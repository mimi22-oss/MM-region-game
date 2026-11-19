import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildMapTiles } from './mapTiles.mjs';
import { angle, toWorld, ward } from '../src/data/ward.ts';
import {
  preCanalGroveFarmTrees,
  preCanalGroveLargeTrees,
  separationFields,
  sparseFieldRoadFarmTrees,
  sparseFieldRoadLargeTrees,
  tharSiCanal,
  tharSiVillage,
} from '../src/data/villages/tharsi/index.ts';
import { unprojectMapPoint } from '../src/game/mapProjection.ts';

const geoOrigin = tharSiVillage.coordinates;
const metersPerDegLat = 111320;
const metersPerDegLon = metersPerDegLat * Math.cos((geoOrigin.lat * Math.PI) / 180);

const projection = {
  origin: [geoOrigin.lng, geoOrigin.lat],
  anchor: [tharSiVillage.x, tharSiVillage.z],
  metersPerDegree: [metersPerDegLon, metersPerDegLat],
  rotation: angle,
};

// 4 Forest Quadrants around AH1 (u = 0) × Thar Si E-W Canal (v = 658):
// - NW (10×10 = 100): North of canal, West of AH1 (between Myothar & Thar Si)
// - NE (10×10 = 100): North of canal, East of AH1 (covers Loc C: U=30.0, V=623.9)
// - SW (10×4  =  40): South of canal, West of AH1 (covers Loc A: U=-46.6, V=666.8; clear North of Thar Si Ward 1 houses)
// - SE (10×4  =  40): South of canal, East of AH1 (covers Loc B: U=+34.3, V=666.2; clear North of Thar Si East houses)
const QUADRANTS = [
  {
    id: 'nw',
    area: 'myothar-area-5',
    label: 'မြို့သာ နယ်မြေ (၅) အနောက်မြောက် သစ်တောအုပ်',
    colsU: [-24, -36.5, -49, -61.5, -74, -86.5, -99, -111.5, -124, -136.5],
    rowsV: [522, 534.5, 547, 559.5, 572, 584.5, 597, 609.5, 622, 634.5],
  },
  {
    id: 'ne',
    area: 'myothar-area-5',
    label: 'မြို့သာ နယ်မြေ (၅) အရှေ့မြောက် သစ်တောအုပ်',
    colsU: [24, 36.5, 49, 61.5, 74, 86.5, 99, 111.5, 124, 136.5],
    rowsV: [534, 546.5, 559, 571.5, 584, 596.5, 609, 621.5, 634, 646.5],
  },
  {
    id: 'sw',
    area: 'tharsi',
    label: 'သာစည်ရွာ အနောက်တောင် သစ်တောအုပ်',
    colsU: [-24, -36.5, -49, -61.5, -74, -86.5, -99, -111.5, -124, -136.5],
    rowsV: [667, 678.5, 690, 701.5],
  },
  {
    id: 'se',
    area: 'tharsi',
    label: 'သာစည်ရွာ အရှေ့တောင် သစ်တောအုပ်',
    colsU: [24, 36.5, 49, 61.5, 74, 86.5, 99, 111.5, 124, 136.5],
    rowsV: [667, 678.5, 690, 701.5],
  },
];

const invC = Math.cos(angle);
const invS = Math.sin(angle);
const toUV = (x, z) => ({ u: x * invC - z * invS, v: x * invS + z * invC });

const existingTreesUV = [
  ...preCanalGroveLargeTrees,
  ...preCanalGroveFarmTrees,
  ...sparseFieldRoadLargeTrees,
  ...sparseFieldRoadFarmTrees,
].map((t) => toUV(t.x, t.z));

const allFields = [
  ...separationFields,
  ...ward.southernFields,
  ...tharSiVillage.fields,
  ...tharSiVillage.bundedFields,
];

const placedUV = [];

function seededUnit(seedA, seedB, salt) {
  const n = Math.sin((seedA + 1) * 127.1 + (seedB + 1) * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function hasConflict(u, v) {
  // Keep clear of AH1 highway (|u| < 14.5)
  if (Math.abs(u) < 14.5) return true;
  // Keep clear of Thar Si E-W canal water (v = 658 ± 6.2)
  if (Math.abs(v - tharSiCanal.v) < 6.2) return true;
  // Keep clear of Thar Si village North lane (v >= 706.5) so no house or lane is ever under trees
  if (v > 706.5) return true;
  // Keep clear of ALL paddy fields (moved separationFields, southernFields, tharsi fields)
  for (const f of allFields) {
    if (Math.abs(u - f.u) <= f.width / 2 + 2.0 && Math.abs(v - f.v) <= f.depth / 2 + 2.0) {
      return true;
    }
  }
  // Keep clear of existing grove/roadside tree trunks
  for (const g of existingTreesUV) {
    if (Math.hypot(u - g.u, v - g.v) < 4.5) return true;
  }
  // Keep clear of previously placed forest trees so combat lanes stay wide open
  for (const p of placedUV) {
    if (Math.hypot(u - p.u, v - p.v) < 6.0) return true;
  }
  return false;
}

const canopyColors = ['#486e40', '#567e47', '#3f6439', '#4f7644'];
const sideColors = ['#62874b', '#567c44', '#4d733e'];

const features = [];
const zoneRects = [];
let minX = Infinity;
let maxX = -Infinity;
let minZ = Infinity;
let maxZ = -Infinity;

for (let qIdx = 0; qIdx < QUADRANTS.length; qIdx++) {
  const q = QUADRANTS[qIdx];
  const uMin = Math.min(...q.colsU) - 6;
  const uMax = Math.max(...q.colsU) + 6;
  const vMin = Math.min(...q.rowsV) - 5;
  const vMax = Math.max(...q.rowsV) + 5;
  const qCenterU = (uMin + uMax) / 2;
  const qCenterV = (vMin + vMax) / 2;
  const qCenterWorld = toWorld(qCenterU, qCenterV);

  zoneRects.push({
    id: q.id,
    area: q.area,
    label: q.label,
    uMin,
    uMax,
    vMin,
    vMax,
    centerU: qCenterU,
    centerV: qCenterV,
    centerX: Number(qCenterWorld.x.toFixed(3)),
    centerZ: Number(qCenterWorld.z.toFixed(3)),
    width: Number((uMax - uMin).toFixed(2)),
    depth: Number((vMax - vMin).toFixed(2)),
    rotation: angle,
    rows: q.rowsV.length,
    cols: q.colsU.length,
    count: q.rowsV.length * q.colsU.length,
  });

  for (let row = 0; row < q.rowsV.length; row++) {
    for (let col = 0; col < q.colsU.length; col++) {
      const baseU = q.colsU[col];
      const baseV = q.rowsV[row];
      const seedA = qIdx * 100 + row;
      const seedB = col;
      let u = baseU + (seededUnit(seedA, seedB, 1) - 0.5) * 2.0;
      let v = baseV + (seededUnit(seedA, seedB, 2) - 0.5) * 2.0;

      if (hasConflict(u, v)) {
        let resolved = false;
        for (const radius of [2.5, 4.0, 5.5, 7.0, 8.5]) {
          for (let k = 0; k < 16; k++) {
            const a = (k * Math.PI) / 8;
            const cu = baseU + Math.cos(a) * radius;
            const cv = baseV + Math.sin(a) * radius;
            if (!hasConflict(cu, cv)) {
              u = cu;
              v = cv;
              resolved = true;
              break;
            }
          }
          if (resolved) break;
        }
        if (!resolved) {
          throw new Error(`Unable to find clear forest slot in ${q.id} near (${baseU}, ${baseV})`);
        }
      }
      placedUV.push({ u, v });

      const world = toWorld(u, v);
      const geo = unprojectMapPoint(projection, world.x, world.z);
      minX = Math.min(minX, world.x);
      maxX = Math.max(maxX, world.x);
      minZ = Math.min(minZ, world.z);
      maxZ = Math.max(maxZ, world.z);

      const yaw = Number((seededUnit(seedA, seedB, 3) * Math.PI * 2).toFixed(4));
      const scaleY = Number((0.92 + seededUnit(seedA, seedB, 4) * 0.2).toFixed(3));
      const idx = features.length;

      features.push({
        type: 'Feature',
        id: `tharsi-zombie-forest-${q.id}-r${row}-c${col}`,
        geometry: {
          type: 'Point',
          coordinates: [Number(geo.lon.toFixed(7)), Number(geo.lat.toFixed(7))],
        },
        properties: {
          kind: 'tree',
          variant: 'large',
          quadrant: q.id,
          radius: 0.95,
          yaw,
          scaleY,
          color: canopyColors[idx % canopyColors.length],
          sideColor: sideColors[idx % sideColors.length],
          row,
          col,
          u: Number(u.toFixed(2)),
          v: Number(v.toFixed(2)),
        },
      });
    }
  }
}

const source = { type: 'FeatureCollection', features };
// Keep 2 tiles (140 trees/tile, ~40 KiB/tile << 256 KiB budget) so both tiles stay resident even on Mobile (cap = 2 tiles)
const { manifest, files } = buildMapTiles(source, {
  dataset: 'tharsi-zombie-forest',
  limits: { maxFeatures: 140 },
});

const root = `public/map/tharsi-zombie-forest/${manifest.version}`;
await mkdir(join(root, 'tiles'), { recursive: true });
for (const [relPath, text] of [...files, ['manifest.json', JSON.stringify(manifest)]]) {
  const target = join(root, relPath);
  try {
    await writeFile(target, text, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST' || (await readFile(target, 'utf8')) !== text) throw error;
  }
}

const northLabelWorld = toWorld(0, 582);
const southLabelWorld = toWorld(0, 684);
const centerWorld = toWorld(0, 622);

const datasetMeta = {
  dataset: 'tharsi-zombie-forest',
  regionId: 'tharsi-zombie-forest',
  manifest: `/map/tharsi-zombie-forest/${manifest.version}/manifest.json`,
  projection,
  treeCount: features.length,
  quadrants: zoneRects.length,
  rows: 10,
  cols: 10,
  label: {
    id: 'tharsi-zombie-forest-label',
    text: 'မြို့သာ နယ်မြေ (၅) သစ်တောအုပ်',
    subtitle: 'Myothar Area 5 Forest (North of Canal)',
    x: Number(northLabelWorld.x.toFixed(3)),
    z: Number(northLabelWorld.z.toFixed(3)),
  },
  labels: [
    {
      id: 'myothar-area-5-forest-label',
      area: 'myothar-area-5',
      text: 'မြို့သာ နယ်မြေ (၅) သစ်တောအုပ်',
      x: Number(northLabelWorld.x.toFixed(3)),
      z: Number(northLabelWorld.z.toFixed(3)),
    },
    {
      id: 'tharsi-forest-label',
      area: 'tharsi',
      text: 'သာစည်ရွာ သစ်တောအုပ်',
      x: Number(southLabelWorld.x.toFixed(3)),
      z: Number(southLabelWorld.z.toFixed(3)),
    },
  ],
  zoneRects,
  zoneBounds: {
    uMin: -142.5,
    uMax: 142.5,
    vMin: 517,
    vMax: 706.5,
    centerU: 0,
    centerV: 611.75,
    centerX: Number(centerWorld.x.toFixed(3)),
    centerZ: Number(centerWorld.z.toFixed(3)),
    width: 285,
    depth: 189.5,
    rotation: angle,
    minX: Number((minX - 8).toFixed(3)),
    maxX: Number((maxX + 8).toFixed(3)),
    minZ: Number((minZ - 8).toFixed(3)),
    maxZ: Number((maxZ + 8).toFixed(3)),
  },
};

await writeFile(
  'src/data/tharsiZombieForestDataset.json',
  JSON.stringify(datasetMeta, null, 2) + '\n',
);

console.log(
  JSON.stringify({
    dataset: manifest.dataset,
    version: manifest.version,
    tiles: manifest.tiles.length,
    features: manifest.featureCount,
    maxTileBytes: Math.max(...manifest.tiles.map((t) => t.bytes)),
    quadrants: zoneRects.map((q) => ({ id: q.id, count: q.count })),
  }),
);
