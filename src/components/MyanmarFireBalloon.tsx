import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  MeshStandardMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CandleInHolder } from './Candle';
import { BALLOON_PROFILE, radiusAt } from '../game/fireBalloonModel';
import { useQualityPreset } from '../game/qualityPreset';

type Vec3 = [number, number, number];
export type MyanmarFireBalloonProps = {
  position?: Vec3;
  scale?: number;
  /** Gentle floating motion, purely visual. */
  floating?: boolean;
  /** Display the existing candle-in-holder component on the wooden platform. */
  showCandle?: boolean;
  /** Enable dynamic Three.js point lights (keep false for sky swarms to avoid GPU limits). Defaults to true. */
  hasLight?: boolean;
};

export { BALLOON_PROFILE, radiusAt };
const PROFILE = BALLOON_PROFILE;

interface SharedBalloonAssets {
  envelopeGeometry: BufferGeometry;
  envelopeMaterial: MeshStandardMaterial;
  detailGeometry: BufferGeometry;
  detailMaterial: MeshStandardMaterial;
}

let cachedBalloonAssets: SharedBalloonAssets | null = null;

function prepareColoredPart(geom: BufferGeometry, hexColor: string): BufferGeometry {
  const nonIndexed = geom.index ? geom.toNonIndexed() : geom;
  if (nonIndexed !== geom) geom.dispose();
  if (nonIndexed.getAttribute('uv')) {
    nonIndexed.deleteAttribute('uv');
  }
  const pos = nonIndexed.getAttribute('position');
  const count = pos.count;
  const color = new Color(hexColor);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    colors[o] = color.r;
    colors[o + 1] = color.g;
    colors[o + 2] = color.b;
  }
  nonIndexed.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return nonIndexed;
}

function makeTubePart(points: Vec3[], radius: number, color: string, tubularSegments?: number): BufferGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(p[0], p[1], p[2])));
  const segs = tubularSegments ?? Math.max(8, points.length * 2);
  const tube = new TubeGeometry(curve, segs, radius, 4, false);
  return prepareColoredPart(tube, color);
}

function getSharedBalloonAssets(): SharedBalloonAssets {
  if (cachedBalloonAssets) return cachedBalloonAssets;

  const curve = new CatmullRomCurve3(PROFILE.map(([r, y]) => new Vector3(r, y, 0)));
  const lathePoints = Array.from({ length: 45 }, (_, i) => {
    const p = curve.getPoint(i / 44);
    return new Vector2(Math.max(0, p.x), p.y);
  });
  const envelopeGeometry = new LatheGeometry(lathePoints, 48);
  envelopeGeometry.userData.shared = true;

  const envelopeMaterial = new MeshStandardMaterial({
    color: '#f29b36',
    emissive: '#ff9d2b',
    emissiveIntensity: 0.21,
    transparent: true,
    opacity: 0.93,
    side: DoubleSide,
    roughness: 0.92,
    depthWrite: true,
  });
  envelopeMaterial.userData.shared = true;

  const parts: BufferGeometry[] = [];

  // Paper gores / vertical seams (12)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sinA = Math.sin(a);
    const cosA = Math.cos(a);
    const points: Vec3[] = Array.from({ length: 17 }, (_, j) => {
      const y = 1.53 + (j / 16) * 3.44;
      const r = radiusAt(y) + 0.016;
      return [sinA * r, y, cosA * r];
    });
    parts.push(makeTubePart(points, 0.005, '#bc632b', 20));
  }

  // Circular Myanmar-inspired bands (6)
  for (const y of [1.99, 2.1, 3.16, 3.87, 4.37, 4.49]) {
    const trim = new TorusGeometry(radiusAt(y) + 0.018, 0.01, 4, 48);
    trim.rotateX(Math.PI / 2);
    trim.translate(0, y, 0);
    parts.push(prepareColoredPart(trim, '#8c391e'));
  }

  // Two zigzag bands
  for (const y of [2.21, 4.42]) {
    const repeats = 30;
    const points: Vec3[] = [];
    for (let i = 0; i <= repeats * 2; i++) {
      const yy = y + (i % 2 ? 0.055 : -0.055);
      const a = (i / (repeats * 2)) * Math.PI * 2;
      const r = radiusAt(yy) + 0.015;
      points.push([Math.sin(a) * r, yy, Math.cos(a) * r]);
    }
    parts.push(makeTubePart(points, 0.013, '#8c311b', repeats * 2));
  }

  // Decorative scrolling motifs around wide central stripe (8)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const points: Vec3[] = [];
    for (let j = 0; j <= 20; j++) {
      const t = j / 20;
      const ang = a + 0.17 * Math.sin(t * Math.PI * 2) + 0.065 * t;
      const y = 3.51 + 0.19 * Math.sin(t * Math.PI * 2);
      const r = radiusAt(y) + 0.026;
      points.push([Math.sin(ang) * r, y, Math.cos(ang) * r]);
    }
    parts.push(makeTubePart(points, 0.027, '#9e341c', 28));
  }

  // Bottom mouth ring
  const mouth = new TorusGeometry(0.37, 0.025, 6, 32);
  mouth.rotateX(Math.PI / 2);
  mouth.translate(0, 1.51, 0);
  parts.push(prepareColoredPart(mouth, '#965021'));

  // Wooden platform floor + planks + tray walls + feet
  const floor = new BoxGeometry(1.14, 0.1, 0.9);
  floor.translate(0, 0.18, 0);
  parts.push(prepareColoredPart(floor, '#976335'));

  for (const z of [-0.33, 0, 0.33]) {
    const plank = new BoxGeometry(1.06, 0.022, 0.28);
    plank.translate(0, 0.241, z);
    parts.push(prepareColoredPart(plank, '#b78448'));
  }

  for (const z of [-0.48, 0.48]) {
    const wall = new BoxGeometry(1.25, 0.2, 0.08);
    wall.translate(0, 0.32, z);
    parts.push(prepareColoredPart(wall, '#8c582f'));
  }

  for (const x of [-0.6, 0.6]) {
    const wall = new BoxGeometry(0.08, 0.2, 1.0);
    wall.translate(x, 0.32, 0);
    parts.push(prepareColoredPart(wall, '#9d673a'));
  }

  for (const x of [-0.46, 0.46]) {
    for (const z of [-0.34, 0.34]) {
      const foot = new BoxGeometry(0.14, 0.15, 0.14);
      foot.translate(x, 0.075, z);
      parts.push(prepareColoredPart(foot, '#694223'));
    }
  }

  // Four suspension ropes
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(
        makeTubePart(
          [
            [sx * 0.55, 0.36, sz * 0.42],
            [sx * 0.46, 0.89, sz * 0.34],
            [sx * 0.29, 1.51, sz * 0.22],
          ],
          0.013,
          '#78522e',
          8,
        ),
      );
    }
  }

  const mergedDetails = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!mergedDetails) {
    throw new Error('Failed to merge balloon detail geometries');
  }
  const detailGeometry = mergedDetails;
  detailGeometry.userData.shared = true;

  const detailMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.89,
  });
  detailMaterial.userData.shared = true;

  cachedBalloonAssets = {
    envelopeGeometry,
    envelopeMaterial,
    detailGeometry,
    detailMaterial,
  };
  return cachedBalloonAssets;
}

/**
 * Myanmar traditional candle-powered festival balloon (visual prop).
 * Uses shared geometry/materials across instances to avoid draw-call and GPU memory bloat.
 */
export function MyanmarFireBalloon({
  position = [0, 0, 0],
  scale = 1,
  floating = true,
  showCandle = true,
  hasLight = true,
}: MyanmarFireBalloonProps) {
  const root = useRef<Group>(null);
  const preset = useQualityPreset();
  const assets = useMemo(() => getSharedBalloonAssets(), []);
  const castBalloonShadow = preset.characterCastShadow;

  useFrame(({ clock }) => {
    if (!floating || !root.current || !root.current.visible) return;
    const t = clock.elapsedTime;
    root.current.position.y = position[1] + 0.1 * Math.sin(t * 0.75);
    root.current.rotation.z = 0.018 * Math.sin(t * 0.46);
    root.current.rotation.x = 0.013 * Math.sin(t * 0.38 + 1);
  });

  return (
    <group ref={root} position={position} scale={scale} name="myanmar-fire-balloon">
      <group name="orange-paper-envelope">
        <mesh
          geometry={assets.envelopeGeometry}
          material={assets.envelopeMaterial}
          castShadow={castBalloonShadow}
          receiveShadow={castBalloonShadow}
          dispose={null}
        />
        <mesh
          geometry={assets.detailGeometry}
          material={assets.detailMaterial}
          castShadow={castBalloonShadow}
          dispose={null}
        />
        {hasLight && (
          <pointLight position={[0, 2.4, 0]} color="#ffad45" intensity={3.0} distance={5} decay={2} />
        )}
      </group>
      {showCandle && (
        <CandleInHolder position={[0, 0.27, 0]} scale={0.7} flameScale={2.2} lit hasLight={hasLight} />
      )}
    </group>
  );
}

export default MyanmarFireBalloon;
