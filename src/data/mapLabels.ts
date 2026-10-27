import { MAP_DESTINATIONS } from '../game/locationDetect.ts';
import { uniqueMapLabels, type MapLabel } from '../game/mapLabels.ts';
import { kalayVillages } from './villages/index.ts';
import { myotharCenterPOIs } from './wards/myothar/center/myotharCenterPOIs.ts';
import { natmyaungBuildings } from './villages/natmyaung/natmyaungBuildings.ts';
import { siTharBuildings } from './villages/sithar/sitharBuildings.ts';

// Use the same world coordinates as the rendered GeoJSON/landmarks, never lon/lat or camera spawn offsets.
const villages = new Set(kalayVillages.map(village => village.id));
const customDestinationIds = new Set(['myothar-monastery', 'ppk-petrol', 'oso-energy', 'ko-lwin-oo', 'min-kan-kaung', 'layoung-mobile', 'thein-htike-san-2']);
export const worldMapLabels: MapLabel[] = uniqueMapLabels([
 ...myotharCenterPOIs.map(poi => ({ id: `poi:${poi.id}`, name: poi.name, x: poi.x, z: poi.z, kind: 'place' as const, priority: 80 })),
 ...siTharBuildings.filter(building => building.isLandmark).map(building => ({
  id: `poi:${building.id}`, name: building.name, x: building.x, z: building.z, kind: 'place' as const, priority: 70,
 })),
 ...natmyaungBuildings.filter(building => building.isLandmark).map(building => ({
  id: `poi:${building.id}`, name: building.name, x: building.x, z: building.z, kind: 'place' as const, priority: 70,
 })),
 ...kalayVillages.map(village => ({ id: `area:${village.id}`, name: village.name, ...village.labelPos, kind: 'area' as const, priority: 100 })),
 ...MAP_DESTINATIONS.filter(destination => !villages.has(destination.id) && !customDestinationIds.has(destination.id)).map(destination => ({
  id: `destination:${destination.id}`, name: destination.label, x: destination.x, z: destination.z,
  kind: (destination.id.startsWith('myothar-area') || destination.id === 'myothar-center' || destination.id === 'kalay-area-1' ? 'area' : 'place') as MapLabel['kind'],
  priority: destination.id.startsWith('myothar-area') || destination.id === 'myothar-center' || destination.id === 'kalay-area-1' ? 100 : (destination.id === 'nankalein-bridge' || destination.id === 'nankalein-chaung' || destination.id === 'kalay-area-1-tea-shop' ? 85 : 50),
 })),
]);
