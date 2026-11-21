/**
 * Chin Village Region Registry & Shared Attached-Door Animation State
 *
 * Ensures that any region designated as a Chin village (`isChinVillageRegion`) is
 * populated EXCLUSIVELY by Chin ethnic villagers via `<ChinVillagePopulation>`
 * (never generic non-Chin `HouseResidentBots` or `VillagePedestrianBots`).
 */

export const CHIN_VILLAGE_REGION_IDS: ReadonlySet<string> = new Set([
  'tharyargone',
  'kyarinn',
  'weipula-village',
  'weipula-chin-village',
]);

export function isChinVillageRegion(regionId: string): boolean {
  return CHIN_VILLAGE_REGION_IDS.has(regionId);
}

/**
 * Shared animated door open fraction (`0 = closed`, `1 = fully open`) keyed by house ID.
 * Driven by `<ChinVillagePopulation>` (residents entering/exiting + player proximity)
 * and consumed directly by `<ChinTraditionalHouseBatch>` to swing each house's OWN
 * attached double front door — guaranteeing ONE single attached door per house.
 */
const doorOpenByHouseId = new Map<string, number>();

export function setChinHouseDoorOpen(houseId: string, open: number): void {
  const clamped = Math.max(0, Math.min(1, open));
  if (clamped <= 0.001) {
    doorOpenByHouseId.delete(houseId);
  } else {
    doorOpenByHouseId.set(houseId, clamped);
  }
}

export function getChinHouseDoorOpen(houseId: string): number {
  return doorOpenByHouseId.get(houseId) ?? 0;
}

export function clearChinHouseDoors(houseIds?: Iterable<string>): void {
  if (!houseIds) {
    doorOpenByHouseId.clear();
    return;
  }
  for (const id of houseIds) {
    doorOpenByHouseId.delete(id);
  }
}
