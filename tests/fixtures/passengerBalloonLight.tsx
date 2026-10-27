import {useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {Box3,PointLight} from 'three';
import {PassengerBalloon} from '../../src/components/PassengerBalloon';
import {CartoonCharacter} from '../../src/components/CartoonCharacter';
import {CandleAnimation} from '../../src/components/Candle';
import {balloonRide} from '../../src/game/balloonRide';
const api=window as any;
Object.assign(balloonRide,{x:0,y:0,z:0,yaw:0,riding:true});
api.passengerView={position:[6,4,-8],target:[0,2.5,0]};api.passengerRiding=(riding:boolean)=>{balloonRide.riding=riding;};
function Person(){const motion=useRef({speed:0,distance:0,stepLift:0,leftFoot:0,rightFoot:0});return <group name="test-passenger" position={[0,.26,0]}><CartoonCharacter motion={motion}/></group>;}
function Probe(){useFrame(({scene,camera})=>{
 camera.position.set(...api.passengerView.position);camera.lookAt(...api.passengerView.target);scene.userData.environmentLamps=1;
 const root=scene.getObjectByName('passenger-balloon')!,person=scene.getObjectByName('test-passenger')!;
 root.updateWorldMatrix(true,true);person.updateWorldMatrix(true,true);
 const lights:any[]=[];root.traverse(o=>{if(o instanceof PointLight)lights.push({position:o.position.toArray(),intensity:o.intensity,shadow:o.castShadow,distance:o.distance,color:o.color.getHexString()});});
 const candle=root.getObjectByName('candle-in-holder')!,flame=candle.children.find(o=>o.type==='Group'&&o.name!=='candle-holder')!;
 const flameBounds=new Box3().setFromObject(flame.children[0]);
 api.passengerLightSample={lights,head:new Box3().setFromObject(person).max.y,candleY:candle.position.y,flameBase:flameBounds.min.y,flameHeight:flameBounds.max.y-flameBounds.min.y};
});return null;}
createRoot(document.getElementById('root')!).render(<Canvas dpr={1} gl={{logarithmicDepthBuffer:true}} style={{height:'100vh',width:'100vw'}} camera={{near:.1,far:9000,fov:48}}>
 <color attach="background" args={['#081125']}/><ambientLight color="#a6bddc" intensity={.28}/><directionalLight color="#9bbbee" intensity={.3} position={[-10,20,10]}/>
 <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.01,0]}><planeGeometry args={[100,100]}/><meshStandardMaterial color="#26332d"/></mesh>
 <CandleAnimation/><PassengerBalloon/><Person/><Probe/>
</Canvas>);
