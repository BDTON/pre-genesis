import * as THREE from './vendor/three.module.js';
import {FACTIONS as FACTION_RULES, PRODUCTIONS} from './engine.js';
import {artProfile} from './art-direction.js';
import {mythicChampion,mythicCapital} from './mythic-miniatures.js';

// Original modelled world, with a project-owned meadow material.
const SQRT3 = Math.sqrt(3);
const FACTIONS = {
  gondor: { color: '#a5c7ed', cloth: '#315e91', light: '#e6ecd9', symbol: '✦' },
  rohan: { color: '#eac06f', cloth: '#b28a37', light: '#f6dc8f', symbol: '☼' },
  elves: { color: '#83bbc9', cloth: '#386f94', light: '#e7e4ce', symbol: '◇' },
  mordor: { color: '#8facd1', cloth: '#40577f', light: '#c9dcf2', symbol: 'ϟ' },
};
// Mythology attributes drive champion identity independently of gameplay powers.
const factionVisualCache=new Map();
function factionVisual(id){
  if(factionVisualCache.has(id))return factionVisualCache.get(id);
  const rule=FACTION_RULES.find(f=>f.id===id),style=rule?.visualStyle||(FACTIONS[id]?id:'gondor'),base=FACTIONS[style]||FACTIONS.gondor;
  const color=rule?.color||base.color,cloth=rule?.color?`#${new THREE.Color(color).multiplyScalar(.56).getHexString()}`:base.cloth;
  const profile=artProfile(id);const visual={...base,id,style,color,cloth:FACTIONS[id]?cloth:profile.color,profile};factionVisualCache.set(id,visual);return visual;
}
const terrainColors = {
  grass: ['#508552', '#609454', '#79a462', '#6b9451'],
  forest: ['#255a48', '#326d4d', '#477f50', '#356747'],
  hills: ['#819c6f', '#91a779', '#aaa87a', '#879c70'],
  mountain: ['#a2afa8', '#829897', '#b8bcb0', '#8eaaa4'],
  water: ['#12617b', '#19748a', '#237a8f', '#308b96'],
  waste: ['#626771', '#777976', '#7d786b', '#676b6b'],
};

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function randomFor(s) { let a = hash(s); return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function worldPosition(tile) { return new THREE.Vector3(SQRT3 * (tile.q + tile.r / 2), 0, 1.5 * tile.r); }
const clamp = THREE.MathUtils.clamp;
const HEX_DIRECTIONS=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];

// The plan consumes observed city state only. Housing is a population symbol;
// completed buildings and active work sites each have a separate representation.
export function cityVisualPlan(city,hasIntel=true){
  const buildings=[...(city.buildings||[])],districts=[...(city.districts||[])].slice(0,4);
  const item=hasIntel?PRODUCTIONS.find(p=>p.id===city.queue&&p.kind!=='unit'&&!buildings.includes(p.id)&&!districts.includes(p.id)):null;
  return {buildings,districts,housing:Math.min(6,Math.max(0,Math.ceil((Number(city.population)||0)/2))),construction:item?{id:item.id,kind:item.kind,stage:Math.min(3,Math.max(0,Math.floor((Number(city.production)||0)/item.cost*3)))}:null};
}

export function actorMotionOffset(animation,now){
  const t=clamp((now-animation.started)/animation.duration,0,1),weight=1-t*t*(3-2*t);
  return animation.offset.clone().multiplyScalar(weight).add(new THREE.Vector3(0,Math.sin(t*Math.PI)*Math.min(.045,animation.offset.length()*.025),0));
}

class ModelBatch {
  constructor(view) { this.view = view; this.entries = new Map(); this.origin = new THREE.Vector3(); this.factor = 1; this.rotation = 0; }
  at(x, y, z, scale = 1, rotation = 0) { this.origin.set(x, y, z); this.factor = scale; this.rotation = rotation; return this; }
  add(geometry, material, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
    const g = this.view.geometry[geometry]; const mat = typeof material === 'string' ? this.view.material(material) : material;
    const key = `${g.uuid}:${mat.uuid}`;
    if (!this.entries.has(key)) this.entries.set(key, { geometry: g, material: mat, matrices: [], tileIds: [], actorIds: [] });
    const c = Math.cos(this.rotation), s = Math.sin(this.rotation), f = this.factor;
    const obj = this.view.dummy;
    obj.position.set(this.origin.x + (x * c + z * s) * f, this.origin.y + y * f, this.origin.z + (z * c - x * s) * f);
    obj.scale.set(sx * f, sy * f, sz * f); obj.rotation.set(rx, ry + this.rotation, rz); obj.updateMatrix();
    this.entries.get(key).matrices.push(obj.matrix.clone()); this.entries.get(key).tileIds.push(this.tileId || null);this.entries.get(key).actorIds.push(this.actorId||null);
  }
  finish() {
    const group = new THREE.Group();
    for (const e of this.entries.values()) {
      const mesh = new THREE.InstancedMesh(e.geometry, e.material, e.matrices.length);
      e.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = !e.material.transparent; mesh.receiveShadow = true;
      mesh.userData.tileIds = e.tileIds;mesh.userData.actorIds=e.actorIds;mesh.userData.baseMatrices=e.matrices;mesh.computeBoundingSphere(); group.add(mesh);
    }
    return group;
  }
}

export class WorldView {
  constructor(container, { onTileClick, onTileHover, onUnitClick } = {}) {
    this.container = container; this.onTileClick = onTileClick; this.onTileHover = onTileHover; this.onUnitClick = onUnitClick;
    this.tileMap = new Map(); this.labels = []; this.materialCache = new Map(); this.geometry = {};
    this.dummy = new THREE.Object3D(); this.target = new THREE.Vector3(0, 0, 0); this.targetGoal = this.target.clone();
    this.span = 13.2; this.spanGoal = 13.2; this.keys = new Set(); this.lastTime = performance.now();
    this.pointer = new THREE.Vector2(-10, -10); this.raycaster = new THREE.Raycaster();
    this.labelsEnabled = true; this.disposed = false; this.currentHovered = null; this.drag = null;
    this.reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;this.highContrast=false;this.motionTime=0;
    this.touchUi=!!window.matchMedia?.('(pointer: coarse)').matches;
    this.compactGraphics=this.touchUi&&window.innerWidth<=900;
    this.contextLost=false;
    // Preserve the app's absolute layout; establish a stacking context so map labels
    // cannot cover its menus, objectives, or other HUD panels.
    if (getComputedStyle(this.container).position === 'static') this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden'; this.container.style.isolation = 'isolate'; this.container.style.zIndex = '0';
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#182c43');
    this.scene.fog = new THREE.Fog('#6c7a88', 43, 91);
    this.camera = new THREE.OrthographicCamera(-20, 20, 13, -13, .1, 110);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (error) {
      const fallback = document.createElement('div'); fallback.className = 'world-webgl-error';
      fallback.style.cssText = 'position:absolute;inset:0;display:grid;place-content:center;color:#ede4cf;padding:40px;background:#25343d;text-align:center;font:16px Georgia;line-height:1.8';
      fallback.textContent = 'Enable graphics acceleration in your browser, then reload to enter Pre-Genesis.';
      this.container.appendChild(fallback); this.error = error; return;
    }
    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.compactGraphics?1.25:1.6));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Interactive map of Pre-Genesis. Select a tile. Right-drag or WASD to pan; scroll to zoom.');
    this.container.appendChild(renderer.domElement);
    this.overlay = document.createElement('div'); this.overlay.className = 'world-label-layer';
    this.overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2';
    this.container.appendChild(this.overlay);
    this.graphicsStatus=document.createElement('div');this.graphicsStatus.className='world-graphics-status';this.graphicsStatus.hidden=true;
    this.graphicsStatus.setAttribute('role','status');this.graphicsStatus.setAttribute('aria-live','polite');this.graphicsStatus.setAttribute('aria-atomic','true');this.container.appendChild(this.graphicsStatus);
    this.installStyles(); this.createGeometry(); this.createGroundTexture(); this.createLighting(); this.createBackdrop(); this.createAtmosphere();
    this.highlightGroup = new THREE.Group(); this.scene.add(this.highlightGroup);
    this.hoverRing = this.createRing('#fff3ce', 1.01, .7); this.hoverRing.visible = false; this.scene.add(this.hoverRing);
    this.events = {
      pointerdown: e => this.pointerDown(e), pointermove: e => this.pointerMove(e), pointerup: e => this.pointerUp(e), pointercancel: e => this.pointerUp({...e,pointerId:e.pointerId,cancelled:true}),
      pointerleave: () => { if (!this.drag) this.clearHover(); }, contextmenu: e => e.preventDefault(),
      wheel: e => { e.preventDefault(); this.zoom(-e.deltaY * .008); },
      keydown: e => { if(!this.canKeyboardPan()||e.altKey||e.ctrlKey||e.metaKey)return;const key=e.key.toLowerCase();if(['w','a','s','d'].includes(key)){this.keys.add(key);e.preventDefault();} },
      keyup: e => this.keys.delete(e.key.toLowerCase()), blur: () => this.keys.clear(),
      webglcontextlost:e=>this.handleContextLost(e),webglcontextrestored:()=>this.handleContextRestored(),
    };
    for (const type of ['pointerdown','pointermove','pointerup','pointercancel','pointerleave','contextmenu','wheel','webglcontextlost','webglcontextrestored']) renderer.domElement.addEventListener(type, this.events[type], { passive: false });
    window.addEventListener('keydown', this.events.keydown); window.addEventListener('keyup', this.events.keyup); window.addEventListener('blur', this.events.blur);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
    this.resize(); this.animate = this.animate.bind(this); this.frame = requestAnimationFrame(this.animate);
  }

  installStyles() {
    if (document.getElementById('realm-world-styles')) return;
    const style = document.createElement('style'); style.id = 'realm-world-styles';
    style.textContent = `
      #world canvas:focus-visible{outline:2px solid #f8dda0;outline-offset:-4px}
      .world-graphics-status{position:absolute;z-index:4;left:50%;top:38%;transform:translate(-50%,-50%);width:min(380px,82%);padding:20px 24px;background:#142733f5;border:1px solid #dec18a;color:#f4eddb;box-shadow:0 8px 40px #07172077;text-align:center;font:14px/1.65 system-ui}
      .world-city-label{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;white-space:nowrap;pointer-events:auto;cursor:pointer;filter:drop-shadow(0 3px 5px #15202b75);transition:opacity .2s}
      .world-city-name{display:flex;align-items:center;gap:7px;padding:5px 10px 5px 6px;border:1px solid var(--faction);border-radius:3px;background:linear-gradient(180deg,#233437ed,#17282bf0);color:#f5eed9;font-family:var(--font,Georgia),serif;font-size:12px;letter-spacing:.075em;box-shadow:0 2px 10px #10252d40}
      .world-city-pop{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border:1px solid var(--faction);border-radius:50%;color:var(--faction);font:700 10px system-ui;letter-spacing:0}
      .world-city-stem{width:1px;height:12px;background:linear-gradient(var(--faction),transparent)}
      .world-label-hp{height:2px;background:#192b2b;width:78%;margin-top:2px;border-radius:2px;overflow:hidden}
      .world-label-hp span{display:block;height:100%;background:var(--faction)}
      .world-unit-label{position:absolute;transform:translate(-50%,-50%);border:1px solid var(--faction);border-radius:50%;width:22px;height:22px;display:grid;place-items:center;padding:0;color:#ffefd0;background:#1c3039e8;box-shadow:0 2px 7px #12232b80;font:12px Georgia;pointer-events:auto;cursor:pointer}
      .world-unit-label:after{content:'';position:absolute;bottom:-5px;width:16px;height:2px;border-radius:1px;background:linear-gradient(to right,var(--faction) var(--hp),#263f44 var(--hp))}
      .world-unit-label[data-exhausted='true']{opacity:.65}
      .world-unit-label[data-army='true']{border-radius:5px;border-width:2px;box-shadow:0 0 0 2px #132733,0 2px 7px #12232b80}
      .world-army-badge{position:absolute;top:-9px;right:-9px;min-width:17px;padding:1px 2px;background:#d8bc82;color:#15242b;border:1px solid #efddb4;border-radius:2px;font:700 8px/10px system-ui;letter-spacing:-.5px;pointer-events:none}
      .world-city-label:hover .world-city-name,.world-unit-label:hover{background:#3a514e;color:#fff}
      @media(max-width:750px){.world-city-name{font-size:10px;gap:4px;padding:3px 6px 3px 4px}.world-city-pop{width:16px;height:16px;font-size:9px}.world-unit-label{width:18px;height:18px;font-size:10px}}
      @media(pointer:coarse){.world-unit-label{width:36px;height:36px;font-size:15px}.world-city-name{min-height:34px;padding:6px 10px}.world-city-pop{width:20px;height:20px}}
    `;
    document.head.appendChild(style);
  }

  createGeometry() {
    this.geometry = {
      hex: new THREE.CylinderGeometry(1.002, 1.002, 1, 6),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
      taper: new THREE.CylinderGeometry(.65, 1, 1, 7),
      taper4: new THREE.CylinderGeometry(.72, 1, 1, 4),
      cone: new THREE.ConeGeometry(1, 1, 7),
      cone4: new THREE.ConeGeometry(1, 1, 4),
      cone5: new THREE.ConeGeometry(1, 1, 9, 4),
      box: new THREE.BoxGeometry(1, 1, 1),
      rock: new THREE.IcosahedronGeometry(1, 2),
      sphere: new THREE.SphereGeometry(1, 16, 12),
      leaf: new THREE.IcosahedronGeometry(1, 2),
      torus: new THREE.TorusGeometry(1, .12, 5, 16),
      mist: new THREE.SphereGeometry(1, 12, 8),
      disc: new THREE.CylinderGeometry(1,1,1,20),
    };
    // Shared architectural silhouettes export exactly as they appear in play.
    const gable=new THREE.Shape();gable.moveTo(-.5,-.5);gable.lineTo(.5,-.5);gable.lineTo(0,.5);gable.closePath();
    this.geometry.gable=new THREE.ExtrudeGeometry(gable,{depth:1,bevelEnabled:false,steps:1});this.geometry.gable.translate(0,0,-.5);
    const arch=new THREE.Shape();arch.moveTo(-.5,-.5);arch.lineTo(-.5,.08);arch.quadraticCurveTo(-.5,.31,0,.5);arch.quadraticCurveTo(.5,.31,.5,.08);arch.lineTo(.5,-.5);arch.lineTo(.32,-.5);arch.lineTo(.32,.07);arch.quadraticCurveTo(.32,.22,0,.35);arch.quadraticCurveTo(-.32,.22,-.32,.07);arch.lineTo(-.32,-.5);arch.closePath();
    this.geometry.arch=new THREE.ExtrudeGeometry(arch,{depth:.12,bevelEnabled:false,curveSegments:5,steps:1});this.geometry.arch.translate(0,0,-.06);
    const hillPositions=[],hillSegments=20,hillRings=8;
    const hillPoint=(a,t)=>{const r=1-t,y=Math.pow(Math.max(0,1-r*r),2.25);return [Math.cos(a)*r,y-.5,Math.sin(a)*r];};
    for(let ring=0;ring<hillRings;ring++)for(let side=0;side<hillSegments;side++){
      const a=side/hillSegments*Math.PI*2,z=(side+1)/hillSegments*Math.PI*2,t=ring/hillRings,u=(ring+1)/hillRings;
      hillPositions.push(...hillPoint(a,t),...hillPoint(a,u),...hillPoint(z,t));
      if(ring<hillRings-1)hillPositions.push(...hillPoint(z,t),...hillPoint(a,u),...hillPoint(z,u));
    }
    const hillVertices=[],hillIndices=[],hillLookup=new Map();
    for(let i=0;i<hillPositions.length;i+=3){const p=hillPositions.slice(i,i+3),key=p.map(v=>Math.round(v*1e6)).join(',');if(!hillLookup.has(key)){hillLookup.set(key,hillVertices.length/3);hillVertices.push(...p);}hillIndices.push(hillLookup.get(key));}
    this.geometry.hill=new THREE.BufferGeometry();this.geometry.hill.setAttribute('position',new THREE.Float32BufferAttribute(hillVertices,3));this.geometry.hill.setIndex(hillIndices);this.geometry.hill.computeVertexNormals();
    // A clipped trapezoid reaches the exact two hex corners without protruding
    // beyond the tile. Neighboring shore edges meet with no floating sand bars.
    const shoreY=SQRT3/2;
    this.geometry.shoreRibbon=new THREE.BufferGeometry();
    this.geometry.shoreRibbon.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,shoreY,.5,0,shoreY,.42,0,shoreY*.84,-.5,0,shoreY,.42,0,shoreY*.84,-.42,0,shoreY*.84],3));
    this.geometry.shoreRibbon.computeVertexNormals();
    // Angular ridges and a shared, irregular snow line replace stacked cones.
    const peak=(snow=false,cut=false)=>{
      const vertices=[],segments=14,rings=8;
      const point=(a,t)=>{
        const snowLine=.63+.055*Math.sin(a*3+.4)+.045*Math.cos(a*5);
        const y=snow?snowLine+(1-snowLine)*t:t*(cut?snowLine:1);
        const ridge=1+.19*Math.sin(a*3+.5)+.13*Math.cos(a*7);
        const radius=Math.pow(1-y,.87)*ridge*(1+.09*Math.sin(y*17+a*2));
        const skin=1;
        return [Math.cos(a)*radius*skin+.14*y,y-.5,Math.sin(a)*radius*skin-.1*y];
      };
      for(let ring=0;ring<rings;ring++)for(let side=0;side<segments;side++){
        const a=side/segments*Math.PI*2,b=(side+1)/segments*Math.PI*2,t=ring/rings,u=(ring+1)/rings;
        vertices.push(...point(a,t),...point(a,u),...point(b,t));
        if(ring<rings-1||cut)vertices.push(...point(b,t),...point(a,u),...point(b,u));
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();return geo;
    };
    this.geometry.cone5.dispose();this.geometry.cone5=peak();this.geometry.mountainRock=peak(false,true);this.geometry.snowPeak=peak(true);
    for(const name of ['leaf','rock']){
      const pos=this.geometry[name].attributes.position;
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        const amount=name==='leaf'?.07:.035;
        const variation=1+amount*Math.sin(x*11+y*7+z*3)+amount*.6*Math.cos(z*13-x*5);
        pos.setXYZ(i,x*variation,y*variation,z*variation);
      }
      // Weld only normals, retaining portable triangles and soft foliage lighting.
      this.geometry[name].computeVertexNormals();
      const normals=this.geometry[name].attributes.normal,sums=new Map(),keys=[];
      for(let i=0;i<pos.count;i++){
        const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v*1e5)).join(',');keys.push(key);
        if(!sums.has(key))sums.set(key,new THREE.Vector3());
        sums.get(key).add(new THREE.Vector3(normals.getX(i),normals.getY(i),normals.getZ(i)));
      }
      for(const normal of sums.values())normal.normalize();
      for(let i=0;i<pos.count;i++){const n=sums.get(keys[i]);normals.setXYZ(i,n.x,n.y,n.z);}
    }
    this.geometry.bough=new THREE.ConeGeometry(1,1,12,3);
    const branches=this.geometry.bough.attributes.position;
    for(let i=0;i<branches.count;i++){
      const x=branches.getX(i),y=branches.getY(i),z=branches.getZ(i),a=Math.atan2(z,x),r=1+.13*Math.sin(a*6)+.08*Math.cos(a*3+y*8);
      branches.setXYZ(i,x*r,y+.045*Math.sin(a*7)*(1-(y+.5)),z*r);
    }
    this.geometry.bough.computeVertexNormals();
  }

  createGroundTexture(){
    const fallback=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);fallback.needsUpdate=true;
    this.groundTextureUniform={value:fallback};this.groundTextureReady={value:0};
    this.groundTexture=new THREE.TextureLoader().load(new URL('./assets/terrain-meadow-v1.png',import.meta.url).href,texture=>{
      if(this.disposed){texture.dispose();fallback.dispose();return;}
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;
      this.groundTextureUniform.value=texture;this.groundTextureReady.value=1;fallback.dispose();
    },undefined,()=>{if(!this.disposed)this.groundTextureUniform.value=fallback;});
  }

  material(key) {
    if (this.materialCache.has(key)) return this.materialCache.get(key);
    const special = {
      water: { color:'#137d94',roughness:.22,metalness:.08 },
      riverLight: {color:'#c8f1e8',roughness:.24,transparent:true,opacity:.42,depthWrite:false},
      waterDeep: {color:'#185d78',roughness:.3,metalness:.05},
      waterShallow: {color:'#48aaae',roughness:.3,metalness:.03},
      lava: {color:'#ff7536',emissive:'#ed4920',emissiveIntensity:1.6},
      eye: {color:'#ffcf79',emissive:'#ffa33b',emissiveIntensity:2.6},
      window: {color:'#fbd797',emissive:'#d99d40',emissiveIntensity:.7},
      bannerGold:{color:'#d8b469',metalness:.42,roughness:.38},
      snow:{color:'#eff6ef',roughness:.88},
      fog:{color:'#506e7d',roughness:1,flatShading:false,emissive:'#243b46',emissiveIntensity:.18},
      fogHigh:{color:'#638290',roughness:1,flatShading:false,emissive:'#263e49',emissiveIntensity:.15},
      forgeSmoke:{color:'#454b4c',roughness:1,transparent:true,opacity:.24,depthWrite:false,flatShading:false},
    };
    const mat = new THREE.MeshStandardMaterial({ color:key.startsWith('#') ? key : '#ffffff',roughness:.91,flatShading:false,...special[key] });
    if(FACTION_RULES.some(f=>factionVisual(f.id).cloth===key))mat.userData.gameRole='faction-cloth';
    if(Object.values(terrainColors).flat().includes(key)||['#71664f','#ccba91','#a59f89','#beb198','#8d9589','#858968','#999675','#aaa17b'].includes(key)){
      mat.onBeforeCompile=shader=>{
        shader.uniforms.atlasGroundMap=this.groundTextureUniform;shader.uniforms.atlasGroundReady=this.groundTextureReady;
        shader.vertexShader='varying vec3 atlasWorld;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 atlasPosition=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
          atlasPosition=instanceMatrix*atlasPosition;
          #endif
          atlasWorld=(modelMatrix*atlasPosition).xyz;
          #include <project_vertex>`);
        shader.fragmentShader=`varying vec3 atlasWorld;uniform sampler2D atlasGroundMap;uniform float atlasGroundReady;
          float atlasHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float atlasNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(atlasHash(i),atlasHash(i+vec2(1.,0.)),f.x),mix(atlasHash(i+vec2(0.,1.)),atlasHash(i+vec2(1.,1.)),f.x),f.y);}
          `+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec2 atlasP=atlasWorld.xz;
          float atlasFootprint=max(length(dFdx(atlasP)),length(dFdy(atlasP)));
          float atlasFine=1.-smoothstep(.25,.8,atlasFootprint*61.);
          float atlasMiddle=1.-smoothstep(.25,.8,atlasFootprint*13.);
          float atlasFields=atlasNoise(atlasP*2.4)*.52+mix(.5,atlasNoise(atlasP*13.),atlasMiddle)*.29+mix(.5,atlasNoise(atlasP*61.),atlasFine)*.19;
          vec3 atlasDetail=texture2D(atlasGroundMap,atlasP*.34).rgb;
          float atlasGrain=clamp(dot(atlasDetail,vec3(.299,.587,.114))*4.8,.70,1.30);
          diffuseColor.rgb*=(.82+atlasFields*.28)*mix(1.,atlasGrain,atlasGroundReady*.65);
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.11,1.015,.86),smoothstep(.56,.84,atlasNoise(atlasP*3.7))*.36);`);
      };
      mat.customProgramCacheKey=()=> 'aurevale-ground-material-v3';
    }
    this.materialCache.set(key, mat); return mat;
  }

  createLighting() {
    // Amber dawn and a cool sky preserve the depth of green foliage and blue water.
    this.scene.add(new THREE.HemisphereLight('#d4edf4', '#40574b', 1.38));
    this.scene.add(new THREE.AmbientLight('#dae6eb', .12));
    this.sun = new THREE.DirectionalLight('#ffe3b6', 2.55); this.sun.position.set(-16, 24, -14);
    this.sun.castShadow = true; const shadowSize=this.compactGraphics?1024:2048;this.sun.shadow.mapSize.set(shadowSize,shadowSize);
    Object.assign(this.sun.shadow.camera, { left:-24,right:24,top:24,bottom:-24,near:1,far:75 });
    this.sun.shadow.bias = -.0005; this.sun.shadow.normalBias = .025;
    this.sun.shadow.radius = 3; this.scene.add(this.sun);
    const fill = new THREE.DirectionalLight('#a0c5de', .58); fill.position.set(20, 15, 13); this.scene.add(fill);
  }

  createBackdrop() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300,300),this.material('#182c43'));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.45; ground.receiveShadow = true; this.scene.add(ground);
    // A broad, softly lit sea surrounds the physical hex terrain.
    const sea = new THREE.Mesh(new THREE.CylinderGeometry(17.6,17.3,.20,96),this.material('water'));
    sea.position.y = -.9; sea.receiveShadow = true; this.scene.add(sea);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(17.3,17.7,.37,96),this.material('#182735'));
    base.position.y = -1.17; base.receiveShadow = true; this.scene.add(base);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(17.45,.035,4,96),this.material('#a88c58'));
    edge.rotation.x = Math.PI / 2; edge.position.y = -.80; this.scene.add(edge);
    this.sea = sea;
  }

  createAtmosphere() {
    const rand = randomFor('golden airborne motes'); const positions = new Float32Array(150 * 3);
    for (let i=0;i<150;i++) { positions[i*3]=(rand()-.5)*35;positions[i*3+1]=rand()*4+.6;positions[i*3+2]=(rand()-.5)*30; }
    const geo = new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.motes = new THREE.Points(geo,new THREE.PointsMaterial({color:'#f8e6b1',size:.035,transparent:true,opacity:.55,depthWrite:false}));
    this.scene.add(this.motes);
    this.clouds = new THREE.Group();
    this.scene.add(this.clouds);
  }

  update(state, { selectedTileId = null, reachable = [], attackable = [] } = {}) {
    const newCampaign=this.state!==state;
    this.state = state; this.selectedTileId = selectedTileId;
    if (!this.renderer) return;
    if(newCampaign){this.lastSeenTiles=new Map();this.lastSeenCities=new Map();this.terrainSignature=null;this.piecesSignature=null;this.actorPositions=new Map();}
    const renderState=this.visibleState(state);this.renderState=renderState;
    this.tileMap = new Map(renderState.tiles.map(t => [t.id,t]));
    const signature = renderState.tiles.map(t=>`${t.id}:${t.terrain}:${t.explored}:${t.visible}:${t.improvement}:${t.resource}:${t.owner}:${t.river}`).join('|');
    if (signature !== this.terrainSignature) { this.terrainSignature = signature; this.buildTerrain(renderState.tiles); }
    const piecesSignature=JSON.stringify({player:renderState.player,cities:renderState.cities,units:renderState.units});
    if(piecesSignature!==this.piecesSignature){this.piecesSignature=piecesSignature;this.buildPieces(renderState);}
    this.lastHighlights={selected:selectedTileId,reachable,attackable};this.updateHighlights(selectedTileId,reachable,attackable);this.measureFocusAnchor();this.updateLabels();
  }

  visibleState(state){
    this.lastSeenTiles??=new Map();this.lastSeenCities??=new Map();
    const actualTiles=new Map((state.tiles||[]).map(tile=>[tile.id,tile]));
    const tiles=(state.tiles||[]).map(tile=>{
      if(tile.explored===false)return {id:tile.id,q:tile.q,r:tile.r,explored:false,visible:false};
      if(tile.visible!==false||tile.owner===state.player){const snapshot={...tile};this.lastSeenTiles.set(tile.id,snapshot);return snapshot;}
      const remembered=this.lastSeenTiles.get(tile.id);
      // On loading a campaign without renderer memory, retain immutable geography
      // only. Current foreign ownership and construction are not observed intel.
      return remembered?{...remembered,visible:false}:{id:tile.id,q:tile.q,r:tile.r,terrain:tile.terrain,resource:tile.resource,river:tile.river,explored:true,visible:false,owner:null,improvement:null};
    });
    const observedCities=new Set();
    for(const city of state.cities||[]){
      const tile=actualTiles.get(city.tileId);if(!tile||tile.explored===false)continue;
      if(tile.visible!==false||city.faction===state.player){
        observedCities.add(city.id);this.lastSeenCities.set(city.id,{...city,buildings:[...(city.buildings||[])],districts:[...(city.districts||[])],districtTiles:{...(city.districtTiles||{})}});
      }
    }
    const cities=[];
    for(const [id,city]of this.lastSeenCities){
      const tile=actualTiles.get(city.tileId);
      if(!tile||tile.explored===false||(tile.visible!==false&&!observedCities.has(id))){this.lastSeenCities.delete(id);continue;}
      cities.push({...city,intelVisible:observedCities.has(id)});
    }
    const units=(state.units||[]).filter(unit=>{const tile=actualTiles.get(unit.tileId);return tile&&tile.explored!==false&&(tile.visible!==false||unit.faction===state.player);});
    return {...state,tiles,cities,units};
  }

  buildTerrain(tiles) {
    if (this.terrainGroup) { this.scene.remove(this.terrainGroup); this.terrainGroup.traverse(o=>{if(o.isInstancedMesh)o.dispose();}); }
    if (this.fogVeil) { this.scene.remove(this.fogVeil); this.fogVeil.geometry.dispose(); this.fogVeil.material.dispose(); this.fogVeil=null; }
    if (this.pickMesh) { this.scene.remove(this.pickMesh); this.pickMesh.dispose(); this.pickMesh.geometry.dispose(); this.pickMesh.material.dispose(); }
    const batch = new ModelBatch(this), lookup = new Map(tiles.map(t=>[t.id,t]));
    const pickGeo = new THREE.CylinderGeometry(1,1,.15,6);
    const pickMat = new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false});
    this.pickMesh = new THREE.InstancedMesh(pickGeo,pickMat,tiles.length); this.pickMesh.userData.tileIds=tiles.map(t=>t.id);
    this.pickMesh.renderOrder=-1;
    tiles.forEach((tile,index)=>{
      const p=worldPosition(tile),rand=randomFor(tile.id);this.dummy.position.set(p.x,.14,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(1,1,1);this.dummy.updateMatrix();this.pickMesh.setMatrixAt(index,this.dummy.matrix);
      batch.at(p.x,0,p.z); batch.tileId=tile.id;
      if (tile.explored === false) {
        // Hidden cells contribute only their coordinates to one continuous veil.
        // Terrain, resources, ownership and improvements never reach its shader.
        return;
      }
      const terrain=terrainColors[tile.terrain] ? tile.terrain : 'grass';
      const height=terrain==='water' ? -.13 : .035;
      batch.add('hex',terrain==='water'?'#263d59':'#71664f',0,-.38,0,1,.61,1);
      const field=Math.sin(p.x*.31+p.z*.19)+Math.cos(p.z*.43-p.x*.11);
      batch.add('hex',terrainColors[terrain][clamp(Math.floor((field+2)*.99),0,3)],0,height-.035,0,1,.16,1);
      this.shoreline(batch,tile,lookup,height);
      if (terrain==='water') {
        batch.add('hex','water',0,-.025,0,1,.018,1);
        // Broken, staggered glints read as water at map scale without a costly reflection pass.
        for(let i=0;i<4;i++){const x=(rand()-.5)*1.15,z=(rand()-.5)*1.15,length=.10+rand()*.26;batch.add('box','riverLight',x,-.009,z,length,.004,.010,0,-.23);if(!this.compactGraphics)batch.add('box','riverLight',x+.075,-.008,z+.048,length*.38,.004,.007,0,-.23);}
        if (rand()>.73) {batch.add('rock','#8d9b8e',.3,.06,.2,.23,.17,.2);batch.add('rock','#a8b0a0',.14,.025,.34,.14,.10,.13);}
      } else if (terrain==='mountain') {
        const dark=(tile.owner&&factionVisual(tile.owner).style==='mordor')||p.x>9;
        this.mountains(batch,rand,dark,height);
      } else if (terrain==='forest') {
        const count=tile.improvement?5:(this.compactGraphics?14:19)+Math.floor(rand()*4);
        for(let i=0;i<count;i++) {const a=rand()*Math.PI*2,r=tile.improvement ? .72 : Math.sqrt(rand())*.77;this.tree(batch,Math.cos(a)*r,height,Math.sin(a)*r,.45+rand()*.46,rand()>.48?'round':'pine',rand);}
        for(let i=0;i<4;i++){const x=(rand()-.5)*1.2,z=(rand()-.5)*1.2;batch.add('rock','#849475',x,height+.035,z,.11,.06,.09);batch.add('leaf','#799757',x+.07,height+.09,z+.04,.09,.10,.08);}
      } else if (terrain==='hills') {
        for(let i=0;i<2;i++){const x=(i-.5)*.34,z=(rand()-.5)*.45,rise=tile.improvement?.11:.17+rand()*.13;batch.add('hill',terrainColors.grass[(i+1)%4],x,height+rise*.47,z,.64+rand()*.13,rise,.49+rand()*.13,0,rand());}
        for(let i=0;i<3;i++)batch.add('rock','#bdbea0',.37+i*.10,height+.08,-.33+i*.09,.12,.13,.09);
        if(rand()>.3)this.tree(batch,-.44,height,.31,.47,'pine',rand);
      } else if (terrain==='waste') {
        for(let i=0;i<4;i++){const x=(rand()-.5)*1.2,z=(rand()-.5)*1.2;batch.add('rock','#414347',x,height+.055,z,.12+rand()*.19,.1+rand()*.2,.13+rand()*.12);}
        if(rand()>.63){batch.add('box','#a1b4b8',.18,height+.05,.1,.53,.008,.028,0,.7);batch.add('rock','#85918c',-.17,height+.085,-.13,.24,.12,.16);}
      } else {
        for(let i=0;i<4;i++){const x=(rand()-.5)*1.4,z=(rand()-.5)*1.4;batch.add('cone',['#92ab65','#799d55','#b7bd75'][i%3],x,height+.05,z,.012,.035+rand()*.04,.012,0,rand()*6);}
        if(rand()>.65&&!tile.improvement&&!tile.river)this.tree(batch,.48,height,-.30,.48,'round',rand);
        if(rand()>.5){for(let i=0;i<5;i++){const x=-.5+rand()*.3,z=.4+rand()*.2;batch.add('cylinder','#709451',x,height+.075,z,.008,.07,.008);batch.add('sphere',i%2?'#ede1b3':'#cdc4d5',x,height+.12,z,.025,.015,.025);}}
      }
      if(tile.river&&terrain!=='water')this.river(batch,tile,lookup,height);
      if(tile.improvement) this.improvement(batch,tile.improvement,height,rand);
      if(tile.resource) this.resource(batch,tile.resource,height,rand);
      if(tile.owner) {
        const color=factionVisual(tile.owner).color;
        for(let i=0;i<6;i++) {
          const a=i*Math.PI/3;
          // Inlaid corner markers make territory visible without painting over the landscape.
          batch.add('box',color,Math.sin(a)*.88,height+.057,Math.cos(a)*.88,.085,.017,.03,0,a);
        }
      }
    });
    this.terrainGroup=batch.finish();this.scene.add(this.terrainGroup);this.pickMesh.computeBoundingSphere();this.scene.add(this.pickMesh);
    this.buildFogVeil(tiles.filter(t=>t.explored===false));
  }

  buildFogVeil(unknown){
    if(!unknown.length)return;
    const vertices=[];
    // Exact hex corners share edges; a single unlit, world-space surface removes
    // individual disks, gaps, shadows and the previous boulder-like relief.
    for(const tile of unknown){
      const p=worldPosition(tile);
      for(let edge=0;edge<6;edge++){
        const a=edge*Math.PI/3+Math.PI/6,b=(edge+1)*Math.PI/3+Math.PI/6;
        vertices.push(p.x,.085,p.z,p.x+Math.cos(b),.085,p.z+Math.sin(b),p.x+Math.cos(a),.085,p.z+Math.sin(a));
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    const material=new THREE.ShaderMaterial({
      uniforms:{time:{value:0},deep:{value:new THREE.Color('#243951')},pale:{value:new THREE.Color('#64788c')}},
      vertexShader:`varying vec2 mapPoint;void main(){mapPoint=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform float time;uniform vec3 deep;uniform vec3 pale;varying vec2 mapPoint;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
        void main(){
          vec2 p=mapPoint*.17+vec2(time*.005,-time*.003);
          float drift=noise(p)*.64+noise(p*2.13+9.7)*.26+noise(p*4.31+4.2)*.10;
          float wisps=noise(vec2(p.x*.7+p.y*1.4,p.y*3.1)+drift);
          vec3 color=mix(deep,pale,smoothstep(.18,.88,drift)*.85+smoothstep(.58,.88,wisps)*.15);
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side:THREE.DoubleSide,
    });
    this.fogVeil=new THREE.Mesh(geometry,material);this.fogVeil.name='Uncharted veil';this.scene.add(this.fogVeil);
  }

  segment(b,from,to,width,color,thickness=.018){
    const a=new THREE.Vector3(...from),end=new THREE.Vector3(...to),delta=end.clone().sub(a),mid=a.clone().add(end).multiplyScalar(.5);
    const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.clone().normalize()));
    b.add('box',color,mid.x,mid.y,mid.z,width,thickness,delta.length()+.018,rotation.x,rotation.y,rotation.z);
  }

  shoreline(b,tile,lookup,h){
    const p=worldPosition(tile),water=tile.terrain==='water';
    for(const [dq,dr]of HEX_DIRECTIONS){
      const near=lookup.get(`${tile.q+dq},${tile.r+dr}`);
      if(!near||near.explored===false||(near.terrain==='water')===water)continue;
      const d=worldPosition(near).sub(p).normalize(),t=new THREE.Vector3(d.z,0,-d.x),mouth=water?near.river:tile.river;
      // Full edge strips join at hex corners; a river leaves an open estuary.
      if(!mouth)b.add('shoreRibbon',water?'waterShallow':'#e1d3ab',0,water?-.008:h+.056,0,1,1,1,0,Math.atan2(d.x,d.z));
      for(const [a,z]of mouth?[[-.48,-.13],[.13,.48]]:[[-.48,.48]]){
        const point=(along,radius,y)=>d.clone().multiplyScalar(radius).addScaledVector(t,along).setY(y).toArray();
        if(mouth)this.segment(b,point(a,.81,water?-.008:h+.056),point(z,.81,water?-.008:h+.056),water?.105:.11,water?'waterShallow':'#e1d3ab',.012);
        if(water)this.segment(b,point(a,.73,-.006),point(z,.73,-.006),.025,'riverLight',.006);
      }
      if(water&&mouth){
        this.segment(b,d.clone().multiplyScalar(SQRT3/2).setY(.117).toArray(),d.clone().multiplyScalar(.62).setY(-.003).toArray(),.145,'water',.016);
        b.add('disc','riverLight',d.x*.60,-.002,d.z*.60,.12,.006,.12);
      }
      if(!water)for(const side of [-1,1]){
        const c=d.clone().multiplyScalar(.70).addScaledVector(t,side*.31);
        b.add('rock','#d2c4a6',c.x,h+.076,c.z,.071,.053,.083,0,Math.atan2(d.x,d.z));
        if(tile.terrain!=='mountain')b.add('leaf','#87945e',c.x-d.x*.08,h+.093,c.z-d.z*.08,.085,.10,.065);
      }
    }
  }

  river(b,tile,lookup,h){
    const p=worldPosition(tile),bend=Math.sin((tile.q+tile.r)*.83)*.13;
    const center=new THREE.Vector3(bend,h+.065,-bend*.35);
    let reaches=0;
    for(const [dq,dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]){
      const near=lookup.get(`${tile.q+dq},${tile.r+dr}`);if(!near||near.explored===false||(!near.river&&near.terrain!=='water'))continue;
      // Exact shared midpoint keeps opposite half-channels joined. Sea tiles
      // supply the short spill to sea level rather than burying it under land.
      const end=worldPosition(near).sub(p).multiplyScalar(.5);end.y=h+.069;
      for(let step=0;step<5;step++){
        const point=t=>center.clone().lerp(end,t).add(new THREE.Vector3(Math.sin(t*Math.PI)*.075,0,Math.sin(t*Math.PI)*.025));
        const a=point(step/5),z=point((step+1)/5);
        this.segment(b,a.toArray(),z.toArray(),.245,'#b7c39a');a.y+=.013;z.y+=.013;this.segment(b,a.toArray(),z.toArray(),.17,'water',.015);
        if(step===1||step===3){a.y+=.009;z.y+=.009;this.segment(b,a.toArray(),z.toArray(),.018,'riverLight',.003);}
      }
      reaches++;
    }
    if(reaches<2){b.add('disc','#a3b08b',center.x,center.y,center.z,.19,.016,.23);b.add('disc','water',center.x,center.y+.014,center.z,.145,.014,.18);}
    for(const side of [-1,1]){b.add('rock','#a8b39a',center.x+side*.23,h+.07,center.z+.28,.11,.075,.13);b.add('cone','#779a64',center.x+side*.22,h+.16,center.z-.22,.022,.2,.025);}
  }

  tree(b,x,y,z,scale,type,rand) {
    b.add('taper','#6c5b43',x,y+scale*.24,z,scale*.045,scale*.48,scale*.045);
    if(type==='pine') {
      const col=['#1d503d','#286044','#3b734a'][Math.floor(rand()*3)],angle=rand()*6;
      for(let layer=0;layer<4;layer++){
        const width=.29-layer*.058;
        b.add('bough',layer>1?'#658f53':col,x+Math.sin(angle+layer)*scale*.024,y+scale*(.37+layer*.16),z,scale*width,scale*(.43-layer*.035),scale*width,0,angle+layer*.6);
      }
    } else {
      const col=type==='gold' ? '#bba357' : ['#487d43','#628e4a','#376d47'][Math.floor(rand()*3)],angle=rand()*6;
      for(let crown=0;crown<4;crown++){
        const a=angle+crown*2.4,dx=Math.cos(a)*scale*.16,dz=Math.sin(a)*scale*.14,top=crown===3;
        b.add('cylinder','#7c6946',x+dx*.45,y+scale*.41,z+dz*.45,scale*.023,scale*.3,scale*.023,Math.sin(a)*.55,0,-Math.cos(a)*.55);
        b.add('leaf',top?(type==='gold'?'#d7b365':'#819c57'):col,x+(top?0:dx),y+scale*(top?.76:.57),z+(top?0:dz),scale*.25,scale*(top?.22:.25),scale*.24,0,a);
      }
    }
  }

  mountains(b,rand,dark,h) {
    for(let i=0;i<3;i++){
      const x=(i-1)*.32,z=(rand()-.5)*.40,height=(i===1?1.45:.95)+rand()*.35,angle=rand()*3,width=i===1?.58:.48;
      b.add(dark?'cone5':'mountainRock',dark?'#3f5057':['#91a7a4','#b7bdb3','#7e979a'][i],x,h+height*.5,z,width,height,width*.9,0,angle);
      if(!dark){b.add('snowPeak','snow',x,h+height*.5,z,width,height,width*.9,0,angle);
        b.add('rock','#a59f89',x-.18,h+.035,z+.15,.30,.13,.26,0,angle);}
      else if(i===1)b.add('cone5','lava',x,h+height*.85,z,.065,.2,.065);
    }
    if(!dark)this.tree(b,.50,h,.43,.38,'pine',rand);
  }

  improvement(b,type,h,rand) {
    const key=String(type).toLowerCase();
    if(key.includes('farm')||key.includes('field')) {
      b.add('box','#726144',-.06,h+.065,.02,.91,.035,.69,0,.12);
      for(let i=0;i<6;i++){
        const x=-.43+i*.148;b.add('box',i%2?'#d1bb68':'#bda454',x,h+.09,.02,.083,.050,.61,0,.12);
        for(let stalk=0;stalk<3;stalk++)b.add('cone','#e0cb77',x,h+.16,-.2+stalk*.20,.025,.15,.035);
      }
      for(const x of [-.53,.44])for(const z of [-.38,.38])b.add('cylinder','#947847',x,h+.17,z,.016,.25,.016);
      b.add('box','#af925c',-.045,h+.21,.38,.97,.025,.025);
      b.add('box','#bca179',.47,h+.16,-.28,.22,.24,.25);b.add('cone4','#8c6d48',.47,h+.37,-.28,.24,.19,.27,0,Math.PI/4);
      b.add('cylinder','#e6d29a',.47,h+.29,-.28,.032,.21,.032);b.add('rock','#d9c178',-.48,h+.15,.45,.11,.14,.09);
    } else if(key.includes('mine')) {
      b.add('rock','#7a8987',0,h+.15,-.10,.48,.38,.39);b.add('box','#293b3e',0,h+.21,.237,.27,.32,.027);
      b.add('box','#a78d60',-.16,h+.22,.26,.052,.39,.06);b.add('box','#a78d60',.16,h+.22,.26,.052,.39,.06);b.add('box','#a78d60',0,h+.43,.26,.39,.06,.065);
      for(const x of [-.085,.085])b.add('box','#71878a',x,h+.069,.48,.021,.018,.42);
      for(let i=0;i<4;i++)b.add('box','#947e56',0,h+.062,.31+i*.11,.25,.021,.035);
      b.add('box','#967e56',0,h+.14,.48,.19,.14,.19);b.add('rock','#bdc8ca',-.025,h+.25,.48,.09,.09,.08);
      for(let i=0;i<3;i++)b.add('rock','#a8b7b5',.35+i*.07,h+.14,-.03+i*.07,.085,.11,.10);
      b.add('sphere','window',.205,h+.31,.29,.026,.034,.025);
    } else if(key.includes('lumber')||key.includes('mill')) {
      b.add('box','#a08152',-.09,h+.13,-.09,.47,.21,.37);
      for(const x of [-.29,.12])for(const z of [-.25,.07])b.add('cylinder','#8e704b',x,h+.27,z,.025,.48,.025);
      b.add('cone4','#526957',-.085,h+.54,-.09,.43,.20,.35,0,Math.PI/4);
      b.add('disc','#b2b8a3',.12,h+.30,.20,.14,.021,.14,Math.PI/2);
      for(let i=0;i<10;i++){const a=i/10*Math.PI*2;b.add('box','#d0d1b4',.12+Math.cos(a)*.13,h+.30+Math.sin(a)*.13,.20,.045,.045,.027,0,0,a);}
      for(let i=0;i<4;i++){
        const z=.32+(i%2)*.12,y=h+.1+Math.floor(i/2)*.11;
        b.add('cylinder','#765a39',-.29,y,z,.053,.42,.053,0,0,Math.PI/2);b.add('cylinder','#c4a771',-.505,y,z,.042,.01,.042,0,0,Math.PI/2);
      }
    }
  }

  resource(b,resource,h,rand) {
    const name=String(resource).toLowerCase();
    if(name.includes('iron')||name.includes('mithril')||name.includes('gold')) {
      for(let i=0;i<3;i++){const x=-.57+i*.1,z=.36+(i%2)*.12;b.add('rock','#596d72',x,h+.12,z,.12,.16,.11);b.add('rock',name.includes('gold')?'#dbc177':'#c0d0d1',x+.01,h+.23,z,.055,.06,.049);}
    } else if(name.includes('wheat')||name.includes('grain')||name.includes('food')) {
      for(let i=0;i<7;i++){const x=.30+(i%4)*.068,z=.43+Math.floor(i/4)*.09;b.add('cylinder','#a3a35e',x,h+.12,z,.012,.23,.012);b.add('rock','#eed083',x,h+.25,z,.035,.075,.030);}
    } else if(name.includes('horse')) {
      for(let i=0;i<2;i++){const x=.24+i*.24,z=.37+i*.13;b.add('box',i?'#a99677':'#d5c8a7',x,h+.18,z,.12,.10,.22);b.add('cone','#ad9874',x,h+.29,z-.09,.053,.19,.05,-.4);b.add('box','#b2a081',x,h+.35,z-.15,.065,.069,.085);for(const dx of [-.043,.043])for(const dz of [-.07,.07])b.add('cylinder','#756d59',x+dx,h+.08,z+dz,.012,.16,.012);}
    } else if(name.includes('fish')) {
      for(let i=0;i<3;i++){b.add('rock','#c6e5db',.13+i*.15,.01,.34+i*.10,.11,.025,.04,0,.4);b.add('cone4','#b4d9cc',.035+i*.15,.012,.30+i*.10,.045,.014,.055,0,.4);}
    } else if(name.includes('timber')){
      for(let i=0;i<3;i++){b.add('cylinder','#7c6141',-.47,h+.10+i*.055,.35+i*.07,.042,.38,.042,0,0,Math.PI/2);b.add('cylinder','#d1b788',-.665,h+.10+i*.055,.35+i*.07,.034,.011,.034,0,0,Math.PI/2);}
    } else if(name.includes('gem')){
      b.add('rock','#697b79',.45,h+.085,.40,.19,.10,.15);for(let i=0;i<3;i++)b.add('cone4',['#a397c1','#83b7c1','#c9acd3'][i],.34+i*.10,h+.20+(i%2)*.07,.41,.055,.24,.055,0,.4,i*.12);
    }
  }

  district(b,id,x,z,f){
    b.add('box','#c4b68e',x,.055,z,.34,.09,.31);
    if(id==='campus'){
      b.add('box','#e0d9bb',x,.24,z,.30,.32,.23);b.add('disc','#759fa1',x,.46,z,.16,.13,.16);b.add('sphere','bannerGold',x,.55,z,.11,.11,.11);
      b.add('cylinder','#5d797d',x+.04,.58,z-.03,.021,.25,.021,.55,0,-.6);b.add('box','#5b869b',x,.28,z+.123,.11,.16,.009);
      for(const s of [-1,1])b.add('box','#d8cead',x+s*.19,.16,z,.09,.20,.27);
    }else if(id==='market'){
      for(let i=0;i<2;i++){
        const dx=x+(i-.5)*.18;b.add('box','#916f47',dx,.15,z,.14,.20,.23);b.add('box',i?'#c79564':'#e3cd94',dx,.31,z,.18,.045,.28,0,0,.12);
        for(const s of [-1,1])b.add('cylinder','#ac9566',dx+s*.073,.22,z+.11,.012,.35,.012);
      }
      b.add('cylinder','#ae8957',x+.26,.12,z+.08,.057,.17,.057);b.add('sphere','#c8b16e',x+.24,.21,z+.08,.045,.04,.045);
    }else if(id==='forge'){
      b.add('box','#777d75',x,.20,z,.31,.31,.28);b.add('cone4','#48616b',x,.41,z,.27,.16,.27,0,Math.PI/4);
      b.add('box','#485760',x-.10,.53,z-.07,.085,.57,.085);b.add('box','window',x,.17,z+.143,.14,.16,.01);
      b.add('box','#7e898d',x+.23,.11,z+.06,.15,.14,.095);b.add('box','#b0b9b4',x+.23,.19,z+.06,.21,.055,.12);
    }else if(id==='sanctuary'){
      b.add('disc','#b6b998',x,.12,z,.21,.08,.21);b.add('disc','water',x,.168,z,.13,.016,.13);
      for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;b.add('cylinder','#e2ddbf',x+Math.cos(a)*.16,.31,z+Math.sin(a)*.16,.022,.37,.022);}
      b.add('cone4','#708d7e',x,.53,z,.27,.22,.27,0,Math.PI/4);b.add('cone','bannerGold',x,.70,z,.029,.14,.029);
    }
  }

  cityWalls(b,f){
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;if(i===2)continue;
      b.add('box','#b8bba5',Math.cos(a)*.77,.20,Math.sin(a)*.77,.60,.29,.065,0,Math.PI/2-a);
      b.add('box',f.cloth,Math.cos(a)*.77,.355,Math.sin(a)*.77,.58,.032,.073,0,Math.PI/2-a);
      b.add('taper','#cacbb0',Math.cos(a+.39)*.82,.27,Math.sin(a+.39)*.82,.075,.45,.075);
    }
  }

  concordSpire(b,x=0,z=0){
    // The four colored stones represent the four realms joining the Concord.
    for(let i=0;i<3;i++)b.add('cylinder',i===1?'bannerGold':'#d4cfb4',x,.06+i*.085,z,.34-i*.045,.085,.34-i*.045);
    b.add('taper','#dad7c4',x,.75,z,.105,1.05,.105);
    b.add('cylinder','bannerGold',x,1.26,z,.17,.07,.17);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+Math.PI/4,dx=x+Math.cos(a)*.22,dz=z+Math.sin(a)*.22;
      b.add('cylinder','#c7cbb7',dx,.64,dz,.027,.87,.027);
      b.add('cone','bannerGold',dx,1.13,dz,.045,.20,.045);
      b.add('sphere',Object.values(FACTIONS)[i].color,dx,.31,dz,.055,.055,.055);
    }
    b.add('cone4','#9dd0d6',x,1.45,z,.15,.32,.15,0,Math.PI/4);
    b.add('cone4','#bde4dc',x,1.20,z,.15,.18,.15,Math.PI,Math.PI/4);
    b.add('cone','bannerGold',x,1.69,z,.022,.16,.022);
  }

  civicWonder(b,id,x=0,z=0){
    const exchange=id==='world_exchange',stone='#ded6bb',roof=exchange?'#527d83':'#746f94';
    for(let level=0;level<3;level++)b.add('box',stone,x,.045+level*.055,z,.68-level*.08,.06,.55-level*.06);
    b.add('box',stone,x,.35,z-.07,.36,.38,.28);
    for(const side of [-1,1])for(const row of [-1,1]){
      b.add('cylinder',stone,x+side*.25,.36,z+row*.16,.029,.38,.029);
      b.add('box','bannerGold',x+side*.25,.55,z+row*.16,.077,.035,.077);
    }
    b.add('gable',roof,x,.67,z,.66,.23,.47);
    b.add('box','bannerGold',x,.79,z,.023,.035,.49);
    if(exchange){
      b.add('cylinder','bannerGold',x,.95,z,.02,.33,.02);
      b.add('box','bannerGold',x,1.08,z,.38,.024,.027);
      for(const side of [-1,1]){b.add('cylinder','bannerGold',x+side*.16,.99,z,.01,.17,.01);b.add('disc','bannerGold',x+side*.16,.90,z,.078,.022,.065);}
      b.add('disc','bannerGold',x,.41,z+.083,.081,.025,.081,Math.PI/2);
    }else{
      for(const side of [-1,0,1]){const dx=x+side*.18;b.add('cylinder','bannerGold',dx,.93,z,.012,.43,.012);b.add('box',['#759995','#c2a169','#817a9d'][side+1],dx+.045,1.05,z,.11,.16,.014);}
      b.add('arch','bannerGold',x,.36,z+.09,.22,.32,.24);
    }
  }

  constructionSite(b,work,f,x=.57,z=-.54){
    const height=.18+work.stage*.11;
    b.add('box','#a89e82',x,.07,z,.33,.07,.28);
    for(const dx of [-.15,.15])for(const dz of [-.12,.12])b.add('cylinder','#987953',x+dx,height/2+.09,z+dz,.014,height,.014);
    for(const dz of [-.12,.12])b.add('box','#b89c6d',x,height+.09,z+dz,.34,.023,.025);
    this.segment(b,[x-.15,.10,z+.12],[x+.15,height+.09,z+.12],.019,'#987953');
    for(let course=0;course<work.stage;course++)b.add('box','#c8c1a7',x,.11+course*.065,z,.23,.05,.18);
    b.add('box',f.cloth,x+.17,.15,z+.10,.065,.10,.015);
  }

  buildStructureSample(kind,id){
    const batch=new ModelBatch(this);batch.at(0,0,0);batch.tileId='0,0';
    if(kind==='wonder'&&['world-exchange','hall-of-nations'].includes(id))this.civicWonder(batch,id.replaceAll('-','_'));
    else if(kind==='improvement')this.improvement(batch,id,0,randomFor(`sample-${id}`));
    else if(kind==='district')this.district(batch,id,0,0,factionVisual('gondor'));
    else if(kind==='wonder'&&id==='concord-spire')this.concordSpire(batch);
    else throw new Error(`Unknown structure sample type: ${kind}`);
    return batch.finish();
  }

  buildPieces(state) {
    const previous=this.actorPositions||new Map(),now=performance.now();
    for(const [id,animation]of this.actorAnimations||[]){const p=previous.get(id);if(p)p.add(actorMotionOffset(animation,now));}
    this.actorPositions=new Map();this.actorAnimations=new Map();
    const focused=typeof document!=='undefined'?this.labels.find(label=>label.element===document.activeElement):null;
    if(this.piecesGroup){this.scene.remove(this.piecesGroup);this.piecesGroup.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
    this.labels.forEach(l=>l.element.remove());this.labels=[];
    const b=new ModelBatch(this), cityTiles=new Set(),placedDistricts=[];
    for(const city of state.cities || []) {
      const tile=this.tileMap.get(city.tileId);if(!tile||tile.explored===false)continue;
      cityTiles.add(city.tileId);const p=worldPosition(tile),f=factionVisual(city.faction);
      const hasIntel=city.intelVisible??(city.faction===state.player||tile.visible!==false);
      b.at(p.x,.15,p.z,.83,-.1);b.tileId=city.tileId;b.actorId=null;
      this.cityGrounds(b,f);
      if(!FACTIONS[city.faction])mythicCapital(this,b,city.faction);
      else if(f.style==='mordor')this.mordorCity(b);
      else if(f.style==='rohan')this.rohanCity(b);
      else if(f.style==='elves')this.elvenCity(b);
      else this.gondorCity(b);
      // Remembered construction is safe to display, but its live statistics are not.
      const plan=cityVisualPlan(city,hasIntel),districts=plan.districts.filter(id=>!city.districtTiles?.[id]),built=plan.buildings;
      for(const id of plan.districts){const target=this.tileMap.get(city.districtTiles?.[id]);if(target&&target.explored!==false)placedDistricts.push({id,tile:target,f,city});}
      const workTile=plan.construction?.kind==='district'?this.tileMap.get(city.queuedDistrictTileId):null;
      const remoteWork=workTile&&workTile.explored!==false;
      if(remoteWork)placedDistricts.push({id:plan.construction.id,tile:workTile,f,city,work:plan.construction});
      const occupied=districts.map((id,i)=>({x:Math.cos(i*1.6+1)*.79,z:Math.sin(i*1.6+1)*.79,r:.39}));
      if(built.includes('fellowship'))occupied.push({x:-.52,z:-.44,r:.50});
      if(built.includes('world_exchange'))occupied.push({x:.58,z:-.48,r:.38});
      if(built.includes('hall_of_nations'))occupied.push({x:-.57,z:.45,r:.38});
      if(plan.construction&&!remoteWork)occupied.push({x:.57,z:-.54,r:.28});
      // Residential clusters represent population, not unearned buildings.
      let houses=0;
      for(let house=0;house<12&&houses<plan.housing;house++){
        const angle=house*Math.PI/6+.22,x=Math.cos(angle)*.84,z=Math.sin(angle)*.79;
        if((Math.abs(x)<.23&&z>.1)||occupied.some(slot=>Math.hypot(x-slot.x,z-slot.z)<slot.r+.14))continue;
        houses++;
        const stone=f.style==='rohan'?'#d3b480':f.style==='mordor'?'#9a896b':'#d7d2b8';
        b.add('box','#bac1aa',x,.12,z,.30,.06,.27,0,-angle);
        b.add('box',stone,x,.28,z,.19,.25,.17,0,-angle);
        b.add('gable',f.cloth,x,.46,z,.23,.16,.22,0,-angle);
        b.add('box','#4c5755',x,.29,z+.088,.036,.09,.012);
        b.add('box','window',x+.05,.33,z+.088,.032,.043,.014);
        // Each population marker is a small residential compound, not an earned district.
        const dx=Math.sin(angle)*.14,dz=-Math.cos(angle)*.14;
        b.add('box',stone,x+dx,.225,z+dz,.14,.18,.14,0,-angle);
        b.add('gable',f.cloth,x+dx,.37,z+dz,.18,.13,.18,0,-angle);
        b.add('box','#eee4c9',x-dx*.75,.195,z-dz*.75,.10,.12,.14,0,-angle);
        b.add('gable',f.cloth,x-dx*.75,.30,z-dz*.75,.13,.095,.18,0,-angle);
      }
      for(let stone=0;stone<7;stone++)b.add('box','#b3b299',-.13+(stone%2)*.12,.03,.36+Math.floor(stone/2)*.085,.10,.018,.067);
      this.banner(b,.58,.06,.28,f.cloth,1.04);
      if(built.includes('walls'))this.cityWalls(b,f);
      if(built.includes('fellowship'))this.concordSpire(b,-.52,-.44);
      if(built.includes('world_exchange'))this.civicWonder(b,'world_exchange',.58,-.48);
      if(built.includes('hall_of_nations'))this.civicWonder(b,'hall_of_nations',-.57,.45);
      if(plan.construction&&!remoteWork)this.constructionSite(b,plan.construction,f);
      if(built.includes('granary'))for(let i=0;i<3;i++)b.add('cylinder','#c6b27b',-.58+i*.09,.12,.46,.042,.17,.042);
      if(built.includes('barracks')){b.add('box','#817556',.55,.16,.53,.23,.25,.05);for(let i=0;i<3;i++)b.add('sphere',f.cloth,.47+i*.08,.20,.565,.038,.06,.015);}
      for(let i=0;i<districts.length;i++){
        const a=i*1.6+1;this.district(b,districts[i],Math.cos(a)*.79,Math.sin(a)*.79,f);
      }
      this.addCityLabel(city,p.clone().add(new THREE.Vector3(0,f.style==='gondor'?1.80:1.63,0)),f,hasIntel);
    }
    for(const placement of placedDistricts){
      const {tile,f,id,work}=placement,p=worldPosition(tile);
      b.at(p.x,.15,p.z,1.45,-.1);b.tileId=tile.id;b.actorId=null;
      b.add('hex','#aabca7',0,.006,0,.62,.05,.62);
      b.add('box','#dedec5',0,.038,0,.81,.035,.74);
      for(const side of [-1,1]){
        b.add('box','#c8cbb3',side*.41,.086,0,.033,.09,.77);
        b.add('box',f.cloth,side*.41,.14,0,.039,.025,.77);
        b.add('cylinder','#d8cba5',side*.32,.19,.31,.021,.27,.021);
        b.add('sphere','window',side*.32,.33,.31,.037,.049,.037);
      }
      for(let i=0;i<4;i++)b.add('box','#eee5c9',0,.021+i*.014,.56-i*.06,.29,.026,.074);
      if(work)this.constructionSite(b,work,f,0,0);
      else{this.district(b,id,0,-.055,f);this.banner(b,-.38,.055,-.3,f.cloth,.66);}
      // Selecting any part of a district yields its actual map tile, not its capital.
    }
    const visibleUnits=(state.units||[]).filter(unit=>{
      const tile=this.tileMap.get(unit.tileId);return tile&&tile.explored!==false&&(tile.visible!==false||unit.faction===state.player);
    }).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
    const perTile=new Map(),tileCounts=new Map();
    for(const unit of visibleUnits)tileCounts.set(unit.tileId,(tileCounts.get(unit.tileId)||0)+1);
    for(const unit of visibleUnits) {
      const tile=this.tileMap.get(unit.tileId);if(!tile||tile.explored===false||(tile.visible===false&&unit.faction!==state.player))continue;
      const index=perTile.get(unit.tileId)||0,count=tileCounts.get(unit.tileId);perTile.set(unit.tileId,index+1);
      const p=worldPosition(tile);const city=cityTiles.has(unit.tileId);
      // Stable id ordering prevents stack positions from changing with array order.
      // Additional rings accommodate friendly stacks without a two-unit limit.
      if(city||count>1){
        const ring=Math.floor(index/6),inRing=Math.min(6,count-ring*6),angle=.68+(index%6)*Math.PI*2/inRing;
        const radius=(city?.87:count<4?.40:.52)+ring*.36;
        p.x+=Math.cos(angle)*radius;p.z+=Math.sin(angle)*radius;
      }
      this.actorPositions.set(unit.id,p.clone());
      const old=previous.get(unit.id);if(this.renderer&&!this.reducedMotion&&old&&old.distanceToSquared(p)>.002&&old.distanceToSquared(p)<70)this.actorAnimations.set(unit.id,{offset:old.clone().sub(p),started:now,duration:560});
      const f=factionVisual(unit.faction);
      b.tileId=unit.tileId;b.actorId=unit.id;
      const army=unit.armySize>=3&&['warrior','archer','rider'].includes(unit.kind),stackScale=count>4?.70:count>2?.82:1;
      const formations=army?[[0,-.25],[-.32,.18],[.32,.18]]:[[0,0]],companyScale=stackScale*(army?.62:1);
      for(const [dx,dz]of formations){
        const x=p.x+dx*stackScale,z=p.z+dz*stackScale;
        b.at(x,.20,z,.8*companyScale,Math.PI*.3);this.unit(b,unit.kind,f,unit.faction);
        if(unit.kind==='warrior'||unit.kind==='archer'){
          for(const side of [-1,1]){b.at(x+side*.23*companyScale,.20,z+.20*companyScale,.61*companyScale,Math.PI*.3);this.unit(b,unit.kind,f,unit.faction);}
        }
      }
      if(unit.kind==='hero'){
        b.at(p.x,.20,p.z,1,0);b.add('disc','#35444a',0,-.006,0,.28,.025,.28);b.add('torus','bannerGold',0,.01,0,.25,.25,.25,Math.PI/2);
        // A colored front inset makes the champion base legible among foliage.
        b.add('box',f.cloth,0,.01,.255,.16,.024,.035);
      }
      this.addUnitLabel(unit,p.clone().add(new THREE.Vector3(0,unit.kind==='rider'?1.0:.85,0)),f);
    }
    this.piecesGroup=b.finish();this.scene.add(this.piecesGroup);
    if(this.actorAnimations.size)this.animatePieces(performance.now());
    if(focused){const replacement=this.labels.find(label=>focused.actorId?label.actorId===focused.actorId:label.cityId===focused.cityId);(replacement?.element||this.renderer?.domElement)?.focus({preventScroll:true});}
  }

  crenellations(b,r,y,count,color) {
    for(let i=0;i<count;i++){const a=i/count*Math.PI*2;b.add('box',color,Math.cos(a)*r,y,Math.sin(a)*r,.085,.14,.085,0,-a);}
  }

  // Radiant Covenant: angular ivory cathedral and lapis-roofed civic courts.
  gondorCity(b) {
    b.add('box','#b8b59b',0,.07,0,1.30,.14,1.12);
    b.add('box','#dcdac0',0,.23,-.02,.68,.33,.86);
    b.add('gable','#426f8a',0,.62,-.10,.70,.38,.89);
    b.add('box','#8fa4a4',0,.43,-.10,.76,.05,.95);
    for(const z of [-.45,-.21,.03,.28])for(const side of [-1,1])this.segment(b,[side*.34,.445,z],[0,.815,z],.018,'#acc5c1',.016);
    b.add('box','bannerGold',0,.817,-.10,.025,.026,.91);
    for(const side of [-1,1]){
      b.add('box','#e4dfc3',side*.31,.51,.24,.23,.88,.27);
      b.add('cone4','#416d88',side*.31,1.10,.24,.22,.33,.24,0,Math.PI/4);
      b.add('box','bannerGold',side*.31,1.34,.24,.024,.19,.024);
      b.add('box','bannerGold',side*.31,1.36,.24,.11,.022,.022);
      b.add('box','#597f96',side*.31,.66,.381,.085,.23,.013);
      b.add('arch','#f1e4c4',side*.31,.67,.40,.145,.31,.27);
      for(const band of [.20,.49,.91])b.add('box','#c4bc99',side*.31,band,.24,.25,.035,.29);
      for(let i=0;i<3;i++)b.add('box','#e8e0c4',side*.45,.30,-.35+i*.22,.13,.51,.055);
      b.add('box','#d2cfb2',side*.47,.18,-.15,.24,.20,.38);
      b.add('cone4','#698e9a',side*.47,.37,-.15,.24,.19,.38,0,Math.PI/4);
    }
    b.add('box','#38546b',0,.23,.417,.18,.32,.025);
    b.add('arch','#eadfbd',0,.25,.445,.29,.41,.32);
    for(const side of [-1,1])b.add('box','bannerGold',side*.057,.22,.438,.008,.24,.01);
    b.add('torus','bannerGold',0,.53,.432,.12,.12,.025);
    b.add('sphere','#6c9dac',0,.53,.428,.10,.10,.02);
    b.add('box','bannerGold',0,.53,.452,.018,.19,.015);b.add('box','bannerGold',0,.53,.452,.19,.018,.015);
    for(let step=0;step<4;step++)b.add('box','#d4d2b3',0,.04+step*.034,.72-step*.074,.38,.05,.11);
    b.add('box','#d4d5ba',0,.70,-.26,.19,.60,.22);b.add('cone4','#47758f',0,1.12,-.26,.22,.29,.24,0,Math.PI/4);
    for(let i=0;i<5;i++)b.add('box','#527c92',-.25+i*.125,.32,-.45,.054,.14,.014);
    // Buttresses and stone joints break up the broad unlit wall faces.
    for(const side of [-1,1])for(const z of [-.35,-.12,.1]){
      b.add('box','#b5b296',side*.36,.25,z,.06,.30,.085);
      b.add('arch','#e7dfc0',side*.346,.32,z+.04,.13,.24,.25,0,side*Math.PI/2);
    }
  }

  // Solar Dynasty: sandstone pylons, stepped sanctuary, turquoise water and palms.
  rohanCity(b) {
    b.add('box','#b6a27b',0,.055,0,1.32,.11,1.14);
    for(let step=0;step<3;step++)b.add('box',['#d0b782','#dfc68d','#e6cf96'][step],0,.13+step*.13,-.17,.90-step*.17,.16,.73-step*.12);
    b.add('box','#d9bf82',0,.66,-.20,.40,.39,.34);b.add('box','#528d92',0,.87,-.20,.47,.055,.40);
    b.add('disc','bannerGold',0,1.04,-.20,.14,.035,.14,Math.PI/2);
    for(const side of [-1,1]){
      b.add('taper4','#dbbf86',side*.34,.40,.30,.24,.65,.20,0,Math.PI/4);
      b.add('box','#4d959b',side*.34,.67,.30,.29,.06,.24);
      b.add('box','#bd9151',side*.34,.40,.457,.038,.32,.015);
      b.add('cone4','bannerGold',side*.34,.79,.30,.07,.15,.07,0,Math.PI/4);
      for(const y of [.20,.32,.54])b.add('box','#a67b43',side*.34,y,.456,.14,.018,.016);
      b.add('disc','bannerGold',side*.34,.50,.465,.044,.013,.044,Math.PI/2);
      b.add('box','#336c7a',side*.34,.30,.47,.055,.13,.009);
      const x=side*.57,z=-.30;
      b.add('cylinder','#a28b5b',x,.39,z,.035,.63,.035,0,0,-side*.12);
      for(let leaf=0;leaf<6;leaf++){const a=leaf*Math.PI/3;b.add('leaf','#6f9563',x+Math.cos(a)*.14,.70,z+Math.sin(a)*.14,.09,.035,.23,0,Math.PI/2-a,side*.1);}
    }
    b.add('box','#978a65',0,.12,.48,.37,.055,.42);b.add('box','water',0,.155,.48,.28,.016,.34);
    for(const side of [-1,1])b.add('box','#bcb17e',side*.22,.11,.49,.045,.06,.43);
    for(let step=0;step<4;step++)b.add('box','#dfc489',0,.10+step*.04,.12-step*.07,.34,.05,.10);
    b.add('box','#36566a',0,.66,-.022,.14,.24,.012);
    for(const side of [-1,1])b.add('box','#f2d49a',side*.097,.65,-.008,.045,.31,.036);
    b.add('box','#c7954c',0,.80,-.008,.24,.036,.039);
    for(let i=0;i<6;i++)b.add('box','#8c6b3e',-.32+i*.13,.14,.77,.085,.024,.048);
  }

  // Aegis League: marble colonnades, blue roof, bronze acroteria and an olive court.
  elvenCity(b) {
    for(let level=0;level<3;level++)b.add('box',['#b8bea9','#d2d2b6','#e6dfc3'][level],0,.045+level*.067,0,1.20-level*.14,.08,.94-level*.11);
    b.add('box','#dfddc2',0,.38,-.13,.41,.38,.43);
    for(const x of [-.39,-.13,.13,.39])for(const z of [-.29,.28]){
      b.add('disc','#dedec7',x,.22,z,.061,.07,.061);b.add('cylinder','#ece5cc',x,.48,z,.041,.47,.041);b.add('box','#eee7cd',x,.735,z,.13,.065,.13);
    }
    b.add('box','#e0d8b9',0,.79,-.005,1.05,.11,.79);
    b.add('gable','#427a97',0,1.04,-.005,1.12,.38,.83);
    b.add('gable','#e3dbbc',0,1.04,.42,1.08,.31,.033);
    b.add('box','bannerGold',0,1.24,-.005,.035,.06,.88);
    for(const z of [-.36,-.16,.04,.24,.4])for(const side of [-1,1])this.segment(b,[side*.56,.85,z],[0,1.235,z],.015,'#8eabb2',.013);
    for(const x of [-.39,-.13,.13,.39]){
      b.add('box','#b0ab90',x,.79,.4,.037,.09,.018);
      b.add('box','#f4e9ca',x-.032,.48,.30,.008,.40,.010);
      b.add('box','#b4b5a0',x+.027,.48,.30,.008,.40,.010);
    }
    b.add('disc','bannerGold',0,1.02,.446,.072,.018,.072,Math.PI/2);
    for(const side of [-1,1])b.add('cone4','bannerGold',side*.42,.97,.32,.067,.18,.055,0,Math.PI/4);
    b.add('box','#678d9b',0,.39,.095,.14,.25,.014);
    const rand=randomFor('olive court');this.tree(b,-.58,.09,-.26,.58,'round',rand);
    b.add('disc','#c1b78e',.53,.13,.32,.12,.09,.12);b.add('sphere','#798c5e',.53,.24,.32,.10,.12,.10);
  }

  // Stormforged: basalt foundation, timber longhouses, copper ridges and stormspire.
  mordorCity(b) {
    b.add('rock','#5e6b6f',0,.13,0,.77,.26,.67);
    b.add('box','#756a55',-.12,.38,.08,.68,.47,.65);
    b.add('gable','#4d7985',-.12,.82,.08,.83,.47,.79);
    for(const z of [-.28,-.08,.12,.32,.45])for(const side of [-1,1])this.segment(b,[-.12+side*.41,.59,z],[-.12,1.055,z],.027,'#aa905e',.025);
    b.add('box','#b09b68',-.12,1.03,.08,.045,.043,.79);
    for(const side of [-1,1]){
      b.add('box','#b19c6c',-.12+side*.31,.40,.25,.042,.49,.051);
      b.add('box','#344957',-.12+side*.18,.46,.414,.08,.16,.015);
    }
    b.add('box','#3a4b52',-.12,.30,.417,.14,.29,.025);
    b.add('arch','#b79b65',-.12,.31,.44,.22,.35,.30);
    for(const side of [-1,1]){
      for(let log=0;log<5;log++)b.add('box','#9b8968',-.12+side*.344,.20+log*.075,.04,.02,.014,.66);
      b.add('disc','bannerGold',-.12+side*.24,.37,.426,.066,.02,.066,Math.PI/2);
      b.add('disc','#436577',-.12+side*.24,.37,.439,.042,.014,.042,Math.PI/2);
    }
    b.add('box','#68777b',.43,.33,-.19,.39,.45,.38);b.add('cone4','#66818a',.43,.62,-.19,.36,.18,.36,0,Math.PI/4);
    for(const x of [.30,.54]){b.add('box','#657176',x,.81,-.25,.08,.70,.085);b.add('box','#9baba5',x,1.17,-.25,.12,.05,.12);}
    b.add('box','window',.43,.29,.01,.17,.18,.015);
    b.add('taper','#586d78',-.44,.58,-.30,.13,.86,.13);b.add('cone4','#8fc3d7',-.44,1.16,-.30,.13,.38,.13,0,Math.PI/4);
    b.add('box','bannerGold',-.44,1.0,-.30,.23,.035,.21);
    b.add('box','#909d9a',.50,.14,.39,.22,.19,.15);b.add('box','#bdc9bf',.50,.25,.39,.30,.055,.21);
    for(let i=0;i<3;i++)b.add('cylinder','#897b5e',-.40+i*.12,.16,.53,.05,.27,.05,0,0,Math.PI/2);
  }

  banner(b,x,y,z,color,height) {
    b.add('cylinder','#b9aa7b',x,y+height/2,z,.018,height,.018);
    b.add('cone','bannerGold',x,y+height+.065,z,.035,.13,.035);
    b.add('box',color,x+.10,y+height-.13,z,.20,.26,.018);
    b.add('box','bannerGold',x+.10,y+height-.13,z+.012,.035,.095,.008);
  }

  unit(b,kind,f,faction) {
    b.add('cylinder','#485a54',0,.025,0,.20,.04,.20);
    b.add('cylinder',f.color,0,.049,0,.19,.008,.19);
    let bodyY=.29;
    if(kind==='rider') {
      const horse=faction==='mordor'?'#4d4742':'#b49e79';
      b.add('box',horse,0,.25,.015,.20,.20,.40);b.add('cone',horse,0,.42,-.19,.10,.28,.12,-.45);
      b.add('box',horse,0,.52,-.26,.09,.10,.15);
      for(const x of [-.075,.075])for(const z of [-.12,.15])b.add('cylinder','#756149',x,.11,z,.025,.21,.025);
      b.add('box',f.cloth,0,.36,.03,.23,.06,.24);bodyY=.52;
      b.add('leaf','#534b3e',0,.31,.30,.036,.20,.043,0,0,.24);
      b.add('box','#534b3e',0,.49,-.16,.042,.19,.075,-.45);
      for(const side of [-1,1])this.segment(b,[side*.06,.55,-.29],[side*.12,.44,.015],.009,'#63533e',.008);
      b.add('box',f.cloth,.20,.99,-.04,.19,.10,.016,0,0,-.14);
    }
    if(kind==='settler'){
      b.add('box','#907454',-.15,.16,.14,.31,.20,.27);
      for(const x of [-.32,.02]){b.add('cylinder','#493f31',x,.12,.14,.10,.035,.10,0,0,Math.PI/2);b.add('cylinder','#b9a26e',x,.12,.14,.036,.041,.036,0,0,Math.PI/2);}
      b.add('sphere','#d8cfaa',-.15,.28,.14,.16,.11,.14);
      for(const side of [-1,1])b.add('cylinder','#9a815a',-.15+side*.15,.36,.14,.015,.38,.015);
      b.add('gable','#d8cfaa',-.15,.58,.14,.38,.15,.33);
      this.banner(b,.18,.05,.13,f.cloth,.76);
    }
    const heroCloth=kind==='hero'&&!FACTIONS[faction]?f.cloth:kind==='hero'?(faction==='gondor'?'#d4d5c3':faction==='rohan'?'#e4d19b':faction==='elves'?'#447591':'#665d52'):f.cloth;
    b.add('cone',heroCloth,0,bodyY,0,.14,.34,.12);
    b.add('box',faction==='mordor'?'#9aa9ae':'#c3c9b6',0,bodyY+.09,-.035,.15,.15,.09);
    b.add('sphere','#c5a57d',0,bodyY+.25,0,.078,.09,.078);
    if(kind==='hero'){
      b.add('cone',f.cloth,0,bodyY-.01,.08,.18,.40,.085);
      if(!FACTIONS[faction])mythicChampion(b,faction,bodyY);
      else if(faction==='gondor'){
        // Michael: original winged herald armor; no portrayal of God as a unit.
        b.add('sphere','#bcb17e',0,bodyY+.31,.012,.083,.051,.078);
        b.add('torus','bannerGold',0,bodyY+.32,.082,.12,.12,.021);
        for(const side of [-1,1]){
          b.add('leaf','#d8dcca',side*.19,bodyY+.19,.12,.12,.23,.055,0,0,-side*.48);
          for(let feather=0;feather<4;feather++)b.add('cone','#efe9d2',side*(.21+feather*.041),bodyY+.27-feather*.024,.12,.039,.25-feather*.018,.028,0,0,-side*(.53+feather*.12));
        }
        b.add('cylinder','bannerGold',.16,bodyY+.04,-.03,.016,.19,.016);b.add('box','bannerGold',.16,bodyY+.13,-.03,.11,.021,.022);
        b.add('box','#eceddc',.16,bodyY+.30,-.03,.032,.34,.014);b.add('cone','#eceddc',.16,bodyY+.50,-.03,.018,.08,.012);
      }else if(faction==='rohan'){
        // Ra: falcon head, solar crown and ceremonial staff, drawn as a miniature.
        b.add('sphere','#526f76',0,bodyY+.26,0,.079,.103,.079);
        b.add('cone','#d4b166',0,bodyY+.25,-.086,.044,.13,.03,-Math.PI/2);
        b.add('sphere','#eee5c0',-.033,bodyY+.285,-.068,.013,.013,.012);b.add('sphere','#eee5c0',.033,bodyY+.285,-.068,.013,.013,.012);
        b.add('disc','bannerGold',0,bodyY+.46,.013,.102,.025,.102,Math.PI/2);
        b.add('torus','#5ba2ab',0,bodyY+.46,.027,.105,.105,.028);
        b.add('cylinder','#bd9955',.18,bodyY+.12,-.02,.017,.74,.017);
        b.add('torus','bannerGold',.18,bodyY+.53,-.02,.07,.09,.023);
        b.add('box','#64a8af',0,bodyY+.13,-.096,.14,.055,.017);
      }else if(faction==='elves'){
        // Athena: bronze helmet, blue mantle, owl shield and spear.
        b.add('sphere','#bdaf74',0,bodyY+.30,.006,.085,.079,.081);
        b.add('box','#af9962',0,bodyY+.24,-.078,.023,.10,.015);
        b.add('box','#476d82',0,bodyY+.39,.01,.045,.10,.18);
        b.add('sphere','bannerGold',-.15,bodyY+.06,-.06,.10,.13,.028);
        b.add('sphere','#477385',-.15,bodyY+.065,-.087,.061,.076,.01);
        for(const side of [-1,1])b.add('sphere','#e5dab0',-.15+side*.021,bodyY+.08,-.100,.017,.02,.009);
        b.add('cone','bannerGold',-.15,bodyY+.044,-.101,.018,.027,.008,0,0,Math.PI);
        b.add('cylinder','#9e8b5b',.17,bodyY+.1,-.025,.013,.68,.013);b.add('cone','#d4d9c8',.17,bodyY+.51,-.025,.028,.14,.026);
      }else{
        // Thor: red beard, fur cloak and plain forged hammer; an original design.
        b.add('sphere','#96613e',0,bodyY+.30,.023,.090,.071,.080);
        b.add('cone','#a66a43',0,bodyY+.19,-.070,.073,.16,.050,0,0,Math.PI);
        for(const side of [-1,1])b.add('leaf','#92968a',side*.105,bodyY+.16,.05,.09,.085,.10);
        b.add('box','#87969b',0,bodyY+.095,-.088,.14,.13,.030);
        b.add('cylinder','#9a8157',.18,bodyY+.12,-.04,.021,.43,.021);
        b.add('box','#b0bfbd',.18,bodyY+.38,-.04,.22,.14,.12);
        b.add('box','#64899e',.18,bodyY+.38,-.104,.04,.13,.009);
        b.add('torus','bannerGold',0,bodyY+.02,0,.12,.10,.08,Math.PI/2);
      }
    } else if(kind==='archer') {
      const bow=[[.14,bodyY-.17,-.05],[.27,bodyY-.05,-.05],[.30,bodyY+.13,-.05],[.25,bodyY+.30,-.05],[.13,bodyY+.36,-.05]];
      for(let i=1;i<bow.length;i++)this.segment(b,bow[i-1],bow[i],.022,'#b89b68',.022);
      this.segment(b,bow[0],bow[4],.008,'#e1d7b5',.008);
      b.add('cylinder','#715e45',-.06,bodyY+.06,.10,.035,.23,.035,0,0,-.2);
      for(const dx of [-.075,-.035]){b.add('cylinder','#d7c6a0',dx,bodyY+.24,.11,.008,.25,.008);b.add('leaf','#e1d9bf',dx,bodyY+.37,.11,.018,.052,.012);}
      b.add('sphere',f.cloth,0,bodyY+.30,.025,.09,.085,.08);
    } else if(kind==='builder') {
      b.add('cylinder','#977b52',.17,bodyY+.09,0,.018,.42,.018,0,0,-.4);
      b.add('box','#8c9d96',.23,bodyY+.28,0,.23,.10,.085);
      b.add('box','#a18a64',-.045,bodyY+.03,.12,.19,.22,.10);
      b.add('box','#d2c4a0',0,bodyY-.01,-.115,.16,.22,.018);
      b.add('disc','#bba275',0,bodyY+.32,0,.115,.033,.115);
    } else if(kind!=='settler') {
      b.add('cone',faction==='mordor'?'#565e5c':'#c9cbb8',0,bodyY+.34,0,.082,.12,.078);
      b.add('cylinder','#b1a183',.18,bodyY+.07,-.04,.013,.60,.013);
      b.add('cone','#dce0c9',.18,bodyY+.42,-.04,.032,.17,.032);
      b.add('sphere',f.cloth,-.14,bodyY+.05,-.04,.085,.12,.035);
      b.add('box','bannerGold',-.14,bodyY+.05,-.077,.018,.13,.010);
      if(kind==='warrior'){
        b.add('box','#c8c6ad',-.16,bodyY+.07,-.078,.20,.24,.03);
        b.add('box',f.cloth,-.16,bodyY+.07,-.098,.16,.20,.012);
        b.add('cone4','#c8c6ad',-.16,bodyY-.085,-.078,.14,.12,.027,Math.PI,Math.PI/4);
        b.add('box','bannerGold',-.16,bodyY+.065,-.109,.018,.18,.008);
        b.add('box',f.cloth,0,bodyY+.43,0,.032,.10,.16);
      }
    }
    if(kind!=='rider')for(const x of [-.047,.047])b.add('box','#4c5147',x,.095,-.015,.046,.12,.063);
  }

  addCityLabel(city,position,f,hasIntel=true) {
    const label=document.createElement('div');label.className='world-city-label';label.style.setProperty('--faction',f.color);
    label.title=hasIntel?`${city.name} · Population ${city.population}`:`${city.name} · Current population and health unknown outside sight`;
    label.setAttribute('role','button');label.setAttribute('aria-label',hasIntel?`Select ${city.name}, population ${city.population}`:`Select ${city.name}, current population and health unknown`);label.tabIndex=0;
    const name=document.createElement('div');name.className='world-city-name';
    const pop=document.createElement('span');pop.className='world-city-pop';pop.textContent=hasIntel?(city.population??1):'?';
    const text=document.createElement('span');text.textContent=String(city.name).toUpperCase();
    name.append(pop,text);label.append(name);
    if(hasIntel&&city.hp<city.maxHp){const bar=document.createElement('div');bar.className='world-label-hp';const fill=document.createElement('span');fill.style.width=`${clamp(city.hp/city.maxHp*100,0,100)}%`;bar.append(fill);label.append(bar);}
    const stem=document.createElement('div');stem.className='world-city-stem';label.append(stem);
    label.addEventListener('click',e=>{e.stopPropagation();this.onTileClick?.(city.tileId);});
    label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();this.onTileClick?.(city.tileId);}});
    this.overlay.append(label);this.labels.push({element:label,position,type:'city',cityId:city.id});
  }

  addUnitLabel(unit,position,f) {
    const label=document.createElement('button');label.type='button';label.className='world-unit-label';label.style.setProperty('--faction',f.color);
    label.style.setProperty('--hp',`${clamp((unit.hp||1)/(unit.maxHp||unit.hp||1)*100,0,100)}%`);
    label.dataset.exhausted=String(unit.moves===0);
    const symbols={hero:'✦',warrior:'⚔',archer:'➶',rider:'♞',settler:'⚑',builder:'⚒'};label.textContent=symbols[unit.kind]||'•';
    const army=unit.armySize>=3;
    label.dataset.army=String(army);
    if(army){const badge=document.createElement('span');badge.className='world-army-badge';badge.textContent='III';badge.setAttribute('aria-hidden','true');label.append(badge);}
    const name=`${unit.name || unit.kind}${army?' · 3 battalions':''}`;
    label.title=`${name} · ${unit.hp}/${unit.maxHp} health · ${unit.moves} moves`;
    label.setAttribute('aria-label',`Select ${name}, ${unit.hp} of ${unit.maxHp} health, ${unit.moves} moves`);
    label.addEventListener('click',e=>{e.stopPropagation();if(this.onUnitClick)this.onUnitClick(unit.id);else this.onTileClick?.(unit.tileId);});
    this.overlay.append(label);this.labels.push({element:label,position,type:'unit',actorId:unit.id});
  }

  createRing(color,radius=1,opacity=1) {
    const points=[];for(let i=0;i<7;i++){const a=i*Math.PI/3;points.push(new THREE.Vector3(Math.sin(a)*radius,.20,Math.cos(a)*radius));}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false}));line.renderOrder=20;return line;
  }

  updateHighlights(selected,reachable,attackable) {
    for(const obj of [...this.highlightGroup.children]) {this.highlightGroup.remove(obj);obj.geometry?.dispose();obj.material?.dispose();}
    const add=(id,color,opacity,radius=1)=>{const tile=this.tileMap.get(typeof id==='string'?id:id.id||id.tileId);if(!tile)return;const ring=this.createRing(color,radius,opacity);ring.position.copy(worldPosition(tile));this.highlightGroup.add(ring);};
    const movementColor=this.highContrast?'#43edff':'#d0edb4',attackColor=this.highContrast?'#ffb13b':'#ff9673';
    for(const id of reachable||[])add(id,movementColor,this.highContrast?1:.58,.93);
    for(const id of attackable||[]){
      add(id,attackColor,1,.95);
      const tile=this.tileMap.get(typeof id==='string'?id:id.id||id.tileId);if(!tile)continue;
      const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.34,.24,-.34),new THREE.Vector3(.34,.24,.34),new THREE.Vector3(-.34,.24,.34),new THREE.Vector3(.34,.24,-.34)]);
      const cross=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:attackColor,depthTest:false}));cross.renderOrder=21;cross.position.copy(worldPosition(tile));cross.userData.marker='attack';this.highlightGroup.add(cross);
    }
    if(selected){add(selected,'#ffedb0',1,1.015);add(selected,'#ffe6a1',.45,.96);}
  }

  updateLabels() {
    if(!this.renderer)return;
    const w=this.width,h=this.height,occupied=[];
    for(const label of this.labels){
      const p=label.position.clone();const animation=this.actorAnimations?.get(label.actorId);
      if(animation)p.add(actorMotionOffset(animation,performance.now()));
      p.project(this.camera);
      const visible=this.labelsEnabled&&p.z>-1&&p.z<1&&Math.abs(p.x)<1.08&&Math.abs(p.y)<1.08&&(label.type!=='unit'||this.span<17.5);
      label.element.style.display=visible?'':'none';if(!visible)continue;
      let x=(p.x*.5+.5)*w,y=(-p.y*.5+.5)*h;
      if(label.type==='city'){
        const halfWidth=Math.min(148,Math.max(62,label.element.textContent.length*3.5));
        occupied.push({left:x-halfWidth,right:x+halfWidth,top:y-42,bottom:y-8});
      }else{
        const size=this.touchUi?(label.element.dataset.army==='true'?48:42):(label.element.dataset.army==='true'?34:28),baseX=x,baseY=y;
        let candidate;
        // Spread overlapping markers in screen pixels so every stack member keeps
        // its own button, including at distant zoom. City nameplates reserve room.
        for(let attempt=0;attempt<Math.max(40,this.labels.length*5);attempt++){
          const ring=Math.ceil(attempt/8),angle=(attempt%8)*Math.PI/4;
          x=clamp(baseX+Math.cos(angle)*ring*size,18,w-18);
          y=clamp(baseY+Math.sin(angle)*ring*size,18,h-18);
          candidate={left:x-size*.5,right:x+size*.5,top:y-size*.5,bottom:y+size*.5};
          if(!occupied.some(r=>candidate.left<r.right&&candidate.right>r.left&&candidate.top<r.bottom&&candidate.bottom>r.top))break;
        }
        occupied.push(candidate);
      }
      label.element.style.left=`${x}px`;label.element.style.top=`${y}px`;
      label.element.style.zIndex=String(Math.round(1000-p.z*100));
    }
  }

  animatePieces(now){
    if(!this.actorAnimations?.size||!this.piecesGroup)return;
    for(const mesh of this.piecesGroup.children){
      let changed=false;
      mesh.userData.actorIds.forEach((id,index)=>{
        const animation=this.actorAnimations.get(id);if(!animation)return;
        const offset=actorMotionOffset(animation,now);
        const matrix=this.dummy.matrix.copy(mesh.userData.baseMatrices[index]);
        matrix.elements[12]+=offset.x;matrix.elements[14]+=offset.z;matrix.elements[13]+=offset.y;
        mesh.setMatrixAt(index,matrix);changed=true;
      });
      if(changed){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
    }
    for(const [id,animation] of this.actorAnimations)if(now-animation.started>=animation.duration)this.actorAnimations.delete(id);
  }

  pick(e) {
    if(!this.pickMesh)return null;const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const targets=[this.pickMesh];if(this.terrainGroup)targets.push(this.terrainGroup);if(this.piecesGroup)targets.push(this.piecesGroup);
    const hit=this.raycaster.intersectObjects(targets,true).find(h=>h.object.userData.tileIds?.[h.instanceId]);
    this.lastPickedActorId=hit?.object.userData.actorIds?.[hit.instanceId]||null;
    return hit?hit.object.userData.tileIds[hit.instanceId]:null;
  }

  pointerDown(e) {
    if(this.contextLost)return;
    this.renderer.domElement.focus({preventScroll:true});
    if(e.pointerType==='touch'){
      this.touches??=new Map();this.touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.touches.size>1){this.pinch=this.touchMeasure();this.suppressTap=true;this.drag=null;this.renderer.domElement.setPointerCapture(e.pointerId);return;}
    }
    this.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,button:e.button,moved:false};
    this.renderer.domElement.setPointerCapture(e.pointerId);
  }

  pointerMove(e) {
    if(this.contextLost)return;
    if(this.touches?.has(e.pointerId)){
      this.touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.touches.size>1){const next=this.touchMeasure();if(this.pinch&&next.distance>0){this.zoom(Math.log(next.distance/Math.max(1,this.pinch.distance))*this.spanGoal);this.pan(next.x-this.pinch.x,next.y-this.pinch.y);}this.pinch=next;return;}
      if(this.suppressTap)return;
    }
    if(this.drag){
      const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;
      if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>4)this.drag.moved=true;
      if((this.drag.button===2||this.drag.button===1||(e.pointerType==='touch'&&this.drag.moved))&&this.drag.moved){this.pan(dx,dy);this.renderer.domElement.style.cursor='grabbing';}
      this.drag.lastX=e.clientX;this.drag.lastY=e.clientY;
      if(this.drag.moved)return;
    }
    const id=this.pick(e);
    if(id!==this.currentHovered){this.currentHovered=id;this.hoverRing.visible=!!id;if(id)this.hoverRing.position.copy(worldPosition(this.tileMap.get(id)));this.onTileHover?.(id);}
    this.renderer.domElement.style.cursor=id?'pointer':'grab';
  }

  pointerUp(e) {
    const drag=this.drag;this.drag=null;this.renderer.domElement.style.cursor='grab';
    if(!this.contextLost&&drag&&!drag.moved&&drag.button===0&&!e.cancelled&&!this.suppressTap){const id=this.pick(e);if(this.lastPickedActorId&&this.onUnitClick)this.onUnitClick(this.lastPickedActorId);else if(id)this.onTileClick?.(id);}
    this.touches?.delete(e.pointerId);this.pinch=null;if(!this.touches?.size)this.suppressTap=false;
    try{this.renderer.domElement.releasePointerCapture(e.pointerId);}catch{}
  }

  cityGrounds(b,f){
    // Civic paving and planted terraces are intrinsic to a settlement. Completed
    // economic, military and religious projects remain driven by city state.
    b.add('hex','#a4b8a4',0,-.005,0,1.08,.07,1.08);
    b.add('hex','#d9dbc1',0,.035,0,1.015,.025,1.015);
    b.add('hex','#c4ccb2',0,.051,0,.985,.012,.985);
    b.add('box','#e9e3ca',0,.066,.42,.32,.015,1.04);
    b.add('box','#dce0c8',0,.067,-.51,1.31,.018,.13);
    for(const side of [-1,1]){
      for(let i=0;i<3;i++)b.add('box','#ece5cc',side*.36,.072,-.47+i*.29,.16,.014,.10);
      // Low arcades frame the main building without competing with its silhouette.
      b.add('box','#e2ddc2',side*.60,.10,-.32,.20,.065,.52);
      for(const z of [-.53,-.32,-.11]){
        b.add('cylinder','#f0e8d0',side*.60,.26,z,.022,.27,.022);
        b.add('box','bannerGold',side*.60,.395,z,.066,.029,.064);
      }
      b.add('box',f.cloth,side*.60,.427,-.32,.24,.044,.61);
      b.add('box','bannerGold',side*.60,.454,-.32,.25,.013,.63);
      b.add('box','#adb99e',side*.35,.095,.72,.15,.06,.20);
      b.add('leaf','#4f7c50',side*.35,.185,.72,.095,.17,.13);
      b.add('cylinder','#c1a268',side*.24,.26,.79,.014,.36,.014);
      b.add('sphere','window',side*.24,.455,.79,.036,.045,.036);
    }
    for(let i=0;i<3;i++)b.add('box','#dfd8bd',0,.028+i*.015,1.015-i*.055,.38,.03,.085);
  }

  touchMeasure(){const [a,b]=[...this.touches.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};}

  handleContextLost(event){
    event.preventDefault();if(this.disposed)return;
    this.contextLost=true;this.keys?.clear();this.drag=null;this.pinch=null;this.touches?.clear();this.suppressTap=false;this.clearHover();
    if(this.frame!=null)cancelAnimationFrame(this.frame);this.frame=null;
    if(this.contextNoticeTimer)clearTimeout(this.contextNoticeTimer);
    this.renderer.domElement.setAttribute('aria-busy','true');
    if(this.overlay)this.overlay.style.visibility='hidden';
    if(this.graphicsStatus){this.graphicsStatus.hidden=false;this.graphicsStatus.textContent='Graphics paused. Your campaign is still here. Waiting for your device to restore the map…';}
  }

  handleContextRestored(){
    if(this.disposed||!this.contextLost)return;
    this.contextLost=false;this.lastTime=performance.now();this.lastRenderedAt=0;this.perfSince=0;this.perfFrames=0;
    this.renderer.shadowMap.needsUpdate=true;
    if(this.groundTextureUniform?.value)this.groundTextureUniform.value.needsUpdate=true;
    this.renderer.domElement.setAttribute('aria-busy','false');
    if(this.overlay)this.overlay.style.visibility='';
    if(this.graphicsStatus){this.graphicsStatus.textContent='Graphics restored. Continue your campaign.';this.graphicsStatus.hidden=false;this.contextNoticeTimer=setTimeout(()=>{if(!this.contextLost&&this.graphicsStatus)this.graphicsStatus.hidden=true;},3000);}
    // Three.js restores its GPU caches. Reuse the CPU scene and campaign state;
    // no reload, new campaign, or duplicate canvas is necessary.
    this.resize();if(this.frame==null)this.frame=requestAnimationFrame(this.animate);
  }

  clearHover(){this.currentHovered=null;if(this.hoverRing)this.hoverRing.visible=false;this.onTileHover?.(null);}

  canKeyboardPan(){
    if(this.contextLost||typeof document==='undefined'||document.activeElement!==this.renderer?.domElement)return false;
    const welcome=document.getElementById('welcome');
    return (!welcome||welcome.hidden)&&!document.querySelector('dialog[open]');
  }

  pan(dx,dy) {
    const speed=this.span*2/(this.height||800);
    // Camera-right and projected camera-forward vectors on the tabletop.
    this.targetGoal.x+=(-dx*.82-dy*.8)*speed;
    this.targetGoal.z+=(dx*.57-dy*1.14)*speed;
    this.targetGoal.x=clamp(this.targetGoal.x,-14,14);this.targetGoal.z=clamp(this.targetGoal.z,-12,12);
  }

  zoom(delta){this.spanGoal=clamp(this.spanGoal-Number(delta||0),4.4,21);}
  focus(tileId){const tile=this.tileMap.get(tileId);if(!tile)return;this.targetGoal.copy(worldPosition(tile));this.spanGoal=Math.min(this.spanGoal,this.width>900?4.9:6.1);this.measureFocusAnchor();}
  resetCamera(){this.targetGoal.set(0,0,0);this.spanGoal=13.2;}
  setLabels(value){this.labelsEnabled=!!value;this.updateLabels();}
  setAccessibility({reducedMotion=this.reducedMotion,highContrast=this.highContrast}={}){
    this.reducedMotion=!!reducedMotion;this.highContrast=!!highContrast;
    if(this.reducedMotion){
      this.target?.copy(this.targetGoal);this.span=this.spanGoal;
      for(const mesh of this.piecesGroup?.children||[]){
        if(!mesh.isInstancedMesh)continue;
        mesh.userData.baseMatrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
      }
      this.actorAnimations?.clear();this.keys?.clear();
    }
    if(this.hoverRing){this.hoverRing.material.color.set(this.highContrast?'#ffffff':'#fff3ce');this.hoverRing.material.opacity=this.reducedMotion?.7:.6;}
    if(this.lastHighlights)this.updateHighlights(this.lastHighlights.selected,this.lastHighlights.reachable,this.lastHighlights.attackable);
    if(this.renderer){this.updateCamera();this.updateLabels();}
  }

  resize(){
    if(!this.renderer)return;const rect=this.container.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);
    this.renderer.setSize(this.width,this.height,false);this.measureFocusAnchor();this.updateCamera();this.updateLabels();
  }

  measureFocusAnchor(){
    if(!this.container||typeof document==='undefined')return;
    const canvas=this.container.getBoundingClientRect(),compact=canvas.width<=900;
    if(!canvas.width||!canvas.height)return;
    const x=canvas.width*(compact?.5:.55),preferredY=canvas.height*(compact?.43:.45);
    let top=40,bottom=canvas.height-60;
    const root=this.container.closest('#game')||this.container.parentElement;
    for(const [selector,edge,padding]of [['.objective','top',88],['#selection','bottom',94]]){
      const panel=root?.querySelector(selector);if(!panel||!panel.getClientRects().length)continue;
      const rect=panel.getBoundingClientRect(),screenX=canvas.left+x;
      if(screenX<rect.left-55||screenX>rect.right+55)continue;
      if(edge==='top')top=Math.max(top,rect.bottom-canvas.top+padding);
      else bottom=Math.min(bottom,rect.top-canvas.top-padding);
    }
    const y=top<=bottom?clamp(preferredY,top,bottom):(top+bottom)*.5;
    this.focusAnchor={x:x/canvas.width,y:clamp(y/canvas.height,.18,.64)};
  }

  updateCamera(){
    const aspect=(this.width||1)/(this.height||1),anchor=this.focusAnchor||{x:this.width>900?.55:.5,y:this.width>900?.45:.43};
    // Shift the orthographic frustum in pixels, leaving the world target intact.
    // This keeps the focused miniature between the measured objective and HUD.
    const shiftX=(1-2*anchor.x)*this.span*aspect,shiftY=(2*anchor.y-1)*this.span;
    this.camera.left=-this.span*aspect+shiftX;this.camera.right=this.span*aspect+shiftX;this.camera.top=this.span+shiftY;this.camera.bottom=-this.span+shiftY;
    this.camera.position.copy(this.target).add(new THREE.Vector3(18,26,26));this.camera.lookAt(this.target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  }

  animate(now){
    if(this.disposed||this.contextLost){this.frame=null;return;}
    if(document.hidden||(this.maxFps&&now-(this.lastRenderedAt||0)<1000/this.maxFps-1)){this.frame=requestAnimationFrame(this.animate);return;}
    this.lastRenderedAt=now;const dt=Math.min((now-this.lastTime)/1000,.05);this.lastTime=now;
    if(!this.canKeyboardPan())this.keys.clear();
    let dx=0,dy=0;if(this.keys.has('a'))dx+=1;if(this.keys.has('d'))dx-=1;if(this.keys.has('w'))dy+=1;if(this.keys.has('s'))dy-=1;
    if(dx||dy)this.pan(dx*dt*500,dy*dt*500);
    const ease=this.reducedMotion?1:1-Math.exp(-dt*9);this.target.lerp(this.targetGoal,ease);this.span+=(this.spanGoal-this.span)*ease;
    this.updateCamera();this.animatePieces(now);this.updateLabels();
    if(!this.reducedMotion)this.motionTime=(this.motionTime||0)+dt;
    if(this.fogVeil)this.fogVeil.material.uniforms.time.value=this.motionTime||0;
    this.motes.rotation.y=(this.motionTime||0)*.009;
    if(this.hoverRing)this.hoverRing.material.opacity=this.reducedMotion?.7:.55+Math.sin((this.motionTime||0)*3)*.15;
    this.renderer.render(this.scene,this.camera);
    this.perfFrames=(this.perfFrames||0)+1;
    if(!this.perfSince)this.perfSince=now;
    if(now-this.perfSince>2000){this.renderer.domElement.dataset.performance=JSON.stringify({fps:Math.round(this.perfFrames*1000/(now-this.perfSince)),drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles});this.perfFrames=0;this.perfSince=now;}
    this.frame=requestAnimationFrame(this.animate);
  }

  dispose(){
    this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver?.disconnect();
    if(this.contextNoticeTimer)clearTimeout(this.contextNoticeTimer);
    if(this.events){for(const type of ['pointerdown','pointermove','pointerup','pointercancel','pointerleave','contextmenu','wheel','webglcontextlost','webglcontextrestored'])this.renderer?.domElement.removeEventListener(type,this.events[type]);for(const type of ['keydown','keyup','blur'])window.removeEventListener(type,this.events[type]);}
    const geos=new Set(),mats=new Set();this.scene?.traverse(obj=>{if(obj.geometry)geos.add(obj.geometry);if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>mats.add(m));});
    Object.values(this.geometry).forEach(g=>geos.add(g));this.materialCache.forEach(m=>mats.add(m));geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
    this.groundTextureUniform?.value?.dispose();this.groundTexture?.dispose();this.renderer?.dispose();this.renderer?.domElement.remove();this.overlay?.remove();this.graphicsStatus?.remove();
  }
}
