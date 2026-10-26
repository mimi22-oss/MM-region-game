export type MapLabel = {
 id: string; name: string; x: number; z: number;
 kind: 'area' | 'place'; priority: number;
};
export type ProjectedLabel = {
 id: string; x: number; y: number; width: number; height: number; priority: number;
};

/** Screen-space layout: keep whole Myanmar text boxes inside the viewport and apart. */
export function layoutMapLabels(candidates: ProjectedLabel[], width: number, height: number, limit = 36) {
 const selected: ProjectedLabel[] = [];
 for (const label of [...candidates].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))) {
  if (![label.x, label.y, label.width, label.height].every(Number.isFinite)) continue;
  const left = label.x - label.width / 2, top = label.y - label.height;
  if (left < 8 || top < 8 || left + label.width > width - 8 || label.y > height - 8) continue;
  if (selected.some(other => Math.abs(label.x - other.x) < (label.width + other.width) / 2 + 10 &&
   top < other.y + 8 && label.y + 8 > other.y - other.height)) continue;
  selected.push(label);
  if (selected.length >= limit) break;
 }
 return selected;
}

/** Prefer custom POIs over an approximate destination representing the same place. */
export function uniqueMapLabels(labels: MapLabel[]) {
 const result: MapLabel[] = [], ids = new Set<string>();
 const normalized = (name: string) => name.normalize('NFC').replace(/[\s\u200b-\u200d()（）·]/gu, '');
 for (const label of [...labels].sort((a, b) => b.priority - a.priority)) {
  if (!label.name.trim() || !Number.isFinite(label.x) || !Number.isFinite(label.z) || ids.has(label.id)) continue;
  if (result.some(other => normalized(other.name) === normalized(label.name) && Math.hypot(other.x - label.x, other.z - label.z) < 100)) continue;
  result.push(label); ids.add(label.id);
 }
 return result;
}
