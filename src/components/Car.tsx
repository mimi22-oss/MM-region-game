import { CarBodywork } from './CarBodywork';
import { useAppearance } from '../game/appearanceStore';
import type { CarModel } from '../data/appearance';
import {useTrafficCollider} from './useTrafficCollider';
import { windshieldGeometry, windshieldFrameGeometry, roofBoxRibbonGeometry } from '../game/carWindshield';
import { useMemo,useRef } from 'react';
import { useRegionFrame as useFrame } from './RegionActivity';
import {Group} from 'three';
import {sceneGround,carGroundPose} from '../game/groundSurface';
import { Shape, Path, DoubleSide } from 'three';
import { driveableCars, carRide, carInput, frontWheelAngle, STEERING_RATIO, type DriveableCar } from '../game/carRide';
import { CartoonCharacter, type DrivingPose } from './CartoonCharacter';
import { CarInterior } from './CarInterior';
import { carBodyShellGeometry, DRIVER_POSITION, DRIVER_SCALE, STEERING_POSITION, STEERING_RADIUS, STEERING_TILT } from '../game/carCabin';

/** Rounded reference-inspired compact car with crystal-clear windshield & detailed cabin interior; front is -Z. */
export function Car({ color = '#277fbd', size = 1, model='compact', motion }: { color?: string; size?: number; model?:CarModel; motion?: { distance: number; steering: number; wheelTravel: number[]; speed?: number } }) {
	const wheelSteers=useRef<(Group|null)[]>([]),wheelSpins=useRef<(Group|null)[]>([]),steeringWheel=useRef<Group>(null);
	useFrame(()=>{
		if(!motion)return;
		wheelSteers.current.forEach((wheel,i)=>{
			if(wheel)wheel.rotation.y=i%2===0?frontWheelAngle(motion.steering,i<2?-1:1,size):0;
		});
		wheelSpins.current.forEach((wheel,i)=>{
			if(wheel)wheel.rotation.x=-motion.wheelTravel[i]/(.43*size);
		});
		if(steeringWheel.current)steeringWheel.current.rotation.z=-motion.steering*STEERING_RATIO;
	});
	const lowerBody = useMemo(()=>carBodyShellGeometry(model), [model]);

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
	const windshieldSeal = useMemo(() => windshieldFrameGeometry(), []);
	// 2. Crystal-clear front windshield glass pane
	const windshieldGlass = useMemo(() => windshieldGeometry(0.54, 0.02, 0.272, 0.046), []);
	// 3. Specular reflection highlight streaks (gives tangible glossy glass sheen)
	const windshieldGlareLeft = useMemo(() => windshieldGeometry(0.08, 0.045, 0.25, 0.049, -0.26), []);
	const windshieldGlareRight = useMemo(() => windshieldGeometry(0.04, 0.065, 0.23, 0.049, -0.10), []);

	// Rear Windshield Assemblies:
	const rearSeal = useMemo(() => windshieldFrameGeometry(0.57, 0.68, 0.89, 0.038), []);
	const rearGlass = useMemo(() => windshieldGeometry(0.54, 0.695, 0.875, 0.046), []);

	// Side Windows:
	const sideWindows = useMemo(() => {
		const rear = new Shape();
		rear.moveTo(-1.08, 1.24);
		rear.quadraticCurveTo(-1.03, 1.87, -0.28, 2.02);
		rear.quadraticCurveTo(-0.16, 2.04, -0.16, 1.90);
		rear.lineTo(-0.16, 1.20);
		rear.quadraticCurveTo(-0.16, 1.16, -0.31, 1.16);
		rear.lineTo(-0.91, 1.16);
		rear.quadraticCurveTo(-1.08, 1.16, -1.08, 1.24);

		const front = new Shape();
		front.moveTo(0.02, 1.20);
		front.lineTo(0.02, 1.93);
		front.quadraticCurveTo(0.02, 2.07, 0.17, 2.01);
		front.quadraticCurveTo(0.68, 1.85, 0.77, 1.24);
		front.quadraticCurveTo(0.79, 1.16, 0.65, 1.16);
		front.lineTo(0.13, 1.16);
		front.quadraticCurveTo(0.02, 1.16, 0.02, 1.20);
		return [rear, front];
	}, []);
	const sideFrames=useMemo(()=>sideWindows.map(shape=>{
	 const points=shape.getPoints(24),frame=shape.clone(),cx=(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,cy=(Math.min(...points.map(p=>p.y))+Math.max(...points.map(p=>p.y)))/2;
	 frame.holes.push(new Path(points.map(p=>p.clone().set(cx+(p.x-cx)*.94,cy+(p.y-cy)*.94))));return frame;
	}),[sideWindows]);

	return (
		<group scale={size} name="cartoon-compact-car" userData={{model}}>
			{/* အောက်ပိုင်း ကိုယ်ထည် (Lower Car Body) */}
			<mesh name="car-body-shell" geometry={lowerBody} castShadow receiveShadow>
				<meshStandardMaterial color={color} metalness={0.18} roughness={0.32} />
			</mesh>

			{model==='compact'?<>
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

			</>:<CarBodywork model={model} color={color}/>}
			<CarInterior motion={motion} model={model}/>

			{/* စတီယာရင်ခွေ (Steering Wheel) */}
			<group position={STEERING_POSITION}>
				<mesh position={[0, -0.05, -0.07]} rotation={[STEERING_TILT, 0, 0]}>
					<cylinderGeometry args={[0.025, 0.025, 0.16, 10]} />
					<meshStandardMaterial color="#171b1f" roughness={0.8} />
				</mesh>
				<group rotation={[STEERING_TILT, 0, 0]}><group ref={steeringWheel} name="steering-wheel">
				<mesh>
					<torusGeometry args={[STEERING_RADIUS, 0.018, 8, 32]} />
					<meshStandardMaterial color="#1e2329" roughness={0.7} />
				</mesh>
				{[0,Math.PI*2/3,Math.PI*4/3].map(a=><mesh key={a} position={[Math.sin(a)*.095,Math.cos(a)*.095,0]} rotation={[0,0,-a]}><boxGeometry args={[.017,.15,.016]}/><meshStandardMaterial color="#59616a" roughness={.6}/></mesh>)}
				<mesh rotation={[Math.PI/2, 0, 0]}>
					<cylinderGeometry args={[0.045, 0.045, 0.02, 12]} />
					<meshStandardMaterial color="#2a323a" roughness={0.6} />
				</mesh>
				</group></group>
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

			{model==='compact'&&<>
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
					opacity={0.16}
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
					opacity={0.18}
					depthWrite={false}
					side={DoubleSide}
				/>
			</mesh>

			</>}
			{/* ဘေးတံခါး၊ မှန်၊ မီးခွက်များနှင့် ဘီးများ (Side Doors, Windows, Lights & Wheels) */}
			{[-1, 1].map((side) => (
				<group key={side}>
					{/* ဘေးပြတင်းပေါက် မှန်ကြည်လင်သား (Clear Side Windows with Black Rubber Trim) */}
					{model==='compact'&&sideWindows.map((shape, i) => (
						<group key={i} position={[side * 0.77, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
							{/* ဘောင်နက် (Rubber border trim) */}
							<mesh>
								<shapeGeometry args={[sideFrames[i]]} />
								<meshStandardMaterial color="#131c22" roughness={0.7} side={DoubleSide} />
							</mesh>
							{/* ဘေးမှန်ကြည် (Transparent side glass) */}
							<mesh position={[0, 0, side * 0.005]}>
								<shapeGeometry args={[shape]} />
								<meshStandardMaterial
									color="#d8f4fa"
									emissive="#72d3e9"
									emissiveIntensity={0.10}
									roughness={0.04}
									metalness={0.18}
									transparent
									opacity={0.18}
									depthWrite={false}
									side={DoubleSide}
								/>
							</mesh>
						</group>
					))}

					{/* B-Pillar တံခါးခွဲတိုင် (Center Pillar Divider) */}
					<mesh visible={model==='compact'} position={[side * 0.78, 1.58, 0.07]}>
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
						<group
							key={z}
							name={`${side<0?'left':'right'}-${z<0?'front':'rear'}-wheel`}
							ref={node=>{wheelSteers.current[(side===-1?0:2)+(z<0?0:1)]=node}}
							position={[side * 0.79, 0.43, z]}
						>
							<group ref={node=>{wheelSpins.current[(side===-1?0:2)+(z<0?0:1)]=node}}>
								<group rotation={[0, 0, Math.PI / 2]}>
									<mesh castShadow>
										<cylinderGeometry args={[0.43, 0.43, 0.22, 24]} />
										<meshStandardMaterial color="#2d2527" roughness={0.95} />
									</mesh>
									<mesh position={[0, -side * 0.12, 0]}>
										<cylinderGeometry args={[0.26, 0.26, 0.025, 24]} />
										<meshStandardMaterial color="#f4932e" roughness={0.4} />
									</mesh>
									<mesh position={[0, -side * 0.136, 0]}>
										<cylinderGeometry args={[0.075, 0.075, 0.015, 16]} />
										<meshStandardMaterial color="#ffb24f" />
									</mesh>
									{/* အပြင်က ကားဘီးများကဲ့သို့ လည်ပတ်မှု ထင်ရှားစေရန် ၅ ချောင်းပါ အလွိုင်းဒေါက် (5-Spoke Alloy Rim & Lug Nuts) */}
									{[0, 1, 2, 3, 4].map((k) => {
										const ang = (k * Math.PI * 2) / 5;
										return (
											<group key={k}>
												<mesh position={[Math.sin(ang) * 0.15, -side * 0.122, Math.cos(ang) * 0.15]} rotation={[0, -ang, 0]}>
													<boxGeometry args={[0.042, 0.016, 0.18]} />
													<meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.25} />
												</mesh>
												<mesh position={[Math.sin(ang) * 0.052, -side * 0.132, Math.cos(ang) * 0.052]}>
													<cylinderGeometry args={[0.011, 0.011, 0.012, 6]} />
													<meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.15} />
												</mesh>
											</group>
										);
									})}
								</group>
							</group>
						</group>
					))}

					{/* ရှေ့မီးကြီးများ (Headlights) */}
					<mesh visible={model==='compact'} position={[side * 0.52, 0.95, -1.55]} scale={[0.17, 0.22, 0.07]}>
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

function GroundedCar({car}:{car:DriveableCar}){
 const appearance=useAppearance();
 const root=useRef<Group>(null),driver=useRef<Group>(null),motion=useRef({speed:0,distance:0,stepLift:0,leftFoot:0,rightFoot:0});
 const driving=useRef<DrivingPose>({active:false,wheelAngle:0,interior:true,clutch:false,brake:false,throttle:false});
 useTrafficCollider(root,car.width*car.size,car.depth*car.size,'car');
 useFrame(({scene,clock})=>{
   if(!root.current)return;
   const ground=sceneGround(scene,clock.elapsedTime),p=carGroundPose(car.x,car.z,car.yaw,car.size,(x,z)=>ground.height(x,z));
   car.groundY=p.y;car.pitch=p.pitch;car.roll=p.roll;
   root.current.position.set(car.x,p.y,car.z);
   root.current.rotation.set(p.pitch,car.yaw,p.roll,'YXZ');
   motion.current.speed=car.speed;
   motion.current.distance=car.distance;
   Object.assign(driving.current,{active:carRide.carId===car.id,wheelAngle:-car.steering*STEERING_RATIO,interior:carRide.interior,clutch:carInput.clutch,brake:carInput.brake,throttle:carInput.throttle});
   if(driver.current)driver.current.visible=carRide.carId===car.id;
 });
 return (
   <group ref={root} name={`driveable-${car.id}`} userData={{dynamic:true,carId:car.id}} position={[car.x,0,car.z]}>
     <Car color={car.color} size={car.size} model={car.model} motion={car}/>
     <group name="car-driver" ref={driver} visible={false} position={[DRIVER_POSITION[0]*car.size,DRIVER_POSITION[1]*car.size,DRIVER_POSITION[2]*car.size]} scale={DRIVER_SCALE*car.size}>
       <CartoonCharacter appearance={appearance.human} motion={motion} driving={driving}/>
     </group>
   </group>
 );
}
export function ParkedCars(){return <>{driveableCars.map(car=><GroundedCar key={car.id} car={car}/>)}</>}

export function ParkedCarsPlan() {
	return (
		<>
			{driveableCars.map((car) => (
				<g key={car.id} transform={`translate(${car.x} ${car.z}) rotate(${(-car.yaw * 180) / Math.PI})`}>
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
