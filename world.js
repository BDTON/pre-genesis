import * as THREE from './vendor/three.module.js';
import {FACTIONS as FACTION_RULES, PRODUCTIONS} from './engine.js';
import {artProfile, architectureFor} from './art-direction.js';
import {mythicChampion, mythicCapital} from './mythic-miniatures.js';

// The Pre-Genesis world: one height-mapped terrain mesh, one animated water plane,
// instanced miniatures that share five surface materials, and frames drawn on demand.
const SQRT3 = Math.sqrt(3);
const HEX_INRADIUS = SQRT3 / 2;
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const CAMERA_OFFSET = Object.freeze(new THREE.Vector3(18, 26, 26));
const Y_AXIS = Object.freeze(new THREE.Vector3(0, 1, 0));
const DEFAULT_SPAN = 13.2;
const ICON_SPRITE = 'assets/icons.svg';
const SKY = '#172A4C';

// Render tiers. dpr caps the pixel ratio; activeFps applies while the camera or a
// piece moves and idleFps to the ambient water; foliage scales forest density and
// detail subdivides each hex wedge of the terrain mesh. Shadows are drawn on high only.
export const QUALITY = Object.freeze({
  high: Object.freeze({name: 'high', dpr: 2, shadow: 2048, activeFps: 60, idleFps: 30, foliage: 1, detail: 4}),
  balanced: Object.freeze({name: 'balanced', dpr: 1.5, shadow: 0, activeFps: 60, idleFps: 20, foliage: .6, detail: 3}),
  low: Object.freeze({name: 'low', dpr: 1, shadow: 0, activeFps: 30, idleFps: 0, foliage: .35, detail: 2}),
});
const TIERS = ['low', 'balanced', 'high'];

// Land heights are relative to a water surface at WATER_LEVEL. Relief is the
// amplitude of the rolling noise added on top of each terrain's base elevation.
const WATER_LEVEL = -.07;
const TERRAIN = {
  grass: {elevation: 0, relief: .022, color: '#84985c'},
  forest: {elevation: .03, relief: .03, color: '#5e7747'},
  hills: {elevation: .17, relief: .085, color: '#9c9868'},
  mountain: {elevation: .30, relief: .15, color: '#8f8b81'},
  waste: {elevation: .05, relief: .04, color: '#aa987b'},
  water: {elevation: -.30, relief: .05, color: '#6d8475'},
};
const SAND = new THREE.Color('#d8c8a0');
const ROCK = new THREE.Color('#8a867c');
const SNOW = new THREE.Color('#ecede6');
// Height weights begin at RIM_START (a fraction of the hex inradius) and ease outward.
const RIM_START = .28;

// Corner i of a pointy-top hex of size 1 lies at 30° + 60°·i in the x–z plane.
// Edge i joins corners i and i + 1; EDGE_NEIGHBORS[i] is the axial step across it.
const CORNERS = Array.from({length: 6}, (_, i) => {
  const a = Math.PI / 6 + i * Math.PI / 3;
  return [Math.cos(a), Math.sin(a)];
});
const EDGE_NORMALS = Array.from({length: 6}, (_, i) => {
  const a = Math.PI / 3 + i * Math.PI / 3;
  return [Math.cos(a), Math.sin(a)];
});
const EDGE_NEIGHBORS = [[0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1], [1, 0]];
const HEX_DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

// The four shared art styles keep their original palettes.
const LEGACY_STYLES = {
  michael: {color: '#a5c7ed', cloth: '#315e91', light: '#e6ecd9'},
  ra: {color: '#eac06f', cloth: '#b28a37', light: '#f6dc8f'},
  athena: {color: '#83bbc9', cloth: '#386f94', light: '#e7e4ce'},
  thor: {color: '#8facd1', cloth: '#40577f', light: '#c9dcf2'},
};

// Special colour keys map to a shared surface and its tint. Plain '#rrggbb' keys are matte.
const SURFACE_KEYS = {
  bannerGold: ['metal', '#c9a227'],
  window: ['glow', '#f2cf8c'],
  snow: ['matte', '#eef0ea'],
  water: ['wet', '#2f7f8a'],
  waterShallow: ['wet', '#58a39c'],
  waterDeep: ['wet', '#1f5670'],
  riverLight: ['sheer', '#d8efe9'],
  forgeSmoke: ['sheer', '#4a4f50'],
};
// Per-colour materials for renderer-less builds (the glTF exporter and tests).
const PORTABLE_KEYS = {
  water: {color: '#137d94', roughness: .22, metalness: .08},
  riverLight: {color: '#c8f1e8', roughness: .24, transparent: true, opacity: .42, depthWrite: false},
  waterDeep: {color: '#185d78', roughness: .3, metalness: .05},
  waterShallow: {color: '#48aaae', roughness: .3, metalness: .03},
  window: {color: '#fbd797', emissive: '#d99d40', emissiveIntensity: .7},
  bannerGold: {color: '#d8b469', metalness: .42, roughness: .38},
  snow: {color: '#eff6ef', roughness: .88},
  forgeSmoke: {color: '#454b4c', roughness: 1, transparent: true, opacity: .24, depthWrite: false},
};
// Props smaller than this (in world units) never cast shadows.
const CAST_SHADOW_MIN = .09;

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function randomFor(s) {
  let a = hash(s);
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function worldPosition(tile) {
  return new THREE.Vector3(SQRT3 * (tile.q + tile.r / 2), 0, 1.5 * tile.r);
}
const axialKey = (q, r) => (q + 512) * 1024 + (r + 512);

// Smooth value noise in [0, 1], matching the GLSL valueNoise below.
function latticeHash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = latticeHash(ix, iz), b = latticeHash(ix + 1, iz), c = latticeHash(ix, iz + 1), d = latticeHash(ix + 1, iz + 1);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
function reliefNoise(x, z) {
  return (valueNoise(x * 1.35, z * 1.35) * .65 + valueNoise(x * 3.1 + 7.3, z * 3.1 + 2.9) * .35) * 2 - 1;
}

// Mythology attributes drive champion identity independently of gameplay powers.
const factionVisualCache = new Map();
function factionVisual(id) {
  if (factionVisualCache.has(id)) return factionVisualCache.get(id);
  const rule = FACTION_RULES.find(f => f.id === id);
  const style = rule?.visualStyle || (LEGACY_STYLES[id] ? id : 'michael');
  const base = LEGACY_STYLES[style] || LEGACY_STYLES.michael;
  const color = rule?.color || base.color;
  const cloth = rule?.color ? `#${new THREE.Color(color).multiplyScalar(.56).getHexString()}` : base.cloth;
  const profile = artProfile(id);
  const visual = {
    ...base, id, style, color, profile,
    cloth: LEGACY_STYLES[id] ? cloth : profile.color,
    architecture: architectureFor(rule || id),
  };
  factionVisualCache.set(id, visual);
  return visual;
}

// The plan consumes observed city state only. Housing is a population symbol;
// completed buildings and active work sites each have a separate representation.
export function cityVisualPlan(city, hasIntel = true) {
  const buildings = [...(city.buildings || [])], districts = [...(city.districts || [])].slice(0, 4);
  const item = hasIntel ? PRODUCTIONS.find(p => p.id === city.queue && p.kind !== 'unit' && !buildings.includes(p.id) && !districts.includes(p.id)) : null;
  return {
    buildings, districts,
    housing: Math.min(6, Math.max(0, Math.ceil((Number(city.population) || 0) / 2))),
    construction: item ? {id: item.id, kind: item.kind, stage: Math.min(3, Math.max(0, Math.floor((Number(city.production) || 0) / item.cost * 3)))} : null,
  };
}

export function actorMotionOffset(animation, now, target = new THREE.Vector3()) {
  const t = clamp((now - animation.started) / animation.duration, 0, 1), weight = 1 - t * t * (3 - 2 * t);
  const lift = Math.sin(t * Math.PI) * Math.min(.045, animation.offset.length() * .025);
  return target.copy(animation.offset).multiplyScalar(weight).setY(animation.offset.y * weight + lift);
}

// A continuous height and colour field over the explored hexes. Each hex keeps a
// plateau near its centre; its rim eases toward values shared with its neighbours,
// so edges and corners agree exactly and the mesh has no seams. Unexplored cells
// contribute only a neutral level, never their terrain.
class TerrainField {
  constructor(tiles, {flat = new Set(), tint = () => null} = {}) {
    this.cells = new Map();
    this.corners = new Map();
    this.bounds = {minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity};
    const tintColor = new THREE.Color();
    for (const tile of tiles) {
      const x = SQRT3 * (tile.q + tile.r / 2), z = 1.5 * tile.r;
      this.bounds.minX = Math.min(this.bounds.minX, x - HEX_INRADIUS);
      this.bounds.maxX = Math.max(this.bounds.maxX, x + HEX_INRADIUS);
      this.bounds.minZ = Math.min(this.bounds.minZ, z - 1);
      this.bounds.maxZ = Math.max(this.bounds.maxZ, z + 1);
      const key = axialKey(tile.q, tile.r);
      if (tile.explored === false) {
        this.cells.set(key, null);
        continue;
      }
      const name = TERRAIN[tile.terrain] ? tile.terrain : 'grass', kind = TERRAIN[name];
      const color = new THREE.Color(kind.color);
      const owner = tint(tile);
      if (owner) color.lerp(tintColor.set(owner), .08);
      this.cells.set(key, {
        tile, x, z, color, water: name === 'water',
        elevation: kind.elevation,
        relief: flat.has(tile.id) ? 0 : kind.relief,
      });
    }
    this.scratch = {height: 0, color: null};
  }

  get knownCount() {
    let count = 0;
    for (const cell of this.cells.values()) if (cell) count++;
    return count;
  }

  // Values at corner i of a cell, averaged over the three hexes that share it.
  // Outside the map is open sea; an unexplored hex is sea beside known water and
  // otherwise level ground.
  corner(cell, i) {
    const cx = cell.x + CORNERS[i][0], cz = cell.z + CORNERS[i][1];
    const key = Math.round(cx * 64 + 8192) * 32768 + Math.round(cz * 64 + 8192);
    const cached = this.corners.get(key);
    if (cached) return cached;
    const {q, r} = cell.tile;
    const [aq, ar] = EDGE_NEIGHBORS[(i + 5) % 6], [bq, br] = EDGE_NEIGHBORS[i];
    const around = [cell, this.cells.get(axialKey(q + aq, r + ar)), this.cells.get(axialKey(q + bq, r + br))];
    const wet = around.some(c => c?.water);
    let elevation = 0, relief = 0, known = 0;
    const color = new THREE.Color(0, 0, 0);
    for (const c of around) {
      if (c) {
        elevation += c.elevation;
        relief += c.relief;
        color.add(c.color);
        known++;
      } else if (c === undefined || wet) {
        elevation += TERRAIN.water.elevation;
      }
    }
    // Where land and sea meet, the corner follows the majority so coasts stay joined.
    const land = around.filter(c => c && !c.water).length, sea = around.length - land;
    let level = elevation / 3;
    if (land >= 2 && sea) level = Math.max(level, WATER_LEVEL + .012);
    else if (sea >= 2 && land) level = Math.min(level, WATER_LEVEL - .03);
    const value = {elevation: level, relief: relief / 3, color: color.multiplyScalar(1 / known)};
    this.corners.set(key, value);
    return value;
  }

  // Elevation at the midpoint of edge i, shared by the two hexes on either side.
  edgeMiddle(cell, i) {
    const [dq, dr] = EDGE_NEIGHBORS[i];
    const near = this.cells.get(axialKey(cell.tile.q + dq, cell.tile.r + dr));
    if (near) return (cell.elevation + near.elevation) / 2;
    const other = near === undefined || cell.water ? TERRAIN.water.elevation : 0;
    return (cell.elevation + other) / 2;
  }

  // t is the hex distance from the centre (1 on the edge); s runs from corner i to i + 1.
  sample(cell, i, t, s, x, z, out, edgeColor) {
    const a = this.corner(cell, i), b = this.corner(cell, (i + 1) % 6);
    const w = t <= RIM_START ? 0 : ((t - RIM_START) / (1 - RIM_START)) ** 2;
    // A quadratic through both corners and the edge midpoint.
    const m = this.edgeMiddle(cell, i);
    const edgeElevation = a.elevation * (1 - s) * (1 - 2 * s) + 4 * m * s * (1 - s) + b.elevation * s * (2 * s - 1);
    const edgeRelief = a.relief + (b.relief - a.relief) * s;
    const relief = (cell.relief + (edgeRelief - cell.relief) * w) * (.3 + .7 * smoothstep(.1, .7, t));
    out.height = cell.elevation + (edgeElevation - cell.elevation) * w + reliefNoise(x, z) * relief;
    if (out.color) out.color.copy(cell.color).lerp(edgeColor.copy(a.color).lerp(b.color, s), w);
    return out;
  }

  cellAt(x, z) {
    const r = z / 1.5, q = x / SQRT3 - r / 2, s = -q - r;
    let rq = Math.round(q), rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    return this.cells.get(axialKey(rq, rr));
  }

  // Terrain height at a world point: a number on explored land, null over an
  // unexplored hex and undefined outside the map.
  heightAt(x, z) {
    const cell = this.cellAt(x, z);
    if (!cell) return cell;
    const dx = x - cell.x, dz = z - cell.z;
    let angle = Math.atan2(dz, dx) - Math.PI / 6;
    angle -= Math.floor(angle / TAU) * TAU;
    const i = Math.min(5, Math.floor(angle / (Math.PI / 3)));
    const [nx, nz] = EDGE_NORMALS[i];
    const t = clamp((dx * nx + dz * nz) / HEX_INRADIUS, 0, 1);
    let s = .5;
    if (t > 1e-6) {
      const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
      s = clamp((dx / t - ax) * (bx - ax) + (dz / t - az) * (bz - az), 0, 1);
    }
    this.scratch.color = null;
    return this.sample(cell, i, t, s, x, z, this.scratch).height;
  }

  // One indexed mesh for every explored hex; vertices on shared edges are welded.
  buildGeometry(detail) {
    const n = Math.max(1, detail), positions = [], colors = [], index = [], lookup = new Map();
    const out = {height: 0, color: new THREE.Color()}, edgeColor = new THREE.Color();
    const rowStart = [];
    for (let a = 0, offset = 0; a <= n; a++) {
      rowStart.push(offset);
      offset += n - a + 1;
    }
    const ids = [];
    for (const cell of this.cells.values()) {
      if (!cell) continue;
      for (let i = 0; i < 6; i++) {
        const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
        ids.length = 0;
        for (let a = 0; a <= n; a++) for (let c = 0; c <= n - a; c++) {
          const x = cell.x + (ax * a + bx * c) / n, z = cell.z + (az * a + bz * c) / n;
          const key = Math.round(x * 256 + 16384) * 65536 + Math.round(z * 256 + 16384);
          let id = lookup.get(key);
          if (id === undefined) {
            this.sample(cell, i, (a + c) / n, a + c ? c / (a + c) : .5, x, z, out, edgeColor);
            id = positions.length / 3;
            positions.push(x, out.height, z);
            colors.push(out.color.r, out.color.g, out.color.b);
            lookup.set(key, id);
          }
          ids.push(id);
        }
        const at = (a, c) => ids[rowStart[a] + c];
        for (let a = 0; a < n; a++) for (let c = 0; c < n - a; c++) {
          index.push(at(a, c), at(a, c + 1), at(a + 1, c));
          if (c < n - a - 1) index.push(at(a + 1, c), at(a, c + 1), at(a + 1, c + 1));
        }
      }
    }
    if (!index.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    // Beaches at the waterline, bare rock on steep slopes and snow on the highest ground.
    const normals = geometry.attributes.normal, color = new THREE.Color();
    for (let v = 0; v < positions.length / 3; v++) {
      const y = positions[v * 3 + 1], slope = 1 - normals.getY(v);
      color.fromArray(colors, v * 3);
      color.lerp(SAND, smoothstep(WATER_LEVEL + .05, WATER_LEVEL + .008, y) * .9);
      color.lerp(ROCK, smoothstep(.16, .42, slope) * .75);
      color.lerp(SNOW, smoothstep(.40, .52, y));
      color.toArray(colors, v * 3);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  // Seabed data for the water shader. R encodes height in [-0.6, 0.6]; G marks
  // explored hexes, so foam and grid lines never reveal unexplored coasts; B is 1
  // over explored hexes and falls to 0 within three units, where the sea meets the sky.
  seabed(size = 128) {
    const {minX, maxX, minZ, maxZ} = this.bounds;
    const extent = Math.max(maxX - minX, maxZ - minZ) + 8;
    const rect = {x: (minX + maxX) / 2 - extent / 2, z: (minZ + maxZ) / 2 - extent / 2, size: extent};
    const data = new Uint8Array(size * size * 4), distance = new Float32Array(size * size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const height = this.heightAt(rect.x + (i + .5) / size * extent, rect.z + (j + .5) / size * extent);
      const known = typeof height === 'number', o = (j * size + i) * 4;
      data[o] = Math.round(clamp(((known ? height : -.6) + .6) / 1.2, 0, 1) * 255);
      data[o + 1] = known ? 255 : 0;
      data[o + 3] = 255;
      distance[j * size + i] = known ? 0 : Infinity;
    }
    // Two-pass chamfer distance (in texels) from the explored hexes.
    const relax = (index, from, cost) => {
      if (distance[from] + cost < distance[index]) distance[index] = distance[from] + cost;
    };
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const index = j * size + i;
      if (i > 0) relax(index, index - 1, 1);
      if (j > 0) {
        relax(index, index - size, 1);
        if (i > 0) relax(index, index - size - 1, 1.414);
        if (i < size - 1) relax(index, index - size + 1, 1.414);
      }
    }
    for (let j = size - 1; j >= 0; j--) for (let i = size - 1; i >= 0; i--) {
      const index = j * size + i;
      if (i < size - 1) relax(index, index + 1, 1);
      if (j < size - 1) {
        relax(index, index + size, 1);
        if (i < size - 1) relax(index, index + size + 1, 1.414);
        if (i > 0) relax(index, index + size - 1, 1.414);
      }
    }
    const texel = extent / size;
    for (let index = 0; index < size * size; index++) {
      data[index * 4 + 2] = Math.round(clamp(1 - distance[index] * texel / 3, 0, 1) ** 1.5 * 255);
    }
    return {data, rect, size};
  }
}

class ModelBatch {
  constructor(view) {
    this.view = view;
    this.entries = new Map();
    this.origin = new THREE.Vector3();
    this.factor = 1;
    this.rotation = 0;
    this.portable = view.usesPortableMaterials();
  }

  at(x, y, z, scale = 1, rotation = 0) {
    this.origin.set(x, y, z);
    this.factor = scale;
    this.rotation = rotation;
    return this;
  }

  add(geometry, material, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
    const g = this.view.geometry[geometry], f = this.factor;
    let mat = material, color = null;
    if (typeof material === 'string') {
      if (this.portable) mat = this.view.material(material);
      else ({surface: mat, color} = this.view.surfaceFor(material));
    }
    const cast = Math.max(sx, sy, sz) * f > CAST_SHADOW_MIN;
    const key = `${g.uuid}:${mat.uuid}:${cast ? 1 : 0}`;
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {geometry: g, material: mat, cast, matrices: [], colors: [], tileIds: [], actorIds: []};
      this.entries.set(key, entry);
    }
    const c = Math.cos(this.rotation), s = Math.sin(this.rotation);
    const obj = this.view.dummy;
    obj.position.set(this.origin.x + (x * c + z * s) * f, this.origin.y + y * f, this.origin.z + (z * c - x * s) * f);
    obj.scale.set(sx * f, sy * f, sz * f);
    obj.rotation.set(rx, ry + this.rotation, rz);
    obj.updateMatrix();
    entry.matrices.push(obj.matrix.clone());
    entry.colors.push(color);
    entry.tileIds.push(this.tileId || null);
    entry.actorIds.push(this.actorId || null);
  }

  finish() {
    const group = new THREE.Group();
    for (const e of this.entries.values()) {
      const mesh = new THREE.InstancedMesh(e.geometry, e.material, e.matrices.length);
      e.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      if (e.colors[0]) e.colors.forEach((color, i) => mesh.setColorAt(i, color));
      mesh.castShadow = e.cast && !e.material.transparent;
      mesh.receiveShadow = !e.material.transparent;
      mesh.userData.tileIds = e.tileIds;
      mesh.userData.actorIds = e.actorIds;
      mesh.userData.baseMatrices = e.matrices;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    return group;
  }
}

const NOISE_GLSL = `
float pgHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pgHash(i), pgHash(i + vec2(1.0, 0.0)), f.x), mix(pgHash(i + vec2(0.0, 1.0)), pgHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Hex distance from the nearest tile centre: 0 at the centre, 1 on the edge.
float hexDistance(vec2 p) {
  float r = p.y / 1.5;
  float q = p.x / 1.7320508 - r * 0.5;
  vec3 cube = vec3(q, r, -q - r);
  vec3 rounded = floor(cube + 0.5);
  vec3 delta = abs(rounded - cube);
  if (delta.x > delta.y && delta.x > delta.z) rounded.x = -rounded.y - rounded.z;
  else if (delta.y > delta.z) rounded.y = -rounded.x - rounded.z;
  vec2 d = abs(p - vec2(1.7320508 * (rounded.x + rounded.y * 0.5), 1.5 * rounded.y));
  return max(d.x, dot(d, vec2(0.5, 0.8660254))) / 0.8660254;
}
float hexLine(vec2 p) {
  float t = hexDistance(p);
  return 1.0 - smoothstep(0.0, 1.25, (1.0 - t) / max(fwidth(t), 1e-4));
}
`;

const WATER_VERTEX = `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWaterWorld;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWaterWorld = worldPosition.xyz;
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FRAGMENT = `
#include <common>
#include <fog_pars_fragment>
uniform float time;
uniform sampler2D seabed;
uniform vec3 seabedRect;
uniform vec3 shallowColor;
uniform vec3 deepColor;
uniform vec3 foamColor;
uniform vec3 horizonColor;
uniform vec3 sunDirection;
uniform vec3 viewDirection;
uniform float gridStrength;
varying vec3 vWaterWorld;
${NOISE_GLSL}
void main() {
  vec2 p = vWaterWorld.xz;
  vec2 uv = (p - seabedRect.xy) / seabedRect.z;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  vec4 bed = texture2D(seabed, clamp(uv, 0.0, 1.0));
  float ground = mix(-0.6, bed.r * 1.2 - 0.6, inside);
  float depth = ${WATER_LEVEL.toFixed(3)} - ground;
  float known = bed.g * inside;
  vec3 color = mix(shallowColor, deepColor, smoothstep(0.015, 0.26, depth));
  // Two slow swells give the surface a directional sheen.
  float s1 = dot(p, vec2(0.83, 0.56)) * 2.3 + time * 0.55;
  float s2 = dot(p, vec2(-0.42, 0.91)) * 3.4 - time * 0.72;
  float swell = 0.014 + 0.012 * valueNoise(p * 0.7 + time * 0.03);
  vec2 slope = (vec2(0.83, 0.56) * cos(s1) * 2.3 + vec2(-0.42, 0.91) * cos(s2) * 2.04) * swell;
  vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
  float light = 0.86 + 0.14 * max(dot(normal, sunDirection), 0.0);
  float glint = pow(max(dot(reflect(-sunDirection, normal), viewDirection), 0.0), 120.0);
  color = color * light + vec3(1.0, 0.94, 0.82) * glint * 0.3;
  // Foam traces explored shores only.
  float shore = 1.0 - smoothstep(0.0, 0.055, depth);
  float surge = 0.5 + 0.5 * sin(depth * 110.0 - time * 1.4 + valueNoise(p * 5.0) * 4.0);
  float foam = known * clamp(shore * (0.3 + 0.7 * surge) + 1.0 - smoothstep(0.0, 0.012, depth), 0.0, 1.0);
  color = mix(color, foamColor, foam * 0.7);
  color = mix(color, deepColor * 0.55, hexLine(p) * gridStrength * known * 0.7);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
  float horizon = 1.0 - bed.b * inside;
  #ifdef USE_FOG
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, horizon);
  #else
    gl_FragColor.rgb = mix(gl_FragColor.rgb, horizonColor, horizon);
  #endif
}`;

const VEIL_VERTEX = `
#include <common>
#include <fog_pars_vertex>
attribute float rim;
varying vec2 vVeil;
varying float vRim;
void main() {
  vVeil = position.xz;
  vRim = rim;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

// Unexplored land lies under a lapis night with faint engraved hatching; a thin
// mist rule marks where the known world ends. Only coordinates reach this shader.
const VEIL_FRAGMENT = `
#include <common>
#include <fog_pars_fragment>
uniform float time;
uniform vec3 night;
uniform vec3 mist;
uniform vec3 rule;
varying vec2 vVeil;
varying float vRim;
${NOISE_GLSL}
void main() {
  vec2 p = vVeil * 0.22 + vec2(time * 0.004, -time * 0.003);
  float cloud = valueNoise(p) * 0.6 + valueNoise(p * 2.3 + 7.1) * 0.28 + valueNoise(p * 5.1 + 3.3) * 0.12;
  vec3 color = mix(night, mist, smoothstep(0.35, 0.9, cloud) * 0.5);
  float u = (vVeil.x + vVeil.y) * 3.2;
  float hatch = 1.0 - smoothstep(0.0, fwidth(u) * 1.2, 0.5 - abs(fract(u) - 0.5));
  color = mix(color, mist, hatch * 0.08);
  color = mix(color, mist, smoothstep(0.55, 1.0, vRim) * 0.14);
  color = mix(color, rule, smoothstep(1.0 - fwidth(vRim) * 1.6, 1.0, vRim) * 0.6);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// Fallback label styles; hud.css restyles the same classes under its .world prefix.
const WORLD_STYLES = `
#world canvas:focus-visible{outline:2px solid var(--gold-leaf,#C9A227);outline-offset:-2px}
.world-label-layer[hidden]{display:none}
.world-graphics-status{position:absolute;z-index:4;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100% - 32px));padding:20px;background:var(--lapis,#172A4C);border:1px solid var(--mist,#A9B4C8);border-radius:4px;color:var(--limewash,#EFE7D6);text-align:center;font:400 14px/1.5 var(--font-text,system-ui,sans-serif);box-shadow:var(--shadow-float)}
.world-city-label{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;white-space:nowrap;pointer-events:auto;cursor:pointer;will-change:transform}
.world-city-name{display:flex;align-items:center;gap:6px;max-width:200px;padding:3px 10px 3px 4px;border:1px solid var(--faction);border-radius:4px;background:var(--lapis-night,#0F1A30);color:var(--limewash,#EFE7D6);font:700 14px/1.2 var(--font-text,system-ui,sans-serif)}
.world-city-name>span:last-child{overflow:hidden;text-overflow:ellipsis}
.world-city-pop{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 4px;border-radius:4px;background:var(--faction);color:var(--ink,#14110D);font:700 12px/1 var(--font-text,system-ui,sans-serif);font-variant-numeric:tabular-nums}
.world-city-stem{width:1px;height:10px;background:var(--faction)}
.world-label-hp{width:78%;height:3px;margin-top:2px;overflow:hidden;border-radius:6px;background:var(--lapis-night,#0F1A30)}
.world-label-hp span{display:block;height:100%;background:var(--faction)}
.world-unit-label{position:absolute;left:0;top:0;display:grid;place-items:center;width:28px;height:28px;padding:0;border:1.5px solid var(--faction);border-radius:50%;background:var(--lapis-night,#0F1A30);color:var(--limewash,#EFE7D6);pointer-events:auto;cursor:pointer;will-change:transform}
.world-unit-label .icon{width:16px;height:16px}
.world-unit-hp{position:absolute;bottom:-6px;left:50%;width:18px;height:3px;overflow:hidden;transform:translateX(-50%);border-radius:6px;background:var(--lapis-raised,#1E365F)}
.world-unit-hp span{display:block;height:100%;background:var(--faction)}
.world-unit-label[data-exhausted='true']{opacity:.6}
.world-unit-label[data-army='true']{border-width:2px;border-radius:6px}
.world-unit-label:focus-visible,.world-city-label:focus-visible{outline:2px solid var(--gold-leaf,#C9A227);outline-offset:2px}
.world-army-badge{position:absolute;top:-8px;right:-10px;min-width:20px;padding:0 4px;border-radius:4px;background:var(--limewash,#EFE7D6);color:var(--ink,#14110D);font:700 12px/16px var(--font-text,system-ui,sans-serif);pointer-events:none}
.world-city-label:hover .world-city-name,.world-unit-label:hover{background:var(--lapis-raised,#1E365F)}
@media (pointer:coarse){.world-unit-label::before{content:'';position:absolute;inset:-9px}}
`;

const CANVAS_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave', 'contextmenu', 'wheel', 'webglcontextlost', 'webglcontextrestored'];
const WINDOW_EVENTS = ['keydown', 'keyup', 'blur'];
const scratchVector = new THREE.Vector3();
const scratchOffset = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();

export class WorldView {
  constructor(container, {onTileClick, onTileHover, onUnitClick} = {}) {
    this.container = container;
    this.onTileClick = onTileClick;
    this.onTileHover = onTileHover;
    this.onUnitClick = onUnitClick;
    this.tileMap = new Map();
    this.labels = [];
    this.materialCache = new Map();
    this.geometry = {};
    this.dummy = new THREE.Object3D();
    this.target = new THREE.Vector3();
    this.targetGoal = new THREE.Vector3();
    this.span = DEFAULT_SPAN;
    this.spanGoal = DEFAULT_SPAN;
    this.azimuth = 0;
    this.azimuthGoal = 0;
    this.keys = new Set();
    this.lastTime = performance.now();
    this.lastRenderedAt = 0;
    this.pointer = new THREE.Vector2(-10, -10);
    this.raycaster = new THREE.Raycaster();
    this.labelsEnabled = true;
    this.disposed = false;
    this.currentHovered = null;
    this.drag = null;
    this.frame = null;
    this.idleTimer = 0;
    this.needsRender = true;
    this.paused = false;
    this.showcase = null;
    this.motionTime = 0;
    this.stats = {calls: 0, triangles: 0, fps: 0};
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    this.highContrast = false;
    this.touchUi = !!window.matchMedia?.('(pointer: coarse)').matches;
    this.compactGraphics = this.touchUi && window.innerWidth <= 900;
    this.contextLost = false;
    this.quality = QUALITY.balanced;
    this.qualitySetting = 'auto';
    this.dprTrim = 0;
    // Preserve the app's absolute layout; establish a stacking context so map labels
    // cannot cover its menus, objectives, or other HUD panels.
    if (getComputedStyle(this.container).position === 'static') this.container.style.position = 'relative';
    Object.assign(this.container.style, {overflow: 'hidden', isolation: 'isolate', zIndex: '0'});
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 46, 124);
    this.camera = new THREE.OrthographicCamera(-20, 20, 13, -13, .1, 140);
    try {
      this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, stencil: false, powerPreference: this.touchUi ? 'low-power' : 'default'});
    } catch (error) {
      const fallback = document.createElement('div');
      fallback.className = 'world-webgl-error';
      fallback.style.cssText = 'position:absolute;inset:0;display:grid;place-content:center;padding:32px;background:#0F1A30;color:#EFE7D6;text-align:center;font:400 16px/1.5 var(--font-text,system-ui,sans-serif)';
      fallback.textContent = 'Turn on graphics acceleration, then reload.';
      this.container.appendChild(fallback);
      this.error = error;
      return;
    }
    const renderer = this.renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // The board is static: shadows are redrawn only when terrain or pieces change.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Map. Select a tile. Drag or use W, A, S and D to pan; scroll or pinch to zoom.');
    this.container.appendChild(renderer.domElement);
    this.overlay = document.createElement('div');
    this.overlay.className = 'world-label-layer';
    this.overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2';
    this.container.appendChild(this.overlay);
    this.graphicsStatus = document.createElement('div');
    this.graphicsStatus.className = 'world-graphics-status';
    this.graphicsStatus.hidden = true;
    this.graphicsStatus.setAttribute('role', 'status');
    this.graphicsStatus.setAttribute('aria-live', 'polite');
    this.graphicsStatus.setAttribute('aria-atomic', 'true');
    this.container.appendChild(this.graphicsStatus);

    this.installStyles();
    this.createGeometry();
    this.createSurfaces();
    this.createEnvironment();
    this.createLighting();
    this.createWater();
    this.createHighlights();

    this.animate = this.animate.bind(this);
    this.events = {
      pointerdown: e => this.pointerDown(e),
      pointermove: e => this.pointerMove(e),
      pointerup: e => this.pointerUp(e),
      pointercancel: e => this.pointerUp({...e, pointerId: e.pointerId, cancelled: true}),
      pointerleave: () => { if (!this.drag) this.clearHover(); },
      contextmenu: e => e.preventDefault(),
      wheel: e => {
        e.preventDefault();
        if (!this.showcase) this.zoom(-e.deltaY * .008);
      },
      keydown: e => {
        if (!this.canKeyboardPan() || e.altKey || e.ctrlKey || e.metaKey) return;
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd'].includes(key)) {
          this.keys.add(key);
          e.preventDefault();
          this.requestRender();
        }
      },
      keyup: e => this.keys.delete(e.key.toLowerCase()),
      blur: () => this.keys.clear(),
      webglcontextlost: e => this.handleContextLost(e),
      webglcontextrestored: () => this.handleContextRestored(),
      visibilitychange: () => this.handleVisibility(),
      pixelratio: () => this.watchPixelRatio(),
    };
    for (const type of CANVAS_EVENTS) renderer.domElement.addEventListener(type, this.events[type], {passive: false});
    for (const type of WINDOW_EVENTS) window.addEventListener(type, this.events[type]);
    document.addEventListener('visibilitychange', this.events.visibilitychange);
    this.watchPixelRatio();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.setQuality('auto');
  }

  installStyles() {
    if (document.getElementById('realm-world-styles')) return;
    const style = document.createElement('style');
    style.id = 'realm-world-styles';
    style.textContent = WORLD_STYLES;
    document.head.appendChild(style);
  }

  // Quality -------------------------------------------------------------------

  tier() {
    return this.quality || QUALITY.high;
  }

  setQuality(name = 'auto') {
    this.qualitySetting = QUALITY[name] ? name : 'auto';
    const tier = this.qualitySetting === 'auto' ? this.autoTier() : this.qualitySetting;
    this.qualityCeiling = TIERS.indexOf(tier);
    this.adaptive = {average: 0, slow: 0, fast: 0, changedAt: performance.now(), raised: 0, locked: false};
    this.applyQuality(tier);
  }

  // Phones and small machines start balanced; frame timing then refines the choice.
  autoTier() {
    const memory = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
    if (memory <= 2 || cores <= 2) return 'low';
    if (this.touchUi || memory <= 4 || cores <= 4) return 'balanced';
    return 'high';
  }

  applyQuality(name) {
    const previous = this.quality;
    this.quality = QUALITY[name] || QUALITY.balanced;
    this.dprTrim = 0;
    if (!this.renderer) return;
    this.applyPixelRatio();
    const size = this.quality.shadow;
    this.sun.castShadow = size > 0;
    if (size && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.renderer.shadowMap.needsUpdate = true;
    const rebuild = previous && previous !== this.quality && (previous.foliage !== this.quality.foliage || previous.detail !== this.quality.detail);
    if (rebuild && this.state) this.update(this.state, this.lastUpdateOptions);
    this.resize();
  }

  applyPixelRatio() {
    const cap = Math.max(1, this.quality.dpr - this.dprTrim);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  }

  // Re-apply the pixel ratio when the window moves to a screen with another density.
  watchPixelRatio() {
    this.pixelRatioQuery?.removeEventListener?.('change', this.events.pixelratio);
    if (this.disposed || !window.matchMedia) return;
    this.pixelRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.pixelRatioQuery.addEventListener?.('change', this.events.pixelratio);
    if (this.renderer && this.sun) {
      this.applyPixelRatio();
      this.resize();
    }
  }

  // Automatic quality steps down after 90 slow frames (first by trimming the pixel
  // ratio, then by tier) and back up after 10 s of smooth motion, never above the
  // starting tier. A tier that proved too slow after being raised stays down.
  adapt(now, interval) {
    if (this.qualitySetting !== 'auto') return;
    const a = this.adaptive, budget = 1000 / this.quality.activeFps;
    a.average = a.average ? a.average * .95 + interval * .05 : interval;
    if (now - a.changedAt < 4000) return;
    a.slow = a.average > budget * 1.45 ? a.slow + 1 : 0;
    a.fast = a.average < budget * 1.12 ? a.fast + interval : 0;
    if (a.slow >= 90) this.stepQuality(-1, now);
    else if (a.fast > 10000 && !a.locked && now - a.changedAt > 20000) this.stepQuality(1, now);
  }

  stepQuality(direction, now) {
    const a = this.adaptive, index = TIERS.indexOf(this.quality.name);
    Object.assign(a, {average: 0, slow: 0, fast: 0, changedAt: now});
    if (direction < 0) {
      if (this.quality.dpr - this.dprTrim > 1 && (window.devicePixelRatio || 1) > 1) {
        this.dprTrim += .25;
        this.applyPixelRatio();
        this.resize();
      } else if (index > 0) {
        if (a.raised) a.locked = true;
        this.applyQuality(TIERS[index - 1]);
      }
    } else if (this.dprTrim > 0) {
      this.dprTrim -= .25;
      a.raised++;
      this.applyPixelRatio();
      this.resize();
    } else if (index < this.qualityCeiling) {
      a.raised++;
      this.applyQuality(TIERS[index + 1]);
    }
  }

  // Frame scheduling ----------------------------------------------------------

  requestRender() {
    this.needsRender = true;
    this.wake();
  }

  wake() {
    if (this.frame != null || !this.renderer || this.disposed || this.contextLost || this.paused) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (typeof requestAnimationFrame !== 'function') return;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = 0;
    }
    this.frame = requestAnimationFrame(this.animate);
  }

  sleep() {
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = 0;
  }

  // Idle frames are timed with setTimeout so the page does not wake at display rate.
  scheduleIdle(delay) {
    if (this.idleTimer || this.frame != null) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = 0;
      this.wake();
    }, Math.max(0, delay));
  }

  setPaused(paused) {
    this.paused = !!paused;
    if (this.paused) this.sleep();
    else {
      this.lastTime = performance.now();
      this.requestRender();
    }
  }

  handleVisibility() {
    if (document.hidden) this.sleep();
    else {
      this.lastTime = performance.now();
      this.requestRender();
    }
  }

  // Camera easing counts as motion, except the showcase drift, which is ambient.
  isMoving() {
    if (this.keys.size > 0 || this.drag?.moved || this.pinch || this.actorAnimations?.size > 0) return true;
    return !this.showcase && (this.target.distanceToSquared(this.targetGoal) > 1e-6
      || Math.abs(this.span - this.spanGoal) > 1e-4
      || Math.abs(this.azimuth - this.azimuthGoal) > 1e-4);
  }

  ambientFps() {
    if (this.reducedMotion) return 0;
    if (this.showcase) return this.touchUi ? 24 : 30;
    return this.quality.idleFps;
  }

  animate(now) {
    this.frame = null;
    if (this.disposed || this.contextLost || this.paused || !this.renderer) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const moving = this.isMoving(), ambient = this.ambientFps();
    const fps = moving ? this.quality.activeFps : ambient;
    if (!fps && !this.needsRender) return;
    const interval = 1000 / (fps || this.quality.activeFps), elapsed = now - this.lastRenderedAt;
    if (!this.needsRender && elapsed < interval - 1.5) {
      if (moving) this.frame = requestAnimationFrame(this.animate);
      else this.scheduleIdle(interval - elapsed - 4);
      return;
    }
    if (moving && this.lastRenderMoving && elapsed < 250) this.adapt(now, elapsed);
    this.lastRenderMoving = moving;
    this.lastRenderedAt = now;
    this.needsRender = false;
    const dt = Math.min((now - this.lastTime) / 1000, .05);
    this.lastTime = now;
    this.step(dt, now);
    this.renderer.render(this.scene, this.camera);
    this.recordFrame(now);
    if (this.frame != null) return;
    if (this.needsRender || this.isMoving()) this.frame = requestAnimationFrame(this.animate);
    else if (ambient) this.scheduleIdle(1000 / ambient - 4);
  }

  step(dt, now) {
    if (!this.canKeyboardPan()) this.keys.clear();
    let dx = 0, dy = 0;
    if (this.keys.has('a')) dx += 1;
    if (this.keys.has('d')) dx -= 1;
    if (this.keys.has('w')) dy += 1;
    if (this.keys.has('s')) dy -= 1;
    if (dx || dy) this.pan(dx * dt * 500, dy * dt * 500);
    if (!this.reducedMotion) this.motionTime += dt;
    if (this.showcase && !this.reducedMotion) {
      const s = this.showcase, t = (s.time += dt);
      this.azimuthGoal = this.azimuth = Math.sin(t * TAU / 90) * .42;
      if (s.base) this.targetGoal.set(s.base.x + Math.sin(t * .05) * .6, 0, s.base.z + Math.cos(t * .04) * .45);
    }
    const ease = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
    let cameraMoved = false;
    if (!this.target.equals(this.targetGoal)) {
      this.target.lerp(this.targetGoal, ease);
      if (this.target.distanceToSquared(this.targetGoal) < 1e-6) this.target.copy(this.targetGoal);
      cameraMoved = true;
    }
    if (this.span !== this.spanGoal) {
      this.span += (this.spanGoal - this.span) * ease;
      if (Math.abs(this.span - this.spanGoal) < 1e-4) this.span = this.spanGoal;
      cameraMoved = true;
    }
    if (this.azimuth !== this.azimuthGoal) {
      this.azimuth += (this.azimuthGoal - this.azimuth) * ease;
      if (Math.abs(this.azimuth - this.azimuthGoal) < 1e-4) this.azimuth = this.azimuthGoal;
      cameraMoved = true;
    }
    if (cameraMoved || this.showcase) this.updateCamera();
    if (cameraMoved) this.labelsDirty = true;
    if (this.actorAnimations?.size) {
      this.animatePieces(now);
      this.labelsDirty = true;
    }
    if (this.pendingHover) {
      const event = this.pendingHover;
      this.pendingHover = null;
      this.applyHover(this.pick(event));
    }
    if (this.water) this.water.material.uniforms.time.value = this.motionTime;
    if (this.fogVeil) this.fogVeil.material.uniforms.time.value = this.motionTime;
    if (this.labelsDirty) this.updateLabels();
  }

  recordFrame(now) {
    const info = this.renderer.info.render;
    this.stats.calls = info.calls;
    this.stats.triangles = info.triangles;
    this.perfFrames = (this.perfFrames || 0) + 1;
    if (!this.perfSince) this.perfSince = now;
    if (now - this.perfSince > 2000) {
      this.stats.fps = Math.round(this.perfFrames * 1000 / (now - this.perfSince));
      this.renderer.domElement.dataset.performance = JSON.stringify({
        fps: this.stats.fps, drawCalls: info.calls, triangles: info.triangles,
        quality: this.quality.name, pixelRatio: this.renderer.getPixelRatio(),
      });
      this.perfFrames = 0;
      this.perfSince = now;
    }
  }

  // Main-pass figures from the last frame; fps is 0 while the map is at rest.
  getStats() {
    const resting = performance.now() - this.lastRenderedAt > 2500;
    return {
      calls: this.stats?.calls ?? 0,
      triangles: this.stats?.triangles ?? 0,
      fps: resting ? 0 : this.stats?.fps ?? 0,
      quality: this.quality?.name,
      setting: this.qualitySetting,
      pixelRatio: this.renderer?.getPixelRatio?.() ?? 1,
    };
  }

  // Upper bound on main-pass draw calls and triangles, counted from the scene graph.
  sceneBudget() {
    let calls = 0, triangles = 0, instances = 0, shadowCasters = 0;
    this.scene.traverseVisible(object => {
      if (!(object.isMesh || object.isLine || object.isPoints)) return;
      const count = object.isInstancedMesh ? object.count : 1;
      if (!count || object.material?.visible === false) return;
      calls++;
      instances += count;
      if (object.castShadow) shadowCasters++;
      if (!object.isMesh) return;
      const geometry = object.geometry;
      const vertices = geometry.index ? geometry.index.count : geometry.attributes.position.count;
      triangles += vertices / 3 * count;
    });
    return {calls, triangles: Math.round(triangles), instances, shadowCasters};
  }

  // Geometry and materials ----------------------------------------------------

  createGeometry() {
    this.geometry = {
      hex: new THREE.CylinderGeometry(1.002, 1.002, 1, 6),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
      taper: new THREE.CylinderGeometry(.65, 1, 1, 6),
      taper4: new THREE.CylinderGeometry(.72, 1, 1, 4),
      cone: new THREE.ConeGeometry(1, 1, 7),
      cone4: new THREE.ConeGeometry(1, 1, 4),
      box: new THREE.BoxGeometry(1, 1, 1),
      rock: new THREE.IcosahedronGeometry(1, 0),
      sphere: new THREE.SphereGeometry(1, 8, 6),
      leaf: new THREE.IcosahedronGeometry(1, 1),
      torus: new THREE.TorusGeometry(1, .12, 4, 12),
      disc: new THREE.CylinderGeometry(1, 1, 1, 12),
      bough: new THREE.ConeGeometry(1, 1, 8, 2),
    };
    // Shared architectural silhouettes export exactly as they appear in play.
    const gable = new THREE.Shape();
    gable.moveTo(-.5, -.5);
    gable.lineTo(.5, -.5);
    gable.lineTo(0, .5);
    gable.closePath();
    this.geometry.gable = new THREE.ExtrudeGeometry(gable, {depth: 1, bevelEnabled: false, steps: 1});
    this.geometry.gable.translate(0, 0, -.5);
    const arch = new THREE.Shape();
    arch.moveTo(-.5, -.5);
    arch.lineTo(-.5, .08);
    arch.quadraticCurveTo(-.5, .31, 0, .5);
    arch.quadraticCurveTo(.5, .31, .5, .08);
    arch.lineTo(.5, -.5);
    arch.lineTo(.32, -.5);
    arch.lineTo(.32, .07);
    arch.quadraticCurveTo(.32, .22, 0, .35);
    arch.quadraticCurveTo(-.32, .22, -.32, .07);
    arch.lineTo(-.32, -.5);
    arch.closePath();
    this.geometry.arch = new THREE.ExtrudeGeometry(arch, {depth: .12, bevelEnabled: false, curveSegments: 4, steps: 1});
    this.geometry.arch.translate(0, 0, -.06);
    this.geometry.hill = this.createHill(12, 5);
    this.geometry.mountainRock = this.createPeak(false);
    this.geometry.snowPeak = this.createPeak(true);
    // Irregular foliage with welded normals keeps soft lighting at low polygon counts.
    const leaf = this.geometry.leaf.attributes.position;
    for (let i = 0; i < leaf.count; i++) {
      const x = leaf.getX(i), y = leaf.getY(i), z = leaf.getZ(i);
      const variation = 1 + .07 * Math.sin(x * 11 + y * 7 + z * 3) + .042 * Math.cos(z * 13 - x * 5);
      leaf.setXYZ(i, x * variation, y * variation, z * variation);
    }
    weldNormals(this.geometry.leaf);
    // Faceted rocks keep their flat normals.
    const rock = this.geometry.rock.attributes.position;
    for (let i = 0; i < rock.count; i++) {
      const x = rock.getX(i), y = rock.getY(i), z = rock.getZ(i);
      const variation = 1 + .09 * Math.sin(x * 5 + y * 3 + z * 7);
      rock.setXYZ(i, x * variation, y * variation * .85, z * variation);
    }
    this.geometry.rock.computeVertexNormals();
    const branches = this.geometry.bough.attributes.position;
    for (let i = 0; i < branches.count; i++) {
      const x = branches.getX(i), y = branches.getY(i), z = branches.getZ(i), a = Math.atan2(z, x);
      const r = 1 + .13 * Math.sin(a * 6) + .08 * Math.cos(a * 3 + y * 8);
      branches.setXYZ(i, x * r, y + .045 * Math.sin(a * 7) * (1 - (y + .5)), z * r);
    }
    this.geometry.bough.computeVertexNormals();
    // A baked occlusion ramp darkens the lower part of every shape; instance colours multiply it.
    for (const [name, geometry] of Object.entries(this.geometry)) {
      const position = geometry.attributes.position, shade = new Float32Array(position.count * 3), floor = name === 'hill' ? .88 : .62;
      for (let i = 0; i < position.count; i++) shade.fill(floor + (1 - floor) * smoothstep(-.5, .3, position.getY(i)), i * 3, i * 3 + 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(shade, 3));
    }
  }

  createHill(segments, rings) {
    const positions = [];
    const point = (a, t) => {
      const r = 1 - t, y = Math.pow(Math.max(0, 1 - r * r), 2.25);
      return [Math.cos(a) * r, y - .5, Math.sin(a) * r];
    };
    for (let ring = 0; ring < rings; ring++) for (let side = 0; side < segments; side++) {
      const a = side / segments * TAU, b = (side + 1) / segments * TAU, t = ring / rings, u = (ring + 1) / rings;
      positions.push(...point(a, t), ...point(a, u), ...point(b, t));
      if (ring < rings - 1) positions.push(...point(b, t), ...point(a, u), ...point(b, u));
    }
    const vertices = [], index = [], lookup = new Map();
    for (let i = 0; i < positions.length; i += 3) {
      const key = positions.slice(i, i + 3).map(v => Math.round(v * 1e6)).join(',');
      if (!lookup.has(key)) {
        lookup.set(key, vertices.length / 3);
        vertices.push(positions[i], positions[i + 1], positions[i + 2]);
      }
      index.push(lookup.get(key));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  }

  // Angular ridges with a shared, irregular snow line.
  createPeak(snow) {
    const vertices = [], segments = 10, rings = 6;
    const point = (a, t) => {
      const snowLine = .63 + .055 * Math.sin(a * 3 + .4) + .045 * Math.cos(a * 5);
      const y = snow ? snowLine + (1 - snowLine) * t : t * snowLine;
      const ridge = 1 + .19 * Math.sin(a * 3 + .5) + .13 * Math.cos(a * 7);
      const radius = Math.pow(1 - y, .87) * ridge * (1 + .09 * Math.sin(y * 17 + a * 2));
      return [Math.cos(a) * radius + .14 * y, y - .5, Math.sin(a) * radius - .1 * y];
    };
    for (let ring = 0; ring < rings; ring++) for (let side = 0; side < segments; side++) {
      const a = side / segments * TAU, b = (side + 1) / segments * TAU, t = ring / rings, u = (ring + 1) / rings;
      vertices.push(...point(a, t), ...point(a, u), ...point(b, t));
      if (ring < rings - 1 || !snow) vertices.push(...point(b, t), ...point(a, u), ...point(b, u));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  // Five shared surfaces; each instance carries its own colour.
  createSurfaces() {
    this.surfaces = {
      matte: new THREE.MeshLambertMaterial({vertexColors: true}),
      metal: new THREE.MeshStandardMaterial({vertexColors: true, metalness: .85, roughness: .34}),
      glow: new THREE.MeshBasicMaterial({toneMapped: false}),
      wet: new THREE.MeshStandardMaterial({vertexColors: true, metalness: .05, roughness: .22}),
      sheer: new THREE.MeshBasicMaterial({transparent: true, opacity: .4, depthWrite: false}),
    };
    for (const [name, material] of Object.entries(this.surfaces)) material.name = `surface-${name}`;
    this.surfaceCache = new Map();
    this.gridUniform = {value: .12};
    this.terrainMaterial = new THREE.MeshLambertMaterial({vertexColors: true});
    this.terrainMaterial.name = 'terrain';
    this.terrainMaterial.onBeforeCompile = shader => {
      shader.uniforms.gridStrength = this.gridUniform;
      shader.vertexShader = 'varying vec3 vTerrainWorld;\n' + shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
      shader.fragmentShader = `uniform float gridStrength;\nvarying vec3 vTerrainWorld;\n${NOISE_GLSL}\n` + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  vec2 terrainP = vTerrainWorld.xz;
  float footprint = length(fwidth(terrainP));
  float detail = 1.0 - smoothstep(0.02, 0.09, footprint);
  diffuseColor.rgb *= 0.9 + valueNoise(terrainP * 1.9) * 0.16 + (valueNoise(terrainP * 9.0) - 0.5) * 0.12 * detail;
  float dryness = smoothstep(0.55, 0.82, valueNoise(terrainP * 0.8 + 3.1)) * smoothstep(-0.02, 0.03, vTerrainWorld.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.03, 0.84), dryness * 0.45);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.06, 0.05), hexLine(terrainP) * gridStrength);`,
      );
    };
    this.terrainMaterial.customProgramCacheKey = () => 'pregenesis-terrain-v1';
  }

  surfaceFor(key) {
    let look = this.surfaceCache.get(key);
    if (look) return look;
    const [surface, hex] = SURFACE_KEYS[key] || ['matte', String(key).startsWith('#') ? key : '#ffffff'];
    look = {surface: this.surfaces[surface], color: new THREE.Color(hex)};
    this.surfaceCache.set(key, look);
    return look;
  }

  usesPortableMaterials() {
    return this.portableMaterials ?? !this.renderer;
  }

  // Per-colour physical materials for builds without a renderer (glTF export, tests).
  material(key) {
    if (this.materialCache.has(key)) return this.materialCache.get(key);
    const material = new THREE.MeshStandardMaterial({color: key.startsWith('#') ? key : '#ffffff', roughness: .91, ...PORTABLE_KEYS[key]});
    material.name = key;
    if (FACTION_RULES.some(f => factionVisual(f.id).cloth === key)) material.userData.gameRole = 'faction-cloth';
    this.materialCache.set(key, material);
    return material;
  }

  // A small pre-filtered sky gives the gilded metal something to reflect.
  createEnvironment() {
    if (!this.renderer?.isWebGLRenderer) return;
    this.environment?.dispose();
    const sky = new THREE.Scene(), geometry = new THREE.SphereGeometry(10, 16, 8);
    const position = geometry.attributes.position, colors = new Float32Array(position.count * 3);
    const top = new THREE.Color('#fff2da'), horizon = new THREE.Color('#aab8c4'), bottom = new THREE.Color('#1b2c47'), color = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i) / 10;
      color.copy(horizon).lerp(y > 0 ? top : bottom, Math.abs(y)).toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.BackSide});
    sky.add(new THREE.Mesh(geometry, material));
    const generator = new THREE.PMREMGenerator(this.renderer);
    this.environment = generator.fromScene(sky, .02, .1, 50, {size: 64});
    generator.dispose();
    geometry.dispose();
    material.dispose();
    this.scene.environment = this.environment.texture;
  }

  createLighting() {
    // Cool sky and warm earth fill; a low afternoon sun from the viewer's left.
    this.hemisphere = new THREE.HemisphereLight('#e1e7ea', '#5f5646', 1.35);
    this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight('#ffe7c4', 2.35);
    this.sun.position.set(-9, 22, 15);
    this.sun.shadow.bias = -.0004;
    this.sun.shadow.normalBias = .02;
    this.scene.add(this.sun);
  }

  updateShadowBounds() {
    if (!this.sun || !this.terrainField) return;
    const {minX, maxX, minZ, maxZ} = this.terrainField.bounds;
    const radius = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 1.5;
    const center = scratchVector.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
    this.sun.position.copy(center).add(scratchOffset.set(-9, 22, 15));
    Object.assign(this.sun.shadow.camera, {left: -radius, right: radius, top: radius, bottom: -radius, near: 4, far: 60});
    this.sun.shadow.camera.updateProjectionMatrix();
    if (this.water) this.water.material.uniforms.sunDirection.value.copy(scratchOffset).normalize();
  }

  createWater() {
    const seabed = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    seabed.needsUpdate = true;
    const material = new THREE.ShaderMaterial({
      name: 'water',
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        time: {value: 0},
        seabed: {value: null},
        seabedRect: {value: new THREE.Vector3(0, 0, 1)},
        shallowColor: {value: new THREE.Color('#5a9e97')},
        deepColor: {value: new THREE.Color('#1e3d5f')},
        foamColor: {value: new THREE.Color('#EFE7D6')},
        horizonColor: {value: new THREE.Color(SKY)},
        sunDirection: {value: new THREE.Vector3(-9, 22, 15).normalize()},
        viewDirection: {value: CAMERA_OFFSET.clone().normalize()},
        gridStrength: this.gridUniform,
      }]),
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      fog: true,
    });
    material.uniforms.seabed.value = seabed;
    material.uniforms.gridStrength = this.gridUniform;
    const geometry = new THREE.PlaneGeometry(130, 130);
    geometry.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(geometry, material);
    this.water.name = 'Sea';
    this.water.position.y = WATER_LEVEL;
    this.water.renderOrder = -1;
    this.scene.add(this.water);
  }

  updateSeabed(field) {
    if (!this.water) return;
    // Shores need finer sampling only on the high tier or once much of the map is known.
    const {data, rect, size} = field.seabed(field.knownCount <= 60 ? 64 : this.tier().shadow ? 128 : 96);
    const uniforms = this.water.material.uniforms;
    uniforms.seabed.value.dispose();
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    uniforms.seabed.value = texture;
    uniforms.seabedRect.value.set(rect.x, rect.z, rect.size);
  }

  createHighlights() {
    const material = new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide});
    this.highlightMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.highlightMesh.name = 'Highlights';
    this.highlightMesh.renderOrder = 20;
    this.highlightMesh.visible = false;
    this.highlightMesh.frustumCulled = false;
    this.scene.add(this.highlightMesh);
    const ring = ringGeometry([[0, 0, 0, 1, .05, WHITE, 1]]);
    this.hoverRing = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({
      vertexColors: true, color: '#EFE7D6', transparent: true, opacity: .75, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    }));
    this.hoverRing.name = 'Hover';
    this.hoverRing.renderOrder = 21;
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);
  }

  // State -----------------------------------------------------------------------

  update(state, options = {}) {
    const {selectedTileId = null, reachable = [], attackable = [], foundable = [], pendingAttack = null} = options;
    const newCampaign = this.state !== state;
    this.state = state;
    this.selectedTileId = selectedTileId;
    this.lastUpdateOptions = options;
    if (!this.renderer) return;
    if (newCampaign) {
      this.lastSeenTiles = new Map();
      this.lastSeenCities = new Map();
      this.terrainSignature = null;
      this.piecesSignature = null;
      this.actorPositions = new Map();
    }
    const renderState = this.visibleState(state);
    this.renderState = renderState;
    this.tileMap = new Map(renderState.tiles.map(t => [t.id, t]));
    const signature = this.terrainKey(renderState);
    if (signature !== this.terrainSignature) {
      this.terrainSignature = signature;
      this.buildTerrain(renderState.tiles, renderState);
    }
    const piecesSignature = JSON.stringify({player: renderState.player, cities: renderState.cities, units: renderState.units});
    if (piecesSignature !== this.piecesSignature) {
      this.piecesSignature = piecesSignature;
      this.buildPieces(renderState);
    }
    this.lastHighlights = {selected: selectedTileId, reachable, attackable, foundable, pendingAttack};
    this.updateHighlights(this.lastHighlights);
    this.measureFocusAnchor();
    this.labelsDirty = true;
    this.updateLabels();
    this.requestRender();
  }

  // Terrain is rebuilt only when geography, ownership, settlements or the tier change;
  // sight alone never triggers a rebuild.
  terrainKey(renderState) {
    const tiles = renderState.tiles.map(t => `${t.id}:${t.terrain}:${t.explored}:${t.improvement}:${t.resource}:${t.owner}:${t.river}`).join('|');
    const settled = (renderState.cities || []).flatMap(c => [c.tileId, ...Object.values(c.districtTiles || {})]).sort().join(',');
    return `${this.tier().name}#${settled}#${tiles}`;
  }

  visibleState(state) {
    this.lastSeenTiles ??= new Map();
    this.lastSeenCities ??= new Map();
    const actualTiles = new Map((state.tiles || []).map(tile => [tile.id, tile]));
    const tiles = (state.tiles || []).map(tile => {
      if (tile.explored === false) return {id: tile.id, q: tile.q, r: tile.r, explored: false, visible: false};
      if (tile.visible !== false || tile.owner === state.player) {
        const snapshot = {...tile};
        this.lastSeenTiles.set(tile.id, snapshot);
        return snapshot;
      }
      const remembered = this.lastSeenTiles.get(tile.id);
      // On loading a campaign without renderer memory, retain immutable geography
      // only. Current foreign ownership and construction are not observed intel.
      return remembered
        ? {...remembered, visible: false}
        : {id: tile.id, q: tile.q, r: tile.r, terrain: tile.terrain, resource: tile.resource, river: tile.river, explored: true, visible: false, owner: null, improvement: null};
    });
    const observedCities = new Set();
    for (const city of state.cities || []) {
      const tile = actualTiles.get(city.tileId);
      if (!tile || tile.explored === false) continue;
      if (tile.visible !== false || city.faction === state.player) {
        observedCities.add(city.id);
        this.lastSeenCities.set(city.id, {...city, buildings: [...(city.buildings || [])], districts: [...(city.districts || [])], districtTiles: {...(city.districtTiles || {})}});
      }
    }
    const cities = [];
    for (const [id, city] of this.lastSeenCities) {
      const tile = actualTiles.get(city.tileId);
      if (!tile || tile.explored === false || (tile.visible !== false && !observedCities.has(id))) {
        this.lastSeenCities.delete(id);
        continue;
      }
      cities.push({...city, intelVisible: observedCities.has(id)});
    }
    const units = (state.units || []).filter(unit => {
      const tile = actualTiles.get(unit.tileId);
      return tile && tile.explored !== false && (tile.visible !== false || unit.faction === state.player);
    });
    return {...state, tiles, cities, units};
  }

  // Title-screen diorama: a separate, fully revealed demo state, no labels or picking,
  // and a slow orbit that stops for reduced motion.
  setShowcase(state, focusTileId = null) {
    if (!state) {
      if (!this.showcase) return;
      this.showcase = null;
      this.labelsEnabled = this.labelsBeforeShowcase ?? true;
      if (this.overlay) this.overlay.hidden = false;
      this.azimuthGoal = 0;
      this.targetGoal.set(0, 0, 0);
      this.spanGoal = DEFAULT_SPAN;
      if (this.reducedMotion) {
        this.azimuth = 0;
        this.target.copy(this.targetGoal);
        this.span = this.spanGoal;
      }
      this.measureFocusAnchor();
      this.updateCamera();
      this.labelsDirty = true;
      this.requestRender();
      return;
    }
    if (!this.showcase) {
      this.labelsBeforeShowcase = this.labelsEnabled;
      this.showcase = {time: 0};
    }
    this.showcase.focusTileId = focusTileId;
    this.labelsEnabled = false;
    if (this.overlay) this.overlay.hidden = true;
    this.keys.clear();
    this.drag = null;
    this.clearHover();
    this.update(state, {selectedTileId: null});
    this.frameShowcase();
    if (this.reducedMotion) {
      this.target.copy(this.targetGoal);
      this.span = this.spanGoal;
      this.azimuth = this.azimuthGoal = 0;
    }
    this.updateCamera();
    this.requestRender();
  }

  // Fit the whole map into the part of the screen the title panel leaves free.
  frameShowcase() {
    if (!this.showcase || !this.terrainField || !this.renderer) return;
    const {minX, maxX, minZ, maxZ} = this.terrainField.bounds;
    const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const focusTile = this.tileMap.get(this.showcase.focusTileId);
    if (focusTile) center.lerp(worldPosition(focusTile), .2);
    this.showcase.base = center;
    this.targetGoal.copy(center);
    const free = this.showcaseViewport(), aspect = (this.width || 1) / (this.height || 1);
    let halfWidth = 0, halfHeight = 0;
    const camera = new THREE.OrthographicCamera(), point = new THREE.Vector3(), offset = new THREE.Vector3();
    for (const azimuth of [-.42, 0, .42]) {
      camera.position.copy(center).add(offset.copy(CAMERA_OFFSET).applyAxisAngle(Y_AXIS, azimuth));
      camera.lookAt(center);
      camera.updateMatrixWorld();
      for (const tile of this.tileMap.values()) {
        point.copy(worldPosition(tile)).applyMatrix4(camera.matrixWorldInverse);
        halfWidth = Math.max(halfWidth, Math.abs(point.x) + .9);
        halfHeight = Math.max(halfHeight, Math.abs(point.y) + .6);
      }
    }
    const spanForHeight = halfHeight / (free.y1 - free.y0);
    const spanForWidth = halfWidth / (aspect * (free.x1 - free.x0));
    this.spanGoal = clamp(Math.max(spanForHeight, spanForWidth), 6, 48);
    this.focusAnchor = {x: (free.x0 + free.x1) / 2, y: (free.y0 + free.y1) / 2};
  }

  showcaseViewport() {
    const full = {x0: 0, x1: 1, y0: 0, y1: 1};
    const panel = typeof document !== 'undefined' ? document.querySelector('#welcome:not([hidden]) .title-panel') : null;
    const box = this.container?.getBoundingClientRect?.();
    if (!panel || !box?.width || !box.height || !panel.getClientRects().length) return full;
    const rect = panel.getBoundingClientRect();
    const left = clamp((rect.left - box.left) / box.width, 0, 1), right = clamp((rect.right - box.left) / box.width, 0, 1);
    const top = clamp((rect.top - box.top) / box.height, 0, 1), bottom = clamp((rect.bottom - box.top) / box.height, 0, 1);
    // A wordmark floating above a bottom sheet keeps its own band clear.
    const mark = document.querySelector('#welcome .wordmark');
    const markRect = mark?.getClientRects().length ? mark.getBoundingClientRect() : null;
    const markBottom = markRect && markRect.bottom <= rect.top ? clamp((markRect.bottom - box.top) / box.height, 0, top * .5) : 0;
    const options = [
      {x0: right, x1: 1, y0: 0, y1: 1, area: (1 - right) * box.width * box.height},
      {x0: 0, x1: left, y0: 0, y1: 1, area: left * box.width * box.height},
      {x0: 0, x1: 1, y0: markBottom, y1: top, area: (top - markBottom) * box.width * box.height},
      {x0: 0, x1: 1, y0: bottom, y1: 1, area: (1 - bottom) * box.width * box.height},
    ].sort((a, b) => b.area - a.area);
    // A phone's bottom sheet may leave only a strip; a small, whole island still reads there.
    return options[0].area > box.width * box.height * .12 ? options[0] : full;
  }

  // Terrain ---------------------------------------------------------------------

  disposeTerrain() {
    if (this.terrainGroup) {
      this.scene.remove(this.terrainGroup);
      this.terrainGroup.traverse(object => {
        if (object.isInstancedMesh) object.dispose();
        else if (object.isMesh) object.geometry.dispose();
      });
      this.terrainGroup = null;
    }
    if (this.fogVeil) {
      this.scene.remove(this.fogVeil);
      this.fogVeil.geometry.dispose();
      this.fogVeil.material.dispose();
      this.fogVeil = null;
    }
    if (this.pickMesh) {
      this.scene.remove(this.pickMesh);
      this.pickMesh.dispose();
      this.pickMesh.geometry.dispose();
      this.pickMesh.material.dispose();
      this.pickMesh = null;
    }
  }

  buildTerrain(tiles, renderState = null) {
    this.disposeTerrain();
    const tier = this.tier();
    const flat = new Set();
    for (const city of renderState?.cities || []) {
      flat.add(city.tileId);
      for (const id of Object.values(city.districtTiles || {})) flat.add(id);
    }
    const field = new TerrainField(tiles, {flat, tint: tile => tile.owner ? factionVisual(tile.owner).color : null});
    this.terrainField = field;
    const group = new THREE.Group();
    group.name = 'Terrain';
    const geometry = field.buildGeometry(tier.detail);
    if (geometry) {
      const first = tiles.find(t => t.explored !== false);
      const material = this.usesPortableMaterials() ? this.material((TERRAIN[first?.terrain] || TERRAIN.grass).color) : this.terrainMaterial;
      const ground = new THREE.Mesh(geometry, material);
      ground.name = 'Ground';
      ground.receiveShadow = true;
      group.add(ground);
    }
    const batch = new ModelBatch(this), lookup = new Map(tiles.map(t => [`${t.q},${t.r}`, t]));
    // The pick mesh is never drawn; three.js raycasts invisible meshes.
    this.pickMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, .16, 6), new THREE.MeshBasicMaterial(), tiles.length);
    this.pickMesh.visible = false;
    this.pickMesh.userData.tileIds = tiles.map(t => t.id);
    tiles.forEach((tile, index) => {
      const p = worldPosition(tile);
      const surface = tile.explored === false ? WATER_LEVEL + .012 : Math.max(WATER_LEVEL, field.heightAt(p.x, p.z) ?? 0);
      this.dummy.position.set(p.x, surface, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.pickMesh.setMatrixAt(index, this.dummy.matrix);
      if (tile.explored !== false) this.dressTile(batch, tile, lookup, field, tier);
    });
    group.add(batch.finish());
    this.terrainGroup = group;
    this.scene.add(group);
    this.pickMesh.computeBoundingSphere();
    this.scene.add(this.pickMesh);
    this.buildFogVeil(tiles, lookup);
    this.updateSeabed(field);
    this.updateShadowBounds();
    if (this.showcase) this.frameShowcase();
    if (this.renderer?.shadowMap) this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  dressTile(b, tile, lookup, field, tier) {
    const p = worldPosition(tile), rand = randomFor(tile.id);
    const ground = (x, z) => field.heightAt(p.x + x, p.z + z) ?? 0;
    const h = ground(0, 0), terrain = TERRAIN[tile.terrain] ? tile.terrain : 'grass';
    const density = tier.foliage * (this.compactGraphics ? .8 : 1);
    b.at(p.x, 0, p.z);
    b.tileId = tile.id;
    b.actorId = null;
    if (terrain === 'water') {
      if (rand() > .8) {
        b.add('rock', '#8d9589', .3, WATER_LEVEL + .03, .2, .2, .15, .18, 0, rand() * 3);
        b.add('rock', '#a3a99b', .14, WATER_LEVEL + .01, .34, .12, .08, .11, 0, rand() * 3);
      }
    } else if (terrain === 'mountain') {
      this.mountains(b, rand, ground);
    } else if (terrain === 'forest') {
      const count = tile.improvement ? 3 : Math.round(11 * density) + Math.floor(rand() * 3);
      for (let i = 0; i < count; i++) {
        const a = rand() * TAU, r = tile.improvement ? .72 : Math.sqrt(rand()) * .74;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        this.tree(b, x, ground(x, z), z, .6 + rand() * .4, rand() > .45 ? 'round' : 'pine', rand);
      }
      for (let i = 0; i < 2; i++) {
        const x = (rand() - .5) * 1.2, z = (rand() - .5) * 1.2, y = ground(x, z);
        b.add('rock', '#849475', x, y + .02, z, .1, .06, .09, 0, rand() * 3);
        b.add('leaf', '#6f8f52', x + .07, y + .06, z + .04, .1, .09, .09);
      }
    } else if (terrain === 'hills') {
      for (let i = 0; i < 2; i++) {
        const x = (i - .5) * .36, z = (rand() - .5) * .45, rise = tile.improvement ? .09 : .13 + rand() * .1;
        b.add('hill', ['#86985a', '#93a062'][i], x, ground(x, z) + rise * .42, z, .62 + rand() * .12, rise, .5 + rand() * .12, 0, rand());
      }
      for (let i = 0; i < 2; i++) {
        const x = .37 + i * .12, z = -.3 + i * .1;
        b.add('rock', '#b3b09a', x, ground(x, z) + .04, z, .1, .09, .08, 0, rand() * 3);
      }
      if (rand() > .3 * density + .1) this.tree(b, -.44, ground(-.44, .31), .31, .55, 'pine', rand);
    } else if (terrain === 'waste') {
      for (let i = 0; i < 3; i++) {
        const x = (rand() - .5) * 1.2, z = (rand() - .5) * 1.2;
        b.add('rock', ['#8e8373', '#a29682', '#7d7466'][i], x, ground(x, z) + .04, z, .12 + rand() * .16, .08 + rand() * .14, .12 + rand() * .1, 0, rand() * 3);
      }
      if (rand() > .5) {
        const x = -.3, z = .35;
        b.add('cone', '#8b8a5e', x, ground(x, z) + .06, z, .08, .12, .08);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const x = (rand() - .5) * 1.4, z = (rand() - .5) * 1.4;
        b.add('cone', ['#8fa662', '#7a9a55', '#b1b673'][i], x, ground(x, z) + .04, z, .014, .05 + rand() * .04, .014, 0, rand() * 6);
      }
      if (rand() > 1 - .35 * density && !tile.improvement && !tile.river) this.tree(b, .48, ground(.48, -.3), -.3, .6, 'round', rand);
      if (rand() > .5) {
        for (let i = 0; i < 3; i++) {
          const x = -.5 + rand() * .3, z = .4 + rand() * .2, y = ground(x, z);
          b.add('cylinder', '#709451', x, y + .045, z, .008, .07, .008);
          b.add('cone4', i % 2 ? '#ede1b3' : '#cdc4d5', x, y + .09, z, .03, .03, .03);
        }
      }
    }
    if (tile.river && terrain !== 'water') this.river(b, tile, lookup, h);
    if (tile.improvement) this.improvement(b, tile.improvement, h, rand);
    if (tile.resource) this.resource(b, tile.resource, terrain === 'water' ? WATER_LEVEL : h, rand);
    if (tile.owner) this.borders(b, tile, lookup, ground);
  }

  // Territory is drawn as an inlaid rule along each edge that faces another owner.
  borders(b, tile, lookup, ground) {
    const color = factionVisual(tile.owner).color;
    for (let i = 0; i < 6; i++) {
      const [dq, dr] = EDGE_NEIGHBORS[i];
      const near = lookup.get(`${tile.q + dq},${tile.r + dr}`);
      if (near && near.explored !== false && near.owner === tile.owner) continue;
      const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
      const from = [ax * .9, 0, az * .9], to = [bx * .9, 0, bz * .9];
      from[1] = ground(from[0], from[2]) + .04;
      to[1] = ground(to[0], to[2]) + .04;
      this.segment(b, from, to, .045, color, .03);
    }
  }

  // Hidden cells contribute only their coordinates to one continuous veil.
  // Terrain, resources, ownership and improvements never reach its shader.
  buildFogVeil(tiles, lookup) {
    const unknown = tiles.filter(t => t.explored === false);
    if (!unknown.length) return;
    // The veil lies just above the sea: nothing is built beneath it, and explored
    // land rises from it like the edge of a drawn map.
    const y = WATER_LEVEL + .012, vertices = [], rims = [];
    for (const tile of unknown) {
      const p = worldPosition(tile);
      for (let i = 0; i < 6; i++) {
        const [dq, dr] = EDGE_NEIGHBORS[i];
        const near = lookup.get(`${tile.q + dq},${tile.r + dr}`);
        const rim = near && near.explored !== false ? 1 : 0;
        const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
        vertices.push(p.x, y, p.z, p.x + bx, y, p.z + bz, p.x + ax, y, p.z + az);
        rims.push(0, rim, rim);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('rim', new THREE.Float32BufferAttribute(rims, 1));
    const material = new THREE.ShaderMaterial({
      name: 'uncharted',
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        time: {value: this.motionTime || 0},
        night: {value: new THREE.Color(SKY)},
        mist: {value: new THREE.Color('#2b4671')},
        rule: {value: new THREE.Color('#A9B4C8')},
      }]),
      vertexShader: VEIL_VERTEX,
      fragmentShader: VEIL_FRAGMENT,
      fog: true,
      toneMapped: false,
    });
    this.fogVeil = new THREE.Mesh(geometry, material);
    this.fogVeil.name = 'Uncharted veil';
    this.scene.add(this.fogVeil);
  }

  segment(b, from, to, width, color, thickness = .018) {
    const a = new THREE.Vector3(...from), end = new THREE.Vector3(...to), delta = end.clone().sub(a), mid = a.clone().add(end).multiplyScalar(.5);
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.clone().normalize()));
    b.add('box', color, mid.x, mid.y, mid.z, width, thickness, delta.length() + .018, rotation.x, rotation.y, rotation.z);
  }

  // River halves meet at the exact shared edge midpoint. Where a river reaches the
  // sea the rim of the land lies below the water surface, so the channel runs under it.
  river(b, tile, lookup, h) {
    const p = worldPosition(tile), field = this.terrainField;
    const ground = (x, z) => field ? (field.heightAt(p.x + x, p.z + z) ?? h) : h;
    const bend = Math.sin((tile.q + tile.r) * .83) * .13;
    const center = new THREE.Vector3(bend, 0, -bend * .35);
    let reaches = 0;
    for (const [dq, dr] of HEX_DIRECTIONS) {
      const near = lookup.get(`${tile.q + dq},${tile.r + dr}`);
      if (!near || near.explored === false || (!near.river && near.terrain !== 'water')) continue;
      const end = worldPosition(near).sub(p).multiplyScalar(.5);
      const point = t => {
        const v = center.clone().lerp(end, t).add(new THREE.Vector3(Math.sin(t * Math.PI) * .075, 0, Math.sin(t * Math.PI) * .025));
        const y = ground(v.x, v.z);
        // Channels over submerged ground sink out of sight instead of standing above the sea.
        v.y = y < WATER_LEVEL + .012 ? Math.min(y, WATER_LEVEL) - .04 : y;
        return v;
      };
      // Deep banks fill any dip between samples; the water rides just above them.
      for (let step = 0; step < 6; step++) {
        const a = point(step / 6), z = point((step + 1) / 6);
        a.y -= .005;
        z.y -= .005;
        this.segment(b, a.toArray(), z.toArray(), .23, '#94a07a', .05);
        a.y += .023;
        z.y += .023;
        this.segment(b, a.toArray(), z.toArray(), .15, 'water', .014);
      }
      reaches++;
    }
    const y = ground(center.x, center.z) + .02;
    if (reaches < 2) {
      b.add('disc', '#94a07a', center.x, y, center.z, .19, .02, .23);
      b.add('disc', 'water', center.x, y + .012, center.z, .145, .014, .18);
    }
    for (const side of [-1, 1]) {
      b.add('rock', '#a8b39a', center.x + side * .23, ground(center.x + side * .23, center.z + .28) + .03, center.z + .28, .1, .07, .12);
      b.add('cone', '#779a64', center.x + side * .22, ground(center.x + side * .22, center.z - .22) + .09, center.z - .22, .02, .18, .022);
    }
  }

  tree(b, x, y, z, scale, type, rand) {
    b.add('taper', '#6c5b43', x, y + scale * .2, z, scale * .045, scale * .4, scale * .045);
    const angle = rand() * 6;
    if (type === 'pine') {
      const color = ['#2e5a42', '#386848', '#47764c'][Math.floor(rand() * 3)];
      for (let layer = 0; layer < 3; layer++) {
        const width = .3 - layer * .075;
        b.add('bough', layer > 1 ? '#5f8a52' : color, x, y + scale * (.36 + layer * .19), z, scale * width, scale * (.44 - layer * .05), scale * width, 0, angle + layer * .6);
      }
    } else {
      const color = type === 'gold' ? '#bba357' : ['#4f7e45', '#648f4c', '#3d6e48'][Math.floor(rand() * 3)];
      for (let crown = 0; crown < 3; crown++) {
        const a = angle + crown * 2.1, top = crown === 2;
        const dx = top ? 0 : Math.cos(a) * scale * .13, dz = top ? 0 : Math.sin(a) * scale * .12;
        b.add('leaf', top ? '#7f9a55' : color, x + dx, y + scale * (top ? .72 : .54), z + dz, scale * .26, scale * (top ? .22 : .24), scale * .25, 0, a);
      }
    }
  }

  mountains(b, rand, ground) {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * .32, z = (rand() - .5) * .4, height = (i === 1 ? 1.3 : .88) + rand() * .3, angle = rand() * 3, width = i === 1 ? .58 : .48;
      const base = ground(x, z) - .05;
      b.add('mountainRock', ['#8f9c97', '#a8aba1', '#7f8e8e'][i], x, base + height * .5, z, width, height, width * .9, 0, angle);
      b.add('snowPeak', 'snow', x, base + height * .5, z, width, height, width * .9, 0, angle);
      b.add('rock', '#9d978a', x - .18, ground(x - .18, z + .15) + .03, z + .15, .26, .11, .22, 0, angle);
    }
    if (rand() > .4) this.tree(b, .5, ground(.5, .43), .43, .5, 'pine', rand);
  }

  improvement(b, type, h, rand) {
    const key = String(type).toLowerCase();
    if (key.includes('farm') || key.includes('field')) {
      b.add('box', '#726144', -.06, h + .035, .02, .91, .035, .69, 0, .12);
      for (let i = 0; i < 6; i++) {
        const x = -.43 + i * .148;
        b.add('box', i % 2 ? '#d1bb68' : '#bda454', x, h + .06, .02, .083, .05, .61, 0, .12);
      }
      for (const x of [-.53, .44]) for (const z of [-.38, .38]) b.add('cylinder', '#947847', x, h + .14, z, .016, .25, .016);
      b.add('box', '#af925c', -.045, h + .18, .38, .97, .025, .025);
      b.add('box', '#bca179', .47, h + .13, -.28, .22, .24, .25);
      b.add('cone4', '#8c6d48', .47, h + .34, -.28, .24, .19, .27, 0, Math.PI / 4);
      b.add('rock', '#d9c178', -.48, h + .1, .45, .11, .14, .09);
    } else if (key.includes('mine')) {
      b.add('rock', '#7a8987', 0, h + .12, -.1, .48, .38, .39);
      b.add('box', '#293b3e', 0, h + .18, .237, .27, .32, .027);
      for (const side of [-1, 1]) b.add('box', '#a78d60', side * .16, h + .19, .26, .052, .39, .06);
      b.add('box', '#a78d60', 0, h + .4, .26, .39, .06, .065);
      for (const x of [-.085, .085]) b.add('box', '#71878a', x, h + .04, .48, .021, .018, .42);
      for (let i = 0; i < 4; i++) b.add('box', '#947e56', 0, h + .03, .31 + i * .11, .25, .021, .035);
      b.add('box', '#967e56', 0, h + .11, .48, .19, .14, .19);
      b.add('rock', '#bdc8ca', -.025, h + .22, .48, .09, .09, .08);
      for (let i = 0; i < 3; i++) b.add('rock', '#a8b7b5', .35 + i * .07, h + .11, -.03 + i * .07, .085, .11, .1);
      b.add('sphere', 'window', .205, h + .28, .29, .026, .034, .025);
    } else if (key.includes('lumber') || key.includes('mill')) {
      b.add('box', '#a08152', -.09, h + .1, -.09, .47, .21, .37);
      for (const x of [-.29, .12]) for (const z of [-.25, .07]) b.add('cylinder', '#8e704b', x, h + .24, z, .025, .48, .025);
      b.add('cone4', '#526957', -.085, h + .51, -.09, .43, .2, .35, 0, Math.PI / 4);
      b.add('disc', '#b2b8a3', .12, h + .27, .2, .14, .021, .14, Math.PI / 2);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        b.add('box', '#d0d1b4', .12 + Math.cos(a) * .13, h + .27 + Math.sin(a) * .13, .2, .045, .045, .027, 0, 0, a);
      }
      for (let i = 0; i < 4; i++) {
        const z = .32 + (i % 2) * .12, y = h + .07 + Math.floor(i / 2) * .11;
        b.add('cylinder', '#765a39', -.29, y, z, .053, .42, .053, 0, 0, Math.PI / 2);
      }
    }
  }

  resource(b, resource, h) {
    const name = String(resource).toLowerCase();
    if (name.includes('iron') || name.includes('gold')) {
      for (let i = 0; i < 3; i++) {
        const x = -.57 + i * .1, z = .36 + (i % 2) * .12;
        b.add('rock', '#596d72', x, h + .09, z, .12, .16, .11);
        b.add('rock', name.includes('gold') ? '#dbc177' : '#c0d0d1', x + .01, h + .2, z, .055, .06, .049);
      }
    } else if (name.includes('wheat') || name.includes('grain') || name.includes('food')) {
      for (let i = 0; i < 7; i++) {
        const x = .3 + (i % 4) * .068, z = .43 + Math.floor(i / 4) * .09;
        b.add('cylinder', '#a3a35e', x, h + .09, z, .012, .23, .012);
        b.add('leaf', '#eed083', x, h + .22, z, .035, .075, .03);
      }
    } else if (name.includes('horse')) {
      for (let i = 0; i < 2; i++) {
        const x = .24 + i * .24, z = .37 + i * .13;
        b.add('box', i ? '#a99677' : '#d5c8a7', x, h + .15, z, .12, .1, .22);
        b.add('cone', '#ad9874', x, h + .26, z - .09, .053, .19, .05, -.4);
        b.add('box', '#b2a081', x, h + .32, z - .15, .065, .069, .085);
        for (const dx of [-.043, .043]) for (const dz of [-.07, .07]) b.add('cylinder', '#756d59', x + dx, h + .05, z + dz, .012, .16, .012);
      }
    } else if (name.includes('fish')) {
      for (let i = 0; i < 3; i++) {
        b.add('rock', '#c6e5db', .13 + i * .15, h + .015, .34 + i * .1, .11, .025, .04, 0, .4);
        b.add('cone4', '#b4d9cc', .035 + i * .15, h + .017, .3 + i * .1, .045, .014, .055, 0, .4);
      }
    } else if (name.includes('timber')) {
      for (let i = 0; i < 3; i++) b.add('cylinder', '#7c6141', -.47, h + .07 + i * .055, .35 + i * .07, .042, .38, .042, 0, 0, Math.PI / 2);
    } else if (name.includes('gem')) {
      b.add('rock', '#697b79', .45, h + .06, .4, .19, .1, .15);
      for (let i = 0; i < 3; i++) b.add('cone4', ['#a397c1', '#83b7c1', '#c9acd3'][i], .34 + i * .1, h + .17 + (i % 2) * .07, .41, .055, .24, .055, 0, .4, i * .12);
    }
  }

  // Districts: House of Life, Agora, Sanctuary and Forge of Hephaestus.
  district(b, id, x, z, f) {
    b.add('box', '#c4b68e', x, .055, z, .34, .09, .31);
    if (id === 'campus') {
      b.add('box', '#e4d8b8', x, .2, z - .02, .3, .22, .22);
      b.add('box', '#d2c29c', x, .32, z - .02, .33, .03, .25);
      for (const side of [-1, 1]) {
        b.add('cylinder', '#e9e0c6', x + side * .08, .21, z + .12, .02, .22, .02);
        b.add('cone', '#6f9a6a', x + side * .08, .33, z + .12, .035, .05, .035, Math.PI);
      }
      b.add('taper4', '#d8c08c', x + .19, .3, z - .1, .035, .44, .035, 0, Math.PI / 4);
      b.add('cone4', 'bannerGold', x + .19, .54, z - .1, .03, .05, .03, 0, Math.PI / 4);
    } else if (id === 'market') {
      b.add('box', '#ddd4b8', x, .27, z - .08, .34, .04, .14);
      b.add('box', '#cfc4a4', x, .19, z - .12, .34, .16, .04);
      for (let i = 0; i < 5; i++) b.add('cylinder', '#ece5cf', x - .15 + i * .075, .19, z - .03, .012, .16, .012);
      for (let i = 0; i < 2; i++) {
        const dx = x + (i - .5) * .2;
        b.add('box', '#916f47', dx, .12, z + .1, .1, .06, .08);
        b.add('box', i ? '#c79564' : f.cloth, dx, .2, z + .1, .13, .015, .11, .15);
      }
    } else if (id === 'forge') {
      b.add('box', '#7b7f76', x, .19, z, .31, .27, .26);
      b.add('cone4', '#4f5f66', x, .38, z, .26, .14, .24, 0, Math.PI / 4);
      b.add('box', '#4b5359', x - .1, .48, z - .07, .07, .42, .07);
      b.add('box', 'window', x, .15, z + .135, .12, .12, .01);
      b.add('box', '#3d3f40', x + .22, .14, z + .08, .08, .06, .05);
      b.add('box', '#3d3f40', x + .22, .1, z + .08, .04, .04, .03);
    } else if (id === 'sanctuary') {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        b.add('box', '#d8d2b8', x + Math.cos(a) * .16, .12, z + Math.sin(a) * .14, .16, .04, .02, 0, Math.PI / 2 - a);
      }
      b.add('disc', 'water', x - .06, .105, z + .03, .07, .01, .07);
      b.add('box', '#e6dfc6', x + .07, .14, z - .03, .07, .08, .07);
      b.add('cone', 'window', x + .07, .2, z - .03, .015, .04, .015);
      this.tree(b, x - .05, .1, z - .08, .32, 'round', () => .5);
    }
  }

  // Cyclopean walls.
  cityWalls(b, f) {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      if (i === 2) continue;
      b.add('box', '#b1ad98', Math.cos(a) * .77, .17, Math.sin(a) * .77, .6, .24, .08, 0, Math.PI / 2 - a);
      b.add('box', f.cloth, Math.cos(a) * .77, .3, Math.sin(a) * .77, .58, .03, .085, 0, Math.PI / 2 - a);
      b.add('taper', '#c2bfaa', Math.cos(a + .39) * .82, .24, Math.sin(a + .39) * .82, .08, .4, .08);
    }
  }

  // Etemenanki: the seven-stage temple tower of Babylon with its summit shrine.
  etemenanki(b, x = 0, z = 0) {
    const brick = ['#b8936a', '#c7a57a', '#b08a61', '#caa97d', '#b8936a', '#c7a57a', '#b08a61'];
    for (let i = 0; i < 7; i++) {
      const size = .54 - i * .062;
      b.add('box', brick[i], x, .1 + i * .13, z, size, .13, size);
    }
    b.add('box', '#3e6c98', x, 1.03, z, .13, .13, .13);
    b.add('box', 'bannerGold', x, 1.105, z, .15, .02, .15);
    for (const side of [-1, 1]) b.add('cone', 'bannerGold', x + side * .04, 1.15, z, .012, .06, .012);
    this.segment(b, [x, .05, z + .46], [x, .36, z + .22], .08, '#d3b489', .03);
  }

  civicWonder(b, id, x = 0, z = 0) {
    if (id === 'world_exchange') this.templeOfSolomon(b, x, z);
    else this.templeOfDelphi(b, x, z);
  }

  // The Temple of Solomon: porch with the bronze pillars Jachin and Boaz, gilded
  // cornices, the bronze sea and the altar in the court (1 Kings 6–7).
  templeOfSolomon(b, x, z) {
    const stone = '#e2dac2', bronze = '#a8844f';
    b.add('box', '#cfc6ad', x, .05, z, .7, .06, .56);
    b.add('box', stone, x, .26, z - .08, .24, .36, .44);
    for (const side of [-1, 1]) b.add('box', '#d6cdb3', x + side * .16, .19, z - .1, .08, .22, .4);
    b.add('box', stone, x, .31, z + .17, .28, .46, .08);
    b.add('box', 'bannerGold', x, .45, z - .08, .26, .02, .46);
    b.add('box', 'bannerGold', x, .545, z + .17, .3, .025, .1);
    b.add('box', '#3a3530', x, .2, z + .215, .08, .16, .01);
    for (const side of [-1, 1]) {
      b.add('cylinder', bronze, x + side * .1, .25, z + .27, .025, .38, .025);
      b.add('sphere', bronze, x + side * .1, .46, z + .27, .04, .035, .04);
    }
    b.add('cylinder', bronze, x - .25, .11, z + .16, .07, .06, .07);
    b.add('disc', 'water', x - .25, .145, z + .16, .06, .01, .06);
    b.add('box', bronze, x + .25, .1, z + .18, .09, .06, .09);
  }

  // The Temple of Apollo at Delphi: a Doric peristyle on its terrace, with the omphalos.
  templeOfDelphi(b, x, z) {
    const marble = '#e8e2cf', shade = '#cfc8b1';
    b.add('box', '#bdb49a', x, .05, z, .56, .06, .7);
    b.add('box', shade, x, .1, z, .38, .04, .54);
    b.add('box', marble, x, .13, z, .34, .03, .5);
    b.add('box', shade, x, .25, z, .18, .2, .34);
    for (let i = 0; i < 6; i++) for (const side of [-1, 1]) b.add('cylinder', marble, x - .15 + i * .06, .255, z + side * .22, .016, .22, .016);
    for (let i = 1; i < 7; i++) for (const side of [-1, 1]) b.add('cylinder', marble, x + side * .15, .255, z - .22 + i * .0629, .016, .22, .016);
    b.add('box', marble, x, .385, z, .36, .04, .52);
    b.add('gable', '#a4563f', x, .455, z, .36, .1, .52);
    b.add('sphere', '#bfb59a', x + .2, .1, z + .3, .035, .04, .035);
  }

  constructionSite(b, work, f, x = .57, z = -.54) {
    const height = .18 + work.stage * .11;
    b.add('box', '#a89e82', x, .07, z, .33, .07, .28);
    for (const dx of [-.15, .15]) for (const dz of [-.12, .12]) b.add('cylinder', '#987953', x + dx, height / 2 + .09, z + dz, .014, height, .014);
    for (const dz of [-.12, .12]) b.add('box', '#b89c6d', x, height + .09, z + dz, .34, .023, .025);
    this.segment(b, [x - .15, .1, z + .12], [x + .15, height + .09, z + .12], .019, '#987953');
    for (let course = 0; course < work.stage; course++) b.add('box', '#c8c1a7', x, .11 + course * .065, z, .23, .05, .18);
    b.add('box', f.cloth, x + .17, .15, z + .1, .065, .1, .015);
  }

  buildStructureSample(kind, id) {
    const batch = new ModelBatch(this);
    batch.at(0, 0, 0);
    batch.tileId = '0,0';
    if (kind === 'wonder' && ['world-exchange', 'temple-of-solomon'].includes(id)) this.civicWonder(batch, 'world_exchange');
    else if (kind === 'wonder' && ['hall-of-nations', 'temple-of-delphi'].includes(id)) this.civicWonder(batch, 'hall_of_nations');
    else if (kind === 'wonder' && ['concord-spire', 'etemenanki'].includes(id)) this.etemenanki(batch);
    else if (kind === 'improvement') this.improvement(batch, id, 0, randomFor(`sample-${id}`));
    else if (kind === 'district') this.district(batch, id, 0, 0, factionVisual('michael'));
    else throw new Error(`Unknown structure sample type: ${kind}`);
    return batch.finish();
  }

  // Pieces ----------------------------------------------------------------------

  groundLevel(tile) {
    const p = worldPosition(tile);
    return Math.max(WATER_LEVEL, this.terrainField?.heightAt(p.x, p.z) ?? 0);
  }

  buildPieces(state) {
    const previous = this.actorPositions || new Map(), now = performance.now();
    for (const [id, animation] of this.actorAnimations || []) previous.get(id)?.add(actorMotionOffset(animation, now));
    this.actorPositions = new Map();
    this.actorAnimations = new Map();
    const focused = typeof document !== 'undefined' ? this.labels.find(label => label.element === document.activeElement) : null;
    if (this.piecesGroup) {
      this.scene.remove(this.piecesGroup);
      this.piecesGroup.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    }
    this.labels.forEach(l => l.element.remove());
    this.labels = [];
    const b = new ModelBatch(this), cityTiles = new Set(), placedDistricts = [];
    for (const city of state.cities || []) {
      const tile = this.tileMap.get(city.tileId);
      if (!tile || tile.explored === false) continue;
      cityTiles.add(city.tileId);
      const p = worldPosition(tile), f = factionVisual(city.faction), lift = this.groundLevel(tile);
      const hasIntel = city.intelVisible ?? (city.faction === state.player || tile.visible !== false);
      b.at(p.x, lift + .035, p.z, .83, -.1);
      b.tileId = city.tileId;
      b.actorId = null;
      this.cityGrounds(b, f);
      this.capital(b, f);
      // Remembered construction is safe to display, but its live statistics are not.
      const plan = cityVisualPlan(city, hasIntel), districts = plan.districts.filter(id => !city.districtTiles?.[id]), built = plan.buildings;
      for (const id of plan.districts) {
        const target = this.tileMap.get(city.districtTiles?.[id]);
        if (target && target.explored !== false) placedDistricts.push({id, tile: target, f, city});
      }
      const workTile = plan.construction?.kind === 'district' ? this.tileMap.get(city.queuedDistrictTileId) : null;
      const remoteWork = workTile && workTile.explored !== false;
      if (remoteWork) placedDistricts.push({id: plan.construction.id, tile: workTile, f, city, work: plan.construction});
      const occupied = districts.map((id, i) => ({x: Math.cos(i * 1.6 + 1) * .79, z: Math.sin(i * 1.6 + 1) * .79, r: .39}));
      if (built.includes('etemenanki')) occupied.push({x: -.52, z: -.44, r: .5});
      if (built.includes('world_exchange')) occupied.push({x: .58, z: -.48, r: .38});
      if (built.includes('hall_of_nations')) occupied.push({x: -.57, z: .45, r: .38});
      if (plan.construction && !remoteWork) occupied.push({x: .57, z: -.54, r: .28});
      // Residential clusters represent population, not unearned buildings.
      let houses = 0;
      for (let slot = 0; slot < 12 && houses < plan.housing; slot++) {
        const angle = slot * Math.PI / 6 + .22, x = Math.cos(angle) * .84, z = Math.sin(angle) * .79;
        if ((Math.abs(x) < .23 && z > .1) || occupied.some(o => Math.hypot(x - o.x, z - o.z) < o.r + .14)) continue;
        houses++;
        this.house(b, f, x, z, angle);
      }
      this.banner(b, .58, .06, .28, f.cloth, 1.04);
      if (built.includes('walls')) this.cityWalls(b, f);
      if (built.includes('etemenanki')) this.etemenanki(b, -.52, -.44);
      if (built.includes('world_exchange')) this.civicWonder(b, 'world_exchange', .58, -.48);
      if (built.includes('hall_of_nations')) this.civicWonder(b, 'hall_of_nations', -.57, .45);
      if (plan.construction && !remoteWork) this.constructionSite(b, plan.construction, f);
      if (built.includes('granary')) for (let i = 0; i < 3; i++) b.add('cylinder', '#c6b27b', -.58 + i * .09, .12, .46, .042, .17, .042);
      if (built.includes('barracks')) {
        b.add('box', '#817556', .55, .16, .53, .23, .25, .05);
        for (let i = 0; i < 3; i++) b.add('sphere', f.cloth, .47 + i * .08, .2, .565, .038, .06, .015);
      }
      districts.forEach((id, i) => {
        const a = i * 1.6 + 1;
        this.district(b, id, Math.cos(a) * .79, Math.sin(a) * .79, f);
      });
      this.addCityLabel(city, p.clone().setY(lift + 1.55), f, hasIntel);
    }
    for (const {tile, f, id, work} of placedDistricts) {
      const p = worldPosition(tile);
      b.at(p.x, this.groundLevel(tile) + .03, p.z, 1.45, -.1);
      b.tileId = tile.id;
      b.actorId = null;
      b.add('hex', '#aabca7', 0, .006, 0, .62, .05, .62);
      b.add('box', '#dedec5', 0, .038, 0, .81, .035, .74);
      for (const side of [-1, 1]) {
        b.add('box', '#c8cbb3', side * .41, .086, 0, .033, .09, .77);
        b.add('box', f.cloth, side * .41, .14, 0, .039, .025, .77);
      }
      if (work) this.constructionSite(b, work, f, 0, 0);
      else {
        this.district(b, id, 0, -.055, f);
        this.banner(b, -.38, .055, -.3, f.cloth, .66);
      }
    }
    const visibleUnits = (state.units || []).filter(unit => {
      const tile = this.tileMap.get(unit.tileId);
      return tile && tile.explored !== false && (tile.visible !== false || unit.faction === state.player);
    }).sort((a, c) => String(a.id).localeCompare(String(c.id), undefined, {numeric: true}));
    const perTile = new Map(), tileCounts = new Map();
    for (const unit of visibleUnits) tileCounts.set(unit.tileId, (tileCounts.get(unit.tileId) || 0) + 1);
    for (const unit of visibleUnits) {
      const tile = this.tileMap.get(unit.tileId);
      const index = perTile.get(unit.tileId) || 0, count = tileCounts.get(unit.tileId);
      perTile.set(unit.tileId, index + 1);
      const p = worldPosition(tile), city = cityTiles.has(unit.tileId), lift = this.groundLevel(tile);
      // Stable id ordering prevents stack positions from changing with array order.
      // Additional rings accommodate friendly stacks without a two-unit limit.
      if (city || count > 1) {
        const ring = Math.floor(index / 6), inRing = Math.min(6, count - ring * 6), angle = .68 + (index % 6) * TAU / inRing;
        const radius = (city ? .87 : count < 4 ? .4 : .52) + ring * .36;
        p.x += Math.cos(angle) * radius;
        p.z += Math.sin(angle) * radius;
      }
      p.y = lift + .07;
      this.actorPositions.set(unit.id, p.clone());
      const old = previous.get(unit.id);
      if (this.renderer && !this.reducedMotion && old && old.distanceToSquared(p) > .002 && old.distanceToSquared(p) < 70) {
        this.actorAnimations.set(unit.id, {offset: old.clone().sub(p), started: now, duration: 560});
      }
      const f = factionVisual(unit.faction);
      b.tileId = unit.tileId;
      b.actorId = unit.id;
      const army = unit.armySize >= 3 && ['warrior', 'archer', 'rider'].includes(unit.kind), stackScale = count > 4 ? .7 : count > 2 ? .82 : 1;
      const formations = army ? [[0, -.25], [-.32, .18], [.32, .18]] : [[0, 0]], companyScale = stackScale * (army ? .62 : 1);
      for (const [dx, dz] of formations) {
        const x = p.x + dx * stackScale, z = p.z + dz * stackScale;
        b.at(x, p.y, z, .8 * companyScale, Math.PI * .3);
        this.unit(b, unit.kind, f, unit.faction);
        if (unit.kind === 'warrior' || unit.kind === 'archer') {
          for (const side of [-1, 1]) {
            b.at(x + side * .23 * companyScale, p.y, z + .2 * companyScale, .61 * companyScale, Math.PI * .3);
            this.unit(b, unit.kind, f, unit.faction);
          }
        }
      }
      if (unit.kind === 'hero') {
        b.at(p.x, p.y, p.z, 1, 0);
        b.add('disc', '#35444a', 0, -.006, 0, .28, .025, .28);
        b.add('torus', 'bannerGold', 0, .01, 0, .25, .25, .25, Math.PI / 2);
        // A coloured front inset makes the champion base legible among foliage.
        b.add('box', f.cloth, 0, .01, .255, .16, .024, .035);
      }
      this.addUnitLabel(unit, p.clone().setY(p.y + (unit.kind === 'rider' ? .85 : .72)), f);
    }
    this.piecesGroup = b.finish();
    this.piecesGroup.name = 'Pieces';
    this.scene.add(this.piecesGroup);
    if (this.actorAnimations.size) this.animatePieces(performance.now());
    if (this.renderer?.shadowMap) this.renderer.shadowMap.needsUpdate = true;
    this.labelsDirty = true;
    this.requestRender();
    if (focused) {
      const replacement = this.labels.find(label => focused.actorId ? label.actorId === focused.actorId : label.cityId === focused.cityId);
      (replacement?.element || this.renderer?.domElement)?.focus({preventScroll: true});
    }
  }

  // Capitals follow the realm's tradition (art-direction.js architectureFor).
  capital(b, f) {
    const style = f.architecture.style;
    if (style === 'pylon') this.pylonCity(b);
    else if (style === 'colonnade') this.colonnadeCity(b);
    else if (style === 'longhouse') this.longhouseCity(b);
    else if (style === 'basilica' || !mythicCapital(this, b, f.architecture, f)) this.basilicaCity(b);
  }

  cityGrounds(b) {
    b.add('hex', '#a9b79f', 0, -.005, 0, 1.08, .07, 1.08);
    b.add('hex', '#d9d6c0', 0, .035, 0, 1.015, .025, 1.015);
    b.add('box', '#e9e3ca', 0, .052, .62, .3, .012, .76);
    for (const side of [-1, 1]) {
      b.add('cylinder', '#8b7a5c', side * .24, .2, .82, .012, .3, .012);
      b.add('sphere', 'window', side * .24, .37, .82, .03, .036, .03);
    }
  }

  // Houses take the roof form of their tradition: gable, flat, round thatch or tent.
  house(b, f, x, z, angle) {
    const {houses, walls} = f.architecture, turn = -angle;
    const dx = Math.sin(angle) * .14, dz = -Math.cos(angle) * .14;
    b.add('box', '#b9bfa8', x, .06, z, .3, .03, .27, 0, turn);
    if (houses === 'round') {
      for (const [ox, oz, s] of [[0, 0, 1], [dx, dz, .72]]) {
        b.add('cylinder', walls, x + ox, .06 + .07 * s, z + oz, .09 * s, .12 * s, .09 * s);
        b.add('cone', '#8a7851', x + ox, .06 + .19 * s, z + oz, .12 * s, .13 * s, .12 * s);
      }
    } else if (houses === 'flat') {
      b.add('box', walls, x, .14, z, .19, .16, .17, 0, turn);
      b.add('box', walls, x, .23, z, .21, .025, .19, 0, turn);
      b.add('box', walls, x + dx, .12, z + dz, .13, .11, .13, 0, turn);
      b.add('box', '#3f3b36', x, .12, z + .088, .036, .08, .012);
    } else if (houses === 'tent') {
      b.add('gable', walls, x, .13, z, .2, .14, .24, 0, turn);
      b.add('gable', '#6b5140', x + dx, .11, z + dz, .15, .1, .18, 0, turn);
    } else {
      b.add('box', walls, x, .2, z, .19, .21, .17, 0, turn);
      b.add('gable', f.cloth, x, .38, z, .23, .16, .22, 0, turn);
      b.add('box', '#4c5755', x, .16, z + .088, .036, .09, .012);
      b.add('box', 'window', x + .05, .25, z + .088, .032, .043, .014);
      b.add('box', walls, x + dx, .16, z + dz, .14, .16, .14, 0, turn);
      b.add('gable', f.cloth, x + dx, .3, z + dz, .18, .12, .18, 0, turn);
    }
  }

  // Basilica (Christian): ivory nave, twin towers and lapis-roofed aisles.
  basilicaCity(b) {
    b.add('box', '#b8b59b', 0, .07, 0, 1.3, .14, 1.12);
    b.add('box', '#dcdac0', 0, .23, -.02, .68, .33, .86);
    b.add('gable', '#426f8a', 0, .62, -.1, .7, .38, .89);
    b.add('box', '#8fa4a4', 0, .43, -.1, .76, .05, .95);
    b.add('box', 'bannerGold', 0, .817, -.1, .025, .026, .91);
    for (const side of [-1, 1]) {
      b.add('box', '#e4dfc3', side * .31, .51, .24, .23, .88, .27);
      b.add('cone4', '#416d88', side * .31, 1.1, .24, .22, .33, .24, 0, Math.PI / 4);
      b.add('box', 'bannerGold', side * .31, 1.34, .24, .024, .19, .024);
      b.add('box', 'bannerGold', side * .31, 1.36, .24, .11, .022, .022);
      b.add('box', '#597f96', side * .31, .66, .381, .085, .23, .013);
      b.add('arch', '#f1e4c4', side * .31, .67, .4, .145, .31, .27);
      for (const band of [.2, .49, .91]) b.add('box', '#c4bc99', side * .31, band, .24, .25, .035, .29);
      b.add('box', '#d2cfb2', side * .47, .18, -.15, .24, .2, .38);
      b.add('cone4', '#698e9a', side * .47, .37, -.15, .24, .19, .38, 0, Math.PI / 4);
      // Buttresses break up the broad nave walls.
      for (const z of [-.35, -.12, .1]) b.add('box', '#b5b296', side * .36, .25, z, .06, .3, .085);
    }
    b.add('box', '#38546b', 0, .23, .417, .18, .32, .025);
    b.add('arch', '#eadfbd', 0, .25, .445, .29, .41, .32);
    b.add('torus', 'bannerGold', 0, .53, .432, .12, .12, .025);
    b.add('disc', '#6c9dac', 0, .53, .428, .1, .02, .1, Math.PI / 2);
    for (let step = 0; step < 3; step++) b.add('box', '#d4d2b3', 0, .04 + step * .034, .72 - step * .074, .38, .05, .11);
    b.add('box', '#d4d5ba', 0, .7, -.26, .19, .6, .22);
    b.add('cone4', '#47758f', 0, 1.12, -.26, .22, .29, .24, 0, Math.PI / 4);
  }

  // Pylon (Egyptian): sandstone pylons, stepped sanctuary, sacred pool and palms.
  pylonCity(b) {
    b.add('box', '#b6a27b', 0, .055, 0, 1.32, .11, 1.14);
    for (let step = 0; step < 3; step++) b.add('box', ['#d0b782', '#dfc68d', '#e6cf96'][step], 0, .13 + step * .13, -.17, .9 - step * .17, .16, .73 - step * .12);
    b.add('box', '#d9bf82', 0, .66, -.2, .4, .39, .34);
    b.add('box', '#528d92', 0, .87, -.2, .47, .055, .4);
    b.add('disc', 'bannerGold', 0, 1.04, -.2, .14, .035, .14, Math.PI / 2);
    for (const side of [-1, 1]) {
      b.add('taper4', '#dbbf86', side * .34, .4, .3, .24, .65, .2, 0, Math.PI / 4);
      b.add('box', '#4d959b', side * .34, .67, .3, .29, .06, .24);
      b.add('box', '#bd9151', side * .34, .4, .457, .038, .32, .015);
      b.add('cone4', 'bannerGold', side * .34, .79, .3, .07, .15, .07, 0, Math.PI / 4);
      for (const y of [.2, .32, .54]) b.add('box', '#a67b43', side * .34, y, .456, .14, .018, .016);
      const x = side * .57, z = -.3;
      b.add('cylinder', '#a28b5b', x, .39, z, .035, .63, .035, 0, 0, -side * .12);
      for (let leaf = 0; leaf < 5; leaf++) {
        const a = leaf * TAU / 5;
        b.add('leaf', '#6f9563', x + Math.cos(a) * .14, .7, z + Math.sin(a) * .14, .09, .035, .23, 0, Math.PI / 2 - a, side * .1);
      }
    }
    b.add('box', '#978a65', 0, .12, .48, .37, .055, .42);
    b.add('box', 'water', 0, .155, .48, .28, .016, .34);
    for (let step = 0; step < 4; step++) b.add('box', '#dfc489', 0, .1 + step * .04, .12 - step * .07, .34, .05, .1);
    b.add('box', '#36566a', 0, .66, -.022, .14, .24, .012);
    b.add('box', '#c7954c', 0, .8, -.008, .24, .036, .039);
  }

  // Colonnade (Greek): marble peristyle, blue pediment roof, bronze acroteria and an olive court.
  colonnadeCity(b) {
    for (let level = 0; level < 3; level++) b.add('box', ['#b8bea9', '#d2d2b6', '#e6dfc3'][level], 0, .045 + level * .067, 0, 1.2 - level * .14, .08, .94 - level * .11);
    b.add('box', '#dfddc2', 0, .38, -.13, .41, .38, .43);
    for (const x of [-.39, -.13, .13, .39]) for (const z of [-.29, .28]) {
      b.add('cylinder', '#ece5cc', x, .48, z, .041, .47, .041);
      b.add('box', '#eee7cd', x, .735, z, .13, .065, .13);
    }
    b.add('box', '#e0d8b9', 0, .79, -.005, 1.05, .11, .79);
    b.add('gable', '#427a97', 0, 1.04, -.005, 1.12, .38, .83);
    b.add('gable', '#e3dbbc', 0, 1.04, .42, 1.08, .31, .033);
    b.add('box', 'bannerGold', 0, 1.24, -.005, .035, .06, .88);
    b.add('disc', 'bannerGold', 0, 1.02, .446, .072, .018, .072, Math.PI / 2);
    for (const side of [-1, 1]) b.add('cone4', 'bannerGold', side * .42, .97, .32, .067, .18, .055, 0, Math.PI / 4);
    b.add('box', '#678d9b', 0, .39, .095, .14, .25, .014);
    this.tree(b, -.58, .09, -.26, .58, 'round', randomFor('olive court'));
    b.add('disc', '#c1b78e', .53, .13, .32, .12, .09, .12);
    b.add('leaf', '#798c5e', .53, .24, .32, .1, .12, .1);
  }

  // Longhouse (Norse): stone footing, timber hall with shingled roof, and a storehouse.
  longhouseCity(b) {
    b.add('rock', '#5e6b6f', 0, .1, 0, .77, .2, .67);
    b.add('box', '#756a55', -.12, .38, .08, .68, .47, .65);
    b.add('gable', '#4d7985', -.12, .82, .08, .83, .47, .79);
    for (const z of [-.28, .12, .45]) for (const side of [-1, 1]) this.segment(b, [-.12 + side * .41, .59, z], [-.12, 1.055, z], .027, '#aa905e', .025);
    b.add('box', '#b09b68', -.12, 1.03, .08, .045, .043, .79);
    for (const side of [-1, 1]) {
      b.add('box', '#b19c6c', -.12 + side * .31, .4, .25, .042, .49, .051);
      b.add('box', '#344957', -.12 + side * .18, .46, .414, .08, .16, .015);
      b.add('disc', 'bannerGold', -.12 + side * .24, .37, .426, .066, .02, .066, Math.PI / 2);
    }
    b.add('box', '#3a4b52', -.12, .3, .417, .14, .29, .025);
    b.add('arch', '#b79b65', -.12, .31, .44, .22, .35, .3);
    b.add('box', '#68777b', .43, .33, -.19, .39, .45, .38);
    b.add('cone4', '#66818a', .43, .62, -.19, .36, .18, .36, 0, Math.PI / 4);
    b.add('box', 'window', .43, .29, .01, .17, .18, .015);
    b.add('taper', '#586d78', -.44, .58, -.3, .13, .86, .13);
    b.add('cone4', '#8fc3d7', -.44, 1.16, -.3, .13, .38, .13, 0, Math.PI / 4);
    b.add('box', 'bannerGold', -.44, 1.0, -.3, .23, .035, .21);
    b.add('box', '#909d9a', .5, .14, .39, .22, .19, .15);
    b.add('box', '#bdc9bf', .5, .25, .39, .3, .055, .21);
    for (let i = 0; i < 3; i++) b.add('cylinder', '#897b5e', -.4 + i * .12, .16, .53, .05, .27, .05, 0, 0, Math.PI / 2);
  }

  banner(b, x, y, z, color, height) {
    b.add('cylinder', '#b9aa7b', x, y + height / 2, z, .018, height, .018);
    b.add('cone', 'bannerGold', x, y + height + .065, z, .035, .13, .035);
    b.add('box', color, x + .1, y + height - .13, z, .2, .26, .018);
    b.add('box', 'bannerGold', x + .1, y + height - .13, z + .012, .035, .095, .008);
  }

  unit(b, kind, f, faction) {
    b.add('cylinder', '#485a54', 0, .025, 0, .2, .04, .2);
    b.add('cylinder', f.color, 0, .049, 0, .19, .008, .19);
    let bodyY = .29;
    if (kind === 'rider') {
      const horse = faction === 'thor' ? '#4d4742' : '#b49e79';
      b.add('box', horse, 0, .25, .015, .2, .2, .4);
      b.add('cone', horse, 0, .42, -.19, .1, .28, .12, -.45);
      b.add('box', horse, 0, .52, -.26, .09, .1, .15);
      for (const x of [-.075, .075]) for (const z of [-.12, .15]) b.add('cylinder', '#756149', x, .11, z, .025, .21, .025);
      b.add('box', f.cloth, 0, .36, .03, .23, .06, .24);
      bodyY = .52;
      b.add('leaf', '#534b3e', 0, .31, .3, .036, .2, .043, 0, 0, .24);
      b.add('box', '#534b3e', 0, .49, -.16, .042, .19, .075, -.45);
      b.add('box', f.cloth, .2, .99, -.04, .19, .1, .016, 0, 0, -.14);
    }
    if (kind === 'settler') {
      b.add('box', '#907454', -.15, .16, .14, .31, .2, .27);
      for (const x of [-.32, .02]) b.add('cylinder', '#493f31', x, .12, .14, .1, .035, .1, 0, 0, Math.PI / 2);
      for (const side of [-1, 1]) b.add('cylinder', '#9a815a', -.15 + side * .15, .36, .14, .015, .38, .015);
      b.add('gable', '#d8cfaa', -.15, .58, .14, .38, .15, .33);
      this.banner(b, .18, .05, .13, f.cloth, .76);
    }
    const legacy = !!LEGACY_STYLES[faction];
    const heroCloth = kind !== 'hero' || !legacy ? f.cloth : {michael: '#d4d5c3', ra: '#e4d19b', athena: '#447591'}[faction] || '#665d52';
    b.add('cone', heroCloth, 0, bodyY, 0, .14, .34, .12);
    b.add('box', faction === 'thor' ? '#9aa9ae' : '#c3c9b6', 0, bodyY + .09, -.035, .15, .15, .09);
    b.add('sphere', '#c5a57d', 0, bodyY + .25, 0, .078, .09, .078);
    if (kind === 'hero') {
      b.add('cone', f.cloth, 0, bodyY - .01, .08, .18, .4, .085);
      if (!legacy) mythicChampion(b, faction, bodyY);
      else this.legacyChampion(b, faction, bodyY);
    } else if (kind === 'archer') {
      const bow = [[.14, bodyY - .17, -.05], [.27, bodyY - .05, -.05], [.3, bodyY + .13, -.05], [.25, bodyY + .3, -.05], [.13, bodyY + .36, -.05]];
      for (let i = 1; i < bow.length; i++) this.segment(b, bow[i - 1], bow[i], .022, '#b89b68', .022);
      this.segment(b, bow[0], bow[4], .008, '#e1d7b5', .008);
      b.add('cylinder', '#715e45', -.06, bodyY + .06, .1, .035, .23, .035, 0, 0, -.2);
      b.add('sphere', f.cloth, 0, bodyY + .3, .025, .09, .085, .08);
    } else if (kind === 'builder') {
      b.add('cylinder', '#977b52', .17, bodyY + .09, 0, .018, .42, .018, 0, 0, -.4);
      b.add('box', '#8c9d96', .23, bodyY + .28, 0, .23, .1, .085);
      b.add('box', '#a18a64', -.045, bodyY + .03, .12, .19, .22, .1);
      b.add('disc', '#bba275', 0, bodyY + .32, 0, .115, .033, .115);
    } else if (kind !== 'settler') {
      b.add('cone', faction === 'thor' ? '#565e5c' : '#c9cbb8', 0, bodyY + .34, 0, .082, .12, .078);
      b.add('cylinder', '#b1a183', .18, bodyY + .07, -.04, .013, .6, .013);
      b.add('cone', '#dce0c9', .18, bodyY + .42, -.04, .032, .17, .032);
      b.add('sphere', f.cloth, -.14, bodyY + .05, -.04, .085, .12, .035);
      if (kind === 'warrior') {
        b.add('box', '#c8c6ad', -.16, bodyY + .07, -.078, .2, .24, .03);
        b.add('box', f.cloth, -.16, bodyY + .07, -.098, .16, .2, .012);
        b.add('box', 'bannerGold', -.16, bodyY + .065, -.109, .018, .18, .008);
        b.add('box', f.cloth, 0, bodyY + .43, 0, .032, .1, .16);
      }
    }
    if (kind !== 'rider') for (const x of [-.047, .047]) b.add('box', '#4c5147', x, .095, -.015, .046, .12, .063);
  }

  // Champions of the four original art styles.
  legacyChampion(b, faction, bodyY) {
    if (faction === 'michael') {
      // Michael: winged armour and a sword; God is never portrayed as a unit.
      b.add('sphere', '#bcb17e', 0, bodyY + .31, .012, .083, .051, .078);
      b.add('torus', 'bannerGold', 0, bodyY + .32, .082, .12, .12, .021);
      for (const side of [-1, 1]) {
        b.add('leaf', '#d8dcca', side * .19, bodyY + .19, .12, .12, .23, .055, 0, 0, -side * .48);
        for (let feather = 0; feather < 3; feather++) {
          b.add('cone', '#efe9d2', side * (.21 + feather * .05), bodyY + .27 - feather * .03, .12, .039, .25 - feather * .02, .028, 0, 0, -side * (.53 + feather * .15));
        }
      }
      b.add('box', 'bannerGold', .16, bodyY + .13, -.03, .11, .021, .022);
      b.add('box', '#eceddc', .16, bodyY + .3, -.03, .032, .34, .014);
    } else if (faction === 'ra') {
      // Ra: falcon head, sun disc and ceremonial staff.
      b.add('sphere', '#526f76', 0, bodyY + .26, 0, .079, .103, .079);
      b.add('cone', '#d4b166', 0, bodyY + .25, -.086, .044, .13, .03, -Math.PI / 2);
      b.add('disc', 'bannerGold', 0, bodyY + .46, .013, .102, .025, .102, Math.PI / 2);
      b.add('torus', '#5ba2ab', 0, bodyY + .46, .027, .105, .105, .028);
      b.add('cylinder', '#bd9955', .18, bodyY + .12, -.02, .017, .74, .017);
      b.add('box', '#64a8af', 0, bodyY + .13, -.096, .14, .055, .017);
    } else if (faction === 'athena') {
      // Athena: bronze helmet, blue mantle, round shield and spear.
      b.add('sphere', '#bdaf74', 0, bodyY + .3, .006, .085, .079, .081);
      b.add('box', '#476d82', 0, bodyY + .39, .01, .045, .1, .18);
      b.add('sphere', 'bannerGold', -.15, bodyY + .06, -.06, .1, .13, .028);
      b.add('sphere', '#477385', -.15, bodyY + .065, -.087, .061, .076, .01);
      b.add('cylinder', '#9e8b5b', .17, bodyY + .1, -.025, .013, .68, .013);
      b.add('cone', '#d4d9c8', .17, bodyY + .51, -.025, .028, .14, .026);
    } else {
      // Thor: red beard, fur cloak and a forged hammer.
      b.add('sphere', '#96613e', 0, bodyY + .3, .023, .09, .071, .08);
      b.add('cone', '#a66a43', 0, bodyY + .19, -.07, .073, .16, .05, 0, 0, Math.PI);
      for (const side of [-1, 1]) b.add('leaf', '#92968a', side * .105, bodyY + .16, .05, .09, .085, .1);
      b.add('cylinder', '#9a8157', .18, bodyY + .12, -.04, .021, .43, .021);
      b.add('box', '#b0bfbd', .18, bodyY + .38, -.04, .22, .14, .12);
      b.add('torus', 'bannerGold', 0, bodyY + .02, 0, .12, .1, .08, Math.PI / 2);
    }
  }

  // Labels ----------------------------------------------------------------------

  addCityLabel(city, position, f, hasIntel = true) {
    const label = document.createElement('div');
    label.className = 'world-city-label';
    label.style.setProperty('--faction', f.color);
    label.title = hasIntel ? `${city.name} · Population ${city.population}` : `${city.name} · Population unknown`;
    label.setAttribute('role', 'button');
    label.setAttribute('aria-label', hasIntel ? `Select ${city.name}, population ${city.population}` : `Select ${city.name}, population unknown`);
    label.tabIndex = 0;
    const name = document.createElement('div');
    name.className = 'world-city-name';
    const pop = document.createElement('span');
    pop.className = 'world-city-pop';
    pop.textContent = hasIntel ? String(city.population ?? 1) : '?';
    const text = document.createElement('span');
    text.textContent = String(city.name);
    name.append(pop, text);
    label.append(name);
    if (hasIntel && city.hp < city.maxHp) {
      const bar = document.createElement('div');
      bar.className = 'world-label-hp';
      const fill = document.createElement('span');
      fill.style.width = `${clamp(city.hp / city.maxHp * 100, 0, 100)}%`;
      bar.append(fill);
      label.append(bar);
    }
    const stem = document.createElement('div');
    stem.className = 'world-city-stem';
    label.append(stem);
    label.addEventListener('click', e => {
      e.stopPropagation();
      this.onTileClick?.(city.tileId);
    });
    label.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      this.onTileClick?.(city.tileId);
    });
    this.overlay.append(label);
    const halfWidth = Math.min(100, Math.max(46, String(city.name).length * 4 + 20));
    this.labels.push({element: label, position, type: 'city', cityId: city.id, halfWidth});
  }

  addUnitLabel(unit, position, f) {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'world-unit-label';
    label.style.setProperty('--faction', f.color);
    label.dataset.exhausted = String(unit.moves === 0);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `${ICON_SPRITE}#${UNIT_ICONS.includes(unit.kind) ? unit.kind : 'army'}`);
    svg.append(use);
    const hp = document.createElement('span');
    hp.className = 'world-unit-hp';
    const fill = document.createElement('span');
    fill.style.width = `${clamp((unit.hp || 1) / (unit.maxHp || unit.hp || 1) * 100, 0, 100)}%`;
    hp.append(fill);
    label.append(svg, hp);
    const army = unit.armySize >= 3;
    label.dataset.army = String(army);
    if (army) {
      const badge = document.createElement('span');
      badge.className = 'world-army-badge';
      badge.textContent = '3';
      badge.setAttribute('aria-hidden', 'true');
      label.append(badge);
    }
    const name = `${unit.name || unit.kind}${army ? ' · Army of 3' : ''}`;
    label.title = `${name} · ${unit.hp}/${unit.maxHp} health · ${unit.moves} moves`;
    label.setAttribute('aria-label', `Select ${name}, ${unit.hp} of ${unit.maxHp} health, ${unit.moves} moves`);
    label.addEventListener('click', e => {
      e.stopPropagation();
      if (this.onUnitClick) this.onUnitClick(unit.id);
      else this.onTileClick?.(unit.tileId);
    });
    this.overlay.append(label);
    this.labels.push({element: label, position, type: 'unit', actorId: unit.id});
  }

  // Projects labels to the screen and spreads stacked unit markers apart. Runs only
  // when the camera, a label or an animation changed.
  updateLabels() {
    if (!this.renderer) return;
    this.labelsDirty = false;
    const w = this.width, h = this.height, now = performance.now();
    const rects = this.labelRects ??= [];
    let used = 0;
    const take = () => rects[used++] ??= {left: 0, right: 0, top: 0, bottom: 0};
    const overlaps = (left, right, top, bottom) => {
      for (let i = 0; i < used; i++) {
        const r = rects[i];
        if (left < r.right && right > r.left && top < r.bottom && bottom > r.top) return true;
      }
      return false;
    };
    const attempts = Math.min(160, Math.max(40, this.labels.length * 5));
    for (const label of this.labels) {
      const p = scratchVector.copy(label.position);
      const animation = this.actorAnimations?.get(label.actorId);
      if (animation) p.add(actorMotionOffset(animation, now, scratchOffset));
      p.project(this.camera);
      const visible = this.labelsEnabled && !this.showcase && p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.08 && Math.abs(p.y) < 1.08
        && (label.type !== 'unit' || this.span < 17.5);
      if (visible !== label.shown) {
        label.shown = visible;
        label.element.style.display = visible ? '' : 'none';
      }
      if (!visible) continue;
      let x = (p.x * .5 + .5) * w, y = (-p.y * .5 + .5) * h;
      if (label.type === 'city') {
        const rect = take(), half = label.halfWidth || 60;
        Object.assign(rect, {left: x - half, right: x + half, top: y - 42, bottom: y - 8});
      } else {
        const army = label.element.dataset.army === 'true';
        const size = this.touchUi ? (army ? 52 : 46) : (army ? 34 : 28), baseX = x, baseY = y;
        // Spread overlapping markers in screen pixels so every stack member keeps
        // its own button, including at distant zoom. City nameplates reserve room.
        for (let attempt = 0; attempt < attempts; attempt++) {
          const ring = Math.ceil(attempt / 8), angle = (attempt % 8) * Math.PI / 4;
          x = clamp(baseX + Math.cos(angle) * ring * size, 18, w - 18);
          y = clamp(baseY + Math.sin(angle) * ring * size, 18, h - 18);
          if (!overlaps(x - size / 2, x + size / 2, y - size / 2, y + size / 2)) break;
        }
        Object.assign(take(), {left: x - size / 2, right: x + size / 2, top: y - size / 2, bottom: y + size / 2});
      }
      const sx = Math.round(x), sy = Math.round(y);
      if (sx !== label.screenX || sy !== label.screenY) {
        label.screenX = sx;
        label.screenY = sy;
        label.element.style.transform = `translate3d(${sx}px,${sy}px,0) translate(-50%,${label.type === 'city' ? '-100%' : '-50%'})`;
      }
      const z = Math.round(1000 - p.z * 100);
      if (z !== label.zIndex) {
        label.zIndex = z;
        label.element.style.zIndex = String(z);
      }
    }
  }

  // Highlights ------------------------------------------------------------------

  highlightPalette() {
    return this.highContrast
      ? {move: ['#ffffff', 1], found: ['#7ff0d8', 1], attack: ['#ff6a3d', 1], pending: ['#ffd166', 1], selected: ['#ffd84a', 1]}
      : {move: ['#EFE7D6', .6], found: ['#6fc2ad', .95], attack: ['#C0462E', 1], pending: ['#D59A3A', 1], selected: ['#C9A227', 1]};
  }

  // All selection, movement, founding and attack marks share one draw call.
  updateHighlights({selected = null, reachable = [], attackable = [], foundable = [], pendingAttack = null} = {}) {
    if (!this.highlightMesh) return;
    const palette = this.highlightPalette(), rings = [], crosses = [];
    const place = id => {
      const tile = this.tileMap.get(typeof id === 'string' ? id : id?.id || id?.tileId);
      if (!tile) return null;
      const p = worldPosition(tile);
      return [p.x, this.groundLevel(tile) + .035, p.z];
    };
    const ring = (id, radius, width, [color, alpha]) => {
      const at = place(id);
      if (at) rings.push([...at, radius, width, color, alpha]);
      return at;
    };
    for (const id of reachable || []) ring(id, .9, .05, palette.move);
    for (const id of foundable || []) ring(id, .74, .07, palette.found);
    for (const id of attackable || []) {
      const at = ring(id, .92, .06, palette.attack);
      if (at && id !== pendingAttack) crosses.push([...at, .34, .05, ...palette.attack]);
    }
    if (pendingAttack) {
      const at = ring(pendingAttack, .96, .11, palette.pending);
      if (at) crosses.push([...at, .42, .08, ...palette.pending]);
    }
    if (selected) ring(selected, 1, .085, palette.selected);
    const previous = this.highlightMesh.geometry;
    this.highlightMesh.geometry = ringGeometry(rings, crosses);
    previous.dispose();
    this.highlightMesh.visible = rings.length + crosses.length > 0;
    this.highlightMesh.userData.marks = {rings: rings.length, crosses: crosses.length};
    this.requestRender();
  }

  applyHover(id) {
    if (id !== this.currentHovered) {
      this.currentHovered = id;
      const tile = id ? this.tileMap.get(id) : null;
      this.hoverRing.visible = !!tile;
      if (tile) {
        const p = worldPosition(tile);
        this.hoverRing.position.set(p.x, this.groundLevel(tile) + .03, p.z);
      }
      this.onTileHover?.(id);
    }
    this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
  }

  clearHover() {
    this.currentHovered = null;
    this.pendingHover = null;
    if (this.hoverRing) this.hoverRing.visible = false;
    this.onTileHover?.(null);
    this.requestRender();
  }

  animatePieces(now) {
    if (!this.actorAnimations?.size || !this.piecesGroup) return;
    for (const mesh of this.piecesGroup.children) {
      const {actorIds, baseMatrices} = mesh.userData;
      let changed = false;
      for (let index = 0; index < actorIds.length; index++) {
        const animation = actorIds[index] && this.actorAnimations.get(actorIds[index]);
        if (!animation) continue;
        const offset = actorMotionOffset(animation, now, scratchOffset);
        const matrix = this.dummy.matrix.copy(baseMatrices[index]);
        matrix.elements[12] += offset.x;
        matrix.elements[13] += offset.y;
        matrix.elements[14] += offset.z;
        mesh.setMatrixAt(index, matrix);
        changed = true;
      }
      if (changed) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
    for (const [id, animation] of this.actorAnimations) if (now - animation.started >= animation.duration) this.actorAnimations.delete(id);
    if (this.renderer?.shadowMap && this.quality?.shadow) this.renderer.shadowMap.needsUpdate = true;
  }

  // Input -----------------------------------------------------------------------

  // Pieces are tested first; otherwise the invisible hex pick mesh names the tile.
  pick(e) {
    if (!this.pickMesh || this.showcase) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.pickHits ??= [];
    hits.length = 0;
    let actor = null;
    if (this.piecesGroup) {
      this.raycaster.intersectObject(this.piecesGroup, true, hits);
      for (const hit of hits) {
        if (hit.object.userData.actorIds?.[hit.instanceId]) {
          actor = hit;
          break;
        }
      }
    }
    this.lastPickedActorId = actor ? actor.object.userData.actorIds[actor.instanceId] : null;
    if (actor) return actor.object.userData.tileIds[actor.instanceId];
    hits.length = 0;
    this.raycaster.intersectObject(this.pickMesh, false, hits);
    return hits.length ? hits[0].object.userData.tileIds[hits[0].instanceId] : null;
  }

  pointerDown(e) {
    if (this.contextLost || this.showcase) return;
    this.renderer.domElement.focus({preventScroll: true});
    if (e.pointerType === 'touch') {
      this.touches ??= new Map();
      this.touches.set(e.pointerId, {x: e.clientX, y: e.clientY});
      if (this.touches.size > 1) {
        this.pinch = this.touchMeasure();
        this.suppressTap = true;
        this.drag = null;
        this.renderer.domElement.setPointerCapture(e.pointerId);
        return;
      }
    }
    this.drag = {x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, button: e.button, moved: false};
    this.renderer.domElement.setPointerCapture(e.pointerId);
  }

  pointerMove(e) {
    if (this.contextLost || this.showcase) return;
    if (this.touches?.has(e.pointerId)) {
      this.touches.set(e.pointerId, {x: e.clientX, y: e.clientY});
      if (this.touches.size > 1) {
        const next = this.touchMeasure();
        if (this.pinch && next.distance > 0) {
          this.zoom(Math.log(next.distance / Math.max(1, this.pinch.distance)) * this.spanGoal);
          this.pan(next.x - this.pinch.x, next.y - this.pinch.y);
        }
        this.pinch = next;
        return;
      }
      if (this.suppressTap) return;
    }
    if (this.drag) {
      const dx = e.clientX - this.drag.lastX, dy = e.clientY - this.drag.lastY;
      if (Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 4) this.drag.moved = true;
      if ((this.drag.button === 2 || this.drag.button === 1 || e.pointerType === 'touch') && this.drag.moved) {
        this.pan(dx, dy);
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      this.drag.lastX = e.clientX;
      this.drag.lastY = e.clientY;
      if (this.drag.moved) return;
    }
    // Hover picking is coalesced to one raycast per drawn frame.
    const hover = this.hoverPoint ??= {clientX: 0, clientY: 0};
    hover.clientX = e.clientX;
    hover.clientY = e.clientY;
    this.pendingHover = hover;
    this.requestRender();
  }

  pointerUp(e) {
    const drag = this.drag;
    this.drag = null;
    this.renderer.domElement.style.cursor = 'grab';
    if (!this.contextLost && drag && !drag.moved && drag.button === 0 && !e.cancelled && !this.suppressTap) {
      const id = this.pick(e);
      if (this.lastPickedActorId && this.onUnitClick) this.onUnitClick(this.lastPickedActorId);
      else if (id) this.onTileClick?.(id);
    }
    this.touches?.delete(e.pointerId);
    this.pinch = null;
    if (!this.touches?.size) this.suppressTap = false;
    try {
      this.renderer.domElement.releasePointerCapture(e.pointerId);
    } catch {
      // The pointer was never captured.
    }
  }

  touchMeasure() {
    const [a, b] = [...this.touches.values()];
    return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y)};
  }

  canKeyboardPan() {
    if (this.contextLost || this.showcase || typeof document === 'undefined' || document.activeElement !== this.renderer?.domElement) return false;
    const welcome = document.getElementById('welcome');
    return (!welcome || welcome.hidden) && !document.querySelector('dialog[open]');
  }

  pan(dx, dy) {
    const speed = this.span * 2 / (this.height || 800);
    // Camera-right and projected camera-forward vectors on the tabletop.
    const x = (-dx * .82 - dy * .8) * speed, z = (dx * .57 - dy * 1.14) * speed;
    const c = Math.cos(this.azimuth || 0), s = Math.sin(this.azimuth || 0);
    this.targetGoal.x = clamp(this.targetGoal.x + x * c + z * s, -14, 14);
    this.targetGoal.z = clamp(this.targetGoal.z - x * s + z * c, -12, 12);
    this.requestRender();
  }

  zoom(delta) {
    this.spanGoal = clamp(this.spanGoal - Number(delta || 0), 4.4, 21);
    this.requestRender();
  }

  focus(tileId) {
    const tile = this.tileMap.get(tileId);
    if (!tile || this.showcase) return;
    this.targetGoal.copy(worldPosition(tile));
    this.spanGoal = Math.min(this.spanGoal, this.width > 900 ? 4.9 : 6.1);
    this.measureFocusAnchor();
    this.requestRender();
  }

  resetCamera() {
    this.targetGoal.set(0, 0, 0);
    this.spanGoal = DEFAULT_SPAN;
    this.requestRender();
  }

  setLabels(value) {
    if (this.showcase) this.labelsBeforeShowcase = !!value;
    else this.labelsEnabled = !!value;
    this.labelsDirty = true;
    this.updateLabels();
  }

  setAccessibility({reducedMotion = this.reducedMotion, highContrast = this.highContrast} = {}) {
    this.reducedMotion = !!reducedMotion;
    this.highContrast = !!highContrast;
    if (this.reducedMotion) {
      this.target?.copy(this.targetGoal);
      this.span = this.spanGoal;
      if (this.showcase) this.azimuthGoal = 0;
      this.azimuth = this.azimuthGoal ?? 0;
      for (const mesh of this.piecesGroup?.children || []) {
        if (!mesh.isInstancedMesh) continue;
        mesh.userData.baseMatrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
      this.actorAnimations?.clear();
      this.keys?.clear();
    }
    if (this.hoverRing) this.hoverRing.material.color.set(this.highContrast ? '#ffffff' : '#EFE7D6');
    if (this.lastHighlights) this.updateHighlights(this.lastHighlights);
    if (this.renderer) {
      this.updateCamera();
      this.labelsDirty = true;
      this.updateLabels();
      this.requestRender();
    }
  }

  // Graphics context ------------------------------------------------------------

  handleContextLost(event) {
    event.preventDefault();
    if (this.disposed) return;
    this.contextLost = true;
    this.keys?.clear();
    this.drag = null;
    this.pinch = null;
    this.touches?.clear();
    this.suppressTap = false;
    this.clearHover();
    this.sleep();
    if (this.contextNoticeTimer) clearTimeout(this.contextNoticeTimer);
    this.renderer.domElement.setAttribute('aria-busy', 'true');
    if (this.overlay) this.overlay.style.visibility = 'hidden';
    if (this.graphicsStatus) {
      this.graphicsStatus.hidden = false;
      this.graphicsStatus.textContent = 'Graphics paused. Your campaign is still here.';
    }
  }

  handleContextRestored() {
    if (this.disposed || !this.contextLost) return;
    this.contextLost = false;
    this.lastTime = performance.now();
    this.lastRenderedAt = 0;
    this.perfSince = 0;
    this.perfFrames = 0;
    this.renderer.shadowMap.needsUpdate = true;
    // The pre-filtered sky lived only on the GPU; everything else re-uploads from memory.
    this.createEnvironment();
    this.renderer.domElement.setAttribute('aria-busy', 'false');
    if (this.overlay) this.overlay.style.visibility = '';
    if (this.graphicsStatus) {
      this.graphicsStatus.textContent = 'Graphics restored. Continue your campaign.';
      this.graphicsStatus.hidden = false;
      this.contextNoticeTimer = setTimeout(() => {
        if (!this.contextLost && this.graphicsStatus) this.graphicsStatus.hidden = true;
      }, 3000);
    }
    // Three.js restores its GPU caches. Reuse the CPU scene and campaign state;
    // no reload, new campaign, or duplicate canvas is necessary.
    this.resize();
    this.requestRender();
  }

  // Camera ----------------------------------------------------------------------

  resize() {
    if (!this.renderer) return;
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.renderer.setSize(this.width, this.height, false);
    if (this.showcase) this.frameShowcase();
    else this.measureFocusAnchor();
    this.updateCamera();
    this.labelsDirty = true;
    this.updateLabels();
    this.requestRender();
  }

  // Keep the focused miniature between the top HUD and the selection panel.
  measureFocusAnchor() {
    if (!this.container || typeof document === 'undefined' || this.showcase) return;
    const canvas = this.container.getBoundingClientRect(), compact = canvas.width <= 900;
    if (!canvas.width || !canvas.height) return;
    const x = canvas.width * (compact ? .5 : .55), preferredY = canvas.height * (compact ? .43 : .45);
    let top = 40, bottom = canvas.height - 60;
    const root = this.container.closest('#game') || this.container.parentElement;
    for (const [selector, edge, padding] of FOCUS_OBSTACLES) {
      const panel = root?.querySelector(selector);
      if (!panel || !panel.getClientRects().length) continue;
      const rect = panel.getBoundingClientRect(), screenX = canvas.left + x;
      if (screenX < rect.left - 55 || screenX > rect.right + 55) continue;
      if (edge === 'top') top = Math.max(top, rect.bottom - canvas.top + padding);
      else bottom = Math.min(bottom, rect.top - canvas.top - padding);
    }
    const y = top <= bottom ? clamp(preferredY, top, bottom) : (top + bottom) * .5;
    this.focusAnchor = {x: x / canvas.width, y: clamp(y / canvas.height, .18, .64)};
  }

  updateCamera() {
    const aspect = (this.width || 1) / (this.height || 1);
    const anchor = this.focusAnchor || {x: this.width > 900 ? .55 : .5, y: this.width > 900 ? .45 : .43};
    // Shift the orthographic frustum in pixels, leaving the world target intact.
    const shiftX = (1 - 2 * anchor.x) * this.span * aspect, shiftY = (2 * anchor.y - 1) * this.span;
    this.camera.left = -this.span * aspect + shiftX;
    this.camera.right = this.span * aspect + shiftX;
    this.camera.top = this.span + shiftY;
    this.camera.bottom = -this.span + shiftY;
    cameraOffset.copy(CAMERA_OFFSET);
    if (this.azimuth) cameraOffset.applyAxisAngle(Y_AXIS, this.azimuth);
    this.camera.position.copy(this.target).add(cameraOffset);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    if (this.water) this.water.material.uniforms.viewDirection.value.copy(cameraOffset).normalize();
    if (this.gridUniform) {
      const fade = 1 - smoothstep(13, 19, this.span);
      this.gridUniform.value = (this.highContrast ? .24 : .12) * (this.showcase ? .4 : fade);
    }
  }

  dispose() {
    this.disposed = true;
    this.sleep();
    this.resizeObserver?.disconnect();
    if (this.contextNoticeTimer) clearTimeout(this.contextNoticeTimer);
    if (this.events) {
      for (const type of CANVAS_EVENTS) this.renderer?.domElement.removeEventListener(type, this.events[type]);
      for (const type of WINDOW_EVENTS) window.removeEventListener(type, this.events[type]);
      document.removeEventListener('visibilitychange', this.events.visibilitychange);
      this.pixelRatioQuery?.removeEventListener?.('change', this.events.pixelratio);
    }
    const geometries = new Set(), materials = new Set(), textures = new Set();
    this.scene?.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
    });
    Object.values(this.geometry).forEach(g => geometries.add(g));
    this.materialCache.forEach(m => materials.add(m));
    Object.values(this.surfaces || {}).forEach(m => materials.add(m));
    if (this.terrainMaterial) materials.add(this.terrainMaterial);
    if (this.water) textures.add(this.water.material.uniforms.seabed.value);
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    textures.forEach(t => t?.dispose());
    this.environment?.dispose();
    this.sun?.shadow.map?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.overlay?.remove();
    this.graphicsStatus?.remove();
  }
}

const UNIT_ICONS = ['hero', 'warrior', 'archer', 'rider', 'settler', 'builder'];
// HUD panels the focused tile should stay clear of: [selector, edge, padding in px].
const FOCUS_OBSTACLES = [['.hud-top', 'top', 56], ['#coach', 'top', 72], ['.objective', 'top', 88], ['#selection', 'bottom', 94]];
const WHITE = '#ffffff';

// Weld only normals, keeping portable triangles and soft lighting.
function weldNormals(geometry) {
  geometry.computeVertexNormals();
  const position = geometry.attributes.position, normal = geometry.attributes.normal, sums = new Map(), keys = [];
  for (let i = 0; i < position.count; i++) {
    const key = `${Math.round(position.getX(i) * 1e5)},${Math.round(position.getY(i) * 1e5)},${Math.round(position.getZ(i) * 1e5)}`;
    keys.push(key);
    if (!sums.has(key)) sums.set(key, new THREE.Vector3());
    sums.get(key).add(new THREE.Vector3(normal.getX(i), normal.getY(i), normal.getZ(i)));
  }
  for (const sum of sums.values()) sum.normalize();
  for (let i = 0; i < position.count; i++) {
    const n = sums.get(keys[i]);
    normal.setXYZ(i, n.x, n.y, n.z);
  }
}

// Flat hexagonal outlines and crosses as one triangle list with RGBA vertex colours.
// rings: [x, y, z, radius, width, color, alpha]; crosses: [x, y, z, half-length, width, color, alpha].
function ringGeometry(rings, crosses = []) {
  const positions = [], colors = [], color = new THREE.Color();
  const quad = (a, b, c, d, rgba) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) colors.push(...rgba);
  };
  for (const [x, y, z, radius, width, hex, alpha] of rings) {
    color.set(hex);
    const rgba = [color.r, color.g, color.b, alpha], inner = radius - width / 2, outer = radius + width / 2;
    for (let i = 0; i < 6; i++) {
      const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % 6];
      quad([x + ax * inner, y, z + az * inner], [x + ax * outer, y, z + az * outer], [x + bx * outer, y, z + bz * outer], [x + bx * inner, y, z + bz * inner], rgba);
    }
  }
  for (const [x, y, z, half, width, hex, alpha] of crosses) {
    color.set(hex);
    const rgba = [color.r, color.g, color.b, alpha];
    for (const [ux, uz] of [[Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2]]) {
      const px = -uz * width / 2, pz = ux * width / 2;
      quad([x - ux * half - px, y, z - uz * half - pz], [x - ux * half + px, y, z - uz * half + pz], [x + ux * half + px, y, z + uz * half + pz], [x + ux * half - px, y, z + uz * half - pz], rgba);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  return geometry;
}
