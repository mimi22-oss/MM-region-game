import fs from 'fs';

const angle = Math.PI / 4;
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

function toWorld(u, v) {
  return {
    x: Number((u * cosA + v * sinA).toFixed(2)),
    z: Number((-u * sinA + v * cosA).toFixed(2)),
  };
}

// 1. Landmarks definitions
const landmarksDefs = [
  {
    id: 'sithar-admin-office',
    name: 'စည်သာ ကျေးရွာ အုပ်ချုပ်ရေးမှူးရုံး',
    u: -24.0,
    v: 4061.0,
    width: 12.0,
    depth: 8.0,
    houseWidth: 12.0,
    houseLength: 8.0,
    rotation: angle + Math.PI / 2,
    wallColor: '#ece6d8',
    roofColor: '#3b6d8c',
    area: 96.0,
    isLandmark: true,
    type: 'office',
    storeys: 2,
  },
  {
    id: 'sithar-baptist-church',
    name: 'စည်သာ နှစ်ခြင်းအသင်းတော် ဘုရားကျောင်း (Sitha Baptist Church)',
    u: -48.0,
    v: 4045.0,
    width: 15.0,
    depth: 9.0,
    houseWidth: 15.0,
    houseLength: 9.0,
    rotation: angle,
    wallColor: '#f8fafc',
    roofColor: '#1e40af',
    area: 135.0,
    isLandmark: true,
    type: 'church',
    storeys: 2,
  },
  {
    id: 'sithar-library',
    name: 'စည်သာ ကျေးရွာ စာကြည့်တိုက် (Sithar Library)',
    u: -68.0,
    v: 4055.0,
    width: 11.0,
    depth: 7.5,
    houseWidth: 11.0,
    houseLength: 7.5,
    rotation: angle,
    wallColor: '#fef3c7',
    roofColor: '#059669',
    area: 82.5,
    isLandmark: true,
    type: 'school',
    storeys: 1,
  },
  {
    id: 'sithar-pentecostal-church',
    name: 'စည်သာ ပင်တေကုတ္တေ ဘုရားကျောင်း (United Pentecostal Church of Sitha)',
    u: -84.0,
    v: 4068.0,
    width: 14.0,
    depth: 8.5,
    houseWidth: 14.0,
    houseLength: 8.5,
    rotation: angle,
    wallColor: '#f1f5f9',
    roofColor: '#dc2626',
    area: 119.0,
    isLandmark: true,
    type: 'church',
    storeys: 2,
  },
  {
    id: 'sithar-monastery-center',
    name: 'စည်သာ ဘုန်းတော်ကြီးကျောင်း (ရန်ကင်းဓမ္မသုခ ရွာလယ်ကျောင်း)',
    u: -52.0,
    v: 4075.0,
    width: 16.0,
    depth: 10.0,
    houseWidth: 16.0,
    houseLength: 10.0,
    rotation: angle,
    wallColor: '#d97706',
    roofColor: '#78350f',
    area: 160.0,
    isLandmark: true,
    type: 'monastery',
    storeys: 1,
  },
  {
    id: 'sithar-yanking-monastery-main',
    name: 'ရန်ကင်းဓမ္မသုခ ကျောင်းတိုက်ကြီး (Sithar Yanking Monastery)',
    u: -124.0,
    v: 4078.0,
    width: 18.0,
    depth: 11.0,
    houseWidth: 18.0,
    houseLength: 11.0,
    rotation: angle,
    wallColor: '#ca8a04',
    roofColor: '#713f12',
    area: 198.0,
    isLandmark: true,
    type: 'monastery',
    storeys: 2,
  },
  {
    id: 'sithar-train-station',
    name: 'စည်သာ ဘူတာရုံ (Si Thar Railway Station)',
    u: 22.0,
    v: 4052.0,
    width: 16.0,
    depth: 7.5,
    houseWidth: 16.0,
    houseLength: 7.5,
    rotation: angle,
    wallColor: '#e2e8f0',
    roofColor: '#b91c1c',
    area: 120.0,
    isLandmark: true,
    type: 'station',
    storeys: 1,
  },
];

// Read existing roads
const roadsTs = fs.readFileSync('src/data/villages/sithar/sitharRoads.ts', 'utf8');
const roadsMatch = roadsTs.match(/export const siTharRoads: SiTharRoadData\[\] = (\[[\s\S]*?\]);\s*export const siTharRoadPlots/);
const roads = JSON.parse(roadsMatch[1]);

function distToSeg(pu, pv, p1u, p1v, p2u, p2v) {
  const dx = p2u - p1u, dy = p2v - p1v;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(pu - p1u, pv - p1v);
  let t = ((pu - p1u) * dx + (pv - p1v) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(pu - (p1u + t * dx), pv - (p1v + t * dy));
}

function checkRoadDistance(u, v) {
  // AH1 highway corridor clearance: at least 15m from centerline (road width is 12m)
  if (Math.abs(u) < 16.0) return -1;
  let minD = Infinity;
  for (const r of roads) {
    const halfW = (r.width || 6.0) / 2;
    for (let i = 0; i < r.uvPoints.length - 1; i++) {
      const p1 = r.uvPoints[i], p2 = r.uvPoints[i + 1];
      const d = distToSeg(u, v, p1[0], p1[1], p2[0], p2[1]);
      minD = Math.min(minD, d - halfW);
    }
  }
  return minD;
}

const solidItems = landmarksDefs.map(lm => ({ ...lm, ...toWorld(lm.u, lm.v) }));
const placedHouses = [];

const wallColors = [
  '#f5ede1', '#e3d5c1', '#d6c7b0', '#dfd5c6', '#5c432d',
  '#e8e1d5', '#ede5d8', '#ccbda8', '#d0c3b0', '#f2ece4'
];

const roofColors = [
  '#8c3a2b', '#3b6d8c', '#a65342', '#627c85', '#a39a85',
  '#4b6b55', '#964332', '#4a607a', '#7d3c2e', '#556b2f'
];

// Scan through village boundary in u and v
for (let v = 4038.0; v <= 4083.0; v += 1.0) {
  for (let u = -150.0; u <= 38.0; u += 1.0) {
    // 1. Buffer zone clearance (Kyar Inn buffer at v <= 4030, Nat Myaung buffer at v >= 4090)
    if (v < 4037 || v > 4083) continue;

    // 2. Road clearance: must be >= 1.6m from any road edge, and <= 32m from a road
    const roadDist = checkRoadDistance(u, v);
    if (roadDist < 1.6 || roadDist > 32.0) continue;

    // 3. Landmark clearance: at least 14.0m from any landmark
    let collidesLandmark = false;
    for (const lm of solidItems) {
      if (Math.hypot(u - lm.u, v - lm.v) < 14.0) {
        collidesLandmark = true;
        break;
      }
    }
    if (collidesLandmark) continue;

    // 4. House-to-house spacing: at least 13.0m center-to-center (spacious, non-overlapping)
    let collidesHouse = false;
    for (const h of placedHouses) {
      if (Math.hypot(u - h.u, v - h.v) < 13.0) {
        collidesHouse = true;
        break;
      }
    }
    if (collidesHouse) continue;

    const idx = placedHouses.length + 1;
    const hid = `sithar-house-${idx}`;
    const hname = `စည်သာ အိမ်အမှတ် (${idx})`;
    const w = idx % 2 === 0 ? 7.5 : 7.0;
    const d = idx % 3 === 0 ? 7.8 : 7.2;
    const wallColor = wallColors[(idx * 7) % wallColors.length];
    const roofColor = roofColors[(idx * 11) % roofColors.length];
    const isTwoStorey = idx % 3 === 0;
    const { x, z } = toWorld(u, v);

    const houseObj = {
      id: hid,
      osmId: 910000000 + idx,
      name: hname,
      u: Number(u.toFixed(2)),
      v: Number(v.toFixed(2)),
      x,
      z,
      width: w,
      depth: d,
      houseWidth: w,
      houseLength: d,
      rotation: angle,
      wallColor,
      roofColor,
      area: Number((w * d).toFixed(1)),
      isLandmark: false,
      type: 'house',
      storeys: isTwoStorey ? 2 : 1,
    };

    placedHouses.push(houseObj);
  }
}

console.log(`Generated ${placedHouses.length} spacious, non-overlapping houses for Si Thar!`);

const allBuildings = [
  ...solidItems,
  ...placedHouses,
];

const sitharHousesList = allBuildings.map(b => ({
  id: b.id,
  name: b.name,
  x: b.x,
  z: b.z,
  width: b.width,
  depth: b.depth,
  color: b.wallColor,
  roof: b.roofColor,
  rotation: b.rotation,
}));

const buildingsTs = `import type { House } from '../../types.ts';

export interface SiTharBuildingData {
  id: string;
  osmId?: string | number;
  name: string;
  u: number;
  v: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  houseWidth: number;
  houseLength: number;
  rotation: number;
  wallColor: string;
  roofColor: string;
  area: number;
  isLandmark: boolean;
  type: string;
  storeys?: number;
}

export const siTharBuildings: SiTharBuildingData[] = ${JSON.stringify(allBuildings, null, 2)};

export const siTharHouses: House[] = ${JSON.stringify(sitharHousesList, null, 2)};
`;

fs.writeFileSync('src/data/villages/sithar/sitharBuildings.ts', buildingsTs, 'utf8');
console.log('Saved src/data/villages/sithar/sitharBuildings.ts successfully!');
