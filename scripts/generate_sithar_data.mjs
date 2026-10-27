import fs from 'fs';
import path from 'path';

const angle = Math.PI / 4;
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

function toWorld(u, v) {
  return {
    x: Number((u * cosA + v * sinA).toFixed(2)),
    z: Number((-u * sinA + v * cosA).toFixed(2)),
  };
}

function toLocalUV(x, z) {
  return {
    u: Number((x * cosA - z * sinA).toFixed(2)),
    v: Number((x * sinA + z * cosA).toFixed(2)),
  };
}

const SITHAR_GEO_ORIGIN = {
  lon: 94.02392,
  lat: 23.0489597,
};

const SITHAR_LOCAL_ANCHOR = {
  u: 0.0,
  v: 4061.0,
};

const SITHAR_SCALE = 0.135;
const METERS_PER_DEG_LAT = 111320.0 * SITHAR_SCALE;
const METERS_PER_DEG_LON = 102450.0 * SITHAR_SCALE;

function geoToLocalUV(lon, lat) {
  return {
    u: Number((SITHAR_LOCAL_ANCHOR.u + (lon - SITHAR_GEO_ORIGIN.lon) * METERS_PER_DEG_LON).toFixed(2)),
    v: Number((SITHAR_LOCAL_ANCHOR.v - (lat - SITHAR_GEO_ORIGIN.lat) * METERS_PER_DEG_LAT).toFixed(2)),
  };
}

function localUVToGeo(u, v) {
  return {
    lon: Number((SITHAR_GEO_ORIGIN.lon + (u - SITHAR_LOCAL_ANCHOR.u) / METERS_PER_DEG_LON).toFixed(7)),
    lat: Number((SITHAR_GEO_ORIGIN.lat - (v - SITHAR_LOCAL_ANCHOR.v) / METERS_PER_DEG_LAT).toFixed(7)),
  };
}

const osm = JSON.parse(fs.readFileSync('map/si-thar-osm-with-custom-labels.geojson', 'utf8'));
const boundaryGeo = JSON.parse(fs.readFileSync('map/si-thar-boundary.geojson', 'utf8'));

console.log('Generating Si Thar data...');

// 1. Boundary Points
const boundaryCoords = boundaryGeo.features[0].geometry.coordinates[0];
const boundaryGeoPoints = boundaryCoords.map(([lon, lat]) => [Number(lon.toFixed(7)), Number(lat.toFixed(7))]);
const boundaryUVPoints = boundaryCoords.map(([lon, lat]) => {
  const { u, v } = geoToLocalUV(lon, lat);
  return [Number(u.toFixed(2)), Number(v.toFixed(2))];
});
const boundaryWorldPoints = boundaryUVPoints.map(([u, v]) => {
  const { x, z } = toWorld(u, v);
  return [x, z];
});

let bMinU = Infinity, bMaxU = -Infinity, bMinV = Infinity, bMaxV = -Infinity;
let bMinX = Infinity, bMaxX = -Infinity, bMinZ = Infinity, bMaxZ = -Infinity;

for (const [u, v] of boundaryUVPoints) {
  if (u < bMinU) bMinU = u;
  if (u > bMaxU) bMaxU = u;
  if (v < bMinV) bMinV = v;
  if (v > bMaxV) bMaxV = v;
}

for (const [x, z] of boundaryWorldPoints) {
  if (x < bMinX) bMinX = x;
  if (x > bMaxX) bMaxX = x;
  if (z < bMinZ) bMinZ = z;
  if (z > bMaxZ) bMaxZ = z;
}

// 2. Roads
const lineFeatures = osm.features.filter(f => f.geometry.type === 'LineString');

const roads = [];
lineFeatures.forEach((f, idx) => {
  const p = f.properties || {};
  if (p.name === 'Si Thar' && f.geometry.coordinates.length === 55) return;

  const isAh1 = p.ref === 'NH41' || p.name === 'Asian Highway';
  const coords = f.geometry.coordinates;

  const geoPoints = coords.map(([lon, lat]) => [Number(lon.toFixed(7)), Number(lat.toFixed(7))]);
  let uvPoints = coords.map(([lon, lat]) => {
    const { u, v } = geoToLocalUV(lon, lat);
    return [Number(u.toFixed(2)), Number(v.toFixed(2))];
  });

  if (isAh1) {
    uvPoints = uvPoints
      .filter(([u, v]) => v >= 4015 && v <= 4105)
      .map(([u, v]) => [0.0, v]);
    if (uvPoints.length < 2) {
      uvPoints = [[0, 4015], [0, 4061], [0, 4105]];
    }
  }

  const worldPoints = uvPoints.map(([u, v]) => {
    const { x, z } = toWorld(u, v);
    return [x, z];
  });

  roads.push({
    id: `sithar-road-${idx}`,
    osmId: p.osm_id || idx,
    name: p.name || (isAh1 ? 'Asian Highway (AH1 / NH41)' : `စည်သာ ရွာတွင်းလမ်း ${idx}`),
    highway: isAh1 ? 'trunk' : (p.highway || 'residential'),
    width: isAh1 ? 12.0 : (p.highway === 'unclassified' ? 5.5 : 6.5),
    geoPoints,
    uvPoints,
    worldPoints,
  });
});

// 3. Landmarks
const pointFeatures = osm.features.filter(f => f.geometry.type === 'Point');
const trainStationPoly = osm.features.find(f => f.properties && f.properties.building === 'train_station');

const landmarks = [];

const villageNode = pointFeatures.find(f => f.properties && f.properties.name === 'စည်သာ');
if (villageNode) {
  const [lon, lat] = villageNode.geometry.coordinates;
  const { u, v } = geoToLocalUV(lon, lat);
  landmarks.push({
    id: 'sithar-admin-office',
    name: 'စည်သာ ကျေးရွာ အုပ်ချုပ်ရေးမှူးရုံး',
    u: Number(u.toFixed(2)),
    v: Number(v.toFixed(2)),
    width: 12.0,
    depth: 8.0,
    houseWidth: 12.0,
    houseLength: 8.0,
    rotation: angle,
    wallColor: '#ece6d8',
    roofColor: '#3b6d8c',
    area: 96.0,
    isLandmark: true,
    type: 'office',
    storeys: 2,
    ...toWorld(u, v),
  });
}

const baptistChurch = pointFeatures.find(f => f.properties && f.properties.name && f.properties.name.includes('BAPTIST'));
if (baptistChurch) {
  const [lon, lat] = baptistChurch.geometry.coordinates;
  const { u, v } = geoToLocalUV(lon, lat);
  landmarks.push({
    id: 'sithar-baptist-church',
    name: 'စည်သာ နှစ်ခြင်းအသင်းတော် ဘုရားကျောင်း (Sitha Baptist Church)',
    u: Number(u.toFixed(2)),
    v: Number(v.toFixed(2)),
    width: 15.0,
    depth: 9.0,
    houseWidth: 15.0,
    houseLength: 9.0,
    rotation: angle + Math.PI / 2,
    wallColor: '#f8fafc',
    roofColor: '#1e40af',
    area: 135.0,
    isLandmark: true,
    type: 'church',
    storeys: 2,
    ...toWorld(u, v),
  });
}

const library = pointFeatures.find(f => f.properties && f.properties.name && f.properties.name.includes('Library'));
if (library) {
  const [lon, lat] = library.geometry.coordinates;
  const { u, v } = geoToLocalUV(lon, lat);
  landmarks.push({
    id: 'sithar-library',
    name: 'စည်သာ ကျေးရွာ စာကြည့်တိုက် (Sithar Library)',
    u: Number(u.toFixed(2)),
    v: Number(v.toFixed(2)),
    width: 10.5,
    depth: 7.5,
    houseWidth: 10.5,
    houseLength: 7.5,
    rotation: angle,
    wallColor: '#fef3c7',
    roofColor: '#059669',
    area: 78.75,
    isLandmark: true,
    type: 'school',
    storeys: 1,
    ...toWorld(u, v),
  });
}

const pentecostal = pointFeatures.find(f => f.properties && f.properties.name && f.properties.name.includes('PENTICOSTAL'));
if (pentecostal) {
  const [lon, lat] = pentecostal.geometry.coordinates;
  const { u, v } = geoToLocalUV(lon, lat);
  landmarks.push({
    id: 'sithar-pentecostal-church',
    name: 'စည်သာ ပင်တေကုတ္တေ ဘုရားကျောင်း (United Pentecostal Church of Sitha)',
    u: Number(u.toFixed(2)),
    v: Number(v.toFixed(2)),
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
    ...toWorld(u, v),
  });
}

const monasteryNearCenter = pointFeatures.find(f => f.properties && f.properties.name && f.properties.name.includes('စည်သာ ဘုန်းကြီးကျောင်း'));
if (monasteryNearCenter) {
  const [lon, lat] = monasteryNearCenter.geometry.coordinates;
  const { u, v } = geoToLocalUV(lon, lat);
  landmarks.push({
    id: 'sithar-monastery-center',
    name: 'စည်သာ ဘုန်းတော်ကြီးကျောင်း (ရန်ကင်းဓမ္မသုခ ရွာလယ်ကျောင်း)',
    u: Number(u.toFixed(2)),
    v: Number(v.toFixed(2)),
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
    ...toWorld(u, v),
  });
}

const monasteryMain = pointFeatures.find(f => f.properties && f.properties.name && f.properties.name.includes('ရန်ကင်းဓမ္မသုခ ကျောင်းတိုက်'));
if (monasteryMain) {
  const [lon, lat] = monasteryMain.geometry.coordinates;
  const { u, v } = geoToLocalUV(lon, lat);
  landmarks.push({
    id: 'sithar-yanking-monastery-main',
    name: 'ရန်ကင်းဓမ္မသုခ ကျောင်းတိုက်ကြီး (Sithar Yanking Monastery)',
    u: Number(u.toFixed(2)),
    v: Number(v.toFixed(2)),
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
    ...toWorld(u, v),
  });
}

if (trainStationPoly) {
  const coords = trainStationPoly.geometry.coordinates[0];
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const cLon = lons.reduce((a, b) => a + b) / lons.length;
  const cLat = lats.reduce((a, b) => a + b) / lats.length;
  const { u, v } = geoToLocalUV(cLon, cLat);
  landmarks.push({
    id: 'sithar-train-station',
    name: 'စည်သာ ဘူတာရုံ (Si Thar Railway Station)',
    u: Number(u.toFixed(2)),
    v: Number(v.toFixed(2)),
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
    ...toWorld(u, v),
  });
}

// 4. Residential Houses with SAT Spacing Guard
const polyFeatures = osm.features.filter(f => f.geometry.type === 'Polygon' && f.properties && f.properties.building !== 'train_station');

const wallColors = [
  '#f5ede1', '#e3d5c1', '#d6c7b0', '#dfd5c6', '#5c432d',
  '#e8e1d5', '#ede5d8', '#ccbda8', '#d0c3b0', '#f2ece4'
];

const roofColors = [
  '#8c3a2b', '#3b6d8c', '#a65342', '#627c85', '#a39a85',
  '#4b6b55', '#964332', '#4a607a', '#7d3c2e', '#556b2f'
];

const placedHouses = [];
const solidItems = [...landmarks];

for (let idx = 0; idx < polyFeatures.length; idx++) {
  const p = polyFeatures[idx];
  const coords = p.geometry.coordinates[0];
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const cLon = lons.reduce((a, b) => a + b) / lons.length;
  const cLat = lats.reduce((a, b) => a + b) / lats.length;
  let { u, v } = geoToLocalUV(cLon, cLat);

  // AH1 Setback Guard
  if (Math.abs(u) < 11.5) {
    u = u < 0 ? -11.8 : 11.8;
  }

  const w = idx % 3 === 0 ? 6.5 : (idx % 2 === 0 ? 6.0 : 5.6);
  const d = idx % 2 === 0 ? 5.4 : 5.0;

  // SAT Overlap Prevention
  let collides = false;
  for (const s of solidItems) {
    if (Math.hypot(u - s.u, v - s.v) < 4.2) {
      collides = true;
      break;
    }
  }
  if (collides) continue;

  const hid = `sithar-house-${placedHouses.length + 1}`;
  const hname = p.properties.name || `စည်သာ လူနေအိမ် (${placedHouses.length + 1})`;
  const wallColor = wallColors[(placedHouses.length * 7) % wallColors.length];
  const roofColor = roofColors[(placedHouses.length * 11) % roofColors.length];
  const { x, z } = toWorld(u, v);

  const entry = {
    id: hid,
    osmId: p.properties.osm_id || placedHouses.length + 1,
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
    storeys: placedHouses.length % 4 === 0 ? 2 : 1,
  };

  placedHouses.push(entry);
  solidItems.push(entry);
}

console.log(`Placed non-overlapping houses: ${placedHouses.length}`);

// 5. Authored village-gap fields live in separationFields.ts and are preserved.

const outDir = path.resolve('src/data/villages/sithar');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 6. Write sitharData.ts
const sitharDataTs = `import { angle } from '../../wards/myothar/area5.ts';

/**
 * စည်သာကျေးရွာ (Si Thar Village · Kalay Township)
 * OpenStreetMap (OSM) နှင့် ကိုယ်ပိုင် Boundary GeoJSON Data ကို အခြေခံထားသော တည်နေရာ အချက်အလက်များ
 *
 * တည်နေရာ: ထောက်ကြန့်/ကြာအင်းရွာ (v ~ 3850 .. 4013) နှင့် နတ်မြောင်းရွာ (v ~ 4110 .. 4340) ကြား AH1 လမ်းမကြီးတစ်လျှောက်
 * Anchor: u = 0, v = 4061
 */
export const SITHAR_GEO_ORIGIN = {
  lon: 94.02392,
  lat: 23.0489597,
};

export const SITHAR_LOCAL_ANCHOR = {
  u: 0.0,
  v: 4061.0,
};

export const SITHAR_SCALE = 0.135;
export const METERS_PER_DEG_LAT = 111320.0 * SITHAR_SCALE;
export const METERS_PER_DEG_LON = 102450.0 * SITHAR_SCALE;

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

/**
 * GeoJSON (lon, lat) သြဒိနိတ်မှ Local (u, v) သို့ ပြောင်းလဲခြင်း
 */
export function geoToLocalUV(lon: number, lat: number): { u: number; v: number } {
  return {
    u: SITHAR_LOCAL_ANCHOR.u + (lon - SITHAR_GEO_ORIGIN.lon) * METERS_PER_DEG_LON,
    v: SITHAR_LOCAL_ANCHOR.v - (lat - SITHAR_GEO_ORIGIN.lat) * METERS_PER_DEG_LAT,
  };
}

/**
 * Local (u, v) မှ GeoJSON (lon, lat) သို့ ပြောင်းလဲခြင်း
 */
export function localUVToGeo(u: number, v: number): { lon: number; lat: number } {
  return {
    lon: SITHAR_GEO_ORIGIN.lon + (u - SITHAR_LOCAL_ANCHOR.u) / METERS_PER_DEG_LON,
    lat: SITHAR_GEO_ORIGIN.lat - (v - SITHAR_LOCAL_ANCHOR.v) / METERS_PER_DEG_LAT,
  };
}

/**
 * Local (u, v) မှ World (x, z) သို့ ပြောင်းလဲခြင်း
 */
export function toWorld(u: number, v: number): { x: number; z: number } {
  return {
    x: u * cosA + v * sinA,
    z: -u * sinA + v * cosA,
  };
}

/**
 * World (x, z) မှ Local (u, v) သို့ ပြောင်းလဲခြင်း
 */
export function toLocalUV(x: number, z: number): { u: number; v: number } {
  return {
    u: x * cosA - z * sinA,
    v: x * sinA + z * cosA,
  };
}

/**
 * GeoJSON (lon, lat) မှ World (x, z) သို့ တိုက်ရိုက်ပြောင်းလဲခြင်း
 */
export function geoToWorld(lon: number, lat: number): { x: number; z: number } {
  const { u, v } = geoToLocalUV(lon, lat);
  return toWorld(u, v);
}

/**
 * World (x, z) မှ GeoJSON (lon, lat) သို့ ပြောင်းလဲခြင်း
 */
export function worldToGeo(x: number, z: number): { lon: number; lat: number } {
  const { u, v } = toLocalUV(x, z);
  return localUVToGeo(u, v);
}

export const sitharMeta = {
  id: 'sithar',
  name: 'စည်သာရွာ',
  englishName: 'Si Thar',
  township: 'ကလေးမြို့နယ်',
  region: 'စစ်ကိုင်းတိုင်းဒေသကြီး',
  villageTract: 'စည်သာကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
  description: 'ကလေးမြို့နယ်၊ ထောက်ကြန့်/ကြာအင်းရွာနှင့် နတ်မြောင်းရွာကြား၊ AH1 အာရှလမ်းမကြီး မိုင်တိုင် (NH41) ဘေးရှိ စည်သာကျေးရွာ',
  coordinates: { lat: 23.0489597, lng: 94.0204163 },
  spawn: toWorld(0, 4061),
};
`;

fs.writeFileSync(path.join(outDir, 'sitharData.ts'), sitharDataTs, 'utf8');
console.log('Wrote sitharData.ts');

// 7. Write sitharBoundary.ts
const sitharBoundaryTs = `export const sitharBoundaryGeoPoints: [number, number][] = ${JSON.stringify(boundaryGeoPoints, null, 2)};

export const sitharBoundaryUVPoints: [number, number][] = ${JSON.stringify(boundaryUVPoints, null, 2)};

export const sitharBoundaryWorldPoints: [number, number][] = ${JSON.stringify(boundaryWorldPoints, null, 2)};

export const sitharBoundaryBounds = {
  minU: ${bMinU.toFixed(2)},
  maxU: ${bMaxU.toFixed(2)},
  minV: ${bMinV.toFixed(2)},
  maxV: ${bMaxV.toFixed(2)},
  minX: ${bMinX.toFixed(2)},
  maxX: ${bMaxX.toFixed(2)},
  minZ: ${bMinZ.toFixed(2)},
  maxZ: ${bMaxZ.toFixed(2)},
};

/**
 * 2D SVG Path for MiniMap and World Plan representation
 */
export const sitharBoundarySvgPath = 'M ' + sitharBoundaryWorldPoints.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ') + ' Z';

/**
 * Point-in-polygon check for Si Thar boundary (Ray Casting Algorithm)
 */
export function isPointInsideSiThar(x: number, z: number): boolean {
  if (x < sitharBoundaryBounds.minX || x > sitharBoundaryBounds.maxX || z < sitharBoundaryBounds.minZ || z > sitharBoundaryBounds.maxZ) {
    return false;
  }
  const pts = sitharBoundaryWorldPoints;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1];
    const xj = pts[j][0], zj = pts[j][1];
    const intersect = ((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
`;

fs.writeFileSync(path.join(outDir, 'sitharBoundary.ts'), sitharBoundaryTs, 'utf8');
console.log('Wrote sitharBoundary.ts');

// 8. Write sitharBuildings.ts
const allBuildings = [...landmarks, ...placedHouses];
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

const sitharBuildingsTs = `import type { House } from '../../types.ts';

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

fs.writeFileSync(path.join(outDir, 'sitharBuildings.ts'), sitharBuildingsTs, 'utf8');
console.log('Wrote sitharBuildings.ts');

// 9. Write sitharRoads.ts
const lanesV = [4026, 4035, 4044, 4053, 4062, 4071, 4080, 4089, 4098];
const ah1RoadPlot = {
  id: 'sithar-ah1-highway',
  name: 'အာရှလမ်းမကြီး (AH1)',
  ...toWorld(0, 4061),
  width: 12.0,
  depth: 100.0,
  rotation: angle,
  main: true,
};

const sideLanePlots = lanesV.map((v, i) => ({
  id: `sithar-lane-${i + 1}`,
  name: `စည်သာ လမ်းသွယ် (${i + 1})`,
  ...toWorld(-75, v),
  width: 180.0,
  depth: 5.0,
  rotation: angle,
  main: false,
}));

const sitharRoadPlots = [ah1RoadPlot, ...sideLanePlots];

const sitharRoadsTs = `import type { RoadPlot } from '../../types.ts';

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

export const siTharRoads: SiTharRoadData[] = ${JSON.stringify(roads, null, 2)};

export const siTharRoadPlots: RoadPlot[] = ${JSON.stringify(sitharRoadPlots, null, 2)};
`;

fs.writeFileSync(path.join(outDir, 'sitharRoads.ts'), sitharRoadsTs, 'utf8');
console.log('Wrote sitharRoads.ts');

// 10. Write index.ts
const sitharIndexTs = `import type { VillageMeta, TreePlot, FieldPlot } from '../../types.ts';
import { sitharMeta, toWorld } from './sitharData.ts';
import { siTharBuildings, siTharHouses } from './sitharBuildings.ts';
import { siTharRoads, siTharRoadPlots } from './sitharRoads.ts';
import {
  sitharBoundaryWorldPoints,
  sitharBoundaryUVPoints,
  sitharBoundaryGeoPoints,
  sitharBoundarySvgPath,
  sitharBoundaryBounds,
  isPointInsideSiThar,
} from './sitharBoundary.ts';

export * from './sitharData.ts';
export * from './sitharBoundary.ts';
export * from './sitharBuildings.ts';
export * from './sitharRoads.ts';

import {siTharSeparationFields} from './separationFields.ts';
export * from './separationFields.ts';

const trees: TreePlot[] = siTharBuildings.slice(0, 40).map((b, i) => ({
  id: \`sithar-tree-\${i + 1}\`,
  x: b.x + (i % 2 === 0 ? b.width / 2 + 1.8 : -b.width / 2 - 1.8),
  z: b.z + (i % 3 === 0 ? b.depth / 2 + 1.8 : -b.depth / 2 - 1.8),
  radius: 0.6,
}));

/** စည်သာရွာ လမ်းဘေး အရိပ်ရ သစ်ပင်ကြီးများ */
const largeTrees: TreePlot[] = [
  ...[4025, 4045, 4065, 4085, 4100].flatMap((v, i) => [
    { id: \`sithar-ah1-tree-w-\${i}\`, ...toWorld(-8.0, v), radius: 1.1 },
    { id: \`sithar-ah1-tree-e-\${i}\`, ...toWorld(8.0, v), radius: 1.1 },
  ]),
  { id: 'sithar-church-banyan-tree', ...toWorld(-32, 4075), radius: 1.6 },
  { id: 'sithar-monastery-peepal-tree', ...toWorld(-145, 4035), radius: 1.7 },
];

const farmTrees: TreePlot[] = [];
const bundedFields: FieldPlot[] = [];

/**
 * စည်သာကျေးရွာ (Si Thar Village Meta Data)
 * System အားလုံး (kalayVillages, detectLocation, collision, 2D Minimap) နှင့် ချိတ်ဆက်ရန်
 */
export const siTharVillage: VillageMeta = {
  id: sitharMeta.id,
  name: sitharMeta.name,
  englishName: sitharMeta.englishName,
  villageTract: sitharMeta.villageTract,
  description: sitharMeta.description,
  coordinates: sitharMeta.coordinates,
  x: sitharMeta.spawn.x,
  z: sitharMeta.spawn.z,
  labelPos: toWorld(0, 4061),
  separationFields: siTharSeparationFields,
  houses: siTharHouses,
  roads: siTharRoadPlots,
  fields: siTharSeparationFields,
  bundedFields,
  ponds: [],
  trees,
  largeTrees,
  farmTrees,
};
`;

fs.writeFileSync(path.join(outDir, 'index.ts'), sitharIndexTs, 'utf8');
console.log('Wrote index.ts');
console.log('Si Thar data generation completed successfully!');
