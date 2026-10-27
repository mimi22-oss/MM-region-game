import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,20);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export const MAP_TILE_LIMITS={maxFeatures:256,maxBytes:262144,maxCoordinates:8192};

/** Full geometry bounds, including holes and collections; never centroid-only coverage. */
export function geometryMetrics(geometry){
 const bbox=[Infinity,Infinity,-Infinity,-Infinity];let coordinateCount=0;
 const point=p=>{
  if(!Array.isArray(p)||p.length<2||!p.every(Number.isFinite)||p[0]<-180||p[0]>180||p[1]<-90||p[1]>90)throw new Error('Invalid WGS84 coordinate');
  bbox[0]=Math.min(bbox[0],p[0]);bbox[1]=Math.min(bbox[1],p[1]);bbox[2]=Math.max(bbox[2],p[0]);bbox[3]=Math.max(bbox[3],p[1]);coordinateCount++;
 };
 const line=(ps,ring=false)=>{if(!Array.isArray(ps)||ps.length<(ring?4:2))throw new Error('Invalid line/ring');ps.forEach(point);if(ring&&(ps[0][0]!==ps.at(-1)[0]||ps[0][1]!==ps.at(-1)[1]))throw new Error('Polygon ring must be closed');};
 const polygon=rs=>{if(!Array.isArray(rs)||!rs.length)throw new Error('Empty polygon');rs.forEach(r=>line(r,true));};
 const visit=(g,depth=0)=>{
  if(!g||depth>16)throw new Error('Invalid/null/deep geometry');
  const c=g.coordinates;
  switch(g.type){
   case 'Point':point(c);break;
   case 'MultiPoint':if(!Array.isArray(c)||!c.length)throw new Error('Empty points');c.forEach(point);break;
   case 'LineString':line(c);break;
   case 'MultiLineString':if(!Array.isArray(c)||!c.length)throw new Error('Empty lines');c.forEach(p=>line(p));break;
   case 'Polygon':polygon(c);break;
   case 'MultiPolygon':if(!Array.isArray(c)||!c.length)throw new Error('Empty polygons');c.forEach(polygon);break;
   case 'GeometryCollection':if(!Array.isArray(g.geometries)||!g.geometries.length)throw new Error('Empty geometries');g.geometries.forEach(x=>visit(x,depth+1));break;
   default:throw new Error(`Unsupported geometry: ${g.type}`);
  }
 };
 visit(geometry);return {bbox,coordinateCount};
}

/** Offline only: do not parse source collections in the game's main thread. */
export function buildMapTiles(collection,{dataset,limits={}}={}){
 if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(dataset??''))throw new Error('Use a lowercase dataset slug');
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features)||collection.crs)throw new Error('Expected WGS84 FeatureCollection without legacy crs');
 limits={...MAP_TILE_LIMITS,...limits};
 for(const [key,max] of Object.entries(MAP_TILE_LIMITS))if(!Number.isSafeInteger(limits[key])||limits[key]<1||limits[key]>max)throw new Error(`Invalid budget: ${key} (maximum ${max})`);
 const ids=new Set(),wrap=features=>JSON.stringify({type:'FeatureCollection',features});
 const items=collection.features.map((source,i)=>{
  if(source?.type!=='Feature'||!source.geometry||!(source.properties===null||(typeof source.properties==='object'&&!Array.isArray(source.properties))))throw new Error(`Invalid feature ${i}`);
  const feature=stable(source);
  feature.id??=`auto-${hash(JSON.stringify(feature))}`;
  if(!['string','number'].includes(typeof feature.id)||feature.id===''||(typeof feature.id==='number'&&!Number.isFinite(feature.id)))throw new Error('Invalid feature ID');
  const key=String(feature.id);if(ids.has(key))throw new Error(`Duplicate feature ID: ${key}`);ids.add(key);
  const metrics=geometryMetrics(feature.geometry),bytes=Buffer.byteLength(JSON.stringify(feature));
  if(metrics.coordinateCount>limits.maxCoordinates||Buffer.byteLength(wrap([feature]))>limits.maxBytes)throw new Error(`Feature ${key} exceeds tile budget; simplify or split explicitly`);
  return {feature,key,bytes,...metrics};
 }).sort((a,b)=>a.key.localeCompare(b.key));
 const files=new Map(),tiles=[];
 const split=items=>{
  if(!items.length)return;
  const bbox=[Infinity,Infinity,-Infinity,-Infinity];let coordinates=0,bytes=Buffer.byteLength(wrap([]))+items.length-1;
  for(const i of items){for(let axis=0;axis<2;axis++){bbox[axis]=Math.min(bbox[axis],i.bbox[axis]);bbox[axis+2]=Math.max(bbox[axis+2],i.bbox[axis+2]);}coordinates+=i.coordinateCount;bytes+=i.bytes;}
  if(items.length<=limits.maxFeatures&&coordinates<=limits.maxCoordinates&&bytes<=limits.maxBytes){
   const text=wrap(items.map(i=>i.feature)),id=String(tiles.length).padStart(6,'0'),url=`tiles/${id}.${hash(text)}.json`;
   files.set(url,text);tiles.push({id,url,bbox,bytes:Buffer.byteLength(text),featureCount:items.length,coordinateCount:coordinates});return;
  }
  const axis=bbox[2]-bbox[0]>=bbox[3]-bbox[1]?0:1;
  items.sort((a,b)=>(a.bbox[axis]+a.bbox[axis+2])-(b.bbox[axis]+b.bbox[axis+2])||a.key.localeCompare(b.key));
  const mid=Math.floor(items.length/2);split(items.slice(0,mid));split(items.slice(mid));
 };
 split(items);
 const version=hash(JSON.stringify({dataset,limits,tiles}));
 return {manifest:{schemaVersion:1,dataset,version,crs:'EPSG:4326',featureCount:items.length,limits,tiles},files};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,v,i,a)=>i%2?pairs:[...pairs,[v,a[i+1]]],[]));
 if(!args['--input']||!args['--output']||!args['--dataset'])throw new Error('Usage: node scripts/mapTiles.mjs --input source.geojson --output public/map/NAME/VERSION --dataset NAME');
 const {manifest,files}=buildMapTiles(JSON.parse(await readFile(resolve(args['--input']),'utf8')),{dataset:args['--dataset']});
 const output=resolve(args['--output']);
 // Require a fresh directory: never overwrite a published dataset in place.
 await mkdir(output,{recursive:false});await mkdir(join(output,'tiles'));
 for(const [url,text] of files)await writeFile(join(output,url),text,{flag:'wx'});
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest),{flag:'wx'});
 console.log(JSON.stringify({output,features:manifest.featureCount,tiles:manifest.tiles.length,version:manifest.version,maxTileBytes:Math.max(0,...manifest.tiles.map(t=>t.bytes))}));
}
