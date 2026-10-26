import { angle, toWorld } from '../../wards/myothar/area5.ts';
import type { WindingCanalPlot } from '../../types.ts';

/**
 * ကံပုလဲရွာနှင့် မြို့သာရပ်ကွက်ကြား ရေနုတ်မြောင်း (Waterway Drain)
 *
 * GeoJSON Specification:
 * - ID: requested-waterway / kanbale-drain
 * - Request kind: drain (ရေနုတ်မြောင်း)
 * - Width: 1.0 scene meter
 * - Length: 689.3 scene meters
 * - Centerline: scene_path_xz / local_path_uv (8 waypoints)
 * - Crosses AH1 / NH41 at u = 0, v = -140.60 (XZ = -99.42, -99.42)
 * - Connects to Kanbale village road at u = 552.05, v = 22.20 (XZ = 406.05, -374.66)
 */

export interface WaterwayDrainPlot extends WindingCanalPlot {
  waterway: 'drain';
  sceneWidth: number;
  sceneLength: number;
  worldPoints: [number, number][];
}

export const kanbaleDrainWorldPoints: [number, number][] = [
  [406.05299110146484, -374.6625135192395],
  [254.5050659409021, -282.0498925877846],
  [109.69262981456268, -218.06300370020165],
  [-3.126329750793502, -159.12769947109393],
  [-40.17145520463623, -145.65678563703182],
  [-109.20992875069442, -91.77306606639945],
  [-129.41626738459559, -51.360260329829316],
  [-163.09358408694288, -9.263614451895137],
];

export const kanbaleDrain: WaterwayDrainPlot = {
  id: 'requested-waterway',
  name: 'ရေနုတ်မြောင်း',
  waterway: 'drain',
  depth: 1.0, // scene_width_m: 1
  sceneWidth: 1.0,
  sceneLength: 689.3,
  rotation: angle,
  points: [
    [552.0492, 22.1964],
    [379.4016, -19.4771],
    [231.7582, -76.6294],
    [110.3096, -114.7309],
    [74.5894, -131.4004],
    [-12.3297, -142.1164],
    [-55.1939, -127.8283],
    [-108.7742, -121.8749],
  ],
  worldPoints: kanbaleDrainWorldPoints,
  bridges: [
    // ၁။ AH1 / NH41 အာရှလမ်းမကြီး ဖြတ်ကူးတံတား (u = 0, v = -140.60)
    // အကျယ် ၁၆ မီတာ (၁၂ မီတာ လမ်းမကြီး + ဘေးပခုံးများ)၊ လမ်းကြောင်းတစ်လျှောက် အနံ ၆ မီတာ
    { u: 0.0, v: -140.60, width: 16.0, depth: 6.0 },

    // ၂။ ကံပုလဲ ရွာတွင်းလမ်း ဆက်စပ်ရာ တံတားငယ် (u = 551.5, v = 22.0)
    { u: 551.5, v: 22.0, width: 8.0, depth: 8.0 },
  ],
};

/**
 * 2D SVG Path Data String
 */
export const kanbaleDrainSvgPath = kanbaleDrainWorldPoints
  .map(([x, z], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${z.toFixed(2)}`)
  .join(' ');
