import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, DoubleSide, Group, Vector2, Vector3 } from 'three';
import { CandleInHolder } from './Candle';

type Vec3 = [number, number, number];
export type MyanmarFireBalloonProps = {
  position?: Vec3;
  scale?: number;
  /** Gentle floating motion, purely visual. */
  floating?: boolean;
  /** Display the existing candle-in-holder component on the wooden platform. */
  showCandle?: boolean;
};

// Envelope starts above the candle platform, and narrows to a small opening.
// Each pair is [radius, height] in local metres.
const PROFILE: [number, number][] = [
  [0.37, 1.50], [0.53, 1.64], [0.78, 1.94], [1.05, 2.35],
  [1.29, 2.83], [1.43, 3.31], [1.48, 3.81], [1.43, 4.24],
  [1.23, 4.63], [0.88, 4.88], [0.45, 5.01], [0, 5.04],
];

function radiusAt(y: number) {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [r0, y0] = PROFILE[i];
    const [r1, y1] = PROFILE[i + 1];
    if (y <= y1) {
      const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
      const s = t * t * (3 - 2 * t);
      return r0 + (r1 - r0) * s;
    }
  }
  return 0;
}

function LineTube({ points, radius = 0.009, color = '#8c391e' }: {
  points: Vec3[]; radius?: number; color?: string;
}) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map(p => new Vector3(...p))), [points]);
  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, Math.max(12, points.length * 3), radius, 5, false]} />
      <meshStandardMaterial color={color} roughness={0.88} />
    </mesh>
  );
}

function CircularTrim({ y, radius, color = '#8c391e', thickness = 0.012 }: {
  y: number; radius: number; color?: string; thickness?: number;
}) {
  return (
    <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, thickness, 5, 96]} />
      <meshStandardMaterial color={color} roughness={0.86} />
    </mesh>
  );
}

function ZigzagBand({ y, amplitude = 0.055, repeats = 30 }: {
  y: number; amplitude?: number; repeats?: number;
}) {
  const points = useMemo<Vec3[]>(() => {
    const out: Vec3[] = [];
    for (let i = 0; i <= repeats * 2; i++) {
      const yy = y + (i % 2 ? amplitude : -amplitude);
      const a = i / (repeats * 2) * Math.PI * 2;
      const r = radiusAt(yy) + 0.015;
      out.push([Math.sin(a) * r, yy, Math.cos(a) * r]);
    }
    return out;
  }, [y, amplitude, repeats]);
  return <LineTube points={points} radius={0.013} color="#8c311b" />;
}

function Envelope() {
  const lathe = useMemo(() => {
    // Catmull-Rom interpolation makes a continuous, smooth paper envelope.
    const curve = new CatmullRomCurve3(PROFILE.map(([r, y]) => new Vector3(r, y, 0)));
    return Array.from({ length: 81 }, (_, i) => {
      const p = curve.getPoint(i / 80);
      return new Vector3(Math.max(0, p.x), p.y, 0);
    });
  }, []);
  return (
    <group name="orange-paper-envelope">
      <mesh castShadow receiveShadow>
        <latheGeometry args={[lathe.map(p => new Vector2(p.x, p.y)), 96]} />
        <meshStandardMaterial color="#f29b36" emissive="#ff9d2b" emissiveIntensity={0.21}
          transparent opacity={0.93} side={DoubleSide} roughness={0.92} depthWrite />
      </mesh>
      {/* Paper gores / vertical seams */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = i / 12 * Math.PI * 2;
        const points: Vec3[] = Array.from({ length: 33 }, (_, j) => {
          const y = 1.53 + j / 32 * 3.44;
          const r = radiusAt(y) + 0.016;
          return [Math.sin(a) * r, y, Math.cos(a) * r];
        });
        return <LineTube key={`seam-${i}`} points={points} radius={0.005} color="#bc632b" />;
      })}
      {/* Two geometric Myanmar-inspired bands */}
      {[1.99, 2.10, 3.16, 3.87, 4.37, 4.49].map(y => (
        <CircularTrim key={y} y={y} radius={radiusAt(y) + 0.018} thickness={0.010} />
      ))}
      <ZigzagBand y={2.21} amplitude={0.055} repeats={30} />
      <ZigzagBand y={4.42} amplitude={0.055} repeats={30} />
      {/* Decorative scrolling motifs around the wide central stripe */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = i / 8 * Math.PI * 2;
        const points: Vec3[] = [];
        for (let j = 0; j <= 36; j++) {
          const t = j / 36;
          const ang = a + 0.17 * Math.sin(t * Math.PI * 2) + 0.065 * t;
          const y = 3.51 + 0.19 * Math.sin(t * Math.PI * 2);
          const r = radiusAt(y) + 0.026;
          points.push([Math.sin(ang) * r, y, Math.cos(ang) * r]);
        }
        return <LineTube key={`motif-${i}`} points={points} radius={0.027} color="#9e341c" />;
      })}
      <mesh position={[0, 1.51, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.37, 0.025, 8, 48]} />
        <meshStandardMaterial color="#965021" />
      </mesh>
      <pointLight position={[0, 2.4, 0]} color="#ffad45" intensity={3.0} distance={5} decay={2} />
    </group>
  );
}

function WoodenPlatform() {
  const wood = '#976335';
  return (
    <group name="wooden-candle-platform">
      {/* Platform floor */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.14, 0.10, 0.90]} />
        <meshStandardMaterial color={wood} roughness={0.94} />
      </mesh>
      {[-0.33, 0, 0.33].map(z => (
        <mesh key={z} position={[0, 0.241, z]} receiveShadow>
          <boxGeometry args={[1.06, 0.022, 0.28]} />
          <meshStandardMaterial color="#b78448" roughness={0.95} />
        </mesh>
      ))}
      {/* Low wooden tray walls */}
      {[-0.48, 0.48].map(z => (
        <mesh key={`z-${z}`} position={[0, 0.32, z]} castShadow>
          <boxGeometry args={[1.25, 0.20, 0.08]} />
          <meshStandardMaterial color="#8c582f" roughness={0.85} />
        </mesh>
      ))}
      {[-0.60, 0.60].map(x => (
        <mesh key={`x-${x}`} position={[x, 0.32, 0]} castShadow>
          <boxGeometry args={[0.08, 0.20, 1.00]} />
          <meshStandardMaterial color="#9d673a" roughness={0.85} />
        </mesh>
      ))}
      {[-0.46, 0.46].flatMap(x => [-0.34, 0.34].map(z => (
        <mesh key={`${x}-${z}`} position={[x, 0.075, z]} castShadow>
          <boxGeometry args={[0.14, 0.15, 0.14]} />
          <meshStandardMaterial color="#694223" />
        </mesh>
      )))}
      {/* Suspension ropes */}
      {[-1, 1].flatMap(sx => [-1, 1].map(sz => (
        <LineTube key={`rope-${sx}-${sz}`}
          points={[[sx * 0.55, 0.36, sz * 0.42], [sx * 0.46, 0.89, sz * 0.34], [sx * 0.29, 1.51, sz * 0.22]]}
          radius={0.013} color="#78522e" />
      )))}
    </group>
  );
}

/**
 * Myanmar traditional candle-powered festival balloon (visual prop).
 * Uses the project's EXISTING CandleInHolder from ./Candle.tsx.
 * Import CandleAnimation once in the parent Canvas if not already mounted.
 */
export function MyanmarFireBalloon({
  position = [0, 0, 0], scale = 1, floating = true, showCandle = true,
}: MyanmarFireBalloonProps) {
  const root = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    root.current.position.y = position[1] + (floating ? 0.10 * Math.sin(t * 0.75) : 0);
    root.current.rotation.z = floating ? 0.018 * Math.sin(t * 0.46) : 0;
    root.current.rotation.x = floating ? 0.013 * Math.sin(t * 0.38 + 1) : 0;
  });
  return (
    <group ref={root} position={position} scale={scale} name="myanmar-fire-balloon">
      <Envelope />
      <WoodenPlatform />
      {showCandle && <CandleInHolder position={[0, 0.27, 0]} scale={0.7} lit />}
    </group>
  );
}

export default MyanmarFireBalloon;
