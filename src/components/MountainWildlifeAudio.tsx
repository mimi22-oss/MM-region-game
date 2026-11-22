import { memo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { TerrainPeak } from '../game/mountainTerrain';
import {
  MountainWildlifeAudioController,
  type WildlifePoint,
} from '../game/mountainWildlifeAudio';

const scratchForward = new Vector3();

/**
 * Spatial Mountain Wildlife Call Controller
 * (`တောင်ပေါ် ကျားဟိန်းသံ နှင့် သမင်/ဒရယ် ဟောက်သံများ`)
 *
 * Mounts inside `Mountains.tsx`. Activates only when the player/camera climbs
 * onto mountain terrain and pans calls toward nearby tigers & deer herds.
 */
export const MountainWildlifeAudio = memo(function MountainWildlifeAudio({
  peaks,
  tigers,
  deer,
}: {
  peaks: readonly TerrainPeak[];
  tigers: readonly WildlifePoint[];
  deer: readonly WildlifePoint[];
}) {
  const controllerRef = useRef<MountainWildlifeAudioController | null>(null);
  const accumRef = useRef(0);

  useEffect(() => {
    const ctrl = new MountainWildlifeAudioController();
    controllerRef.current = ctrl;
    return () => {
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, []);

  useFrame(({ camera }, delta) => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    accumRef.current += delta;
    // Update spatial audio at ~8 Hz (smooth & zero GC pressure)
    if (accumRef.current < 0.125) return;
    const dt = accumRef.current;
    accumRef.current = 0;

    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    camera.getWorldDirection(scratchForward);
    ctrl.step(
      dt,
      focus.x,
      focus.z,
      scratchForward.x,
      scratchForward.z,
      peaks,
      tigers,
      deer,
    );
  });

  return null;
});
