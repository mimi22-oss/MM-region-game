import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {InstancedMesh,Matrix4,PointLight,Vector3} from 'three';
import {MyanmarFireBalloon} from '../../src/components/MyanmarFireBalloon';
import {FireBalloonSky} from '../../src/components/FireBalloonSky';
import {CandleAnimation,CandleInHolder} from '../../src/components/Candle';
const view={position:[7,3.2,9],target:[0,2.1,0]};
Object.assign(window,{balloonLightView:view});
function Probe(){
 useFrame(({camera,scene})=>{
  camera.position.set(...view.position as [number,number,number]);camera.lookAt(...view.target as [number,number,number]);
  const sky=scene.getObjectByName('fire-balloon-sky');if(!sky)return;
  const flames=sky.getObjectByName('balloon-flames') as InstancedMesh,glows=sky.getObjectByName('balloon-glows') as InstancedMesh;
  const matrix=new Matrix4(),p=new Vector3();let finite=true,lights=0;
  sky.traverse(object=>{if(object instanceof PointLight)lights++;if(object instanceof InstancedMesh)for(let i=0;i<object.count;i++){object.getMatrixAt(i,matrix);finite&&=matrix.elements.every(Number.isFinite);p.setFromMatrixPosition(matrix);finite&&=Number.isFinite(p.length());}});
  if(flames?.count)Object.assign(window,{balloonLightResult:{flames:flames.count,glows:glows.count,lights,finite}});
 });return null;
}
createRoot(document.getElementById('root')!).render(<div style={{height:'100vh'}}><Canvas gl={{logarithmicDepthBuffer:true}} camera={{fov:44,near:.01,far:9000}}>
 <color attach="background" args={['#071126']}/><ambientLight intensity={.25}/>
 <CandleAnimation/><MyanmarFireBalloon position={[-1,0,0]} floating={false} hasLight={false}/>
 <CandleInHolder position={[2,0,0]} scale={2}/>
 <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.01,0]}><planeGeometry args={[12,12]}/><meshStandardMaterial color="#172133"/></mesh>
 <FireBalloonSky count={36} maxNearLOD={1} maxMidLOD={4}/><Probe/>
</Canvas></div>);
