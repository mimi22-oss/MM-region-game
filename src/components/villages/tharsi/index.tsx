import { tharSiVillage } from '../../../data/villages/tharsi';
import { MainRoad } from '../../MainRoad';
import { Lanes } from '../../Lane';
import { Field } from '../../Field';
import { PolylineCanal, EastWestCanal } from '../../Canal';
import { House, houseFenceBounds, houseVisualRotation } from '../../House';
import { Tree } from '../../Tree';

/**
 * သာစည်ရွာ (Thar Si Village) — 3D Scene Component
 * မြို့သာရပ်ကွက် နယ်မြေ (၅) နှင့် သာစည်ရွာကြား လယ်ကွင်း ၆ ကွက် (`separationFields`)၊
 * နယ်မြေ (၅) ရေမြောင်းဆုံမှ လယ်ကွင်းများ အနောက်ဘက်ကနေ ကွေ့ကောက်စီးဆင်းလာသော ရေမြောင်း (`PolylineCanal`)၊
 * လမ်းမကြီးကို ကန့်လန့်ဖြတ်သော အရှေ့-အနောက် ရေမြောင်း (`EastWestCanal`) နှင့်
 * သာစည်ရွာ (`MainRoad`, `Lanes`, `Field`, `House`, `Tree`) တို့ကို ပြန်လည်အသုံးပြုထားပါသည်။
 */
export function TharSiVillage(){
 return <group name="village-tharsi">
  {tharSiVillage.separationFields.map((f,i)=><Field key={f.id??`ts-sep-${i}`} f={f} bunded/>)}
  <PolylineCanal p={tharSiVillage.connectingCanal}/>
  <EastWestCanal c={tharSiVillage.canal}/>
  <MainRoad roads={tharSiVillage.roads}/>
  <Lanes roads={tharSiVillage.roads}/>
  {tharSiVillage.fields.map((f,i)=><Field key={f.id??`ts-f-${i}`} f={f}/>)}
  {tharSiVillage.bundedFields.map((f,i)=><Field key={f.id??`ts-bf-${i}`} f={f} bunded/>)}
  {tharSiVillage.houses.map(h=><House key={h.id} h={h}/>)}
  {tharSiVillage.largeTrees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="large"/>)}
  {tharSiVillage.trees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="canopy"/>)}
  {tharSiVillage.farmTrees.map(t=><Tree key={t.id} t={t} variant="farm"/>)}
 </group>;
}

/** သာစည်ရွာ (Thar Si Village) — 2D Map Plan SVG Component */
export function TharSiVillagePlan({labels}:{labels:boolean}){
 const wc=tharSiVillage.connectingCanal;
 const c=tharSiVillage.canal;
 return <g id="village-tharsi-plan">
  {tharSiVillage.separationFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  <g transform={`rotate(${-wc.rotation*180/Math.PI})`}>
   <polyline points={wc.points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#4d9395" strokeWidth={wc.depth} strokeLinejoin="round" strokeLinecap="round"/>
   {wc.bridges.map((b,i)=><rect key={i} x={b.u-b.width/2} y={b.v-b.depth/2} width={b.width} height={b.depth} fill="#b7ad95"/>)}
  </g>
  <g transform={`translate(${c.x} ${c.z}) rotate(${-(c.rotation+Math.PI/2)*180/Math.PI})`}>
   <rect x={-c.width/2} y={-c.depth/2} width={c.width} height={c.depth} fill="#4d9395"/>
   {c.bridges.map((b,i)=><rect key={i} x={-c.width/2-1} y={b.u-c.u-b.width/2} width={c.width+2} height={b.width} fill="#d6cfb9"/>)}
  </g>
  {tharSiVillage.bundedFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {tharSiVillage.fields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {tharSiVillage.roads.map(r=><rect key={r.id} x={r.x-r.width/2} y={r.z-r.depth/2} width={r.width} height={r.depth} fill={r.main?'#657371':'#d4bd98'} transform={`rotate(${-r.rotation*180/Math.PI} ${r.x} ${r.z})`}/>)}
  {tharSiVillage.houses.map(h=>{
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
  {tharSiVillage.farmTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="2.4" fill="#547b48"/>)}
  {tharSiVillage.trees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="5.8" fill="#365a42"/>)}
  {tharSiVillage.largeTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="6.5" fill="#486e40" stroke="#739451" strokeWidth="0.6"/>)}
  {labels&&<text x={tharSiVillage.labelPos.x} y={tharSiVillage.labelPos.z} textAnchor="middle" fontSize="14" fill="#fff9dc" stroke="#173d35" strokeWidth="0.45">{tharSiVillage.name}</text>}
 </g>;
}
