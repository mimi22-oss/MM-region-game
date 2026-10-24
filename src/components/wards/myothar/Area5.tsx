import { ParkedCars, ParkedCarsPlan } from '../../Car';
import { ParkedMotorcycle } from '../../Motorcycle';
import { MOTORCYCLE_X, MOTORCYCLE_Z, MOTORCYCLE_YAW } from '../../../data/motorcycle';
import { area5, farmhouse, toWorld } from '../../../data/wards/myothar/area5';
import { House, FARMHOUSE_NAME, houseFenceBounds, houseVisualRotation } from '../../House';
import { Farmhouse } from '../../Farmhouse';
import { UShweHouse, U_SHWE_HOUSE_ID } from '../../ushwehouse';
import { KalaySignboard, KALAY_SIGN_HOUSE_ID, KALAY_SIGN_ROTATION } from '../../KalaySignboard';
import { ToiletBlock, TOIL_X, TOIL_Z, TOIL_ROT } from '../../ToiletBlock';
import { WaterPump, PUMP_X, PUMP_Z, PUMP_ROT } from '../../WaterPump';
import { HandPumpLongSpout } from '../../HandPumpLongSpout';
import { HAND_PUMP_X, HAND_PUMP_Z, HAND_PUMP_ROT, SPOUT_LENGTH, SPOUT_END_X, SPOUT_END_Z, DRAIN_END_X, DRAIN_END_Z } from '../../../data/handPumpLongSpout';
import { MangoTrees } from '../../MangoTrees';
import { TamarindTrees } from '../../TamarindTrees';
import { tamarindTrees } from '../../../data/tamarindTrees';
import { mangoTrees } from '../../../data/mangoTrees';
import { MainRoad } from '../../MainRoad';
import { Lanes } from '../../Lane';
import { Trees } from '../../Tree';
import { Canal } from '../../Canal';
import { Fields } from '../../Field';
import { Mountains, WesternLandscapePlan } from '../../Mountains';
import { Monastery, OpenGround, RiceMill } from '../../Landmarks';
import { RiceMillPlan } from '../../RiceMillPlan';
import { Warehouses } from './Warehouses';
import { FootballPitch } from './FootballPitch';

export { Warehouses, FootballPitch };

/** မြို့သာရပ်ကွက် · နယ်မြေ (၅) — 3D Scene Component */
export function Area5(){
 return <group name="myothar-area-5">
  <Warehouses/>
  <FootballPitch/>
  <Canal/>
  <Farmhouse/>
  <UShweHouse/>
  <KalaySignboard/>
  <ToiletBlock/>
  <MangoTrees/>
  <TamarindTrees/>
  <WaterPump/>
  <HandPumpLongSpout/>
  <OpenGround/>
  <Monastery/>
  <RiceMill/>
  <Fields/>
  <MainRoad/>
  <Lanes/>
  {area5.houses.filter(h=>h.id!==farmhouse.id&&h.id!==U_SHWE_HOUSE_ID&&h.id!==KALAY_SIGN_HOUSE_ID).map(h=><House key={h.id} h={h}/>)}
  <Trees/>
  <ParkedCars/>
  <ParkedMotorcycle/>
 </group>;
}

/** မြို့သာရပ်ကွက် · နယ်မြေ (၅) — 2D Map Plan SVG Component */
export function Area5Plan({labels,onSelectLocation}:{labels:boolean;onSelectLocation?:(id:string)=>void}){
 const areaLabelPos=toWorld(-45,195);
 return <g id="myothar-area-5-plan"><ParkedCarsPlan/>
  <WesternLandscapePlan/>
  <g className={labels?"map-region-clickable":undefined} onClick={labels&&onSelectLocation?e=>{e.stopPropagation();onSelectLocation('myothar-area-5');}:undefined}>
  {area5.fields.map((f,i)=><rect key={`f${i}`} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {area5.roads.map(r=><rect key={r.id} x={r.x-r.width/2} y={r.z-r.depth/2} width={r.width} height={r.depth} fill={r.main?'#657371':'#d4bd98'} transform={`rotate(${-r.rotation*180/Math.PI} ${r.x} ${r.z})`}/>)}
  <g transform={`translate(${area5.openGround.x} ${area5.openGround.z}) rotate(${-area5.openGround.rotation*180/Math.PI})`}>
   <rect x={-area5.openGround.width/2} y={-area5.openGround.depth/2} width={area5.openGround.width} height={area5.openGround.depth} fill="#b8ac83"/>
   {labels&&<text textAnchor="middle" fontSize="7">ကွက်လပ်ပြင်ကြီး</text>}
  </g>
  <g transform={`translate(${area5.pitch.x} ${area5.pitch.z}) rotate(${-area5.pitch.rotation*180/Math.PI})`}>
   <rect x="-30" y="-48" width="60" height="96" fill="#668b50" stroke="#eee9d2"/>
   <path d="M-30 0H30" stroke="#eee9d2"/>
   <circle r="9" fill="none" stroke="#eee9d2"/>
   {labels&&<text y="20" textAnchor="middle" fontSize="6" fill="#fff">ဘောလုံးကွင်း</text>}
  </g>
  {area5.warehouses.map(w=><rect key={w.id} x={w.x-w.width/2} y={w.z-w.depth/2} width={w.width} height={w.depth} fill={w.roof} stroke="#e1d5bb" transform={`rotate(${-w.rotation*180/Math.PI} ${w.x} ${w.z})`}/>)}
  <g transform={`translate(${area5.frontLot.x} ${area5.frontLot.z}) rotate(${-area5.frontLot.rotation*180/Math.PI})`}>
   <rect x={-area5.frontLot.width/2} y={-area5.frontLot.depth/2} width={area5.frontLot.width} height={area5.frontLot.depth} fill="#c1b590"/>
   <line x1={area5.frontLot.width/2} y1={-area5.frontLot.depth/2} x2={area5.frontLot.width/2} y2={-1.7} stroke="#2563a6" strokeWidth="1.2"/>
   <line x1={area5.frontLot.width/2} y1={1.7} x2={area5.frontLot.width/2} y2={area5.frontLot.depth/2} stroke="#2563a6" strokeWidth="1.2"/>
   {labels&&<text textAnchor="middle" fontSize="5">မြေကွက်လပ်</text>}
  </g>
  <g transform={`translate(${area5.farmNorthLand.x} ${area5.farmNorthLand.z}) rotate(${-area5.farmNorthLand.rotation*180/Math.PI})`}>
   <rect x="-32" y="-18" width="64" height="36" fill="#b1b77c" stroke="#d8c68b"/>
   {labels&&<text textAnchor="middle" fontSize="4.5">{area5.farmNorthLand.owner}</text>}
  </g>
  {area5.sideLots.map((l,i)=><g key={`empty${i}`} transform={`translate(${l.x} ${l.z}) rotate(${-l.rotation*180/Math.PI})`}>
   <rect x={-l.width/2} y={-l.depth/2} width={l.width} height={l.depth} fill="#c1b590" stroke="#d8c68b"/>
   {labels&&<text textAnchor="middle" fontSize="3">မြေကွက်လပ်</text>}
  </g>)}
  {area5.roads.filter(r=>r.id==='farmhouse-access').map(r=><rect key={r.id} x={r.x-r.width/2} y={r.z-r.depth/2} width={r.width} height={r.depth} fill="#d4bd98" transform={`rotate(${-r.rotation*180/Math.PI} ${r.x} ${r.z})`}/>)}
  {[area5.canal,...area5.drains].map((c,i)=><g key={`canal${i}`} transform={`translate(${c.x} ${c.z}) rotate(${-c.rotation*180/Math.PI})`}>
   <rect x={-c.width/2} y={-c.depth/2} width={c.width} height={c.depth} fill="#4d9395"/>
   {c.bridges.map(v=><rect key={v} x={-c.width/2-1} y={v-2.5} width={c.width+2} height="5" fill="#d6cfb9"/>)}
  </g>)}
  {[...area5.yards,area5.farm].map((p,i)=><rect key={`plot${i}`} x={p.x-p.width/2} y={p.z-p.depth/2} width={p.width} height={p.depth} fill={i<area5.yards.length?'#b7ad83':'#a6a66e'} stroke="#8b9367" transform={`rotate(${-p.rotation*180/Math.PI} ${p.x} ${p.z})`}/>)}
  <rect x={area5.pond.x-area5.pond.width/2} y={area5.pond.z-area5.pond.depth/2} width={area5.pond.width} height={area5.pond.depth} fill="#548f94" stroke="#97825c" strokeWidth="2" transform={`rotate(${-area5.pond.rotation*180/Math.PI} ${area5.pond.x} ${area5.pond.z})`}/>
  {area5.farmTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="2.4" fill="#547b48"/>)}
       {mangoTrees.map(t=><g key={t.id}>
     <circle cx={t.x} cy={t.z} r="2.8" fill="#356530" stroke="#234720" strokeWidth="0.3"/>
     <circle cx={t.x+0.7} cy={t.z-0.6} r="0.75" fill="#f59e0b"/>
     <circle cx={t.x-0.6} cy={t.z+0.7} r="0.75" fill="#f97316"/>
    </g>)}
    {tamarindTrees.map(t=><g key={t.id}>
     <circle cx={t.x} cy={t.z} r="3.2" fill="#386630" stroke="#22451e" strokeWidth="0.35"/>
     <circle cx={t.x+0.8} cy={t.z-0.7} r="0.7" fill="#8b572a"/>
     <circle cx={t.x-0.7} cy={t.z+0.8} r="0.7" fill="#9c6331"/>
     <circle cx={t.x} cy={t.z+0.9} r="0.6" fill="#7a4b22"/>
    </g>)}
    {labels&&<text x="61.7" y="214.0" textAnchor="middle" fontSize="3.0" fill="#fff" stroke="#1c3d1f" strokeWidth="0.45">မန်ကျည်းပင်တန်း</text>}
   {labels&&<text x="85.7" y="298.5" textAnchor="middle" fontSize="3.2" fill="#fff" stroke="#1c3d1f" strokeWidth="0.45">သရက်ခြံ</text>}
   <g transform={'translate(' + PUMP_X + ' ' + PUMP_Z + ') rotate(' + (-(PUMP_ROT)*180/Math.PI) + ')'}>
    <rect x="-1.1" y="-1.0" width="2.2" height="2.0" fill="#a8a194" stroke="#716b60" strokeWidth="0.25"/>
    <circle cx="0.25" cy="-0.2" r="0.28" fill="#1b5e43"/>
    <circle cx="-0.45" cy="-0.2" r="0.2" fill="#235c4b"/>
    <circle cx="0.3" cy="0.45" r="0.48" fill="#3ba9be" opacity="0.8"/>
    {labels&&<text y="-0.4" textAnchor="middle" fontSize="1.6" fill="#1c382f">ရေစုပ်စက်</text>}
   </g>
   <g transform={'translate(' + TOIL_X + ' ' + TOIL_Z + ') rotate(' + (-(TOIL_ROT)*180/Math.PI) + ')'}>
    <rect x="-1.7" y="-1.1" width="3.4" height="2.2" fill="#d2c9b8" stroke="#716758" strokeWidth="0.3"/>
    <rect x="-1.28" y="-0.52" width="1.04" height="1.04" fill="#a8a194" stroke="#6b655a" strokeWidth="0.2"/>
    <rect x="0.24" y="-0.52" width="1.04" height="1.04" fill="#a8a194" stroke="#6b655a" strokeWidth="0.2"/>
    {labels&&<text y="0.5" textAnchor="middle" fontSize="1.8" fill="#1c382f">အိမ်သာ</text>}
   </g>
   <g transform={'translate(' + MOTORCYCLE_X + ' ' + MOTORCYCLE_Z + ') rotate(' + (-(MOTORCYCLE_YAW)*180/Math.PI) + ')'}>
    <rect x="-0.22" y="-0.75" width="0.44" height="1.5" rx="0.2" fill="#2196d2" stroke="#1773a5" strokeWidth="0.12"/>
    <circle cx="0" cy="-0.55" r="0.22" fill="#1e2024"/>
    <circle cx="0" cy="0.55" r="0.22" fill="#1e2024"/>
    <rect x="-0.15" y="-0.15" width="0.3" height="0.5" rx="0.08" fill="#1f2228"/>
    {labels&&<text y="-0.9" textAnchor="middle" fontSize="1.8" fill="#1773a5" fontWeight="bold">ဆိုင်ကယ်</text>}
   </g>
   <g transform={'translate(' + HAND_PUMP_X + ' ' + HAND_PUMP_Z + ') rotate(' + (-(HAND_PUMP_ROT)*180/Math.PI) + ')'}>
    <rect x="-0.7" y="-0.7" width="1.4" height="1.4" fill="#a8a194" stroke="#6b655a" strokeWidth="0.2"/>
    <circle cx="0" cy="0" r="0.28" fill="#1b5ea2"/>
    <line x1="0" y1="0" x2="0" y2={SPOUT_LENGTH} stroke="#1b5ea2" strokeWidth="0.45"/>
    <rect x="-0.8" y={SPOUT_LENGTH - 0.8} width="1.6" height="1.6" fill="#a8a194" stroke="#6b655a" strokeWidth="0.2"/>
    <circle cx="0" cy={SPOUT_LENGTH} r="0.55" fill="#3ba9be" opacity="0.85"/>
    {labels&&<text x="0" y="-1.0" textAnchor="middle" fontSize="1.8" fill="#164879" fontWeight="bold">လက်နှိပ်ဘုံဘိုင်</text>}
    </g>
    <line x1={SPOUT_END_X} y1={SPOUT_END_Z} x2={DRAIN_END_X} y2={DRAIN_END_Z} stroke="#3ba9be" strokeWidth="0.45"/>
  <g transform={`translate(${area5.monastery.x} ${area5.monastery.z}) rotate(${-area5.monastery.rotation*180/Math.PI})`}>
   <rect x="-48" y="-33" width="96" height="66" fill="#b9b08a" stroke="#eee2b8"/>
   {area5.monastery.buildings.map(b=><g key={b.id}>
    <rect x={b.u-b.width/2} y={b.v-b.depth/2} width={b.width} height={b.depth} fill={b.roof}/>
    {labels&&<text x={b.u} y={b.v} textAnchor="middle" fontSize="3.5" fill="#fff">{b.name}</text>}
   </g>)}
   {area5.monastery.stupas.map((p,i)=><circle key={i} cx={p.u} cy={p.v} r={p.radius} fill="#edc856"/>)}
   {labels&&<text x="0" y="-18" fontSize="5" textAnchor="middle">ကျောင်းဝင်း ကွင်းပြင်</text>}
  </g>
  <g transform={`rotate(${-area5.crossCanal.rotation*180/Math.PI})`}>
   <polyline points={area5.crossCanal.points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#4d9395" strokeWidth={area5.crossCanal.depth} strokeLinejoin="round" strokeLinecap="round"/>
   {area5.crossCanal.bridges.map((b,i)=><rect key={i} x={b.u-b.width/2} y={b.v-b.depth/2} width={b.width} height={b.depth} fill="#b7ad95"/>)}
  </g>
  <RiceMillPlan labels={labels}/>
  {area5.houses.map(h=>{
   const {sideHalf,backHalf,frontHalf}=houseFenceBounds(h);
   const rot = h.id === KALAY_SIGN_HOUSE_ID ? KALAY_SIGN_ROTATION : houseVisualRotation(h);
   return <g key={h.id}>
    <g transform={`translate(${h.x} ${h.z}) rotate(${-rot*180/Math.PI})`}>
     {h.id===KALAY_SIGN_HOUSE_ID?<>
      <circle cx="0" cy="0" r="4.2" fill="#497c36" stroke="#dde6cc" strokeWidth="0.3"/>
      <rect x="-2.8" y="-0.25" width="5.6" height="0.5" fill="#f5c518" rx="0.2"/>
      {[-1.65,1.65].map(px=><circle key={px} cx={px} cy="0" r="0.45" fill="#801424"/>)}
      {labels&&<text y="0.8" textAnchor="middle" fontSize="1.8" fill="#fff" stroke="#801424" strokeWidth="0.3">ကလေးမြို့</text>}
     </>:h.id===U_SHWE_HOUSE_ID?<>
      <line x1={-sideHalf} y1={-backHalf} x2={-sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8"/>
      <line x1={sideHalf} y1={-backHalf} x2={sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8"/>
      <rect x="-4.6" y="4.5" width="9.2" height="2.7" fill="#849699" stroke="#6b4c30" strokeWidth="0.2"/>
      <rect x="-3.8" y="5.4" width="2.8" height="0.7" fill="#6b4423"/>
      <circle cx="2.2" cy="5.85" r="0.6" fill="#8c6744"/>
      {labels&&<text y="6.1" textAnchor="middle" fontSize="1.8" fill="#fff" stroke="#1c3d1f" strokeWidth="0.3">ဦးရွှေ မုန့်ဆိုင်</text>}
     </>:h.name!==FARMHOUSE_NAME&&<>
      <line x1={-sideHalf} y1={-backHalf} x2={-sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8"/>
      <line x1={sideHalf} y1={-backHalf} x2={sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8"/>
      <line x1={-sideHalf} y1={frontHalf} x2={-1.3} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1"/>
      <line x1={1.3} y1={frontHalf} x2={sideHalf} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1"/>
     </>}
     <rect x={-h.width/2} y={-h.depth/2} width={h.width} height={h.depth} fill={h.roof}/>
    </g>
   </g>;
  })}
  {area5.trees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="5.8" fill="#365a42"/>)}
  {area5.largeTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="6.5" fill="#486e40" stroke="#739451" strokeWidth="0.6"/>)}
  <text x="55" y="-90" fontSize="15" fill="#fff">AH1</text>
  {labels&&<text x={areaLabelPos.x} y={areaLabelPos.z} textAnchor="middle" fontSize="14" fill="#fff9dc" stroke="#173d35" strokeWidth="0.45">မြို့သာ · {area5.name} ↗</text>}
  </g>
 </g>;
}
