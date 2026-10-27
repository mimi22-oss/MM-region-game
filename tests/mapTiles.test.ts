import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Offline builder is intentionally executable JavaScript.
import {buildMapTiles} from '../scripts/mapTiles.mjs';
import {MapTileIndex,MapTileStore,validateManifest,fetchMapJson,type MapManifest,type MapTilePayload} from '../src/game/mapTileStore.ts';
const point=(id:number,x=94+id/100000,y=23)=>({type:'Feature',id,properties:{kind:'tree'},geometry:{type:'Point',coordinates:[x,y]}});
const collection=(features:unknown[])=>({type:'FeatureCollection',features});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('100,000 features partition into bounded deterministic tiles and nearest queries use full geometry bounds',()=>{
 const features=Array.from({length:100000},(_,i)=>point(i,94+(i%1000)/10000,23+Math.floor(i/1000)/10000));
 const a=buildMapTiles(collection(features),{dataset:'stress'});
 const manifest=validateManifest(a.manifest);assert.equal(manifest.featureCount,100000);
 assert.ok(manifest.tiles.length>390);
 const ids=new Set();for(const tile of manifest.tiles){assert.ok(tile.featureCount<=256);assert.ok(tile.bytes<=262144);const text=a.files.get(tile.url);assert.equal(Buffer.byteLength(text),tile.bytes);for(const f of JSON.parse(text).features)ids.add(f.id);}
 assert.equal(ids.size,100000);
 const index=new MapTileIndex(manifest.tiles);assert.equal(index.nearest(94.05,23.005,.01,4).length,4);assert.equal(index.nearest(0,0,.01,4).length,0);
 const small=features.slice(0,600);const b=buildMapTiles(collection(small),{dataset:'stable'}),c=buildMapTiles(collection(small.reverse()),{dataset:'stable'});assert.deepEqual(b.manifest,c.manifest);
 const span=buildMapTiles(collection([{type:'Feature',id:'long',properties:{},geometry:{type:'LineString',coordinates:[[90,20],[100,20]]}}]),{dataset:'span'});
 assert.equal(new MapTileIndex(span.manifest.tiles).nearest(90,20,.01,1)[0].id,span.manifest.tiles[0].id);
});
test('coincident dense features split; duplicate IDs, invalid coordinates, open rings and oversized features fail',()=>{
 const dense=buildMapTiles(collection(Array.from({length:1000},(_,i)=>point(i,94,23))),{dataset:'dense'});assert.ok(dense.manifest.tiles.every((t:any)=>t.featureCount<=256));
 assert.throws(()=>buildMapTiles(collection([point(1),point(1)]),{dataset:'bad'}),/Duplicate/);
 assert.throws(()=>buildMapTiles(collection([point(1,NaN)]),{dataset:'bad'}),/coordinate/);
 assert.throws(()=>buildMapTiles(collection([{...point(1),geometry:{type:'Polygon',coordinates:[[[94,23],[95,23],[95,24],[94,24]]]}}]),{dataset:'bad'}),/closed/);
 assert.throws(()=>buildMapTiles(collection([{...point(1),properties:{name:'x'.repeat(300000)}}]),{dataset:'bad'}),/budget/);
});
test('cache stays bounded across travel, cancels stale requests, and revisiting reuses resident data',async()=>{
 const built=buildMapTiles(collection(Array.from({length:30},(_,i)=>point(i))),{dataset:'travel',limits:{maxFeatures:1}});
 let calls=0;const store=new MapTileStore(built.manifest,async(t,s)=>{calls++;await tick();if(s.aborted)throw new Error('aborted');return JSON.parse(built.files.get(t.url));},{maxActive:2,maxTiles:3,maxBytes:786432,concurrency:2});
 const ids=built.manifest.tiles.map((t:any)=>t.id);
 for(let i=0;i<ids.length;i+=2){store.select(ids.slice(i,i+2));await tick();await tick();assert.ok(store.getStats().resident<=3);assert.ok(store.getStats().inFlight<=2);assert.ok(store.getSnapshot().length<=2);}
 const old=calls;store.select(ids.slice(-2));await tick();assert.equal(calls,old);
 store.select(ids.slice(0,2));store.select(ids.slice(-2));await tick();await tick();assert.deepEqual(store.getSnapshot().map(s=>s.tile.id),ids.slice(-2));
 store.dispose();assert.equal(store.getStats().resident,0);
});
test('failure backoff prevents request storms and disposal ignores late completions',async()=>{
 const built=buildMapTiles(collection([point(1)]),{dataset:'failure'});let calls=0;
 const bad=new MapTileStore(built.manifest,async()=>{calls++;throw new Error('offline');},{maxActive:1,maxTiles:1,maxBytes:262144});
 for(let i=0;i<10;i++){bad.select(['000000']);await tick();}assert.equal(calls,1);assert.equal(bad.getStats().failed,1);bad.dispose();
 let finish!:(v:MapTilePayload)=>void;const slow=new MapTileStore(built.manifest,()=>new Promise(resolve=>{finish=resolve;}),{maxActive:1,maxTiles:1,maxBytes:262144});
 slow.select(['000000']);slow.dispose();finish(JSON.parse([...built.files.values()][0] as string));await tick();assert.equal(slow.getStats().resident,0);
});
test('manifest and streamed response budgets cannot be bypassed',async()=>{
 const built=buildMapTiles(collection([point(1)]),{dataset:'validation'});
 assert.throws(()=>validateManifest({...built.manifest,featureCount:2}),/count/);
 assert.throws(()=>validateManifest({...built.manifest,tiles:[{...built.manifest.tiles[0],url:'../outside.json'}]}),/tile/);
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response('x'.repeat(64));await assert.rejects(fetchMapJson('http://local/',new AbortController().signal,32),/budget/);}
 finally{globalThis.fetch=original;}
});
