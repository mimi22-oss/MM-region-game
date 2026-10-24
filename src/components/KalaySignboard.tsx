import { useMemo } from 'react';
import { TextureLoader, CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { Box } from './Primitives';
import {
	kalaySignCoords,
	KALAY_SIGN_HOUSE_ID,
	KALAY_SIGN_ROTATION,
	KALAY_SIGN_BEARING,
} from '../data/kalaySignboard';
import { mobileQuality } from '../game/sceneBudget';
import kalaySignFaceImg from '../assets/kalay_sign_face.png';

export { KALAY_SIGN_HOUSE_ID, KALAY_SIGN_ROTATION, KALAY_SIGN_BEARING };

// Authentic color palette from kalay.png
const GOLD_BRIGHT = '#f5c518';
const GOLD_RICH = '#eab308';
const GOLD_DEEP = '#ca8a04';
const GOLD_TEXT = '#ffdf40';
const MAROON_RED = '#801424';
const MAROON_DARK = '#6b0f1c';
const MINT_PEDESTAL = '#a7d8cf';
const WALL_CREAM = '#e8ecd5';
const LAWN_GREEN = '#3e702c';

/**
 * kalay.png ပါ စစ်မှန်သော "ကလေးမြို့" ဆိုင်းဘုတ်မျက်နှာစာ Texture
 * ဓာတ်ပုံထဲပါရှိသည့် အတိုင်းအတာ၊ အချိုးအစား၊ စာလုံးပုံစံနှင့် ရွှေရောင်ဖောင်းကြွ 3D အလင်းအမှောင်များကို
 * တထပ်ထဲကျအောင် တိကျသေချာစွာ တင်ဆက်ပေးပါသည်
 */
function useKalayTextTexture(): Texture | null {
	return useMemo(() => {
		if (typeof document === 'undefined') return null;
		const loader = new TextureLoader();
		const tex = loader.load(kalaySignFaceImg);
		tex.colorSpace = SRGBColorSpace;
		tex.anisotropy = 8;
		return tex;
	}, []);
}

/**
 * ရိုးရာ ရွှေမုခ်တိုင်ကြီး (Ornate Ceremonial Pillar from kalay.png)
 */
function CeremonialPillar({ x }: { x: number }) {
	return (
		<group position={[x, 0, 0]} name="ceremonial-pillar">
			{/* ၀။ လေးထောင့် အောက်ခံအုတ်ခုံ (Square Plinth Base from kalay.png) */}
			<mesh position={[0, 0.04, 0]} castShadow>
				<boxGeometry args={[1.2, 0.08, 1.2]} />
				<meshStandardMaterial color={MINT_PEDESTAL} roughness={0.5} />
			</mesh>

			{/* ၁။ အောက်ခြေ အစိမ်းဖျော့/အပြာဖျော့ ကြာကလပ် အဆင့်ဆင့် (Pale Celadon Mint Stepped Plinth) */}
			<mesh position={[0, 0.14, 0]} castShadow>
				<cylinderGeometry args={[0.56, 0.64, 0.2, 24]} />
				<meshStandardMaterial color={MINT_PEDESTAL} roughness={0.5} />
			</mesh>
			<mesh position={[0, 0.28, 0]} castShadow>
				<cylinderGeometry args={[0.48, 0.56, 0.18, 24]} />
				<meshStandardMaterial color={MINT_PEDESTAL} roughness={0.5} />
			</mesh>
			<mesh position={[0, 0.42, 0]} castShadow>
				<cylinderGeometry args={[0.42, 0.48, 0.16, 24]} />
				<meshStandardMaterial color={MINT_PEDESTAL} roughness={0.5} />
			</mesh>

			{/* ၂။ ရွှေကြာခုံ (Golden Flared Lotus Base) */}
			<mesh position={[0, 0.56, 0]} castShadow>
				<cylinderGeometry args={[0.38, 0.44, 0.18, 24]} />
				<meshStandardMaterial color={GOLD_RICH} roughness={0.35} metalness={0.65} />
			</mesh>
			{/* ကြာလှန် ကြာပွင့်ဖတ်များ (Upward Lotus Petals Band) */}
			<mesh position={[0, 0.72, 0]}>
				<cylinderGeometry args={[0.36, 0.38, 0.16, 20]} />
				<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.35} metalness={0.7} />
			</mesh>

			{/* ၃။ အနီရင့်ရောင် တိုင်လုံး အောက်ပိုင်း (Lower Maroon Pillar Column) */}
			<mesh position={[0, 1.25, 0]} castShadow>
				<cylinderGeometry args={[0.32, 0.34, 0.9, 24]} />
				<meshStandardMaterial color={MAROON_RED} roughness={0.4} />
			</mesh>

			{/* အောက်ပိုင်း ရွှေကြာလှန်ဖတ် ၈ ချပ် (Lower Golden Upward Petal Points) */}
			{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
				const a = (i * Math.PI * 2) / 8;
				return (
					<mesh key={i} position={[0.33 * Math.cos(a), 1.05, 0.33 * Math.sin(a)]}>
						<coneGeometry args={[0.07, 0.26, 4]} />
						<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.7} />
					</mesh>
				);
			})}

			{/* ၄။ အလယ် ရွှေပုတီးစေ့ခွေ / ကြာခွေ (Middle Golden Beaded Torus Ring) */}
			<mesh position={[0, 1.72, 0]}>
				<torusGeometry args={[0.34, 0.055, 10, 24]} />
				<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.75} />
			</mesh>
			<mesh position={[0, 1.72, 0]}>
				<cylinderGeometry args={[0.35, 0.35, 0.06, 24]} />
				<meshStandardMaterial color={GOLD_RICH} roughness={0.3} metalness={0.7} />
			</mesh>

			{/* ၅။ အနီရင့်ရောင် တိုင်လုံး အထက်ပိုင်း (Upper Maroon Pillar Column) */}
			<mesh position={[0, 2.22, 0]} castShadow>
				<cylinderGeometry args={[0.32, 0.32, 0.88, 24]} />
				<meshStandardMaterial color={MAROON_RED} roughness={0.4} />
			</mesh>

			{/* အထက်ပိုင်း ရွှေကြာမှောက်ဖတ် ၈ ချပ် (Upper Golden Downward Petal Points) */}
			{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
				const a = (i * Math.PI * 2) / 8;
				return (
					<mesh
						key={i}
						position={[0.33 * Math.cos(a), 2.42, 0.33 * Math.sin(a)]}
						rotation={[Math.PI, 0, 0]}
					>
						<coneGeometry args={[0.07, 0.26, 4]} />
						<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.7} />
					</mesh>
				);
			})}

			{/* ၆။ တိုင်ထိပ် ရွှေကြာပွင့်ခေါင်းတိုင် (Ornate Flared Golden Lotus Capital) */}
			{/* လည်ပင်းကွင်း (Capital Neck Ring) */}
			<mesh position={[0, 2.68, 0]}>
				<cylinderGeometry args={[0.38, 0.32, 0.12, 24]} />
				<meshStandardMaterial color={GOLD_RICH} roughness={0.35} metalness={0.7} />
			</mesh>
			{/* ဖြာထွက် ရွှေကြာခွက် (Flared Upper Lotus Cup) */}
			<mesh position={[0, 2.85, 0]} castShadow>
				<cylinderGeometry args={[0.54, 0.38, 0.24, 24]} />
				<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.75} />
			</mesh>
			{/* ထိပ်ဖုံး သစ်သား/ကွန်ကရစ်ခုံတုံး (Top Support Capital Block) */}
			<mesh position={[0, 3.02, 0]} castShadow>
				<cylinderGeometry args={[0.58, 0.54, 0.1, 24]} />
				<meshStandardMaterial color={GOLD_DEEP} roughness={0.35} metalness={0.7} />
			</mesh>
		</group>
	);
}

/**
 * ကလေးမြို့ (Kalaymyo) အဓိက မုခ်ဦး ဆိုင်းဘုတ်ကြီး (Main Signboard Plaque with Ornate Gilded Frame)
 */
function MainSignboardPlaque() {
	const textTexture = useKalayTextTexture();

	return (
		<group name="main-kalay-signboard-plaque">
			{/* ======================================================== */}
			{/* ၁။ ပင်မ အနီရင့်ရောင် ဆိုင်းဘုတ်ပြား (Central Maroon Red Plaque: 4.8m x 1.7m) */}
			{/* ======================================================== */}
			{/* အလယ်ဗဟို အနီပြား (Main Center Rectangle) */}
			<mesh position={[0, 3.65, 0]} castShadow>
				<boxGeometry args={[4.4, 1.6, 0.34]} />
				<meshStandardMaterial color={MAROON_RED} roughness={0.35} />
			</mesh>
			{/* ဘေး အနားစွန်း ကွေးညွတ်ခုံးများ (Lobed Scallop Bracket Flanges) */}
			{[-2.2, 2.2].map((bx) => (
				<mesh key={bx} position={[bx, 3.65, 0]}>
					<cylinderGeometry args={[0.7, 0.7, 0.34, 16]} />
					<meshStandardMaterial color={MAROON_RED} roughness={0.35} />
				</mesh>
			))}
			{/* အထက်/အောက် ခုံးများ (Top & Bottom Center Arcs) */}
			{[4.45, 2.85].map((by) => (
				<mesh key={by} position={[0, by, 0]}>
					<boxGeometry args={[3.2, 0.16, 0.34]} />
					<meshStandardMaterial color={MAROON_RED} roughness={0.35} />
				</mesh>
			))}

			{/* ======================================================== */}
			{/* ၂။ ရွှေရောင် ရိုးရာ ကနုတ်ပန်းဘောင်ကြီး (Ornate Golden Filigree Frame) */}
			{/* ======================================================== */}
			{/* အထက် ရွှေဘောင်တန်း (Top Golden Frame Bar) */}
			<mesh position={[0, 4.55, 0]} castShadow>
				<boxGeometry args={[4.9, 0.22, 0.4]} />
				<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.7} />
			</mesh>
			{/* အောက် ရွှေဘောင်တန်း (Bottom Golden Frame Bar resting on pillars) */}
			<mesh position={[0, 2.78, 0]} castShadow>
				<boxGeometry args={[4.9, 0.24, 0.42]} />
				<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.7} />
			</mesh>
			{/* ဒေါင်တိုင် ၂ တိုင်ကြား မုခ်ခုံး ကနုတ်ခွေ (Arch Bracket between pillars under bottom bar) */}
			<mesh position={[0, 2.65, 0]}>
				<boxGeometry args={[2.5, 0.12, 0.38]} />
				<meshStandardMaterial color={GOLD_RICH} roughness={0.35} metalness={0.7} />
			</mesh>
			{/* ဘယ်/ညာ တိုင်ထိပ် မုခ်ကွေး ကနုတ်ထောင့်စပ်များ (Curved brackets from pillar capitals to plaque) */}
			{[-1.35, 1.35].map((ax) => (
				<mesh key={ax} position={[ax, 2.58, 0]} rotation={[0, 0, (ax < 0 ? -1 : 1) * 0.42]}>
					<boxGeometry args={[0.55, 0.12, 0.36]} />
					<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.7} />
				</mesh>
			))}

			{/* ဘယ်/ညာ ရွှေရောင် ကနုတ်နားရွက်ခုံး တောင်ပံများ (Winged Golden Kanote Ears on Sides) */}
			{[-1, 1].map((s) => (
				<group key={s} position={[s * 2.8, 3.65, 0]}>
					{/* ပင်မ နားရွက်တောင်ပံခုံး (Main Wing lobe) */}
					<mesh scale={[0.8, 1.25, 1]} castShadow>
						<cylinderGeometry args={[0.75, 0.75, 0.38, 20]} />
						<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.7} />
					</mesh>
					{/* ထိပ်ဖျား ချွန်ချွန် ကနုတ်စွယ် (Pointed Wing Finial Tip) */}
					<mesh position={[s * 0.72, 0, 0]} rotation={[0, 0, -s * (Math.PI / 2)]}>
						<coneGeometry args={[0.22, 0.45, 6]} />
						<meshStandardMaterial color={GOLD_RICH} roughness={0.3} metalness={0.75} />
					</mesh>
					{/* အလှဆင် ကနုတ်ပန်းဝိုင်း (Decorative Floral Rosette) */}
					{[0.2, -0.2].map((z) => (
						<mesh key={z} position={[0, 0, z]}>
							<cylinderGeometry args={[0.35, 0.35, 0.04, 16]} />
							<meshStandardMaterial color={GOLD_DEEP} roughness={0.35} metalness={0.65} />
						</mesh>
					))}
				</group>
			))}

			{/* ======================================================== */}
			{/* ၃။ ထိပ်ဖူး ရွှေတံခွန်နှင့် ရွှေကြာဖူးများ (Crowning Crest & Lotus Finials) */}
			{/* ======================================================== */}
			{/* အလယ်ထိပ်ဖူး ရွှေကနုတ်မောက် (Central Gilded Kanote Crest / Flame Pediment) */}
			<group position={[0, 4.75, 0]}>
				{/* အောက်ခံ ကနုတ်ပန်းခွေ (Scrollwork Pediment Base) */}
				<Box position={[0, 0.12, 0]} size={[2.2, 0.22, 0.38]} color={GOLD_BRIGHT} />
				{/* အလယ် တံခွန်စိန်ဖူး (Central Spire Flame Crest) */}
				<mesh position={[0, 0.42, 0]} castShadow>
					<coneGeometry args={[0.32, 0.55, 8]} />
					<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.25} metalness={0.8} />
				</mesh>
				{/* ထိပ်ဖျား ရတနာစိန်ဖူးလုံး (Jewel Finial Sphere) */}
				<mesh position={[0, 0.72, 0]}>
					<sphereGeometry args={[0.1, 12, 10]} />
					<meshStandardMaterial color={GOLD_TEXT} roughness={0.2} metalness={0.85} />
				</mesh>
				{/* ဘေးပတ်လည် ကနုတ်တောင်ပံငယ်များ (Flanking Crest Scrolls) */}
				{[-0.6, 0.6].map((cx) => (
					<mesh key={cx} position={[cx, 0.3, 0]}>
						<coneGeometry args={[0.18, 0.36, 6]} />
						<meshStandardMaterial color={GOLD_RICH} roughness={0.3} metalness={0.75} />
					</mesh>
				))}
			</group>

			{/* ဒေါင်တိုင် ၂ တိုင်၏ ထိပ်တည့်တည့်ရှိ ရွှေကြာဖူး ဘုကြီး ၂ ခု (Twin Golden Lotus Finials aligned above pillars) */}
			{[-1.65, 1.65].map((lx) => (
				<group key={lx} position={[lx, 4.65, 0]}>
					{/* ကြာခုံ (Lotus Plinth) */}
					<mesh position={[0, 0.12, 0]} castShadow>
						<cylinderGeometry args={[0.26, 0.32, 0.18, 16]} />
						<meshStandardMaterial color={GOLD_RICH} roughness={0.3} metalness={0.7} />
					</mesh>
					{/* ရွှေကြာဖူးလုံး (Lotus Bud Bulb) */}
					<mesh position={[0, 0.35, 0]} castShadow>
						<sphereGeometry args={[0.22, 16, 14]} />
						<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.25} metalness={0.75} />
					</mesh>
					{/* ကြာဖူးထိပ်ဖျား (Pointed Bud Tip) */}
					<mesh position={[0, 0.55, 0]}>
						<coneGeometry args={[0.08, 0.22, 10]} />
						<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.25} metalness={0.8} />
					</mesh>
				</group>
			))}

			{/* ======================================================== */}
			{/* ၄။ kalay.png ဓာတ်ပုံပါ စစ်မှန်သော "ကလေးမြို့" ရွှေစာလုံးဖောင်းကြွ မျက်နှာစာ Texture */}
			{/* ======================================================== */}
			{/* ရှေ့ဘက်မျက်နှာစာ (Front Face facing South 180.0°) */}
			<mesh position={[0, 3.65, 0.176]}>
				<planeGeometry args={[4.4, 1.55]} />
				{textTexture ? (
					<meshStandardMaterial
						map={textTexture}
						roughness={0.25}
						metalness={0.25}
					/>
				) : (
					<meshStandardMaterial color={MAROON_RED} />
				)}
			</mesh>

			{/* နောက်ဘက်မျက်နှာစာ (Back Face facing North 0.0°) */}
			<mesh position={[0, 3.65, -0.176]} rotation={[0, Math.PI, 0]}>
				<planeGeometry args={[4.4, 1.55]} />
				{textTexture ? (
					<meshStandardMaterial
						map={textTexture}
						roughness={0.25}
						metalness={0.25}
					/>
				) : (
					<meshStandardMaterial color={MAROON_RED} />
				)}
			</mesh>
		</group>
	);
}

/**
 * ပန်းခြံကျွန်းနှင့် ခံတပ်ရိုး တံတိုင်းတို (Raised Landscaped Garden Island with Crenellated Parapet)
 */
function GardenIslandAndParapet() {
	return (
		<group name="garden-island-and-parapet">
			{/* ၁။ စိမ်းလန်းသော မြက်ခင်းပန်းခြံကုန်း (Raised Green Lawn Mound: 8.5m x 6.5m) */}
			<mesh position={[0, 0.15, 0]} scale={[1.2, 0.25, 0.9]} receiveShadow>
				<cylinderGeometry args={[3.8, 4.1, 1.0, 32]} />
				<meshStandardMaterial color={LAWN_GREEN} roughness={0.85} />
			</mesh>

			{/* မြက်ခင်းပြင်ပေါ်ရှိ ရောင်စုံပန်းပွင့်လေးများ (Flowerbed Specks) */}
			{!mobileQuality &&
				[
					[-1.8, 1.2, '#fef08a'],
					[1.8, 1.2, '#fef08a'],
					[-2.2, -1.0, '#f43f5e'],
					[2.2, -1.0, '#f43f5e'],
					[-0.8, 1.8, '#ffffff'],
					[0.8, 1.8, '#ffffff'],
					[0, 2.1, '#facc15'],
					[-1.2, -1.6, '#ec4899'],
					[1.2, -1.6, '#ec4899'],
				].map(([fx, fz, fcol], fi) => (
					<mesh key={fi} position={[fx as number, 0.3, fz as number]}>
						<sphereGeometry args={[0.08, 6, 6]} />
						<meshStandardMaterial color={fcol as string} roughness={0.6} />
					</mesh>
				))}

			{/* ၂။ ခံတပ်ရိုး တံတိုင်းတို အနားကွပ် (Crenellated Parapet Boundary Wall from photo) */}
			{/* အောက်ခြေ နံရံခွေ (Curved Parapet Wall) */}
			{[-3.6, -2.6, -1.6, -0.6, 0.6, 1.6, 2.6, 3.6].map((wx, wi) => {
				const wz = 2.4 - Math.abs(wx) * 0.18;
				return (
					<group key={wi} position={[wx, 0.28, wz]}>
						{/* တံတိုင်းတို အုတ်ခုံ (Wall segment) */}
						<Box position={[0, 0, 0]} size={[0.85, 0.45, 0.18]} color={WALL_CREAM} />
						{/* ခံတပ်ရိုး ကြာဖူးထိပ်ခေါင်း (Scalloped Lotus Merlon Crest) */}
						<mesh position={[0, 0.32, 0]}>
							<coneGeometry args={[0.18, 0.22, 6]} />
							<meshStandardMaterial color={WALL_CREAM} roughness={0.6} />
						</mesh>
						{/* ထိပ်ဖူး ဘုလုံးကလေး (Bud Finial Tip) */}
						<mesh position={[0, 0.45, 0]}>
							<sphereGeometry args={[0.05, 8, 6]} />
							<meshStandardMaterial color={MINT_PEDESTAL} />
						</mesh>
					</group>
				);
			})}

			{/* ၃။ ညဘက် ဆိုင်းဘုတ်ကို ထိုးပြမည့် မီးမောင်းထိုးမီး ၂ လုံး (Ground Uplight Spotlights) */}
			{[-1.5, 1.5].map((lx) => (
				<group key={lx} position={[lx, 0.32, 1.6]} rotation={[-0.45, 0, 0]}>
					<mesh>
						<cylinderGeometry args={[0.1, 0.07, 0.18, 10]} />
						<meshStandardMaterial color="#334155" metalness={0.7} />
					</mesh>
					{/* မီးရောင် မှန်မျက်နှာပြင် (Warm Glow Lamp Face) */}
					<mesh position={[0, 0.09, 0]}>
						<cylinderGeometry args={[0.09, 0.09, 0.02, 10]} />
						<meshStandardMaterial color="#fef08a" roughness={0.1} />
					</mesh>
				</group>
			))}
		</group>
	);
}

/**
 * ကလေးမြို့ ဆိုင်းဘုတ်ကြီး (Kalaymyo Landmark Monument Component)
 * - တည်နေရာ (Location): Lat 23.1600815, Lng 94.0470009
 * - Scene X: 295.571, Scene Z: 261.630 (Local U=24.0, V=394.0)
 * - မျက်နှာမူ (Facing): South / 180.0° (KALAY_SIGN_ROTATION = angle rad)
 * - ဒေါင်တိုင်များ (Pillars): အရှေ့ဘက် (East: x=1.65) နှင့် အနောက်ဘက် (West: x=-1.65) ဘေးချင်းယှဉ်လျက် မတ်မတ်ရပ်တည်
 */
export function KalaySignboard() {
	const c = kalaySignCoords;
	// Signboard faces South / 180.0°
	// Local +Z points South (bearing 180.0°)
	// Local +X points East (bearing 90.0°)
	// Local -X points West (bearing 270.0°)
	const rot = KALAY_SIGN_ROTATION;

	return (
		<group position={[c.x, 0, c.z]} rotation={[0, rot, 0]} name="kalaymyo-city-signboard-landmark">
			{/* ၁။ ပန်းခြံကျွန်းနှင့် ခံတပ်ရိုး တံတိုင်းတို (Garden Island Mound & Crenellated Parapet Wall) */}
			<GardenIslandAndParapet />

			{/* ၂။ ရွှေမုခ်တိုင်ကြီး ၂ တိုင် (Twin Ornate Ceremonial Pillars) */}
			{/* အနောက်ဘက် ဒေါင်တိုင် (West Pillar at x = -1.65, bearing 270°) */}
			<CeremonialPillar x={-1.65} />
			{/* အရှေ့ဘက် ဒေါင်တိုင် (East Pillar at x = 1.65, bearing 90°) */}
			<CeremonialPillar x={1.65} />

			{/* ၃။ ပင်မ "ကလေးမြို့" ဆိုင်းဘုတ်ပြားကြီး (Main Signboard with Gilded Frame & 3D Gold Letters) */}
			<MainSignboardPlaque />
		</group>
	);
}
