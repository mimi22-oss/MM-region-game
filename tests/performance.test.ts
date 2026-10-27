import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import {staticDetails,updateStaticDetails} from '../src/game/staticVisibility.ts';
import { batchStaticMeshes } from '../src/game/staticBatch.ts';
import { spatialIndex } from '../src/game/spatialIndex.ts';

test('paint variations share one draw call while preserving each building color',()=>{
 const root=new Group(),colors:Color[]=[];
 for(let i=0;i<40;i++){
  const color=new Color().setHSL(i/40,.6,.5);colors.push(color);
  const mesh=new Mesh(new BoxGeometry(6,8,5),new MeshStandardMaterial({color}));mesh.position.set(10+i%8*10,4,10+Math.floor(i/8)*10);root.add(mesh);
 }
 const batch=batchStaticMeshes(root);assert.equal(batch.batchCount,1);
 const actual=new Color();colors.forEach((expected,i)=>{batch.batches[0].getColorAt(i,actual);assert.ok(Math.abs(actual.r-expected.r)<1e-6);assert.ok(Math.abs(actual.g-expected.g)<1e-6);assert.ok(Math.abs(actual.b-expected.b)<1e-6);});
 assert.equal((batch.batches[0].material as MeshStandardMaterial).color.getHexString(),'ffffff');batch.dispose();
});
test('decorative detail culling preserves roofs, walls and walkable road decks and restores nearby trims',()=>{
 const root=new Group();
 for(let i=0;i<2;i++)for(const [size,walkable] of [[[1.5,1.4,.1],false],[[8,5,6],false],[[2,.1,2],true]] as const){
  const mesh=new Mesh(new BoxGeometry(...size),new MeshStandardMaterial());mesh.position.set(10+i*5,1,10);mesh.userData.walkable=walkable;root.add(mesh);
 }
 const batch=batchStaticMeshes(root),details=staticDetails(root);assert.equal(details.length,1);
 updateStaticDetails(details,1000,5,1000,false);assert.equal(details[0].mesh.visible,false);
 assert.ok(batch.batches.filter(m=>m!==details[0].mesh).every(m=>m.visible));
 updateStaticDetails(details,10,5,10,false);assert.equal(details[0].mesh.visible,true);batch.dispose();
});

test('batching reduces repeated primitives and preserves transformed bounds, ray hits and cleanup',()=>{
 const root=new Group(),parent=new Group();parent.position.set(10,0,10);parent.rotation.y=Math.PI/4;root.add(parent);
 const meshes:Mesh[]=[];
 for(let i=0;i<100;i++){const mesh=new Mesh(new BoxGeometry(2,3,4),new MeshStandardMaterial({color:'#bfa58a'}));mesh.position.set((i%10)*3,2,Math.floor(i/10)*5);parent.add(mesh);meshes.push(mesh)}
 root.updateMatrixWorld(true);const expected=meshes[0].matrixWorld.clone().multiply(new Matrix4().makeScale(2,3,4));
 const animated=new Group();animated.userData.dynamic=true;const ripple=new Mesh(new BoxGeometry(),new MeshStandardMaterial());animated.add(ripple);root.add(animated);
 const transparent=new Mesh(new BoxGeometry(),new MeshStandardMaterial({transparent:true,opacity:0.4}));root.add(transparent);
 const result=batchStaticMeshes(root);assert.equal(result.sourceMeshes,100);assert.ok(result.batchCount<=4);
 assert.equal(ripple.parent,animated);assert.equal(transparent.parent,root);
 const batches=root.children.filter(c=>c instanceof InstancedMesh);const actual=new Matrix4();batches[0].getMatrixAt(0,actual);
 actual.elements.forEach((v,i)=>assert.ok(Math.abs(v-expected.elements[i])<0.0001));
 const ray=new Raycaster(new Vector3(10,30,10),new Vector3(0,-1,0));assert.ok(ray.intersectObjects(batches).length>0);
 result.dispose();assert.equal(meshes[0].parent,parent);assert.equal(parent.children.length,100);assert.equal(root.children.filter(c=>c instanceof InstancedMesh).length,0);
 const second=batchStaticMeshes(root);assert.equal(second.sourceMeshes,100);second.dispose();
});

test('spatial cells retain boundary-overlapping and negative-coordinate obstacles',()=>{
 const items=Array.from({length:1000},(_,i)=>({x:(i%50)*40-1000,z:Math.floor(i/50)*40-400,radius:12+i%5}));
 const query=spatialIndex(items,item=>item);
 for(let x=-1024;x<1024;x+=17)for(let z=-420;z<420;z+=31){const candidates=query(x,z);for(const item of items)if(Math.hypot(x-item.x,z-item.z)<=item.radius)assert.ok(candidates.includes(item));assert.ok(candidates.length<30)}
});


test('mountain terrain joins tiles smoothly and leaves footprints and the road pass clear',async()=>{
 const {buildMountainTiles,mountainHeight}=await import('../src/game/mountainTerrain.ts');
 const peaks=[{u:-105,v:100,radius:90,height:500},{u:105,v:100,radius:90,height:550},{u:250,v:100,radius:100,height:600}];
 assert.equal(mountainHeight(0,100,peaks),0);assert.equal(mountainHeight(600,100,peaks),0);
 assert.ok(mountainHeight(105,100,peaks)>=549);assert.ok(mountainHeight(185,100,peaks)>0);
 const tiles=buildMountainTiles(peaks,10),edges=new Map<string,number[]>();let triangles=0;
 for(const tile of tiles){const p=tile.geometry.getAttribute('position'),normal=tile.geometry.getAttribute('normal'),color=tile.geometry.getAttribute('color');triangles+=tile.geometry.index!.count/3;
  for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getY(i)));assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<0.001);assert.ok(color.getX(i)>=0&&color.getX(i)<=1);
   const key=`${tile.u+p.getX(i)},${tile.v+p.getZ(i)}`,values=[p.getY(i),normal.getX(i),normal.getY(i),normal.getZ(i)];
   if(edges.has(key))values.forEach((v,j)=>assert.ok(Math.abs(v-edges.get(key)![j])<0.0001));else edges.set(key,values);
  }tile.geometry.dispose();
 }
 assert.ok(triangles>0&&triangles<12000);
});


test('robot facing stays fixed while orbiting and turns toward actual movement',async()=>{
 const {avatarHeading}=await import('../src/game/avatarHeading.ts');
 let facing=0.7;
 for(let cameraYaw=-Math.PI;cameraYaw<=Math.PI;cameraYaw+=0.1){facing=avatarHeading(facing,0,0);assert.equal(facing,0.7)}
 for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1]]){const heading=avatarHeading(facing,dx,dz),length=Math.hypot(dx,dz);assert.ok(Math.abs(-Math.sin(heading)-dx/length)<1e-10);assert.ok(Math.abs(-Math.cos(heading)-dz/length)<1e-10)}
 assert.equal(avatarHeading(1.2,1e-9,-1e-9),1.2);
});


test('bot appearances are unique and exclude the player mint palette',async()=>{
 const {botAppearance,playerPalette}=await import('../src/game/robotAppearance.ts');const variants=Array.from({length:64},(_,i)=>botAppearance(i));
 assert.equal(new Set(variants.map(v=>v.palette.shell)).size,64);assert.equal(new Set(variants.map(v=>v.size)).size,64);
 for(const v of variants){assert.notEqual(v.palette.shell,playerPalette.shell);assert.ok(v.size>=0.66&&v.size<=1.11);const hue=Number(v.palette.shell.match(/hsl\(([0-9.]+)/)![1]);assert.ok(hue<105||hue>=200)}
});

test('bot routes join lanes to highways, reject blocked crossings and reverse at ends',async()=>{
 const {buildRoadGraph,nextRoadNode}=await import('../src/game/robotRoutes.ts');
 const roads=[{id:'main',name:'main',x:0,z:0,width:4,depth:40,rotation:0,main:true},{id:'lane',name:'lane',x:0,z:0,width:40,depth:4,rotation:0,main:false}];
 const graph=buildRoadGraph(roads,()=>true),center=graph.findIndex(n=>Math.hypot(n.x,n.z)<0.01);assert.equal(graph[center].links.length,4);
 const end=graph.findIndex(n=>n.links.length===1);assert.equal(nextRoadNode(graph,end,graph[end].links[0],0.5),graph[end].links[0]);
 const blocked=buildRoadGraph(roads,(x,z)=>Math.hypot(x,z)>2);for(const n of blocked)for(const j of n.links){const b=blocked[j];assert.ok(Math.hypot((n.x+b.x)/2,(n.z+b.z)/2)>2)}
});

test('all villages have safe bot patrols with access to a main road',async()=>{
 const {ward}=await import('../src/data/ward.ts');const {kalayVillages}=await import('../src/data/villages/index.ts');const {canStand}=await import('../src/game/collision.ts');const {buildRoadGraph}=await import('../src/game/robotRoutes.ts');
 for(const region of [{id:'myothar',roads:ward.roads},...kalayVillages]){
  const clear=(x:number,z:number)=>[[0,0],[0.08,0],[-0.08,0],[0,0.08],[0,-0.08]].every(([dx,dz])=>canStand(x+dx,z+dz));
  const graph=buildRoadGraph(region.roads,clear),lanes=graph.map((n,i)=>n.lane&&n.links.length?i:-1).filter(i=>i>=0);assert.ok(lanes.length>=8,region.id);
  const seen=new Set(lanes),queue=[...lanes];for(let i=0;i<queue.length;i++)for(const j of graph[queue[i]].links)if(!seen.has(j)){seen.add(j);queue.push(j)}assert.ok([...seen].some(i=>!graph[i].lane),region.id+' connects to highway');
  for(const n of graph)for(const j of n.links){const b=graph[j];for(let t=0;t<=1;t+=0.25)assert.ok(clear(n.x+(b.x-n.x)*t,n.z+(b.z-n.z)*t),region.id+' patrol edge is clear')}
 }
});


test('parked reference car blocks entry without obstructing AH1 or the player spawn',async()=>{
 const {parkedCars}=await import('../src/data/cars.ts');const {ward,toWorld}=await import('../src/data/ward.ts');const {canStand}=await import('../src/game/collision.ts');
 for(const car of parkedCars)assert.equal(canStand(car.x,car.z),false);
 assert.ok(canStand(ward.spawn.x,ward.spawn.z));
 for(let v=98;v<=109;v++)for(const u of [-5,0,5]){const p=toWorld(u,v);assert.ok(canStand(p.x,p.z))}
});


test('touch directions and lifecycle reset cannot leave movement or sprint stuck',async()=>{
 const {createMobileInput,resetMobileInput,touchDirection}=await import('../src/game/mobileInput.ts');
 const a=createMobileInput(),b=createMobileInput();
 for(const [direction,forward,right] of [['up',1,0],['down',-1,0],['left',0,-1],['right',0,1]] as const)assert.deepEqual(touchDirection(direction),{forward,right});
 a.sprint=true;assert.equal(a.active,false);assert.equal(a.forward,0);assert.equal(a.right,0);
 Object.assign(a,touchDirection('up'),{active:true,session:3,lookX:50,lookY:-10});resetMobileInput(a);
 assert.equal(a.session,3);assert.deepEqual({...a,session:0},b);
 Object.assign(a,touchDirection('right'),{active:true,session:a.session+1});assert.equal(a.session,4);assert.equal(a.sprint,false);assert.equal(b.active,false);
});


test('mobile joystick steers diagonally and pinch suppresses movement until release',async()=>{
 const {createMobileInput,MobileGesture,joystickDirection}=await import('../src/game/mobileInput.ts');
 const d=joystickDirection(30,-40);assert.equal(d.right,.6);assert.equal(d.forward,.8);
 assert.deepEqual(joystickDirection(2,2),{forward:0,right:0});
 const input=createMobileInput(),g=new MobileGesture(input);
 g.down(1,'left',100,200);g.hold();g.move(1,130,160);
 assert.equal(input.active,true);assert.equal(input.forward,.8);assert.equal(input.right,.6);
 g.down(2,'right',300,200);assert.equal(input.sprint,true);
 g.move(1,120,160);assert.equal(g.pinching,false,'one moving thumb and stationary sprint thumb are not a pinch');
 g.move(2,340,200);assert.equal(g.pinching,true);assert.ok(input.zoomFactor<1,'spread zooms in');
 assert.equal(input.active,false);assert.equal(input.sprint,false);assert.equal(input.lookX,0);
 input.zoomFactor=1;g.move(2,310,200);assert.ok(input.zoomFactor>1,'contract zooms out');
 g.up(2);g.move(1,180,220);assert.equal(input.active,false,'remaining finger cannot restart movement');
 g.up(1);g.down(3,'left',100,200);g.hold();assert.equal(input.active,true);
 g.clear();assert.deepEqual(input,{...createMobileInput(),session:input.session});
 for(const side of ['left','right'] as const){
  g.down(1,side,100,200);g.down(2,side,150,200);g.move(2,180,200);
  assert.equal(g.pinching,true);assert.ok(input.zoomFactor<1);g.clear();
 }
});


test('two-finger travel pans on either half or across halves and preserves pinch zoom',async()=>{
 const {createMobileInput,MobileGesture}=await import('../src/game/mobileInput.ts');
 for(const sides of [['left','left'],['right','right'],['left','right']] as const){
  const input=createMobileInput(),g=new MobileGesture(input);
  g.down(1,sides[0],100,100);g.down(2,sides[1],200,100);
  g.move(1,100,130);g.move(2,200,130);
  assert.equal(g.pinching,true);assert.equal(input.panX,0);assert.equal(input.panY,30);
  assert.equal(input.zoomFactor,1,'parallel drag preserves zoom');
  assert.equal(input.active,false);assert.equal(input.sprint,false);assert.equal(input.lookY,0);
  input.panX=0;input.panY=0;
  g.move(1,80,130);g.move(2,220,130);
  assert.ok(Math.abs(input.zoomFactor-100/140)<1e-10);assert.equal(input.panX,0);
  g.up(1);g.move(2,250,150);g.hold();
  assert.equal(input.active,false);assert.equal(input.panX,0);assert.equal(input.panY,0);
  g.clear();assert.deepEqual({...input,session:0},createMobileInput());
 }
});


test('scene streaming caps detailed regions, retains nearby regions and evicts distant ones',async()=>{
 const {selectRegions,selectOverviewRegions}=await import('../src/game/sceneBudget.ts');
 const regions=Array.from({length:1000},(_,i)=>({id:String(i),minX:i*200,maxX:i*200+100,minZ:0,maxZ:100}));
 assert.equal(selectOverviewRegions(regions,50,50,true).length,16);
 assert.equal(selectOverviewRegions(regions,50,50,false).length,32);
 assert.deepEqual(selectRegions(regions,50,50,10,[],true),['0']);
 assert.equal(selectRegions(regions,150,50,10,[],false).length,2);
 assert.deepEqual(selectRegions(regions,50,50,700,['0'],true),[]);
 assert.deepEqual(selectRegions(regions,5000,50,10,['0'],true),['25']);
 assert.deepEqual(selectRegions(regions,-1000,50,10,['0'],true),[]);
 assert.deepEqual(selectRegions(regions,150,50,10,['1'],true),['1'],'hysteresis avoids switching at region boundaries');
});


test('camera travel never relocates or turns the robot, including world-edge pans',async()=>{
 const {panCamera}=await import('../src/game/cameraNavigation.ts');
 const s={x:12,z:-18,bodyYaw:.7,camX:12,camZ:-18,yaw:0};
 panCamera(s,100,200,500);assert.equal(s.camX,112);assert.equal(s.camZ,-218);
 s.yaw=Math.PI/2;panCamera(s,10000,10000,500);
 assert.equal(s.camX,-500);assert.equal(s.camZ,-500);
 assert.deepEqual({x:s.x,z:s.z,bodyYaw:s.bodyYaw},{x:12,z:-18,bodyYaw:.7});
});


test('teleport accepts clear ground, finds nearby space and rejects blocked or invalid views',async()=>{
 const {findTeleportSpot}=await import('../src/game/cameraNavigation.ts');
 assert.deepEqual(findTeleportSpot(10,20,()=>true),{x:10,z:20});
 const spot=findTeleportSpot(10,20,(x,z)=>Math.hypot(x-10,z-20)>=4);
 assert.ok(spot);assert.ok(Math.hypot(spot.x-10,spot.z-20)<=4.001);
 assert.equal(findTeleportSpot(10,20,()=>false),null);
 assert.equal(findTeleportSpot(NaN,20,()=>true),null);
});


test('view location follows camera focus while the robot stays in Myothar',async()=>{
 const {detectLocation,MAP_DESTINATIONS}=await import('../src/game/locationDetect.ts');
 const {ward}=await import('../src/data/ward.ts');
 const {panCamera}=await import('../src/game/cameraNavigation.ts');
 const destination=MAP_DESTINATIONS.find(d=>d.id==='htaukkyant')!;
 const s={...ward.spawn,camX:ward.spawn.x,camZ:ward.spawn.z,yaw:0};
 panCamera(s,destination.x-s.camX,s.camZ-destination.z,ward.size/2);
 assert.equal(detectLocation(s.camX,s.camZ).id,'htaukkyant');
 assert.deepEqual({x:s.x,z:s.z},ward.spawn);
});

test('region detail stays stable around zoom thresholds and waits for navigation to settle',async()=>{
 const {selectRegions,ViewSettler}=await import('../src/game/sceneBudget.ts');
 const regions=[{id:'a',minX:0,maxX:100,minZ:0,maxZ:100}];
 assert.deepEqual(selectRegions(regions,50,50,490,['a'],true),['a']);
 assert.deepEqual(selectRegions(regions,50,50,490,[],true),[]);
 const settle=new ViewSettler();
 for(let x=0;x<20;x++)assert.equal(settle.update(x,0,20,0.1),false);
 for(let i=0;i<5;i++)assert.equal(settle.update(19,0,20,.1),false);
 assert.equal(settle.update(19,0,20,.2),true);
 assert.equal(settle.update(19,0,25,.1),false);
});


test('main-road car traffic merges adjacent roads, separates directions and varies appearances',async()=>{
 const {buildTrafficRoutes,trafficPose,carAppearance}=await import('../src/game/carTraffic.ts');
 const routes=buildTrafficRoutes([{id:'a',x:0,z:50,width:12,depth:100,rotation:0,main:true},{id:'b',x:0,z:150,width:12,depth:100,rotation:0,main:true},{id:'lane',x:30,z:50,width:6,depth:50,rotation:0,main:false}]);
 assert.equal(routes.length,1);const r=routes[0],period=2*r.length+2*Math.PI*r.lane;
 const a=trafficPose(r,20),b=trafficPose(r,r.length+Math.PI*r.lane+20);assert.ok(a.x*b.x<0);
 for(let t=0;t<period;t+=.2){const p=trafficPose(r,t);assert.ok(Math.abs(p.x)<6);assert.ok(p.z>=0&&p.z<=200);const q=trafficPose(r,t+.01);assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<.011)}
 assert.equal(new Set(Array.from({length:32},(_,i)=>carAppearance(i).color)).size,32);
 assert.ok(new Set(Array.from({length:12},(_,i)=>carAppearance(i).size)).size>1);
});

test('windshield follows the outside of the curved car body',async()=>{
 const {windshieldGeometry,cabinCurvePoint}=await import('../src/game/carWindshield.ts');const g=windshieldGeometry(),p=g.getAttribute('position');
 for(let i=0;i<=16;i++){
  const base=cabinCurvePoint(.015+(.27-.015)*i/16);
  for(let j=0;j<9;j++){const k=i*9+j,outward=(p.getY(k)-base.y)*base.ny+(p.getZ(k)-base.z)*base.nz;assert.ok(outward>.05);assert.ok(p.getZ(k)<0)}
 }
 g.dispose();
});

test('only the owner opens home gates, with delayed closing and matching collision',async()=>{
 const {homeAccess,homeGates,updateHomeAccess,homeGateBlocks,ownsHome}=await import('../src/game/homeAccess.ts');
 const {farmhouse}=await import('../src/data/ward.ts');
 assert.ok(ownsHome(farmhouse.id));assert.equal(ownsHome(farmhouse.id,'npc'),false);assert.equal(ownsHome('another-house'),false);
 const g=homeGates.yard;updateHomeAccess(1e5,1e5,10);assert.ok(homeGateBlocks(g.x,g.z));
 updateHomeAccess(g.x,g.z,1,'npc');assert.equal(homeAccess.open.yard,0);
 updateHomeAccess(g.x,g.z,2.9);assert.equal(homeAccess.open.yard,0);
 updateHomeAccess(g.x+.2,g.z,.1);assert.equal(homeAccess.wait.yard,0);
 updateHomeAccess(g.x+.2,g.z,2.9);assert.equal(homeAccess.open.yard,0);
 updateHomeAccess(g.x+.2,g.z,.11);
 updateHomeAccess(g.x+.2,g.z,1);assert.equal(homeAccess.open.yard,1);assert.equal(homeGateBlocks(g.x,g.z),false);
 updateHomeAccess(1e5,1e5,1);assert.equal(homeAccess.open.yard,1);
 updateHomeAccess(1e5,1e5,2);assert.equal(homeAccess.open.yard,0);assert.ok(homeGateBlocks(g.x,g.z));
});


test('farm estate surrounds owned plots, excludes neighbors and keeps gate/canal access',async()=>{
 const {insideEstate,estateFenceBlocks,estatePalms,estatePanels}=await import('../src/data/farmEstate.ts');
 const {ward,toWorld,angle}=await import('../src/data/ward.ts');
 for(const plot of [ward.frontLot,ward.farm,ward.pond,ward.farmNorthLand,...ward.sideLots]){
  const u=plot.x*Math.cos(angle)-plot.z*Math.sin(angle),v=plot.x*Math.sin(angle)+plot.z*Math.cos(angle);
  for(const du of [-1,1])for(const dv of [-1,1])assert.ok(insideEstate(u+du*plot.width/2,v+dv*plot.depth/2));
 }
 for(const [u,v] of [[-74,204],[-24,240],[-74,296],[-182,270]])assert.equal(insideEstate(u,v),false);
 const gate=toWorld(-10,270);assert.equal(estateFenceBlocks(gate.x,gate.z),false);
 const fence=toWorld(-154,270);assert.ok(estateFenceBlocks(fence.x,fence.z));
 assert.ok(estatePanels.filter(p=>p.raised).length>=2);
 assert.ok(estatePalms.length>12);for(const palm of estatePalms){assert.ok(insideEstate(palm.u,palm.v));assert.ok(Math.abs(palm.u+54)>5)}
});


test('reload spawn is clear ground inside the owned farmhouse',async()=>{
 const {ward,farmhouse}=await import('../src/data/ward.ts');const {localPoint}=await import('../src/game/homeAccess.ts');const {canStand}=await import('../src/game/collision.ts');
 const p=localPoint(ward.spawn.x,ward.spawn.z,farmhouse.x,farmhouse.z,farmhouse.rotation);
 assert.ok(Math.abs(p.x)<5.5&&Math.abs(p.z)<4.5);assert.ok(canStand(ward.spawn.x,ward.spawn.z));assert.equal(ward.spawnZoom,3);
});


test('robot location uses a stable geographic anchor and true avatar compass direction',async()=>{
 const {robotLocation,locationCopyText}=await import('../src/game/robotLocation.ts');
 const {tharSiVillage}=await import('../src/data/villages/index.ts');const {angle,toWorld}=await import('../src/data/ward.ts');
 const a=robotLocation(tharSiVillage.x,tharSiVillage.z,angle);
 assert.equal(a.latitude,tharSiVillage.coordinates!.lat);assert.equal(a.longitude,tharSiVillage.coordinates!.lng);
 for(const [turn,direction] of [[0,'North'],[Math.PI/2,'East'],[Math.PI,'South'],[Math.PI*1.5,'West']] as const)assert.equal(robotLocation(0,0,angle-turn).direction,direction);
 const east=toWorld(100,0),north=toWorld(0,-100);
 assert.ok(robotLocation(tharSiVillage.x+east.x,tharSiVillage.z+east.z,0).longitude>a.longitude);
 assert.ok(robotLocation(tharSiVillage.x+north.x,tharSiVillage.z+north.z,0).latitude>a.latitude);
 const copy=locationCopyText(12.345,67.89,angle);assert.ok(copy.includes('12.345, 67.890'));assert.ok(copy.includes('Latitude (approx)'));assert.ok(copy.includes('Facing: North'));assert.ok(copy.includes('Local U/V'));
});
