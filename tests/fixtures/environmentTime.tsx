import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {TimeEnvironment} from '../../src/components/TimeEnvironment';
import {EnvironmentSettings,useEnvironmentTime} from '../../src/components/EnvironmentSettings';
import {EnvironmentAudio} from '../../src/components/EnvironmentAudio';
import {House} from '../../src/components/House';
import {ward} from '../../src/data/ward';
import '../../src/style.css';
const api=window as any,h=ward.houses[0];
function Inspect(){useFrame(({scene,gl})=>{
 const sun=scene.getObjectByName('time-sun') as any,sky=scene.getObjectByName('time-sky') as any,stars=scene.getObjectByName('time-stars') as any;
 api.envSample={sun:sun.intensity,sky:sky.material.uniforms.zenith.value.getHexString(),lamps:scene.userData.environmentLamps,stars:stars.material.opacity,fog:(scene.fog as any)?.near,skyId:sky.uuid,calls:gl.info.render.calls};
});return null;}
function Fixture(){
 const environment=useEnvironmentTime(),[active,setActive]=useState(true);api.envActive=setActive;api.envChoose=environment.choose;api.envClock={period:environment.period,mode:environment.preferences.mode,minute:environment.minute};
 return <main className={environment.period==='night'||environment.period==='evening'?'night-mode':''}>
  <EnvironmentAudio period={environment.period} volume={environment.preferences.volume} enabled={environment.preferences.sound} active={active}/>
  <Canvas shadows dpr={.7} gl={{logarithmicDepthBuffer:true}} style={{height:'100vh',width:'100vw'}} camera={{position:[h.x+20,11,h.z+26],far:9000,fov:65}} onCreated={({camera})=>{camera.lookAt(h.x,5,h.z);camera.userData.viewFocus={x:h.x,z:h.z};}}>
   <TimeEnvironment minute={environment.minute}/><House h={h}/><Inspect/>
  </Canvas>
  <div className="settings-menu" style={{position:'absolute',right:10,top:10,width:290,maxHeight:'95vh',overflowY:'auto'}}><EnvironmentSettings value={environment.preferences} onChange={environment.setPreferences} onChoose={environment.choose} now={environment.now} period={environment.period}/></div>
 </main>;
}
const root=createRoot(document.getElementById('root')!);api.envUnmount=()=>root.unmount();root.render(<Fixture/>);
