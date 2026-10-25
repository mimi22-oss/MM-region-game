import {useEffect,type RefObject} from 'react';
import type {Group} from 'three';
import {trafficColliders,type TrafficKind} from '../game/trafficColliders';
export function useTrafficCollider(root:RefObject<Group|null>,width:number,depth:number,kind:TrafficKind='robot'){
 useEffect(()=>{const object=root.current;if(!object)return;trafficColliders.set(object,{width,depth,kind});return ()=>{trafficColliders.delete(object);};},[root,width,depth,kind]);
}
