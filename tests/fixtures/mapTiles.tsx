import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {InstancedMesh} from 'three';
import {SeparationFieldTiles} from '../../src/components/SeparationFieldTiles';
import {siTharSeparationFields} from '../../src/data/villages/sithar/separationFields';
import {siTharVillage} from '../../src/data/villages/sithar';
import {kyarInnVillage} from '../../src/data/villages/kyarinn';
import {natmyaungVillage} from '../../src/data/villages/natmyaung';
import {toWorld} from '../../src/data/villages/sithar/sitharData';
import {sceneGround} from '../../src/game/groundSurface';
const api=window as any;api.tileView=toWorld(-50,4061);
function Probe(){useFrame(({camera,scene,gl,clock})=>{
 const p=api.tileView;camera.position.set(p.x,350,p.z+.01);camera.lookAt(p.x,0,p.z);camera.userData.viewFocus=p;
 let instances=0,tiles=0;scene.traverse(o=>{if(o instanceof InstancedMesh&&o.name.startsWith('tile-fields-')){tiles++;instances+=o.count;}});
 const f=siTharSeparationFields[0];api.tileSample={tiles,instances,height:sceneGround(scene,clock.elapsedTime).height(f.x,f.z),geometries:gl.info.memory.geometries};
 });return null;}
function Context(){return <>{[kyarInnVillage,siTharVillage,natmyaungVillage].flatMap(r=>r.houses).map(h=><mesh key={h.id} position={[h.x,3,h.z]} rotation={[0,h.rotation,0]}><boxGeometry args={[h.width,6,h.depth]}/><meshLambertMaterial color="#bb9584"/></mesh>)}
 {[kyarInnVillage,siTharVillage,natmyaungVillage].flatMap(r=>r.roads).map(r=><mesh key={r.id} position={[r.x,.01,r.z]} rotation={[0,r.rotation,0]}><boxGeometry args={[r.width,.02,r.depth]}/><meshLambertMaterial color="#707d79"/></mesh>)}
 </>;}
createRoot(document.getElementById('root')!).render(<StrictMode><Canvas orthographic dpr={1} camera={{zoom:2,near:.1,far:10000}} style={{height:'100vh',width:'100vw'}}><color attach="background" args={['#607452']}/><ambientLight intensity={2}/><directionalLight position={[0,500,0]} intensity={1}/><Context/><SeparationFieldTiles/><Probe/></Canvas></StrictMode>);
