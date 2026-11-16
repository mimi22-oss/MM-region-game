import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,DoubleSide,InstancedMesh,Object3D} from 'three';
import {combatEffects,playerCombat} from '../../game/combat/combatRuntime';
import {useQualityPreset} from '../../game/qualityPreset';

/** Three pooled draw calls: swept fire ribbon, sparks/mist, and impact flashes. */
export function SwordCombatVFX(){
 const quality=useQualityPreset(),low=quality.id==='mobile'||quality.id==='low';
 const flash=useRef<InstancedMesh>(null);
 const pool=useMemo(()=>{
  const ribbon=new BufferGeometry(),points=new BufferGeometry();
  ribbon.setAttribute('position',new BufferAttribute(new Float32Array(48*18),3));ribbon.setAttribute('color',new BufferAttribute(new Float32Array(48*18),3));
  points.setAttribute('position',new BufferAttribute(new Float32Array(8*16*3),3));points.setAttribute('color',new BufferAttribute(new Float32Array(8*16*3),3));
  return {ribbon,points,matrix:new Object3D()};
 },[]);
 useEffect(()=>()=>{pool.ribbon.dispose();pool.points.dispose();for(const t of combatEffects.trail)t.at=-100;for(const p of combatEffects.impacts)p.at=-100;},[pool]);
 useFrame((_,delta)=>{
  if(!playerCombat.paused&&!document.hidden)combatEffects.time+=Math.min(.25,delta);
 },-.6);
 useFrame(()=>{
  const now=combatEffects.time,rp=pool.ribbon.attributes.position as BufferAttribute,rc=pool.ribbon.attributes.color as BufferAttribute;
  let vertices=0;
  const samples=low?12:32;
  for(let i=1;i<samples;i++){
   const n=combatEffects.trail.length;
   const a=combatEffects.trail[(combatEffects.trailHead-i+n*2)%n],b=combatEffects.trail[(combatEffects.trailHead-i-1+n*2)%n];
   const age=now-a.at;if(age>.2||now-b.at>.2||a.sequence!==b.sequence)continue;
   for(let j=0;j<6;j++){
    const point=j===0||j===3?a.base:j===1?a.tip:j===2||j===4?b.tip:b.base;
    rp.setXYZ(vertices,point.x,point.y,point.z);
    const fade=Math.max(0,1-age/.2);rc.setXYZ(vertices,2*fade,(j%3===0?.15:.65)*fade,.03*fade);vertices++;
   }
  }
  pool.ribbon.setDrawRange(0,vertices);rp.needsUpdate=true;rc.needsUpdate=true;
  const pp=pool.points.attributes.position as BufferAttribute,pc=pool.points.attributes.color as BufferAttribute;
  let count=0;
  for(let i=0;i<combatEffects.impacts.length;i++){
   const p=combatEffects.impacts[i],age=now-p.at,live=age>=0&&age<.55;
   pool.matrix.position.copy(p.position);pool.matrix.scale.setScalar(live&&age<.12?.16*(1-age/.12):0);pool.matrix.updateMatrix();flash.current?.setMatrixAt(i,pool.matrix.matrix);
   if(!live)continue;
   const particles=low?6:16;
   for(let j=0;j<particles;j++){
    const a=(j*2.39996+p.seed)*1.13,speed=.6+(j%4)*.35,fade=1-age/.55;
    pp.setXYZ(count,p.position.x+Math.cos(a)*age*speed,p.position.y+(.5+j%3*.4)*age-age*age*1.5,p.position.z+Math.sin(a)*age*speed);
    pc.setXYZ(count,j%3===0?.6:2,j%3===0?.3:.8,j%3===0?1.5:.06);pc.setXYZ(count,pc.getX(count)*fade,pc.getY(count)*fade,pc.getZ(count)*fade);count++;
   }
  }
  pool.points.setDrawRange(0,count);pp.needsUpdate=true;pc.needsUpdate=true;
  if(flash.current)flash.current.instanceMatrix.needsUpdate=true;
 });
 return <group name="sword-combat-vfx">
  <mesh geometry={pool.ribbon} frustumCulled={false}><meshBasicMaterial vertexColors transparent blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false}/></mesh>
  <points geometry={pool.points} frustumCulled={false}><pointsMaterial vertexColors size={low?.08:.11} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></points>
  <instancedMesh ref={flash} args={[undefined,undefined,8]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color="#fff1b0" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></instancedMesh>
 </group>;
}
