import { useMemo } from 'react';
import {
	TextureLoader,
	CanvasTexture,
	SRGBColorSpace,
	type Texture,
} from 'three';
import {
	kalaySignBigCoords,
	KALAY_SIGN_BIG_ROTATION,
	KALAY_SIGN_BIG_BEARING,
	KALAY_SIGN_BIG_TITLE,
	KALAY_SIGN_BIG_SUBTITLE,
} from '../data/kalaySignboardBig';
import { mobileQuality } from '../game/sceneBudget';
import burmeseLionEmblemImg from '../assets/burmese_lion_emblem.png';

export { KALAY_SIGN_BIG_ROTATION, KALAY_SIGN_BIG_BEARING };

// image-big.png ဓာတ်ပုံပါ အရောင်စပ်များ (Authentic color palette from image-big.png)
const RED_MAIN = '#c21f2f';
const RED_DARK = '#8f1420';
const RED_DEEP_MAROON = '#7a0e1a';
const GOLD_BRIGHT = '#ffd84d';
const GOLD_RICH = '#f0b429';
const GOLD_DEEP = '#c98a0f';
const GREEN_BAND = '#1f6b3a';
const GREEN_DARK = '#14512b';
const FLAG_YELLOW = '#fecb00';
const FLAG_GREEN = '#34b233';
const FLAG_RED = '#ea2839';
// burmese lion.png ပါ မြန်မာ့ခြင်္သေ့ (Chinthe) အရောင်စပ်များ (cream/ivory body, gold mane/trim, red claws)
const LION_BODY = '#ebdcb0';
const LION_BODY_DARK = '#cdb87f';
const LION_MANE_GOLD = '#ffd84d';
const LION_CLAW_RED = '#c21f2f';

/**
 * ဆိုင်းဘုတ်ပြားအလယ် ရွှေစာသား + ခြင်္သေ့တံဆိပ် + အလံ ပါဝင်သော
 * အနီရောင်ပြား မျက်နှာစာ Texture ကို Canvas ဖြင့် တိုက်ရိုက်ဆွဲဖန်တီးခြင်း
 * (image-big.png ပါ စာသား "ကလေးမြို့ မှ ကြိုဆိုပါ၏" အတိအကျ)
 */
function usePlaqueTexture(): Texture | null {
	return useMemo(() => {
		if (typeof document === 'undefined') return null;
		const canvas = document.createElement('canvas');
		canvas.width = 2048;
		canvas.height = 512;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;

		// အောက်ခံ အနီရင့်ရောင် (Base maroon-red fill)
		const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
		bg.addColorStop(0, RED_MAIN);
		bg.addColorStop(1, RED_DARK);
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// အနားသတ် ရွှေရောင်လိုင်းများ (Gold outer border trim)
		ctx.strokeStyle = GOLD_BRIGHT;
		ctx.lineWidth = 8;
		ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

		// ဘယ်ဘက် မြန်မာ့ခြင်္သေ့ လေးထောင့်ဘောင် (Left Burmese Lion emblem box from image-big.png & burmese lion.png)
		const boxSize = 340;
		const boxY = (canvas.height - boxSize) / 2;
		const boxX = 90;

		ctx.fillStyle = RED_DEEP_MAROON;
		ctx.fillRect(boxX, boxY, boxSize, boxSize);
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 12;
		ctx.strokeRect(boxX, boxY, boxSize, boxSize);
		ctx.strokeStyle = GOLD_BRIGHT;
		ctx.lineWidth = 6;
		ctx.strokeRect(boxX + 10, boxY + 10, boxSize - 20, boxSize - 20);

		// မြန်မာ့ခြင်္သေ့ ရွှေရောင် ရုပ်ရိပ်ဆွဲသား (Chinthe Lion silhouette baseline)
		ctx.save();
		ctx.translate(boxX + boxSize / 2, boxY + boxSize / 2);
		ctx.fillStyle = GOLD_BRIGHT;
		// ရင်အုပ်နှင့် ရှေ့ခြေထောက်
		ctx.beginPath();
		ctx.rect(-80, -30, 55, 120);
		ctx.fill();
		// ကိုယ်ထည်
		ctx.beginPath();
		ctx.rect(-35, 0, 95, 70);
		ctx.fill();
		// နောက်ခြေထောက်
		ctx.beginPath();
		ctx.rect(30, 20, 50, 70);
		ctx.fill();
		// လည်ပင်းနှင့် ခေါင်း
		ctx.beginPath();
		ctx.arc(-60, -60, 38, 0, Math.PI * 2);
		ctx.fill();
		// ဦးစွဲ
		ctx.beginPath();
		ctx.moveTo(-75, -95);
		ctx.lineTo(-50, -95);
		ctx.lineTo(-62, -125);
		ctx.closePath();
		ctx.fill();
		// ကောက်ချိုးထားသော အမြီး
		ctx.lineWidth = 14;
		ctx.strokeStyle = GOLD_BRIGHT;
		ctx.beginPath();
		ctx.arc(60, -20, 45, 0, Math.PI * 1.5, false);
		ctx.stroke();
		// အနီရောင် ခြေသည်းများ
		ctx.fillStyle = RED_MAIN;
		ctx.fillRect(-85, 80, 20, 12);
		ctx.fillRect(-60, 80, 20, 12);
		ctx.fillRect(35, 80, 20, 12);
		ctx.fillRect(55, 80, 20, 12);
		ctx.restore();

		const tex = new CanvasTexture(canvas);
		tex.colorSpace = SRGBColorSpace;
		tex.anisotropy = 8;
		tex.needsUpdate = true;

		// burmese_lion_emblem.png ဓာတ်ပုံ တင်သွင်းဆွဲသားခြင်း (Asynchronously draw high-res emblem image onto canvas)
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.src = burmeseLionEmblemImg;
		img.onload = () => {
			ctx.drawImage(img, boxX, boxY, boxSize, boxSize);
			tex.needsUpdate = true;
		};

		// ညာဘက် မြန်မာနိုင်ငံအလံ လေးထောင့်ဘောင် (Right Myanmar flag square)
		const flagW = 400;
		const flagH = 280;
		const flagX = canvas.width - 90 - flagW;
		const flagY = (canvas.height - flagH) / 2;

		ctx.fillStyle = '#ffffff';
		ctx.fillRect(flagX - 8, flagY - 8, flagW + 16, flagH + 16);
		ctx.strokeStyle = GOLD_BRIGHT;
		ctx.lineWidth = 8;
		ctx.strokeRect(flagX - 12, flagY - 12, flagW + 24, flagH + 24);

		const stripeH = flagH / 3;
		ctx.fillStyle = FLAG_YELLOW;
		ctx.fillRect(flagX, flagY, flagW, stripeH);
		ctx.fillStyle = FLAG_GREEN;
		ctx.fillRect(flagX, flagY + stripeH, flagW, stripeH);
		ctx.fillStyle = FLAG_RED;
		ctx.fillRect(flagX, flagY + stripeH * 2, flagW, stripeH);

		// အလယ် ကြယ်ငါးပွင့် (Center white star)
		ctx.fillStyle = '#ffffff';
		ctx.save();
		ctx.translate(flagX + flagW / 2, flagY + flagH / 2);
		ctx.beginPath();
		for (let i = 0; i < 5; i++) {
			const outerA = (i * 2 * Math.PI) / 5 - Math.PI / 2;
			const innerA = outerA + Math.PI / 5;
			const outerR = flagH * 0.38;
			const innerR = outerR * 0.42;
			ctx.lineTo(Math.cos(outerA) * outerR, Math.sin(outerA) * outerR);
			ctx.lineTo(Math.cos(innerA) * innerR, Math.sin(innerA) * innerR);
		}
		ctx.closePath();
		ctx.fill();
		ctx.restore();

		// အလယ်ဗဟို ရွှေရောင် "ကလေးမြို့ မှ ကြိုဆိုပါ၏" စာသား (Center gold title text - refined smaller proportions)
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '700 96px "Myanmar Text", "Padauk", "Noto Sans Myanmar", sans-serif';
		ctx.lineJoin = 'round';

		// Drop shadow for 3D depth
		ctx.lineWidth = 12;
		ctx.strokeStyle = '#3a040a';
		ctx.strokeText(KALAY_SIGN_BIG_TITLE, canvas.width / 2 + 3, canvas.height / 2 + 4);

		// Deep gold outline
		ctx.lineWidth = 8;
		ctx.strokeStyle = GOLD_DEEP;
		ctx.strokeText(KALAY_SIGN_BIG_TITLE, canvas.width / 2, canvas.height / 2);

		// Gold gradient text fill
		const textGrad = ctx.createLinearGradient(0, canvas.height / 2 - 50, 0, canvas.height / 2 + 50);
		textGrad.addColorStop(0, '#fff4b3');
		textGrad.addColorStop(0.3, GOLD_BRIGHT);
		textGrad.addColorStop(0.8, GOLD_RICH);
		textGrad.addColorStop(1, GOLD_DEEP);
		ctx.fillStyle = textGrad;
		ctx.fillText(KALAY_SIGN_BIG_TITLE, canvas.width / 2, canvas.height / 2);

		return tex;
	}, []);
}

/**
 * ထိပ်ဖူး အစိမ်းရောင် ခွေးပေါ်ရှိ "စစ်တိုင်းတိုင်းဒေသကြီး" ရွှေစာသား Texture
 * ကို Canvas ဖြင့် တိုက်ရိုက်ဆွဲဖန်တီးခြင်း
 */
function useCrestBandTexture(): Texture | null {
	return useMemo(() => {
		if (typeof document === 'undefined') return null;
		const canvas = document.createElement('canvas');
		canvas.width = 1536;
		canvas.height = 320;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;

		const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
		bg.addColorStop(0, GREEN_BAND);
		bg.addColorStop(1, GREEN_DARK);
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '700 150px "Myanmar Text", "Padauk", "Noto Sans Myanmar", sans-serif';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 10;
		ctx.strokeStyle = GOLD_DEEP;
		ctx.strokeText(KALAY_SIGN_BIG_SUBTITLE, canvas.width / 2, canvas.height / 2);
		ctx.fillStyle = GOLD_BRIGHT;
		ctx.fillText(KALAY_SIGN_BIG_SUBTITLE, canvas.width / 2, canvas.height / 2);

		const tex = new CanvasTexture(canvas);
		tex.colorSpace = SRGBColorSpace;
		tex.anisotropy = 8;
		tex.needsUpdate = true;
		return tex;
	}, []);
}

/**
 * ဂိတ်တိုင်ကြီး တစ်တိုင် (Ornate Gate Pillar from image-big.png)
 * အောက်ခြေ ရွှေကွင်းများ၊ အနီရင့်ရောင် တိုင်လုံးကြီးနှင့် အပေါ်ပိုင်း ရွှေဒေါင့်ကွင်း
 */
function GatePillar({ x, beamY }: { x: number; beamY: number }) {
	const shaftTop = beamY - 0.35;
	const shaftHeight = shaftTop - 0.3;
	return (
		<group position={[x, 0, 0]} name="gate-pillar">
			{/* လေးထောင့် အောက်ခံအုတ်ခုံ (Square base plinth) */}
			<mesh position={[0, 0.15, 0]} castShadow receiveShadow>
				<boxGeometry args={[1.3, 0.3, 1.3]} />
				<meshStandardMaterial color={GOLD_RICH} roughness={0.4} metalness={0.5} />
			</mesh>
			{/* ရွှေကြာခုံ အဆင့်ဆင့် (Stepped golden lotus rings) */}
			<mesh position={[0, 0.42, 0]} castShadow>
				<cylinderGeometry args={[0.52, 0.6, 0.24, 20]} />
				<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.35} metalness={0.65} />
			</mesh>
			{/* အနီရင့်ရောင် တိုင်လုံးကြီး (Main red pillar shaft) */}
			<mesh position={[0, 0.3 + shaftHeight / 2, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[0.46, 0.5, shaftHeight, 20]} />
				<meshStandardMaterial color={RED_MAIN} roughness={0.4} />
			</mesh>
			{/* တိုင်လုံး အလယ် ရွှေကွင်းတန်း (Mid gold ring accent) */}
			<mesh position={[0, 0.3 + shaftHeight * 0.5, 0]}>
				<torusGeometry args={[0.49, 0.045, 10, 20]} />
				<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.7} />
			</mesh>
			{/* တိုင်ထိပ် ရွှေဒေါင့်ကွင်း (Capital ring just under the beam) */}
			<mesh position={[0, shaftTop, 0]} castShadow>
				<cylinderGeometry args={[0.6, 0.48, 0.3, 20]} />
				<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.7} />
			</mesh>
		</group>
	);
}

/**
 * မြန်မာ့ခြင်္သေ့ ဂိတ်ကင်းစောင့် ရုပ်တု (Burmese Guardian Lion / Chinthe Statue)
 * burmese lion.png ပုံပါ ပုံစံအတိုင်း: နုနယ်ဝါညိုရောင် ကိုယ်ထည်၊ ရွှေရောင် သားမွေးလွှာအဆင့်ဆင့်
 * (mane rings)၊ လက်ဖျား/ခြေဖျား ရွှေကွေးကြွေးပန်းချီများနှင့် အနီရောင် ခြေသည်းများ ပါဝင်သည်
 */
function BurmeseLion({ x, facing }: { x: number; facing: number }) {
	const paws: [number, number][] = [
		[-0.62, 0.42], // front-left (forward)
		[0.5, 0.42], // front-right (forward)
		[-0.55, -0.4], // rear-left (back)
		[0.42, -0.4], // rear-right (back)
	];
	const maneRings = [0, 1, 2, 3, 4];

	return (
		<group position={[x, 0, 0]} rotation={[0, facing, 0]} name="burmese-lion-statue">
			{/* ခြေထောက် ၄ချောင်း (Four legs with red claw feet) */}
			{paws.map(([lx, lz], i) => (
				<group key={i} position={[lx, 0, lz]}>
					<mesh position={[0, 0.35, 0]} castShadow>
						<cylinderGeometry args={[0.13, 0.16, 0.7, 10]} />
						<meshStandardMaterial color={LION_BODY} roughness={0.55} />
					</mesh>
					{/* ရွှေကွေးကြွေးပန်းချီ ခြေဖျားတွင် (Gold scrollwork wrap at the ankle) */}
					<mesh position={[0, 0.58, 0]}>
						<torusGeometry args={[0.15, 0.035, 8, 14]} />
						<meshStandardMaterial color={LION_MANE_GOLD} roughness={0.3} metalness={0.65} />
					</mesh>
					{/* အနီရောင် ခြေသည်း (Red claw foot) */}
					<mesh position={[0, 0.07, 0.05]} castShadow>
						<boxGeometry args={[0.22, 0.14, 0.32]} />
						<meshStandardMaterial color={LION_CLAW_RED} roughness={0.4} />
					</mesh>
				</group>
			))}

			{/* ကိုယ်ထည် ကြီး (Main torso, elongated along local Z) */}
			<mesh position={[0, 0.78, 0]} castShadow receiveShadow>
				<boxGeometry args={[0.62, 0.62, 1.35]} />
				<meshStandardMaterial color={LION_BODY} roughness={0.55} />
			</mesh>
			{/* ကိုယ်ထည်အောက်ပိုင်း အရိပ်အထိုင် (Lower body shading) */}
			<mesh position={[0, 0.5, 0]}>
				<boxGeometry args={[0.6, 0.3, 1.25]} />
				<meshStandardMaterial color={LION_BODY_DARK} roughness={0.6} />
			</mesh>

			{/* ခေါင်း (Head, forward-facing on +Z) */}
			<group position={[0, 1.05, 0.78]}>
				<mesh castShadow>
					<boxGeometry args={[0.48, 0.46, 0.5]} />
					<meshStandardMaterial color={LION_BODY} roughness={0.5} />
				</mesh>
				{/* နှုတ်ခမ်း/ပါးရိုး ဖြူဝါညိုရောင် (Muzzle) */}
				<mesh position={[0, -0.05, 0.3]}>
					<boxGeometry args={[0.3, 0.22, 0.18]} />
					<meshStandardMaterial color={'#f5ecd0'} roughness={0.5} />
				</mesh>
				{/* အနီရောင် နှုတ်ခမ်း (Red mouth line) */}
				<mesh position={[0, -0.1, 0.4]}>
					<boxGeometry args={[0.22, 0.05, 0.04]} />
					<meshStandardMaterial color={LION_CLAW_RED} roughness={0.4} />
				</mesh>
				{/* နား ၂ချောင်း (Ears) */}
				{[-0.2, 0.2].map((ex, i) => (
					<mesh key={i} position={[ex, 0.26, 0.05]} castShadow>
						<coneGeometry args={[0.1, 0.16, 8]} />
						<meshStandardMaterial color={GOLD_RICH} roughness={0.35} metalness={0.5} />
					</mesh>
				))}
				{/* ထိပ်ဖျား ရွှေဦးစွဲ (Gold forehead crest spike) */}
				<mesh position={[0, 0.32, -0.08]} castShadow>
					<coneGeometry args={[0.07, 0.22, 8]} />
					<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.6} />
				</mesh>
			</group>

			{/* လည်ပေါ်ရှိ သားမွေးလွှာ ရွှေကွင်းအဆင့်ဆင့် (Gold stepped mane rings around the neck/chest) */}
			{maneRings.map((i) => {
				const r = 0.32 + i * 0.035;
				return (
					<mesh key={i} position={[0, 0.9 + i * 0.1, 0.42 - i * 0.03]} rotation={[Math.PI / 2, 0, 0]}>
						<torusGeometry args={[r, 0.05, 8, 16]} />
						<meshStandardMaterial color={LION_MANE_GOLD} roughness={0.3} metalness={0.65} />
					</mesh>
				);
			})}

			{/* ကျောကုန်း ရွှေကွေးကြွေးပန်းချီတန်း (Gold scrollwork ridge along the spine) */}
			<mesh position={[0, 1.12, 0]} castShadow>
				<boxGeometry args={[0.1, 0.12, 1.1]} />
				<meshStandardMaterial color={GOLD_RICH} roughness={0.3} metalness={0.55} />
			</mesh>

			{/* တင်ပါးဆုံရွှေပန်းချီချပ် (Gold haunch flourish plates, flank decoration) */}
			{[0.55, -0.3].map((fz, i) => (
				<mesh key={i} position={[0.32, 0.72, fz]} rotation={[0, 0, 0.12]}>
					<boxGeometry args={[0.06, 0.4, 0.3]} />
					<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.6} />
				</mesh>
			))}
			{[0.55, -0.3].map((fz, i) => (
				<mesh key={`l-${i}`} position={[-0.32, 0.72, fz]} rotation={[0, 0, -0.12]}>
					<boxGeometry args={[0.06, 0.4, 0.3]} />
					<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.6} />
				</mesh>
			))}

			{/* ကောက်ချိုးထားသော အမြီး (Curled tail, arcing up over the back) */}
			<group position={[0, 1.0, -0.72]}>
				<mesh rotation={[0.6, 0, 0]} castShadow>
					<cylinderGeometry args={[0.07, 0.1, 0.55, 8]} />
					<meshStandardMaterial color={LION_BODY} roughness={0.5} />
				</mesh>
				<mesh position={[0, 0.42, -0.1]} rotation={[-0.3, 0, 0]}>
					<cylinderGeometry args={[0.05, 0.08, 0.4, 8]} />
					<meshStandardMaterial color={LION_BODY} roughness={0.5} />
				</mesh>
				{/* အမြီးဖျား ရွှေသားမွေးလိမ် (Gold tail-tip tuft) */}
				<mesh position={[0, 0.65, -0.28]}>
					<sphereGeometry args={[0.1, 10, 8]} />
					<meshStandardMaterial color={LION_MANE_GOLD} roughness={0.3} metalness={0.55} />
				</mesh>
			</group>

			{/* ခြေအောက် ရွှေရင့်ရောင် ရုပ်တုခုံ (Gold statue base plinth) */}
			<mesh position={[0, 0.03, 0]} receiveShadow>
				<boxGeometry args={[0.95, 0.12, 1.75]} />
				<meshStandardMaterial color={GOLD_DEEP} roughness={0.4} metalness={0.4} />
			</mesh>
		</group>
	);
}

/**
 * ဒေါင်တိုင် ၂ တိုင်ကြား ချိတ်ဆက်ထားသော ပင်မ ကန့်လန့်ဘိန်း (Rigid Lintel Beam)
 * အနီ/ရွှေ ဘောင်တန်း၊ မူလ ဆိုင်းဘုတ်ပြား Texture နှင့် ရွှေစာသား ပါဝင်သည်
 */
function LintelBeam({ span, beamY }: { span: number; beamY: number }) {
	const plaqueTexture = usePlaqueTexture();
	const beamHeight = 1.5;
	const beamDepth = 0.9;
	const halfBeamDepth = beamDepth / 2;

	return (
		<group position={[0, beamY, 0]} name="lintel-beam">
			{/* ပင်မ အနီရင့်ရောင် ကန့်လန့်ဘိန်း (Main red beam box) */}
			<mesh castShadow receiveShadow>
				<boxGeometry args={[span, beamHeight, beamDepth]} />
				<meshStandardMaterial color={RED_MAIN} roughness={0.4} />
			</mesh>

			{/* အပေါ်/အောက် ရွှေဘောင်တန်း (Top & bottom gold trim strips) */}
			{[beamHeight / 2 - 0.08, -(beamHeight / 2 - 0.08)].map((by, i) => (
				<mesh key={i} position={[0, by, 0]}>
					<boxGeometry args={[span, 0.16, beamDepth + 0.04]} />
					<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.7} />
				</mesh>
			))}

			{/* ကန့်လန့်ဘိန်း ဘယ်/ညာ ထိပ်ဖျား ရွှေကနုတ်နားရွက်များ (Kanote ear flourishes extending beyond pillars) */}
			{[-span / 2 - 0.35, span / 2 + 0.35].map((kx, i) => (
				<group key={`ear-${i}`} position={[kx, 0, 0]}>
					<mesh castShadow>
						<boxGeometry args={[0.6, beamHeight * 0.85, beamDepth * 0.8]} />
						<meshStandardMaterial color={GOLD_RICH} roughness={0.3} metalness={0.65} />
					</mesh>
					<mesh position={[i === 0 ? -0.25 : 0.25, 0, 0]} rotation={[0, 0, i === 0 ? Math.PI / 2 : -Math.PI / 2]}>
						<coneGeometry args={[0.22, 0.5, 6]} />
						<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.25} metalness={0.7} />
					</mesh>
				</group>
			))}

			{/* ===== ရှေ့ဘက် မျက်နှာစာ (Front Face, facing North 0.0°) ===== */}
			<group position={[0, 0, halfBeamDepth]}>
				{/* ပင်မ ဆိုင်းဘုတ်ပြား Texture (Front plaque plane) */}
				<mesh position={[0, 0, 0.008]}>
					<planeGeometry args={[span * 0.86, beamHeight * 0.78]} />
					{plaqueTexture ? (
						<meshStandardMaterial map={plaqueTexture} roughness={0.3} metalness={0.2} />
					) : (
						<meshStandardMaterial color={RED_MAIN} />
					)}
				</mesh>
			</group>

			{/* ===== နောက်ဘက် မျက်နှာစာ (Back Face, facing South 180.0°) ===== */}
			<group position={[0, 0, -halfBeamDepth]} rotation={[0, Math.PI, 0]}>
				{/* ပင်မ ဆိုင်းဘုတ်ပြား Texture (Back plaque plane) */}
				<mesh position={[0, 0, 0.008]}>
					<planeGeometry args={[span * 0.86, beamHeight * 0.78]} />
					{plaqueTexture ? (
						<meshStandardMaterial map={plaqueTexture} roughness={0.3} metalness={0.2} />
					) : (
						<meshStandardMaterial color={RED_MAIN} />
					)}
				</mesh>
			</group>
		</group>
	);
}

/**
 * ထိပ်ဖူး ရွှေကြာပွင့် အဆင့်ဆင့် ခေါင်းတိုင်များနှင့် အစိမ်းရောင်ခွေးစာတန်း
 * (Stepped Golden Finial Crest + Green Text Band from image-big.png)
 */
function CrestAndBand({ span, beamY }: { span: number; beamY: number }) {
	const bandTexture = useCrestBandTexture();
	const beamTop = beamY + 0.75;
	const finialCount = 9;
	const finials = Array.from({ length: finialCount }, (_, i) => {
		const t = i / (finialCount - 1);
		const centerBias = 1 - Math.abs(t - 0.5) * 2;
		const fx = (t - 0.5) * span * 0.84;
		const height = 0.55 + centerBias * 0.95;
		return { fx, height, key: i };
	});

	return (
		<group name="crest-and-band">
			{/* အစိမ်းရောင် ခွေးပတ် ရွှေစာသားတန်း (Curved green text band resting on the beam) */}
			<group position={[0, beamTop - 0.05, 0]}>
				<mesh castShadow>
					<boxGeometry args={[span * 0.72, 0.5, 0.5]} />
					<meshStandardMaterial color={GREEN_BAND} roughness={0.55} />
				</mesh>
				{/* အစိမ်းရောင်ခွေးအနား ရွှေစွန်းခြမ်း (Gold edge trim) */}
				{[0.26, -0.26].map((bz, i) => (
					<mesh key={i} position={[0, 0, bz]}>
						<boxGeometry args={[span * 0.72 + 0.04, 0.5, 0.04]} />
						<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.35} metalness={0.6} />
					</mesh>
				))}
				{/* ရှေ့/နောက် မျက်နှာစာ Texture (Front & back text faces) */}
				<mesh position={[0, 0, 0.251]}>
					<planeGeometry args={[span * 0.7, 0.44]} />
					{bandTexture ? (
						<meshStandardMaterial map={bandTexture} roughness={0.35} metalness={0.15} />
					) : (
						<meshStandardMaterial color={GREEN_BAND} />
					)}
				</mesh>
				<mesh position={[0, 0, -0.251]} rotation={[0, Math.PI, 0]}>
					<planeGeometry args={[span * 0.7, 0.44]} />
					{bandTexture ? (
						<meshStandardMaterial map={bandTexture} roughness={0.35} metalness={0.15} />
					) : (
						<meshStandardMaterial color={GREEN_BAND} />
					)}
				</mesh>
			</group>

			{/* ရွှေကနုတ်ပန်းချပ် ခြေခံတန်း (Gold scrollwork base strip under finials) */}
			<mesh position={[0, beamTop + 0.22, 0]} castShadow>
				<boxGeometry args={[span * 0.9, 0.18, 0.4]} />
				<meshStandardMaterial color={GOLD_RICH} roughness={0.3} metalness={0.65} />
			</mesh>

			{/* အဆင့်ဆင့် တက်သွားသော ရွှေကြာပွင့် ထိပ်ဖူးတန်း (Ascending stepped golden finials) */}
			{finials.map(({ fx, height, key }) => (
				<group key={key} position={[fx, beamTop + 0.3, 0]}>
					{/* ခြေခံကြာခုံ (Finial base disc) */}
					<mesh position={[0, 0.06, 0]}>
						<cylinderGeometry args={[0.17, 0.2, 0.12, 10]} />
						<meshStandardMaterial color={GOLD_DEEP} roughness={0.35} metalness={0.6} />
					</mesh>
					{/* ထိပ်ဖျား ကနုတ်မောက်စိန် (Pointed spire tip) */}
					<mesh position={[0, 0.12 + height / 2, 0]} castShadow>
						<coneGeometry args={[0.16, height, 6]} />
						<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.28} metalness={0.72} />
					</mesh>
					{/* ထိပ်ဖျားစွန်း ငါးငယ်လေး (Tiny tip bead) */}
					<mesh position={[0, 0.12 + height + 0.06, 0]}>
						<sphereGeometry args={[0.06, 8, 6]} />
						<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.2} metalness={0.8} />
					</mesh>
				</group>
			))}
		</group>
	);
}

/**
 * လမ်းမကြီးကို ဖြတ်ကျော်ထားသော ကလေးမြို့ ဂိတ်ဆိုင်းဘုတ်ကြီး (Town Entrance Arch Gate Component)
 * - တည်နေရာ (Location): Robot location ချင်းဆိုင်ရွာ (Chin Sai village) တွင် တွေ့ရသော
 *   Scene X/Z ≈ 813.173, 813.173 (Local U=0.0, V=1150.0) — AH1 မိန်းလမ်းမကြီးကို ဖြတ်ချထား
 * - မျက်နှာမူ (Facing): North / 0.0° (KALAY_SIGN_BIG_ROTATION = angle + π rad)
 * - ဂိတ်တိုင်များ (Pillars): မိန်းလမ်းမကြီး အရှေ့ဘက် နှင့် အနောက်ဘက် ၂ဖက်ကို ခွထား
 * - ဆိုင်းဘုတ်ဘိန်းပေါ်တွင် [Lion 3D Logo] [ကလေးမြို့ မှ ကြိုဆိုပါ၏] [Myanmar အလံ 3D Logo] စီတန်းထားရှိသည်
 * - ဂိတ်တိုင်အောက်ခြေတွင် burmese lion.png ပုံအတိုင်း မြန်မာ့ခြင်္သေ့ ကင်းစောင့်ရုပ်တု ၂ ခု စောင့်နေသည်
 */
export function KalaySignboardBig() {
	const c = kalaySignBigCoords;
	const rot = KALAY_SIGN_BIG_ROTATION;
	const half = c.span / 2;
	const beamY = 5.4;
	const lionOffset = half + 1.1;

	return (
		<group position={[c.x, 0, c.z]} rotation={[0, rot, 0]} name="kalaymyo-town-gate-arch">
			{/* ၁။ ဂိတ်တိုင်ကြီး ၂ တိုင် (Twin Gate Pillars straddling both sides of the main road) */}
			<GatePillar x={-half} beamY={beamY} />
			<GatePillar x={half} beamY={beamY} />

			{/* ၁.၅။ ဂိတ်တိုင်အောက်ခြေ မြန်မာ့ခြင်္သေ့ ကင်းစောင့်ရုပ်တု ၂ ခု (Twin Chinthe guardian lions, from burmese lion.png) */}
			<BurmeseLion x={-lionOffset} facing={Math.PI / 2} />
			<BurmeseLion x={lionOffset} facing={-Math.PI / 2} />

			{/* ၂။ ဒေါင်တိုင် ၂ တိုင်ကြား ချိတ်ဆက်ထားသော ပင်မ ကန့်လန့်ဘိန်းနှင့် ဆိုင်းဘုတ်ပြား (Lion 3D Logo + Title + Flag) */}
			<LintelBeam span={c.span} beamY={beamY} />

			{/* ၃။ ထိပ်ဖူး ရွှေကြာပွင့်တန်းနှင့် အစိမ်းရောင်ခွေးစာတန်း */}
			{!mobileQuality && <CrestAndBand span={c.span} beamY={beamY} />}
			{mobileQuality && (
				<mesh position={[0, beamY + 0.95, 0]} castShadow>
					<coneGeometry args={[0.5, 1.1, 6]} />
					<meshStandardMaterial color={GOLD_BRIGHT} roughness={0.3} metalness={0.6} />
				</mesh>
			)}
		</group>
	);
}
