import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,CanvasTexture,DoubleSide,InstancedMesh,Object3D,Sprite,SpriteMaterial,SRGBColorSpace} from 'three';
import {combatEffects,playerCombat} from '../../game/combat/combatRuntime';
import {useQualityPreset} from '../../game/qualityPreset';

const DAMAGE_POPUP_DURATION_SEC = 1.05;

interface PopupSpriteSlot {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  texture: CanvasTexture;
  material: SpriteMaterial;
  lastRenderedKey: string;
}

function paintDamageText(slot: PopupSpriteSlot, text: string, critical: boolean) {
  const { canvas, ctx, texture } = slot;
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.font = critical
    ? '900 54px "Noto Sans Myanmar", system-ui, -apple-system, sans-serif'
    : '900 48px "Noto Sans Myanmar", system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.54;

  // Crisp game-style dark drop shadow & outline
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = critical ? '#450a0a' : '#1f0710';
  ctx.strokeText(text, cx, cy);

  // Glowing vertical fill gradient
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const grad = ctx.createLinearGradient(0, cy - 26, 0, cy + 26);
  if (critical) {
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.55, '#fb923c');
    grad.addColorStop(1, '#ef4444');
  } else {
    grad.addColorStop(0, '#fff1f2');
    grad.addColorStop(0.5, '#fb7185');
    grad.addColorStop(1, '#e11d48');
  }
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, cy);
  ctx.restore();
  texture.needsUpdate = true;
}

/** Pooled combat VFX: swept fire ribbon, sparks/mist, impact flashes, and floating game-style damage numbers (-10 HP). */
export function SwordCombatVFX(){
 const quality=useQualityPreset(),low=quality.id==='mobile'||quality.id==='low';
 const flash=useRef<InstancedMesh>(null);
 const popupSpriteRefs=useRef<Array<Sprite|null>>([]);
 const pool=useMemo(()=>{
  const ribbon=new BufferGeometry(),points=new BufferGeometry();
  ribbon.setAttribute('position',new BufferAttribute(new Float32Array(48*18),3));ribbon.setAttribute('color',new BufferAttribute(new Float32Array(48*18),3));
  points.setAttribute('position',new BufferAttribute(new Float32Array(8*16*3),3));points.setAttribute('color',new BufferAttribute(new Float32Array(8*16*3),3));
  const popupSlots: PopupSpriteSlot[] = Array.from({ length: combatEffects.damagePopups.length }, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    return { canvas, ctx, texture, material, lastRenderedKey: '' };
  });
  return {ribbon,points,matrix:new Object3D(),popupSlots};
 },[]);
 useEffect(()=>()=>{
  pool.ribbon.dispose();pool.points.dispose();
  for(const slot of pool.popupSlots){slot.texture.dispose();slot.material.dispose();}
  for(const t of combatEffects.trail)t.at=-100;
  for(const p of combatEffects.impacts)p.at=-100;
  for(const d of combatEffects.damagePopups)d.at=-100;
 },[pool]);
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

  // Update floating RPG-style "-10 HP" damage numbers
  for(let i=0;i<combatEffects.damagePopups.length;i++){
   const popup=combatEffects.damagePopups[i];
   const sprite=popupSpriteRefs.current[i];
   const slot=pool.popupSlots[i];
   if(!sprite||!slot)continue;
   const age=now-popup.at;
   const live=age>=0&&age<DAMAGE_POPUP_DURATION_SEC;
   sprite.visible=live;
   if(!live)continue;
   const key=`${popup.at}:${popup.text}:${popup.critical?1:0}`;
   if(slot.lastRenderedKey!==key){
    slot.lastRenderedKey=key;
    paintDamageText(slot,popup.text,popup.critical);
   }
   const t=age/DAMAGE_POPUP_DURATION_SEC;
   // Quick bounce pop-in then gentle float upward & fade out
   const popScale=t<0.14?0.65+(t/0.14)*0.55:t<0.28?1.2-((t-0.14)/0.14)*0.18:1.02;
   const baseW=popup.critical?1.95:1.55;
   const baseH=popup.critical?0.58:0.46;
   sprite.scale.set(baseW*popScale,baseH*popScale,1);
   const driftX=Math.sin(popup.seed*1.7)*0.22*t;
   const driftZ=Math.cos(popup.seed*2.3)*0.22*t;
   const floatY=0.25+age*1.15-age*age*0.28;
   sprite.position.set(popup.position.x+driftX,popup.position.y+floatY,popup.position.z+driftZ);
   slot.material.opacity=t<0.6?1:Math.max(0,1-(t-0.6)/0.4);
  }
 });
 return <group name="sword-combat-vfx" userData={{cameraIgnore:true}}>
  <mesh geometry={pool.ribbon} frustumCulled={false} userData={{cameraIgnore:true}}><meshBasicMaterial vertexColors transparent blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false}/></mesh>
  <points geometry={pool.points} frustumCulled={false} userData={{cameraIgnore:true}}><pointsMaterial vertexColors size={low?.08:.11} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></points>
  <instancedMesh ref={flash} args={[undefined,undefined,8]} frustumCulled={false} userData={{cameraIgnore:true}}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color="#fff1b0" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></instancedMesh>
  {pool.popupSlots.map((slot,i)=>(
   <sprite
    key={i}
    ref={el=>{popupSpriteRefs.current[i]=el;}}
    material={slot.material}
    userData={{cameraIgnore:true}}
    visible={false}
    renderOrder={24}
    frustumCulled={false}
   />
  ))}
 </group>;
}
