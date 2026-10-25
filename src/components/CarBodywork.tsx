import {useMemo} from 'react';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,CylinderGeometry,Quaternion,Vector3,DoubleSide} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CAR_MODELS,type CarModel} from '../data/appearance';
type P=[number,number,number];
const cache=new Map<CarModel,{panels:BufferGeometry;glass:BufferGeometry;trim:BufferGeometry}>();
function bodywork(model:CarModel){
 const cached=cache.get(model);if(cached)return cached;
 const spec=CAR_MODELS[model],f=spec.roofFront,r=spec.roofRear,y=spec.roofY,truck=model==='lighttruck';
 const painted:BufferGeometry[]=[],glass:BufferGeometry[]=[],trim:BufferGeometry[]=[];
 const box=(to:BufferGeometry[],size:P,p:P)=>to.push(new BoxGeometry(...size).translate(...p));
 const pane=(points:P[])=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();glass.push(g);};
 const beam=(a:P,b:P,radius=.035)=>{const p=new Vector3(...a),q=new Vector3(...b),d=q.clone().sub(p),g=new CylinderGeometry(radius,radius,d.length(),8);g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),d.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());painted.push(g);};
 box(painted,[1.42,.065,r-f+.08],[0,y,(f+r)/2]);
 pane([[-.65,1.24,-.77],[.65,1.24,-.77],[.65,y,f],[-.65,y,f]]);
 const back=truck?r:1.10,backY=truck?1.56:1.20;
 pane([[-.65,backY,back],[.65,backY,back],[.65,y,r],[-.65,y,r]]);
 for(const side of [-1,1]){
  const x=side*.70;
  beam([x,1.20,-.77],[x,y,f]);beam([x,backY,back],[x,y,r]);
  pane([[x,1.19,-.65],[x,1.19,back],[x,y-.04,r],[x,y-.04,f]]);
  if(!truck)box(trim,[.035,y-1.18,.045],[x,(y+1.18)/2,.18]);
  if(model==='lambo'){
   box(trim,[.022,.20,.40],[side*.78,.88,.30]);
   box(painted,[.14,.09,2.6],[side*.73,.43,0]);
  }
 }
 beam([-.70,1.24,-.77],[.70,1.24,-.77],.025);
 beam([-.70,backY,back],[.70,backY,back],.025);
 if(truck){
  box(painted,[1.40,.37,.055],[0,1.38,r]);
  box(trim,[1.28,.06,1.03],[0,.72,.98]);
  box(trim,[1.38,.045,.04],[0,1.19,1.48]);
 }else if(model==='lambo'){
  box(trim,[1.46,.065,.22],[0,1.42,1.32]);
  for(const x of [-.47,.47])box(trim,[.045,.25,.05],[x,1.28,1.30]);
 }
 if(model==='toshiba')for(const z of [f+.1,r-.1])box(trim,[1.36,.07,.04],[0,y+.07,z]);
 box(trim,[model==='lambo'?1.2:.90,.15,.04],[0,.78,-1.57]);
 const combine=(parts:BufferGeometry[])=>{const g=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());return g;};
 const result={panels:combine(painted),glass:combine(glass),trim:combine(trim)};cache.set(model,result);return result;
}
/** Interchangeable upper bodywork on the common four-wheel chassis and cabin. */
export function CarBodywork({model,color}:{model:CarModel;color:string}){
 const geometry=useMemo(()=>bodywork(model),[model]);
 return <group name={`car-bodywork-${model}`}>
  <mesh geometry={geometry.panels} dispose={null} castShadow><meshStandardMaterial color={color} metalness={.25} roughness={.35}/></mesh>
  <mesh geometry={geometry.trim} dispose={null}><meshStandardMaterial color="#222830" roughness={.65}/></mesh>
  <mesh geometry={geometry.glass} dispose={null}><meshStandardMaterial color="#d8eff5" transparent opacity={.16} depthWrite={false} side={DoubleSide} roughness={.08}/></mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*.52,1.02,-1.49]} rotation={[0,side*.12,model==='lambo'?side*.12:0]}><boxGeometry args={[model==='lambo'?.32:.26,.09,.08]}/><meshStandardMaterial color="#eff6ff" emissive="#d8e9f9" emissiveIntensity={.4}/></mesh>)}
 </group>;
}
