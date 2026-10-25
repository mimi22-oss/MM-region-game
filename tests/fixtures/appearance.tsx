import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {Group,Mesh,Vector3} from 'three';
import {AppearanceSettings} from '../../src/components/AppearanceSettings';
import {CartoonCharacter} from '../../src/components/CartoonCharacter';
import {RobotCharacter} from '../../src/components/RobotCharacter';
import {Car} from '../../src/components/Car';
import {useAppearance,getAppearance} from '../../src/game/appearanceStore';
import {HUMAN_PRESETS} from '../../src/data/appearance';
import {driveableCars} from '../../src/game/carRide';
import type {CharacterKind} from '../../src/components/CharacterPicker';
import '../../src/style.css';
function Models({kind}:{kind:CharacterKind}){
 const a=useAppearance(),motion=useRef({speed:0,distance:0}),wheels=useRef<Group>(null);
 useFrame(({scene})=>{
  const torso=scene.getObjectByName('custom-person')?.getObjectByName('human-torso') as Mesh|undefined,other=scene.getObjectByName('reference-person')?.getObjectByName('human-torso') as Mesh|undefined;
  (window as any).appearanceTest={settings:getAppearance(),kind,torso:torso&&(torso.material as any).color.getHexString(),other:other&&(other.material as any).color.getHexString(),scale:torso?.getWorldScale(new Vector3()).toArray(),car:driveableCars[0],modelVisible:!!scene.getObjectByName(`car-bodywork-${a.car.model}`),robotLegs:!!scene.getObjectByName(`robot-legs-${a.robot.legs}`),robotHands:!!scene.getObjectByName(`robot-hand-${a.robot.hands}`)};
 });
 return <>
  <group name="custom-person" position={[-1.7,0,-1]}><CartoonCharacter appearance={a.human} motion={motion}/></group>
  <group name="reference-person" position={[-.8,0,-1]}><CartoonCharacter appearance={HUMAN_PRESETS.boy} motion={motion}/></group>
  <group position={[.4,0,-1]}><RobotCharacter wheels={wheels} appearance={a.robot} motion={motion}/></group>
  <group position={[1.2,0,2]} rotation={[0,-.25,0]}><Car model={a.car.model} color={a.car.color} motion={driveableCars[0]}/></group>
 </>;
}
function Fixture(){
 const [kind,setKind]=useState<CharacterKind>('cartoon');
 return <><Canvas dpr={1} style={{width:'100vw',height:'100vh'}} camera={{position:[6,4,-8],fov:45,near:.05}} onCreated={({camera})=>camera.lookAt(0,1,0)}><ambientLight intensity={1.7}/><directionalLight position={[3,8,-4]} intensity={2}/><color attach="background" args={['#e4e9df']}/><mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[100,100]}/><meshStandardMaterial color="#acb9a5"/></mesh><Models kind={kind}/></Canvas><aside className="settings-menu" style={{position:'fixed',left:10,top:10,right:'auto',width:310,maxHeight:'95vh'}}><AppearanceSettings kind={kind} onKindChange={setKind}/></aside></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture/></React.StrictMode>);
