import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildMapTiles } from './mapTiles.mjs';
import {
  KANBALE_CUSTOM_BUILDINGS,
  kanbaleBuildings,
} from '../src/data/villages/kanbale/kanbaleBuildings.ts';
import { kanbaleRoads, kanbaleRoadPlots } from '../src/data/villages/kanbale/kanbaleRoads.ts';
import {
  KANBALE_GEO_ORIGIN,
  KANBALE_LOCAL_ANCHOR,
  METERS_PER_DEG_LAT,
  METERS_PER_DEG_LON,
  toWorld,
  worldToGeo,
} from '../src/data/villages/kanbale/kanbaleData.ts';
import { angle } from '../src/data/wards/myothar/area5.ts';
import { projectMapPoint } from '../src/game/mapProjection.ts';
import { kanbaleBoundaryBounds } from '../src/data/villages/kanbale/kanbaleBoundary.ts';

function toGeoPoint(x, z) {
  const g = worldToGeo(x, z);
  return [Number(g.lon.toFixed(8)), Number(g.lat.toFixed(8))];
}

function buildingFeature(b) {
  const rawRing = (b.polygonPoints && b.polygonPoints.length >= 3
    ? b.polygonPoints
    : [
        [b.x - b.width / 2, b.z - b.depth / 2],
        [b.x + b.width / 2, b.z - b.depth / 2],
        [b.x + b.width / 2, b.z + b.depth / 2],
        [b.x - b.width / 2, b.z + b.depth / 2],
      ]
  ).map(([px, pz]) => toGeoPoint(px, pz));

  if (
    rawRing.length > 0 &&
    (rawRing[0][0] !== rawRing[rawRing.length - 1][0] ||
      rawRing[0][1] !== rawRing[rawRing.length - 1][1])
  ) {
    rawRing.push([...rawRing[0]]);
  }
  while (rawRing.length < 4) rawRing.push([...rawRing[0]]);

  const customComponent = KANBALE_CUSTOM_BUILDINGS[b.id] ?? null;
  const assetId =
    customComponent === 'KanbaleSchool'
      ? 'building:village-school'
      : customComponent === 'KanbaleFarmhouse'
        ? 'building:farmhouse'
        : 'building:sithar-house';

  return {
    type: 'Feature',
    id: b.id,
    geometry: { type: 'Polygon', coordinates: [rawRing] },
    properties: {
      kind: 'building',
      assetId,
      osmId: b.osmId,
      osmType: b.osmType,
      name: b.name,
      area: b.area,
      width: b.width,
      depth: b.depth,
      height: b.height,
      houseLength: b.houseLength,
      houseWidth: b.houseWidth,
      wallHeight: b.wallHeight,
      roofHeight: b.roofHeight,
      wallColor: b.wallColor,
      roofColor: b.roofColor,
      rotation: b.rotation,
      anchorGeo: toGeoPoint(b.x, b.z),
      customComponent,
      privateHome: !customComponent,
    },
  };
}

function roadFeature(r) {
  return {
    type: 'Feature',
    id: r.id,
    geometry: {
      type: 'LineString',
      coordinates: r.worldPoints.map(([x, z]) => toGeoPoint(x, z)),
    },
    properties: {
      kind: 'road',
      name: r.name,
      highway: r.highway,
      width: r.width,
    },
  };
}

function roadPlotFeature(rp) {
  return {
    type: 'Feature',
    id: rp.id,
    geometry: {
      type: 'Point',
      coordinates: toGeoPoint(rp.x, rp.z),
    },
    properties: {
      kind: 'road-plot',
      name: rp.name,
      width: rp.width,
      depth: rp.depth,
      rotation: rp.rotation,
      main: rp.main,
    },
  };
}

const residentialTrees = kanbaleBuildings.slice(0, 140).map((b, i) => ({
  id: `kanbale-tree-${i + 1}`,
  x: b.x + (i % 2 === 0 ? b.width / 2 + 1.8 : -b.width / 2 - 1.8),
  z: b.z + (i % 3 === 0 ? b.depth / 2 + 1.8 : -b.depth / 2 - 1.8),
  radius: 0.6,
  variant: 'canopy',
}));

const shadeTrees = kanbaleRoads.slice(0, 30).map((r, i) => {
  const pt = r.worldPoints[Math.floor(r.worldPoints.length / 2)];
  return {
    id: `kanbale-large-tree-${i + 1}`,
    x: pt[0] + (i % 2 === 0 ? 4.2 : -4.2),
    z: pt[1] + (i % 2 === 0 ? 4.2 : -4.2),
    radius: 1.1,
    variant: 'large',
  };
});

function treeFeature(t) {
  return {
    type: 'Feature',
    id: t.id,
    geometry: {
      type: 'Point',
      coordinates: toGeoPoint(t.x, t.z),
    },
    properties: {
      kind: 'tree',
      assetId: t.variant === 'large' ? 'nature:shade-tree' : 'nature:canopy-tree',
      variant: t.variant,
      radius: t.radius,
    },
  };
}

const allTrees = [...residentialTrees, ...shadeTrees];
const features = [
  ...kanbaleBuildings.map(buildingFeature),
  ...kanbaleRoads.map(roadFeature),
  ...kanbaleRoadPlots.map(roadPlotFeature),
  ...allTrees.map(treeFeature),
];

const { manifest, files } = buildMapTiles(
  { type: 'FeatureCollection', features },
  {
    dataset: 'kanbale',
    regionId: 'kanbale',
    schemaVersion: 2,
    limits: { maxFeatures: 128, maxBytes: 196608, maxCoordinates: 4096 },
  },
);

const root = `public/map/kanbale/${manifest.version}`;
await mkdir(join(root, 'tiles'), { recursive: true });
for (const [path, text] of [...files, ['manifest.json', JSON.stringify(manifest)]]) {
  const target = join(root, path);
  try {
    await writeFile(target, text, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST' || (await readFile(target, 'utf8')) !== text) throw error;
  }
}

const anchor = toWorld(KANBALE_LOCAL_ANCHOR.u, KANBALE_LOCAL_ANCHOR.v);
const projection = {
  origin: [KANBALE_GEO_ORIGIN.lon, KANBALE_GEO_ORIGIN.lat],
  anchor: [anchor.x, anchor.z],
  metersPerDegree: [METERS_PER_DEG_LON, METERS_PER_DEG_LAT],
  rotation: angle,
};

const blockCells = new Map();
const CELL_M = 80;
for (const b of kanbaleBuildings) {
  const gx = Math.floor(b.x / CELL_M);
  const gz = Math.floor(b.z / CELL_M);
  const key = `${gx},${gz}`;
  let cell = blockCells.get(key);
  if (!cell) {
    cell = { minX: b.x, maxX: b.x, minZ: b.z, maxZ: b.z };
    blockCells.set(key, cell);
  } else {
    cell.minX = Math.min(cell.minX, b.x);
    cell.maxX = Math.max(cell.maxX, b.x);
    cell.minZ = Math.min(cell.minZ, b.z);
    cell.maxZ = Math.max(cell.maxZ, b.z);
  }
}

const overviewPlots = [...blockCells.entries()].map(([key, c]) => ({
  id: `kb-ov-${key}`,
  x: Number(((c.minX + c.maxX) / 2).toFixed(1)),
  z: Number(((c.minZ + c.maxZ) / 2).toFixed(1)),
  width: Number(Math.max(18, c.maxX - c.minX + 8).toFixed(1)),
  depth: Number(Math.max(18, c.maxZ - c.minZ + 8).toFixed(1)),
  rotation: 0,
  color: '#8f6b56',
}));

const datasetMeta = {
  schemaVersion: manifest.schemaVersion,
  dataset: manifest.dataset,
  regionId: 'kanbale',
  version: manifest.version,
  manifest: `/map/kanbale/${manifest.version}/manifest.json`,
  counts: {
    buildings: kanbaleBuildings.length,
    roads: kanbaleRoads.length,
    roadPlots: kanbaleRoadPlots.length,
    trees: allTrees.length,
    totalFeatures: manifest.featureCount,
    tiles: manifest.tiles.length,
  },
  bounds: kanbaleBoundaryBounds,
  projection,
  overviewPlots,
};

await writeFile('src/data/kanbaleDataset.json', `${JSON.stringify(datasetMeta, null, 2)}\n`);
console.log(
  JSON.stringify({
    dataset: manifest.dataset,
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
    tiles: manifest.tiles.length,
    features: manifest.featureCount,
    maxTileBytes: Math.max(0, ...manifest.tiles.map((t) => t.bytes)),
  }),
);
