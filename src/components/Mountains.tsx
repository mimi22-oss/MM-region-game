import { mobileQuality } from '../game/sceneBudget';
import { StaticBatch } from './StaticBatch';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group } from 'three';
import { registerGroundRegion, releaseGroundRegion } from '../game/groundSurface.ts';
import { ward, toWorld, angle } from '../data/ward';
import { buildMountainTiles, mountainHeight, type TerrainPeak } from '../game/mountainTerrain';
import {
	MAHA_WEIPULA_BASE_GATE_UV,
	MAHA_WEIPULA_PLAZA_UV,
	MAHA_WEIPULA_SUMMIT_UV,
	WEIPULA_ROAD_CONTROL_POINTS,
	WEIPULA_VILLAGE_V_OFFSET,
	buildWeipulaRoadSegments,
	buildWeipulaSlopeFlora,
	buildWeipulaStairway,
	type MountainGrassTuftPlot,
	type MountainTreePlot,
} from '../game/weipulaClimb';
import { WeipulaRoad } from './WeipulaRoad';
import { TaungphilaMountainFeatures } from './TaungphilaMountainFeatures';
import {
	TAUNGPHILA_MOUNTAIN_WORLD,
	TAUNGPHILA_ROAD_CONTROL_POINTS,
	buildTaungphilaSlopeFlora,
} from '../game/taungphilaWorld';
import { MountainForestFixedPool } from '../game/treeResourcePool';
import { WeipulaVillageResidents } from './WeipulaVillageResidents';
import { ChinHornbillRoofEmblem, ChinTraditionalHouse } from './ChinTraditionalHouse';
import { WeipulaChinVillageTiles } from './WeipulaChinVillageTiles';
import weipulaChinVillageMeta from '../data/weipulaChinVillageDataset.json';

const distantMountainTiers = [
	// ဒုတိယဆင့် တောင်တန်းများ (Inner Chin Hills behind 1,320m Maha Weipula: v = 7400 ~ 7900)
	...[-2800, -2100, -1400, -700, 0, 700, 1400, 2100].map((u, i) => {
		const v = 7450 + (i % 3) * 180;
		const height = 1480 + (i % 4) * 140;
		const radius = 560 + (i % 3) * 60;
		return {
			id: `distant-chin-tier2-${i}`,
			u,
			v,
			...toWorld(u, v),
			height,
			radius,
			plateau: 0.06,
			skirtPower: 1.3,
			ridgeAxis: .3 + .42 * Math.sin(i),
			ridgeRelief: .2,
			color: i % 2 ? '#3b5443' : '#334c3d',
		};
	}),
	// တတိယဆင့် အဝေး မိုးကုတ်စက်ဝိုင်း ချင်းတောင်တန်းကြီးများ (High Chin Horizon Ridges: v = 8300 ~ 8800)
	...[-3200, -2200, -1200, -200, 800, 1800, 2800].map((u, i) => {
		const v = 8450 + (i % 2) * 260;
		const height = 1780 + (i % 3) * 180;
		const radius = 720 + (i % 3) * 70;
		return {
			id: `distant-chin-tier3-${i}`,
			u,
			v,
			...toWorld(u, v),
			height,
			radius,
			plateau: 0.05,
			skirtPower: 1.35,
			ridgeAxis: -.14 + .5 * Math.sin(i * 1.7),
			ridgeRelief: .26,
			color: '#3d5261',
		};
	}),
];

const foreground = [...ward.mountains, ...ward.weipula.peaks];

function RidgeSurface({ peaks, step = 10, haze = 0 }: { peaks: TerrainPeak[]; step?: number; haze?: number }) {
	const tiles = useMemo(() => buildMountainTiles(peaks, step, haze), [peaks, step, haze]);
	useEffect(() => () => {
		for (const t of tiles) t.geometry.dispose();
	}, [tiles]);
	return (
		<>
			{tiles.map(t => {
				const p = toWorld(t.u, t.v);
				return (
					<mesh
						userData={{ walkable: true }}
						key={t.key}
						position={[p.x, 0, p.z]}
						rotation={[0, angle, 0]}
						geometry={t.geometry}
						receiveShadow
					>
						<meshStandardMaterial vertexColors roughness={0.96} />
					</mesh>
				);
			})}
		</>
	);
}

/**
 * Singleton Memory Reference Cache + Fixed Object Pool Mountain Forest:
 * Uses ONE shared GPU geometry/material cache (`getTreeAssetCache()`) and a
 * pre-allocated fixed-capacity `MountainForestFixedPool` that dynamically recycles
 * tree & grass slots around the camera focus with zero object duplication or GC churn.
 */
function MountainLushForest({
	trees,
	grassTufts,
}: {
	trees: MountainTreePlot[];
	grassTufts: MountainGrassTuftPlot[];
}) {
	const pool = useMemo(() => new MountainForestFixedPool(trees, grassTufts), [trees, grassTufts]);

	useEffect(() => {
		// Seed initial visible slots from the northern valley approach facing the mountain
		const initialFocus = toWorld(MAHA_WEIPULA_BASE_GATE_UV.u, MAHA_WEIPULA_BASE_GATE_UV.v);
		pool.syncToFocus(initialFocus.x, initialFocus.z, true);
		return () => {
			pool.disposePool();
		};
	}, [pool]);

	useFrame(({ camera }) => {
		const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
		pool.syncToFocus(focus.x, focus.z);
	});

	return (
		<group name="weipula-lush-green-forest-pooled">
			{pool.meshes().map((mesh, idx) => (
				<primitive key={`mtn-forest-pool-${idx}`} object={mesh} />
			))}
		</group>
	);
}

/**
 * မဟာဝေပုလ္လတောင်ခြေ မုခ်ဦးနှင့် ခြင်္သေ့ခုံ (Base Welcome Archway at Foothill Trailhead, y ≈ 0m)
 */
function BaseMountainArchway({ x, y, z }: { x: number; y: number; z: number }) {
	return (
		<group position={[x, y, z]} rotation={[0, angle, 0]} name="weipula-base-archway">
			{/* တောင်ခြေ အဝင် ကျောက်ခင်းရင်ပြင် (Walkable Base Arrival Apron) */}
			<mesh userData={{ walkable: true }} position={[0, 0.1, 0]} receiveShadow>
				<boxGeometry args={[20, 0.24, 14]} />
				<meshStandardMaterial color="#58544c" roughness={0.86} />
			</mesh>
			{/* မုခ်ဦးတိုင်ကြီး ၂ တိုင် (Grand Burmese Pagoda Archway Pillars) */}
			{[-5.6, 5.6].map(side => (
				<group key={`base-pillar-${side}`} position={[side, 0, 2.2]}>
					<mesh position={[0, 0.8, 0]} castShadow receiveShadow>
						<boxGeometry args={[2.1, 1.6, 2.1]} />
						<meshStandardMaterial color="#e6dec9" roughness={0.75} />
					</mesh>
					<mesh position={[0, 4.4, 0]} castShadow>
						<boxGeometry args={[1.35, 6.4, 1.35]} />
						<meshStandardMaterial color="#f0e7d0" roughness={0.68} />
					</mesh>
					{/* ခြင်္သေ့ခုံနှင့် ရွှေခြင်္သေ့အမှတ်အသား (Guardian Chinthe Pedestal) */}
					<mesh position={[0, 1.0, -3.2]} castShadow>
						<boxGeometry args={[1.5, 2.0, 1.8]} />
						<meshStandardMaterial color="#dfd6be" roughness={0.78} />
					</mesh>
					<mesh position={[0, 2.65, -3.2]} castShadow>
						<coneGeometry args={[0.62, 1.5, 6]} />
						<meshStandardMaterial color="#eec648" metalness={0.35} roughness={0.42} />
					</mesh>
				</group>
			))}
			{/* မုခ်ဦး ရွှေရောင် ပြာသာဒ်အမိုး ၃ ဆင့် (3-Tier Golden & Crimson Pyatthat Roof) */}
			<group position={[0, 7.6, 2.2]}>
				<mesh position={[0, 0.35, 0]} castShadow>
					<boxGeometry args={[14.8, 0.9, 2.5]} />
					<meshStandardMaterial color="#a6362b" roughness={0.62} />
				</mesh>
				<mesh position={[0, 1.2, 0]} castShadow>
					<boxGeometry args={[11.2, 0.8, 2.0]} />
					<meshStandardMaterial color="#e8be44" metalness={0.42} roughness={0.38} />
				</mesh>
				<mesh position={[0, 2.0, 0]} castShadow>
					<boxGeometry args={[7.6, 0.72, 1.5]} />
					<meshStandardMaterial color="#f5d155" metalness={0.48} roughness={0.32} />
				</mesh>
				<mesh position={[0, 3.2, 0]} castShadow>
					<coneGeometry args={[0.75, 2.1, 8]} />
					<meshStandardMaterial color="#ffe066" metalness={0.55} roughness={0.28} />
				</mesh>
				{/* မုခ်ဦး ဆိုင်းဘုတ်ပြား (Golden Welcome Nameplate) */}
				<mesh position={[0, -0.55, -1.28]}>
					<boxGeometry args={[8.4, 1.15, 0.14]} />
					<meshStandardMaterial color="#1f3b2c" roughness={0.55} />
				</mesh>
				<mesh position={[0, -0.55, -1.36]}>
					<boxGeometry args={[7.9, 0.88, 0.04]} />
					<meshStandardMaterial color="#f2cc4d" metalness={0.35} roughness={0.4} />
				</mesh>
			</group>
		</group>
	);
}

/**
 * တောင်ခါးပန်း နားနေဇရပ် (Mid-Mountain Pilgrim Rest Pavilion along Stone Stairway)
 */
function MountainRestPavilion({ x, y, z }: { x: number; y: number; z: number }) {
	return (
		<group position={[x, y, z]} rotation={[0, angle, 0]}>
			{/* တောင်စောင်း အောက်ခံ ကျောက်နံရံ (Stone Retaining Pier into Hillside) */}
			<mesh position={[0, -6.5, 0]}>
				<boxGeometry args={[9.2, 13.0, 9.2]} />
				<meshStandardMaterial color="#514b43" roughness={0.95} />
			</mesh>
			{/* နားနေဇရပ် ကြမ်းခင်း (Walkable Rest Deck) */}
			<mesh userData={{ walkable: true }} position={[0, 0.18, 0]} receiveShadow>
				<boxGeometry args={[9.4, 0.36, 9.4]} />
				<meshStandardMaterial color="#d9cfb9" roughness={0.82} />
			</mesh>
			{/* စောင်းတန်းလှေကားနှင့် ဆက်သွယ်သော ဝင်ပေါက်တံတား (Deck Bridge to Stairway) */}
			<mesh userData={{ walkable: true }} position={[-5.4, 0.12, 0]} receiveShadow>
				<boxGeometry args={[3.4, 0.3, 4.4]} />
				<meshStandardMaterial color="#cec3ab" roughness={0.84} />
			</mesh>
			{/* သစ်သားတိုင် ၄ တိုင် */}
			{[-3.4, 3.4].flatMap(px =>
				[-3.4, 3.4].map(pz => (
					<mesh key={`zpost-${px}-${pz}`} position={[px, 2.2, pz]} castShadow>
						<cylinderGeometry args={[0.18, 0.22, 4.0, 8]} />
						<meshStandardMaterial color="#543622" roughness={0.85} />
					</mesh>
				))
			)}
			{/* ဇရပ် နှစ်ထပ် ခေါင်မိုး */}
			<mesh position={[0, 4.35, 0]} castShadow>
				<boxGeometry args={[10.4, 0.55, 10.4]} />
				<meshStandardMaterial color="#8f3b2e" roughness={0.68} />
			</mesh>
			<mesh position={[0, 5.15, 0]} castShadow>
				<boxGeometry args={[7.2, 0.6, 7.2]} />
				<meshStandardMaterial color="#a34434" roughness={0.65} />
			</mesh>
			<mesh position={[0, 6.1, 0]}>
				<coneGeometry args={[0.55, 1.4, 6]} />
				<meshStandardMaterial color="#f5d155" metalness={0.5} roughness={0.3} />
			</mesh>
			{/* ကျောက်ထိုင်ခုံတန်း ၂ လုံး */}
			{[-2.4, 2.4].map(bz => (
				<mesh key={`zbench-${bz}`} position={[2.2, 0.62, bz]}>
					<boxGeometry args={[1.1, 0.52, 2.8]} />
					<meshStandardMaterial color="#c9bfa9" roughness={0.82} />
				</mesh>
			))}
		</group>
	);
}

/**
 * ဝေပုလ္လ ရှုခင်းသာ ကော်ဖီနှင့် လက်ဖက်ရည်ဆိုင် (Panoramic Mountain Tea & Coffee Pavilion)
 */
function MountainVillageTeaShop({ u, v, baseY }: { u: number; v: number; baseY: number }) {
	const pos = toWorld(u, v);
	return (
		<group position={[pos.x, baseY, pos.z]} rotation={[0, angle, 0]}>
			{/* ရှုခင်းသာ လက်ဖက်ရည်ဆိုင် ပင်မအဆောက်အအုံ ပလက်ဖောင်း (Main Shop Walkable Deck) */}
			<mesh userData={{ walkable: true }} position={[0, 0.45, 0]} receiveShadow>
				<boxGeometry args={[11.5, 0.4, 8.5]} />
				<meshStandardMaterial color="#63452b" roughness={0.8} />
			</mesh>

			{/* ချောက်ကမ်းပါးဘက် ထိုးထွက်နေသော ရှုခင်းကြည့် လသာဆောင်ကြမ်းခင်း (Cantilevered View Deck) */}
			<mesh userData={{ walkable: true }} position={[0, 0.45, 5.5]} receiveShadow>
				<boxGeometry args={[12.5, 0.4, 3.2]} />
				<meshStandardMaterial color="#7a5536" roughness={0.8} />
			</mesh>

			{/* လသာဆောင် သစ်သားအကာလက်ရန်း (Observation Deck Safety Railing) */}
			<group position={[0, 1.2, 7.0]}>
				<mesh position={[0, 0, 0]}>
					<boxGeometry args={[12.5, 0.12, 0.15]} />
					<meshStandardMaterial color="#47301e" roughness={0.85} />
				</mesh>
				{[-5.8, -2.9, 0, 2.9, 5.8].map(rx => (
					<mesh key={`deck-post-${rx}`} position={[rx, -0.35, 0]}>
						<boxGeometry args={[0.18, 0.7, 0.18]} />
						<meshStandardMaterial color="#47301e" roughness={0.85} />
					</mesh>
				))}
			</group>

			{/* တိုင်လုံး ၆ တိုင် (Carved Timber Pavilion Posts) */}
			{[-4.8, 0, 4.8].flatMap(px =>
				[-3.4, 3.4].map(pz => (
					<mesh key={`post-${px}-${pz}`} position={[px, 2.2, pz]} castShadow>
						<cylinderGeometry args={[0.18, 0.22, 3.5, 8]} />
						<meshStandardMaterial color="#422d1d" roughness={0.85} />
					</mesh>
				))
			)}

			{/* ရိုးရာ သွပ်မိုး/သက်ငယ်မိုး ခေါင်မိုးအဆင့်ဆင့် (Traditional Tiered Thatched Roof) */}
			<group position={[0, 4.2, 0]}>
				<mesh position={[0, 0.3, 0]} castShadow>
					<boxGeometry args={[12.8, 0.35, 9.8]} />
					<meshStandardMaterial color="#694025" roughness={0.7} />
				</mesh>
				<mesh position={[0, 0.8, 0]} castShadow>
					<boxGeometry args={[9.5, 0.5, 7.0]} />
					<meshStandardMaterial color="#75482b" roughness={0.65} />
				</mesh>
				<mesh position={[0, 1.3, 0]} castShadow>
					<boxGeometry args={[5.8, 0.45, 4.2]} />
					<meshStandardMaterial color="#825131" roughness={0.6} />
				</mesh>
				<ChinHornbillRoofEmblem position={[0, 1.54, 0.1]} scale={1.15} />
			</group>

			{/* လက်ဖက်ရည်ဆိုင် ကောင်တာ (Tea Counter & Kettle) */}
			<group position={[-2.8, 1.05, -1.8]}>
				<mesh position={[0, 0, 0]} castShadow>
					<boxGeometry args={[4.2, 0.8, 1.2]} />
					<meshStandardMaterial color="#503723" roughness={0.8} />
				</mesh>
				<mesh position={[-1.2, 0.55, 0]}>
					<cylinderGeometry args={[0.2, 0.25, 0.35, 8]} />
					<meshStandardMaterial color="#b39247" metalness={0.7} roughness={0.3} />
				</mesh>
				<mesh position={[-0.5, 0.52, 0]}>
					<cylinderGeometry args={[0.15, 0.15, 0.38, 8]} />
					<meshStandardMaterial color="#c24434" roughness={0.5} />
				</mesh>
			</group>

			{/* စားပွဲဝိုင်းများနှင့် ထိုင်ခုံငယ်များ (Tea Tables & Stools) */}
			{[
				{ tx: 2.2, tz: -1.0 },
				{ tx: -2.0, tz: 3.8 },
				{ tx: 2.2, tz: 3.8 },
			].map((tbl, i) => (
				<group key={`tea-table-${i}`} position={[tbl.tx, 0.65, tbl.tz]}>
					<mesh position={[0, 0.35, 0]} castShadow>
						<cylinderGeometry args={[0.85, 0.85, 0.1, 12]} />
						<meshStandardMaterial color="#735134" roughness={0.7} />
					</mesh>
					<mesh position={[0, 0.15, 0]}>
						<cylinderGeometry args={[0.1, 0.1, 0.4, 8]} />
						<meshStandardMaterial color="#382517" roughness={0.85} />
					</mesh>
					{[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((ang, si) => (
						<mesh key={`stool-${si}`} position={[Math.cos(ang) * 1.15, 0.2, Math.sin(ang) * 1.15]} castShadow>
							<cylinderGeometry args={[0.25, 0.25, 0.35, 8]} />
							<meshStandardMaterial color="#543823" roughness={0.8} />
						</mesh>
					))}
				</group>
			))}

			{/* ရှုခင်းသာ လက်ဖက်ရည်ဆိုင် ဆိုင်းဘုတ် (Tea Shop Wooden Signboard) */}
			<group position={[0, 3.8, 4.3]}>
				<mesh position={[0, 0, 0]}>
					<boxGeometry args={[4.8, 0.7, 0.12]} />
					<meshStandardMaterial color="#4a2f1c" roughness={0.85} />
				</mesh>
				<mesh position={[0, 0, 0.07]}>
					<boxGeometry args={[4.4, 0.5, 0.02]} />
					<meshStandardMaterial color="#ebc959" roughness={0.4} />
				</mesh>
			</group>

			{/* ဆိုင်ကယ် ရပ်နားရန် ကွင်းပြင် (Front Motorcycle Parking Apron) */}
			<mesh userData={{ walkable: true }} position={[0, 0.12, -5.2]} receiveShadow>
				<boxGeometry args={[11.5, 0.15, 2.6]} />
				<meshStandardMaterial color="#58524a" roughness={0.85} />
			</mesh>
		</group>
	);
}

/**
 * ရွာအဝင် သစ်သား မုခ်ဦး (Traditional Village Welcome Gate)
 */
function VillageWelcomeGate({ u, v, baseY }: { u: number; v: number; baseY: number }) {
	const pos = toWorld(u, v);
	return (
		<group position={[pos.x, baseY, pos.z]} rotation={[0, angle, 0]}>
			{[-4.2, 4.2].map(gx => (
				<mesh key={`gate-post-${gx}`} position={[gx, 2.8, 0]} castShadow>
					<boxGeometry args={[0.5, 5.6, 0.5]} />
					<meshStandardMaterial color="#4a301f" roughness={0.85} />
				</mesh>
			))}
			<group position={[0, 5.4, 0]}>
				<mesh position={[0, 0.25, 0]} castShadow>
					<boxGeometry args={[10.2, 0.45, 1.8]} />
					<meshStandardMaterial color="#6e3f26" roughness={0.7} />
				</mesh>
				<mesh position={[0, 0.75, 0]} castShadow>
					<boxGeometry args={[7.4, 0.45, 1.4]} />
					<meshStandardMaterial color="#804a2c" roughness={0.65} />
				</mesh>
				<ChinHornbillRoofEmblem position={[0, 0.98, 0]} rotationY={Math.PI} scale={1.25} />
			</group>
			<mesh position={[0, 4.4, 0]}>
				<boxGeometry args={[6.2, 0.75, 0.12]} />
				<meshStandardMaterial color="#ebc959" roughness={0.4} />
			</mesh>
		</group>
	);
}

/**
 * ရွာတွင်း လမ်းမီးတိုင် (Village Street Lantern)
 */
function VillageStreetLantern({ x, y, z }: { x: number; y: number; z: number }) {
	return (
		<group position={[x, y, z]} rotation={[0, angle, 0]}>
			<mesh position={[0, 1.8, 0]}>
				<cylinderGeometry args={[0.08, 0.12, 3.6, 8]} />
				<meshStandardMaterial color="#3a3e40" metalness={0.6} roughness={0.4} />
			</mesh>
			<mesh position={[0, 3.5, 0]}>
				<boxGeometry args={[0.55, 0.65, 0.55]} />
				<meshStandardMaterial color="#4a4f52" roughness={0.6} />
			</mesh>
			<mesh position={[0, 3.5, 0]}>
				<sphereGeometry args={[0.22, 8, 8]} />
				<meshBasicMaterial color="#fff4c2" />
			</mesh>
		</group>
	);
}

/**
 * အဆင့်ဆင့် ဆက်သွယ်ထားသော ဆိုင်ကယ်တက်လမ်းနှင့် ကျောက်လှေကား (Ramp & Stairs Connecting Tiers)
 */
function VillageTierConnection({
	uRamp,
	uStairs,
	vMid,
	vLength,
	yBottom,
	yTop,
}: {
	uRamp: number;
	uStairs: number;
	vMid: number;
	vLength: number;
	yBottom: number;
	yTop: number;
}) {
	const rampPos = toWorld(uRamp, vMid);
	const yMid = (yBottom + yTop) / 2;
	const rise = yTop - yBottom;
	const pitch = Math.atan2(rise, vLength);
	const hyp = Math.hypot(rise, vLength);

	const steps = useMemo(() => {
		const arr: { pos: { x: number; z: number }; y: number; key: string }[] = [];
		const count = 20;
		for (let i = 0; i < count; i++) {
			const t = (i + 0.5) / count;
			const v = vMid - vLength / 2 + t * vLength;
			const y = yBottom + t * rise;
			arr.push({ pos: toWorld(uStairs, v), y, key: `step-${i}` });
		}
		return arr;
	}, [uStairs, vMid, vLength, yBottom, rise]);

	return (
		<>
			{/* ၁။ ဆိုင်ကယ်နှင့် လူသွား ဆင်ခြေလျှော ကျောက်ခင်းလမ်း (Ridable Motorcycle Ramp) */}
			<group position={[rampPos.x, yMid, rampPos.z]} rotation={[0, angle, 0]}>
				<mesh userData={{ walkable: true }} rotation={[-pitch, 0, 0]} receiveShadow>
					<boxGeometry args={[4.4, 0.35, hyp + 0.5]} />
					<meshStandardMaterial color="#554f48" roughness={0.88} />
				</mesh>
				{[-2.25, 2.25].map(side => (
					<mesh key={`ramp-curb-${side}`} position={[side, 0.25, 0]} rotation={[-pitch, 0, 0]}>
						<boxGeometry args={[0.3, 0.35, hyp + 0.5]} />
						<meshStandardMaterial color="#3d3731" roughness={0.9} />
					</mesh>
				))}
			</group>

			{/* ၂။ လူသွား ကျောက်လှေကားထစ် ၂၀ ဆင့် (Walkable Pedestrian Stone Staircase) */}
			{steps.map(s => (
				<mesh userData={{ walkable: true }} key={s.key} position={[s.pos.x, s.y, s.pos.z]} rotation={[0, angle, 0]} receiveShadow>
					<boxGeometry args={[2.8, 0.175, vLength / 20 + 0.15]} />
					<meshStandardMaterial color="#68635c" roughness={0.85} />
				</mesh>
			))}
			{/* လှေကားလက်ရန်း (Timber Handrails running along stairs) */}
			{[-1.45, 1.45].map(side => {
				const stairsMid = toWorld(uStairs + side, vMid);
				return (
					<group key={`stairs-rail-${side}`} position={[stairsMid.x, yMid + 0.65, stairsMid.z]} rotation={[0, angle, 0]}>
						<mesh rotation={[-pitch, 0, 0]}>
							<boxGeometry args={[0.12, 0.12, hyp]} />
							<meshStandardMaterial color="#4a311f" roughness={0.85} />
						</mesh>
					</group>
				);
			})}
		</>
	);
}

/**
 * စေတီတော် ရင်ပြင်နှင့် တောင်ပေါ်လမ်းမများ ဆက်သွယ်သော လမ်းမ (Summit Connecting Avenue)
 */
function SummitConnectingAvenue({
	uFrom,
	vFrom,
	yFrom,
	uTo,
	vTo,
	yTo,
	width = 6.0,
}: {
	uFrom: number;
	vFrom: number;
	yFrom: number;
	uTo: number;
	vTo: number;
	yTo: number;
	width?: number;
}) {
	const midU = (uFrom + uTo) / 2;
	const midV = (vFrom + vTo) / 2;
	const midPos = toWorld(midU, midV);
	const midY = (yFrom + yTo) / 2;
	const du = uTo - uFrom;
	const dv = vTo - vFrom;
	const len = Math.hypot(du, dv);
	const dy = yTo - yFrom;
	const hyp = Math.hypot(len, dy);
	const segAngle = angle + Math.atan2(du, dv);
	const pitch = Math.atan2(dy, len);

	return (
		<group position={[midPos.x, midY, midPos.z]} rotation={[0, segAngle, 0]}>
			<mesh position={[0, -4.5, 0]} rotation={[-pitch, 0, 0]}>
				<boxGeometry args={[width + 0.6, 8.8, hyp + 0.4]} />
				<meshStandardMaterial color="#4a443c" roughness={0.95} />
			</mesh>
			<mesh userData={{ walkable: true }} rotation={[-pitch, 0, 0]} receiveShadow>
				<boxGeometry args={[width, 0.24, hyp + 0.7]} />
				<meshStandardMaterial color="#4e5354" roughness={0.85} />
			</mesh>
		</group>
	);
}

/**
 * ဝေပုလ္လ လှေကားထစ်ရွာ ပင်မကွန်ပိုးနန့် (Weipula Terraced Mountain Village Complex)
 * Anchored dynamically to the NE foothill ridge south of the 10 Nat Myaung separation paddy fields.
 */
function WeipulaVillage() {
	const vOff = WEIPULA_VILLAGE_V_OFFSET;
	const ridgeTopY = mountainHeight(-335, 4461 + vOff, foreground);
	const t4Y = ridgeTopY;
	const t3Y = t4Y - 5.0;
	const t2Y = t3Y - 5.0;
	const t1Y = t2Y - 5.0;
	const tierElevations = [t1Y, t2Y, t3Y, t4Y];

	const t1Pos = toWorld(-335, 4380 + vOff);
	const t2Pos = toWorld(-335, 4407 + vOff);
	const t3Pos = toWorld(-335, 4434 + vOff);
	const t4Pos = toWorld(-335, 4461 + vOff);

	const lanterns = [
		toWorld(-352, 4373 + vOff),
		toWorld(-318, 4373 + vOff),
		toWorld(-352, 4400 + vOff),
		toWorld(-318, 4400 + vOff),
		toWorld(-352, 4427 + vOff),
		toWorld(-318, 4427 + vOff),
		toWorld(-352, 4454 + vOff),
		toWorld(-318, 4454 + vOff),
	];

	return (
		<group name="weipula-terraced-village">
			{/* ===== TIER 1: တောင်စောင်း ရွာအဝင် အဆင့် (Lower Entrance Terrace) ===== */}
			<group position={[t1Pos.x, t1Y, t1Pos.z]} rotation={[0, angle, 0]}>
				<mesh position={[0, -24.0, 0]}>
					<boxGeometry args={[42.6, 48.0, 18.6]} />
					<meshStandardMaterial color="#464038" roughness={0.95} />
				</mesh>
				<mesh userData={{ walkable: true }} position={[0, 0.05, 0]} receiveShadow>
					<boxGeometry args={[42.0, 0.3, 18.0]} />
					<meshStandardMaterial color="#57514a" roughness={0.88} />
				</mesh>
				<mesh userData={{ walkable: true }} position={[0, 0.22, -5.5]}>
					<boxGeometry args={[42.0, 0.08, 5.0]} />
					<meshStandardMaterial color="#474c4d" roughness={0.85} />
				</mesh>
			</group>

			<VillageWelcomeGate u={-335} v={4371 + vOff} baseY={t1Y} />

			<ChinTraditionalHouse
				u={-345}
				v={4382 + vOff}
				baseY={t1Y}
				width={8.0}
				depth={7.0}
				height={3.8}
				wallColor="#66462c"
				roofColor="#783b2e"
				title="တောင်စောင်း ပန်းဥယျာဉ်အိမ်"
			/>

			<ChinTraditionalHouse
				u={-326}
				v={4382 + vOff}
				baseY={t1Y}
				width={8.5}
				depth={7.5}
				height={3.6}
				wallColor="#7a5635"
				roofColor="#4f3d2e"
				title="တောင်သူ စိုက်ပျိုးရေးအိမ်"
				hasDryingRack
			/>

			{/* CONNECTION: TIER 1 -> TIER 2 */}
			<VillageTierConnection
				uRamp={-351}
				uStairs={-319}
				vMid={4394.5 + vOff}
				vLength={11.0}
				yBottom={t1Y}
				yTop={t2Y}
			/>

			{/* ===== TIER 2: ရွာလယ် ယဉ်ကျေးမှု အဆင့် (Middle Heritage Terrace) ===== */}
			<group position={[t2Pos.x, t2Y, t2Pos.z]} rotation={[0, angle, 0]}>
				<mesh position={[0, -24.0, 0]}>
					<boxGeometry args={[42.6, 48.0, 18.6]} />
					<meshStandardMaterial color="#464038" roughness={0.95} />
				</mesh>
				<mesh userData={{ walkable: true }} position={[0, 0.05, 0]} receiveShadow>
					<boxGeometry args={[42.0, 0.3, 18.0]} />
					<meshStandardMaterial color="#57514a" roughness={0.88} />
				</mesh>
				<mesh userData={{ walkable: true }} position={[0, 0.22, -5.5]}>
					<boxGeometry args={[42.0, 0.08, 5.0]} />
					<meshStandardMaterial color="#474c4d" roughness={0.85} />
				</mesh>
			</group>

			<ChinTraditionalHouse
				u={-345}
				v={4409 + vOff}
				baseY={t2Y}
				width={8.0}
				depth={7.5}
				height={3.8}
				wallColor="#704e33"
				roofColor="#854637"
				title="ချင်းရိုးရာ ယက္ကန်းအိမ်"
				hasLoom
				hornbillScale={1.2}
			/>

			<ChinTraditionalHouse
				u={-326}
				v={4409 + vOff}
				baseY={t2Y}
				width={9.0}
				depth={8.0}
				height={5.2}
				wallColor="#4a2e1b"
				roofColor="#2d4b38"
				title="တောင်ပေါ် နှစ်ထပ် ပျဉ်ထောင်အိမ်ကြီး"
				hornbillScale={1.25}
			/>

			{/* CONNECTION: TIER 2 -> TIER 3 */}
			<VillageTierConnection
				uRamp={-351}
				uStairs={-319}
				vMid={4421.5 + vOff}
				vLength={11.0}
				yBottom={t2Y}
				yTop={t3Y}
			/>

			{/* ===== TIER 3: တောင်ပေါ်ရှုခင်းသာ အဆင့် (Viewpoint & Tea House) ===== */}
			<group position={[t3Pos.x, t3Y, t3Pos.z]} rotation={[0, angle, 0]}>
				<mesh position={[0, -24.0, 0]}>
					<boxGeometry args={[42.6, 48.0, 18.6]} />
					<meshStandardMaterial color="#464038" roughness={0.95} />
				</mesh>
				<mesh userData={{ walkable: true }} position={[0, 0.05, 0]} receiveShadow>
					<boxGeometry args={[42.0, 0.3, 18.0]} />
					<meshStandardMaterial color="#57514a" roughness={0.88} />
				</mesh>
				<mesh userData={{ walkable: true }} position={[0, 0.22, -5.5]}>
					<boxGeometry args={[42.0, 0.08, 5.0]} />
					<meshStandardMaterial color="#474c4d" roughness={0.85} />
				</mesh>
			</group>

			<MountainVillageTeaShop u={-345} v={4436 + vOff} baseY={t3Y} />

			<ChinTraditionalHouse
				u={-325}
				v={4436 + vOff}
				baseY={t3Y}
				width={8.0}
				depth={7.5}
				height={3.8}
				wallColor="#5e442c"
				roofColor="#52463e"
				title="တောင်စောင်း ဧည့်ရိပ်သာ"
				hasChimney
			/>

			{/* CONNECTION: TIER 3 -> TIER 4 */}
			<VillageTierConnection
				uRamp={-351}
				uStairs={-319}
				vMid={4448.5 + vOff}
				vLength={11.0}
				yBottom={t3Y}
				yTop={t4Y}
			/>

			{/* ===== TIER 4: တောင်ထိပ် ရွာသူကြီးနှင့် ဆေးပေးခန်း အဆင့် (Upper Elder & Clinic) ===== */}
			<group position={[t4Pos.x, t4Y, t4Pos.z]} rotation={[0, angle, 0]}>
				<mesh position={[0, -24.0, 0]}>
					<boxGeometry args={[42.6, 48.0, 18.6]} />
					<meshStandardMaterial color="#464038" roughness={0.95} />
				</mesh>
				<mesh userData={{ walkable: true }} position={[0, 0.05, 0]} receiveShadow>
					<boxGeometry args={[42.0, 0.3, 18.0]} />
					<meshStandardMaterial color="#57514a" roughness={0.88} />
				</mesh>
				<mesh userData={{ walkable: true }} position={[0, 0.22, -5.5]}>
					<boxGeometry args={[42.0, 0.08, 5.0]} />
					<meshStandardMaterial color="#474c4d" roughness={0.85} />
				</mesh>
			</group>

			<ChinTraditionalHouse
				u={-345}
				v={4463 + vOff}
				baseY={t4Y}
				width={9.5}
				depth={8.5}
				height={4.6}
				wallColor="#5c381e"
				roofColor="#823c2d"
				title="ရွာသူကြီး အိမ်"
				hasFlag
				hornbillScale={1.38}
			/>

			<ChinTraditionalHouse
				u={-325}
				v={4463 + vOff}
				baseY={t4Y}
				width={8.5}
				depth={7.5}
				height={3.8}
				wallColor="#dde2d8"
				roofColor="#285438"
				title="တောင်ပေါ် ကျေးလက်ဆေးပေးခန်း"
				hasClinicCross
				hornbillScale={1.1}
			/>

			{/* ရွာတွင်း လမ်းမီးတိုင်များ (Village Street Lanterns) */}
			{lanterns.map((l, i) => (
				<VillageStreetLantern
					key={`village-lamp-${i}`}
					x={l.x}
					y={tierElevations[Math.floor(i / 2)]}
					z={l.z}
				/>
			))}
		</group>
	);
}

export function Mountains() {
	const { scene } = useThree();
	const mountainRoot = useRef<Group>(null);

	useEffect(() => {
		if (mountainRoot.current) {
			registerGroundRegion(scene, 'mountains', mountainRoot.current);
		}
		return () => {
			releaseGroundRegion(scene, 'mountains');
		};
	}, [scene]);

	const summit = ward.weipula.peaks[2];
	const summitHeight = useMemo(
		() => mountainHeight(summit.u, summit.v, foreground),
		[summit.u, summit.v]
	);

	// ဝေပုလ္လ လှေကားထစ်ရွာ အဆင့် ၄ ဆင့်၏ အမြင့်များ (shared between village terraces & animated residents)
	const villageTierElevations = useMemo<[number, number, number, number]>(() => {
		const t4Y = mountainHeight(-335, 4461 + WEIPULA_VILLAGE_V_OFFSET, foreground);
		return [t4Y - 15.0, t4Y - 10.0, t4Y - 5.0, t4Y];
	}, []);

	// ၁။ တောင်တက်ကွေ့လမ်း အပိုင်းများ (Pitched 3D Switchback Mountain Road from Base to Summit)
	const roadSegments = useMemo(() => buildWeipulaRoadSegments(foreground), []);

	// ၂။ မြောက်ဘက် တောင်တက် စောင်းတန်း ကျောက်လှေကားနှင့် နားနေဇရပ်များ
	const stairway = useMemo(() => buildWeipulaStairway(foreground), []);

	// ၃။ တောင်တစ်ခုလုံး (မဟာဝေပုလ္လ + တောင်ဖီလာ + အနောက်တောင်တန်း) စိမ်းစိုနေစေမည့် ထင်းရှူးပင်၊ သစ်ပင်နှင့် မြက်ခင်းချုံပုတ်များ
	const slopeFlora = useMemo(() => {
		const weipula = buildWeipulaSlopeFlora(foreground, mobileQuality);
		const taungphila = buildTaungphilaSlopeFlora(foreground, mobileQuality);
		return {
			trees: [...weipula.trees, ...taungphila.trees],
			grassTufts: [...weipula.grassTufts, ...taungphila.grassTufts],
		};
	}, []);

	// တောင်ခြေ မုခ်ဦး တည်နေရာ (Base Foothill Archway, y ≈ 0m)
	const baseGatePos = useMemo(() => {
		const p = toWorld(MAHA_WEIPULA_BASE_GATE_UV.u, MAHA_WEIPULA_BASE_GATE_UV.v);
		const h = mountainHeight(MAHA_WEIPULA_BASE_GATE_UV.u, MAHA_WEIPULA_BASE_GATE_UV.v, foreground);
		return { x: p.x, y: h, z: p.z };
	}, []);

	// တောင်ထိပ် ကားရပ်နားစခန်း အလယ်ဗဟို (Summit Parking Plaza right north of Pagoda)
	const plazaPos = useMemo(() => {
		const p = toWorld(MAHA_WEIPULA_PLAZA_UV.u, MAHA_WEIPULA_PLAZA_UV.v);
		return { x: p.x, y: summitHeight + 0.06, z: p.z };
	}, [summitHeight]);

	return (
		<group ref={mountainRoot} name="forested-ridge-terrain">
			{/* ၁။ သဘာဝ တောင်တန်း မျက်နှာပြင် (Sculpted 1,320m Climbable Mountain Massif & Distant Chin Hills) */}
			<RidgeSurface peaks={foreground} step={mobileQuality ? 30 : 20} />
			<RidgeSurface peaks={distantMountainTiers} step={mobileQuality ? 80 : 60} haze={0.55} />

			{/* ၂။ တောင်ခြေ မုခ်ဦး (Base Foothill Welcome Archway — Climb Trailhead at y ≈ 0m) */}
			<BaseMountainArchway x={baseGatePos.x} y={baseGatePos.y} z={baseGatePos.z} />

			<WeipulaRoad segments={roadSegments} peaks={foreground} />

			{/* ၃.၅။ တောင်ဖီလာတောင် ဆိုင်ကယ်တောင်တက်လမ်း၊ ရေကန်၊ ဇရပ်၊ တောရဘုန်းကြီးကျောင်းနှင့် စေတီတော်များ */}
			<TaungphilaMountainFeatures peaks={foreground} />

			{/* ၄။ မဟာဝေပုလ္လ တောင်တက် ကျောက်လှေကား စောင်းတန်း (Clearly Visible Pilgrim Stone Stairway from Base to 1,320m Summit) */}
			<group name="weipula-pilgrim-stairway">
				{stairway.flights.map(f => (
					<group key={f.key} position={[f.x, f.y, f.z]} rotation={[0, angle, 0]}>
						{/* လှေကားအောက်ခံ ကျောက်ခုံ (Deep Retaining Stone Pier into Mountain Spine) */}
						<mesh position={[0, -14.0, 0]} rotation={[-f.pitch, 0, 0]}>
							<boxGeometry args={[7.2, 27.6, f.hyp + 0.6]} />
							<meshStandardMaterial color="#676054" roughness={0.94} />
						</mesh>
						{/* ချောမွေ့စွာ တက်နိုင်သော လှေကားမျက်နှာပြင် (Continuous Walkable Stairway Ramp) */}
						<mesh userData={{ walkable: true }} rotation={[-f.pitch, 0, 0]} receiveShadow>
							<boxGeometry args={[6.0, 0.3, f.hyp + 1.0]} />
							<meshStandardMaterial color="#dfd5bf" roughness={0.8} />
						</mesh>
						{/* လှေကားထစ် အရိပ်အယောင် ကျောက်တန်းများ (Visual Stone Step Treads) */}
						{!mobileQuality &&
							[-0.36, -0.12, 0.12, 0.36].map((frac, si) => (
								<mesh
									key={`tread-${si}`}
									position={[0, 0.17 + Math.sin(f.pitch) * f.hyp * frac, Math.cos(f.pitch) * f.hyp * frac]}
								>
									<boxGeometry args={[5.6, 0.14, 0.36]} />
									<meshStandardMaterial color="#ede6d6" roughness={0.78} />
								</mesh>
							))}
						{/* ဘေးနှစ်ဖက် အဖြူရောင် စောင်းတန်း လက်ရန်းနံရံ (Bright Whitewashed Pagoda Parapet) */}
						{[-3.2, 3.2].map(side => (
							<mesh key={`parapet-${side}`} position={[side, 0.68, 0]} rotation={[-f.pitch, 0, 0]}>
								<boxGeometry args={[0.46, 1.15, f.hyp + 0.5]} />
								<meshStandardMaterial color="#f5f0e4" roughness={0.72} />
							</mesh>
						))}
						{/* စောင်းတန်း မီးတိုင် (Warm Golden Stairway Lanterns) */}
						{f.hasLantern && (
							<group position={[2.85, 1.0, -f.horizLen * 0.45]}>
								<mesh position={[0, 1.1, 0]}>
									<cylinderGeometry args={[0.07, 0.1, 2.2, 6]} />
									<meshStandardMaterial color="#4a4035" roughness={0.7} />
								</mesh>
								<mesh position={[0, 2.3, 0]}>
									<sphereGeometry args={[0.24, 8, 8]} />
									<meshBasicMaterial color="#ffe999" />
								</mesh>
							</group>
						)}
					</group>
				))}

				{/* တောင်ခါးပန်း နားနေဇရပ် ၂ ဆောင် (Mid-Mountain Pilgrim Rest Pavilions) */}
				{stairway.pavilions.map(pav => (
					<MountainRestPavilion key={pav.key} x={pav.x} y={pav.y} z={pav.z} />
				))}
			</group>

			{/* ၅။ တောင်ထိပ် ကားရပ်နားစခန်းနှင့် ရင်ပြင်တော်အဝင် (Summit Plaza & Vehicle Turnaround) */}
			<group position={[plazaPos.x, plazaPos.y, plazaPos.z]} rotation={[0, angle, 0]}>
				{/* တောင်ထိပ် ကားရပ်နားကွင်း အောက်ခံ ကျောက်နံရံ */}
				<mesh position={[0, -5.5, 0]}>
					<boxGeometry args={[44.6, 11.0, 26.6]} />
					<meshStandardMaterial color="#4b453d" roughness={0.95} />
				</mesh>
				{/* ကတ္တရာခင်း ကားရပ်နားကွင်းပြင် (Paved Plaza Deck) */}
				<mesh userData={{ walkable: true }} position={[0, 0.05, 0]} receiveShadow>
					<boxGeometry args={[44, 0.2, 26]} />
					<meshStandardMaterial color="#4a5051" roughness={0.85} />
				</mesh>
				{/* ကားရပ်နားမျဉ်းဖြူများ (Parking Stall Markings) */}
				{[-14, -7, 0, 7, 14].map(px => (
					<mesh key={px} position={[px, 0.16, -6]}>
						<boxGeometry args={[0.2, 0.01, 7]} />
						<meshBasicMaterial color="#ffffff" />
					</mesh>
				))}

				{/* မုခ်ဦးတံခါးကြီး (Welcome Archway Gate to Pagoda) */}
				<group position={[0, 0.1, 13]}>
					{/* မုခ်ဦးတိုင် ၂ တိုင် */}
					{[-6.5, 6.5].map(side => (
						<mesh key={side} position={[side, 3.2, 0]} castShadow>
							<boxGeometry args={[1.2, 6.4, 1.2]} />
							<meshStandardMaterial color="#d4c7a5" roughness={0.7} />
						</mesh>
					))}
					{/* မုခ်ဦးခေါင်မိုး ရွှေရောင်ပြာသာဒ် (Ornate Golden Tiered Archway Roof) */}
					<mesh position={[0, 6.8, 0]} castShadow>
						<boxGeometry args={[15.6, 0.8, 2.2]} />
						<meshStandardMaterial color="#b23e32" roughness={0.6} />
					</mesh>
					<mesh position={[0, 7.6, 0]} castShadow>
						<boxGeometry args={[12.0, 0.8, 1.8]} />
						<meshStandardMaterial color="#ebc34e" metalness={0.4} roughness={0.4} />
					</mesh>
					<mesh position={[0, 8.4, 0]} castShadow>
						<boxGeometry args={[8.5, 0.7, 1.4]} />
						<meshStandardMaterial color="#fad755" metalness={0.5} roughness={0.3} />
					</mesh>
					<mesh position={[0, 9.4, 0]}>
						<coneGeometry args={[0.6, 1.6, 6]} />
						<meshStandardMaterial color="#ffe168" />
					</mesh>
				</group>

				{/* ကားရပ်နားကွင်းပြင် မီးတိုင်များ (Plaza Lamp Posts) */}
				{[-19, 19].map(side => (
					<group key={side} position={[side, 0.1, -10]}>
						<mesh position={[0, 3.0, 0]} castShadow>
							<cylinderGeometry args={[0.1, 0.16, 6, 8]} />
							<meshStandardMaterial color="#3b4447" metalness={0.6} roughness={0.4} />
						</mesh>
						<mesh position={[0, 6.0, 0]}>
							<sphereGeometry args={[0.45, 8, 8]} />
							<meshBasicMaterial color="#fffae0" />
						</mesh>
					</group>
				))}

				{/* တောင်ပေါ်ရောက် ကားအမှတ်အသား (Parked Mountain Sightseeing 4x4 Vehicle) */}
				<group position={[-7, 0.1, -6]} rotation={[0, 0, 0]}>
					{/* ယာဉ်ကိုယ်ထည် (Rugged 4x4 Sightseeing Jeep) */}
					<mesh position={[0, 0.85, 0]} castShadow>
						<boxGeometry args={[2.2, 1.1, 4.2]} />
						<meshStandardMaterial color="#d45b2c" roughness={0.5} />
					</mesh>
					{/* အမိုးနှင့် မှန်ခန်း (Cabin & Roof) */}
					<mesh position={[0, 1.65, -0.2]} castShadow>
						<boxGeometry args={[2.0, 0.8, 2.6]} />
						<meshStandardMaterial color="#2d3336" roughness={0.4} />
					</mesh>
					{/* ဘီး ၄ ဘီး (All-Terrain Wheels) */}
					{[-1.15, 1.15].flatMap(wx =>
						[-1.3, 1.3].map(wz => (
							<mesh key={`${wx}-${wz}`} position={[wx, 0.42, wz]} rotation={[0, 0, Math.PI / 2]}>
								<cylinderGeometry args={[0.42, 0.42, 0.35, 12]} />
								<meshStandardMaterial color="#1a1c1d" roughness={0.9} />
							</mesh>
						))
					)}
				</group>
			</group>

			{/* ၆။ မဟာဝေပုလ္လ ထိပ်ဖူးစေတီတော်မြတ်ကြီးနှင့် ရင်ပြင်တော် ပရဝုဏ် (Grand Mountaintop Pagoda Complex) */}
			<group position={[summit.x, summitHeight, summit.z]} rotation={[0, angle, 0]}>
				{/* ရင်ပြင်တော် အောက်ခံ တောင်ထိပ်ကျောက်အုတ်မြစ် */}
				<mesh position={[0, -5.4, 0]}>
					<boxGeometry args={[35.0, 11.2, 35.0]} />
					<meshStandardMaterial color="#585249" roughness={0.94} />
				</mesh>
				{/* (က) ရင်ပြင်တော် ပလက်ဖောင်း (Spacious Grand Marble Terrace) */}
				<mesh userData={{ walkable: true }} position={[0, 0.6, 0]} receiveShadow>
					<boxGeometry args={[34, 1.2, 34]} />
					<meshStandardMaterial color="#eee8dc" roughness={0.8} />
				</mesh>
				{/* ရင်ပြင်တော် ပတ်လည် အလှဆင်အနားကွပ် (Terrace Border Curb) */}
				<mesh position={[0, 1.25, 0]}>
					<boxGeometry args={[34.6, 0.12, 34.6]} />
					<meshStandardMaterial color="#c5b797" roughness={0.8} />
				</mesh>
				{/* ရင်ပြင်တော် လက်ရန်းတိုင်ငယ်များ (Terrace Corner Stupa Pillars) */}
				{[-16, 16].flatMap(cx =>
					[-16, 16].map(cz => (
						<mesh key={`terrace-pillar-${cx}-${cz}`} position={[cx, 1.8, cz]} castShadow>
							<boxGeometry args={[1.2, 1.4, 1.2]} />
							<meshStandardMaterial color="#e5decb" roughness={0.7} />
						</mesh>
					))
				)}

				{/* ရင်ပြင်တော် မြောက်ဘက် အဝင်လှေကားထစ်နှင့် ဆင်ခြေလျှော (North Entrance Approach from Plaza & Stairway) */}
				<mesh userData={{ walkable: true }} position={[0, 0.35, -18.6]} rotation={[-0.22, 0, 0]}>
					<boxGeometry args={[11, 0.55, 4.2]} />
					<meshStandardMaterial color="#dcd3bf" roughness={0.8} />
				</mesh>

				{/* (ခ) မဟာဝေပုလ္လ ရွှေစေတီတော်ကြီး (The Grand Golden Mountain Pagoda) */}
				{/* ပစ္စယာ ပထမဆင့် (1st Tier Octagonal Plinth) */}
				<mesh position={[0, 2.2, 0]} castShadow receiveShadow>
					<cylinderGeometry args={[8.8, 10.2, 2.2, 8]} />
					<meshStandardMaterial color="#f7f1e1" roughness={0.6} />
				</mesh>
				{/* ပစ္စယာ ဒုတိယဆင့် (2nd Tier Octagonal Plinth with Gold Trim) */}
				<mesh position={[0, 3.8, 0]} castShadow>
					<cylinderGeometry args={[7.2, 8.4, 1.6, 8]} />
					<meshStandardMaterial color="#eed67d" metalness={0.35} roughness={0.45} />
				</mesh>
				{/* အရံစေတီ ၄ ဆူ (Four Corner Satellite Stupas) */}
				{[-5.8, 5.8].flatMap(sx =>
					[-5.8, 5.8].map(sz => (
						<group key={`corner-stupa-${sx}-${sz}`} position={[sx, 4.6, sz]}>
							<mesh position={[0, 0.8, 0]} castShadow>
								<cylinderGeometry args={[0.9, 1.3, 1.6, 8]} />
								<meshStandardMaterial color="#f0d36c" metalness={0.4} roughness={0.4} />
							</mesh>
							<mesh position={[0, 2.1, 0]} castShadow>
								<coneGeometry args={[0.65, 1.4, 8]} />
								<meshStandardMaterial color="#fbe064" metalness={0.5} roughness={0.3} />
							</mesh>
						</group>
					))
				)}
				{/* ပစ္စယာ တတိယဆင့် (3rd Tier Plinth) */}
				<mesh position={[0, 5.0, 0]} castShadow>
					<cylinderGeometry args={[5.6, 6.8, 1.2, 8]} />
					<meshStandardMaterial color="#f2ca4b" metalness={0.4} roughness={0.4} />
				</mesh>
				{/* ခေါင်းလောင်းမှောက် (Bell-Shaped Dome) */}
				<mesh position={[0, 8.2, 0]} castShadow>
					<cylinderGeometry args={[3.2, 5.4, 5.6, 16]} />
					<meshStandardMaterial color="#f2ca4b" metalness={0.45} roughness={0.38} />
				</mesh>
				{/* ကြာမှောက်ကြာလန်နှင့် ငှက်ပျောဖူး (Lotus Petal Tiers & Spire) */}
				<mesh position={[0, 12.4, 0]} castShadow>
					<cylinderGeometry args={[1.8, 3.0, 3.4, 14]} />
					<meshStandardMaterial color="#f7d558" metalness={0.45} roughness={0.35} />
				</mesh>
				<mesh position={[0, 15.2, 0]} castShadow>
					<coneGeometry args={[1.5, 3.2, 12]} />
					<meshStandardMaterial color="#fad54d" metalness={0.5} roughness={0.3} />
				</mesh>
				{/* ရွှေထီးတော် အဆင့်ဆင့် (Concentric Tiered Golden Hti Umbrella) */}
				<group position={[0, 17.2, 0]}>
					<mesh position={[0, 0, 0]}>
						<cylinderGeometry args={[2.4, 2.4, 0.2, 16]} />
						<meshStandardMaterial color="#ffe168" metalness={0.6} roughness={0.25} />
					</mesh>
					<mesh position={[0, 0.45, 0]}>
						<cylinderGeometry args={[1.9, 1.9, 0.18, 16]} />
						<meshStandardMaterial color="#ffe168" metalness={0.6} roughness={0.25} />
					</mesh>
					<mesh position={[0, 0.85, 0]}>
						<cylinderGeometry args={[1.4, 1.4, 0.16, 16]} />
						<meshStandardMaterial color="#ffe168" metalness={0.6} roughness={0.25} />
					</mesh>
					<mesh position={[0, 1.2, 0]}>
						<cylinderGeometry args={[0.9, 0.9, 0.15, 12]} />
						<meshStandardMaterial color="#ffe168" metalness={0.6} roughness={0.25} />
					</mesh>
				</group>
				{/* စိန်ဖူးတော်နှင့် ငှက်မြတ်နားတော် (Diamond Orb & Vane Spire Pinnacle) */}
				<mesh position={[0, 19.1, 0]}>
					<sphereGeometry args={[0.42, 10, 10]} />
					<meshStandardMaterial color="#ffffff" emissive="#ffee88" emissiveIntensity={0.6} roughness={0.1} />
				</mesh>
				<mesh position={[0, 19.8, 0]}>
					<coneGeometry args={[0.18, 1.0, 8]} />
					<meshStandardMaterial color="#ffe577" metalness={0.7} roughness={0.2} />
				</mesh>

				{/* (ဂ) မုခ် ၄ မျက်နှာ ဂန္ဓကုဋိတိုက်ငယ်များ (Cardinal Buddha Shrines) */}
				{[
					{ side: 'N', x: 0, z: -8.8, rot: 0 },
					{ side: 'S', x: 0, z: 8.8, rot: Math.PI },
					{ side: 'E', x: 8.8, z: 0, rot: Math.PI / 2 },
					{ side: 'W', x: -8.8, z: 0, rot: -Math.PI / 2 },
				].map(shrine => (
					<group key={shrine.side} position={[shrine.x, 1.2, shrine.z]} rotation={[0, shrine.rot, 0]}>
						{/* ပန်းတင်ခုံ (Flower Offering Altar) */}
						<mesh position={[0, 0.45, 0]} castShadow>
							<boxGeometry args={[3.2, 0.9, 1.6]} />
							<meshStandardMaterial color="#ded6c3" roughness={0.7} />
						</mesh>
						{/* ရွှေရောင်ဆင်းတုတော် အသေးစား (Miniature Golden Buddha Image) */}
						<mesh position={[0, 1.35, 0.2]}>
							<cylinderGeometry args={[0.4, 0.6, 1.0, 8]} />
							<meshStandardMaterial color="#fcd85a" metalness={0.4} roughness={0.3} />
						</mesh>
					</group>
				))}

				{/* (ဃ) အနောက်ဘက် နားနေဆောင် ဓမ္မာရုံ / ဇရပ် (West Pilgrim Rest Pavilion) */}
				<group position={[-11.5, 1.2, 0]}>
					{/* ကြမ်းပြင် (Pavilion Deck) */}
					<mesh position={[0, 0.25, 0]} castShadow receiveShadow>
						<boxGeometry args={[6.5, 0.5, 9.5]} />
						<meshStandardMaterial color="#cbb898" roughness={0.8} />
					</mesh>
					{/* သစ်သားတိုင် ၆ တိုင် (Wooden Posts) */}
					{[-2.6, 2.6].flatMap(px =>
						[-4.0, 0, 4.0].map(pz => (
							<mesh key={`zayat-post-${px}-${pz}`} position={[px, 2.0, pz]} castShadow>
								<cylinderGeometry args={[0.14, 0.16, 3.6, 8]} />
								<meshStandardMaterial color="#543725" roughness={0.9} />
							</mesh>
						))
					)}
					{/* အမိုးနှစ်ထပ် (Traditional Tiered Roof) */}
					<mesh position={[0, 4.0, 0]} castShadow>
						<boxGeometry args={[7.8, 0.7, 10.8]} />
						<meshStandardMaterial color="#8a4436" roughness={0.7} />
					</mesh>
					<mesh position={[0, 4.9, 0]} castShadow>
						<boxGeometry args={[5.5, 0.7, 8.0]} />
						<meshStandardMaterial color="#9c4d3d" roughness={0.7} />
					</mesh>
				</group>

				{/* (င) အရှေ့ဘက် ကြေးစည်တော်ကြီး / ခေါင်းလောင်းစင် (East Sacred Bronze Bell Gantry) */}
				<group position={[11.5, 1.2, 0]}>
					{/* ခေါင်းလောင်းတိုင် ၂ တိုင် (Timber Gantry Posts) */}
					{[-1.6, 1.6].map(side => (
						<mesh key={side} position={[0, 2.0, side]} castShadow>
							<boxGeometry args={[0.3, 3.8, 0.3]} />
							<meshStandardMaterial color="#503522" roughness={0.85} />
						</mesh>
					))}
					{/* ကန့်လန့်ယက်တန်း (Cross Beam) */}
					<mesh position={[0, 3.8, 0]}>
						<boxGeometry args={[0.4, 0.35, 4.0]} />
						<meshStandardMaterial color="#503522" roughness={0.85} />
					</mesh>
					{/* ကြေးခေါင်းလောင်းကြီး (Heavy Sacred Bronze Bell) */}
					<mesh position={[0, 2.5, 0]} castShadow>
						<cylinderGeometry args={[0.5, 0.85, 1.5, 12]} />
						<meshStandardMaterial color="#b38a4c" metalness={0.7} roughness={0.35} />
					</mesh>
				</group>

				{/* (စ) မြောက်ဘက် ရှုခင်းကြည့် လသာဆောင်နှင့် ကျောက်ခုံတန်းများ (Panoramic Overlook Balustrade & Benches) */}
				<group position={[0, 1.2, -15.5]}>
					{/* ကျောက်ခုံတန်း ၂ လုံး (Stone Observation Benches) */}
					{[-7.5, 7.5].map(side => (
						<mesh key={side} position={[side, 0.45, 0]}>
							<boxGeometry args={[3.6, 0.5, 0.9]} />
							<meshStandardMaterial color="#d8d0bf" roughness={0.8} />
						</mesh>
					))}
					{/* ရှုခင်းကြည့် အကာလက်ရန်း (Observation Safety Railing) */}
					<mesh position={[0, 0.6, -0.6]}>
						<boxGeometry args={[26, 0.8, 0.2]} />
						<meshStandardMaterial color="#cfc7b4" roughness={0.7} />
					</mesh>
				</group>
			</group>

			{/* ၇။ တောင်တစ်ခုလုံး စိမ်းစိုနေစေမည့် သစ်တောကြီး၊ မြက်ခင်းချုံပုတ်များ၊ လှေကားထစ်ရွာများနှင့် သူနာပြု/ချင်းရွာသားများ */}
			<MountainLushForest trees={slopeFlora.trees} grassTufts={slopeFlora.grassTufts} />
			<WeipulaVillageResidents tierElevations={villageTierElevations} />
			<WeipulaChinVillageTiles peaks={foreground} />
			<StaticBatch>
				<WeipulaVillage />
			</StaticBatch>
		</group>
	);
}

export function WesternLandscapePlan() {
	const mahaWeipulaPeak = ward.weipula.peaks[2];
	const roadSvgPoints = WEIPULA_ROAD_CONTROL_POINTS.map(pt => {
		const w = toWorld(pt.u, pt.v);
		return `${w.x.toFixed(1)},${w.z.toFixed(1)}`;
	}).join(' ');
	const taungphilaRoadSvgPoints = TAUNGPHILA_ROAD_CONTROL_POINTS.map(pt => {
		const w = toWorld(pt.u, pt.v);
		return `${w.x.toFixed(1)},${w.z.toFixed(1)}`;
	}).join(' ');
	const stairStart = toWorld(MAHA_WEIPULA_BASE_GATE_UV.u, MAHA_WEIPULA_BASE_GATE_UV.v);
	const stairEnd = toWorld(MAHA_WEIPULA_SUMMIT_UV.u, MAHA_WEIPULA_SUMMIT_UV.v - 22);

	return (
		<>
			{[...ward.westernFields, ...ward.southernFields].map(f => (
				<rect
					key={f.id}
					x={f.x - f.width / 2}
					y={f.z - f.depth / 2}
					width={f.width}
					height={f.depth}
					fill={f.color}
					stroke="#c1b57f"
					strokeWidth="1"
					transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
				/>
			))}
			{/* အဆင့်ဆင့် တောင်တန်းများ အောက်ခြေ ပတ်လည်လိုင်း (Natural Mountain Elevation Contours) */}
			{[...ward.mountains, ...ward.weipula.peaks].map(m => (
				<g key={m.id}>
					<circle cx={m.x} cy={m.z} r={m.radius} fill="#2f4a36" opacity="0.34" />
					<circle cx={m.x} cy={m.z} r={m.radius * 0.72} fill={m.color} stroke="#466049" strokeWidth="1" />
					<circle cx={m.x} cy={m.z} r={m.radius * 0.44} fill="#3e6447" stroke="#5b8461" strokeWidth="0.9" />
					<circle cx={m.x} cy={m.z} r={m.radius * 0.18} fill="#6d9272" />
				</g>
			))}
			{/* မဟာဝေပုလ္လ တောင်တက်ကွေ့လမ်းနှင့် စောင်းတန်းလှေကား (2D Climb Trail Overlay) */}
			<polyline
				points={roadSvgPoints}
				fill="none"
				stroke="#d6cfc1"
				strokeWidth="3.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity="0.88"
			/>
			{/* တောင်ဖီလာတောင် ဆိုင်ကယ်တောင်တက်လမ်း၊ ရေကန်၊ တောရကျောင်းနှင့် စေတီများ (2D Map Overlay) */}
			<polyline
				points={taungphilaRoadSvgPoints}
				fill="none"
				stroke="#e5dcc8"
				strokeWidth="3.0"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity="0.9"
			/>
			{TAUNGPHILA_MOUNTAIN_WORLD.lakes.map(lk => (
				<ellipse
					key={lk.id}
					cx={lk.x}
					cy={lk.z}
					rx={lk.radiusX}
					ry={lk.radiusZ}
					fill="#3a8da0"
					stroke="#9ad4e0"
					strokeWidth="1.2"
					opacity="0.86"
					transform={`rotate(${(-lk.rotation * 180) / Math.PI} ${lk.x} ${lk.z})`}
				/>
			))}
			{TAUNGPHILA_MOUNTAIN_WORLD.monasteries.map(m => (
				<rect
					key={m.id}
					x={m.x - 5.5}
					y={m.z - 4.5}
					width="11"
					height="9"
					fill="#8f1f24"
					stroke="#f2c144"
					strokeWidth="1"
					transform={`rotate(${(-m.rotation * 180) / Math.PI} ${m.x} ${m.z})`}
				/>
			))}
			{TAUNGPHILA_MOUNTAIN_WORLD.pagodas.map(p => (
				<circle key={p.id} cx={p.x} cy={p.z} r={Math.max(3.5, p.radius)} fill="#f2c844" stroke="#ffffff" strokeWidth="1" />
			))}
			<line
				x1={stairStart.x}
				y1={stairStart.z}
				x2={stairEnd.x}
				y2={stairEnd.z}
				stroke="#f6dc7a"
				strokeWidth="2.6"
				strokeDasharray="4 3"
			/>
			{/* မဟာဝေပုလ္လတောင်ခြေ မုခ်ဦး အမှတ်အသား */}
			<g transform={`translate(${stairStart.x} ${stairStart.z})`}>
				<circle r="6.5" fill="#a6362b" stroke="#fde068" strokeWidth="1.4" />
				<text y="-10" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#fef3c7" stroke="#1f3528" strokeWidth="2" paintOrder="stroke fill">
					တောင်ခြေမုခ်ဦး (တက်လမ်းအစ)
				</text>
			</g>
			{/* မဟာဝေပုလ္လတောင်တော် စေတီတော် အမှတ်အသား */}
			{mahaWeipulaPeak && (
				<g transform={`translate(${mahaWeipulaPeak.x} ${mahaWeipulaPeak.z})`}>
					<circle r="12" fill="#4d6f51" stroke="#8cb88f" strokeWidth="1.5" />
					<circle r="9" fill="#f2c844" stroke="#ffffff" strokeWidth="1.5" />
					<text y="3" textAnchor="middle" fontSize="10">
						🛕
					</text>
					<text
						y="-16"
						textAnchor="middle"
						fontSize="13"
						fontWeight="bold"
						fill="#f5da62"
						stroke="#254230"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						မဟာဝေပုလ္လတောင်တော်
					</text>
					<text y="20" textAnchor="middle" fontSize="10" fill="#eaf2ce" stroke="#254230" strokeWidth="1.8" paintOrder="stroke fill">
						(တောင်ထိပ်စေတီတော်)
					</text>
				</g>
			)}
			{/* ဝေပုလ္လ လှေကားထစ်ရွာ အမှတ်အသား (2D Map Marker) */}
			{(() => {
				const vPos = toWorld(-340, 4410 + WEIPULA_VILLAGE_V_OFFSET);
				return (
					<g transform={`translate(${vPos.x} ${vPos.z})`}>
						<circle r="10" fill="#4d6f51" stroke="#90c294" strokeWidth="1.2" />
						<circle r="7" fill="#de8b37" stroke="#ffffff" strokeWidth="1" />
						<text y="3" textAnchor="middle" fontSize="8">
							🏡
						</text>
						<text
							y="-12"
							textAnchor="middle"
							fontSize="11"
							fontWeight="bold"
							fill="#fed274"
							stroke="#223a2b"
							strokeWidth="2"
							paintOrder="stroke fill"
						>
							ဝေပုလ္လ လှေကားထစ်ရွာ
						</text>
					</g>
				);
			})()}
			{/* မဟာဝေပုလ္လ တောင်ခါးပန်း ချင်းလှေကားထစ်ရွာ (အိမ်ခြေ ၁၀၀ — 2D Map Marker) */}
			<g transform={`translate(${weipulaChinVillageMeta.label.x} ${weipulaChinVillageMeta.label.z})`}>
				<circle r="11" fill="#4d6f51" stroke="#facc15" strokeWidth="1.4" />
				<circle r="7.5" fill="#b8382c" stroke="#ffffff" strokeWidth="1.1" />
				<text y="3" textAnchor="middle" fontSize="8">
					🏘️
				</text>
				<text
					y="-14"
					textAnchor="middle"
					fontSize="11"
					fontWeight="bold"
					fill="#fde68a"
					stroke="#223a2b"
					strokeWidth="2.2"
					paintOrder="stroke fill"
				>
					{weipulaChinVillageMeta.label.text}
				</text>
				<text y="19" textAnchor="middle" fontSize="9" fill="#eaf2ce" stroke="#223a2b" strokeWidth="1.8" paintOrder="stroke fill">
					(လှေကားထစ် အိမ်ခြေ ၁၀၀)
				</text>
			</g>
			<text x={ward.taungphila.label.x} y={ward.taungphila.label.z} textAnchor="middle" fontSize="26" fill="#f3edcb" stroke="#304b4b" strokeWidth="0.6">
				{ward.taungphila.name}
			</text>
			<text x={ward.weipula.label.x} y={ward.weipula.label.z} textAnchor="middle" fontSize="26" fill="#f3edcb" stroke="#304b4b" strokeWidth="0.6">
				{ward.weipula.name}
			</text>
		</>
	);
}
