import type { VillageMeta } from '../types.ts';
import { tharSiVillage, tharSiLanes, tharSiCrossLanes } from './tharsi/index.ts';
import { chinSaiVillage, chinSaiLanes, chinSaiCrossLanes, chinSaiMonasteries } from './chinsai/index.ts';
import { zingalinVillage, zingalinLanes, zingalinCrossLanes, zingalinMonasteries, zeeChaungStream } from './zingalin/index.ts';
import { htomarVillage, htomarLanes, htomarCrossLanes, htomarLandmarks, htomarFiveColumnFields, htomarRoadsideShops } from './htomar/index.ts';
import { tharYarGoneVillage, tharYarGoneLanes, tharYarGoneCrossLanes, tharYarGoneLandmarkBuildings } from './tharyargone/index.ts';
import {
 htaukKyantVillage,
 htaukKyantLanes,
 htaukKyantCrossLanes,
 htaukKyantCanal,
 htaukKyantLake,
 htaukKyantPonds,
 allHtaukKyantPonds,
 htaukKyantLandmarks,
 htaukKyantLandmarkBuildings,
} from './htaukkyant/index.ts';

export {
 htaukKyantVillage,
 htaukKyantLanes,
 htaukKyantCrossLanes,
 htaukKyantCanal,
 htaukKyantLake,
 htaukKyantPonds,
 allHtaukKyantPonds,
 htaukKyantLandmarks,
 htaukKyantLandmarkBuildings,
 tharYarGoneVillage,
 tharYarGoneLanes,
 tharYarGoneCrossLanes,
 tharYarGoneLandmarkBuildings,
 tharSiVillage,
 tharSiLanes,
 tharSiCrossLanes,
 chinSaiVillage,
 chinSaiLanes,
 chinSaiCrossLanes,
 chinSaiMonasteries,
 zingalinVillage,
 zingalinLanes,
 zingalinCrossLanes,
 zingalinMonasteries,
 zeeChaungStream,
 htomarVillage,
 htomarLanes,
 htomarCrossLanes,
 htomarLandmarks,
 htomarFiveColumnFields,
 htomarRoadsideShops,
};

/**
 * ကလေးမြို့နယ်အတွင်းရှိ ကျေးရွာများ (Villages) စုစည်းမှု။
 */
export const kalayVillages: VillageMeta[] = [
 tharSiVillage,
 chinSaiVillage,
 zingalinVillage,
 htomarVillage,
 tharYarGoneVillage,
 htaukKyantVillage,
];
