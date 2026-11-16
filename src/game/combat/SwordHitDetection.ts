import {Vector3} from 'three';
/** Allocation-free closest distance between two finite segments (including points). */
export class SwordHitDetection {
 private u=new Vector3();private v=new Vector3();private w=new Vector3();private closest=new Vector3();
 segmentDistanceSq(p:Vector3,q:Vector3,a:Vector3,b:Vector3){
  const u=this.u.subVectors(q,p),v=this.v.subVectors(b,a),w=this.w.subVectors(p,a);
  const A=u.dot(u),B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(w),den=A*C-B*B;
  let s=den>1e-12?Math.max(0,Math.min(1,(B*E-C*D)/den)):0;
  let t=C>1e-12?(B*s+E)/C:0;
  if(C<=1e-12)s=A>1e-12?Math.max(0,Math.min(1,-D/A)):0;
  if(t<0){t=0;s=A>1e-12?Math.max(0,Math.min(1,-D/A)):0;}
  else if(t>1){t=1;s=A>1e-12?Math.max(0,Math.min(1,(B-D)/A)):0;}
  return this.closest.copy(w).addScaledVector(u,s).addScaledVector(v,-t).lengthSq();
 }
 sweptBlade(previousBase:Vector3,previousTip:Vector3,base:Vector3,tip:Vector3,a:Vector3,b:Vector3,radius:number){
  // Boundary segments plus intermediate blade samples cover the swept ribbon's interior.
  if(this.segmentDistanceSq(base,tip,a,b)<=radius*radius||this.segmentDistanceSq(previousBase,previousTip,a,b)<=radius*radius||
     this.segmentDistanceSq(previousTip,tip,a,b)<=radius*radius||this.segmentDistanceSq(previousBase,base,a,b)<=radius*radius)return true;
  for(let i=1;i<4;i++){
   const t=i/4;
   this.sampleA.copy(previousBase).lerp(previousTip,t);this.sampleB.copy(base).lerp(tip,t);
   if(this.segmentDistanceSq(this.sampleA,this.sampleB,a,b)<=radius*radius)return true;
  }
  return false;
 }
 private sampleA=new Vector3();private sampleB=new Vector3();
}
