import { angle } from '../../wards/myothar/area5.ts';

/**
 * နတ်မြောင်းကျေးရွာ (Nat Myaung Village · Kalay Township)
 * OpenStreetMap (OSM) နှင့် ကိုယ်ပိုင် Boundary GeoJSON Data ကို အခြေခံထားသော တည်နေရာ အချက်အလက်များ
 *
 * တည်နေရာ: ကြာအင်းရွာ (v ~ 3850 .. 4120) နှင့် ဝေပုလ္လတောင်ကြီး (v >= 4365) ကြား AH1 လမ်းမကြီးတစ်လျှောက်
 * Anchor: u = 0, v = 4220
 */
export const NATMYAUNG_GEO_ORIGIN = {
  lon: 94.0385,
  lat: 23.0085,
};

export const NATMYAUNG_LOCAL_ANCHOR = {
  u: 0.0,
  v: 4220.0,
};

// 1 deg lat = 111320m, 1 deg lon ~ 102450m scaled by 0.18 to fit village corridor (240m span)
export const NATMYAUNG_SCALE = 0.18;
export const METERS_PER_DEG_LAT = 111320.0 * NATMYAUNG_SCALE;
export const METERS_PER_DEG_LON = 102450.0 * NATMYAUNG_SCALE;

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

/**
 * GeoJSON (lon, lat) သြဒိနိတ်မှ Local (u, v) သို့ ပြောင်းလဲခြင်း
 */
export function geoToLocalUV(lon: number, lat: number): { u: number; v: number } {
  return {
    u: NATMYAUNG_LOCAL_ANCHOR.u + (lon - NATMYAUNG_GEO_ORIGIN.lon) * METERS_PER_DEG_LON,
    v: NATMYAUNG_LOCAL_ANCHOR.v - (lat - NATMYAUNG_GEO_ORIGIN.lat) * METERS_PER_DEG_LAT,
  };
}

/**
 * Local (u, v) မှ GeoJSON (lon, lat) သို့ ပြောင်းလဲခြင်း
 */
export function localUVToGeo(u: number, v: number): { lon: number; lat: number } {
  return {
    lon: NATMYAUNG_GEO_ORIGIN.lon + (u - NATMYAUNG_LOCAL_ANCHOR.u) / METERS_PER_DEG_LON,
    lat: NATMYAUNG_GEO_ORIGIN.lat - (v - NATMYAUNG_LOCAL_ANCHOR.v) / METERS_PER_DEG_LAT,
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

export const natmyaungMeta = {
  id: 'natmyaung',
  name: 'နတ်မြောင်းရွာ',
  englishName: 'Nat Myaung',
  township: 'ကလေးမြို့နယ်',
  region: 'စစ်ကိုင်းတိုင်းဒေသကြီး',
  villageTract: 'နတ်မြောင်းကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
  description: 'ကလေးမြို့နယ်၊ ကြာအင်းရွာနှင့် ဝေပုလ္လတောင်ကြား၊ AH1 အာရှလမ်းမကြီး မိုင်တိုင် (NH41) ဘေးရှိ နတ်မြောင်းကျေးရွာ',
  coordinates: { lat: 23.0094395, lng: 94.0414276 },
  spawn: toWorld(0, 4220),
};
