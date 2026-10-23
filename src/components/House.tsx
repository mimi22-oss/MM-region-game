import { mobileQuality } from '../game/sceneBudget';
import { angle, ward, type House as HouseData } from '../data/ward';
import { Box } from './Primitives';
export const FARMHOUSE_NAME='á€œá€™á€ºá€¸á€žá€½á€šá€º á‚ Â· á€…á€­á€¯á€€á€ºá€á€„á€ºá€¸á€¡á€­á€™á€º';
export function houseVisualRotation(h:HouseData){
 return angle+(h.x*Math.cos(angle)-h.z*Math.sin(angle)>0?-Math.PI/2:Math.PI/2);
}
export function houseFenceBounds(h:HouseData){
 const sideMargin=h.name.startsWith('á€€á€½á€„á€ºá€¸á€˜á€±á€¸á€¡á€­á€™á€º')?1.0:1.6;
 const sideHalf=h.width/2+sideMargin;
 const backHalf=h.depth/2+1.5;
 const frontHalf=h.depth/2+2.6;
 return {sideHalf,backHalf,frontHalf};
}
function WireMeshSegment({length}:{length:number}){
 if(mobileQuality)return <group><Box position={[0,1.45,0]} size={[length,.06,.06]} color="#68767a"/>{[-1,1].map(side=><Box key={side} position={[side*length/2,.78,0]} size={[.1,1.56,.1]} color="#566366"/>)}</group>;
 const meshCount=Math.max(6,Math.round(length/1.2));
 return <group>
  <Box position={[0,1.45,0]} size={[length,0.05,0.05]} color="#68767a"/>
  <Box position={[0,0.8,0]} size={[length,0.035,0.035]} color="#7a898d"/>
  <Box position={[0,0.16,0]} size={[length,0.05,0.05]} color="#68767a"/>
  <mesh position={[0,0.8,0]}>
   <boxGeometry args={[length,1.28,0.02]}/>
   <meshStandardMaterial color="#98abb0" metalness={0.45} roughness={0.4} transparent opacity={0.36}/>
  </mesh>
  {Array.from({length:meshCount+1},(_,i)=>{
   const x=-length/2+i*(length/meshCount);
   const isPost=i%2===0||i===meshCount;
   return <Box key={i} position={[x,isPost?0.78:0.8,0]} size={isPost?[0.08,1.56,0.08]:[0.03,1.28,0.03]} color={isPost?'#566366':'#7f9196'}/>;
  })}
 </group>;
}
function BlueSheetSection({startX,endX}:{startX:number;endX:number}){
 const length=endX-startX;
 if(length<=0.2)return null;
 const centerX=(startX+endX)/2;
 if(mobileQuality)return <Box position={[centerX,.915,0]} size={[length,1.83,.06]} color="#2563a6"/>;
 const ribCount=Math.max(2,Math.round(length/0.85));
 return <group>
  <mesh position={[centerX,0.915,0]} castShadow receiveShadow>
   <boxGeometry args={[length,1.83,0.06]}/>
   <meshStandardMaterial color="#2563a6" metalness={0.35} roughness={0.45}/>
  </mesh>
  <Box position={[centerX,1.84,0]} size={[length+0.04,0.05,0.1]} color="#1d4e89"/>
  <Box position={[centerX,1.35,-0.05]} size={[length,0.06,0.05]} color="#566366"/>
  <Box position={[centerX,0.5,-0.05]} size={[length,0.06,0.05]} color="#566366"/>
  {Array.from({length:ribCount+1},(_,i)=>{
   const x=startX+i*(length/ribCount);
   return <Box key={i} position={[x,0.915,0.01]} size={[0.14,1.82,0.09]} color={i%2?'#3279c7':'#1e5291'}/>;
  })}
 </group>;
}
function BlueSheetFrontFence({z,width,gateWidth=2.6}:{z:number;width:number;gateWidth?:number}){
 const halfWidth=width/2;
 const halfGate=gateWidth/2;
 const leafLen=Math.min(1.1,gateWidth*0.38);
 return <group position={[0,0,z]}>
  <BlueSheetSection startX={-halfWidth} endX={-halfGate}/>
  <BlueSheetSection startX={halfGate} endX={halfWidth}/>
  {/* Gate posts and open gate leaves on both sides of the front doorway */}
  {[-1,1].map(s=><group key={s} position={[s*halfGate,0,0]}>
   <Box position={[0,0.98,0]} size={[0.16,1.96,0.16]} color="#485457"/>
   <Box position={[0,1.98,0]} size={[0.22,0.06,0.22]} color="#1d4e89"/>
   <group rotation={[0,-s*1.15,0]}>
    <mesh position={[-s*leafLen/2,0.88,0]} castShadow receiveShadow>
     <boxGeometry args={[leafLen,1.72,0.05]}/>
     <meshStandardMaterial color="#2b6cb0" metalness={0.35} roughness={0.45}/>
    </mesh>
    <Box position={[-s*leafLen/2,1.75,0]} size={[leafLen,0.05,0.08]} color="#1d4e89"/>
   </group>
  </group>)}
 </group>;
}
export function FrontLotFence(){
 const l=ward.frontLot;
 // Facing the main road (AH1): +Z in l.rotation + Math.PI/2 is the East / main-road side of frontLot.
 return <group position={[l.x,0,l.z]} rotation={[0,l.rotation+Math.PI/2,0]}>
  <BlueSheetFrontFence z={l.width/2} width={l.depth} gateWidth={3.4}/>
 </group>;
}
function HouseFence({h}:{h:HouseData}){
 if(h.name===FARMHOUSE_NAME)return null;
 const {sideHalf,backHalf,frontHalf}=houseFenceBounds(h);
 const fenceWidth=sideHalf*2;
 const fenceDepth=backHalf+frontHalf;
 const centerZ=(frontHalf-backHalf)/2;
 const rot=houseVisualRotation(h);
 // In rot (angle + Math.PI/2): +Z is East (facing main road), -Z is West (open), Â±X are North and South sides.
 return <group position={[h.x,0,h.z]} rotation={[0,rot,0]}>
  {[-sideHalf,sideHalf].map(x=><group key={x} position={[x,0,centerZ]} rotation={[0,Math.PI/2,0]}>
   <WireMeshSegment length={fenceDepth}/>
  </group>)}
  <BlueSheetFrontFence z={frontHalf} width={fenceWidth} gateWidth={2.6}/>
 </group>;
}
export function House({h}:{h:HouseData}){
 const front=h.depth/2;
 const balconyWidth=h.width*0.65;
 const rot=houseVisualRotation(h);
 return <>
  <group position={[h.x,0,h.z]} rotation={[0,rot,0]}>
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
  </group>
  <HouseFence h={h}/>
 </>;
}
