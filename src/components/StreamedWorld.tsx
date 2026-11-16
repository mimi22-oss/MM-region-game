import { ThreeGhostsMissionScene } from './ThreeGhostsMissionScene';
import {HauntedWarehouseAudioZone} from './HauntedWarehouseAudioZone';
import { GhostNpcs } from './GhostNpc';
import { Ghost3DDebugGizmos } from './Ghost3DDebugGizmos';
import { CarBots } from './CarBots';
import type { TimeMode } from '../game/environmentTime';
import {staticDetails,updateStaticDetails} from '../game/staticVisibility';
import {decorateFestivalRegion,updateFestivalVisibility,createFestivalOverview} from '../game/festivalCandles';
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
import { registerGroundRegion, releaseGroundRegion, releaseGroundRegions } from '../game/groundSurface';
import { regionAssets, worldRegions as regions } from './regionAssets';
import { startupDiagnostics } from '../game/startupDiagnostics';
import { diagnosticConfig } from '../game/diagnosticMode';
import { sourceIsEdited } from '../game/worldEdits';
import { getIntroState, isIntroHighAltitude, useIntroState } from '../game/IntroStateMachine';
import kanbaleDatasetJson from '../data/kanbaleDataset.json' with { type: 'json' };
import { KanbaleChunkTiles } from './villages/kanbale/KanbaleChunkTiles';

// No spread into Math.min/max: large source collections exceed JS argument limits.
const bounds = regions.map(r => {
  if ('streamed' in r && r.streamed && r.id === 'kanbale') {
    const b = kanbaleDatasetJson.bounds;
    return { id: r.id, minX: b.minX - 60, maxX: b.maxX + 60, minZ: b.minZ - 60, maxZ: b.maxZ + 60 };
  }
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const h of r.houses){minX=Math.min(minX,h.x);maxX=Math.max(maxX,h.x);minZ=Math.min(minZ,h.z);maxZ=Math.max(maxZ,h.z);}
  return {id:r.id,minX:minX-60,maxX:maxX+60,minZ:minZ-60,maxZ:maxZ+60};
});
startupDiagnostics.record('map-parse', { regionCount: bounds.length });

const spawnRegions = selectRegions(bounds, ward.spawn.x, ward.spawn.z, 5, [], mobileQuality);
type Plot = { x: number; z: number; width: number; depth: number; rotation: number; color: string; height: number; y: number };
const ignoreOverviewRay = () => {};
const overviewGeometry = new BoxGeometry(), overviewMaterial = new MeshLambertMaterial();

/** A single draw call per region keeps the whole map visible without detailed object trees. */
function Overview({ region }: { region: typeof regions[number] }) {
  const mesh = useRef<InstancedMesh>(null);
  const plots = useMemo<Plot[]>(() => {
    if ('streamed' in region && region.streamed && region.id === 'kanbale') {
      return kanbaleDatasetJson.overviewPlots.map((p) => ({
        ...p,
        height: 4.5,
        y: 2.25,
      }));
    }
    const fields=[...new Map([...region.fields,...('bundedFields' in region?region.bundedFields:[]),...('separationFields' in region?region.separationFields:[])].map(f=>['id' in f?f.id:`${f.x}/${f.z}/${f.width}/${f.depth}/${f.rotation}`,f])).values()];
    return [
    ...fields.map(f => ({ ...f, height: .1, y: 0 })),
    ...region.roads.map(r => ({ ...r, color: r.main ? '#657371' : '#d4bd98', height: .15, y: .1 })),
    ...region.houses.filter(h => !sourceIsEdited(h.id)).map(h => ({ ...h, color: h.roof, height: 5, y: 2.5 })),
  ];}, [region]);

  useLayoutEffect(() => {
    const matrix = new Matrix4(), q = new Quaternion(), axis = new Vector3(0, 1, 0), v = new Vector3(), scale = new Vector3(), color = new Color();
    plots.forEach((p, i) => {
      matrix.compose(v.set(p.x, p.y, p.z), q.setFromAxisAngle(axis, p.rotation), scale.set(p.width, p.height, p.depth));
      mesh.current!.setMatrixAt(i, matrix);
      mesh.current!.setColorAt(i, color.set(p.color));
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [plots]);

  return <instancedMesh ref={mesh} raycast={ignoreOverviewRay} args={[overviewGeometry, overviewMaterial, plots.length]} />;
}

/** Freeze transform matrices on static nodes in live regions while preserving dynamic descendants. */
function freezeStaticMatrices(root: Object3D, parentDynamic = false) {
  const isDynamic = parentDynamic || Boolean(root.userData.dynamic || root.userData.flowPeriod || root.userData.flowPath);
  if (!isDynamic) {
    root.updateMatrix();
    root.matrixAutoUpdate = false;
  }
  const children = root.children;
  for (let i = 0; i < children.length; i++) {
    freezeStaticMatrices(children[i], isDynamic);
  }
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
    decorateFestivalRegion(root);
    if (live) freezeStaticMatrices(root);
    root.name = `detail-${id}`;
    startupDiagnostics.record('building-geom', { regionId: id });
    onBuilt(id, root);
  }, [id, host, live, onBuilt]);
  return createPortal(<RegionActivity.Provider value={active}>{content}</RegionActivity.Provider>, host);
});

export type StreamedWorldProps = {
  destination?: WorldDestination | null;
  paused?: boolean;
  minute?: number;
  timeMode?: TimeMode;
  soundEnabled?: boolean;
  soundVolume?: number;
  isAuthoritativeOnline?: boolean;
  onLoadingChange: (state: WorldLoadingState) => void;
  onSceneError: () => void;
};

type CachedRegion = { root: Group; flows: Object3D[]; festivalOverview: Group; details:ReturnType<typeof staticDetails> };
const MAX_CACHED_REGIONS = mobileQuality ? 2 : 5;

export function StreamedWorld({
  destination,
  paused = false,
  minute = 780,
  timeMode = 'auto',
  soundEnabled = true,
  soundVolume = 0.3,
  isAuthoritativeOnline = false,
  onLoadingChange,
  onSceneError,
}: StreamedWorldProps) {
  const { gl, scene, invalidate } = useThree();
  const intro = useIntroState();
  const downloads = useSyncExternalStore(regionAssets.subscribe, regionAssets.getSnapshot);
  const cache = useRef(new Map<string, CachedRegion>());
  const [prepared, setPrepared] = useState<string[]>([]);
  const [warming, setWarming] = useState<{ id: string; root: Group } | null>(null);
  const [started, setStarted] = useState(false);
  const [active, setActive] = useState(spawnRegions);
  const [overviewIds,setOverviewIds]=useState(()=>selectOverviewRegions(bounds,ward.spawn.x,ward.spawn.z,mobileQuality));
  const elapsed = useRef(0);
  const lastRegionCheck = useRef({ initialized: false, fx: 0, fz: 0, cy: 0, activeCount: -1 });
  useLayoutEffect(() => {
    elapsed.current = 0.25;
  }, [intro.active, intro.runId]);
  const introTargetRegions = useMemo(
    () =>
      intro.active && intro.target
        ? selectRegions(bounds, intro.target.x, intro.target.z, 10, [], mobileQuality)
        : [],
    [intro.active, intro.target?.x, intro.target?.z],
  );

  // Progressive loading: Prioritize active region, intro destination, then spawn, then idle background
  const building = useMemo(() => {
    if(warming)return undefined; // Finish GPU/ground preparation before building another region.
    const activeUnprepared = active.find(id => !prepared.includes(id) && !cache.current.has(id));
    if (activeUnprepared) return activeUnprepared;
    const introUnprepared = introTargetRegions.find(id => !prepared.includes(id) && !cache.current.has(id));
    if (introUnprepared) return introUnprepared;
    const spawnUnprepared = !started ? spawnRegions.find(id => !prepared.includes(id) && !cache.current.has(id)) : undefined;
    if (spawnUnprepared) return spawnUnprepared;
    // Stop background construction when full: evicted downloads must not cycle forever.
    if (!mobileQuality && !diagnosticConfig.disableDistantChunks && started && cache.current.size < MAX_CACHED_REGIONS) {
      const nextDownloaded = downloads.find(d => d.phase === 'downloaded' && !prepared.includes(d.id) && !cache.current.has(d.id));
      return nextDownloaded?.id;
    }
    return undefined;
  }, [active, introTargetRegions, prepared, started, downloads, warming]);

  const onBuilt = useCallback((id: string, root: Group) => {
    if (cache.current.has(id)) return;

    // Bounded caching on mobile: evict least recently used non-spawn, non-active, non-intro region
    if (cache.current.size >= MAX_CACHED_REGIONS) {
      for (const [cachedId, cached] of cache.current.entries()) {
        if (cachedId !== 'myothar' && !active.includes(cachedId) && !introTargetRegions.includes(cachedId)) {
          cached.root.removeFromParent();
          cached.festivalOverview.removeFromParent();
          releaseGroundRegion(scene,cachedId);
          disposePreparedRegion(cached.root);
          disposePreparedRegion(cached.festivalOverview);
          cache.current.delete(cachedId);
          setPrepared(prev => prev.filter(p => p !== cachedId));
          break;
        }
      }
    }

    cache.current.set(id, {
      root,
      flows: id === 'myothar' ? [] : regionFlows(root),
      festivalOverview: createFestivalOverview(root),
      details:staticDetails(root),
    });
    setWarming({ id, root });
  }, [active, introTargetRegions, scene]);

  // Request spawn regions immediately; load distant regions on-demand or idle
  useEffect(() => {
    regionAssets.request(spawnRegions, true);
  }, []);

  useEffect(() => {
    if (!started) return;
    const wanted = introTargetRegions.length
      ? [...new Set([...active, ...introTargetRegions])]
      : active;
    regionAssets.retainPending(wanted);
    regionAssets.request(wanted, true);
    if (!mobileQuality && !diagnosticConfig.disableDistantChunks) {
      const timer = window.setTimeout(() => {
        // Only one neighbouring region, not every region in the world catalogue.
        const focus=wanted.map(id=>bounds.find(b=>b.id===id)!).filter(Boolean);
        if(!focus.length)return;
        const nearest=bounds.filter(b=>!wanted.includes(b.id)).map(b=>({id:b.id,d:Math.min(...focus.map(a=>Math.hypot(Math.max(a.minX-b.maxX,0,b.minX-a.maxX),Math.max(a.minZ-b.maxZ,0,b.minZ-a.maxZ))))})).sort((a,b)=>a.d-b.d)[0];
        regionAssets.retainPending([...wanted,...(nearest&&nearest.d<650?[nearest.id]:[])]);
        if(nearest&&nearest.d<650)regionAssets.request([nearest.id], false);
      }, 1500);
      return () => window.clearTimeout(timer);
    }
  }, [started, active, introTargetRegions]);

  useEffect(() => {
    if (!warming) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        prepareRobotPatrols(warming.id);
        await warmRegion(gl, scene, warming.root, bounds.find(item => item.id === warming.id)!);
        if (!cancelled) {
          registerGroundRegion(scene, warming.id, warming.root);
          setPrepared(previous => (previous.includes(warming.id) ? previous : [...previous, warming.id]));
          setWarming(null);
          invalidate();
        }
      } catch {
        if (!cancelled) onSceneError();
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [warming, gl, scene, invalidate, onSceneError]);

  useLayoutEffect(() => {
    if (!destination || !started) return;
    const introNow = getIntroState();
    if (introNow.active && !introNow.reducedMotion) return;
    const height = 3.15 + (destination.distance ?? 10) * Math.sin(-(destination.pitch ?? -.16));
    setActive(selectRegions(bounds, destination.x, destination.z, height, [], mobileQuality));
  }, [destination, started]);

  useLayoutEffect(() => {
    for (const id of prepared) {
      const cached = cache.current.get(id);
      if (!cached) continue;
      const { root, festivalOverview } = cached;
      if (active.includes(id)) {
        // Map insertion order is the cache's least-recently-used order.
        cache.current.delete(id);cache.current.set(id,cached);
        if (root.parent !== scene) scene.add(root);
        festivalOverview.removeFromParent();
      } else {
        root.removeFromParent();
        if (festivalOverview.parent !== scene) scene.add(festivalOverview);
      }
    }
    invalidate();
  }, [prepared, active, scene, invalidate]);

  // StrictMode replays setup/cleanup; dispose only when this world really unmounts.
  const lifetime = useRef(0);
  useEffect(() => {
    const generation = ++lifetime.current;
    const entries = cache.current;
    return () => {
      queueMicrotask(() => {
        if (lifetime.current !== generation) return;
        releaseGroundRegions(scene);
        for (const { root, festivalOverview } of entries.values()) {
          disposePreparedRegion(root);
          disposePreparedRegion(festivalOverview);
        }
        entries.clear();
      });
    };
  }, [scene]);

  // When spawn regions are prepared, game is ready!
  const spawnReady = spawnRegions.every(id => prepared.includes(id));
  useLayoutEffect(() => {
    if (!started && spawnReady) {
      setStarted(true);
      startupDiagnostics.record('game-ready');
      invalidate();
    }
  }, [started, spawnReady, invalidate]);

  const loading = useMemo<WorldLoadingState>(() => ({
    blocking: !started,
    required: spawnRegions.map(id => {
      const entry = downloads.find(item => item.id === id) ?? { id, name: id, phase: 'idle' };
      return {
        id,
        name: entry.name,
        phase: prepared.includes(id) ? 'ready' : warming?.id === id ? 'rendering' : entry.phase === 'downloaded' ? 'waiting-render' : entry.phase,
      };
    }),
    downloads: downloads.map(({ id, name, phase }) => ({ id, name, phase })),
  }), [started, downloads, prepared, warming]);

  useLayoutEffect(() => {
    onLoadingChange(loading);
  }, [loading, onLoadingChange]);

function sameStringList(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const fallbackFocus = { x: 0, z: 0 };

  useFrame(({ camera, clock }, dt) => {
    if (!started) return;
    const introNow = getIntroState();
    const introHighAlt = introNow.active && !introNow.reducedMotion && camera.position.y > (mobileQuality ? 220 : 280);
    if (!introHighAlt) {
      for (const id of active) animateRegionFlows(cache.current.get(id)?.flows ?? [], clock.elapsedTime);
    }
    let focus = camera.userData.viewFocus as { x: number; z: number } | undefined;
    if (!focus) {
      fallbackFocus.x = camera.position.x;
      fallbackFocus.z = camera.position.z;
      focus = fallbackFocus;
    }
    elapsed.current += dt;
    if (elapsed.current < .2) return;
    elapsed.current = 0;
    if (!introHighAlt) {
      for (const id of active) {
        const cached = cache.current.get(id);
        if (cached) {
          updateFestivalVisibility(cached.root, focus.x, focus.z, mobileQuality, camera.position.y);
          updateStaticDetails(cached.details,camera.position.x,camera.position.y,camera.position.z,mobileQuality);
        }
      }
    }
    const lr = lastRegionCheck.current;
    if (
      !lr.initialized ||
      lr.activeCount !== active.length ||
      Math.abs(focus.x - lr.fx) > 5 ||
      Math.abs(focus.z - lr.fz) > 5 ||
      Math.abs(camera.position.y - lr.cy) > 3
    ) {
      let next: string[];
      if (introHighAlt) {
        // High-altitude stage: render only lightweight regional Overviews, never swap transit full-detail meshes.
        next = [];
      } else if (introNow.active && introNow.target) {
        // Descending intro: stick strictly to destination chunks so flyover doesn't flash unrelated transit regions.
        next = selectRegions(bounds, introNow.target.x, introNow.target.z, camera.position.y, active, mobileQuality);
      } else {
        next = selectRegions(bounds, focus.x, focus.z, camera.position.y, active, mobileQuality);
      }
      if (!sameStringList(next, active)) setActive(next);
      const nextOverview=selectOverviewRegions(bounds,focus.x,focus.z,mobileQuality);
      if(!sameStringList(nextOverview,overviewIds))setOverviewIds(nextOverview);
      lr.initialized = true;
      lr.fx = focus.x;
      lr.fz = focus.z;
      lr.cy = camera.position.y;
      lr.activeCount = next.length;
    }
  });

  const myothar = downloads.find(item => item.id === 'myothar')?.value;
  const Scene = building ? downloads.find(item => item.id === building)?.value : undefined;
  const hideNpcsDuringHighIntro = intro.active && isIntroHighAltitude(intro);

  return <>
    {started && active.includes('myothar') && <ThreeGhostsMissionScene />}
    {myothar && <RegionBuilder id="myothar" Scene={myothar} live active={started && active.includes('myothar')} onBuilt={onBuilt} />}
    {building && building !== 'myothar' && Scene && !cache.current.has(building) &&
      <RegionBuilder key={building} id={building} Scene={Scene} onBuilt={onBuilt} />}
    <KanbaleChunkTiles active={started && active.includes('kanbale')} destination={destination} />
    {regions.filter(region=>overviewIds.includes(region.id)).map(region => <group key={region.id} visible={!active.includes(region.id) || !prepared.includes(region.id)}><Overview region={region} /></group>)}
    {!paused && started && !diagnosticConfig.disableNPCs && !hideNpcsDuringHighIntro && <>
      <RobotBots activeRegions={active} />
      <CarBots />
    </>}
    {/* F07: HauntedWarehouseAudioZone operates independently of NPC rendering / diagnostic toggles */}
    {started && !hideNpcsDuringHighIntro && (
      <HauntedWarehouseAudioZone
        enabled={active.includes('myothar')}
        minute={minute}
        timeMode={timeMode}
        soundEnabled={soundEnabled}
        soundVolume={soundVolume}
        paused={paused}
      />
    )}
    {/* F04: in authoritative-v2 online multiplayer, server owns ghost simulation; local GhostNpcs is disabled. */}
    {started && !diagnosticConfig.disableNPCs && !hideNpcsDuringHighIntro && !isAuthoritativeOnline && <>
      <GhostNpcs paused={paused}
        enabled={active.includes('myothar')}
        minute={minute}
        timeMode={timeMode}
        soundEnabled={soundEnabled}
        soundVolume={soundVolume}
      />
      <Ghost3DDebugGizmos />
    </>}
  </>;
}
