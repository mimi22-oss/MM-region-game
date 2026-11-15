import type {Material} from 'three';
/** Capture instance-cloned material defaults once; never mutate a shared GLB material. */
export function rememberGhostMaterial(material:Material){material.userData.ghostOpacity=material.opacity;material.userData.ghostTransparent=material.transparent;material.userData.ghostDepthWrite=material.depthWrite;}
export function applyGhostOpacity(material:Material,opacity:number){
 const translucent=opacity<.99,transparent=Boolean(material.userData.ghostTransparent)||translucent;
 if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
 material.opacity=(material.userData.ghostOpacity??1)*Math.max(0,Math.min(1,opacity));
 material.depthWrite=(material.userData.ghostDepthWrite??true)&&!translucent;
}
