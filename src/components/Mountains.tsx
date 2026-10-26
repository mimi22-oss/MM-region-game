import { mobileQuality } from '../game/sceneBudget';
import { StaticBatch } from './StaticBatch';
import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Group } from 'three';
import { registerGroundRegion } from '../game/groundSurface.ts';
import { ward, toWorld, angle } from '../data/ward';
import { buildMountainTiles, mountainHeight, type TerrainPeak } from '../game/mountainTerrain';

const distantMountainTiers = [
	// ဒုတိယဆင့် တောင်တန်းများ (Inner Chin Hills: v = 4800 ~ 5200)
	...[-950, -750, -550, -350, -150, 60, 260, 460, 680, 880].map((u, i) => {
		const v = 4850 + (i % 3) * 120;
		const height = 750 + (i % 4) * 80;
		const radius = 175 + (i % 3) * 15;
		return {
			id: `distant-chin-tier2-${i}`,
			u,
			v,
			...toWorld(u, v),
			height,
			radius,
			color: i % 2 ? '#3b5443' : '#334c3d',
		};
	}),
	// တတိယဆင့် တောင်တန်းကြီးများ (High Chin Range: v = 5400 ~ 5800)
	...[-1100, -850, -600, -350, -100, 150, 400, 650, 900].map((u, i) => {
		const v = 5500 + (i % 2) * 160;
		const height = 980 + (i % 3) * 120;
		const radius = 220 + (i % 3) * 20;
		return {
			id: `distant-chin-tier3-${i}`,
			u,
			v,
			...toWorld(u, v),
			height,
			radius,
			color: '#364d55',
		};
	}),
	// စတုတ္ထဆင့် အဝေးဆုံး မိုးကုတ်စက်ဝိုင်း တောင်တန်း (Atmospheric Horizon Ridges: v = 6200)
	...[-1200, -800, -400, 0, 400, 800, 1200].map((u, i) => {
		const v = 6200;
		const height = 1200 + (i % 3) * 100;
		const radius = 260;
		return {
			id: `distant-chin-tier4-${i}`,
			u,
			v,
			...toWorld(u, v),
			height,
			radius,
			color: '#3d5261',
		};
	}),
];

const foreground = [...ward.mountains, ...ward.weipula.peaks];

function RidgeSurface({ peaks, step = 10, haze = 0 }: { peaks: TerrainPeak[]; step?: number; haze?: number }) {
	const tiles = useMemo(() => buildMountainTiles(peaks, step, haze), [peaks, step, haze]);
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
						<meshStandardMaterial vertexColors roughness={1} />
					</mesh>
				);
			})}
		</>
	);
}

/**
 * တောင်ပေါ် ထင်းရှူးပင်များ (Highland Mountain Pines):
 * ချင်းတောင်တန်းနှင့် ဝေပုလ္လ တောင်ကုန်းပြင်မြင့်ပေါ်တွင် သဘာဝအတိုင်း ပေါက်ရောက်နေသော ထင်းရှူးပင်များ
 */
function MountainPine({ x, y, z, scale = 1, i = 0 }: { x: number; y: number; z: number; scale?: number; i?: number }) {
	const foliageColors = ['#284e36', '#325b3f', '#22422e', '#2c5339'];
	const col = foliageColors[i % foliageColors.length];
	return (
		<group position={[x, y, z]} scale={[scale, scale, scale]}>
			{/* ပင်စည် (Pine Trunk) */}
			<mesh position={[0, 4.5, 0]}>
				<cylinderGeometry args={[0.22, 0.45, 9, 7]} />
				<meshStandardMaterial color="#634832" roughness={0.9} />
			</mesh>
			{/* အောက်ဆင့် ထင်းရှူးရွက်အုံ (Bottom Cone Layer) */}
			<mesh position={[0, 6.8, 0]}>
				<coneGeometry args={[3.2, 5.0, mobileQuality ? 5 : 7]} />
				<meshStandardMaterial color={col} roughness={0.85} />
			</mesh>
			{/* အလယ်ဆင့် ထင်းရှူးရွက်အုံ (Middle Cone Layer) */}
			<mesh position={[0, 9.6, 0]}>
				<coneGeometry args={[2.4, 4.4, mobileQuality ? 5 : 7]} />
				<meshStandardMaterial color={foliageColors[(i + 1) % foliageColors.length]} roughness={0.85} />
			</mesh>
			{/* ထိပ်ဖူး ထင်းရှူးရွက်အုံ (Top Peak Cone Layer) */}
			<mesh position={[0, 12.2, 0]}>
				<coneGeometry args={[1.5, 3.8, mobileQuality ? 5 : 7]} />
				<meshStandardMaterial color="#3a6747" roughness={0.8} />
			</mesh>
		</group>
	);
}

/**
 * တောင်ပေါ် အရိပ်ရ သစ်ပင်ကြီးများ (Highland Broadleaf Trees)
 */
function MountainBroadTree({ x, y, z, scale = 1, i = 0 }: { x: number; y: number; z: number; scale?: number; i?: number }) {
	return (
		<group position={[x, y, z]} scale={[scale, scale, scale]}>
			<mesh position={[0, 3.8, 0]}>
				<cylinderGeometry args={[0.3, 0.55, 7.6, 7]} />
				<meshStandardMaterial color="#5a422e" roughness={0.9} />
			</mesh>
			<mesh position={[0, 8.2, 0]}>
				<icosahedronGeometry args={[3.8, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color={i % 2 ? '#447248' : '#3a623e'} roughness={0.85} />
			</mesh>
			<mesh position={[1.4, 7.5, -0.8]}>
				<icosahedronGeometry args={[2.5, 0]} />
				<meshStandardMaterial color="#517e4e" roughness={0.85} />
			</mesh>
		</group>
	);
}

/**
 * ဝေပုလ္လ တောင်ကုန်းပြင်မြင့် သစ်ပင်များ စာရင်း
 * ကုန်းပြင်မြင့် တစ်လျှောက်၊ စေတီတော် ပတ်လည်နှင့် တောင်တက်လမ်း တစ်လျှောက် ပေါက်ရောက်နေသော သစ်ပင်များ
 */
const highlandTreePlots = [
	// စေတီတော် အနောက်ဘက် ကုန်းပြင်မြင့် ထင်းရှူးတော
	{ u: -440, v: 4420, kind: 'pine', scale: 1.15 },
	{ u: -465, v: 4440, kind: 'pine', scale: 1.25 },
	{ u: -450, v: 4470, kind: 'pine', scale: 1.05 },
	{ u: -480, v: 4460, kind: 'pine', scale: 1.3 },
	{ u: -430, v: 4500, kind: 'pine', scale: 1.1 },
	{ u: -415, v: 4520, kind: 'broad', scale: 1.2 },
	{ u: -460, v: 4510, kind: 'pine', scale: 1.15 },

	// စေတီတော် အရှေ့ဘက် ကုန်းပြင်မြင့် ရှုခင်းစင်စပ် သစ်ပင်များ
	{ u: -320, v: 4430, kind: 'broad', scale: 1.1 },
	{ u: -300, v: 4450, kind: 'pine', scale: 1.2 },
	{ u: -315, v: 4480, kind: 'pine', scale: 1.05 },
	{ u: -285, v: 4465, kind: 'pine', scale: 1.25 },
	{ u: -290, v: 4500, kind: 'broad', scale: 1.15 },
	{ u: -330, v: 4520, kind: 'pine', scale: 1.1 },

	// စေတီတော် တောင်ဘက် (တောင်နောက်ကြော ကုန်းပြင်မြင့်)
	{ u: -380, v: 4510, kind: 'pine', scale: 1.35 },
	{ u: -360, v: 4530, kind: 'pine', scale: 1.2 },
	{ u: -400, v: 4535, kind: 'pine', scale: 1.25 },
	{ u: -350, v: 4550, kind: 'broad', scale: 1.1 },
	{ u: -390, v: 4565, kind: 'pine', scale: 1.3 },

	// ရင်ပြင်တော် မြောက်ဘက် ကားရပ်နားစခန်းနှင့် ရှုခင်းကြည့် ပလက်ဖောင်း အနီး
	{ u: -425, v: 4390, kind: 'pine', scale: 1.2 },
	{ u: -440, v: 4365, kind: 'pine', scale: 1.15 },
	{ u: -302, v: 4390, kind: 'broad', scale: 1.05 },
	{ u: -302, v: 4425, kind: 'pine', scale: 1.2 },
	{ u: -368, v: 4370, kind: 'pine', scale: 1.1 },

	// တောင်တက်လမ်း တစ်လျှောက် အရိပ်ရ သစ်ပင်တန်းများ
	{ u: -280, v: 4330, kind: 'broad', scale: 1.0 },
	{ u: -250, v: 4350, kind: 'pine', scale: 1.15 },
	{ u: -240, v: 4300, kind: 'pine', scale: 1.2 },
	{ u: -200, v: 4315, kind: 'pine', scale: 1.1 },
	{ u: -180, v: 4260, kind: 'broad', scale: 1.1 },
	{ u: -150, v: 4270, kind: 'pine', scale: 1.15 },
	{ u: -130, v: 4220, kind: 'pine', scale: 1.05 },
	{ u: -90, v: 4235, kind: 'broad', scale: 1.0 },
	{ u: -70, v: 4180, kind: 'pine', scale: 1.1 },
	{ u: -45, v: 4150, kind: 'broad', scale: 1.05 },
];

/**
 * ဝေပုလ္လ တောင်တက်လမ်း ပင်မလမ်းကြောင်း (Webula Mountain Road Segments)
 * AH1 / ကြာအင်းရွာစွန်မှ ဝေပုလ္လ တောင်ပေါ်ကုန်းပြင်မြင့် ရင်ပြင်တော်သို့ ဆက်သွယ်ထားသော ကတ္တရာလမ်း
 */
const mountainRoadPoints = [
	{ u: -35, v: 4130, w: 9 },
	{ u: -90, v: 4190, w: 8.5 },
	{ u: -160, v: 4255, w: 8.5 },
	{ u: -230, v: 4315, w: 8.5 },
	{ u: -300, v: 4375, w: 8.5 },
	{ u: -355, v: 4405, w: 9.5 },
	{ u: -380, v: 4422, w: 12 },
];

/**
 * ဝေပုလ္လ တောင်ပေါ် လှေကားထစ်ရွာ ပျဉ်ထောင်အိမ်များ (Highland Village Timber Cottages & Mansions)
 */
function MountainVillageHouse({
	u,
	v,
	baseY,
	width,
	depth,
	height,
	wallColor,
	roofColor,
	title,
	hasLoom,
	hasDryingRack,
	hasFlag,
	hasClinicCross,
	hasChimney,
}: {
	u: number;
	v: number;
	baseY: number;
	width: number;
	depth: number;
	height: number;
	wallColor: string;
	roofColor: string;
	title: string;
	hasLoom?: boolean;
	hasDryingRack?: boolean;
	hasFlag?: boolean;
	hasClinicCross?: boolean;
	hasChimney?: boolean;
}) {
	const pos = toWorld(u, v);
	const halfW = width / 2;
	const halfD = depth / 2;
	return (
		<group position={[pos.x, baseY, pos.z]} rotation={[0, angle, 0]}>
			{/* အိမ်တိုင်လုံးများ (Timber Foundation Stilts) */}
			{[-halfW + 0.6, 0, halfW - 0.6].flatMap(px =>
				[-halfD + 0.6, 0, halfD + 0.6].map(pz => (
					<mesh key={`post-${px}-${pz}`} position={[px, 0.6, pz]} castShadow>
						<cylinderGeometry args={[0.2, 0.25, 1.2, 8]} />
						<meshStandardMaterial color="#4a3120" roughness={0.9} />
					</mesh>
				))
			)}

			{/* အိမ်မကြီး ပျဉ်ကာနံရံများ (Main House Timber Living Quarters) */}
			<mesh position={[0, height / 2 + 0.8, -0.6]} castShadow receiveShadow>
				<boxGeometry args={[width, height, depth - 2.4]} />
				<meshStandardMaterial color={wallColor} roughness={0.8} />
			</mesh>

			{/* အမိုးစောက် သွပ်မိုး/ဝါးမိုး (Sloping Mountain Roof with Overhang) */}
			<group position={[0, height + 1.2, -0.6]}>
				<mesh position={[0, 0.45, 0]} castShadow>
					<boxGeometry args={[width + 1.6, 0.35, depth - 1.2]} />
					<meshStandardMaterial color={roofColor} roughness={0.65} />
				</mesh>
				<mesh position={[0, 0.95, 0]} castShadow>
					<boxGeometry args={[width * 0.75, 0.65, depth * 0.65]} />
					<meshStandardMaterial color={roofColor} roughness={0.6} />
				</mesh>
				<mesh position={[0, 1.45, 0]} castShadow>
					<boxGeometry args={[width * 0.45, 0.45, depth * 0.4]} />
					<meshStandardMaterial color={roofColor} roughness={0.55} />
				</mesh>
			</group>

			{/* ပြတင်းပေါက် သစ်သားတံခါးရွက်များ (Windows with Wooden Shutters) */}
			{[-halfW + 1.4, halfW - 1.4].map(wx => (
				<mesh key={`win-${wx}`} position={[wx, height * 0.55 + 0.8, -0.6 + (depth - 2.4) / 2 + 0.05]}>
					<boxGeometry args={[1.3, 1.3, 0.1]} />
					<meshStandardMaterial color="#2d1c10" roughness={0.7} />
				</mesh>
			))}

			{/* အရှေ့ဘက် လသာဆောင် ဝရံတာ (Walkable Front Veranda Deck) */}
			<mesh
				userData={{ walkable: true }}
				position={[0, 0.75, halfD - 1.1]}
				receiveShadow
			>
				<boxGeometry args={[width + 0.6, 0.2, 2.6]} />
				<meshStandardMaterial color="#6a472c" roughness={0.8} />
			</mesh>

			{/* ဝရံတာ လက်ရန်းတိုင်များနှင့် အကာအရံ (Veranda Timber Railing) */}
			<group position={[0, 1.35, halfD + 0.15]}>
				<mesh position={[0, 0, 0]}>
					<boxGeometry args={[width + 0.6, 0.1, 0.12]} />
					<meshStandardMaterial color="#4d321d" roughness={0.85} />
				</mesh>
				{[-halfW + 0.2, 0, halfW - 0.2].map(rx => (
					<mesh key={`rail-post-${rx}`} position={[rx, -0.3, 0]}>
						<boxGeometry args={[0.15, 0.6, 0.15]} />
						<meshStandardMaterial color="#4d321d" roughness={0.85} />
					</mesh>
				))}
			</group>

			{/* ဝရံတာပေါ်က ပန်းအိုးတန်းများ (Flower Boxes with Mountain Orchids) */}
			{[-halfW + 1.0, halfW - 1.0].map(fx => (
				<group key={`flower-${fx}`} position={[fx, 1.45, halfD + 0.15]}>
					<mesh position={[0, 0, 0]}>
						<boxGeometry args={[1.4, 0.25, 0.3]} />
						<meshStandardMaterial color="#543621" roughness={0.9} />
					</mesh>
					{[-0.4, 0, 0.4].map(px => (
						<mesh key={`bloom-${px}`} position={[px, 0.25, 0]}>
							<sphereGeometry args={[0.2, 6, 6]} />
							<meshStandardMaterial color={px < 0 ? '#df4d68' : px === 0 ? '#f2b705' : '#e06287'} roughness={0.6} />
						</mesh>
					))}
				</group>
			))}

			{/* ဝရံတာ အဝင် ဆင်ခြေလျှောခင်း (Step / Approach Ramp to Veranda) */}
			<mesh
				userData={{ walkable: true }}
				position={[0, 0.4, halfD + 0.55]}
				receiveShadow
			>
				<boxGeometry args={[2.4, 0.35, 0.8]} />
				<meshStandardMaterial color="#5d3e26" roughness={0.85} />
			</mesh>

			{/* ဆိုင်ကယ် ရပ်နားရန် ကျောက်ပြားခင်း နေရာ (Paved Motorcycle Parking Pad) */}
			<mesh
				userData={{ walkable: true }}
				position={[halfW + 1.5, 0.1, 0]}
				receiveShadow
			>
				<boxGeometry args={[2.6, 0.15, 4.2]} />
				<meshStandardMaterial color="#5c5750" roughness={0.85} />
			</mesh>

			{/* ယက္ကန်းစင် (Traditional Chin Handloom Display on Veranda) */}
			{hasLoom && (
				<group position={[-halfW + 1.8, 1.15, halfD - 0.8]}>
					<mesh position={[0, 0.4, 0]}>
						<boxGeometry args={[1.4, 0.8, 0.8]} />
						<meshStandardMaterial color="#3d2617" roughness={0.85} />
					</mesh>
					<mesh position={[0, 0.45, 0.42]}>
						<boxGeometry args={[1.2, 0.7, 0.04]} />
						<meshStandardMaterial color="#b8382c" roughness={0.6} />
					</mesh>
				</group>
			)}

			{/* ပြောင်းဖူးလှန်းစင် (Corn Drying Rack with Golden Cobs) */}
			{hasDryingRack && (
				<group position={[-halfW - 0.8, 0.2, halfD - 1.0]}>
					<mesh position={[0, 1.2, 0]}>
						<boxGeometry args={[0.2, 2.4, 2.2]} />
						<meshStandardMaterial color="#4a311e" roughness={0.9} />
					</mesh>
					{[-0.6, 0, 0.6].map(cy => (
						<mesh key={`corn-${cy}`} position={[0.15, 1.2 + cy, 0]}>
							<boxGeometry args={[0.2, 0.35, 1.8]} />
							<meshStandardMaterial color="#e8b538" roughness={0.5} />
						</mesh>
					))}
				</group>
			)}

			{/* ရွာသူကြီးအိမ် မြန်မာနိုင်ငံတော်အလံတိုင် (National Flag Mast) */}
			{hasFlag && (
				<group position={[halfW + 1.2, 0, halfD + 1.0]}>
					<mesh position={[0, 3.2, 0]}>
						<cylinderGeometry args={[0.07, 0.1, 6.4, 8]} />
						<meshStandardMaterial color="#cfd4d8" metalness={0.7} roughness={0.3} />
					</mesh>
					<mesh position={[0.8, 5.8, 0]}>
						<boxGeometry args={[1.6, 1.0, 0.02]} />
						<meshStandardMaterial color="#f0ce35" roughness={0.4} />
					</mesh>
				</group>
			)}

			{/* ကျေးလက်ဆေးပေးခန်း အမှတ်အသား (Clinic Red Cross) */}
			{hasClinicCross && (
				<group position={[0, height + 0.3, halfD - 0.55]}>
					<mesh position={[0, 0, 0]}>
						<boxGeometry args={[1.6, 0.8, 0.1]} />
						<meshStandardMaterial color="#ffffff" roughness={0.3} />
					</mesh>
					<mesh position={[0, 0, 0.06]}>
						<boxGeometry args={[0.6, 0.2, 0.02]} />
						<meshStandardMaterial color="#d92b2b" />
					</mesh>
					<mesh position={[0, 0, 0.06]}>
						<boxGeometry args={[0.2, 0.6, 0.02]} />
						<meshStandardMaterial color="#d92b2b" />
					</mesh>
				</group>
			)}

			{/* ကျောက်ခေါင်းတိုင် (Stone Fireplace Chimney) */}
			{hasChimney && (
				<mesh position={[halfW - 0.8, height + 1.2, -0.6]} castShadow>
					<boxGeometry args={[1.1, 3.2, 1.1]} />
					<meshStandardMaterial color="#5e5953" roughness={0.9} />
				</mesh>
			)}
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
	const segAngle = angle + Math.atan2(du, dv);
	const pitch = Math.atan2(yTo - yFrom, len);

	return (
		<mesh
			userData={{ walkable: true }}
			position={[midPos.x, midY, midPos.z]}
			rotation={[-pitch, segAngle, 0]}
			receiveShadow
		>
			<boxGeometry args={[width, 0.22, len + 0.6]} />
			<meshStandardMaterial color="#4e5354" roughness={0.85} />
		</mesh>
	);
}

/**
 * ဝေပုလ္လ လှေကားထစ်ရွာ ပင်မကွန်ပိုးနန့် (Weipula Terraced Mountain Village Complex)
 */
function WeipulaVillage() {
	const t1Pos = toWorld(-335, 4380);
	const t2Pos = toWorld(-335, 4407);
	const t3Pos = toWorld(-335, 4434);
	const t4Pos = toWorld(-335, 4461);

	const lanterns = [
		toWorld(-352, 4373),
		toWorld(-318, 4373),
		toWorld(-352, 4400),
		toWorld(-318, 4400),
		toWorld(-352, 4427),
		toWorld(-318, 4427),
		toWorld(-352, 4454),
		toWorld(-318, 4454),
	];

	return (
		<group name="weipula-terraced-village">
			{/* ===== TIER 1: တောင်ခြေ ရွာအဝင် အဆင့် (Lower Entrance Terrace, y=932.0) ===== */}
			<group position={[t1Pos.x, 932.0, t1Pos.z]} rotation={[0, angle, 0]}>
				<mesh position={[0, -2.8, 0]}>
					<boxGeometry args={[42.6, 5.6, 18.6]} />
					<meshStandardMaterial color="#3e3933" roughness={0.95} />
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

			<VillageWelcomeGate u={-335} v={4371} baseY={932.0} />

			<MountainVillageHouse
				u={-345}
				v={4382}
				baseY={932.0}
				width={8.0}
				depth={7.0}
				height={3.8}
				wallColor="#66462c"
				roofColor="#783b2e"
				title="တောင်စောင်း ပန်းဥယျာဉ်အိမ်"
			/>

			<MountainVillageHouse
				u={-326}
				v={4382}
				baseY={932.0}
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
				vMid={4394.5}
				vLength={11.0}
				yBottom={932.0}
				yTop={935.5}
			/>

			{/* ===== TIER 2: ရွာလယ် ယဉ်ကျေးမှု အဆင့် (Middle Heritage Terrace, y=935.5) ===== */}
			<group position={[t2Pos.x, 935.5, t2Pos.z]} rotation={[0, angle, 0]}>
				<mesh position={[0, -2.8, 0]}>
					<boxGeometry args={[42.6, 5.6, 18.6]} />
					<meshStandardMaterial color="#3e3933" roughness={0.95} />
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

			<MountainVillageHouse
				u={-345}
				v={4409}
				baseY={935.5}
				width={8.0}
				depth={7.5}
				height={3.8}
				wallColor="#704e33"
				roofColor="#854637"
				title="ချင်းရိုးရာ ယက္ကန်းအိမ်"
				hasLoom
			/>

			<MountainVillageHouse
				u={-326}
				v={4409}
				baseY={935.5}
				width={9.0}
				depth={8.0}
				height={5.2}
				wallColor="#4a2e1b"
				roofColor="#2d4b38"
				title="တောင်ပေါ် နှစ်ထပ် ပျဉ်ထောင်အိမ်ကြီး"
			/>

			{/* CONNECTION: TIER 2 -> TIER 3 */}
			<VillageTierConnection
				uRamp={-351}
				uStairs={-319}
				vMid={4421.5}
				vLength={11.0}
				yBottom={935.5}
				yTop={939.0}
			/>

			{/* ===== TIER 3: တောင်ပေါ်ရှုခင်းသာ အဆင့် (Viewpoint & Tea House, y=939.0) ===== */}
			<group position={[t3Pos.x, 939.0, t3Pos.z]} rotation={[0, angle, 0]}>
				<mesh position={[0, -2.8, 0]}>
					<boxGeometry args={[42.6, 5.6, 18.6]} />
					<meshStandardMaterial color="#3e3933" roughness={0.95} />
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

			<MountainVillageTeaShop u={-345} v={4436} baseY={939.0} />

			<MountainVillageHouse
				u={-325}
				v={4436}
				baseY={939.0}
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
				vMid={4448.5}
				vLength={11.0}
				yBottom={939.0}
				yTop={942.5}
			/>

			{/* ===== TIER 4: တောင်ထိပ် ရွာသူကြီးနှင့် ဆေးပေးခန်း အဆင့် (Upper Elder & Clinic, y=942.5) ===== */}
			<group position={[t4Pos.x, 942.5, t4Pos.z]} rotation={[0, angle, 0]}>
				<mesh position={[0, -2.8, 0]}>
					<boxGeometry args={[42.6, 5.6, 18.6]} />
					<meshStandardMaterial color="#3e3933" roughness={0.95} />
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

			<MountainVillageHouse
				u={-345}
				v={4463}
				baseY={942.5}
				width={9.5}
				depth={8.5}
				height={4.6}
				wallColor="#5c381e"
				roofColor="#823c2d"
				title="ရွာသူကြီး အိမ်"
				hasFlag
			/>

			<MountainVillageHouse
				u={-325}
				v={4463}
				baseY={942.5}
				width={8.5}
				depth={7.5}
				height={3.8}
				wallColor="#dde2d8"
				roofColor="#285438"
				title="တောင်ပေါ် ကျေးလက်ဆေးပေးခန်း"
				hasClinicCross
			/>

			{/* စေတီတော် ရင်ပြင်သို့ ဆက်သွယ်ထားသော ပင်မလမ်းမကြီး (Connecting Road to Pagoda Plaza) */}
			<SummitConnectingAvenue
				uFrom={-356}
				vFrom={4434}
				yFrom={939.2}
				uTo={-380}
				vTo={4422}
				yTo={940.5}
				width={6.5}
			/>

			{/* တောင်ခြေလမ်းသို့ ဆက်သွယ်သော အဝင်လမ်း (Connecting Road to Lower Mountain Road) */}
			<SummitConnectingAvenue
				uFrom={-335}
				vFrom={4371}
				yFrom={932.0}
				uTo={-300}
				vTo={4375}
				yTo={930.5}
				width={6.0}
			/>

			{/* ရွာတွင်း လမ်းမီးတိုင်များ (Village Street Lanterns) */}
			{lanterns.map((l, i) => (
				<VillageStreetLantern
					key={`village-lamp-${i}`}
					x={l.x}
					y={932.0 + Math.floor(i / 2) * 3.5}
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
	}, [scene]);

	const summit = ward.weipula.peaks[2];
	const summitHeight = mountainHeight(summit.u, summit.v, foreground);

	// တောင်ပေါ် သစ်ပင်များ၏ တည်နေရာနှင့် အမြင့်များကို ကြိုတင်တွက်ချက်ထားခြင်း
	const mountainTrees = useMemo(() => {
		return highlandTreePlots.map((plot, i) => {
			const pos = toWorld(plot.u, plot.v);
			const h = mountainHeight(plot.u, plot.v, foreground);
			return {
				id: `highland-tree-${i}`,
				x: pos.x,
				y: h,
				z: pos.z,
				scale: plot.scale,
				kind: plot.kind,
			};
		});
	}, []);

	// တောင်တက်လမ်း အပိုင်းများ၏ နေရာနှင့် အမြင့်ကို တွက်ချက်ခြင်း
	const roadSegments = useMemo(() => {
		const segs: {
			key: string;
			x: number;
			y: number;
			z: number;
			length: number;
			width: number;
			rot: number;
		}[] = [];
		for (let i = 0; i < mountainRoadPoints.length - 1; i++) {
			const p1 = mountainRoadPoints[i];
			const p2 = mountainRoadPoints[i + 1];
			const midU = (p1.u + p2.u) / 2;
			const midV = (p1.v + p2.v) / 2;
			const pos = toWorld(midU, midV);
			const h = mountainHeight(midU, midV, foreground) + 0.08;
			const du = p2.u - p1.u;
			const dv = p2.v - p1.v;
			const length = Math.hypot(du, dv);
			const segAngle = angle + Math.atan2(du, dv);
			segs.push({
				key: `mtn-road-seg-${i}`,
				x: pos.x,
				y: h,
				z: pos.z,
				length: length + 0.6,
				width: (p1.w + p2.w) / 2,
				rot: segAngle,
			});
		}
		return segs;
	}, []);

	// ကားရပ်နားစခန်း အလယ်ဗဟို
	const plazaPos = useMemo(() => {
		const p = toWorld(-380, 4420);
		const h = mountainHeight(-380, 4420, foreground) + 0.06;
		return { x: p.x, y: h, z: p.z };
	}, []);

	return (
		<group ref={mountainRoot} name="forested-ridge-terrain">
			{/* ၁။ တောင်တန်း မျက်နှာပြင် (Highland Plateau Surface & Mountain Flanks) */}
			<RidgeSurface peaks={foreground} step={mobileQuality ? 28 : 10} />
			<RidgeSurface peaks={distantMountainTiers} step={mobileQuality ? 50 : 20} haze={0.5} />

			{/* ၂။ ဝေပုလ္လ တောင်တက်လမ်း (Webula Scenic Mountain Access Road) */}
			{roadSegments.map(seg => (
				<mesh
					key={seg.key}
					position={[seg.x, seg.y, seg.z]}
					rotation={[0, seg.rot, 0]}
					userData={{ walkable: true }}
					receiveShadow
				>
					<boxGeometry args={[seg.width, 0.16, seg.length]} />
					<meshStandardMaterial color="#44494a" roughness={0.88} />
				</mesh>
			))}

			{/* ၃။ တောင်ပေါ် ကားရပ်နားစခန်းနှင့် ရင်ပြင်တော်အဝင် (Summit Plaza & Vehicle Turnaround) */}
			<group position={[plazaPos.x, plazaPos.y, plazaPos.z]} rotation={[0, angle, 0]}>
				{/* ကတ္တရာခင်း ကားရပ်နားကွင်းပြင် (Paved Plaza Deck) */}
				<mesh userData={{ walkable: true }} position={[0, 0.05, 0]} receiveShadow>
					<boxGeometry args={[44, 0.16, 26]} />
					<meshStandardMaterial color="#4a5051" roughness={0.85} />
				</mesh>
				{/* ကားရပ်နားမျဉ်းဖြူများ (Parking Stall Markings) */}
				{[-14, -7, 0, 7, 14].map(px => (
					<mesh key={px} position={[px, 0.14, -6]}>
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

			{/* ၄။ မဟာဝေပုလ္လ ထိပ်ဖူးစေတီတော်မြတ်ကြီးနှင့် ရင်ပြင်တော် ပရဝုဏ် (Grand Mountaintop Pagoda Complex) */}
			<group position={[summit.x, summitHeight, summit.z]} rotation={[0, angle, 0]}>
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

				{/* ရင်ပြင်တော် မြောက်ဘက် အဝင်လှေကားထစ် (North Entrance Stairs to Terrace) */}
				<mesh userData={{ walkable: true }} position={[0, 0.3, -17.8]}>
					<boxGeometry args={[10, 0.6, 1.6]} />
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

			{/* ၅။ တောင်ပေါ်ပေါက် သစ်ပင်များနှင့် ရွာ (Static Batched Highland Trees & Terraced Mountain Village) */}
			<StaticBatch>
				{mountainTrees.map((tree, i) =>
					tree.kind === 'pine' ? (
						<MountainPine key={tree.id} x={tree.x} y={tree.y} z={tree.z} scale={tree.scale} i={i} />
					) : (
						<MountainBroadTree key={tree.id} x={tree.x} y={tree.y} z={tree.z} scale={tree.scale} i={i} />
					)
				)}
				<WeipulaVillage />
			</StaticBatch>
		</group>
	);
}

export function WesternLandscapePlan() {
	const mahaWeipulaPeak = ward.weipula.peaks[2];

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
			{/* အဆင့်ဆင့် တောင်တန်းများ အောက်ခြေ ပတ်လည်လိုင်း (Tiered Mountain Contours) */}
			{[...ward.mountains, ...ward.weipula.peaks].map(m => (
				<g key={m.id}>
					{/* တောင်ခြေ ပထမဆင့် */}
					<circle cx={m.x} cy={m.z} r={m.radius * 1.25} fill="#2f4534" opacity="0.35" />
					{/* တောင်ခါးပန်း ဒုတိယဆင့် */}
					<circle cx={m.x} cy={m.z} r={m.radius * 0.75} fill={m.color} stroke="#466049" strokeWidth="1" />
					{/* ပြန့်ပြူးသော တောင်ကုန်းပြင်မြင့် တတိယဆင့် (Flat Highland Plateau Zone) */}
					<circle cx={m.x} cy={m.z} r={m.radius * 0.58} fill="#4f7553" stroke="#6f9b74" strokeWidth="1" />
					{/* လုံးဝိုင်းသော တောင်ထိပ်ကြော စတုတ္ထဆင့် */}
					<circle cx={m.x} cy={m.z} r={m.radius * 0.22} fill="#729477" />
				</g>
			))}
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
						(တောင်ပေါ်ကုန်းပြင်မြင့်)
					</text>
				</g>
			)}
			{/* ဝေပုလ္လ လှေကားထစ်ရွာ အမှတ်အသား (2D Map Marker) */}
			{(() => {
				const vPos = toWorld(-340, 4410);
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
			<text x={ward.taungphila.label.x} y={ward.taungphila.label.z} textAnchor="middle" fontSize="26" fill="#f3edcb" stroke="#304b4b" strokeWidth="0.6">
				{ward.taungphila.name}
			</text>
			<text x={ward.weipula.label.x} y={ward.weipula.label.z} textAnchor="middle" fontSize="26" fill="#f3edcb" stroke="#304b4b" strokeWidth="0.6">
				{ward.weipula.name}
			</text>
		</>
	);
}
