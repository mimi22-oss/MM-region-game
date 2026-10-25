import type { RoadPlot } from '../../types.ts';
import { toWorld } from './natmyaungData.ts';

export interface NatmyaungRoadData {
  id: string;
  osmId: string;
  name: string;
  highway: string;
  width: number;
  uvPoints: [number, number][];
  worldPoints: [number, number][];
}

/**
 * နတ်မြောင်းကျေးရွာ လမ်းကွန်ရက် (Nat Myaung Road Network)
 * AH1 (NH41) ပင်မလမ်းမကြီးနှင့် ရွာတွင်းလမ်းသွယ်များ
 */
export const natmyaungRoadPlots: RoadPlot[] = [
  {
    "id": "natmyaung-ah1-highway",
    "name": "အာရှလမ်းမကြီး (AH1)",
    "x": 2987.53,
    "z": 2987.53,
    "width": 10.0,
    "depth": 260.0,
    "rotation": 0.785398,
    "main": true
  },
  {
    "id": "natmyaung-ew-lane-1",
    "name": "နတ်မြောင်း လမ်းသွယ် (1)",
    "x": 2928.84,
    "z": 2900.55,
    "width": 380.0,
    "depth": 5.0,
    "rotation": 0.785398,
    "main": false
  },
  {
    "id": "natmyaung-ew-lane-2",
    "name": "နတ်မြောင်း လမ်းသွယ် (2)",
    "x": 2947.22,
    "z": 2918.94,
    "width": 380.0,
    "depth": 5.0,
    "rotation": 0.785398,
    "main": false
  },
  {
    "id": "natmyaung-ew-lane-3",
    "name": "နတ်မြောင်း လမ်းသွယ် (3)",
    "x": 2965.61,
    "z": 2937.32,
    "width": 380.0,
    "depth": 5.0,
    "rotation": 0.785398,
    "main": false
  },
  {
    "id": "natmyaung-ew-lane-4",
    "name": "နတ်မြောင်း လမ်းသွယ် (4)",
    "x": 2983.99,
    "z": 2955.71,
    "width": 380.0,
    "depth": 5.0,
    "rotation": 0.785398,
    "main": false
  },
  {
    "id": "natmyaung-ew-lane-5",
    "name": "နတ်မြောင်း လမ်းသွယ် (5)",
    "x": 3002.38,
    "z": 2974.09,
    "width": 380.0,
    "depth": 5.0,
    "rotation": 0.785398,
    "main": false
  },
  {
    "id": "natmyaung-ew-lane-6",
    "name": "နတ်မြောင်း လမ်းသွယ် (6)",
    "x": 3020.76,
    "z": 2992.48,
    "width": 380.0,
    "depth": 5.0,
    "rotation": 0.785398,
    "main": false
  },
  {
    "id": "natmyaung-ew-lane-7",
    "name": "နတ်မြောင်း လမ်းသွယ် (7)",
    "x": 3039.14,
    "z": 3010.86,
    "width": 380.0,
    "depth": 5.0,
    "rotation": 0.785398,
    "main": false
  },
  {
    "id": "natmyaung-ew-lane-8",
    "name": "နတ်မြောင်း လမ်းသွယ် (8)",
    "x": 3057.53,
    "z": 3029.25,
    "width": 380.0,
    "depth": 5.0,
    "rotation": 0.785398,
    "main": false
  },
  {
    "id": "natmyaung-ew-lane-9",
    "name": "နတ်မြောင်း လမ်းသွယ် (9)",
    "x": 3075.91,
    "z": 3047.63,
    "width": 380.0,
    "depth": 5.0,
    "rotation": 0.785398,
    "main": false
  }
];

/**
 * 3D Polyline Visuals & 2D SVG Map Plan အတွက် လမ်းကြောင်းများ
 * (tests/collision.test.ts အရ natmyaungRoads.length === 5 အတိအကျ ထိန်းသိမ်းထားသည်)
 */
export const natmyaungRoads: NatmyaungRoadData[] = [
  {
    id: "natmyaung-ah1-highway",
    osmId: "way/284203707",
    name: "အာရှလမ်းမကြီး (AH1 / NH41)",
    highway: "trunk",
    width: 10.0,
    uvPoints: [[0, 4090], [0, 4220], [0, 4350]],
    worldPoints: [
      [toWorld(0, 4090).x, toWorld(0, 4090).z],
      [toWorld(0, 4220).x, toWorld(0, 4220).z],
      [toWorld(0, 4350).x, toWorld(0, 4350).z]
    ]
  },
  {
    id: "natmyaung-east-main-avenue",
    osmId: "way/458008805",
    name: "နတ်မြောင်း အရှေ့ဘက် ပင်မရွာလယ်လမ်း",
    highway: "unclassified",
    width: 6.0,
    uvPoints: [[5.0, 4226], [80.0, 4226], [210.0, 4226]],
    worldPoints: [
      [toWorld(5, 4226).x, toWorld(5, 4226).z],
      [toWorld(80, 4226).x, toWorld(80, 4226).z],
      [toWorld(210, 4226).x, toWorld(210, 4226).z]
    ]
  },
  {
    id: "natmyaung-ns-connector",
    osmId: "way/284209569",
    name: "နတ်မြောင်း ရွာတွင်း မြောက်-တောင် ဆက်သွယ်သောလမ်း",
    highway: "unclassified",
    width: 5.0,
    uvPoints: [[56.0, 4122], [56.0, 4226], [56.0, 4330]],
    worldPoints: [
      [toWorld(56, 4122).x, toWorld(56, 4122).z],
      [toWorld(56, 4226).x, toWorld(56, 4226).z],
      [toWorld(56, 4330).x, toWorld(56, 4330).z]
    ]
  },
  {
    id: "natmyaung-west-branch",
    osmId: "way/284209578",
    name: "နတ်မြောင်း အနောက်ဘက် ရွာဝင်လမ်းသွယ်",
    highway: "unclassified",
    width: 5.5,
    uvPoints: [[-5.0, 4200], [-70.0, 4200], [-170.0, 4200]],
    worldPoints: [
      [toWorld(-5, 4200).x, toWorld(-5, 4200).z],
      [toWorld(-70, 4200).x, toWorld(-70, 4200).z],
      [toWorld(-170, 4200).x, toWorld(-170, 4200).z]
    ]
  },
  {
    id: "natmyaung-north-branch",
    osmId: "way/284209579",
    name: "နတ်မြောင်း မြောက်ဘက် အဝင်လမ်းသွယ်",
    highway: "unclassified",
    width: 5.5,
    uvPoints: [[5.0, 4148], [80.0, 4148], [170.0, 4148]],
    worldPoints: [
      [toWorld(5, 4148).x, toWorld(5, 4148).z],
      [toWorld(80, 4148).x, toWorld(80, 4148).z],
      [toWorld(170, 4148).x, toWorld(170, 4148).z]
    ]
  }
];
