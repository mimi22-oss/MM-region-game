import { useRef } from 'react';
import { useRegionFrame as useFrame } from './RegionActivity';
import { Mesh, DoubleSide } from 'three';
import {
	HAND_PUMP_X,
	HAND_PUMP_Z,
	HAND_PUMP_ROT,
	SPOUT_END_X,
	SPOUT_END_Z,
	SPOUT_LENGTH,
	DRAIN_END_X,
	DRAIN_END_Z,
	DRAIN_LENGTH,
	DRAIN_ROT,
} from '../data/handPumpLongSpout';
import { Box } from './Primitives';
import { mobileQuality } from '../game/sceneBudget';

// Authentic Burmese cast-iron hand pump color palette
const PUMP_BLUE = '#1b5ea2';
const PUMP_DARK_BLUE = '#134679';
const PUMP_STEEL = '#3b4b59';
const PUMP_BOLT = '#164879';
const STICKER_YELLOW = '#eab308';
const STICKER_RED = '#b91c1c';
const STICKER_WHITE = '#f8fafc';
const RUBBER_BLACK = '#18181b';
const CONCRETE_GRAY = '#9e978a';
const CONCRETE_DARK = '#7d776c';

/**
 * နှုတ်သီးခေါင်းပေါက် အဆုံး (၁၀ မီတာအကွာ) မှ အောက်သို့ တိုက်ရိုက် ထွက်ကျစီးဆင်းနေသော ရေစီးကြောင်းနှင့် ရေလှိုင်းများ
 * (Flowing water animation at the discharge mouth of the 10-meter long spout)
 */
function SpoutDischargeWater() {
	const coreStreamRef = useRef<Mesh>(null);
	const veilStreamRef = useRef<Mesh>(null);
	const splashRef = useRef<Mesh>(null);
	const rippleRefs = [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)];

	useFrame(({ clock }) => {
		const t = clock.elapsedTime;

		// ၁။ ရေစီးကြောင်း အတွင်းအူတိုင် လှိုင်းထန်မှု (Turbulent Gushing Core)
		if (coreStreamRef.current) {
			const pulse = 1 + Math.sin(t * 22) * 0.08;
			coreStreamRef.current.scale.set(pulse, 1, 1 + Math.cos(t * 24) * 0.08);
		}
		if (veilStreamRef.current) {
			const veilPulse = 1 + Math.cos(t * 20) * 0.09;
			veilStreamRef.current.scale.set(veilPulse, 1, 1 + Math.sin(t * 25) * 0.09);
		}

		// ၂။ ကွန်ကရစ်ရေကန်ကြမ်းခင်းသို့ ထိခတ်ရာ ရေပန်း/ရေဖွေး (Impact Splash Dome)
		if (splashRef.current) {
			const splashPulse = 1 + Math.sin(t * 26) * 0.16;
			splashRef.current.scale.set(splashPulse, 1 + Math.cos(t * 28) * 0.2, splashPulse);
		}

		// ၃။ ရေကန်တွင်း ပြန့်ကားထွက်သော ရေလှိုင်းကွင်းများ (Expanding Ripple Rings)
		rippleRefs.forEach((ref, i) => {
			if (!ref.current) return;
			const phase = (t * 1.6 + i * 0.33) % 1;
			const scale = 0.2 + phase * 1.5;
			ref.current.scale.set(scale, scale, 1);
			const mat = ref.current.material as any;
			if (mat) {
				mat.opacity = Math.max(0, (1 - phase) * 0.7);
			}
		});
	});

	return (
		<group position={[0, 0, SPOUT_LENGTH]} name="spout-discharge-water">
			{/* ၁။ နှုတ်သီးခေါင်းပေါက် အတွင်းပိုင်း ရေပွက်လိုင်း (Water in Spout Mouth at y=0.52) */}
			<mesh position={[0, 0.52, 0]}>
				<cylinderGeometry args={[0.038, 0.038, 0.04, 16]} />
				<meshStandardMaterial
					color="#70d6eb"
					transparent
					opacity={0.9}
					roughness={0.1}
					metalness={0.2}
				/>
			</mesh>

			{/* ၂။ နှုတ်သီးခေါင်းပေါက်မှ ကွန်ကရစ်ကန်သို့ တိုက်ရိုက် ဦးစိုက်ကျဆင်းနေသော ရေစီးကြောင်းကြီး */}
			{/* ရေစီးကြောင်း အူတိုင် (Main Gushing Water Core: height ~0.44m, from y=0.52 down to y=0.10) */}
			<mesh ref={coreStreamRef} position={[0, 0.31, 0]} castShadow>
				<cylinderGeometry args={[0.038, 0.065, 0.44, 16]} />
				<meshStandardMaterial
					color="#4ec2db"
					transparent
					opacity={0.88}
					roughness={0.08}
					metalness={0.25}
				/>
			</mesh>

			{/* ရေစီးကြောင်း အပြင်လွှာ ရေဖွေးအမြှုပ် (Outer Frothing Veil) */}
			<mesh ref={veilStreamRef} position={[0, 0.31, 0]}>
				<cylinderGeometry args={[0.044, 0.076, 0.44, 16]} />
				<meshStandardMaterial
					color="#dbf8fd"
					transparent
					opacity={0.4}
					roughness={0.15}
				/>
			</mesh>

			{/* ၃။ ရေကျရောက် ထိခတ်ရာ ဗဟိုနေရာ (Splash Impact Point) */}
			<mesh ref={splashRef} position={[0, 0.12, 0]} castShadow>
				<sphereGeometry args={[0.14, 12, 10]} />
				<meshStandardMaterial
					color="#e2f9fd"
					transparent
					opacity={0.9}
					roughness={0.1}
				/>
			</mesh>

			{/* ၄။ ဖြာထွက်နေသော ရေပေါက် ရေစက်ကလေးများ (Spray Droplets) */}
			{!mobileQuality &&
				[-0.1, 0.11, -0.04, 0.07, 0].map((dx, idx) => (
					<mesh
						key={idx}
						position={[dx, 0.15 + (idx % 2) * 0.05, (idx % 3) * 0.06 - 0.03]}
					>
						<sphereGeometry args={[0.024, 6, 6]} />
						<meshStandardMaterial color="#f0fcfe" transparent opacity={0.92} />
					</mesh>
				))}

			{/* ၅။ ကွန်ကရစ်ရေကန်တွင်း စိုစွတ်တောက်ပနေသော ရေပြင်ကြီး (Glistening Water Basin Surface at y=0.10) */}
			<mesh position={[0, 0.10, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.62, 24]} />
				<meshStandardMaterial
					color="#3ba9be"
					transparent
					opacity={0.78}
					roughness={0.05}
					metalness={0.3}
				/>
			</mesh>

			{/* ၆။ ပြန့်ကားထွက်နေသော ရေလှိုင်းကွင်း ၃ ခု (3 Expanding Ripple Rings) */}
			{rippleRefs.map((ref, i) => (
				<mesh
					key={i}
					ref={ref}
					position={[0, 0.105, 0]}
					rotation={[-Math.PI / 2, 0, 0]}
				>
					<ringGeometry args={[0.15, 0.22, 24]} />
					<meshBasicMaterial color="#bdf4fc" transparent opacity={0.65} />
				</mesh>
			))}
		</group>
	);
}

/**
 * နှုတ်သီးခေါင်းပေါက် အဆုံး (၁၀ မီတာအကွာ) ရှိ ကွန်ကရစ် ရေကန် / ရေသောက်ခုံ
 * (Concrete Wash Basin & Apron at the end of the long spout)
 */
function SpoutEndBasin() {
	return (
		<group position={[0, 0, SPOUT_LENGTH]} name="spout-end-basin">
			{/* အောက်ခံ ကွန်ကရစ်ခုံ (Base Concrete Platform: 1.6m x 1.6m x 0.12m) */}
			<Box position={[0, 0.06, 0]} size={[1.6, 0.12, 1.6]} color={CONCRETE_GRAY} />

			{/* ကွန်ကရစ် ရေကန် နှုတ်ခမ်းဘောင် ၄ ဖက် (Raised Curb Edges) */}
			<Box position={[0, 0.15, -0.75]} size={[1.6, 0.08, 0.1]} color={CONCRETE_DARK} />
			<Box position={[-0.75, 0.15, 0]} size={[0.1, 0.08, 1.6]} color={CONCRETE_DARK} />
			<Box position={[0.75, 0.15, 0]} size={[0.1, 0.08, 1.6]} color={CONCRETE_DARK} />
			{/* အရှေ့ဘက် ရေဆင်းမြောင်းပေါက် ဘောင် (Front Curb with Drain Notched Outflow) */}
			<Box position={[-0.5, 0.15, 0.75]} size={[0.6, 0.08, 0.1]} color={CONCRETE_DARK} />
			<Box position={[0.5, 0.15, 0.75]} size={[0.6, 0.08, 0.1]} color={CONCRETE_DARK} />
		</group>
	);
}

/**
 * ၁၀ မီတာ အရှည်ရှိသော နှုတ်သီးခေါင်းပေါက် ပိုက်တန်းကြီးနှင့် ဒေါက်တိုင်များ
 * (The 10-meter Long Spout Conduit Pipe with Support Stands and Flanges)
 */
function LongSpoutConduit() {
	const standDistances = [2.5, 5.0, 7.5, 9.8];
	const pipeRadius = 0.042;

	return (
		<group name="long-spout-conduit">
			{/* ၁။ ဘုံဘိုင်မှ နှုတ်သီးအဆုံး ၁၀ မီတာတိုင်အောင် တန်းဆင်းသွားသော ပင်မ ရေပိုက်ကြီး */}
			{(() => {
				const dy = 0.58 - 0.72; // -0.14m drop over 10m
				const dz = SPOUT_LENGTH; // 10.0586m
				const pipeLength = Math.hypot(dy, dz);
				const pitchAngle = Math.atan2(dy, dz);

				return (
					<group position={[0, 0.65, SPOUT_LENGTH / 2]} rotation={[pitchAngle, 0, 0]}>
						<mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
							<cylinderGeometry args={[pipeRadius, pipeRadius, pipeLength, 16]} />
							<meshStandardMaterial color={PUMP_BLUE} roughness={0.38} metalness={0.25} />
						</mesh>
					</group>
				);
			})()}

			{/* ၂။ ပိုက်ဆက်ခွေများ (Pipe Flange Joint Collars at every 2.5m) */}
			{[2.5, 5.0, 7.5].map((z) => {
				const frac = z / SPOUT_LENGTH;
				const y = 0.72 - frac * 0.14;
				return (
					<group key={z} position={[0, y, z]}>
						<mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
							<cylinderGeometry args={[pipeRadius * 1.35, pipeRadius * 1.35, 0.06, 16]} />
							<meshStandardMaterial color={PUMP_DARK_BLUE} roughness={0.4} metalness={0.4} />
						</mesh>
						{[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, bi) => (
							<mesh
								key={bi}
								position={[
									pipeRadius * 1.2 * Math.cos(a),
									pipeRadius * 1.2 * Math.sin(a),
									0,
								]}
								rotation={[Math.PI / 2, 0, 0]}
							>
								<cylinderGeometry args={[0.01, 0.01, 0.075, 6]} />
								<meshStandardMaterial color={PUMP_BOLT} roughness={0.4} />
							</mesh>
						))}
					</group>
				);
			})}

			{/* ၃။ ပိုက်ဒေါက်တိုင်များ (Steel Support Bipod Stands anchored to concrete pads) */}
			{standDistances.map((z) => {
				const frac = z / SPOUT_LENGTH;
				const pipeY = 0.72 - frac * 0.14;
				const legH = pipeY - 0.05;

				return (
					<group key={z} position={[0, 0, z]}>
						<Box position={[0, 0.05, 0]} size={[0.36, 0.1, 0.36]} color={CONCRETE_GRAY} />
						{[-0.09, 0.09].map((lx) => (
							<mesh
								key={lx}
								position={[lx / 2, legH / 2 + 0.05, 0]}
								rotation={[0, 0, lx > 0 ? -0.1 : 0.1]}
								castShadow
							>
								<cylinderGeometry args={[0.016, 0.016, legH, 8]} />
								<meshStandardMaterial color={PUMP_STEEL} roughness={0.5} metalness={0.5} />
							</mesh>
						))}
						<mesh position={[0, pipeY, 0]} rotation={[Math.PI / 2, 0, 0]}>
							<torusGeometry args={[pipeRadius * 1.15, 0.014, 8, 16]} />
							<meshStandardMaterial color={PUMP_STEEL} metalness={0.6} />
						</mesh>
					</group>
				);
			})}

			{/* ၄။ နှုတ်သီးခေါင်းပေါက် အဆုံး ကွေးညွတ်သော ရေထွက်ခေါင်း (90-Degree Down-Turned Spout Elbow at z=10.0586) */}
			<group position={[0, 0.58, SPOUT_LENGTH]}>
				<mesh rotation={[0, 0, 0]} castShadow>
					<sphereGeometry args={[pipeRadius * 1.3, 14, 12]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.35} metalness={0.3} />
				</mesh>
				<mesh position={[0, -0.06, 0]} castShadow>
					<cylinderGeometry args={[pipeRadius, pipeRadius * 1.1, 0.12, 16]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.35} metalness={0.25} />
				</mesh>
				<mesh position={[0, -0.11, 0]}>
					<cylinderGeometry args={[pipeRadius * 1.25, pipeRadius * 1.25, 0.025, 16]} />
					<meshStandardMaterial color={PUMP_DARK_BLUE} roughness={0.4} metalness={0.4} />
				</mesh>
				<mesh position={[0, -0.12, 0]}>
					<cylinderGeometry args={[pipeRadius * 0.9, pipeRadius * 0.9, 0.015, 14]} />
					<meshStandardMaterial color="#0b243b" roughness={0.6} />
				</mesh>
			</group>
		</group>
	);
}

/**
 * လူတစ်ယောက် ခါးလောက် အမြင့် (Waist-height ~1.05m tall) မြန်မာ့ရိုးရာ သံလက်နှိပ်ဘုံဘိုင်
 * (Waist-Height Cast-Iron Hand Pump Body & Lever Mechanism)
 */
function WaistHeightHandPumpBody() {
	return (
		<group name="waist-height-hand-pump-body">
			{/* ၁။ အောက်ခြေ ကွန်ကရစ်ခုံ (Base Concrete Plinth: 1.4m x 1.4m x 0.12m) */}
			<Box position={[0, 0.06, 0]} size={[1.4, 0.12, 1.4]} color={CONCRETE_GRAY} />
			<Box position={[0, 0.14, -0.65]} size={[1.4, 0.06, 0.1]} color={CONCRETE_DARK} />
			<Box position={[-0.65, 0.14, 0]} size={[0.1, 0.06, 1.4]} color={CONCRETE_DARK} />
			<Box position={[0.65, 0.14, 0]} size={[0.1, 0.06, 1.4]} color={CONCRETE_DARK} />

			{/* ၂။ အဝီစိတွင်းခေါင်း ပိုက်ငုတ် (Wellhead Casing Stub under Pump) */}
			<mesh position={[0, 0.14, 0]}>
				<cylinderGeometry args={[0.088, 0.095, 0.08, 16]} />
				<meshStandardMaterial color="#1e4d6b" roughness={0.5} />
			</mesh>

			{/* ၃။ စတုရန်း ဖလန်းပြားနှင့် ထောင့်စွန်း မူလီခေါင်း ၄ လုံး (Square Base Flange with 4 Corner Bolts) */}
			<Box position={[0, 0.18, 0]} size={[0.3, 0.026, 0.3]} color={PUMP_BLUE} />
			{[-0.11, 0.11].map((bx) =>
				[-0.11, 0.11].map((bz) => (
					<mesh key={`${bx}-${bz}`} position={[bx, 0.2, bz]}>
						<cylinderGeometry args={[0.013, 0.015, 0.02, 6]} />
						<meshStandardMaterial color={PUMP_BOLT} roughness={0.4} />
					</mesh>
				))
			)}
			{/* အောက်ခြေ လည်ပင်းကွင်း (Lower Neck Collar) */}
			<mesh position={[0, 0.21, 0]}>
				<cylinderGeometry args={[0.096, 0.105, 0.04, 16]} />
				<meshStandardMaterial color={PUMP_BLUE} roughness={0.45} />
			</mesh>

			{/* ၄။ ပင်မ ဆလင်ဒါ ကိုယ်ထည်ပြွန်ကြီး (Main Cylindrical Barrel: Height 0.64m, from y=0.23 to y=0.87) */}
			<mesh position={[0, 0.55, 0]} castShadow>
				<cylinderGeometry args={[0.092, 0.092, 0.64, 24]} />
				<meshStandardMaterial color={PUMP_BLUE} roughness={0.38} metalness={0.22} />
			</mesh>

			{/* ၅။ ဆလင်ဒါပေါ်ရှိ တံဆိပ်နှင့် အညွှန်းစာတန်းများ (Authentic Labels on Barrel) */}
			<group position={[0, 0.74, 0.094]}>
				<Box position={[0, 0, 0]} size={[0.12, 0.07, 0.002]} color={STICKER_YELLOW} />
				<Box position={[0, 0.022, 0.001]} size={[0.1, 0.013, 0.002]} color={STICKER_RED} />
				<Box position={[0, 0.005, 0.001]} size={[0.09, 0.005, 0.002]} color="#1e293b" />
				<Box position={[0, -0.012, 0.001]} size={[0.085, 0.005, 0.002]} color="#1e293b" />
			</group>
			<group position={[0, 0.44, 0.094]}>
				<Box position={[0, 0, 0]} size={[0.12, 0.16, 0.002]} color={STICKER_WHITE} />
				<Box position={[0, 0.03, 0.001]} size={[0.1, 0.09, 0.001]} color="#cbd5e1" />
				<Box position={[0, -0.05, 0.001]} size={[0.1, 0.04, 0.002]} color={STICKER_YELLOW} />
			</group>

			{/* ၆။ နှုတ်သီးခေါင်း ဆက်သွယ်ရာ လည်တိုင် (Spout Connection Boss on Front +Z at y=0.72m) */}
			<mesh position={[0, 0.72, 0.075]} rotation={[Math.PI / 2, 0, 0]} castShadow>
				<cylinderGeometry args={[0.052, 0.052, 0.06, 16]} />
				<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} />
			</mesh>
			<mesh position={[0, 0.72, 0.105]} rotation={[Math.PI / 2, 0, 0]}>
				<cylinderGeometry args={[0.062, 0.062, 0.022, 16]} />
				<meshStandardMaterial color={PUMP_DARK_BLUE} roughness={0.4} />
			</mesh>

			{/* ၇။ ထိပ်ဖုံး ဖလန်းပြား (Top Flange Cap Disc at y=0.88m) */}
			<group position={[0, 0.88, 0]}>
				<mesh castShadow>
					<cylinderGeometry args={[0.14, 0.14, 0.03, 24]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} />
				</mesh>
				{[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
					<mesh
						key={i}
						position={[0.118 * Math.cos(a), 0.02, 0.118 * Math.sin(a)]}
					>
						<cylinderGeometry args={[0.011, 0.011, 0.022, 6]} />
						<meshStandardMaterial color={PUMP_BOLT} roughness={0.4} />
					</mesh>
				))}
				<mesh position={[0, 0.028, 0]}>
					<cylinderGeometry args={[0.035, 0.038, 0.036, 12]} />
					<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} />
				</mesh>
			</group>

			{/* ၈။ ပစ်စတင်တံနှင့် ခွချိတ်ယိုခ် (Vertical Piston Rod up to Waist Height ~1.05m) */}
			<group position={[0, 0.89, 0]}>
				<mesh position={[0, 0.2, 0]} castShadow>
					<cylinderGeometry args={[0.014, 0.014, 0.4, 8]} />
					<meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.8} />
				</mesh>
				<group position={[0, 0.4, 0]}>
					<mesh position={[0, 0, 0]}>
						<cylinderGeometry args={[0.024, 0.024, 0.03, 12]} />
						<meshStandardMaterial color={PUMP_BLUE} />
					</mesh>
					<Box position={[-0.024, 0.06, 0]} size={[0.014, 0.12, 0.034]} color={PUMP_BLUE} />
					<Box position={[0.024, 0.06, 0]} size={[0.014, 0.12, 0.034]} color={PUMP_BLUE} />
					<mesh position={[0, 0.11, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.016, 0.016, 0.076, 8]} />
						<meshStandardMaterial color={PUMP_BOLT} />
					</mesh>
				</group>
			</group>

			{/* ၉။ မောင်းတံ ဒေါက်တိုင် (Fulcrum Bracket on Top Flange) */}
			<group position={[0.05, 0.9, -0.075]}>
				<Box position={[0, 0.02, 0]} size={[0.038, 0.05, 0.065]} color={PUMP_BLUE} />
				<mesh position={[0, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.014, 0.014, 0.07, 6]} />
					<meshStandardMaterial color={PUMP_BOLT} />
				</mesh>
				<Box position={[-0.016, 0.19, 0]} size={[0.009, 0.34, 0.044]} color={PUMP_BLUE} />
				<Box position={[0.016, 0.19, 0]} size={[0.009, 0.34, 0.044]} color={PUMP_BLUE} />
				<mesh position={[0, 0.36, 0]} rotation={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.016, 0.016, 0.076, 6]} />
					<meshStandardMaterial color={PUMP_BOLT} />
				</mesh>
			</group>

			{/* ၁၀။ လက်နှိပ်မောင်းတံရှည်ကြီးနှင့် ရော်ဘာလက်ကိုင် (Long Lever Handle & Rubber Grip) */}
			<group position={[0.05, 1.26, -0.075]}>
				<group position={[-0.05, 0.13, 0.075]} rotation={[0.38, 0, 0]}>
					<Box position={[0, 0, 0]} size={[0.026, 0.19, 0.05]} color={PUMP_BLUE} />
				</group>
				<group rotation={[0.42, 0, -0.38]}>
					<mesh position={[0, -0.55, 0]} castShadow>
						<cylinderGeometry args={[0.016, 0.018, 1.15, 8]} />
						<meshStandardMaterial color={PUMP_BLUE} roughness={0.4} metalness={0.2} />
					</mesh>
					<group position={[0, -1.14, 0]}>
						<mesh castShadow>
							<cylinderGeometry args={[0.024, 0.024, 0.18, 12]} />
							<meshStandardMaterial color={RUBBER_BLACK} roughness={0.85} />
						</mesh>
						{[-0.06, -0.03, 0.01, 0.05].map((ry) => (
							<mesh key={ry} position={[0, ry, 0]}>
								<cylinderGeometry args={[0.0255, 0.0255, 0.013, 12]} />
								<meshStandardMaterial color="#27272a" roughness={0.9} />
							</mesh>
						))}
					</group>
				</group>
			</group>
		</group>
	);
}

/**
 * နှုတ်သီးခေါင်းပေါက် ကွန်ကရစ်ကန် (151.967, 216.093) မှ တူးမြောင်းအစွန်း (146.809, 219.768) သို့ စီးဆင်းသော ရေမြောင်း
 * (Drainage Ditch Channel leading from the pump spout catchment basin into the canal bank)
 */
function DrainChannelToCanal() {
	const waterRef = useRef<Mesh>(null);
	const outfallSplashRef = useRef<Mesh>(null);
	const outfallRippleRef = useRef<Mesh>(null);
	// တူးမြောင်းရေပြင်ဘက်သို့ အနည်းငယ်ပိုမိုဆင်းသက်စေရန် အလျား အပိုဆောင်းထားရှိခြင်း
	const totalLength = DRAIN_LENGTH + 0.85;
	const midZ = totalLength / 2;

	useFrame(({ clock }) => {
		const t = clock.elapsedTime;
		// ရေမြောင်းတွင်း စီးဆင်းနေသော ရေလှိုင်းငယ်
		if (waterRef.current) {
			const pulse = 1 + Math.sin(t * 14) * 0.035;
			waterRef.current.scale.set(pulse, 1, 1);
		}
		// တူးမြောင်းတွင်းသို့ စီးဝင်ပေါက် ရေဖွေး/ရေပွက်
		if (outfallSplashRef.current) {
			const sPulse = 1 + Math.sin(t * 22) * 0.18;
			outfallSplashRef.current.scale.set(sPulse, 1 + Math.cos(t * 24) * 0.22, sPulse);
		}
		// တူးမြောင်းတွင်း လှိုင်းကွင်းများ
		if (outfallRippleRef.current) {
			const phase = (t * 1.5) % 1;
			outfallRippleRef.current.scale.set(0.3 + phase * 1.4, 0.3 + phase * 1.4, 1);
			const mat = outfallRippleRef.current.material as any;
			if (mat) mat.opacity = Math.max(0, (1 - phase) * 0.7);
		}
	});

	return (
		<group
			position={[SPOUT_END_X, 0, SPOUT_END_Z]}
			rotation={[0, DRAIN_ROT, 0]}
			name="drain-channel-to-canal"
		>
			{/* ၁။ ရေမြောင်း အောက်ခံကျောက်သားကြမ်းခင်း (Channel Masonry Bed) */}
			<Box position={[0, 0.02, midZ]} size={[0.44, 0.04, totalLength]} color="#50483c" />

			{/* ၂။ ရေမြောင်း ဘေးဘောင်နံရံ ၂ ဖက် (Channel Retaining Concrete Curbs) */}
			<Box position={[-0.24, 0.065, midZ]} size={[0.08, 0.09, totalLength]} color={CONCRETE_DARK} />
			<Box position={[0.24, 0.065, midZ]} size={[0.08, 0.09, totalLength]} color={CONCRETE_DARK} />

			{/* ၃။ မြောင်းတွင်း တူးမြောင်းဆီသို့ စီးဆင်းနေသော ရေစီးကြောင်းလိုင်း (Flowing Water Ribbon in Channel) */}
			<mesh ref={waterRef} position={[0, 0.038, midZ]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[0.34, totalLength]} />
				<meshStandardMaterial
					color="#3ba9be"
					transparent
					opacity={0.8}
					roughness={0.06}
					metalness={0.25}
				/>
			</mesh>

			{/* ၄။ လူကူး ကွန်ကရစ်တံတားပြားငယ် (Small Footbridge Slab over Ditch at z=2.8m) */}
			<group position={[0, 0.09, 2.8]}>
				<Box position={[0, 0.02, 0]} size={[0.72, 0.04, 0.6]} color="#a8a194" />
			</group>

			{/* ၅။ တူးမြောင်းအစွန်း (146.809, 219.768) သို့ ရေကျဆင်းရာ ထွက်ပေါက် (Outfall at Canal Bank) */}
			<group position={[0, 0, DRAIN_LENGTH]}>
				{/* မြောင်းထွက်ပေါက် ဘောင်ကျောက်တုံးများ (Outfall Masonry Headwall) */}
				<Box position={[-0.26, 0.06, 0]} size={[0.12, 0.12, 0.24]} color="#484236" />
				<Box position={[0.26, 0.06, 0]} size={[0.12, 0.12, 0.24]} color="#484236" />

				{/* တူးမြောင်းရေပြင်သို့ စီးဝင်ကျဆင်းသော ရေပွက်ရေဖွေး (Outfall Cascade Splash) */}
				<mesh ref={outfallSplashRef} position={[0, 0.03, 0.2]}>
					<sphereGeometry args={[0.14, 10, 8]} />
					<meshStandardMaterial color="#d4f4fa" transparent opacity={0.88} roughness={0.1} />
				</mesh>

				{/* တူးမြောင်းရေပြင်အတွင်း ပြန့်ထွက်သော ရေလှိုင်းကွင်း (Outfall Ripple Ring in Canal) */}
				<mesh ref={outfallRippleRef} position={[0, 0.02, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
					<ringGeometry args={[0.12, 0.22, 20]} />
					<meshBasicMaterial color="#bdf4fc" transparent opacity={0.65} />
				</mesh>
			</group>
		</group>
	);
}

/**
 * လူတစ်ယောက် ခါးလောက် အမြင့်ရှိပြီး ၁၀ မီတာ ရှည်လျားသော နှုတ်သီးခေါင်းပေါက်နှင့်
 * တူးမြောင်းဆီသို့ စီးဆင်းသော ရေမြောင်း ပါရှိသည့် လက်နှိပ်ဘုံဘိုင်
 * (Waist-height Cast-iron Hand Water Pump with 10m Spout & Canal Drain Channel)
 * - Location: Scene X=159.065, Z=208.966
 * - Spout Reach: extends 10.059m to (151.967, 216.093)
 * - Drain Canal Outflow: extends 6.333m to (146.809, 219.768) into the canal bank
 * - Facing: West (270.0°) — rotY = HAND_PUMP_ROT (-0.783 rad)
 */
export function HandPumpLongSpout() {
	return (
		<group name="hand-pump-long-spout-station">
			{/* ၁။ ဘုံဘိုင်နေရာ (origin: 159.065, 208.966) ရှိ ခါးလောက်အမြင့် သံလက်နှိပ်ဘုံဘိုင်ကိုယ်ထည်နှင့် ၁၀ မီတာ နှုတ်သီး */}
			<group
				position={[HAND_PUMP_X, 0, HAND_PUMP_Z]}
				rotation={[0, HAND_PUMP_ROT, 0]}
				name="hand-pump-and-spout"
			>
				{/* ခါးလောက်အမြင့် သံလက်နှိပ်ဘုံဘိုင်ကိုယ်ထည် */}
				<WaistHeightHandPumpBody />

				{/* ၁၀ မီတာ အရှည်ရှိသော နှုတ်သီးခေါင်းပေါက် ပိုက်တန်းကြီးနှင့် ဒေါက်တိုင်များ */}
				<LongSpoutConduit />

				{/* နှုတ်သီးခေါင်းပေါက် အဆုံး (151.967, 216.093) ရှိ ကွန်ကရစ်ရေကန် */}
				<SpoutEndBasin />

				{/* နှုတ်သီးခေါင်းပေါက်မှ ကွန်ကရစ်ရေကန်သို့ တိုက်ရိုက် ထွက်ကျနေသော ရေစီးကြောင်းကြီး */}
				<SpoutDischargeWater />
			</group>

			{/* ၂။ နှုတ်သီးခေါင်းပေါက် အဆုံး (151.967, 216.093) မှ တူးမြောင်း (146.809, 219.768) သို့ စီးဆင်းသော ရေမြောင်း */}
			<DrainChannelToCanal />
		</group>
	);
}
