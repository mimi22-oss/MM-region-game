import { toWorld, toLocalUV } from './natmyaungData.ts';

/**
 * နတ်မြောင်းရွာ နယ်နိမိတ် (Nat Myaung Boundary Coordinates)
 * `map/Natmyaung-boundary.geojson` မှ ရရှိသော GeoJSON Polygon
 */

export const natmyaungBoundaryGeoPoints: [number, number][] = [
  [
    94.0380912,
    23.0039349
  ],
  [
    94.0392821,
    23.0040436
  ],
  [
    94.0401074,
    23.0055655
  ],
  [
    94.0418669,
    23.0067111
  ],
  [
    94.0429398,
    23.0071456
  ],
  [
    94.0437123,
    23.0087256
  ],
  [
    94.0448281,
    23.0097132
  ],
  [
    94.0462013,
    23.0108192
  ],
  [
    94.0460297,
    23.0117672
  ],
  [
    94.0453001,
    23.0125967
  ],
  [
    94.0437981,
    23.0144137
  ],
  [
    94.0422102,
    23.0140977
  ],
  [
    94.0410515,
    23.0139397
  ],
  [
    94.0400645,
    23.0134262
  ],
  [
    94.0383478,
    23.0129917
  ],
  [
    94.0371891,
    23.0124387
  ],
  [
    94.0357729,
    23.0116882
  ],
  [
    94.0380912,
    23.0039349
  ]
];

export const natmyaungBoundaryUVPoints: [number, number][] = [
  [
    -7.54,
    4311.47
  ],
  [
    14.42,
    4309.3
  ],
  [
    29.64,
    4278.8
  ],
  [
    62.09,
    4255.85
  ],
  [
    81.87,
    4247.14
  ],
  [
    96.12,
    4215.48
  ],
  [
    116.7,
    4195.69
  ],
  [
    142.02,
    4173.53
  ],
  [
    138.85,
    4154.53
  ],
  [
    125.4,
    4137.91
  ],
  [
    97.7,
    4101.5
  ],
  [
    68.42,
    4107.84
  ],
  [
    47.05,
    4111.0
  ],
  [
    28.85,
    4121.29
  ],
  [
    -2.81,
    4130.0
  ],
  [
    -24.17,
    4141.08
  ],
  [
    -50.29,
    4156.12
  ],
  [
    -7.54,
    4311.47
  ]
];

export const natmyaungBoundaryWorldPoints: [number, number][] = [
  [
    3043.34,
    3054.0
  ],
  [
    3057.33,
    3036.94
  ],
  [
    3046.53,
    3004.61
  ],
  [
    3053.24,
    2965.44
  ],
  [
    3061.07,
    2945.29
  ],
  [
    3048.76,
    2912.83
  ],
  [
    3049.32,
    2884.28
  ],
  [
    3051.55,
    2850.71
  ],
  [
    3035.88,
    2839.51
  ],
  [
    3014.62,
    2837.27
  ],
  [
    2969.28,
    2831.11
  ],
  [
    2953.06,
    2856.3
  ],
  [
    2940.19,
    2873.65
  ],
  [
    2934.59,
    2893.79
  ],
  [
    2918.36,
    2922.34
  ],
  [
    2911.09,
    2945.28
  ],
  [
    2903.26,
    2974.38
  ],
  [
    3043.34,
    3054.0
  ]
];

export const natmyaungBoundarySvgPath = "M 3043.34,3054.0 L 3057.33,3036.94 L 3046.53,3004.61 L 3053.24,2965.44 L 3061.07,2945.29 L 3048.76,2912.83 L 3049.32,2884.28 L 3051.55,2850.71 L 3035.88,2839.51 L 3014.62,2837.27 L 2969.28,2831.11 L 2953.06,2856.3 L 2940.19,2873.65 L 2934.59,2893.79 L 2918.36,2922.34 L 2911.09,2945.28 L 2903.26,2974.38 L 3043.34,3054.0 Z";

export const natmyaungBoundaryBounds = {
  minX: 2903.26,
  maxX: 3061.07,
  minZ: 2831.11,
  maxZ: 3054.0,
  minU: -50.29,
  maxU: 142.02,
  minV: 4101.5,
  maxV: 4311.47,
};

/**
 * Point in polygon test (2D Ray-Casting Algorithm in World space)
 */
export function isPointInsideNatmyaung(x: number, z: number): boolean {
  const { minX, maxX, minZ, maxZ } = natmyaungBoundaryBounds;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return false;

  let inside = false;
  const pts = natmyaungBoundaryWorldPoints;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const zi = pts[i][1];
    const xj = pts[j][0];
    const zj = pts[j][1];

    const intersect =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
