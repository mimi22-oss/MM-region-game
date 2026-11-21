import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { mobileQuality } from '../../../game/sceneBudget';
import type { WeipulaVillagerRuntime } from '../../../game/weipulaVillagers';
import {
  THARYARGONE_VILLAGE_CENTER,
  createTharyargoneChinRoster,
  createTharyargoneChinRuntime,
  stepTharyargoneChinVillager,
} from '../../../game/tharyargoneChinVillagers';
import { WeipulaVillagerRig, type VillagerHandles } from '../../WeipulaVillageResidents';

const ACTIVE_RANGE_SQ = 380 * 380;

/**
 * သာယာကုန်းကျေးရွာ ချင်းလူမျိုးစု ရွာသူရွာသားများ 3D Controller
 *
 * Reuses `WeipulaVillagerRig` & `getWeipulaVillagerCache()` Singleton GPU cache
 * (zero duplicate geometries/textures/materials), single `useFrame` loop, and
 * 380m proximity sleep when the player is in another village.
 */
export function TharyargoneChinVillagers() {
  const rootGroupRef = useRef<Group>(null);

  const roster = useMemo(() => {
    const full = createTharyargoneChinRoster();
    return mobileQuality ? full.filter((_, idx) => idx % 5 !== 4 && idx % 5 !== 3) : full;
  }, []);

  const runtimesRef = useRef<WeipulaVillagerRuntime[] | null>(null);
  if (!runtimesRef.current || runtimesRef.current.length !== roster.length) {
    runtimesRef.current = roster.map(createTharyargoneChinRuntime);
  }
  const handlesListRef = useRef<(VillagerHandles | null)[]>(new Array(roster.length).fill(null));

  useFrame(({ camera }, delta) => {
    const group = rootGroupRef.current;
    if (!group) return;

    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    const dx = focus.x - THARYARGONE_VILLAGE_CENTER.x;
    const dz = focus.z - THARYARGONE_VILLAGE_CENTER.z;
    const near = dx * dx + dz * dz <= ACTIVE_RANGE_SQ;
    group.visible = near;
    if (!near) return;

    const runtimes = runtimesRef.current!;
    const handlesList = handlesListRef.current;
    const dt = Math.min(delta, 0.08);

    for (let i = 0; i < runtimes.length; i++) {
      const rt = runtimes[i];
      stepTharyargoneChinVillager(rt, dt);

      const h = handlesList[i];
      if (!h || !h.root) continue;

      const walkFactor = Math.min(1, rt.speed / 0.65);
      const stride = rt.walkDist * 4.6;
      const bounce = Math.abs(Math.sin(stride)) * 0.03 * walkFactor;

      h.root.position.set(rt.x, rt.desc.yOffset + bounce, rt.z);
      h.root.rotation.y = rt.yaw;

      if (h.head) {
        h.head.rotation.y =
          Math.sin(rt.elapsed * 0.85 + rt.desc.phaseOffset) * 0.24 * (1 - walkFactor * 0.6);
        h.head.rotation.x = Math.sin(rt.elapsed * 1.4 + rt.desc.phaseOffset) * 0.04;
      }
      const armSwing = Math.sin(stride) * 0.45 * walkFactor;
      if (h.leftArm) {
        h.leftArm.rotation.x = -armSwing;
        h.leftArm.rotation.z = 0.08;
      }
      if (h.rightArm) {
        h.rightArm.rotation.x = armSwing;
        h.rightArm.rotation.z = -0.08;
      }
      const legSwing = Math.sin(stride) * 0.36 * walkFactor;
      if (h.leftLeg) h.leftLeg.rotation.x = legSwing;
      if (h.rightLeg) h.rightLeg.rotation.x = -legSwing;
    }
  });

  return (
    <group ref={rootGroupRef} name="tharyargone-chin-villagers" userData={{ dynamic: true }}>
      {roster.map((desc, idx) => (
        <WeipulaVillagerRig
          key={desc.id}
          desc={desc}
          register={h => {
            handlesListRef.current[idx] = h;
          }}
        />
      ))}
    </group>
  );
}
