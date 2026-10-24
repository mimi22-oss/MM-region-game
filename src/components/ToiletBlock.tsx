import { angle } from '../data/ward';
import { Box } from './Primitives';

/**
 * ၂ ခန်းတွဲ အိမ်သာ (Two-room Toilet Block):
 * - တည်နေရာ (Location): Scene X=130.464, Z=277.362 (Local U=-103.873, V=288.376)
 * - မျက်နှာမူ (Facing): North (Local +Z faces directly North towards orchard/farmhouse)
 * - အမိုးပေါ် ကွန်ကရစ်ရေကန် ၂ ကန်တွဲ (Two overhead reinforced concrete water tanks on roof)
 * - ဘယ်ဘက်ခြမ်း (Room 1 - West/Left): ရိုးရိုးအိမ်သာ (Traditional Squat Toilet with squat pan, water tub, faucet, plastic scoop)
 * - ညာဘက်ခြမ်း (Room 2 - East/Right): ဗိုလ်ထိုင်အိမ်သာ (Western Sitting Toilet with commode, cistern, bidet spray)
 */
export const TOIL_X = 130.464;
export const TOIL_Z = 277.362;
export const TOIL_ROT = angle + Math.PI;

export function ToiletBlock() {
	return (
		<group position={[TOIL_X, 0, TOIL_Z]} rotation={[0, TOIL_ROT, 0]} name="two-room-toilet">
			{/* ၁။ အောက်ခံကွန်ကရစ်ခုံနှင့် အဝင်လှေကားထစ်များ (Concrete Base Plinth & Steps) */}
			<Box position={[0, 0.1, 0]} size={[3.6, 0.2, 2.4]} color="#a39d91" />
			{/* အဝင်လှေကားထစ်ငယ်များ (Entrance Steps at North facing doors) */}
			<Box position={[-0.8, 0.05, 1.3]} size={[1.1, 0.1, 0.35]} color="#948e82" />
			<Box position={[0.8, 0.05, 1.3]} size={[1.1, 0.1, 0.35]} color="#948e82" />

			{/* ၂။ အတွင်းပိုင်း ကြမ်းခင်းကြွေပြားများ (Interior Tiled Floors) */}
			{/* အခန်း ၁ - ကြွေပြား (Room 1 Floor - Squat Toilet) */}
			<Box position={[-0.8, 0.205, 0]} size={[1.4, 0.01, 1.9]} color="#b7cbcf" />
			{/* အခန်း ၂ - ကြွေပြား (Room 2 Floor - Western Toilet) */}
			<Box position={[0.8, 0.205, 0]} size={[1.4, 0.01, 1.9]} color="#c2d5db" />

			{/* ၃။ အပြင်နံရံများနှင့် အလယ်အကန့်နံရံ (Exterior & Partition Walls, Height 2.4m) */}
			{/* နောက်ဘက်နံရံ (Back Wall at lz=-1.0) */}
			<Box position={[0, 1.3, -1.0]} size={[3.4, 2.2, 0.2]} color="#dfd8cb" />
			{/* ဘယ်ဘက်နံရံ (Left Outer Wall at lx=-1.6) */}
			<Box position={[-1.6, 1.3, 0]} size={[0.2, 2.2, 2.2]} color="#dfd8cb" />
			{/* ညာဘက်နံရံ (Right Outer Wall at lx=+1.6) */}
			<Box position={[1.6, 1.3, 0]} size={[0.2, 2.2, 2.2]} color="#dfd8cb" />
			{/* အလယ်အကန့်နံရံ (Center Dividing Wall at lx=0) */}
			<Box position={[0, 1.3, 0]} size={[0.2, 2.2, 2.0]} color="#d6cfc2" />

			{/* အောက်ခြေနံရံအနားကွပ် (Base Skirting around outer perimeter) */}
			<Box position={[0, 0.3, -1.05]} size={[3.46, 0.2, 0.12]} color="#8c8477" />
			<Box position={[-1.65, 0.3, 0]} size={[0.12, 0.2, 2.24]} color="#8c8477" />
			<Box position={[1.65, 0.3, 0]} size={[0.12, 0.2, 2.24]} color="#8c8477" />

			{/* အရှေ့ဘက်မျက်နှာစာနံရံ (Front Wall facing North at lz=+1.0 with 2 doorways) */}
			{/* ဘယ်ဘက်တိုင် (Left Front Jamb: lx=-1.7 to -1.35) */}
			<Box position={[-1.525, 1.3, 1.0]} size={[0.35, 2.2, 0.2]} color="#dfd8cb" />
			{/* အလယ်တိုင် (Center Front Jamb: lx=-0.25 to +0.25) */}
			<Box position={[0, 1.3, 1.0]} size={[0.5, 2.2, 0.2]} color="#dfd8cb" />
			{/* ညာဘက်တိုင် (Right Front Jamb: lx=1.35 to 1.7) */}
			<Box position={[1.525, 1.3, 1.0]} size={[0.35, 2.2, 0.2]} color="#dfd8cb" />
			{/* အပေါ်ထုပ်တန်းများ (Lintels above doors: y=2.1 to 2.4) */}
			<Box position={[-0.8, 2.25, 1.0]} size={[1.1, 0.3, 0.2]} color="#dfd8cb" />
			<Box position={[0.8, 2.25, 1.0]} size={[1.1, 0.3, 0.2]} color="#dfd8cb" />

			{/* အခန်းအမှတ်အသားဆိုင်းဘုတ်ငယ်များ (Door Label Plates) */}
			{/* ဘယ်ဘက်တံခါး - ၁ · ရိုးရိုး (Room 1 - Squat) */}
			<Box position={[-0.8, 2.25, 1.11]} size={[0.5, 0.12, 0.02]} color="#386b4a" />
			{/* ညာဘက်တံခါး - ၂ · ဗိုလ်ထိုင် (Room 2 - Western) */}
			<Box position={[0.8, 2.25, 1.11]} size={[0.5, 0.12, 0.02]} color="#2d526e" />

			{/* တံခါးများ (Doors - slightly ajar for open walk-in & visual inspection) */}
			{/* အခန်း ၁ တံခါး (Room 1 Door hinged at lx=-1.35) */}
			<group position={[-1.35, 0.2, 1.0]} rotation={[0, Math.PI / 2, 0]}>
				<Box position={[0.38, 0.95, 0.02]} size={[0.76, 1.9, 0.04]} color="#a17549" />
				<Box position={[0.7, 0.95, 0.06]} size={[0.04, 0.08, 0.06]} color="#e3c27f" />
			</group>
			{/* အခန်း ၂ တံခါး (Room 2 Door hinged at lx=0.25) */}
			<group position={[0.25, 0.2, 1.0]} rotation={[0, Math.PI / 2, 0]}>
				<Box position={[0.38, 0.95, 0.02]} size={[0.76, 1.9, 0.04]} color="#a17549" />
				<Box position={[0.7, 0.95, 0.06]} size={[0.04, 0.08, 0.06]} color="#e3c27f" />
			</group>

			{/* အနောက်ဘက် အလင်းပေါက်/လေဝင်လေထွက် ပြတင်းပေါက်ငယ်များ (Rear Wall Ventilation Louvers) */}
			{[-0.8, 0.8].map((x) => (
				<group key={x} position={[x, 2.05, -1.0]}>
					<Box position={[0, 0, 0]} size={[0.55, 0.35, 0.24]} color="#2c3639" />
					<Box position={[0, 0.08, 0.1]} size={[0.5, 0.04, 0.06]} color="#829499" />
					<Box position={[0, 0, 0.1]} size={[0.5, 0.04, 0.06]} color="#829499" />
					<Box position={[0, -0.08, 0.1]} size={[0.5, 0.04, 0.06]} color="#829499" />
				</group>
			))}

			{/* ၄။ ကွန်ကရစ် အမိုးပြားနှင့် အမိုးဘောင် (Reinforced Flat Concrete Roof & Parapet) */}
			<Box position={[0, 2.45, 0]} size={[3.6, 0.15, 2.4]} color="#cac4b6" />
			{/* အမိုးအနားကွပ် (Roof Parapet rim) */}
			<Box position={[0, 2.58, -1.15]} size={[3.6, 0.12, 0.1]} color="#b8b1a3" />
			<Box position={[0, 2.58, 1.15]} size={[3.6, 0.12, 0.1]} color="#b8b1a3" />
			<Box position={[-1.75, 2.58, 0]} size={[0.1, 0.12, 2.4]} color="#b8b1a3" />
			<Box position={[1.75, 2.58, 0]} size={[0.1, 0.12, 2.4]} color="#b8b1a3" />

			{/* ======================================================== */}
			{/* ၅။ အမိုးပေါ် ကွန်ကရစ်ရေကန် ၂ ကန်တွဲ (Two Overhead Concrete Water Tanks on Roof) */}
			{/* ======================================================== */}
			{/* ကွန်ကရစ် ရေကန် ၁ (Concrete Tank 1 over Room 1 at lx=-0.75) */}
			<group position={[-0.75, 2.525, 0]} name="concrete-water-tank-1">
				{/* အောက်ခံ ကွန်ကရစ်ခုံ (Base Plinth Support) */}
				<Box position={[0, 0.06, 0]} size={[1.12, 0.12, 1.12]} color="#7c766b" />
				{/* အဓိက ကွန်ကရစ် ရေကန်ကိုယ်ထည် (Main Concrete Water Tank Body) */}
				<Box position={[0, 0.58, 0]} size={[1.04, 0.92, 1.04]} color="#aba396" />
				{/* ကွန်ကရစ် အလယ်အနားလိုင်း (Middle Decorative Plaster Band) */}
				<Box position={[0, 0.58, 0]} size={[1.08, 0.06, 1.08]} color="#8f887b" />
				{/* အပေါ် ကွန်ကရစ် အမိုးအနားကွပ် (Top Concrete Coping Slab) */}
				<Box position={[0, 1.08, 0]} size={[1.12, 0.08, 1.12]} color="#c2bcb0" />
				{/* စစ်ဆေးကြည့်ရှုပေါက် ကွန်ကရစ်အဖုံး (Top Inspection Manhole Cover with handle) */}
				<Box position={[0, 1.14, 0]} size={[0.46, 0.04, 0.46]} color="#746e63" />
				<Box position={[0, 1.17, 0]} size={[0.14, 0.02, 0.04]} color="#48443d" />
			</group>

			{/* ကွန်ကရစ် ရေကန် ၂ (Concrete Tank 2 over Room 2 at lx=+0.75) */}
			<group position={[0.75, 2.525, 0]} name="concrete-water-tank-2">
				{/* အောက်ခံ ကွန်ကရစ်ခုံ (Base Plinth Support) */}
				<Box position={[0, 0.06, 0]} size={[1.12, 0.12, 1.12]} color="#7c766b" />
				{/* အဓိက ကွန်ကရစ် ရေကန်ကိုယ်ထည် (Main Concrete Water Tank Body) */}
				<Box position={[0, 0.58, 0]} size={[1.04, 0.92, 1.04]} color="#aba396" />
				{/* ကွန်ကရစ် အလယ်အနားလိုင်း (Middle Decorative Plaster Band) */}
				<Box position={[0, 0.58, 0]} size={[1.08, 0.06, 1.08]} color="#8f887b" />
				{/* အပေါ် ကွန်ကရစ် အမိုးအနားကွပ် (Top Concrete Coping Slab) */}
				<Box position={[0, 1.08, 0]} size={[1.12, 0.08, 1.12]} color="#c2bcb0" />
				{/* စစ်ဆေးကြည့်ရှုပေါက် ကွန်ကရစ်အဖုံး (Top Inspection Manhole Cover with handle) */}
				<Box position={[0, 1.14, 0]} size={[0.46, 0.04, 0.46]} color="#746e63" />
				<Box position={[0, 1.17, 0]} size={[0.14, 0.02, 0.04]} color="#48443d" />
			</group>

			{/* ကွန်ကရစ် ရေကန် ၂ ကန်ကြား ဆက်သွယ်ပေးသော ရေပိုက်လိုင်းများ (Galvanized & PVC Water Supply Pipes) */}
			{/* ရေကန် ၂ ကန်ကြား ဆက်သွယ်ပိုက် (Interconnecting Bridge Pipe between concrete tanks) */}
			<Box position={[0, 2.75, 0]} size={[0.5, 0.05, 0.05]} color="#505b63" />
			{/* အလယ် ဘုံဘိုင်ဖွင့်ပိတ်ဗား (Central Equalizer Valve Wheel) */}
			<Box position={[0, 2.75, 0.04]} size={[0.04, 0.09, 0.04]} color="#b45309" />

			{/* ရေကန် ၁ အောက်ဆင်းပိုက် (Down-pipe into Room 1 Water Tub) */}
			<Box position={[-1.25, 1.9, -0.85]} size={[0.045, 1.2, 0.045]} color="#505b63" />
			{/* ရေကန် ၂ အောက်ဆင်းပိုက် (Down-pipe into Room 2 Western Cistern) */}
			<Box position={[0.6, 1.9, -0.85]} size={[0.045, 1.2, 0.045]} color="#505b63" />
			{/* ဘေးဘက် ရေလျှံထွက်ပိုက်ငယ်များ (Overflow Spouts on Tank Sides) */}
			<Box position={[-1.34, 3.45, 0]} size={[0.14, 0.03, 0.03]} color="#505b63" />
			<Box position={[1.34, 3.45, 0]} size={[0.14, 0.03, 0.03]} color="#505b63" />

			{/* ======================================================== */}
			{/* ၆။ ဘယ်ဘက်ခြမ်း (Room 1) - ရိုးရိုးအိမ်သာ (Traditional Squat Toilet) */}
			{/* ======================================================== */}
			<group position={[-0.8, 0.2, 0]} name="room-1-squat">
				{/* ကြွေရိုးရိုးအိမ်သာခွက် (Traditional Ceramic Squat Pan in Floor center at lz=-0.15) */}
				<group position={[0.1, 0.015, -0.15]}>
					{/* အိမ်သာခွက် နှုတ်ခမ်းဘောင် (Squat Pan Rim) */}
					<Box position={[0, 0.01, 0]} size={[0.44, 0.03, 0.6]} color="#ffffff" />
					{/* အလယ် အညစ်အကြေးဆင်းပေါက် (Drain Bowl depression) */}
					<Box position={[0, 0.015, 0.06]} size={[0.16, 0.03, 0.32]} color="#475569" />
					{/* ဘယ်ဘက် ခြေနင်းခုံး (Left Foot Tread Pad) */}
					<Box position={[-0.14, 0.03, 0]} size={[0.11, 0.02, 0.42]} color="#e2e8f0" />
					{[-0.12, -0.04, 0.04, 0.12].map((zTread) => (
						<Box key={zTread} position={[-0.14, 0.042, zTread]} size={[0.09, 0.008, 0.02]} color="#94a3b8" />
					))}
					{/* ညာဘက် ခြေနင်းခုံး (Right Foot Tread Pad) */}
					<Box position={[0.14, 0.03, 0]} size={[0.11, 0.02, 0.42]} color="#e2e8f0" />
					{[-0.12, -0.04, 0.04, 0.12].map((zTread) => (
						<Box key={zTread} position={[0.14, 0.042, zTread]} size={[0.09, 0.008, 0.02]} color="#94a3b8" />
					))}
				</group>

				{/* ထောင့်စွန်း ရေကန်ငယ် (Corner Masonry Tiled Water Tub in outer left corner: lx=-0.45, lz=-0.6) */}
				<group position={[-0.45, 0, -0.6]} name="water-tub">
					{/* ကြွေပြားကပ် ရေကန်ကိုယ်ထည် (Tiled Tub Outer Shell) */}
					<Box position={[0, 0.325, 0]} size={[0.55, 0.65, 0.55]} color="#4d7f8c" />
					{/* ရေမျက်နှာပြင် (Clear Water Surface inside Tub) */}
					<Box position={[0, 0.6, 0]} size={[0.47, 0.01, 0.47]} color="#64b5c7" />

					{/* ရေပိုက်ခေါင်း (Water Tap / Faucet over the tub from overhead pipe) */}
					<group position={[0, 0.75, -0.2]}>
						<Box position={[0, 0, 0.08]} size={[0.03, 0.03, 0.16]} color="#cbd5e1" />
						<Box position={[0, -0.03, 0.14]} size={[0.025, 0.06, 0.025]} color="#cbd5e1" />
						{/* ဘုံဘိုင်ဖွင့်ပိတ်ခလုတ် (Tap Valve Handle) */}
						<Box position={[0, 0.03, 0.08]} size={[0.06, 0.02, 0.02]} color="#3b82f6" />
					</group>

					{/* ပလတ်စတစ် ရေခွက်/ဖလား (Traditional Plastic Water Dipper / Scoop resting on rim) */}
					<group position={[0.15, 0.66, 0.12]} rotation={[0, 0.3, 0]}>
						{/* ဖလားခွက် (Scoop Bowl) */}
						<mesh position={[0, 0.05, 0]}>
							<cylinderGeometry args={[0.07, 0.05, 0.1, 14]} />
							<meshStandardMaterial color="#dc2626" roughness={0.4} />
						</mesh>
						{/* ဖလားလက်ကိုင်ရိုး (Scoop Handle) */}
						<Box position={[-0.1, 0.08, 0]} size={[0.14, 0.02, 0.02]} color="#b91c1c" />
					</group>
				</group>

				{/* ရေဆင်းကြမ်းခင်းပေါက် (Floor Drain Grate) */}
				<mesh position={[0.45, 0.01, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
					<circleGeometry args={[0.06, 12]} />
					<meshStandardMaterial color="#475569" roughness={0.5} />
				</mesh>

				{/* မျက်နှာကျက် မီးသီး (Ceiling Lamp) */}
				<mesh position={[0, 2.15, 0]}>
					<sphereGeometry args={[0.07, 12, 12]} />
					<meshStandardMaterial color="#fffde6" emissive="#ffeaa7" emissiveIntensity={0.6} />
				</mesh>
			</group>

			{/* ======================================================== */}
			{/* ၇။ ညာဘက်ခြမ်း (Room 2) - ဗိုလ်ထိုင်အိမ်သာ (Western Sitting Toilet) */}
			{/* ======================================================== */}
			<group position={[0.8, 0.2, 0]} name="room-2-western">
				{/* ကမုတ်ခွက်အောက်ခံနှင့် ခွက် (Commode Base & Bowl at lz=-0.6) */}
				<mesh position={[0, 0.2, -0.6]} castShadow>
					<cylinderGeometry args={[0.16, 0.18, 0.4, 16]} />
					<meshStandardMaterial color="#f0f4f8" roughness={0.3} />
				</mesh>
				{/* အထိုင်ခွက် ထိပ်ပိုင်း (Commode Bowl Rim) */}
				<mesh position={[0, 0.42, -0.58]} castShadow>
					<boxGeometry args={[0.38, 0.08, 0.5]} />
					<meshStandardMaterial color="#ffffff" roughness={0.25} />
				</mesh>
				{/* အထိုင်ပြား (Seat Ring & Lid) */}
				<Box position={[0, 0.47, -0.58]} size={[0.4, 0.03, 0.48]} color="#f4f7f9" />

				{/* ရေဆွဲပုံး ဖလက်ရှ်တိုင်ကီ (Flush Cistern Tank behind Commode) */}
				<Box position={[0, 0.8, -0.82]} size={[0.42, 0.38, 0.2]} color="#ffffff" />
				{/* ရေဆွဲခလုတ် (Chrome Flush Push Button on Cistern) */}
				<Box position={[0, 1.0, -0.82]} size={[0.08, 0.02, 0.08]} color="#d8e1e6" />

				{/* ရေပန်းခေါင်းနှင့် ပိုက် (Bidet Sprayer hung on left dividing wall) */}
				<group position={[-0.65, 0.65, -0.5]}>
					<Box position={[0.04, 0, 0]} size={[0.06, 0.1, 0.04]} color="#7c878c" />
					<Box position={[0.04, -0.06, 0]} size={[0.03, 0.08, 0.03]} color="#cbd5e1" />
					{/* ရေပိုက်ခွေ (Flexible Hose) */}
					<Box position={[0.04, -0.18, 0]} size={[0.025, 0.18, 0.025]} color="#94a3b8" />
				</group>

				{/* အိမ်သာသုံးစက္ကူ လိပ်ထည့်ခုံ (Toilet Paper Roll on right wall) */}
				<group position={[0.65, 0.75, -0.5]}>
					<Box position={[-0.04, 0, 0]} size={[0.06, 0.08, 0.04]} color="#64748b" />
					<mesh position={[-0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
						<meshStandardMaterial color="#ffffff" roughness={0.8} />
					</mesh>
				</group>

				{/* မျက်နှာကျက် မီးသီး (Ceiling Lamp) */}
				<mesh position={[0, 2.15, 0]}>
					<sphereGeometry args={[0.07, 12, 12]} />
					<meshStandardMaterial color="#fffde6" emissive="#ffeaa7" emissiveIntensity={0.6} />
				</mesh>
			</group>
		</group>
	);
}
