import { tharYarGoneVillage, tharYarGoneStream, tharYarGoneLandmarks, tharYarGoneLandmarkBuildings, type TharYarGoneLandmarkBuilding } from '../../../data/villages/tharyargone';
import { MainRoad } from '../../MainRoad';
import { Lanes } from '../../Lane';
import { Field } from '../../Field';
import { PolylineCanal } from '../../Canal';
import { House, houseFenceBounds, houseVisualRotation } from '../../House';
import { Tree } from '../../Tree';
import { Block } from '../../Primitives';

/** ဘုရားကျောင်းပေါ်ရှိ လက်ဝါးကပ်တိုင် */
function Cross({y}:{y:number}){
 return <group position={[0,y,0]}>
  <Block y={1.2} w={0.32} h={2.4} d={0.32} color="#e4c15a"/>
  <Block y={1.7} w={1.5} h={0.32} d={0.32} color="#e4c15a"/>
 </group>;
}

/** သာယာကုန်းကျေးရွာ၏ အထင်ကရ အဆောက်အအုံ တစ်ခုချင်းစီ (ဘုရားကျောင်း၊ ခေါင်းလောင်းစင်၊ ဟော်၊ တည်းခိုခန်း၊ ဆိုင်၊ ဆန်စက်) */
function LandmarkBuilding({b}:{b:TharYarGoneLandmarkBuilding}){
 const slope=(h:number)=>[-1,1].map(s=><mesh key={s} position={[s*b.width/4,h,0]} rotation={[0,0,-s*Math.atan2(2.2,b.width/2)]} castShadow><boxGeometry args={[Math.hypot(b.width/2,2.2)+1.4,0.24,b.depth+1.6]}/><meshStandardMaterial color={b.roof}/></mesh>);
 return <group position={[b.x,0,b.z]} rotation={[0,b.rotation,0]}>
  <Block y={0.2} w={b.width+1.8} h={0.4} d={b.depth+1.8} color="#cfc4a9"/>
  {b.kind==='tower'?<>
   <Block y={b.height/2} w={b.width} h={b.height} d={b.depth} color={b.color}/>
   <Block y={b.height-3} w={b.width+0.4} h={0.5} d={b.depth+0.4} color="#d7ccb2"/>
   <mesh position={[0,b.height+2.4,0]} castShadow><coneGeometry args={[b.width*0.78,4.8,4]}/><meshStandardMaterial color={b.roof}/></mesh>
   <Cross y={b.height+4.6}/>
  </>:<>
   <Block y={b.height/2} w={b.width} h={b.height} d={b.depth} color={b.color}/>
   {slope(b.height+1.1)}
   {b.kind==='church'&&<>
    {/* ဘုရားကျောင်း ဘေးပြတင်းပေါက်များနှင့် ရှေ့တံခါးကြီး */}
    {[-1,1].map(s=>[-5,0,5].map(zz=><Block key={`${s}${zz}`} x={s*(b.width/2+0.05)} y={4.2} z={zz} w={0.15} h={2.6} d={1.3} color="#4b6a85"/>))}
    <Block y={2.1} z={b.depth/2+0.08} w={2.6} h={3.8} d={0.15} color="#6b4a30"/>
    <Cross y={b.height+2.4}/>
   </>}
   {b.kind==='mill'&&<>
    <Block x={b.width/2-3} y={b.height+4} w={2.6} h={8} d={2.6} color="#8f8a82"/>
    <Block x={-b.width/4} y={b.height/2+0.5} z={b.depth/2+0.08} w={5} h={b.height-2} d={0.15} color="#6e6a5a"/>
   </>}
   {b.kind==='guesthouse'&&<Block y={b.height+0.4} z={b.depth/2+0.1} w={b.width*0.7} h={0.8} d={0.14} color="#2a5c8a"/>}
   {b.kind==='shop'&&<>
    <Block y={3.1} z={b.depth/2+1.2} w={b.width+0.8} h={0.16} d={2.4} color="#3b6e5c"/>
    <Block y={3.7} z={b.depth/2+2.3} w={b.width*0.85} h={0.6} d={0.14} color="#c45b3e"/>
   </>}
  </>}
 </group>;
}

/**
 * သာယာကုန်းကျေးရွာ (Thar Yar Gone Village) — 3D Scene Component
 * ထိုမာကျေးရွာနှင့်ကြား လယ်ကွင်း ၅၀ ကွင်း (`separationFields`)၊ အနောက်ဘက်စမ်းချောင်း (`PolylineCanal`)၊
 * ရွာအလည်တည့်တည့် St. Assumption Church ဘုရားကျောင်းနှင့် ရွာတွင်းလမ်းကွန်ရက် (`MainRoad`, `Lanes`, `Field`, `House`, `Tree`)
 */
export function TharYarGoneVillage(){
 const residentialHouses=tharYarGoneVillage.houses.filter(h=>!h.id.startsWith('tyg-landmark-'));
 return <group name="village-tharyargone">
  {tharYarGoneVillage.separationFields.map((f,i)=><Field key={f.id??`tyg-sep-${i}`} f={f} bunded/>)}
  {tharYarGoneStream&&<PolylineCanal p={tharYarGoneStream}/>}
  {tharYarGoneLandmarks.map(m=><group key={m.id} position={[m.x,0,m.z]} rotation={[0,m.rotation,0]}>
   <Block y={0.03} w={m.width} h={0.06} d={m.depth} color="#d1c7a8"/>
  </group>)}
  <MainRoad roads={tharYarGoneVillage.roads}/>
  <Lanes roads={tharYarGoneVillage.roads}/>
  {tharYarGoneVillage.fields.map((f,i)=><Field key={f.id??`tyg-f-${i}`} f={f} bunded/>)}
  {tharYarGoneVillage.bundedFields.map((f,i)=><Field key={f.id??`tyg-bf-${i}`} f={f} bunded/>)}
  {residentialHouses.map(h=><House key={h.id} h={h}/>)}
  {tharYarGoneLandmarkBuildings.map(b=><LandmarkBuilding key={b.id} b={b}/>)}
  {tharYarGoneVillage.largeTrees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="large"/>)}
  {tharYarGoneVillage.trees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="canopy"/>)}
  {tharYarGoneVillage.farmTrees.map(t=><Tree key={t.id} t={t} variant="farm"/>)}
 </group>;
}

/** သာယာကုန်းကျေးရွာ (Thar Yar Gone Village) — 2D Map Plan SVG Component */
export function TharYarGoneVillagePlan({labels,onSelectLocation}:{labels:boolean;onSelectLocation?:(id:string)=>void}){
 const wc=tharYarGoneStream;
 const residentialHouses=tharYarGoneVillage.houses.filter(h=>!h.id.startsWith('tyg-landmark-'));
 return <g id="village-tharyargone-plan" className={labels?"map-region-clickable":undefined} onClick={labels&&onSelectLocation?e=>{e.stopPropagation();onSelectLocation('tharyargone');}:undefined}>
  {tharYarGoneVillage.separationFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {wc&&<g transform={`rotate(${-wc.rotation*180/Math.PI})`}>
   <polyline points={wc.points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#4d9395" strokeWidth={wc.depth} strokeLinejoin="round" strokeLinecap="round"/>
  </g>}
  {tharYarGoneLandmarks.map(m=><rect key={m.id} x={m.x-m.width/2} y={m.z-m.depth/2} width={m.width} height={m.depth} fill="#d1c7a8" stroke="#8a7f5d" strokeWidth="0.8" transform={`rotate(${-m.rotation*180/Math.PI} ${m.x} ${m.z})`}/>)}
  {tharYarGoneVillage.bundedFields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.9" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {tharYarGoneVillage.fields.map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="0.8" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
  {tharYarGoneVillage.roads.map(r=><rect key={r.id} x={r.x-r.width/2} y={r.z-r.depth/2} width={r.width} height={r.depth} fill={r.main?'#657371':'#d4bd98'} transform={`rotate(${-r.rotation*180/Math.PI} ${r.x} ${r.z})`}/>)}
  {tharYarGoneLandmarkBuildings.map(b=><rect key={b.id} x={b.x-b.width/2} y={b.z-b.depth/2} width={b.width} height={b.depth} fill={b.roof} stroke="#fff3d1" strokeWidth="0.8" transform={`rotate(${-b.rotation*180/Math.PI} ${b.x} ${b.z})`}/>)}
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
  {tharYarGoneVillage.farmTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="2.4" fill="#547b48"/>)}
  {tharYarGoneVillage.trees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="5.8" fill="#365a42"/>)}
  {tharYarGoneVillage.largeTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="6.5" fill="#486e40" stroke="#739451" strokeWidth="0.6"/>)}
  {labels&&<>
   <text x={tharYarGoneVillage.labelPos.x} y={tharYarGoneVillage.labelPos.z} textAnchor="middle" fontSize="14" fill="#fff9dc" stroke="#173d35" strokeWidth="0.45">{tharYarGoneVillage.name} ↗</text>
   {tharYarGoneLandmarkBuildings.filter(b=>b.kind!=='tower'&&b.kind!=='shop').map(b=><text key={b.id} x={b.x} y={b.z-10} textAnchor="middle" fontSize="8.5" fill="#fff6d6" stroke="#2d3b36" strokeWidth="0.3">{b.name}</text>)}
  </>}
 </g>;
}

