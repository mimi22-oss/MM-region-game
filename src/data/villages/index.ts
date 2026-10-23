import type { VillageMeta } from '../types.ts';
import { tharSiVillage, tharSiLanes, tharSiCrossLanes } from './tharsi/index.ts';

export { tharSiVillage, tharSiLanes, tharSiCrossLanes };

/**
 * ကလေးမြို့နယ်အတွင်းရှိ ကျေးရွာများ (Villages) စုစည်းမှု။
 */
export const kalayVillages: VillageMeta[] = [tharSiVillage];
