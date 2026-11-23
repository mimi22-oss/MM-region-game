import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial } from 'three';
import { angle } from '../data/ward';
import { RABBIT_COAT_COLORS, getMountainRabbitAssetCache } from '../game/mountainRabbitAssets';
import { mountainHeight, type TerrainPeak } from '../game/mountainTerrain';
import {
  RABBIT_CARROT_CINEMATIC_DURATION_SEC,
  triggerRabbitCarrotCinematic,
  useRabbitCarrotCinematic,
} from '../game/rabbitCarrotCinematic';
import { useMountainTigerCombat } from '../game/mountainTigerCombat';

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

function sampleGroundY(x: number, z: number, fallbackY: number, peaks: readonly TerrainPeak[]): number {
  const u = x * cosA - z * sinA;
  const v = x * sinA + z * cosA;
  const h = mountainHeight(u, v, peaks);
  return Number.isFinite(h) && h > 0.5 ? h : fallbackY;
}

/** Procedural 3D Carrot (`မုန်လာဥနီ / ခါကျက်ဥနီ`) mesh group. */
const CarrotMesh = memo(function CarrotMesh({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  carrotMat,
  leafMat,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  carrotMat: MeshStandardMaterial;
  leafMat: MeshStandardMaterial;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Tapered orange carrot root */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={carrotMat} castShadow>
        <coneGeometry args={[0.052, 0.32, 10]} />
      </mesh>
      {/* Emerald leafy green carrot crown */}
      <mesh position={[-0.19, 0.015, 0]} rotation={[0.1, 0, 0.9]} material={leafMat}>
        <coneGeometry args={[0.042, 0.14, 6]} />
      </mesh>
      <mesh position={[-0.18, 0.025, 0.025]} rotation={[-0.35, 0.2, 1.15]} material={leafMat}>
        <coneGeometry args={[0.032, 0.12, 6]} />
      </mesh>
      <mesh position={[-0.18, 0.025, -0.025]} rotation={[0.35, -0.2, 1.15]} material={leafMat}>
        <coneGeometry args={[0.032, 0.12, 6]} />
      </mesh>
    </group>
  );
});

const RABBIT_SLOTS = [
  { angle: -1.15, startRadius: 1.55, eatRadius: 0.78, scale: 1.05, phase: 0.0 },
  { angle: -0.52, startRadius: 1.48, eatRadius: 0.72, scale: 0.96, phase: 1.3 },
  { angle: 0.12, startRadius: 1.62, eatRadius: 0.76, scale: 1.08, phase: 2.5 },
  { angle: 0.76, startRadius: 1.5, eatRadius: 0.74, scale: 0.92, phase: 3.7 },
  { angle: 1.32, startRadius: 1.64, eatRadius: 0.82, scale: 1.0, phase: 4.9 },
] as const;

/**
 * 3D 5-Second Auto-Bot Rabbit Carrot-Feeding Scene (`Auto-Bot + ခါကျက်ဥနီ + ယုန် ၅ ကောင်`).
 * Mounts inside the 3D scene and only renders while the 5s cinematic is active.
 */
export const RabbitCarrotCelebration = memo(function RabbitCarrotCelebration({
  peaks,
}: {
  peaks: readonly TerrainPeak[];
}) {
  const cin = useRabbitCarrotCinematic();
  const rabbitCache = useMemo(() => getMountainRabbitAssetCache(), []);

  const materials = useMemo(() => {
    const carrotMat = new MeshStandardMaterial({ color: '#f97316', roughness: 0.55 });
    const leafMat = new MeshStandardMaterial({ color: '#16a34a', roughness: 0.72 });
    const basketMat = new MeshStandardMaterial({ color: '#b45309', roughness: 0.88 });
    const skinMat = new MeshStandardMaterial({ color: '#f1c29b', roughness: 0.72 });
    const tunicMat = new MeshStandardMaterial({ color: '#dc2626', roughness: 0.78 });
    const trimMat = new MeshStandardMaterial({ color: '#facc15', roughness: 0.52 });
    const longyiMat = new MeshStandardMaterial({ color: '#1e3a5f', roughness: 0.84 });
    const hatMat = new MeshStandardMaterial({ color: '#d9b574', roughness: 0.86 });
    const hairMat = new MeshStandardMaterial({ color: '#1f2937', roughness: 0.8 });
    const rabbitMats = RABBIT_SLOTS.map(
      (_, i) =>
        new MeshStandardMaterial({
          color: RABBIT_COAT_COLORS[i % RABBIT_COAT_COLORS.length],
          roughness: 0.9,
          vertexColors: true,
        }),
    );
    return {
      carrotMat,
      leafMat,
      basketMat,
      skinMat,
      tunicMat,
      trimMat,
      longyiMat,
      hatMat,
      hairMat,
      rabbitMats,
    };
  }, []);

  useEffect(
    () => () => {
      materials.carrotMat.dispose();
      materials.leafMat.dispose();
      materials.basketMat.dispose();
      materials.skinMat.dispose();
      materials.tunicMat.dispose();
      materials.trimMat.dispose();
      materials.longyiMat.dispose();
      materials.hatMat.dispose();
      materials.hairMat.dispose();
      for (const m of materials.rabbitMats) m.dispose();
    },
    [materials],
  );

  const botTorsoRef = useRef<Group>(null);
  const botRightArmRef = useRef<Group>(null);
  const botLeftArmRef = useRef<Group>(null);
  const rabbitGroupRefs = useRef<Array<Group | null>>([]);
  const rabbitHeadRefs = useRef<Array<Group | null>>([]);
  const carrotGroupRefs = useRef<Array<Group | null>>([]);
  const clockRef = useRef(0);

  useEffect(() => {
    if (cin.active) clockRef.current = 0;
  }, [cin.active, cin.seq]);

  useFrame((_, dt) => {
    if (!cin.active) return;
    clockRef.current += Math.min(0.05, Math.max(0, dt));
    const t = clockRef.current;

    // Gentle kneeling caretaker motion offering carrots to the bunnies
    if (botTorsoRef.current) {
      botTorsoRef.current.rotation.x = 0.24 + Math.sin(t * 2.2) * 0.06;
    }
    if (botRightArmRef.current) {
      botRightArmRef.current.rotation.x = -0.95 + Math.sin(t * 3.1) * 0.18;
      botRightArmRef.current.rotation.z = -0.18 + Math.cos(t * 2.4) * 0.08;
    }
    if (botLeftArmRef.current) {
      botLeftArmRef.current.rotation.x = -0.45 + Math.sin(t * 2.0 + 1.2) * 0.1;
    }

    // Animate 5 rabbits hopping up to the carrots and enthusiastically nibbling
    for (let i = 0; i < RABBIT_SLOTS.length; i++) {
      const slot = RABBIT_SLOTS[i];
      const grp = rabbitGroupRefs.current[i];
      const head = rabbitHeadRefs.current[i];
      const carrot = carrotGroupRefs.current[i];
      if (!grp) continue;

      const approachT = Math.min(1, t / 0.85);
      const easeApproach = 1 - Math.pow(1 - approachT, 3);
      const rad = slot.startRadius + (slot.eatRadius - slot.startRadius) * easeApproach;
      const hopY =
        approachT < 1
          ? Math.abs(Math.sin(approachT * Math.PI * 2)) * 0.16
          : Math.max(0, Math.sin(t * 2.1 + slot.phase) - 0.86) * 0.42;

      const lx = Math.sin(slot.angle) * rad;
      const lz = Math.cos(slot.angle) * rad;
      grp.position.set(lx, hopY, lz);
      // Face directly inward toward the carrot pile
      grp.rotation.y = Math.atan2(-lx, -lz);

      if (head) {
        if (approachT >= 0.85) {
          // Rapid adorable carrot-munching head dip & nibble bob!
          const nibble = Math.sin(t * 13.5 + slot.phase) * 0.09;
          head.rotation.x = 0.42 + nibble;
          head.rotation.y = Math.sin(t * 3.6 + slot.phase) * 0.14;
        } else {
          head.rotation.x = -0.05;
          head.rotation.y = 0;
        }
      }

      if (carrot) {
        if (approachT >= 0.9) {
          // Subtle nibble wiggle + gradual bite shrink as bunny eats!
          const biteFrac = Math.max(0.62, 1 - (t - 0.9) * 0.075);
          carrot.scale.setScalar(biteFrac);
          carrot.rotation.y = slot.angle + Math.sin(t * 14 + slot.phase) * 0.08;
        } else {
          carrot.scale.setScalar(1);
        }
      }
    }
  });

  if (!cin.active) return null;

  const baseY = sampleGroundY(cin.centerX, cin.centerZ, cin.centerY, peaks);
  const c = rabbitCache;

  return (
    <group
      name="rabbit-carrot-celebration-scene"
      position={[cin.centerX, baseY, cin.centerZ]}
      rotation={[0, cin.facingYaw, 0]}
    >
      {/* Friendly Mountain Auto-Bot Caretaker kneeling beside the carrot basket */}
      <group position={[0, 0, -0.95]} name="carrot-feeding-autobot">
        {/* Kneeling lower body / legs */}
        <mesh position={[-0.14, 0.22, 0.06]} rotation={[0.95, 0, 0]} material={materials.longyiMat} castShadow>
          <capsuleGeometry args={[0.095, 0.34, 6, 10]} />
        </mesh>
        <mesh position={[0.14, 0.22, 0.06]} rotation={[0.95, 0, 0]} material={materials.longyiMat} castShadow>
          <capsuleGeometry args={[0.095, 0.34, 6, 10]} />
        </mesh>
        <mesh position={[0, 0.34, -0.02]} material={materials.longyiMat} castShadow>
          <cylinderGeometry args={[0.2, 0.24, 0.36, 12]} />
        </mesh>

        {/* Animated Upper Torso leaning forward warmly */}
        <group ref={botTorsoRef} position={[0, 0.5, 0]}>
          <mesh position={[0, 0.26, 0]} material={materials.tunicMat} castShadow>
            <cylinderGeometry args={[0.19, 0.21, 0.5, 12]} />
          </mesh>
          {/* Traditional highland gold shoulder sash */}
          <mesh position={[0, 0.38, 0.01]} material={materials.trimMat}>
            <torusGeometry args={[0.195, 0.022, 6, 16]} />
          </mesh>

          {/* Head + Bamboo Hat (ခမောက်) */}
          <group position={[0, 0.64, 0.02]}>
            <mesh material={materials.skinMat} castShadow>
              <sphereGeometry args={[0.155, 14, 12]} />
            </mesh>
            {/* Friendly eyes */}
            <mesh position={[-0.052, 0.02, 0.138]} material={materials.hairMat}>
              <sphereGeometry args={[0.018, 6, 6]} />
            </mesh>
            <mesh position={[0.052, 0.02, 0.138]} material={materials.hairMat}>
              <sphereGeometry args={[0.018, 6, 6]} />
            </mesh>
            {/* Conical woven highland hat */}
            <mesh position={[0, 0.14, 0]} material={materials.hatMat} castShadow>
              <coneGeometry args={[0.36, 0.2, 16]} />
            </mesh>
          </group>

          {/* Right Arm extending a bright orange carrot to the rabbits */}
          <group ref={botRightArmRef} position={[0.23, 0.44, 0.04]}>
            <mesh position={[0, -0.18, 0]} material={materials.tunicMat} castShadow>
              <capsuleGeometry args={[0.06, 0.28, 6, 8]} />
            </mesh>
            <mesh position={[0, -0.36, 0]} material={materials.skinMat}>
              <sphereGeometry args={[0.058, 8, 8]} />
            </mesh>
            <CarrotMesh
              position={[0.02, -0.4, 0.12]}
              rotation={[0.3, 1.3, 0.1]}
              scale={1.08}
              carrotMat={materials.carrotMat}
              leafMat={materials.leafMat}
            />
          </group>

          {/* Left Arm resting over carrot basket */}
          <group ref={botLeftArmRef} position={[-0.23, 0.44, 0.04]}>
            <mesh position={[0, -0.18, 0]} material={materials.tunicMat} castShadow>
              <capsuleGeometry args={[0.06, 0.28, 6, 8]} />
            </mesh>
            <mesh position={[0, -0.36, 0]} material={materials.skinMat}>
              <sphereGeometry args={[0.058, 8, 8]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Woven Basket brimming with bright orange 3D Carrots (`မုန်လာဥနီ / ခါကျက်ဥနီ`) */}
      <group position={[-0.42, 0, -0.32]}>
        <mesh position={[0, 0.11, 0]} material={materials.basketMat} castShadow>
          <cylinderGeometry args={[0.24, 0.17, 0.22, 12]} />
        </mesh>
        <CarrotMesh position={[-0.04, 0.22, 0.04]} rotation={[0.2, 0.5, 0.25]} scale={0.95} carrotMat={materials.carrotMat} leafMat={materials.leafMat} />
        <CarrotMesh position={[0.05, 0.23, -0.02]} rotation={[-0.2, 2.2, 0.3]} scale={0.95} carrotMat={materials.carrotMat} leafMat={materials.leafMat} />
      </group>

      {/* 5 Scattered Carrots in front of the 5 Rabbits */}
      {RABBIT_SLOTS.map((slot, i) => {
        const cx = Math.sin(slot.angle) * 0.36;
        const cz = Math.cos(slot.angle) * 0.36;
        return (
          <group
            key={`carrot-ground-${i}`}
            ref={(el) => {
              carrotGroupRefs.current[i] = el;
            }}
            position={[cx, 0.05, cz]}
            rotation={[0, slot.angle, 0]}
          >
            <CarrotMesh
              scale={1.08}
              carrotMat={materials.carrotMat}
              leafMat={materials.leafMat}
            />
          </group>
        );
      })}

      {/* 5 Adorable Animated Mountain Rabbits nibbling on the Carrots! */}
      {RABBIT_SLOTS.map((slot, i) => {
        const furMat = materials.rabbitMats[i];
        return (
          <group
            key={`celebration-rabbit-${i}`}
            ref={(el) => {
              rabbitGroupRefs.current[i] = el;
            }}
            scale={slot.scale}
          >
            <mesh position={[0, 0.24, -0.02]} scale={[0.92, 0.88, 1.32]} geometry={c.bodyGeo} material={furMat} castShadow />
            <mesh position={[0, 0.23, -0.429]} scale={[1.05, 1.05, 1.05]} geometry={c.tailGeo} material={c.tailWhiteMat} />
            <mesh position={[-0.12, 0.066, 0.157]} scale={[1, 0.72, 1.45]} geometry={c.pawGeo} material={furMat} />
            <mesh position={[0.12, 0.066, 0.157]} scale={[1, 0.72, 1.45]} geometry={c.pawGeo} material={furMat} />
            {/* Articulated head pivot for realistic carrot-munching nod! */}
            <group
              ref={(el) => {
                rabbitHeadRefs.current[i] = el;
              }}
              position={[0, 0.38, 0.2]}
            >
              <mesh position={[0, 0.02, 0.04]} scale={[1, 0.94, 1.08]} geometry={c.headGeo} material={furMat} castShadow />
              <mesh position={[-0.068, 0.18, 0.01]} rotation={[-0.14, 0, 0.16]} geometry={c.earOuterGeo} material={furMat} castShadow />
              <mesh position={[0.068, 0.18, 0.01]} rotation={[-0.14, 0, -0.16]} geometry={c.earOuterGeo} material={furMat} castShadow />
              <mesh position={[-0.066, 0.18, 0.03]} rotation={[-0.14, 0, 0.16]} geometry={c.earInnerGeo} material={c.pinkInnerMat} />
              <mesh position={[0.066, 0.18, 0.03]} rotation={[-0.14, 0, -0.16]} geometry={c.earInnerGeo} material={c.pinkInnerMat} />
              <mesh position={[-0.127, 0.051, 0.106]} geometry={c.eyeGeo} material={c.eyeDarkMat} />
              <mesh position={[0.127, 0.051, 0.106]} geometry={c.eyeGeo} material={c.eyeDarkMat} />
              <mesh position={[0, 0, 0.247]} geometry={c.noseGeo} material={c.pinkInnerMat} />
            </group>
          </group>
        );
      })}
    </group>
  );
});

/**
 * Celebratory non-blocking HUD caption during the 5s Auto-Bot Rabbit Carrot-Feeding View
 * + replayable Carrot Feeding button once Carrots are unlocked on the mountain.
 */
export function RabbitCarrotCelebrationHud({
  playerPosRef,
  playerYawRef,
  onMountain,
}: {
  playerPosRef: { current: { x: number; z: number } };
  playerYawRef: { current: number };
  onMountain: boolean;
}) {
  const cin = useRabbitCarrotCinematic();
  const tigers = useMountainTigerCombat();

  if (cin.active && cin.phase === 'showcase') {
    const pct = Math.max(0, Math.min(100, Math.round((cin.elapsed / RABBIT_CARROT_CINEMATIC_DURATION_SEC) * 100)));
    return (
      <div className="rabbit-carrot-banner" role="status" aria-live="polite">
        <div className="rabbit-carrot-banner-row">
          <span className="rabbit-carrot-banner-icon" aria-hidden="true">🥕</span>
          <div className="rabbit-carrot-banner-text">
            <strong>မုန်လာဥနီ (ခါကျက်ဥနီ) ဆု ရရှိပြီး!</strong>
            <span>Auto-Bot မှ တောင်ပေါ်ယုန်လေးများကို ဥနီကျွေးနေသည် 🐰</span>
          </div>
        </div>
        <div className="rabbit-carrot-progress" aria-hidden="true">
          <div className="rabbit-carrot-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  if (!onMountain || !tigers.carrotsUnlocked) return null;

  return (
    <button
      type="button"
      className="rabbit-carrot-feed-btn"
      onClick={() => {
        triggerRabbitCarrotCinematic({
          playerX: playerPosRef.current.x,
          playerGroundY: 16,
          playerZ: playerPosRef.current.z,
          bodyYaw: playerYawRef.current,
        });
      }}
      title="Auto-Bot ဖြင့် ယုန်လေးများ ခါကျက်ဥနီစားတာ 5s ကြည့်မည်"
    >
      <span aria-hidden="true">🥕</span>
      <span>ယုန်ကျွေးမည် (ခါကျက်ဥနီ)</span>
    </button>
  );
}
