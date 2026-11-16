/** Shared gameplay positions. Only the current mount may publish or remove an ID. */
export type GhostRuntimeEntry = {
  id: string; x: number; z: number; state: string; active: boolean;
  source: 'entity' | 'ai'; updatedAt: number;
};
export const GHOST_RUNTIME_MAX_AGE_MS = 1000;
export function createGhostRuntimeRegistry(now: () => number = () => performance.now()) {
  const owners = new Map<string, { entry?: GhostRuntimeEntry }>();
  return {
    register(id: string) {
      const owner: { entry?: GhostRuntimeEntry } = {};
      owners.set(id, owner); // Replacement invalidates both the old data and its writer.
      return {
        report(x: number, z: number, active: boolean, state: string, source: 'entity' | 'ai' = 'ai') {
          if (owners.get(id) !== owner || !Number.isFinite(x) || !Number.isFinite(z)) return;
          const entry = owner.entry ??= { id, x, z, active, state, source, updatedAt: now() };
          entry.x = x; entry.z = z; entry.active = active; entry.state = state;
          entry.source = source; entry.updatedAt = now();
        },
        clear() { if (owners.get(id) === owner) owner.entry = undefined; },
        release() { if (owners.get(id) === owner) owners.delete(id); },
      };
    },
    get(id: string): Readonly<GhostRuntimeEntry> | undefined {
      const entry = owners.get(id)?.entry;
      const age = entry ? now() - entry.updatedAt : Infinity;
      return entry && age >= 0 && age < GHOST_RUNTIME_MAX_AGE_MS ? entry : undefined;
    },
  };
}
const runtime = createGhostRuntimeRegistry();
export const registerGhostRuntime = runtime.register;
export const getGhostRuntime = runtime.get;
