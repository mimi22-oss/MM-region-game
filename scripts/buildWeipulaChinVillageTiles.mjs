import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { area5 } from '../src/data/wards/myothar/area5.ts';
import { buildMapTiles } from './mapTiles.mjs';
import { unprojectMapPoint } from '../src/game/mapProjection.ts';
import {
  WEIPULA_CHIN_COLS_PER_TIER,
  WEIPULA_CHIN_TIER_COUNT,
  WEIPULA_CHIN_VILLAGE_ANCHOR_UV,
  WEIPULA_CHIN_VILLAGE_ANCHOR_WORLD,
  WEIPULA_CHIN_VILLAGE_PROJECTION,
  buildWeipulaChinVillageHouses,
} from '../src/game/weipulaChinVillageLayout.ts';

const peaks = [...area5.mountains, ...area5.weipula.peaks];
const houses = buildWeipulaChinVillageHouses(peaks);
const proj = WEIPULA_CHIN_VILLAGE_PROJECTION;

function orientedFootprintPolygonGeo(x, z, width, depth, rotY) {
  const hw = width / 2;
  const hd = depth / 2;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const corners = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
    [-hw, -hd],
  ];
  return corners.map(([lx, lz]) => {
    const wx = x + lx * c + lz * s;
    const wz = z - lx * s + lz * c;
    const g = unprojectMapPoint(proj, wx, wz);
    return [Number(g.lon.toFixed(7)), Number(g.lat.toFixed(7))];
  });
}

const features = houses.map(h => {
  const anchorGeo = unprojectMapPoint(proj, h.x, h.z);
  return {
    type: 'Feature',
    id: h.id,
    geometry: {
      type: 'Polygon',
      coordinates: [orientedFootprintPolygonGeo(h.x, h.z, h.width, h.depth, h.rotation)],
    },
    properties: {
      kind: 'chin-terraced-house',
      name: h.title,
      tier: h.tier,
      col: h.col,
      u: h.u,
      v: h.v,
      baseY: h.baseY,
      width: h.width,
      depth: h.depth,
      height: h.height,
      rotation: h.rotation,
      wallColor: h.wallColor,
      roofColor: h.roofColor,
      hornbillScale: h.hornbillScale,
      isChiefHouse: h.isChiefHouse,
      isClinic: h.isClinic,
      terraceWidth: h.terraceWidth,
      terraceDepth: h.terraceDepth,
      anchorGeo: [Number(anchorGeo.lon.toFixed(7)), Number(anchorGeo.lat.toFixed(7))],
      privateHome: !h.isClinic,
    },
  };
});

const collection = {
  type: 'FeatureCollection',
  features,
};

const { manifest, files } = buildMapTiles(collection, {
  dataset: 'weipula-chin-village',
  regionId: 'weipula-chin-village',
  schemaVersion: 2,
  limits: { maxFeatures: 64 },
});

const datasetDir = resolve('public/map/weipula-chin-village', manifest.version);
await rm(datasetDir, { recursive: true, force: true });
await mkdir(join(datasetDir, 'tiles'), { recursive: true });
for (const [url, text] of files) {
  await writeFile(join(datasetDir, url), text);
}
await writeFile(join(datasetDir, 'manifest.json'), JSON.stringify(manifest));

// Compute overall village world bounds & center
let minX = Infinity;
let maxX = -Infinity;
let minZ = Infinity;
let maxZ = -Infinity;
let sumX = 0;
let sumZ = 0;
for (const h of houses) {
  if (h.x < minX) minX = h.x;
  if (h.x > maxX) maxX = h.x;
  if (h.z < minZ) minZ = h.z;
  if (h.z > maxZ) maxZ = h.z;
  sumX += h.x;
  sumZ += h.z;
}

const metadata = {
  dataset: 'weipula-chin-village',
  regionId: 'weipula-chin-village',
  manifest: `/map/weipula-chin-village/${manifest.version}/manifest.json`,
  projection: proj,
  houseCount: houses.length,
  tiers: WEIPULA_CHIN_TIER_COUNT,
  colsPerTier: WEIPULA_CHIN_COLS_PER_TIER,
  anchorUV: WEIPULA_CHIN_VILLAGE_ANCHOR_UV,
  anchorWorld: {
    x: Number(WEIPULA_CHIN_VILLAGE_ANCHOR_WORLD.x.toFixed(3)),
    z: Number(WEIPULA_CHIN_VILLAGE_ANCHOR_WORLD.z.toFixed(3)),
  },
  label: {
    id: 'weipula-chin-village-label',
    text: 'မဟာဝေပုလ္လ ချင်းလှေကားထစ်ရွာ',
    subtitle: 'တောင်ခါးပန်း ချင်းလှေကားထစ်ရွာ · အိမ်ခြေ ၁၀၀ · အောက်ချင်းငှက်ခေါင်မိုးအိမ်များ',
    x: Number((sumX / houses.length).toFixed(3)),
    z: Number((sumZ / houses.length).toFixed(3)),
  },
  bounds: {
    minX: Number(minX.toFixed(2)),
    maxX: Number(maxX.toFixed(2)),
    minZ: Number(minZ.toFixed(2)),
    maxZ: Number(maxZ.toFixed(2)),
  },
};

await writeFile(
  resolve('src/data/weipulaChinVillageDataset.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      dataset: manifest.dataset,
      version: manifest.version,
      houses: manifest.featureCount,
      tiles: manifest.tiles.length,
      maxTileBytes: Math.max(0, ...manifest.tiles.map(t => t.bytes)),
      outputDir: datasetDir,
    },
    null,
    2,
  ),
);
