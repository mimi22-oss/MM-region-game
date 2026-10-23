import { zingalinVillage, zeeChaungStream, zingalinMonasteries } from '../../../data/villages/zingalin';
import { MainRoad } from '../../MainRoad';
import { Lanes } from '../../Lane';
import { Field } from '../../Field';
import { PolylineCanal } from '../../Canal';
import { House, houseFenceBounds, houseVisualRotation } from '../../House';
import { Tree } from '../../Tree';
import { Block } from '../../Primitives';

/**
 * ဇင်းကလင်းကျေးရွာ (Zingalin Village) — 3D Scene Component
 * ချင်းဆိုင်ရွာနှင့် ဇင်းကလင်းရွာကြား လယ်ကွင်းများ (`separationFields`)၊
 * ဇီးချောင်း (`PolylineCanal`)၊ ဇေတဝန်ကျောင်းတိုက်နှင့်
 * ဇင်းကလင်းကျေးရွာ (`MainRoad`, `Lanes`, `Field`, `House`, `Tree`) တို့ကို ပြန်လည်အသုံးပြုထားပါသည်။
 */
export function ZingalinVillage(){
 return <group name="village-zingalin">
  {zingalinVillage.separationFields.map((f,i)=><Field key={f.id??`zg-sep-${i}`} f={f} bunded/>)}
  <PolylineCanal p={zeeChaungStream}/>
  {zingalinMonasteries.map(m=><group key={m.id} position={[m.x,0,m.z]} rotation={[0,m.rotation,0]}>
   <Block y={0.02} w={m.width} h={0.04} d={m.depth} color="#b9b08a"/>
  </group>)}
  <MainRoad roads={zingalinVillage.roads}/>
  <Lanes roads={zingalinVillage.roads}/>
  {zingalinVillage.fields.map((f,i)=><Field key={f.id??`zg-f-${i}`} f={f}/>)}
  {zingalinVillage.bundedFields.map((f,i)=><Field key={f.id??`zg-bf-${i}`} f={f} bunded/>)}
  {zingalinVillage.houses.map(h=><House key={h.id} h={h}/>)}
  {zingalinVillage.largeTrees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="large"/>)}
  {zingalinVillage.trees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="canopy"/>)}
  {zingalinVillage.farmTrees.map(t=><Tree key={t.id} t={t} variant="farm"/>)}
 </group>;
}

/** ဇင်းကလင်းကျေးရွာ (Zingalin Village) — 2D Map Plan SVG Component */
export function ZingalinVillagePlan({labels,onSelectLocation}:{labels:boolean;onSelectLocation?:(id:string)=>void}){
 const wc=zeeChaungStream;
 return <g id="village-zingalin-plan" className={labels?"map-region-clickable":undefined} onClick={labels&&onSelectLocation?e=>{e.stopPropagation();onSelectLocation('zingalin');}:undefined}>
  {zingalinVillage.separationFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  <g transform={`rotate(${-wc.rotation*180/Math.PI})`}>
   <polyline points={wc.points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#4d9395" strokeWidth={wc.depth} strokeLinejoin="round" strokeLinecap="round"/>
   {wc.bridges.map((b,i)=><rect key={i} x={b.u-b.width/2} y={b.v-b.depth/2} width={b.width} height={b.depth} fill="#b7ad95"/>)}
  </g>
  {zingalinMonasteries.map(m=><rect key={m.id} x={m.x-m.width/2} y={m.z-m.depth/2} width={m.width} height={m.depth} fill="#b9b08a" stroke="#8a7f5d" strokeWidth="0.8" transform={`rotate(${-m.rotation*180/Math.PI} ${m.x} ${m.z})`}/>)}
  {zingalinVillage.bundedFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {zingalinVillage.fields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {zingalinVillage.roads.map(r=><rect key={r.id} x={r.x-r.width/2} y={r.z-r.depth/2} width={r.width} height={r.depth} fill={r.main?'#657371':'#d4bd98'} transform={`rotate(${-r.rotation*180/Math.PI} ${r.x} ${r.z})`}/>)}
  {zingalinVillage.houses.map(h=>{
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
  {zingalinVillage.farmTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="2.4" fill="#547b48"/>)}
  {zingalinVillage.trees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="5.8" fill="#365a42"/>)}
  {zingalinVillage.largeTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="6.5" fill="#486e40" stroke="#739451" strokeWidth="0.6"/>)}
  {labels&&<>
   <text x={zingalinVillage.labelPos.x} y={zingalinVillage.labelPos.z} textAnchor="middle" fontSize="14" fill="#fff9dc" stroke="#173d35" strokeWidth="0.45">{zingalinVillage.name} ↗</text>
   {zingalinMonasteries.map(m=><text key={m.id} x={m.x} y={m.z-10} textAnchor="middle" fontSize="9.5" fill="#fff6d6" stroke="#2d3b36" strokeWidth="0.35">{m.name}</text>)}
  </>}
 </g>;
}

