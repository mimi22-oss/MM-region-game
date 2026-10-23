import {
	htaukKyantVillage,
	htaukKyantCanal,
	htaukKyantLake,
	htaukKyantPonds,
	htaukKyantLandmarks,
	htaukKyantLandmarkBuildings,
	toWorld,
	schoolRot,
	type HtaukKyantLandmarkBuilding,
} from '../../../data/villages/htaukkyant';
import { MainRoad } from '../../MainRoad';
import { Lanes } from '../../Lane';
import { Field } from '../../Field';
import { EastWestCanal } from '../../Canal';
import { House, houseFenceBounds, houseVisualRotation } from '../../House';
import { Tree } from '../../Tree';
import { Block } from '../../Primitives';

/** ဘုရားရင်ပြင်ပေါ်ရှိ ရွှေရောင် စေတီတော်မြတ်ကြီး */
function GoldenPagoda({ b }: { b: HtaukKyantLandmarkBuilding }) {
	return (
		<group position={[b.x, 0, b.z]} rotation={[0, b.rotation, 0]}>
			{/* ပထမနှင့် ဒုတိယ အဆင့် ပစ္စယံ / ပလ္လင်တော် */}
			<Block y={0.3} w={b.width} h={0.6} d={b.depth} color="#dfd7be" />
			<Block y={0.8} w={b.width - 2} h={0.5} d={b.depth - 2} color="#ebd89e" />
			<Block y={1.3} w={b.width - 4} h={0.5} d={b.depth - 4} color="#f0deaa" />
			{/* ခေါင်းလောင်းပုံ ပင်မ စေတီလုံး */}
			<mesh position={[0, 3.2, 0]} castShadow>
				<cylinderGeometry args={[1.6, 4.4, 3.6, 16]} />
				<meshStandardMaterial color="#e5ba3c" metalness={0.45} roughness={0.25} />
			</mesh>
			{/* ရစ်လုံးနှင့် ကြာမှောက်ကြာလန် */}
			<mesh position={[0, 5.4, 0]} castShadow>
				<coneGeometry args={[1.7, 1.4, 16]} />
				<meshStandardMaterial color="#deb130" metalness={0.5} roughness={0.2} />
			</mesh>
			{/* ငှက်ပျောဖူးနှင့် ထီးတော် */}
			<mesh position={[0, 7.2, 0]} castShadow>
				<cylinderGeometry args={[0.08, 0.45, 2.6, 12]} />
				<meshStandardMaterial color="#fcd968" metalness={0.6} roughness={0.15} />
			</mesh>
			<mesh position={[0, 8.4, 0]} castShadow>
				<coneGeometry args={[0.9, 0.8, 12]} />
				<meshStandardMaterial color="#fde588" metalness={0.65} roughness={0.1} />
			</mesh>
			{/* ထောင့်အရံ စေတီငယ် ၄ ဆူ */}
			{[-1, 1].map(sx =>
				[-1, 1].map(sz => (
					<group key={`${sx}-${sz}`} position={[sx * (b.width / 2 - 1.8), 0.6, sz * (b.depth / 2 - 1.8)]}>
						<Block y={0.4} w={1.6} h={0.8} d={1.6} color="#ebd89e" />
						<mesh position={[0, 1.4, 0]} castShadow>
							<coneGeometry args={[0.65, 1.4, 8]} />
							<meshStandardMaterial color="#e5ba3c" metalness={0.45} roughness={0.25} />
						</mesh>
					</group>
				))
			)}
		</group>
	);
}

/** ထောက်ကြန့် ဘောလုံးကွင်း 3D မျက်နှာပြင်နှင့် ဂိုးတိုင်များ */
function FootballPitch({ m }: { m: (typeof htaukKyantLandmarks)[0] }) {
	return (
		<group position={[m.x, 0, m.z]} rotation={[0, m.rotation, 0]}>
			{/* မြက်ခင်းစိမ်း ကွင်းပြင် */}
			<Block y={0.03} w={m.width} h={0.06} d={m.depth} color="#457838" />
			{/* ကွင်းဘေး အဖြူရောင် လိုင်းများ */}
			<Block y={0.065} w={m.width - 4} h={0.01} d={0.3} color="#f0f5ee" />
			<Block y={0.065} x={-(m.width / 2 - 2)} h={0.01} d={m.depth - 6} w={0.3} color="#f0f5ee" />
			<Block y={0.065} x={m.width / 2 - 2} h={0.01} d={m.depth - 6} w={0.3} color="#f0f5ee" />
			{/* အလယ်စည်းနှင့် စက်ဝိုင်း */}
			<Block y={0.065} w={m.width - 4} h={0.01} d={0.3} color="#f0f5ee" />
			<mesh position={[0, 0.066, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<ringGeometry args={[6.8, 7.1, 24]} />
				<meshBasicMaterial color="#f0f5ee" />
			</mesh>
			{/* မြောက်ဘက်နှင့် တောင်ဘက် ဂိုးတိုင်များ */}
			{[-1, 1].map(side => (
				<group key={side} position={[0, 0, side * (m.depth / 2 - 3)]}>
					<Block x={-3.6} y={1.2} w={0.16} h={2.4} d={0.16} color="#ffffff" />
					<Block x={3.6} y={1.2} w={0.16} h={2.4} d={0.16} color="#ffffff" />
					<Block y={2.4} w={7.36} h={0.16} d={0.16} color="#ffffff" />
					<Block z={side * 1.2} y={1.1} w={7.2} h={2.1} d={0.1} color="#e0e8e2" />
				</group>
			))}
		</group>
	);
}

/** အထက ထောက်ကြန့် ကျောင်းသားတန်းစီ စုဝေးရာ ကွင်းပြင်ကြီး */
function SchoolAssemblyGround({ m }: { m: (typeof htaukKyantLandmarks)[0] }) {
	return (
		<group position={[m.x, 0, m.z]} rotation={[0, m.rotation, 0]}>
			{/* ညီညာသော မြက်ခင်းစိမ်း ရင်ပြင် */}
			<Block y={0.035} w={m.width} h={0.05} d={m.depth} color="#4d7c3d" />
			{/* ကွင်းပတ်လည် အဖြူရောင် လိုင်းများ */}
			<Block y={0.065} x={0} z={-m.depth / 2 + 0.8} w={m.width - 2} h={0.01} d={0.25} color="#f0f5ee" />
			<Block y={0.065} x={0} z={m.depth / 2 - 0.8} w={m.width - 2} h={0.01} d={0.25} color="#f0f5ee" />
			<Block y={0.065} x={-m.width / 2 + 0.8} z={0} w={0.25} h={0.01} d={m.depth - 2} color="#f0f5ee" />
			<Block y={0.065} x={m.width / 2 - 0.8} z={0} w={0.25} h={0.01} d={m.depth - 2} color="#f0f5ee" />
			{/* ကျောင်းသားတန်းစီ စစ်ဆေးသော အဖြူရောင် တန်းစီလိုင်းများ */}
			{[-12, -6, 0, 6, 12].map(ox => (
				<Block key={ox} x={ox} y={0.063} z={0} w={0.18} h={0.01} d={m.depth - 5} color="#e0ebd8" />
			))}
			{/* ကျောင်းအုပ်ကြီးနှင့် ဆရာဆရာမများ ရပ်စင် စင်မြင့် */}
			<Block x={0} y={0.3} z={m.depth / 2 - 2.5} w={12} h={0.5} d={3.5} color="#ded5bc" />
			<Block x={0} y={0.85} z={m.depth / 2 - 2.5} w={0.9} h={0.7} d={0.7} color="#7a5435" />
		</group>
	);
}

/** အထက ထောက်ကြန့် ပန်းခင်းနှင့် ရုက္ခဗေဒစိုက်ခင်း */
function SchoolGarden({ m }: { m: (typeof htaukKyantLandmarks)[0] }) {
	return (
		<group position={[m.x, 0, m.z]} rotation={[0, m.rotation, 0]}>
			<Block y={0.12} w={m.width + 0.6} h={0.24} d={m.depth + 0.6} color="#d6cebd" />
			<Block y={0.16} w={m.width} h={0.22} d={m.depth} color="#523f2b" />
			{/* ပန်းခင်း အပင်ငယ်များ */}
			{[-3.5, 0, 3.5].map(x =>
				[-6, -2, 2, 6].map(z => (
					<group key={`${x}-${z}`} position={[x, 0.32, z]}>
						<Block y={0.2} w={1.6} h={0.4} d={1.6} color={(x + z) % 2 ? '#3b7032' : '#4a8241'} />
						<Block y={0.45} w={0.6} h={0.15} d={0.6} color={(x + z) % 3 === 0 ? '#de434f' : '#f0bc3a'} />
					</group>
				))
			)}
		</group>
	);
}

/** အထက ထောက်ကြန့် နိုင်ငံတော်အလံတိုင် (မိန်းလမ်းမကြီးဘက် မျက်နှာမူလျက်) */
function SchoolFlagPole({ x, z, rot }: { x: number; z: number; rot: number }) {
	return (
		<group position={[x, 0, z]} rotation={[0, rot, 0]}>
			<Block y={0.25} w={3.2} h={0.5} d={3.2} color="#e5ded0" />
			<Block y={0.6} w={2} h={0.35} d={2} color="#dbd0bf" />
			<mesh position={[0, 6, 0]} castShadow>
				<cylinderGeometry args={[0.07, 0.09, 11.5, 10]} />
				<meshStandardMaterial color="#c8d2d6" metalness={0.7} roughness={0.25} />
			</mesh>
			<mesh position={[0, 11.8, 0]} castShadow>
				<sphereGeometry args={[0.2, 12, 12]} />
				<meshStandardMaterial color="#f5c942" metalness={0.8} roughness={0.2} />
			</mesh>
			{/* မြန်မာနိုင်ငံတော်အလံ (အဝါ၊ အစိမ်း၊ အနီ နှင့် အလယ်ကြယ်ဖြူ) */}
			<group position={[0.9, 10.8, 0]}>
				<Block y={0.4} w={1.8} h={0.4} d={0.03} color="#fec50c" />
				<Block y={0} w={1.8} h={0.4} d={0.03} color="#34b233" />
				<Block y={-0.4} w={1.8} h={0.4} d={0.03} color="#ea2839" />
				<Block z={0.025} w={0.5} h={0.5} d={0.02} color="#ffffff" />
			</group>
		</group>
	);
}

/** အထင်ကရ အဆောက်အအုံများ (ကျောင်းတိုက်၊ စာသင်ဆောင်များ၊ တန်ဆောင်း) */
function LandmarkBuilding({ b }: { b: HtaukKyantLandmarkBuilding }) {
	// အဆောက်အအုံ အလျားလိုက် အမိုးစောက် ပုံစံထုတ်ခြင်း
	const roofSlope = (h: number) => {
		const pitch = 2.4;
		if (b.width >= b.depth) {
			// အလျားလိုက် မျက်နှာစာ (X ဝင်ရိုးတလျှောက် အမိုးခေါင်မိုး၊ Z ဘက်သို့ ပြေဆင်း)
			return [-1, 1].map(s => (
				<mesh
					key={s}
					position={[0, h, s * (b.depth / 4)]}
					rotation={[s * Math.atan2(pitch, b.depth / 2), 0, 0]}
					castShadow
				>
					<boxGeometry args={[b.width + 1.2, 0.26, Math.hypot(b.depth / 2, pitch) + 0.8]} />
					<meshStandardMaterial color={b.roof} roughness={0.7} />
				</mesh>
			));
		} else {
			// ဒေါင်လိုက် စာသင်ဆောင် (Z ဝင်ရိုးတလျှောက် အမိုးခေါင်မိုး၊ X ဘက်သို့ ပြေဆင်း)
			return [-1, 1].map(s => (
				<mesh
					key={s}
					position={[s * (b.width / 4), h, 0]}
					rotation={[0, 0, -s * Math.atan2(pitch, b.width / 2)]}
					castShadow
				>
					<boxGeometry args={[Math.hypot(b.width / 2, pitch) + 0.8, 0.26, b.depth + 1.2]} />
					<meshStandardMaterial color={b.roof} roughness={0.7} />
				</mesh>
			));
		}
	};

	return (
		<group position={[b.x, 0, b.z]} rotation={[0, b.rotation, 0]}>
			<Block y={0.25} w={b.width + 1.2} h={0.5} d={b.depth + 1.2} color="#d4ccb8" />
			<Block y={b.height / 2} w={b.width} h={b.height} d={b.depth} color={b.color} />
			{roofSlope(b.height + 1.2)}

			{/* ပင်မ ကျောင်းဆောင်ကြီး အလယ်ထပ် ပြတင်းပေါက်များနှင့် မျက်နှာစာ (မိန်းလမ်းမကြီးဘက် မျက်နှာမူ) */}
			{b.kind === 'school-main' && (
				<>
					{/* အလယ်ထပ် အဆင့်ခွဲ မျဉ်း */}
					<Block y={4.2} z={b.depth / 2 + 0.12} w={b.width + 0.4} h={0.25} d={0.2} color="#b8ab96" />
					{/* ကျောင်းဆိုင်းဘုတ် အစိမ်းရောင် ဗျဉ်းပြား */}
					<Block y={b.height - 0.2} z={b.depth / 2 + 0.1} w={b.width * 0.7} h={0.8} d={0.15} color="#1b4666" />
					{/* စာသင်ခန်း ပြတင်းပေါက်များ (အောက်ထပ် နှင့် အပေါ်ထပ်) */}
					{[-16, -8, 0, 8, 16].map(xx => (
						<Block key={xx} x={xx} y={2.4} z={b.depth / 2 + 0.08} w={3.2} h={2.2} d={0.12} color="#85a8c2" />
					))}
					{[-16, -8, 0, 8, 16].map(xx => (
						<Block key={`top-${xx}`} x={xx} y={6.2} z={b.depth / 2 + 0.08} w={3.2} h={2.2} d={0.12} color="#85a8c2" />
					))}
					{/* ပင်မ ဝင်ပေါက် မုခ်ဦး အမိုးနှင့် တိုင်များ */}
					<Block x={0} y={3.8} z={b.depth / 2 + 1.8} w={8.4} h={7.6} d={3.6} color="#eee8db" />
					<Block x={0} y={0.25} z={b.depth / 2 + 3.8} w={5.2} h={0.5} d={1.4} color="#cfc7b4" />
				</>
			)}

			{/* စာသင်ဆောင် တောင်ပံများ — ရင်ပြင်ဘက်သို့ မျက်နှာမူသော စင်္ကြံလမ်း */}
			{b.kind === 'school-wing' && (
				<>
					{/* စာသင်ဆောင် ဘေး ပြတင်းပေါက်များ */}
					{[-12, -4, 4, 12].map(zz => (
						<Block key={zz} x={b.width / 2 + 0.05} y={3} z={zz} w={0.12} h={1.8} d={2.6} color="#7c9eb8" />
					))}
					{[-12, -4, 4, 12].map(zz => (
						<Block key={`opp-${zz}`} x={-b.width / 2 - 0.05} y={3} z={zz} w={0.12} h={1.8} d={2.6} color="#7c9eb8" />
					))}
				</>
			)}

			{/* ဘုန်းတော်ကြီးကျောင်းတိုက် ပြာသာဒ်အဆင့်ဆင့် အမိုးငယ် */}
			{b.kind === 'monastery' && (
				<>
					<Block y={b.height + 1.6} w={b.width * 0.55} h={1.8} d={b.depth * 0.55} color="#bba882" />
					<mesh position={[0, b.height + 3.4, 0]} castShadow>
						<coneGeometry args={[b.width * 0.32, 2.8, 4]} />
						<meshStandardMaterial color={b.roof} />
					</mesh>
				</>
			)}

			{/* နားနေဆောင် ပတ်လည် တိုင်လုံးများ */}
			{b.kind === 'pavilion' && (
				<>
					{[-1, 1].map(sx =>
						[-1, 1].map(sz => (
							<Block
								key={`p-${sx}-${sz}`}
								x={sx * (b.width / 2 - 0.5)}
								y={b.height / 2}
								z={sz * (b.depth / 2 - 0.5)}
								w={0.4}
								h={b.height}
								d={0.4}
								color="#5e4430"
							/>
						))
					)}
				</>
			)}
		</group>
	);
}

/** ရေကန်ကြီးနှင့် ရေကန် ၅ ကန် 3D မျက်နှာပြင် */
function PondSurface({ p }: { p: (typeof htaukKyantPonds)[0] }) {
	return (
		<group position={[p.x, 0, p.z]} rotation={[0, p.rotation, 0]}>
			<Block y={0.1} w={p.width + 4} h={0.2} d={p.depth + 4} color="#796e52" />
			<mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[p.width, p.depth]} />
				<meshStandardMaterial color={p.color ?? '#3d838b'} metalness={0.3} roughness={0.3} />
			</mesh>
		</group>
	);
}

/**
 * ထောက်ကြန့်ကျေးရွာ (Htauk Kyant Village) — 3D Scene Component
 */
export function HtaukKyantVillage() {
	const residentialHouses = htaukKyantVillage.houses.filter(h => !h.id.startsWith('hk-landmark-'));
	const pagodaBuildings = htaukKyantLandmarkBuildings.filter(b => b.kind === 'pagoda');
	const otherBuildings = htaukKyantLandmarkBuildings.filter(b => b.kind !== 'pagoda');
	const footballPlayground = htaukKyantLandmarks.find(m => m.id === 'hk-football-playground')!;
	const schoolYard = htaukKyantLandmarks.find(m => m.id === 'hk-school-yard')!;
	const pagodaYard = htaukKyantLandmarks.find(m => m.id === 'hk-pagoda-compound')!;
	const assemblyGround = htaukKyantLandmarks.find(m => m.id === 'hk-school-assembly-ground')!;
	const schoolGarden = htaukKyantLandmarks.find(m => m.id === 'hk-school-garden')!;

	// နိုင်ငံတော်အလံတိုင် (ကွင်းပြင်ရှေ့၊ မိန်းလမ်းမကြီးဘက် မျက်နှာမူလျက်)
	const flagPos = toWorld(-32, 3270);
	// ကျောင်းဝင်ပေါက် ဂိတ်တိုင် ၂ တိုင် (AH1 ဘေး)
	const gateNorth = toWorld(-26, 3273);
	const gateSouth = toWorld(-26, 3287);

	return (
		<group name="village-htaukkyant">
			{/* သာယာကုန်း-ထောက်ကြန့်ကြား လယ်ကွင်းများနှင့် ကန့်လန့်ဖြတ် ရေမြောင်း+တံတား */}
			{htaukKyantVillage.separationFields.map((f, i) => (
				<Field key={f.id ?? `hk-sep-${i}`} f={f} bunded />
			))}
			{htaukKyantCanal && <EastWestCanal c={htaukKyantCanal} />}

			{/* အနောက်မြောက်ဘက် ရေကန်ကြီးနှင့် ရေကန် ၅ ကန် */}
			<PondSurface p={htaukKyantLake} />
			{htaukKyantPonds.map(p => (
				<PondSurface key={p.id} p={p} />
			))}

			{/* ဘုရားဝင်း ကွင်းပြင် */}
			<group position={[pagodaYard.x, 0, pagodaYard.z]} rotation={[0, pagodaYard.rotation, 0]}>
				<Block y={0.03} w={pagodaYard.width} h={0.06} d={pagodaYard.depth} color="#ded5bc" />
			</group>

			{/* ကျောင်းဝင်း ညီညာသော မြေခင်းပြင် (မိန်းလမ်းမကြီးဘက် မျက်နှာမူ) */}
			<group position={[schoolYard.x, 0, schoolYard.z]} rotation={[0, schoolYard.rotation, 0]}>
				<Block y={0.03} w={schoolYard.width} h={0.06} d={schoolYard.depth} color="#ccd7de" />
			</group>

			{/* အထက ထောက်ကြန့် ကျောင်းကွင်းပြင် */}
			{assemblyGround && <SchoolAssemblyGround m={assemblyGround} />}

			{/* အထက ထောက်ကြန့် ပန်းခင်း */}
			{schoolGarden && <SchoolGarden m={schoolGarden} />}

			{/* အထက ထောက်ကြန့် နိုင်ငံတော်အလံတိုင် */}
			<SchoolFlagPole x={flagPos.x} z={flagPos.z} rot={schoolRot} />

			{/* ကျောင်းအဝင် ဂိတ်တိုင် ၂ တိုင် (AH1 ဘေး) */}
			<Block x={gateNorth.x} y={1.6} z={gateNorth.z} w={1.1} h={3.2} d={1.1} color="#cdd7dc" />
			<Block x={gateNorth.x} y={3.35} z={gateNorth.z} w={1.3} h={0.3} d={1.3} color="#1b4666" />
			<Block x={gateSouth.x} y={1.6} z={gateSouth.z} w={1.1} h={3.2} d={1.1} color="#cdd7dc" />
			<Block x={gateSouth.x} y={3.35} z={gateSouth.z} w={1.3} h={0.3} d={1.3} color="#1b4666" />

			{/* ဘောလုံးကွင်း (မိန်းလမ်းမကြီးနှင့် Pagoda ကြား) */}
			<FootballPitch m={footballPlayground} />

			{/* လမ်းကွန်ရက် */}
			<MainRoad roads={htaukKyantVillage.roads} />
			<Lanes roads={htaukKyantVillage.roads} />

			{/* လယ်ကွင်းများ (ဘောလုံးကွင်းနှင့် စေတီကြား လယ်ကွင်းလေး အပါအဝင်) */}
			{htaukKyantVillage.fields.map((f, i) => (
				<Field key={f.id ?? `hk-f-${i}`} f={f} bunded />
			))}
			{htaukKyantVillage.bundedFields.map((f, i) => (
				<Field key={f.id ?? `hk-bf-${i}`} f={f} bunded />
			))}

			{/* လူနေအိမ်ခြေများ */}
			{residentialHouses.map(h => (
				<House key={h.id} h={h} />
			))}

			{/* ထောက်ကြန့် စေတီတော်မြတ် ၂ ဆူ (အရှေ့ဘက် နှင့် အရှေ့မြောက်ဘက်) နှင့် အခြား အထင်ကရ ကျောင်းဆောင်များ */}
			{pagodaBuildings.map(b => (
				<GoldenPagoda key={b.id} b={b} />
			))}
			{otherBuildings.map(b => (
				<LandmarkBuilding key={b.id} b={b} />
			))}

			{/* သစ်ပင်များ */}
			{htaukKyantVillage.largeTrees.map((t, i) => (
				<Tree key={t.id} t={t} i={i} variant="large" />
			))}
			{htaukKyantVillage.trees.map((t, i) => (
				<Tree key={t.id} t={t} i={i} variant="canopy" />
			))}
			{htaukKyantVillage.farmTrees.map(t => (
				<Tree key={t.id} t={t} variant="farm" />
			))}
		</group>
	);
}

/**
 * ထောက်ကြန့်ကျေးရွာ (Htauk Kyant Village) — 2D Map Plan SVG Component
 */
export function HtaukKyantVillagePlan({
	labels,
	onSelectLocation,
}: {
	labels: boolean;
	onSelectLocation?: (id: string) => void;
}) {
	const residentialHouses = htaukKyantVillage.houses.filter(h => !h.id.startsWith('hk-landmark-'));
	const c = htaukKyantCanal;

	return (
		<g
			id="village-htaukkyant-plan"
			className={labels ? 'map-region-clickable' : undefined}
			onClick={
				labels && onSelectLocation
					? e => {
							e.stopPropagation();
							onSelectLocation('htaukkyant');
					  }
					: undefined
			}
		>
			{/* သာယာကုန်း-ထောက်ကြန့်ကြား ခြားထားသော လယ်ကွင်းများ */}
			{htaukKyantVillage.separationFields.map(f => (
				<rect
					key={f.id}
					x={f.x - f.width / 2}
					y={f.z - f.depth / 2}
					width={f.width}
					height={f.depth}
					fill={f.color}
					stroke="#c1b57f"
					strokeWidth="0.9"
					transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
				/>
			))}

			{/* ကန့်လန့်ဖြတ် ရေမြောင်းနှင့် AH1 တံတား */}
			{c && (
				<g transform={`rotate(${(-c.rotation * 180) / Math.PI} ${c.x} ${c.z})`}>
					<rect
						x={c.uMin}
						y={c.v - c.width / 2}
						width={c.uMax - c.uMin}
						height={c.width}
						fill="#4d9395"
						stroke="#3b7678"
						strokeWidth="0.8"
					/>
					{c.bridges.map((b, i) => (
						<rect
							key={i}
							x={b.u - b.width / 2}
							y={b.v - b.depth / 2}
							width={b.width}
							height={b.depth}
							fill="#697574"
							stroke="#d6cfb9"
							strokeWidth="0.7"
						/>
					))}
				</g>
			)}

			{/* ရေကန်ကြီးနှင့် ရေကန် ၅ ကန် */}
			<rect
				x={htaukKyantLake.x - htaukKyantLake.width / 2}
				y={htaukKyantLake.z - htaukKyantLake.depth / 2}
				width={htaukKyantLake.width}
				height={htaukKyantLake.depth}
				fill="#3c7980"
				stroke="#2a585e"
				strokeWidth="1.2"
				rx="6"
				transform={`rotate(${(-htaukKyantLake.rotation * 180) / Math.PI} ${htaukKyantLake.x} ${htaukKyantLake.z})`}
			/>
			{htaukKyantPonds.map(p => (
				<rect
					key={p.id}
					x={p.x - p.width / 2}
					y={p.z - p.depth / 2}
					width={p.width}
					height={p.depth}
					fill={p.color ?? '#3d838b'}
					stroke="#2a585e"
					strokeWidth="1"
					transform={`rotate(${(-p.rotation * 180) / Math.PI} ${p.x} ${p.z})`}
				/>
			))}

			{/* အနောက်နှင့် အရှေ့ လယ်ကွင်းများ */}
			{htaukKyantVillage.bundedFields.map(f => (
				<rect
					key={f.id}
					x={f.x - f.width / 2}
					y={f.z - f.depth / 2}
					width={f.width}
					height={f.depth}
					fill={f.color}
					stroke="#c1b57f"
					strokeWidth="0.9"
					transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
				/>
			))}
			{htaukKyantVillage.fields.map(f => (
				<rect
					key={f.id}
					x={f.x - f.width / 2}
					y={f.z - f.depth / 2}
					width={f.width}
					height={f.depth}
					fill={f.color}
					stroke="#c1b57f"
					strokeWidth="0.8"
					transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
				/>
			))}

			{/* ရင်ပြင်များ (ဘုရားဝင်း၊ ဘောလုံးကွင်း၊ ကျောင်းဝင်း၊ ကွင်းပြင်၊ စိုက်ခင်း) */}
			{htaukKyantLandmarks.map(m => {
				let fill = '#ded5bc';
				let stroke = '#8a7f5d';
				if (m.id === 'hk-football-playground') {
					fill = '#457838';
					stroke = '#2f5926';
				} else if (m.id === 'hk-school-yard') {
					fill = '#ccd7de';
					stroke = '#92a3af';
				} else if (m.id === 'hk-school-assembly-ground') {
					fill = '#4d7c3d';
					stroke = '#375e2c';
				} else if (m.id === 'hk-school-garden') {
					fill = '#3e6b33';
					stroke = '#2c4e24';
				}
				return (
					<rect
						key={m.id}
						x={m.x - m.width / 2}
						y={m.z - m.depth / 2}
						width={m.width}
						height={m.depth}
						fill={fill}
						stroke={stroke}
						strokeWidth="0.8"
						transform={`rotate(${(-m.rotation * 180) / Math.PI} ${m.x} ${m.z})`}
					/>
				);
			})}

			{/* လမ်းများ (မိန်းလမ်းမကြီးကို ပုံပါ လိမ္မော်ရောင် လမ်းကြောင်းအတိုင်း ပေါ်လွင်စေသည်) */}
			{htaukKyantVillage.roads.map(r => (
				<rect
					key={r.id}
					x={r.x - r.width / 2}
					y={r.z - r.depth / 2}
					width={r.width}
					height={r.depth}
					fill={r.main ? '#ff6a00' : '#d4bd98'}
					stroke={r.main ? '#d35400' : '#baa077'}
					strokeWidth={r.main ? '1.5' : '0.5'}
					transform={`rotate(${(-r.rotation * 180) / Math.PI} ${r.x} ${r.z})`}
				/>
			))}

			{/* အထင်ကရ အဆောက်အအုံများ */}
			{htaukKyantLandmarkBuildings.map(b => (
				<rect
					key={b.id}
					x={b.x - b.width / 2}
					y={b.z - b.depth / 2}
					width={b.width}
					height={b.depth}
					fill={b.roof}
					stroke="#fff3d1"
					strokeWidth="0.8"
					transform={`rotate(${(-b.rotation * 180) / Math.PI} ${b.x} ${b.z})`}
				/>
			))}

			{/* လူနေအိမ်ခြေများ */}
			{residentialHouses.map(h => {
				const { sideHalf, backHalf, frontHalf } = houseFenceBounds(h);
				const rot = houseVisualRotation(h);
				return (
					<g key={h.id}>
						<g transform={`translate(${h.x} ${h.z}) rotate(${(-rot * 180) / Math.PI})`}>
							<line x1={-sideHalf} y1={-backHalf} x2={-sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8" />
							<line x1={sideHalf} y1={-backHalf} x2={sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8" />
							<line x1={-sideHalf} y1={frontHalf} x2={-1.3} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1" />
							<line x1={1.3} y1={frontHalf} x2={sideHalf} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1" />
							<rect x={-h.width / 2} y={-h.depth / 2} width={h.width} height={h.depth} fill={h.roof} />
						</g>
					</g>
				);
			})}

			{/* စာတန်း အညွှန်းများ */}
			{labels && (
				<>
					<text
						x={htaukKyantVillage.labelPos.x}
						y={htaukKyantVillage.labelPos.z}
						fill="#143e37"
						fontSize="26"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="4"
						paintOrder="stroke fill"
					>
						ထောက်ကြန့်ကျေးရွာ
					</text>
					<text
						x={htaukKyantVillage.labelPos.x}
						y={htaukKyantVillage.labelPos.z + 18}
						fill="#285e54"
						fontSize="13"
						fontWeight="600"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						Htauk Kyant Village · Kalay
					</text>
					{/* အထင်ကရ နေရာ အညွှန်းများ */}
					<text
						x={htaukKyantLandmarks.find(m => m.id === 'hk-football-playground')!.x}
						y={htaukKyantLandmarks.find(m => m.id === 'hk-football-playground')!.z}
						fill="#ffffff"
						fontSize="11"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#255420"
						strokeWidth="2"
						paintOrder="stroke fill"
					>
						⚽ ဘောလုံးကွင်း
					</text>
					<text
						x={htaukKyantLandmarks.find(m => m.id === 'hk-pagoda-compound')!.x}
						y={htaukKyantLandmarks.find(m => m.id === 'hk-pagoda-compound')!.z}
						fill="#b07b14"
						fontSize="11"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						ထောက်ကြန့် စေတီ
					</text>
					<text
						x={htaukKyantLandmarks.find(m => m.id === 'hk-school-yard')!.x}
						y={htaukKyantLandmarks.find(m => m.id === 'hk-school-yard')!.z}
						fill="#194c73"
						fontSize="11"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#ffffff"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						အထက ထောက်ကြန့်
					</text>
					<text
						x={htaukKyantLake.x}
						y={htaukKyantLake.z}
						fill="#ffffff"
						fontSize="11"
						fontWeight="bold"
						textAnchor="middle"
						stroke="#1e4e54"
						strokeWidth="2"
						paintOrder="stroke fill"
					>
						ရေကန်ကြီး
					</text>
				</>
			)}
		</g>
	);
}
