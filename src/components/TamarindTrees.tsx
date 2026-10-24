import { tamarindTrees, type TamarindTreePlot } from '../data/tamarindTrees';
import { mobileQuality } from '../game/sceneBudget';

// Pod offsets (x, y, z, rotation around Y, pod bend/curve angle, brown shade variant)
const TAMARIND_POD_OFFSETS = [
	{ x: 1.4, y: 2.5, z: 0.9, rotY: 0.2, curve: 0.15, color: '#8b572a' },
	{ x: 1.55, y: 2.35, z: 0.8, rotY: -0.3, curve: -0.2, color: '#9c6331' }, // Twin pair
	{ x: -1.3, y: 2.6, z: 1.1, rotY: 0.4, curve: 0.25, color: '#825227' },
	{ x: -1.45, y: 2.45, z: 1.25, rotY: -0.15, curve: -0.1, color: '#966030' }, // Twin pair
	{ x: 0.4, y: 2.65, z: -1.6, rotY: 0.1, curve: 0.3, color: '#8b572a' },
	{ x: 0.55, y: 2.5, z: -1.5, rotY: -0.4, curve: -0.15, color: '#7a4b22' },
	{ x: -0.9, y: 2.75, z: -1.3, rotY: 0.5, curve: 0.2, color: '#9c6331' },
	{ x: 1.7, y: 2.8, z: -0.5, rotY: -0.25, curve: -0.25, color: '#8b572a' },
	{ x: -1.6, y: 2.7, z: -0.6, rotY: 0.35, curve: 0.1, color: '#825227' },
	{ x: 1.0, y: 2.95, z: 1.4, rotY: -0.5, curve: -0.3, color: '#966030' },
	{ x: -0.7, y: 2.9, z: 1.5, rotY: 0.2, curve: 0.2, color: '#8b572a' },
	{ x: 1.8, y: 2.4, z: 0.3, rotY: 0.6, curve: 0.35, color: '#7a4b22' },
	{ x: -0.3, y: 2.55, z: 1.8, rotY: -0.2, curve: -0.2, color: '#9c6331' },
	{ x: -1.1, y: 2.4, z: -0.9, rotY: 0.3, curve: 0.15, color: '#8b572a' },
	{ x: 1.3, y: 2.6, z: -1.1, rotY: -0.1, curve: -0.1, color: '#825227' },
	{ x: -0.2, y: 3.0, z: -1.7, rotY: 0.45, curve: 0.25, color: '#966030' },
	{ x: 2.0, y: 2.3, z: 0.8, rotY: -0.35, curve: -0.2, color: '#8b572a' },
	{ x: -1.8, y: 2.35, z: 0.5, rotY: 0.25, curve: 0.3, color: '#9c6331' },
];

/**
 * မန်ကျည်းသီးတောင့် (Curved Segmented Tamarind Pod):
 * Characteristic curved, segmented pod with slender stalk and cinnamon-brown velvety pod body.
 */
function TamarindPod({
	rotY,
	curve,
	color,
}: {
	rotY: number;
	curve: number;
	color: string;
}) {
	return (
		<group rotation={[0, rotY, curve]}>
			{/* အညှာရိုးကလေး (Slender Stem / Pedicel) */}
			<mesh position={[0, 0.08, 0]}>
				<cylinderGeometry args={[0.008, 0.008, 0.14, 4]} />
				<meshStandardMaterial color="#423425" />
			</mesh>

			{/* အသီးထိပ်ဖူးခွက် (Calyx Cap) */}
			<mesh position={[0, 0.01, 0]}>
				<cylinderGeometry args={[0.02, 0.012, 0.02, 6]} />
				<meshStandardMaterial color="#3c2f21" />
			</mesh>

			{/* အဆစ် ၁ - ထိပ်ပိုင်း အစေ့ခုံး (Segment 1 - Upper Seed Bump) */}
			<mesh position={[0, -0.05, 0]} castShadow>
				<cylinderGeometry args={[0.042, 0.046, 0.09, 8]} />
				<meshStandardMaterial color={color} roughness={0.88} />
			</mesh>

			{/* အဆစ် ၂ - အလယ်ပိုင်း အစေ့ခုံး (Segment 2 - Middle Curved Seed Bump) */}
			<group position={[0.02, -0.13, 0]} rotation={[0, 0, -0.22]}>
				<mesh castShadow>
					<cylinderGeometry args={[0.046, 0.046, 0.09, 8]} />
					<meshStandardMaterial color={color} roughness={0.88} />
				</mesh>

				{/* အဆစ် ၃ - အောက်ပိုင်း ကွေးညွတ်သော အစေ့ခုံး (Segment 3 - Lower Curved Seed Bump) */}
				<group position={[0.025, -0.085, 0]} rotation={[0, 0, -0.28]}>
					<mesh castShadow>
						<cylinderGeometry args={[0.044, 0.038, 0.08, 8]} />
						<meshStandardMaterial color={color} roughness={0.88} />
					</mesh>

					{/* အသီးထိပ်ဖျား လုံးဝိုင်းသော အဖျားပိုင်း (Rounded Pod Tip) */}
					<mesh position={[0.005, -0.045, 0]} castShadow>
						<sphereGeometry args={[0.034, 8, 6]} />
						<meshStandardMaterial color={color} roughness={0.88} />
					</mesh>
				</group>
			</group>
		</group>
	);
}

/**
 * မြန်မာ့ရိုးရာ မန်ကျည်းပင်ကြီး (Authentic Myanmar Tamarind Tree):
 * - ပင်စည်ကြီး၊ အမြစ်ခုံးနှင့် တွန့်ခေါက်နေသော သစ်ခေါက်ကြမ်းများ (Gnarled, deeply fissured dark bark)
 * - ကျယ်ပြန့်သော ထီးပုံသဏ္ဌာန် ရွက်အုပ်ကြီး (Broad spreading umbrella-shaped canopy)
 * - တွဲလောင်းကျနေသော မန်ကျည်းသီးတောင့်များ (Clusters of curved hanging tamarind pods)
 */
export function TamarindTree({ t }: { t: TamarindTreePlot }) {
	const rotY = (t.seed * 0.0628) % (Math.PI * 2);

	return (
		<group position={[t.x, 0, t.z]} rotation={[0, rotY, 0]} name={t.id}>
			{/* ၁။ မန်ကျည်းပင် ပင်စည်ကြီးနှင့် အမြစ်ခုံး (Buttressed Root Flare & Gnarled Trunk) */}
			{/* အောက်ခြေ ဖြာထွက်အမြစ်ခုံး (Root Buttress Base) */}
			<mesh position={[0, 0.45, 0]} castShadow>
				<cylinderGeometry args={[0.42, 0.65, 0.9, 8]} />
				<meshStandardMaterial color="#3d2f23" roughness={0.96} />
			</mesh>
			{/* အဓိက ပင်စည်ကြီး (Rugged Main Trunk with deep fissured bark) */}
			<mesh position={[0, 1.8, 0]} castShadow>
				<cylinderGeometry args={[0.34, 0.44, 2.0, 8]} />
				<meshStandardMaterial color="#453528" roughness={0.96} />
			</mesh>

			{/* ၂။ ခိုင်မာဖြာထွက်နေသော မန်ကျည်းကိုင်းကြီး ၄ ကိုင်း (4 Spreading Muscular Branches) */}
			{/* ကိုင်း ၁ - အရှေ့တောင်ထွက်ကိုင်း (Branch 1) */}
			<mesh position={[0.7, 2.9, 0.45]} rotation={[0.35, 0.45, -0.45]} castShadow>
				<cylinderGeometry args={[0.16, 0.26, 1.9, 6]} />
				<meshStandardMaterial color="#453528" roughness={0.96} />
			</mesh>
			{/* ကိုင်း ၂ - အနောက်မြောက်ထွက်ကိုင်း (Branch 2) */}
			<mesh position={[-0.65, 2.85, 0.4]} rotation={[-0.3, -0.5, 0.48]} castShadow>
				<cylinderGeometry args={[0.15, 0.24, 1.8, 6]} />
				<meshStandardMaterial color="#453528" roughness={0.96} />
			</mesh>
			{/* ကိုင်း ၃ - နောက်ဘက်ထွက်ကိုင်း (Branch 3) */}
			<mesh position={[0.15, 3.0, -0.7]} rotation={[0.48, -0.65, -0.15]} castShadow>
				<cylinderGeometry args={[0.15, 0.24, 1.8, 6]} />
				<meshStandardMaterial color="#453528" roughness={0.96} />
			</mesh>
			{/* ကိုင်း ၄ - ဘေးထွက်ကိုင်းခွဲ (Branch 4) */}
			<mesh position={[-0.2, 2.95, -0.55]} rotation={[-0.35, 0.4, 0.35]} castShadow>
				<cylinderGeometry args={[0.13, 0.2, 1.6, 6]} />
				<meshStandardMaterial color="#453528" roughness={0.96} />
			</mesh>

			{/* ၃။ ထီးပုံသဏ္ဌာန် ကျယ်ပြန့်သော မန်ကျည်းရွက်အုပ်ကြီး (Broad Umbrella Tamarind Canopy) */}
			{/* ပင်မ ထီးရွက်အုပ်ကြီး (Broad Flattened Umbrella Dome) */}
			<mesh position={[0, 4.4, 0]} scale={[1.4, 0.8, 1.35]} castShadow>
				<icosahedronGeometry args={[2.5, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#305728" roughness={0.92} />
			</mesh>

			{/* ဘေးပတ်လည် ဖြာထွက်ရွက်အုပ်လုံးများ (Surrounding Feathery Canopy Cushions) */}
			<mesh position={[1.6, 3.8, 0.7]} scale={[1.2, 0.8, 1.15]} castShadow>
				<icosahedronGeometry args={[1.7, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#386630" roughness={0.92} />
			</mesh>
			<mesh position={[-1.5, 3.75, 0.8]} scale={[1.15, 0.8, 1.2]} castShadow>
				<icosahedronGeometry args={[1.65, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#2d5427" roughness={0.92} />
			</mesh>
			<mesh position={[0.3, 3.9, -1.6]} scale={[1.3, 0.85, 1.15]} castShadow>
				<icosahedronGeometry args={[1.7, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#3a6b32" roughness={0.92} />
			</mesh>
			<mesh position={[-0.3, 3.85, 1.5]} scale={[1.15, 0.8, 1.15]} castShadow>
				<icosahedronGeometry args={[1.55, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#34602c" roughness={0.92} />
			</mesh>

			{/* အထက်ထိပ်ဖူး ရွက်နုအုပ် (Upper Crown Crest) */}
			<mesh position={[0, 5.2, 0]} scale={[1.1, 0.75, 1.1]} castShadow>
				<icosahedronGeometry args={[1.7, mobileQuality ? 0 : 1]} />
				<meshStandardMaterial color="#42783a" roughness={0.92} />
			</mesh>

			{/* ၄။ အပင်ပေါ်တွင် သီးနေသော မန်ကျည်းသီးတောင့်များ (Hanging Tamarind Pods on Tree) */}
			{!mobileQuality &&
				TAMARIND_POD_OFFSETS.map((p, idx) => (
					<group key={idx} position={[p.x, p.y, p.z]}>
						<TamarindPod rotY={p.rotY} curve={p.curve} color={p.color} />
					</group>
				))}
		</group>
	);
}

/**
 * မန်ကျည်းပင်တန်း Component (Tamarind Trees Row Component)
 */
export function TamarindTrees() {
	return (
		<group name="tamarind-trees-row">
			{tamarindTrees.map((t) => (
				<TamarindTree key={t.id} t={t} />
			))}
		</group>
	);
}
