import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Vector3,
  type Object3D,
} from 'three';
import {
  getActiveMissionWeapon,
  useThreeGhostsMission,
} from '../game/missions/threeGhostsMission';
import {
  belongsToAvatar,
  findSwordHand,
  fitSupportHandToGun,
  gunGripRotation,
} from '../game/missions/gunAttachment';
import { getPlayerDeathState } from '../game/playerDeath';
import { currentCar } from '../game/carRide';
import { balloonRide } from '../game/balloonRide';
import { motorcycleRide } from '../game/motorcycleRide';
import { getChairSittingState } from '../game/chairSitting';
import { type CharacterMotion } from './CartoonCharacter';
import {
  getSpecialActionState,
  playSpecialAction,
  stopSpecialAction,
} from '../game/specialActions';
import { GunModel } from './GunModel';
import {
  GUN_SHOOTING_MOTION_ID,
  gunEffects,
  registerCombatGun,
  requestGunShot,
} from '../game/combat/gunCombatRuntime';

export const GUN_IDLE_MOTION_ID = 'gun-idle';
export const GUN_WALK_MOTION_ID = 'gun-hold-walking';

export function isGunMotionId(id: string | null | undefined): boolean {
  return (
    id === GUN_IDLE_MOTION_ID ||
    id === GUN_WALK_MOTION_ID ||
    id === GUN_SHOOTING_MOTION_ID
  );
}

export function HeldGun({
  avatar,
  motion,
}: {
  avatar: RefObject<Group | null>;
  motion?: RefObject<CharacterMotion>;
}) {
  useThreeGhostsMission();
  const scene = useThree(state => state.scene);
  const equipped = getActiveMissionWeapon() === 'zombie-gun';

  useEffect(() => {
    if (!equipped) {
      if (isGunMotionId(getSpecialActionState().activeActionId)) {
        stopSpecialAction();
      }
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code !== 'KeyF' ||
        e.repeat ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        (e.target instanceof HTMLElement &&
          (e.target.isContentEditable ||
            e.target.closest('input,textarea,select')))
      )
        return;
      e.preventDefault();
      requestGunShot();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [equipped]);

  useFrame(() => {
    if (!equipped) return;
    const onFootAndAlive =
      !currentCar() &&
      !balloonRide.riding &&
      !motorcycleRide.riding &&
      getPlayerDeathState().phase === 'alive' &&
      getChairSittingState().status === 'IDLE';

    const activeId = getSpecialActionState().activeActionId;
    if (!onFootAndAlive) {
      if (isGunMotionId(activeId)) {
        stopSpecialAction();
      }
      return;
    }

    if (
      activeId !== null &&
      activeId !== GUN_IDLE_MOTION_ID &&
      activeId !== GUN_WALK_MOTION_ID
    ) {
      return;
    }

    const isWalking = Math.abs(motion?.current.speed ?? 0) > 0.15;
    const desiredId = isWalking ? GUN_WALK_MOTION_ID : GUN_IDLE_MOTION_ID;
    if (activeId !== desiredId) {
      playSpecialAction(desiredId, { loop: true, force: true });
    }
  });

  return (
    <>
      {equipped && <EquippedGun avatar={avatar} />}
      {equipped && createPortal(<GunCombatVFX />, scene)}
    </>
  );
}

function EquippedGun({ avatar }: { avatar: RefObject<Group | null> }) {
  const [hand, setHand] = useState<Object3D | null>(null);
  const lastCheck = useRef(-Infinity);

  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastCheck.current < 0.25) return;
    lastCheck.current = clock.elapsedTime;
    const root = avatar.current;
    if (!root) {
      if (hand) setHand(null);
      return;
    }
    if (hand && belongsToAvatar(hand, root)) return;
    const next = findSwordHand(root);
    if (next !== hand) setHand(next);
  });

  return hand && avatar.current
    ? createPortal(<GunGrip hand={hand} avatar={avatar.current} />, hand)
    : null;
}

function GunGrip({ hand, avatar }: { hand: Object3D; avatar: Object3D }) {
  const root = useRef<Group>(null);
  const flashRef = useRef<Group>(null);
  const scale = useRef(new Vector3());
  const lastShotSeqRef = useRef(gunEffects.shotsFired);
  const burstTimerRef = useRef(0);

  useLayoutEffect(() => {
    return root.current ? registerCombatGun(root.current, avatar) : undefined;
  }, [hand, avatar]);

  // Default priority 0 runs after Player (-1) and GlbHuman (-0.5) while keeping R3F's auto-render active
  useFrame(({ clock }, dt) => {
    gunEffects.time = clock.elapsedTime;
    const weapon = root.current;
    if (!weapon) return;
    weapon.visible =
      !currentCar() &&
      !balloonRide.riding &&
      !motorcycleRide.riding &&
      getPlayerDeathState().phase === 'alive';
    if (!weapon.visible) return;

    // Keep gun barrel oriented forward along the character's current facing yaw
    weapon.quaternion.copy(gunGripRotation(hand, avatar));

    // Normalize Mixamo bone centimetre scale so the gun stays human-sized in world metres
    hand.getWorldScale(scale.current);
    weapon.scale.set(
      1 / Math.max(Math.abs(scale.current.x), 0.0001),
      1 / Math.max(Math.abs(scale.current.y), 0.0001),
      1 / Math.max(Math.abs(scale.current.z), 0.0001),
    );

    // Trigger one distinct fire burst each time shotsFired increments
    if (gunEffects.shotsFired !== lastShotSeqRef.current) {
      lastShotSeqRef.current = gunEffects.shotsFired;
      burstTimerRef.current = 0.18;
    } else if (burstTimerRef.current > 0) {
      burstTimerRef.current = Math.max(0, burstTimerRef.current - Math.min(dt, 0.1));
    }

    const burstProgress = burstTimerRef.current / 0.18;
    const recoil = burstProgress > 0 ? burstProgress * 0.042 : 0;
    weapon.position.set(0, recoil * 0.3, recoil);

    // Lock the character's Left (support) Hand directly onto the gun's front foregrip
    fitSupportHandToGun(avatar, weapon);

    if (flashRef.current) {
      flashRef.current.visible = burstTimerRef.current > 0;
      if (burstTimerRef.current > 0) {
        const expand = 0.75 + (1 - burstProgress) * 0.85;
        flashRef.current.scale.setScalar(expand);
        flashRef.current.rotation.z = gunEffects.shotsFired * 1.37 + burstProgress * 4;
      }
    }
  });

  return (
    <group ref={root} name="player-held-zombie-gun">
      <group position={[0, -0.01, -0.02]}>
        <GunModel held />
        {/* Distinct 1-shot Muzzle Fire Burst (မီးပွင့်) at the barrel tip */}
        <group
          ref={flashRef}
          name="gun-muzzle-fire"
          position={[0, 0.088, -0.52]}
          visible={false}
        >
          {/* White-hot inner core */}
          <mesh>
            <sphereGeometry args={[0.048, 10, 10]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.96}
              blending={AdditiveBlending}
            />
          </mesh>
          {/* Forward golden-orange flame cone */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.09]}>
            <coneGeometry args={[0.065, 0.22, 10]} />
            <meshBasicMaterial
              color="#fb923c"
              transparent
              opacity={0.92}
              blending={AdditiveBlending}
            />
          </mesh>
          {/* Outer crimson fire burst */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
            <coneGeometry args={[0.095, 0.14, 8]} />
            <meshBasicMaterial
              color="#ef4444"
              transparent
              opacity={0.82}
              blending={AdditiveBlending}
            />
          </mesh>
          {/* 4-way starburst flame petals so the fire flash is bold from every camera angle */}
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.24, 0.032, 0.032]} />
            <meshBasicMaterial
              color="#fde047"
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
            />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.24, 0.032, 0.032]} />
            <meshBasicMaterial
              color="#f97316"
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
            />
          </mesh>
          <pointLight color="#ff7b00" intensity={5.5} distance={6.5} />
        </group>
      </group>
    </group>
  );
}

function GunCombatVFX() {
  const lineGeometry = useMemo(() => {
    const geom = new BufferGeometry();
    geom.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(12 * 2 * 3), 3),
    );
    return geom;
  }, []);

  const lineMaterial = useMemo(
    () =>
      new LineBasicMaterial({
        color: '#fde047',
        transparent: true,
        opacity: 0.88,
        blending: AdditiveBlending,
      }),
    [],
  );

  const lineObj = useMemo(
    () => new LineSegments(lineGeometry, lineMaterial),
    [lineGeometry, lineMaterial],
  );

  useEffect(() => {
    return () => {
      lineGeometry.dispose();
      lineMaterial.dispose();
    };
  }, [lineGeometry, lineMaterial]);

  useFrame(({ clock }) => {
    gunEffects.time = clock.elapsedTime;
    const pos = lineGeometry.getAttribute('position') as BufferAttribute;
    const arr = pos.array as Float32Array;
    let activeCount = 0;

    for (let i = 0; i < gunEffects.tracers.length; i++) {
      const t = gunEffects.tracers[i];
      const age = clock.elapsedTime - t.at;
      const base = i * 6;
      if (age >= 0 && age <= 0.14) {
        activeCount++;
        arr[base] = t.from.x;
        arr[base + 1] = t.from.y;
        arr[base + 2] = t.from.z;
        arr[base + 3] = t.to.x;
        arr[base + 4] = t.to.y;
        arr[base + 5] = t.to.z;
      } else {
        arr[base] = 0;
        arr[base + 1] = -1000;
        arr[base + 2] = 0;
        arr[base + 3] = 0;
        arr[base + 4] = -1000;
        arr[base + 5] = 0;
      }
    }
    lineObj.visible = activeCount > 0;
    if (activeCount > 0) {
      pos.needsUpdate = true;
    }
  });

  return <primitive object={lineObj} />;
}
