type Point = readonly [x: number, z: number];

export const MYOTHAR_CEMETERY_BOUNDARY: readonly Point[] = [
  [-30.50424561717233, -401.59180192706134],
  [134.1514837155285, -470.9921594058478],
  [155.24374922378712, -417.9212562763674],
  [-17.576748811622224, -349.8816901206944],
];
export const TOMB_LENGTH = 2.12;
export const TOMB_WIDTH = 1.04;
export const TOMB_HEIGHT = 1.54;
export const CEMETERY_ROW_SPACING = 3.96;
const COLUMN_SPACING = 1.56;
const FIRST_ROW_Z = 3.72;
const AVENUE_WIDTH = 3.4;
const CROSS_WIDTH = 2.6;
const GATE_WIDTH = 6.4;
export const CEMETERY_CROSS_OFFSETS = [-42, 0, 42];
export const CEMETERY_PATROL_ROW_Z = FIRST_ROW_Z + CEMETERY_ROW_SPACING * 2.5;

const epitaphs = [
  ['ဦးဘိုးသာ', 'ကောင်းရာသုဂတိလားပါစေ'],
  ['ဒေါ်ခင်မြ', 'မိသားစုကောင်းမှု'],
  ['ဦးအောင်မြင့်', 'အမှတ်တရ'],
  ['ဒေါ်မြင့်ကြည်', 'ငြိမ်းချမ်းစွာ အနားယူပါစေ'],
  ['ဦးသန်းထွန်း', 'ကောင်းရာသုဂတိလားပါစေ'],
  ['ဒေါ်စိုးတင့်', 'သားသမီးများကောင်းမှု'],
] as const;

export interface CemeteryLayoutOptions {
  boundary?: readonly Point[];
  center?: Point;
  rotation?: number;
  length?: number;
  width?: number;
  hasZayat?: boolean;
  hasTrees?: boolean;
}

type CemeteryFrame = { cx: number; cz: number; cos: number; sin: number };
export function cemeteryToWorld(frame: CemeteryFrame, x: number, z: number) {
  return { x: frame.cx + x * frame.cos - z * frame.sin, z: frame.cz + x * frame.sin + z * frame.cos };
}

function cemeteryToLocal(frame: CemeteryFrame, x: number, z: number): Point {
  const dx = x - frame.cx, dz = z - frame.cz;
  return [dx * frame.cos + dz * frame.sin, -dx * frame.sin + dz * frame.cos];
}

function containsPoint(polygon: readonly Point[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[j], [bx, bz] = polygon[i];
    if ((az > z) !== (bz > z) && x < ax + (bx - ax) * (z - az) / (bz - az)) inside = !inside;
  }
  return inside;
}

function clipOutline(outline: readonly Point[], distance: (p: Point) => number) {
  const result: Point[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[(i + outline.length - 1) % outline.length], b = outline[i];
    const offsetA = distance(a), offsetB = distance(b);
    if ((offsetA >= 0) !== (offsetB >= 0)) {
      const t = offsetA / (offsetA - offsetB);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    if (offsetB >= 0) result.push(b);
  }
  return result;
}

/** Clips a path ribbon against the actual compound outline. */
function clipPath(outline: readonly Point[], minX: number, maxX: number, minZ: number, maxZ: number) {
  return [
    ([x]: Point) => x - minX, ([x]: Point) => maxX - x,
    ([, z]: Point) => z - minZ, ([, z]: Point) => maxZ - z,
  ].reduce<readonly Point[]>((path, edge) => clipOutline(path, edge), outline);
}

function insetWalkableOutline(outline: readonly Point[]) {
  const edges = outline.map(([x, z], i) => {
    const [nx, nz] = outline[(i + 1) % outline.length];
    return { x, z, dx: nx - x, dz: nz - z, area: x * nz - z * nx };
  });
  const winding = Math.sign(edges.reduce((area, edge) => area + edge.area, 0));
  return edges.reduce<readonly Point[]>((inset, { x, z, dx, dz }) => {
    const length = Math.hypot(dx, dz);
    return length < .001 ? inset : clipOutline(inset, ([px, pz]) =>
      winding * (dx * (pz - z) - dz * (px - x)) / length - .68);
  }, outline);
}

export function createCemeteryLayout({
  boundary = MYOTHAR_CEMETERY_BOUNDARY, center, rotation, length, width, hasZayat = true, hasTrees = true,
}: CemeteryLayoutOptions = {}) {
  const hasBoundary = boundary.length >= 3;
  const [a, b, c] = hasBoundary ? boundary : [[0, 0], [175, 0], [175, 54]];
  const cx = center?.[0] ?? (hasBoundary ? boundary.reduce((sum, p) => sum + p[0], 0) / boundary.length : 0);
  const cz = center?.[1] ?? (hasBoundary ? boundary.reduce((sum, p) => sum + p[1], 0) / boundary.length : 0);
  const rot = rotation ?? Math.atan2(b[1] - a[1], b[0] - a[0]);
  const len = length ?? Math.hypot(b[0] - a[0], b[1] - a[1]);
  const w = width ?? Math.hypot(c[0] - b[0], c[1] - b[1]);
  const frame = { cx, cz, cos: Math.cos(rot), sin: Math.sin(rot) };
  const outline: Point[] = hasBoundary
    ? boundary.map(([x, z]) => cemeteryToLocal(frame, x, z))
    : [[-len / 2, -w / 2], [len / 2, -w / 2], [len / 2, w / 2], [-len / 2, w / 2]];
  const points = hasBoundary ? boundary : outline.map(([x, z]) => {
    const p = cemeteryToWorld(frame, x, z);
    return [p.x, p.z] as const;
  });
  const rows: number[] = [];
  const rowLimit = Math.max(...outline.map(([, z]) => Math.abs(z)));
  const minX = Math.min(...outline.map(([x]) => x)), maxX = Math.max(...outline.map(([x]) => x));
  for (let z = FIRST_ROW_Z; z + TOMB_LENGTH / 2 < rowLimit; z += CEMETERY_ROW_SPACING) rows.push(-z, z);
  const columns = Math.floor((maxX - minX - 1.6) / COLUMN_SPACING) + 1;
  const firstX = minX + .8;
  const crossOffsets = CEMETERY_CROSS_OFFSETS.filter(x => Math.abs(x) + 1 < len / 2);
  const zayatX = -len / 2 + 14;
  const treeOffsets = hasTrees ? [-.38, -.22, -.08, .08, .22, .36].map(f => len * f) : [];
  const featuredColumns = [28, 32, 36].map(x => Math.round((-len / 2 + x - firstX) / COLUMN_SPACING));
  const walkableOutline = insetWalkableOutline(outline);
  const paths = [
    { id: 'avenue', kind: 'avenue', points: clipPath(outline, minX, maxX, -AVENUE_WIDTH / 2, AVENUE_WIDTH / 2) },
    ...crossOffsets.map(x => ({ id: `cross-${x}`, kind: 'cross', points: clipPath(walkableOutline, x - CROSS_WIDTH / 2, x + CROSS_WIDTH / 2, -rowLimit, rowLimit) })),
    ...rows.slice(2).map((z, i) => {
      const mid = (z + rows[i]) / 2;
      return { id: `row-walk-${i}`, kind: 'row', points: clipPath(walkableOutline, minX + 1, maxX - 1, mid - .67, mid + .67) };
    }),
  ].filter(path => path.points.length >= 3);

  const walls: { key: string; x: number; z: number; length: number; rot: number }[] = [];
  const gateSide = points.length >= 4 ? points.length - 1 : -1;
  let entrance = { x: cx, z: cz, rot };
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const segmentLength = Math.hypot(dx, dz), segmentRot = Math.atan2(dz, dx);
    const add = (key: string, start: number, end: number) => {
      const t = (start + end) / 2;
      walls.push({ key, x: p[0] + dx * t, z: p[1] + dz * t, length: (end - start) * segmentLength, rot: segmentRot });
    };
    if (i === gateSide && segmentLength > GATE_WIDTH + 1) {
      const split = GATE_WIDTH / (2 * segmentLength);
      add('west-a', 0, .5 - split);
      add('west-b', .5 + split, 1);
      entrance = { x: (p[0] + q[0]) / 2, z: (p[1] + q[1]) / 2, rot: segmentRot };
    } else add(`wall-${i}`, 0, 1);
  }
  return { ...frame, rot, len, w, outline, points, rows, columns, firstX, crossOffsets, paths,
    walls, entrance, zayatX, hasZayat, treeOffsets, featuredColumns, bound: Math.hypot(Math.max(-minX, maxX), rowLimit) + 2 };
}

export type CemeteryLayout = ReturnType<typeof createCemeteryLayout>;
export const MYOTHAR_CEMETERY_LAYOUT = createCemeteryLayout();

export function getCemeteryGrave(layout: CemeteryLayout, row: number, column: number) {
  if (column < 0 || column >= layout.columns || row < 0 || row >= layout.rows.length) return null;
  const x = layout.firstX + column * COLUMN_SPACING, z = layout.rows[row];
  const featureColumn = row < 2 && layout.hasZayat ? layout.featuredColumns.indexOf(column) : -1;
  const epitaph = featureColumn < 0 ? undefined : epitaphs[(row === 0 ? 0 : 3) + featureColumn];
  const scale = epitaph ? 1.1 : 1;
  const halfX = TOMB_WIDTH * scale / 2, halfZ = TOMB_LENGTH * scale / 2;
  if (layout.crossOffsets.some(offset => Math.abs(x - offset) < CROSS_WIDTH / 2 + halfX)) return null;
  if (layout.hasZayat && Math.abs(x - layout.zayatX) < 7 + halfX && Math.abs(z) < 6.8 + halfZ) return null;
  if (Math.abs(z) < 2.2 + halfZ + .31 && layout.treeOffsets.some(offset => Math.abs(x - offset) < halfX + .38)) return null;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    if (!containsPoint(layout.outline, x + sx * (halfX + 1.1), z + sz * (halfZ + 1.1))) return null;
  }
  return { x, z, halfX, halfZ, scale, epitaph };
}

export function cemeteryTombBlocks(x: number, z: number, clearance: number, playerRadius: number, layout = MYOTHAR_CEMETERY_LAYOUT) {
  if (clearance > TOMB_HEIGHT * 1.1) return false;
  const [lx, lz] = cemeteryToLocal(layout, x, z);
  const column = Math.round((lx - layout.firstX) / COLUMN_SPACING);
  for (let row = 0; row < layout.rows.length; row++) {
    if (Math.abs(lz - layout.rows[row]) > TOMB_LENGTH * .55 + playerRadius) continue;
    for (let col = column - 1; col <= column + 1; col++) {
      const g = getCemeteryGrave(layout, row, col);
      if (!g || clearance > TOMB_HEIGHT * g.scale) continue;
      const dx = Math.max(0, Math.abs(lx - g.x) - g.halfX), dz = Math.max(0, Math.abs(lz - g.z) - g.halfZ);
      if (dx * dx + dz * dz < playerRadius * playerRadius) return true;
    }
  }
  return false;
}
