import {buildMapTiles} from './mapTiles.mjs';
import {siTharSeparationFields} from '../src/data/villages/sithar/separationFields.ts';
import {worldToGeo,SITHAR_GEO_ORIGIN,METERS_PER_DEG_LAT,METERS_PER_DEG_LON,toWorld} from '../src/data/villages/sithar/sitharData.ts';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const source={type:'FeatureCollection',features:siTharSeparationFields.map(f=>{const geo=worldToGeo(f.x,f.z);return {type:'Feature',id:f.id,geometry:{type:'Point',coordinates:[geo.lon,geo.lat]},properties:{kind:'field',width:f.width,depth:f.depth,rotation:f.rotation,color:f.color}};})};
const {manifest,files}=buildMapTiles(source,{dataset:'sithar-fields',limits:{maxFeatures:10}});
const root=`public/map/sithar-fields/${manifest.version}`;
await mkdir(join(root,'tiles'),{recursive:true});
for(const [path,text] of [...files,['manifest.json',JSON.stringify(manifest)]]){
 const target=join(root,path);
 try{await writeFile(target,text,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||await readFile(target,'utf8')!==text)throw error;}
}
const anchor=toWorld(0,4061);
await writeFile('src/data/sitharFieldDataset.json',JSON.stringify({manifest:`/map/sithar-fields/${manifest.version}/manifest.json`,projection:{origin:[SITHAR_GEO_ORIGIN.lon,SITHAR_GEO_ORIGIN.lat],anchor:[anchor.x,anchor.z],metersPerDegree:[METERS_PER_DEG_LON,METERS_PER_DEG_LAT],rotation:Math.PI/4}},null,2)+'\n');
console.log(JSON.stringify({tiles:manifest.tiles.length,features:manifest.featureCount,version:manifest.version}));
