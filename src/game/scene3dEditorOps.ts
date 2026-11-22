import type { AssetDefinition } from './assetRegistry.ts';
import type { FeatureKind, LayoutFeature, Point2, WorldLayout } from './worldLayout.ts';
import { deleteSelection } from './layoutTransforms.ts';

/**
 * ============================================================================
 * Real-Time 3D World Scene Editor Operations (Pure & Deterministic CRUD)
 * ============================================================================
 * Powers the live 3D WYSIWYG editor at `/map?tool=editor`:
 * - Create point components from Asset Registry (Drag & Drop or Click Place)
 * - Create multi-point linear structures (Drag & Draw Bridges, Roads, Canals)
 * - Move (X, Y, Z) & Nudge
 * - Cardinal Rotation (North / East / South / West) & Fine Rotation
 * - Update Dimensions, Scale, Colors, Name, Elevation
 * - Duplicate & Delete (both custom & existing authored site features)
 */

export type CardinalDirection = 'north' | 'east' | 'south' | 'west';

export interface CardinalSpec {
  readonly key: CardinalDirection;
  readonly labelMm: string;
  readonly shortLabel: string;
  readonly rad: number;
  readonly deg: number;
}

export const CARDINAL_DIRECTIONS: readonly CardinalSpec[] = [
  { key: 'north', labelMm: 'မြောက် (N)', shortLabel: 'N · မြောက်', rad: 0, deg: 0 },
  { key: 'east', labelMm: 'အရှေ့ (E)', shortLabel: 'E · အရှေ့', rad: -Math.PI / 2, deg: 90 },
  { key: 'south', labelMm: 'တောင် (S)', shortLabel: 'S · တောင်', rad: Math.PI, deg: 180 },
  { key: 'west', labelMm: 'အနောက် (W)', shortLabel: 'W · အနောက်', rad: Math.PI / 2, deg: 270 },
] as const;

export type DrawPathCategory = 'bridge' | 'road' | 'canal';

export interface QuickJumpSpot {
  readonly id: string;
  readonly labelMm: string;
  readonly icon: string;
  readonly regionId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly distance: number;
}

export const EDITOR_QUICK_JUMPS: readonly QuickJumpSpot[] = [
  {
    id: 'myothar-monastery',
    labelMm: 'မြို့သာ ဘုန်းကြီးကျောင်း',
    icon: '🛕',
    regionId: 'myothar',
    x: 187.1,
    y: 1.5,
    z: -55.2,
    distance: 46,
  },
  {
    id: 'myothar-monastery-pagodas',
    labelMm: 'ကျောင်းဝန်း စေတီ ၃ ဆူ',
    icon: '⛩️',
    regionId: 'myothar',
    x: 209.2,
    y: 2.0,
    z: -120.5,
    distance: 34,
  },
  {
    id: 'farmhouse',
    labelMm: 'အိမ် (Farmhouse)',
    icon: '🏡',
    regionId: 'myothar',
    x: 138.0,
    y: 1.5,
    z: 242.0,
    distance: 42,
  },
  {
    id: 'kanbale-cemetery',
    labelMm: 'သင်္ချိုင်း (ကံပုလဲ)',
    icon: '⚰️',
    regionId: 'myothar',
    x: 44.6,
    y: 1.5,
    z: -411.5,
    distance: 48,
  },
  {
    id: 'taungphila-mountain',
    labelMm: 'တောင်ဖီလာတောင်',
    icon: '⛰️',
    regionId: 'myothar',
    x: -143.9,
    y: 65.0,
    z: 576.1,
    distance: 110,
  },
  {
    id: 'highland-plateau-camp',
    labelMm: 'တောင်ပေါ် စခန်းနှင့် လွင်ပြင်ရွာများ',
    icon: '🏕️',
    regionId: 'myothar',
    x: -560.0,
    y: 136.0,
    z: 700.0,
    distance: 95,
  },
  {
    id: 'maha-weipula-junction',
    labelMm: 'မဟာဝေပုလ္လ တောင်လမ်းဆုံ',
    icon: '🏔️',
    regionId: 'myothar',
    x: 2672.8,
    y: 140.0,
    z: 3765.0,
    distance: 150,
  },
];

function makeId(prefix = 'obj'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeRadians(rad: number): number {
  let r = rad % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/** Converts editor rotation radians to compass degrees (0=N, 90=E, 180=S, 270=W). */
export function rotationRadToCompassDeg(rad: number): number {
  const deg = ((-rad * 180) / Math.PI) % 360;
  return Math.round((deg + 360) % 360) % 360;
}

/** Converts compass degrees (0=N, 90=E, 180=S, 270=W) to Three.js Y-rotation radians. */
export function compassDegToRotationRad(deg: number): number {
  return normalizeRadians((-deg * Math.PI) / 180);
}

export function inferFeatureKindFromAsset(def: AssetDefinition): FeatureKind {
  if (def.assetId.includes('school')) return 'school';
  if (def.assetId.includes('shop') || def.assetId.includes('u-shwe')) return 'shop';
  if (def.assetId.includes('toilet')) return 'toilet';
  if (def.assetId.includes('pump')) return 'well';
  if (def.assetId.includes('monastery') || def.assetId.includes('stupa') || def.assetId.includes('zayat')) return 'religious';
  if (def.assetId.includes('bridge')) return 'road';
  if (def.category === 'buildings') return 'house';
  if (def.category === 'nature') return 'tree';
  if (def.category === 'furniture') return 'furniture';
  if (def.category === 'vehicles') return 'vehicle';
  if (def.category === 'cultural') return 'cultural';
  return 'custom';
}

/** CREATE: Builds a new 3D placeable feature from an AssetDefinition at exact world (x, elevationY, z). */
export function createFeatureFromAsset(
  def: AssetDefinition,
  x: number,
  z: number,
  elevationY = 0,
  rotation = def.defaultRotation ?? 0,
): LayoutFeature {
  return {
    id: makeId('item'),
    kind: inferFeatureKindFromAsset(def),
    name: def.nameMm || def.name,
    points: [{ x: Number(x.toFixed(3)), z: Number(z.toFixed(3)) }],
    rotation: normalizeRadians(rotation),
    elevationY: Number(elevationY.toFixed(3)),
    assetId: def.assetId,
    dimensions: {
      width: def.defaultDimensions.width,
      depth: def.defaultDimensions.depth,
      height: def.defaultDimensions.height,
    },
    scale: def.defaultScale ?? 1,
    color: def.defaultColor,
    roofColor: def.defaultRoofColor,
    isCustomPlaced: true,
    metadata: {
      placedIn3D: true,
      category: def.assetId === 'infrastructure:bridge' ? 'bridge' : def.category,
    },
  };
}

/** CREATE (Drag & Draw): Builds a multi-point 3D Bridge, Road, or Canal feature. */
export function createDrawnPathFeature(
  category: DrawPathCategory,
  points: readonly Point2[],
  width: number,
  elevationY = category === 'bridge' ? 2.8 : 0,
): LayoutFeature {
  const cleanPoints = points.map((p) => ({
    x: Number(p.x.toFixed(3)),
    z: Number(p.z.toFixed(3)),
  }));
  const labels: Record<DrawPathCategory, string> = {
    bridge: 'တံတား (3D Bridge)',
    road: 'လမ်း (3D Road)',
    canal: 'ရေမြောင်း (3D Canal)',
  };
  const colors: Record<DrawPathCategory, string> = {
    bridge: '#52585c',
    road: '#657371',
    canal: '#3b8d99',
  };
  return {
    id: makeId(category),
    kind: 'road',
    name: labels[category],
    points: cleanPoints,
    width: Math.max(1.5, Math.min(30, width)),
    elevationY: Number(elevationY.toFixed(3)),
    assetId: category === 'bridge' ? 'infrastructure:bridge' : undefined,
    color: colors[category],
    roofColor: category === 'bridge' ? '#cbd5e1' : undefined,
    isCustomPlaced: true,
    metadata: {
      placedIn3D: true,
      category,
    },
  };
}

/** UPDATE: Moves a feature (single-point or multi-point path) so its anchor/centroid sits at (x, z). */
export function moveFeatureInLayout(
  layout: WorldLayout,
  featureId: string,
  targetX: number,
  targetZ: number,
  elevationY?: number,
): WorldLayout {
  return {
    ...layout,
    features: layout.features.map((f) => {
      if (f.id !== featureId || !f.points.length) return f;
      const cx = f.points.reduce((s, p) => s + p.x, 0) / f.points.length;
      const cz = f.points.reduce((s, p) => s + p.z, 0) / f.points.length;
      const dx = targetX - cx;
      const dz = targetZ - cz;
      return {
        ...f,
        points: f.points.map((p) => ({
          x: Number((p.x + dx).toFixed(3)),
          z: Number((p.z + dz).toFixed(3)),
        })),
        ...(elevationY !== undefined ? { elevationY: Number(elevationY.toFixed(3)) } : {}),
      };
    }),
  };
}

/** UPDATE: Sets exact cardinal direction (N/E/S/W) on a feature. */
export function rotateFeatureCardinal(
  layout: WorldLayout,
  featureId: string,
  direction: CardinalDirection,
): WorldLayout {
  const spec = CARDINAL_DIRECTIONS.find((c) => c.key === direction) ?? CARDINAL_DIRECTIONS[0];
  return patchFeatureInLayout(layout, featureId, { rotation: spec.rad });
}

/** UPDATE: Rotates a feature relatively by `deltaDeg` degrees (clockwise positive). */
export function rotateFeatureByDegrees(
  layout: WorldLayout,
  featureId: string,
  deltaDeg: number,
): WorldLayout {
  const target = layout.features.find((f) => f.id === featureId);
  if (!target) return layout;
  const currentDeg = rotationRadToCompassDeg(target.rotation ?? 0);
  const nextRad = compassDegToRotationRad(currentDeg + deltaDeg);
  return patchFeatureInLayout(layout, featureId, { rotation: nextRad });
}

/** UPDATE: Generic patch for name, dimensions, scale, color, roofColor, width, elevationY, rotation. */
export function patchFeatureInLayout(
  layout: WorldLayout,
  featureId: string,
  patch: Partial<LayoutFeature>,
): WorldLayout {
  return {
    ...layout,
    features: layout.features.map((f) => (f.id === featureId ? { ...f, ...patch } : f)),
  };
}

/** CREATE (Clone): Duplicates an existing feature offset cleanly by (offsetX, offsetZ). */
export function duplicateFeatureInLayout(
  layout: WorldLayout,
  featureId: string,
  offsetX = 3,
  offsetZ = 3,
): { layout: WorldLayout; duplicatedId: string | null } {
  const orig = layout.features.find((f) => f.id === featureId);
  if (!orig) return { layout, duplicatedId: null };
  const newId = makeId('copy');
  const clone: LayoutFeature = {
    ...orig,
    id: newId,
    name: `${orig.name} (Copy)`,
    points: orig.points.map((p) => ({
      x: Number((p.x + offsetX).toFixed(3)),
      z: Number((p.z + offsetZ).toFixed(3)),
    })),
    isCustomPlaced: true,
    metadata: {
      ...(orig.metadata ?? {}),
      authored: false,
      sourceId: undefined,
      sourceSnapshot: undefined,
      placedIn3D: true,
    },
  };
  return {
    layout: {
      ...layout,
      features: [...layout.features, clone],
    },
    duplicatedId: newId,
  };
}

/** DELETE: Removes a feature and records authored sourceId in `deletedSourceIds` so the live 3D site hides it! */
export function deleteFeatureFromLayout(layout: WorldLayout, featureId: string): WorldLayout {
  return deleteSelection(layout, [featureId]);
}

/** Computes world center (x, z) of any single-point or multi-point feature. */
export function featureAnchorXZ(feature: LayoutFeature): Point2 {
  if (!feature.points || feature.points.length === 0) return { x: 0, z: 0 };
  if (feature.points.length === 1) return feature.points[0];
  return {
    x: feature.points.reduce((s, p) => s + p.x, 0) / feature.points.length,
    z: feature.points.reduce((s, p) => s + p.z, 0) / feature.points.length,
  };
}
