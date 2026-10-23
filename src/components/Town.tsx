import { Monastery, OpenGround, RiceMill } from './Landmarks';
import { ward, farmhouse } from '../data/ward';
import { Box } from './Primitives';
import { House } from './House';
import { Farmhouse } from './Farmhouse';
import { MainRoad } from './MainRoad';
import { Lanes } from './Lane';
import { Trees } from './Tree';
import { Canal } from './Canal';
import { Fields } from './Field';
import { Mountains } from './Mountains';
function Warehouses(){return <>{ward.warehouses.map(w=><group key={w.id} position={[w.x,0,w.z]} rotation={[0,w.rotation,0]}>
 <Box position={[0,0.15,0]} size={[w.width+3,0.3,w.depth+3]} color="#baa98d"/>
 <Box position={[0,3.5,0]} size={[w.width,7,w.depth]} color={w.color}/>
 {[-1,1].map(side=><mesh key={side} position={[side*w.width/4,7.8,0]} rotation={[0,0,-side*Math.atan2(1.6,w.width/2)]} castShadow><boxGeometry args={[Math.hypot(w.width/2,1.6)+1,0.22,w.depth+1.8]}/><meshStandardMaterial color={w.roof}/></mesh>)}
 {[-1,1].map(side=><group key={side}><Box position={[side*(w.width/2+0.04),2.4,0]} size={[0.12,4.8,8]} color="#526564"/>{[-10,10].map(z=><Box key={z} position={[side*(w.width/2+0.1),5,z]} size={[0.15,1.1,3]} color="#90b8bd"/>)}</group>)}
 </group>)}</>}
function FootballPitch(){const p=ward.pitch;return <group position={[p.x,0,p.z]} rotation={[0,p.rotation,0]}>
 <Box position={[0,0.04,0]} size={[p.width+8,0.08,p.depth+8]} color="#81925c"/>
 {Array.from({length:8},(_,i)=><Box key={i} position={[0,0.09,-42+i*12]} size={[p.width,0.04,12]} color={i%2?'#668b50':'#719858'}/>)}
 {[-1,1].map(s=><group key={s}>
 <Box position={[s*30,0.13,0]} size={[0.15,0.04,96]} color="#eee9d2"/>
 <Box position={[0,0.13,s*48]} size={[60,0.04,0.15]} color="#eee9d2"/>
 <Box position={[0,0.13,s*32]} size={[36,0.04,0.15]} color="#eee9d2"/>
 {[-1,1].map(t=><Box key={t} position={[t*18,0.13,s*40]} size={[0.15,0.04,16]} color="#eee9d2"/>)}
 {[-1,1].map(t=><Box key={t} position={[t*3.66,1.22,s*48]} size={[0.12,2.44,0.12]} color="#f3f0de"/>)}
 <Box position={[0,2.44,s*48]} size={[7.44,0.12,0.12]} color="#f3f0de"/>
 </group>)}
 <Box position={[0,0.13,0]} size={[60,0.04,0.15]} color="#eee9d2"/>
 <mesh position={[0,0.155,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[9,9.15,64]}/><meshBasicMaterial color="#eee9d2"/></mesh>
 </group>}export function Town(){return <>
 <color attach="background" args={['#c6ded8']}/><fog attach="fog" args={['#c6ded8',1800,5500]}/>
 <hemisphereLight args={['#e5f2ee','#697445',2]}/>
 <directionalLight position={[-80,180,60]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-320} shadow-camera-right={320} shadow-camera-top={320} shadow-camera-bottom={-320} shadow-camera-far={650} shadow-normalBias={0.04}/>
 <Box position={[0,-0.3,0]} size={[ward.size,0.6,ward.size]} color="#92a36b"/>
 <Warehouses/><FootballPitch/><Canal/><Farmhouse/><OpenGround/><Monastery/><RiceMill/>
 <Fields/><Mountains/>
 <MainRoad/><Lanes/> {ward.houses.filter(h=>h.id!==farmhouse.id).map(h=><House key={h.id} h={h}/>)}
 <Trees/>
 {/* A low visual border; collision follows the ward boundary. */}
 {[-1,1].map(s=><group key={s}><Box position={[s*ward.size/2,0.2,0]} size={[0.16,0.4,ward.size]} color="#d6c598"/><Box position={[0,0.2,s*ward.size/2]} size={[ward.size,0.4,0.16]} color="#d6c598"/></group>)}
 </>}
