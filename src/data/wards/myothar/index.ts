import { area5, angle, toWorld, pitchLanes, oppositeLanes, residentialRows, farmhouse, type House } from './area5.ts';

export { area5, angle, toWorld, pitchLanes, oppositeLanes, residentialRows, farmhouse, type House };

/** မြို့သာရပ်ကွက် (နယ်မြေများ စုစည်းမှု) */
export const myotharWard = {
 ...area5,
 id: 'myothar',
 name: 'မြို့သာရပ်ကွက် · ကလေးမြို့',
 shortName: 'မြို့သာရပ်ကွက်',
 currentArea: area5.name,
 areas: [area5],
 size: 8600,
 spawn: {x:farmhouse.x+2*Math.cos(farmhouse.rotation)+1.8*Math.sin(farmhouse.rotation),z:farmhouse.z-2*Math.sin(farmhouse.rotation)+1.8*Math.cos(farmhouse.rotation)},
 spawnYaw: farmhouse.rotation,
 spawnZoom: 3,
 description: 'ပေးထားသော မြေပုံကို မှီငြမ်းထားသော ခန့်မှန်း 3D ပုံစံ',
};
