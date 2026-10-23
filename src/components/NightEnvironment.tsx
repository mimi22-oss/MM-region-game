import { mobileQuality } from '../game/sceneBudget';
import { useMemo } from 'react';
import { ward, toWorld, kalayVillages } from '../data/ward';

/**
 * တောက်ပသော ကြယ်တာရာများ (Night Sky Stars)
 * ကောင်းကင်ယံအမြင့်တွင် ပြန့်ကျဲတည်ရှိသော ကြယ်တာရာများ
 */
function NightStars() {
	const stars = useMemo(() => {
		const arr: { x: number; y: number; z: number; size: number; color: string }[] = [];
		const colors = ['#ffffff', '#e3f0ff', '#ffeec7', '#d0e8ff', '#fffde8'];
		for (let i = 0; i < (mobileQuality?80:350); i++) {
			const angle = (i * 2.399963) % (Math.PI * 2);
			const dist = 600 + ((i * 37) % 3600);
			const x = Math.cos(angle) * dist;
			const z = Math.sin(angle) * dist;
			const y = 900 + ((i * 43) % 1800);
			const size = 3 + (i % 4) * 1.8;
			const color = colors[i % colors.length];
			arr.push({ x, y, z, size, color });
		}
		return arr;
	}, []);

	return (
		<group name="night-stars">
			{stars.map((s, idx) => (
				<mesh key={idx} position={[s.x, s.y, s.z]}>
					<sphereGeometry args={[s.size, 4, 4]} />
					<meshBasicMaterial color={s.color} />
				</mesh>
			))}
		</group>
	);
}

/**
 * သာယာလှပသော လမင်းကြီး (Luminous Moon & Moonlight Halo)
 * ဝေပုလ္လတောင်ကြီး အထက် ကောင်းကင်ယံတွင် သာယာစွာ သာနေသော လပြည့်ဝန်း
 */
function NightMoon() {
	return (
		<group position={[280, 850, 2600]} name="night-moon">
			{/* ပင်မ လမင်းလုံးကြီး */}
			<mesh>
				<sphereGeometry args={[65, 20, 20]} />
				<meshBasicMaterial color="#fff4d0" />
			</mesh>
			{/* လရောင် အဝန်းအဝိုင်း (Moon Halo Glow) */}
			<mesh position={[0, 0, -2]}>
				<ringGeometry args={[70, 130, 32]} />
				<meshBasicMaterial color="#ffe899" transparent opacity={0.22} />
			</mesh>
			<mesh position={[0, 0, -3]}>
				<ringGeometry args={[130, 220, 32]} />
				<meshBasicMaterial color="#88b5e6" transparent opacity={0.12} />
			</mesh>
		</group>
	);
}

/**
 * လမ်းဘေး ဓာတ်တိုင်/မီးတိုင်များ (Street Lantern Post)
 */
function StreetLamp({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
	return (
		<group position={[x, 0, z]} rotation={[0, rot, 0]}>
			{/* မီးတိုင် အောက်ခံ */}
			<mesh position={[0, 3.2, 0]}>
				<cylinderGeometry args={[0.16, 0.22, 6.4, 6]} />
				<meshStandardMaterial color="#2d383b" />
			</mesh>
			{/* မီးတိုင် လက်တံ */}
			<mesh position={[0.8, 6.2, 0]}>
				<boxGeometry args={[1.6, 0.16, 0.16]} />
				<meshStandardMaterial color="#2d383b" />
			</mesh>
			{/* မီးအိမ်ခေါင်း (Warm Amber Light Bulb) */}
			<mesh position={[1.4, 5.8, 0]}>
				<boxGeometry args={[0.9, 0.7, 0.9]} />
				<meshBasicMaterial color="#ffc35b" />
			</mesh>
		</group>
	);
}

/**
 * ညဘက် လင်းလက်နေသော အထင်ကရ မီးရောင်များ
 * - မဟာဝေပုလ္လတောင်တော် စေတီ ရွှေရောင်မီး
 * - ထောက်ကြန့် စေတီတော်များ ရွှေရောင်မီး
 * - ခရစ်ယာန်ဘုရားကျောင်းများ လက်ဝါးကပ်တိုင်နှင့် ပြတင်းပေါက်မီး
 * - ကြာအင်းရေကန် ရေပေါ်ဆောင် မီးရောင်များ
 * - AH1 လမ်းမကြီးတစ်လျှောက် လမ်းမီးတိုင်များ
 */
export function NightEnvironment() {
	// အဓိက လမ်းမီးတိုင် တည်နေရာများ (AH1 တစ်လျှောက် တံတားများနှင့် ရွာအဝင်များ)
	const streetLamps = useMemo(() => {
		const points: { u: number; v: number; rot: number }[] = [
			// မြို့သာ Area 5
			{ u: 8, v: 50, rot: 0 },
			{ u: 8, v: 140, rot: 0 },
			{ u: 8, v: 240, rot: 0 },
			{ u: 8, v: 330, rot: 0 },
			// သာစည်ရွာ
			{ u: 8, v: 750, rot: 0 },
			{ u: 8, v: 850, rot: 0 },
			// ချင်းဆိုင်ရွာ
			{ u: 8, v: 1100, rot: 0 },
			{ u: 8, v: 1220, rot: 0 },
			// ဇင်းကလင်းရွာ & ဇီးချောင်းတံတား
			{ u: 8, v: 1460, rot: 0 },
			{ u: 8, v: 1560, rot: 0 },
			// သာယာကုန်းရွာ & ဘုရားကျောင်းရှေ့
			{ u: 8, v: 2650, rot: 0 },
			{ u: 8, v: 2750, rot: 0 },
			// ထောက်ကြန့်ရွာ တံတား & ဘုရား/ဘောလုံးကွင်းရှေ့
			{ u: 8, v: 3150, rot: 0 },
			{ u: 8, v: 3280, rot: 0 },
			{ u: 8, v: 3380, rot: 0 },
			// ကြာအင်းရွာ သပြေချောင်းတံတား & ကျောင်းရှေ့
			{ u: 8, v: 3645, rot: 0 },
			{ u: 8, v: 3750, rot: 0 },
			{ u: 8, v: 3850, rot: 0 },
			{ u: 8, v: 3950, rot: 0 },
			// ကြာအင်းရေကန် ရေပေါ်ဆောင် ကူးတံတားဘေး
			{ u: -332, v: 4004, rot: Math.PI / 2 },
			{ u: -332, v: 4014, rot: Math.PI / 2 },
		];
		return points.map(pt => ({ ...toWorld(pt.u, pt.v), rot: pt.rot }));
	}, []);

	// မဟာဝေပုလ္လတောင်တော် စေတီတော် တည်နေရာ (တောင်ထွတ် ရွှေရောင်မီး)
	const mahaWeipulaPeak = ward.weipula.peaks[2];

	// ထောက်ကြန့် စေတီတော် တည်နေရာ
	const htaukKyantVillage = kalayVillages.find(v => v.id === 'htaukkyant');
	const hkPagoda = htaukKyantVillage?.houses.find(h => h.id === 'hk-landmark-pagoda-base');
	const hkPagodaSw = htaukKyantVillage?.houses.find(h => h.id === 'hk-landmark-pagoda-sw');

	// ကြာအင်းရွာ ဘုရားကျောင်းများနှင့် ရေပေါ်ဆောင်
	const kyarInnVillage = kalayVillages.find(v => v.id === 'kyarinn');
	const kiBaptist = kyarInnVillage?.houses.find(h => h.id === 'ki-church-baptist');
	const kiIbc = kyarInnVillage?.houses.find(h => h.id === 'ki-church-ibc');
	const kiStPeter = kyarInnVillage?.houses.find(h => h.id === 'ki-church-st-peter');
	const kiPavilion = kyarInnVillage?.houses.find(h => h.id === 'ki-lake-pavilion');

	// သာယာကုန်း ဘုရားကျောင်း
	const tygVillage = kalayVillages.find(v => v.id === 'tharyargone');
	const tygChurch = tygVillage?.houses.find(h => h.id === 'tyg-landmark-church');

	// မြို့သာ ကျောင်းတိုက်
	const monastery = ward.monastery;

	// ရွာများနှင့် ရပ်ကွက်ရှိ အိမ်များ၏ နွေးထွေးသော ပြတင်းပေါက် မီးရောင်များ (Cozy Village Window Lights)
	const houseWindows = useMemo(() => {
		const allHomes = [
			...ward.houses,
			...kalayVillages.flatMap(v => v.houses.filter(h => !h.id.startsWith('hk-landmark-') && !h.id.startsWith('ki-'))),
		];
		// နမူနာ အိမ်အချို့တွင် မီးလင်းနေစေခြင်း
		return allHomes
			.filter((_, idx) => idx % 3 === 0)
			.slice(0,mobileQuality?80:10000)
			.map(h => {
				const cos = Math.cos(h.rotation);
				const sin = Math.sin(h.rotation);
				return {
					x: h.x + h.width * 0.2 * cos + h.depth * 0.52 * sin,
					z: h.z - h.width * 0.2 * sin + h.depth * 0.52 * cos,
					rot: h.rotation,
				};
			});
	}, []);

	return (
		<group name="night-environment">
			{/* ကြယ်တာရာများနှင့် သာယာသော လမင်းကြီး */}
			<NightStars />
			<NightMoon />

			{/* ရွာအိမ်များ၏ နွေးထွေးသော ပြတင်းပေါက် မီးရောင်များ */}
			{houseWindows.map((w, idx) => (
				<mesh key={`win-${idx}`} position={[w.x, 1.6, w.z]} rotation={[0, w.rot, 0]}>
					<boxGeometry args={[1.2, 0.9, 0.15]} />
					<meshBasicMaterial color={idx % 2 ? '#ffc35b' : '#ffb244'} />
				</mesh>
			))}

			{/* လမ်းမီးတိုင်များ */}
			{streetLamps.map((lamp, i) => (
				<StreetLamp key={`lamp-${i}`} x={lamp.x} z={lamp.z} rot={lamp.rot} />
			))}

			{/* ၁။ မဟာဝေပုလ္လတောင်တော် ရွှေရောင်ညမီးရောင် (Golden Mountaintop Beacon) */}
			{mahaWeipulaPeak && (
				<group position={[mahaWeipulaPeak.x, 905, mahaWeipulaPeak.z]}>
					{!mobileQuality&&<pointLight color="#ffd055" intensity={3.5} distance={180} decay={1.8} />}
					<mesh position={[0, 4, 0]}>
						<sphereGeometry args={[5, 8, 8]} />
						<meshBasicMaterial color="#ffe880" />
					</mesh>
				</group>
			)}

			{/* ၂။ ထောက်ကြန့် စေတီတော်မြတ်ကြီးများ ရွှေရောင်မီးရောင် (Golden Pagoda Illumination) */}
			{hkPagoda && (
				<group position={[hkPagoda.x, 14, hkPagoda.z]}>
					{!mobileQuality&&<pointLight color="#ffba3b" intensity={3} distance={85} decay={2} />}
					<mesh position={[0, 10, 0]}>
						<sphereGeometry args={[2.5, 8, 8]} />
						<meshBasicMaterial color="#ffe168" />
					</mesh>
				</group>
			)}
			{hkPagodaSw && (
				<group position={[hkPagodaSw.x, 8, hkPagodaSw.z]}>
					{!mobileQuality&&<pointLight color="#ffba3b" intensity={2} distance={55} decay={2} />}
				</group>
			)}

			{/* ၃။ မြို့သာ ကျောင်းတိုက် စေတီတော်များနှင့် ဓမ္မာရုံမီး */}
			{monastery && (
				<group position={[monastery.x, 6, monastery.z]}>
					{!mobileQuality&&<pointLight color="#ffc85b" intensity={2.5} distance={75} decay={2} />}
					{/* စေတီငယ် ညမီးများ */}
					{monastery.stupas.map((s, idx) => {
						const cos = Math.cos(monastery.rotation);
						const sin = Math.sin(monastery.rotation);
						const wx = monastery.x + s.u * cos + s.v * sin;
						const wz = monastery.z - s.u * sin + s.v * cos;
						return (
							<mesh key={idx} position={[wx - monastery.x, 8, wz - monastery.z]}>
								<sphereGeometry args={[1.2, 6, 6]} />
								<meshBasicMaterial color="#ffdc6b" />
							</mesh>
						);
					})}
				</group>
			)}

			{/* ၄။ ခရစ်ယာန် ဘုရားကျောင်းများ ထိပ်ဖျား လက်ဝါးကပ်တိုင် မီးရောင်များ */}
			{kiBaptist && (
				<group position={[kiBaptist.x, 22, kiBaptist.z]}>
					{!mobileQuality&&<pointLight color="#b6d8ff" intensity={2.2} distance={60} decay={2} />}
					<mesh position={[0, 0.5, 0]}>
						<boxGeometry args={[0.5, 2.8, 0.5]} />
						<meshBasicMaterial color="#ffffff" />
					</mesh>
					<mesh position={[0, 0.9, 0]}>
						<boxGeometry args={[1.8, 0.5, 0.5]} />
						<meshBasicMaterial color="#ffffff" />
					</mesh>
				</group>
			)}
			{kiIbc && (
				<group position={[kiIbc.x, 20, kiIbc.z]}>
					{!mobileQuality&&<pointLight color="#ffd88a" intensity={1.8} distance={50} decay={2} />}
					<mesh position={[0, 0.5, 0]}>
						<boxGeometry args={[0.5, 2.5, 0.5]} />
						<meshBasicMaterial color="#fff3cc" />
					</mesh>
				</group>
			)}
			{kiStPeter && (
				<group position={[kiStPeter.x, 25, kiStPeter.z]}>
					{!mobileQuality&&<pointLight color="#ffe8aa" intensity={2.5} distance={65} decay={2} />}
					<mesh position={[0, 0.8, 0]}>
						<boxGeometry args={[0.6, 3.2, 0.6]} />
						<meshBasicMaterial color="#ffffff" />
					</mesh>
					<mesh position={[0, 1.4, 0]}>
						<boxGeometry args={[2.2, 0.6, 0.6]} />
						<meshBasicMaterial color="#ffffff" />
					</mesh>
				</group>
			)}
			{tygChurch && (
				<group position={[tygChurch.x, 22, tygChurch.z]}>
					{!mobileQuality&&<pointLight color="#e2eeff" intensity={2.2} distance={60} decay={2} />}
					<mesh position={[0, 0.6, 0]}>
						<boxGeometry args={[0.5, 2.8, 0.5]} />
						<meshBasicMaterial color="#ffffff" />
					</mesh>
				</group>
			)}

			{/* ၅။ ကြာအင်းရေကန် ရေပေါ်နားနေဆောင် ညဘက် နွေးထွေးသော မီးရောင် (Water Pavilion Glow) */}
			{kiPavilion && (
				<group position={[kiPavilion.x, 3.5, kiPavilion.z]}>
					{!mobileQuality&&<pointLight color="#ffa834" intensity={3} distance={50} decay={2} />}
					{/* နားနေဆောင် အတွင်း မီးလုံး */}
					<mesh position={[0, 0, 0]}>
						<sphereGeometry args={[1.2, 8, 8]} />
						<meshBasicMaterial color="#ffc46a" />
					</mesh>
					{/* ကူးတံတားဘေး မီးအိမ်ငယ်များ */}
					{[-3, 3].map(dz => (
						<mesh key={dz} position={[0, -1.2, dz]}>
							<sphereGeometry args={[0.4, 6, 6]} />
							<meshBasicMaterial color="#ffbe52" />
						</mesh>
					))}
				</group>
			)}
		</group>
	);
}
