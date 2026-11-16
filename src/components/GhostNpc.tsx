import {combatLineClear,registerCombatTarget,playerCombat} from '../game/combat/combatRuntime';
import {ghostCombatReaction,requestGhostReaction,finishGhostReaction,clearGhostCombatReaction,setGhostCombatEngaged} from '../game/combat/GhostCombatReactions';
import {GuardMeleeController} from '../game/combat/GuardMeleeController';
import {isPlayerHomeProtected} from '../game/playerHomeProtection';
import {isGhostSegmentWalkable} from '../data/ghostWarehouseWaypoints';
import { getGhostRuntime, registerGhostRuntime } from '../game/missions/ghostRuntimeRegistry';
import { guardMissionActive, updateGhostGuard, getGuardGhost, seedGuardGhost } from '../game/missions/ghostGuardCoordinator';
import { GHOST_STATS, isGhostDefeated } from '../game/missions/threeGhostsMission';
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
  isGhostDevUiAvailable,
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
  shouldTriggerDetectionSting,
  createGhostScareAudioState,
  checkAndCommitScareCue,
  type GhostHorrorAudio,
  type GhostScareAudioState,
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
import {
  registerGhostDebugProvider,
  unregisterGhostDebugProvider,
  type GhostDebugEntry,
} from '../game/audio/ghostDebugStore.ts';

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

const cachedGhostClips = new Map<GhostClipId, AnimationClip>();
const inFlightGhostClipUi = new Map<GhostClipId, Promise<AnimationClip | null>>();

import {
  GHOST_LOAD_RETRY_DELAYS_MS,
  loadGhostModelOnce,
  clampGhostGltfTextures,
  setGhostModelLoaderForTest,
  resetGhostModelCacheForTest,
} from '../game/ghostModelLoader';

export {
  GHOST_LOAD_RETRY_DELAYS_MS,
  setGhostModelLoaderForTest,
  resetGhostModelCacheForTest,
  loadGhostModelOnce,
};

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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { camera } = useThree();

  const checkTimerRef = useRef(0);
  const playerObjRef = useRef<Mesh | Group | null>(null);
  const playerVecRef = useRef(new Vector3());
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wait before fetching 3.7MB model until player is both active-hours (or dev forced) & near this ghost zone.
  useFrame(({ scene }, dt) => {
    if (paused || !enabled || !scheduleActive) return;
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
      if (!loadArmed) {
        setLoadArmed(true);
      }
    } else if (dist > DEFAULT_GHOST_AI_CONFIG.assetLoadDistanceM + 15 && !modelGltf) {
      // F05: Player moved away from haunt zone while model was still unloaded.
      // Disarm so that re-approaching triggers an immediate fresh load attempt.
      if (loadArmed) {
        setLoadArmed(false);
        setLoadAttempt(0);
      }
    }
  });

  useEffect(() => {
    if (!loadArmed || modelGltf) return;
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
        if (live) {
          setModelGltf(gltf);
        }
      })
      .catch((error) => {
        if (!live) return;
        console.warn(`[GhostNpc] Failed to load ghost model (attempt ${loadAttempt + 1}):`, error);
        // F05: Bounded exponential backoff retry (5s, 15s, 30s)
        const delay = GHOST_LOAD_RETRY_DELAYS_MS[Math.min(loadAttempt, GHOST_LOAD_RETRY_DELAYS_MS.length - 1)];
        retryTimeoutRef.current = setTimeout(() => {
          if (live) {
            setLoadAttempt((prev) => prev + 1);
          }
        }, delay);
      });

    // F05: Immediate retry on network recovery
    const handleOnline = () => {
      if (live && !modelGltf) {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        setLoadAttempt((prev) => prev + 1);
      }
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      live = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [loadArmed, loadAttempt, modelGltf]);

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
  const runtimeRef = useRef<ReturnType<typeof registerGhostRuntime> | null>(null);
  const runtimeWorld = useMemo(() => new Vector3(), []);
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
    lastStateTransition: { from: string; to: string; atSec: number } | null;
    microTimings: { aiMs: number; audioMs: number };
    scareAudioState: GhostScareAudioState;
    grabPose:ReturnType<typeof createGhostGrabPose>;
    guardMelee:GuardMeleeController;
    reactionSeq:number;
    playerReactionSeq:number;
    reactionClip:string|null;
    deathComplete:boolean;
    playCombat:(name:string)=>void;
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
    const scale = (GHOST_TARGET_HEIGHT_M / 2) * (GHOST_STATS[ghostId as keyof typeof GHOST_STATS]?.scale ?? 2) / Math.max(0.05, size.y);
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
    const runtime = registerGhostRuntime(ghostId);
    runtimeRef.current = runtime;

    let disposed = false;
    const releaseTarget=registerCombatTarget(ghostId,{root:group,height:size.y*scale,radius:Math.min(.65,Math.max(.3,size.x*scale*.3))});
    const playCombat=(name:string)=>{
      const clip=modelGltf.animations.find(c=>c.name===name);
      if(!clip){console.warn('Missing ghost combat clip',name);return;}
      if(rigRef.current)rigRef.current.reactionClip=name;
      controller.play(clip,{loop:false,crossFadeSec:.08,endHoldSec:0,fadeOutSec:.12});
    };
    controller.onFinished(()=>{
      const rig=rigRef.current;if(!rig?.reactionClip)return;
      if(rig.reactionClip==='Ghost_Death')rig.deathComplete=true;
      finishGhostReaction(ghostId,rig.reactionSeq);rig.reactionClip=null;rig.currentClipKey='';
    });

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
      if(rigRef.current?.reactionClip)return;
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
        if (disposed || !loadedClip || rigRef.current?.reactionClip) return;
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
      disposed = true;releaseTarget();clearGhostCombatReaction(ghostId);
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
      lastStateTransition: null,
      microTimings: { aiMs: 0, audioMs: 0 },
      scareAudioState: createGhostScareAudioState(),
      grabPose:createGhostGrabPose(cloned),
      guardMelee:new GuardMeleeController(DEFAULT_GHOST_AI_CONFIG.grabHoldDurationSec,DEFAULT_GHOST_AI_CONFIG.playerFallDurationSec),
      playerReactionSeq:-1,reactionSeq:0,reactionClip:null,deathComplete:isGhostDefeated(ghostId),playCombat,
      audioSync:new HorrorAnimationSync(),
      dispose,
    };

    const debugEntry: GhostDebugEntry = {
      ghostId,
      zoneId,
      personality: ghostPersonalityForId(ghostId),
      getSnapshot: (): GhostAiSnapshot | null => rigRef.current?.ai.getSnapshot() ?? null,
      forceState: (next) => {
        rigRef.current?.ai.forceStateForTest(next);
      },
      preloadAllClips: () =>
        Promise.all((Object.keys(GHOST_CLIP_SPECS) as GhostClipId[]).map((id) => ensureClip(id))),
      getMicroTimings: () => rigRef.current?.microTimings ?? { aiMs: 0, audioMs: 0 },
      getModelStatus: () => 'ready',
      getInactivityReason: () => {
        if (!enabledRef.current || !scheduleActiveRef.current) return 'schedule-day';
        if (paused) return 'paused';
        const s = rigRef.current?.ai.getSnapshot();
        if (s?.homeProtected) return 'home-protected';
        return 'active';
      },
      getLastStateTransition: () => {
        const trans = rigRef.current?.lastStateTransition;
        if (!trans) return null;
        return {
          from: trans.from,
          to: trans.to,
          ageSec: Math.max(0, Math.round(((rigRef.current?.audioClockSec ?? 0) - trans.atSec) * 10) / 10),
        };
      },
    };
    ghostDebugRegistry.set(ghostId, debugEntry);
    registerGhostDebugProvider(ghostId, debugEntry);
    syncGhostDebugWindow();

    // Attach clip loader callback onto ref instance
    (rigRef.current as unknown as { applyClip: typeof applyClip }).applyClip = applyClip;

    return () => {
      runtime.release();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      ghostDebugRegistry.delete(ghostId);
      unregisterGhostDebugProvider(ghostId);
      syncGhostDebugWindow();
      rigRef.current?.dispose();
      rigRef.current = null;
    };
  }, [modelGltf, zoneEnv, ghostId, zoneId, initialSeed]);

  useFrame(({ scene, clock, camera }, delta) => {
    const rig = rigRef.current;
    const root = rootRef.current;
    if (!rig || !root) return;
    if (paused) {
      const previous = getGhostRuntime(ghostId);
      const snap = rig.ai.getSnapshot();
      runtimeRef.current?.report(previous?.x ?? snap.x, previous?.z ?? snap.z, false, 'PAUSED', previous?.source ?? 'ai');
      return;
    }
    if (isGhostDefeated(ghostId)) {
      runtimeRef.current?.clear();root.userData.ghostAttackEnabled=false;root.userData.ghostCollisionEnabled=false;
      clearGhostEncounterInteraction(ghostId);clearGhostThreat(ghostId);rig.guardMelee.cancel();
      rig.audio.stop(ghostId);rig.mixerAudio.stopOwner(ghostId);
      if(rig.deathComplete){root.visible=false;return;}
      if(rig.reactionClip!=='Ghost_Death'){const e=ghostCombatReaction(ghostId);rig.reactionSeq=e?.seq??0;rig.playCombat('Ghost_Death');}
      root.visible=true;rig.controller.stepBlend(false,false,Math.min(delta,.25));rig.mixer.update(Math.min(delta,.25));
      const clip=modelGltf.animations.find(c=>c.name==='Ghost_Death');
      const normalized=clip?(rig.mixer.existingAction(clip,rig.rigObject)?.time??0)/clip.duration:1;
      const opacity=Math.min(1,(1-normalized)/.2);
      for(const material of rig.materials)applyGhostOpacity(material,opacity);
      if(!clip)rig.deathComplete=true;
      return;
    }
    const reaction=ghostCombatReaction(ghostId);
    if(reaction&&reaction.seq!==rig.reactionSeq){
      rig.reactionSeq=reaction.seq;rig.guardMelee.cancel();clearGhostEncounterInteraction(ghostId);rig.playCombat(reaction.clip);
    }
    root.visible = true;

    // F03: allow up to 0.25s per frame so low-FPS devices (<20 FPS) don't lose time;
    // rig.ai.step internally subdivides dt into <=0.05s fixed substeps.
    const dt = Math.min(delta, 0.25);
    const missionGuard = guardMissionActive();
    const shouldRun = enabledRef.current && scheduleActiveRef.current && !missionGuard;

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

    const isDev = isGhostDevUiAvailable();
    const tAi0 = isDev ? performance.now() : 0;
    const snap = rig.ai.step({
      dt:rig.reactionClip&&rig.reactionClip!=='Ghost_Attack'?0:dt,
      activeBySchedule: shouldRun,
      playerX: px,
      playerZ: pz,
      playerInVehicle:
        playerUnavailableForGhost() || Boolean(camera.userData?.playerOccupied) ||
        Math.abs(py - rig.y) > 2.6 ||
        isOtherGhostGrabbingPlayer(ghostId),
      traffic: trafficList,
    });
    const tAi1 = isDev ? performance.now() : 0;

    camera.getWorldPosition(audioCamera.position);camera.getWorldQuaternion(audioCamera.rotation);
    audioCamera.forward.set(0,0,-1).applyQuaternion(audioCamera.rotation);audioCamera.up.set(0,1,0).applyQuaternion(audioCamera.rotation);
    gameAudio.listener(audioCamera.position.x,audioCamera.position.y,audioCamera.position.z,audioCamera.forward.x,audioCamera.forward.y,audioCamera.forward.z,audioCamera.up.x,audioCamera.up.y,audioCamera.up.z);
    if(snap.playerKilled&&rig.lastKillSeq!==snap.grabInteraction.seq){rig.lastKillSeq=snap.grabInteraction.seq;killPlayerFromGhost(ghostId,snap.grabInteraction.seq,px,pz);}
    if(!missionGuard)setGhostEncounterInteraction(snap.grabInteraction, ghostId);
    if(!missionGuard&&snap.state==='GRABBING'&&snap.grabInteraction.phase==='neck-grab'&&rig.lastAiState!=='GRABBING')rig.playCombat('Ghost_Attack');
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

    // DETECTED: brief horror sting once on detection transition with cooldown (F11: includes Hunter direct chase).
    const enteredDetected = shouldTriggerDetectionSting(
      snap.state,
      rig.lastAiState,
      rig.lastStingAt,
      rig.audioClockSec,
      retreating,
      10,
    );
    if(audible&&enteredDetected){
     rig.lastStingAt=rig.audioClockSec;
     rig.mixerAudio.playCue({assetId:'horror-sting',fallbackPreset:'ghost_warning',bus:'horrorEvents',owner:ghostId,position:ghostPos,volume:0.78});
    }

    // GRABBING: play grab impact strictly once per unique grab interaction seq.
    if(audible&&snap.state==='GRABBING'&&snap.grabInteraction.phase==='neck-grab'&&snap.grabInteraction.seq!==rig.lastGrabImpactSeq){
     rig.lastGrabImpactSeq=snap.grabInteraction.seq;
     rig.mixerAudio.playCue({assetId:'ghost-grab-impact',fallbackPreset:'ghost_grab',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.92});
    }

    // Existing Ghost AI discrete cue events (scream / evil-laugh / flee-scare) - sequence deduplicated (F11).
    if(snap.audioCue&&snap.audioCue.seq!==rig.lastAudioSeq){
     rig.lastAudioSeq=snap.audioCue.seq;
     if(audible){
      if(snap.audioCue.cue==='scream'){
       if(checkAndCommitScareCue('scream','ai_event',{state:snap.state,scareTriggerCount:snap.scareTriggerCount,grabSeq:snap.grabInteraction.seq,audioClockSec:rig.audioClockSec},rig.scareAudioState)){
        rig.lastClipCueAt=rig.audioClockSec;
        rig.mixerAudio.playCue({assetId:'spectral-shriek',fallbackPreset:'ghost_scream',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.88});
       }
      }else if(snap.audioCue.cue==='evil-laugh'){
       if(checkAndCommitScareCue('evil-laugh','ai_event',{state:snap.state,scareTriggerCount:snap.scareTriggerCount,grabSeq:snap.grabInteraction.seq,audioClockSec:rig.audioClockSec},rig.scareAudioState)){
        rig.lastClipCueAt=rig.audioClockSec;
        rig.mixerAudio.playCue({assetId:'spectral-cackle',fallbackPreset:'ghost_evil_laugh',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.85});
       }
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
       // F11: Deduplicate against GhostAiController scream event and delayed clip arrivals
       if(checkAndCommitScareCue('scream','animation_sync',{state:snap.state,scareTriggerCount:snap.scareTriggerCount,grabSeq:snap.grabInteraction.seq,audioClockSec:rig.audioClockSec},rig.scareAudioState)){
        rig.lastClipCueAt=rig.audioClockSec;
        rig.mixerAudio.playCue({assetId:'spectral-shriek',fallbackPreset:'ghost_scream',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.86});
       }
       return;
      }
      if(preset==='ghost_evil_laugh'){
       // F11: Deduplicate against GhostAiController laugh event and delayed clip arrivals
       if(checkAndCommitScareCue('evil-laugh','animation_sync',{state:snap.state,scareTriggerCount:snap.scareTriggerCount,grabSeq:snap.grabInteraction.seq,audioClockSec:rig.audioClockSec},rig.scareAudioState)){
        rig.lastClipCueAt=rig.audioClockSec;
        rig.mixerAudio.playCue({assetId:'spectral-cackle',fallbackPreset:'ghost_evil_laugh',bus:'ghostEffects',owner:ghostId,position:ghostPos,volume:0.82});
       }
       return;
      }
      rig.audio.play(preset,1,ghostId);
     });

    if(snap.state==='CHASING'||snap.state==='GRABBING'||snap.state==='SCARING'||snap.state==='OBSERVING_PLAYER'||ghostId==='ghost-1'){
     setGhostAudioDiagnostics({ghostId,state:snap.state,distToPlayerM:Math.round(snap.distToPlayerM*10)/10,chaseActive:chasingActive});
    }
    const tAud1 = isDev ? performance.now() : 0;
    if (isDev) {
      rig.microTimings.aiMs = Math.round((tAi1 - tAi0) * 100) / 100;
      rig.microTimings.audioMs = Math.round((tAud1 - tAi1) * 100) / 100;
    }
    if (rig.lastAiState && snap.state !== rig.lastAiState) {
      rig.lastStateTransition = {
        from: rig.lastAiState,
        to: snap.state,
        atSec: rig.audioClockSec,
      };
    }
    rig.lastAiState=snap.state;

    // Record the authoritative AI position even when distance culling hides the mesh.
    // A spawn-zone anchor must NEVER count as an encounter.
    if (!missionGuard) runtimeRef.current?.report(snap.x, snap.z, shouldRun && snap.visible, snap.state);
    if (missionGuard && (ghostId === 'ghost-1' || ghostId === 'ghost-2' || ghostId === 'ghost-3')) {
      const id = ghostId as 'ghost-1' | 'ghost-2' | 'ghost-3';
      seedGuardGhost(id, snap.x, snap.z);
      updateGhostGuard(clock.elapsedTime, px, pz);
      const guard = getGuardGhost(id);
      runtimeRef.current?.report(guard.x, guard.z, true, guard.mode);
      if (rig.lastAppliedOpacity !== 1) {
        rig.lastAppliedOpacity = 1;
        for (const material of rig.materials) applyGhostOpacity(material, 1);
      }
      const distanceToPlayer = Math.hypot(guard.x-px, guard.z-pz);
      const attackClip=modelGltf.animations.find(c=>c.name==='Ghost_Attack');
      const attackNormalized=attackClip?(rig.mixer.existingAction(attackClip,rig.rigObject)?.time??0)/attackClip.duration:0;
      let defence=playerCombat.defend();
      if(defence==='block'||defence==='parry'){
        const heading=playerObjRef.current?.rotation.y??0;
        if((-Math.sin(heading)*(guard.x-px)-Math.cos(heading)*(guard.z-pz))/Math.max(.001,distanceToPlayer)<.3)defence='none';
      }
      const interaction=rig.guardMelee.step({dt,x:guard.x,z:guard.z,distance:distanceToPlayer,protected:isPlayerHomeProtected(px,pz),
        valid:distanceToPlayer<=2.45&&guard.mode==='chase'&&combatLineClear(guard.x,guard.z,px,pz)&&!playerUnavailableForGhost()&&!camera.userData.playerOccupied&&(!rig.reactionClip||rig.reactionClip==='Ghost_Attack')&&isGhostSegmentWalkable(guard.x,guard.z,px,pz,.25),
        attackNormalized,defence});
      if(rig.guardMelee.started)rig.playCombat('Ghost_Attack');
      if(interaction.active&&interaction.phase==='neck-grab'&&rig.playerReactionSeq!==interaction.seq){rig.playerReactionSeq=interaction.seq;playerCombat.interrupt(ghostId==='ghost-3'?'Knockback':'Hit_React');}
      if(rig.guardMelee.parried)requestGhostReaction(ghostId,'Ghost_Stagger');
      setGhostCombatEngaged(ghostId,rig.guardMelee.engaged);
      setGhostEncounterInteraction(interaction,ghostId);
      if(rig.guardMelee.killed)killPlayerFromGhost(ghostId,interaction.seq,px,pz);
      root.userData.ghostAttackEnabled=rig.guardMelee.engaged&&!isPlayerHomeProtected(px,pz);
      runtimeRef.current?.report(guard.x,guard.z,true,rig.guardMelee.engaged?'GRABBING':guard.mode);
      if(!rig.reactionClip){
        const guardClip=guard.mode==='chase'||guard.mode==='gather'||guard.mode==='return'?'flee_01':'depressed';
        const key='guard:'+guardClip;
        if(rig.currentClipKey!==key){rig.currentClipKey=key;(rig as unknown as {applyClip:(id:GhostClipId,loop:boolean,speed:number)=>void}).applyClip(guardClip,true,1);}
      }
      root.visible = distanceToPlayer < DEFAULT_GHOST_AI_CONFIG.visibleDistanceM;
      if (!root.visible) return;
      rig.groundTimer += dt;
      if (!rig.grounded || rig.groundTimer >= 0.35) {
        rig.groundTimer = 0; rig.grounded = true;
        rig.y = sceneGround(scene, clock.elapsedTime).height(guard.x,guard.z)+0.01;
      }
      root.position.set(guard.x,rig.y,guard.z);
      root.getWorldPosition(runtimeWorld);
      runtimeRef.current?.report(runtimeWorld.x, runtimeWorld.z, true, rig.guardMelee.engaged?'GRABBING':guard.mode, 'entity');
      if (guard.mode === 'chase') root.rotation.y = Math.atan2(px-guard.x,pz-guard.z);
      rig.controller.stepBlend(false,false,dt);
      rig.mixer.update(dt);
      if(interaction.active&&interaction.phase==='neck-grab'&&!rig.reactionClip)rig.grabPose.update(px,py+1.35,pz,root.rotation.y);
      return;
    }
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
    root.getWorldPosition(runtimeWorld);
    runtimeRef.current?.report(runtimeWorld.x, runtimeWorld.z, shouldRun && snap.visible, snap.state, 'entity');

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
    if (!rig.reactionClip&&clipKey !== rig.currentClipKey) {
      rig.currentClipKey = clipKey;
      const applyFn = (
        rig as unknown as {
          applyClip?: (clipId: GhostClipId, loop: boolean, speedScale: number) => void;
        }
      ).applyClip;
      applyFn?.(snap.activeClip.clipId, snap.activeClip.loop, snap.activeClip.speedScale);
    } else if(!rig.reactionClip) {
      const spec = GHOST_CLIP_SPECS[snap.activeClip.clipId];
      rig.controller.setSpeed(spec.basePlaybackSpeed * snap.activeClip.speedScale);
    }

    // Suspend animation mixer step if camera/player is beyond detail threshold
    if (snap.distToPlayerM <= DEFAULT_GHOST_AI_CONFIG.aiSuspendDistanceM) {
      rig.controller.stepBlend(false, false, dt);
      rig.mixer.update(dt);
      if(snap.grabInteraction.phase==='neck-grab'&&!rig.reactionClip)rig.grabPose.update(px,py+1.35,pz,snap.yaw);
    }
  });

  return <group ref={rootRef} name={`night-ghost-${ghostId}`} userData={{ dynamic: true }} />;
}
