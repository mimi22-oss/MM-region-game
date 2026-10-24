import { updateHomeAccess } from '../src/game/homeAccess.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canStand,move } from '../src/game/collision.ts';
import { mangoTrees, MANGO_START_GEO, MANGO_END_GEO, orchardMangoTrees, standaloneMangoTree } from '../src/data/mangoTrees.ts';
import { tamarindTrees } from '../src/data/tamarindTrees.ts';
import { uShweHouse, KALAY_SIGN_HOUSE_ID, kalaySignHouse } from '../src/data/ward.ts';
import { KALAY_SIGN_ROTATION, KALAY_SIGN_BEARING } from '../src/data/kalaySignboard.ts';
import { MOTORCYCLE_X, MOTORCYCLE_Z, MOTORCYCLE_YAW } from '../src/data/motorcycle.ts';
import { robotLocation } from '../src/game/robotLocation.ts';
import { ward,angle,toWorld,pitchLanes,oppositeLanes,residentialRows,tharSiVillage,chinSaiVillage,zingalinVillage,htomarVillage,htomarFiveColumnFields,htomarRoadsideShops,tharYarGoneVillage,htaukKyantVillage,allHtaukKyantPonds,htaukKyantLandmarks,kyarInnVillage,kyarInnTaphiChaung,kyarInnLandmarks,kyarInnLandmarkBuildings,kyarInnLakePonds,kyarInnLakeIsland,kyarInnLakeStructures } from '../src/data/ward.ts';
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
 for(let i=0;i<1400;i++){updateHomeAccess(start.x,start.z,1/60);const dx=end.x-start.x,dz=end.z-start.z,d=Math.hypot(dx,dz);if(d<.05)break;move(start,dx/d*Math.min(.2,d),dz/d*Math.min(.2,d));}
 assert.ok(Math.hypot(start.x-end.x,start.z-end.z)<0.1);
 for(const v of [266,274]){const p=toWorld(-54,v);assert.equal(canStand(p.x,p.z),false)}
});

test('character can enter walk-in farmhouse through front door and explore interior rooms and left kitchen annex',()=>{
 const fh=ward.houses.find(h=>h.name==='လမ်းသွယ် ၂ · စိုက်ခင်းအိမ်')!;
 const c=Math.cos(fh.rotation),s=Math.sin(fh.rotation);
 const toFh=(lx:number,lz:number)=>({x:fh.x+lx*c+lz*s,z:fh.z-lx*s+lz*c});

 // Porch and front door entry facing main road approach
 const porch=toFh(0,6.2);
 assert.ok(canStand(porch.x,porch.z),'front porch is walkable');
 const door=toFh(0,5.0);
 updateHomeAccess(1e5,1e5,10);
 assert.equal(canStand(door.x,door.z),false,'door is initially closed');
 updateHomeAccess(porch.x,porch.z,.01);
 updateHomeAccess(porch.x,porch.z,3);
 updateHomeAccess(porch.x,porch.z,1);
 assert.ok(canStand(door.x,door.z),'front doorway is walkable');
 const livingRoom=toFh(0,3.8);
 assert.ok(canStand(livingRoom.x,livingRoom.z),'living room entrance is walkable');

 // Walk through door from porch to living room
 const pos={...porch};
 move(pos,livingRoom.x-porch.x,livingRoom.z-porch.z);
 assert.ok(Math.hypot(pos.x-livingRoom.x,pos.z-livingRoom.z)<0.15,'can walk straight through front door');

 // Interior rooms and house-sized kitchen annex are walkable
 const kitchen=toFh(10.0,1.5);
 assert.ok(canStand(kitchen.x,kitchen.z),'house-sized left kitchen annex is walkable');
 const yard=toFh(16.5,0);
 assert.ok(canStand(yard.x,yard.z),'yard between kitchen and wire fence is walkable');
 const bedroom=toFh(-2.0,-2.5);
 assert.ok(canStand(bedroom.x,bedroom.z),'bedroom floor is walkable');
 const deskChair=toFh(-2.5,2.2);
 assert.ok(canStand(deskChair.x,deskChair.z),'computer desk chair space is walkable');

 // Furniture, outer walls, and compound wire mesh fences block walking
 const centerTable=toFh(0,0);
 assert.equal(canStand(centerTable.x,centerTable.z),false,'center dining table blocks walking');
 const bed=toFh(-4.5,-2.5);
 assert.equal(canStand(bed.x,bed.z),false,'bed blocks walking');
 const backWall=toFh(0,-5.0);
 assert.equal(canStand(backWall.x,backWall.z),false,'back wall blocks walking');
 const rightWall=toFh(-6.0,0);
 assert.equal(canStand(rightWall.x,rightWall.z),false,'right wall blocks walking');
 const kitchenLeftWall=toFh(15.0,0);
 assert.equal(canStand(kitchenLeftWall.x,kitchenLeftWall.z),false,'kitchen left wall blocks walking');
 const leftWireFence=toFh(18.0,0);
 assert.equal(canStand(leftWireFence.x,leftWireFence.z),false,'left wire mesh fence blocks walking');
 const rightWireFence=toFh(-9.0,0);
 assert.equal(canStand(rightWireFence.x,rightWireFence.z),false,'right wire mesh fence blocks walking');
 const backWireFence=toFh(0,-7.5);
 assert.equal(canStand(backWireFence.x,backWireFence.z),false,'back wire mesh fence blocks walking');
});

test('character can enter two-room toilet block facing North with western commode and traditional squat cubicles',()=>{
 const toiletPos={x:130.464,z:277.362};
 const tRot=angle+Math.PI;
 const tC=Math.cos(tRot),tS=Math.sin(tRot);
 const toToilet=(lx:number,lz:number)=>({x:toiletPos.x+lx*tC+lz*tS,z:toiletPos.z-lx*tS+lz*tC});

 // North entrance approach for both cubicles
 // Room 1 (West / Left): Traditional Squat toilet
 const frontRoom1=toToilet(-0.8,1.6);
 assert.ok(canStand(frontRoom1.x,frontRoom1.z),'outside North door of Room 1 is walkable');
 const door1=toToilet(-0.8,1.0);
 assert.ok(canStand(door1.x,door1.z),'Room 1 doorway is walkable');
 const insideRoom1=toToilet(-0.7,0.2);
 assert.ok(canStand(insideRoom1.x,insideRoom1.z),'Room 1 Squat toilet standing area is walkable');

 // Walk from outside into Room 1 (Squat Room)
 const pos1={...frontRoom1};
 move(pos1,insideRoom1.x-frontRoom1.x,insideRoom1.z-frontRoom1.z);
 assert.ok(Math.hypot(pos1.x-insideRoom1.x,pos1.z-insideRoom1.z)<0.15,'can walk through North door into Room 1');

 // Room 2 (East / Right): Western Sitting toilet
 const frontRoom2=toToilet(0.8,1.6);
 assert.ok(canStand(frontRoom2.x,frontRoom2.z),'outside North door of Room 2 is walkable');
 const door2=toToilet(0.8,1.0);
 assert.ok(canStand(door2.x,door2.z),'Room 2 doorway is walkable');
 const insideRoom2=toToilet(0.8,0.2);
 assert.ok(canStand(insideRoom2.x,insideRoom2.z),'Room 2 Western toilet standing area is walkable');

 // Walk from outside into Room 2 (Western Room)
 const pos2={...frontRoom2};
 move(pos2,insideRoom2.x-frontRoom2.x,insideRoom2.z-frontRoom2.z);
 assert.ok(Math.hypot(pos2.x-insideRoom2.x,pos2.z-insideRoom2.z)<0.15,'can walk through North door into Room 2');

 // Walls and fixtures block walking
 const backWall=toToilet(0,-1.0);
 assert.equal(canStand(backWall.x,backWall.z),false,'back wall blocks walking');
 const centerWall=toToilet(0,0);
 assert.equal(canStand(centerWall.x,centerWall.z),false,'center dividing wall blocks walking');
 const leftOuterWall=toToilet(-1.6,0);
 assert.equal(canStand(leftOuterWall.x,leftOuterWall.z),false,'left outer wall blocks walking');
 const rightOuterWall=toToilet(1.6,0);
 assert.equal(canStand(rightOuterWall.x,rightOuterWall.z),false,'right outer wall blocks walking');
 const waterTub=toToilet(-1.25,-0.6);
 assert.equal(canStand(waterTub.x,waterTub.z),false,'masonry water tub in Room 1 blocks walking');
 const commode=toToilet(0.8,-0.7);
 assert.equal(canStand(commode.x,commode.z),false,'Western commode fixture in Room 2 blocks walking');
});

test('mango orchard trees sit between specified coordinates and their trunks block walking',()=>{
 assert.ok(mangoTrees.length >= 6, 'mango orchard has planted trees');
 const minLat = Math.min(MANGO_START_GEO.lat, MANGO_END_GEO.lat);
 const maxLat = Math.max(MANGO_START_GEO.lat, MANGO_END_GEO.lat);
 const minLng = Math.min(MANGO_START_GEO.lng, MANGO_END_GEO.lng);
 const maxLng = Math.max(MANGO_START_GEO.lng, MANGO_END_GEO.lng);

 for (const t of orchardMangoTrees) {
  const loc = robotLocation(t.x, t.z, 0);
  assert.ok(loc.latitude >= minLat - 0.0001 && loc.latitude <= maxLat + 0.0001, 'tree latitude is within requested range');
  assert.ok(loc.longitude >= minLng - 0.0001 && loc.longitude <= maxLng + 0.0001, 'tree longitude is within requested range');
  assert.equal(canStand(t.x, t.z), false, 'mango tree trunk blocks walking');
  assert.ok(canStand(t.x + 1.2, t.z) || canStand(t.x, t.z + 1.2), 'space around mango tree is walkable');
 }
});

test('standalone mango tree sits at requested location (145.761, 267.264) and its trunk blocks walking',()=>{
 const t = standaloneMangoTree;
 assert.equal(canStand(t.x, t.z), false, 'standalone mango tree trunk blocks walking');
 assert.ok(canStand(t.x + 1.2, t.z) || canStand(t.x, t.z + 1.2), 'space around standalone mango tree is walkable');
 const loc = robotLocation(t.x, t.z, -1.097435);
 assert.ok(Math.abs(loc.latitude - 23.1609864) < 0.0001, 'tree latitude matches request');
 assert.ok(Math.abs(loc.longitude - 94.0460003) < 0.0001, 'tree longitude matches request');
});

test('tamarind trees sit at requested coordinates and their trunks block walking',()=>{
 assert.equal(tamarindTrees.length, 3, 'three tamarind trees planted in row');
 for (const t of tamarindTrees) {
  assert.equal(canStand(t.x, t.z), false, 'tamarind tree trunk blocks walking');
  assert.ok(canStand(t.x + 1.2, t.z) || canStand(t.x, t.z + 1.2), 'space around tamarind tree is walkable');
  const loc = robotLocation(t.x, t.z, 0);
  assert.ok(Math.abs(loc.latitude - t.lat) < 0.0001, 'tree latitude matches request');
  assert.ok(Math.abs(loc.longitude - t.lng) < 0.0001, 'tree longitude matches request');
 }
});

test('regular tree sits at requested location (194.157, 205.428) and its trunk blocks walking',()=>{
 const t = ward.largeTrees.find(t => t.id === 'cross-canal-verge-tree')!;
 assert.ok(t, 'tree exists in ward.largeTrees');
 assert.equal(canStand(t.x, t.z), false, 'regular tree trunk blocks walking');
 assert.ok(canStand(t.x, t.z - 1.2), 'space around tree is walkable');
 const loc = robotLocation(t.x, t.z, -1.442213);
 assert.ok(Math.abs(loc.latitude - 23.1610718) < 0.0001, 'tree latitude matches request');
 assert.ok(Math.abs(loc.longitude - 94.0467619) < 0.0001, 'tree longitude matches request');
});

test('U Shwe house and snack shop blocks building and counter while customer shop area is walkable',()=>{
 assert.ok(uShweHouse, 'U Shwe house exists');
 assert.ok(uShweHouse.name.includes('ဦးရွှေအိမ်'), 'house named U Shwe house');

 // 1. Inside main building is blocked
 assert.equal(canStand(uShweHouse.x, uShweHouse.z), false, 'main house building blocks walking');

 // 2. Snack counter blocks walking
 const rot = uShweHouse.rotation;
 const c = Math.cos(rot), s = Math.sin(rot);
 const counterWorld = {
  x: uShweHouse.x + (-2.4) * c + 5.75 * s,
  z: uShweHouse.z - (-2.4) * s + 5.75 * c
 };
 assert.equal(canStand(counterWorld.x, counterWorld.z), false, 'snack counter blocks walking');

 // 3. Customer ordering space in front of counter is walkable
 const customerWorld = {
  x: uShweHouse.x + (-2.4) * c + 6.6 * s,
  z: uShweHouse.z - (-2.4) * s + 6.6 * c
 };
 assert.ok(canStand(customerWorld.x, customerWorld.z), 'space in front of snack counter is walkable');

 // 4. Road space where robot stands facing the shop is walkable
 const robotPos = { x: 157.153, z: 181.188 };
 assert.ok(canStand(robotPos.x, robotPos.z), 'robot standing position in front of shop is walkable');
 const loc = robotLocation(robotPos.x, robotPos.z, 2.137380);
 assert.ok(Math.abs(loc.latitude - 23.1614608) < 0.0001, 'latitude matches request');
 assert.ok(Math.abs(loc.longitude - 94.0466737) < 0.0001, 'longitude matches request');
});

test('Kalaymyo signboard landmark replaces house h98 with 3D monument and walkable perimeter',()=>{
 assert.ok(kalaySignHouse, 'Kalay sign house h98 exists in inventory');
 assert.equal(KALAY_SIGN_HOUSE_ID, 'h98');

 // 1. Monument structure blocks walking directly into pillars
 const signPos = { x: 295.571, z: 261.630 };
 assert.equal(canStand(signPos.x, signPos.z), false, 'monument center blocks walking');

 // 2. Robot standing location facing the sign is walkable
 const robotPos = { x: 289.406, z: 266.075 };
 assert.ok(canStand(robotPos.x, robotPos.z), 'robot observation location in front of Kalay sign is walkable');
 const loc = robotLocation(robotPos.x, robotPos.z, 0);
 assert.ok(Math.abs(loc.latitude - 23.1600815) < 0.0001, 'latitude matches request');
 assert.ok(Math.abs(loc.longitude - 94.0470009) < 0.0001, 'longitude matches request');

 // 3. Signboard faces South / 180.0° and pillars stand side-by-side East & West
 assert.ok(Math.abs(KALAY_SIGN_BEARING - 180.0) < 0.1, 'signboard configured to face South 180 deg');
 const fwdX = Math.sin(KALAY_SIGN_ROTATION), fwdZ = Math.cos(KALAY_SIGN_ROTATION);
 const faceYaw = Math.atan2(-fwdX, -fwdZ);
 const faceLoc = robotLocation(signPos.x, signPos.z, faceYaw);
 assert.ok(Math.abs(faceLoc.bearing - 180.0) < 0.1, 'signboard local front direction bearing is 180.0 deg');
 assert.equal(faceLoc.direction, 'South', 'signboard faces South');

 // Verify East pillar (x = +1.65) and West pillar (x = -1.65) stand side-by-side
 const rot = KALAY_SIGN_ROTATION;
 const dxEast = 1.65 * Math.cos(rot), dzEast = 1.65 * (-Math.sin(rot));
 const eastYaw = Math.atan2(-dxEast, -dzEast);
 const eastLoc = robotLocation(signPos.x, signPos.z, eastYaw);
 assert.equal(eastLoc.direction, 'East', 'left pillar (+X) stands on the East side');

 const dxWest = -1.65 * Math.cos(rot), dzWest = -1.65 * (-Math.sin(rot));
 const westYaw = Math.atan2(-dxWest, -dzWest);
 const westLoc = robotLocation(signPos.x, signPos.z, westYaw);
 assert.equal(westLoc.direction, 'West', 'right pillar (-X) stands on the West side');

 // 4. Perimeter space around the monument is walkable
 assert.ok(canStand(signPos.x + 3.6, signPos.z), 'road beside monument is walkable');
 assert.ok(canStand(signPos.x, signPos.z - 3.6), 'lane beside monument is walkable');
});

test('water pump station sits at requested location and pump blocks while splash observation space is walkable',()=>{
 const pumpPos={x:109.721,z:284.313};
 assert.equal(canStand(pumpPos.x,pumpPos.z),false,'pump motor blocks walking');
 const loc=robotLocation(pumpPos.x,pumpPos.z,1.102371);
 assert.ok(Math.abs(loc.latitude-23.1611070)<0.0001,'pump latitude matches request');
 assert.ok(Math.abs(loc.longitude-94.0456336)<0.0001,'pump longitude matches request');

 // Space in front of the flowing water stream is walkable
 const viewPos={x:pumpPos.x+1.1*Math.sin(angle),z:pumpPos.z+1.1*Math.cos(angle)};
 assert.ok(canStand(viewPos.x,viewPos.z),'space watching auto-flowing water is walkable');
 const walkAround={x:pumpPos.x-1.3,z:pumpPos.z};
 assert.ok(canStand(walkAround.x,walkAround.z),'path beside pump platform is walkable');
});

test('classic blue motorcycle sits at requested location and blocks while perimeter is walkable',()=>{
 assert.equal(canStand(MOTORCYCLE_X, MOTORCYCLE_Z), false, 'motorcycle blocks walking');
 const loc = robotLocation(MOTORCYCLE_X, MOTORCYCLE_Z, MOTORCYCLE_YAW);
 assert.ok(Math.abs(loc.latitude - 23.1612262) < 0.0001, 'latitude matches request');
 assert.ok(Math.abs(loc.longitude - 94.0462532) < 0.0001, 'longitude matches request');
 assert.equal(loc.direction, 'East', 'facing matches East (79.1 deg)');
 assert.ok(canStand(MOTORCYCLE_X + 1.2, MOTORCYCLE_Z), 'walking beside motorcycle is clear');
 assert.ok(canStand(MOTORCYCLE_X, MOTORCYCLE_Z - 1.2), 'walking around motorcycle is clear');
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
 assert.equal(tharSiVillage.houses.length,320);
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
 const canalV=tharSiVillage.canal!.v;
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
 const wc=tharSiVillage.connectingCanal!;
 const ew=tharSiVillage.canal!;
 assert.deepEqual(wc.points[0],[-160,388]);
 assert.deepEqual(wc.points.at(-1),[ew.uMin,ew.v]);
 const westFieldEdge=Math.min(...tharSiVillage.separationFields.map(f=>f.u!-f.width/2));
 for(const [u,v] of wc.points){
  assert.ok(u<westFieldEdge,'winding canal stays west of separation paddies');
  const p=toWorld(u,v);
  assert.equal(canStand(p.x,p.z),false,'winding canal water blocks walking');
 }
});


test('Chin Sai village sits between Thar Si village (separated by 3 paddy fields) and Weipula',()=>{
 assert.equal(chinSaiVillage.name,'ချင်းဆိုင်ရွာ');
 assert.equal(chinSaiVillage.separationFields.length,3);
 const localV=(p:{x:number;z:number})=>(p.x+p.z)/Math.sqrt(2);
 const tharSiSouth=Math.max(...tharSiVillage.houses.map(localV));
 const chinSaiNorth=Math.min(...chinSaiVillage.houses.map(localV));
 const weipulaNorth=Math.min(...ward.weipula.peaks.filter(m=>Math.abs(m.u)<400).map(m=>m.v-m.radius));
 for(const f of chinSaiVillage.separationFields){
  assert.ok(localV(f)-f.depth/2>tharSiSouth,'3 separation paddies sit south of Thar Si village');
  assert.ok(localV(f)+f.depth/2<chinSaiNorth,'3 separation paddies sit north of Chin Sai village');
  assert.ok(canStand(f.x,f.z),'separation paddy is walkable');
 }
 for(const h of chinSaiVillage.houses){
  assert.ok(localV(h)>tharSiSouth,'Chin Sai house is south of Thar Si');
  assert.ok(localV(h)<weipulaNorth,'Chin Sai house is north of Weipula');
  assert.equal(canStand(h.x,h.z),false,'Chin Sai house blocks walking');
 }
 for(const t of [...chinSaiVillage.trees,...chinSaiVillage.largeTrees,...chinSaiVillage.farmTrees]){
  assert.equal(canStand(t.x,t.z),false,'Chin Sai tree blocks walking');
 }
 for(const r of chinSaiVillage.roads){
  assert.ok(canStand(r.x,r.z),`${r.id} center is walkable`);
 }
});

test('Zingalin village sits between Chin Sai village and Weipula with walkable lanes and solid homes',()=>{
 assert.equal(zingalinVillage.name,'ဇင်းကလင်းကျေးရွာ');
 const localV=(p:{x:number;z:number})=>(p.x+p.z)/Math.sqrt(2);
 const chinSaiSouth=Math.max(...chinSaiVillage.houses.map(localV));
 const zingalinNorth=Math.min(...zingalinVillage.houses.map(localV));
 const weipulaNorth=Math.min(...ward.weipula.peaks.filter(m=>Math.abs(m.u)<400).map(m=>m.v-m.radius));
 for(const f of zingalinVillage.separationFields){
  assert.ok(localV(f)-f.depth/2>chinSaiSouth,'separation paddy sits south of Chin Sai village');
  assert.ok(localV(f)+f.depth/2<zingalinNorth,'separation paddy sits north of Zingalin village');
  assert.ok(canStand(f.x,f.z),'separation paddy is walkable');
 }
 for(const h of zingalinVillage.houses){
  assert.ok(localV(h)>chinSaiSouth,'Zingalin house is south of Chin Sai');
  assert.ok(localV(h)<weipulaNorth,'Zingalin house is north of Weipula');
  assert.equal(canStand(h.x,h.z),false,'Zingalin house blocks walking');
 }
 for(const t of [...zingalinVillage.trees,...zingalinVillage.largeTrees,...zingalinVillage.farmTrees]){
  assert.equal(canStand(t.x,t.z),false,'Zingalin tree blocks walking');
 }
 for(const r of zingalinVillage.roads){
  assert.ok(canStand(r.x,r.z),`${r.id} center is walkable`);
 }
});

test('Htomar village has few houses on the west and many houses deep on the east beyond 5 paddy columns',()=>{
 assert.equal(htomarVillage.name,'ထိုမာကျေးရွာ');
 const localU=(p:{x:number;z:number})=>(p.x-p.z)/Math.sqrt(2);
 const localV=(p:{x:number;z:number})=>(p.x+p.z)/Math.sqrt(2);
 const westHouses=htomarVillage.houses.filter(h=>localU(h)<0&&!h.id.startsWith('htomar-campus-'));
 const westCampusBuildings=htomarVillage.houses.filter(h=>localU(h)<0&&h.id.startsWith('htomar-campus-'));
 assert.ok(westCampusBuildings.length>=15,'TU Kalay and GTHS Khamtee campus buildings on the west side of AH1');
 const eastInteriorHouses=htomarVillage.houses.filter(h=>localU(h)>250);
 assert.ok(westHouses.length<=10,'few houses on the west side of AH1');
 assert.ok(eastInteriorHouses.length>150,'many houses in the eastern interior');
 const cols=new Set(htomarFiveColumnFields.map(f=>f.u));
 assert.equal(cols.size,5,'5 columns of paddy fields separate AH1 from Htomar interior');
 assert.equal(htomarRoadsideShops.filter(s=>s.shopType==='restaurant').length,4);
 assert.equal(htomarRoadsideShops.filter(s=>s.shopType==='teashop').length,2);
 assert.equal(htomarRoadsideShops.filter(s=>s.shopType==='betel').length,1);
 const minFieldU=Math.min(...htomarFiveColumnFields.map(f=>f.u!-f.width/2));
 for(const s of htomarRoadsideShops){assert.ok(s.u>6&&s.u<minFieldU,'shop sits between AH1 and 5 paddy columns');}
 const weipulaNorth=Math.min(...ward.weipula.peaks.filter(m=>Math.abs(m.u)<400).map(m=>m.v-m.radius));
 for(const h of htomarVillage.houses){
  assert.ok(localV(h)<weipulaNorth,'Htomar house is north of Weipula');
  assert.equal(canStand(h.x,h.z),false,'Htomar house blocks walking');
 }
 for(const t of [...htomarVillage.trees,...htomarVillage.largeTrees,...htomarVillage.farmTrees]){
  assert.equal(canStand(t.x,t.z),false,'Htomar tree blocks walking');
 }
 for(const r of htomarVillage.roads){
  assert.ok(canStand(r.x,r.z),`${r.id} center is walkable`);
 }
});

test('Thar Yar Gone village sits between Htomar and Weipula behind 50 paddy fields with St. Assumption Church at its center',()=>{
 assert.equal(tharYarGoneVillage.name,'သာယာကုန်းကျေးရွာ');
 assert.equal(tharYarGoneVillage.separationFields.length,50);
 const localV=(p:{x:number;z:number})=>(p.x+p.z)/Math.sqrt(2);
 const localU=(p:{x:number;z:number})=>(p.x-p.z)/Math.sqrt(2);
 const htomarSouth=Math.max(...htomarVillage.houses.map(localV));
 const villageNorth=Math.min(...tharYarGoneVillage.houses.map(localV));
 const weipulaNorth=Math.min(...ward.weipula.peaks.filter(m=>Math.abs(m.u)<400).map(m=>m.v-m.radius));
 for(const f of tharYarGoneVillage.separationFields){
  assert.ok(localV(f)-f.depth/2>htomarSouth,'50 paddies sit south of Htomar');
  assert.ok(localV(f)+f.depth/2<villageNorth,'50 paddies sit north of Thar Yar Gone');
  assert.ok(canStand(f.x,f.z),'separation paddy is walkable');
 }
 for(const h of tharYarGoneVillage.houses){
  assert.ok(localV(h)<weipulaNorth,'Thar Yar Gone house is north of Weipula');
  assert.equal(canStand(h.x,h.z),false,'Thar Yar Gone house blocks walking');
 }
 const church=tharYarGoneVillage.houses.find(h=>h.id==='tyg-landmark-church')!;
 assert.ok(church,'St. Assumption Church exists');
 const eastHouses=tharYarGoneVillage.houses.filter(h=>localU(h)>0);
 assert.equal(eastHouses.length,1,'only Thida Tun Rice Mill-2 is on the east side of AH1');
 assert.equal(eastHouses[0].id,'tyg-landmark-rice-mill');
 const west=tharYarGoneVillage.houses.filter(h=>localU(h)<0&&!h.id.startsWith('tyg-landmark-'));
 const minU=Math.min(...west.map(localU)),maxU=Math.max(...west.map(localU));
 assert.ok(Math.abs(localU(church)-(minU+maxU)/2)<30,'church is near the east-west center of the village');
 const ys=west.map(localV);
 assert.ok(Math.abs(localV(church)-(Math.min(...ys)+Math.max(...ys))/2)<30,'church is near the north-south center of the village');
 for(const t of [...tharYarGoneVillage.trees,...tharYarGoneVillage.largeTrees,...tharYarGoneVillage.farmTrees]){
  assert.equal(canStand(t.x,t.z),false,'Thar Yar Gone tree blocks walking');
 }
 for(const r of tharYarGoneVillage.roads){
  assert.ok(canStand(r.x,r.z),`${r.id} center is walkable`);
 }
});

test('Htauk Kyant village sits between Thar Yar Gone and Weipula with Pagoda & Football field on the east, High School on the west, and Lake & ponds on the northwest', () => {
  assert.equal(htaukKyantVillage.name, 'ထောက်ကြန့်ကျေးရွာ');
  assert.equal(htaukKyantVillage.separationFields.length, 20);
  const localV = (p: { x: number; z: number }) => (p.x + p.z) / Math.sqrt(2);
  const localU = (p: { x: number; z: number }) => (p.x - p.z) / Math.sqrt(2);
  const tharYarGoneSouth = Math.max(...tharYarGoneVillage.houses.map(localV));
  const villageNorth = Math.min(...htaukKyantVillage.houses.map(localV));
  const weipulaNorth = Math.min(...ward.weipula.peaks.filter(m => Math.abs(m.u) < 400).map(m => m.v - m.radius));

  // 1. Separation canal & paddies between Thar Yar Gone and Htauk Kyant
  const canalV = htaukKyantVillage.canal!.v;
  for (const f of htaukKyantVillage.separationFields) {
    assert.ok(localV(f) - f.depth / 2 > tharYarGoneSouth, 'separation paddy sits south of Thar Yar Gone');
    assert.ok(localV(f) + f.depth / 2 < villageNorth, 'separation paddy sits north of Htauk Kyant');
    assert.ok(canStand(f.x, f.z), 'separation paddy is walkable');
  }
  const canalWater = toWorld(-120, canalV);
  assert.equal(canStand(canalWater.x, canalWater.z), false, 'canal water blocks walking');
  const bridge = toWorld(0, canalV);
  assert.ok(canStand(bridge.x, bridge.z), 'AH1 bridge over canal is walkable');

  // 2. Houses solid and north of Weipula
  for (const h of htaukKyantVillage.houses) {
    assert.ok(localV(h) < weipulaNorth, 'Htauk Kyant house is north of Weipula');
    assert.equal(canStand(h.x, h.z), false, 'Htauk Kyant house blocks walking');
  }

  // 3. Football playground, small paddy field, and Pagoda arrangement
  const pagoda = htaukKyantVillage.houses.find(h => h.id === 'hk-landmark-pagoda-base')!;
  const pagodaSw = htaukKyantVillage.houses.find(h => h.id === 'hk-landmark-pagoda-sw')!;
  const playground = htaukKyantLandmarks.find(m => m.id === 'hk-football-playground')!;
  const smallField = htaukKyantVillage.fields.find(f => f.id === 'htaukkyant-field-between-pitch-and-pagoda')!;
  assert.ok(pagoda && pagodaSw, 'Htauk Kyant Pagodas exist (East & Northeast of building)');
  assert.ok(playground, 'Football playground exists');
  assert.ok(smallField, 'Small paddy field exists between playground and Pagoda');
  assert.ok(localU(playground) > 0, 'Football playground is east of main road');
  assert.ok(localU(smallField) > localU(playground), 'Small field sits east of football playground');
  assert.ok(localU(pagoda) > localU(smallField), 'Pagoda sits east of small field');
  assert.ok(canStand(smallField.x, smallField.z), 'small paddy field is walkable');

  const eastHouses = htaukKyantVillage.houses.filter(h => localU(h) > 0);
  assert.ok(eastHouses.length > 50, 'residential and landmark buildings east of AH1');

  // 4. Basic Education High School (BEHS) on west side of AH1 (localU < 0) opposite Pagoda & Playground
  const schoolMain = htaukKyantVillage.houses.find(h => h.id === 'hk-landmark-school-main')!;
  const schoolWing = htaukKyantVillage.houses.find(h => h.id === 'hk-landmark-school-wing')!;
  assert.ok(schoolMain && schoolWing, 'BEHS High School buildings exist');
  assert.ok(localU(schoolMain) < 0, 'High school is west of main road');
  assert.ok(Math.abs(localV(schoolMain) - localV(pagoda)) < 80, 'High school is opposite Pagoda across the road');

  // 5. Lake and 5 ponds on northeast paddy border
  assert.equal(allHtaukKyantPonds.length, 6, 'large lake and 5 rectangular ponds');
  for (const p of allHtaukKyantPonds) {
    assert.ok(p.u > 180, 'lake/pond is on the northeastern paddy field margin');
    assert.equal(canStand(p.x, p.z), false, 'pond water blocks walking');
  }

  // 6. Trees and roads
  for (const t of [...htaukKyantVillage.trees, ...htaukKyantVillage.largeTrees, ...htaukKyantVillage.farmTrees]) {
    assert.equal(canStand(t.x, t.z), false, 'Htauk Kyant tree blocks walking');
  }
  for (const r of htaukKyantVillage.roads) {
    assert.ok(canStand(r.x, r.z), `${r.id} center is walkable`);
  }
});

test('Kyar Inn village sits between Htauk Kyant and Weipula with Taphi Chaung bridge, Kyarinn middle school on east, and 4 churches', () => {
  assert.equal(kyarInnVillage.name, 'ကြာအင်းရွာ');
  assert.equal(kyarInnVillage.separationFields.length, 20);
  const localV = (p: { x: number; z: number }) => (p.x + p.z) / Math.sqrt(2);
  const localU = (p: { x: number; z: number }) => (p.x - p.z) / Math.sqrt(2);

  const htaukKyantSouth = Math.max(...htaukKyantVillage.houses.map(localV));
  const villageNorth = Math.min(...kyarInnVillage.houses.map(localV));
  const villageSouth = Math.max(...kyarInnVillage.houses.map(localV));
  const weipulaNorth = Math.min(...ward.weipula.peaks.filter(m => Math.abs(m.u) < 400).map(m => m.v - m.radius));

  // 1. Separation fields between Htauk Kyant and Kyar Inn
  for (const f of kyarInnVillage.separationFields) {
    assert.ok(localV(f) - f.depth / 2 > htaukKyantSouth, 'separation paddy is south of Htauk Kyant');
    assert.ok(localV(f) + f.depth / 2 < villageNorth, 'separation paddy is north of Kyar Inn');
    assert.ok(canStand(f.x, f.z), 'separation paddy is walkable');
  }

  // 2. Taphi Chaung stream and bridge
  const taphiWater = toWorld(-120, kyarInnTaphiChaung.v);
  assert.equal(canStand(taphiWater.x, taphiWater.z), false, 'Taphi Chaung stream water blocks walking');
  const taphiBridge = toWorld(0, kyarInnTaphiChaung.v);
  assert.ok(canStand(taphiBridge.x, taphiBridge.z), 'AH1 bridge over Taphi Chaung is walkable');

  // 3. Geographic positioning between Htauk Kyant and Weipula
  assert.ok(villageNorth > htaukKyantSouth, 'Kyar Inn is south of Htauk Kyant');
  assert.ok(villageSouth < weipulaNorth, 'Kyar Inn is north of Weipula mountain');
  for (const h of kyarInnVillage.houses) {
    assert.equal(canStand(h.x, h.z), false, 'Kyar Inn house blocks walking');
  }

  // 4. Kyarinn Middle School on East side (u > 0)
  const schoolHall1 = kyarInnVillage.houses.find(h => h.id === 'ki-school-north-hall-1')!;
  const schoolHall2 = kyarInnVillage.houses.find(h => h.id === 'ki-school-north-hall-2')!;
  const schoolOffice = kyarInnVillage.houses.find(h => h.id === 'ki-school-office')!;
  const schoolEastHall = kyarInnVillage.houses.find(h => h.id === 'ki-school-east-hall')!;
  const schoolEastWing = kyarInnVillage.houses.find(h => h.id === 'ki-school-east-wing')!;
  const schoolField = kyarInnLandmarks.find(m => m.id === 'ki-school-field')!;

  assert.ok(schoolHall1 && schoolHall2 && schoolOffice && schoolEastHall && schoolEastWing, 'Middle school buildings exist');
  assert.ok(schoolField, 'Middle school sports ground exists');
  assert.ok(localU(schoolHall1) > 0, 'School North Hall 1 is east of AH1');
  assert.ok(localU(schoolHall2) > 0, 'School North Hall 2 is east of AH1');
  assert.ok(localU(schoolEastHall) > 0, 'School East Hall is east of AH1');
  assert.ok(localU(schoolField) > 0, 'School ground is east of AH1');
  assert.ok(canStand(schoolField.x, schoolField.z), 'school sports ground is walkable');

  // 5. Churches (Baptist, IBC, CJC on West side; St. Peter on East side)
  const churchBaptist = kyarInnVillage.houses.find(h => h.id === 'ki-church-baptist')!;
  const churchIbc = kyarInnVillage.houses.find(h => h.id === 'ki-church-ibc')!;
  const churchCjc = kyarInnVillage.houses.find(h => h.id === 'ki-church-cjc')!;
  const churchStPeter = kyarInnVillage.houses.find(h => h.id === 'ki-church-st-peter')!;

  assert.ok(churchBaptist, 'Kyarinn Baptist Church exists');
  assert.ok(churchIbc, 'IBC Kyarinn Church exists');
  assert.ok(churchCjc, 'CJC Church Kyar Inn exists');
  assert.ok(churchStPeter, 'St. Peter Catholic Church exists');

  assert.ok(localU(churchBaptist) < 0, 'Baptist church is west of AH1');
  assert.ok(localU(churchIbc) < 0, 'IBC church is west of AH1');
  assert.ok(localU(churchCjc) < 0, 'CJC church is west of AH1');
  assert.ok(localU(churchStPeter) > 0, 'St. Peter Catholic church is east of AH1');

  // Relative north-south placement of churches
  assert.ok(localV(churchBaptist) < localV(churchIbc), 'Baptist church is north of IBC');
  assert.ok(localV(churchStPeter) > localV(schoolHall1), 'St. Peter church is south of middle school halls');

  // 6. Trees and roads
  for (const t of [...kyarInnVillage.trees, ...kyarInnVillage.largeTrees, ...kyarInnVillage.farmTrees]) {
    assert.equal(canStand(t.x, t.z), false, 'Kyar Inn tree blocks walking');
  }
  for (const r of kyarInnVillage.roads) {
    assert.ok(canStand(r.x, r.z), `${r.id} center is walkable`);
  }

  // 7. Kyar Inn Lake (ကြာအင်းရေကန်) at southwest of Kyar Inn village
  assert.equal(kyarInnVillage.ponds?.length, 17, '17 ponds in Kyar Inn Lake complex');
  for (const p of kyarInnVillage.ponds!) {
    assert.ok(localU(p) < -200, 'pond is to the west of village residential blocks');
    assert.ok(localV(p) >= 3850 && localV(p) <= 4120, 'pond is in the southern/southwest half of the village zone');
    assert.equal(canStand(p.x, p.z), false, 'pond water blocks walking');
  }

  // Main Kyar Inn Lake, Island, and Water Pavilion
  const mainLake = kyarInnVillage.ponds!.find(p => p.id === 'ki-pond-main-lake')!;
  const islandLake = kyarInnVillage.ponds!.find(p => p.id === 'ki-pond-island-lake')!;
  const pavilion = kyarInnVillage.houses.find(h => h.id === 'ki-lake-pavilion')!;

  assert.ok(mainLake, 'Main Kyar Inn Lake exists');
  assert.ok(islandLake, 'Island Lake exists');
  assert.ok(kyarInnLakeIsland, 'Kyar Inn Lake Island exists');
  assert.ok(pavilion, 'Water pavilion on stilts exists');
  assert.equal(canStand(pavilion.x, pavilion.z), false, 'water pavilion blocks collision');
});


test('detectLocation identifies every ward, village, sub-ward, and landmark during robot movement or Shift+Drag', async () => {
  const { detectLocation, MAP_DESTINATIONS } = await import('../src/game/locationDetect.ts');

  for (const dest of MAP_DESTINATIONS) {
    const loc = detectLocation(dest.x, dest.z);
    assert.equal(loc.id, dest.id, `Destination ${dest.id} resolves to its own id`);
  }

  // Thar Si sub-wards 1 to 6
  const tsW1 = toWorld(-50, 720);
  assert.equal(detectLocation(tsW1.x, tsW1.z).subArea, 'သာစည်ရွာ · ရပ်ကွက် (၁)');
  const tsW2 = toWorld(-50, 860);
  assert.equal(detectLocation(tsW2.x, tsW2.z).subArea, 'သာစည်ရွာ · ရပ်ကွက် (၂)');
  const tsW3 = toWorld(-160, 720);
  assert.equal(detectLocation(tsW3.x, tsW3.z).subArea, 'သာစည်ရွာ · ရပ်ကွက် (၃)');
  const tsW6 = toWorld(-270, 860);
  assert.equal(detectLocation(tsW6.x, tsW6.z).subArea, 'သာစည်ရွာ · ရပ်ကွက် (၆)');

  // Kyar Inn vs Kyar Inn Lake
  const kiCenter = toWorld(0, 3850);
  assert.equal(detectLocation(kiCenter.x, kiCenter.z).id, 'kyarinn');
  const kiLake = toWorld(-340, 3990);
  assert.equal(detectLocation(kiLake.x, kiLake.z).id, 'kyarinn-lake');
});
