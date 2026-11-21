import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { mobileQuality } from '../game/sceneBudget';
import { useQualityPreset } from '../game/qualityPreset';
import { refreshGroundRegion, releaseGroundRegion } from '../game/groundSurface';
import {
  SCHOOL_HALL_POOL_DESKTOP,
  SCHOOL_HALL_POOL_MOBILE,
  SchoolHallFixedPoolController,
} from '../game/schoolHallPool';
import type { SchoolHallSpec } from '../game/schoolClassrooms';
import { SchoolClassroomHall } from './SchoolClassroomHall';

const POOLED_GROUND_ID = 'pooled-school-halls';

/**
 * ============================================================================
 * PooledSchoolHalls — Unified Fixed Object Pool for ALL 10 Schools (32 Halls)
 * ============================================================================
 *
 * Mounts ONCE in `<StreamedWorld>` with a fixed number of reusable pool slots
 * (`12` desktop / `8` mobile). Every school across Myothar, Thar Si, Kanbale,
 * Htomar, Htauk Kyant, Kyar Inn, and Nat Myaung preserves its own unique layout,
 * storeys, stairs, colours, and rooms while sharing:
 * 1. ONE Singleton Memory Reference Cache (`getSchoolBuildingAssetCache()`),
 * 2. ONE Fixed Object Pool (`SchoolHallFixedPoolController`), and
 * 3. Clean `GroundSurface` registration & release (`refreshGroundRegion` / `releaseGroundRegion`).
 */
export const PooledSchoolHalls = memo(function PooledSchoolHalls({
  activeRegions = [],
}: {
  activeRegions?: string[];
}) {
  const { scene } = useThree();
  const preset = useQualityPreset();
  const isLowQuality = mobileQuality || preset.id === 'mobile' || preset.id === 'low';
  const capacity = isLowQuality ? SCHOOL_HALL_POOL_MOBILE : SCHOOL_HALL_POOL_DESKTOP;
  const activeRadius = isLowQuality ? 190 : 260;

  const controller = useMemo(
    () => new SchoolHallFixedPoolController(capacity, activeRadius),
    [capacity, activeRadius],
  );

  const poolGroupRef = useRef<Group>(null);
  const timerRef = useRef(0);
  const lastRegionsKeyRef = useRef('');
  const [slotHalls, setSlotHalls] = useState<(SchoolHallSpec | null)[]>(() =>
    Array.from({ length: capacity }, () => null),
  );
  const [groundSyncVersion, setGroundSyncVersion] = useState(0);

  // Reset slot array if quality preset swaps capacity
  useEffect(() => {
    setSlotHalls(Array.from({ length: capacity }, () => null));
    lastRegionsKeyRef.current = '';
    timerRef.current = 0;
  }, [capacity]);

  // Register & refresh walkable 1F/2F floor & staircase meshes whenever pooled halls change
  useEffect(() => {
    const group = poolGroupRef.current;
    if (!group) return;
    refreshGroundRegion(scene, POOLED_GROUND_ID, group);
  }, [scene, groundSyncVersion]);

  // Release GroundSurface & pool state cleanly on unmount
  useEffect(() => {
    return () => {
      controller.dispose();
      releaseGroundRegion(scene, POOLED_GROUND_ID);
    };
  }, [controller, scene]);

  const regionsKey = activeRegions.join('|');

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    timerRef.current -= dt;
    const regionsChanged = lastRegionsKeyRef.current !== regionsKey;
    if (!regionsChanged && timerRef.current > 0) return;

    lastRegionsKeyRef.current = regionsKey;
    timerRef.current = 0.25;

    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
      x: camera.position.x,
      z: camera.position.z,
    };
    const { changed } = controller.rebalance(focus.x, focus.z, activeRegions);
    if (changed) {
      setSlotHalls(controller.slots.map(s => s.hall));
      setGroundSyncVersion(v => v + 1);
    }
  });

  return (
    <group ref={poolGroupRef} name="pooled-school-halls" userData={{ dynamic: true }}>
      {slotHalls.map((hall, slotIdx) => (
        <group key={`school-hall-slot-${slotIdx}`} name={`school-hall-slot-${slotIdx}`}>
          {hall && <SchoolClassroomHall spec={hall} />}
        </group>
      ))}
    </group>
  );
});
