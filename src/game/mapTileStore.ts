/** Payloads are fetched JSON, never dynamic JS imports: eviction can release their memory. */
export type TileBounds = [number, number, number, number];
export type MapTile = {id:string;url:string;bbox:TileBounds;bytes:number;featureCount:number;coordinateCount:number};
export type MapManifest = {schemaVersion:1;dataset:string;version:string;crs:'EPSG:4326';featureCount:number;limits:{maxFeatures:number;maxBytes:number;maxCoordinates:number};tiles:MapTile[]};
type Branch = {bbox:TileBounds;left?:Branch;right?:Branch;tile?:MapTile};
const distance = (b:TileBounds,x:number,y:number) => Math.hypot(Math.max(b[0]-x,0,x-b[2]),Math.max(b[1]-y,0,y-b[3]));

export function validateManifest(value:unknown):MapManifest {
 const m=value as MapManifest;
 if(!m||m.schemaVersion!==1||m.crs!=='EPSG:4326'||!m.dataset||!m.version||!Array.isArray(m.tiles)||!m.limits)throw new Error('Invalid map manifest');
 for(const n of [m.limits.maxBytes,m.limits.maxFeatures,m.limits.maxCoordinates])if(!Number.isSafeInteger(n)||n<=0)throw new Error('Invalid map limits');
 const ids=new Set<string>();let count=0;
 for(const t of m.tiles){
  if(!t.id||ids.has(t.id)||!/^tiles\/[a-zA-Z0-9._-]+\.json$/.test(t.url))throw new Error('Invalid or duplicate tile');
  ids.add(t.id);
  if(!Array.isArray(t.bbox)||t.bbox.length!==4||!t.bbox.every(Number.isFinite)||t.bbox[0]>t.bbox[2]||t.bbox[1]>t.bbox[3]||t.bbox[0]<-180||t.bbox[2]>180||t.bbox[1]<-90||t.bbox[3]>90)throw new Error('Invalid tile bounds');
  for(const [n,max] of [[t.bytes,m.limits.maxBytes],[t.featureCount,m.limits.maxFeatures],[t.coordinateCount,m.limits.maxCoordinates]])if(!Number.isSafeInteger(n)||n<1||n>max)throw new Error('Tile exceeds manifest budget');
  count+=t.featureCount;
 }
 if(count!==m.featureCount)throw new Error('Manifest count mismatch');
 return m;
}

/** Bounding-volume tree: no per-frame scan or sort of the entire catalogue. */
export class MapTileIndex {
 private root?:Branch;
 constructor(tiles:readonly MapTile[]){
  const build=(items:MapTile[]):Branch|undefined=>{
   if(!items.length)return;
   const bbox:TileBounds=[Infinity,Infinity,-Infinity,-Infinity];
   for(const t of items){bbox[0]=Math.min(bbox[0],t.bbox[0]);bbox[1]=Math.min(bbox[1],t.bbox[1]);bbox[2]=Math.max(bbox[2],t.bbox[2]);bbox[3]=Math.max(bbox[3],t.bbox[3]);}
   if(items.length===1)return {bbox,tile:items[0]};
   const axis=bbox[2]-bbox[0]>=bbox[3]-bbox[1]?0:1;
   items.sort((a,b)=>(a.bbox[axis]+a.bbox[axis+2])-(b.bbox[axis]+b.bbox[axis+2])||a.id.localeCompare(b.id));
   const mid=Math.floor(items.length/2);
   return {bbox,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
  };
  this.root=build([...tiles]);
 }
 nearest(x:number,y:number,radius:number,limit:number):MapTile[]{
  if(![x,y,radius,limit].every(Number.isFinite)||radius<0||limit<1)return [];
  const heap:{node:Branch;d:number}[]=[],result:MapTile[]=[];
  const push=(node?:Branch)=>{if(!node)return;const d=distance(node.bbox,x,y);if(d>radius)return;let i=heap.length;heap.push({node,d});while(i>0){const p=(i-1)>>1;if(heap[p].d<=d)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
  const pop=()=>{const item=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].d<heap[c].d)c++;if(heap[i].d<=heap[c].d)break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}return item.node;};
  push(this.root);
  while(heap.length&&result.length<Math.floor(limit)){const n=pop();if(n.tile)result.push(n.tile);else{push(n.left);push(n.right);}}
  return result;
 }
}

/** Bound the response BEFORE JSON.parse, even if Content-Length is absent/incorrect. */
export async function fetchMapJson(url:string,signal:AbortSignal,maxBytes:number):Promise<unknown>{
 const response=await fetch(url,{signal});
 if(!response.ok)throw new Error(`Map download failed (${response.status})`);
 if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel();throw new Error('Map response exceeds byte budget');}
 if(!response.body)throw new Error('Map response has no body');
 const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
 try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>maxBytes)throw new Error('Map response exceeds byte budget');text+=decoder.decode(next.value,{stream:true});}text+=decoder.decode();}
 finally{await reader.cancel();reader.releaseLock();}
 return JSON.parse(text);
}

export type MapTilePayload={type:'FeatureCollection';features:Array<{type:'Feature';id:string|number;geometry:unknown;properties:Record<string,unknown>|null}>};
type StoreOptions={maxTiles:number;maxBytes:number;maxActive:number;concurrency?:number;retryMs?:number};
type TileLoader=(tile:MapTile,signal:AbortSignal)=>Promise<MapTilePayload>;
/** Bounded resident + in-flight data. Selection changes cancel irrelevant requests. */
export class MapTileStore {
 private definitions:Map<string,MapTile>;
 private resident=new Map<string,MapTilePayload>();
 private running=new Map<string,AbortController>();
 private wanted:string[]=[];
 private failures=new Map<string,number>();
 private listeners=new Set<()=>void>();
 private snapshot:ReadonlyArray<{tile:MapTile;data:MapTilePayload}>=[];
 private closed=false;
 private options:StoreOptions;
 private load:TileLoader;
 constructor(manifest:MapManifest,load:TileLoader,options:StoreOptions){
  validateManifest(manifest);
  if(![options.maxTiles,options.maxActive,options.maxBytes,options.concurrency??2].every(n=>Number.isSafeInteger(n)&&n>0)||options.maxActive>options.maxTiles||manifest.limits.maxBytes*options.maxActive>options.maxBytes)throw new Error('Invalid map cache budget');
  this.definitions=new Map(manifest.tiles.map(t=>[t.id,t]));this.load=load;this.options=options;
 }
 getSnapshot=()=>this.snapshot;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn);};};
 getStats=()=>({resident:this.resident.size,bytes:[...this.resident.keys()].reduce((n,id)=>n+this.definitions.get(id)!.bytes,0),inFlight:this.running.size,failed:this.failures.size});
 select(ids:readonly string[]){
  if(this.closed)return;
  this.wanted=[...new Set(ids)].filter(id=>this.definitions.has(id)).slice(0,this.options.maxActive);
  for(const [id,controller] of this.running)if(!this.wanted.includes(id))controller.abort();
  for(const id of this.failures.keys())if(!this.wanted.includes(id))this.failures.delete(id);
  for(const id of this.wanted){const value=this.resident.get(id);if(value){this.resident.delete(id);this.resident.set(id,value);}}
  this.publish();this.pump();
 }
 private publish(){
  const next=this.wanted.filter(id=>this.resident.has(id)).map(id=>({tile:this.definitions.get(id)!,data:this.resident.get(id)!}));
  if(next.length===this.snapshot.length&&next.every((v,i)=>v.data===this.snapshot[i].data))return;
  this.snapshot=next;this.listeners.forEach(fn=>fn());
 }
 private trim(incoming:MapTile){
  let bytes=this.getStats().bytes;
  for(const [id] of this.resident){
   if(this.resident.size<this.options.maxTiles&&bytes+incoming.bytes<=this.options.maxBytes)break;
   if(this.wanted.includes(id))continue;
   bytes-=this.definitions.get(id)!.bytes;this.resident.delete(id);
  }
 }
 private pump(){
  if(this.closed)return;
  for(const id of this.wanted){
   if(this.running.size>=(this.options.concurrency??2))break;
   if(this.resident.has(id)||this.running.has(id)||(this.failures.get(id)??-Infinity)+ (this.options.retryMs??30000)>Date.now())continue;
   const tile=this.definitions.get(id)!,controller=new AbortController();this.running.set(id,controller);
   void this.load(tile,controller.signal).then(data=>{
    if(this.closed||controller.signal.aborted||!this.wanted.includes(id))return;
    if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length!==tile.featureCount)throw new Error('Map tile payload mismatch');
    this.trim(tile);this.resident.set(id,data);this.failures.delete(id);this.publish();
   }).catch(()=>{if(!this.closed&&!controller.signal.aborted)this.failures.set(id,Date.now());}).finally(()=>{this.running.delete(id);this.pump();});
  }
 }
 dispose(){this.closed=true;for(const c of this.running.values())c.abort();this.resident.clear();this.failures.clear();this.wanted=[];this.snapshot=[];this.listeners.clear();}
}

/** The renderer receives only a bounded selection; keep the returned store per world. */
export async function openMapDataset(manifestUrl:string,signal:AbortSignal,mobile=false){
 const url=new URL(manifestUrl,typeof location==='undefined'?'http://localhost/':location.href);
 const manifest=validateManifest(await fetchMapJson(url.href,signal,4*1024*1024));
 if(manifest.limits.maxBytes>262144||manifest.limits.maxFeatures>256||manifest.limits.maxCoordinates>8192)throw new Error('Dataset exceeds client tile budget');
 const index=new MapTileIndex(manifest.tiles);
 const store=new MapTileStore(manifest,async (tile,requestSignal)=>await fetchMapJson(new URL(tile.url,url).href,requestSignal,tile.bytes) as MapTilePayload,
  {maxTiles:mobile?4:8,maxActive:mobile?2:4,maxBytes:mobile?1048576:2097152,concurrency:2});
 return {manifest,index,store};
}
