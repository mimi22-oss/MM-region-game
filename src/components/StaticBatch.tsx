import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { batchStaticMeshes } from '../game/staticBatch';

/** Contents must be static; animated descendants opt out with userData.dynamic. */
export function StaticBatch({children}:{children:ReactNode}){
 const root=useRef<Group>(null),current=useRef<ReturnType<typeof batchStaticMeshes>|null>(null);
 const elapsed=useRef(0),center=useRef(new Vector3());
 useLayoutEffect(()=>{const batch=batchStaticMeshes(root.current!);current.current=batch;return ()=>{current.current=null;batch.dispose()}},[]);
 useFrame(({camera},dt)=>{
  elapsed.current+=dt;if(elapsed.current<0.2)return;elapsed.current=0;
  for(const batch of current.current?.batches??[]){
   if(!batch.userData.detail||!batch.boundingSphere)continue;
   center.current.copy(batch.boundingSphere.center).applyMatrix4(root.current!.matrixWorld);
   batch.visible=camera.position.distanceTo(center.current)-batch.boundingSphere.radius<180;
  }
 });
 return <group ref={root}>{children}</group>;
}
