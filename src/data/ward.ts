import {
 kalayWards,
 myotharWard,
 area5,
 angle,
 toWorld,
 pitchLanes,
 oppositeLanes,
 residentialRows,
 farmhouse,
 type House,
} from './wards/index.ts';
import { kalayVillages, tharSiVillage, tharSiLanes, tharSiCrossLanes } from './villages/index.ts';

export const ward = {
 ...myotharWard,
 name: 'မြို့သာရပ်ကွက် · ကလေးမြို့',
 villages: kalayVillages,
};

export {
 kalayWards,
 kalayVillages,
 tharSiVillage,
 tharSiLanes,
 tharSiCrossLanes,
 myotharWard,
 area5,
 angle,
 toWorld,
 pitchLanes,
 oppositeLanes,
 residentialRows,
 farmhouse,
 type House,
};
