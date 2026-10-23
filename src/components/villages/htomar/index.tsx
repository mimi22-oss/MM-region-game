import { htomarVillage, htomarLandmarks, htomarCampusFeatures, htomarRoadsideShops } from '../../../data/villages/htomar';
import { MainRoad } from '../../MainRoad';
import { Lanes } from '../../Lane';
import { Field } from '../../Field';
import { House, houseFenceBounds, houseVisualRotation } from '../../House';
import { Tree } from '../../Tree';
import { Block } from '../../Primitives';

/**
 * ထိုမာကျေးရွာ (Htomar Village) + Technological University, Kalay + GTHS (Khamtee) + လမ်းမဘေးဆိုင်များ — 3D Scene Component
 */
export function HtomarVillage(){
 const cf=htomarCampusFeatures;
 const residentialHouses=htomarVillage.houses.filter(h=>!h.id.startsWith('htomar-campus-')&&!h.id.startsWith('htomar-shop-'));
 const campusBuildings=htomarVillage.houses.filter(h=>h.id.startsWith('htomar-campus-'));
 return <group name="village-htomar">
  {htomarVillage.separationFields.map((f,i)=><Field key={f.id??`ht-sep-${i}`} f={f} bunded/>)}
  {htomarLandmarks.map(m=><group key={m.id} position={[m.x,0,m.z]} rotation={[0,m.rotation,0]}>
   <Block y={0.015} w={m.width} h={0.03} d={m.depth} color="#b9b08a"/>
  </group>)}
  {/* GTHS Khamtee အားကစားကွင်း၊ TU Kalay ရှေ့ရင်ပြင်၊ အဝိုင်းပတ်နှင့် အလယ်မြက်ခင်းပြင် */}
  <group position={[cf.gthsField.x,0,cf.gthsField.z]} rotation={[0,cf.gthsField.rotation,0]}>
   <Block y={0.03} w={cf.gthsField.width} h={0.05} d={cf.gthsField.depth} color="#8a9968"/>
  </group>
  <group position={[cf.tuFrontPlaza.x,0,cf.tuFrontPlaza.z]} rotation={[0,cf.tuFrontPlaza.rotation,0]}>
   <Block y={0.04} w={cf.tuFrontPlaza.width} h={0.06} d={cf.tuFrontPlaza.depth} color="#d4c9ad"/>
  </group>
  <group position={[cf.tuRoundabout.x,0,cf.tuRoundabout.z]}>
   <mesh position={[0,0.06,0]} receiveShadow><cylinderGeometry args={[cf.tuRoundabout.radius,cf.tuRoundabout.radius,0.1,24]}/><meshStandardMaterial color="#c9be9f"/></mesh>
   <mesh position={[0,0.18,0]} receiveShadow><cylinderGeometry args={[cf.tuRoundabout.radius*0.48,cf.tuRoundabout.radius*0.52,0.22,20]}/><meshStandardMaterial color="#678a56"/></mesh>
  </group>
  <group position={[cf.tuCourtyard.x,0,cf.tuCourtyard.z]} rotation={[0,cf.tuCourtyard.rotation,0]}>
   <Block y={0.03} w={cf.tuCourtyard.width} h={0.05} d={cf.tuCourtyard.depth} color="#6d8c57"/>
  </group>
  <MainRoad roads={htomarVillage.roads}/>
  <Lanes roads={htomarVillage.roads}/>
  {htomarVillage.fields.map((f,i)=><Field key={f.id??`ht-f-${i}`} f={f} bunded/>)}
  {htomarVillage.bundedFields.map((f,i)=><Field key={f.id??`ht-bf-${i}`} f={f} bunded/>)}
  {residentialHouses.map(h=><House key={h.id} h={h}/>)}
  {/* AH1 အရှေ့ဘက် လယ်ကွင်း ၅ ကွင်းနှင့် မိန်းလမ်းမကြီးကြားရှိ စားသောက်ဆိုင် ၄ ဆိုင်၊ လက်ဖက်ရည်ဆိုင် ၂ ဆိုင်နှင့် ကွမ်းယာဆိုင် ၁ ဆိုင် */}
  {htomarRoadsideShops.map(shop=>{
   if(shop.shopType==='betel'){
    return <group key={shop.id} position={[shop.x,0,shop.z]} rotation={[0,shop.rotation,0]}>
     <Block y={0.08} w={shop.width+0.8} h={0.16} d={shop.depth+0.8} color="#c2b598"/>
     <Block y={1.1} w={shop.width} h={1.9} d={shop.depth} color={shop.color}/>
     <Block y={1.35} z={shop.depth/2+0.12} w={shop.width*0.75} h={0.75} d={0.22} color="#a8d5db"/>
     <Block y={2.25} z={0.3} w={shop.width+1.2} h={0.18} d={shop.depth+1.4} color={shop.roof}/>
     <Block y={2.6} z={shop.depth/2+0.45} w={shop.width*0.9} h={0.42} d={0.12} color="#d9822b"/>
    </group>;
   }
   const isTea=shop.shopType==='teashop';
   return <group key={shop.id} position={[shop.x,0,shop.z]} rotation={[0,shop.rotation,0]}>
    <Block y={0.06} w={shop.width+2.4} h={0.12} d={shop.depth+4.2} color="#cbbd9d"/>
    <Block y={2.1} w={shop.width} h={4} d={shop.depth} color={shop.color}/>
    <Block y={4.4} w={shop.width+1.2} h={0.3} d={shop.depth+1.2} color={shop.roof}/>
    {/* ရှေ့ဖက် အမိုးဆင့် (Awning) နှင့် ဆိုင်းဘုတ် */}
    <Block y={3.1} z={shop.depth/2+1.3} w={shop.width+0.8} h={0.16} d={2.6} color={isTea?'#3b6e5c':'#c45b3e'}/>
    <Block y={3.65} z={shop.depth/2+2.45} w={shop.width*0.85} h={0.65} d={0.14} color={isTea?'#2a5c8a':'#b83b2b'}/>
    {/* ရှေ့ဝရန်တာ စားပွဲဝိုင်းလေးများ */}
    {[-shop.width*0.26,shop.width*0.26].map((tx,ti)=><group key={ti} position={[tx,0,shop.depth/2+1.3]}>
     <Block y={0.45} w={1.1} h={0.75} d={1.1} color="#8c6747"/>
    </group>)}
   </group>;
  })}
  {campusBuildings.map(b=><group key={b.id} position={[b.x,0,b.z]} rotation={[0,b.rotation,0]}>
   <Block y={0.25} w={b.width+1.6} h={0.5} d={b.depth+1.6} color="#cfc4a9"/>
   <Block y={4.2} w={b.width} h={7.4} d={b.depth} color={b.color}/>
   {[-1,1].map(s=><mesh key={s} position={[s*b.width/4,8.9,0]} rotation={[0,0,-s*Math.atan2(2.2,b.width/2)]} castShadow><boxGeometry args={[Math.hypot(b.width/2,2.2)+1.4,0.24,b.depth+1.8]}/><meshStandardMaterial color={b.roof}/></mesh>)}
  </group>)}
  {htomarVillage.largeTrees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="large"/>)}
  {htomarVillage.trees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="canopy"/>)}
  {htomarVillage.farmTrees.map(t=><Tree key={t.id} t={t} variant="farm"/>)}
 </group>;
}

/** ထိုမာကျေးရွာ (Htomar Village) — 2D Map Plan SVG Component */
export function HtomarVillagePlan({labels,onSelectLocation}:{labels:boolean;onSelectLocation?:(id:string)=>void}){
 const cf=htomarCampusFeatures;
 const residentialHouses=htomarVillage.houses.filter(h=>!h.id.startsWith('htomar-campus-')&&!h.id.startsWith('htomar-shop-'));
 const campusBuildings=htomarVillage.houses.filter(h=>h.id.startsWith('htomar-campus-'));
 return <g id="village-htomar-plan" className={labels?"map-region-clickable":undefined} onClick={labels&&onSelectLocation?e=>{e.stopPropagation();onSelectLocation('htomar');}:undefined}>
  {htomarVillage.separationFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {htomarLandmarks.map(m=><rect key={m.id} x={m.x-m.width/2} y={m.z-m.depth/2} width={m.width} height={m.depth} fill="#b9b08a" stroke="#8a7f5d" strokeWidth="0.9" transform={`rotate(${-m.rotation*180/Math.PI} ${m.x} ${m.z})`}/>)}
  <rect x={cf.gthsField.x-cf.gthsField.width/2} y={cf.gthsField.z-cf.gthsField.depth/2} width={cf.gthsField.width} height={cf.gthsField.depth} fill="#8a9968" stroke="#c9bf96" strokeWidth="0.7" transform={`rotate(${-cf.gthsField.rotation*180/Math.PI} ${cf.gthsField.x} ${cf.gthsField.z})`}/>
  <rect x={cf.tuFrontPlaza.x-cf.tuFrontPlaza.width/2} y={cf.tuFrontPlaza.z-cf.tuFrontPlaza.depth/2} width={cf.tuFrontPlaza.width} height={cf.tuFrontPlaza.depth} fill="#d4c9ad" transform={`rotate(${-cf.tuFrontPlaza.rotation*180/Math.PI} ${cf.tuFrontPlaza.x} ${cf.tuFrontPlaza.z})`}/>
  <circle cx={cf.tuRoundabout.x} cy={cf.tuRoundabout.z} r={cf.tuRoundabout.radius} fill="#c9be9f" stroke="#7d7560" strokeWidth="0.8"/>
  <circle cx={cf.tuRoundabout.x} cy={cf.tuRoundabout.z} r={cf.tuRoundabout.radius*0.48} fill="#678a56"/>
  <rect x={cf.tuCourtyard.x-cf.tuCourtyard.width/2} y={cf.tuCourtyard.z-cf.tuCourtyard.depth/2} width={cf.tuCourtyard.width} height={cf.tuCourtyard.depth} fill="#6d8c57" transform={`rotate(${-cf.tuCourtyard.rotation*180/Math.PI} ${cf.tuCourtyard.x} ${cf.tuCourtyard.z})`}/>
  {htomarVillage.bundedFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {htomarVillage.fields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.8" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {htomarVillage.roads.map(r=><rect key={r.id} x={r.x-r.width/2} y={r.z-r.depth/2} width={r.width} height={r.depth} fill={r.main?'#657371':'#d4bd98'} transform={`rotate(${-r.rotation*180/Math.PI} ${r.x} ${r.z})`}/>)}
  {campusBuildings.map(b=><rect key={b.id} x={b.x-b.width/2} y={b.z-b.depth/2} width={b.width} height={b.depth} fill={b.roof} stroke="#efe6d0" strokeWidth="0.7" transform={`rotate(${-b.rotation*180/Math.PI} ${b.x} ${b.z})`}/>)}
  {htomarRoadsideShops.map(s=><rect key={s.id} x={s.x-s.width/2} y={s.z-s.depth/2} width={s.width} height={s.depth} fill={s.roof} stroke="#fff3d1" strokeWidth="0.8" transform={`rotate(${-s.rotation*180/Math.PI} ${s.x} ${s.z})`}/>)}
  {residentialHouses.map(h=>{
   const {sideHalf,backHalf,frontHalf}=houseFenceBounds(h);
   const rot=houseVisualRotation(h);
   return <g key={h.id}>
    <g transform={`translate(${h.x} ${h.z}) rotate(${-rot*180/Math.PI})`}>
     <line x1={-sideHalf} y1={-backHalf} x2={-sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8"/>
     <line x1={sideHalf} y1={-backHalf} x2={sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8"/>
     <line x1={-sideHalf} y1={frontHalf} x2={-1.3} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1"/>
     <line x1={1.3} y1={frontHalf} x2={sideHalf} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1"/>
     <rect x={-h.width/2} y={-h.depth/2} width={h.width} height={h.depth} fill={h.roof}/>
    </g>
   </g>;
  })}
  {htomarVillage.farmTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="2.4" fill="#547b48"/>)}
  {htomarVillage.trees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="5.8" fill="#365a42"/>)}
  {htomarVillage.largeTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="6.5" fill="#486e40" stroke="#739451" strokeWidth="0.6"/>)}
  {labels&&<>
   <text x={htomarVillage.labelPos.x} y={htomarVillage.labelPos.z} textAnchor="middle" fontSize="14" fill="#fff9dc" stroke="#173d35" strokeWidth="0.45">{htomarVillage.name} ↗</text>
   {htomarLandmarks.map(m=><text key={m.id} x={m.x} y={m.z-10} textAnchor="middle" fontSize="9.5" fill="#fff6d6" stroke="#2d3b36" strokeWidth="0.35">{m.name}</text>)}
   {htomarRoadsideShops.map(s=><text key={s.id} x={s.x} y={s.z-6} textAnchor="middle" fontSize="6.5" fill="#fff9dc" stroke="#2d3b36" strokeWidth="0.25">{s.name}</text>)}
  </>}
 </g>;
}
