import {garmentGeometry,closedSleeveGeometry,coveredStride} from '../game/characterClothing';
import { CartoonFace } from './CartoonFace';
import { CartoonHair } from './CartoonHair';
import { createContext, useContext, useEffect, useMemo, useRef, type RefObject } from 'react';
import { HUMAN_PRESETS, type HumanAppearance } from '../data/appearance';
import { useFrame } from '@react-three/fiber';
import {
	BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Group,
	MeshStandardMaterial, SphereGeometry, Vector3, TubeGeometry, Quaternion, Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { driverGrip, DRIVER_POSITION, DRIVER_SCALE, STEERING_TILT } from '../game/carCabin';

type Point = [number, number, number];
export type CharacterMotion = { speed: number; distance: number; stepLift?:number;leftFoot?:number;rightFoot?:number };
export type DrivingPose = {active:boolean;wheelAngle:number;interior:boolean;clutch:boolean;brake:boolean;throttle:boolean};

// Shared resources keep switching characters inexpensive, including on phones.
const ball = new SphereGeometry(1, 20, 14);
const mat = (color: string, roughness = .8) => new MeshStandardMaterial({ color, roughness });
const defaultMaterials = {
	skin: mat('#e6ad7f', .67), innerEar: mat('#ce856d'), lips: mat('#925943'),
	hair: mat('#28242b', .72), hairLight: mat('#2c282e', .72), hairShade: mat('#25232b', .72),
	hoodie: mat('#6936ae'), hoodInside: mat('#412571'), rib: mat('#562e91'), seam: mat('#7946bb'),
	trousers: mat('#272934'), trouserSeam: mat('#343541'),
	white: mat('#f4f0e9', .64), sole: mat('#d6d8df'), lace: mat('#dddbe1'),
	eye: mat('#fff9ed', .2), iris: mat('#714524', .28), pupil: mat('#16131a', .17),
	shine: new MeshStandardMaterial({ color: '#ffffff', roughness: .12, emissive: '#ffffff', emissiveIntensity: .28 }),
};

const HumanContext=createContext<HumanAppearance>(HUMAN_PRESETS.boy);
const MaterialContext=createContext(defaultMaterials);
function useHumanMaterials(){return useContext(MaterialContext);}

/** A smooth elliptical loft, used for tailored clothes instead of stacked balls. */
function loft(rows: Point[], centers: number[] = [], segments = 24) {
	const profile = new CatmullRomCurve3(rows.map(r => new Vector3(...r)));
	const vertices: number[] = [], indices: number[] = [];
	const steps = Math.max(20, rows.length * 4);
	const ascending = rows[rows.length - 1][1] > rows[0][1];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps, p = profile.getPoint(t);
		const ci = t * (centers.length - 1), a = Math.max(0, Math.floor(ci)), b = Math.min(centers.length - 1, a + 1);
		const cz = centers.length ? centers[a] + (centers[b] - centers[a]) * (ci - a) : 0;
		for (let j = 0; j <= segments; j++) {
			const phi = j / segments * Math.PI * 2;
			vertices.push(Math.cos(phi) * Math.max(.001, p.x), p.y, Math.sin(phi) * Math.max(.001, p.z) + cz);
			if (i < steps && j < segments) {
				const k = i * (segments + 1) + j;
				if (ascending) indices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2);
				else indices.push(k, k + 1, k + segments + 1, k + 1, k + segments + 2, k + segments + 1);
			}
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
	geometry.setIndex(indices); geometry.computeVertexNormals();
	return geometry;
}

function line(points: Point[], radius = .005, closed = false) {
	return new TubeGeometry(new CatmullRomCurve3(points.map(p => new Vector3(...p)), closed), 24, radius, 6, closed);
}
function join(geometries: BufferGeometry[]) {
	const result = mergeGeometries(geometries, false)!;
	geometries.forEach(g => g.dispose());
	return result;
}

const torso = loft([[.01, .68, .01], [.19, .69, .125], [.224, .77, .143], [.229, .97, .135], [.238, 1.12, .125], [.198, 1.20, .12], [.082, 1.245, .08], [.001, 1.24, .001]]);
const hem = loft([[.19, .677, .123], [.208, .689, .132], [.207, .728, .132], [.20, .739, .128]]);
const sleeve = loft([[.012, .055, .012], [.088, .018, .085], [.092, -.09, .09], [.082, -.23, .082], [.076, -.34, .079], [.061, -.435, .065], [.01, -.452, .01]]);
const cuff = loft([[.059, -.471, .06], [.064, -.458, .065], [.065, -.42, .064], [.062, -.41, .061]]);
const pantsLeg = loft([[.01, .025, .01], [.093, 0, .102], [.099, -.13, .10], [.083, -.32, .081], [.079, -.46, .075], [.064, -.515, .06], [.012, -.53, .012]]);
const ankle = loft([[.058, -.55, .057], [.061, -.548, .058], [.062, -.509, .06], [.059, -.502, .057]]);
const shoe = loft([[.078, .031, .14], [.088, .055, .147], [.086, .092, .14], [.065, .133, .082], [.043, .143, .053], [.001, .144, .001]], [-.042, -.047, -.048, .003, .02, .02]);
const sole = loft([[.078, .008, .14], [.087, .015, .148], [.089, .034, .15], [.085, .045, .145]], [-.045, -.045, -.045, -.045]);
const soleStripe = loft([[.078, .007, .138], [.087, .012, .148], [.087, .021, .148]], [-.045, -.045, -.045]);
const laces = join([-.07, -.035, 0].map((z, i) => line([[-.054, .109 + i * .006, z], [0, .123 + i * .005, z - .008], [.054, .109 + i * .006, z]], .005)));
// Open hand reference: fingers lie flat and straight, fanned slightly apart
// (index/pinky angle away from the middle finger) with tapered tips.
const fingers = join([-.03, -.01, .011, .031].flatMap((x, i) => {
	const length = [.052, .063, .058, .044][i];
	const fan = [-.006, -.001, .002, .009][i];
	const base: Point = [x, -.028, .004];
	const tip: Point = [x + fan, -.028 - length, .004 + fan * .3];
	const radius = [.0092, .0102, .0096, .008][i];
	const tipRadius = radius * .72;
	const tipBall = ball.clone().scale(tipRadius, tipRadius * 1.1, tipRadius * .95).translate(...tip);
	return [line([base, [x + fan * .4, -.028 - length * .58, .004 + fan * .12], tip], radius), tipBall];
}));

// A folded fabric shell joins the shoulders all the way around the neck.
// The inner lining and outer cloth are continuous surfaces, not floating rings.
function hoodShell(inner: boolean) {
	const positions: number[] = [], indices: number[] = [], rings = inner ? 10 : 12, sides = 40;
	for (let row = 0; row <= rings; row++) for (let j = 0; j <= sides; j++) {
		const t = Math.min(1, row / 10), fold = inner ? 0 : Math.max(0, (row - 10) / 2), phi = Math.PI + .62 - j / sides * (Math.PI + 1.24), back = Math.max(0, Math.sin(phi));
		const rx = inner ? .103 + .04 * t : .168 + .018 * Math.sin(t * Math.PI) - .025 * fold;
		const rz = inner ? .072 + .025 * t : .116 + .018 * Math.sin(t * Math.PI) - .019 * fold;
		const y = 1.17 + (inner ? .094 : .106) * t + .012 * back * t - .012 * fold;
		positions.push(Math.cos(phi) * rx, y, Math.sin(phi) * rz + .025);
		if (row < rings && j < sides) { const k = row * (sides + 1) + j; if (inner) indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2); else indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1); }
	}
	const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
const hoodOuter = hoodShell(false), hoodInner = hoodShell(true);
// Closed front folds cover the open ends of the U-shaped hood and join its
// upper edge to the shoulders. Both folds share one mesh and remain fabric-thin.
const hoodFrontFolds = (() => {
	const positions: number[] = [], indices: number[] = [], rows = 8, cols = 6;
	const stride = cols + 1, layer = (rows + 1) * stride;
	for (const side of [-1, 1]) {
		const start = positions.length / 3;
		for (let back = 0; back < 2; back++) for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
			const t = i / rows, s = j / cols;
			const inner = .052 + .038 * t, outer = .181 - .028 * t;
			positions.push(side * (inner + (outer - inner) * s), 1.197 + .08 * t,
				-.125 + .08 * t + .045 * s * (1 - t) - .012 * Math.sin(Math.PI * s) * Math.sin(Math.PI * t) + back * .014);
		}
		const triangle = (a: number, b: number, c: number, reverse = false) => {
			if ((side > 0) !== reverse) indices.push(start + a, start + c, start + b);
			else indices.push(start + a, start + b, start + c);
		};
		for (let back = 0; back < 2; back++) for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
			const k = back * layer + i * stride + j;
			triangle(k, k + 1, k + stride, Boolean(back));
			triangle(k + 1, k + stride + 1, k + stride, Boolean(back));
		}
		const edge = [
			...Array.from({ length: cols + 1 }, (_, j) => j),
			...Array.from({ length: rows }, (_, i) => (i + 1) * stride + cols),
			...Array.from({ length: cols }, (_, j) => rows * stride + cols - 1 - j),
			...Array.from({ length: rows - 1 }, (_, i) => (rows - 1 - i) * stride),
		];
		edge.forEach((a, i) => { const b = edge[(i + 1) % edge.length]; triangle(a, a + layer, b); triangle(b, a + layer, b + layer); });
	}
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(positions, 3));
	g.setIndex(indices); g.computeVertexNormals(); return g;
})();
const hoodRim = line([[-.137, 1.268, -.033], [-.169, 1.281, .017], [-.132, 1.291, .106], [0, 1.292, .148], [.132, 1.291, .106], [.169, 1.281, .017], [.137, 1.268, -.033]], .012);
const drawstrings = join([-1, 1].map(s => line([[s * .073, 1.204, -.122], [s * .074, 1.12, -.143], [s * .075, 1.016, -.147], [s * .08, .969, -.146]], .0045)));
const pocketStitch = line([[-.158, .794, -.14], [-.137, .843, -.15], [-.113, .914, -.149], [.113, .914, -.149], [.137, .843, -.15], [.158, .794, -.14]], .0024);
const pocket = loft([[.001, .762, .001], [.139, .781, .012], [.16, .813, .017], [.128, .887, .013], [.112, .915, .009], [.001, .917, .001]], [-.137, -.138, -.14, -.14, -.138, -.137]);
const shirtV = (() => {
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute([-.067, 1.218, -.107, .067, 1.218, -.107, 0, 1.174, -.136], 3));
	g.setIndex([0, 1, 2]); g.computeVertexNormals(); return g;
})();
const badge = line([[.104, 1.075, -.135], [.145, 1.075, -.127], [.145, 1.118, -.127], [.104, 1.118, -.135]], .0028, true);
const badgeGlyph = join([
	line([[.111, 1.096, -.138], [.119, 1.106, -.139], [.128, 1.095, -.136], [.138, 1.102, -.133]], .0021),
	line([[.111, 1.084, -.137], [.137, 1.084, -.131]], .0019),
]);

function Ellipsoid({ position, scale, material }: { position: Point; scale: Point; material: MeshStandardMaterial }) {
	return <mesh geometry={ball} material={material} position={position} scale={scale} castShadow />;
}

function Arm({ side, innerRef }: { side: number; innerRef: RefObject<Group | null> }) {
 const materials=useHumanMaterials();
	return <group ref={innerRef} position={[side * .219, 1.175, 0]} rotation={[0, 0, side * .14]}>
		<mesh geometry={sleeve} material={materials.hoodie} castShadow />
		<mesh geometry={cuff} material={materials.rib} castShadow />
		<group position={[0, -.515, -.006]} rotation={[.08, 0, side * .07]}>
			{/* Flattened, slightly tapered palm reads as a real open hand instead of a ball. */}
			<Ellipsoid position={[0, .006, -.004]} scale={[.052, .066, .024]} material={materials.skin} />
			<Ellipsoid position={[0, -.03, .008]} scale={[.046, .032, .021]} material={materials.skin} />
			{/* Thumb splays wide to the side like an open hand, with a knuckle bulge. */}
			<group position={[-side * .05, .006, -.01]} rotation={[.15, -side * .65, side * .75]}>
				<Ellipsoid position={[0, 0, 0]} scale={[.017, .023, .017]} material={materials.skin} />
				<Ellipsoid position={[0, -.028, 0]} scale={[.015, .022, .016]} material={materials.skin} />
				<Ellipsoid position={[0, -.05, -.002]} scale={[.0115, .013, .012]} material={materials.skin} />
			</group>
			<mesh geometry={fingers} material={materials.skin} scale={[side, 1, 1]} castShadow />
		</group>
	</group>;
}

function Leg({ side, innerRef,covered=false }: { side: number; innerRef: RefObject<Group | null>;covered?:boolean }) {
 const materials=useHumanMaterials();
	return <group ref={innerRef} position={[side * .104, .707, .016]}>
		{!covered&&<><mesh geometry={pantsLeg} material={materials.trousers} castShadow />
		<mesh geometry={ankle} material={materials.trouserSeam} castShadow />
		<Ellipsoid position={[side * .078, -.19, .003]} scale={[.025, .083, .064]} material={materials.trouserSeam} />
		<Ellipsoid position={[side * .085, -.139, .002]} scale={[.025, .019, .064]} material={materials.trousers} /></>}
        {covered&&<Ellipsoid position={[0,-.61,0]} scale={[.052,.06,.052]} material={materials.skin}/>}
		<group position={[0, -.7, -.015]}>
			<HumanShoes/>
		</group>
	</group>;
}

// Bent limbs keep both hands on the grips and both feet beside the footrests.
const ridingSleeves=join([-1,1].map(side=>closedSleeveGeometry([[side*.219,1.175,0],[side*.25,1.00,-.23],[side*.27,.86,-.44]],.073)));
function RidingLeg({side}:{side:number}){
 const materials=useHumanMaterials();
 const hip=new Vector3(side*.145,.707,.016),knee=new Vector3(side*.205,.48,-.32),ankle=new Vector3(side*.205,.24,-.25);
 const segment=(a:Vector3,b:Vector3,r:number)=>{const d=b.clone().sub(a),q=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),d.clone().normalize());return <mesh geometry={ball} material={materials.trousers} position={a.clone().add(b).multiplyScalar(.5)} quaternion={q} scale={[r,d.length()*.63,r]} castShadow/>};
 return <group>{segment(hip,knee,.09)}{segment(knee,ankle,.068)}<Ellipsoid position={[side*.205,.48,-.32]} scale={[.082,.078,.082]} material={materials.trousers}/><group position={[side*.205,.16,-.25]}><HumanShoes/></group></group>;
}
function RidingArms(){const materials=useHumanMaterials();return <group><mesh geometry={ridingSleeves} material={materials.hoodie} castShadow/>{[-1,1].map(side=><group key={side}><Ellipsoid position={[side*.27,.85,-.45]} scale={[.062,.057,.058]} material={materials.rib}/><Ellipsoid position={[side*.27,.83,-.49]} scale={[.046,.037,.043]} material={materials.skin}/></group>)}</group>}

function HumanShoes(){
 const appearance=useContext(HumanContext),materials=useHumanMaterials();
 if(appearance.shoes==='sandals')return <group name="human-sandals"><mesh geometry={sole} material={materials.white}/><Ellipsoid position={[0,.065,-.04]} scale={[.072,.045,.115]} material={materials.skin}/><mesh position={[0,.095,-.07]}><boxGeometry args={[.15,.025,.055]}/><primitive object={materials.white} attach="material"/></mesh></group>;
 return <group name={`human-${appearance.shoes}`}><mesh geometry={shoe} material={materials.white} castShadow/><mesh geometry={sole} material={materials.sole}/><mesh geometry={soleStripe} material={materials.rib}/>{appearance.shoes==='boots'?<mesh position={[0,.17,.01]} scale={[1,1,.92]} material={materials.white}><cylinderGeometry args={[.066,.075,.18,12]}/></mesh>:<mesh geometry={laces} material={materials.lace}/>}</group>;
}
const skirts={dress:garmentGeometry('dress'),longyi:garmentGeometry('longyi')};
function HumanClothes({seated}:{seated:boolean}){
 const a=useContext(HumanContext),materials=useHumanMaterials();
 return <group name={`human-clothes-${a.clothes}`}>
  {a.clothes==='hoodie'?<><mesh geometry={pocket} material={materials.hoodie}/><mesh geometry={pocketStitch} material={materials.seam}/><mesh geometry={drawstrings} material={materials.lace}/><mesh geometry={hoodOuter} material={materials.hoodie}/><mesh geometry={hoodInner} material={materials.hoodInside}/><mesh geometry={hoodFrontFolds} material={materials.hoodie}/><mesh geometry={hoodRim} material={materials.hoodie}/></>:<>{[.84,.96,1.08,1.19].map(y=><Ellipsoid key={y} position={[0,y,-.142]} scale={[.009,.009,.006]} material={materials.lace}/>)}<mesh position={[0,1.15,-.13]} material={materials.white}><boxGeometry args={[.13,.06,.018]}/></mesh></>}
  {(a.clothes==='dress'||a.clothes==='longyi')&&(seated?<mesh position={[0,.61,-.12]} scale={[.24,.12,.30]} geometry={ball} material={a.clothes==='dress'?materials.hoodie:materials.trousers}/>:<mesh name="opaque-garment" geometry={skirts[a.clothes]} material={a.clothes==='dress'?materials.hoodie:materials.trousers}/>)}
 </group>;
}

const limbUp=new Vector3(0,1,0),limbDirection=new Vector3();
function fitLimb(mesh:Mesh|null,a:Vector3,b:Vector3,radius:number){
 if(!mesh)return;
 limbDirection.subVectors(b,a);
 mesh.position.lerpVectors(a,b,.5);
 mesh.scale.set(radius,limbDirection.length()*.5+radius*.4,radius);
 mesh.quaternion.setFromUnitVectors(limbUp,limbDirection.normalize());
}
function DrivingArm({side,pose}:{side:number;pose:RefObject<DrivingPose>}){
 const materials=useHumanMaterials();
 const upper=useRef<Mesh>(null),lower=useRef<Mesh>(null),hand=useRef<Group>(null);
 const points=useRef({shoulder:new Vector3(side*.219,1.175,0),elbow:new Vector3(),wrist:new Vector3(),grip:new Vector3()});
 useFrame(()=>{
  if(!pose.current.active)return;
  const p=points.current,angle=Math.max(-.85,Math.min(.85,pose.current.wheelAngle));
  driverGrip(side,pose.current.wheelAngle,p.grip);
  p.elbow.set(side*.30,1.01+(p.grip.y-1.025)*.35,-.16);
  p.wrist.copy(p.grip).lerp(p.elbow,.16);
  fitLimb(upper.current,p.shoulder,p.elbow,.074);
  fitLimb(lower.current,p.elbow,p.wrist,.064);
  if(hand.current){hand.current.position.copy(p.grip);hand.current.rotation.set(STEERING_TILT,0,angle);}
 });
 return <group name={side<0?'driver-left-arm':'driver-right-arm'}>
  <mesh ref={upper} geometry={ball} material={materials.hoodie} castShadow/>
  <mesh ref={lower} geometry={ball} material={materials.hoodie} castShadow/>
  <group ref={hand} name={side<0?'driver-left-grip':'driver-right-grip'}>
   <Ellipsoid position={[0,0,.030]} scale={[.040,.052,.021]} material={materials.skin}/>
   {[-.029,-.010,.009,.028].map(y=><mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]} material={materials.skin}><torusGeometry args={[.032,.009,6,12,Math.PI*1.65]}/></mesh>)}
   <Ellipsoid position={[-side*.031,.014,.002]} scale={[.019,.031,.019]} material={materials.skin}/>
  </group>
 </group>;
}
function DrivingLeg({side,pose}:{side:number;pose:RefObject<DrivingPose>}){
 const materials=useHumanMaterials();
 const thigh=useRef<Mesh>(null),shin=useRef<Mesh>(null),foot=useRef<Group>(null);
 const points=useRef({hip:new Vector3(side*.104,.707,.016),knee:new Vector3(),ankle:new Vector3(),x:side<0?.12:.43});
 useFrame((_,delta)=>{
  if(!pose.current.active)return;
  const p=points.current,targetX=side<0?.12:pose.current.brake?.28:.43;
  p.x+=(targetX-p.x)*(1-Math.exp(-Math.min(delta,.05)*15));
  const x=(p.x-DRIVER_POSITION[0])/DRIVER_SCALE;
  const pressed=side<0?pose.current.clutch:pose.current.brake||pose.current.throttle;
  p.knee.set(x,.64,-.40);p.ankle.set(x,.29,-.70);
  fitLimb(thigh.current,p.hip,p.knee,.088);fitLimb(shin.current,p.knee,p.ankle,.068);
  if(foot.current){foot.current.position.set(x,.225,-.73);foot.current.rotation.x=pressed?.30:.60;}
 });
 return <group name={side<0?'driver-left-leg':'driver-right-leg'}>
  <mesh ref={thigh} geometry={ball} material={materials.trousers} castShadow/>
  <mesh ref={shin} geometry={ball} material={materials.trousers} castShadow/>
  <group ref={foot}><HumanShoes/></group>
 </group>;
}

/** Reference-inspired boy. Facing -Z; origin at the soles; no world movement here. */
function CharacterBody({ motion, riding=false, driving }: { motion: RefObject<CharacterMotion>;riding?:boolean;driving?:RefObject<DrivingPose> }) {
 const appearance=useContext(HumanContext),materials=useHumanMaterials();
 const covered=appearance.clothes==='dress'||appearance.clothes==='longyi';
	const body = useRef<Group>(null), headGroup = useRef<Group>(null);
	const leftArm = useRef<Group>(null), rightArm = useRef<Group>(null);
	const leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null);
	const leftEye = useRef<Group>(null), rightEye = useRef<Group>(null);
	const animation = useRef({ stride: 0, time: 0, blink: 2.6 });
	useFrame((_, delta) => {
		if(driving&&!driving.current.active)return;
		const dt = Math.min(delta, .06), a = animation.current;
		a.time += dt;
		const speed = riding||driving?0:Math.abs(motion.current.speed), active = Math.min(1, speed / .8);
		a.stride += (active - a.stride) * (1 - Math.exp(-dt * 11));
		const run = Math.min(1, Math.max(0, (speed - 2.8) / 4));
		const phase = motion.current.distance * (4.9 - run * .6);
		const swing = covered?coveredStride(phase,a.stride):Math.sin(phase) * (.40 + run * .22) * a.stride;
		if (leftLeg.current) {leftLeg.current.rotation.x = swing;leftLeg.current.position.y=.707+(motion.current.leftFoot??0)+Math.max(0,Math.sin(phase))*Math.min(covered?.05:1,motion.current.stepLift??0)*a.stride;}
		if (rightLeg.current) {rightLeg.current.rotation.x = -swing;rightLeg.current.position.y=.707+(motion.current.rightFoot??0)+Math.max(0,-Math.sin(phase))*Math.min(covered?.05:1,motion.current.stepLift??0)*a.stride;}
		if (leftArm.current) leftArm.current.rotation.x = -swing * .82;
		if (rightArm.current) rightArm.current.rotation.x = swing * .82;
		if (body.current) {
			body.current.position.y = driving?0:Math.abs(Math.sin(phase)) * .018 * a.stride + Math.sin(a.time * 1.8) * .0025 * (1 - a.stride);
			body.current.rotation.z = Math.sin(phase) * .013 * a.stride;
		}
		if (headGroup.current) headGroup.current.rotation.y = Math.sin(a.time * .65) * .022 * (1 - a.stride);
		if (headGroup.current&&driving) headGroup.current.visible=!driving.current.interior;
		a.blink -= dt;
		const blinkScale = a.blink < 0 ? Math.max(.06, Math.abs(a.blink + .085) / .085) : 1;
		if (a.blink < -.17) a.blink = 3.1 + Math.sin(a.time * 2.3) * .8;
		if (leftEye.current) leftEye.current.scale.y = Math.min(1, blinkScale);
		if (rightEye.current) rightEye.current.scale.y = Math.min(1, blinkScale);
	});
	return <group name="cartoon-boy-character" dispose={null}>
		{driving?<><DrivingLeg side={-1} pose={driving}/><DrivingLeg side={1} pose={driving}/></>:riding?<><RidingLeg side={-1}/><RidingLeg side={1}/></>:<><Leg side={-1} innerRef={leftLeg} covered={covered}/><Leg side={1} innerRef={rightLeg} covered={covered}/></>}
		<group ref={body}>
			<Ellipsoid position={[0, .72, .01]} scale={[.194, .106, .121]} material={materials.trousers} />
			<mesh name="human-torso" geometry={torso} material={materials.hoodie} castShadow />
			<mesh geometry={hem} material={materials.rib} castShadow />
			<HumanClothes seated={riding||!!driving}/>
			<mesh geometry={shirtV} material={materials.white} />
			<Ellipsoid position={[0, 1.273, .004]} scale={[.077, .111, .072]} material={materials.skin} />
			{driving?<><DrivingArm side={-1} pose={driving}/><DrivingArm side={1} pose={driving}/></>:riding?<RidingArms/>:<><Arm side={-1} innerRef={leftArm}/><Arm side={1} innerRef={rightArm}/></>}
			<group ref={headGroup} position={[0, 1.565, 0]}>
				<group scale={[appearance.face==='round'?1.09:appearance.face==='mature'?.96:1,appearance.face==='mature'?1.02:1,1]}><CartoonFace leftEye={leftEye} rightEye={rightEye} appearance={appearance}/><CartoonHair style={appearance.hair} color={appearance.hairColor}/></group>
			</group>
		</group>
	</group>;
}

/** Reusable person: independent appearance, shared geometry, walking/riding/driving poses. */
export function CartoonCharacter({appearance=HUMAN_PRESETS.boy,...props}:{appearance?:HumanAppearance;motion:RefObject<CharacterMotion>;riding?:boolean;driving?:RefObject<DrivingPose>}){
 const palette=useMemo(()=>{
  const tint=(base:MeshStandardMaterial,color:string,factor=1)=>{const m=base.clone();m.color.set(color).multiplyScalar(factor);return m;};
  return {...defaultMaterials,skin:tint(defaultMaterials.skin,appearance.skin),hoodie:tint(defaultMaterials.hoodie,appearance.clothingColor),rib:tint(defaultMaterials.rib,appearance.clothingColor,.8),hoodInside:tint(defaultMaterials.hoodInside,appearance.clothingColor,.6),seam:tint(defaultMaterials.seam,appearance.clothingColor,1.12),trousers:tint(defaultMaterials.trousers,appearance.trousersColor),trouserSeam:tint(defaultMaterials.trouserSeam,appearance.trousersColor,1.15),white:tint(defaultMaterials.white,appearance.shoeColor)};
 },[appearance.skin,appearance.clothingColor,appearance.trousersColor,appearance.shoeColor]);
 useEffect(()=>()=>{for(const key of Object.keys(palette) as (keyof typeof palette)[])if(palette[key]!==defaultMaterials[key])palette[key].dispose();},[palette]);
 // Seated poses use the vehicle's seat and grip dimensions, while walking height is configurable.
 return <HumanContext.Provider value={appearance}><MaterialContext.Provider value={palette}><group scale={props.riding||props.driving?1:appearance.height} userData={{humanPreset:appearance.preset}}><CharacterBody {...props}/></group></MaterialContext.Provider></HumanContext.Provider>;
}
