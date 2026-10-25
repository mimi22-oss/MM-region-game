import React, { useCallback, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { StreamedWorld } from '../../src/components/StreamedWorld';
import { WorldLoading } from '../../src/components/WorldLoading';
import type { WorldDestination, WorldLoadingState } from '../../src/game/regionLoading';
import { MAP_DESTINATIONS } from '../../src/game/locationDetect';
import { ward } from '../../src/data/ward';
import { worldRegions } from '../../src/components/regionAssets';
import { sceneGround } from '../../src/game/groundSurface';
import '../../src/style.css';

function CameraAt({ destination }: { destination: WorldDestination | null }) {
  const camera = useThree(state => state.camera);
  useLayoutEffect(() => {
    const point = destination ?? ward.spawn;
    camera.position.set(point.x, 6, point.z + 12);
    camera.lookAt(point.x, 1, point.z);
    camera.userData.viewFocus = { x: point.x, z: point.z };
  }, [camera, destination]);
  useFrame(({ scene, gl, clock }) => {
    const details = scene.children.filter(child => child.name.startsWith('detail-'));
    let objects = 0;
    scene.traverse(() => { objects++; });
    (window as any).worldStats = { details: details.map(root => ({ name: root.name, uuid: root.uuid })), objects, geometries: gl.info.memory.geometries };
    (window as any).checkGround = () => worldRegions.flatMap(region => region.roads.map(road => ({region:region.id,road:road.id,height:sceneGround(scene,clock.elapsedTime).height(road.x,road.z),expected:road.main?.21:.12}))).filter(item=>item.height+1e-5<item.expected);
  });
  return null;
}

function Fixture() {
  const [destination, setDestination] = useState<WorldDestination | null>(null);
  const [failed, setFailed] = useState(false);
  const sceneError = useCallback(() => setFailed(true), []);
  const [loading, setLoading] = useState<WorldLoadingState>({ blocking: true, required: [], downloads: [] });
  // A small canvas keeps software-rendered browser checks practical.
  return <>
    {MAP_DESTINATIONS.map(point => <button key={point.id} data-destination={point.id} onClick={() => setDestination({ ...point, seq: Date.now() })}>{point.label}</button>)}
    <div style={{ width: 360, height: 240 }}>
      <Canvas frameloop={loading.blocking ? 'demand' : 'always'} shadows={false} dpr={.5} camera={{ far: 9000 }}>
        <ambientLight intensity={2} />
        <StreamedWorld destination={destination} paused onLoadingChange={setLoading} onSceneError={sceneError} />
        <CameraAt destination={destination} />
      </Canvas>
    </div>
    <output data-ready={!loading.blocking && !failed} data-failed={failed}>{JSON.stringify(loading.required)}</output>
    <WorldLoading state={loading} sceneFailed={failed} />
  </>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture /></React.StrictMode>);
