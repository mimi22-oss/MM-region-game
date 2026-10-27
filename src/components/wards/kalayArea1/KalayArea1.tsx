import { memo, useMemo, useState } from 'react';
import {
	kalayArea1Meta,
	kalayArea1Roads,
	kalayArea1Trees,
	type KalayArea1Road,
} from '../../../data/wards/kalayArea1/kalayArea1Data.ts';
import {
	kalayArea1Buildings,
	type KalayArea1BuildingData,
} from '../../../data/wards/kalayArea1/kalayArea1Buildings.ts';
import { KalayArea1Building } from './KalayArea1Building.tsx';
import { KalayArea1TeaShop } from './KalayArea1TeaShop.tsx';
import { NankaleinCreek } from './NankaleinCreek.tsx';
import { Tree } from '../../Tree.tsx';
import { sourceIsEdited } from '../../../game/worldEdits';

export interface KalayArea1Props {
	onSelectBuilding?: (building: KalayArea1BuildingData) => void;
}

/**
 * ကလေးမြို့ နယ်မြေ (၁) — 3D Scene Component
 *
 * တည်နေရာ:
 * - မြို့သာရပ်ကွက် အလယ် (နယ်မြေ ၁ မှ ၇) မြောက်ဘက်
 * - နန်းကလိန်ချောင်း နှင့် တံတားကြီးဘေးတွင် ဆက်စပ်တည်ရှိသော ကလေးမြို့ နယ်မြေ (၁)
 *
 * အဓိက Feature များ:
 * ၁။ နန်းကလိန်ချောင်း (Nankalein Creek) — AH1 ကို ကန့်လန့်ဖြတ်စီးဆင်းသော ရေချောင်းကြီး
 * ၂။ နန်းကလိန်ချောင်း တံတားကြီး (Large Concrete Bridge) — AH1 ပေါ်ရှိ ကွန်ကရစ်တံတားကြီး
 * ၃။ AH1 / NH41 အာရှလမ်းမကြီးနှင့် ရပ်ကွက်တွင်းလမ်း ၂၂ သွယ်
 * ၄။ 3D Building Models — OSM Polygon Footprints ၅၃၄ လုံး
 * ၅။ Walkable Ground & Road Ribbons
 */
export const KalayArea1 = memo(function KalayArea1({
	onSelectBuilding,
}: KalayArea1Props) {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const handleSelect = (id: string) => {
		setSelectedId((prev) => (prev === id ? null : id));
		const b = kalayArea1Buildings.find((item: KalayArea1BuildingData) => item.id === id);
		if (b && onSelectBuilding) {
			onSelectBuilding(b);
		}
	};

	// လမ်းကြောင်း Segment များ တွက်ချက်ခြင်း (Walkable Road Ribbons)
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

		kalayArea1Roads.forEach((r: KalayArea1Road, rIdx: number) => {
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
					key: `a1-road-seg-${rIdx}-${i}`,
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

	// မြေပြင် အတိုင်းအတာ (Ground Plinth)
	const b = kalayArea1Meta.bounds;
	const groundCenterX = (b.minX + b.maxX) / 2;
	const groundCenterZ = (b.minZ + b.maxZ) / 2;
	const groundWidth = b.maxX - b.minX + 60;
	const groundDepth = b.maxZ - b.minZ + 60;

	const selectedBuilding = useMemo(
		() => kalayArea1Buildings.find((item: KalayArea1BuildingData) => item.id === selectedId),
		[selectedId],
	);

	return (
		<group name="ward-kalay-area-1">
			{/* ======================================================== */}
			{/* ၁။ ကလေးမြို့ နယ်မြေ (၁) မြေပြင် (Walkable Ground Plinth) */}
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
			{/* ၂။ နန်းကလိန်ချောင်းနှင့် တံတားကြီး (Creek & Big Bridge)    */}
			{/* ======================================================== */}
			<NankaleinCreek />

			{/* ======================================================== */}
			{/* ၃။ လမ်းကြောင်းများ (Walkable Real OSM Roads)            */}
			{/* ======================================================== */}
			<group name="kalay-area-1-roads">
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
			{/* ၄။ လူနေအိမ်နှင့် အဆောက်အအုံများ (534 Buildings)        */}
			{/* ======================================================== */}
			<group name="kalay-area-1-buildings">
				{kalayArea1Buildings.map((building: KalayArea1BuildingData) => {
					if (sourceIsEdited(building.id)) return null;
					const isSelected = selectedId === building.id;
					return (
						<KalayArea1Building
							key={building.id}
							building={building}
							selected={isSelected}
							onSelect={handleSelect}
						/>
					);
				})}
			</group>

			{/* ======================================================== */}
			{/* ၅။ သစ်ပင်များ (Trees along AH1 & Nankalein Riverbanks)  */}
			{/* ======================================================== */}
			<group name="kalay-area-1-trees">
				{kalayArea1Trees.map((tree, idx: number) => (
					<Tree
						key={tree.id}
						t={tree}
						i={idx}
						variant="large"
					/>
				))}
			</group>

			{/* ======================================================== */}
			{/* ၆။ နန်းကလိန် လက်ဖက်ရည်ဆိုင် (Nankalein Tea Shop)          */}
			{/* ======================================================== */}
			<KalayArea1TeaShop onSelect={() => handleSelect('kalay-area-1-tea-shop')} />

			{/* ======================================================== */}
			{/* ၇။ ရွေးချယ်ထားသော အဆောက်အအုံ Floating 3D Badge        */}
			{/* ======================================================== */}
			{selectedBuilding && (
				<group
					position={[
						selectedBuilding.x,
						selectedBuilding.height + 2.4,
						selectedBuilding.z,
					]}
				>
					<pointLight color="#38bdf8" intensity={2.5} distance={18} decay={2} />
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
