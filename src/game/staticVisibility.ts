import {InstancedMesh,Vector3,type Object3D} from 'three';

/** Tiny window trims only: building shells, roofs and walkable decks always remain. */
export function staticDetails(root:Object3D){
 const details:{mesh:InstancedMesh;center:Vector3;radius:number}[]=[];
 root.updateWorldMatrix(true,true);
 root.traverse(object=>{
  if(!(object instanceof InstancedMesh)||!object.userData.detail||object.userData.walkable)return;
  object.computeBoundingSphere();if(!object.boundingSphere)return;
  const sphere=object.boundingSphere.clone().applyMatrix4(object.matrixWorld);
  details.push({mesh:object,center:sphere.center,radius:sphere.radius});
 });
 return details;
}
export function updateStaticDetails(details:ReturnType<typeof staticDetails>,x:number,y:number,z:number,mobile:boolean){
 const range=mobile?110:180;
 for(const {mesh,center,radius} of details){
  const distance=Math.hypot(center.x-x,center.y-y,center.z-z)-radius;
  mesh.visible=distance<range+(mesh.visible?35:0);
 }
}
