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

// 1. Grid Configuration (3 Rows x 5 Columns = 15 Rectangular Blocks)
// Spacious layout inspired by Myothar Ward 5 and Thar Yar Gone village (မြို့သာရပ်ကွက် ၅ နှင့် သာယာကုန်းရွာ အကွက်ပုံစံ)
//
// North-South Span (v):
//   Kyar Inn separation fields: v = 4027.5 (depth 8: 4023.5 to 4031.5)
//   Si Thar village EW Lanes:
//     Lane 1 (South): v = 4035.5
//     Lane 2: v = 4052.0
//     Lane 3: v = 4069.0
//     Lane 4 (North): v = 4085.5
//   Nat Myaung separation fields: v = 4095.0 (depth 14: 4088.0 to 4102.0)
//   Nat Myaung village starts at v = 4110.0
//
// East-West Span (u):
//   Col 0 Center: u = -32.0 (span: -48.7 to -15.3)
//   Col 1 Center: u = -72.0 (span: -88.7 to -55.3)
//   Col 2 Center (Center Block): u = -112.0 (span: -128.7 to -95.3)
//   Col 3 Center: u = -152.0 (span: -168.7 to -135.3)
//   Col 4 Center: u = -192.0 (span: -208.7 to -175.3)
//
// NS Cross Lanes:
//   Lane 0: u = -13.0 (connecting to AH1 via connector)
//   Lane 1: u = -52.0
//   Lane 2: u = -92.0
//   Lane 3: u = -132.0
//   Lane 4: u = -172.0
//   Lane 5: u = -212.0

const rowCentersV = [4043.5, 4060.5, 4077.5]; // 3 Row Centers (Tier 0: South, Tier 1: Center, Tier 2: North)
const colCentersU = [-32.0, -72.0, -112.0, -152.0, -192.0]; // 5 Column Centers (Col 0, 1, 2: Center, 3, 4)

// Each Block is 36.0m wide (along u) x 16.0m deep (along v)
// Inside each block: 2 spacious rows of houses x 3 houses per row = 6 houses per block
// Spacing along u between house centers: 12.0m (wide spacing like Myothar Ward 5)
// Spacing along v between house row centers: 8.0m (clean separation with middle access lane)
const uOffsets = [-12.0, 0.0, 12.0]; // 3 houses per row
const vOffsets = [-4.0, 4.0]; // 2 rows of houses per block

// Each individual house compound (အိမ်ဝန်းအကျယ်တစ်ခု):
// Compound width: 9.4m (< 12.0m spacing -> 2.6m clear gap between compounds along u)
// Compound depth: 6.0m (< 8.0m spacing -> 2.0m clear gap between compounds along v)
// House building width: 6.8m to 7.4m, depth: 4.4m to 4.8m (Authentic spacious Myanmar village houses)
// ZERO OVERLAP! Every house has its own individual wire-mesh fence (သံဇကာခြံပတ်ခြာလည်အကာ).

// Colors for authentic village roofs & walls
const wallColors = [
  '#f5ede1', '#e3d5c1', '#d6c7b0', '#dfd5c6', '#5c432d',
  '#e8e1d5', '#ede5d8', '#ccbda8', '#d0c3b0', '#f2ece4'
];

const roofColors = [
  '#8c3a2b', '#3b6d8c', '#a65342', '#627c85', '#a39a85',
  '#4b6b55', '#964332', '#4a607a', '#7d3c2e', '#556b2f'
];

// Landmark Definitions for Center Block (Row 1, Col 2: u center -112.0, v center 4060.5)
// 6 Landmarks distributed evenly across 2 rows x 3 columns in the Center Block:
const landmarksMap = {
  // Row 0 of Center Block (v = 4056.5)
  'r0_c0': {
    id: 'sithar-admin-office',
    name: 'စည်သာ ကျေးရွာ အုပ်ချုပ်ရေးမှူးရုံး',
    width: 7.2,
    depth: 4.8,
    compoundWidth: 9.6,
    compoundDepth: 6.2,
    wallColor: '#ece6d8',
    roofColor: '#3b6d8c',
    type: 'office',
    storeys: 2,
    isLandmark: true,
  },
  'r0_c1': {
    id: 'sithar-library',
    name: 'စည်သာ ကျေးရွာ စာကြည့်တိုက် (Sithar Library)',
    width: 7.0,
    depth: 4.6,
    compoundWidth: 9.6,
    compoundDepth: 6.2,
    wallColor: '#fef3c7',
    roofColor: '#059669',
    type: 'school',
    storeys: 1,
    isLandmark: true,
  },
  'r0_c2': {
    id: 'sithar-baptist-church',
    name: 'စည်သာ နှစ်ခြင်းအသင်းတော် ဘုရားကျောင်း (Sitha Baptist Church)',
    width: 7.4,
    depth: 5.0,
    compoundWidth: 9.6,
    compoundDepth: 6.2,
    wallColor: '#f8fafc',
    roofColor: '#1e40af',
    type: 'church',
    storeys: 2,
    isLandmark: true,
  },
  // Row 1 of Center Block (v = 4064.5)
  'r1_c0': {
    id: 'sithar-pentecostal-church',
    name: 'စည်သာ ပင်တေကုတ္တေ ဘုရားကျောင်း (United Pentecostal Church of Sitha)',
    width: 7.2,
    depth: 4.8,
    compoundWidth: 9.6,
    compoundDepth: 6.2,
    wallColor: '#f1f5f9',
    roofColor: '#dc2626',
    type: 'church',
    storeys: 2,
    isLandmark: true,
  },
  'r1_c1': {
    id: 'sithar-monastery-center',
    name: 'စည်သာ ဘုန်းတော်ကြီးကျောင်း (ရန်ကင်းဓမ္မသုခ ရွာလယ်ကျောင်း)',
    width: 7.4,
    depth: 5.0,
    compoundWidth: 9.6,
    compoundDepth: 6.2,
    wallColor: '#d97706',
    roofColor: '#78350f',
    type: 'monastery',
    storeys: 1,
    isLandmark: true,
  },
  'r1_c2': {
    id: 'sithar-yanking-monastery-main',
    name: 'ရန်ကင်းဓမ္မသုခ ကျောင်းတိုက်ကြီး (Sithar Yanking Monastery)',
    width: 7.6,
    depth: 5.2,
    compoundWidth: 9.6,
    compoundDepth: 6.2,
    wallColor: '#ca8a04',
    roofColor: '#713f12',
    type: 'monastery',
    storeys: 2,
    isLandmark: true,
  },
};

const allBuildings = [];
let houseCount = 0;

for (let r = 0; r < 3; r++) {
  const baseV = rowCentersV[r];
  for (let c = 0; c < 5; c++) {
    const baseU = colCentersU[c];
    const blockIdx = r * 5 + c + 1;
    const isCenterBlock = (r === 1 && c === 2);

    for (let rowInBlock = 0; rowInBlock < vOffsets.length; rowInBlock++) {
      const v = Number((baseV + vOffsets[rowInBlock]).toFixed(2));
      for (let colInBlock = 0; colInBlock < uOffsets.length; colInBlock++) {
        const u = Number((baseU + uOffsets[colInBlock]).toFixed(2));
        const key = `r${rowInBlock}_c${colInBlock}`;

        if (isCenterBlock && landmarksMap[key]) {
          const lm = landmarksMap[key];
          const { x, z } = toWorld(u, v);
          allBuildings.push({
            id: lm.id,
            osmId: 910000000 + allBuildings.length + 1,
            name: lm.name,
            u,
            v,
            x,
            z,
            width: lm.width,
            depth: lm.depth,
            houseWidth: lm.width,
            houseLength: lm.depth,
            compoundWidth: lm.compoundWidth || 9.6,
            compoundDepth: lm.compoundDepth || 6.2,
            rotation: angle,
            wallColor: lm.wallColor,
            roofColor: lm.roofColor,
            area: Number((lm.width * lm.depth).toFixed(1)),
            isLandmark: true,
            type: lm.type,
            storeys: lm.storeys,
          });
        } else {
          houseCount++;
          const hid = `sithar-h-b${blockIdx}-${rowInBlock * uOffsets.length + colInBlock + 1}`;
          const hname = `စည်သာ အကွက်(${blockIdx}) အိမ် (${rowInBlock * uOffsets.length + colInBlock + 1})`;
          const w = Number((6.8 + ((blockIdx + colInBlock) % 3) * 0.3).toFixed(1));
          const d = Number((4.5 + ((blockIdx + rowInBlock) % 2) * 0.3).toFixed(1));
          const wallColor = wallColors[(blockIdx * 7 + rowInBlock * 3 + colInBlock) % wallColors.length];
          const roofColor = roofColors[(blockIdx * 11 + rowInBlock * 5 + colInBlock) % roofColors.length];
          const isTwoStorey = (houseCount % 3 === 0);
          const { x, z } = toWorld(u, v);

          allBuildings.push({
            id: hid,
            osmId: 910000000 + allBuildings.length + 1,
            name: hname,
            u,
            v,
            x,
            z,
            width: w,
            depth: d,
            houseWidth: w,
            houseLength: d,
            compoundWidth: 9.4,
            compoundDepth: 6.0,
            rotation: angle,
            wallColor,
            roofColor,
            area: Number((w * d).toFixed(1)),
            isLandmark: false,
            type: 'house',
            storeys: isTwoStorey ? 2 : 1,
          });
        }
      }
    }
  }
}

// Add East Landmark: Railway Station (u = 22, v = 4060.5)
const stationCoord = toWorld(22.0, 4060.5);
allBuildings.push({
  id: 'sithar-train-station',
  osmId: 910000999,
  name: 'စည်သာ ဘူတာရုံ (Si Thar Railway Station)',
  u: 22.0,
  v: 4060.5,
  x: stationCoord.x,
  z: stationCoord.z,
  width: 14.0,
  depth: 6.5,
  houseWidth: 14.0,
  houseLength: 6.5,
  compoundWidth: 18.0,
  compoundDepth: 10.0,
  rotation: angle,
  wallColor: '#e2e8f0',
  roofColor: '#b91c1c',
  area: 91.0,
  isLandmark: true,
  type: 'station',
  storeys: 1,
});

console.log(`Generated ${allBuildings.length} buildings (7 landmarks + ${allBuildings.length - 7} spacious residential houses in 15 blocks)!`);

// 2. Generate Full Road Network (AH1 Trunk + 4 Continuous EW Lanes + 6 Continuous NS Cross Lanes + 1 AH1 Connector + 15 Block Access Roads = 27 Roads)
const roadsData = [];
const roadPlots = [];

// AH1 Asian Highway Trunk
const ah1Geo = [
  [94.02392, 23.0520],
  [94.02392, 23.0460],
];
const ah1UV = [
  [0, 4022],
  [0, 4098],
];
const ah1World = ah1UV.map(p => {
  const w = toWorld(p[0], p[1]);
  return [w.x, w.z];
});

roadsData.push({
  id: 'sithar-road-0',
  osmId: 284203707,
  name: 'Asian Highway',
  highway: 'trunk',
  width: 12,
  geoPoints: ah1Geo,
  uvPoints: ah1UV,
  worldPoints: ah1World,
});

roadPlots.push({
  id: 'sithar-main-road',
  name: 'AH1 အာရှလမ်းမကြီး (စည်သာရွာပိုင်း)',
  ...toWorld(0, 4060.5),
  width: 12,
  depth: 76,
  rotation: angle,
  main: true,
});

// 4 Continuous East-West Lanes bounding the 3 Tiers of Blocks (v = 4035.5 to 4085.5)
const ewLanesV = [4035.5, 4052.0, 4069.0, 4085.5];
const uMin = -212.0;
const uMax = -13.0;
const ewWidth = Math.abs(uMax - uMin); // 199m
const ewMidU = (uMin + uMax) / 2; // -112.5

for (let i = 0; i < ewLanesV.length; i++) {
  const v = ewLanesV[i];
  const uvPts = [[uMin, v], [uMax, v]];
  const wPts = uvPts.map(p => {
    const w = toWorld(p[0], p[1]);
    return [w.x, w.z];
  });

  roadsData.push({
    id: `sithar-ew-lane-${i + 1}`,
    osmId: 920000000 + i + 1,
    name: `စည်သာ အရှေ့-အနောက် လမ်းသွယ် (${i + 1})`,
    highway: 'residential',
    width: 3.2,
    geoPoints: [],
    uvPoints: uvPts,
    worldPoints: wPts,
  });

  roadPlots.push({
    id: `sithar-ew-plot-${i + 1}`,
    name: `စည်သာ လမ်းသွယ် ${i + 1}`,
    ...toWorld(ewMidU, v),
    width: ewWidth,
    depth: 3.2,
    rotation: angle,
    main: false,
  });
}

// 6 Continuous North-South Cross Lanes bounding the 5 Columns of Blocks
const nsLanesU = [-13.0, -52.0, -92.0, -132.0, -172.0, -212.0];
const vMin = 4035.5;
const vMax = 4085.5;
const nsDepth = Math.abs(vMax - vMin); // 50.0m
const nsMidV = (vMin + vMax) / 2; // 4060.5

for (let j = 0; j < nsLanesU.length; j++) {
  const u = nsLanesU[j];
  const uvPts = [[u, vMin], [u, vMax]];
  const wPts = uvPts.map(p => {
    const w = toWorld(p[0], p[1]);
    return [w.x, w.z];
  });

  roadsData.push({
    id: `sithar-ns-lane-${j + 1}`,
    osmId: 920000010 + j + 1,
    name: `စည်သာ မြောက်-တောင် လမ်းသွယ် (${j + 1})`,
    highway: 'residential',
    width: 3.6,
    geoPoints: [],
    uvPoints: uvPts,
    worldPoints: wPts,
  });

  roadPlots.push({
    id: `sithar-ns-plot-${j + 1}`,
    name: `စည်သာ အတွင်းလမ်း ${j + 1}`,
    ...toWorld(u, nsMidV),
    width: 3.6,
    depth: nsDepth,
    rotation: angle,
    main: false,
  });
}

// AH1 connector road
const ah1ConnectorUV = [[-13.0, 4060.5], [0, 4060.5]];
roadsData.push({
  id: 'sithar-ah1-connector',
  osmId: 920000099,
  name: 'စည်သာ AH1 ဆက်သွယ်လမ်း',
  highway: 'residential',
  width: 4.0,
  geoPoints: [],
  uvPoints: ah1ConnectorUV,
  worldPoints: ah1ConnectorUV.map(p => {
    const w = toWorld(p[0], p[1]);
    return [w.x, w.z];
  }),
});

roadPlots.push({
  id: 'sithar-ah1-connector-plot',
  name: 'စည်သာ AH1 ဆက်သွယ်လမ်း',
  ...toWorld(-6.5, 4060.5),
  width: 13.0,
  depth: 4.0,
  rotation: angle,
  main: false,
});

// 15 Block Access Roads (one central access road per block)
for (let b = 0; b < 15; b++) {
  const r = Math.floor(b / 5);
  const c = b % 5;
  const bu = colCentersU[c];
  const bv = rowCentersV[r];

  const uvPts = [[bu - 14.0, bv], [bu + 14.0, bv]];
  const wPts = uvPts.map(p => {
    const w = toWorld(p[0], p[1]);
    return [w.x, w.z];
  });

  roadsData.push({
    id: `sithar-block-road-${b + 1}`,
    osmId: 920000020 + b + 1,
    name: `စည်သာ အကွက် (${b + 1}) လမ်းကြား`,
    highway: 'unclassified',
    width: 2.0,
    geoPoints: [],
    uvPoints: uvPts,
    worldPoints: wPts,
  });

  roadPlots.push({
    id: `sithar-block-plot-${b + 1}`,
    name: `စည်သာ အကွက် ${b + 1} လမ်းကြား`,
    ...toWorld(bu, bv),
    width: 28.0,
    depth: 2.0,
    rotation: angle,
    main: false,
  });
}

console.log(`Generated ${roadsData.length} roads total (fulfilling >= 20 road network requirement)!`);

// 3. Write out to sitharBuildings.ts
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
  compoundWidth?: number;
  compoundDepth?: number;
  rotation: number;
  wallColor: string;
  roofColor: string;
  area: number;
  isLandmark: boolean;
  type: string;
  storeys?: number;
}

export const siTharBuildings: SiTharBuildingData[] = ${JSON.stringify(allBuildings, null, 2)};

export const siTharHouses: House[] = siTharBuildings.map((b) => ({
  id: b.id,
  name: b.name,
  x: b.x,
  z: b.z,
  width: b.houseWidth || b.width,
  depth: b.houseLength || b.depth,
  color: b.wallColor,
  roof: b.roofColor,
  rotation: b.rotation,
}));
`;

fs.writeFileSync('src/data/villages/sithar/sitharBuildings.ts', buildingsTs, 'utf-8');
console.log('Successfully wrote src/data/villages/sithar/sitharBuildings.ts!');

// 4. Write out to sitharRoads.ts
const roadsTs = `import type { RoadPlot } from '../../types.ts';

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

export const siTharRoads: SiTharRoadData[] = ${JSON.stringify(roadsData, null, 2)};

export const siTharRoadPlots: RoadPlot[] = ${JSON.stringify(roadPlots, null, 2)};
`;

fs.writeFileSync('src/data/villages/sithar/sitharRoads.ts', roadsTs, 'utf-8');
console.log('Successfully wrote src/data/villages/sithar/sitharRoads.ts!');
