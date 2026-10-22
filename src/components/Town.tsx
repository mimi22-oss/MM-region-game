import { Canal, Monastery, OpenGround, Gardens } from './Landmarks';
import { angle, ward, type House } from '../data/ward';
function Box({position,size,color}:{position:[number,number,number];size:[number,number,number];color:string}){
 return <mesh position={position} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color}/></mesh>;
}
function Home({h}:{h:House}){
 const front=h.depth/2;
 const balconyWidth=h.width*0.65;
 return <group position={[h.x,0,h.z]} rotation={[0,h.rotation,0]}>
  {/* Enclosed ground and upper storeys, separated by a visible floor band. */}
  <Box position={[0,0.15,0]} size={[h.width+0.3,0.3,h.depth+0.3]} color="#aaa18d"/>
  <Box position={[0,1.8,0]} size={[h.width,3,h.depth]} color="#d6cbb6"/>
  <Box position={[0,3.4,0]} size={[h.width+0.35,0.2,h.depth+0.35]} color="#71523c"/>
  <Box position={[0,5,0]} size={[h.width,3,h.depth]} color={h.color}/>
  <Box position={[0,6.55,0]} size={[h.width+0.4,0.15,h.depth+0.4]} color="#e6ce9f"/>
  {[-1,1].map(side=><mesh key={side} position={[side*h.width/4,7.35,0]} rotation={[0,0,-side*Math.atan2(1.6,h.width/2)]} castShadow><boxGeometry args={[Math.hypot(h.width/2,1.6)+0.8,0.18,h.depth+1.2]}/><meshStandardMaterial color={h.roof} roughness={0.85}/></mesh>)}
  {[1.85,5.05].map(y=><group key={y}>
   {[-1,1].map(side=><group key={side}>
    <Box position={[side*h.width*0.31,y,front+0.07]} size={[1.5,1.4,0.14]} color="#355b59"/>
    <Box position={[side*h.width*0.31,y,front+0.16]} size={[0.09,1.5,0.07]} color="#e6ce9f"/>
    <Box position={[side*h.width*0.31,y-0.75,front+0.15]} size={[1.7,0.12,0.2]} color="#e6ce9f"/>
    <Box position={[side*(h.width/2+0.06),y,0]} size={[0.12,1.4,1.7]} color="#355b59"/>
    <Box position={[side*(h.width/2+0.14),y,0]} size={[0.08,1.5,0.09]} color="#e6ce9f"/>
   </group>)}
  </group>)}
  <Box position={[0,1.45,front+0.08]} size={[1.4,2.3,0.16]} color="#573f30"/>
  <Box position={[0,4.65,front+0.08]} size={[1.4,2.3,0.16]} color="#573f30"/>
  <Box position={[0,0.18,front+0.8]} size={[balconyWidth,0.35,1.6]} color="#b9ad94"/>
  <Box position={[0,3.4,front+0.8]} size={[balconyWidth,0.2,1.6]} color="#8c6744"/>
  {[-1,1].map(side=><group key={side}>
   <Box position={[side*(balconyWidth/2-0.15),1.75,front+1.4]} size={[0.22,3.3,0.22]} color="#71523c"/>
   <Box position={[side*balconyWidth/2,4.05,front+0.8]} size={[0.12,1.1,1.6]} color="#a58b63"/>
  </group>)}
  <Box position={[0,4.6,front+1.55]} size={[balconyWidth,0.12,0.12]} color="#e6ce9f"/>
  {Array.from({length:7},(_,i)=><Box key={i} position={[-balconyWidth/2+i*balconyWidth/6,4.05,front+1.55]} size={[0.1,1.1,0.1]} color="#a58b63"/>)}
  <Box position={[0,0.09,front+1.95]} size={[2.2,0.18,0.7]} color="#b9ad94"/>
 </group>;
}function Warehouses(){return <>{ward.warehouses.map(w=><group key={w.id} position={[w.x,0,w.z]} rotation={[0,w.rotation,0]}>
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
 <color attach="background" args={['#c6ded8']}/><fog attach="fog" args={['#c6ded8',260,850]}/>
 <hemisphereLight args={['#e5f2ee','#697445',2]}/>
 <directionalLight position={[-80,180,60]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-180} shadow-camera-right={180} shadow-camera-top={180} shadow-camera-bottom={-180} shadow-camera-far={450} shadow-normalBias={0.04}/>
 <Box position={[0,-0.3,0]} size={[ward.size,0.6,ward.size]} color="#92a36b"/>
 <Warehouses/><FootballPitch/><Canal/><Gardens/><OpenGround/><Monastery/>
 {ward.fields.map((f,i)=><group key={`field${i}`} position={[f.x,0,f.z]} rotation={[0,f.rotation,0]}>
 <Box position={[0,0.02,0]} size={[f.width,0.04,f.depth]} color={f.color}/>
 {Array.from({length:12},(_,n)=><Box key={n} position={[-f.width/2+n*5,0.055,0]} size={[0.3,0.04,f.depth]} color="#7e8b50"/>)}
 </group>)}
 {ward.roads.map(r=><group key={r.id} position={[r.x,0,r.z]} rotation={[0,r.rotation,0]}>
 <Box position={[0,0.04,0]} size={[r.width+1.6,0.08,r.depth]} color="#c5b18d"/>
 <Box position={[0,0.09,0]} size={[r.width,0.06,r.depth]} color={r.main?'#697574':'#b9a887'}/>
 {r.main&&Array.from({length:96},(_,n)=><Box key={n} position={[0,0.13,n*8-380]} size={[0.15,0.02,3]} color="#e9d9a2"/>)}
 </group>)} {ward.houses.map(h=><Home key={h.id} h={h}/>)}
 {ward.largeTrees.map((t,i)=><group key={t.id} position={[t.x,0,t.z]}>
  <mesh position={[0,4.5,0]} castShadow><cylinderGeometry args={[0.55,t.radius,9,10]}/><meshStandardMaterial color="#71543b" roughness={1}/></mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*1.8,8,0]} rotation={[0,0,-side*0.8]} castShadow><cylinderGeometry args={[0.2,0.45,5,7]}/><meshStandardMaterial color="#71543b"/></mesh>)}
  <mesh position={[0,11,0]} scale={[1,0.8,1]} castShadow><icosahedronGeometry args={[6.5,2]}/><meshStandardMaterial color={i%2?'#486e40':'#567e47'} roughness={1}/></mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*3.5,9.6,1]} castShadow><icosahedronGeometry args={[3.8,1]}/><meshStandardMaterial color="#62874b" roughness={1}/></mesh>)}
 </group>)} {ward.trees.map((t,i)=><group key={t.id} position={[t.x,0,t.z]}>
 <mesh position={[0,4,0]} castShadow><cylinderGeometry args={[0.32,t.radius,8,8]}/><meshStandardMaterial color="#796043"/></mesh>
 <group rotation={[0,angle,0]}><mesh position={[(i<32?1:-1)*4.5,8,0]} rotation={[0,0,-(i<32?1:-1)*Math.atan2(9,4)]} castShadow><cylinderGeometry args={[0.18,0.35,Math.hypot(9,4),7]}/><meshStandardMaterial color="#796043"/></mesh></group> <mesh position={[(i<32?1:-1)*9*Math.cos(angle),10,-(i<32?1:-1)*9*Math.sin(angle)]} scale={[1,0.65,1]} castShadow><icosahedronGeometry args={[6.3,2]}/><meshStandardMaterial color={i%2?'#497954':'#628850'}/></mesh>
 <mesh position={[(i<32?1:-1)*4*Math.cos(angle),9.3,-(i<32?1:-1)*4*Math.sin(angle)]} scale={[1,0.7,1]} castShadow><icosahedronGeometry args={[5.8,1]}/><meshStandardMaterial color="#759555"/></mesh>
 </group>)}
 {/* A low visual border; collision follows the ward boundary. */}
 {[-1,1].map(s=><group key={s}><Box position={[s*ward.size/2,0.2,0]} size={[0.16,0.4,ward.size]} color="#d6c598"/><Box position={[0,0.2,s*ward.size/2]} size={[ward.size,0.4,0.16]} color="#d6c598"/></group>)}
 </>}












