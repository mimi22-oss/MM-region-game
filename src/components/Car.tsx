import { windshieldGeometry, roofBoxRibbonGeometry } from '../game/carWindshield';
import { useMemo } from 'react';
import { Shape, ExtrudeGeometry, DoubleSide } from 'three';
import { parkedCars } from '../data/cars';

/** Rounded reference-inspired compact car with crystal-clear windshield & detailed cabin interior; front is -Z. */
export function Car({ color = '#277fbd', size = 1 }: { color?: string; size?: number }) {
	// Lower car body (stops cleanly at the beltline y ~ 1.24, leaving cabin open for genuine transparent glass)
	const lowerBody = useMemo(() => {
		const s = new Shape();
		s.moveTo(-1.55, 0.43);
		s.lineTo(1.64, 0.43);
		s.quadraticCurveTo(1.78, 1.15, 0.76, 1.26); // front nose, bumper & hood
		s.lineTo(-1.18, 1.24); // beltline along doors and rear quarter
		s.quadraticCurveTo(-1.44, 1.18, -1.55, 0.43); // rear trunk / bumper curve
		s.closePath();
		const g = new ExtrudeGeometry(s, {
			depth: 1.42,
			bevelEnabled: true,
			bevelSegments: 3,
			steps: 1,
			bevelSize: 0.07,
			bevelThickness: 0.07,
			curveSegments: 16,
		});
		g.translate(0, 0, -0.71);
		return g;
	}, []);

	// Upper cabin arched roof cap (covers cabin top from t=0.27 to t=0.69)
	const roofCap = useMemo(() => roofBoxRibbonGeometry(-0.70, 0.70, 0.27, 0.69, -0.015, 0.075, 16), []);

	// Left & Right A-Pillars (connecting cowl to roof cap)
	const aPillarLeft = useMemo(() => roofBoxRibbonGeometry(-0.71, -0.57, 0.01, 0.28, -0.015, 0.075, 10), []);
	const aPillarRight = useMemo(() => roofBoxRibbonGeometry(0.57, 0.71, 0.01, 0.28, -0.015, 0.075, 10), []);

	// Left & Right C-Pillars (connecting roof cap to rear quarter)
	const cPillarLeft = useMemo(() => roofBoxRibbonGeometry(-0.71, -0.56, 0.68, 0.89, -0.015, 0.075, 10), []);
	const cPillarRight = useMemo(() => roofBoxRibbonGeometry(0.56, 0.71, 0.68, 0.89, -0.015, 0.075, 10), []);

	// Front Windshield Assemblies:
	// 1. Black rubber weatherstrip frame around the front opening
	const windshieldSeal = useMemo(() => windshieldGeometry(0.57, 0.008, 0.282, 0.038), []);
	// 2. Crystal-clear front windshield glass pane
	const windshieldGlass = useMemo(() => windshieldGeometry(0.54, 0.02, 0.272, 0.046), []);
	// 3. Specular reflection highlight streaks (gives tangible glossy glass sheen)
	const windshieldGlareLeft = useMemo(() => windshieldGeometry(0.08, 0.045, 0.25, 0.049, -0.26), []);
	const windshieldGlareRight = useMemo(() => windshieldGeometry(0.04, 0.065, 0.23, 0.049, -0.10), []);

	// Rear Windshield Assemblies:
	const rearSeal = useMemo(() => windshieldGeometry(0.57, 0.68, 0.89, 0.038), []);
	const rearGlass = useMemo(() => windshieldGeometry(0.54, 0.695, 0.875, 0.046), []);

	// Side Windows:
	const sideWindows = useMemo(() => {
		const rear = new Shape();
		rear.moveTo(-1.08, 1.28);
		rear.quadraticCurveTo(-1.03, 1.87, -0.28, 2.02);
		rear.quadraticCurveTo(-0.16, 2.04, -0.16, 1.90);
		rear.lineTo(-0.16, 1.28);
		rear.quadraticCurveTo(-0.16, 1.20, -0.31, 1.20);
		rear.lineTo(-0.91, 1.20);
		rear.quadraticCurveTo(-1.08, 1.20, -1.08, 1.28);

		const front = new Shape();
		front.moveTo(0.02, 1.26);
		front.lineTo(0.02, 1.93);
		front.quadraticCurveTo(0.02, 2.07, 0.17, 2.01);
		front.quadraticCurveTo(0.68, 1.85, 0.77, 1.28);
		front.quadraticCurveTo(0.79, 1.20, 0.65, 1.20);
		front.lineTo(0.13, 1.20);
		front.quadraticCurveTo(0.02, 1.20, 0.02, 1.26);
		return [rear, front];
	}, []);

	return (
		<group scale={size} name="cartoon-compact-car">
			{/* အောက်ပိုင်း ကိုယ်ထည် (Lower Car Body) */}
			<mesh geometry={lowerBody} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
				<meshStandardMaterial color={color} metalness={0.18} roughness={0.32} />
			</mesh>

			{/* အပေါ်ခေါင်မိုး (Roof Cap Panel) */}
			<mesh geometry={roofCap} castShadow receiveShadow>
				<meshStandardMaterial color={color} metalness={0.18} roughness={0.32} side={DoubleSide} />
			</mesh>

			{/* ကားရှေ့တိုင် A-Pillars (Left & Right) */}
			<mesh geometry={aPillarLeft} castShadow receiveShadow>
				<meshStandardMaterial color={color} metalness={0.18} roughness={0.32} side={DoubleSide} />
			</mesh>
			<mesh geometry={aPillarRight} castShadow receiveShadow>
				<meshStandardMaterial color={color} metalness={0.18} roughness={0.32} side={DoubleSide} />
			</mesh>

			{/* ကားနောက်တိုင် C-Pillars (Left & Right) */}
			<mesh geometry={cPillarLeft} castShadow receiveShadow>
				<meshStandardMaterial color={color} metalness={0.18} roughness={0.32} side={DoubleSide} />
			</mesh>
			<mesh geometry={cPillarRight} castShadow receiveShadow>
				<meshStandardMaterial color={color} metalness={0.18} roughness={0.32} side={DoubleSide} />
			</mesh>

			{/* ၃D အတွင်းခန်း (3D Cabin Interior visible through glass) */}
			{/* အတွင်းကြမ်းပြင် (Cabin Floor) */}
			<mesh position={[0, 0.60, 0.15]}>
				<boxGeometry args={[1.30, 0.06, 2.0]} />
				<meshStandardMaterial color="#15191d" roughness={0.9} />
			</mesh>

			{/* ဒက်ရှ်ဘုတ်ခုံ (Dashboard Console) */}
			<mesh position={[0, 1.18, -0.50]}>
				<boxGeometry args={[1.22, 0.18, 0.36]} />
				<meshStandardMaterial color="#1a1e22" roughness={0.85} />
			</mesh>
			{/* ယာဉ်မောင်းဘက် အမြန်နှုန်းပြဒိုင်ခွက်ခုံး (Driver Instrument Cluster Hood & Glow) */}
			<mesh position={[0.28, 1.28, -0.48]}>
				<boxGeometry args={[0.34, 0.08, 0.32]} />
				<meshStandardMaterial color="#13161a" roughness={0.8} />
			</mesh>
			<mesh position={[0.28, 1.24, -0.31]}>
				<circleGeometry args={[0.065, 16]} />
				<meshStandardMaterial color="#0c1520" emissive="#38bdf8" emissiveIntensity={0.65} />
			</mesh>
			{/* အလယ်စခရင် (Center Console Infotainment Glow) */}
			<mesh position={[0, 1.21, -0.31]}>
				<planeGeometry args={[0.20, 0.12]} />
				<meshStandardMaterial color="#0c1520" emissive="#38bdf8" emissiveIntensity={0.5} />
			</mesh>

			{/* စတီယာရင်ခွေ (Steering Wheel) */}
			<group position={[0.28, 1.23, -0.27]}>
				<mesh position={[0, -0.05, -0.07]} rotation={[-0.45, 0, 0]}>
					<cylinderGeometry args={[0.025, 0.025, 0.16, 10]} />
					<meshStandardMaterial color="#171b1f" roughness={0.8} />
				</mesh>
				<mesh rotation={[-0.45, 0, 0]}>
					<torusGeometry args={[0.13, 0.018, 8, 24]} />
					<meshStandardMaterial color="#1e2329" roughness={0.7} />
				</mesh>
				<mesh rotation={[-0.45, 0, 0]}>
					<cylinderGeometry args={[0.045, 0.045, 0.02, 12]} />
					<meshStandardMaterial color="#2a323a" roughness={0.6} />
				</mesh>
			</group>

			{/* ရှေ့ထိုင်ခုံ ၂ လုံး (Driver & Passenger Front Bucket Seats with Headrests) */}
			{[-0.28, 0.28].map((x) => (
				<group key={x}>
					{/* ထိုင်ခုံအခင်း (Seat Bottom Cushion) */}
					<mesh position={[x, 0.76, 0.05]}>
						<boxGeometry args={[0.36, 0.12, 0.40]} />
						<meshStandardMaterial color="#222930" roughness={0.8} />
					</mesh>
					{/* ခါးမှီ (Seat Backrest) */}
					<mesh position={[x, 1.08, 0.22]} rotation={[0.15, 0, 0]}>
						<boxGeometry args={[0.34, 0.46, 0.10]} />
						<meshStandardMaterial color="#222930" roughness={0.8} />
					</mesh>
					{/* ခေါင်းမှီ (Headrest) */}
					<mesh position={[x, 1.38, 0.27]}>
						<boxGeometry args={[0.18, 0.13, 0.09]} />
						<meshStandardMaterial color="#2a323b" roughness={0.8} />
					</mesh>
				</group>
			))}

			{/* နောက်ထိုင်ခုံတန်း (Rear Passenger Bench Seat) */}
			<group>
				<mesh position={[0, 0.76, 0.72]}>
					<boxGeometry args={[1.22, 0.12, 0.38]} />
					<meshStandardMaterial color="#222930" roughness={0.8} />
				</mesh>
				<mesh position={[0, 1.08, 0.90]} rotation={[0.15, 0, 0]}>
					<boxGeometry args={[1.22, 0.46, 0.10]} />
					<meshStandardMaterial color="#222930" roughness={0.8} />
				</mesh>
				{[-0.32, 0.32].map((x) => (
					<mesh key={x} position={[x, 1.37, 0.95]}>
						<boxGeometry args={[0.18, 0.13, 0.09]} />
						<meshStandardMaterial color="#2a323b" roughness={0.8} />
					</mesh>
				))}
			</group>

			{/* ကားအတွင်း နောက်ကြည့်မှန် (Interior Rearview Mirror) */}
			<group position={[0, 1.93, -0.30]}>
				<mesh position={[0, 0.035, -0.015]}>
					<cylinderGeometry args={[0.012, 0.012, 0.07, 8]} />
					<meshStandardMaterial color="#14181c" roughness={0.8} />
				</mesh>
				<mesh rotation={[0.16, 0, 0]}>
					<boxGeometry args={[0.18, 0.06, 0.025]} />
					<meshStandardMaterial color="#14181c" roughness={0.7} />
				</mesh>
				<mesh position={[0, 0, 0.014]} rotation={[0.16, 0, 0]}>
					<planeGeometry args={[0.17, 0.052]} />
					<meshStandardMaterial color="#bfeaf3" metalness={0.85} roughness={0.08} />
				</mesh>
			</group>

			{/* ======================================================== */}
			{/* ကားရှေ့ လေကာမှန်အစုံ (FRONT WINDSHIELD GLASS ASSEMBLY) */}
			{/* ======================================================== */}
			{/* ၁။ အနက်ရောင် ရော်ဘာဘောင် (Rubber Weatherstrip Seal Border) */}
			<mesh geometry={windshieldSeal}>
				<meshStandardMaterial color="#12181d" roughness={0.75} side={DoubleSide} />
			</mesh>

			{/* ၂။ ကြည်လင်သော မှန်သားအစစ် (Crystal-Clear Front Windshield Glass) */}
			<mesh geometry={windshieldGlass}>
				<meshStandardMaterial
					color="#daf4fb"
					emissive="#7adbf2"
					emissiveIntensity={0.12}
					roughness={0.03}
					metalness={0.15}
					transparent
					opacity={0.38}
					depthWrite={false}
					side={DoubleSide}
				/>
			</mesh>

			{/* ၃။ နေရောင်/ကောင်းကင်ရောင်ပြန် မှန်မျက်နှာပြင် အစင်းကြောင်း (Specular Glass Glare Streaks) */}
			<mesh geometry={windshieldGlareLeft}>
				<meshStandardMaterial
					color="#ffffff"
					emissive="#ffffff"
					emissiveIntensity={0.25}
					roughness={0.02}
					transparent
					opacity={0.30}
					depthWrite={false}
					side={DoubleSide}
				/>
			</mesh>
			<mesh geometry={windshieldGlareRight}>
				<meshStandardMaterial
					color="#ffffff"
					emissive="#ffffff"
					emissiveIntensity={0.18}
					roughness={0.02}
					transparent
					opacity={0.20}
					depthWrite={false}
					side={DoubleSide}
				/>
			</mesh>

			{/* ၄။ ကားရှေ့မှန် သုတ်တံ ၂ ခု (Dual Windshield Wipers) */}
			<group>
				<mesh position={[-0.22, 1.33, -0.73]} rotation={[-0.42, 0.18, 0.22]}>
					<boxGeometry args={[0.018, 0.014, 0.42]} />
					<meshStandardMaterial color="#14181c" roughness={0.8} />
				</mesh>
				<mesh position={[0.16, 1.33, -0.73]} rotation={[-0.42, 0.18, 0.22]}>
					<boxGeometry args={[0.018, 0.014, 0.42]} />
					<meshStandardMaterial color="#14181c" roughness={0.8} />
				</mesh>
			</group>

			{/* ကားနောက်လေကာမှန် (Rear Windshield Glass Assembly) */}
			<mesh geometry={rearSeal}>
				<meshStandardMaterial color="#12181d" roughness={0.75} side={DoubleSide} />
			</mesh>
			<mesh geometry={rearGlass}>
				<meshStandardMaterial
					color="#daf4fb"
					emissive="#65c7df"
					emissiveIntensity={0.10}
					roughness={0.04}
					metalness={0.16}
					transparent
					opacity={0.42}
					depthWrite={false}
					side={DoubleSide}
				/>
			</mesh>

			{/* ဘေးတံခါး၊ မှန်၊ မီးခွက်များနှင့် ဘီးများ (Side Doors, Windows, Lights & Wheels) */}
			{[-1, 1].map((side) => (
				<group key={side}>
					{/* ဘေးပြတင်းပေါက် မှန်ကြည်လင်သား (Clear Side Windows with Black Rubber Trim) */}
					{sideWindows.map((shape, i) => (
						<group key={i} position={[side * 0.77, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
							{/* ဘောင်နက် (Rubber border trim) */}
							<mesh>
								<shapeGeometry args={[shape]} />
								<meshStandardMaterial color="#131c22" roughness={0.7} side={DoubleSide} />
							</mesh>
							{/* ဘေးမှန်ကြည် (Transparent side glass) */}
							<mesh position={[0, 0.03, side * 0.005]} scale={[0.94, 0.94, 1]}>
								<shapeGeometry args={[shape]} />
								<meshStandardMaterial
									color="#d8f4fa"
									emissive="#72d3e9"
									emissiveIntensity={0.10}
									roughness={0.04}
									metalness={0.18}
									transparent
									opacity={0.40}
									depthWrite={false}
									side={DoubleSide}
								/>
							</mesh>
						</group>
					))}

					{/* B-Pillar တံခါးခွဲတိုင် (Center Pillar Divider) */}
					<mesh position={[side * 0.78, 1.58, 0.07]}>
						<boxGeometry args={[0.022, 0.72, 0.05]} />
						<meshStandardMaterial color="#152129" roughness={0.6} />
					</mesh>

					{/* ဘေးနောက်ကြည့်မှန် (Side Rearview Mirrors) */}
					<group position={[side * 0.75, 1.25, -0.60]}>
						<mesh position={[side * 0.03, 0, 0]}>
							<boxGeometry args={[0.07, 0.024, 0.04]} />
							<meshStandardMaterial color="#152129" roughness={0.7} />
						</mesh>
						<mesh position={[side * 0.08, 0.01, 0]}>
							<boxGeometry args={[0.07, 0.09, 0.14]} />
							<meshStandardMaterial color={color} metalness={0.18} roughness={0.32} />
						</mesh>
						<mesh
							position={[side * 0.08, 0.01, 0.071]}
							rotation={[0, side > 0 ? -Math.PI / 12 : Math.PI / 12, 0]}
						>
							<planeGeometry args={[0.06, 0.08]} />
							<meshStandardMaterial color="#bfeaf3" metalness={0.85} roughness={0.08} />
						</mesh>
					</group>

					{/* တံခါးလက်ကိုင်များ (Door Handles) */}
					{[-0.25, 0.88].map((z) => (
						<mesh key={z} position={[side * 0.81, 1.04, z]}>
							<boxGeometry args={[0.035, 0.055, 0.20]} />
							<meshStandardMaterial color="#d8dedc" metalness={0.5} roughness={0.3} />
						</mesh>
					))}

					{/* ကားဘီးများ (Front & Rear Wheels) */}
					{[-1.04, 1.04].map((z) => (
						<group key={z} position={[side * 0.79, 0.43, z]} rotation={[0, 0, Math.PI / 2]}>
							<mesh castShadow>
								<cylinderGeometry args={[0.43, 0.43, 0.22, 24]} />
								<meshStandardMaterial color="#2d2527" roughness={0.95} />
							</mesh>
							<mesh position={[0, -side * 0.12, 0]}>
								<cylinderGeometry args={[0.25, 0.25, 0.025, 24]} />
								<meshStandardMaterial color="#f4932e" roughness={0.4} />
							</mesh>
							<mesh position={[0, -side * 0.136, 0]}>
								<cylinderGeometry args={[0.065, 0.065, 0.012, 16]} />
								<meshStandardMaterial color="#ffb24f" />
							</mesh>
						</group>
					))}

					{/* ရှေ့မီးကြီးများ (Headlights) */}
					<mesh position={[side * 0.52, 0.95, -1.55]} scale={[0.17, 0.22, 0.07]}>
						<sphereGeometry args={[1, 16, 12]} />
						<meshStandardMaterial color="#ffe34b" emissive="#ffbd24" emissiveIntensity={0.25} />
					</mesh>

					{/* နောက်မီးနီများ (Taillights) */}
					<mesh position={[side * 0.59, 0.87, 1.50]} scale={[0.10, 0.17, 0.06]}>
						<sphereGeometry args={[1, 12, 10]} />
						<meshStandardMaterial color="#ef4144" emissive="#b31215" emissiveIntensity={0.2} />
					</mesh>
				</group>
			))}

			{/* အရှေ့နှင့် အနောက် ဘမ်ဘာ အကာအရံများ (Front & Rear Chrome Bumpers) */}
			{[-1, 1].map((side) => (
				<mesh key={side} position={[0, 0.48, side * 1.68]} rotation={[0, 0, Math.PI / 2]}>
					<capsuleGeometry args={[0.10, 1.24, 4, 10]} />
					<meshStandardMaterial color="#d7dddc" metalness={0.45} roughness={0.35} />
				</mesh>
			))}
		</group>
	);
}

export function ParkedCars() {
	return (
		<>
			{parkedCars.map((car) => (
				<group key={car.id} position={[car.x, 0, car.z]} rotation={[0, car.rotation, 0]}>
					<Car color={car.color} size={car.size} />
				</group>
			))}
		</>
	);
}

export function ParkedCarsPlan() {
	return (
		<>
			{parkedCars.map((car) => (
				<g key={car.id} transform={`translate(${car.x} ${car.z}) rotate(${(-car.rotation * 180) / Math.PI})`}>
					<rect
						x={-car.width / 2}
						y={-car.depth / 2}
						width={car.width}
						height={car.depth}
						rx="0.4"
						fill={car.color}
						stroke="#182f3b"
						strokeWidth="0.2"
					/>
					<rect x="-0.6" y="-0.7" width="1.2" height="1" fill="#a3e0e8" />
				</g>
			))}
		</>
	);
}
