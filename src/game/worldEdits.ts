import type { LayoutFeature, Point2, WorldLayout } from './worldLayout';

export function featureContent(f: LayoutFeature) {
  return JSON.stringify({
    name: f.name,
    kind: f.kind,
    points: f.points,
    rotation: f.rotation ?? 0,
    dimensions: f.dimensions,
    width: f.width,
    assetId: f.assetId,
    color: f.color,
    roofColor: f.roofColor,
    size: f.size,
    scale: f.scale,
  });
}

export function sourceId(f: LayoutFeature) {
  return f.metadata?.authored === true && typeof f.metadata.sourceId === 'string'
    ? f.metadata.sourceId
    : undefined;
}

export function isAuthoredFeatureModified(f: LayoutFeature): boolean {
  if (!f.metadata?.authored) return true; // Custom-placed features are always dynamic
  const snapshot = f.metadata.sourceSnapshot as Record<string, unknown> | undefined;
  if (!snapshot) return false;

  const pts = snapshot.points as Point2[] | undefined;
  if (!pts || f.points.length !== pts.length) return true;
  for (let i = 0; i < f.points.length; i++) {
    if (Math.hypot(f.points[i].x - pts[i].x, f.points[i].z - pts[i].z) > 0.05) return true;
  }

  const rot = (snapshot.rotation as number) ?? 0;
  if (Math.abs((f.rotation ?? 0) - rot) > 0.001) return true;
  if (f.assetId !== snapshot.assetId) return true;
  if (f.color !== snapshot.color) return true;
  if (f.roofColor !== snapshot.roofColor) return true;
  if (f.name !== snapshot.name) return true;
  if (f.width !== snapshot.width) return true;

  const dim = snapshot.dimensions as { width?: number; depth?: number; height?: number } | undefined;
  if (f.dimensions?.width !== dim?.width || f.dimensions?.depth !== dim?.depth) return true;

  return false;
}

let version = 0;
let layouts: WorldLayout[] = [];
let hidden = new Set<string>();
let changed = new Map<string, LayoutFeature>();
let changedGroups = new Set<string>();
const listeners = new Set<() => void>();

export const worldEditVersion = () => version;
export const subscribeWorldEdits = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const sourceIsEdited = (id: string) =>
  hidden.has(id) || changed.has(id) || changedGroups.has(id);

export const editedSource = (id: string) => changed.get(id);
export const deletedSource = (id: string) => hidden.has(id);
export const savedWorldLayouts = () => layouts;

/** Publish only after persistence succeeds. Original geometry/collision reads the same revision. */
export function publishWorldEdits(next: WorldLayout[]) {
  layouts = next;
  hidden = new Set(next.flatMap((l) => l.deletedSourceIds ?? []));
  changed = new Map();
  changedGroups = new Set();

  for (const l of next) {
    for (const f of l.features) {
      const id = sourceId(f);
      if (id && !hidden.has(id)) {
        if (isAuthoredFeatureModified(f)) {
          changed.set(id, f);
          if (f.groupId) changedGroups.add(f.groupId);
        }
      } else if (id && hidden.has(id)) {
        if (f.groupId) changedGroups.add(f.groupId);
      }
    }
  }

  version++;
  listeners.forEach((fn) => fn());
}

export function clearWorldEdits() {
  publishWorldEdits([]);
}
