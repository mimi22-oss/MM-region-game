import { memo, useMemo, useState } from 'react';
import {
	myotharCenterMeta,
	myotharCenterBuildings,
	myotharCenterRoads,
	myotharCenterPOIs,
	myotharCenterTrees,
	type MyotharCenterBuildingData,
	type MyotharCenterRoad,
	type MyotharCenterPOI,
} from '../../../../data/wards/myothar/center/index.ts';
import { MyotharCenterBuilding } from './MyotharCenterBuilding';
import { MyotharCenterLandmarks } from './MyotharCenterLandmarks';
import { Cemetery } from '../../../Cemetery.tsx';
import { Tree } from '../../../Tree.tsx';
import { sourceIsEdited } from '../../../../game/worldEdits';

export interface MyotharCenterProps {
	onSelectBuilding?: (building: MyotharCenterBuildingData) => void;
}

/**
 * မြို့သာရပ်ကွက် အလယ် (နယ်မြေ ၁ မှ ၇) — 3D Scene Component
 *
 * တည်နေရာ:
 * - မြို့သာရပ်ကွက် နယ်မြေ (၅) ၏ ရွှေမြန်မာ စက်သုံးဆီဆိုင် တောင်ဘက်
 * - ကံပုလဲရွာ ၏ အနောက်ဘက်ခြမ်းတွင် ဆက်စပ်တည်ရှိသော မြို့သာရပ်ကွက် အလယ်
 *
 * အဓိက Feature များ:
 * ၁။ OpenStreetMap (OSM) Road Paths — AH1 / NH41 အာရှလမ်းမကြီးနှင့် ရပ်ကွက်တွင်းလမ်း ၂၇ သွယ်
 * ၂။ 3D Building Models — OSM Polygon Footprints ၁,၁၂၉ လုံး
 * ၃။ Custom Landmarks — မြို့သာကျောင်းတိုက်၊ PPK၊ OSO၊ ကားဝပ်ရှော့၊ GBS၊ စားသောက်ဆိုင်၊ ဖုန်းဆိုင်၊ ကုန်မာဆိုင် စသည့် အထင်ကရ ၁၀ ခု
 * ၄။ Walkable Ground & Road Ribbons
 * ၅။ Building Selection & Information System
 */
export const MyotharCenter = memo(function MyotharCenter({
	onSelectBuilding,
}: MyotharCenterProps) {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const landmarkBuildingIds = useMemo(() => {
		return new Set(myotharCenterPOIs.map((p: MyotharCenterPOI) => p.buildingId));
	}, []);

	const handleSelect = (id: string) => {
		setSelectedId((prev) => (prev === id ? null : id));
		const b = myotharCenterBuildings.find((item: MyotharCenterBuildingData) => item.id === id);
		if (b && onSelectBuilding) {
			onSelectBuilding(b);
		}
	};

	// ၁။ လမ်းဆုံ/လမ်းကြောင်း Segment များ တွက်ချက်ခြင်း (Walkable Road Ribbons)
	const roadSegments = useMemo(() => {
		const list: {
			key: string;
			mx: number;
			mz: number;
			length: number;
			width: number;
			rot: number;
			isAh1: boolean;
		}[] = [];

		myotharCenterRoads.forEach((r: MyotharCenterRoad, rIdx: number) => {
			const pts = r.worldPoints;
			for (let i = 0; i < pts.length - 1; i++) {
				const p1 = pts[i];
				const p2 = pts[i + 1];
				const dx = p2[0] - p1[0];
				const dz = p2[1] - p1[1];
				const length = Math.hypot(dx, dz);
				if (length < 0.3) continue;

				const mx = (p1[0] + p2[0]) / 2;
				const mz = (p1[1] + p2[1]) / 2;
				const rot = -Math.atan2(dz, dx);

				list.push({
					key: `mc-road-seg-${rIdx}-${i}`,
					mx,
					mz,
					length: length + 0.15,
					width: r.width,
					rot,
					isAh1: r.ref === 'NH41',
				});
			}
		});

		return list;
	}, []);

	// ၂။ မြေပြင် အတိုင်းအတာ (Ground Plinth)
	const b = myotharCenterMeta.bounds;
	const groundCenterX = (b.minX + b.maxX) / 2;
	const groundCenterZ = (b.minZ + b.maxZ) / 2;
	const groundWidth = b.maxX - b.minX + 80;
	const groundDepth = b.maxZ - b.minZ + 80;

	const selectedBuilding = useMemo(
		() => myotharCenterBuildings.find((item: MyotharCenterBuildingData) => item.id === selectedId),
		[selectedId],
	);

	return (
		<group name="ward-myothar-center">
			{/* ======================================================== */}
			{/* ၁။ မြို့သာရပ်ကွက် အလယ် မြေပြင် (Walkable Ground) */}
			{/* ======================================================== */}
			<mesh
				position={[groundCenterX, -0.04, groundCenterZ]}
				rotation={[-Math.PI / 2, 0, 0]}
				receiveShadow
				userData={{ walkable: true }}
			>
				<planeGeometry args={[groundWidth, groundDepth]} />
				<meshStandardMaterial color="#7e965f" roughness={0.9} />
			</mesh>

			{/* ======================================================== */}
			{/* ၂။ OSM လမ်းကြောင်းများ (Walkable Real OSM Roads) */}
			{/* ======================================================== */}
			<group name="myothar-center-roads">
				{roadSegments.map((s) => (
					<group key={s.key} position={[s.mx, 0, s.mz]} rotation={[0, s.rot, 0]}>
						{/* Gravel / Shoulder sub-base */}
						<mesh
							position={[0, 0.04, 0]}
							rotation={[-Math.PI / 2, 0, 0]}
							receiveShadow
							userData={{ walkable: true }}
						>
							<planeGeometry args={[s.length, s.width + (s.isAh1 ? 1.6 : 0.8)]} />
							<meshStandardMaterial color="#c5b18d" roughness={0.92} />
						</mesh>
						{/* Paved road surface */}
						<mesh
							position={[0, s.isAh1 ? 0.18 : 0.08, 0]}
							rotation={[-Math.PI / 2, 0, 0]}
							receiveShadow
							userData={{ walkable: true }}
						>
							<planeGeometry args={[s.length, s.width]} />
							<meshStandardMaterial
								color={s.isAh1 ? '#697574' : '#5a6663'}
								roughness={0.82}
								metalness={0.06}
							/>
						</mesh>
						{/* AH1 Center Dashed Yellow Stripe */}
						{s.isAh1 && s.length >= 6 && (
							<mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
								<planeGeometry args={[Math.min(s.length - 2, 3.2), 0.16]} />
								<meshStandardMaterial color="#e9d9a2" roughness={0.6} />
							</mesh>
						)}
					</group>
				))}
			</group>

			{/* ======================================================== */}
			{/* ၃။ အထင်ကရနေရာများ (Custom 3D POI Landmarks) */}
			{/* ======================================================== */}
			<MyotharCenterLandmarks />

			{/* ======================================================== */}
			{/* ၃.၅။ သင်္ချိုင်း / သုသာန်ဝင်း (10,000 Multicolored Graves Reusable Cemetery) */}
			{/* ======================================================== */}
			<Cemetery name="သင်္ချိုင်း" township="မြို့သာရပ်ကွက်" graveCount={10000} />

			{/* ======================================================== */}
			{/* ၄။ လူနေအိမ်နှင့် အဆောက်အအုံများ (Buildings) */}
			{/* ======================================================== */}
			<group name="myothar-center-buildings">
				{myotharCenterBuildings.map((building: MyotharCenterBuildingData) => {
					// Skip buildings that are replaced by full custom landmark models or edited/moved
					if (landmarkBuildingIds.has(building.id) || sourceIsEdited(building.id)) return null;

					const isSelected = selectedId === building.id;
					return (
						<MyotharCenterBuilding
							key={building.id}
							building={building}
							selected={isSelected}
							onSelect={handleSelect}
						/>
					);
				})}
			</group>

			{/* ======================================================== */}
			{/* ၅။ သစ်ပင်များ (Shading Trees along AH1 & Compounds) */}
			{/* ======================================================== */}
			<group name="myothar-center-trees">
				{myotharCenterPOIs.map((poi: MyotharCenterPOI, idx: number) => (
					<Tree
						key={`poi-tree-${poi.id}`}
						t={{
							id: `tree-poi-${poi.id}`,
							x: poi.x + 8 * (idx % 2 === 0 ? 1 : -1),
							z: poi.z + 6 * (idx % 3 === 0 ? 1 : -1),
							radius: 4,
						}}
						i={idx}
						variant="large"
					/>
				))}
				{myotharCenterTrees.map((tree, idx: number) => (
					<Tree
						key={tree.id}
						t={tree}
						i={idx}
						variant="large"
					/>
				))}
			</group>

			{/* ======================================================== */}
			{/* ၆။ ရွေးချယ်ထားသော အဆောက်အအုံ Floating 3D Badge */}
			{/* ======================================================== */}
			{selectedBuilding && (
				<group
					position={[
						selectedBuilding.x,
						selectedBuilding.height + 2.4,
						selectedBuilding.z,
					]}
				>
					{/* Beacon Point Light */}
					<pointLight
						color="#38bdf8"
						intensity={2.5}
						distance={18}
						decay={2}
					/>

					{/* Indicator Diamond */}
					<mesh position={[0, 0.4, 0]} rotation={[0.4, 0.4, 0]}>
						<octahedronGeometry args={[0.55, 0]} />
						<meshStandardMaterial
							color="#38bdf8"
							emissive="#0284c7"
							emissiveIntensity={0.8}
							roughness={0.2}
						/>
					</mesh>
				</group>
			)}
		</group>
	);
});
