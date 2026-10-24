import { FarmEstate } from './FarmEstate';
import { HomeGate, HomeDirections } from './HomeGate';
import { farmhouse } from '../data/ward';
import { houseVisualRotation, FrontLotFence, WireMeshSegment } from './House';
import { Gardens } from './Landmarks';
import { Box } from './Primitives';
import { DoubleSide } from 'three';

/**
 * Character's walk-in Farmhouse (စိုက်ခင်းအိမ်):
 * - Main House expanded to width=12m (lx=-6..+6), depth=10m (lz=-5..+5)
 * - House-sized Kitchen Lean-to Annex ("မီးဖိုဆောင် အဖီ") on the LEFT side:
 *   Width=9m (lx=6..15), Depth=8m (lz=-4..+4) — a full house-sized culinary banquet building!
 * - Wire Mesh Compound Fence ("သံဇကာ ခြံစည်းရိုး") placed at lx=18.0 (3 full meters clear of the kitchen annex outer wall!)
 * - 4 requested interior furnishings: TV, Table, Bed, Computer + full kitchen appliances
 */
export function FarmhouseBuilding() {
	const h = farmhouse;
	const rot = houseVisualRotation(h);

	// Expanded dimensions:
	const houseW = 12.0;
	const houseD = 10.0;
	const halfW = houseW / 2; // 6.0
	const halfD = houseD / 2; // 5.0

	return (
		<group position={[h.x, 0, h.z]} rotation={[0, rot, 0]} name="character-farmhouse">
			{/* ======================================================== */}
			{/* ၀။ ခြံစည်းရိုး သံဇကာများနှင့် ခြံဝင်း (Compound Fences) */}
			{/* မီးဖိုဆောင် အဖီသည် lx=15.0 တွင်ရှိပြီး ဘယ်ဘက်သံဇကာကို lx=18.0 တွင်ထားရှိ၍ လွတ်အောင် ပြုလုပ်ထားပါသည် */}
			{/* ======================================================== */}
			<group name="farmhouse-compound-fence">
				{/* ဘယ်ဘက် သံဇကာ ခြံစည်းရိုး (Left Wire Mesh Fence at lx=18.0, 3m clear of kitchen annex) */}
				<group position={[18.0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
					<WireMeshSegment length={15.0} />
				</group>

				{/* ညာဘက် သံဇကာ ခြံစည်းရိုး (Right Wire Mesh Fence at lx=-9.0, 3m clear of main house) */}
				<group position={[-9.0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
					<WireMeshSegment length={15.0} />
				</group>

				{/* နောက်ဘက် သံဇကာ ခြံစည်းရိုး (Rear Wire Mesh Fence at lz=-7.5, spans lx=-9 to 18) */}
				<group position={[4.5, 0, -7.5]}>
					<WireMeshSegment length={27.0} />
				</group>

				{/* အရှေ့ဘက် ခြံစည်းရိုး သွပ်ပြားနှင့် အဝင်ဂိတ်ပေါက် (Front Fence at lz=7.5 with 3.4m open gate) */}
				<group position={[0, 0, 7.5]}>
					{/* ညာဘက် သွပ်ပြားခြံစည်းရိုး (Right Front Sheet Section from x=-9.0 to -1.7) */}
					<mesh position={[-5.35, 0.915, 0]} castShadow receiveShadow>
						<boxGeometry args={[7.3, 1.83, 0.06]} />
						<meshStandardMaterial color="#2563a6" metalness={0.35} roughness={0.45} />
					</mesh>
					<Box position={[-5.35, 1.84, 0]} size={[7.34, 0.05, 0.1]} color="#1d4e89" />

					{/* ဘယ်ဘက် သွပ်ပြားခြံစည်းရိုး (Left Front Sheet Section from x=1.7 to 18.0) */}
					<mesh position={[9.85, 0.915, 0]} castShadow receiveShadow>
						<boxGeometry args={[16.3, 1.83, 0.06]} />
						<meshStandardMaterial color="#2563a6" metalness={0.35} roughness={0.45} />
					</mesh>
					<Box position={[9.85, 1.84, 0]} size={[16.34, 0.05, 0.1]} color="#1d4e89" />

					{/* ဂိတ်တိုင် ၂ တိုင်နှင့် ဟင်းလင်းပွင့်နေသော ဂိတ်တံခါးရွက်များ (Open Gate Posts & Leaves) */}
					<HomeGate id="yard" width={3.4}/>
					{[-1.7, 1.7].map((gx, idx) => (
						<group key={gx} position={[gx, 0, 0]}>
							<Box position={[0, 0.98, 0]} size={[0.18, 1.96, 0.18]} color="#485457" />
							<Box position={[0, 1.98, 0]} size={[0.24, 0.06, 0.24]} color="#1d4e89" />
							{/* ပွင့်နေသော ဂိတ်တံခါးရွက် (Open gate leaf swung inward) */}

						</group>
					))}
				</group>
			</group>

			{/* ======================================================== */}
			{/* ၁။ အောက်ခြေဖောင်ဒေးရှင်းနှင့် ကြမ်းခင်း (Foundation & Floors) */}
			{/* ======================================================== */}
			{/* အောက်ခြေ ကွန်ကရစ်ဖောင်ဒေးရှင်း (Concrete Base for 12m x 10m house) */}
			<mesh position={[0, 0.08, 0]}>
				<boxGeometry args={[houseW + 0.4, 0.16, houseD + 0.4]} />
				<meshStandardMaterial color="#aaa18d" roughness={0.9} />
			</mesh>

			{/* အိမ်အတွင်း ကျွန်းပျဉ်ခင်းကြမ်းပြင် (Polished Teak Wooden Floor) */}
			<mesh position={[0, 0.165, 0]}>
				<boxGeometry args={[houseW - 0.4, 0.03, houseD - 0.4]} />
				<meshStandardMaterial color="#966a42" roughness={0.45} />
			</mesh>

			{/* ဧည့်ခန်း ပန်းရောင်ကော်ဇောကြီး (Living Room Cozy Rug at lx=2.6, lz=-2.8) */}
			<mesh position={[2.6, 0.182, -2.8]}>
				<boxGeometry args={[3.2, 0.005, 2.4]} />
				<meshStandardMaterial color="#b3493b" roughness={0.8} />
			</mesh>

			{/* အိပ်ခန်း အခင်းကော်ဇော (Bedroom Rug at lx=-3.8, lz=-2.5) */}
			<mesh position={[-3.8, 0.182, -2.5]}>
				<boxGeometry args={[2.8, 0.005, 2.8]} />
				<meshStandardMaterial color="#305470" roughness={0.8} />
			</mesh>

			{/* ======================================================== */}
			{/* ၂။ မိန်းလမ်းဘက် မျက်နှာမူသော အိမ်ရှေ့ဝရန်တာနှင့် အဝင်တံခါး */}
			{/* (Front Entrance Verandah & Doorway at lz=+5.0) */}
			{/* ======================================================== */}
			{/* ဝရန်တာကြမ်းပြင် (Front Verandah Platform at lx=0, lz=5.9) */}
			<mesh position={[0, 0.14, 5.9]}>
				<boxGeometry args={[3.6, 0.18, 1.8]} />
				<meshStandardMaterial color="#947452" roughness={0.5} />
			</mesh>
			{/* အဝင်လှေကားထစ်များ (Entrance Steps down to front yard) */}
			<mesh position={[0, 0.07, 7.0]}>
				<boxGeometry args={[3.0, 0.10, 0.6]} />
				<meshStandardMaterial color="#aaa18d" roughness={0.7} />
			</mesh>
			{/* ဝရန်တာတိုင်များ (Front Porch Support Pillars) */}
			{[-1.6, 1.6].map((x) => (
				<mesh key={x} position={[x, 1.6, 6.6]}>
					<boxGeometry args={[0.18, 2.9, 0.18]} />
					<meshStandardMaterial color="#71523c" roughness={0.6} />
				</mesh>
			))}
			{/* ဝရန်တာ အမိုးငယ် (Front Porch Awning Roof) */}
			<mesh position={[0, 3.25, 6.0]} rotation={[0.15, 0, 0]}>
				<boxGeometry args={[3.8, 0.12, 2.2]} />
				<meshStandardMaterial color="#849699" roughness={0.8} />
			</mesh>

			{/* အဝင်တံခါးဘောင် (Front Door Frame at lx=0, lz=5.0) */}
            {[-1.28,1.28].map(x=><Box key={x} position={[x,1.35,5]} size={[.16,2.5,.26]} color="#573f30"/>)}
            <Box position={[0,2.65,5]} size={[2.72,.16,.26]} color="#573f30"/>

			{/* အဝင်ကြိုဆို ကြမ်းသုတ်ဖျာ (Welcome Door Mat) */}
			<mesh position={[0, 0.185, 4.6]}>
				<boxGeometry args={[1.4, 0.005, 0.7]} />
				<meshStandardMaterial color="#2d523e" roughness={0.8} />
			</mesh>
			{/* ဟင်းလင်းပွင့်နေသော တံခါးရွက် ၂ ချပ် (Open Double Doors swung inward) */}
            <group position={[0,0,5]}><HomeGate id="door" width={2.4} height={2.4} color="#7a5438"/></group>
            <HomeDirections/>


			{/* ======================================================== */}
			{/* ၃။ ချဲ့ထွင်ထားသော အိမ်မကြီး အပြင်နံရံများ (Main House Outer Walls) */}
			{/* ======================================================== */}
			{/* အရှေ့ဘက်နံရံ - တံခါးဘယ်ဘက်ပိုင်း (Front Wall Left Section: lx=1.2..6.0) */}
			<mesh position={[3.6, 1.7, 5.0]}>
				<boxGeometry args={[4.8, 3.0, 0.24]} />
				<meshStandardMaterial color="#d6cbb6" roughness={0.65} />
			</mesh>
			{/* အရှေ့ဘက်နံရံ - တံခါးညာဘက်ပိုင်း (Front Wall Right Section: lx=-6.0..-1.2) */}
			<mesh position={[-3.6, 1.7, 5.0]}>
				<boxGeometry args={[4.8, 3.0, 0.24]} />
				<meshStandardMaterial color="#d6cbb6" roughness={0.65} />
			</mesh>
			{/* အရှေ့တံခါး အပေါ်ယက်မနံရံ (Front Door Lintel at lz=5.0) */}
			<mesh position={[0, 2.8, 5.0]}>
				<boxGeometry args={[2.5, 0.8, 0.24]} />
				<meshStandardMaterial color="#d6cbb6" roughness={0.65} />
			</mesh>

			{/* နောက်ဘက်နံရံ (Back Wall at lz=-5.0, spans lx=-6.0..+6.0) */}
			<mesh position={[0, 1.7, -5.0]}>
				<boxGeometry args={[houseW, 3.0, 0.24]} />
				<meshStandardMaterial color="#d6cbb6" roughness={0.65} />
			</mesh>
			{/* နောက်ဘက် ပြတင်းပေါက် ၂ ခု (Back Windows) */}
			{[-3.5, 3.5].map((x) => (
				<group key={x} position={[x, 1.75, -5.0]}>
					<mesh>
						<boxGeometry args={[1.8, 1.4, 0.28]} />
						<meshStandardMaterial color="#2d4957" roughness={0.3} transparent opacity={0.65} />
					</mesh>
					<mesh>
						<boxGeometry args={[1.9, 1.5, 0.08]} />
						<meshStandardMaterial color="#573f30" roughness={0.6} />
					</mesh>
				</group>
			))}

			{/* ညာဘက်နံရံ (Right Outer Wall at lx=-6.0, spans lz=-5.0..+5.0) */}
			<mesh position={[-halfW, 1.7, 0]}>
				<boxGeometry args={[0.24, 3.0, houseD]} />
				<meshStandardMaterial color="#d6cbb6" roughness={0.65} />
			</mesh>
			{/* ညာဘက် အိပ်ခန်း/စာကြည့်ခန်း ပြတင်းပေါက် ၂ ခု (Right Windows) */}
			{[-2.5, 2.5].map((z) => (
				<group key={z} position={[-halfW, 1.75, z]}>
					<mesh>
						<boxGeometry args={[0.28, 1.4, 1.8]} />
						<meshStandardMaterial color="#2d4957" roughness={0.3} transparent opacity={0.65} />
					</mesh>
					<mesh>
						<boxGeometry args={[0.08, 1.5, 1.9]} />
						<meshStandardMaterial color="#573f30" roughness={0.6} />
					</mesh>
				</group>
			))}

			{/* ဘယ်ဘက်နံရံ - မီးဖိုဆောင်ကူးပေါက်မှလွဲ၍ ကျန်အပိုင်းများ (Left Wall at lx=+6.0) */}
			{/* ဘယ်ဘက်နံရံ နောက်ပိုင်း (Left Wall Back Section: lz=-5.0..-1.2) */}
			<mesh position={[halfW, 1.7, -3.1]}>
				<boxGeometry args={[0.24, 3.0, 3.8]} />
				<meshStandardMaterial color="#d6cbb6" roughness={0.65} />
			</mesh>
			{/* ဘယ်ဘက်နံရံ ရှေ့ပိုင်း (Left Wall Front Section: lz=1.8..5.0) */}
			<mesh position={[halfW, 1.7, 3.4]}>
				<boxGeometry args={[0.24, 3.0, 3.2]} />
				<meshStandardMaterial color="#d6cbb6" roughness={0.65} />
			</mesh>
			{/* မီးဖိုဆောင်ကူး မုခ်ဦးအပေါ်ယက်မ (Archway Lintel at lx=6.0, lz=0.3, width 3.0m) */}
			<mesh position={[halfW, 2.75, 0.3]}>
				<boxGeometry args={[0.24, 0.9, 3.0]} />
				<meshStandardMaterial color="#d6cbb6" roughness={0.65} />
			</mesh>

			{/* ======================================================== */}
			{/* ၄။ အိမ်တလုံးစာ အကျယ်ရှိသော ဘယ်ဘက် မီးဖိုဆောင် အဖီကြီး */}
			{/* (GRAND HOUSE-SIZED KITCHEN LEAN-TO ANNEX: lx=6.0..15.0, lz=-4.0..+4.0) */}
			{/* Width = 9.0m, Depth = 8.0m (အိမ်တလုံးစာ အပြည့်အကျယ်) */}
			{/* ======================================================== */}
			<group name="grand-kitchen-annex-left">
				{/* မီးဖိုဆောင် ကြမ်းခင်း (Kitchen Floor: lx=6.0..15.0, lz=-4.0..+4.0) */}
				<mesh position={[10.5, 0.16, 0]}>
					<boxGeometry args={[9.0, 0.03, 8.0]} />
					<meshStandardMaterial color="#7a8b90" roughness={0.7} />
				</mesh>

				{/* မီးဖိုဆောင် အဖီမိုးကြီး (Grand Sloping Corrugated Lean-To Roof) */}
				{/* lx=6.0 (y=3.3m) မှ ဘယ်ဘက် lx=15.2 (y=2.15m) သို့ လျှောဆင်းသောအမိုး */}
				<mesh position={[10.5, 2.75, 0]} rotation={[0, 0, -0.124]}>
					<boxGeometry args={[9.4, 0.14, 8.6]} />
					<meshStandardMaterial color="#7a8c8f" roughness={0.8} side={DoubleSide} />
				</mesh>

				{/* အဖီမိုး ဒိုင်းနှင့် မြှားတန်း ၅ တန်း (5 Rafter Support Beams spanning roof) */}
				{[-3.0, -1.5, 0, 1.5, 3.0].map((z) => (
					<mesh key={z} position={[10.5, 2.68, z]} rotation={[0, 0, -0.124]}>
						<boxGeometry args={[9.3, 0.16, 0.14]} />
						<meshStandardMaterial color="#573f30" roughness={0.7} />
					</mesh>
				))}

				{/* မီးဖိုဆောင် အပြင်ဘက် ဘယ်နံရံ (Kitchen Left Outer Wall at lx=15.0, spans lz=-4..+4) */}
				<mesh position={[15.0, 1.15, 0]}>
					<boxGeometry args={[0.22, 2.2, 8.0]} />
					<meshStandardMaterial color="#d0c4ae" roughness={0.7} />
				</mesh>
				{/* ဘယ်ဘက် ဥယျာဉ်ရှုခင်း ပြတင်းပေါက် ၃ ခု (3 Large Kitchen Windows on Left Wall) */}
				{[-2.2, 0, 2.2].map((z) => (
					<group key={z} position={[15.0, 1.4, z]}>
						<mesh>
							<boxGeometry args={[0.26, 1.0, 1.6]} />
							<meshStandardMaterial color="#2d4957" roughness={0.3} transparent opacity={0.6} />
						</mesh>
						<mesh>
							<boxGeometry args={[0.08, 1.1, 1.7]} />
							<meshStandardMaterial color="#573f30" roughness={0.6} />
						</mesh>
					</group>
				))}

				{/* မီးဖိုဆောင် နောက်ဘက်နံရံ (Kitchen Back Wall at lz=-4.0, spans lx=6.0..15.0) */}
				<mesh position={[10.5, 1.45, -4.0]}>
					<boxGeometry args={[9.0, 2.7, 0.22]} />
					<meshStandardMaterial color="#d0c4ae" roughness={0.7} />
				</mesh>

				{/* မီးဖိုဆောင် အရှေ့ဘက်နံရံနှင့် ဥယျာဉ်ထွက်တံခါး (Kitchen Front Wall at lz=+4.0) */}
				<mesh position={[8.0, 1.45, 4.0]}>
					<boxGeometry args={[4.0, 2.7, 0.22]} />
					<meshStandardMaterial color="#d0c4ae" roughness={0.7} />
				</mesh>
				<mesh position={[13.25, 1.45, 4.0]}>
					<boxGeometry args={[3.5, 2.7, 0.22]} />
					<meshStandardMaterial color="#d0c4ae" roughness={0.7} />
				</mesh>
				{/* ဥယျာဉ်ထွက် တံခါးပေါက်အပေါ်နံရံ (Back Garden Door Lintel at lx=10.75, lz=4.0) */}
				<mesh position={[10.75, 2.35, 4.0]}>
					<boxGeometry args={[1.5, 0.6, 0.22]} />
					<meshStandardMaterial color="#d0c4ae" roughness={0.7} />
				</mesh>

				{/* ---------------------------------------------------- */}
				{/* မီးဖိုဆောင်အတွင်း ပရိဘောဂများနှင့် အသုံးအဆောင်များ */}
				{/* ---------------------------------------------------- */}
				{/* နောက်နံရံကပ် ချက်ပြုတ်ခုံ ကောင်တာကြီး (Grand Cooking Counter along Back Wall: length 7.0m) */}
				<mesh position={[10.5, 0.58, -3.45]}>
					<boxGeometry args={[7.0, 0.82, 0.75]} />
					<meshStandardMaterial color="#4e3524" roughness={0.6} />
				</mesh>
				<mesh position={[10.5, 1.0, -3.45]}>
					<boxGeometry args={[7.1, 0.05, 0.80]} />
					<meshStandardMaterial color="#2a2c30" roughness={0.4} />
				</mesh>

				{/* ဂတ်စ်မီးဖိုခုံ ၄ ပေါက်နှင့် အငွေ့စုပ်ခေါင်းတိုင် (Modern 4-Burner Gas Stove & Range Hood) */}
				<group position={[8.5, 1.04, -3.45]}>
					<mesh>
						<boxGeometry args={[1.0, 0.06, 0.6]} />
						<meshStandardMaterial color="#1a1c20" roughness={0.5} />
					</mesh>
					{/* မီးဖို ၄ ခု (4 Burners) */}
					{[-0.26, 0.26].map((bx) =>
						[-0.14, 0.14].map((bz) => (
							<mesh key={`${bx}-${bz}`} position={[bx, 0.04, bz]}>
								<cylinderGeometry args={[0.09, 0.09, 0.02, 14]} />
								<meshStandardMaterial color="#383e47" metalness={0.7} />
							</mesh>
						)),
					)}
					{/* ရေနွေးအိုးနှင့် ဒယ်အိုး (Teapot & Cooking Pan) */}
					<mesh position={[-0.26, 0.15, -0.14]}>
						<cylinderGeometry args={[0.08, 0.11, 0.14, 14]} />
						<meshStandardMaterial color="#d45f28" roughness={0.4} />
					</mesh>
					<mesh position={[0.26, 0.12, 0.14]}>
						<cylinderGeometry args={[0.13, 0.11, 0.09, 16]} />
						<meshStandardMaterial color="#30343a" roughness={0.3} metalness={0.7} />
					</mesh>
				</group>

				{/* ရိုးရာ မြေစိုက် မီးဖိုခုံ (Traditional Charcoal/Firewood Hearth with Clay Pots) */}
				<group position={[12.8, 0.6, -3.45]}>
					<mesh position={[0, 0.44, 0]}>
						<boxGeometry args={[1.2, 0.12, 0.65]} />
						<meshStandardMaterial color="#7a583d" roughness={0.9} />
					</mesh>
					{[-0.32, 0.32].map((px) => (
						<mesh key={px} position={[px, 0.65, 0]}>
							<cylinderGeometry args={[0.16, 0.13, 0.22, 14]} />
							<meshStandardMaterial color="#8a4f32" roughness={0.8} />
						</mesh>
					))}
				</group>

				{/* ဘေစင်နှင့် စတီးရေဘုံဘိုင် (Double Stainless Sink & Swivel Faucets) */}
				<group position={[10.5, 1.02, -3.45]}>
					<mesh>
						<boxGeometry args={[1.2, 0.04, 0.55]} />
						<meshStandardMaterial color="#88969e" roughness={0.25} metalness={0.8} />
					</mesh>
					{/* ရေဘုံဘိုင် ၂ ခု (Double Chrome Faucets) */}
					{[-0.25, 0.25].map((fx) => (
						<group key={fx} position={[fx, 0.18, -0.2]}>
							<mesh>
								<cylinderGeometry args={[0.015, 0.015, 0.24, 8]} />
								<meshStandardMaterial color="#dce4e8" metalness={0.9} roughness={0.1} />
							</mesh>
						</group>
					))}
				</group>

				{/* ဧရာမ အလယ်အစားအစာပြင်ဆင်စားပွဲကြီးနှင့် သစ်သားခုံများ (Central Kitchen Island & 4 Stools) */}
				<group position={[10.5, 0, 0]}>
					{/* စားပွဲခုံကြီး (Teak Island Tabletop) */}
					<mesh position={[0, 0.88, 0]}>
						<boxGeometry args={[2.6, 0.08, 1.4]} />
						<meshStandardMaterial color="#5c3c24" roughness={0.4} />
					</mesh>
					{/* စားပွဲခြေထောက် ၄ ချောင်း (Legs) */}
					{[-1.15, 1.15].map((x) =>
						[-0.55, 0.55].map((z) => (
							<mesh key={`${x}-${z}`} position={[x, 0.42, z]}>
								<boxGeometry args={[0.12, 0.84, 0.12]} />
								<meshStandardMaterial color="#3d2616" roughness={0.6} />
							</mesh>
						)),
					)}
					{/* သစ်သားထိုင်ခုံပု ၄ လုံး (4 Wooden Stools) */}
					{[-0.7, 0.7].map((x) =>
						[-1.0, 1.0].map((z) => (
							<group key={`${x}-${z}`} position={[x, 0, z]}>
								<mesh position={[0, 0.46, 0]}>
									<cylinderGeometry args={[0.2, 0.2, 0.05, 16]} />
									<meshStandardMaterial color="#7a5438" roughness={0.5} />
								</mesh>
								<mesh position={[0, 0.22, 0]}>
									<cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
									<meshStandardMaterial color="#3d2616" />
								</mesh>
							</group>
						)),
					)}
					{/* စားပွဲပေါ်ရှိ သစ်သီးဗန်းနှင့် အသုပ်ပန်းကန် (Fruit Basket & Serving Bowls) */}
					<mesh position={[0, 0.98, 0]}>
						<cylinderGeometry args={[0.22, 0.16, 0.10, 16]} />
						<meshStandardMaterial color="#baa478" roughness={0.5} />
					</mesh>
				</group>

				{/* ၂ တံခါးဖွင့် ရေခဲသေတ္တာကြီး (Tall Double-Door Refrigerator at lx=14.2, lz=3.1) */}
				<group position={[14.2, 1.0, 3.1]}>
					<mesh>
						<boxGeometry args={[0.85, 1.85, 0.85]} />
						<meshStandardMaterial color="#dce4e8" metalness={0.35} roughness={0.3} />
					</mesh>
					{/* လက်ကိုင်များ (Handles) */}
					{[-0.2, 0.2].map((y) => (
						<mesh key={y} position={[-0.44, y, 0]}>
							<boxGeometry args={[0.03, 0.35, 0.03]} />
							<meshStandardMaterial color="#788690" metalness={0.8} />
						</mesh>
					))}
				</group>

				{/* မီးဖိုဆောင် နံရံစင်ရှည်ကြီး (Multi-Tier Long Spice & Dish Wall Shelves) */}
				<group position={[10.5, 1.95, -3.85]}>
					<mesh>
						<boxGeometry args={[5.0, 0.06, 0.28]} />
						<meshStandardMaterial color="#68482f" roughness={0.6} />
					</mesh>
					{[-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8].map((x, i) => (
						<mesh key={x} position={[x, 0.12, 0]}>
							<cylinderGeometry args={[0.06, 0.06, 0.16, 10]} />
							<meshStandardMaterial
								color={['#e4ceaa', '#c85a42', '#58885c', '#467290', '#d49b42'][i % 5]}
								roughness={0.5}
							/>
						</mesh>
					))}
				</group>

				{/* မီးဖိုဆောင် အလင်းဆိုင်းမီးအိမ် ၂ လုံး (2 Warm Pendant Lights in Kitchen) */}
				{[8.5, 12.5].map((kx) => (
					<group key={kx} position={[kx, 2.25, 0]}>
						<mesh position={[0, 0.15, 0]}>
							<cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
							<meshStandardMaterial color="#8a7442" metalness={0.8} />
						</mesh>
						<mesh>
							<cylinderGeometry args={[0.2, 0.32, 0.18, 14, 1, true]} />
							<meshStandardMaterial color="#f0e4c8" side={DoubleSide} roughness={0.5} />
						</mesh>
						<mesh position={[0, -0.04, 0]}>
							<sphereGeometry args={[0.09, 10, 8]} />
							<meshStandardMaterial color="#fff4da" emissive="#ffe4a0" emissiveIntensity={0.8} />
						</mesh>
					</group>
				))}
			</group>

			{/* ======================================================== */}
			{/* ၅။ ချဲ့ထွင်ထားသော အိမ်မကြီးတွင်း ပရိဘောဂ ၄ မျိုး */}
			{/* (INTERIOR FURNISHINGS: TV, TABLE, BED, COMPUTER) */}
			{/* ======================================================== */}

			{/* -------------------------------------------------------- */}
			{/* (က) တီဗွီနှင့် ဧည့်ခန်းအစုံ (TV & Entertainment Lounge at lx=2.6) */}
			{/* -------------------------------------------------------- */}
			<group name="tv-entertainment-center">
				{/* တီဗွီတင်ခုံ ကက်ဘိနက် (TV Media Console Cabinet along Back Wall at lx=2.6, lz=-4.6) */}
				<mesh position={[2.6, 0.44, -4.6]}>
					<boxGeometry args={[2.6, 0.52, 0.55]} />
					<meshStandardMaterial color="#3a2516" roughness={0.5} />
				</mesh>

				{/* ၇၅ လက်မ စမတ်တီဗွီကြီး (75-inch Widescreen Smart TV) */}
				<group position={[2.6, 1.55, -4.6]}>
					<mesh position={[0, -0.58, 0]}>
						<boxGeometry args={[0.6, 0.03, 0.28]} />
						<meshStandardMaterial color="#111317" roughness={0.3} metalness={0.7} />
					</mesh>
					<mesh position={[0, -0.42, 0]}>
						<cylinderGeometry args={[0.04, 0.04, 0.3, 10]} />
						<meshStandardMaterial color="#111317" roughness={0.3} metalness={0.7} />
					</mesh>
					<mesh>
						<boxGeometry args={[2.1, 1.2, 0.06]} />
						<meshStandardMaterial color="#111317" roughness={0.3} metalness={0.6} />
					</mesh>
					<mesh position={[0, 0, 0.033]}>
						<planeGeometry args={[2.02, 1.12]} />
						<meshStandardMaterial
							color="#0e3860"
							emissive="#38bdf8"
							emissiveIntensity={0.55}
							roughness={0.1}
						/>
					</mesh>
					<mesh position={[0, -0.68, 0.05]}>
						<boxGeometry args={[1.6, 0.09, 0.1]} />
						<meshStandardMaterial color="#181a1f" roughness={0.6} />
					</mesh>
				</group>

				{/* ဧည့်ခန်းဆိုဖာ ထိုင်ခုံကြီး (Comfortable 3-Seater Sofa facing TV at lz=-2.4) */}
				<group position={[2.6, 0.48, -2.4]}>
					<mesh>
						<boxGeometry args={[2.5, 0.44, 0.95]} />
						<meshStandardMaterial color="#2c4252" roughness={0.8} />
					</mesh>
					<mesh position={[0, 0.38, 0.38]}>
						<boxGeometry args={[2.5, 0.55, 0.24]} />
						<meshStandardMaterial color="#2c4252" roughness={0.8} />
					</mesh>
					{[-1.15, 1.15].map((x) => (
						<mesh key={x} position={[x, 0.22, 0]}>
							<boxGeometry args={[0.2, 0.38, 0.95]} />
							<meshStandardMaterial color="#253847" roughness={0.8} />
						</mesh>
					))}
					{[-0.7, 0.7].map((x) => (
						<mesh key={x} position={[x, 0.32, 0.18]} rotation={[0.2, 0, 0]}>
							<boxGeometry args={[0.42, 0.32, 0.15]} />
							<meshStandardMaterial color="#d4a359" roughness={0.7} />
						</mesh>
					))}
				</group>

				{/* ဧည့်ခန်း ကော်ဖီစားပွဲ (Living Room Coffee Table at lz=-3.5) */}
				<group position={[2.6, 0.34, -3.5]}>
					<mesh position={[0, 0.08, 0]}>
						<boxGeometry args={[1.4, 0.05, 0.75]} />
						<meshStandardMaterial color="#573822" roughness={0.4} />
					</mesh>
					{[-0.6, 0.6].map((x) =>
						[-0.3, 0.3].map((z) => (
							<mesh key={`${x}-${z}`} position={[x, -0.06, z]}>
								<cylinderGeometry args={[0.028, 0.028, 0.24, 8]} />
								<meshStandardMaterial color="#3d2616" roughness={0.5} />
							</mesh>
						)),
					)}
					<mesh position={[0, 0.18, 0]}>
						<cylinderGeometry args={[0.08, 0.1, 0.15, 12]} />
						<meshStandardMaterial color="#e8dfd1" roughness={0.3} />
					</mesh>
					{[-0.24, 0.24].map((x) => (
						<mesh key={x} position={[x, 0.14, 0]}>
							<cylinderGeometry args={[0.045, 0.04, 0.07, 10]} />
							<meshStandardMaterial color="#e8dfd1" roughness={0.3} />
						</mesh>
					))}
				</group>
			</group>

			{/* -------------------------------------------------------- */}
			{/* (ခ) စားပွဲ (Central 6-Seater Dining Table & Chairs at lx=0, lz=0) */}
			{/* -------------------------------------------------------- */}
			<group name="dining-table-center">
				{/* ကျွန်းသစ် ထမင်းစားပွဲကြီး (Solid Teak Dining Tabletop at lx=0, lz=0) */}
				<mesh position={[0, 0.84, 0]}>
					<boxGeometry args={[2.4, 0.08, 1.3]} />
					<meshStandardMaterial color="#543721" roughness={0.4} />
				</mesh>
				{/* စားပွဲခြေထောက် ၄ ချောင်း (Table Legs) */}
				{[-1.05, 1.05].map((x) =>
					[-0.52, 0.52].map((z) => (
						<mesh key={`${x}-${z}`} position={[x, 0.4, z]}>
							<boxGeometry args={[0.1, 0.8, 0.1]} />
							<meshStandardMaterial color="#3a2516" roughness={0.5} />
						</mesh>
					)),
				)}

				{/* သစ်သားကုလားထိုင် ၆ လုံး (6 Elegant Dining Chairs) */}
				{[-0.7, 0, 0.7].map((x) => (
					<group key={`chair-s-${x}`} position={[x, 0, -0.85]}>
						<mesh position={[0, 0.46, 0]}>
							<boxGeometry args={[0.44, 0.05, 0.44]} />
							<meshStandardMaterial color="#7a5438" roughness={0.5} />
						</mesh>
						<mesh position={[0, 0.82, -0.19]}>
							<boxGeometry args={[0.42, 0.72, 0.05]} />
							<meshStandardMaterial color="#7a5438" roughness={0.5} />
						</mesh>
						{[-0.18, 0.18].map((cx) =>
							[-0.18, 0.18].map((cz) => (
								<mesh key={`${cx}-${cz}`} position={[cx, 0.22, cz]}>
									<cylinderGeometry args={[0.022, 0.022, 0.44, 8]} />
									<meshStandardMaterial color="#4e3524" />
								</mesh>
							)),
						)}
					</group>
				))}
				{[-0.7, 0, 0.7].map((x) => (
					<group key={`chair-n-${x}`} position={[x, 0, 0.85]} rotation={[0, Math.PI, 0]}>
						<mesh position={[0, 0.46, 0]}>
							<boxGeometry args={[0.44, 0.05, 0.44]} />
							<meshStandardMaterial color="#7a5438" roughness={0.5} />
						</mesh>
						<mesh position={[0, 0.82, -0.19]}>
							<boxGeometry args={[0.42, 0.72, 0.05]} />
							<meshStandardMaterial color="#7a5438" roughness={0.5} />
						</mesh>
						{[-0.18, 0.18].map((cx) =>
							[-0.18, 0.18].map((cz) => (
								<mesh key={`${cx}-${cz}`} position={[cx, 0.22, cz]}>
									<cylinderGeometry args={[0.022, 0.022, 0.44, 8]} />
									<meshStandardMaterial color="#4e3524" />
								</mesh>
							)),
						)}
					</group>
				))}
			</group>

			{/* -------------------------------------------------------- */}
			{/* (ဂ) အိပ်ရာ/ကုတင် (Bed in Bedroom Suite at lx=-3.8, lz=-2.5) */}
			{/* -------------------------------------------------------- */}
			<group name="bedroom-bed-setup" position={[-3.8, 0, -2.5]}>
				{/* သစ်သားကုတင်ဘောင်ကြီး (Carved Wooden Bed Frame) */}
				<mesh position={[0, 0.26, 0]}>
					<boxGeometry args={[2.0, 0.32, 2.4]} />
					<meshStandardMaterial color="#4e301b" roughness={0.5} />
				</mesh>
				{/* ကုတင်ခေါင်းရင်း ဘုတ်ပြားကြီး (Headboard against Right Wall) */}
				<mesh position={[-1.02, 0.95, 0]}>
					<boxGeometry args={[0.12, 1.15, 2.4]} />
					<meshStandardMaterial color="#442a17" roughness={0.5} />
				</mesh>
				{/* ကုတင်ခြေရင်း ဘုတ်ပြား (Footboard) */}
				<mesh position={[1.02, 0.52, 0]}>
					<boxGeometry args={[0.08, 0.55, 2.4]} />
					<meshStandardMaterial color="#442a17" roughness={0.5} />
				</mesh>

				{/* မွေ့ရာဖြူထူထူကြီး (Thick White Comfortable Mattress) */}
				<mesh position={[0, 0.48, 0]}>
					<boxGeometry args={[1.88, 0.28, 2.24]} />
					<meshStandardMaterial color="#fcfcfc" roughness={0.8} />
				</mesh>

				{/* စောင်နွေးနွေးကြီး (Warm Folded Duvet) */}
				<mesh position={[0.24, 0.54, 0]}>
					<boxGeometry args={[1.4, 0.16, 2.25]} />
					<meshStandardMaterial color="#1f4460" roughness={0.7} />
				</mesh>

				{/* အိစက်ညက်ညောသော ခေါင်းအုံး ၂ လုံး (2 Soft Pillows at Headboard) */}
				{[-0.6, 0.6].map((z) => (
					<mesh key={z} position={[-0.7, 0.68, z]} rotation={[0, 0, 0.22]}>
						<boxGeometry args={[0.48, 0.15, 0.72]} />
						<meshStandardMaterial color="#f5f7f8" roughness={0.9} />
					</mesh>
				))}

				{/* အိပ်ရာဘေး စားပွဲငယ်နှင့် မီးအိမ် (Bedside Nightstand & Glowing Lamp) */}
				<group position={[-0.4, 0, -1.6]}>
					<mesh position={[0, 0.35, 0]}>
						<boxGeometry args={[0.58, 0.62, 0.58]} />
						<meshStandardMaterial color="#3d2616" roughness={0.5} />
					</mesh>
					<mesh position={[0, 0.72, 0]}>
						<cylinderGeometry args={[0.02, 0.05, 0.15, 8]} />
						<meshStandardMaterial color="#baa478" metalness={0.7} />
					</mesh>
					<mesh position={[0, 0.92, 0]}>
						<cylinderGeometry args={[0.12, 0.18, 0.25, 12]} />
						<meshStandardMaterial color="#fff0d0" emissive="#ffe4a8" emissiveIntensity={0.5} />
					</mesh>
				</group>
			</group>

			{/* -------------------------------------------------------- */}
			{/* (ဃ) ကွန်ပျူတာ (Computer & Gaming Workstation at lx=-3.8, lz=2.2) */}
			{/* -------------------------------------------------------- */}
			<group name="computer-workstation" position={[-3.8, 0, 2.2]}>
				{/* ကွန်ပျူတာ စားပွဲခုံ (Solid Modern Computer Desk) */}
				<mesh position={[0, 0.44, 0]}>
					<boxGeometry args={[0.9, 0.80, 2.0]} />
					<meshStandardMaterial color="#3d2717" roughness={0.4} />
				</mesh>
				<mesh position={[0, 0.84, 0]}>
					<boxGeometry args={[0.98, 0.05, 2.06]} />
					<meshStandardMaterial color="#2d1d11" roughness={0.35} />
				</mesh>

				{/* ၂၇ လက်မ ကွေးညွတ် စခရင် မော်နီတာ (27-inch Curved Desktop PC Monitor facing interior) */}
				<group position={[-0.15, 1.22, 0]} rotation={[0, Math.PI / 2, 0]}>
					<mesh position={[0, -0.32, 0]}>
						<boxGeometry args={[0.32, 0.025, 0.22]} />
						<meshStandardMaterial color="#16181c" metalness={0.8} roughness={0.2} />
					</mesh>
					<mesh position={[0, -0.18, -0.06]}>
						<cylinderGeometry args={[0.025, 0.025, 0.26, 8]} />
						<meshStandardMaterial color="#16181c" metalness={0.8} roughness={0.2} />
					</mesh>
					<mesh>
						<boxGeometry args={[0.9, 0.54, 0.04]} />
						<meshStandardMaterial color="#16181c" metalness={0.6} roughness={0.3} />
					</mesh>
					<mesh position={[0, 0, 0.022]}>
						<planeGeometry args={[0.86, 0.5]} />
						<meshStandardMaterial
							color="#092238"
							emissive="#38bdf8"
							emissiveIntensity={0.65}
							roughness={0.1}
						/>
					</mesh>
				</group>

				{/* ကွန်ပျူတာ စက်ကေ့စ် (Desktop PC Gaming Tower Case with RGB Lighting) */}
				<group position={[-0.22, 1.14, 0.72]}>
					<mesh>
						<boxGeometry args={[0.26, 0.56, 0.5]} />
						<meshStandardMaterial color="#131518" metalness={0.7} roughness={0.3} />
					</mesh>
					<mesh position={[0.132, 0, 0]}>
						<planeGeometry args={[0.44, 0.48]} />
						<meshStandardMaterial
							color="#16a34a"
							emissive="#22c55e"
							emissiveIntensity={0.5}
							roughness={0.1}
						/>
					</mesh>
				</group>

				{/* ကီးဘုတ်နှင့် မောက်စ် (Backlit Keyboard & Ergonomic Mouse on Desk Mat) */}
				<group position={[0.15, 0.88, 0]}>
					<mesh position={[0, 0, 0]}>
						<boxGeometry args={[0.42, 0.005, 0.95]} />
						<meshStandardMaterial color="#181a1f" roughness={0.9} />
					</mesh>
					<mesh position={[0, 0.012, -0.1]}>
						<boxGeometry args={[0.16, 0.018, 0.48]} />
						<meshStandardMaterial
							color="#22262d"
							emissive="#38bdf8"
							emissiveIntensity={0.2}
							roughness={0.5}
						/>
					</mesh>
					<mesh position={[0, 0.016, 0.26]}>
						<boxGeometry args={[0.12, 0.025, 0.07]} />
						<meshStandardMaterial color="#22262d" roughness={0.4} />
					</mesh>
				</group>

				{/* ကွန်ပျူတာ ရုံးသုံးလှည့်ကုလားထိုင် (Ergonomic Swivel Desk Chair at lx=-3.0, lz=2.2) */}
				<group position={[0.65, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
					<mesh position={[0, 0.48, 0]}>
						<boxGeometry args={[0.54, 0.08, 0.54]} />
						<meshStandardMaterial color="#1a1e24" roughness={0.8} />
					</mesh>
					<mesh position={[0, 0.88, -0.24]}>
						<boxGeometry args={[0.5, 0.72, 0.08]} />
						<meshStandardMaterial color="#1a1e24" roughness={0.8} />
					</mesh>
					{[-0.25, 0.25].map((x) => (
						<mesh key={x} position={[x, 0.65, 0]}>
							<boxGeometry args={[0.06, 0.25, 0.34]} />
							<meshStandardMaterial color="#2d333b" roughness={0.5} />
						</mesh>
					))}
					<mesh position={[0, 0.24, 0]}>
						<cylinderGeometry args={[0.035, 0.035, 0.44, 8]} />
						<meshStandardMaterial color="#4c5663" metalness={0.8} />
					</mesh>
				</group>
			</group>

			{/* ======================================================== */}
			{/* ၆။ မျက်နှာကျက်နှင့် တွဲလောင်းမီးဆိုင်းကြီး (Ceiling & Pendant Chandelier) */}
			{/* ======================================================== */}
			<mesh position={[0, 3.22, 0]}>
				<boxGeometry args={[houseW - 0.2, 0.04, houseD - 0.2]} />
				<meshStandardMaterial color="#c2b49d" roughness={0.7} />
			</mesh>
			{/* သစ်သားမျက်နှာကျက် ထုပ်ယက်မတန်းများ (Exposed Ceiling Beams) */}
			{[-4.0, -2.0, 0, 2.0, 4.0].map((x) => (
				<mesh key={x} position={[x, 3.16, 0]}>
					<boxGeometry args={[0.18, 0.14, houseD - 0.4]} />
					<meshStandardMaterial color="#573f30" roughness={0.6} />
				</mesh>
			))}
			{/* အလယ် မီးဆိုင်းကြီး (Warm Golden Hanging Pendant Chandelier at y=2.8) */}
			<group position={[0, 2.8, 0]}>
				<mesh position={[0, 0.2, 0]}>
					<cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
					<meshStandardMaterial color="#8a7442" metalness={0.8} />
				</mesh>
				<mesh>
					<cylinderGeometry args={[0.3, 0.48, 0.3, 16, 1, true]} />
					<meshStandardMaterial color="#f0e4c8" side={DoubleSide} roughness={0.5} />
				</mesh>
				<mesh position={[0, -0.06, 0]}>
					<sphereGeometry args={[0.14, 12, 10]} />
					<meshStandardMaterial color="#fff4da" emissive="#ffe4a0" emissiveIntensity={0.8} />
				</mesh>
			</group>

			{/* ======================================================== */}
			{/* ၇။ အပေါ်ထပ်နှင့် ခေါင်မိုးကြီး (Upper Storey, Balcony & Gable Roof) */}
			{/* ======================================================== */}
			{/* အလယ်ကြမ်းခင်းအနားကွပ် (Mid-Level Floor Divider Band at y=3.45) */}
			<mesh position={[0, 3.45, 0]}>
				<boxGeometry args={[houseW + 0.4, 0.24, houseD + 0.4]} />
				<meshStandardMaterial color="#71523c" roughness={0.6} />
			</mesh>

			{/* အပေါ်ထပ်ကိုယ်ထည် (Upper Storey Walls: width 12m, depth 10m) */}
			<mesh position={[0, 5.05, 0]}>
				<boxGeometry args={[houseW, 3.0, houseD]} />
				<meshStandardMaterial color={h.color} roughness={0.6} />
			</mesh>
			{/* အပေါ်ထပ် အမိုးအောက်အနားကွပ် (Upper Eaves Band at y=6.6) */}
			<mesh position={[0, 6.6, 0]}>
				<boxGeometry args={[houseW + 0.45, 0.18, houseD + 0.45]} />
				<meshStandardMaterial color="#e6ce9f" roughness={0.6} />
			</mesh>

			{/* အပေါ်ထပ် ပြတင်းပေါက်များနှင့် တံခါး (Upper Windows & Door at y=5.1) */}
			{[-1, 1].map((side) => (
				<group key={side} position={[side * houseW * 0.32, 5.1, halfD + 0.08]}>
					<mesh>
						<boxGeometry args={[1.6, 1.5, 0.14]} />
						<meshStandardMaterial color="#355b59" roughness={0.4} />
					</mesh>
					<mesh position={[0, 0, 0.05]}>
						<boxGeometry args={[0.09, 1.6, 0.07]} />
						<meshStandardMaterial color="#e6ce9f" />
					</mesh>
				</group>
			))}
			<mesh position={[0, 4.75, halfD + 0.08]}>
				<boxGeometry args={[1.5, 2.4, 0.16]} />
				<meshStandardMaterial color="#573f30" roughness={0.6} />
			</mesh>

			{/* အပေါ်ထပ် ဝရန်တာ (Upper Front Balcony at lz=halfD+0.85) */}
			{(() => {
				const balconyWidth = houseW * 0.65; // ~7.8m
				return (
					<group>
						<mesh position={[0, 3.5, halfD + 0.85]}>
							<boxGeometry args={[balconyWidth, 0.22, 1.7]} />
							<meshStandardMaterial color="#8c6744" roughness={0.6} />
						</mesh>
						{[-1, 1].map((side) => (
							<group key={side}>
								<mesh position={[side * (balconyWidth / 2 - 0.15), 4.95, halfD + 1.5]}>
									<boxGeometry args={[0.22, 3.1, 0.22]} />
									<meshStandardMaterial color="#71523c" />
								</mesh>
								<mesh position={[side * (balconyWidth / 2), 4.15, halfD + 0.85]}>
									<boxGeometry args={[0.12, 1.1, 1.7]} />
									<meshStandardMaterial color="#a58b63" />
								</mesh>
							</group>
						))}
						<mesh position={[0, 4.7, halfD + 1.65]}>
							<boxGeometry args={[balconyWidth, 0.12, 0.12]} />
							<meshStandardMaterial color="#e6ce9f" />
						</mesh>
						{Array.from({ length: 9 }, (_, i) => (
							<mesh
								key={i}
								position={[-balconyWidth / 2 + (i * balconyWidth) / 8, 4.15, halfD + 1.65]}
							>
								<boxGeometry args={[0.1, 1.1, 0.1]} />
								<meshStandardMaterial color="#a58b63" />
							</mesh>
						))}
					</group>
				);
			})()}

			{/* အမိုးခုံးကြီး (Classic Gable Roof Panels for expanded 12m width) */}
			{[-1, 1].map((side) => (
				<mesh
					key={side}
					position={[(side * houseW) / 4, 7.55, 0]}
					rotation={[0, 0, -side * Math.atan2(1.8, houseW / 2)]}
					castShadow
				>
					<boxGeometry args={[Math.hypot(houseW / 2, 1.8) + 0.9, 0.2, houseD + 1.4]} />
					<meshStandardMaterial color={h.roof} roughness={0.85} />
				</mesh>
			))}
		</group>
	);
}

/** Farmhouse building with walk-in character home, giant left-side kitchen annex, compound fences, and gardens. */
export function Farmhouse() {
	return (
		<>
			<FarmhouseBuilding />
			<Gardens />
			<FarmEstate />
		</>
	);
}
