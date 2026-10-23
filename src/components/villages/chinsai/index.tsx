import { chinSaiVillage, chinSaiMonasteries } from '../../../data/villages/chinsai';
import { MainRoad } from '../../MainRoad';
import { Lanes } from '../../Lane';
import { Field } from '../../Field';
import { House, houseFenceBounds, houseVisualRotation } from '../../House';
import { Tree } from '../../Tree';
import { Block } from '../../Primitives';

/**
 * ချင်းဆိုင်ရွာ (Chin Sai Village) — 3D Scene Component
 * သာစည်ရွာနှင့် ချင်းဆိုင်ရွာကြား လယ်ကွင်း ၃ ကွက် (`separationFields`)၊
 * မင်းကျောင်းကျောင်းတိုက်နှင့် ကမ္ဘာရန်ကင်းကျောင်းတိုက်၊
 * ချင်းဆိုင်ရွာ (`MainRoad`, `Lanes`, `Field`, `House`, `Tree`) တို့ကို ပြန်လည်အသုံးပြုထားပါသည်။
 */
export function ChinSaiVillage(){
 return <group name="village-chinsai">
  {chinSaiVillage.separationFields.map((f,i)=><Field key={f.id??`cs-sep-${i}`} f={f} bunded/>)}
  {chinSaiMonasteries.map(m=><group key={m.id} position={[m.x,0,m.z]} rotation={[0,m.rotation,0]}>
   <Block y={0.02} w={m.width} h={0.04} d={m.depth} color="#b9b08a"/>
  </group>)}
  <MainRoad roads={chinSaiVillage.roads}/>
  <Lanes roads={chinSaiVillage.roads}/>
  {chinSaiVillage.fields.map((f,i)=><Field key={f.id??`cs-f-${i}`} f={f}/>)}
  {chinSaiVillage.bundedFields.map((f,i)=><Field key={f.id??`cs-bf-${i}`} f={f} bunded/>)}
  {chinSaiVillage.houses.map(h=><House key={h.id} h={h}/>)}
  {chinSaiVillage.largeTrees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="large"/>)}
  {chinSaiVillage.trees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="canopy"/>)}
  {chinSaiVillage.farmTrees.map(t=><Tree key={t.id} t={t} variant="farm"/>)}
 </group>;
}

/** ချင်းဆိုင်ရွာ (Chin Sai Village) — 2D Map Plan SVG Component */
export function ChinSaiVillagePlan({labels,onSelectLocation}:{labels:boolean;onSelectLocation?:(id:string)=>void}){
 return <g id="village-chinsai-plan" className={labels?"map-region-clickable":undefined} onClick={labels&&onSelectLocation?e=>{e.stopPropagation();onSelectLocation('chinsai');}:undefined}>
  {chinSaiVillage.separationFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {chinSaiMonasteries.map(m=><rect key={m.id} x={m.x-m.width/2} y={m.z-m.depth/2} width={m.width} height={m.depth} fill="#b9b08a" stroke="#8a7f5d" strokeWidth="0.8" transform={`rotate(${-m.rotation*180/Math.PI} ${m.x} ${m.z})`}/>)}
  {chinSaiVillage.bundedFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {chinSaiVillage.fields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {chinSaiVillage.roads.map(r=><rect key={r.id} x={r.x-r.width/2} y={r.z-r.depth/2} width={r.width} height={r.depth} fill={r.main?'#657371':'#d4bd98'} transform={`rotate(${-r.rotation*180/Math.PI} ${r.x} ${r.z})`}/>)}
  {chinSaiVillage.houses.map(h=>{
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
  {chinSaiVillage.farmTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="2.4" fill="#547b48"/>)}
  {chinSaiVillage.trees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="5.8" fill="#365a42"/>)}
  {chinSaiVillage.largeTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="6.5" fill="#486e40" stroke="#739451" strokeWidth="0.6"/>)}
  {labels&&<>
   <text x={chinSaiVillage.labelPos.x} y={chinSaiVillage.labelPos.z} textAnchor="middle" fontSize="14" fill="#fff9dc" stroke="#173d35" strokeWidth="0.45">{chinSaiVillage.name} ↗</text>
   {chinSaiMonasteries.map(m=><text key={m.id} x={m.x} y={m.z-10} textAnchor="middle" fontSize="9.5" fill="#fff6d6" stroke="#2d3b36" strokeWidth="0.35">{m.name}</text>)}
  </>}
 </g>;
}
