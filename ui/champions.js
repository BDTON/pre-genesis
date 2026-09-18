// Champion figures: a small reader for the glTF-binary files the figure kit
// exports (tools/figures/build.py). The files use one skin, one set of six
// clips and three untextured materials, so the whole format three.js would
// otherwise pull in is unnecessary here: this module reads exactly what those
// files contain and nothing else.
//
// A kit is parsed once per figure and shared; every champion on the map gets
// its own bones, mixer and actions, and shares the kit's geometry, materials
// and clips. Nothing here is loaded until world.js asks for it.
import * as THREE from '../vendor/three.module.js';

// Split so no source literal reads as an asset path: the release builder
// precaches `assets/…` literals, and figures must stay out of the core bundle.
const FIGURE_DIR = 'assets/figures/';
const FIGURE_EXT = '.gl' + 'b';

/** Founder's Five champions with a figure. Moses has none yet. */
export {FIGURE_IDS as CHAMPION_FIGURES} from './portraits.js';
import {FIGURE_IDS as CHAMPION_FIGURES} from './portraits.js';
/** Patron figures. Shown as a patron only, never as a unit on the map. */
export {PATRON_FIGURE_IDS as PATRON_FIGURES} from './portraits.js';
export const CLIPS = Object.freeze(['idle', 'move', 'attack', 'power', 'hurt', 'victory']);

export function figureUrl(id) {
  return FIGURE_DIR + id + FIGURE_EXT;
}
export function hasFigure(id) {
  return CHAMPION_FIGURES.includes(id);
}

const COMPONENTS = {5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
const ITEMS = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};
const ATTRIBUTES = {POSITION: 'position', NORMAL: 'normal', COLOR_0: 'color', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight', TEXCOORD_0: 'uv'};
const GLB_MAGIC = 0x46546C67, JSON_CHUNK = 0x4E4F534A, BIN_CHUNK = 0x004E4942;

// Warm gold stands in for the emissive slots the exporter cannot carry per
// vertex (haloes, the sun disk, the stream of fire); the vertex colour keeps
// its own hue underneath.
const GLOW = new THREE.Color('#F2CF8C');

function parseGlb(buffer) {
  const head = new DataView(buffer);
  if (head.getUint32(0, true) !== GLB_MAGIC) throw Error('not a binary glTF file');
  let offset = 12, json = null, bin = null;
  while (offset + 8 <= buffer.byteLength) {
    const length = head.getUint32(offset, true), type = head.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === JSON_CHUNK) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)));
    else if (type === BIN_CHUNK) bin = new Uint8Array(buffer, start, length);
    offset = start + length + (4 - length % 4) % 4;
  }
  if (!json) throw Error('binary glTF without a JSON chunk');
  return {json, bin};
}

function readAccessor(gltf, bin, index) {
  const accessor = gltf.accessors[index];
  const Type = COMPONENTS[accessor.componentType];
  const itemSize = ITEMS[accessor.type];
  if (!Type || !itemSize) throw Error(`unsupported accessor ${accessor.componentType}/${accessor.type}`);
  const view = gltf.bufferViews[accessor.bufferView];
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = view.byteStride || 0;
  const packed = Type.BYTES_PER_ELEMENT * itemSize;
  if (!stride || stride === packed) {
    return {array: new Type(bin.buffer, bin.byteOffset + start, accessor.count * itemSize), itemSize, normalized: !!accessor.normalized};
  }
  // Interleaved data is copied out; the figures do not use it, but a rebuilt
  // file that does still loads.
  const array = new Type(accessor.count * itemSize);
  for (let i = 0; i < accessor.count; i++) {
    const row = new Type(bin.buffer, bin.byteOffset + start + i * stride, itemSize);
    array.set(row, i * itemSize);
  }
  return {array, itemSize, normalized: !!accessor.normalized};
}

function primitiveGeometry(gltf, bin, primitive) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, target] of Object.entries(ATTRIBUTES)) {
    const index = primitive.attributes[name];
    if (index === undefined) continue;
    const {array, itemSize, normalized} = readAccessor(gltf, bin, index);
    geometry.setAttribute(target, new THREE.BufferAttribute(array, itemSize, normalized));
  }
  if (primitive.indices !== undefined) {
    const {array} = readAccessor(gltf, bin, primitive.indices);
    geometry.setIndex(new THREE.BufferAttribute(array, 1));
  }
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  // Skinned vertices leave the rest pose, so the cull sphere is widened once.
  if (geometry.boundingSphere) geometry.boundingSphere.radius *= 1.6;
  return geometry;
}

function primitiveMaterial(gltf, primitive) {
  const def = gltf.materials?.[primitive.material] || {};
  const pbr = def.pbrMetallicRoughness || {};
  const factor = pbr.baseColorFactor || [1, 1, 1, 1];
  const material = new THREE.MeshStandardMaterial({
    vertexColors: !!primitive.attributes.COLOR_0,
    metalness: pbr.metallicFactor ?? 1,
    roughness: pbr.roughnessFactor ?? 1,
    side: def.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: false,
  });
  material.color.setRGB(factor[0], factor[1], factor[2], THREE.LinearSRGBColorSpace);
  material.name = def.name || 'figure';
  if (def.emissiveFactor) {
    material.emissive.copy(GLOW);
    material.emissiveIntensity = .34 * Math.max(...def.emissiveFactor);
  }
  return material;
}

function buildClip(gltf, bin, animation, prefix) {
  const tracks = [];
  for (const channel of animation.channels) {
    const node = gltf.nodes[channel.target.node];
    const path = channel.target.path;
    if (!node?.name || path === 'weights') continue;
    const sampler = animation.samplers[channel.sampler];
    const times = readAccessor(gltf, bin, sampler.input).array;
    const {array: values} = readAccessor(gltf, bin, sampler.output);
    const Track = path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    const property = path === 'rotation' ? 'quaternion' : path === 'translation' ? 'position' : 'scale';
    const track = new Track(`${node.name}.${property}`, Array.from(times), Array.from(values));
    if (sampler.interpolation === 'STEP') track.setInterpolation(THREE.InterpolateDiscrete);
    tracks.push(track);
  }
  const name = animation.name?.startsWith(prefix) ? animation.name.slice(prefix.length) : animation.name || 'clip';
  return new THREE.AnimationClip(name, -1, tracks);
}

// One figure, parsed once. `lods[0]` is the full figure and `lods[1]` the far
// one; each entry lists {geometry, material, variant} for one draw call.
class FigureKit {
  constructor(id, gltf, bin) {
    this.id = id;
    this.clips = new Map();
    this.instances = new Set();
    const geometries = new Map(), materials = new Map();
    const partsFor = meshIndex => {
      const mesh = gltf.meshes[meshIndex];
      return mesh.primitives.map((primitive, index) => {
        const key = `${meshIndex}:${index}`;
        if (!geometries.has(key)) geometries.set(key, primitiveGeometry(gltf, bin, primitive));
        const materialKey = primitive.material ?? 'default';
        if (!materials.has(materialKey)) materials.set(materialKey, primitiveMaterial(gltf, primitive));
        return {geometry: geometries.get(key), material: materials.get(materialKey)};
      });
    };
    this.geometries = geometries;
    this.materials = materials;
    // Mesh nodes are named <id>_LOD0, <id>_LOD1 and optionally <id>_LOD*_<variant>.
    this.lods = [[], []];
    this.nodes = gltf.nodes;
    this.meshNodes = [];
    gltf.nodes.forEach((node, index) => {
      if (node.mesh === undefined) return;
      const match = /_LOD(\d)(?:_(.+))?$/.exec(node.name || '');
      const level = match ? Math.min(1, Number(match[1])) : 0;
      const variant = match?.[2] || null;
      this.meshNodes.push(index);
      for (const part of partsFor(node.mesh)) this.lods[level].push({...part, variant});
    });
    if (!this.lods[1].length) this.lods[1] = this.lods[0];
    const skin = gltf.skins?.[0];
    this.joints = skin ? skin.joints : [];
    this.boneInverses = skin && skin.inverseBindMatrices !== undefined
      ? (() => {
        const {array} = readAccessor(gltf, bin, skin.inverseBindMatrices);
        return this.joints.map((_, i) => new THREE.Matrix4().fromArray(array, i * 16));
      })()
      : this.joints.map(() => new THREE.Matrix4());
    for (const animation of gltf.animations || []) {
      const clip = buildClip(gltf, bin, animation, `${id}_`);
      this.clips.set(clip.name, clip);
    }
    // The figure's own height, so the renderer can scale every figure alike.
    let height = 0;
    for (const {geometry} of this.lods[0]) {
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) height = Math.max(height, position.getY(i));
    }
    this.height = height || 1;
  }

  // A fresh skeleton and mixer over the shared geometry and clips.
  createInstance({variant = null} = {}) {
    const root = new THREE.Group();
    root.name = `${this.id}-figure`;
    const nodes = new Map();
    const make = index => {
      if (nodes.has(index)) return nodes.get(index);
      const def = this.nodes[index];
      const bone = new THREE.Bone();
      bone.name = def.name || `node${index}`;
      if (def.translation) bone.position.fromArray(def.translation);
      if (def.rotation) bone.quaternion.fromArray(def.rotation);
      if (def.scale) bone.scale.fromArray(def.scale);
      nodes.set(index, bone);
      for (const child of def.children || []) if (!this.meshNodes.includes(child)) bone.add(make(child));
      return bone;
    };
    const parented = new Set();
    for (const [index, def] of this.nodes.entries()) for (const child of def.children || []) parented.add(child);
    for (const [index] of this.nodes.entries()) {
      if (parented.has(index) || this.meshNodes.includes(index)) continue;
      root.add(make(index));
    }
    for (const joint of this.joints) make(joint);
    const bones = this.joints.map(joint => nodes.get(joint));
    const skeleton = new THREE.Skeleton(bones, this.boneInverses);
    root.updateMatrixWorld(true);
    const meshes = this.lods.map((parts, level) => parts.map(part => {
      const mesh = new THREE.SkinnedMesh(part.geometry, part.material);
      mesh.name = `${this.id}-lod${level}${part.variant ? `-${part.variant}` : ''}`;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.userData.variant = part.variant;
      mesh.bind(skeleton, new THREE.Matrix4());
      mesh.visible = level === 0 && (!part.variant || part.variant === variant);
      root.add(mesh);
      return mesh;
    }));
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map();
    for (const [name, clip] of this.clips) actions.set(name, mixer.clipAction(clip));
    const instance = {kit: this, root, meshes, skeleton, mixer, actions, variant};
    this.instances.add(instance);
    return instance;
  }

  releaseInstance(instance) {
    this.instances.delete(instance);
    instance.mixer.stopAllAction();
    instance.mixer.uncacheRoot(instance.root);
    instance.skeleton.dispose();
    instance.root.removeFromParent();
  }

  dispose() {
    for (const instance of [...this.instances]) this.releaseInstance(instance);
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear();
    this.materials.clear();
    this.clips.clear();
  }
}

const pending = new Map();

/** Fetches and parses one figure. Repeat calls share the same kit. */
export function loadFigure(id) {
  if (pending.has(id)) return pending.get(id);
  const promise = fetch(figureUrl(id), {credentials: 'omit'})
    .then(response => {
      if (!response.ok) throw Error(`${response.status} ${response.statusText}`);
      return response.arrayBuffer();
    })
    .then(buffer => {
      const {json, bin} = parseGlb(buffer);
      if (!bin) throw Error('binary glTF without a buffer chunk');
      return new FigureKit(id, json, bin);
    });
  pending.set(id, promise);
  promise.catch(() => pending.delete(id));
  return promise;
}

/** Forgets every parsed figure and frees its GPU buffers. */
export function unloadFigures() {
  for (const promise of pending.values()) promise.then(kit => kit.dispose(), () => {});
  pending.clear();
}

export {FigureKit};
