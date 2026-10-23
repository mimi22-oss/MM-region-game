import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Group } from 'three';
import { batchStaticMeshes } from '../game/staticBatch';

/** Contents must be static; animated descendants opt out with userData.dynamic. */
export function StaticBatch({children}:{children:ReactNode}){
 const root=useRef<Group>(null),current=useRef<ReturnType<typeof batchStaticMeshes>|null>(null);
 useLayoutEffect(()=>{const batch=batchStaticMeshes(root.current!);current.current=batch;return ()=>{current.current=null;batch.dispose()}},[]);
 return <group ref={root}>{children}</group>;
}
