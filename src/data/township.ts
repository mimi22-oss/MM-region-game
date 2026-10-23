import { kalayWards, myotharWard, area5, angle, toWorld, pitchLanes, oppositeLanes, residentialRows, farmhouse } from './wards/index.ts';
import { kalayVillages } from './villages/index.ts';
import type { House, RoadPlot, TreePlot, FieldPlot, AreaMeta, WardMeta, VillageMeta } from './types.ts';

/**
 * ကလေးမြို့နယ် (Kalay Township) ပေါင်းချုပ် ဒေတာ
 * - `wards`: မြို့ပေါ် ရပ်ကွက်ပေါင်း ၂၀ ကျော် (ရပ်ကွက်တစ်ခုချင်းစီတွင် နယ်မြေအများအပြား ပါဝင်သည်)
 * - `villages`: မြို့နယ်အတွင်းရှိ ကျေးရွာများ (Villages)
 */
export const kalayTownship = {
 id: 'kalay-township',
 name: 'ကလေးမြို့နယ်',
 wards: kalayWards,
 villages: kalayVillages,
};

export {
 kalayWards,
 kalayVillages,
 myotharWard,
 area5,
 angle,
 toWorld,
 pitchLanes,
 oppositeLanes,
 residentialRows,
 farmhouse,
 type House,
 type RoadPlot,
 type TreePlot,
 type FieldPlot,
 type AreaMeta,
 type WardMeta,
 type VillageMeta,
};

