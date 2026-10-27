import {kalayVillages,ward} from '../src/data/ward.ts';
import {myotharCenterBuildings} from '../src/data/wards/myothar/center/myotharCenterBuildings.ts';
import {kalayArea1Buildings} from '../src/data/wards/kalayArea1/kalayArea1Buildings.ts';
const unique=items=>new Map(items.map(x=>[x.id,x])).size;
const regions=[{...ward,id:'myothar',houses:[...ward.houses,...myotharCenterBuildings,...kalayArea1Buildings]},...kalayVillages].map(r=>({
 id:r.id,buildings:unique(r.houses),roads:unique(r.roads),fields:unique([...(r.fields??[]),...(r.bundedFields??[]),...(r.separationFields??[])]),trees:unique([...(r.trees??[]),...(r.largeTrees??[]),...(r.farmTrees??[])])
}));
console.log(JSON.stringify({architecture:'legacy eager data; lazy 3D components',regions,totalFeatures:regions.reduce((n,r)=>n+r.buildings+r.roads+r.fields+r.trees,0),newDataPath:'scripts/mapTiles.mjs -> public/map/<dataset>/<version>/manifest.json -> openMapDataset',note:'Tile/JSON budgets bound new dataset residency; this audit does not measure browser FPS, GPU or total JS heap.'},null,2));
