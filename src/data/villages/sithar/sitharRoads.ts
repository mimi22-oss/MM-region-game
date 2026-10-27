import type { RoadPlot } from '../../types.ts';

export interface SiTharRoadData {
  id: string;
  osmId: string | number;
  name: string;
  highway: string;
  width: number;
  geoPoints: [number, number][];
  uvPoints: [number, number][];
  worldPoints: [number, number][];
}

export const siTharRoads: SiTharRoadData[] = [
  {
    "id": "sithar-road-0",
    "osmId": 284203707,
    "name": "Asian Highway",
    "highway": "trunk",
    "width": 12,
    "geoPoints": [
      [
        94.02392,
        23.052
      ],
      [
        94.02392,
        23.046
      ]
    ],
    "uvPoints": [
      [
        0,
        4022
      ],
      [
        0,
        4098
      ]
    ],
    "worldPoints": [
      [
        2843.98,
        2843.98
      ],
      [
        2897.72,
        2897.72
      ]
    ]
  },
  {
    "id": "sithar-ew-lane-1",
    "osmId": 920000001,
    "name": "စည်သာ အရှေ့-အနောက် လမ်းသွယ် (1)",
    "highway": "residential",
    "width": 3.2,
    "geoPoints": [],
    "uvPoints": [
      [
        -212,
        4035.5
      ],
      [
        -13,
        4035.5
      ]
    ],
    "worldPoints": [
      [
        2703.62,
        3003.44
      ],
      [
        2844.34,
        2862.72
      ]
    ]
  },
  {
    "id": "sithar-ew-lane-2",
    "osmId": 920000002,
    "name": "စည်သာ အရှေ့-အနောက် လမ်းသွယ် (2)",
    "highway": "residential",
    "width": 3.2,
    "geoPoints": [],
    "uvPoints": [
      [
        -212,
        4052
      ],
      [
        -13,
        4052
      ]
    ],
    "worldPoints": [
      [
        2715.29,
        3015.1
      ],
      [
        2856,
        2874.39
      ]
    ]
  },
  {
    "id": "sithar-ew-lane-3",
    "osmId": 920000003,
    "name": "စည်သာ အရှေ့-အနောက် လမ်းသွယ် (3)",
    "highway": "residential",
    "width": 3.2,
    "geoPoints": [],
    "uvPoints": [
      [
        -212,
        4069
      ],
      [
        -13,
        4069
      ]
    ],
    "worldPoints": [
      [
        2727.31,
        3027.12
      ],
      [
        2868.03,
        2886.41
      ]
    ]
  },
  {
    "id": "sithar-ew-lane-4",
    "osmId": 920000004,
    "name": "စည်သာ အရှေ့-အနောက် လမ်းသွယ် (4)",
    "highway": "residential",
    "width": 3.2,
    "geoPoints": [],
    "uvPoints": [
      [
        -212,
        4085.5
      ],
      [
        -13,
        4085.5
      ]
    ],
    "worldPoints": [
      [
        2738.98,
        3038.79
      ],
      [
        2879.69,
        2898.08
      ]
    ]
  },
  {
    "id": "sithar-ns-lane-1",
    "osmId": 920000011,
    "name": "စည်သာ မြောက်-တောင် လမ်းသွယ် (1)",
    "highway": "residential",
    "width": 3.6,
    "geoPoints": [],
    "uvPoints": [
      [
        -13,
        4035.5
      ],
      [
        -13,
        4085.5
      ]
    ],
    "worldPoints": [
      [
        2844.34,
        2862.72
      ],
      [
        2879.69,
        2898.08
      ]
    ]
  },
  {
    "id": "sithar-ns-lane-2",
    "osmId": 920000012,
    "name": "စည်သာ မြောက်-တောင် လမ်းသွယ် (2)",
    "highway": "residential",
    "width": 3.6,
    "geoPoints": [],
    "uvPoints": [
      [
        -52,
        4035.5
      ],
      [
        -52,
        4085.5
      ]
    ],
    "worldPoints": [
      [
        2816.76,
        2890.3
      ],
      [
        2852.12,
        2925.65
      ]
    ]
  },
  {
    "id": "sithar-ns-lane-3",
    "osmId": 920000013,
    "name": "စည်သာ မြောက်-တောင် လမ်းသွယ် (3)",
    "highway": "residential",
    "width": 3.6,
    "geoPoints": [],
    "uvPoints": [
      [
        -92,
        4035.5
      ],
      [
        -92,
        4085.5
      ]
    ],
    "worldPoints": [
      [
        2788.48,
        2918.58
      ],
      [
        2823.83,
        2953.94
      ]
    ]
  },
  {
    "id": "sithar-ns-lane-4",
    "osmId": 920000014,
    "name": "စည်သာ မြောက်-တောင် လမ်းသွယ် (4)",
    "highway": "residential",
    "width": 3.6,
    "geoPoints": [],
    "uvPoints": [
      [
        -132,
        4035.5
      ],
      [
        -132,
        4085.5
      ]
    ],
    "worldPoints": [
      [
        2760.19,
        2946.87
      ],
      [
        2795.55,
        2982.22
      ]
    ]
  },
  {
    "id": "sithar-ns-lane-5",
    "osmId": 920000015,
    "name": "စည်သာ မြောက်-တောင် လမ်းသွယ် (5)",
    "highway": "residential",
    "width": 3.6,
    "geoPoints": [],
    "uvPoints": [
      [
        -172,
        4035.5
      ],
      [
        -172,
        4085.5
      ]
    ],
    "worldPoints": [
      [
        2731.91,
        2975.15
      ],
      [
        2767.26,
        3010.51
      ]
    ]
  },
  {
    "id": "sithar-ns-lane-6",
    "osmId": 920000016,
    "name": "စည်သာ မြောက်-တောင် လမ်းသွယ် (6)",
    "highway": "residential",
    "width": 3.6,
    "geoPoints": [],
    "uvPoints": [
      [
        -212,
        4035.5
      ],
      [
        -212,
        4085.5
      ]
    ],
    "worldPoints": [
      [
        2703.62,
        3003.44
      ],
      [
        2738.98,
        3038.79
      ]
    ]
  },
  {
    "id": "sithar-ah1-connector",
    "osmId": 920000099,
    "name": "စည်သာ AH1 ဆက်သွယ်လမ်း",
    "highway": "residential",
    "width": 4,
    "geoPoints": [],
    "uvPoints": [
      [
        -13,
        4060.5
      ],
      [
        0,
        4060.5
      ]
    ],
    "worldPoints": [
      [
        2862.01,
        2880.4
      ],
      [
        2871.21,
        2871.21
      ]
    ]
  },
  {
    "id": "sithar-block-road-1",
    "osmId": 920000021,
    "name": "စည်သာ အကွက် (1) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -46,
        4043.5
      ],
      [
        -18,
        4043.5
      ]
    ],
    "worldPoints": [
      [
        2826.66,
        2891.71
      ],
      [
        2846.46,
        2871.91
      ]
    ]
  },
  {
    "id": "sithar-block-road-2",
    "osmId": 920000022,
    "name": "စည်သာ အကွက် (2) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -86,
        4043.5
      ],
      [
        -58,
        4043.5
      ]
    ],
    "worldPoints": [
      [
        2798.38,
        2920
      ],
      [
        2818.17,
        2900.2
      ]
    ]
  },
  {
    "id": "sithar-block-road-3",
    "osmId": 920000023,
    "name": "စည်သာ အကွက် (3) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -126,
        4043.5
      ],
      [
        -98,
        4043.5
      ]
    ],
    "worldPoints": [
      [
        2770.09,
        2948.28
      ],
      [
        2789.89,
        2928.48
      ]
    ]
  },
  {
    "id": "sithar-block-road-4",
    "osmId": 920000024,
    "name": "စည်သာ အကွက် (4) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -166,
        4043.5
      ],
      [
        -138,
        4043.5
      ]
    ],
    "worldPoints": [
      [
        2741.81,
        2976.57
      ],
      [
        2761.61,
        2956.77
      ]
    ]
  },
  {
    "id": "sithar-block-road-5",
    "osmId": 920000025,
    "name": "စည်သာ အကွက် (5) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -206,
        4043.5
      ],
      [
        -178,
        4043.5
      ]
    ],
    "worldPoints": [
      [
        2713.52,
        3004.85
      ],
      [
        2733.32,
        2985.05
      ]
    ]
  },
  {
    "id": "sithar-block-road-6",
    "osmId": 920000026,
    "name": "စည်သာ အကွက် (6) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -46,
        4060.5
      ],
      [
        -18,
        4060.5
      ]
    ],
    "worldPoints": [
      [
        2838.68,
        2903.73
      ],
      [
        2858.48,
        2883.94
      ]
    ]
  },
  {
    "id": "sithar-block-road-7",
    "osmId": 920000027,
    "name": "စည်သာ အကွက် (7) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -86,
        4060.5
      ],
      [
        -58,
        4060.5
      ]
    ],
    "worldPoints": [
      [
        2810.4,
        2932.02
      ],
      [
        2830.19,
        2912.22
      ]
    ]
  },
  {
    "id": "sithar-block-road-8",
    "osmId": 920000028,
    "name": "စည်သာ အကွက် (8) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -126,
        4060.5
      ],
      [
        -98,
        4060.5
      ]
    ],
    "worldPoints": [
      [
        2782.11,
        2960.3
      ],
      [
        2801.91,
        2940.5
      ]
    ]
  },
  {
    "id": "sithar-block-road-9",
    "osmId": 920000029,
    "name": "စည်သာ အကွက် (9) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -166,
        4060.5
      ],
      [
        -138,
        4060.5
      ]
    ],
    "worldPoints": [
      [
        2753.83,
        2988.59
      ],
      [
        2773.63,
        2968.79
      ]
    ]
  },
  {
    "id": "sithar-block-road-10",
    "osmId": 920000030,
    "name": "စည်သာ အကွက် (10) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -206,
        4060.5
      ],
      [
        -178,
        4060.5
      ]
    ],
    "worldPoints": [
      [
        2725.54,
        3016.87
      ],
      [
        2745.34,
        2997.07
      ]
    ]
  },
  {
    "id": "sithar-block-road-11",
    "osmId": 920000031,
    "name": "စည်သာ အကွက် (11) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -46,
        4077.5
      ],
      [
        -18,
        4077.5
      ]
    ],
    "worldPoints": [
      [
        2850.7,
        2915.75
      ],
      [
        2870.5,
        2895.96
      ]
    ]
  },
  {
    "id": "sithar-block-road-12",
    "osmId": 920000032,
    "name": "စည်သာ အကွက် (12) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -86,
        4077.5
      ],
      [
        -58,
        4077.5
      ]
    ],
    "worldPoints": [
      [
        2822.42,
        2944.04
      ],
      [
        2842.22,
        2924.24
      ]
    ]
  },
  {
    "id": "sithar-block-road-13",
    "osmId": 920000033,
    "name": "စည်သာ အကွက် (13) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -126,
        4077.5
      ],
      [
        -98,
        4077.5
      ]
    ],
    "worldPoints": [
      [
        2794.13,
        2972.32
      ],
      [
        2813.93,
        2952.52
      ]
    ]
  },
  {
    "id": "sithar-block-road-14",
    "osmId": 920000034,
    "name": "စည်သာ အကွက် (14) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -166,
        4077.5
      ],
      [
        -138,
        4077.5
      ]
    ],
    "worldPoints": [
      [
        2765.85,
        3000.61
      ],
      [
        2785.65,
        2980.81
      ]
    ]
  },
  {
    "id": "sithar-block-road-15",
    "osmId": 920000035,
    "name": "စည်သာ အကွက် (15) လမ်းကြား",
    "highway": "unclassified",
    "width": 2,
    "geoPoints": [],
    "uvPoints": [
      [
        -206,
        4077.5
      ],
      [
        -178,
        4077.5
      ]
    ],
    "worldPoints": [
      [
        2737.56,
        3028.89
      ],
      [
        2757.36,
        3009.09
      ]
    ]
  }
];

export const siTharRoadPlots: RoadPlot[] = [
  {
    "id": "sithar-main-road",
    "name": "AH1 အာရှလမ်းမကြီး (စည်သာရွာပိုင်း)",
    "x": 2871.21,
    "z": 2871.21,
    "width": 12,
    "depth": 76,
    "rotation": 0.7853981633974483,
    "main": true
  },
  {
    "id": "sithar-ew-plot-1",
    "name": "စည်သာ လမ်းသွယ် 1",
    "x": 2773.98,
    "z": 2933.08,
    "width": 199,
    "depth": 3.2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ew-plot-2",
    "name": "စည်သာ လမ်းသွယ် 2",
    "x": 2785.65,
    "z": 2944.75,
    "width": 199,
    "depth": 3.2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ew-plot-3",
    "name": "စည်သာ လမ်းသွယ် 3",
    "x": 2797.67,
    "z": 2956.77,
    "width": 199,
    "depth": 3.2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ew-plot-4",
    "name": "စည်သာ လမ်းသွယ် 4",
    "x": 2809.34,
    "z": 2968.43,
    "width": 199,
    "depth": 3.2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ns-plot-1",
    "name": "စည်သာ အတွင်းလမ်း 1",
    "x": 2862.01,
    "z": 2880.4,
    "width": 3.6,
    "depth": 50,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ns-plot-2",
    "name": "စည်သာ အတွင်းလမ်း 2",
    "x": 2834.44,
    "z": 2907.98,
    "width": 3.6,
    "depth": 50,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ns-plot-3",
    "name": "စည်သာ အတွင်းလမ်း 3",
    "x": 2806.15,
    "z": 2936.26,
    "width": 3.6,
    "depth": 50,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ns-plot-4",
    "name": "စည်သာ အတွင်းလမ်း 4",
    "x": 2777.87,
    "z": 2964.55,
    "width": 3.6,
    "depth": 50,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ns-plot-5",
    "name": "စည်သာ အတွင်းလမ်း 5",
    "x": 2749.58,
    "z": 2992.83,
    "width": 3.6,
    "depth": 50,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ns-plot-6",
    "name": "စည်သာ အတွင်းလမ်း 6",
    "x": 2721.3,
    "z": 3021.11,
    "width": 3.6,
    "depth": 50,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-ah1-connector-plot",
    "name": "စည်သာ AH1 ဆက်သွယ်လမ်း",
    "x": 2866.61,
    "z": 2875.8,
    "width": 13,
    "depth": 4,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-1",
    "name": "စည်သာ အကွက် 1 လမ်းကြား",
    "x": 2836.56,
    "z": 2881.81,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-2",
    "name": "စည်သာ အကွက် 2 လမ်းကြား",
    "x": 2808.27,
    "z": 2910.1,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-3",
    "name": "စည်သာ အကွက် 3 လမ်းကြား",
    "x": 2779.99,
    "z": 2938.38,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-4",
    "name": "စည်သာ အကွက် 4 လမ်းကြား",
    "x": 2751.71,
    "z": 2966.67,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-5",
    "name": "စည်သာ အကွက် 5 လမ်းကြား",
    "x": 2723.42,
    "z": 2994.95,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-6",
    "name": "စည်သာ အကွက် 6 လမ်းကြား",
    "x": 2848.58,
    "z": 2893.83,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-7",
    "name": "စည်သာ အကွက် 7 လမ်းကြား",
    "x": 2820.3,
    "z": 2922.12,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-8",
    "name": "စည်သာ အကွက် 8 လမ်းကြား",
    "x": 2792.01,
    "z": 2950.4,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-9",
    "name": "စည်သာ အကွက် 9 လမ်းကြား",
    "x": 2763.73,
    "z": 2978.69,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-10",
    "name": "စည်သာ အကွက် 10 လမ်းကြား",
    "x": 2735.44,
    "z": 3006.97,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-11",
    "name": "စည်သာ အကွက် 11 လမ်းကြား",
    "x": 2860.6,
    "z": 2905.86,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-12",
    "name": "စည်သာ အကွက် 12 လမ်းကြား",
    "x": 2832.32,
    "z": 2934.14,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-13",
    "name": "စည်သာ အကွက် 13 လမ်းကြား",
    "x": 2804.03,
    "z": 2962.42,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-14",
    "name": "စည်သာ အကွက် 14 လမ်းကြား",
    "x": 2775.75,
    "z": 2990.71,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  },
  {
    "id": "sithar-block-plot-15",
    "name": "စည်သာ အကွက် 15 လမ်းကြား",
    "x": 2747.46,
    "z": 3018.99,
    "width": 28,
    "depth": 2,
    "rotation": 0.7853981633974483,
    "main": false
  }
];
