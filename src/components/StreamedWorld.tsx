import { CarBots } from './CarBots';
import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect, useSyncExternalStore, memo, type ComponentType } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, MeshLambertMaterial, InstancedMesh, Matrix4, Quaternion, Vector3, Color, Group, type Object3D } from 'three';
import { ward } from '../data/ward';
import { mobileQuality, selectRegions, selectOverviewRegions } from '../game/sceneBudget';
import type { WorldDestination, WorldLoadingState } from '../game/regionLoading';
import { StaticBatch } from './StaticBatch';
import { RobotBots, prepareRobotPatrols } from './RobotBots';
import { RegionActivity } from './RegionActivity';
import { snapshotRegion, regionFlows, animateRegionFlows, warmRegion, disposePreparedRegion } from '../game/preparedScene';
import { registerGroundRegion, releaseGroundRegions } from '../game/groundSurface';
import { regionAssets, worldRegions as regions } from './regionAssets';

const bounds=regions.map(r=>({id:r.id,minX:Math.min(...r.houses.map(h=>h.x))-60,maxX:Math.max(...r.houses.map(h=>h.x))+60,minZ:Math.min(...r.houses.map(h=>h.z))-60,maxZ:Math.max(...r.houses.map(h=>h.z))+60}));
const spawnRegions = selectRegions(bounds, ward.spawn.x, ward.spawn.z, 5, [], mobileQuality);
type Plot={x:number;z:number;width:number;depth:number;rotation:number;color:string;height:number;y:number};
const ignoreOverviewRay = () => {};
const overviewGeometry = new BoxGeometry(), overviewMaterial = new MeshLambertMaterial();
/** A single draw call per region keeps the whole map visible without detailed object trees. */
function Overview({region}:{region:typeof regions[number]}){
 const mesh=useRef<InstancedMesh>(null);
 const plots=useMemo<Plot[]>(()=>[
  ...region.fields.map(f=>({...f,height:.1,y:0})),
  ...('bundedFields' in region?region.bundedFields:[]).map(f=>({...f,height:.1,y:0})),
  ...('separationFields' in region?region.separationFields:[]).map(f=>({...f,height:.1,y:0})),
  ...region.roads.map(r=>({...r,color:r.main?'#657371':'#d4bd98',height:.15,y:.1})),
  ...region.houses.map(h=>({...h,color:h.roof,height:5,y:2.5})),
 ],[region]);
 useLayoutEffect(()=>{const matrix=new Matrix4(),q=new Quaternion(),axis=new Vector3(0,1,0),v=new Vector3(),scale=new Vector3(),color=new Color();
 plots.forEach((p,i)=>{matrix.compose(v.set(p.x,p.y,p.z),q.setFromAxisAngle(axis,p.rotation),scale.set(p.width,p.height,p.depth));mesh.current!.setMatrixAt(i,matrix);mesh.current!.setColorAt(i,color.set(p.color))});
 mesh.current!.instanceMatrix.needsUpdate=true;if(mesh.current!.instanceColor)mesh.current!.instanceColor.needsUpdate=true;mesh.current!.computeBoundingSphere();
 },[plots]);
 return <instancedMesh ref={mesh} raycast={ignoreOverviewRay} args={[overviewGeometry,overviewMaterial,plots.length]} />;
}
/** Build once in a detached portal. Villages retain only the compact batched result. */
const RegionBuilder = memo(function RegionBuilder({ id, Scene, live = false, active = false, onBuilt }: {
 id: string;
 Scene: ComponentType;
 live?: boolean;
 active?: boolean;
 onBuilt: (id: string, root: Group) => void;
}) {
 const host = useMemo(() => new Group(), []), sent = useRef(false);
 const content = useMemo(() => <group dispose={null}><StaticBatch><Scene /></StaticBatch></group>, [Scene]);
 useEffect(() => {
  if (sent.current) return;
  sent.current = true;
  const root = live ? host : snapshotRegion(host);
  root.name = `detail-${id}`;
  onBuilt(id, root);
 }, [id, host, live, onBuilt]);
 return createPortal(<RegionActivity.Provider value={active}>{content}</RegionActivity.Provider>, host);
});

export type StreamedWorldProps = {
 destination?: WorldDestination | null;
 paused?: boolean;
 onLoadingChange: (state: WorldLoadingState) => void;
 onSceneError: () => void;
};

const preparationOrder = [...spawnRegions, ...selectOverviewRegions(bounds, ward.spawn.x, ward.spawn.z, mobileQuality).filter(id => !spawnRegions.includes(id))];
type CachedRegion = { root: Group; flows: Object3D[] };

export function StreamedWorld({ destination, paused = false, onLoadingChange, onSceneError }: StreamedWorldProps) {
 const { gl, scene, invalidate } = useThree();
 const downloads = useSyncExternalStore(regionAssets.subscribe, regionAssets.getSnapshot);
 const cache = useRef(new Map<string, CachedRegion>());
 const [prepared, setPrepared] = useState<string[]>([]);
 const [warming, setWarming] = useState<{ id: string; root: Group } | null>(null);
 const [started, setStarted] = useState(false);
 const [active, setActive] = useState(spawnRegions);
 const elapsed = useRef(0), startupFrames = useRef(0);
 const allPrepared = prepared.length === preparationOrder.length;
 const building = preparationOrder[prepared.length];
 const onBuilt = useCallback((id: string, root: Group) => {
  if (cache.current.has(id)) return;
  cache.current.set(id, { root, flows: id === 'myothar' ? [] : regionFlows(root) });
  setWarming({ id, root });
 }, []);

 // Downloads, React construction, batching, route generation and GPU uploads all
 // finish during startup. Changing location afterwards only attaches cached groups.
 useEffect(() => { regionAssets.request(preparationOrder); }, []);
 useEffect(() => {
  if (!warming) return;
  let cancelled = false;
  const timer = window.setTimeout(async () => {
   try {
    prepareRobotPatrols(warming.id);
    await warmRegion(gl, scene, warming.root, bounds.find(item => item.id === warming.id)!);
    if (!cancelled) {
     registerGroundRegion(scene, warming.id, warming.root);
     setPrepared(previous => [...previous, warming.id]);
     setWarming(null);
     invalidate();
    }
   } catch { if (!cancelled) onSceneError(); }
  }, 0);
  return () => { cancelled = true; window.clearTimeout(timer); };
 }, [warming, gl, scene, invalidate, onSceneError]);

 useLayoutEffect(() => {
  if (!destination || !started) return;
  const height = 3.15 + (destination.distance ?? 10) * Math.sin(-(destination.pitch ?? -.16));
  setActive(selectRegions(bounds, destination.x, destination.z, height, [], mobileQuality));
 }, [destination, started]);
 useLayoutEffect(() => {
  for (const id of prepared) {
   const { root } = cache.current.get(id)!;
   if (active.includes(id)) { if (root.parent !== scene) scene.add(root); }
   else root.removeFromParent();
  }
  invalidate();
 }, [prepared, active, scene, invalidate]);

 // StrictMode replays setup/cleanup; dispose only when this world really unmounts.
 const lifetime = useRef(0);
 useEffect(() => {
  const generation = ++lifetime.current;
  const entries = cache.current;
  return () => { queueMicrotask(() => {
   if (lifetime.current !== generation) return;
   releaseGroundRegions(scene);
   for (const { root } of entries.values()) disposePreparedRegion(root);
   entries.clear();
  }); };
 }, [scene]);

 const loading = useMemo<WorldLoadingState>(() => ({
  blocking: !started,
  required: preparationOrder.map(id => {
   const entry = downloads.find(item => item.id === id)!;
   return { id, name: entry.name, phase: prepared.includes(id) ? 'ready' : warming?.id === id ? 'rendering' : entry.phase === 'downloaded' ? 'waiting-render' : entry.phase };
  }),
  downloads: downloads.map(({ id, name, phase }) => ({ id, name, phase })),
 }), [started, downloads, prepared, warming]);
 useLayoutEffect(() => { onLoadingChange(loading); }, [loading, onLoadingChange]);

 useFrame(({ camera, clock }, dt) => {
  if (!started) {
   if (allPrepared) {
    invalidate();
    if (++startupFrames.current >= 2) setStarted(true);
   }
   return;
  }
  for (const id of active) animateRegionFlows(cache.current.get(id)?.flows ?? [], clock.elapsedTime);
  const focus = camera.userData.viewFocus ?? { x: camera.position.x, z: camera.position.z };
  elapsed.current += dt;
  if (elapsed.current < .2) return;
  elapsed.current = 0;
  const next = selectRegions(bounds, focus.x, focus.z, camera.position.y, active, mobileQuality);
  // No heavy tree replacement remains: switching cached regions is safe in motion.
  if (next.join() !== active.join()) setActive(next);
 });

 const myothar = downloads.find(item => item.id === 'myothar')?.value;
 const Scene = downloads.find(item => item.id === building)?.value;
 return <>
  {myothar && <RegionBuilder id="myothar" Scene={myothar} live active={started && active.includes('myothar')} onBuilt={onBuilt} />}
  {building && building !== 'myothar' && Scene && !cache.current.has(building) &&
   <RegionBuilder key={building} id={building} Scene={Scene} onBuilt={onBuilt} />}
  {regions.map(region => <group key={region.id} visible={!active.includes(region.id) || !prepared.includes(region.id)}><Overview region={region} /></group>)}
  {!paused && started && <><RobotBots activeRegions={active} /><CarBots /></>}
 </>;
}
