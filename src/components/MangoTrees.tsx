import { mangoTrees, type MangoTreePlot } from '../data/mangoTrees';
import { mobileQuality } from '../game/sceneBudget';

// Mango fruit relative offsets (x, y, z, rotation, color)
const MANGO_FRUIT_OFFSETS = [
	{ x: 1.2, y: 2.5, z: 0.8, rot: 0.15, color: '#f59e0b' },
	{ x: 1.35, y: 2.35, z: 0.7, rot: -0.2, color: '#f97316' }, // Twin pair
	{ x: -1.1, y: 2.6, z: 0.9, rot: 0.25, color: '#fbbf24' },
	{ x: -1.25, y: 2.4, z: 1.05, rot: -0.1, color: '#84cc16' }, // Twin pair with lime blush
	{ x: 0.3, y: 2.7, z: -1.4, rot: 0.3, color: '#f59e0b' },
	{ x: 0.45, y: 2.5, z: -1.3, rot: -0.15, color: '#f97316' },
	{ x: -0.7, y: 2.8, z: -1.1, rot: 0.2, color: '#fbbf24' },
	{ x: 1.4, y: 2.9, z: -0.4, rot: -0.25, color: '#f59e0b' },
	{ x: -1.3, y: 2.8, z: -0.5, rot: 0.1, color: '#f97316' },
	{ x: 0.8, y: 3.1, z: 1.2, rot: -0.3, color: '#fbbf24' },
	{ x: -0.6, y: 3.0, z: 1.3, rot: 0.2, color: '#f59e0b' },
	{ x: 1.5, y: 2.4, z: 0.2, rot: 0.35, color: '#84cc16' },
	{ x: -0.2, y: 2.5, z: 1.5, rot: -0.2, color: '#f97316' },
	{ x: -0.9, y: 2.3, z: -0.8, rot: 0.15, color: '#f59e0b' },
	{ x: 1.1, y: 2.7, z: -0.9, rot: -0.1, color: '#fbbf24' },
	{ x: -0.1, y: 3.2, z: -1.5, rot: 0.25, color: '#f97316' },
];

export function MangoTree({ t }: { t: MangoTreePlot }) {
	const rotY = (t.seed * 0.0628) % (Math.PI * 2);

	return (
		<group position={[t.x, 0, t.z]} rotation={[0, rotY, 0]} name={t.id}>
			{/* ၁။ သရက်ပင် ပင်စည်ကြီးနှင့် အမြစ်ခုံး (Trunk & Root Flare) */}
			{/* အောက်ခြေ အမြစ်ခုံး (Root Flare) */}
			<mesh position={[0, 0.4, 0]} castShadow>
				<cylinderGeometry args={[0.34, 0.52, 0.8, 8]} />
				<meshStandardMaterial color="#543c26" roughness={0.95} />
			</mesh>
			{/* အဓိက သရက်ပင်စည် (Main Trunk) */}
			<mesh position={[0, 1.7, 0]} castShadow>
				<cylinderGeometry args={[0.26, 0.34, 1.8, 8]} />
				<meshStandardMaterial color="#5c422a" roughness={0.95} />
			</mesh>

			{/* ၂။ ခိုင်မာသော သရက်ကိုင်းကြီးများ (Major Spreading Branches) */}
			{/* ကိုင်း ၁ (Branch 1) */}
			<mesh position={[0.55, 2.85, 0.35]} rotation={[0.35, 0.4, -0.42]} castShadow>
				<cylinderGeometry args={[0.13, 0.22, 1.6, 6]} />
				<meshStandardMaterial color="#5c422a" roughness={0.95} />
			</mesh>
			{/* ကိုင်း ၂ (Branch 2) */}
			<mesh position={[-0.5, 2.8, 0.35]} rotation={[-0.3, -0.45, 0.45]} castShadow>
				<cylinderGeometry args={[0.12, 0.2, 1.5, 6]} />
				<meshStandardMaterial color="#5c422a" roughness={0.95} />
			</mesh>
			{/* ကိုင်း ၃ (Branch 3) */}
			<mesh position={[0.1, 2.9, -0.55]} rotation={[0.42, -0.7, -0.18]} castShadow>
				<cylinderGeometry args={[0.12, 0.2, 1.5, 6]} />
				<meshStandardMaterial color="#5c422a" roughness={0.95} />
			</mesh>

			{/* ၃။ ထူထပ်စိမ်းလန်းသော သရက်ရွက်အုပ်ကြီး (Lush Mango Foliage Canopy) */}
			{/* အလယ် ဗဟိုရွက်အုပ် (Central Dense Canopy Dome) */}
			<mesh position={[0, 4.3, 0]} scale={[1.15, 0.85, 1.1]} castShadow>
				<icosahedronGeometry args={[2.3, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#2c5626" roughness={0.9} />
			</mesh>
			{/* ဘေးထွက် ရွက်အုပ်လုံးများ (Surrounding Leaf Clusters) */}
			<mesh position={[1.3, 3.8, 0.6]} scale={[1.1, 0.85, 1.05]} castShadow>
				<icosahedronGeometry args={[1.5, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#356530" roughness={0.9} />
			</mesh>
			<mesh position={[-1.2, 3.7, 0.7]} scale={[1.05, 0.85, 1.1]} castShadow>
				<icosahedronGeometry args={[1.4, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#2d5927" roughness={0.9} />
			</mesh>
			<mesh position={[0.2, 3.9, -1.3]} scale={[1.15, 0.9, 1.05]} castShadow>
				<icosahedronGeometry args={[1.45, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#396c34" roughness={0.9} />
			</mesh>
			<mesh position={[-0.2, 3.8, 1.2]} scale={[1.05, 0.85, 1.05]} castShadow>
				<icosahedronGeometry args={[1.35, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#32602b" roughness={0.9} />
			</mesh>
			{/* ထိပ်ဖူး ရွက်နုအုပ် (Top Crown Leaves) */}
			<mesh position={[0, 5.0, 0]} scale={[1.0, 0.75, 1.0]} castShadow>
				<icosahedronGeometry args={[1.5, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#427a38" roughness={0.9} />
			</mesh>

			{/* ၄။ သရက်သီးများ (Hanging Mango Fruits with stems) */}
			{!mobileQuality &&
				MANGO_FRUIT_OFFSETS.map((m, idx) => (
					<group key={idx} position={[m.x, m.y, m.z]} rotation={[0, m.rot, m.rot * 0.7]}>
						{/* သရက်သီးညှာရိုး (Fruit Stem / Pedicel) */}
						<mesh position={[0, 0.09, 0]}>
							<cylinderGeometry args={[0.012, 0.012, 0.16, 4]} />
							<meshStandardMaterial color="#543c26" />
						</mesh>
						{/* သရက်သီး (Teardrop / Kidney Shaped Mango Fruit) */}
						<mesh position={[0, 0, 0]} scale={[0.72, 1.38, 0.62]} rotation={[0.15, 0, 0.22]} castShadow>
							<sphereGeometry args={[0.13, 10, 8]} />
							<meshStandardMaterial
								color={m.color}
								roughness={0.35}
								metalness={0.06}
							/>
						</mesh>
					</group>
				))}
		</group>
	);
}

/** သရက်စိုက်ခင်း (Mango Orchard Trees between Lat 23.1613299, 94.0453693 and Lat 23.1609846, 94.0453438) */
export function MangoTrees() {
	return (
		<group name="mango-orchard-trees">
			{mangoTrees.map((t) => (
				<MangoTree key={t.id} t={t} />
			))}
		</group>
	);
}
