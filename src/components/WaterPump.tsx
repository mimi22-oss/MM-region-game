import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';
import { angle } from '../data/ward';
import { Box } from './Primitives';
import { mobileQuality } from '../game/sceneBudget';

/**
 * ရေဘုံဘိုင်နှင့် ရေစုပ်စက် (Tube-well Water Pump Station):
 * - တည်နေရာ (Location): Scene X=109.721, Z=284.313 (Local U=-123.455, V=278.624)
 * - မျက်နှာမူ (Facing): North
 * - ကွန်ကရစ်ခုံ၊ အဝီစိတွင်းခေါင်း၊ လျှပ်စစ် ရေစုပ်စက်မော်တာ၊ လက်နှိပ်ဘုံဘိုင်
 * - မြေပြင်သို့ အလိုအလျောက် ထွက်ကျစီးဆင်းနေသော ရေစီးကြောင်းနှင့် ရေလှိုင်းငယ်များ (Auto-flowing animated water jet, splashes & expanding ripples)
 */
export const PUMP_X = 109.721;
export const PUMP_Z = 284.313;
export const PUMP_ROT = angle;

function AnimatedWaterStream() {
	const streamRef = useRef<Mesh>(null);
	const splashRef = useRef<Mesh>(null);
	const rippleRefs = [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)];

	useFrame(({ clock }) => {
		const t = clock.elapsedTime;

		// ၁။ ကျဆင်းနေသော ရေစီးကြောင်း၏ လှိုင်းထန်မှု (Turbulent Gushing Stream)
		if (streamRef.current) {
			const pulse = 1 + Math.sin(t * 20) * 0.08;
			streamRef.current.scale.set(pulse, 1, 1 + Math.cos(t * 22) * 0.08);
		}

		// ၂။ မြေပြင်သို့ ကျရောက်ထိခတ်ရာနေရာမှ ရေဖွေး/ရေပန်း (Impact Splash Dome)
		if (splashRef.current) {
			const splashPulse = 1 + Math.sin(t * 26) * 0.18;
			splashRef.current.scale.set(splashPulse, 1 + Math.cos(t * 28) * 0.22, splashPulse);
		}

		// ၃။ မြေပြင်ရေအိုင်အတွင်း ပြန့်ကားထွက်သွားသော ရေလှိုင်းကွင်းများ (Expanding Ripple Rings)
		rippleRefs.forEach((ref, i) => {
			if (!ref.current) return;
			const phase = (t * 1.5 + i * 0.33) % 1; // 0 to 1 cycle
			const scale = 0.2 + phase * 1.6; // expands from small to wide
			ref.current.scale.set(scale, scale, 1);
			const mat = ref.current.material as any;
			if (mat) {
				mat.opacity = Math.max(0, (1 - phase) * 0.75); // fades as it expands
			}
		});
	});

	return (
		<group position={[0.3, 0, 0.45]}>
			{/* ရေပိုက်ခေါင်းမှ ထွက်ကျနေသော ရေလုံးကြီး (Arching Water Jet Stream) */}
			<mesh
				ref={streamRef}
				position={[0, 0.42, 0.12]}
				rotation={[0.48, 0, 0]}
				castShadow
			>
				<cylinderGeometry args={[0.048, 0.075, 0.68, 12]} />
				<meshStandardMaterial
					color="#5ecae0"
					transparent
					opacity={0.82}
					roughness={0.1}
					metalness={0.25}
				/>
			</mesh>

			{/* ရေထိခတ်ရာ ဗဟိုနေရာ (Splash Impact Point on ground basin) */}
			<mesh ref={splashRef} position={[0, 0.13, 0.34]} castShadow>
				<sphereGeometry args={[0.13, 10, 8]} />
				<meshStandardMaterial
					color="#d8f5fc"
					transparent
					opacity={0.88}
					roughness={0.1}
				/>
			</mesh>

			{/* ရေပေါက်ကလေးများ ဖြာထွက်နေခြင်း (Splashing Water Spray Droplets) */}
			{[-0.1, 0.12, 0, -0.08].map((dx, idx) => (
				<mesh
					key={idx}
					position={[dx, 0.18 + (idx % 2) * 0.06, 0.34 + (idx % 3) * 0.08]}
				>
					<sphereGeometry args={[0.025, 6, 6]} />
					<meshStandardMaterial color="#ebfbfe" transparent opacity={0.9} />
				</mesh>
			))}

			{/* မြေပြင်ပေါ်က စိုစွတ်တောက်ပနေသော ရေအိုင်ငယ် (Wet Glistening Water Puddle) */}
			<mesh position={[0, 0.09, 0.36]} rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.55, 24]} />
				<meshStandardMaterial
					color="#3ba9be"
					transparent
					opacity={0.7}
					roughness={0.05}
					metalness={0.3}
				/>
			</mesh>

			{/* ပြန့်ကားထွက်နေသော ရေလှိုင်းကွင်း ၃ ခု (3 Dynamic Expanding Ripple Rings) */}
			{rippleRefs.map((ref, i) => (
				<mesh
					key={i}
					ref={ref}
					position={[0, 0.095, 0.36]}
					rotation={[-Math.PI / 2, 0, 0]}
				>
					<ringGeometry args={[0.16, 0.22, 24]} />
					<meshBasicMaterial color="#bdf4fc" transparent opacity={0.6} />
				</mesh>
			))}

			{/* ကွန်ကရစ်ခုံမှ မြေပြင်သို့ စီးဆင်းကျနေသော ရေစီးကြောင်းငယ် (Overflow Water Stream to Earth) */}
			<mesh position={[0, 0.085, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[0.3, 0.45]} />
				<meshStandardMaterial
					color="#47b4c7"
					transparent
					opacity={0.65}
					roughness={0.1}
				/>
			</mesh>
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
			<Box position={[0.75, 0.17, 0.95]} size={[0.7, 0.06, 0.1]} color="#8c8577" />

			{/* မြေပြင်သို့ လျှံကျရေမြောင်းငယ် (Small drainage ditch extending onto ground) */}
			<Box position={[0.3, 0.02, 1.3]} size={[0.42, 0.04, 0.7]} color="#4d4436" />
			<Box position={[0.3, 0.035, 1.3]} size={[0.3, 0.02, 0.68]} color="#3ba9be" />

			{/* ၂။ အဝီစိတွင်းခေါင်း ပိုက်ကြီး (Tube-well Casing Pipe from Ground) */}
			<mesh position={[-0.1, 0.35, -0.2]} castShadow>
				<cylinderGeometry args={[0.07, 0.08, 0.45, 16]} />
				<meshStandardMaterial color="#1e4d6b" roughness={0.4} />
			</mesh>
			<mesh position={[-0.1, 0.58, -0.2]}>
				<cylinderGeometry args={[0.09, 0.09, 0.05, 16]} />
				<meshStandardMaterial color="#14374d" roughness={0.5} />
			</mesh>

			{/* ၃။ လျှပ်စစ် ရေစုပ်စက် မော်တာ (Electric Motor Pump Assembly) */}
			<group position={[0.25, 0.15, -0.2]} name="electric-water-pump">
				{/* စက်တင် သံဖရိန်ခုံ (Pump Mounting Frame Base) */}
				<Box position={[0, 0.05, 0]} size={[0.65, 0.1, 0.45]} color="#2d3748" />

				{/* လျှပ်စစ်မော်တာ ကိုယ်ထည် (Electric Motor with Cooling Ribs) */}
				<mesh position={[-0.1, 0.22, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
					<cylinderGeometry args={[0.13, 0.13, 0.32, 16]} />
					<meshStandardMaterial color="#1b5e43" roughness={0.35} metalness={0.3} />
				</mesh>
				{/* မော်တာ အအေးပေးပန်ကာအဖုံး (Fan Cowl Cap) */}
				<mesh position={[-0.28, 0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.135, 0.135, 0.06, 16]} />
					<meshStandardMaterial color="#144632" roughness={0.5} />
				</mesh>

				{/* ရေစုပ်ခေါင်း ဘုံဘိုင်လိပ်ခုံး (Centrifugal Pump Volute / Impeller Casing) */}
				<mesh position={[0.14, 0.22, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
					<cylinderGeometry args={[0.15, 0.15, 0.14, 16]} />
					<meshStandardMaterial color="#227353" roughness={0.35} metalness={0.25} />
				</mesh>

				{/* မော်တာခေါင်းပေါ်ရှိ ဝါယာကြိုးသေတ္တာ (Terminal Box on Motor) */}
				<Box position={[-0.1, 0.38, 0]} size={[0.1, 0.08, 0.1]} color="#2d3748" />

				{/* စုပ်ပိုက်ဆက်သွယ်မှု (Suction Pipe from Wellhead to Pump) */}
				<mesh position={[-0.1, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
					<meshStandardMaterial color="#334155" roughness={0.4} />
				</mesh>

				{/* ရေထွက်ပိုက်ကွေးကြီး (Discharge Pipe curving forward and downward) */}
				{/* အပေါ်တက်ပိုက် (Vertical Riser) */}
				<Box position={[0.14, 0.42, 0.06]} size={[0.07, 0.3, 0.07]} color="#1e4d6b" />
				{/* အရှေ့ထွက်ပိုက် (Horizontal Elbow Pipe) */}
				<Box position={[0.14, 0.58, 0.2]} size={[0.07, 0.07, 0.24]} color="#1e4d6b" />
				{/* အောက်ငိုက် ရေထွက်ခေါင်း (Downward Discharge Spout) */}
				<mesh position={[0.14, 0.53, 0.33]} rotation={[0.45, 0, 0]} castShadow>
					<cylinderGeometry args={[0.05, 0.05, 0.14, 12]} />
					<meshStandardMaterial color="#14374d" roughness={0.4} metalness={0.3} />
				</mesh>
			</group>

			{/* ၄။ ရိုးရာ လက်နှိပ်ဘုံဘိုင် (Traditional Myanmar Cast-Iron Lever Pump) */}
			<group position={[-0.45, 0.15, -0.2]} name="hand-lever-pump">
				{/* အောက်ခြေအနားကွပ် (Base Flange) */}
				<mesh position={[0, 0.04, 0]}>
					<cylinderGeometry args={[0.14, 0.16, 0.08, 12]} />
					<meshStandardMaterial color="#1b4d3e" roughness={0.6} />
				</mesh>
				{/* ပင်မ ဆလင်ဒါ ကိုယ်ထည် (Main Pump Barrel) */}
				<mesh position={[0, 0.4, 0]} castShadow>
					<cylinderGeometry args={[0.085, 0.11, 0.65, 12]} />
					<meshStandardMaterial color="#235c4b" roughness={0.5} />
				</mesh>
				{/* ဘုံဘိုင်ထိပ်ဖူး (Top Cap) */}
				<mesh position={[0, 0.75, 0]}>
					<cylinderGeometry args={[0.1, 0.085, 0.07, 12]} />
					<meshStandardMaterial color="#1b4d3e" roughness={0.6} />
				</mesh>
				{/* လက်နှိပ်တံ မောင်းရိုး (Pump Lever Handle with weighted tip) */}
				<group position={[0, 0.72, 0]} rotation={[0.3, 0, 0.5]}>
					<mesh position={[0, 0.28, 0]} castShadow>
						<cylinderGeometry args={[0.016, 0.02, 0.6, 8]} />
						<meshStandardMaterial color="#1b4d3e" roughness={0.5} />
					</mesh>
					{/* မောင်းတံထိပ် သံလုံး (Cast-iron Counterweight Ball) */}
					<mesh position={[0, 0.58, 0]} castShadow>
						<sphereGeometry args={[0.05, 10, 8]} />
						<meshStandardMaterial color="#143e32" roughness={0.6} />
					</mesh>
				</group>
				{/* လက်နှိပ်ဘုံဘိုင် ရေနှုတ်သီးခေါင်း (Spout) */}
				<mesh position={[0, 0.38, 0.14]} rotation={[0.5, 0, 0]}>
					<cylinderGeometry args={[0.035, 0.04, 0.16, 8]} />
					<meshStandardMaterial color="#1b4d3e" roughness={0.5} />
				</mesh>
			</group>

			{/* ၅။ မော်တာခလုတ်သေတ္တာနှင့် သစ်သားတိုင် (Electrical Switch Box on Wooden Post) */}
			<group position={[0.75, 0.15, -0.6]}>
				{/* သစ်သားတိုင် (Wooden Post) */}
				<Box position={[0, 0.55, 0]} size={[0.1, 1.1, 0.1]} color="#6b4c30" />
				{/* မိုးကာ မော်တာစတက်တာ ခလုတ်သေတ္တာ (Waterproof Starter / Breaker Box) */}
				<Box position={[0, 0.85, 0.07]} size={[0.22, 0.28, 0.12]} color="#475569" />
				{/* ခလုတ် အနီ/အစိမ်း (Power Switch Buttons) */}
				<Box position={[-0.04, 0.83, 0.14]} size={[0.03, 0.03, 0.02]} color="#ef4444" />
				<Box position={[0.04, 0.83, 0.14]} size={[0.03, 0.03, 0.02]} color="#22c55e" />
			</group>

			{/* ၆။ မြေပြင်သို့ အလိုအလျောက် ထွက်ကျစီးဆင်းနေသော ရေ (Auto-flowing Animated Water) */}
			<AnimatedWaterStream />
		</group>
	);
}
