import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {GhostAudioEventScheduler,hauntedBand,hauntedGain} from '../src/game/audio/GhostAudioEventScheduler.ts';
import {warehouseSoundOrigins,warehouseOccluded,warehouseZoneDistance} from '../src/game/audio/warehouseSoundOrigins.ts';
import {area5} from '../src/data/wards/myothar/area5.ts';
import {GHOST_WAREHOUSE_ANCHOR,isGhostNightActive} from '../src/game/ghostConfig.ts';
import {isWarehouseHorrorAudioActive} from '../src/game/audio/WarehouseHorrorLoopPlayer.ts';
import {PLAYER_HOME_REFERENCE} from '../src/game/playerHomeProtection.ts';

test('distance bands are hysteretic, gains smooth, and night respects world-time overrides',()=>{
 assert.equal(hauntedBand(61,'outside'),'outside');assert.equal(hauntedBand(59,'outside'),'distant');
 assert.equal(hauntedBand(60.9,'distant'),'distant');assert.equal(hauntedBand(63,'distant'),'outside');
 assert.equal(hauntedBand(40,'distant'),'uneasy');assert.equal(hauntedBand(41,'uneasy'),'uneasy');
 assert.equal(hauntedBand(20,'uneasy'),'near');assert.equal(hauntedBand(8,'near'),'encounter');assert.equal(hauntedBand(9,'encounter'),'encounter');assert.equal(hauntedBand(11,'encounter'),'near');
 assert.equal(hauntedGain(60),0);assert.equal(hauntedGain(45),1);assert.ok(Math.abs(hauntedGain(59.99)-hauntedGain(60))<.001);
 assert.equal(isGhostNightActive(780,{timeMode:'day'}),false);assert.equal(isGhostNightActive(780,{timeMode:'night'}),true);assert.equal(isGhostNightActive(780,{forceActive:true}),true);
});
function sample(distance:number,seed=445){const scheduler=new GhostAudioEventScheduler(seed);const events:{time:number;preset:string}[]=[];
 for(let i=0;i<18000;i++){const event=scheduler.tick(.1,distance,true,0);if(event)events.push({time:i/10,preset:event.preset});}return events;}
test('seeded scheduler varies intervals/origins, proximity weights, cooldowns and quiet gaps',()=>{
 const distant=sample(50),uneasy=sample(30),near=sample(12);assert.deepEqual(near,sample(12));assert.notDeepEqual(near,sample(12,446));
 assert.ok(near.length>distant.length);assert.ok(uneasy.some(e=>e.preset==='ghost_evil_laugh'));assert.ok(near.some(e=>e.preset==='ghost_sudden_scream'));
 assert.ok(distant.every(e=>!['ghost_evil_laugh','ghost_sudden_scream'].includes(e.preset)));
 for(let i=1;i<near.length;i++){assert.ok(near[i].time-near[i-1].time>=6.5);assert.notEqual(near[i].preset,near[i-1].preset);}
 for(const [preset,gap] of [['ghost_evil_laugh',24],['ghost_sudden_scream',50]] as const){const events=near.filter(e=>e.preset===preset);for(let i=1;i<events.length;i++)assert.ok(events[i].time-events[i-1].time>=gap-.01);}
 const scheduler=new GhostAudioEventScheduler(3),origins=[{id:'a'},{id:'b'},{id:'c'}];let previous='';for(let i=0;i<30;i++){const origin=scheduler.chooseOrigin(origins)!;assert.notEqual(origin.id,previous);previous=origin.id;}
});
test('no events during daytime, outside zone or overlap cap; ghost activity never gates environmental sounds',()=>{
 for(const [distance,enabled,voices,busy] of [[70,true,0,false],[30,false,0,false],[30,true,2,false]] as const){
  const scheduler=new GhostAudioEventScheduler();for(let i=0;i<1000;i++)assert.equal(scheduler.tick(.1,distance,enabled,voices,busy),null);
 }
 const independent=new GhostAudioEventScheduler();let count=0;for(let i=0;i<1000;i++)if(independent.tick(.1,5,true,0,true))count++;assert.ok(count>0);
 const scheduler=new GhostAudioEventScheduler();for(let i=0;i<100;i++)scheduler.tick(.1,30,false,0);assert.equal(scheduler.tick(1000,30,true,0),null);
});
test('warehouse/tree sources match authored Area 5 geometry and skip edited sources',()=>{
 const origins=warehouseSoundOrigins(area5.warehouses,area5.trees,GHOST_WAREHOUSE_ANCHOR);
 assert.ok(origins.some(p=>p.kind==='warehouse'));assert.ok(origins.some(p=>p.kind==='tree'));
 for(const origin of origins){
  if(origin.kind==='tree'){const tree=area5.trees.find(t=>t.id===origin.sourceId)!;assert.equal(origin.x,tree.x);assert.equal(origin.z,tree.z);}
  else {const w=area5.warehouses.find(w=>w.id===origin.sourceId)!,dx=origin.x-w.x,dz=origin.z-w.z;
   assert.ok(Math.abs(Math.abs(Math.cos(w.rotation)*dx-Math.sin(w.rotation)*dz)-w.width/2)<1e-8);
   assert.ok(Math.abs(Math.sin(w.rotation)*dx+Math.cos(w.rotation)*dz-w.depth*.2)<1e-8);
  }
 }
 const skip=origins[0].sourceId;assert.ok(warehouseSoundOrigins(area5.warehouses,area5.trees,GHOST_WAREHOUSE_ANCHOR,id=>id===skip).every(p=>p.sourceId!==skip));
 assert.equal(warehouseOccluded(-10,0,10,0,[{id:'wall',x:0,z:0,width:2,depth:4,rotation:Math.PI/4}]),true);
 assert.equal(warehouseOccluded(-10,20,10,20,[{id:'wall',x:0,z:0,width:2,depth:4,rotation:Math.PI/4}]),false);
 assert.equal(origins.filter(p=>p.kind==='warehouse').length,area5.warehouses.length*2,'all 8 Area 5 warehouses expose spatial wall origins');
});

test('Warehouse Row zone boundary covers all 8 buildings, falls back to 60m anchor, and respects manual time overrides',()=>{
 assert.equal(isGhostNightActive(1260,{timeMode:'day'}),false,'manual day overrides night minute');
 assert.equal(isGhostNightActive(1260,{timeMode:'morning'}),false,'manual morning overrides night minute');
 assert.equal(isGhostNightActive(1260,{timeMode:'evening'}),false,'manual evening overrides night minute');
 assert.equal(isGhostNightActive(780,{timeMode:'night'}),true,'manual night overrides day minute');
 for(const w of area5.warehouses){
  const d=warehouseZoneDistance(w.x,w.z,GHOST_WAREHOUSE_ANCHOR,area5.warehouses);
  assert.ok(d<=45,`warehouse ${w.id} sits inside full-gain zone (${d.toFixed(1)}m)`);
 }
 const homeDist=warehouseZoneDistance(PLAYER_HOME_REFERENCE.x,PLAYER_HOME_REFERENCE.z,GHOST_WAREHOUSE_ANCHOR,area5.warehouses);
 assert.ok(homeDist>150,'player home remains well outside warehouse horror zone');
 const north=area5.warehouses[0];
 assert.ok(warehouseZoneDistance(north.x,north.z,GHOST_WAREHOUSE_ANCHOR,[])>60,'without geometry fallback uses 60m anchor radius');
});

test('scheduler produces all 7 horror sound categories with variation and procedural modules have no external audio URLs',()=>{
 const nearEvents=sample(12,777);
 const seen=new Set(nearEvents.map(e=>e.preset));
 for(const required of ['ghost_evil_laugh','warehouse_creak','wood_crack','metal_knock','ghost_footsteps','ghost_whisper','warehouse_scrape'] as const){
  assert.ok(seen.has(required),`scheduler emits ${required}`);
 }
 const s=new GhostAudioEventScheduler(123);
 const variations=Array.from({length:12},()=>s.variation());
 assert.ok(new Set(variations.map(v=>v.pitch)).size>1,'pitch is randomized');
 assert.ok(new Set(variations.map(v=>v.volume)).size>1,'volume is randomized');
 assert.ok(variations.every(v=>v.pitch>=.85&&v.pitch<=1.15&&v.volume>=.65&&v.volume<=1));
 const root=resolve(import.meta.dirname,'..');
 for(const rel of ['src/game/gameAudio.ts','src/game/ghostAudio.ts','src/game/ambientAudio.ts','src/game/audio/WarehouseAmbientBed.ts','src/game/audio/GhostAudioEventScheduler.ts','src/game/audio/GhostSpatialAudioController.ts','src/components/HauntedWarehouseAudioZone.tsx']){
  const code=readFileSync(resolve(root,rel),'utf8');
  assert.equal(/\.(mp3|wav|ogg|aac|flac|m4a)\b/i.test(code),false,`${rel} uses no external audio files`);
  assert.equal(/\bfetch\s*\(/i.test(code),false,`${rel} makes no network fetches`);
 }
});

test('warehouse horror audio plays only during night ghost hours while ghosts are still present',()=>{
 const base={enabled:true,soundEnabled:true,soundVolume:0.8,paused:false,hasLivingGhosts:true};
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:780,timeMode:'auto'}),false,'silent during auto daytime (13:00)');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:540,timeMode:'morning'}),false,'silent during manual morning');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:780,timeMode:'day'}),false,'silent during manual day');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:1050,timeMode:'evening'}),false,'silent during manual evening');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:1260,timeMode:'day'}),false,'manual day silences even night minute');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:1260,timeMode:'auto'}),true,'active during auto night (21:00) with living ghosts');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:120,timeMode:'auto'}),true,'active during late auto night (02:00) with living ghosts');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:780,timeMode:'night'}),true,'active during manual night with living ghosts');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:1260,timeMode:'night',hasLivingGhosts:false}),false,'silent at night once all ghosts are defeated');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:780,timeMode:'day',forceActive:true}),true,'respects dev forceActive override while ghosts are alive');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:1260,timeMode:'night',paused:true}),false,'silent while paused');
 assert.equal(isWarehouseHorrorAudioActive({...base,minute:1260,timeMode:'night',soundEnabled:false}),false,'silent when sound is disabled');
});
