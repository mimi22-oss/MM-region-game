import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { Group } from 'three';
import {
	angle,
	toWorld,
	kyarInnVillage,
	kyarInnTaphiChaung,
	kyarInnLandmarks,
	kyarInnLandmarkBuildings,
	type KyarInnLandmarkBuilding,
	kyarInnLakePonds,
	kyarInnLakeIsland,
	kyarInnLakeStructures,
} from '../../../data/villages/kyarinn';
import { MainRoad } from '../../MainRoad';
import { Lanes } from '../../Lane';
import { Field } from '../../Field';
import { EastWestCanal } from '../../Canal';
import { House, houseVisualRotation } from '../../House';
import { ChinTraditionalHouseBatch, type ChinHouseBatchItem } from '../../ChinTraditionalHouse';
import { ChristianChurch } from '../../ChristianChurch';
import { WALKIN_SCHOOL_HALL_IDS } from '../../../game/schoolClassrooms';
import { Tree } from '../../Tree';
import { Block } from '../../Primitives';
import { sourceIsEdited } from '../../../game/worldEdits';
import { registerGroundRegion, releaseGroundRegion } from '../../../game/groundSurface';
import { defaultChinCompoundBounds } from '../../../game/chinVillagerPool';

const CHIN_TIMBER_WALLS = [
	'#6a482d',
	'#5c3b22',
	'#785233',
	'#4d311d',
	'#634227',
	'#734c2f',
] as const;

const CHIN_ROOF_COLORS = [
	'#7d3c2e',
	'#8a4435',
	'#2f523b',
	'#4f3d2e',
	'#52463e',
	'#3e5446',
] as const;

// Dedicated walkable village ground cleanly spanning residential grid u ∈ [-211, +185], v ∈ [3670, 4025]
// (stops safely east of Kyar Inn Lake ponds at u <= -212 and sits below lanes/yards with zero z-fighting)
const KYARINN_VILLAGE_GROUND_POS = toWorld(-13, 3847.5);

/** အလက ကြာအင်း ကျောင်းဆောင်များ (North Halls, East Wings, Office) */
function SchoolBuilding({ b }: { b: KyarInnLandmarkBuilding }) {
	const pitch = 2.2;
	const isNS = b.depth > b.width;

	return (
		<group position={[b.x, 0, b.z]} rotation={[0, b.rotation, 0]}>
			<Block y={0.2} w={b.width + 1.2} h={0.4} d={b.depth + 1.2} color="#d4ccb8" />
			<Block y={b.height / 2} w={b.width} h={b.height} d={b.depth} color={b.color} />

			{/* အမိုးစောက် (အလျားလိုက် သို့မဟုတ် ဒေါင်လိုက် အလိုက် သင့်လျော်စွာ) */}
			{isNS
				? [-1, 1].map(s => (
						<mesh
							key={s}
							position={[s * (b.width / 4), b.height + 1, 0]}
							rotation={[0, 0, -s * Math.atan2(pitch, b.width / 2)]}
							castShadow
						>
							<boxGeometry args={[Math.hypot(b.width / 2, pitch) + 0.8, 0.24, b.depth + 1.2]} />
							<meshStandardMaterial color={b.roof} roughness={0.7} />
						</mesh>
				  ))
				: [-1, 1].map(s => (
						<mesh
							key={s}
							position={[0, b.height + 1, s * (b.depth / 4)]}
							rotation={[s * Math.atan2(pitch, b.depth / 2), 0, 0]}
							castShadow
						>
							<boxGeometry args={[b.width + 1.2, 0.24, Math.hypot(b.depth / 2, pitch) + 0.8]} />
							<meshStandardMaterial color={b.roof} roughness={0.7} />
						</mesh>
				  ))}

			{/* စာသင်ခန်း ပြတင်းပေါက် တန်းများ */}
			{isNS
				? Array.from({ length: Math.floor(b.depth / 6) }, (_, idx) => {
						const zz = -b.depth / 2 + 4 + idx * 6;
						return (
							<group key={idx}>
								<Block x={b.width / 2 + 0.06} y={b.height * 0.55} z={zz} w={0.12} h={1.8} d={2.2} color="#7fa2b8" />
								<Block x={-b.width / 2 - 0.06} y={b.height * 0.55} z={zz} w={0.12} h={1.8} d={2.2} color="#7fa2b8" />
							</group>
						);
				  })
				: Array.from({ length: Math.floor(b.width / 6) }, (_, idx) => {
						const xx = -b.width / 2 + 4 + idx * 6;
						return (
							<group key={idx}>
								<Block x={xx} y={b.height * 0.55} z={b.depth / 2 + 0.06} w={2.2} h={1.8} d={0.12} color="#7fa2b8" />
								<Block x={xx} y={b.height * 0.55} z={-b.depth / 2 - 0.06} w={2.2} h={1.8} d={0.12} color="#7fa2b8" />
							</group>
						);
				  })}
		</group>
	);
}

/** အလက ကြာအင်း အားကစားနှင့် ကျောင်းကွင်းပြင်ကြီး (AH1 ဘေး) */
function MiddleSchoolField({ m }: { m: (typeof kyarInnLandmarks)[0] }) {
	return (
		<group position={[m.x, 0, m.z]} rotation={[0, m.rotation, 0]}>
			{/* မြက်ခင်းစိမ်း ကွင်းပြင်ကြီး */}
			<Block y={0.03} w={m.width} h={0.06} d={m.depth} color="#457838" />
			{/* ကွင်းပတ်လည် အဖြူရောင် လိုင်းများ */}
			<Block y={0.065} x={0} z={-m.depth / 2 + 1.2} w={m.width - 4} h={0.01} d={0.3} color="#f0f5ee" />
			<Block y={0.065} x={0} z={m.depth / 2 - 1.2} w={m.width - 4} h={0.01} d={0.3} color="#f0f5ee" />
			<Block y={0.065} x={-m.width / 2 + 1.2} z={0} w={0.3} h={0.01} d={m.depth - 4} color="#f0f5ee" />
			<Block y={0.065} x={m.width / 2 - 1.2} z={0} w={0.3} h={0.01} d={m.depth - 4} color="#f0f5ee" />
			{/* အလယ်စည်းနှင့် စက်ဝိုင်း */}
			<Block y={0.065} x={0} z={0} w={0.3} h={0.01} d={m.depth - 4} color="#f0f5ee" />
			<mesh position={[0, 0.066, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<ringGeometry args={[6.8, 7.1, 24]} />
				<meshBasicMaterial color="#f0f5ee" />
			</mesh>
			{/* ဘောလုံးဂိုးတိုင်များ (အရှေ့နှင့် အနောက်) */}
			{[-1, 1].map(side => (
				<group key={side} position={[side * (m.width / 2 - 3), 0, 0]}>
					<Block y={1.2} z={-3.6} w={0.16} h={2.4} d={0.16} color="#ffffff" />
					<Block y={1.2} z={3.6} w={0.16} h={2.4} d={0.16} color="#ffffff" />
					<Block y={2.4} z={0} w={0.16} h={0.16} d={7.36} color="#ffffff" />
					<Block x={side * 1.2} y={1.1} z={0} w={0.1} h={2.1} d={7.2} color="#e0e8e2" />
				</group>
			))}
		</group>
	);
}

/** ကြာအင်းရေကန် ရေမျက်နှာပြင်နှင့် ကန်ဘောင်များ */
function LakePondSurface({ p }: { p: (typeof kyarInnLakePonds)[0] }) {
	return (
		<group position={[p.x, 0, p.z]} rotation={[0, p.rotation, 0]}>
			{/* မြေသား ကန်ဘောင် */}
			<Block y={0.08} w={p.width + 3.2} h={0.16} d={p.depth + 3.2} color="#6d634b" />
			{/* ရေပြင် */}
			<mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[p.width, p.depth]} />
				<meshStandardMaterial
					color={p.color ?? '#367272'}
					metalness={0.35}
					roughness={0.25}
				/>
			</mesh>
		</group>
	);
}

/** ကုန်းမြေပါ ရေကန် အလယ်ရှိ ကုန်းမြေကျွန်း (Island) */
function LakeIsland({ island }: { island: typeof kyarInnLakeIsland }) {
	return (
		<group position={[island.x, 0, island.z]} rotation={[0, island.rotation, 0]}>
			{/* ကျွန်းကုန်းမြေ အောက်ခံမြေမို့ */}
			<Block y={0.28} w={island.width} h={0.35} d={island.depth} color="#527d42" />
			<Block y={0.45} w={island.width - 4} h={0.25} d={island.depth - 3} color="#457338" />
			{/* ကျွန်းပေါ်ရှိ သစ်ပင်ငယ်၊ ချုံပင်များ */}
			{[-10, -4, 2, 8].map(ox => (
				<mesh key={ox} position={[ox, 1.2, (ox % 3) * 1.5]} castShadow>
					<sphereGeometry args={[1.4, 7, 7]} />
					<meshStandardMaterial color={ox % 2 ? '#3b6e32' : '#4b823e'} roughness={0.8} />
				</mesh>
			))}
		</group>
	);
}

/** ကြာအင်းရေကန် ရေပေါ် နားနေဆောင် (Water Pavilion on stilts) */
function WaterPavilion({ b }: { b: (typeof kyarInnLakeStructures)[0] }) {
	const pitch = 2.4;
	return (
		<group position={[b.x, 0, b.z]} rotation={[0, b.rotation, 0]}>
			{/* ရေပေါ် သစ်သားတိုင်လုံးများ (Stilts) */}
			{[-1, 1].map(sx =>
				[-1, 1].map(sz => (
					<mesh
						key={`${sx}-${sz}`}
						position={[sx * (b.width / 2 - 0.6), 0.7, sz * (b.depth / 2 - 0.6)]}
						castShadow
					>
						<cylinderGeometry args={[0.22, 0.22, 1.4, 8]} />
						<meshStandardMaterial color="#4a3628" />
					</mesh>
				))
			)}
			{/* နားနေဆောင် ကြမ်းခင်းပလက်ဖောင်း */}
			<Block y={1.45} w={b.width} h={0.3} d={b.depth} color="#ba9c77" />
			{/* ပတ်လည် လက်ရန်း */}
			{[-1, 1].map(sx => (
				<Block key={sx} x={sx * (b.width / 2 - 0.15)} y={2.1} w={0.15} h={1} d={b.depth} color="#755038" />
			))}
			<Block z={-b.depth / 2 + 0.15} y={2.1} w={b.width} h={1} d={0.15} color="#755038" />
			{/* အမိုးတိုင်များ */}
			{[-1, 1].map(sx =>
				[-1, 1].map(sz => (
					<mesh
						key={`roof-post-${sx}-${sz}`}
						position={[sx * (b.width / 2 - 0.4), 2.5, sz * (b.depth / 2 - 0.4)]}
						castShadow
					>
						<cylinderGeometry args={[0.16, 0.16, 2.2, 8]} />
						<meshStandardMaterial color="#5c3e2d" />
					</mesh>
				))
			)}
			{/* စောက်နက်သော အနီရောင်/ကြက်သွေးရောင် အမိုး */}
			{[-1, 1].map(s => (
				<mesh
					key={s}
					position={[0, 4.2, s * (b.depth / 4)]}
					rotation={[s * Math.atan2(pitch, b.depth / 2), 0, 0]}
					castShadow
				>
					<boxGeometry args={[b.width + 1.2, 0.22, Math.hypot(b.depth / 2, pitch) + 0.6]} />
					<meshStandardMaterial color={b.roof} roughness={0.65} />
				</mesh>
			))}
		</group>
	);
}

/** ရေပေါ်ဆောင် ကူးတံတား (Footbridge) */
function LakeFootbridge({ b }: { b: (typeof kyarInnLakeStructures)[1] }) {
	return (
		<group position={[b.x, 0, b.z]} rotation={[0, b.rotation, 0]}>
			{/* တံတားတိုင်များ */}
			{[-2.5, 0, 2.5].map(z =>
				[-1, 1].map(sx => (
					<mesh key={`${z}-${sx}`} position={[sx * 0.85, 0.65, z]} castShadow>
						<cylinderGeometry args={[0.15, 0.15, 1.3, 6]} />
						<meshStandardMaterial color="#4a3628" />
					</mesh>
				))
			)}
			{/* တံတားလျှောက်လမ်း ပျဉ်ခင်း */}
			<Block y={1.35} w={b.width} h={0.2} d={b.depth} color="#b89a74" />
			{/* ဘေးလက်ရန်းတန်းများ */}
			{[-1, 1].map(sx => (
				<Block key={sx} x={sx * (b.width / 2 - 0.08)} y={1.85} w={0.12} h={0.8} d={b.depth} color="#755038" />
			))}
		</group>
	);
}

/**
 * ကြာအင်းကျေးရွာ (Kyar Inn Chin Village) — 3D Scene Component
 * - သာယာကုန်းကျေးရွာကဲ့သို့ပင် ချင်းရွာဖြစ်သဖြင့် လူနေအိမ်အားလုံးကို ကျယ်ဝန်းသော အိမ်ခြံဝန်း +
 *   အိမ်နှင့်တွဲနေသော အလိုအလျောက်ပွင့်ပိတ် အိမ်တံခါးပါ ချင်းရိုးရာ အောက်ချင်းငှက်ခေါင်မိုးအိမ်များ
 *   (`<ChinTraditionalHouseBatch flatGround showCompoundFence omitStaticDoorLeaves />`) ဖြင့် ပြသသည်။
 * - ခရစ်ယာန်ဘုရားကျောင်း ၄ ကျောင်း (Baptist, IBC, CJC, St. Peter Catholic)၊ အလက ကြာအင်းကျောင်း နှင့်
 *   ကြာအင်းရေကန်တို့ကို မူလအတိုင်း ထိန်းသိမ်းထားသည်။
 */
export function KyarInnVillage() {
	const { scene } = useThree();
	const groundGroupRef = useRef<Group>(null);
	const walkableHousesRef = useRef<Group>(null);

	const chinResidentialHouses = useMemo<ChinHouseBatchItem[]>(() => {
		const residential = kyarInnVillage.houses.filter(
			h => !h.id.startsWith('ki-') && !sourceIsEdited(h.id),
		);
		return residential.map((h, i) => {
			const isTwoStorey = i % 5 === 2;
			return {
				id: h.id,
				x: h.x,
				z: h.z,
				baseY: 0,
				width: h.width,
				depth: h.depth,
				height: isTwoStorey ? 4.7 : 3.65,
				rotation: houseVisualRotation(h),
				wallColor: CHIN_TIMBER_WALLS[i % CHIN_TIMBER_WALLS.length],
				roofColor: CHIN_ROOF_COLORS[(i * 3 + 1) % CHIN_ROOF_COLORS.length],
				hornbillScale: isTwoStorey ? 1.15 : 1.04,
				compound: defaultChinCompoundBounds(h.width, h.depth),
			};
		});
	}, []);

	useEffect(() => {
		if (groundGroupRef.current) {
			registerGroundRegion(scene, 'kyarinn-village-ground', groundGroupRef.current);
		}
		if (walkableHousesRef.current) {
			registerGroundRegion(scene, 'kyarinn-chin-house-decks', walkableHousesRef.current);
		}
		return () => {
			releaseGroundRegion(scene, 'kyarinn-chin-house-decks');
			releaseGroundRegion(scene, 'kyarinn-village-ground');
		};
	}, [scene]);

	const churches = kyarInnLandmarkBuildings.filter(b => b.kind.startsWith('church-'));
	const schoolBuildings = kyarInnLandmarkBuildings.filter(b => b.kind.startsWith('school-'));
	const schoolField = kyarInnLandmarks.find(m => m.id === 'ki-school-field')!;
	const lakePavilion = kyarInnLakeStructures.find(s => s.id === 'ki-lake-pavilion');
	const lakeBridge = kyarInnLakeStructures.find(s => s.id === 'ki-lake-footbridge');
	const lakeSheds = kyarInnLakeStructures.filter(s => s.id !== 'ki-lake-pavilion' && s.id !== 'ki-lake-footbridge');

	return (
		<group name="village-kyarinn">
			{/* ကြာအင်းချင်းကျေးရွာ မြေပြင်အခင်း (Dedicated Walkable Village Ground Plane cleanly below lanes & yards) */}
			<group ref={groundGroupRef} name="kyarinn-ground-surface">
				<mesh
					userData={{ walkable: true }}
					position={[KYARINN_VILLAGE_GROUND_POS.x, 0.008, KYARINN_VILLAGE_GROUND_POS.z]}
					rotation={[0, angle, 0]}
					receiveShadow
				>
					<boxGeometry args={[396, 0.016, 355]} />
					<meshStandardMaterial color="#738b56" roughness={0.95} />
				</mesh>
			</group>

			{/* ထောက်ကြန့်-ကြာအင်းကြား လယ်ကွင်းများနှင့် သပြေချောင်း (Taphi Chaung) */}
			{kyarInnVillage.separationFields.map((f, i) => (
				<Field key={f.id ?? `ki-sep-${i}`} f={f} bunded />
			))}
			{kyarInnTaphiChaung && <EastWestCanal c={kyarInnTaphiChaung} />}

			{/* ကြာအင်းရေကန် (Kyar Inn Lake) နှင့် ရေကန် ၁၇ ကန် 3D မျက်နှာပြင် */}
			{kyarInnVillage.ponds?.map(p => (
				<LakePondSurface key={p.id} p={p} />
			))}

			{/* ကုန်းမြေပါ ရေကန် အလယ်ရှိ ကုန်းမြေ (Island) */}
			<LakeIsland island={kyarInnLakeIsland} />

			{/* ရေပေါ် နားနေဆောင်နှင့် ကူးတံတား */}
			{lakePavilion && <WaterPavilion b={lakePavilion} />}
			{lakeBridge && <LakeFootbridge b={lakeBridge} />}
			{lakeSheds.map(h => (
				<House key={h.id} h={h} />
			))}

			{/* အလက ကြာအင်း အားကစားကွင်းပြင်ကြီး (AH1 ဘေး) */}
			{schoolField && <MiddleSchoolField m={schoolField} />}

			{/* လမ်းကွန်ရက် (AH1 ပင်မလမ်းမကြီးနှင့် ရွာတွင်းလမ်းများ) */}
			<MainRoad roads={kyarInnVillage.roads} />
			<Lanes roads={kyarInnVillage.roads} />

			{/* လယ်ကွင်းများ (အနောက်နှင့် အရှေ့) */}
			{kyarInnVillage.fields.map((f, i) => (
				<Field key={f.id ?? `ki-f-${i}`} f={f} bunded />
			))}
			{kyarInnVillage.bundedFields.map((f, i) => (
				<Field key={f.id ?? `ki-bf-${i}`} f={f} bunded />
			))}

			{/* ကြာအင်းကျေးရွာ ချင်းရိုးရာ အောက်ချင်းငှက်ခေါင်မိုးအိမ် + ကျယ်ဝန်းသော အိမ်ခြံဝန်း
			    (အိမ်နှင့်တွဲနေသော ပွင့်ပိတ်တံခါးများနှင့် ချင်းလူမျိုးစု ၁–၁၀ ဦး/အိမ်ကို StreamedWorld မှ <ChinVillageBots /> က live မောင်းနှင်သည်) */}
			<ChinTraditionalHouseBatch
				houses={chinResidentialHouses}
				name="kyarinn-chin-hornbill-houses"
				walkableGroupRef={walkableHousesRef}
				flatGround
				showCompoundFence
				omitStaticDoorLeaves
			/>

			{/* အလက ကြာအင်း ကျောင်းဆောင်များ — Fixed Object Pool (`<PooledSchoolHalls>`) ဖြင့် render လုပ်သည် */}
			{schoolBuildings.map(b =>
				WALKIN_SCHOOL_HALL_IDS.has(b.id) ? null : <SchoolBuilding key={b.id} b={b} />
			)}

			{/* ခရစ်ယာန် ဘုရားကျောင်းများ — သီးသန့် ChristianChurch component (Baptist, IBC, CJC, St. Peter) */}
			{churches.map(b => (
				<ChristianChurch
					key={b.id}
					id={b.id}
					name={b.name}
					x={b.x}
					z={b.z}
					width={b.width}
					depth={b.depth}
					height={b.height}
					rotation={b.rotation}
					wallColor={b.color}
					roofColor={b.roof}
					variant="steeple-church"
					steepleHeight={b.steepleHeight}
					isCatholic={b.kind === 'church-catholic'}
				/>
			))}

			{/* သစ်ပင်များ */}
			{kyarInnVillage.largeTrees.map((t, i) => (
				<Tree key={t.id} t={t} i={i} variant="large" />
			))}
			{kyarInnVillage.trees.map((t, i) => (
				<Tree key={t.id} t={t} i={i} variant="canopy" />
			))}
			{kyarInnVillage.farmTrees.map(t => (
				<Tree key={t.id} t={t} variant="farm" />
			))}
		</group>
	);
}

/**
 * ကြာအင်းကျေးရွာ (Kyar Inn Village) — 2D Map Plan SVG Component
 */
export function KyarInnVillagePlan({
	labels,
	onSelectLocation,
}: {
	labels: boolean;
	onSelectLocation?: (id: string) => void;
}) {
	const residentialHouses = kyarInnVillage.houses.filter(h => !h.id.startsWith('ki-'));
	const c = kyarInnTaphiChaung;

	return (
		<g
			id="village-kyarinn-plan"
			className={labels ? 'map-region-clickable' : undefined}
			onClick={
				labels && onSelectLocation
					? e => {
							e.stopPropagation();
							onSelectLocation('kyarinn');
					  }
					: undefined
			}
		>
			{/* ထောက်ကြန့်-ကြာအင်းကြား လယ်ကွင်းများ */}
			{kyarInnVillage.separationFields.map(f => (
				<rect
					key={f.id}
					x={f.x - f.width / 2}
					y={f.z - f.depth / 2}
					width={f.width}
					height={f.depth}
					fill={f.color}
					stroke="#c1b57f"
					strokeWidth="0.9"
					transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
				/>
			))}

			{/* သပြေချောင်း (Taphi Chaung) နှင့် AH1 တံတား */}
			{c && (
				<g transform={`rotate(${(-c.rotation * 180) / Math.PI} ${c.x} ${c.z})`}>
					<rect
						x={c.uMin}
						y={c.v - c.width / 2}
						width={c.uMax - c.uMin}
						height={c.width}
						fill="#4d9395"
						stroke="#3b7678"
						strokeWidth="0.8"
					/>
					{c.bridges.map((b, i) => (
						<rect
							key={i}
							x={b.u - b.width / 2}
							y={b.v - b.depth / 2}
							width={b.width}
							height={b.depth}
							fill="#697574"
							stroke="#d6cfb9"
							strokeWidth="0.7"
						/>
					))}
				</g>
			)}

			{/* အနောက်နှင့် အရှေ့ လယ်ကွင်းများ */}
			{kyarInnVillage.bundedFields.map(f => (
				<rect
					key={f.id}
					x={f.x - f.width / 2}
					y={f.z - f.depth / 2}
					width={f.width}
					height={f.depth}
					fill={f.color}
					stroke="#c1b57f"
					strokeWidth="0.9"
					transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
				/>
			))}
			{kyarInnVillage.fields.map(f => (
				<rect
					key={f.id}
					x={f.x - f.width / 2}
					y={f.z - f.depth / 2}
					width={f.width}
					height={f.depth}
					fill={f.color}
					stroke="#c1b57f"
					strokeWidth="0.8"
					transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
				/>
			))}

			{/* အလက ကြာအင်း ကွင်းပြင်ကြီး */}
			{kyarInnLandmarks.map(m => (
				<rect
					key={m.id}
					x={m.x - m.width / 2}
					y={m.z - m.depth / 2}
					width={m.width}
					height={m.depth}
					fill="#457838"
					stroke="#2e5824"
					strokeWidth="1"
					transform={`rotate(${(-m.rotation * 180) / Math.PI} ${m.x} ${m.z})`}
				/>
			))}

			{/* ကြာအင်းရေကန် (Kyar Inn Lake) ၁၇ ကန် မျက်နှာပြင် */}
			{kyarInnLakePonds.map(p => (
				<rect
					key={p.id}
					x={p.x - p.width / 2}
					y={p.z - p.depth / 2}
					width={p.width}
					height={p.depth}
					fill={p.color ?? '#367272'}
					stroke="#645b44"
					strokeWidth="1.2"
					transform={`rotate(${(-p.rotation * 180) / Math.PI} ${p.x} ${p.z})`}
				/>
			))}

			{/* ကုန်းမြေပါ ရေကန် အလယ်ရှိ ကုန်းမြေ (Island) */}
			<rect
				x={kyarInnLakeIsland.x - kyarInnLakeIsland.width / 2}
				y={kyarInnLakeIsland.z - kyarInnLakeIsland.depth / 2}
				width={kyarInnLakeIsland.width}
				height={kyarInnLakeIsland.depth}
				fill={kyarInnLakeIsland.color}
				stroke="#39612e"
				strokeWidth="0.8"
				transform={`rotate(${(-kyarInnLakeIsland.rotation * 180) / Math.PI} ${kyarInnLakeIsland.x} ${kyarInnLakeIsland.z})`}
			/>

			{/* ရေပေါ် နားနေဆောင်နှင့် ကူးတံတား */}
			{kyarInnLakeStructures.map(s => (
				<rect
					key={s.id}
					x={s.x - s.width / 2}
					y={s.z - s.depth / 2}
					width={s.width}
					height={s.depth}
					fill={s.roof}
					stroke="#ffffff"
					strokeWidth="0.5"
					transform={`rotate(${(-s.rotation * 180) / Math.PI} ${s.x} ${s.z})`}
				/>
			))}

			{/* လမ်းများ (မိန်းလမ်းမကြီးနှင့် ရွာတွင်းလမ်းများ) */}
			{kyarInnVillage.roads.map(r => (
				<rect
					key={r.id}
					x={r.x - r.width / 2}
					y={r.z - r.depth / 2}
					width={r.width}
					height={r.depth}
					fill={r.main ? '#ff6a00' : '#d4bd98'}
					stroke={r.main ? '#d35400' : '#baa077'}
					strokeWidth={r.main ? '1.5' : '0.5'}
					transform={`rotate(${(-r.rotation * 180) / Math.PI} ${r.x} ${r.z})`}
				/>
			))}

			{/* အထင်ကရ အဆောက်အအုံများ (အလက ကျောင်းဆောင်များနှင့် ဘုရားကျောင်းများ) */}
			{kyarInnLandmarkBuildings.map(b => (
				<rect
					key={b.id}
					x={b.x - b.width / 2}
					y={b.z - b.depth / 2}
					width={b.width}
					height={b.depth}
					fill={b.roof}
					stroke="#fff3d1"
					strokeWidth="0.8"
					transform={`rotate(${(-b.rotation * 180) / Math.PI} ${b.x} ${b.z})`}
				/>
			))}

			{/* လူနေအိမ်ခြေများ (ချင်းရိုးရာ ကျယ်ဝန်းသော အိမ်ခြံဝန်းများ) */}
			{residentialHouses.map((h, i) => {
				const { sideHalf, backHalf, frontHalf } = defaultChinCompoundBounds(h.width, h.depth);
				const rot = houseVisualRotation(h);
				const roofFill = CHIN_ROOF_COLORS[(i * 3 + 1) % CHIN_ROOF_COLORS.length];
				return (
					<g key={h.id}>
						<g transform={`translate(${h.x} ${h.z}) rotate(${(-rot * 180) / Math.PI})`}>
							<line x1={-sideHalf} y1={-backHalf} x2={-sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8" />
							<line x1={sideHalf} y1={-backHalf} x2={sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8" />
							<line x1={-sideHalf} y1={-backHalf} x2={sideHalf} y2={-backHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8" />
							<line x1={-sideHalf} y1={frontHalf} x2={-1.5} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1" />
							<line x1={1.5} y1={frontHalf} x2={sideHalf} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1" />
							<rect x={-h.width / 2} y={-h.depth / 2} width={h.width} height={h.depth} fill={roofFill} />
						</g>
					</g>
				);
			})}

			{/* စာတန်း အညွှန်းများ */}
			{labels && (
				<>
					<text
						x={kyarInnVillage.labelPos.x}
						y={kyarInnVillage.labelPos.z}
						fill="#143e37"
						fontSize="26"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="4"
						paintOrder="stroke fill"
					>
						ကြာအင်းရွာ
					</text>
					<text
						x={kyarInnVillage.labelPos.x}
						y={kyarInnVillage.labelPos.z + 18}
						fill="#285e54"
						fontSize="13"
						fontWeight="600"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						Kyar Inn Village · Kalay
					</text>
					{/* အထင်ကရ နေရာ အညွှန်းများ */}
					<text
						x={kyarInnLandmarks.find(m => m.id === 'ki-school-field')!.x}
						y={kyarInnLandmarks.find(m => m.id === 'ki-school-field')!.z}
						fill="#ffffff"
						fontSize="11"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#204d1c"
						strokeWidth="2"
						paintOrder="stroke fill"
					>
						🎓 အလက ကြာအင်း (Kyarinn middle school)
					</text>
					<text
						x={kyarInnLandmarkBuildings.find(b => b.id === 'ki-church-baptist')!.x}
						y={kyarInnLandmarkBuildings.find(b => b.id === 'ki-church-baptist')!.z}
						fill="#1d4868"
						fontSize="10"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						⛪ Kyarinn Baptist Church
					</text>
					<text
						x={kyarInnLandmarkBuildings.find(b => b.id === 'ki-church-ibc')!.x}
						y={kyarInnLandmarkBuildings.find(b => b.id === 'ki-church-ibc')!.z}
						fill="#823022"
						fontSize="10"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						⛪ IBC Kyarinn
					</text>
					<text
						x={kyarInnLandmarkBuildings.find(b => b.id === 'ki-church-cjc')!.x}
						y={kyarInnLandmarkBuildings.find(b => b.id === 'ki-church-cjc')!.z}
						fill="#285375"
						fontSize="10"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						⛪ CJC Church
					</text>
					<text
						x={kyarInnLandmarkBuildings.find(b => b.id === 'ki-church-st-peter')!.x}
						y={kyarInnLandmarkBuildings.find(b => b.id === 'ki-church-st-peter')!.z}
						fill="#872f23"
						fontSize="10"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						⛪ St. Peter Catholic Church
					</text>
					<text
						x={kyarInnTaphiChaung.x}
						y={kyarInnTaphiChaung.z - 6}
						fill="#256b6b"
						fontSize="11"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						သပြေချောင်း (Taphi Chaung)
					</text>
					{/* ကြာအင်းရေကန် (Kyar Inn Lake) အမှတ်အသားနှင့် အညွှန်းများ */}
					<g>
						<circle
							cx={kyarInnLakePonds[0].x}
							cy={kyarInnLakePonds[0].z - 6}
							r="5.5"
							fill="#0f9d58"
							stroke="#ffffff"
							strokeWidth="1.5"
						/>
						<circle
							cx={kyarInnLakePonds[0].x}
							cy={kyarInnLakePonds[0].z - 6}
							r="2"
							fill="#ffffff"
						/>
						<text
							x={kyarInnLakePonds[0].x}
							y={kyarInnLakePonds[0].z - 16}
							fill="#0e5a36"
							fontSize="12"
							fontWeight="bold"
							textAnchor="middle"
							stroke="#ffffff"
							strokeWidth="3"
							paintOrder="stroke fill"
						>
							📍 Kyar Inn Lake (ကြာအင်းရေကန်)
						</text>
						<text
							x={kyarInnLakePonds[0].x}
							y={kyarInnLakePonds[0].z + 6}
							fill="#d2f2ea"
							fontSize="9"
							fontWeight="bold"
							textAnchor="middle"
						>
							ရေကန်
						</text>
						<text
							x={kyarInnLakePonds[1].x}
							y={kyarInnLakePonds[1].z}
							fill="#c9e8f0"
							fontSize="10"
							fontWeight="bold"
							textAnchor="middle"
						>
							ရေကန်
						</text>
						<text
							x={kyarInnLakeIsland.x}
							y={kyarInnLakeIsland.z + 3}
							fill="#ffffff"
							fontSize="9"
							fontWeight="bold"
							textAnchor="middle"
							stroke="#25541c"
							strokeWidth="1.5"
							paintOrder="stroke fill"
						>
							ကုန်းမြေ
						</text>
						<text
							x={kyarInnLakePonds[7].x}
							y={kyarInnLakePonds[7].z}
							fill="#c9e8f0"
							fontSize="10"
							fontWeight="bold"
							textAnchor="middle"
						>
							ရေကန်
						</text>
						<text
							x={kyarInnLakePonds[13].x}
							y={kyarInnLakePonds[13].z + 3}
							fill="#e2f5db"
							fontSize="8"
							fontWeight="bold"
							textAnchor="middle"
						>
							ရေကန်
						</text>
						<text
							x={kyarInnLakePonds[14].x}
							y={kyarInnLakePonds[14].z + 3}
							fill="#e2f5db"
							fontSize="8"
							fontWeight="bold"
							textAnchor="middle"
						>
							ရေကန်
						</text>
					</g>
				</>
			)}
		</g>
	);
}
