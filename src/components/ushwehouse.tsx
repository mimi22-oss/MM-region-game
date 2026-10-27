import { Box } from './Primitives';
import { angle } from '../data/ward';
import { uShweHouseCoords, U_SHWE_HOUSE_ID } from '../data/ushwehouse';
import { mobileQuality } from '../game/sceneBudget';
import { sourceIsEdited } from '../game/worldEdits';

export { U_SHWE_HOUSE_ID };

/**
 * ဦးရွှေအိမ်နှင့် မုန့်စျေးဆိုင် (U Shwe House & Myanmar Traditional Snack Stall Component)
 * - တည်နေရာ (Location): Lat 23.1614608, Lng 94.0466737 (Scene X=152.735, Z=186.676)
 * - မျက်နှာမူ (Facing): East (Local +Z faces front street where robot stands at u=-16.995, v=239.244)
 * - ၂ ထပ်တိုက် ပင်မအိမ်ကြီးနှင့် အရှေ့ဘက် မုန့်စျေးဆိုင် အဖီ (Lean-to Annex Snack Stall)
 * - မြန်မာ့ရိုးရာ မုန့်မျိုးစုံ (Traditional Myanmar Snacks):
 *   - မုန့်ဟင်းခါးအိုးကြီး၊ မုန့်ဖတ်တောင်းနှင့် ပန်းကန်များ
 *   - အကြော်စုံဗန်းကြီး (ဘူးသီးကြော်၊ ဘယာကြော်၊ မတ်ပဲကြော်နှင့် အချဉ်ရည်)
 *   - မုန့်လက်ကောက် (သကာရည်ဆမ်း)၊ မုန့်စိမ်းပေါင်း (အုန်းသီးဆံဆမ်း)၊ ရွှေကြည်မုန့်
 *   - မုန့်ဖန်ပုလင်း ၃ လုံး (Snack Jars with metal lids)
 *   - ငှက်ပျောဖက်ထုပ်မုန့်များ
 *   - လက်ဖက်ရည်ခွက်များ၊ ဓာတ်ဗူး၊ ရေနွေးကြမ်းအိုးနှင့် စားပွဲဝိုင်း၊ ခုံပုလေးများ
 */
export function UShweHouse({ ignoreEdits = false }: { ignoreEdits?: boolean } = {}) {
	if (!ignoreEdits && sourceIsEdited(U_SHWE_HOUSE_ID)) return null;
	const h = uShweHouseCoords;
	const rot = angle + Math.PI / 2; // 3*pi/4, facing front street
	const front = h.depth / 2; // 4.5m

	return (
		<group position={[h.x, 0, h.z]} rotation={[0, rot, 0]} name="u-shwe-house-and-snack-shop">
            <PorchCandles width={h.width} front={front} y={.02}/>
            <FestivalAnchor items={[{x:2.0,y:.75,z:6.05,holder:true}]}/>
			{/* ======================================================== */}
			{/* ၁။ ပင်မ ၂ ထပ်အိမ်ကြီး (Main 2-Storey House Building: 10m x 9m) */}
			{/* ======================================================== */}
			<group name="main-house-building">
				{/* အောက်ခြေ ကွန်ကရစ်ဖောင်ဒေးရှင်းခုံ (Foundation Base) */}
				<Box position={[0, 0.15, 0]} size={[h.width + 0.3, 0.3, h.depth + 0.3]} color="#aaa18d" />

				{/* အောက်ထပ် ပင်မနံရံများ (Ground Floor Walls) */}
				<Box position={[0, 1.8, 0]} size={[h.width, 3.0, h.depth]} color="#d6cbb6" />

				{/* အလယ်ထပ် ကြမ်းခင်းလိုင်းဘောင် (Floor Divider Band) */}
				<Box position={[0, 3.4, 0]} size={[h.width + 0.35, 0.2, h.depth + 0.35]} color="#71523c" />

				{/* အပေါ်ထပ် နံရံများ (Upper Floor Walls) */}
				<Box position={[0, 5.0, 0]} size={[h.width, 3.0, h.depth]} color={h.color} />

				{/* အမိုးအောက်ခြေ အနားကွပ် (Roof Cornice) */}
				<Box position={[0, 6.55, 0]} size={[h.width + 0.4, 0.15, h.depth + 0.4]} color="#e6ce9f" />

				{/* ပင်မအမိုးစောင်း ၂ ဖက် (Gabled Roofs in #8b5545) */}
				{[-1, 1].map((side) => (
					<mesh
						key={side}
						position={[side * (h.width / 4), 7.35, 0]}
						rotation={[0, 0, -side * Math.atan2(1.6, h.width / 2)]}
						castShadow
					>
						<boxGeometry args={[Math.hypot(h.width / 2, 1.6) + 0.8, 0.18, h.depth + 1.2]} />
						<meshStandardMaterial color={h.roof} roughness={0.85} />
					</mesh>
				))}

				{/* အိမ်ရှေ့ ပြတင်းပေါက်များနှင့် အပေါ်ထပ် ဝရံတာ (Windows & Balcony) */}
				{[-1, 1].map((side) => (
					<group key={side}>
						{/* အောက်ထပ် ပြတင်းပေါက်များ (Ground Windows) */}
						<Box position={[side * (h.width * 0.32), 1.9, front + 0.05]} size={[1.5, 1.4, 0.12]} color="#355b59" />
						<Box position={[side * (h.width * 0.32), 1.9, front + 0.12]} size={[0.08, 1.45, 0.06]} color="#e6ce9f" />
						{/* အပေါ်ထပ် ပြတင်းပေါက်များ (Upper Windows) */}
						<Box position={[side * (h.width * 0.32), 5.1, front + 0.05]} size={[1.5, 1.4, 0.12]} color="#355b59" />
						<Box position={[side * (h.width * 0.32), 5.1, front + 0.12]} size={[0.08, 1.45, 0.06]} color="#e6ce9f" />
					</group>
				))}

				{/* ပင်မ အိမ်တံခါးမကြီး (Main House Front Entrance Door) */}
				<Box position={[0, 1.45, front + 0.05]} size={[1.4, 2.3, 0.12]} color="#573f30" />
				<Box position={[0, 4.65, front + 0.05]} size={[1.4, 2.3, 0.12]} color="#573f30" />

				{/* အပေါ်ထပ် ဝရံတာလက်ရန်း (Upper Floor Balcony at y=3.4) */}
				<Box position={[0, 3.45, front + 0.8]} size={[6.5, 0.15, 1.5]} color="#8c6744" />
				<Box position={[0, 4.2, front + 1.5]} size={[6.5, 0.08, 0.08]} color="#e6ce9f" />
				{[-3.0, -2.0, -1.0, 0, 1.0, 2.0, 3.0].map((bx) => (
					<Box key={bx} position={[bx, 3.8, front + 1.5]} size={[0.08, 0.7, 0.08]} color="#a58b63" />
				))}
			</group>

			{/* ======================================================== */}
			{/* ၂။ မုန့်စျေးဆိုင် အဖီ (Lean-to Annex Snack Stall: Width 9.2m, Depth 2.7m) */}
			{/* ======================================================== */}
			<group name="snack-shop-lean-to-annex">
				{/* အဖီ ကြမ်းခင်းပြား (Raised Shop Floor Platform: y=0.08, lz=4.5..7.2) */}
				<mesh position={[0, 0.08, 5.85]} receiveShadow>
					<boxGeometry args={[9.4, 0.16, 2.7]} />
					<meshStandardMaterial color="#b5aa94" roughness={0.8} />
				</mesh>

				{/* အဖီ အမိုးစောင်း (Slanted Corrugated Zinc Awning Roof: slopes y=3.3 down to 2.45 at lz=7.3) */}
				<mesh position={[0, 2.9, 5.85]} rotation={[0.31, 0, 0]} castShadow>
					<boxGeometry args={[9.6, 0.08, 2.9]} />
					<meshStandardMaterial color="#849699" roughness={0.5} metalness={0.4} />
				</mesh>

				{/* အမိုးအောက် သစ်သားဒိုင်းတန်းနှင့် တံစက်မြိတ် (Roof Eaves & Timber Framing) */}
				<Box position={[0, 2.48, 7.22]} size={[9.6, 0.12, 0.08]} color="#6b4c30" />
				<Box position={[0, 3.32, 4.55]} size={[9.6, 0.12, 0.08]} color="#6b4c30" />

				{/* အဖီ အရှေ့မျက်နှာစာ သစ်သားတိုင် ၄ တိုင် (4 Front Wooden Support Posts at lz=7.18) */}
				{[-4.4, -1.4, 1.4, 4.4].map((px) => (
					<Box key={px} position={[px, 1.25, 7.18]} size={[0.15, 2.35, 0.15]} color="#5c3d24" />
				))}

				{/* ဆိုင်ဆိုင်းဘုတ်ကြီး (Prominent U Shwe Snack Shop Signboard) */}
				<group position={[0, 2.25, 7.26]}>
					{/* ဆိုင်းဘုတ် သစ်သားဘောင် (Signboard Frame) */}
					<Box position={[0, 0, 0]} size={[3.4, 0.52, 0.06]} color="#78350f" />
					{/* ရွှေဝါရောင် အလယ်နောက်ခံ (Gold/Yellow Background Plate) */}
					<Box position={[0, 0, 0.032]} size={[3.2, 0.42, 0.02]} color="#f59e0b" />
					{/* အနီရောင် အလှဆင်အနားလိုင်းများ (Red Trim Stripes) */}
					<Box position={[0, 0.17, 0.035]} size={[3.1, 0.03, 0.01]} color="#dc2626" />
					<Box position={[0, -0.17, 0.035]} size={[3.1, 0.03, 0.01]} color="#dc2626" />
					{/* မြန်မာစာတန်းအတုပြုလုပ်ချက် - ဦးရွှေ မုန့်ဆိုင် (Stylized Myanmar Script Banner) */}
					<Box position={[0, 0, 0.04]} size={[2.6, 0.18, 0.01]} color="#7f1d1d" />
				</group>

				{/* ======================================================== */}
				{/* ၃။ မုန့်ရောင်းကောင်တာနှင့် မုန့်မှန်ဗီရိုကြီး (Snack Counter & Glass Case) */}
				{/* ======================================================== */}
				<group position={[-2.4, 0, 5.75]} name="snack-serving-counter">
					{/* သစ်သားကောင်တာစားပွဲကြီး (Teak Wooden Counter: 2.8m x 0.9m x 0.75m) */}
					<Box position={[0, 0.48, 0]} size={[2.8, 0.8, 0.72]} color="#6b4423" />
					{/* ကောင်တာ ထိပ်ပျဉ်ပြား (Counter Top Board) */}
					<Box position={[0, 0.9, 0]} size={[2.9, 0.05, 0.78]} color="#85542b" />

					{/* ကောင်တာပေါ်ရှိ မုန့်မှန်ဗီရိုကြီး (Glass Snack Display Case: 2.1m x 0.65m x 0.55m) */}
					<group position={[0, 1.25, 0]}>
						{/* မှန်ဘောင် သစ်သားဘောင် (Glass Case Timber Frame) */}
						<Box position={[0, 0, 0]} size={[2.1, 0.65, 0.55]} color="#5c3818" />
						{/* ဖောက်ထွင်းမြင် မှန်ချပ်များ (Clear Glass Panes) */}
						<mesh position={[0, 0, 0.28]}>
							<planeGeometry args={[2.0, 0.58]} />
							<meshStandardMaterial color="#bae6fd" transparent opacity={0.4} roughness={0.1} />
						</mesh>
						<mesh position={[0, 0, -0.28]}>
							<planeGeometry args={[2.0, 0.58]} />
							<meshStandardMaterial color="#bae6fd" transparent opacity={0.4} roughness={0.1} />
						</mesh>
						{/* အလယ် မှန်စင်ပြား (Interior Middle Shelf) */}
						<mesh position={[0, 0, 0]}>
							<boxGeometry args={[2.0, 0.02, 0.5]} />
							<meshStandardMaterial color="#bae6fd" transparent opacity={0.5} roughness={0.1} />
						</mesh>

						{/* မှန်ဗီရိုအတွင်းရှိ မုန့်လေးများ (Snacks inside Glass Case) */}
						{!mobileQuality && (
							<group position={[0, -0.15, 0]}>
								{/* က။ မုန့်လက်ကောက် ဗန်း (Mont Let Kauk Donuts Tray) */}
								<group position={[-0.6, 0.02, 0]}>
									<mesh position={[0, 0, 0]}>
										<cylinderGeometry args={[0.22, 0.22, 0.02, 16]} />
										<meshStandardMaterial color="#f8fafc" roughness={0.3} />
									</mesh>
									{/* သကာရည်ဆမ်း ရွှေဝါရောင် မုန့်လက်ကောက် ကွင်း ၄ ကွင်း (4 Glazed Donut Rings) */}
									{[
										[-0.08, -0.06],
										[0.08, -0.06],
										[-0.06, 0.08],
										[0.07, 0.07],
									].map(([dx, dz], di) => (
										<mesh key={di} position={[dx, 0.03, dz]} rotation={[Math.PI / 2, 0, 0]}>
											<torusGeometry args={[0.045, 0.016, 8, 16]} />
											<meshStandardMaterial color="#d97706" roughness={0.4} />
										</mesh>
									))}
								</group>

								{/* ခ။ မုန့်စိမ်းပေါင်း ဗန်း (Mont Sein Paung Pandan Rice Cakes) */}
								<group position={[0, 0.02, 0]}>
									<mesh position={[0, 0, 0]}>
										<boxGeometry args={[0.34, 0.02, 0.26]} />
										<meshStandardMaterial color="#f1f5f9" />
									</mesh>
									{/* စိမ်းစိုနေသော မုန့်စိမ်းပေါင်း တုံးကလေးများနှင့် အုန်းသီးဆံဖြူများ (Green Pandan Cakes + Coconut) */}
									{[-0.09, 0, 0.09].map((mx, mi) => (
										<group key={mi} position={[mx, 0.025, 0]} rotation={[0, 0.78, 0]}>
											<Box position={[0, 0, 0]} size={[0.06, 0.03, 0.06]} color="#16a34a" />
											<Box position={[0, 0.02, 0]} size={[0.04, 0.008, 0.04]} color="#ffffff" />
										</group>
									))}
								</group>

								{/* ဂ။ ရွှေကြည်မုန့် / သာကူမုန့် ဗန်း (Golden Semolina Cakes Tray) */}
								<group position={[0.6, 0.02, 0]}>
									<mesh position={[0, 0, 0]}>
										<boxGeometry args={[0.32, 0.02, 0.24]} />
										<meshStandardMaterial color="#f8fafc" />
									</mesh>
									{[-0.07, 0.07].map((sx, si) =>
										[-0.05, 0.05].map((sz, zi) => (
											<Box
												key={`${si}-${zi}`}
												position={[sx, 0.025, sz]}
												size={[0.055, 0.03, 0.045]}
												color="#ca8a04"
											/>
										))
									)}
								</group>
							</group>
						)}
					</group>

					{/* ကောင်တာပေါ် အပြင်ဘက် မုန့်ဗန်းကြီးများနှင့် ပုလင်းများ (Countertop Snacks & Jars) */}
					{/* ၁။ အကြော်စုံ ဗန်းကြီး (Large Assorted Fritters Metal Tray) */}
					<group position={[-0.9, 0.93, 0.15]}>
						{/* ငွေရောင် သံဗန်းဝိုင်းကြီး (Large Round Aluminum Tray) */}
						<mesh position={[0, 0.01, 0]}>
							<cylinderGeometry args={[0.26, 0.28, 0.025, 20]} />
							<meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.6} />
						</mesh>
						{/* ဘူးသီးကြော် ရွှေဝါရောင် ချောင်းများ (Crispy Gourd Fritter Sticks) */}
						{[-0.08, 0, 0.08].map((fx, fi) => (
							<mesh key={fi} position={[fx, 0.03, -0.05]} rotation={[0, 0.2 * fi, 0]}>
								<boxGeometry args={[0.035, 0.03, 0.14]} />
								<meshStandardMaterial color="#d97706" roughness={0.8} />
							</mesh>
						))}
						{/* ဘယာကြော် လုံးဝိုင်းများ (Round Lentil Bayar Gyaw Balls) */}
						{[
							[-0.1, 0.06],
							[0.1, 0.06],
							[0, 0.08],
						].map(([bx, bz], bi) => (
							<mesh key={bi} position={[bx, 0.03, bz]}>
								<sphereGeometry args={[0.028, 8, 6]} />
								<meshStandardMaterial color="#b45309" roughness={0.85} />
							</mesh>
						))}
						{/* အလယ် အချဉ်ရည်ခွက်နီ (Red Chili Sauce Dipping Cup) */}
						<mesh position={[0, 0.03, 0]}>
							<cylinderGeometry args={[0.04, 0.03, 0.035, 12]} />
							<meshStandardMaterial color="#dc2626" roughness={0.3} />
						</mesh>
					</group>

					{/* ၂။ မုန့်ဖန်ပုလင်းကြီး ၃ လုံး (3 Glass Snack Jars with Metal Lids) */}
					{[0.8, 1.05, 1.3].map((jx, ji) => (
						<group key={ji} position={[jx - 0.2, 0.93, 0.12]}>
							{/* ဖန်ပုလင်း ကိုယ်ထည် (Glass Jar Body) */}
							<mesh position={[0, 0.14, 0]}>
								<cylinderGeometry args={[0.075, 0.075, 0.25, 12]} />
								<meshStandardMaterial color="#bae6fd" transparent opacity={0.45} roughness={0.1} />
							</mesh>
							{/* သံပုံး အဖုံး (Metal Screw Lid) */}
							<mesh position={[0, 0.27, 0]}>
								<cylinderGeometry args={[0.078, 0.078, 0.03, 12]} />
								<meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.3} />
							</mesh>
							{/* ပုလင်းအတွင်း မုန့်များ (Snacks inside Jar: biscuit sticks, brittle, crisps) */}
							<mesh position={[0, 0.12, 0]}>
								<cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
								<meshStandardMaterial
									color={ji === 0 ? '#eab308' : ji === 1 ? '#78350f' : '#f59e0b'}
									roughness={0.8}
								/>
							</mesh>
						</group>
					))}

					{/* ၃။ ငှက်ပျောဖက်ထုပ် မုန့်များ (Banana-Leaf Wrapped Snacks on Bamboo Mat) */}
					<group position={[0.85, 0.93, -0.2]}>
						<mesh position={[0, 0.005, 0]}>
							<boxGeometry args={[0.28, 0.01, 0.18]} />
							<meshStandardMaterial color="#854d0e" roughness={0.9} />
						</mesh>
						{[-0.07, 0, 0.07].map((px, pi) => (
							<mesh key={pi} position={[px, 0.035, 0]} rotation={[0, 0.3 * pi, 0]}>
								<coneGeometry args={[0.035, 0.06, 4]} />
								<meshStandardMaterial color="#3f6212" roughness={0.7} />
							</mesh>
						))}
					</group>
				</group>

				{/* ======================================================== */}
				{/* ၄။ မုန့်ဟင်းခါး ချက်ပြုတ်ရာနေရာ (Mohinga Pot & Noodle Corner) */}
				{/* ======================================================== */}
				<group position={[-4.0, 0.08, 5.2]} name="mohinga-cooking-corner">
					{/* စတီးဒယ်အိုးတင်ခုံ (Cooking Stand Table) */}
					<Box position={[0, 0.35, 0]} size={[0.9, 0.7, 0.9]} color="#475569" />

					{/* မုန့်ဟင်းခါး ဒယ်အိုးကြီး (Big Simmering Mohinga Cauldron) */}
					<mesh position={[0, 0.9, 0]} castShadow>
						<cylinderGeometry args={[0.28, 0.25, 0.4, 16]} />
						<meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />
					</mesh>
					{/* အိုးလက်ကိုင် ၂ ဖက် (Pot Handles) */}
					{[-0.3, 0.3].map((hx) => (
						<mesh key={hx} position={[hx, 0.98, 0]} rotation={[0, 0, Math.PI / 2]}>
							<torusGeometry args={[0.04, 0.012, 6, 12]} />
							<meshStandardMaterial color="#94a3b8" metalness={0.8} />
						</mesh>
					))}
					{/* မွှေနေသော ယောက်မရိုးရှည် (Soup Ladle Handle) */}
					<mesh position={[0.1, 1.15, 0]} rotation={[0.2, 0, -0.3]}>
						<cylinderGeometry args={[0.01, 0.01, 0.45, 6]} />
						<meshStandardMaterial color="#94a3b8" metalness={0.7} />
					</mesh>

					{/* မုန့်ဖတ်တောင်း (Bamboo Noodle Basket with White Vermicelli) */}
					<group position={[0, 0.78, 0.7]}>
						{/* ဝါးတောင်း (Wicker Basket) */}
						<mesh position={[0, 0.08, 0]}>
							<cylinderGeometry args={[0.22, 0.18, 0.16, 12]} />
							<meshStandardMaterial color="#ca8a04" roughness={0.9} />
						</mesh>
						{/* အထဲရှိ မုန့်ဟင်းခါး မုန့်ဖတ်ဖြူများ (White Rice Vermicelli) */}
						<mesh position={[0, 0.14, 0]}>
							<sphereGeometry args={[0.18, 10, 8]} />
							<meshStandardMaterial color="#f8fafc" roughness={0.7} />
						</mesh>
					</group>

					{/* စားသုံးရန် အဆင်သင့် မုန့်ဟင်းခါး ပန်းကန် ၂ လုံး (Ready Mohinga Bowls) */}
					{[-0.15, 0.18].map((bx, bi) => (
						<group key={bi} position={[bx, 0.72, 1.05]}>
							<mesh position={[0, 0.04, 0]}>
								<cylinderGeometry args={[0.09, 0.05, 0.06, 12]} />
								<meshStandardMaterial color="#f8fafc" />
							</mesh>
							{/* အထဲရှိ မုန့်ဟင်းခါးရည်နှင့် ကြက်ဥပြုတ်၊ နံနံပင် (Soup Broth & Toppings) */}
							<mesh position={[0, 0.06, 0]}>
								<cylinderGeometry args={[0.08, 0.08, 0.01, 10]} />
								<meshStandardMaterial color="#b45309" roughness={0.3} />
							</mesh>
							{/* ကြက်ဥပြုတ်စိတ် (Boiled Egg Slice) */}
							<mesh position={[0.03, 0.07, 0]} rotation={[0, 0.4, 0]}>
								<cylinderGeometry args={[0.025, 0.025, 0.012, 8]} />
								<meshStandardMaterial color="#fef08a" />
							</mesh>
						</group>
					))}
				</group>

				{/* ======================================================== */}
				{/* ၅။ ဧည့်သည်ထိုင် စားပွဲဝိုင်းနှင့် ခုံပုများ (Customer Tea Table & Stools) */}
				{/* ======================================================== */}
				<group position={[2.2, 0.08, 5.85]} name="customer-dining-table">
					{/* စားပွဲဝိုင်း သစ်သားခုံ (Round Wooden Tea Table: Radius 0.55m, Height 0.65m) */}
					<mesh position={[0, 0.65, 0]} castShadow>
						<cylinderGeometry args={[0.55, 0.55, 0.04, 20]} />
						<meshStandardMaterial color="#8c6744" roughness={0.7} />
					</mesh>
					{/* စားပွဲ အလယ်တိုင်နှင့် အောက်ခံခြေ (Center Pedestal Leg & Base) */}
					<mesh position={[0, 0.33, 0]}>
						<cylinderGeometry args={[0.06, 0.08, 0.62, 8]} />
						<meshStandardMaterial color="#6b4c30" />
					</mesh>
					<mesh position={[0, 0.02, 0]}>
						<cylinderGeometry args={[0.32, 0.32, 0.03, 12]} />
						<meshStandardMaterial color="#6b4c30" />
					</mesh>

					{/* မြန်မာ့ရိုးရာ ရောင်စုံ ခုံပု ၄ လုံး (4 Colorful Tea Shop Stools around table) */}
					{[
						[0, 0.72, '#0891b2'], // Turquoise Cyan
						[0, -0.72, '#dc2626'], // Ruby Red
						[-0.72, 0, '#65a30d'], // Lime Green
						[0.72, 0, '#78350f'], // Teak Brown
					].map(([sx, sz, scolor], si) => (
						<group key={si} position={[sx as number, 0, sz as number]}>
							{/* ခုံထိုင်ခုံပြား (Stool Seat) */}
							<mesh position={[0, 0.38, 0]} castShadow>
								<cylinderGeometry args={[0.16, 0.16, 0.035, 12]} />
								<meshStandardMaterial color={scolor as string} roughness={0.6} />
							</mesh>
							{/* ခုံခြေထောက် ၄ ချောင်း (4 Stool Legs) */}
							{[-0.09, 0.09].map((lx) =>
								[-0.09, 0.09].map((lz) => (
									<mesh key={`${lx}-${lz}`} position={[lx, 0.18, lz]}>
										<cylinderGeometry args={[0.015, 0.015, 0.36, 6]} />
										<meshStandardMaterial color="#334155" />
									</mesh>
								))
							)}
						</group>
					))}

					{/* စားပွဲပေါ်ရှိ မြန်မာ့လက်ဖက်ရည်ခွက်များနှင့် ဓာတ်ဗူး (Burmese Tea Cups & Thermos on Table) */}
					{/* ၁။ ဓာတ်ဗူးနီ (Chinese Pattern Red Thermos Flask) */}
					<group position={[-0.18, 0.67, 0.15]}>
						<mesh position={[0, 0.15, 0]} castShadow>
							<cylinderGeometry args={[0.06, 0.065, 0.28, 12]} />
							<meshStandardMaterial color="#dc2626" roughness={0.4} />
						</mesh>
						{/* ဓာတ်ဗူး အပေါ်စတီးဖုံး (Chrome Cap) */}
						<mesh position={[0, 0.3, 0]}>
							<cylinderGeometry args={[0.045, 0.055, 0.04, 10]} />
							<meshStandardMaterial color="#e2e8f0" metalness={0.8} />
						</mesh>
					</group>

					{/* ၂။ ရေနွေးကြမ်းအိုးစိမ်း (Green Chinese Teapot) */}
					<mesh position={[0.15, 0.74, -0.1]} castShadow>
						<sphereGeometry args={[0.065, 10, 8]} />
						<meshStandardMaterial color="#15803d" roughness={0.3} />
					</mesh>

					{/* ၃။ မြန်မာ့လက်ဖက်ရည် ဖန်ခွက် ၂ ခွက် (2 Glass Cups of Sweet Burmese Milk Tea) */}
					{[-0.05, 0.18].map((tx, ti) => (
						<group key={ti} position={[tx, 0.67, 0.28]}>
							<mesh position={[0, 0.045, 0]}>
								<cylinderGeometry args={[0.032, 0.026, 0.08, 10]} />
								<meshStandardMaterial color="#bae6fd" transparent opacity={0.4} roughness={0.1} />
							</mesh>
							{/* လက်ဖက်ရည် ချိုဆိမ့်ရောင် (Golden-brown milk tea liquid inside) */}
							<mesh position={[0, 0.038, 0]}>
								<cylinderGeometry args={[0.028, 0.024, 0.06, 8]} />
								<meshStandardMaterial color="#c2844b" roughness={0.3} />
							</mesh>
						</group>
					))}
				</group>

				{/* ၆။ ခြံစည်းရိုးနှင့် လမ်းမဘက် အဝင်ပေါက် (Compound Fences with Open Shop Entrance) */}
				{/* ဘယ်ဘက် ခြံစည်းရိုးသံဇကာ (Left Fence along side) */}
				<mesh position={[-4.7, 0.9, 5.8]} rotation={[0, Math.PI / 2, 0]}>
					<boxGeometry args={[2.7, 1.6, 0.05]} />
					<meshStandardMaterial color="#68767a" roughness={0.6} />
				</mesh>
				{/* ညာဘက် ခြံစည်းရိုးသံဇကာ (Right Fence along side) */}
				<mesh position={[4.7, 0.9, 5.8]} rotation={[0, Math.PI / 2, 0]}>
					<boxGeometry args={[2.7, 1.6, 0.05]} />
					<meshStandardMaterial color="#68767a" roughness={0.6} />
				</mesh>
			</group>
		</group>
	);
}
import {FestivalAnchor,PorchCandles} from './FestivalAnchor';
