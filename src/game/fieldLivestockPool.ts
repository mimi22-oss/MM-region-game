import { ward } from '../data/ward.ts';
import { kalayVillages } from '../data/villages/index.ts';
import { natmyaungWeipulaSeparationFields } from '../data/villages/natmyaung/separationFields.ts';
import type { FieldPlot } from '../data/types.ts';

/**
 * ============================================================================
 * Paddy-Field Livestock Engine (Cow, Water Buffalo, Horse)
 * (Singleton Memory Reference Cache + Fixed Object Pool)
 * ============================================================================
 *
 * Pure TypeScript simulation layer:
 * - Every single paddy field plot across Myothar & all villages receives EXACTLY:
 *   - 2 Cows (`နွား ၂ ကောင်`)
 *   - 4 Water Buffaloes (`ကျွဲ ၄ ကောင်`)
 *   - 1 Horse (`မြင်း ၁ ကောင်`)
 *   (= 7 livestock bots per paddy field!).
 * - Each animal runs a natural grazing behavior loop inside its own field:
 *   1. `grazing`: lowers neck & head down to the grass, rhythmic chewing & grass nuzzling.
 *   2. `looking-around`: lifts head smoothly upright, pans left/right scanning surroundings.
 *   3. `strolling`: walks gently to a fresh grass patch inside the same paddy field.
 * - Pre-allocated Fixed Object Pool dynamically binds the nearest paddy fields around
 *   `(focusX, focusZ)` with ZERO per-frame allocation or GPU duplication!
 */

export type LivestockSpecies = 'cow' | 'buffalo' | 'horse';
export type LivestockBehaviorState = 'grazing' | 'looking-around' | 'strolling';

export const COWS_PER_FIELD = 2;
export const BUFFALOES_PER_FIELD = 4;
export const HORSES_PER_FIELD = 1;
export const LIVESTOCK_PER_FIELD = COWS_PER_FIELD + BUFFALOES_PER_FIELD + HORSES_PER_FIELD;

const FIELD_SPECIES_TEMPLATE: readonly LivestockSpecies[] = [
  'cow',
  'cow',
  'buffalo',
  'buffalo',
  'buffalo',
  'buffalo',
  'horse',
];

export interface LivestockFieldAnchor {
  readonly id: string;
  readonly regionId: string;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly rotation: number;
}

export interface LivestockBotState {
  readonly id: string;
  readonly fieldId: string;
  readonly fieldIndex: number;
  readonly regionId: string;
  readonly species: LivestockSpecies;
  readonly coatIndex: number;
  readonly scale: number;
  readonly phaseOffset: number;
  readonly walkSpeed: number;
  // Local coordinates in the field's rotated XZ frame
  lx: number;
  lz: number;
  targetLx: number;
  targetLz: number;
  // World coordinates & animation pose
  worldX: number;
  worldY: number;
  worldZ: number;
  yaw: number;
  speed: number;
  walkDist: number;
  elapsed: number;
  behavior: LivestockBehaviorState;
  stateTimer: number;
  stateElapsed: number;
  /** Current smoothed neck pitch (rad): > +0.55 = head down grazing, <= 0 = head lifted alert */
  neckPitch: number;
  /** Current smoothed head yaw (rad): scanning left/right while looking around */
  headYaw: number;
  lookDirection: number;
  seed: number;
}

export interface PooledLivestockSlot {
  readonly slotIndex: number;
  animal: LivestockBotState | null;
}

function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function nextLcg(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [next, next / 4294967296];
}

function fieldLocalToWorld(
  f: LivestockFieldAnchor,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const c = Math.cos(f.rotation);
  const s = Math.sin(f.rotation);
  return {
    x: f.x + lx * c + lz * s,
    z: f.z - lx * s + lz * c,
  };
}

/**
 * Collects every unique paddy field plot across Myothar & all villages (deduplicated by id/center).
 */
export function collectAllWorldPaddyFields(): LivestockFieldAnchor[] {
  const result: LivestockFieldAnchor[] = [];
  const seen = new Set<string>();

  const pushFields = (regionId: string, list: readonly FieldPlot[] | undefined) => {
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.z)) continue;
      if (f.width < 8 || f.depth < 8) continue;
      const dedupKey = f.id ?? `${f.x.toFixed(1)}:${f.z.toFixed(1)}:${f.width.toFixed(1)}:${f.depth.toFixed(1)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      result.push({
        id: f.id ?? `${regionId}-field-${i}`,
        regionId,
        x: f.x,
        z: f.z,
        width: f.width,
        depth: f.depth,
        rotation: f.rotation,
      });
    }
  };

  // Myothar Area 5 fields (farmhouse paddy, rice mill paddies, southern paddies)
  pushFields('myothar', ward.fields);
  pushFields('myothar', (ward as { bundedFields?: FieldPlot[] }).bundedFields);
  pushFields('myothar', (ward as { separationFields?: FieldPlot[] }).separationFields);

  // All Kalay villages
  for (const v of kalayVillages) {
    pushFields(v.id, v.fields);
    pushFields(v.id, v.bundedFields);
    pushFields(v.id, v.separationFields);
  }

  // Nat Myaung ↔ Weipula 10 separation paddy fields
  pushFields('natmyaung', natmyaungWeipulaSeparationFields);

  return result;
}

export const ALL_WORLD_PADDY_FIELDS: readonly LivestockFieldAnchor[] = collectAllWorldPaddyFields();

function safeFieldHalfExtents(f: LivestockFieldAnchor): { halfW: number; halfD: number } {
  return {
    halfW: Math.max(1.8, f.width / 2 - 2.4),
    halfD: Math.max(1.8, f.depth / 2 - 2.4),
  };
}

function grazingPitchFor(species: LivestockSpecies): number {
  return species === 'horse' ? 1.15 : 0.88;
}

function alertPitchFor(species: LivestockSpecies): number {
  return species === 'horse' ? -0.22 : -0.06;
}

/**
 * Generates EXACTLY 2 Cows, 4 Buffaloes, and 1 Horse (7 animals) for every paddy field.
 */
export function buildFieldLivestockRoster(
  fields: readonly LivestockFieldAnchor[] = ALL_WORLD_PADDY_FIELDS,
): LivestockBotState[] {
  const animals: LivestockBotState[] = [];

  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    const { halfW, halfD } = safeFieldHalfExtents(f);
    let seed = (hashString(f.id) ^ Math.imul(fi + 17, 2654435761)) >>> 0;

    // Distribute 7 animals across 7 balanced sectors inside the field so they never stack
    const sectorCols = f.width >= f.depth ? 4 : 2;
    const sectorRows = Math.ceil(LIVESTOCK_PER_FIELD / sectorCols);

    for (let ai = 0; ai < LIVESTOCK_PER_FIELD; ai++) {
      const species = FIELD_SPECIES_TEMPLATE[ai];
      let r1: number;
      let r2: number;
      let r3: number;
      let r4: number;
      [seed, r1] = nextLcg(seed);
      [seed, r2] = nextLcg(seed);
      [seed, r3] = nextLcg(seed);
      [seed, r4] = nextLcg(seed);

      const col = ai % sectorCols;
      const row = Math.floor(ai / sectorCols);
      const cellW = (halfW * 2) / sectorCols;
      const cellD = (halfD * 2) / sectorRows;
      const lx = -halfW + (col + 0.2 + r1 * 0.6) * cellW;
      const lz = -halfD + (row + 0.2 + r2 * 0.6) * cellD;
      const w = fieldLocalToWorld(f, lx, lz);

      // Start most animals grazing, some lifting head looking around so fields immediately feel alive
      const initialBehavior: LivestockBehaviorState =
        ai % 3 === 1 ? 'looking-around' : 'grazing';
      const initialPitch =
        initialBehavior === 'grazing' ? grazingPitchFor(species) : alertPitchFor(species);
      const walkSpeed =
        species === 'horse'
          ? 0.85 + r3 * 0.28
          : species === 'cow'
            ? 0.58 + r3 * 0.2
            : 0.48 + r3 * 0.18;
      const scale =
        species === 'buffalo'
          ? 0.96 + r3 * 0.1
          : species === 'horse'
            ? 0.95 + r3 * 0.1
            : 0.94 + r3 * 0.1;

      animals.push({
        id: `${f.id}-${species}-${ai + 1}`,
        fieldId: f.id,
        fieldIndex: fi,
        regionId: f.regionId,
        species,
        coatIndex: (fi + ai) % 4,
        scale: Number(scale.toFixed(3)),
        phaseOffset: r4 * Math.PI * 2,
        walkSpeed: Number(walkSpeed.toFixed(3)),
        lx,
        lz,
        targetLx: lx,
        targetLz: lz,
        worldX: w.x,
        worldY: 0.06,
        worldZ: w.z,
        yaw: f.rotation + r4 * Math.PI * 2,
        speed: 0,
        walkDist: 0,
        elapsed: r4 * 12,
        behavior: initialBehavior,
        stateTimer: 2.2 + r3 * 4.5,
        stateElapsed: r1 * 2.0,
        neckPitch: initialPitch,
        headYaw: 0,
        lookDirection: r2 < 0.5 ? 1 : -1,
        seed: (seed ^ (ai * 6151 + 43)) >>> 0,
      });
    }
  }

  return animals;
}

/**
 * Fixed Object Pool controller for paddy-field Cows, Buffaloes, and Horses.
 * - Pre-allocates `capacity` slots ONCE (multiple of 7: e.g. `63` desktop = 9 full fields,
 *   `35` mobile = 5 full fields).
 * - Dynamically assigns the nearest paddy fields around `(focusX, focusZ)` so every nearby
 *   field shows its full `2 Cows + 4 Buffaloes + 1 Horse` herd with ZERO GPU bloat!
 */
export class FieldLivestockFixedPoolController {
  readonly fields: readonly LivestockFieldAnchor[];
  readonly animals: LivestockBotState[];
  readonly capacity: number;
  readonly activeRadius: number;
  readonly slots: PooledLivestockSlot[];

  private assigned = new Set<LivestockBotState>();
  private rebalanceTimer = 0;

  constructor(
    capacity: number,
    activeRadius = 195,
    fields: readonly LivestockFieldAnchor[] = ALL_WORLD_PADDY_FIELDS,
  ) {
    this.fields = fields;
    this.animals = buildFieldLivestockRoster(fields);
    this.capacity = Math.max(LIVESTOCK_PER_FIELD, capacity);
    this.activeRadius = activeRadius;
    this.slots = Array.from({ length: this.capacity }, (_, slotIndex) => ({
      slotIndex,
      animal: null,
    }));
  }

  rebalance(focusX: number, focusZ: number): void {
    const maxDistSq = this.activeRadius * this.activeRadius;
    const nearFields: { fi: number; distSq: number }[] = [];

    for (let fi = 0; fi < this.fields.length; fi++) {
      const f = this.fields[fi];
      const dx = f.x - focusX;
      const dz = f.z - focusZ;
      const dSq = dx * dx + dz * dz;
      // Measure against field center + half-diagonal so large fields activate smoothly as you approach
      const pad = Math.hypot(f.width / 2, f.depth / 2);
      const effectiveR = this.activeRadius + pad;
      if (dSq <= effectiveR * effectiveR) {
        nearFields.push({ fi, distSq: dSq });
      }
    }
    nearFields.sort((a, b) => a.distSq - b.distSq);

    const desired: LivestockBotState[] = [];
    for (let i = 0; i < nearFields.length && desired.length < this.capacity; i++) {
      const base = nearFields[i].fi * LIVESTOCK_PER_FIELD;
      for (let k = 0; k < LIVESTOCK_PER_FIELD && desired.length < this.capacity; k++) {
        desired.push(this.animals[base + k]);
      }
    }

    const desiredSet = new Set(desired);

    // 1. Release slots from far-away fields
    for (let si = 0; si < this.slots.length; si++) {
      const slot = this.slots[si];
      if (slot.animal && !desiredSet.has(slot.animal)) {
        this.assigned.delete(slot.animal);
        slot.animal = null;
      }
    }

    // 2. Fill open slots with nearest paddy fields' 2 cows + 4 buffaloes + 1 horse
    let idx = 0;
    for (let si = 0; si < this.slots.length && idx < desired.length; si++) {
      if (this.slots[si].animal !== null) continue;
      while (idx < desired.length && this.assigned.has(desired[idx])) idx++;
      if (idx >= desired.length) break;
      const a = desired[idx++];
      this.slots[si].animal = a;
      this.assigned.add(a);
    }

    void maxDistSq;
  }

  private stepAnimal(a: LivestockBotState, dt: number): void {
    const f = this.fields[a.fieldIndex];
    const { halfW, halfD } = safeFieldHalfExtents(f);
    a.elapsed += dt;
    a.stateElapsed += dt;
    a.stateTimer -= dt;

    let targetNeckPitch = grazingPitchFor(a.species);
    let targetHeadYaw = 0;

    if (a.behavior === 'grazing') {
      a.speed = 0;
      targetNeckPitch = grazingPitchFor(a.species);
      targetHeadYaw = Math.sin(a.elapsed * 1.2 + a.phaseOffset) * 0.14;

      if (a.stateTimer <= 0) {
        // Lift head up and look around the surroundings!
        let r1: number;
        let r2: number;
        [a.seed, r1] = nextLcg(a.seed);
        [a.seed, r2] = nextLcg(a.seed);
        a.behavior = 'looking-around';
        a.stateElapsed = 0;
        a.stateTimer = 3.0 + r1 * 2.8;
        a.lookDirection = r2 < 0.5 ? 1 : -1;
      }
    } else if (a.behavior === 'looking-around') {
      a.speed = 0;
      targetNeckPitch = alertPitchFor(a.species);
      // Smoothly turn head left & right scanning the paddy field & surroundings
      targetHeadYaw = Math.sin(a.stateElapsed * 1.35 * a.lookDirection) * 0.62;

      if (a.stateTimer <= 0) {
        let rChoice: number;
        let r1: number;
        let r2: number;
        let rDur: number;
        [a.seed, rChoice] = nextLcg(a.seed);
        [a.seed, r1] = nextLcg(a.seed);
        [a.seed, r2] = nextLcg(a.seed);
        [a.seed, rDur] = nextLcg(a.seed);

        if (rChoice < 0.58) {
          // Walk gently to a new grass patch inside this paddy field
          a.behavior = 'strolling';
          a.stateElapsed = 0;
          a.stateTimer = 3.5 + rDur * 3.5;
          const stepSpanX = Math.min(halfW, 7.5);
          const stepSpanZ = Math.min(halfD, 7.5);
          a.targetLx = Math.max(-halfW, Math.min(halfW, a.lx + (r1 - 0.5) * 2 * stepSpanX));
          a.targetLz = Math.max(-halfD, Math.min(halfD, a.lz + (r2 - 0.5) * 2 * stepSpanZ));
        } else {
          // Lower head right back down to graze more grass!
          a.behavior = 'grazing';
          a.stateElapsed = 0;
          a.stateTimer = 4.5 + rDur * 4.5;
        }
      }
    } else {
      // 'strolling' calmly to a fresh grass spot inside the same field
      targetNeckPitch = a.species === 'horse' ? -0.14 : 0.08;
      targetHeadYaw = Math.sin(a.elapsed * 0.9 + a.phaseOffset) * 0.14;

      const dx = a.targetLx - a.lx;
      const dz = a.targetLz - a.lz;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.35 || a.stateTimer <= 0) {
        a.speed = 0;
        let rDur: number;
        [a.seed, rDur] = nextLcg(a.seed);
        a.behavior = 'grazing';
        a.stateElapsed = 0;
        a.stateTimer = 4.5 + rDur * 4.5;
      } else {
        const step = Math.min(dist, a.walkSpeed * dt);
        const nx = dx / dist;
        const nz = dz / dist;
        a.lx = Math.max(-halfW, Math.min(halfW, a.lx + nx * step));
        a.lz = Math.max(-halfD, Math.min(halfD, a.lz + nz * step));
        a.speed = step / Math.max(0.001, dt);
        a.walkDist += step;

        const w = fieldLocalToWorld(f, a.lx, a.lz);
        a.worldX = w.x;
        a.worldZ = w.z;

        const targetYaw = f.rotation + Math.atan2(nx, nz);
        let diff = targetYaw - a.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        a.yaw += diff * Math.min(1, dt * 3.8);
      }
    }

    // Smooth organic neck lift/drop & head scan interpolation
    const blend = Math.min(1, dt * 4.2);
    a.neckPitch += (targetNeckPitch - a.neckPitch) * blend;
    a.headYaw += (targetHeadYaw - a.headYaw) * blend;
  }

  update(focusX: number, focusZ: number, dt: number, forceRebalance = false): void {
    const clampedDt = Math.min(0.08, Math.max(0, dt));
    this.rebalanceTimer -= clampedDt;
    if (forceRebalance || this.rebalanceTimer <= 0) {
      this.rebalance(focusX, focusZ);
      this.rebalanceTimer = 0.45;
    }

    for (let si = 0; si < this.slots.length; si++) {
      const a = this.slots[si].animal;
      if (!a) continue;
      this.stepAnimal(a, clampedDt);
    }
  }

  dispose(): void {
    this.assigned.clear();
    for (const s of this.slots) s.animal = null;
  }
}
