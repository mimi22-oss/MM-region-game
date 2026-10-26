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
 * - အဆောက်အအုံနှင့် ခြံဝန်းပေါင်း 923 ခု (Area 5 Style Compound Fences & Footprints)
 * - လမ်းကွန်ရက် 27 ခု (AH1 အာရှလမ်းမကြီးနှင့် ရပ်ကွက်တွင်းလမ်းများ)
 * - အဓိက အထင်ကရနေရာ 10 ခု (ကျောင်းတိုက်၊ စက်သုံးဆီဆိုင်များ၊ စားသောက်ဆိုင်၊ ဝပ်ရှော့၊ အရောင်းဆိုင်များ)
 */

export const MYOTHAR_CENTER_GEO_ORIGIN = {
  lon: 94.068471,
  lat: 23.1685,
};

export const MYOTHAR_CENTER_LOCAL_ANCHOR = {
  u: 0.0,
  v: -740.0,
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
  description: 'ကလေးမြို့နယ်၊ မြို့သာရပ်ကွက် နယ်မြေ (၅) ရွှေမြန်မာစက်သုံးဆီဆိုင် တောင်ဘက်နှင့် ကံပုလဲရွာ အနောက်ဘက်ခြမ်းတွင် ဆက်စပ်တည်ရှိသော မြို့သာရပ်ကွက် အလယ်ခေါင် (နယ်မြေ ၁ မှ ၇ အထိ) ခြံဝန်းနှင့် အဆောက်အအုံ 923 လုံးနှင့် လမ်းကွန်ရက်',
  coordinates: { lat: 23.168500, lng: 94.068471 },
  spawn: toWorld(0.0, -740.0),
  bounds: {
    minU: -507.3,
    maxU: 530.8,
    minV: -1148.1,
    maxV: -216.2,
    minX: -863.7,
    maxX: -231.6,
    minZ: -1151.2,
    maxZ: 127.1,
  },
};

/**
 * ကံပုလဲ source polygon မှ မြို့သာရပ်ကွက် အလယ်ခေါင်သို့ ပြောင်းရွှေ့ထားသော သစ်ပင်များ
 */
export const myotharCenterTrees = [
  { id: 'mc-moved-tree-1', x: -199.485, z: -341.044, radius: 0.8 },
  { id: 'mc-moved-tree-2', x: -231.690, z: -318.909, radius: 0.8 },
  { id: 'mc-moved-tree-3', x: -230.940, z: -317.474, radius: 0.8 },
  { id: 'mc-moved-tree-4', x: -231.760, z: -310.394, radius: 0.8 },
  { id: 'mc-moved-tree-5', x: -230.720, z: -289.684, radius: 0.8 },
  { id: 'mc-moved-tree-6', x: -225.880, z: -286.549, radius: 0.8 },
  { id: 'mc-moved-tree-7', x: -201.220, z: -353.469, radius: 0.8 },
  { id: 'mc-moved-tree-8', x: -203.645, z: -360.284, radius: 0.8 },
  { id: 'mc-moved-tree-9', x: -230.345, z: -352.074, radius: 0.8 },
];

