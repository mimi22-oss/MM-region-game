/**
 * မြို့သာ နယ်မြေ (၅) · အနောက်ဘက်ရပ်ကွက် လက်နှိပ်ဘုံဘိုင်ရှည်နှင့် ရေမြောင်း
 * (Waist-height Cast-Iron Hand Water Pump with Long Spout & Drainage Canal Outflow):
 * - တည်နေရာ (Pump Location): Scene X=159.065, Z=208.966 (Local U=-35.286, V=260.237)
 * - နှုတ်သီးခေါင်းပေါက် အဆုံး (Spout End Basin): Scene X=151.967, Z=216.093 (Local U=-45.344, V=260.257)
 * - နှုတ်သီးခေါင်းပေါက် အရှည် (Spout Length): ~10.059 meters
 * - ရေမြောင်း စီးဆင်းရာနေရာ (Drain Canal Outflow Point): Scene X=146.809, Z=219.768 (Local U=-51.590, V=259.209)
 * - ရေမြောင်း အရှည် (Drain Channel Length): ~6.333 meters
 * - မျက်နှာမူ (Facing): West (270.0° / 273.2°)
 * - အမြင့် (Height): လူတစ်ယောက်၏ ခါးလောက် အမြင့် (Waist-height: ~1.05m tall)
 */

export const HAND_PUMP_X = 159.065;
export const HAND_PUMP_Z = 208.966;

export const SPOUT_END_X = 151.967;
export const SPOUT_END_Z = 216.093;

export const SPOUT_DX = SPOUT_END_X - HAND_PUMP_X; // -7.098
export const SPOUT_DZ = SPOUT_END_Z - HAND_PUMP_Z; // +7.127
export const SPOUT_LENGTH = Math.hypot(SPOUT_DX, SPOUT_DZ); // 10.0586 meters

// Three.js Y-rotation so local +Z points directly from (HAND_PUMP_X, HAND_PUMP_Z) to (SPOUT_END_X, SPOUT_END_Z)
export const HAND_PUMP_ROT = Math.atan2(SPOUT_DX, SPOUT_DZ); // -0.7833595 rad (-44.88°)
export const HAND_PUMP_BEARING = 270.0; // Facing West

export const HAND_PUMP_RADIUS = 0.45;
export const SPOUT_RADIUS = 0.045;
export const PUMP_WAIST_HEIGHT = 1.05; // Waist-height of person (1.05m)

// ရေမြောင်း စီးဆင်းရာ မြောင်းအဆုံး / တူးမြောင်းအစွန်း (Drain Channel to Canal Bank)
export const DRAIN_END_X = 146.809;
export const DRAIN_END_Z = 219.768;

export const DRAIN_DX = DRAIN_END_X - SPOUT_END_X; // -5.158
export const DRAIN_DZ = DRAIN_END_Z - SPOUT_END_Z; // +3.675
export const DRAIN_LENGTH = Math.hypot(DRAIN_DX, DRAIN_DZ); // 6.333 meters
export const DRAIN_ROT = Math.atan2(DRAIN_DX, DRAIN_DZ); // -0.952 rad (-54.55°)
