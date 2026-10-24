import { toWorld } from './wards/myothar/area5.ts';

/**
 * သရက်ခြံ (Mango Orchard Trees):
 * Placed between user-specified geographic coordinates:
 * - Start: Lat 23.1613299, Lng 94.0453693 (Local u=-150.502, v=253.816)
 * - End:   Lat 23.1609846, Lng 94.0453438 (Local u=-153.112, v=292.255)
 */
export type MangoTreePlot = {
	id: string;
	u: number;
	v: number;
	x: number;
	z: number;
	radius: number;
	seed: number;
};

export const MANGO_START_GEO = { lat: 23.1613299, lng: 94.0453693 };
export const MANGO_END_GEO = { lat: 23.1609846, lng: 94.0453438 };

const p1 = { u: -153.111748, v: 292.254736 };
const p2 = { u: -150.501786, v: 253.81594 };
const TREE_COUNT = 7;

export const orchardMangoTrees: MangoTreePlot[] = Array.from(
	{ length: TREE_COUNT },
	(_, i) => {
		const t = (i + 0.5) / TREE_COUNT;
		const u = p2.u + t * (p1.u - p2.u);
		const v = p2.v + t * (p1.v - p2.v);
		const w = toWorld(u, v);
		return {
			id: `mango-tree-${i + 1}`,
			u,
			v,
			x: w.x,
			z: w.z,
			radius: 0.45,
			seed: (i * 73 + 17) % 100,
		};
	}
);

/**
 * စိုက်ခင်းအနီး သီးခြားစိုက်ပျိုးထားသော သရက်ပင် (Standalone Farmstead Mango Tree):
 * - တည်နေရာ (Location): Lat 23.1609864, Lng 94.0460003
 * - Scene X=145.761, Z=267.264 (Local U=-85.916, V=292.052)
 */
export const standaloneMangoTree: MangoTreePlot = {
	id: 'mango-tree-standalone-1',
	u: -85.916,
	v: 292.052,
	x: 145.761,
	z: 267.264,
	radius: 0.45,
	seed: 48,
};

export const mangoTrees: MangoTreePlot[] = [...orchardMangoTrees, standaloneMangoTree];
