import { WORLD_CELL_SIZE_M, computeWorldCellCoord } from '../shared/network.ts';

export interface SpatialEntityPosition {
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

/**
 * Uniform 2D spatial hash grid partitioning world entities into cells (`WORLD_CELL_SIZE_M`)
 * so per-observer interest checks run in O(local-neighborhood) rather than O(N^2).
 */
export class SpatialInterestGrid<T extends SpatialEntityPosition> {
  private readonly cellSizeM: number;
  private readonly items = new Map<string, T>();
  private readonly cellById = new Map<string, string>();
  private readonly buckets = new Map<string, Set<string>>();

  constructor(cellSizeM: number = WORLD_CELL_SIZE_M) {
    this.cellSizeM = cellSizeM;
  }

  private cellKeyFor(x: number, z: number): string {
    const { cx, cz } = computeWorldCellCoord(x, z, this.cellSizeM);
    return `${cx}:${cz}`;
  }

  upsert(item: T): void {
    const nextKey = this.cellKeyFor(item.x, item.z);
    const prevKey = this.cellById.get(item.id);
    if (prevKey && prevKey !== nextKey) {
      const prevBucket = this.buckets.get(prevKey);
      if (prevBucket) {
        prevBucket.delete(item.id);
        if (prevBucket.size === 0) this.buckets.delete(prevKey);
      }
    }
    this.items.set(item.id, item);
    if (prevKey !== nextKey) {
      let bucket = this.buckets.get(nextKey);
      if (!bucket) {
        bucket = new Set();
        this.buckets.set(nextKey, bucket);
      }
      bucket.add(item.id);
      this.cellById.set(item.id, nextKey);
    }
  }

  remove(id: string): void {
    const key = this.cellById.get(id);
    if (key) {
      const bucket = this.buckets.get(key);
      if (bucket) {
        bucket.delete(id);
        if (bucket.size === 0) this.buckets.delete(key);
      }
      this.cellById.delete(id);
    }
    this.items.delete(id);
  }

  clear(): void {
    this.items.clear();
    this.cellById.clear();
    this.buckets.clear();
  }

  size(): number {
    return this.items.size;
  }

  getActiveCellCount(): number {
    return this.buckets.size;
  }

  /** Returns all entities strictly within `radiusM` ordered nearest-first up to `limit`. */
  queryRadius(
    x: number,
    z: number,
    radiusM: number,
    excludeId?: string,
    limit: number = Infinity,
  ): T[] {
    const minCoord = computeWorldCellCoord(x - radiusM, z - radiusM, this.cellSizeM);
    const maxCoord = computeWorldCellCoord(x + radiusM, z + radiusM, this.cellSizeM);
    const rSq = radiusM * radiusM;
    const candidates: Array<{ item: T; dSq: number }> = [];

    for (let cx = minCoord.cx; cx <= maxCoord.cx; cx++) {
      for (let cz = minCoord.cz; cz <= maxCoord.cz; cz++) {
        const bucket = this.buckets.get(`${cx}:${cz}`);
        if (!bucket) continue;
        for (const id of bucket) {
          if (id === excludeId) continue;
          const item = this.items.get(id);
          if (!item) continue;
          const dx = item.x - x;
          const dz = item.z - z;
          const dSq = dx * dx + dz * dz;
          if (dSq <= rSq) {
            candidates.push({ item, dSq });
          }
        }
      }
    }

    if (candidates.length > 1) {
      candidates.sort((a, b) => a.dSq - b.dSq);
    }
    const capped = Number.isFinite(limit) && candidates.length > limit
      ? candidates.slice(0, limit)
      : candidates;
    return capped.map((c) => c.item);
  }
}
