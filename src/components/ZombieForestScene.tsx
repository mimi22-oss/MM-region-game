import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  Vector3,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { clampGhostGltfTextures } from '../game/ghostModelLoader.ts';
import { sceneGround } from '../game/groundSurface.ts';
import { playerCombat, registerCombatTarget } from '../game/combat/combatRuntime.ts';
import { isPlayerHomeProtected } from '../game/playerHomeProtection.ts';
import { getPlayerDeathState } from '../game/playerDeath.ts';
import { currentCar } from '../game/carRide.ts';
import { balloonRide } from '../game/balloonRide.ts';
import { motorcycleRide } from '../game/motorcycleRide.ts';
import { ghostMissionProximity } from './ThreeGhostsMissionScene.tsx';
import {
  ZOMBIE_ALL_CLIPS,
  ZOMBIE_DEFEAT_CLIPS,
  ZOMBIE_DEFEAT_URLS,
  ZOMBIE_FOREST_ZONE_BOUNDS,
  ZOMBIE_IDS,
  ZOMBIE_MODEL_URL,
  ZOMBIE_MOTION_URLS,
  applyZombieAttackToPlayer,
  getZombieById,
  getZombieForestProgress,
  prepareZombieDefeatClip,
  prepareZombieMotionClip,
  stepZombieForestAi,
  useZombieForestMission,
  type ZombieClipId,
  type ZombieDefeatClipId,
  type ZombieId,
} from '../game/missions/zombieForestMission.ts';

export { prepareZombieMotionClip, prepareZombieDefeatClip };

export const ZOMBIE_TARGET_HEIGHT_M = 1.85;
export const ZOMBIE_ASSET_LOAD_DISTANCE_M = 260;

export interface LoadedZombieAssets {
  readonly model: GLTF;
  readonly clips: Record<ZombieClipId, AnimationClip>;
  readonly defeatClips: Record<ZombieDefeatClipId, AnimationClip>;
}

let cachedAssetsPromise: Promise<LoadedZombieAssets> | null = null;

export function loadZombieAssetsOnce(): Promise<LoadedZombieAssets> {
  if (cachedAssetsPromise) return cachedAssetsPromise;
  const loader = new GLTFLoader();
  cachedAssetsPromise = Promise.all([
    loader.loadAsync(ZOMBIE_MODEL_URL),
    ...ZOMBIE_ALL_CLIPS.map(id => loader.loadAsync(ZOMBIE_MOTION_URLS[id])),
    ...ZOMBIE_DEFEAT_CLIPS.map(id => loader.loadAsync(ZOMBIE_DEFEAT_URLS[id])),
  ])
    .then(([modelGltf, ...restGltfs]) => {
      clampGhostGltfTextures(modelGltf, 1024);
      const motionGltfs = restGltfs.slice(0, ZOMBIE_ALL_CLIPS.length);
      const defeatGltfs = restGltfs.slice(ZOMBIE_ALL_CLIPS.length);
      const clips = {} as Record<ZombieClipId, AnimationClip>;
      ZOMBIE_ALL_CLIPS.forEach((id, idx) => {
        clips[id] = prepareZombieMotionClip(motionGltfs[idx], id);
      });
      const defeatClips = {} as Record<ZombieDefeatClipId, AnimationClip>;
      ZOMBIE_DEFEAT_CLIPS.forEach((id, idx) => {
        defeatClips[id] = prepareZombieDefeatClip(
          defeatGltfs[idx],
          modelGltf.scene,
          id,
        );
      });
      return { model: modelGltf, clips, defeatClips };
    })
    .catch(err => {
      cachedAssetsPromise = null;
      throw err;
    });
  return cachedAssetsPromise;
}

export function ZombieForestScene({ paused = false }: { paused?: boolean }) {
  const mission = useZombieForestMission();
  const { scene, camera } = useThree();
  const [loadArmed, setLoadArmed] = useState(false);
  const [assets, setAssets] = useState<LoadedZombieAssets | null>(null);
  const playerRef = useRef<Group | null>(null);
  const playerPos = useMemo(() => new Vector3(), []);

  useEffect(() => {
    if (!loadArmed || assets) return;
    let live = true;
    loadZombieAssetsOnce()
      .then(loaded => {
        if (live) setAssets(loaded);
      })
      .catch(err => {
        console.warn('[ZombieForestScene] Failed to load zombie assets:', err);
      });
    return () => {
      live = false;
    };
  }, [loadArmed, assets]);

  useFrame((_, dt) => {
    if (paused) return;
    if (!playerRef.current || !playerRef.current.parent) {
      playerRef.current =
        (scene.getObjectByName('player-avatar') as Group | null) ?? null;
    }

    let px = camera.position.x;
    let pz = camera.position.z;
    if (playerRef.current) {
      playerRef.current.getWorldPosition(playerPos);
      px = playerPos.x;
      pz = playerPos.z;
    }

    const distToForest = Math.hypot(
      px - ZOMBIE_FOREST_ZONE_BOUNDS.centerX,
      pz - ZOMBIE_FOREST_ZONE_BOUNDS.centerZ,
    );
    if (!loadArmed && distToForest <= ZOMBIE_ASSET_LOAD_DISTANCE_M) {
      setLoadArmed(true);
    }

    const onFoot =
      !currentCar() && !balloonRide.riding && !motorcycleRide.riding;
    const alive = getPlayerDeathState().phase === 'alive';
    const homeProtected = isPlayerHomeProtected(px, pz);

    const aiRes = stepZombieForestAi(
      dt,
      px,
      pz,
      onFoot,
      alive,
      homeProtected,
    );

    if (aiRes.strikeZombieId) {
      const attackRes = applyZombieAttackToPlayer(aiRes.strikeZombieId, px, pz);
      if (attackRes.blocked) {
        playerCombat.message = attackRes.message;
        ghostMissionProximity.lastMessage = attackRes.message;
      } else if (attackRes.applied) {
        if (!attackRes.playerDied) {
          playerCombat.interrupt('Hit_React');
        }
        playerCombat.message = attackRes.message;
        ghostMissionProximity.lastMessage = attackRes.message;
      }
    } else if (getZombieForestProgress().lastMessage && playerCombat.message) {
      ghostMissionProximity.lastMessage = playerCombat.message;
    }
  });

  if (!assets) return null;

  return (
    <group name="zombie-forest-swarm" key={mission.waveSeed}>
      {ZOMBIE_IDS.map(id => (
        <ZombieNpcInstance
          key={`${mission.waveSeed}:${id}`}
          zombieId={id}
          assets={assets}
          paused={paused}
          playerRef={playerRef}
        />
      ))}
    </group>
  );
}

function ZombieNpcInstance({
  zombieId,
  assets,
  paused,
  playerRef,
}: {
  zombieId: ZombieId;
  assets: LoadedZombieAssets;
  paused: boolean;
  playerRef: React.RefObject<Group | null>;
}) {
  const rootRef = useRef<Group>(null);
  const hudRef = useRef<Group>(null);
  const pipRefs = useRef<Array<Mesh | null>>([]);
  const playerVec = useMemo(() => new Vector3(), []);

  const initialZombie = getZombieById(zombieId);
  const maxHits = initialZombie?.maxHits ?? 3;

  const rigStateRef = useRef<{
    cloned: Group;
    mixer: AnimationMixer;
    actions: Record<ZombieClipId, AnimationAction>;
    defeatActions: Record<ZombieDefeatClipId, AnimationAction>;
    activeClip: ZombieClipId;
    playingDefeatClip: ZombieDefeatClipId | null;
    defeatElapsedSec: number;
    defeatDurationSec: number;
    groundY: number;
    groundTimer: number;
  } | null>(null);

  useLayoutEffect(() => {
    const group = rootRef.current;
    if (!group) return;

    const cloned = clone(assets.model.scene) as Group;
    cloned.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(cloned);
    const size = bounds.getSize(new Vector3());
    const scale = ZOMBIE_TARGET_HEIGHT_M / Math.max(0.1, size.y);
    cloned.scale.multiplyScalar(scale);
    cloned.position.set(
      -(bounds.min.x + bounds.max.x) * scale * 0.5,
      -bounds.min.y * scale,
      -(bounds.min.z + bounds.max.z) * scale * 0.5,
    );
    cloned.updateMatrixWorld(true);

    cloned.traverse(obj => {
      if (obj instanceof Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
        obj.frustumCulled = false;
      }
    });

    const mixer = new AnimationMixer(cloned);
    const actions = {} as Record<ZombieClipId, AnimationAction>;
    for (const clipId of ZOMBIE_ALL_CLIPS) {
      const act = mixer.clipAction(assets.clips[clipId]);
      act.setLoop(LoopRepeat, Infinity);
      actions[clipId] = act;
    }
    const defeatActions = {} as Record<ZombieDefeatClipId, AnimationAction>;
    for (const defId of ZOMBIE_DEFEAT_CLIPS) {
      const act = mixer.clipAction(assets.defeatClips[defId]);
      act.setLoop(LoopOnce, 1);
      act.clampWhenFinished = true;
      defeatActions[defId] = act;
    }

    const z = getZombieById(zombieId);
    const startClip: ZombieClipId = z?.clip ?? 'idle';
    const startAction = actions[startClip];
    startAction.reset().play();
    // Offset initial animation phase by zombie index so 13 zombies never move in lockstep
    mixer.setTime(((z?.index ?? 0) * 0.67) % Math.max(0.5, assets.clips[startClip].duration));

    group.add(cloned);
    const groundY = 0;
    if (z) {
      group.position.set(z.x, groundY, z.z);
      group.rotation.y = z.yaw;
    }

    const releaseTarget = registerCombatTarget(zombieId, {
      root: group,
      height: ZOMBIE_TARGET_HEIGHT_M,
      radius: 0.48,
    });

    rigStateRef.current = {
      cloned,
      mixer,
      actions,
      defeatActions,
      activeClip: startClip,
      playingDefeatClip: null,
      defeatElapsedSec: 0,
      defeatDurationSec: 4.5,
      groundY,
      groundTimer: 0.25,
    };

    return () => {
      releaseTarget();
      mixer.stopAllAction();
      mixer.uncacheRoot(cloned);
      group.remove(cloned);
      rigStateRef.current = null;
    };
  }, [assets, zombieId]);

  useFrame(({ scene, clock, camera }, delta) => {
    const group = rootRef.current;
    const rig = rigStateRef.current;
    const z = getZombieById(zombieId);
    if (!group || !rig || !z) return;
    if (paused) return;

    const dt = Math.min(delta, 0.2);

    if (!z.alive) {
      if (hudRef.current) hudRef.current.visible = false;
      if (!rig.playingDefeatClip) {
        const defId = z.defeatClip;
        rig.playingDefeatClip = defId;
        rig.defeatElapsedSec = 0;
        rig.defeatDurationSec = assets.defeatClips[defId]?.duration ?? 5.5;
        const prevAct = rig.actions[rig.activeClip];
        const defAct = rig.defeatActions[defId];
        if (defAct) {
          defAct.reset().setEffectiveTimeScale(1.35).fadeIn(0.2).play();
          prevAct?.fadeOut(0.2);
        }
      }
      rig.defeatElapsedSec += dt * 1.35;
      rig.mixer.update(dt);
      if (rig.defeatElapsedSec >= rig.defeatDurationSec + 0.35) {
        group.visible = false;
      }
      return;
    }

    group.visible = true;
    rig.cloned.rotation.x = 0;

    // Crossfade when AI switches between 'idle' | 'crawl' | 'scream' | 'attack'
    if (z.clip !== rig.activeClip) {
      const prevAction = rig.actions[rig.activeClip];
      const nextAction = rig.actions[z.clip];
      if (nextAction) {
        nextAction.reset().fadeIn(0.22).play();
        prevAction?.fadeOut(0.22);
        rig.activeClip = z.clip;
      }
    }

    rig.mixer.update(dt);

    rig.groundTimer += dt;
    if (rig.groundTimer >= 0.2) {
      rig.groundTimer = 0;
      rig.groundY = sceneGround(scene, clock.elapsedTime).height(z.x, z.z);
    }

    group.position.set(z.x, rig.groundY, z.z);
    group.rotation.y = z.yaw;

    // Update floating hit-pip bar when player is within 24m
    if (hudRef.current) {
      let px = camera.position.x;
      let pz = camera.position.z;
      if (playerRef.current) {
        playerRef.current.getWorldPosition(playerVec);
        px = playerVec.x;
        pz = playerVec.z;
      }
      const dist = Math.hypot(px - z.x, pz - z.z);
      hudRef.current.visible = dist <= 26;
      if (hudRef.current.visible) {
        hudRef.current.position.y = z.clip === 'crawl' ? 1.05 : 2.1;
        hudRef.current.lookAt(camera.position);
        for (let i = 0; i < z.maxHits; i++) {
          const pip = pipRefs.current[i];
          if (pip) {
            pip.visible = i < z.hitsRemaining;
          }
        }
      }
    }
  });

  const pipWidth = maxHits === 2 ? 0.26 : 0.17;
  const pipSpacing = maxHits === 2 ? 0.3 : 0.2;

  return (
    <group ref={rootRef} name={`forest-${zombieId}`}>
      <group ref={hudRef} position={[0, 2.1, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[0.66, 0.11]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.82} />
        </mesh>
        {Array.from({ length: maxHits }, (_, i) => {
          const offsetX = (i - (maxHits - 1) * 0.5) * pipSpacing;
          return (
            <mesh
              key={i}
              ref={el => {
                pipRefs.current[i] = el;
              }}
              position={[offsetX, 0, 0]}
            >
              <planeGeometry args={[pipWidth, 0.065]} />
              <meshBasicMaterial
                color={maxHits === 2 ? '#f59e0b' : '#ef4444'}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
