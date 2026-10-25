import { useRef } from 'react';
import { useRegionFrame as useFrame } from './RegionActivity';
import { Mesh } from 'three';
import { angle } from '../data/ward';
import { Box } from './Primitives';
import { mobileQuality } from '../game/sceneBudget';

/**
 * ရေဘုံဘိုင်နှင့် ရေစုပ်စက် (Tube-well Water Pump Station):
 * - တည်နေရာ (Location): Scene X=109.721, Z=284.313 (Local U=-123.455, V=278.624)
 * - မျက်နှာမူ (Facing): North
 * - လက်နှိပ်ဘုံဘိုင် (Cast-iron Hand Pump - cast-iron-hand.png ပုံစံအတိုင်း အပြာရောင်၊ အဝါ/အဖြူ တံဆိပ်စာပြားများ၊ မောင်းတံရှည်နှင့် ရော်ဘာလက်ကိုင်)
 * - သံလက်နှိပ်ဘုံဘိုင်၏ နှုတ်သီးခေါင်းပေါက်မှ တိုက်ရိုက် အလိုအလျောက် ထွက်ကျစီးဆင်းနေသော ရေစီးကြောင်းကြီးနှင့် ရေလှိုင်းငယ်များ
 */
export const PUMP_X = 109.721;
export const PUMP_Z = 284.313;
export const PUMP_ROT = angle;

// Colors matching cast-iron-hand.png
const PUMP_BLUE = '#1c5ea2';
const PUMP_DARK_BLUE = '#144677';
const PUMP_BOLT = '#164879';
const STICKER_YELLOW = '#eab308';
const STICKER_RED = '#b91c1c';
const STICKER_WHITE = '#f8fafc';
const RUBBER_BLACK = '#18181b';

/**
 * သံလက်နှိပ်ဘုံဘိုင် နှုတ်သီးခေါင်းမှ တိုက်ရိုက် မြေပြင်သို့ အလိုအလျောက် ထွက်ကျစီးဆင်းနေသော ရေစီးကြောင်းကြီး (Water Stream from Hand Pump Spout)
 */
function HandPumpWaterStream() {
	const coreStreamRef = useRef<Mesh>(null);
	const veilStreamRef = useRef<Mesh>(null);
	const splashRef = useRef<Mesh>(null);
	const rippleRefs = [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)];

	useFrame(({ clock }) => {
		const t = clock.elapsedTime;

		// ၁။ သံလက်နှိပ်ဘုံဘိုင်မှ ထွက်ကျနေသော ရေစီးကြောင်းကြီး၏ သန်မာလှိုင်းထန်မှု (Turbulent Gushing Stream Core)
		if (coreStreamRef.current) {
			const pulse = 1 + Math.sin(t * 22) * 0.08;
			coreStreamRef.current.scale.set(pulse, 1, 1 + Math.cos(t * 24) * 0.08);
		}
		if (veilStreamRef.current) {
			const veilPulse = 1 + Math.cos(t * 20) * 0.09;
			veilStreamRef.current.scale.set(veilPulse, 1, 1 + Math.sin(t * 25) * 0.09);
		}

		// ၂။ မြေပြင်/ကွန်ကရစ်ခုံသို့ ထိခတ်ရာနေရာမှ ရေဖွေး/ရေပန်း (Impact Splash Dome)
		if (splashRef.current) {
			const splashPulse = 1 + Math.sin(t * 26) * 0.18;
			splashRef.current.scale.set(splashPulse, 1 + Math.cos(t * 28) * 0.22, splashPulse);
		}

		// ၃။ မြေပြင်ရေအိုင်အတွင်း ပြန့်ကားထွက်သွားသော ရေလှိုင်းကွင်းများ (Expanding Ripple Rings)
		rippleRefs.forEach((ref, i) => {
			if (!ref.current) return;
			const phase = (t * 1.5 + i * 0.33) % 1;
			const scale = 0.2 + phase * 1.6;
			ref.current.scale.set(scale, scale, 1);
			const mat = ref.current.material as any;
			if (mat) {
				mat.opacity = Math.max(0, (1 - phase) * 0.75);
			}
		});
	});

	return (
		<group name="hand-pump-flowing-water">
			{/* က။ နှုတ်သီးပေါက် အတွင်းပိုင်း ရေပွက်လိုင်း (Gushing Water within the Iron Spout Mouth) */}
			<mesh position={[0, 0.38, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
				<cylinderGeometry args={[0.04, 0.04, 0.06, 16]} />
				<meshStandardMaterial
					color="#70d6eb"
					transparent
					opacity={0.9}
					roughness={0.1}
					metalness={0.2}
				/>
			</mesh>

			{/* ခ။ သံလက်နှိပ်ဘုံဘိုင် နှုတ်သီးမှ အောက်သို့ တိုက်ရိုက် ဦးစိုက်ကျဆင်းနေသော ပင်မ ရေစီးကြောင်းကြီး (Main Gushing Water Stream) */}
			{/* ရေစီးကြောင်း အတွင်းအူတိုင် (Solid Water Core: from mouth y=0.38, z=0.125 down to ground y=0.015, z=0.48) */}
			<mesh
				ref={coreStreamRef}
				position={[0, 0.2, 0.302]}
				rotation={[0.82, 0, 0]}
				castShadow
			>
				<cylinderGeometry args={[0.044, 0.078, 0.48, 16]} />
				<meshStandardMaterial
					color="#4ec2db"
					transparent
					opacity={0.85}
					roughness={0.08}
					metalness={0.25}
				/>
			</mesh>

			{/* ရေစီးကြောင်း အပြင်လွှာ ရေဖွေးအမြှုပ်လွှာ (Frothing Water Veil / Foam) */}
			<mesh
				ref={veilStreamRef}
				position={[0, 0.2, 0.302]}
				rotation={[0.82, 0, 0]}
			>
				<cylinderGeometry args={[0.05, 0.088, 0.48, 16]} />
				<meshStandardMaterial
					color="#dbf8fd"
					transparent
					opacity={0.4}
					roughness={0.15}
				/>
			</mesh>

			{/* ဂ။ ရေကျရောက်ထိခတ်ရာ ဗဟိုနေရာ (Splash Impact Point on Basin) */}
			<mesh ref={splashRef} position={[0, 0.03, 0.48]} castShadow>
				<sphereGeometry args={[0.15, 12, 10]} />
				<meshStandardMaterial
					color="#e2f9fd"
					transparent
					opacity={0.9}
					roughness={0.1}
				/>
			</mesh>

			{/* ဃ။ ဖြာထွက်နေသော ရေပေါက် ရေစက်ကလေးများ (Splashing Water Spray Droplets) */}
			{[-0.12, 0.13, -0.05, 0.08, 0].map((dx, idx) => (
				<mesh
					key={idx}
					position={[dx, 0.08 + (idx % 2) * 0.06, 0.48 + (idx % 3) * 0.08]}
				>
					<sphereGeometry args={[0.026, 6, 6]} />
					<meshStandardMaterial color="#f0fcfe" transparent opacity={0.92} />
				</mesh>
			))}

			{/* င။ ကွန်ကရစ်ခုံပေါ်က စိုစွတ်တောက်ပနေသော ရေအိုင်ကြီး (Wet Glistening Water Puddle) */}
			<mesh position={[0, 0.012, 0.48]} rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.68, 24]} />
				<meshStandardMaterial
					color="#3ba9be"
					transparent
					opacity={0.72}
					roughness={0.05}
					metalness={0.3}
				/>
			</mesh>

			{/* စ။ ပြန့်ကားထွက်နေသော ရေလှိုင်းကွင်း ၃ ခု (3 Dynamic Expanding Ripple Rings) */}
			{rippleRefs.map((ref, i) => (
				<mesh
					key={i}
					ref={ref}
					position={[0, 0.016, 0.48]}
					rotation={[-Math.PI / 2, 0, 0]}
				>
					<ringGeometry args={[0.18, 0.25, 24]} />
					<meshBasicMaterial color="#bdf4fc" transparent opacity={0.65} />
				</mesh>
			))}

			{/* ဆ။ ကွန်ကရစ်ခုံမှ မြေပြင်သို့ လျှံကျစီးဆင်းနေသော ရေစီးကြောင်း (Overflow Water Stream to Earth) */}
			<mesh position={[0, 0.01, 0.95]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[0.34, 0.55]} />
				<meshStandardMaterial
					color="#47b4c7"
					transparent
					opacity={0.68}
					roughness={0.1}
				/>
			</mesh>
		</group>
	);
}

/**
 * cast-iron-hand.png အတိုင်း သီးသန့်တည်ဆောက်ထားသော မြန်မာ့ရိုးရာ အပြာရောင် သံလက်နှိပ်ဘုံဘိုင်
 */
export function CastIronHandPump() {
	return (
		<group name="cast-iron-hand-pump">
			{/* ၁။ အောက်ခြေ စတုရန်း ဖလန်းပြားနှင့် ထောင့်စွန်း မူလီခေါင်းများ (Square Base Flange with 4 Corner Bolts) */}
			<Box position={[0, 0.012, 0]} size={[0.26, 0.024, 0.26]} color={PUMP_BLUE} />
			{/* အောက်ခြေ မူလီ ၄ လုံး (4 Corner Mounting Bolts) */}
			{[-0.095, 0.095].map((bx) =>
				[-0.095, 0.095].map((bz) => (
					<mesh key={`${bx}-${bz}`} position={[bx, 0.028, bz]}>
						<cylinderGeometry args={[0.012, 0.014, 0.016, 6]} />
						<meshStandardMaterial color={PUMP_BOLT} roughness={0.4} />
					</mesh>
				))
			)}
			{/* အောက်ခြေ လည်ပင်းကွင်း (Lower Neck Collar) */}
			<mesh position={[0, 0.035, 0]}>
				<cylinderGeometry args={[0.088, 0.096, 0.03, 16]} />
				<meshStandardMaterial color={PUMP_BLUE} roughness={0.45} />
			</mesh>

			{/* ၂။ ပင်မ ဆလင်ဒါ ကိုယ်ထည်ပြွန်ကြီး (Main Cylindrical Body / Barrel) */}
			<mesh position={[0, 0.35, 0]} castShadow>
				<cylinderGeometry args={[0.082, 0.082, 0.62, 24]} />
				<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} metalness={0.18} />
			</mesh>

			{/* ၃။ ရှေ့ဘက် ရေထွက်ခေါင်း / နှုတ်သီးပေါက် (Circular Front Discharge Spout) */}
			<group position={[0, 0.38, 0.08]}>
				{/* နှုတ်သီး လည်တိုင် (Spout Neck) */}
				<mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
					<cylinderGeometry args={[0.046, 0.046, 0.06, 16]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} />
				</mesh>
				{/* အပြင်နှုတ်ခမ်း ဖလန်းကွင်း (Flared Outer Mouth Rim) */}
				<mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
					<cylinderGeometry args={[0.056, 0.056, 0.025, 16]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} />
				</mesh>
				{/* အတွင်းဘက် အပေါက်နက် (Dark Inner Bore Hole) */}
				<mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
					<cylinderGeometry args={[0.038, 0.038, 0.02, 12]} />
					<meshStandardMaterial color="#0b243b" roughness={0.6} />
				</mesh>
			</group>

			{/* ၄။ ဆလင်ဒါပေါ်ရှိ တံဆိပ်နှင့် အညွှန်းစာတန်းများ (Authentic Labels from Photo) */}
			{/* အပေါ် အဝါရောင် အမှတ်တံဆိပ် စတစ်ကာပြား (Upper Yellow Brand Sticker) */}
			<group position={[0, 0.49, 0.083]}>
				<Box position={[0, 0, 0]} size={[0.11, 0.065, 0.002]} color={STICKER_YELLOW} />
				{/* အနီရောင် ခေါင်းစည်းလိုင်း (Red Header Banner) */}
				<Box position={[0, 0.02, 0.001]} size={[0.095, 0.012, 0.002]} color={STICKER_RED} />
				{/* စာတန်းလိုင်းငယ်များ (Text Markings Simulation) */}
				<Box position={[0, 0.004, 0.001]} size={[0.085, 0.005, 0.002]} color="#1e293b" />
				<Box position={[0, -0.01, 0.001]} size={[0.08, 0.005, 0.002]} color="#1e293b" />
			</group>

			{/* အောက် အဖြူရောင် အသုံးပြုပုံ အညွှန်းဇယားပြား (Lower White Instruction Chart) */}
			<group position={[0, 0.22, 0.083]}>
				<Box position={[0, 0, 0]} size={[0.11, 0.15, 0.002]} color={STICKER_WHITE} />
				{/* ဇယားဘောင်လိုင်း (Frame) */}
				<Box position={[0, 0.025, 0.001]} size={[0.095, 0.085, 0.001]} color="#cbd5e1" />
				{/* ဇယားအောက်ခြေ အဝါရောင်အကွက် (Yellow Bottom Section on Placard) */}
				<Box position={[0, -0.045, 0.001]} size={[0.095, 0.04, 0.002]} color={STICKER_YELLOW} />
				{/* ဇယားအတွင်း စာတန်း/ပုံကြမ်းလိုင်းများ (Instruction Lines) */}
				{[-0.05, -0.038, 0.015, 0.035, 0.055].map((dy) => (
					<Box
						key={dy}
						position={[0, dy, 0.002]}
						size={[0.08, 0.004, 0.002]}
						color="#334155"
					/>
				))}
			</group>

			{/* ၅။ ထိပ်ဖုံး ဖလန်းပြား (Top Flange Cap Disc with Rim Bolts) */}
			<group position={[0, 0.67, 0]}>
				{/* ထိပ်ဖုံးအပြား (Flange Disc) */}
				<mesh castShadow>
					<cylinderGeometry args={[0.13, 0.13, 0.028, 24]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} />
				</mesh>
				{/* ပတ်လည် မူလီခေါင်းများ (Rim Bolts around Top Flange) */}
				{[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
					<mesh
						key={i}
						position={[0.11 * Math.cos(a), 0.018, 0.11 * Math.sin(a)]}
					>
						<cylinderGeometry args={[0.01, 0.01, 0.02, 6]} />
						<meshStandardMaterial color={PUMP_BOLT} roughness={0.4} />
					</mesh>
				))}
				{/* အလယ် ပစ်စတင်တံထွက်ပေါက် ဘု (Center Rod Bushing Boss) */}
				<mesh position={[0, 0.025, 0]}>
					<cylinderGeometry args={[0.032, 0.036, 0.035, 12]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} />
				</mesh>
				{/* ဘေးဘက် ရေလောင်းထည့်ပေါက်/ဆီပေါက် ဘုငယ် (Side Priming / Oil Port Boss) */}
				<mesh position={[-0.045, 0.022, 0.025]}>
					<cylinderGeometry args={[0.018, 0.018, 0.03, 8]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} />
				</mesh>
				{/* စက်ရုံတံဆိပ် အဝိုင်းခုံး (Embossed Foundry Logo Seal) */}
				<mesh position={[0.05, 0.016, -0.02]}>
					<cylinderGeometry args={[0.026, 0.026, 0.006, 12]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.3} />
				</mesh>
			</group>

			{/* ၆။ မောင်းတံ ဒေါက်တိုင်နှင့် အထက်တွဲဆက်ခွင် (Fulcrum Bracket & Vertical Links) */}
			<group position={[0.045, 0.69, -0.07]}>
				{/* အောက်ခြေ ထိပ်ဖုံးတွဲကွင်း (Hinge Bracket on Flange) */}
				<Box position={[0, 0.02, 0]} size={[0.035, 0.05, 0.06]} color={PUMP_BLUE} />
				{/* အောက်ခြေ ပတ္တာမူလီနှင့် နပ် (Lower Pivot Bolt) */}
				<mesh position={[0, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.012, 0.012, 0.065, 6]} />
					<meshStandardMaterial color={PUMP_BOLT} />
				</mesh>

				{/* အပေါ်သို့ ထောင်တက်နေသော သံပြားဒေါက်တိုင် ၂ ချောင်း (Twin Upright Fulcrum Link Bars) */}
				<Box position={[-0.015, 0.18, 0]} size={[0.008, 0.32, 0.042]} color={PUMP_BLUE} />
				<Box position={[0.015, 0.18, 0]} size={[0.008, 0.32, 0.042]} color={PUMP_BLUE} />

				{/* အပေါ်ထိပ် အလယ်ပတ္တာမူလီ (Upper Fulcrum Cross Pivot Bolt) */}
				<mesh position={[0, 0.34, 0]} rotation={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.014, 0.014, 0.07, 6]} />
					<meshStandardMaterial color={PUMP_BOLT} />
				</mesh>
			</group>

			{/* ၇။ ပစ်စတင်တံနှင့် အပေါ်ထိပ် ခွချိတ် (Central Piston Rod & Top U-Clevis Yoke) */}
			<group position={[0, 0.69, 0]}>
				{/* ဒေါင်လိုက် ပစ်စတင်တံလုံး (Vertical Steel Piston Rod) */}
				<mesh position={[0, 0.22, 0]} castShadow>
					<cylinderGeometry args={[0.012, 0.012, 0.42, 8]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} metalness={0.2} />
				</mesh>

				{/* ထိပ်ဖျား ခွချိတ်ယိုခ် (Top U-Clevis Yoke) */}
				<group position={[0, 0.44, 0]}>
					{/* အောက်ခြေ လည်ကွင်း (Yoke Base Collar) */}
					<mesh position={[0, 0, 0]}>
						<cylinderGeometry args={[0.022, 0.022, 0.03, 12]} />
						<meshStandardMaterial color={PUMP_BLUE} />
					</mesh>
					{/* U ပုံသဏ္ဌာန် လက် ၂ ချောင်း (Twin U-Shackle Arms) */}
					<Box position={[-0.022, 0.06, 0]} size={[0.012, 0.12, 0.032]} color={PUMP_BLUE} />
					<Box position={[0.022, 0.06, 0]} size={[0.012, 0.12, 0.032]} color={PUMP_BLUE} />
					{/* ထိပ်ဖျား ပတ္တာမူလီ (Top Clevis Hinge Bolt) */}
					<mesh position={[0, 0.11, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.015, 0.015, 0.072, 8]} />
						<meshStandardMaterial color={PUMP_BOLT} />
					</mesh>
				</group>
			</group>

			{/* ၈။ လက်နှိပ်မောင်းတံရှည်ကြီးနှင့် ရော်ဘာလက်ကိုင် (Long Pump Lever Handle & Rubber Grip) */}
			<group position={[0.045, 1.03, -0.07]}>
				{/* ကွေးညွတ်သော သံပြားခေါင်း (Curved Steel Rocker Head) */}
				<group position={[-0.045, 0.12, 0.07]} rotation={[0.4, 0, 0]}>
					<Box position={[0, 0, 0]} size={[0.025, 0.18, 0.048]} color={PUMP_BLUE} />
				</group>

				{/* အောက်သို့ ရှည်လျားစွာ ထိုးဆင်းနေသော လက်ကိုင်မောင်းတံ (Long Handle Bar Angled Downward) */}
				<group rotation={[0.38, 0, -0.42]}>
					{/* သံပိုက် မောင်းတံကိုယ်ထည် (Steel Tube Handle Bar: Length 1.15m) */}
					<mesh position={[0, -0.52, 0]} castShadow>
						<cylinderGeometry args={[0.015, 0.017, 1.08, 8]} />
						<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} metalness={0.15} />
					</mesh>

					{/* ထိပ်ဖျား အနက်ရောင် ရော်ဘာလက်ကိုင်စွပ် (Black Rubber Hand Grip Sleeve at Tip) */}
					<group position={[0, -1.08, 0]}>
						<mesh castShadow>
							<cylinderGeometry args={[0.022, 0.022, 0.16, 12]} />
							<meshStandardMaterial color={RUBBER_BLACK} roughness={0.85} />
						</mesh>
						{/* ရော်ဘာလက်ကိုင် အနားရစ်ခွေများ (Grip Ribs) */}
						{[-0.05, -0.02, 0.01, 0.04].map((ry) => (
							<mesh key={ry} position={[0, ry, 0]}>
								<cylinderGeometry args={[0.0235, 0.0235, 0.012, 12]} />
								<meshStandardMaterial color="#27272a" roughness={0.9} />
							</mesh>
						))}
					</group>
				</group>
			</group>

			{/* ၉။ သံလက်နှိပ်ဘုံဘိုင်၏ နှုတ်သီးခေါင်းပေါက်မှ တိုက်ရိုက် ထွက်ကျနေသော ရေစီးကြောင်းကြီး (Water Flow directly from this pump) */}
			<HandPumpWaterStream />
		</group>
	);
}

export function WaterPump() {
	return (
		<group position={[PUMP_X, 0, PUMP_Z]} rotation={[0, PUMP_ROT, 0]} name="water-pump-station">
			{/* ၁။ ကွန်ကရစ် အောက်ခံခုံ (Concrete Apron/Platform: 2.2m x 2.0m x 0.15m) */}
			<Box position={[0, 0.075, 0]} size={[2.2, 0.15, 2.0]} color="#a39c8e" />

			{/* ကွန်ကရစ်ခုံ နှုတ်ခမ်းဘောင်များ (Raised Concrete Perimeter Curbs) */}
			<Box position={[0, 0.17, -0.95]} size={[2.2, 0.06, 0.1]} color="#8c8577" />
			<Box position={[-1.05, 0.17, 0]} size={[0.1, 0.06, 2.0]} color="#8c8577" />
			<Box position={[1.05, 0.17, 0]} size={[0.1, 0.06, 2.0]} color="#8c8577" />
			{/* အရှေ့ဘက် ရေဆင်းပေါက်ဘောင် (Front Curb with drain opening in center) */}
			<Box position={[-0.65, 0.17, 0.95]} size={[0.9, 0.06, 0.1]} color="#8c8577" />
			<Box position={[0.65, 0.17, 0.95]} size={[0.9, 0.06, 0.1]} color="#8c8577" />

			{/* မြေပြင်သို့ လျှံကျရေမြောင်းငယ် (Small drainage ditch extending onto ground) */}
			<Box position={[0, 0.02, 1.3]} size={[0.42, 0.04, 0.7]} color="#4d4436" />
			<Box position={[0, 0.035, 1.3]} size={[0.3, 0.02, 0.68]} color="#3ba9be" />

			{/* ၂။ အဝီစိတွင်းခေါင်း ပိုက်ငုတ် (Wellhead casing stub directly under the hand pump base) */}
			<mesh position={[0, 0.08, -0.1]}>
				<cylinderGeometry args={[0.075, 0.08, 0.16, 16]} />
				<meshStandardMaterial color="#1e4d6b" roughness={0.5} />
			</mesh>

			{/* ၃။ cast-iron-hand.png အတိုင်း ပုံစံတူ သံလက်နှိပ်ဘုံဘိုင် (Authentic Cast-Iron Hand Pump) */}
			{/* ရေစီးကြောင်းကြီးသည် ဤသံလက်နှိပ်ဘုံဘိုင်၏ နှုတ်သီးခေါင်းမှ တိုက်ရိုက် ထွက်ကျနေပါသည် */}
			<group position={[0, 0.15, -0.1]} name="cast-iron-hand-pump-assembly">
				<CastIronHandPump />
			</group>

			{/* ၄။ တွဲဖက် လျှပ်စစ် ရေစုပ်စက် မော်တာ (Auxiliary Electric Motor Water Pump on Side) */}
			<group position={[0.62, 0.15, -0.3]} name="electric-water-pump">
				{/* စက်တင် သံဖရိန်ခုံ (Pump Mounting Frame Base) */}
				<Box position={[0, 0.05, 0]} size={[0.55, 0.1, 0.4]} color="#2d3748" />

				{/* လျှပ်စစ်မော်တာ ကိုယ်ထည် (Electric Motor with Cooling Ribs) */}
				<mesh position={[-0.08, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
					<cylinderGeometry args={[0.12, 0.12, 0.28, 16]} />
					<meshStandardMaterial color="#1b5e43" roughness={0.35} metalness={0.3} />
				</mesh>
				{/* မော်တာ အအေးပေးပန်ကာအဖုံး (Fan Cowl Cap) */}
				<mesh position={[-0.24, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.125, 0.125, 0.05, 16]} />
					<meshStandardMaterial color="#144632" roughness={0.5} />
				</mesh>

				{/* ရေစုပ်ခေါင်း ဘုံဘိုင်လိပ်ခုံး (Centrifugal Pump Volute / Impeller Casing) */}
				<mesh position={[0.12, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
					<cylinderGeometry args={[0.14, 0.14, 0.12, 16]} />
					<meshStandardMaterial color="#227353" roughness={0.35} metalness={0.25} />
				</mesh>

				{/* မော်တာခေါင်းပေါ်ရှိ ဝါယာကြိုးသေတ္တာ (Terminal Box on Motor) */}
				<Box position={[-0.08, 0.35, 0]} size={[0.09, 0.07, 0.09]} color="#2d3748" />

				{/* မော်တာနှင့် တွင်းခေါင်း ဆက်သွယ်သော စုပ်ပိုက် (Suction pipe to wellhead below hand pump) */}
				<mesh position={[-0.35, 0.12, 0.08]} rotation={[0, 0.35, Math.PI / 2]}>
					<cylinderGeometry args={[0.035, 0.035, 0.42, 8]} />
					<meshStandardMaterial color="#334155" roughness={0.4} />
				</mesh>
			</group>

			{/* ၅။ မော်တာခလုတ်သေတ္တာနှင့် သစ်သားတိုင် (Electrical Switch Box on Wooden Post) */}
			<group position={[0.82, 0.15, -0.65]}>
				{/* သစ်သားတိုင် (Wooden Post) */}
				<Box position={[0, 0.55, 0]} size={[0.1, 1.1, 0.1]} color="#6b4c30" />
				{/* မိုးကာ မော်တာစတက်တာ ခလုတ်သေတ္တာ (Waterproof Starter / Breaker Box) */}
				<Box position={[0, 0.85, 0.07]} size={[0.22, 0.28, 0.12]} color="#475569" />
				{/* ခလုတ် အနီ/အစိမ်း (Power Switch Buttons) */}
				<Box position={[-0.04, 0.83, 0.14]} size={[0.03, 0.03, 0.02]} color="#ef4444" />
				<Box position={[0.04, 0.83, 0.14]} size={[0.03, 0.03, 0.02]} color="#22c55e" />
			</group>
		</group>
	);
}
