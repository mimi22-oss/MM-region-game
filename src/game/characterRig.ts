import {Bone,Quaternion,Vector3,type AnimationClip} from 'three';

export function gameplayClips(clips:AnimationClip[],hipY:number){
 return clips.map(source=>{
  const clip=source.clone();
  if(clip.name==='Vault')for(const track of clip.tracks)if(track.name==='Hips.position'){
   for(let i=0;i<track.values.length;i+=3)track.values[i+1]=hipY;
  }
  return clip;
 });
}

/** Two-bone IK adapts the authored seated clips to the game's vehicle grips. */
export function createLimbFitter(upper:Bone,lower:Bone,end:Bone){
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),direction=new Vector3(),pole=new Vector3(),elbow=new Vector3(),target=new Vector3();
 const current=new Vector3(),desired=new Vector3(),world=new Quaternion(),parent=new Quaternion(),delta=new Quaternion();
 const l1=lower.position.length(),l2=end.position.length();
 function aim(bone:Bone,child:Bone,to:Vector3){
  bone.getWorldPosition(a);child.getWorldPosition(b);
  current.subVectors(b,a).normalize();desired.subVectors(to,a).normalize();delta.setFromUnitVectors(current,desired);
  bone.getWorldQuaternion(world);bone.parent!.getWorldQuaternion(parent);
  bone.quaternion.copy(parent.invert().multiply(delta.multiply(world)));bone.updateWorldMatrix(false,true);
 }
 return (grip:Vector3,bend:Vector3)=>{
  upper.getWorldPosition(a);lower.getWorldPosition(b);end.getWorldPosition(c);
  const scale=upper.getWorldScale(current).x,first=l1*scale,second=l2*scale;
  direction.subVectors(grip,a);const distance=Math.max(.001,Math.min(direction.length(),first+second-.0001));direction.normalize();
  pole.copy(bend).addScaledVector(direction,-bend.dot(direction)).normalize();
  const along=(first*first-second*second+distance*distance)/(2*distance);
  elbow.copy(a).addScaledVector(direction,along).addScaledVector(pole,Math.sqrt(Math.max(0,first*first-along*along)));
  target.copy(a).addScaledVector(direction,distance);
  aim(upper,lower,elbow);aim(lower,end,target);
 };
}
