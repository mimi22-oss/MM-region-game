import {useEffect,type RefObject} from 'react';
import type {Group} from 'three';
import {trafficColliders} from '../game/trafficColliders';
export function useTrafficCollider(root:RefObject<Group|null>,width:number,depth:number){
 useEffect(()=>{const object=root.current;if(!object)return;trafficColliders.set(object,{width,depth});return ()=>{trafficColliders.delete(object);};},[root,width,depth]);
}
