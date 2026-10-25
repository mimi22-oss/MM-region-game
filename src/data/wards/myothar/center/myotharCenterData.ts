import { angle } from '../area5.ts';

/**
 * မြို့သာရပ်ကွက် အလယ်ခေါင် (နယ်မြေ ၁ မှ ၇ အထိ)
 * Myothar Ward Center (Areas 1 to 7) · Kalay Township
 *
 * တည်နေရာ:
 * - မြို့သာရပ်ကွက် နယ်မြေ (၅) ၏ ရွှေမြန်မာ စက်သုံးဆီဆိုင် တောင်ဘက်
 * - ကံပုလဲရွာ ၏ အနောက်ဘက်ခြမ်းတွင် ဆက်စပ်တည်ရှိသော မြို့သာရပ်ကွက် အလယ်ခေါင်
 *
 * OpenStreetMap (OSM) စစ်စစ် ဒေတာများ:
 * - အဆောက်အအုံနှင့် ခြံဝန်းပေါင်း 1036 ခု (Area 5 Style Compound Fences & Footprints)
 * - လမ်းကွန်ရက် 27 ခု (AH1 အာရှလမ်းမကြီးနှင့် ရပ်ကွက်တွင်းလမ်းများ)
 * - အဓိက အထင်ကရနေရာ 10 ခု (ကျောင်းတိုက်၊ စက်သုံးဆီဆိုင်များ၊ စားသောက်ဆိုင်၊ ဝပ်ရှော့၊ အရောင်းဆိုင်များ)
 */

export const MYOTHAR_CENTER_GEO_ORIGIN = {
  lon: 94.064442,
  lat: 23.163868,
};

export const MYOTHAR_CENTER_LOCAL_ANCHOR = {
  u: 160.0,
  v: -252.0,
};

export const METERS_PER_DEG_LAT = 111320.0;
export const METERS_PER_DEG_LON = 102348.5;

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

/**
 * GeoJSON (lon, lat) သြဒိနိတ်မှ Local (u, v) သို့ ပြောင်းလဲခြင်း
 */
export function geoToLocalUV(lon: number, lat: number): { u: number; v: number } {
  return {
    u: MYOTHAR_CENTER_LOCAL_ANCHOR.u + (lon - MYOTHAR_CENTER_GEO_ORIGIN.lon) * METERS_PER_DEG_LON,
    v: MYOTHAR_CENTER_LOCAL_ANCHOR.v - (lat - MYOTHAR_CENTER_GEO_ORIGIN.lat) * METERS_PER_DEG_LAT,
  };
}

/**
 * Local (u, v) မှ GeoJSON (lon, lat) သို့ ပြောင်းလဲခြင်း
 */
export function localUVToGeo(u: number, v: number): { lon: number; lat: number } {
  return {
    lon: MYOTHAR_CENTER_GEO_ORIGIN.lon + (u - MYOTHAR_CENTER_LOCAL_ANCHOR.u) / METERS_PER_DEG_LON,
    lat: MYOTHAR_CENTER_GEO_ORIGIN.lat - (v - MYOTHAR_CENTER_LOCAL_ANCHOR.v) / METERS_PER_DEG_LAT,
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

export const myotharCenterMeta = {
  id: 'myothar-center',
  name: 'မြို့သာရပ်ကွက် အလယ်ခေါင် (နယ်မြေ ၁ မှ ၇)',
  shortName: 'မြို့သာ အလယ်ခေါင်',
  englishName: 'Myothar Ward Center (Areas 1-7)',
  township: 'ကလေးမြို့နယ်',
  region: 'စစ်ကိုင်းတိုင်းဒေသကြီး',
  description: 'ကလေးမြို့နယ်၊ မြို့သာရပ်ကွက် နယ်မြေ (၅) ရွှေမြန်မာစက်သုံးဆီဆိုင် တောင်ဘက်နှင့် ကံပုလဲရွာ အနောက်ဘက်ခြမ်းတွင် ဆက်စပ်တည်ရှိသော မြို့သာရပ်ကွက် အလယ်ခေါင် (နယ်မြေ ၁ မှ ၇ အထိ) ခြံဝန်းနှင့် အဆောက်အအုံ 1036 လုံးနှင့် လမ်းကွန်ရက်',
  coordinates: { lat: 23.167062, lng: 94.067266 },
  spawn: toWorld(449.0, -607.6),
  bounds: {
    minU: 65.1,
    maxU: 1103.2,
    minV: -1175.7,
    maxV: -243.8,
    minX: -478.5,
    maxX: 153.6,
    minZ: -1575.4,
    maxZ: -297.2,
  },
};
