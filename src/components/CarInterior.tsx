import { useRef } from 'react';
import { BoxGeometry, CylinderGeometry, Group, MeshStandardMaterial, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useRegionFrame as useFrame } from './RegionActivity';
import { carInput, carRide, currentCar } from '../game/carRide';

type Point = [number, number, number];
const colors = { carpet:'#34383c', trim:'#252a30', seat:'#48464a', insert:'#65616a', metal:'#a6a9af', black:'#11161c', screen:'#193c49' };
type Finish = keyof typeof colors;
const parts: Record<Finish, BufferGeometry[]> = {carpet:[],trim:[],seat:[],insert:[],metal:[],black:[],screen:[]};
function box(finish: Finish, size: Point, position: Point, tilt = 0) {
 parts[finish].push(new BoxGeometry(...size).rotateX(tilt).translate(...position));
}
function dial(x: number, radius: number) {
 parts.black.push(new CylinderGeometry(radius, radius, .015, 24).rotateX(Math.PI/2).translate(x,1.30,-.345));
 // Light markings, grouped into the same shared mesh as the trim.
 for(let i=0;i<9;i++) {
  const a=-2.2+i*.55;
  parts.metal.push(new BoxGeometry(.006,.013,.003).rotateZ(-a).translate(x+Math.sin(a)*radius*.78,1.30+Math.cos(a)*radius*.78,-.335));
 }
}
box('carpet',[1.29,.06,1.94],[0,.60,.13]);
box('trim',[.13,.19,.73],[0,.72,-.12]); // transmission tunnel
box('insert',[.115,.04,.38],[0,.84,-.08]);
box('black',[.10,.015,.09],[0,.865,-.18]); // gear gaiter
box('trim',[1.25,.17,.34],[0,1.18,-.55]);
box('black',[.44,.075,.28],[.28,1.365,-.47]); // instrument hood
box('screen',[.18,.105,.012],[-.07,1.21,-.371]);
for(const x of [-.48,-.20,.12,.51]) {
 box('black',[.12,.052,.014],[x,1.215,-.372]);
 for(const y of [1.201,1.215,1.229]) box('metal',[.103,.003,.008],[x,y,-.36]);
}
dial(.20,.060); dial(.36,.052);
for(const side of [-1,1]) {
 box('trim',[.035,.42,1.73],[side*.635,.91,.05]);
 box('insert',[.035,.14,.63],[side*.61,1.025,-.07]);
 box('trim',[.11,.055,.38],[side*.585,.95,-.08]);
 box('metal',[.025,.024,.13],[side*.59,1.075,-.20]);
 box('black',[.018,.13,.42],[side*.61,.79,.10]); // door storage pocket
 box('carpet',[.40,.012,.49],[side*.29,.638,-.43]);
 const x=side*.28;
 box('black',[.31,.18,.30],[x,.73,.08]); // seat pedestal
 box('seat',[.38,.20,.44],[x,.88,.08]);
 box('insert',[.25,.025,.34],[x,.988,.055]);
 box('seat',[.38,.58,.12],[x,1.28,.24],.14);
 box('insert',[.25,.45,.025],[x,1.28,.17],.14);
 for(const edge of [-1,1]) box('seat',[.065,.45,.08],[x+edge*.157,1.25,.145],.14);
 for(const post of [-1,1]) box('metal',[.012,.14,.012],[x+post*.062,1.57,.28]);
 box('seat',[.22,.16,.10],[x,1.68,.29]);
 box('metal',[.035,.045,.025],[x-side*.19,1.01,.16]); // belt buckle
}
box('seat',[1.22,.20,.42],[0,.88,.72]);
box('insert',[1.08,.022,.33],[0,.989,.72]);
box('seat',[1.22,.58,.12],[0,1.28,.90],.14);
for(const x of [-.32,.32]) {
 box('insert',[.39,.45,.022],[x,1.28,.83],.14);
 box('seat',[.22,.16,.10],[x,1.68,.96]);
}
const cabin = Object.entries(parts).map(([finish, geometries]) => {
 const geometry=mergeGeometries(geometries,false)!;
 geometries.forEach(part=>part.dispose());
 return {finish, geometry, material:new MeshStandardMaterial({color:colors[finish as Finish],roughness:finish==='metal'?.4:.85,metalness:finish==='metal'?.55:0})};
});

/** Static cabin details are batched by material and shared between every car. */
export function CarInterior({motion}:{motion?:{speed?:number}}) {
 const pedals=useRef<(Group|null)[]>([]),lever=useRef<Group>(null),needle=useRef<Group>(null);
 useFrame(()=>{
  const occupied=!!motion&&currentCar()===motion;
  const inputs=[occupied&&carInput.clutch,occupied&&carInput.brake,occupied&&carInput.throttle];
  pedals.current.forEach((pedal,i)=>{if(pedal)pedal.rotation.x=inputs[i]?-.28:0;});
  if(lever.current){const gear=occupied?carRide.gear:0;lever.current.rotation.x=gear===0?0:gear===-1||gear%2===0?.20:-.20;lever.current.rotation.z=gear===0?0:gear===-1?-.20:gear<3?.20:0;}
  if(needle.current)needle.current.rotation.z=2.2-Math.min(1,Math.abs(motion?.speed??0)*3.6/120)*4.4;
 });
 return <group name="car-cabin">
  {cabin.map(part=><mesh key={part.finish} name={`cabin-${part.finish}`} geometry={part.geometry} material={part.material} dispose={null} receiveShadow/>)}
  {[.12,.28,.43].map((x,i)=><group name={['clutch-pedal','brake-pedal','accelerator-pedal'][i]} key={x} ref={node=>{pedals.current[i]=node;}} position={[x,.79,-.64]}>
   <mesh position={[0,.035,-.012]}><boxGeometry args={[.012,.13,.018]}/><meshStandardMaterial color="#92959b"/></mesh>
   <mesh rotation={[-.30,0,0]}><boxGeometry args={[i===2?.055:.075,.10,.025]}/><meshStandardMaterial color="#15191d"/></mesh>
  </group>)}
  <group ref={lever} name="gear-lever" position={[0,.87,-.18]}>
   <mesh position={[0,.065,0]}><cylinderGeometry args={[.009,.012,.13,8]}/><meshStandardMaterial color="#a1a5ab" metalness={.6} roughness={.4}/></mesh>
   <mesh position={[0,.14,0]} scale={[1,.75,1]}><sphereGeometry args={[.028,12,8]}/><meshStandardMaterial color="#14181c"/></mesh>
  </group>
  <mesh position={[.07,.89,.10]} rotation={[-.2,0,0]}><boxGeometry args={[.025,.035,.17]}/><meshStandardMaterial color="#191d22"/></mesh>
  <group ref={needle} position={[.20,1.30,-.332]}><mesh position={[0,.022,0]}><boxGeometry args={[.004,.047,.004]}/><meshBasicMaterial color="#f97958"/></mesh></group>
 </group>;
}
