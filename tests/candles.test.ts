import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,InstancedMesh,Raycaster,Vector3,Matrix4} from 'three';
import {candleHolderGeometry,candleGeometry,candleSolidMaterial,flameGeometry,animateCandleFlames,candleFlameMaterial} from '../src/game/candleModel.ts';
import {decorateFestivalRegion,updateFestivalVisibility,createFestivalOverview} from '../src/game/festivalCandles.ts';
import {batchStaticMeshes} from '../src/game/staticBatch.ts';
import {snapshotRegion,disposePreparedRegion} from '../src/game/preparedScene.ts';

test('the cup is hollow, the candle rests on its base, and flames are actual finite 3D geometry',()=>{
 const cup=new Mesh(candleHolderGeometry,candleSolidMaterial),hit=new Raycaster(new Vector3(0,1,0),new Vector3(0,-1,0)).intersectObject(cup)[0];
 assert.ok(hit&&hit.point.y<.04,'center ray reaches the inner floor, not a closed lid');
 candleGeometry.computeBoundingBox();assert.ok(Math.abs(candleGeometry.boundingBox!.min.y)<1e-6);
 for(const g of [candleGeometry,candleHolderGeometry,flameGeometry]){for(const n of g.attributes.position.array)assert.ok(Number.isFinite(n));assert.ok(g.index!.count>50);}
});
test('rotated fence and tabletop anchors survive batching and become shared instances without duplication',()=>{
 const source=new Group(),home=new Group(),anchor=new Group();home.position.set(100,0,50);home.rotation.y=Math.PI/2;
 anchor.userData={dynamic:true,festivalCandles:[{x:1,y:1.475,z:0},{x:0,y:.88,z:1,holder:true}]};home.add(anchor);source.add(home);
 const batch=batchStaticMeshes(source),root=snapshotRegion(source);decorateFestivalRegion(root);decorateFestivalRegion(root);
 assert.equal(root.children.filter(c=>c.name==='festival-candles').length,1);
 const wax:InstancedMesh[]=[],cups:InstancedMesh[]=[];root.traverse(o=>{if(o instanceof InstancedMesh){if(o.name==='festival-wax')wax.push(o);if(o.name==='festival-holders')cups.push(o);}});
 assert.equal(wax.reduce((n,m)=>n+m.count,0),2);assert.equal(cups.reduce((n,m)=>n+m.count,0),1);
 root.updateMatrixWorld(true);const matrix=new Matrix4();wax[0].getMatrixAt(0,matrix);const p=new Vector3().setFromMatrixPosition(matrix).applyMatrix4(wax[0].matrixWorld);
 assert.ok(Math.abs(p.x-100)<1e-6&&Math.abs(p.z-49)<1e-6);assert.ok(Math.abs(p.y-1.475)<1e-6);
 updateFestivalVisibility(root,100,50);assert.equal(wax[0].visible,true);
 updateFestivalVisibility(root,10000,10000);assert.equal(wax[0].parent!.visible,false);
 updateFestivalVisibility(root,1000,50,false,800);assert.equal(wax[0].parent!.visible,true,'aerial viewing must not use the walking-distance cutoff');
 const overview=createFestivalOverview(root);assert.ok(overview.children.length);const overviewMesh=overview.children[0] as InstancedMesh;
 assert.equal(overviewMesh.count,1);overviewMesh.getMatrixAt(0,matrix);assert.ok(new Vector3().setFromMatrixPosition(matrix).y>5.19,'overview light remains above simplified roof after Float32 storage');
 disposePreparedRegion(overview);
 let disposed=false;candleGeometry.addEventListener('dispose',()=>{disposed=true;});disposePreparedRegion(root);batch.dispose();assert.equal(disposed,false,'cached regions must not destroy shared candle resources');
});
test('one animation clock keeps all flame batches flickering after a cached region is restored',()=>{
 animateCandleFlames(12);assert.equal(candleFlameMaterial.uniforms.time.value,12);animateCandleFlames(15);assert.equal(candleFlameMaterial.uniforms.time.value,15);
});
