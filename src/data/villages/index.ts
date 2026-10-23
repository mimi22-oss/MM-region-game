import type { VillageMeta } from '../types.ts';
import { tharSiVillage, tharSiLanes, tharSiCrossLanes } from './tharsi/index.ts';
import { chinSaiVillage, chinSaiLanes, chinSaiCrossLanes, chinSaiMonasteries } from './chinsai/index.ts';

export { tharSiVillage, tharSiLanes, tharSiCrossLanes, chinSaiVillage, chinSaiLanes, chinSaiCrossLanes, chinSaiMonasteries };

/**
 * ကလေးမြို့နယ်အတွင်းရှိ ကျေးရွာများ (Villages) စုစည်းမှု။
 */
export const kalayVillages: VillageMeta[] = [tharSiVillage, chinSaiVillage];
