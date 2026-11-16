import { BufferGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, MeshStandardMaterial, type Material } from 'three';

type PoolEntry<T> = {
  key: string;
  resource: T;
  refs: number;
  disposed: boolean;
};

export interface StreamedAssetPoolStats {
  geometriesActive: number;
  materialsActive: number;
  totalRefs: number;
  reuseHits: number;
  allocations: number;
  disposals: number;
}

/**
 * Reference-counted shared Three.js geometry and material pool for streamed world chunks.
 * Multiple tiles reuse unit primitives and palette materials instead of rebuilding/leaking GPU buffers
 * across teleports, while active references shield shared assets during sibling tile unmounts.
 */
export class StreamedAssetPool {
  private geometries = new Map<string, PoolEntry<BufferGeometry>>();
  private materials = new Map<string, PoolEntry<Material>>();
  private reuseHits = 0;
  private allocations = 0;
  private disposals = 0;

  acquireGeometry<T extends BufferGeometry>(key: string, create: () => T): { key: string; resource: T; release: () => void } {
    let entry = this.geometries.get(key) as PoolEntry<T> | undefined;
    if (entry && !entry.disposed) {
      entry.refs++;
      this.reuseHits++;
    } else {
      entry = { key, resource: create(), refs: 1, disposed: false };
      this.geometries.set(key, entry);
      this.allocations++;
    }
    let released = false;
    return {
      key,
      resource: entry.resource,
      release: () => {
        if (released) return;
        released = true;
        this.releaseGeometry(key);
      },
    };
  }

  acquireMaterial<T extends Material>(key: string, create: () => T): { key: string; resource: T; release: () => void } {
    let entry = this.materials.get(key) as PoolEntry<T> | undefined;
    if (entry && !entry.disposed) {
      entry.refs++;
      this.reuseHits++;
    } else {
      entry = { key, resource: create(), refs: 1, disposed: false };
      this.materials.set(key, entry);
      this.allocations++;
    }
    let released = false;
    return {
      key,
      resource: entry.resource,
      release: () => {
        if (released) return;
        released = true;
        this.releaseMaterial(key);
      },
    };
  }

  private releaseGeometry(key: string) {
    const entry = this.geometries.get(key);
    if (!entry || entry.disposed) return;
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs === 0) {
      entry.disposed = true;
      entry.resource.dispose();
      this.geometries.delete(key);
      this.disposals++;
    }
  }

  private releaseMaterial(key: string) {
    const entry = this.materials.get(key);
    if (!entry || entry.disposed) return;
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs === 0) {
      entry.disposed = true;
      entry.resource.dispose();
      this.materials.delete(key);
      this.disposals++;
    }
  }

  getStats(): StreamedAssetPoolStats {
    let totalRefs = 0;
    for (const g of this.geometries.values()) totalRefs += g.refs;
    for (const m of this.materials.values()) totalRefs += m.refs;
    return {
      geometriesActive: this.geometries.size,
      materialsActive: this.materials.size,
      totalRefs,
      reuseHits: this.reuseHits,
      allocations: this.allocations,
      disposals: this.disposals,
    };
  }

  resetForTests() {
    for (const g of this.geometries.values()) {
      if (!g.disposed) g.resource.dispose();
    }
    for (const m of this.materials.values()) {
      if (!m.disposed) m.resource.dispose();
    }
    this.geometries.clear();
    this.materials.clear();
    this.reuseHits = 0;
    this.allocations = 0;
    this.disposals = 0;
  }
}

export const sharedStreamedAssetPool = new StreamedAssetPool();

/** Pre-keyed unit geometry helpers reused across chunked villages. */
export function acquireUnitBoxGeometry(pool = sharedStreamedAssetPool) {
  return pool.acquireGeometry('unit:box:1x1x1', () => new BoxGeometry(1, 1, 1));
}

export function acquireUnitPlaneGeometry(pool = sharedStreamedAssetPool) {
  return pool.acquireGeometry('unit:plane:1x1', () => {
    const g = new PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  });
}

export function acquireUnitCylinderGeometry(pool = sharedStreamedAssetPool) {
  return pool.acquireGeometry('unit:cylinder:8', () => new CylinderGeometry(0.82, 1, 1, 8));
}

export function acquireUnitSphereGeometry(pool = sharedStreamedAssetPool) {
  return pool.acquireGeometry('unit:sphere:8x6', () => new SphereGeometry(1, 8, 6));
}

export function acquireSharedStandardMaterial(
  key: string,
  params: ConstructorParameters<typeof MeshStandardMaterial>[0],
  pool = sharedStreamedAssetPool,
) {
  return pool.acquireMaterial(`mat:std:${key}`, () => new MeshStandardMaterial(params));
}
