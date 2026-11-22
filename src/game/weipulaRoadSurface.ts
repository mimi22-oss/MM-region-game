import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { toWorld } from '../data/ward.ts';
import { mountainHeight, type TerrainPeak } from './mountainTerrain.ts';
import type { PitchedRoadSegment } from './weipulaClimb.ts';

type Point = [u: number, y: number, v: number];
export const WEIPULA_ASPHALT_TOP = .17;

/** A vertex pair shared by both road fragments at every bend, including chunk boundaries. */
export function buildWeipulaRoadSections(segments: readonly PitchedRoadSegment[]) {
  if (segments.length === 0) return [];
  return Array.from({ length: segments.length + 1 }, (_, i) => {
    const prev = segments[Math.max(0, i - 1)], next = segments[Math.min(i, segments.length - 1)];
    const n1u = (prev.v2 - prev.v1) / prev.length, n1v = (prev.u1 - prev.u2) / prev.length;
    const n2u = (next.v2 - next.v1) / next.length, n2v = (next.u1 - next.u2) / next.length;
    const sum = Math.hypot(n1u + n2u, n1v + n2v);
    const nx = sum > .001 ? (n1u + n2u) / sum : n2u;
    const nz = sum > .001 ? (n1v + n2v) / sum : n2v;
    const miter = 1 / Math.max(.72, nx * n2u + nz * n2v);
    const bend = Math.acos(Math.max(-1, Math.min(1, n1u * n2u + n1v * n2v)));
    const bendWidth = Math.min(prev.length, next.length) * .52 / Math.max(.02, Math.tan(bend / 2));
    const halfWidth = Math.min((prev.width + next.width) / 4, Math.max(2.38, bendWidth));
    const u = i === segments.length ? prev.u2 : next.u1;
    const v = i === segments.length ? prev.v2 : next.v1;
    return { u, v, y: (i === segments.length ? prev.y2 : next.y1) + WEIPULA_ASPHALT_TOP,
      halfWidth, nx: nx * miter, nz: nz * miter };
  });
}

type Section = ReturnType<typeof buildWeipulaRoadSections>[number];
const gravel = new Color('#857866');
const soil = new Color('#657653');

function point(s: Section, offset: number, dy = 0): Point {
  return [s.u + offset * s.nx, s.y + dy, s.v + offset * s.nz];
}

class Ribbon {
  private readonly positions: number[] = [];
  private readonly indices: number[] = [];
  private readonly colors: number[] = [];
  private readonly origin: { x: number; z: number };
  constructor(origin: { x: number; z: number }) { this.origin = origin; }
  append(a: Point, b: Point, c: Point, d: Point, shoulder?: 'left' | 'right') {
    const index = this.positions.length / 3;
    for (const [u, y, v] of [a, b, c, d]) {
      const w = toWorld(u, v);
      this.positions.push(w.x - this.origin.x, y, w.z - this.origin.z);
    }
    if (shoulder) {
      const [first, second] = shoulder === 'left' ? [soil, gravel] : [gravel, soil];
      this.colors.push(first.r, first.g, first.b, first.r, first.g, first.b,
        second.r, second.g, second.b, second.r, second.g, second.b);
    }
    this.indices.push(index, index + 1, index + 2, index + 1, index + 3, index + 2);
  }
  make() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    if (this.colors.length) geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function strip(ribbon: Ribbon, a: Section, b: Section, aMin: number, aMax: number, bMin: number, bMax: number, dy = 0) {
  // Positive offset points to local +U when the road is heading in +V.
  ribbon.append(point(a, aMin, dy), point(b, bMin, dy), point(a, aMax, dy), point(b, bMax, dy));
}

export function buildWeipulaRoadSurface(segments: readonly PitchedRoadSegment[], peaks: readonly TerrainPeak[]) {
  if (segments.length === 0) return [];
  const sections = buildWeipulaRoadSections(segments);
  const shoulders = sections.map(s => [-1, 1].map(side => {
    const edge = point(s, side * (s.halfWidth + 2.4));
    const drop = Math.max(0, s.y - mountainHeight(edge[0], edge[2], peaks));
    const fill = Math.max(0, Math.min(1, (31 - drop) / 10));
    const width = .48 + (1.9 + Math.min(14, drop * .48)) * fill;
    const outer = point(s, side * (s.halfWidth + width));
    const ground = mountainHeight(outer[0], outer[2], peaks);
    outer[1] = s.y - (1 - fill) - fill * Math.max(.14, s.y - ground + .16);
    return outer;
  }));
  const take = 28;
  // Use a common origin so adjacent chunks round their identical join vertices the same way.
  const origin = toWorld(sections[0].u, sections[0].v);
  return Array.from({ length: Math.ceil(segments.length / take) }, (_, chunk) => {
    const first = chunk * take, last = Math.min(segments.length, first + take);
    const asphalt = new Ribbon(origin), earth = new Ribbon(origin), edge = new Ribbon(origin);
    const center = new Ribbon(origin), guard = new Ribbon(origin);
    const piers: { x: number; z: number; top: number; bottom: number; yaw: number; width: number }[] = [];
    let pierDistance = 34;
    for (let i = first; i < last; i++) {
      const a = sections[i], b = sections[i + 1];
      const wa = a.halfWidth, wb = b.halfWidth;
      strip(asphalt, a, b, -wa, 0, -wb, 0);
      strip(asphalt, a, b, 0, wa, 0, wb);
      strip(edge, a, b, -wa + .32, -wa + .47, -wb + .32, -wb + .47, .022);
      strip(edge, a, b, wa - .47, wa - .32, wb - .47, wb - .32, .022);
      const count = Math.max(1, Math.ceil(segments[i].length / 12));
      for (let dash = 0; dash < count; dash++) {
        const t0 = dash / count, t1 = (dash + .60) / count;
        const sample = (t: number, side: number): Point => [
          a.u + (b.u - a.u) * t + (a.nx + (b.nx - a.nx) * t) * side,
          a.y + (b.y - a.y) * t + .023,
          a.v + (b.v - a.v) * t + (a.nz + (b.nz - a.nz) * t) * side,
        ];
        center.append(sample(t0, -.11), sample(t1, -.11), sample(t0, .11), sample(t1, .11));
      }
      const baseU = (a.u + b.u) / 2, baseV = (a.v + b.v) / 2;
      const midHeight = (a.y + b.y) / 2, baseY = mountainHeight(baseU, baseV, peaks);
      const bridge = midHeight - baseY > 26;
      for (const [sideIndex, side] of [-1, 1].entries()) {
        const innerA = point(a, side * wa, -.025), innerB = point(b, side * wb, -.025);
        const outerA = shoulders[i][sideIndex], outerB = shoulders[i + 1][sideIndex];
        if (side < 0) earth.append(outerA, outerB, innerA, innerB, 'left');
        else earth.append(innerA, innerB, outerA, outerB, 'right');
        if (bridge || (midHeight > 25 && mountainHeight(outerA[0], outerA[2], peaks) < a.y - 1.9)) {
          const upperA = point(a, side * wa, .62), upperB = point(b, side * wb, .62);
          const lowerA = point(a, side * wa, .21), lowerB = point(b, side * wb, .21);
          guard.append(lowerA, lowerB, upperA, upperB);
        }
      }
      pierDistance += segments[i].length;
      if (bridge && pierDistance >= 27) {
        pierDistance = 0;
        const world = toWorld(baseU, baseV);
        piers.push({ x: world.x - origin.x, z: world.z - origin.z, top: midHeight - .22,
          bottom: baseY - .6, yaw: segments[i].yaw, width: Math.min(5, (wa + wb) * .44) });
      }
    }
    return { ...origin, asphalt: asphalt.make(), earth: earth.make(), edge: edge.make(),
      center: center.make(), guard: guard.make(), piers };
  });
}
