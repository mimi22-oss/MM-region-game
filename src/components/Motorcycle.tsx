import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { motorcycleRide } from '../game/motorcycleRide';
import { BufferGeometry,Float32BufferAttribute,Shape,ExtrudeGeometry,MeshStandardMaterial,SphereGeometry,BoxGeometry,CylinderGeometry,TorusGeometry,CatmullRomCurve3,TubeGeometry,Vector3,Quaternion } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { motorcycleData } from '../data/motorcycle';
type P=[number,number,number];
const mat=(color:string,metalness=0,roughness=.45)=>new MeshStandardMaterial({color,metalness,roughness});
const blue=mat('#13a5e4',.15,.31),blueShade=mat('#177fb3',.13),ivory=mat('#f6f1e9',0,.47),trim=mat('#342b40',.05),rubber=mat('#292630',0,.91),seatMat=mat('#3c3545',0,.9),silver=mat('#bdccd1',.55,.32),engine=mat('#82858c',.4),glass=mat('#d7eef2',.1,.16),amber=mat('#ffb63e'),red=mat('#ee4252'),mirror=mat('#77cbea',.55,.18);
const sphere=new SphereGeometry(1,20,12),box=new BoxGeometry(1,1,1),up=new Vector3(0,1,0);
function rod(a:P,b:P,r:number){const pa=new Vector3(...a),pb=new Vector3(...b),d=pb.clone().sub(pa);const g=new CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new Quaternion().setFromUnitVectors(up,d.normalize()));g.translate(...pa.add(pb).multiplyScalar(.5).toArray());return g;}
function merge(list:BufferGeometry[]){const g=mergeGeometries(list,false)!;list.forEach(p=>p.dispose());return g;}
function curve(points:P[],r:number){return new TubeGeometry(new CatmullRomCurve3(points.map(p=>new Vector3(...p))),32,r,8,false);}
/** Rounded side silhouette extruded across the bike's width. Shape coordinates are (forward Z, height Y). */
function profile(draw:(s:Shape)=>void,width:number,bevel=.012){const s=new Shape();draw(s);const g=new ExtrudeGeometry(s,{depth:width,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:18,steps:1});g.translate(0,0,-width/2);g.rotateY(-Math.PI/2);return g;}
const chassis=profile(s=>{s.moveTo(-.72,.62);s.bezierCurveTo(-.60,.70,-.30,.70,-.13,.66);s.lineTo(-.14,.53);s.quadraticCurveTo(-.16,.45,.03,.41);s.lineTo(.08,.28);s.lineTo(-.30,.25);s.quadraticCurveTo(-.42,.28,-.46,.45);s.quadraticCurveTo(-.55,.52,-.73,.48);s.closePath()},.21);
const sideCover=profile(s=>{s.moveTo(-.40,.47);s.quadraticCurveTo(-.37,.55,-.26,.52);s.quadraticCurveTo(-.06,.48,-.03,.39);s.quadraticCurveTo(-.15,.34,-.32,.36);s.quadraticCurveTo(-.40,.38,-.40,.47);s.closePath()},.245,.009);
const apron=profile(s=>{s.moveTo(.28,.90);s.quadraticCurveTo(.38,.85,.37,.71);s.quadraticCurveTo(.38,.49,.19,.22);s.lineTo(-.12,.22);s.quadraticCurveTo(.04,.38,.12,.54);s.quadraticCurveTo(.24,.69,.24,.84);s.quadraticCurveTo(.24,.89,.28,.90);s.closePath()},.25,.016);
const shieldEdge=curve([[.14,.23,.18],[.15,.40,.29],[.16,.64,.355],[.13,.81,.33],[.10,.89,.28]],.009);
const seat=profile(s=>{s.moveTo(-.74,.72);s.quadraticCurveTo(-.77,.73,-.75,.78);s.quadraticCurveTo(-.74,.81,-.68,.80);s.lineTo(-.12,.77);s.quadraticCurveTo(-.06,.765,-.07,.72);s.lineTo(-.74,.72);s.closePath()},.245,.018);
const seatPiping=profile(s=>{s.moveTo(-.74,.724);s.lineTo(-.08,.724);s.lineTo(-.08,.738);s.lineTo(-.74,.744);s.closePath()},.258,.003);
const seatStrap=curve([[-.134,.748,-.47],[-.126,.795,-.47],[0,.804,-.47],[.126,.795,-.47],[.134,.748,-.47]],.009);
const radius=.286,front=.635,rear=-.635;
function fender(center:number,r:number,start:number,end:number,width:number){
 const p:number[]=[],idx:number[]=[],rows=42,sides=12;
 for(let i=0;i<=rows;i++)for(let j=0;j<=sides;j++){
  const a=start+(end-start)*i/rows,t=j/sides*2-1,rr=r+.013*Math.cos(t*Math.PI/2);
  p.push(t*width/2,radius+Math.sin(a)*rr,center+Math.cos(a)*rr);
  if(i<rows&&j<sides){const k=i*(sides+1)+j;idx.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const frontFender=fender(front,.325,.25,Math.PI-.15,.17),rearFender=fender(rear,.337,.2,Math.PI+.22,.19);
const fenderMat=blue.clone();fenderMat.side=2;
const wheelTire=new TorusGeometry(.247,.039,12,44);wheelTire.rotateY(Math.PI/2);
const wheelRim=new TorusGeometry(.222,.012,8,40);wheelRim.rotateY(Math.PI/2);
const hub=new CylinderGeometry(.073,.073,.12,28);hub.rotateZ(Math.PI/2);
const axle=new CylinderGeometry(.021,.021,.17,12);axle.rotateZ(Math.PI/2);
const spokes=merge(Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2,b=a+(i%2?.22:-.22);return rod([i%2?.035:-.035,Math.sin(b)*.055,Math.cos(b)*.055],[i%2?.017:-.017,Math.sin(a)*.217,Math.cos(a)*.217],.0024)}));
const frame=merge([rod([0,.30,-.55],[0,.28,.12],.029),rod([0,.28,.12],[0,.86,.29],.025),rod([0,.3,-.38],[0,.67,-.47],.027)]);
const forks=merge([-.082,.082].map(x=>rod([x,.29,front],[x,.86,.30],.026)));
const shockShafts=merge([-.123,.123].map(x=>rod([x,.31,rear],[x,.67,-.55],.016)));
const shockCovers=merge([-.123,.123].map(x=>rod([x,.44,-.606],[x,.66,-.555],.026)));
const swingarm=merge([-.1,.1].map(x=>rod([x,.28,-.05],[x,.29,rear],.019)));
const handlebar=curve([[-.29,.927,.23],[-.20,.93,.26],[-.12,.94,.29],[.12,.94,.29],[.20,.93,.26],[.29,.927,.23]],.013);
const grips=merge([rod([-.31,.928,.23],[-.22,.93,.25],.020),rod([.22,.93,.25],[.31,.928,.23],.020)]);
const levers=merge([rod([-.29,.913,.285],[-.20,.927,.30],.0045),rod([.20,.927,.30],[.29,.913,.285],.0045)]);
const mirrorStem=curve([[.20,.93,.26],[.22,1.06,.245],[.26,1.13,.23]],.0055);
const exhaustPipe=curve([[.11,.31,.12],[.17,.20,.13],[.18,.17,-.06],[.18,.19,-.25]],.017);
const muffler=rod([.18,.19,-.25],[.18,.20,-.86],.033);
const footrests=merge([rod([-.24,.25,-.025],[.24,.25,-.025],.015),rod([-.24,.26,-.42],[.24,.26,-.42],.012)]);
const stand=merge([rod([-.05,.25,-.16],[-.20,.018,-.22],.012),rod([-.23,.018,-.27],[-.18,.018,-.18],.012)]);
const engineBlock=profile(s=>{s.moveTo(-.28,.22);s.lineTo(.08,.22);s.quadraticCurveTo(.14,.25,.12,.34);s.quadraticCurveTo(.10,.39,-.04,.38);s.lineTo(-.23,.36);s.closePath()},.23,.018);
const engineCover=new CylinderGeometry(.066,.066,.035,24);engineCover.rotateZ(Math.PI/2);
const cylinderFins=merge(Array.from({length:6},(_,i)=>new BoxGeometry(.15,.115,.008).translate(0,.308,.095+i*.012)));
function Part({g,m}:{g:BufferGeometry;m:MeshStandardMaterial}){return <mesh geometry={g} material={m} castShadow/>;}
function Ball({p,s,m}:{p:P;s:P;m:MeshStandardMaterial}){return <mesh geometry={sphere} material={m} position={p} scale={s} castShadow/>;}
function Box({p,s,m}:{p:P;s:P;m:MeshStandardMaterial}){return <mesh geometry={box} material={m} position={p} scale={s} castShadow/>;}
function Wheel({z}:{z:number}){const spin=useRef<Group>(null);useFrame(()=>{if(spin.current)spin.current.rotation.x=motorcycleRide.distance/radius});return <group ref={spin} position={[0,radius,z]} name="spoked-wheel"><Part g={wheelTire} m={rubber}/>{[-.027,.027].map(x=><mesh key={x} position={[x,0,0]} geometry={wheelRim} material={silver}/>)}<Part g={spokes} m={silver}/><Part g={hub} m={silver}/><Part g={axle} m={trim}/></group>}
/** Reusable rounded step-through motorcycle; local forward is +Z. */
export function MotorcycleModel({scale=1}:{scale?:number}){
 return <group scale={scale} name="classic-motorcycle-model" dispose={null}>
  <Wheel z={front}/><Wheel z={rear}/>
  <Part g={frame} m={trim}/><Part g={swingarm} m={silver}/>
  <Part g={rearFender} m={fenderMat}/><Part g={chassis} m={blue}/><Part g={sideCover} m={blue}/>
  <Part g={apron} m={ivory}/><Part g={shieldEdge} m={trim}/><mesh geometry={shieldEdge} material={trim} scale={[-1,1,1]}/>
  <Part g={forks} m={blue}/><Part g={frontFender} m={fenderMat}/>
  <Part g={shockShafts} m={silver}/><Part g={shockCovers} m={silver}/>
  <Part g={engineBlock} m={engine}/><mesh geometry={engineCover} material={silver} position={[.132,.29,-.035]}/><mesh geometry={engineCover} material={silver} position={[-.132,.29,-.035]}/><Part g={cylinderFins} m={engine}/>
  <Box p={[0,.703,-.42]} s={[.20,.052,.62]} m={blueShade}/><Part g={seatPiping} m={silver}/><Part g={seat} m={seatMat}/><Part g={seatStrap} m={trim}/>
  <Ball p={[0,.938,.315]} s={[.123,.073,.072]} m={blue}/>
  <Box p={[0,.944,.376]} s={[.13,.10,.022]} m={trim}/><Box p={[0,.944,.391]} s={[.112,.083,.009]} m={glass}/>
  <Part g={handlebar} m={silver}/><Part g={grips} m={rubber}/><Part g={levers} m={silver}/>
  {[-1,1].map(s=><group key={s}><Ball p={[s*.14,.923,.32]} s={[.025,.025,.035]} m={trim}/><Ball p={[s*.14,.923,.348]} s={[.02,.02,.012]} m={amber}/></group>)}
  <Part g={mirrorStem} m={trim}/><Ball p={[.27,1.145,.226]} s={[.047,.055,.014]} m={trim}/><Ball p={[.27,1.145,.213]} s={[.038,.045,.005]} m={mirror}/>
  <Box p={[0,.55,-.90]} s={[.07,.10,.08]} m={trim}/><Box p={[0,.598,-.94]} s={[.105,.095,.042]} m={trim}/><Box p={[0,.60,-.965]} s={[.084,.072,.014]} m={red}/><Box p={[0,.50,-.95]} s={[.12,.072,.009]} m={ivory}/>
  <Part g={exhaustPipe} m={silver}/><Part g={muffler} m={silver}/><Ball p={[.18,.20,-.863]} s={[.021,.021,.003]} m={trim}/>
  <Part g={footrests} m={rubber}/><Part g={stand} m={trim}/>
 </group>;
}
export function ParkedMotorcycle(){const root=useRef<Group>(null);useFrame(()=>{if(root.current){root.current.visible=!motorcycleRide.riding;root.current.position.set(motorcycleRide.x,.015,motorcycleRide.z);root.current.rotation.set(0,motorcycleRide.yaw+Math.PI,-.045)}});return <group ref={root} position={[motorcycleData.x,.015,motorcycleData.z]} rotation={[0,motorcycleData.rotation+Math.PI,-.045]} userData={{dynamic:true}} name="parked-motorcycle-area5-west"><MotorcycleModel/></group>}
