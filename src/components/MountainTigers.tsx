import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { toWorld } from '../data/ward';
import { balloonRide } from '../game/balloonRide';
import { currentCar } from '../game/carRide';
import { motorcycleRide } from '../game/motorcycleRide';
import type { TerrainPeak } from '../game/mountainTerrain';
import { getMountainTigerAssetCache, TIGER_ANKLE, TIGER_HEAD, TIGER_LEGS, TIGER_TAIL } from '../game/mountainTigerAssets';
import {
  MountainTigerFixedPool,
  buildMountainTigerSpawns,
  type MountainTigerSpawn,
  type TigerHpBarAnchor,
} from '../game/mountainTigerPool';
import { getPlayerDeathState } from '../game/playerDeath';
import { isPlayerHomeProtected } from '../game/playerHomeProtection';
import { RabbitCarrotCelebration } from './RabbitCarrotCelebration';

const MAX_OVERHEAD_HP_BARS = 6;
const HP_BAR_WIDTH = 1.1;
const HP_BAR_HEIGHT = 0.12;

/**
 * Reusable Single Mountain Tiger 3D Component (for `/map?tool=editor` & Asset Library)
 * consuming the exact same Singleton `getMountainTigerAssetCache()`.
 */
export const MountainTigerModel = memo(function MountainTigerModel({
  scale = 1,
}: {
  scale?: number;
}) {
  const c = getMountainTigerAssetCache();
  return (
    <group scale={scale} name="mountain-tiger-model" dispose={null}>
      <mesh geometry={c.bodyGeo} material={c.coatMat} castShadow />
      <mesh position={[...TIGER_HEAD]} geometry={c.headGeo} material={c.detailMat} castShadow />
      {TIGER_LEGS.map(({ x, y, z, hind }) => (
        <group key={String(x)} position={[x, y, z]}>
          <mesh geometry={hind ? c.hindLegGeo : c.legGeo} material={c.coatMat} castShadow />
          <mesh position={[...TIGER_ANKLE]} geometry={c.pawGeo} material={c.detailMat} castShadow />
        </group>
      ))}
      <mesh position={[...TIGER_TAIL]} geometry={c.tailGeo} material={c.detailMat} castShadow />
    </group>
  );
});

/**
 * Pooled Wild Mountain Tigers (`တောင်ပေါ် ကျားကြီးများ — Open-World Combat`)
 * Places paired (2 tigers) and solitary (1 tiger) territories strictly far away
 * from all mountain rabbits and deer herds via Singleton Cache + Fixed Object Pool.
 * Drives open-world tiger combat AI, overhead 3D HP bars, and mounts the 5-second
 * Auto-Bot Rabbit Carrot-Feeding celebration once all mountain tigers are defeated.
 */
export const MountainTigers = memo(function MountainTigers({
  peaks,
  spawns,
}: {
  peaks: readonly TerrainPeak[];
  spawns?: readonly MountainTigerSpawn[];
}) {
  const pool = useMemo(() => {
    const list = spawns ?? buildMountainTigerSpawns(peaks);
    return new MountainTigerFixedPool(list);
  }, [peaks, spawns]);

  const playerRef = useRef<Group | null>(null);
  const playerPos = useMemo(() => new Vector3(), []);
  const hpBarsScratch = useMemo<TigerHpBarAnchor[]>(() => [], []);
  const hpGroupRefs = useRef<Array<Group | null>>([]);
  const hpFillRefs = useRef<Array<Mesh | null>>([]);

  const hpAssets = useMemo(() => {
    const bgGeo = new PlaneGeometry(HP_BAR_WIDTH + 0.08, HP_BAR_HEIGHT + 0.06);
    const fillGeo = new PlaneGeometry(HP_BAR_WIDTH, HP_BAR_HEIGHT);
    const bgMat = new MeshBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.78 });
    const fillMats = Array.from(
      { length: MAX_OVERHEAD_HP_BARS },
      () => new MeshBasicMaterial({ color: '#22c55e' }),
    );
    return { bgGeo, fillGeo, bgMat, fillMats };
  }, []);

  useEffect(() => {
    const initial = toWorld(-2680, 6200);
    pool.syncToFocus(initial.x, initial.z, true);
    return () => {
      pool.disposePool();
      hpAssets.bgGeo.dispose();
      hpAssets.fillGeo.dispose();
      hpAssets.bgMat.dispose();
      for (const m of hpAssets.fillMats) m.dispose();
    };
  }, [pool, hpAssets]);

  useFrame(({ camera, scene }, delta) => {
    if (!playerRef.current || !playerRef.current.parent) {
      playerRef.current = (scene.getObjectByName('player-avatar') as Group | null) ?? null;
    }

    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    let px = focus.x;
    let py = 0;
    let pz = focus.z;
    if (playerRef.current) {
      playerRef.current.getWorldPosition(playerPos);
      px = playerPos.x;
      py = playerPos.y;
      pz = playerPos.z;
    }

    const onFoot = !currentCar() && !balloonRide.riding && !motorcycleRide.riding;
    const alive = getPlayerDeathState().phase === 'alive';
    const canEngage = onFoot && alive && !isPlayerHomeProtected(px, pz);

    pool.step(delta, focus.x, focus.z, peaks, {
      playerX: px,
      playerY: py,
      playerZ: pz,
      canEngage,
      cameraX: camera.position.x,
      cameraZ: camera.position.z,
    });

    // Update lightweight pooled 3D overhead HP bars for fighting/wounded tigers
    pool.collectCombatHpBars(hpBarsScratch);
    for (let i = 0; i < MAX_OVERHEAD_HP_BARS; i++) {
      const grp = hpGroupRefs.current[i];
      const fill = hpFillRefs.current[i];
      if (!grp || !fill) continue;
      const bar = hpBarsScratch[i];
      if (!bar) {
        grp.visible = false;
        continue;
      }
      grp.visible = true;
      grp.position.set(bar.x, bar.y, bar.z);
      grp.quaternion.copy(camera.quaternion);
      const ratio = Math.max(0.02, Math.min(1, bar.hp / Math.max(1, bar.maxHp)));
      fill.scale.set(ratio, 1, 1);
      fill.position.set(-(1 - ratio) * (HP_BAR_WIDTH * 0.5), 0, 0.01);
      hpAssets.fillMats[i].color.set(ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444');
    }
  });

  return (
    <group name="mountain-tigers-pooled">
      {pool.meshes().map((mesh, idx) => (
        <primitive key={`mtn-tiger-mesh-${idx}`} object={mesh} />
      ))}

      {/* Pooled 3D Overhead HP Bars for active fighting tigers */}
      {hpAssets.fillMats.map((fillMat, idx) => (
        <group
          key={`tiger-hp-bar-${idx}`}
          ref={(el) => {
            hpGroupRefs.current[idx] = el;
          }}
          visible={false}
        >
          <mesh geometry={hpAssets.bgGeo} material={hpAssets.bgMat} />
          <mesh
            ref={(el) => {
              hpFillRefs.current[idx] = el;
            }}
            geometry={hpAssets.fillGeo}
            material={fillMat}
            position={[0, 0, 0.01]}
          />
        </group>
      ))}

      {/* 5-Second Auto-Bot Rabbit Carrot-Feeding Celebration */}
      <RabbitCarrotCelebration peaks={peaks} />
    </group>
  );
});
