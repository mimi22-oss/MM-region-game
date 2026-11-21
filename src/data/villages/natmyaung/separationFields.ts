import type { FieldPlot } from '../../types.ts';
import { toWorld } from './natmyaungData.ts';

const PADDY_COLORS = ['#8ca65c', '#a6af68', '#7e9c55', '#96a85d', '#86a257'];

/**
 * နတ်မြောင်းရွာ နှင့် မဟာဝေပုလ္လတောင်တော် ကြား ခြားထားသော လယ်ကွင်း ၁၀ ကွင်း
 * (Ten separation paddy fields south of Nat Myaung village boundary v <= 4311.5
 * and north of Maha Weipula foothills v >= 4590: 5 west of AH1 + 5 east of AH1,
 * leaving a continuous 28m AH1 highway corridor clear down the center.)
 */
const FIELD_ROWS_V = [4374, 4418, 4462, 4506, 4550] as const;

export const natmyaungWeipulaSeparationFields: FieldPlot[] = FIELD_ROWS_V.flatMap((v, rowIdx) =>
  ([-44, 44] as const).map((u, sideIdx) => ({
    id: `natmyaung-weipula-sep-field-${rowIdx * 2 + sideIdx}`,
    row: rowIdx,
    u,
    v,
    ...toWorld(u, v),
    width: 56,
    depth: 38,
    rotation: Math.PI / 4,
    color: PADDY_COLORS[(rowIdx + sideIdx * 2) % PADDY_COLORS.length],
  })),
);
