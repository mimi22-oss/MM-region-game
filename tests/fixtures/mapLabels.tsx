import { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { MapLabelsOverlay, MapLabelsProjection } from '../../src/components/MapLabels';
import { myotharCenterPOIs } from '../../src/data/wards/myothar/center/myotharCenterPOIs';
import '../../src/style.css';

const view = { x: -400, z: -650, height: 1000, tilt: 0.001, yaw: 0 };
Object.assign(window, { mapLabelView: view });
function Camera() {
 useFrame(({ camera }) => {
  camera.position.set(view.x + Math.sin(view.yaw) * view.tilt, view.height, view.z + Math.cos(view.yaw) * view.tilt);
  camera.lookAt(view.x, 0, view.z);
 });
 return null;
}
function Fixture() {
 const host = useRef<HTMLDivElement>(null);
 return <main><div className="scene-wrap">
  <Canvas camera={{ fov: 65, far: 10000 }}>
   <color attach="background" args={['#adc3a0']} />
   <Camera />
   {myotharCenterPOIs.map(poi => <mesh key={poi.id} position={[poi.x, 3, poi.z]}><boxGeometry args={[20, 6, 15]} /><meshBasicMaterial color="#8a7868" /></mesh>)}
   <MapLabelsProjection host={host} enabled />
  </Canvas>
  <MapLabelsOverlay host={host} hidden={false} />
 </div></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
