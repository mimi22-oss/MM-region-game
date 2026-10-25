import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { batchStaticMeshes } from '../src/game/staticBatch.ts';
import { snapshotRegion, regionFlows, disposePreparedRegion } from '../src/game/preparedScene.ts';

test('batched region snapshots keep bounds and animation markers after releasing the source tree', () => {
 const source = new Group(), material = new MeshStandardMaterial(), geometry = new BoxGeometry(2, 2, 2);
 for (let i = 0; i < 100; i++) {
  const parent = new Group(), mesh = new Mesh(geometry, material);
  parent.position.set(i % 10 * 3, 1, Math.floor(i / 10) * 3);
  parent.add(mesh); source.add(parent);
 }
 const flow = new Group();
 flow.userData = { dynamic: true, flowPeriod: 8, flowSpeed: 1.5 };
 source.add(flow);
 let before = 0; source.traverse(() => { before++; });
 const batch = batchStaticMeshes(source);
 assert.equal(batch.prunedGroups, 100);
 const snapshot = snapshotRegion(source);
 let after = 0; snapshot.traverse(() => { after++; });
 assert.ok(after < before / 20, `${before} source nodes reduced to ${after} cached nodes`);
 batch.dispose();
 assert.equal(source.children.length, 101, 'source hierarchy restored for React cleanup');
 source.clear();
 snapshot.updateMatrixWorld(true);
 const ray = new Raycaster(new Vector3(0, 20, 0), new Vector3(0, -1, 0));
 assert.ok(ray.intersectObject(snapshot, true).length > 0, 'cached scene survives source unmount');
 assert.equal(regionFlows(snapshot).length, 1);
 assert.equal(regionFlows(snapshot)[0].matrixAutoUpdate, true);
 disposePreparedRegion(snapshot);
});

test('cached region disposal leaves shared primitive resources alive', () => {
 const geometry = new BoxGeometry(), material = new MeshStandardMaterial(), root = new Group();
 geometry.userData.shared = material.userData.shared = true;
 let disposed = 0;
 geometry.addEventListener('dispose', () => { disposed++; });
 material.addEventListener('dispose', () => { disposed++; });
 root.add(new Mesh(geometry, material));
 disposePreparedRegion(root);
 assert.equal(disposed, 0);
 geometry.dispose(); material.dispose();
});
