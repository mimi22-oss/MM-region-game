import { area5, angle, toWorld, pitchLanes, oppositeLanes, residentialRows, farmhouse, uShweHouse, KALAY_SIGN_HOUSE_ID, kalaySignHouse, type House } from './area5.ts';
import { myotharCenterMeta, myotharCenterPOIs, myotharCenterBuildings, myotharCenterRoads } from './center/index.ts';

export {
	area5,
	angle,
	toWorld,
	pitchLanes,
	oppositeLanes,
	residentialRows,
	farmhouse,
	uShweHouse,
	KALAY_SIGN_HOUSE_ID,
	kalaySignHouse,
	type House,
	myotharCenterMeta,
	myotharCenterPOIs,
	myotharCenterBuildings,
	myotharCenterRoads,
};

/** မြို့သာရပ်ကွက် (နယ်မြေများ စုစည်းမှု) */
export const myotharWard = {
	...area5,
	id: 'myothar',
	name: 'မြို့သာရပ်ကွက် · ကလေးမြို့',
	shortName: 'မြို့သာရပ်ကွက်',
	currentArea: area5.name,
	areas: [area5, myotharCenterMeta],
	size: 8600,
	spawn: { x: farmhouse.x + 2 * Math.cos(farmhouse.rotation) + 1.8 * Math.sin(farmhouse.rotation), z: farmhouse.z - 2 * Math.sin(farmhouse.rotation) + 1.8 * Math.cos(farmhouse.rotation) },
	spawnYaw: farmhouse.rotation,
	spawnZoom: 3,
	description: 'မြို့သာရပ်ကွက် နယ်မြေ (၅) နှင့် မြို့သာရပ်ကွက် အလယ် (နယ်မြေ ၁ မှ ၇) OpenStreetMap Data စစ်စစ်များ စုစည်းမှု',
};

