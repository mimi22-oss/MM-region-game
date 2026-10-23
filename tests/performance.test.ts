import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { batchStaticMeshes } from '../src/game/staticBatch.ts';
import { spatialIndex } from '../src/game/spatialIndex.ts';

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
