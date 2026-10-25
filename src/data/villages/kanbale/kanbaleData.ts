import { angle } from '../../wards/myothar/area5.ts';

/**
 * ကံပုလဲရွာ (Kanbale Village · Kalay Township)
 * OpenStreetMap (OSM) နှင့် ကိုယ်ပိုင် Boundary GeoJSON Data ကို အခြေခံထားသော တည်နေရာ အချက်အလက်များ
 */
export const KANBALE_GEO_ORIGIN = {
  lon: 94.064442,
  lat: 23.163868,
};

export const KANBALE_LOCAL_ANCHOR = {
  u: 160.0,
  v: -252.0,
};

export const METERS_PER_DEG_LAT = 111320.0;
export const METERS_PER_DEG_LON = 111320.0 * Math.cos((23.160308 * Math.PI) / 180); // ~102354.72 m/deg

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

/**
 * GeoJSON (lon, lat) သြဒိနိတ်မှ Local (u, v) သို့ ပြောင်းလဲခြင်း
 */
export function geoToLocalUV(lon: number, lat: number): { u: number; v: number } {
  return {
    u: KANBALE_LOCAL_ANCHOR.u + (lon - KANBALE_GEO_ORIGIN.lon) * METERS_PER_DEG_LON,
    v: KANBALE_LOCAL_ANCHOR.v - (lat - KANBALE_GEO_ORIGIN.lat) * METERS_PER_DEG_LAT,
  };
}

/**
 * Local (u, v) မှ GeoJSON (lon, lat) သို့ ပြောင်းလဲခြင်း
 */
export function localUVToGeo(u: number, v: number): { lon: number; lat: number } {
  return {
    lon: KANBALE_GEO_ORIGIN.lon + (u - KANBALE_LOCAL_ANCHOR.u) / METERS_PER_DEG_LON,
    lat: KANBALE_GEO_ORIGIN.lat - (v - KANBALE_LOCAL_ANCHOR.v) / METERS_PER_DEG_LAT,
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

export const kanbaleMeta = {
  id: 'kanbale',
  name: 'ကံပုလဲရွာ',
  englishName: 'Kanbale',
  township: 'ကလေးမြို့နယ်',
  region: 'စစ်ကိုင်းတိုင်းဒေသကြီး',
  villageTract: 'ကံပုလဲကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
  description: 'ကလေးမြို့နယ်၊ မြို့သာရပ်ကွက် နယ်မြေ (၅) အရှေ့တောင်ဘက်ရှိ OpenStreetMap Data စစ်စစ်ဖြင့် တည်ဆောက်ထားသော ကံပုလဲရွာ (အဆောက်အအုံ ၆၈၀ လုံးနှင့် လမ်းကွန်ရက်)',
  coordinates: { lat: 23.1588218, lng: 94.0754088 },
  spawn: toWorld(652.6, -3.94), // Directly at custom farmhouse way/403027623
};
