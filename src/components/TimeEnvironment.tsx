import {useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {BackSide,BufferGeometry,Color,DirectionalLight,Float32BufferAttribute,Fog,Group,HemisphereLight,Mesh,MeshBasicMaterial,MeshStandardMaterial,Object3D,PointLight,ShaderMaterial,Vector3,type PointsMaterial} from 'three';
import {environmentBlend,type EnvironmentPalette} from '../game/environmentTime';
import {ward} from '../data/ward';
import {mobileQuality} from '../game/sceneBudget';
import {NightEnvironment} from './NightEnvironment';
import {StaticBatch} from './StaticBatch';

const colorKeys=['sky','horizon','fog','sun','ambient','ground'] as const;
const numericKeys=['sunlight','ambientLight','elevation','azimuth','fogNear','fogFar','lamps','stars','shadowSoftness'] as const;
type LightState=Omit<EnvironmentPalette,typeof colorKeys[number]>&Record<typeof colorKeys[number],Color>;
function paletteAt(minute:number):LightState {
 const {a,b,t}=environmentBlend(minute),out={} as LightState;
 for(const key of colorKeys)out[key]=new Color(a[key]).lerp(new Color(b[key]),t);
 for(const key of numericKeys)out[key]=a[key]+(b[key]-a[key])*t;
 return out;
}
const ignoreRay=()=>{};
/** One sky dome, one shadow-casting light and one star draw call; terrain stays mounted. */
export function TimeEnvironment({minute}:{minute:number}){
 const desired=useMemo(()=>paletteAt(minute),[minute]);
 const current=useRef<LightState|null>(null);if(!current.current)current.current=paletteAt(minute);
 const initial=current.current;
 const sun=useRef<DirectionalLight>(null),ambient=useRef<HemisphereLight>(null),ground=useRef<MeshStandardMaterial>(null);
 const sky=useRef<Mesh>(null),celestial=useRef<Group>(null),moon=useRef<MeshBasicMaterial>(null),stars=useRef<PointsMaterial>(null);
 const target=useMemo(()=>new Object3D(),[]),direction=useMemo(()=>new Vector3(),[]);
 const fog=useMemo(()=>new Fog(initial.fog,initial.fogNear,initial.fogFar),[]);
 const shader=useMemo(()=>new ShaderMaterial({side:BackSide,depthWrite:false,depthTest:false,toneMapped:false,
  uniforms:{zenith:{value:initial.sky.clone()},horizon:{value:initial.horizon.clone()},sunColor:{value:initial.sun.clone()},sunDirection:{value:new Vector3()},sunStrength:{value:0}},
  vertexShader:`varying vec3 vDirection;
   #include <common>
   #include <logdepthbuf_pars_vertex>
   void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`varying vec3 vDirection;uniform vec3 zenith;uniform vec3 horizon;uniform vec3 sunColor;uniform vec3 sunDirection;uniform float sunStrength;
   #include <common>
   #include <logdepthbuf_pars_fragment>
   void main(){
    #include <logdepthbuf_fragment>
    vec3 d=normalize(vDirection);float h=smoothstep(-0.07,0.65,d.y);
    vec3 color=mix(horizon,zenith,h);float disk=smoothstep(0.99965,0.99985,dot(d,sunDirection));
    float halo=pow(max(0.0,dot(d,sunDirection)),180.0)*0.18;
    gl_FragColor=vec4(mix(color,sunColor,(disk+halo)*sunStrength),1.0);
    #include <colorspace_fragment>
   }`,
 }),[]);
 const starGeometry=useMemo(()=>{
  const points=[];let seed=4721;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<(mobileQuality?100:320);i++){
   const y=.08+random()*.92,angle=random()*Math.PI*2,r=Math.sqrt(1-y*y);
   points.push(Math.cos(angle)*r,y,Math.sin(angle)*r);
  }
  return new BufferGeometry().setAttribute('position',new Float32BufferAttribute(points,3));
 },[]);
 useLayoutEffect(()=>()=>{shader.dispose();starGeometry.dispose();},[shader,starGeometry]);
 useFrame(({camera,scene},dt)=>{
  const c=current.current!,blend=1-Math.exp(-Math.min(dt,.1)*1.5);
  for(const key of colorKeys)c[key].lerp(desired[key],blend);
  for(const key of numericKeys)c[key]+=(desired[key]-c[key])*blend;
  scene.userData.environmentLamps=c.lamps;
  fog.color.copy(c.fog);fog.near=c.fogNear;fog.far=c.fogFar;
  const focus=camera.userData.viewFocus??camera.position;
  target.position.set(Math.round(focus.x/4)*4,0,Math.round(focus.z/4)*4);target.updateMatrixWorld();
  direction.set(Math.sin(c.azimuth)*Math.cos(c.elevation),Math.sin(c.elevation),Math.cos(c.azimuth)*Math.cos(c.elevation));
  if(sun.current){sun.current.position.copy(target.position).addScaledVector(direction,260);sun.current.color.copy(c.sun);sun.current.intensity=c.sunlight;sun.current.shadow.radius=c.shadowSoftness;}
  if(ambient.current){ambient.current.color.copy(c.ambient);ambient.current.groundColor.copy(c.ground);ambient.current.intensity=c.ambientLight;}
  ground.current?.color.copy(c.ground);
  shader.uniforms.zenith.value.copy(c.sky);shader.uniforms.horizon.value.copy(c.horizon);shader.uniforms.sunColor.value.copy(c.sun);shader.uniforms.sunDirection.value.copy(direction);shader.uniforms.sunStrength.value=1-c.stars;
  const far='far' in camera?Number(camera.far):9000;
  if(sky.current){sky.current.position.copy(camera.position);sky.current.scale.setScalar(far*.9);}
  if(celestial.current){celestial.current.position.copy(camera.position);celestial.current.scale.setScalar(far*.75);celestial.current.visible=c.stars>.001;}
  if(moon.current)moon.current.opacity=c.stars;
  if(stars.current)stars.current.opacity=c.stars;
 });
 return <>
  <primitive object={fog} attach="fog"/>
  <mesh name="time-sky" ref={sky} material={shader} renderOrder={-1000} frustumCulled={false} raycast={ignoreRay}><sphereGeometry args={[1,32,16]}/></mesh>
  <group ref={celestial}>
   <points name="time-stars" geometry={starGeometry} frustumCulled={false} renderOrder={-999} raycast={ignoreRay}><pointsMaterial ref={stars} color="#f4f5ff" size={mobileQuality?2:2.3} sizeAttenuation={false} transparent opacity={initial.stars} fog={false} depthTest={false} depthWrite={false} toneMapped={false}/></points>
   <mesh name="time-moon" position={[-.65,.58,.49]} renderOrder={-998} raycast={ignoreRay}><sphereGeometry args={[.022,24,16]}/><meshBasicMaterial ref={moon} color="#fff1ce" transparent opacity={initial.stars} fog={false} depthWrite={false} depthTest={false} toneMapped={false}/></mesh>
  </group>
  <primitive object={target}/>
  <hemisphereLight ref={ambient} args={[initial.ambient,initial.ground,initial.ambientLight]}/>
  <directionalLight name="time-sun" ref={sun} target={target} intensity={initial.sunlight} color={initial.sun} castShadow={!mobileQuality}
   shadow-mapSize={[1024,1024]} shadow-camera-left={-110} shadow-camera-right={110} shadow-camera-top={110} shadow-camera-bottom={-110} shadow-camera-near={.5} shadow-camera-far={650} shadow-normalBias={.08} shadow-bias={-.0001}/>
  <mesh position={[0,-.3,0]} receiveShadow><boxGeometry args={[ward.size,.6,ward.size]}/><meshStandardMaterial ref={ground} color={initial.ground}/></mesh>
  <TimeTownLights state={current}/>
 </>;
}
/** Keep the existing batched windows/street fixtures/temple beacons across all time changes. */
function TimeTownLights({state}:{state:{current:LightState|null}}){
 const root=useRef<Group>(null);
 const materials=useRef<{material:MeshBasicMaterial;color:Color}[]>([]);
 const anchors=useRef<{position:Vector3;color:Color;intensity:number;distance:number;decay:number}[]>([]);
 const pool=useMemo(()=>Array.from({length:mobileQuality?2:3},()=>new PointLight('#ffd38a',0,26,1.3)),[]);
 const selected=useRef<typeof anchors.current>([]),elapsed=useRef(1);
 useLayoutEffect(()=>{
  const unique=new Set<MeshBasicMaterial>();
  root.current!.traverse(object=>{
   if(object instanceof Mesh){object.raycast=ignoreRay;for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof MeshBasicMaterial)unique.add(material);}
   if(object.userData.nightLight){const light=object.userData.nightLight;anchors.current.push({...light,color:new Color(light.color),position:object.getWorldPosition(new Vector3())});}
  });
  materials.current=[...unique].map(material=>({material,color:material.color.clone()}));
  return ()=>{for(const item of materials.current)item.material.color.copy(item.color);materials.current=[];anchors.current=[];selected.current=[];};
 },[]);
 useFrame(({camera},dt)=>{
  const strength=state.current!.lamps;
  for(const item of materials.current)item.material.color.copy(item.color).multiplyScalar(.04+strength*.96);
  elapsed.current+=dt;
  if(elapsed.current>.5){
   elapsed.current=0;
   const focus=camera.userData.viewFocus??camera.position;
   const distance=(item:typeof anchors.current[number])=>Math.hypot(item.position.x-focus.x,item.position.z-focus.z);
   selected.current=anchors.current.filter(item=>distance(item)<item.distance*2).sort((a,b)=>distance(a)-distance(b)).slice(0,pool.length);
   selected.current.forEach((item,i)=>{pool[i].position.copy(item.position);pool[i].color.copy(item.color);pool[i].distance=item.distance;pool[i].decay=item.decay;});
  }
  pool.forEach((light,i)=>{light.intensity=(selected.current[i]?.intensity??0)*strength;});
 });
 return <group ref={root} name="time-town-lights"><StaticBatch><NightEnvironment sky={false}/></StaticBatch>{pool.map((light,i)=><primitive key={i} object={light}/>)}</group>;
}
