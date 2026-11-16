/**
 * server/walkabilityProviders.ts
 *
 * Lightweight server-side WalkabilityPort implementations that require no
 * Three.js, DOM, or browser-only imports.  Used by createTownServer to give
 * the authoritative WorldSimulation basic barrier + home-protection knowledge
 * without coupling to the client geometry pipeline.
 *
 * F02 fix: wires grab-barrier LOS checks so the ghost cannot deal damage
 * through walls/fences in the authoritative simulation.
 */

import {
  AUTHORITATIVE_HOME_SAFE_ZONE,
  WAREHOUSE_GHOST_ENCOUNTER,
  isPointInHomeSafeZone,
} from '../shared/network.ts';
import type { WalkabilityPort } from '../shared/contracts/index.ts';

// ---------------------------------------------------------------------------
// Warehouse collision boxes (server-side authoring — no Three.js needed)
// Coordinates from the myothar warehouse region layout.  Each entry is an
// axis-aligned box [minX, minZ, maxX, maxZ] that is *impassable* (wall/fence).
// Keep this in sync with any edits to the warehouse geometry authoring.
// ---------------------------------------------------------------------------
const WAREHOUSE_IMPASSABLE_BOXES: readonly [number, number, number, number][] = [
  // North wall of the main warehouse structure
  [22.0, 18.0, 52.0, 20.5],
  // South wall
  [22.0, 54.0, 52.0, 56.5],
  // West wall
  [22.0, 18.0, 24.5, 56.5],
  // East wall
  [49.5, 18.0, 52.0, 56.5],
  // Internal dividing wall (separates main hall from storage annex)
  [32.0, 30.0, 34.5, 48.0],
  // Fence row south of the warehouse
  [15.0, 60.0, 55.0, 61.0],
];

function isInsideImpassableBox(x: number, z: number): boolean {
  for (const [minX, minZ, maxX, maxZ] of WAREHOUSE_IMPASSABLE_BOXES) {
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
  }
  return false;
}

/**
 * Returns a WalkabilityPort that knows about:
 *   1. Home safe-zone polygon / circle (uses shared isPointInHomeSafeZone).
 *   2. Warehouse impassable collision boxes.
 *
 * isPointWalkable returns false for impassable cells.
 * isHomeProtected delegates to the shared helper.
 *
 * isSegmentWalkable is intentionally left undefined so WorldSimulation uses
 * its own built-in segment sampler (which calls isPointWalkable in a loop).
 */
export function createDefaultWalkabilityPort(): WalkabilityPort {
  return {
    isPointWalkable(x: number, z: number): boolean {
      // Walls and fences are not walkable
      if (isInsideImpassableBox(x, z)) return false;
      return true;
    },

    isHomeProtected(x: number, z: number, bufferM = 0): boolean {
      return isPointInHomeSafeZone(x, z, bufferM);
    },
  };
}

/** Null provider — no barriers, no extra home protection.  Used by tests
 *  that want to isolate movement/combat without collision. */
export const NULL_WALKABILITY_PORT: WalkabilityPort = {
  isPointWalkable: () => true,
  isHomeProtected: (x, z, bufferM = 0) => isPointInHomeSafeZone(x, z, bufferM),
};

// Validate that the warehouse anchor is inside the walkable area (dev sanity)
if (
  isInsideImpassableBox(WAREHOUSE_GHOST_ENCOUNTER.anchorX, WAREHOUSE_GHOST_ENCOUNTER.anchorZ)
) {
  // eslint-disable-next-line no-console
  console.warn(
    '[walkabilityProviders] WARNING: warehouse ghost anchor (%f, %f) falls inside an impassable box — check box coordinates.',
    WAREHOUSE_GHOST_ENCOUNTER.anchorX,
    WAREHOUSE_GHOST_ENCOUNTER.anchorZ,
  );
}

// Same for the home safe-zone centre
if (
  isInsideImpassableBox(AUTHORITATIVE_HOME_SAFE_ZONE.x, AUTHORITATIVE_HOME_SAFE_ZONE.z)
) {
  // eslint-disable-next-line no-console
  console.warn(
    '[walkabilityProviders] WARNING: home safe-zone centre (%f, %f) falls inside an impassable box.',
    AUTHORITATIVE_HOME_SAFE_ZONE.x,
    AUTHORITATIVE_HOME_SAFE_ZONE.z,
  );
}
