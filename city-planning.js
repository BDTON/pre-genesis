// Pure city-planning rules shared by UI previews and authoritative simulation.
export const CITY_FOCUSES=['balanced','food','production','gold'];
export const DISTRICT_KINDS=['campus','market','sanctuary','forge'];
export const DISTRICT_YIELD={campus:'science',market:'gold',sanctuary:'culture',forge:'production'};
const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
const ordinal=(a,b)=>a<b?-1:a>b?1:0;
export const districtLimit=population=>Math.min(4,1+Math.floor((population-1)/3));
export const workRadius=city=>city.population>=4?2:1;
export function tileYields(faction,tile){
 let food=tile.terrain==='grass'?2:tile.terrain==='forest'?1:0;
 let production=tile.terrain==='hills'?2:['forest','waste'].includes(tile.terrain)?1:0,gold=tile.river?1:0;
 if(['wheat','fish'].includes(tile.resource))food+=2;
 if(['iron','timber'].includes(tile.resource))production++;
 if(['gems','horses'].includes(tile.resource))gold+=2;
 if(tile.improvement==='farm')food+=faction.techs.includes('agriculture')?3:2;
 if(['mine','lumbermill'].includes(tile.improvement))production+=2;
 return {food,production,gold};
}
export function districtAt(state,tileId){
 for(const city of state.cities)for(const [kind,id] of Object.entries(city.districtTiles||{}))if(id===tileId)return {city,kind};
 return null;
}
export function reservedDistrictAt(state,tileId,ignoreCityId=null){
 return state.cities.find(c=>c.id!==ignoreCityId&&c.queuedDistrictTileId===tileId&&DISTRICT_KINDS.includes(c.queue))||null;
}
export function cityWorkPlan(state,city,yieldFn=tileYields){
 const center=state.tiles.find(t=>t.id===city.tileId),faction=state.factions.find(f=>f.id===city.faction);
 const forbidden=new Set(state.cities.flatMap(c=>[c.tileId,...Object.values(c.districtTiles||{}),...(c.queuedDistrictTileId?[c.queuedDistrictTileId]:[])]));
 const cities=state.cities.filter(c=>c.faction===city.faction).map(c=>({city:c,tile:state.tiles.find(t=>t.id===c.tileId)}));
 const focus=CITY_FOCUSES.includes(city.focus)?city.focus:'balanced';
 const candidates=state.tiles.filter(t=>{
  if(t.owner!==city.faction||forbidden.has(t.id)||distance(t,center)>workRadius(city))return false;
  const nearest=cities.filter(x=>distance(t,x.tile)<=workRadius(x.city)).sort((a,b)=>distance(t,a.tile)-distance(t,b.tile)||ordinal(a.city.id,b.city.id))[0];
  return nearest?.city.id===city.id;
 }).map(tile=>({tile,yields:yieldFn(faction,tile)}));
 const score=y=>(y.food+y.production+y.gold)+(focus==='balanced'?0:3*y[focus]);
 candidates.sort((a,b)=>score(b.yields)-score(a.yields)||ordinal(a.tile.id,b.tile.id));
 const worked=candidates.slice(0,city.population);
 return {focus,workedTiles:worked.map(x=>x.tile),availableTiles:candidates.map(x=>x.tile),yields:worked.reduce((sum,x)=>{for(const k of ['food','production','gold'])sum[k]+=x.yields[k];return sum;},{food:0,production:0,gold:0})};
}
export function districtAdjacency(state,tileId,kind){
 const center=state.tiles.find(t=>t.id===tileId);if(!center)return 0;
 const near=state.tiles.filter(t=>distance(t,center)===1);
 if(kind==='campus')return near.filter(t=>t.terrain==='mountain').length+Math.floor(near.filter(t=>t.terrain==='forest').length/2);
 if(kind==='market')return near.filter(t=>t.river||t.resource).length;
 if(kind==='sanctuary')return Math.floor(near.filter(t=>t.terrain==='forest').length/2);
 if(kind==='forge')return near.filter(t=>t.terrain==='hills'||t.improvement==='mine').length;
 return 0;
}
export function districtOptions(state,city,kind){
 if(!DISTRICT_KINDS.includes(kind)||city.districts.includes(kind)||city.districts.length>=districtLimit(city.population))return [];
 const center=state.tiles.find(t=>t.id===city.tileId);
 return state.tiles.filter(t=>t.owner===city.faction&&distance(t,center)<=2&&!['water','mountain'].includes(t.terrain)&&!t.improvement&&!t.resource&&!state.cities.some(c=>c.tileId===t.id)&&!districtAt(state,t.id)&&!reservedDistrictAt(state,t.id,city.id))
 .map(t=>({...t,adjacency:districtAdjacency(state,t.id,kind),yieldName:DISTRICT_YIELD[kind]}))
 .sort((a,b)=>b.adjacency-a.adjacency||ordinal(a.id,b.id));
}
