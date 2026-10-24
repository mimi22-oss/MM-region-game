/**
 * မော်တော်ဆိုင်ကယ် တည်နေရာနှင့် အချက်အလက်များ (Motorcycle Data - motorcycle.png)
 * - တည်နေရာ (Location): နယ်မြေ (၅) · အနောက်ဘက်ရပ်ကွက်
 * - Latitude (approx): 23.1612262, Longitude (approx): 94.0462532
 * - Scene X/Z (m): 145.190, 230.083
 * - Local U/V (m): -60.028, 265.358
 * - Facing: East (79.1 deg), yaw (rad): -0.594620
 */
export const MOTORCYCLE_NAME = 'မော်တော်ဆိုင်ကယ် (Motorcycle)';
export const MOTORCYCLE_X = 145.190;
export const MOTORCYCLE_Z = 230.083;
export const MOTORCYCLE_U = -60.028;
export const MOTORCYCLE_V = 265.358;
export const MOTORCYCLE_YAW = -0.594620; // rad (East 79.1 deg)
export const MOTORCYCLE_BEARING = 79.1;
export const MOTORCYCLE_RADIUS = 0.55; // collision blocking radius in meters

export const motorcycleData = {
	id: 'motorcycle-area5-west',
	name: MOTORCYCLE_NAME,
	x: MOTORCYCLE_X,
	z: MOTORCYCLE_Z,
	u: MOTORCYCLE_U,
	v: MOTORCYCLE_V,
	rotation: MOTORCYCLE_YAW,
	bearing: MOTORCYCLE_BEARING,
	radius: MOTORCYCLE_RADIUS,
};
