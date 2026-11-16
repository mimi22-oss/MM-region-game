import {killPlayerFromGhost,playerUnavailableForGhost} from '../game/playerDeath';
import {createGhostGrabPose} from '../game/ghostGrabPose';
import {createGhostPersonalityConfig,ghostPersonalityForId} from '../game/ghostPersonalities';
import {rememberGhostMaterial,applyGhostOpacity} from '../game/ghostVisuals';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  type Texture,
  Vector3,
  Quaternion,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AnimationController } from '../animation/core/AnimationController.ts';
import {
  GHOST_CLIP_SPECS,
  loadGhostRetargetedClip,
  type GhostClipId,
} from '../animation/ghost/GhostMotionLibrary.ts';
import {
  buildGhostHauntEnvironment,
  selectActiveGhostZones,
  type GhostHauntZoneId,
  type GhostWarehouseEnvironment,
} from '../data/ghostWarehouseWaypoints.ts';
import type { TimeMode } from '../game/environmentTime.ts';
import {
  GhostAiController,
  type GhostAiSnapshot,
} from '../game/ghostAi.ts';
import {
  clearGhostEncounterInteraction,
  clearGhostThreat,
  DEFAULT_GHOST_AI_CONFIG,
  DEFAULT_GHOST_COUNT,
  GHOST_MODEL_URL,
  GHOST_TARGET_HEIGHT_M,
  isGhostNightActive,
  isOtherGhostGrabbingPlayer,
  setActiveGhostZones,
  setGhostEncounterInteraction,
  setGhostThreatActive,
  useGhostDevSettings,
} from '../game/ghostConfig.ts';
import {
  HorrorAnimationSync,
  acquireSharedGhostAudio,
  releaseSharedGhostAudio,
  type GhostHorrorAudio,
} from '../game/ghostAudio.ts';
import {
  acquireSharedHorrorMixer,
  releaseSharedHorrorMixer,
  type HorrorAudioMixer,
} from '../game/audio/HorrorAudioMixer.ts';
import { sharedHorrorAssetLoader } from '../game/audio/HorrorAudioAssetLoader.ts';
import { setGhostAudioDiagnostics } from '../game/audio/horrorAudioDiagnostics.ts';
import {gameAudio} from '../game/gameAudio.ts';
import { sceneGround } from '../game/groundSurface.ts';
import { getQualityPreset } from '../game/qualityPreset.ts';
import { trafficColliders } from '../game/trafficColliders.ts';

interface GhostDebugEntry {
  ghostId: string;
  zoneId: GhostHauntZoneId;
  getSnapshot: () => GhostAiSnapshot | null;
  forceState: (next: Parameters<GhostAiController['forceStateForTest']>[0]) => void;
  preloadAllClips: () => Promise<(AnimationClip | null)[]>;
}

const ghostDebugRegistry = new Map<string, GhostDebugEntry>();
let activeRerollHandler: (() => void) | null = null;

function syncGhostDebugWindow() {
  if (typeof window === 'undefined') return;
  const win = window as unknown as Record<string, unknown>;
  if (ghostDebugRegistry.size === 0 && !activeRerollHandler) {
    delete win.__GHOST_NPC__;
    return;
  }
  const pickEntry = (id?: string): GhostDebugEntry | undefined => {
    if (id) return ghostDebugRegistry.get(id);
    for (const entry of ghostDebugRegistry.values()) {
      const snap = entry.getSnapshot();
      if (snap && snap.visible) return entry;
    }
    return ghostDebugRegistry.values().next().value;
  };
  win.__GHOST_NPC__ = {
    get count() {
      return ghostDebugRegistry.size;
    },
    getSnapshots: () =>
      Array.from(ghostDebugRegistry.values()).map((entry) => ({
        ghostId: entry.ghostId,
        zoneId: entry.zoneId,
        snapshot: entry.getSnapshot(),
      })),
    getSnapshot: (id?: string): GhostAiSnapshot | null => pickEntry(id)?.getSnapshot() ?? null,
    forceState: (next: Parameters<GhostAiController['forceStateForTest']>[0], id?: string) => {
      pickEntry(id)?.forceState(next);
    },
    preloadAllClips: () =>
      Promise.all(Array.from(ghostDebugRegistry.values()).map((entry) => entry.preloadAllClips())),
    rerollLocations: () => activeRerollHandler?.(),
  };
}

let cachedGhostModelPromise: Promise<GLTF> | null = null;
const cachedGhostClips = new Map<GhostClipId, AnimationClip>();
const inFlightGhostClipUi = new Map<GhostClipId, Promise<AnimationClip | null>>();

function clampGhostGltfTextures(gltf: GLTF, maxSize: number): GLTF {
  if (typeof document === 'undefined') return gltf;
  const seen = new Set<Texture>();
  const texKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'] as const;

  gltf.scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      for (const key of texKeys) {
        const tex = mat[key];
        if (!tex || seen.has(tex)) continue;
        seen.add(tex);
        tex.anisotropy = Math.min(tex.anisotropy || 1, maxSize <= 1024 ? 2 : 4);
        const img = tex.image as { width?: number; height?: number } | undefined;
        if (!img || typeof img.width !== 'number' || typeof img.height !== 'number') continue;
        const maxDim = Math.max(img.width, img.height);
        if (maxDim <= maxSize) continue;
        const scale = maxSize / maxDim;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
          tex.image = canvas;
          tex.needsUpdate = true;
        }
      }
    }
  });
  return gltf;
}

function loadGhostModelOnce(): Promise<GLTF> {
  if (!cachedGhostModelPromise) {
    cachedGhostModelPromise = new GLTFLoader()
      .loadAsync(GHOST_MODEL_URL)
      .then((gltf) => clampGhostGltfTextures(gltf, getQualityPreset().glbMaxTextureSize))
      .catch((error) => {
        cachedGhostModelPromise = null;
        throw error;
      });
  }
  return cachedGhostModelPromise;
}

export interface GhostNpcProps {
  readonly enabled: boolean;
  readonly paused?:boolean;
  readonly minute: number;
  readonly timeMode: TimeMode;
  readonly soundEnabled?: boolean;
  readonly soundVolume?: number;
  readonly ghostId?: string;
  readonly zoneId?: GhostHauntZoneId;
  readonly initialSeed?: number;
}

export interface GhostNpcsProps {
  readonly enabled: boolean;
  readonly paused?:boolean;
  readonly minute: number;
  readonly timeMode: TimeMode;
  readonly soundEnabled?: boolean;
  readonly soundVolume?: number;
  readonly count?: number;
}

interface GhostSpawnAssignment {
  readonly ghostId: string;
  readonly zoneId: GhostHauntZoneId;
  readonly seed: number;
}

function createRandomGhostAssignments(count: number): GhostSpawnAssignment[] {
  const zones = selectActiveGhostZones(count);
  return zones.map((zoneId, idx) => ({
    ghostId: `ghost-${idx + 1}`,
    zoneId,
    seed: ((Math.floor(Math.random() * 0x7fffffff) + 1) ^ ((idx + 1) * 2654435761)) >>> 0,
  }));
}

/**
 * Spawns multiple independent Night Ghost NPCs (`count` defaulting to 3) across randomized,
 * spatially separated haunt zones in Myothar while sharing one GLB mesh/clip cache and audio context.
 */
export function GhostNpcs({
  enabled,
  paused=false,
  minute,
  timeMode,
  soundEnabled = true,
  soundVolume = 0.3,
  count = DEFAULT_GHOST_COUNT,
}: GhostNpcsProps) {
  const devSettings = useGhostDevSettings();
  const scheduleActive = isGhostNightActive(minute, {
    timeMode,
    forceActive: devSettings.forceActive,
  });

  const [assignments, setAssignments] = useState<GhostSpawnAssignment[]>(() =>
    createRandomGhostAssignments(count),
  );
  const needsRerollRef = useRef(false);
  const wasScheduleActiveRef = useRef(scheduleActive);

  const rerollAssignments = useCallback(() => {
    needsRerollRef.current = false;
    setAssignments(createRandomGhostAssignments(count));
  }, [count]);

  useEffect(() => {
    setAssignments(createRandomGhostAssignments(count));
  }, [count]);

  useEffect(() => {
    activeRerollHandler = rerollAssignments;
    syncGhostDebugWindow();
    return () => {
      if (activeRerollHandler === rerollAssignments) {
        activeRerollHandler = null;
        syncGhostDebugWindow();
      }
    };
  }, [rerollAssignments]);

  // Re-randomize haunt locations after dawn despawn settles so each fresh night distributes ghosts anew
  useEffect(() => {
    const prev = wasScheduleActiveRef.current;
    wasScheduleActiveRef.current = scheduleActive;

    if (prev && !scheduleActive) {
      needsRerollRef.current = true;
      const timer = setTimeout(() => {
        if (needsRerollRef.current) rerollAssignments();
      }, (DEFAULT_GHOST_AI_CONFIG.despawnDurationSec + 0.6) * 1000);
      return () => clearTimeout(timer);
    }

    if (!prev && scheduleActive && needsRerollRef.current) {
      rerollAssignments();
    }
    return undefined;
  }, [scheduleActive, rerollAssignments]);

  useEffect(() => {
    if (!enabled || !scheduleActive) {
      setActiveGhostZones([]);
      return;
    }
    setActiveGhostZones(
      assignments.map((item) => {
        const env = buildGhostHauntEnvironment(item.zoneId);
        return {
          ghostId: item.ghostId,
          zoneId: item.zoneId,
          zoneName: env.zoneName ?? item.zoneId,
          x: env.anchor.x,
          z: env.anchor.z,
        };
      }),
    );
    return () => setActiveGhostZones([]);
  }, [assignments, enabled, scheduleActive]);

  return (
    <group name="night-ghosts-swarm">
      {assignments.map((item) => (
        <GhostNpc
          key={item.ghostId}
          ghostId={item.ghostId}
          zoneId={item.zoneId}
          initialSeed={item.seed}
          enabled={enabled}
          paused={paused}
          minute={minute}
          timeMode={timeMode}
          soundEnabled={soundEnabled}
          soundVolume={soundVolume}
        />
      ))}
    </group>
  );
}

/**
 * Autonomous Elderly Female Night Ghost NPC in a Myothar haunt zone.
 * Lazy-loads single model & retargeted extracted motions only when near active zone/hours,
 * avoids obstacles & oncoming traffic, and runs with zero per-frame React state updates.
 */
export function GhostNpc({
  enabled,
  paused=false,
  minute,
  timeMode,
  soundEnabled = true,
  soundVolume = 0.3,
  ghostId = 'ghost-1',
  zoneId = 'warehouse-row',
  initialSeed,
}: GhostNpcProps) {
  const devSettings = useGhostDevSettings();
  const scheduleActive = isGhostNightActive(minute, {
    timeMode,
    forceActive: devSettings.forceActive,
  });

  const zoneEnv = useMemo(() => buildGhostHauntEnvironment(zoneId), [zoneId]);

  const [loadArmed, setLoadArmed] = useState(false);
  const [modelGltf, setModelGltf] = useState<GLTF | null>(null);
  const { camera } = useThree();

  const checkTimerRef = useRef(0);
  const playerObjRef = useRef<Mesh | Group | null>(null);
  const playerVecRef = useRef(new Vector3());

  // Wait before fetching 3.7MB model until player is both active-hours (or dev forced) & near this ghost zone.
  useFrame(({ scene }, dt) => {
    if (paused || loadArmed || !enabled || !scheduleActive) return;
    checkTimerRef.current += Math.min(dt, 0.1);
    if (checkTimerRef.current < 0.4) return;
    checkTimerRef.current = 0;

    if (!('playerOccupied' in camera.userData)) return;

    if (!playerObjRef.current || !playerObjRef.current.parent) {
      playerObjRef.current = (scene.getObjectByName('player-avatar') as Group | null) ?? null;
    }

    let px = camera.position.x;
    let pz = camera.position.z;
    if (playerObjRef.current) {
      playerObjRef.current.getWorldPosition(playerVecRef.current);
      px = playerVecRef.current.x;
      pz = playerVecRef.current.z;
    } else {
      const focus = camera.userData?.viewFocus as { x?: number; z?: number } | undefined;
      if (!focus || typeof focus.x !== 'number' || typeof focus.z !== 'number') return;
      px = focus.x;
      pz = focus.z;
    }

    const dist =
      zoneEnv.measureDistanceFromZone?.(px, pz) ??
      Math.hypot(px - zoneEnv.anchor.x, pz - zoneEnv.anchor.z);
    if (dist <= DEFAULT_GHOST_AI_CONFIG.assetLoadDistanceM) {
      setLoadArmed(true);
    }
  });

  useEffect(() => {
    if (!loadArmed) return;
    void sharedHorrorAssetLoader.preload([
      'ghost-whisper',
      'spectral-cackle',
      'spectral-shriek',
      'horror-sting',
      'chase-tension',
      'ghost-grab-impact',
    ]);
    let live = true;
    loadGhostModelOnce()
      .then((gltf) => {
        if (live) setModelGltf(gltf);
      })
      .catch((error) => {
        console.warn('[GhostNpc] Failed to load ghost model:', error);
      });
    return () => {
      live = false;
    };
  }, [loadArmed]);

  if (!modelGltf) return null;

  return (
    <LoadedGhostNpc
      key={`${ghostId}:${zoneId}:${initialSeed ?? 0}`}
      modelGltf={modelGltf}
      enabled={enabled}
      paused={paused}
      scheduleActive={scheduleActive}
      soundEnabled={soundEnabled}
      soundVolume={soundVolume}
      ghostId={ghostId}
      zoneId={zoneId}
      zoneEnv={zoneEnv}
      initialSeed={initialSeed}
    />
  );
}

function LoadedGhostNpc({
  modelGltf,
  enabled,
  paused=false,
  scheduleActive,
  soundEnabled,
  soundVolume,
  ghostId,
  zoneId,
  zoneEnv,
  initialSeed,
}: {
  modelGltf: GLTF;
  enabled: boolean;
  paused?:boolean;
  scheduleActive: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  ghostId: string;
  zoneId: GhostHauntZoneId;
  zoneEnv: GhostWarehouseEnvironment;
  initialSeed?: number;
}) {
  const rootRef = useRef<Group>(null);
  const rigRef = useRef<{
    rigObject: Group;
    mixer: AnimationMixer;
    controller: AnimationController;
    materials: Material[];
    ai: GhostAiController;
    audio: GhostHorrorAudio;
    mixerAudio: HorrorAudioMixer;
    y: number;
    grounded: boolean;
    groundTimer: number;
    currentClipKey: string;
    lastAppliedOpacity: number;
    lastAudioSeq: number;
    lastSafetyState:string;
    lastAiState: string;
    audioClockSec: number;
    lastStingAt: number;
    lastIdleChatterAt: number;
    lastNearThreatAt: number;
    lastGrabImpactSeq: number;
    lastClipCueAt: number;
    lastKillSeq:number;
    grabPose:ReturnType<typeof createGhostGrabPose>;
    audioSync:HorrorAnimationSync;
    dispose: () => void;
  } | null>(null);

  const playerObjRef = useRef<Group | null>(null);
  const playerVecRef = useRef(new Vector3());
  const audioCamera=useMemo(()=>({position:new Vector3(),rotation:new Quaternion(),forward:new Vector3(),up:new Vector3()}),[]);
  const trafficVecRef = useRef(new Vector3());
  const trafficScratchRef = useRef<Array<{
    x: number;
    z: number;
    yaw: number;
    halfWidth: number;
    halfDepth: number;
  }>>([]);

  const scheduleActiveRef = useRef(scheduleActive);
  scheduleActiveRef.current = scheduleActive;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const soundRef = useRef({ enabled: soundEnabled, volume: soundVolume });
  soundRef.current = { enabled: soundEnabled, volume: soundVolume };

  useLayoutEffect(() => {
    const group = rootRef.current;
    if (!group) return;

    const cloned = clone(modelGltf.scene) as Group;
    cloned.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(cloned);
    const size = bounds.getSize(new Vector3());
    const scale = GHOST_TARGET_HEIGHT_M / Math.max(0.05, size.y);
    cloned.scale.multiplyScalar(scale);
    cloned.position.set(
      (-(bounds.min.x + bounds.max.x) * scale) * 0.5,
      -bounds.min.y * scale,
      (-(bounds.min.z + bounds.max.z) * scale) * 0.5,
    );
    cloned.updateMatrixWorld(true);

    const materials: Material[] = [];
    const seenMat = new Set<Material>();
    cloned.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
        // Skinned animation bounds shift widely on freaky/fall poses; parent group handles distance culling.
        obj.frustumCulled = false;
        const rawMats = Array.isArray(obj.material) ? obj.material : [obj.material];
        const clonedMats = rawMats.map((m) => {
          const mat = m.clone();rememberGhostMaterial(mat);
          if (!seenMat.has(mat)) {
            seenMat.add(mat);
            materials.push(mat);
          }
          return mat;
        });
        obj.material = Array.isArray(obj.material) ? clonedMats : clonedMats[0];
      }
    });

    const mixer = new AnimationMixer(cloned);
    const controller = new AnimationController(mixer, cloned);
    const ai = new GhostAiController(zoneEnv, createGhostPersonalityConfig(ghostPersonalityForId(ghostId)), initialSeed);

    group.add(cloned);
    group.visible = false;

    let disposed = false;

    const ensureClip = (clipId: GhostClipId): Promise<AnimationClip | null> => {
      const existing = cachedGhostClips.get(clipId);
      if (existing) return Promise.resolve(existing);
      const pending = inFlightGhostClipUi.get(clipId);
      if (pending) return pending;

      const req = loadGhostRetargetedClip(clipId, cloned)
        .then((clip) => {
          cachedGhostClips.set(clipId, clip);
          return clip;
        })
        .catch((error) => {
          console.warn(`[GhostNpc] Failed to load clip "${clipId}":`, error);
          return null;
        })
        .finally(() => {
          inFlightGhostClipUi.delete(clipId);
        });
      inFlightGhostClipUi.set(clipId, req);
      return req;
    };

    // Preload primary encounter clips eagerly in background once model enters active zone
    void Promise.all([
      ensureClip('depressed'),
      ensureClip('freaky'),
      ensureClip('flee_01'),
      ensureClip('flee_02'),
      ensureClip('laugh_01'),
    ]);

    const applyClip = (clipId: GhostClipId, loop: boolean, speedScale: number) => {
      const spec = GHOST_CLIP_SPECS[clipId];
      const finalSpeed = spec.basePlaybackSpeed * speedScale;
      const cached = cachedGhostClips.get(clipId);
      if (cached) {
        controller.play(cached, {
          loop,
          speed: finalSpeed,
          crossFadeSec: spec.crossFadeSec,
          fadeOutSec: spec.fadeOutSec,
          endHoldSec: loop ? 0 : Math.max(0.8, spec.endHoldSec),
        });
        return;
      }
      void ensureClip(clipId).then((loadedClip) => {
        if (disposed || !loadedClip) return;
        const curState = rigRef.current?.ai.getActiveClipDirective();
        if (curState && curState.clipId === clipId) {
          controller.play(loadedClip, {
            loop: curState.loop,
            speed: GHOST_CLIP_SPECS[clipId].basePlaybackSpeed * curState.speedScale,
            crossFadeSec: GHOST_CLIP_SPECS[clipId].crossFadeSec,
            fadeOutSec: GHOST_CLIP_SPECS[clipId].fadeOutSec,
            endHoldSec: curState.loop ? 0 : Math.max(0.8, GHOST_CLIP_SPECS[clipId].endHoldSec),
          });
        }
      });
    };

    const audio = acquireSharedGhostAudio();
    const mixerAudio = acquireSharedHorrorMixer();
    const detachAudio=gameAudio.attach();
    const unlockAudio = (event:Event) => {if(event.isTrusted)audio.unlock();};
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', unlockAudio, { passive: true });
      document.addEventListener('keydown', unlockAudio, { passive: true });
    }

    const dispose = () => {
      disposed = true;
      clearGhostEncounterInteraction(ghostId);
      clearGhostThreat(ghostId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
      }
      mixerAudio.releaseOwner(ghostId);
      releaseSharedHorrorMixer();
      if (ghostId === 'ghost-1') {
        setGhostAudioDiagnostics(null);
      }
      audio.release(ghostId);detachAudio();
      releaseSharedGhostAudio();
      controller.dispose();
      for (const mat of materials) mat.dispose();
      cloned.traverse((child) => {
        if ((child as { isSkinnedMesh?: boolean; skeleton?: { dispose: () => void } }).isSkinnedMesh) {
          (child as { skeleton?: { dispose: () => void } }).skeleton?.dispose();
        }
      });
      group.remove(cloned);
    };

    rigRef.current = {
      rigObject: cloned,
      mixer,
      controller,
      materials,
      ai,
      audio,
      mixerAudio,
      y: 0,
      grounded: false,
      groundTimer: 0.4,
      currentClipKey: '',
      lastAppliedOpacity: -1,
      lastAudioSeq: 0,
      lastSafetyState:'',
      lastAiState: '',
      audioClockSec: 0,
      lastStingAt: -Infinity,
      lastIdleChatterAt: 2,
      lastNearThreatAt: -Infinity,
      lastGrabImpactSeq: -1,
      lastClipCueAt: -Infinity,
      lastKillSeq:-1,
      grabPose:createGhostGrabPose(cloned),
      audioSync:new HorrorAnimationSync(),
      dispose,
    };

    ghostDebugRegistry.set(ghostId, {
      ghostId,
      zoneId,
      getSnapshot: (): GhostAiSnapshot | null => rigRef.current?.ai.getSnapshot() ?? null,
      forceState: (next) => {
        rigRef.current?.ai.forceStateForTest(next);
      },
      preloadAllClips: () =>
        Promise.all((Object.keys(GHOST_CLIP_SPECS) as GhostClipId[]).map((id) => ensureClip(id))),
    });
    syncGhostDebugWindow();

    // Attach clip loader callback onto ref instance
    (rigRef.current as unknown as { applyClip: typeof applyClip }).applyClip = applyClip;

    return () => {
      ghostDebugRegistry.delete(ghostId);
      syncGhostDebugWindow();
      rigRef.current?.dispose();
      rigRef.current = null;
    };
  }, [modelGltf, zoneEnv, ghostId, zoneId, initialSeed]);

  useFrame(({ scene, clock, camera }, delta) => {
    const rig = rigRef.current;
    const root = rootRef.current;
    if (!rig || !root || paused) return;

    const dt = Math.min(delta, 0.05);
    const shouldRun = enabledRef.current && scheduleActiveRef.current;

    if (!playerObjRef.current || !playerObjRef.current.parent) {
      playerObjRef.current = (scene.getObjectByName('player-avatar') as Group | null) ?? null;
    }

    let px = camera.position.x;
    let py = rig.y;
    let pz = camera.position.z;
    if (playerObjRef.current) {
      playerObjRef.current.getWorldPosition(playerVecRef.current);
      px = playerVecRef.current.x;
      py = playerVecRef.current.y;
      pz = playerVecRef.current.z;
    } else {
      const focus = camera.userData?.viewFocus as { x?: number; z?: number } | undefined;
      if (focus && typeof focus.x === 'number' && typeof focus.z === 'number') {
        px = focus.x;
        pz = focus.z;
      }
    }

    // Collect nearby traffic colliders into reusable scratch array (zero per-frame heap pressure once sized)
    const trafficList = trafficScratchRef.current;
    let trafficLen = 0;
    const snapBefore = rig.ai.getSnapshot();
    if (snapBefore.state === 'ROAD_CROSSING') {
      const gx = snapBefore.x;
      const gz = snapBefore.z;
      for (const [colliderRoot, box] of trafficColliders) {
        colliderRoot.getWorldPosition(trafficVecRef.current);
        const dx = trafficVecRef.current.x - gx;
        const dz = trafficVecRef.current.z - gz;
        if (dx * dx + dz * dz > 45 * 45) continue;
        let slot = trafficList[trafficLen];
        if (!slot) {
          slot = { x: 0, z: 0, yaw: 0, halfWidth: 0, halfDepth: 0 };
          trafficList.push(slot);
        }
        slot.x = trafficVecRef.current.x;
        slot.z = trafficVecRef.current.z;
        slot.yaw = colliderRoot.rotation.y;
        slot.halfWidth = box.width * 0.5;
        slot.halfDepth = box.depth * 0.5;
        trafficLen++;
      }
    }
    trafficList.length = trafficLen;

    const snap = rig.ai.step({
      dt,
      activeBySchedule: shouldRun,
      playerX: px,
      playerZ: pz,
      playerInVehicle:
        playerUnavailableForGhost() || Boolean(camera.userData?.playerOccupied) ||
        Math.abs(py - rig.y) > 2.6 ||
        isOtherGhostGrabbingPlayer(ghostId),
      traffic: trafficList,
    });

    camera.getWorldPosition(audioCamera.position);camera.getWorldQuaternion(audioCamera.rotation);
    audioCamera.forward.set(0,0,-1).applyQuaternion(audioCamera.rotation);audioCamera.up.set(0,1,0).applyQuaternion(audioCamera.rotation);
    gameAudio.listener(audioCamera.position.x,audioCamera.position.y,audioCamera.position.z,audioCamera.forward.x,audioCamera.forward.y,audioCamera.forward.z,audioCamera.up.x,audioCamera.up.y,audioCamera.up.z);
    if(snap.playerKilled&&rig.lastKillSeq!==snap.grabInteraction.seq){rig.lastKillSeq=snap.grabInteraction.seq;killPlayerFromGhost(ghostId,snap.grabInteraction.seq,px,pz);}
    setGhostEncounterInteraction(snap.grabInteraction, ghostId);
    setGhostThreatActive(
      ghostId,
      snap.state === 'SCARING' ||
        snap.state === 'CHASING' ||
        snap.state === 'GRABBING' ||
        snap.state === 'OBSERVING_PLAYER',
    );

    root.userData.ghostAttackEnabled=snap.attackEnabled;root.userData.ghostCollisionEnabled=snap.collisionEnabled;
    rig.audioClockSec += dt;
    const retreating=snap.state==='RETREAT'||snap.state==='FADE_OUT';
    const despawned=snap.state==='DESPAWNING'||snap.state==='DORMANT';
    if((retreating&&rig.lastSafetyState!==snap.state)||snap.state==='DORMANT'||!shouldRun){
     rig.audio.stop(ghostId);
     rig.mixerAudio.stopOwner(ghostId);
    }
    rig.lastSafetyState=snap.state;
    const audible=soundRef.current.enabled&&soundRef.current.volume>0&&shouldRun&&snap.visible&&snap.distToPlayerM<=65&&!document.hidden;
    const ghostPos={x:snap.x,y:rig.y+1.5,z:snap.z};
    rig.audio.position(ghostId,ghostPos.x,ghostPos.y,ghostPos.z,audible);
    rig.mixerAudio.positionOwner(ghostId,ghostPos.x,ghostPos.y,ghostPos.z,audible,soundRef.current.volume);
    rig.audio.sustain(ghostId,'ghost_ambient',audible&&!retreating&&!despawned&&snap.state!=='CHASING');

    // CHASING: start chase tension once and scale intensity as ghost approaches; fade out on retreat/despawn.
    const chasingActive=audible&&snap.state==='CHASING';
    if(chasingActive){
     const chaseIntensity=Math.max(0.28,Math.min(1,1-(snap.distToPlayerM-3)/30))*(snap.homeProtected?0.15:1);
     rig.mixerAudio.setChaseTension(ghostId,true,chaseIntensity,dt);
    }else{
     rig.mixerAudio.setChaseTension(ghostId,false,0,dt);
    }

    // DETECTED: brief horror sting once on detection transition with cooldown.
    const enteredDetected=(snap.state==='OBSERVING_PLAYER'||snap.state==='SCARING')&&rig.lastAiState!=='OBSERVING_PLAYER'&&rig.lastAiState!=='SCARING';
    if(audible&&enteredDetected&&rig.audioClockSec-rig.lastStingAt>=10){
     rig.lastStingAt=rig.audioClockSec;
     rig.mixerAudio.playCue({assetId:'horror-sting',fallbackPreset:'ghost_warning',bus:'horrorEvents',owner:ghostId,position:ghostPos,volume:0.78});
    }

    // GRABBING: play grab impact strictly once per unique grab interaction seq.
    if(audible&&snap.state==='GRABBING'&&snap.grabInteraction.phase==='neck-grab'&&snap.grabInteraction.seq!==rig.lastGrabImpactSeq){
     rig.lastGrabImpactSeq=snap.grabInteraction.seq;
     rig.mixerAudio.playCue({assetId:'ghost-grab-impact',fallbackPreset:'ghost_grab',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.92});
    }

    // Existing Ghost AI discrete cue events (scream / evil-laugh / flee-scare).
    if(snap.audioCue&&snap.audioCue.seq!==rig.lastAudioSeq){
     rig.lastAudioSeq=snap.audioCue.seq;
     if(audible){
      if(snap.audioCue.cue==='scream'){
       rig.lastClipCueAt=rig.audioClockSec;
       rig.mixerAudio.playCue({assetId:'spectral-shriek',fallbackPreset:'ghost_scream',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.88});
      }else if(snap.audioCue.cue==='evil-laugh'){
       rig.lastClipCueAt=rig.audioClockSec;
       rig.mixerAudio.playCue({assetId:'spectral-cackle',fallbackPreset:'ghost_evil_laugh',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.85});
      }else if(snap.audioCue.cue==='flee-scare'){
       rig.mixerAudio.playCue({assetId:'horror-sting',fallbackPreset:'ghost_warning',bus:'horrorEvents',owner:ghostId,volume:0.78});
      }
     }
    }

    // NEAR PLAYER: spatial shriek or cackle with cooldown when closing distance.
    if(audible&&!retreating&&snap.distToPlayerM<=14&&(snap.state==='CHASING'||snap.state==='OBSERVING_PLAYER')&&rig.audioClockSec-rig.lastNearThreatAt>=8.5){
     rig.lastNearThreatAt=rig.audioClockSec;
     const nearAsset=snap.state==='CHASING'?'spectral-shriek':'spectral-cackle';
     rig.mixerAudio.playCue({assetId:nearAsset,fallbackPreset:nearAsset==='spectral-shriek'?'ghost_scream':'ghost_evil_laugh',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.8});
    }

    // IDLE: occasional distant whisper or spectral cackle while patrolling/hiding nearby.
    const isIdlePatrol=snap.state==='HIDING'||snap.state==='WANDERING'||snap.state==='ROAD_CROSSING'||snap.state==='COOLDOWN'||snap.state==='RETURNING_HOME';
    if(audible&&!retreating&&isIdlePatrol&&rig.audioClockSec-rig.lastIdleChatterAt>=15){
     rig.lastIdleChatterAt=rig.audioClockSec;
     const idleAsset=snap.distToPlayerM<=36&&Math.floor(rig.audioClockSec)%3===0?'spectral-cackle':'ghost-whisper';
     rig.mixerAudio.playCue({assetId:idleAsset,fallbackPreset:idleAsset==='spectral-cackle'?'ghost_evil_laugh':'ghost_whisper',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.56});
    }

    const actualClip=rig.currentClipKey.split(':')[0];
    const clip=cachedGhostClips.get(actualClip as GhostClipId);
    const action=clip?rig.mixer.existingAction(clip):null;
    rig.audioSync.step({state:snap.state,clip:action?.isRunning()&&(!retreating||actualClip==='depressed')?actualClip:'',clipTime:action?.time??0,clipDuration:clip?.duration??0,
      moving:snap.state==='FLEEING'||snap.state==='CHASING'||snap.state==='WANDERING'||snap.state==='ROAD_CROSSING'||snap.state==='RETURNING_HOME',
      grabPhase:snap.grabInteraction.phase,visible:snap.visible},preset=>{
      if(!audible)return;
      if(preset==='ghost_grab')return;
      if((preset==='ghost_scream'||preset==='ghost_evil_laugh')&&rig.audioClockSec-rig.lastClipCueAt<0.35)return;
      if(preset==='ghost_footsteps'){
       rig.mixerAudio.playCue({assetId:'distant-footsteps',fallbackPreset:'ghost_footsteps',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.42});
       return;
      }
      if(preset==='ghost_whisper'){
       rig.mixerAudio.playCue({assetId:'ghost-whisper',fallbackPreset:'ghost_whisper',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.65});
       return;
      }
      if(preset==='ghost_warning'){
       rig.mixerAudio.playCue({assetId:'horror-sting',fallbackPreset:'ghost_warning',bus:'horrorEvents',owner:ghostId,volume:0.75});
       return;
      }
      if(preset==='ghost_scream'){
       rig.mixerAudio.playCue({assetId:'spectral-shriek',fallbackPreset:'ghost_scream',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.86});
       return;
      }
      if(preset==='ghost_evil_laugh'){
       rig.mixerAudio.playCue({assetId:'spectral-cackle',fallbackPreset:'ghost_evil_laugh',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.82});
       return;
      }
      rig.audio.play(preset,1,ghostId);
     });

    if(snap.state==='CHASING'||snap.state==='GRABBING'||snap.state==='SCARING'||snap.state==='OBSERVING_PLAYER'||ghostId==='ghost-1'){
     setGhostAudioDiagnostics({ghostId,state:snap.state,distToPlayerM:Math.round(snap.distToPlayerM*10)/10,chaseActive:chasingActive});
    }
    rig.lastAiState=snap.state;

    const withinVis = snap.visible && snap.distToPlayerM <= DEFAULT_GHOST_AI_CONFIG.visibleDistanceM;
    root.visible = withinVis;
    if (!withinVis) return;

    // Ground alignment via throttled terrain raycast/height query (immediate on initial spawn)
    rig.groundTimer += dt;
    if (!rig.grounded || snap.state === 'SPAWNING' || rig.groundTimer >= 0.35) {
      rig.groundTimer = 0;
      rig.grounded = true;
      const g = sceneGround(scene, clock.elapsedTime);
      rig.y = g.height(snap.x, snap.z) + 0.01;
    }

    root.position.set(snap.x, rig.y, snap.z);
    root.rotation.set(0, snap.yaw, 0);

    // Apply opacity fade transitions cleanly without dirtying materials every frame
    if (Math.abs(snap.opacity - rig.lastAppliedOpacity) > 0.003) {
      rig.lastAppliedOpacity = snap.opacity;
      for (let i = 0; i < rig.materials.length; i++) {
        const m = rig.materials[i];
        applyGhostOpacity(m,snap.opacity);
      }
    }

    // Update active animation clip cleanly when directive changes
    const clipKey = `${snap.activeClip.clipId}:${snap.activeClip.loop ? 1 : 0}`;
    if (clipKey !== rig.currentClipKey) {
      rig.currentClipKey = clipKey;
      const applyFn = (
        rig as unknown as {
          applyClip?: (clipId: GhostClipId, loop: boolean, speedScale: number) => void;
        }
      ).applyClip;
      applyFn?.(snap.activeClip.clipId, snap.activeClip.loop, snap.activeClip.speedScale);
    } else {
      const spec = GHOST_CLIP_SPECS[snap.activeClip.clipId];
      rig.controller.setSpeed(spec.basePlaybackSpeed * snap.activeClip.speedScale);
    }

    // Suspend animation mixer step if camera/player is beyond detail threshold
    if (snap.distToPlayerM <= DEFAULT_GHOST_AI_CONFIG.aiSuspendDistanceM) {
      rig.controller.stepBlend(false, false, dt);
      rig.mixer.update(dt);
      if(snap.grabInteraction.phase==='neck-grab')rig.grabPose.update(px,py+1.35,pz,snap.yaw);
    }
  });

  return <group ref={rootRef} name={`night-ghost-${ghostId}`} userData={{ dynamic: true }} />;
}
