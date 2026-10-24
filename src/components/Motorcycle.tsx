import { useMemo } from 'react';
import {
	motorcycleData,
	MOTORCYCLE_X,
	MOTORCYCLE_Z,
	MOTORCYCLE_YAW,
} from '../data/motorcycle';
import { mobileQuality } from '../game/sceneBudget';

// motorcycle.png ပါ စစ်မှန်သော အရောင်စပ်များ (Authentic Color Palette from motorcycle.png)
const BLUE_BODY = '#2196d2'; // Sky blue chassis, fender, cowl, side covers
const BLUE_DARK = '#1773a5'; // Deep blue shadow / inner accents
const WHITE_APRON = '#f8fafc'; // Ivory / white curved front leg shield apron
const SEAT_BLACK = '#1f2228'; // Charcoal black upholstered seat
const CHROME_SILVER = '#cbd5e1'; // Chrome exhaust, shocks, handlebar, rims
const ENGINE_GRAY = '#94a3b8'; // Aluminum crankcase engine block
const RUBBER_BLACK = '#1a1c20'; // Black rubber tires, footpegs, handgrips
const AMBER_LIGHT = '#f59e0b'; // Amber turn signals
const RED_TAILLIGHT = '#dc2626'; // Red rear tail light
const HEADLIGHT_GLASS = '#e0f2fe'; // Crystal clear headlight glass

/**
 * ဘီးတစ်ဖက် (Spoke Wheel with black rubber tire, chrome rim, hub & radial spokes)
 */
function SpokeWheel({ z, radius = 0.28 }: { z: number; radius?: number }) {
	const spokeCount = mobileQuality ? 8 : 16;
	const spokeAngles = useMemo(() => {
		return Array.from({ length: spokeCount }, (_, i) => (i * Math.PI) / (spokeCount / 2));
	}, [spokeCount]);

	return (
		<group position={[0, radius, z]} name="spoke-wheel">
			{/* အပြင်ဘက် တာယာ ရာဘာ (Black Rubber Tire) */}
			<mesh rotation={[0, Math.PI / 2, 0]} castShadow>
				<torusGeometry args={[radius * 0.88, radius * 0.14, 8, 20]} />
				<meshStandardMaterial color={RUBBER_BLACK} roughness={0.85} />
			</mesh>

			{/* စတီး ဘီးခွေ (Chrome Wheel Rim) */}
			<mesh rotation={[0, Math.PI / 2, 0]}>
				<cylinderGeometry args={[radius * 0.82, radius * 0.82, 0.05, 20, 1, true]} />
				<meshStandardMaterial color={CHROME_SILVER} metalness={0.85} roughness={0.2} />
			</mesh>

			{/* အလယ် ဘီးဝင်ရိုးနှင့် ဘရိတ်အုံ (Wheel Hub & Drum Brake) */}
			<mesh rotation={[0, Math.PI / 2, 0]} castShadow>
				<cylinderGeometry args={[0.07, 0.07, 0.08, 12]} />
				<meshStandardMaterial color={CHROME_SILVER} metalness={0.75} roughness={0.3} />
			</mesh>

			{/* အလယ်ဝင်ရိုးစွန်း (Axle nut) */}
			<mesh rotation={[0, Math.PI / 2, 0]}>
				<cylinderGeometry args={[0.02, 0.02, 0.13, 8]} />
				<meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
			</mesh>

			{/* စတီးဒေါက်များ (Radial Wheel Spokes) */}
			{!mobileQuality &&
				spokeAngles.map((angle, idx) => (
					<mesh
						key={idx}
						rotation={[angle, 0, 0]}
						position={[0, 0, 0]}
					>
						<cylinderGeometry args={[0.003, 0.003, radius * 1.5, 4]} />
						<meshStandardMaterial color={CHROME_SILVER} metalness={0.9} roughness={0.15} />
					</mesh>
				))}
		</group>
	);
}

/**
 * စစ်မှန်သော မြန်မာ့လူသုံးများသည့် မော်တော်ဆိုင်ကယ် (Classic Blue & White Underbone Motorcycle - motorcycle.png)
 * Honda Super Cub / Wave စတိုင်: အပြာရောင် ကိုယ်ထည်၊ အဖြူရောင် အကာဒိုင်း၊ ဘီးစပုတ်၊ မီးလုံးနှင့် အိတ်ဇောပိုက် အပြည့်အစုံ ပါဝင်သည်
 */
export function MotorcycleModel({ scale = 1.0 }: { scale?: number }) {
	const wheelR = 0.28;
	const frontZ = 0.58;
	const rearZ = -0.58;

	return (
		<group scale={scale} name="classic-motorcycle-model">
			{/* ၁။ ရှေ့ဘီးနှင့် နောက်ဘီးများ (Front and Rear Wheels) */}
			<SpokeWheel z={frontZ} radius={wheelR} />
			<SpokeWheel z={rearZ} radius={wheelR} />

			{/* ၂။ ရှေ့ခက်ရင်းဒေါက်နှင့် ဖန်ဒါကာဗာ (Front Fork & Blue Fender) */}
			<group position={[0, wheelR, frontZ]}>
				{/* ဘယ်/ညာ ခက်ရင်းတိုင်များ (Twin Fork Legs) */}
				{[-0.065, 0.065].map((side, i) => (
					<mesh
						key={i}
						position={[side, 0.16, -0.06]}
						rotation={[-0.32, 0, 0]}
						castShadow
					>
						<cylinderGeometry args={[0.022, 0.024, 0.44, 8]} />
						<meshStandardMaterial color={BLUE_BODY} roughness={0.35} metalness={0.25} />
					</mesh>
				))}

				{/* ရှေ့ဘီးကာ အပြာရောင် ဖန်ဒါ (Curved Front Mudguard / Fender) */}
				<mesh position={[0, 0.22, -0.04]} rotation={[-0.3, 0, 0]} castShadow>
					<cylinderGeometry args={[wheelR * 1.05, wheelR * 1.05, 0.11, 14, 1, true, 0, Math.PI * 0.7]} />
					<meshStandardMaterial color={BLUE_BODY} roughness={0.3} metalness={0.25} />
				</mesh>
			</group>

			{/* ၃။ စတီယာရင်ခေါင်း၊ လက်ကိုင်ဘားနှင့် ရှေ့မီးကြီး (Steering Column, Handlebar & Headlamp) */}
			<group position={[0, 0.82, 0.44]} rotation={[-0.22, 0, 0]}>
				{/* အလယ် အပြာရောင် မီးခေါင်းအုံ (Handlebar Headlamp Cowl) */}
				<mesh position={[0, 0.08, 0.02]} castShadow>
					<boxGeometry args={[0.18, 0.15, 0.14]} />
					<meshStandardMaterial color={BLUE_BODY} roughness={0.3} metalness={0.25} />
				</mesh>

				{/* ရှေ့မီးကြီး ဖန်သားပြင် (Front Headlight Lens) */}
				<mesh position={[0, 0.08, 0.095]} rotation={[Math.PI / 2, 0, 0]}>
					<cylinderGeometry args={[0.055, 0.055, 0.02, 16]} />
					<meshStandardMaterial color={HEADLIGHT_GLASS} roughness={0.15} metalness={0.4} />
				</mesh>

				{/* မီးကြီး အလယ် အလင်းပြန် (Headlight Chrome Rim) */}
				<mesh position={[0, 0.08, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
					<torusGeometry args={[0.056, 0.008, 8, 16]} />
					<meshStandardMaterial color={CHROME_SILVER} metalness={0.85} roughness={0.2} />
				</mesh>

				{/* ဘယ်/ညာ လိမ္မော်ရောင် မီးအချက်ပြများ (Amber Indicator Pods) */}
				{[-0.11, 0.11].map((side, i) => (
					<mesh key={i} position={[side, 0.07, 0.05]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.022, 0.022, 0.025, 10]} />
						<meshStandardMaterial color={AMBER_LIGHT} roughness={0.2} />
					</mesh>
				))}

				{/* စတီး လက်ကိုင်ဘားတန်း (Chrome Handlebar Tube) */}
				<mesh position={[0, 0.06, -0.01]} rotation={[0, 0, Math.PI / 2]} castShadow>
					<cylinderGeometry args={[0.014, 0.014, 0.62, 10]} />
					<meshStandardMaterial color={CHROME_SILVER} metalness={0.85} roughness={0.2} />
				</mesh>

				{/* ဘယ်/ညာ အနက်ရောင် ရာဘာ လက်ကိုင်ဆုပ် (Black Rubber Handgrips) */}
				{[-0.27, 0.27].map((side, i) => (
					<group key={i} position={[side, 0.06, -0.01]}>
						<mesh rotation={[0, 0, Math.PI / 2]}>
							<cylinderGeometry args={[0.019, 0.019, 0.11, 10]} />
							<meshStandardMaterial color={RUBBER_BLACK} roughness={0.85} />
						</mesh>
						{/* စတီး ဘရိတ်/ကလပ်စ် လက်တံ (Brake / Clutch Lever) */}
						<mesh position={[0, -0.02, 0.04]} rotation={[0.2, side > 0 ? 0.3 : -0.3, 0]}>
							<boxGeometry args={[0.08, 0.008, 0.014]} />
							<meshStandardMaterial color={CHROME_SILVER} metalness={0.85} roughness={0.2} />
						</mesh>
					</group>
				))}

				{/* ညာဘက် စတီးရိုး နောက်ကြည့်မှန် (Right-side Rear-View Mirror from motorcycle.png) */}
				<group position={[0.24, 0.12, 0.01]}>
					{/* မတ်စောက်သော စတီးမှန်ရိုးတံ (Slanted Mirror Stem) */}
					<mesh position={[0.04, 0.1, 0]} rotation={[0, 0, -0.35]}>
						<cylinderGeometry args={[0.005, 0.005, 0.22, 8]} />
						<meshStandardMaterial color={CHROME_SILVER} metalness={0.85} roughness={0.2} />
					</mesh>
					{/* အဝိုင်းပုံ မှန်ခွက် (Round Mirror Head) */}
					<group position={[0.09, 0.19, 0]}>
						<mesh rotation={[Math.PI / 2, 0, 0]}>
							<cylinderGeometry args={[0.048, 0.048, 0.012, 16]} />
							<meshStandardMaterial color={BLUE_BODY} roughness={0.3} metalness={0.25} />
						</mesh>
						<mesh position={[0, 0, -0.007]} rotation={[Math.PI / 2, 0, 0]}>
							<cylinderGeometry args={[0.042, 0.042, 0.002, 16]} />
							<meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
						</mesh>
					</group>
				</group>
			</group>

			{/* ၄။ အဖြူရောင် လေကာဒိုင်း / ခြေကာဒိုင်း (White Curved Leg Shield Apron - iconic Super Cub apron) */}
			<group position={[0, 0.52, 0.28]} name="leg-shield-apron">
				{/* အလယ်ဗဟို ကွေးဆင်းသွားသော အကာလွှာ (Center Scoop Fairing) */}
				<mesh position={[0, 0.02, -0.04]} rotation={[0.42, 0, 0]} castShadow>
					<boxGeometry args={[0.22, 0.44, 0.03]} />
					<meshStandardMaterial color={WHITE_APRON} roughness={0.35} />
				</mesh>
				{/* ဘယ်ဘက် ခြေကာတောင်ပံ (Left Wing Flange) */}
				<mesh position={[-0.16, 0.01, -0.02]} rotation={[0.38, 0.28, -0.1]} castShadow>
					<boxGeometry args={[0.16, 0.42, 0.025]} />
					<meshStandardMaterial color={WHITE_APRON} roughness={0.35} />
				</mesh>
				{/* ညာဘက် ခြေကာတောင်ပံ (Right Wing Flange) */}
				<mesh position={[0.16, 0.01, -0.02]} rotation={[0.38, -0.28, 0.1]} castShadow>
					<boxGeometry args={[0.16, 0.42, 0.025]} />
					<meshStandardMaterial color={WHITE_APRON} roughness={0.35} />
				</mesh>
			</group>

			{/* ၅။ ပင်မ ကိုယ်ထည် ဖရိမ်နှင့် အင်ဂျင်အုံ (Main Step-Through Blue Chassis & Engine) */}
			<group name="main-chassis-and-engine">
				{/* လည်ပင်းမှ အောက်သို့ဆင်းသော ပင်မ အပြာရောင် ဖရိမ် (Main Underbone Tube) */}
				<mesh position={[0, 0.54, 0.16]} rotation={[0.55, 0, 0]} castShadow>
					<boxGeometry args={[0.12, 0.42, 0.14]} />
					<meshStandardMaterial color={BLUE_BODY} roughness={0.3} metalness={0.25} />
				</mesh>

				{/* အောက်ခြေ အလျားလိုက် အင်ဂျင်အုံ (Horizontal 4-Stroke Engine Block from motorcycle.png) */}
				<group position={[0, 0.28, 0.02]}>
					{/* ပင်မ အလွိုင်း အင်ဂျင်ဘလောက် (Crankcase Block) */}
					<mesh castShadow>
						<boxGeometry args={[0.22, 0.18, 0.26]} />
						<meshStandardMaterial color={ENGINE_GRAY} metalness={0.65} roughness={0.35} />
					</mesh>
					{/* ရှေ့သို့ထိုးထွက်နေသော ဆလင်ဒါခေါင်း (Forward-facing Horizontal Cylinder Head) */}
					<mesh position={[0, 0.02, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
						<cylinderGeometry args={[0.075, 0.075, 0.16, 12]} />
						<meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
					</mesh>
					{/* ညာဘက် အင်ဂျင်ကလပ်စ်အုံ အဝိုင်း (Circular Clutch Cover) */}
					<mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.08, 0.08, 0.03, 16]} />
						<meshStandardMaterial color={ENGINE_GRAY} metalness={0.7} roughness={0.3} />
					</mesh>
				</group>

				{/* အလယ် ဘက်ထရီကာဗာနှင့် အပြာရောင် ဘေးကာများ (Blue Side Fairings / Battery Covers) */}
				<group position={[0, 0.48, -0.14]}>
					<mesh castShadow>
						<boxGeometry args={[0.22, 0.26, 0.36]} />
						<meshStandardMaterial color={BLUE_BODY} roughness={0.3} metalness={0.25} />
					</mesh>
					{/* ဘယ်ဘက် ဖောင်းကြွ ကာဗာအပြာ (Left Side Cover Oval Bulge) */}
					<mesh position={[-0.115, -0.02, 0]} scale={[0.3, 1, 1.2]}>
						<sphereGeometry args={[0.11, 12, 10]} />
						<meshStandardMaterial color={BLUE_BODY} roughness={0.3} metalness={0.25} />
					</mesh>
					{/* ညာဘက် ဖောင်းကြွ ကာဗာအပြာ (Right Side Cover Oval Bulge) */}
					<mesh position={[0.115, -0.02, 0]} scale={[0.3, 1, 1.2]}>
						<sphereGeometry args={[0.11, 12, 10]} />
						<meshStandardMaterial color={BLUE_BODY} roughness={0.3} metalness={0.25} />
					</mesh>
				</group>
			</group>

			{/* ၆။ အနက်ရောင် ဆိုင်ကယ်ထိုင်ခုံ (Upholstered Black Seat Saddle) */}
			<group position={[0, 0.68, -0.22]} name="motorcycle-seat">
				{/* ပင်မ ထိုင်ခုံသား (Contoured Seat Cushion) */}
				<mesh position={[0, 0, 0]} castShadow>
					<boxGeometry args={[0.26, 0.11, 0.58]} />
					<meshStandardMaterial color={SEAT_BLACK} roughness={0.8} metalness={0.1} />
				</mesh>
				{/* ရှေ့ပိုင်း သွယ်ဆင်းသွားသော အနားသတ် (Front Taper) */}
				<mesh position={[0, -0.02, 0.26]} rotation={[-0.2, 0, 0]}>
					<boxGeometry args={[0.22, 0.08, 0.12]} />
					<meshStandardMaterial color={SEAT_BLACK} roughness={0.8} />
				</mesh>
			</group>

			{/* ၇။ နောက်ဘီးကာ ဖန်ဒါနှင့် နောက်မီးနီ (Deep Rear Mudguard & Taillight) */}
			<group position={[0, wheelR, rearZ]} name="rear-fender-and-taillight">
				{/* နောက်ဘီး အပြာရောင် ဖန်ဒါကာ (Deep Blue Rear Fender Arcing Over Wheel) */}
				<mesh position={[0, 0.16, -0.02]} rotation={[0.4, 0, 0]} castShadow>
					<cylinderGeometry args={[wheelR * 1.06, wheelR * 1.06, 0.18, 14, 1, true, 0, Math.PI * 0.85]} />
					<meshStandardMaterial color={BLUE_BODY} roughness={0.3} metalness={0.25} />
				</mesh>

				{/* နောက်ဘက် အနီရောင် မီးလုံး (Red Taillight Box from motorcycle.png) */}
				<group position={[0, 0.28, -0.28]}>
					{/* မီးခွက် အနက်ရောင် ခုံ (Black Taillight Housing) */}
					<mesh position={[0, 0, 0]} castShadow>
						<boxGeometry args={[0.1, 0.08, 0.05]} />
						<meshStandardMaterial color={RUBBER_BLACK} roughness={0.7} />
					</mesh>
					{/* အနီရောင် မှန်ဘီလူး (Red Lens) */}
					<mesh position={[0, 0, -0.028]}>
						<boxGeometry args={[0.08, 0.06, 0.015]} />
						<meshStandardMaterial color={RED_TAILLIGHT} roughness={0.2} metalness={0.3} />
					</mesh>
					{/* နံပါတ်ပြား အဖြူရောင် (White License Plate Bracket) */}
					<mesh position={[0, -0.07, -0.015]} rotation={[0.2, 0, 0]}>
						<boxGeometry args={[0.12, 0.07, 0.005]} />
						<meshStandardMaterial color="#f1f5f9" roughness={0.4} />
					</mesh>
				</group>

				{/* ဘယ်/ညာ နောက်ဆိုင်းထိန်း စပရင်ရှော့ဘားများ (Twin Rear Chrome Shock Absorbers) */}
				{[-0.11, 0.11].map((side, i) => (
					<group key={i} position={[side, 0.18, -0.04]} rotation={[0.3, 0, 0]}>
						{/* အပေါ် အပြာရောင် ခွက်ခေါင်း (Top Blue Cap) */}
						<mesh position={[0, 0.12, 0]}>
							<cylinderGeometry args={[0.022, 0.022, 0.08, 8]} />
							<meshStandardMaterial color={BLUE_BODY} roughness={0.35} metalness={0.25} />
						</mesh>
						{/* စတီး စပရင်လိုင်း (Chrome Coil Spring Shaft) */}
						<mesh position={[0, 0, 0]}>
							<cylinderGeometry args={[0.018, 0.018, 0.18, 8]} />
							<meshStandardMaterial color={CHROME_SILVER} metalness={0.85} roughness={0.2} />
						</mesh>
					</group>
				))}
			</group>

			{/* ၈။ အိတ်ဇောပိုက်နှင့် ဆိုင်လင်ဆာ (Chrome Exhaust Pipe & Long Muffler on Right Side) */}
			<group position={[0.16, 0.18, 0]} name="chrome-exhaust-system">
				{/* အင်ဂျင်ခေါင်းမှ ကွေးဆင်းလာသော ပိုက် (Curved Header Pipe) */}
				<mesh position={[0, 0.05, 0.16]} rotation={[-0.4, 0, 0]} castShadow>
					<cylinderGeometry args={[0.022, 0.022, 0.22, 8]} />
					<meshStandardMaterial color={CHROME_SILVER} metalness={0.9} roughness={0.15} />
				</mesh>
				{/* နောက်သို့ ရှည်လျားစွာ ပြေးသွားသော အိတ်ဇောပြွန်မကြီး (Long Megaphone Muffler) */}
				<mesh position={[0, 0.02, -0.32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
					<cylinderGeometry args={[0.038, 0.028, 0.72, 12]} />
					<meshStandardMaterial color={CHROME_SILVER} metalness={0.9} roughness={0.15} />
				</mesh>
				{/* အိတ်ဇောထိပ်ဖူး စတီးကွင်း (Exhaust Chrome Tip) */}
				<mesh position={[0, 0.02, -0.68]} rotation={[Math.PI / 2, 0, 0]}>
					<cylinderGeometry args={[0.024, 0.038, 0.04, 12]} />
					<meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
				</mesh>
			</group>

			{/* ၉။ ခြေနင်းတံနှင့် ဆိုင်ကယ်ထောက် (Footpegs & Parked Kickstand) */}
			<group position={[0, 0.22, 0]} name="footpegs-and-kickstand">
				{/* ဘယ်/ညာ ရာဘာခြေနင်းတံများ (Left & Right Rider Footpegs) */}
				{[-0.22, 0.22].map((side, i) => (
					<mesh key={i} position={[side, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
						<cylinderGeometry args={[0.02, 0.02, 0.14, 8]} />
						<meshStandardMaterial color={RUBBER_BLACK} roughness={0.85} />
					</mesh>
				))}

				{/* ဘယ်ဘက် ဘေးထောက်တံ (Left Side Stand - resting on ground y=0) */}
				<mesh position={[-0.14, -0.1, -0.05]} rotation={[0.2, 0, 0.42]} castShadow>
					<cylinderGeometry args={[0.012, 0.012, 0.26, 6]} />
					<meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
				</mesh>
				{/* ဘေးထောက်ခြေခုံ (Side Stand Foot Plate) */}
				<mesh position={[-0.22, -0.21, -0.03]}>
					<boxGeometry args={[0.04, 0.01, 0.06]} />
					<meshStandardMaterial color="#1e293b" roughness={0.6} />
				</mesh>
			</group>
		</group>
	);
}

/**
 * သတ်မှတ်ထားသော မြေပုံတည်နေရာတွင် ရပ်ထားသည့် မော်တော်ဆိုင်ကယ် ကွန်ပိုနန့်
 * - တည်နေရာ (Location): နယ်မြေ (၅) · အနောက်ဘက်ရပ်ကွက်
 *   Lat 23.1612262, Lng 94.0462532 (Scene X=145.190, Z=230.083, Local U=-60.028, V=265.358)
 * - မျက်နှာမူ (Facing): East (79.1 deg), Cartoon yaw: -0.594620 rad
 */
export function ParkedMotorcycle() {
	const c = motorcycleData;
	// ဆိုင်ကယ်သည် ဘေးထောက်ပေါ်တွင် ၄ ဒီဂရီခန့် သဘာဝအတိုင်း ဘယ်ဘက်သို့ အနည်းငယ် စောင်း၍ ရပ်တည်နေသည် (natural parked lean)
	const parkedLean = -0.07; // ~4 deg left lean

	return (
		<group
			position={[c.x, 0, c.z]}
			rotation={[0, c.rotation, parkedLean]}
			name="parked-motorcycle-area5-west"
		>
			<MotorcycleModel scale={1.0} />
		</group>
	);
}
