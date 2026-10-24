import { toWorld } from './wards/myothar/area5.ts';

/**
 * မန်ကျည်းပင်များ (Tamarind Trees - Tamarindus indica):
 * ၃ ပင်တန်း စိုက်ပျိုးထားသော မန်ကျည်းပင်ကြီးများနှင့် တွဲလောင်းကျနေသော မန်ကျည်းသီးတောင့်များ
 * User-specified geographic coordinates:
 * 1. Lat 23.1618078, Lng 94.0458158 -> u = -104.802, v = 200.616 (x = 67.751, z = 215.963)
 * 2. Lat 23.1618124, Lng 94.0457338 -> u = -113.195, v = 200.104 (x = 61.454, z = 221.536)
 * 3. Lat 23.1618071, Lng 94.0456500 -> u = -121.772, v = 200.694 (x = 55.806, z = 228.018)
 */
export type TamarindTreePlot = {
	id: string;
	u: number;
	v: number;
	x: number;
	z: number;
	radius: number;
	seed: number;
	lat: number;
	lng: number;
};

export const tamarindTrees: TamarindTreePlot[] = [
	{
		id: 'tamarind-tree-1',
		u: -104.802,
		v: 200.616,
		x: 67.751,
		z: 215.963,
		radius: 0.55,
		seed: 23,
		lat: 23.1618078,
		lng: 94.0458158,
	},
	{
		id: 'tamarind-tree-2',
		u: -113.195,
		v: 200.104,
		x: 61.454,
		z: 221.536,
		radius: 0.58,
		seed: 67,
		lat: 23.1618124,
		lng: 94.0457338,
	},
	{
		id: 'tamarind-tree-3',
		u: -121.772,
		v: 200.694,
		x: 55.806,
		z: 228.018,
		radius: 0.54,
		seed: 91,
		lat: 23.1618071,
		lng: 94.0456500,
	},
];
