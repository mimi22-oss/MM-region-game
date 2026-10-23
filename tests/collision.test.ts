import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canStand,move } from '../src/game/collision.ts';
import { ward,toWorld,pitchLanes,oppositeLanes,residentialRows,tharSiVillage } from '../src/data/ward.ts';
test('Myothar inventory and safe AH1 spawn',()=>{assert.equal(ward.houses.length,98);assert.equal(ward.roads.length,18);assert.equal(ward.fields.length,2);assert.ok(canStand(ward.spawn.x,ward.spawn.z));for(let v=-120;v<=120;v+=2){const p=toWorld(0,v);assert.ok(canStand(p.x,p.z),'AH1 is walkable')}});
test('every rotated house and trunk blocks walking',()=>{for(const h of ward.houses)assert.equal(canStand(h.x,h.z),false);for(const t of ward.trees)assert.equal(canStand(t.x,t.z),false);assert.equal(canStand(ward.size/2,0),false);assert.equal(canStand(NaN,0),false)});
test('large movement cannot tunnel through rotated building',()=>{const h=ward.houses[0];const start=toWorld(-66,-110);assert.ok(canStand(start.x,start.z));move(start,h.x-start.x,h.z-start.z);assert.ok(canStand(start.x,start.z));assert.ok(Math.hypot(start.x-h.x,start.z-h.z)>4)});
test('movement respects expanded ward bounds',()=>{const p={x:0,z:0};move(p,0,ward.size);assert.ok(p.z<=ward.size/2-0.4);assert.ok(canStand(p.x,p.z))});

test('warehouses block entry and pitch stays clear',()=>{
 assert.equal(ward.warehouses.length,8);
 for(const w of ward.warehouses)assert.equal(canStand(w.x,w.z),false);
 for(let u=68;u<=124;u+=4)for(let v=-46;v<=46;v+=4){const p=toWorld(u,v);assert.ok(canStand(p.x,p.z),'pitch must be walkable')}
 for(const u of [-77,-99])for(let v=-110;v<=110;v+=2){const p=toWorld(u,v);assert.ok(canStand(p.x,p.z),'neighborhood lane must be clear')}
});

test('canal crossings and monastery footprints',()=>{
 const water=toWorld(-54,0);assert.equal(canStand(water.x,water.z),false);
 for(const localV of ward.canal.bridges){const v=localV+ward.canal.v;const p=toWorld(-54,v);assert.ok(canStand(p.x,p.z));const start=toWorld(-60,v),end=toWorld(-48,v);move(start,end.x-start.x,end.z-start.z);assert.ok(Math.hypot(start.x-end.x,start.z-end.z)<0.1)}
 const m=ward.monastery,c=Math.cos(m.rotation),s=Math.sin(m.rotation);
 for(const b of m.buildings){assert.equal(canStand(m.x+b.u*c+b.v*s,m.z-b.u*s+b.v*c),false)}
 const yard=toWorld(205,46);assert.ok(canStand(yard.x,yard.z));
});

test('pitch and large open ground separate warehouses from monastery',()=>{
 const localU=(p:{x:number;z:number})=>p.x*Math.cos(ward.monastery.rotation)-p.z*Math.sin(ward.monastery.rotation);
 const warehouseBack=Math.max(...ward.warehouses.map(w=>localU(w)+w.width/2));
 const monasteryFront=localU(ward.monastery)-ward.monastery.width/2;
 for(const area of [ward.pitch,ward.openGround]){
  assert.ok(localU(area)-area.width/2>warehouseBack);
  assert.ok(localU(area)+area.width/2<monasteryFront);
  for(let u=-area.width/2+2;u<area.width/2;u+=8)for(let v=-area.depth/2+2;v<area.depth/2;v+=8){const c=Math.cos(area.rotation),s=Math.sin(area.rotation);assert.ok(canStand(area.x+u*c+v*s,area.z-u*s+v*c))}
 }
});


test('five pitch-side lanes, two rows per block, four opposite lanes',()=>{
 assert.equal(pitchLanes.length,5);assert.equal(oppositeLanes.length,4);
 const local=(h:{x:number;z:number})=>({u:(h.x-h.z)/Math.sqrt(2),v:(h.x+h.z)/Math.sqrt(2)});
 for(let i=0;i<4;i++){
  const homes=ward.houses.map(local).filter(h=>h.u>10&&h.u<145&&h.v>pitchLanes[i]+1&&h.v<pitchLanes[i+1]-1);
  assert.equal(homes.length,12);assert.equal(new Set(homes.map(h=>Math.round(h.v))).size,2);
 }
 for(const r of ward.roads.filter(r=>r.id.startsWith('pitch-lane-')||r.id.startsWith('opposite-lane-')||r.id==='pitch-monastery-lane')){
  for(let a=-r.width/2+1;a<r.width/2;a+=2)for(let b=-r.depth/2+1;b<r.depth/2;b+=2){const c=Math.cos(r.rotation),s=Math.sin(r.rotation);assert.ok(canStand(r.x+a*c+b*s,r.z-a*s+b*c),r.id+' must be walkable')}
 }
});

test('exactly two continuous drains connect the residential lanes',()=>{
 assert.equal(1+ward.drains.length,2);
 for(const c of [ward.canal,...ward.drains]){assert.ok(c.v-c.depth/2<oppositeLanes[0]);assert.ok(c.v+c.depth/2>oppositeLanes.at(-1)!)}
 for(const v of [140,170,210,270]){const p=toWorld(-34,v);assert.ok(canStand(p.x,p.z),'removed extra drain should be dry ground')}
 for(const u of [-54,-160])for(const v of [140,170,278]){const p=toWorld(u,v);assert.equal(canStand(p.x,p.z),false)}
 for(const v of oppositeLanes)for(const u of [-54,-160]){const p=toWorld(u,v);assert.ok(canStand(p.x,p.z))}
 const join=toWorld(-54,123);assert.equal(canStand(join.x,join.z),false);
 assert.equal(canStand(ward.pond.x,ward.pond.z),false);
});


test('front lot, canal, home, farm, pond, rear canal and home follow requested order',()=>{
 const u=(p:{x:number;z:number})=>(p.x-p.z)/Math.sqrt(2);
 const front=ward.houses.find(h=>h.name==='လမ်းသွယ် ၂ · စိုက်ခင်းအိမ်')!;
 const rear=ward.houses.find(h=>h.name==='လမ်းသွယ် ၂ · မြောင်းနောက်အိမ်')!;
 const sequence=[0,u(ward.frontLot),-54,u(front),u(ward.farm),u(ward.pond),-160,u(rear)];
 for(let i=1;i<sequence.length;i++)assert.ok(sequence[i]<sequence[i-1]);
 for(let x=-46;x<=-12;x+=2){const p=toWorld(x,270);assert.ok(canStand(p.x,p.z),'front lot should stay clear')}
 for(const x of [-54,-160]){const p=toWorld(x,278);assert.equal(canStand(p.x,p.z),false)}
});


test('farmhouse north/south rows and ownership are separated by lanes',()=>{
 const centerV=(p:{x:number;z:number})=>(p.x+p.z)/Math.sqrt(2);
 const farmhouse=ward.houses.find(h=>h.name==='လမ်းသွယ် ၂ · စိုက်ခင်းအိမ်')!;
 assert.deepEqual(Object.values(residentialRows).map(rows=>rows.length),[3,3,1,3]);
 assert.ok(oppositeLanes[0]<residentialRows.northFar[0]);
 assert.ok(residentialRows.northFar.at(-1)!<oppositeLanes[1]);
 assert.ok(oppositeLanes[1]<residentialRows.northNear[0]);
 assert.ok(residentialRows.northNear.at(-1)!<centerV(farmhouse));
 assert.ok(centerV(farmhouse)<residentialRows.southNear[0]);
 assert.ok(residentialRows.southNear[0]<oppositeLanes[2]);
 assert.ok(oppositeLanes[2]<residentialRows.southFar[0]);
 for(const [group,rows] of Object.entries(residentialRows))for(const v of rows){const homes=ward.houses.filter(h=>h.name.startsWith(group)&&Math.abs(centerV(h)-v)<0.01);assert.equal(homes.length,group==='northNear'&&v!==residentialRows.northNear[0]?1:2)}
 const p=ward.farmNorthLand;assert.equal(p.owner,'စိုက်ခင်းအိမ်ပိုင် မြေ');assert.ok(canStand(p.x,p.z));
});


test('farmhouse entrance bridge connects the road through the empty lot',()=>{
 const start=toWorld(0,270),end=toWorld(-63,270);
 move(start,end.x-start.x,end.z-start.z);
 assert.ok(Math.hypot(start.x-end.x,start.z-end.z)<0.1);
 for(const v of [266,274]){const p=toWorld(-54,v);assert.equal(canStand(p.x,p.z),false)}
});

test('eastern rows face AH1 and cross-drain joins both north-south canals',()=>{
 assert.equal(ward.houses.filter(h=>h.name.startsWith('အရှေ့တန်း ၁')).length,4);
 assert.equal(ward.houses.filter(h=>h.name.startsWith('အရှေ့တန်း ၂')).length,1);
 for(const h of ward.houses.filter(h=>(h.x-h.z)/Math.sqrt(2)>0))assert.ok(Math.abs(h.rotation-(ward.crossCanal.rotation-Math.PI/2))<0.001);
 for(const u of [-160,-54,20,80]){const p=toWorld(u,u<0?ward.crossCanal.junctionV:ward.crossCanal.v);assert.equal(canStand(p.x,p.z),false)}
 const start=toWorld(0,260),end=toWorld(0,304);move(start,end.x-start.x,end.z-start.z);assert.ok(Math.hypot(start.x-end.x,start.z-end.z)<0.1);
 const tree=ward.largeTrees.find(t=>t.id==='east-row-canal-tree')!;assert.equal(canStand(tree.x,tree.z),false);
});

test('cross-drain bends south, clears farmland and preserves the southern lane',()=>{
 for(const u of [-102,-120,-140]){const p=toWorld(u,282);assert.ok(canStand(p.x,p.z),'old farm crossing is dry')}
 assert.ok(ward.crossCanal.junctionV>Math.max(...residentialRows.southFar));
 for(const [u,v] of [[-9,300],[-9,340],[-12,372],[-100,376]]){const p=toWorld(u,v);assert.equal(canStand(p.x,p.z),false)}
 const start=toWorld(-18,310),end=toWorld(0,310);move(start,end.x-start.x,end.z-start.z);assert.ok(Math.hypot(start.x-end.x,start.z-end.z)<0.1);
});

test('rice mill compound has clear road frontage, two paddy rows and solid buildings',()=>{
 const m=ward.riceMill;
 assert.equal(m.buildings.length,2);assert.equal(m.fields.length,2);
 for(const b of m.buildings)assert.equal(canStand(b.x,b.z),false);
 for(const p of [m.yard,...m.paths,...m.fields]){
  for(let u=-p.width/2+2;u<p.width/2;u+=3)for(let v=-p.depth/2+2;v<p.depth/2;v+=3){const c=Math.cos(p.rotation),s=Math.sin(p.rotation);assert.ok(canStand(p.x+u*c+v*s,p.z-u*s+v*c),'compound open space stays walkable')}
 }
 const local=(p:{x:number;z:number})=>({u:(p.x-p.z)/Math.sqrt(2),v:(p.x+p.z)/Math.sqrt(2)});
 assert.ok(local(m.yard).u+m.yard.width/2<local(m.buildings[0]).u-m.buildings[0].width/2);
 const rows=ward.houses.filter(h=>h.name.startsWith('ဆန်စက်ဘေး')).map(local).sort((a,b)=>a.v-b.v);
 assert.equal(rows.length,2);
 for(const f of m.fields){assert.ok(local(f).v-f.depth/2>rows[0].v+7);assert.ok(local(f).v+f.depth/2<rows[1].v-7)}
 for(const b of m.buildings)for(const u of [-b.width/2,b.width/2])for(const v of [-b.depth/2,b.depth/2]){const c=Math.cos(b.rotation),s=Math.sin(b.rotation);assert.ok(Math.abs(b.x+u*c+v*s)<ward.size/2&&Math.abs(b.z-u*s+v*c)<ward.size/2)}
});

test('five western plots extend behind the rear home with northern and southern fields',()=>{
 const center=ward.westernFields.filter(f=>f.row===0);assert.equal(center.length,5);
 for(const row of [0,1,2])assert.equal(ward.westernFields.filter(f=>f.row===row).length,5);
 for(const f of ward.westernFields){assert.ok(f.u+f.width/2<-190);assert.ok(canStand(f.x,f.z));for(const u of [-f.width/2,f.width/2])for(const v of [-f.depth/2,f.depth/2]){const p=toWorld(f.u+u,f.v+v);assert.ok(Math.abs(p.x)<ward.size/2&&Math.abs(p.z)<ward.size/2)}}
 for(const m of ward.mountains){assert.ok(m.u+m.radius<Math.min(...center.map(f=>f.u-f.width/2)));assert.ok(m.height>100);assert.equal(canStand(m.x,m.z),false);assert.ok(Math.abs(m.x)+m.radius<ward.size/2&&Math.abs(m.z)+m.radius<ward.size/2)}
});

test('thirty southern paddies lead to Weipula, with an AH1 pass and connected western ridge',()=>{
 assert.equal(ward.southernFields.length,30);
 for(const f of ward.southernFields){assert.ok(f.v-f.depth/2>401);assert.ok(canStand(f.x,f.z));for(const u of [-f.width/2,f.width/2])for(const v of [-f.depth/2,f.depth/2]){const p=toWorld(f.u+u,f.v+v);assert.ok(canStand(p.x,p.z))}}
 assert.ok(Math.max(...ward.weipula.peaks.map(m=>m.height))>4*Math.max(...ward.mountains.map(m=>m.height)));
 for(const m of ward.weipula.peaks){assert.equal(canStand(m.x,m.z),false);assert.ok(Math.abs(m.x)+m.radius<ward.size/2);assert.ok(Math.abs(m.z)+m.radius<ward.size/2)}
 for(let v=400;v<=1290;v+=2)for(const u of [-5,0,5]){const p=toWorld(u,v);assert.ok(canStand(p.x,p.z),'AH1 pass stays open')}
 const all=[...ward.mountains,...ward.weipula.peaks.filter(m=>m.u<0)];const reached=new Set([0]);let added=true;
 while(added){added=false;for(let i=0;i<all.length;i++)if(!reached.has(i)&&[...reached].some(j=>Math.hypot(all[i].x-all[j].x,all[i].z-all[j].z)<all[i].radius+all[j].radius)){reached.add(i);added=true}}
 assert.equal(reached.size,all.length,'western range joins Weipula');
});


test('Thar Si village sits between Myothar Area 5 and Weipula with walkable lanes and solid homes',()=>{
 assert.equal(tharSiVillage.name,'သာစည်ရွာ');
 assert.equal(tharSiVillage.houses.length,54);
 const localV=(p:{x:number;z:number})=>(p.x+p.z)/Math.sqrt(2);
 const area5South=Math.max(...ward.houses.map(localV));
 const weipulaNorth=Math.min(...ward.weipula.peaks.filter(m=>Math.abs(m.u)<400).map(m=>m.v-m.radius));
 for(const h of tharSiVillage.houses){
  assert.ok(localV(h)>area5South,'Thar Si house is south of Myothar Area 5');
  assert.ok(localV(h)<weipulaNorth,'Thar Si house is north of Weipula');
  assert.equal(canStand(h.x,h.z),false,'Thar Si house blocks walking');
 }
 for(const t of [...tharSiVillage.trees,...tharSiVillage.largeTrees,...tharSiVillage.farmTrees]){
  assert.equal(canStand(t.x,t.z),false,'Thar Si tree trunk blocks walking');
 }
 for(const r of tharSiVillage.roads){
  assert.ok(canStand(r.x,r.z),`${r.id} center is walkable`);
 }
 for(const f of [...tharSiVillage.fields,...tharSiVillage.bundedFields]){
  assert.ok(canStand(f.x,f.z),'Thar Si field is walkable');
 }
});


test('6 paddy fields and east-west canal separate Myothar Area 5 from Thar Si village',()=>{
 assert.equal(tharSiVillage.separationFields.length,6);
 const localV=(p:{x:number;z:number})=>(p.x+p.z)/Math.sqrt(2);
 const area5South=Math.max(...ward.houses.map(localV));
 const canalV=tharSiVillage.canal.v;
 for(const f of tharSiVillage.separationFields){
  assert.ok(localV(f)>area5South,'separation paddy is south of Myothar Area 5');
  assert.ok(localV(f)+f.depth/2<canalV,'separation paddy is north of east-west canal');
  assert.ok(canStand(f.x,f.z),'separation paddy is walkable');
 }
 for(const u of [-80,-30,30,80]){
  const water=toWorld(u,canalV);
  assert.equal(canStand(water.x,water.z),false,'east-west canal water blocks walking');
 }
 const bridge=toWorld(0,canalV);
 assert.ok(canStand(bridge.x,bridge.z),'AH1 bridge over east-west canal is walkable');
 for(const h of tharSiVillage.houses){
  assert.ok(localV(h)>canalV,'Thar Si house is south of east-west canal');
 }
});


test('winding canal connects Myothar Area 5 junction around paddies to western tip of Thar Si canal',()=>{
 const wc=tharSiVillage.connectingCanal;
 const ew=tharSiVillage.canal;
 assert.deepEqual(wc.points[0],[-160,388]);
 assert.deepEqual(wc.points.at(-1),[ew.uMin,ew.v]);
 const westFieldEdge=Math.min(...tharSiVillage.separationFields.map(f=>f.u!-f.width/2));
 for(const [u,v] of wc.points){
  assert.ok(u<westFieldEdge,'winding canal stays west of separation paddies');
  const p=toWorld(u,v);
  assert.equal(canStand(p.x,p.z),false,'winding canal water blocks walking');
 }
});
