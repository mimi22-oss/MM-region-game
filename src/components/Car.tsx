import { windshieldGeometry } from '../game/carWindshield';
import { useMemo } from 'react';
import { Shape, ExtrudeGeometry, DoubleSide } from 'three';
import { parkedCars } from '../data/cars';

/** Rounded reference-inspired compact car; front is -Z. */
export function Car({color='#277fbd',size=1}:{color?:string;size?:number}){
 const windshieldFrame=useMemo(()=>windshieldGeometry(0.67,0.012,0.30,0.097),[]);
 const windshieldInterior=useMemo(()=>windshieldGeometry(0.62,0.025,0.285,0.101),[]);
 const windshieldSeatLeft=useMemo(()=>windshieldGeometry(0.16,0.05,0.19,0.103,-0.28),[]);
 const windshieldSeatRight=useMemo(()=>windshieldGeometry(0.16,0.05,0.19,0.103,0.28),[]);
 const windshieldDash=useMemo(()=>windshieldGeometry(0.60,0.025,0.085,0.104),[]);
 const windshield=useMemo(()=>windshieldGeometry(0.62,0.025,0.285,0.107),[]);
 const windshieldGlareLeft=useMemo(()=>windshieldGeometry(0.09,0.045,0.265,0.110,-0.34),[]);
 const windshieldGlareRight=useMemo(()=>windshieldGeometry(0.045,0.06,0.25,0.110,-0.16),[]);
 const rearFrame=useMemo(()=>windshieldGeometry(0.62,0.68,0.89,0.097),[]);
 const rearGlass=useMemo(()=>windshieldGeometry(0.56,0.70,0.87,0.103),[]);
 const body=useMemo(()=>{const s=new Shape();s.moveTo(-1.55,0.43);s.lineTo(1.64,0.43);s.quadraticCurveTo(1.78,1.15,0.76,1.28);s.bezierCurveTo(0.42,2.55,-1.25,2.55,-1.55,0.43);s.closePath();const g=new ExtrudeGeometry(s,{depth:1.42,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:0.09,bevelThickness:0.09,curveSegments:16});g.translate(0,0,-0.71);return g},[]);
 const windows=useMemo(()=>{
  const rear=new Shape();rear.moveTo(-1.08,1.3);rear.quadraticCurveTo(-1.03,1.87,-0.28,2.02);rear.quadraticCurveTo(-0.16,2.04,-0.16,1.9);rear.lineTo(-0.16,1.29);rear.quadraticCurveTo(-0.16,1.18,-0.31,1.18);rear.lineTo(-0.91,1.18);rear.quadraticCurveTo(-1.08,1.18,-1.08,1.3);
  const front=new Shape();front.moveTo(0.02,1.25);front.lineTo(0.02,1.93);front.quadraticCurveTo(0.02,2.07,0.17,2.01);front.quadraticCurveTo(0.68,1.85,0.77,1.3);front.quadraticCurveTo(0.79,1.18,0.65,1.18);front.lineTo(0.13,1.18);front.quadraticCurveTo(0.02,1.18,0.02,1.25);return [rear,front];
 },[]);
 return <group scale={size} name="cartoon-compact-car">
  <mesh geometry={body} rotation={[0,Math.PI/2,0]} castShadow receiveShadow><meshStandardMaterial color={color} metalness={0.18} roughness={0.32}/></mesh>
  {[-1,1].map(side=><group key={side}>
   {windows.map((shape,i)=><group key={i} position={[side*0.806,0,0]} rotation={[0,Math.PI/2,0]}>
    <mesh><shapeGeometry args={[shape]}/><meshStandardMaterial color="#14232b" side={DoubleSide}/></mesh>
    <mesh position={[0,0.04,side*0.004]} scale={[0.94,0.94,1]}><shapeGeometry args={[shape]}/><meshStandardMaterial color="#1b3442" roughness={0.35} side={DoubleSide}/></mesh>
    <mesh position={[0,0.04,side*0.008]} scale={[0.94,0.94,1]}><shapeGeometry args={[shape]}/><meshStandardMaterial color="#bfeef7" emissive="#5ab8d1" emissiveIntensity={0.1} roughness={0.06} metalness={0.22} transparent opacity={0.58} side={DoubleSide}/></mesh>
   </group>)}
   <mesh position={[side*0.812,1.22,0.07]}><boxGeometry args={[0.018,1.48,0.025]}/><meshStandardMaterial color="#152a35"/></mesh>
   {[-0.25,0.88].map(z=><mesh key={z} position={[side*0.825,1.04,z]}><boxGeometry args={[0.035,0.055,0.22]}/><meshStandardMaterial color="#d8dedc" metalness={0.5} roughness={0.3}/></mesh>)}
   {[-1.04,1.04].map(z=><group key={z} position={[side*0.79,0.43,z]} rotation={[0,0,Math.PI/2]}>
    <mesh castShadow><cylinderGeometry args={[0.43,0.43,0.22,24]}/><meshStandardMaterial color="#302729" roughness={0.95}/></mesh>
    <mesh position={[0,-side*0.12,0]}><cylinderGeometry args={[0.25,0.25,0.025,24]}/><meshStandardMaterial color="#f4932e" roughness={0.4}/></mesh>
    <mesh position={[0,-side*0.136,0]}><cylinderGeometry args={[0.065,0.065,0.012,16]}/><meshStandardMaterial color="#ffb24f"/></mesh>
   </group>)}
   <mesh position={[side*0.52,0.95,-1.55]} scale={[0.17,0.22,0.07]}><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color="#ffe34b" emissive="#ffbd24" emissiveIntensity={0.2}/></mesh>
   <mesh position={[side*0.59,0.87,1.5]} scale={[0.1,0.17,0.06]}><sphereGeometry args={[1,12,10]}/><meshStandardMaterial color="#ef4144"/></mesh>
  </group>)}
  {/* ရှေ့လေကာမှန် ဘောင်၊ အတွင်းခန်းရိပ်နှင့် ကြည်လင်သော မှန်သား (Front Windshield Glass Assembly) */}
  <mesh geometry={windshieldFrame}><meshStandardMaterial color="#122129" roughness={0.6} side={DoubleSide}/></mesh>
  <mesh geometry={windshieldInterior}><meshStandardMaterial color="#19313f" roughness={0.45} side={DoubleSide}/></mesh>
  <mesh geometry={windshieldSeatLeft}><meshStandardMaterial color="#274252" roughness={0.7} side={DoubleSide}/></mesh>
  <mesh geometry={windshieldSeatRight}><meshStandardMaterial color="#274252" roughness={0.7} side={DoubleSide}/></mesh>
  <mesh geometry={windshieldDash}><meshStandardMaterial color="#111f27" roughness={0.65} side={DoubleSide}/></mesh>
  <mesh geometry={windshield}><meshStandardMaterial color="#c8f6ff" emissive="#67c7e0" emissiveIntensity={0.14} roughness={0.05} metalness={0.2} transparent opacity={0.56} side={DoubleSide}/></mesh>
  <mesh geometry={windshieldGlareLeft}><meshStandardMaterial color="#f2fdff" emissive="#ffffff" emissiveIntensity={0.22} roughness={0.02} transparent opacity={0.42} side={DoubleSide}/></mesh>
  <mesh geometry={windshieldGlareRight}><meshStandardMaterial color="#f2fdff" emissive="#ffffff" emissiveIntensity={0.18} roughness={0.02} transparent opacity={0.32} side={DoubleSide}/></mesh>
  {/* နောက်မှန် (Rear Windshield) */}
  <mesh geometry={rearFrame}><meshStandardMaterial color="#122129" roughness={0.6} side={DoubleSide}/></mesh>
  <mesh geometry={rearGlass}><meshStandardMaterial color="#9adce8" emissive="#459db5" emissiveIntensity={0.1} roughness={0.08} metalness={0.22} side={DoubleSide}/></mesh>

  {[-1,1].map(side=><mesh key={side} position={[0,0.48,side*1.68]} rotation={[0,0,Math.PI/2]}><capsuleGeometry args={[0.1,1.24,4,10]}/><meshStandardMaterial color="#d7dddc" metalness={0.45} roughness={0.35}/></mesh>)}
 </group>;
}
export function ParkedCars(){return <>{parkedCars.map(car=><group key={car.id} position={[car.x,0,car.z]} rotation={[0,car.rotation,0]}><Car color={car.color} size={car.size}/></group>)}</>}
export function ParkedCarsPlan(){return <>{parkedCars.map(car=><g key={car.id} transform={`translate(${car.x} ${car.z}) rotate(${-car.rotation*180/Math.PI})`}><rect x={-car.width/2} y={-car.depth/2} width={car.width} height={car.depth} rx="0.4" fill={car.color} stroke="#182f3b" strokeWidth="0.2"/><rect x="-0.6" y="-0.7" width="1.2" height="1" fill="#a3e0e8"/></g>)}</>}
