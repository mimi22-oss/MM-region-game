export * from './myotharCenterData.ts';
export * from './myotharCenterPOIs.ts';
export type { MyotharCenterRoad } from './myotharCenterRoads.ts';
export type { MyotharCenterBuildingData } from './myotharCenterBuildings.ts';
export * from './myotharSchoolCampus.ts';

import { myotharCenterRoads as rawMyotharCenterRoads } from './myotharCenterRoads.ts';
import { myotharCenterBuildings as rawMyotharCenterBuildings } from './myotharCenterBuildings.ts';
import {
  applyMyotharCenterBuildingOverrides,
  applyMyotharCenterRoadOverrides,
} from './myotharSchoolCampus.ts';

/** Authored Myothar Center roads with `way/239609161` cleanly connected into the Myothar School East Gate. */
export const myotharCenterRoads = applyMyotharCenterRoadOverrides(rawMyotharCenterRoads);

/** Authored Myothar Center buildings with road-corridor houses relocated cleanly (0 houses deleted). */
export const myotharCenterBuildings = applyMyotharCenterBuildingOverrides(rawMyotharCenterBuildings);
