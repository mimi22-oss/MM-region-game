import { memo } from 'react';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { myotharCenterBuildings } from '../data/wards/myothar/center/myotharCenterBuildings';
import { myotharCenterRoads } from '../data/wards/myothar/center/myotharCenterRoads';
import { kanbaleRoads } from '../data/villages/kanbale/kanbaleRoads';
import { kanbaleDrainSvgPath } from '../data/villages/kanbale/kanbaleDrain';
import { natmyaungRoads } from '../data/villages/natmyaung/natmyaungRoads';
import {
	kalayArea1Roads,
	nankaleinCreek,
	nankaleinBridge,
	kalayArea1Trees,
} from '../data/wards/kalayArea1/kalayArea1Data';
import { kalayArea1Buildings } from '../data/wards/kalayArea1/kalayArea1Buildings';
import { nankaleinTeaShopData } from '../data/wards/kalayArea1/kalayArea1TeaShop';

type Rectangle = { x: number; z: number; width: number; depth: number; rotation: number };
function rectanglePath(r: Rectangle) {
	const c = Math.cos(r.rotation), s = Math.sin(r.rotation);
	return [[-1, -1], [1, -1], [1, 1], [-1, 1]]
		.map(([u, v], i) => `${i ? 'L' : 'M'}${(r.x + c * u * r.width / 2 + s * v * r.depth / 2).toFixed(1)},${(r.z - s * u * r.width / 2 + c * v * r.depth / 2).toFixed(1)}`)
		.join('') + 'Z';
}

// Static, batched SVG paths keep dragging a large map inexpensive, including on phones.
const houses =
	[...ward.houses, ...kalayVillages.flatMap(v => v.houses)].map(rectanglePath).join('') +
	myotharCenterBuildings.map(b => rectanglePath({ ...b, width: b.houseWidth ?? b.width, depth: b.houseLength ?? b.depth })).join('') +
	kalayArea1Buildings.map(b => rectanglePath({ x: b.x, z: b.z, width: b.houseWidth || b.width, depth: b.houseLength || b.depth, rotation: b.rotation })).join('');

const yards = kalayArea1Buildings.map(b => {
	const sideHalf = b.fenceSideHalf || b.width / 2;
	const backHalf = b.fenceBackHalf || b.depth * 0.46;
	const frontHalf = b.fenceFrontHalf || b.depth * 0.54;
	const w = sideHalf * 2;
	const d = backHalf + frontHalf;
	const c = Math.cos(b.rotation), s = Math.sin(b.rotation);
	const vOffset = (frontHalf - backHalf) / 2;
	const cx = b.x + s * vOffset;
	const cz = b.z + c * vOffset;
	return [[-1, -1], [1, -1], [1, 1], [-1, 1]]
		.map(([u, v], i) => `${i ? 'L' : 'M'}${(cx + c * u * w / 2 + s * v * d / 2).toFixed(1)},${(cz - s * u * w / 2 + c * v * d / 2).toFixed(1)}`)
		.join('') + 'Z';
}).join('');

const roads = [...ward.roads, ...kalayVillages.filter(v => v.id !== 'kanbale' && v.id !== 'natmyaung').flatMap(v => v.roads)].map(rectanglePath).join('');
const polylines = [...myotharCenterRoads, ...kanbaleRoads, ...natmyaungRoads, ...kalayArea1Roads];
const trees = [...ward.trees, ...kalayVillages.flatMap(v => v.trees), ...kalayArea1Trees].map(t => `M${(t.x - 1.5).toFixed(1)},${t.z.toFixed(1)}a1.5,1.5 0 1,0 3,0a1.5,1.5 0 1,0 -3,0`).join('');

const nankaleinCreekPath = nankaleinCreek.worldPoints
	.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
	.join('');

const bridgeRotDeg = (-nankaleinBridge.rotation * 180) / Math.PI;

const teaShop = nankaleinTeaShopData;
const teaShopRotDeg = (-teaShop.rotation * 180) / Math.PI;

export const MapSelectionMap = memo(function MapSelectionMap() {
	return (
		<g pointerEvents="none" aria-hidden="true">
			{/* ၁။ မြေပြင် အောက်ခံ (Ground Terrain) */}
			<rect x={-20000} y={-20000} width={40000} height={40000} fill="#c1cfab" />

			{/* ၂။ ရေလမ်းကြောင်းများ (Waterways & Creeks) */}
			{/* Kanbale drain */}
			<path d={kanbaleDrainSvgPath} fill="none" stroke="#0284c7" strokeWidth={2.5} opacity={0.8} />

			{/* Nankalein Creek trench bed */}
			<path
				d={nankaleinCreekPath}
				fill="none"
				stroke="#475569"
				strokeWidth={nankaleinCreek.trenchWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity={0.7}
			/>
			{/* Nankalein Creek water ribbon */}
			<path
				d={nankaleinCreekPath}
				fill="none"
				stroke="#0284c7"
				strokeWidth={nankaleinCreek.waterWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity={0.88}
			/>

			{/* ၃။ လမ်းကွန်ရက် (Road Network) */}
			<path d={roads} fill="#89948e" />
			{polylines.map((road, index) => (
				<path
					key={`${index}:${road.id}`}
					d={road.worldPoints.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('')}
					fill="none"
					stroke={(road as { ref?: string }).ref === 'NH41' ? '#334155' : '#89948e'}
					strokeWidth={road.width}
					strokeLinejoin="round"
					strokeLinecap="round"
				/>
			))}

			{/* ၄။ နန်းကလိန်ချောင်း တံတားကြီး (Nankalein Highway Bridge) */}
			<g
				id="map-nankalein-bridge"
				transform={`translate(${nankaleinBridge.x.toFixed(1)}, ${nankaleinBridge.z.toFixed(1)}) rotate(${bridgeRotDeg.toFixed(1)})`}
			>
				{/* Concrete base deck */}
				<rect
					x={(-nankaleinBridge.width / 2).toFixed(1)}
					y={(-nankaleinBridge.length / 2).toFixed(1)}
					width={nankaleinBridge.width}
					height={nankaleinBridge.length}
					fill="#64748b"
					stroke="#1e293b"
					strokeWidth={0.8}
					rx={1.0}
				/>
				{/* Asphalt road */}
				<rect
					x={(-nankaleinBridge.roadWidth / 2).toFixed(1)}
					y={(-nankaleinBridge.length / 2).toFixed(1)}
					width={nankaleinBridge.roadWidth}
					height={nankaleinBridge.length}
					fill="#1e293b"
				/>
				{/* Yellow dashed center line */}
				<line
					x1={0}
					y1={-nankaleinBridge.length / 2 + 2}
					x2={0}
					y2={nankaleinBridge.length / 2 - 2}
					stroke="#facc15"
					strokeWidth={0.6}
					strokeDasharray="2.5, 2.5"
				/>
			</g>

			{/* ၄.၅။ နန်းကလိန် လက်ဖက်ရည်ဆိုင် (Nankalein Tea Shop 2D) */}
			<g
				id="map-nankalein-tea-shop"
				transform={`translate(${teaShop.x.toFixed(1)}, ${teaShop.z.toFixed(1)}) rotate(${teaShopRotDeg.toFixed(1)})`}
			>
				{/* Outdoor Patio */}
				<rect
					x={(teaShop.outdoor.centerU - teaShop.u - teaShop.outdoor.width / 2).toFixed(1)}
					y={(-teaShop.outdoor.depth / 2).toFixed(1)}
					width={teaShop.outdoor.width}
					height={teaShop.outdoor.depth}
					fill="#cbd5e1"
					stroke="#3b82f6"
					strokeWidth={0.5}
					rx={0.6}
				/>
				{/* Indoor Building Roof */}
				<rect
					x={(teaShop.indoor.centerU - teaShop.u - teaShop.indoor.width / 2).toFixed(1)}
					y={(-teaShop.indoor.depth / 2).toFixed(1)}
					width={teaShop.indoor.width}
					height={teaShop.indoor.depth}
					fill="#b91c1c"
					stroke="#1e293b"
					strokeWidth={0.6}
					rx={0.8}
				/>
				{/* Counter */}
				<rect x={-5.2} y={-2.1} width={1.4} height={4.2} fill="#d97706" rx={0.3} />
				{/* 12 Tables */}
				{teaShop.tables.map((t) => (
					<circle
						key={t.id}
						cx={t.du}
						cy={t.dv}
						r={0.7}
						fill={t.isOutdoor ? '#2563eb' : '#92400e'}
						stroke="#ffffff"
						strokeWidth={0.2}
					/>
				))}
			</g>

			{/* ၅။ ခြံဝန်းများနှင့် အိမ်ခြေများ (Compound Yards & Houses) */}
			<path d={yards} fill="#e2d8c3" stroke="#94a3b8" strokeWidth={0.3} opacity={0.55} />
			<path d={houses} fill="#ae927a" stroke="#715f52" strokeWidth={0.5} />

			{/* ၆။ သစ်ပင်များ (Trees) */}
			<path d={trees} fill="#5d8551" />
		</g>
	);
});

