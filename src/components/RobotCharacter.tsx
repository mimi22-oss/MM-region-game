import { useMemo, useRef, type RefObject } from 'react';
import { Group, Mesh, Shape, DoubleSide } from 'three';
import { useFrame } from '@react-three/fiber';

import { playerPalette, type RobotPalette } from '../game/robotAppearance';

function Ball({
	position,
	scale,
	color,
}: {
	position: [number, number, number];
	scale: [number, number, number];
	color: string;
}) {
	return (
		<mesh position={position} scale={scale} castShadow>
			<sphereGeometry args={[1, 20, 14]} />
			<meshStandardMaterial color={color} roughness={0.35} metalness={0.12} />
		</mesh>
	);
}

/** Eyelashes configuration for one eye (mirrored symmetrically across left and right eyes) */
const EYELASH_CONFIG = [
	// Outer lash: longest, elegantly swept outward
	{ x: 0.040, y: 0.004, rotZ: -0.65, length: 0.036, rBottom: 0.0036, rTop: 0.0012 },
	// Mid-outer lash
	{ x: 0.022, y: 0.009, rotZ: -0.38, length: 0.032, rBottom: 0.0036, rTop: 0.0012 },
	// Center lash: perky, nearly straight up
	{ x: 0.003, y: 0.011, rotZ: -0.10, length: 0.028, rBottom: 0.0034, rTop: 0.0012 },
	// Inner lash: delicate, shorter
	{ x: -0.018, y: 0.007, rotZ: 0.16, length: 0.020, rBottom: 0.0030, rTop: 0.0010 },
];

/** Reference-inspired robot with eyelashes, blinking eyes and 5-second interval mouth open/close animation. Front faces -Z. */
export function RobotCharacter({
	wheels,
	palette = playerPalette,
	size = 1,
}: {
	wheels: RefObject<Group | null>;
	palette?: RobotPalette;
	size?: number;
}) {
	const { shell: mint, panel: dark, accent: orange, rubber, trim } = palette;

	// Eyelid & Eyeball refs for smooth 60fps blinking animation
	const leftEyeballRef = useRef<Group>(null);
	const rightEyeballRef = useRef<Group>(null);
	const leftEyelidRef = useRef<Group>(null);
	const rightEyelidRef = useRef<Group>(null);

	// Mouth refs for talking / open-close mouth animation
	const mouthCavityRef = useRef<Group>(null);
	const closedSmileRef = useRef<Mesh>(null);

	// Human-like blinking state machine: spontaneous interval (2.5s - 5.5s) with occasional double-blinks
	const blinkState = useRef({
		timer: 0.8 + Math.random() * 2.8,
		isBlinking: false,
		blinkElapsed: 0,
		blinkDuration: 0.16,
		doubleBlinkPending: false,
	});

	// ပါးစပ်ဖွင့်လိုက်ပိတ်လိုက် ပြုလုပ်ရန် (ကြားကာလ ၅ စက္ကန့် ကြာမြင့်ချိန် သတ်မှတ်ချက်)
	const mouthState = useRef({
		timer: 5.0, // ပိတ်လိုက်ဖွင့်လိုက်ကြား ကြာချိန် ၅ စက္ကန့်
		isOpenCycle: false,
		elapsed: 0,
		cycleDuration: 0.9, // ပါးစပ်ဖွင့်ပိတ် လှုပ်ရှားချိန် ~၀.၉ စက္ကန့်
		openness: 0,
	});

	useFrame((_, delta) => {
		const dt = Math.min(delta, 0.08);

		// --- ၁။ မျက်တောင်ခတ်ခြင်း (Human-like Blinking Animation) ---
		const bs = blinkState.current;
		if (!bs.isBlinking) {
			bs.timer -= dt;
			if (bs.timer <= 0) {
				bs.isBlinking = true;
				bs.blinkElapsed = 0;
				bs.blinkDuration = 0.14 + Math.random() * 0.04;
				if (bs.doubleBlinkPending) {
					bs.doubleBlinkPending = false;
				} else if (Math.random() < 0.22) {
					// 22% chance of a cute human double-blink
					bs.doubleBlinkPending = true;
				}
			}
		} else {
			bs.blinkElapsed += dt;
			if (bs.blinkElapsed >= bs.blinkDuration) {
				bs.isBlinking = false;
				bs.blinkElapsed = 0;
				if (bs.doubleBlinkPending) {
					bs.timer = 0.08 + Math.random() * 0.06; // brief interval before second blink
				} else {
					bs.timer = 2.4 + Math.random() * 3.2; // next regular blink interval
				}
			}
		}

		// Calculate blink progress: 0 (eyes wide open) to 1 (eyes fully closed)
		let blink = 0;
		if (bs.isBlinking) {
			const p = bs.blinkElapsed / bs.blinkDuration;
			if (p < 0.38) {
				blink = Math.sin((p / 0.38) * (Math.PI / 2)); // rapid ease-in closing
			} else if (p < 0.52) {
				blink = 1; // hold closed briefly
			} else {
				const t = (p - 0.52) / 0.48;
				blink = 1 - Math.sin(t * (Math.PI / 2)); // smooth ease-out reopening
			}
		}

		// Apply blinking to eyeballs (scale Y down to flatten pupil/white)
		const eyeScaleY = Math.max(0.01, 1 - blink * 0.99);
		if (leftEyeballRef.current) leftEyeballRef.current.scale.y = eyeScaleY;
		if (rightEyeballRef.current) rightEyeballRef.current.scale.y = eyeScaleY;

		// Move upper eyelids & eyelashes smoothly down over eyeball
		const lidY = 1.516 - blink * 0.062;
		const lidRotX = -blink * 0.42;
		if (leftEyelidRef.current) {
			leftEyelidRef.current.position.y = lidY;
			leftEyelidRef.current.rotation.x = lidRotX;
		}
		if (rightEyelidRef.current) {
			rightEyelidRef.current.position.y = lidY;
			rightEyelidRef.current.rotation.x = lidRotX;
		}

		// --- ၂။ ပါးစပ်ဖွင့်လိုက်ပိတ်လိုက် ပြုလုပ်ခြင်း (ကြားကာလ ၅ စက္ကန့်) ---
		const ms = mouthState.current;
		if (!ms.isOpenCycle) {
			ms.timer -= dt;
			if (ms.timer <= 0) {
				ms.isOpenCycle = true;
				ms.elapsed = 0;
			}
		} else {
			ms.elapsed += dt;
			if (ms.elapsed >= ms.cycleDuration) {
				ms.isOpenCycle = false;
				ms.elapsed = 0;
				ms.openness = 0;
				ms.timer = 5.0; // ပိတ်လိုက်ဖွင့်လိုက်ကြား ကြာချိန် ၅ စက္ကန့်တိတိ ထားရှိခြင်း
			} else {
				const p = ms.elapsed / ms.cycleDuration; // 0 .. 1
				// Smooth curve: open over first 38%, hold open 24%, close over last 38%
				if (p < 0.38) {
					ms.openness = Math.sin((p / 0.38) * (Math.PI / 2)); // 0 -> 1 smooth ease-in open
				} else if (p < 0.62) {
					ms.openness = 1.0; // hold open (teeth and tongue clearly visible)
				} else {
					const t = (p - 0.62) / 0.38;
					ms.openness = 1.0 - Math.sin(t * (Math.PI / 2)); // 1 -> 0 smooth ease-out close
				}
			}
		}

		// Apply mouth openness to 3D meshes
		const openness = ms.openness;
		if (mouthCavityRef.current) {
			mouthCavityRef.current.scale.y = Math.max(0.01, openness);
			mouthCavityRef.current.visible = openness > 0.03;
		}
		if (closedSmileRef.current) {
			closedSmileRef.current.visible = openness <= 0.35;
			closedSmileRef.current.scale.y = Math.max(0.15, 1 - openness * 0.85);
		}
	});

	// အပိတ်အပြုံးပုံစံ (Closed Smile Shape)
	const closedSmile = useMemo(() => {
		const s = new Shape();
		s.moveTo(-0.095, 0.018);
		s.quadraticCurveTo(0, -0.010, 0.095, 0.018);
		s.quadraticCurveTo(0, -0.032, -0.095, 0.018);
		return s;
	}, []);

	// အဖွင့်ပါးစပ်အတွင်းခေါင်း (Open Mouth Inner Cavity)
	const openCavity = useMemo(() => {
		const s = new Shape();
		s.moveTo(-0.095, 0.018);
		s.quadraticCurveTo(0, -0.010, 0.095, 0.018);
		s.quadraticCurveTo(0, -0.095, -0.095, 0.018);
		return s;
	}, []);

	// အဖွင့်ပါးစပ် အဖြူရောင်နှုတ်ခမ်းဘောင် (Open Mouth White Lip Frame)
	const openBorder = useMemo(() => {
		const s = new Shape();
		s.moveTo(-0.098, 0.020);
		s.quadraticCurveTo(0, -0.012, 0.098, 0.020);
		s.quadraticCurveTo(0, -0.100, -0.098, 0.020);
		return s;
	}, []);

	// ချစ်စရာ ပန်းရောင်လျှာလေး (Cute Pink Tongue)
	const tongue = useMemo(() => {
		const s = new Shape();
		s.moveTo(-0.052, -0.040);
		s.quadraticCurveTo(0, -0.022, 0.052, -0.040);
		s.quadraticCurveTo(0, -0.090, -0.052, -0.040);
		return s;
	}, []);

	// အပေါ်သွားတန်းဖြူဖြူလေး (Upper White Teeth Bar)
	const teeth = useMemo(() => {
		const s = new Shape();
		s.moveTo(-0.070, 0.018);
		s.quadraticCurveTo(0, -0.008, 0.070, 0.018);
		s.lineTo(0.070, 0.004);
		s.quadraticCurveTo(0, -0.018, -0.070, 0.004);
		s.closePath();
		return s;
	}, []);

	// မျက်ခွံအနားကွပ် (Curved upper eyeliner arch band)
	const eyelidArch = useMemo(() => {
		const s = new Shape();
		s.moveTo(-0.052, -0.006);
		s.quadraticCurveTo(0, 0.012, 0.052, -0.006);
		s.quadraticCurveTo(0, 0.019, -0.052, -0.006);
		return s;
	}, []);

	return (
		<group scale={0.95 * size} name="robot-character">
			{/* ဘီးများ (Wheels Assembly) */}
			<group ref={wheels} position={[0, 0.24, 0]}>
				{[-1, 1].map((side) => (
					<group key={side} position={[side * 0.305, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<mesh castShadow>
							<cylinderGeometry args={[0.24, 0.24, 0.15, 24]} />
							<meshStandardMaterial color={rubber} roughness={0.9} />
						</mesh>
						{[-1, 1].map((s) => (
							<mesh key={s} position={[0, s * 0.078, 0]}>
								<cylinderGeometry args={[0.19, 0.19, 0.018, 24]} />
								<meshStandardMaterial color={orange} roughness={0.4} metalness={0.25} />
							</mesh>
						))}
						<mesh position={[0, -side * 0.092, 0]}>
							<cylinderGeometry args={[0.083, 0.083, 0.025, 20]} />
							<meshStandardMaterial color={orange} metalness={0.3} roughness={0.4} />
						</mesh>
						{Array.from({ length: 12 }, (_, i) => (
							<mesh
								key={i}
								position={[
									Math.cos((i * Math.PI) / 6) * 0.239,
									0,
									Math.sin((i * Math.PI) / 6) * 0.239,
								]}
								rotation={[0, (-i * Math.PI) / 6, 0]}
							>
								<boxGeometry args={[0.018, 0.15, 0.025]} />
								<meshStandardMaterial color="#77717c" />
							</mesh>
						))}
					</group>
				))}
			</group>

			{/* အောက်ခံဝင်ရိုး (Axle) */}
			<mesh position={[0, 0.28, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
				<cylinderGeometry args={[0.065, 0.065, 0.62, 12]} />
				<meshStandardMaterial color={dark} />
			</mesh>

			{/* ကိုယ်ထည် (Body Shell) */}
			<Ball position={[0, 0.76, 0]} scale={[0.285, 0.41, 0.235]} color={mint} />
			<mesh position={[0, 1.12, 0]}>
				<cylinderGeometry args={[0.19, 0.18, 0.08, 24]} />
				<meshStandardMaterial color={orange} />
			</mesh>
			<mesh position={[0, 1.2, 0]}>
				<cylinderGeometry args={[0.12, 0.12, 0.12, 16]} />
				<meshStandardMaterial color={dark} />
			</mesh>

			{/* ဦးခေါင်းနှင့် မျက်နှာဗဟို (Head and Visor) */}
			<Ball position={[0, 1.47, 0]} scale={[0.37, 0.32, 0.29]} color={mint} />
			<Ball position={[0, 1.44, -0.235]} scale={[0.306, 0.217, 0.105]} color={dark} />

			{/* မျက်လုံးများ၊ မျက်တောင်များနှင့် နားရွက်/လက်မောင်းများ (Eyes, Eyelashes, Ears & Arms) */}
			{[-1, 1].map((side) => (
				<group key={side}>
					{/* လိမ္မော်ရောင် မျက်လုံးဘောင်ခွက် (Orange Eye Socket Bezel) */}
					<mesh position={[side * 0.14, 1.46, -0.337]} rotation={[Math.PI / 2, 0, 0]}>
						<cylinderGeometry args={[0.066, 0.066, 0.018, 24]} />
						<meshStandardMaterial color={orange} />
					</mesh>

					{/* မျက်လုံးအိမ် (Eyeball Group - scales Y during blink) */}
					<group
						ref={side === -1 ? leftEyeballRef : rightEyeballRef}
						position={[side * 0.14, 1.46, 0]}
					>
						{/* မျက်လုံးအဖြူသား (Eyeball White) */}
						<Ball position={[0, 0, -0.351]} scale={[0.049, 0.061, 0.02]} color="#fffdf1" />
						{/* မျက်နက်ဝန်း (Pupil/Iris) */}
						<Ball position={[0, 0, -0.372]} scale={[0.024, 0.032, 0.009]} color="#101018" />
						{/* မျက်ဝန်းအလင်းပြန် အစက်လေး (Catchlight Shine) */}
						<Ball
							position={[-side * 0.007, 0.012, -0.381]}
							scale={[0.006, 0.008, 0.003]}
							color="#ffffff"
						/>
					</group>

					{/* မျက်တောင်နှင့် အပေါ်မျက်ခွံ (Eyelashes and Eyelid Assembly) */}
					<group
						ref={side === -1 ? leftEyelidRef : rightEyelidRef}
						position={[side * 0.14, 1.516, -0.383]}
					>
						{/* အပေါ် မျက်ခွံ အနားကွပ် (Upper Eyelid Arch / Eyeliner Band) */}
						<mesh>
							<shapeGeometry args={[eyelidArch, 8]} />
							<meshStandardMaterial color="#0e1017" roughness={0.4} side={DoubleSide} />
						</mesh>

						{/* မျက်တောင်လေးများ ၄ ချောင်း (4 Delicate Curved Eyelashes) */}
						{EYELASH_CONFIG.map((lash, idx) => (
							<group
								key={idx}
								position={[side * lash.x, lash.y, 0]}
								rotation={[0.12, 0, side * lash.rotZ]}
							>
								<mesh position={[0, lash.length / 2, 0]}>
									<cylinderGeometry args={[lash.rTop, lash.rBottom, lash.length, 8]} />
									<meshStandardMaterial color="#0e1017" roughness={0.35} metalness={0.1} />
								</mesh>
								{/* မျက်တောင်ဖျား အဝန်းစက် (Smooth rounded lash tip) */}
								<mesh position={[0, lash.length, 0]}>
									<sphereGeometry args={[lash.rTop * 1.1, 6, 6]} />
									<meshStandardMaterial color="#0e1017" roughness={0.35} />
								</mesh>
							</group>
						))}
					</group>

					{/* နားရွက်ဒစ်ပြားများ (Ear Discs) */}
					<mesh position={[side * 0.37, 1.46, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
						<cylinderGeometry args={[0.124, 0.124, 0.09, 24]} />
						<meshStandardMaterial color={orange} />
					</mesh>
					<mesh position={[side * 0.419, 1.46, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.075, 0.075, 0.012, 20]} />
						<meshStandardMaterial color={dark} />
					</mesh>

					{/* ပခုံးနှင့် လက်မောင်းများ (Shoulders and Arms) */}
					<Ball position={[side * 0.285, 0.94, 0]} scale={[0.075, 0.09, 0.09]} color={rubber} />
					<mesh position={[side * 0.32, 0.81, 0]} rotation={[0, 0, side * 0.16]} castShadow>
						<cylinderGeometry args={[0.032, 0.032, 0.22, 10]} />
						<meshStandardMaterial color={orange} />
					</mesh>
					<mesh position={[side * 0.34, 0.69, 0]}>
						<cylinderGeometry args={[0.033, 0.033, 0.09, 10]} />
						<meshStandardMaterial color={dark} />
					</mesh>
					<Ball position={[side * 0.34, 0.6, -0.01]} scale={[0.07, 0.085, 0.075]} color={mint} />
				</group>
			))}

			{/* ======================================================== */}
			{/* ၅ စက္ကန့်လျှင် တစ်ကြိမ် ဖွင့်လိုက်ပိတ်လိုက် ပြုလုပ်သော ပါးစပ် */}
			{/* ======================================================== */}
			<group position={[0, 1.345, -0.336]} rotation={[0, Math.PI, 0]}>
				{/* ၁။ အဖွင့်ပါးစပ် အတွင်းခေါင်းအစု (Open Mouth Cavity, Tongue & Teeth) */}
				<group ref={mouthCavityRef}>
					{/* နှုတ်ခမ်းအနားကွပ်ဖြူ (White Smile Lip Frame) */}
					<mesh position={[0, 0, 0]}>
						<shapeGeometry args={[openBorder, 10]} />
						<meshStandardMaterial color="#fffdf1" roughness={0.3} side={DoubleSide} />
					</mesh>
					{/* ပါးစပ်အတွင်း အမှောင်ခေါင်း (Dark Mouth Cavity) */}
					<mesh position={[0, 0, 0.001]}>
						<shapeGeometry args={[openCavity, 10]} />
						<meshStandardMaterial color="#22112a" roughness={0.65} side={DoubleSide} />
					</mesh>
					{/* ချစ်စရာ ပန်းရောင်လျှာလေး (Cute Pink Tongue) */}
					<mesh position={[0, 0, 0.002]}>
						<shapeGeometry args={[tongue, 8]} />
						<meshStandardMaterial color="#ff6987" roughness={0.4} side={DoubleSide} />
					</mesh>
					{/* အပေါ်သွားတန်းဖြူဖြူလေး (Upper White Teeth) */}
					<mesh position={[0, 0, 0.002]}>
						<shapeGeometry args={[teeth, 8]} />
						<meshStandardMaterial color="#fffdf1" roughness={0.3} side={DoubleSide} />
					</mesh>
				</group>

				{/* ၂။ အပိတ်အပြုံး နှုတ်ခမ်းလိုင်း (Closed Smile Line) */}
				<mesh ref={closedSmileRef} position={[0, 0, 0.003]}>
					<shapeGeometry args={[closedSmile, 10]} />
					<meshStandardMaterial color="#fffdf1" roughness={0.3} side={DoubleSide} />
				</mesh>
			</group>

			{/* ရင်ဘတ်ထိန်းချုပ်ခလုတ်များ (Chest Controls) */}
			<Ball position={[0, 0.79, -0.225]} scale={[0.143, 0.18, 0.032]} color="#536c70" />
			<Ball position={[0, 0.79, -0.247]} scale={[0.128, 0.16, 0.019]} color={trim} />
			{[-1, 1].map((side) => (
				<Ball key={side} position={[side * 0.045, 0.74, -0.268]} scale={[0.022, 0.025, 0.012]} color={orange} />
			))}
			<Ball position={[0, 0.84, -0.268]} scale={[0.012, 0.012, 0.008]} color="#fffdf1" />
			<mesh position={[0, 1.025, -0.19]}>
				<boxGeometry args={[0.065, 0.028, 0.025]} />
				<meshStandardMaterial color={orange} />
			</mesh>

			{/* အင်တင်နာတိုင်နှင့် ထိပ်လုံး (Antenna) */}
			<mesh position={[-0.22, 1.84, 0.06]} rotation={[0, 0, -0.12]}>
				<cylinderGeometry args={[0.009, 0.009, 0.27, 8]} />
				<meshStandardMaterial color={dark} />
			</mesh>
			<Ball position={[-0.204, 1.98, 0.06]} scale={[0.032, 0.032, 0.032]} color={orange} />
		</group>
	);
}
