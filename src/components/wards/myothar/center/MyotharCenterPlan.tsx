import { memo } from 'react';
import {
	myotharCenterBuildings,
	myotharCenterRoads,
	myotharCenterPOIs,
	myotharCenterTrees,
	type MyotharCenterBuildingData,
	type MyotharCenterRoad,
	type MyotharCenterPOI,
} from '../../../../data/wards/myothar/center/index.ts';

export interface MyotharCenterPlanProps {
	labels: boolean;
	onSelectLocation?: (id: string) => void;
}

/**
 * မြို့သာရပ်ကွက် အလယ် (နယ်မြေ ၁ မှ ၇) — 2D Map Plan SVG Component
 *
 * နယ်မြေ (၅) စတိုင်အတိုင်း:
 * - သပ်ရပ်သော ခြံဝန်းမြေကွက် (Compound Yard Ground)
 * - ဘေးနှင့် အနောက် ဇကာခြံစည်းရိုး (Side & Back Dashed Wire Mesh Fences)
 * - မျက်နှာစာ အဝင်တံခါးပေါက်ပါ သွပ်ပြားခြံစည်းရိုး (Front Fence with Gate Opening)
 * - ခြံဝန်းအတွင်း စနစ်တကျ နေရာချထားသော အိမ်ခေါင်မိုးများ (Separated House Roofs)
 * - လမ်းကွန်ရက်နှင့် အထင်ကရနေရာ အမှတ်အသားများ
 */
export const MyotharCenterPlan = memo(function MyotharCenterPlan({
	labels,
	onSelectLocation,
}: MyotharCenterPlanProps) {
	return (
		<g id="ward-myothar-center-plan">
			{/* ၁။ လမ်းကွန်ရက် (Road Network Paths) */}
			<g id="mc-roads">
				{myotharCenterRoads.map((r: MyotharCenterRoad) => {
					const pathD = r.worldPoints
						.map((p: [number, number], idx: number) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
						.join(' ');

					const isAh1 = r.ref === 'NH41';
					return (
						<path
							key={r.id}
							d={pathD}
							fill="none"
							stroke={isAh1 ? '#495057' : '#d4bd98'}
							strokeWidth={r.width}
							strokeLinecap="round"
							strokeLinejoin="round"
							opacity={0.88}
						/>
					);
				})}
			</g>

			{/* ၂။ နယ်မြေ (၅) စတိုင် ခြံဝန်းများနှင့် သီးခြားအိမ်ခြေများ (Compounds & Separated Houses) */}
			<g id="mc-buildings">
				{myotharCenterBuildings.map((b: MyotharCenterBuildingData) => {
					const sideHalf = b.fenceSideHalf || b.width / 2;
					const backHalf = b.fenceBackHalf || b.depth * 0.46;
					const frontHalf = b.fenceFrontHalf || b.depth * 0.54;
					const halfGate = (b.gateWidth || 2.4) / 2;
					const houseW = b.houseWidth || 5.0;
					const houseD = b.houseLength || 6.2;
					const houseZ = b.houseZOffset ?? -0.6;
					const eave = Math.max(0, Math.min(.3, sideHalf - houseW / 2 - .06, backHalf + houseZ - houseD / 2 - .06));
					const rotDeg = (-b.rotation * 180) / Math.PI;

					return (
						<g
							key={b.id}
							transform={`translate(${b.x.toFixed(1)}, ${b.z.toFixed(1)}) rotate(${rotDeg.toFixed(1)})`}
						>
							{/* (က) ခြံဝန်းမြေကွက် (Compound Yard Ground) */}
							<rect
								x={-sideHalf}
								y={-backHalf}
								width={sideHalf * 2}
								height={backHalf + frontHalf}
								fill="#d8cfbe"
								opacity={0.5}
								rx={0.3}
							/>

							{/* (ခ) ဘေးနှင့် အနောက် ဇကာခြံစည်းရိုး (Dashed Side & Back Wire Fences) */}
							<line
								x1={-sideHalf}
								y1={-backHalf}
								x2={-sideHalf}
								y2={frontHalf}
								stroke="#68767a"
								strokeWidth={0.5}
								strokeDasharray="1.2 0.8"
							/>
							<line
								x1={sideHalf}
								y1={-backHalf}
								x2={sideHalf}
								y2={frontHalf}
								stroke="#68767a"
								strokeWidth={0.5}
								strokeDasharray="1.2 0.8"
							/>
							<line
								x1={-sideHalf}
								y1={-backHalf}
								x2={sideHalf}
								y2={-backHalf}
								stroke="#68767a"
								strokeWidth={0.5}
								strokeDasharray="1.2 0.8"
							/>

							{/* (ဂ) မျက်နှာစာ ခြံစည်းရိုးနှင့် အဝင်ဂိတ်ပေါက် (Front Fence with Gate Gap) */}
							<line
								x1={-sideHalf}
								y1={frontHalf}
								x2={-halfGate}
								y2={frontHalf}
								stroke={b.fenceColor || '#2563a6'}
								strokeWidth={0.8}
							/>
							<line
								x1={halfGate}
								y1={frontHalf}
								x2={sideHalf}
								y2={frontHalf}
								stroke={b.fenceColor || '#2563a6'}
								strokeWidth={0.8}
							/>

							{/* (ဃ) ခြံဝန်းအတွင်း ပင်မအိမ်ခေါင်မိုး (Main House Roof Footprint) */}
							<rect
								x={-houseW / 2 - eave}
								y={houseZ - houseD / 2 - eave}
								width={houseW + 2 * eave}
								height={houseD + 2 * eave}
								fill={b.isLandmark ? '#f59e0b' : b.roofColor}
								stroke="#475569"
								strokeWidth={0.3}
								rx={0.2}
							/>
						</g>
					);
				})}
			</g>

			{/* ၂.၅။ သစ်ပင်များ (Moved Compound Trees) */}
			<g id="mc-trees">
				{myotharCenterTrees.map((t) => (
					<circle
						key={t.id}
						cx={t.x}
						cy={t.z}
						r={2.5}
						fill="#22c55e"
						stroke="#15803d"
						strokeWidth={0.5}
						opacity={0.8}
					/>
				))}
			</g>

			{/* ၃။ အထင်ကရနေရာများ အညွှန်းနှင့် အမှတ်အသားများ (Landmark Pins & Labels) */}
			<g id="mc-landmarks">
				{myotharCenterPOIs.map((poi: MyotharCenterPOI) => (
					<g
						key={poi.id}
						transform={`translate(${poi.x.toFixed(1)}, ${poi.z.toFixed(1)})`}
						className={labels ? 'map-region-clickable' : undefined}
						onClick={
							labels && onSelectLocation
								? (e: React.MouseEvent) => {
									e.stopPropagation();
									onSelectLocation(poi.id);
								}
								: undefined
						}
					>
						{/* Pin Badge Circle */}
						<circle
							r={7}
							fill={poi.kind === 'place_of_worship' ? '#d97706' : poi.kind === 'industrial' ? '#0284c7' : '#2563eb'}
							stroke="#ffffff"
							strokeWidth={1.5}
						/>
						<circle
							r={3}
							fill="#ffffff"
						/>

						{/* Landmark Label Text */}
						{labels && (
							<g transform="translate(0, -10)">
								<rect
									x={-Math.max(poi.name.length * 3.8, 25)}
									y={-14}
									width={Math.max(poi.name.length * 7.6, 50)}
									height={18}
									rx={9}
									fill="#1e293b"
									fillOpacity={0.85}
									stroke="#ffffff"
									strokeWidth={0.8}
								/>
								<text
									x={0}
									y={-2}
									textAnchor="middle"
									fill="#ffffff"
									fontSize="8.5"
									fontWeight="600"
									fontFamily="'Myanmar Text', 'Pyidaungsu', sans-serif"
								>
									{poi.name}
								</text>
							</g>
						)}
					</g>
				))}
			</g>
		</g>
	);
});
