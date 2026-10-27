import { angle } from '../../wards/myothar/area5.ts';

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
