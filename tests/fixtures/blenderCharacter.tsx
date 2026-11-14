import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {CartoonCharacter,type CharacterMotion,type DrivingPose} from '../../src/components/CartoonCharacter';
import {MotorcycleModel} from '../../src/components/Motorcycle';
import {Car} from '../../src/components/Car';
import {DRIVER_POSITION,DRIVER_SCALE} from '../../src/game/carCabin';
import {HUMAN_PRESETS} from '../../src/data/appearance';
function Character({mode,preset}:{mode:string;preset:'boy'|'girl'}){
 const appearance=HUMAN_PRESETS[preset];
 const motion=useRef<CharacterMotion>({speed:0,distance:0});
 const driving=useRef<DrivingPose>({active:true,wheelAngle:.3,interior:false,clutch:false,brake:false,throttle:true});
 useFrame((_,dt)=>{motion.current.speed=['Walk','Bike','Swim'].includes(mode)?1.8:0;motion.current.distance+=motion.current.speed*dt;motion.current.airborne=mode==='Vault';motion.current.jumpVelocity=0;motion.current.swimming=mode==='Swim';});
 if(mode==='Car')return <><Car/><group position={DRIVER_POSITION} scale={DRIVER_SCALE}><CartoonCharacter appearance={appearance} motion={motion} driving={driving}/></group></>;
 return <>{mode==='Bike'&&<group rotation={[0,Math.PI,0]}><MotorcycleModel riding/></group>}<group position={mode==='Bike'?[0,.1,.26]:[0,0,0]}><CartoonCharacter appearance={appearance} key={mode} motion={motion} riding={mode==='Bike'}/></group></>;
}
function Fixture(){
 const [mode,setMode]=useState('Idle');
 const [preset,setPreset]=useState<'boy'|'girl'>('boy');
 return <><nav style={{position:'fixed',zIndex:1,padding:12}}>{(['boy','girl'] as const).map(name=><button key={name} onClick={()=>setPreset(name)}>{name}</button>)}{['Idle','Walk','Vault','Bike','Car','Swim'].map(name=><button key={name} onClick={()=>setMode(name)}>{name}</button>)}</nav><Canvas shadows dpr={1} style={{height:'100vh'}} camera={{position:[3,2.2,-4],fov:40}} onCreated={({camera})=>camera.lookAt(0,.9,0)}><color attach="background" args={['#d7dee4']}/><ambientLight intensity={1.8}/><directionalLight castShadow position={[2,6,-4]} intensity={2.3}/><mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[100,100]}/><meshStandardMaterial color="#b9c4b1"/></mesh><Character mode={mode} preset={preset}/></Canvas></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture/></React.StrictMode>);
