import { memo } from 'react';
import {
	kalayArea1Roads,
	kalayArea1Trees,
	nankaleinCreek,
	nankaleinBridge,
	type KalayArea1Road,
} from '../../../data/wards/kalayArea1/kalayArea1Data.ts';
import {
	kalayArea1Buildings,
	type KalayArea1BuildingData,
} from '../../../data/wards/kalayArea1/kalayArea1Buildings.ts';
import { nankaleinTeaShopData } from '../../../data/wards/kalayArea1/kalayArea1TeaShop.ts';

export interface KalayArea1PlanProps {
	labels?: boolean;
	onSelectLocation?: (id: string) => void;
}

/**
 * ကလေးမြို့ နယ်မြေ (၁) 2D Map Plan (SVG Minimap & Plan View)
 */
export const KalayArea1Plan = memo(function KalayArea1Plan({
	labels = true,
	onSelectLocation,
}: KalayArea1PlanProps) {
	// Creek path string
	const creekPathD = nankaleinCreek.worldPoints
		.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
		.join(' ');

	const bridge = nankaleinBridge;
	const bridgeRotDeg = (-bridge.rotation * 180) / Math.PI;

	const teaShop = nankaleinTeaShopData;
	const teaShopRotDeg = (-teaShop.rotation * 180) / Math.PI;

	return (
		<g id="ward-kalay-area-1-plan">
			{/* ======================================================== */}
			{/* ၁။ နန်းကလိန်ချောင်း (Nankalein Creek 2D Ribbon)          */}
			{/* ======================================================== */}
			<g id="a1-creek">
				{/* Creek bed trench */}
				<path
					d={creekPathD}
					fill="none"
					stroke="#475569"
					strokeWidth={nankaleinCreek.trenchWidth}
					strokeLinecap="round"
					strokeLinejoin="round"
					opacity={0.7}
				/>
				{/* Flowing Water Ribbon */}
				<path
					d={creekPathD}
					fill="none"
					stroke="#0284c7"
					strokeWidth={nankaleinCreek.waterWidth}
					strokeLinecap="round"
					strokeLinejoin="round"
					opacity={0.88}
				/>
			</g>

			{/* ======================================================== */}
			{/* ၂။ လမ်းကွန်ရက် (Road Network Paths)                     */}
			{/* ======================================================== */}
			<g id="a1-roads">
				{kalayArea1Roads.map((r: KalayArea1Road) => {
					const pathD = r.worldPoints
						.map((p: [number, number], idx: number) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
						.join(' ');

					const isAh1 = r.ref === 'NH41';
					return (
						<path
							key={r.id}
							d={pathD}
							fill="none"
							stroke={isAh1 ? '#334155' : '#cbd5e1'}
							strokeWidth={r.width}
							strokeLinecap="round"
							strokeLinejoin="round"
							opacity={0.88}
						/>
					);
				})}
			</g>

			{/* ======================================================== */}
			{/* ၃။ နန်းကလိန်ချောင်း တံတားကြီး (Large Highway Bridge 2D)   */}
			{/* ======================================================== */}
			<g
				id="a1-bridge"
				transform={`translate(${bridge.x.toFixed(1)}, ${bridge.z.toFixed(1)}) rotate(${bridgeRotDeg.toFixed(1)})`}
				onClick={() => onSelectLocation?.('nankalein-bridge')}
				style={{ cursor: 'pointer' }}
			>
				{/* Bridge Deck Base */}
				<rect
					x={(-bridge.width / 2).toFixed(1)}
					y={(-bridge.length / 2).toFixed(1)}
					width={bridge.width}
					height={bridge.length}
					fill="#64748b"
					stroke="#1e293b"
					strokeWidth={0.8}
					rx={1.0}
				/>
				{/* Asphalt Roadway */}
				<rect
					x={(-bridge.roadWidth / 2).toFixed(1)}
					y={(-bridge.length / 2).toFixed(1)}
					width={bridge.roadWidth}
					height={bridge.length}
					fill="#1e293b"
				/>
				{/* Center Dashed Line */}
				<line
					x1={0}
					y1={-bridge.length / 2 + 2}
					x2={0}
					y2={bridge.length / 2 - 2}
					stroke="#facc15"
					strokeWidth={0.5}
					strokeDasharray="2.5, 2.5"
				/>
			</g>

			{/* ======================================================== */}
			{/* ၃.၅။ နန်းကလိန် လက်ဖက်ရည်ဆိုင် (Nankalein Tea Shop 2D)     */}
			{/* ======================================================== */}
			<g
				id="a1-tea-shop"
				transform={`translate(${teaShop.x.toFixed(1)}, ${teaShop.z.toFixed(1)}) rotate(${teaShopRotDeg.toFixed(1)})`}
				onClick={() => onSelectLocation?.(teaShop.id)}
				style={{ cursor: 'pointer' }}
			>
				{/* Outdoor Patio Deck */}
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
				{/* Indoor Hall Building */}
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
				<rect
					x={-5.2}
					y={-2.1}
					width={1.4}
					height={4.2}
					fill="#d97706"
					rx={0.3}
				/>
				{/* 12 Tables dots */}
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

			{/* ======================================================== */}
			{/* ၄။ ခြံဝန်းများနှင့် အိမ်ခြေများ (Compounds & Buildings)     */}
			{/* ======================================================== */}
			<g id="a1-buildings">
				{kalayArea1Buildings.map((b: KalayArea1BuildingData) => {
					const sideHalf = b.fenceSideHalf || b.width / 2;
					const backHalf = b.fenceBackHalf || b.depth * 0.46;
					const frontHalf = b.fenceFrontHalf || b.depth * 0.54;
					const houseW = b.houseWidth || 5.0;
					const houseD = b.houseLength || 6.2;
					const rotDeg = (-b.rotation * 180) / Math.PI;

					return (
						<g
							key={b.id}
							transform={`translate(${b.x.toFixed(1)}, ${b.z.toFixed(1)}) rotate(${rotDeg.toFixed(1)})`}
						>
							{/* Yard */}
							<rect
								x={-sideHalf}
								y={-backHalf}
								width={sideHalf * 2}
								height={backHalf + frontHalf}
								fill="#e2d8c3"
								stroke={b.fenceColor || '#2563a6'}
								strokeWidth={0.4}
								rx={0.5}
								opacity={0.85}
							/>
							{/* House Roof */}
							<rect
								x={-houseW / 2}
								y={-houseD / 2}
								width={houseW}
								height={houseD}
								fill={b.roofColor}
								stroke="#475569"
								strokeWidth={0.3}
								rx={0.3}
							/>
						</g>
					);
				})}
			</g>

			{/* ======================================================== */}
			{/* ၅။ သစ်ပင်များ (Trees)                                   */}
			{/* ======================================================== */}
			<g id="a1-trees">
				{kalayArea1Trees.map((t) => (
					<circle
						key={t.id}
						cx={t.x}
						cy={t.z}
						r={t.radius * 0.55}
						fill="#2d6a4f"
						opacity={0.65}
					/>
				))}
			</g>

			{/* ======================================================== */}
			{/* ၆။ အမည်စာသားများ (Burmese Map Labels)                   */}
			{/* ======================================================== */}
			{labels && (
				<g id="a1-labels" style={{ pointerEvents: 'none', userSelect: 'none' }}>
					{/* နန်းကလိန် လက်ဖက်ရည်ဆိုင် Label */}
					<g transform={`translate(${teaShop.x.toFixed(1)}, ${(teaShop.z - 8).toFixed(1)})`}>
						<rect x={-50} y={-11} width={100} height={22} rx={4} fill="#854d0e" opacity={0.92} />
						<text
							x={0}
							y={4}
							textAnchor="middle"
							fill="#fef08a"
							fontSize={9.5}
							fontWeight="bold"
							fontFamily="sans-serif"
						>
							နန်းကလိန် လက်ဖက်ရည်ဆိုင်
						</text>
					</g>

					{/* နန်းကလိန်ချောင်းတံတား Label */}
					<g transform={`translate(${bridge.x.toFixed(1)}, ${(bridge.z - 12).toFixed(1)})`}>
						<rect x={-45} y={-10} width={90} height={20} rx={4} fill="#064e3b" opacity={0.88} />
						<text
							x={0}
							y={4}
							textAnchor="middle"
							fill="#fef08a"
							fontSize={9}
							fontWeight="bold"
							fontFamily="sans-serif"
						>
							နန်းကလိန်ချောင်းတံတား
						</text>
					</g>

					{/* နန်းကလိန်ချောင်း River Label */}
					<g transform={`translate(${(bridge.x - 70).toFixed(1)}, ${(bridge.z + 20).toFixed(1)})`}>
						<rect x={-42} y={-9} width={84} height={18} rx={3} fill="#0369a1" opacity={0.82} />
						<text
							x={0}
							y={3.5}
							textAnchor="middle"
							fill="#ffffff"
							fontSize={8.5}
							fontWeight="600"
							fontFamily="sans-serif"
						>
							နန်းကလိန်ချောင်း
						</text>
					</g>

					{/* ကလေးမြို့ နယ်မြေ (၁) District Label */}
					<g transform={`translate(${(bridge.x - 120).toFixed(1)}, ${(bridge.z - 80).toFixed(1)})`}>
						<rect x={-52} y={-12} width={104} height={24} rx={5} fill="#1e293b" opacity={0.9} />
						<text
							x={0}
							y={4}
							textAnchor="middle"
							fill="#38bdf8"
							fontSize={10.5}
							fontWeight="bold"
							fontFamily="sans-serif"
						>
							ကလေးမြို့ နယ်မြေ (၁)
						</text>
					</g>
				</g>
			)}
		</g>
	);
});
