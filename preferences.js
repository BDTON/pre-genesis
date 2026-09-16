// Player preferences are deliberately separate from campaign saves.
export const SETTINGS_KEY='crowns-player-preferences-v1';
export const DEFAULT_BINDINGS=Object.freeze({nextUnit:'KeyN',endTurn:'KeyE',commands:'KeyC',rest:'KeyH',found:'KeyF',power:'KeyR',army:'KeyJ'});
export const ACTION_LABELS=Object.freeze({nextUnit:'Next unit',endTurn:'End turn',commands:'Commands',rest:'Rest unit',found:'Found city',power:'Champion power',army:'Form army'});
export const BINDABLE_KEYS=Object.freeze('BCEFGHIJKLMNOPQRTUVXYZ'.split('').map(k=>'Key'+k));
export const DEFAULT_PAD_BINDINGS=Object.freeze({nextUnit:2,endTurn:3,zoomOut:4,zoomIn:5,rest:6,context:7,commands:8,menu:9});
export const PAD_ACTION_LABELS=Object.freeze({nextUnit:'Next unit',endTurn:'End turn',zoomOut:'Zoom out',zoomIn:'Zoom in',rest:'Rest unit',context:'Unit ability',commands:'Commands',menu:'Menu'});
export const PAD_BUTTON_LABELS=Object.freeze({2:'X / Square',3:'Y / Triangle',4:'LB / L1',5:'RB / R1',6:'LT / L2',7:'RT / R2',8:'View / Share',9:'Menu / Options'});
export function normalizePreferences(value={}){
  const v=value&&typeof value==='object'?value:{};
  const bindings={...DEFAULT_BINDINGS};
  let padBindings={...DEFAULT_PAD_BINDINGS};
  if(v.padBindings&&typeof v.padBindings==='object'){
    const candidate=Object.fromEntries(Object.keys(padBindings).map(k=>[k,v.padBindings[k]]));
    if(Object.values(candidate).every(n=>Number.isInteger(n)&&n>=2&&n<=9)&&new Set(Object.values(candidate)).size===8)padBindings=candidate;
  }
  if(v.bindings&&typeof v.bindings==='object'){
    const proposed=Object.fromEntries(Object.keys(bindings).map(k=>[k,BINDABLE_KEYS.includes(v.bindings[k])?v.bindings[k]:bindings[k]]));
    if(new Set(Object.values(proposed)).size===Object.keys(bindings).length)Object.assign(bindings,proposed);
  }
  return {textSize:v.textSize==='large'?'large':'standard',contrast:v.contrast==='high'?'high':'standard',motion:['system','reduced','full'].includes(v.motion)?v.motion:'system',quality:v.quality==='balanced'?'balanced':'high',confirmTurn:!!v.confirmTurn,volume:typeof v.volume==='number'&&Number.isFinite(v.volume)?Math.max(0,Math.min(1,v.volume)):.65,bindings,padBindings};
}
export function loadPreferences(storage){try{return normalizePreferences(JSON.parse(storage.getItem(SETTINGS_KEY)||'{}'));}catch{return normalizePreferences();}}
export function savePreferences(storage,value){try{storage.setItem(SETTINGS_KEY,JSON.stringify(normalizePreferences(value)));return true;}catch{return false;}}
