import { memo, useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';

export interface CemeteryProps {
	/** Boundary polygon in scene [x, z] coordinates (4 or more points). */
	boundary?: [number, number][];
	/** Explicit center position [x, z] if boundary not provided or to override. */
	center?: [number, number];
	/** Rotation angle in radians (default: computed from boundary or 0). */
	rotation?: number;
	/** Length of cemetery in meters (if boundary not provided). */
	length?: number;
	/** Width of cemetery in meters (if boundary not provided). */
	width?: number;
	/** Target number of graves (default: 10000). */
	graveCount?: number;
	/** Cemetery name in Myanmar or English (e.g., "မြို့သာ သုသာန်", "သင်္ချိုင်း"). */
	name?: string;
	/** Township or ward subtitle (e.g. "ကလေးမြို့"). */
	township?: string;
	/** Whether to render boundary wall (default: true). */
	hasWall?: boolean;
	/** Whether to render entrance archway (default: true). */
	hasArch?: boolean;
	/** Whether to render rest pavilion (သုသာန် ဇရပ်) (default: true). */
	hasZayat?: boolean;
	/** Whether to render cemetery trees (တရုတ်စံပယ် & အရိပ်ရပင်) (default: true). */
	hasTrees?: boolean;
	/** Optional custom position offset [x, y, z]. */
	position?: [number, number, number];
}

/**
 * မြို့သာ အလယ် GeoJSON ဖြင့် ပေးထားသော မူလ သင်္ချိုင်း နယ်နိမိတ် (Scene Coordinates XZ)
 */
export const defaultMyotharCemeteryBoundary: [number, number][] = [
	[-30.50424561717233, -401.59180192706134],
	[134.1514837155285, -470.9921594058478],
	[155.24374922378712, -417.9212562763674],
	[-17.576748811622224, -349.8816901206944],
];

/**
 * Point-in-polygon raycasting algorithm
 */
function isPointInPolygon(pt: [number, number], poly: [number, number][]): boolean {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const xi = poly[i][0], zi = poly[i][1];
		const xj = poly[j][0], zj = poly[j][1];
		const intersect =
			zi > pt[1] !== zj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

/**
 * မြန်မာ့ရိုးရာ အုတ်ဂူများနှင့် ကျောက်စာတိုင် အရောင်အသွေးများ (Authentic Myanmar Cemetery Palette)
 */
const GRAVE_PALETTES = [
	{ plinth: '#f8fafc', head: '#ffffff' }, // Pure white marble (စကျင်ကျောက်ဖြူ)
	{ plinth: '#e2e8f0', head: '#f1f5f9' }, // Light whitewashed stone (ထုံးဖြူရောင်)
	{ plinth: '#cbd5e1', head: '#94a3b8' }, // Granite grey (ကျောက်နှမ်း မီးခိုး)
	{ plinth: '#64748b', head: '#334155' }, // Charcoal slate (ကျောက်နက်ရောင်)
	{ plinth: '#a7f3d0', head: '#6ee7b7' }, // Jade celadon green (ကျောက်စိမ်းနု)
	{ plinth: '#bae6fd', head: '#7dd3fc' }, // Sky / Cyan blue (မိုးပြာရောင်)
	{ plinth: '#fde68a', head: '#fcd34d' }, // Golden yellow / Sandstone (ရွှေဝါ/သဲကျောက်)
	{ plinth: '#fecdd3', head: '#fda4af' }, // Rose pink (ပန်းရောင်နု)
	{ plinth: '#fed7aa', head: '#fdba74' }, // Terracotta / Peach (အုတ်နီရောင်ဖျော့)
	{ plinth: '#e9d5ff', head: '#d8b4fe' }, // Lavender violet (ခရမ်းနု)
	{ plinth: '#d9f99d', head: '#bef264' }, // Moss lime stone (ကျောက်ညှိစိမ်းဖျော့)
	{ plinth: '#f5f5f4', head: '#e7e5e4' }, // Warm alabaster / Ivory (ဆင်စွယ်ရောင်)
];

const plinthGeometry = new THREE.BoxGeometry(0.96, 0.22, 0.46);
const headstoneGeometry = new THREE.BoxGeometry(0.14, 0.46, 0.38);

/**
 * Reusable Cemetery (သင်္ချိုင်း / သုသာန်) Component
 *
 * အင်္ဂါရပ်များ:
 * ၁။ InstancedMesh ဖြင့် အုတ်ဂူ ၁၀,၀၀၀ (10,000 graves) ကို Draw Call ၂ ခုတည်းဖြင့် 60 FPS ချောမွေ့စွာ Render ပြုလုပ်ခြင်း
 * ၂။ အရောင်မျိုးစုံ (စကျင်ကျောက်ဖြူ၊ မိုးပြာ၊ ကျောက်စိမ်းနု၊ ရွှေဝါ၊ ပန်းရောင်၊ အုတ်နီ၊ ကျောက်နက် စသည်)
 * ၃။ သုသာန် အုတ်တံတိုင်း (Boundary Perimeter Wall) နှင့် မုခ်ဦး (Entrance Archway)
 * ၄။ မြန်မာ့ရိုးရာ သုသာန် ဇရပ် (Funeral Rest Pavilion)၊ ရေအိုးစင်နှင့် နားနေခုံများ
 * ၅။ အလယ်ဗဟို လျှောက်လမ်း (Central Avenue) နှင့် ဖြတ်သန်းလမ်းများ (Cross Aisles)
 * ၆။ တရုတ်စံပယ်ပင်များ (Frangipani) နှင့် အရိပ်ရ သစ်ပင်ကြီးများ (Shade Trees)
 * ၇။ တခြားမြို့နယ်/ရပ်ကွက်များတွင်လည်း Boundary ပေးရုံဖြင့် အသင့်ယူသုံးနိုင်သော Reusable Architecture
 */
export const Cemetery = memo(function Cemetery({
	boundary = defaultMyotharCemeteryBoundary,
	center,
	rotation,
	length,
	width,
	graveCount = 10000,
	name = 'သင်္ချိုင်း',
	township = 'ကလေးမြို့',
	hasWall = true,
	hasArch = true,
	hasZayat = true,
	hasTrees = true,
	position = [0, 0, 0],
}: CemeteryProps) {
	const plinthMeshRef = useRef<THREE.InstancedMesh>(null);
	const headstoneMeshRef = useRef<THREE.InstancedMesh>(null);

	// ၁။ နယ်နိမိတ် ဗဟို၊ အတိုင်းအတာနှင့် လည်ပတ်ထောင့် တွက်ချက်ခြင်း
	const config = useMemo(() => {
		let cx = 0,
			cz = 0;
		if (center) {
			cx = center[0];
			cz = center[1];
		} else if (boundary && boundary.length >= 3) {
			for (const p of boundary) {
				cx += p[0];
				cz += p[1];
			}
			cx /= boundary.length;
			cz /= boundary.length;
		}

		let rot = rotation ?? 0;
		let len = length ?? 175;
		let w = width ?? 54;

		if (boundary && boundary.length >= 4) {
			const dx = boundary[1][0] - boundary[0][0];
			const dz = boundary[1][1] - boundary[0][1];
			if (rotation === undefined) {
				rot = Math.atan2(dz, dx);
			}
			if (length === undefined) {
				len = Math.hypot(dx, dz);
			}
			if (width === undefined) {
				const dxW = boundary[2][0] - boundary[1][0];
				const dzW = boundary[2][1] - boundary[1][1];
				w = Math.hypot(dxW, dzW);
			}
		}

		return { cx, cz, rot, len, w };
	}, [boundary, center, rotation, length, width]);

	// ၂။ အုတ်ဂူ ၁၀,၀၀၀ နေရာချထားမှု တွက်ချက်ခြင်း (Layout Grid with Pathways & Zayat Clearances)
	const graves = useMemo(() => {
		const list: {
			x: number;
			z: number;
			headX: number;
			headZ: number;
			rotation: number;
			tilt: number;
			scaleY: number;
			plinthColor: string;
			headColor: string;
		}[] = [];

		const { cx, cz, rot, len, w } = config;
		const cosR = Math.cos(rot);
		const sinR = Math.sin(rot);

		// Grid parameters tuned to generate ~10,000 inside boundary
		const rows = 82;
		const cols = 142;
		const halfLen = len / 2 - 2.5;
		const halfW = w / 2 - 2.2;
		const stepZ = (halfW * 2) / (rows - 1);
		const stepX = (halfLen * 2) / (cols - 1);

		let seed = 42;
		const nextRand = () => {
			seed = (seed * 9301 + 49297) % 233280;
			return seed / 233280;
		};

		for (let r = 0; r < rows; r++) {
			const lz = -halfW + r * stepZ;
			// အလယ်ဗဟို လျှောက်လမ်း (Central Walkway Avenue)
			if (Math.abs(lz) < 1.35) continue;

			for (let c = 0; c < cols; c++) {
				const lx = -halfLen + c * stepX;

				// ကန့်လန့်ဖြတ် လျှောက်လမ်းများ (Cross Aisles)
				if (
					Math.abs(lx + 42) < 0.95 ||
					Math.abs(lx) < 0.95 ||
					Math.abs(lx - 42) < 0.95
				)
					continue;

				// အဝင်ဝရှိ ဇရပ်နှင့် ခြံဝင်းလွတ် (Zayat Courtyard Plaza)
				if (lx > -halfLen + 5 && lx < -halfLen + 24 && Math.abs(lz) < 6.8) continue;

				// Global world coordinates
				const wx = cx + lx * cosR - lz * sinR;
				const wz = cz + lx * sinR + lz * cosR;

				if (boundary.length >= 3 && !isPointInPolygon([wx, wz], boundary)) {
					continue;
				}

				const rand = nextRand();
				const paletteIdx = Math.floor(rand * GRAVE_PALETTES.length);
				const palette = GRAVE_PALETTES[paletteIdx];

				// Subtle natural organic tilts and scales
				const tilt = (nextRand() - 0.5) * 0.08;
				const scaleY = 0.88 + nextRand() * 0.28;

				// Headstone position at the head end of the plinth
				const headOffset = -0.36;
				const headX = wx + headOffset * cosR;
				const headZ = wz + headOffset * sinR;

				list.push({
					x: wx,
					z: wz,
					headX,
					headZ,
					rotation: rot,
					tilt,
					scaleY,
					plinthColor: palette.plinth,
					headColor: palette.head,
				});

				if (list.length >= graveCount) break;
			}
			if (list.length >= graveCount) break;
		}

		return list;
	}, [config, boundary, graveCount]);

	// ၃။ InstancedMesh အတွက် Matrix နှင့် Color များကို GPU Buffer သို့ ပေးပို့ခြင်း
	useLayoutEffect(() => {
		if (!plinthMeshRef.current || !headstoneMeshRef.current || graves.length === 0) return;

		const dummy = new THREE.Object3D();
		const color = new THREE.Color();
		const count = graves.length;

		for (let i = 0; i < count; i++) {
			const g = graves[i];

			// (က) အုတ်ဂူ အောက်ခြေခုံ (Plinth)
			dummy.position.set(g.x, 0.11, g.z);
			dummy.rotation.set(0, g.rotation, 0);
			dummy.scale.set(1, 1, 1);
			dummy.updateMatrix();
			plinthMeshRef.current.setMatrixAt(i, dummy.matrix);
			color.set(g.plinthColor);
			plinthMeshRef.current.setColorAt(i, color);

			// (ခ) အုတ်ဂူ ကျောက်စာတိုင် (Headstone)
			dummy.position.set(g.headX, 0.44 * g.scaleY, g.headZ);
			dummy.rotation.set(0, g.rotation + g.tilt, 0);
			dummy.scale.set(1, g.scaleY, 1);
			dummy.updateMatrix();
			headstoneMeshRef.current.setMatrixAt(i, dummy.matrix);
			color.set(g.headColor);
			headstoneMeshRef.current.setColorAt(i, color);
		}

		plinthMeshRef.current.instanceMatrix.needsUpdate = true;
		if (plinthMeshRef.current.instanceColor) plinthMeshRef.current.instanceColor.needsUpdate = true;
		plinthMeshRef.current.computeBoundingSphere();

		headstoneMeshRef.current.instanceMatrix.needsUpdate = true;
		if (headstoneMeshRef.current.instanceColor)
			headstoneMeshRef.current.instanceColor.needsUpdate = true;
		headstoneMeshRef.current.computeBoundingSphere();
	}, [graves]);

	// ၄။ အုတ်တံတိုင်း (Perimeter Walls) တွက်ချက်ခြင်း
	const wallSegments = useMemo(() => {
		if (!hasWall || boundary.length < 3) return [];
		const segments: {
			key: string;
			x: number;
			z: number;
			length: number;
			rot: number;
			isWestGate?: boolean;
		}[] = [];

		const n = boundary.length;
		for (let i = 0; i < n; i++) {
			const p1 = boundary[i];
			const p2 = boundary[(i + 1) % n];
			const dx = p2[0] - p1[0];
			const dz = p2[1] - p1[1];
			const segLen = Math.hypot(dx, dz);
			const segRot = Math.atan2(dz, dx);

			// Side 3->0 is the West entrance side (faces town access)
			if (i === 3) {
				const gateWidth = 6.4;
				const halfWall = (segLen - gateWidth) / 2;

				// West wall section 1 (left of gate)
				const mid1X = p1[0] + (dx / segLen) * (halfWall / 2);
				const mid1Z = p1[1] + (dz / segLen) * (halfWall / 2);
				segments.push({
					key: `wall-west-1`,
					x: mid1X,
					z: mid1Z,
					length: halfWall,
					rot: segRot,
				});

				// West wall section 2 (right of gate)
				const mid2X = p2[0] - (dx / segLen) * (halfWall / 2);
				const mid2Z = p2[1] - (dz / segLen) * (halfWall / 2);
				segments.push({
					key: `wall-west-2`,
					x: mid2X,
					z: mid2Z,
					length: halfWall,
					rot: segRot,
				});
			} else {
				const midX = (p1[0] + p2[0]) / 2;
				const midZ = (p1[1] + p2[1]) / 2;
				segments.push({
					key: `wall-seg-${i}`,
					x: midX,
					z: midZ,
					length: segLen,
					rot: segRot,
				});
			}
		}

		return segments;
	}, [boundary, hasWall]);

	// ၅။ အဝင်မုခ်ဦး တည်နေရာ (West Entrance Archway Location)
	const entrance = useMemo(() => {
		if (boundary.length < 4) return { x: config.cx, z: config.cz, rot: config.rot };
		// West side center between point 3 and 0
		const p3 = boundary[3];
		const p0 = boundary[0];
		const ex = (p3[0] + p0[0]) / 2;
		const ez = (p3[1] + p0[1]) / 2;
		const dx = p0[0] - p3[0];
		const dz = p0[1] - p3[1];
		const rot = Math.atan2(dz, dx);
		return { x: ex, z: ez, rot };
	}, [boundary, config]);

	// ၆။ သုသာန် ဇရပ် တည်နေရာ (Rest Pavilion Location)
	const zayatPos = useMemo(() => {
		const { cx, cz, rot, len } = config;
		const cosR = Math.cos(rot);
		const sinR = Math.sin(rot);
		// Placed near west courtyard (lx ≈ -len/2 + 14, lz = 0)
		const lx = -len / 2 + 14;
		const lz = 0;
		const x = cx + lx * cosR - lz * sinR;
		const z = cz + lx * sinR + lz * cosR;
		return { x, z, rot };
	}, [config]);

	// ၇။ တရုတ်စံပယ်ပင်များနှင့် အရိပ်ရပင်များ (Frangipani & Shading Trees)
	const treeSpots = useMemo(() => {
		if (!hasTrees) return [];
		const list: { key: string; x: number; z: number; isFrangipani: boolean }[] = [];
		const { cx, cz, rot, len } = config;
		const cosR = Math.cos(rot);
		const sinR = Math.sin(rot);

		// Frangipani trees along central avenue
		const frangipaniXOffsets = [-len * 0.38, -len * 0.22, -len * 0.08, len * 0.08, len * 0.22, len * 0.36];
		frangipaniXOffsets.forEach((ox, idx) => {
			[-2.2, 2.2].forEach((oz, sideIdx) => {
				const wx = cx + ox * cosR - oz * sinR;
				const wz = cz + ox * sinR + oz * cosR;
				list.push({
					key: `frangipani-${idx}-${sideIdx}`,
					x: wx,
					z: wz,
					isFrangipani: true,
				});
			});
		});

		// Shade trees along perimeter corners
		if (boundary.length >= 4) {
			boundary.forEach((p, idx) => {
				// Offset slightly inside corner
				const cornerX = p[0] + (cx - p[0]) * 0.06;
				const cornerZ = p[1] + (cz - p[1]) * 0.06;
				list.push({
					key: `cemetery-corner-tree-${idx}`,
					x: cornerX,
					z: cornerZ,
					isFrangipani: false,
				});
			});
		}

		return list;
	}, [config, boundary, hasTrees]);

	return (
		<group position={position} name="cemetery-complex">
			{/* ======================================================== */}
			{/* ၁။ မြေပြင် အောက်ခြေခုံ (Cemetery Earth Ground) */}
			{/* ======================================================== */}
			<mesh
				position={[config.cx, -0.02, config.cz]}
				rotation={[-Math.PI / 2, 0, config.rot]}
				receiveShadow
				userData={{ walkable: true }}
			>
				<planeGeometry args={[config.len + 4, config.w + 4]} />
				<meshStandardMaterial color="#788b64" roughness={0.92} />
			</mesh>

			{/* ======================================================== */}
			{/* ၂။ အလယ်ဗဟို လျှောက်လမ်း (Main Central Paved Avenue) */}
			{/* ======================================================== */}
			<mesh
				position={[config.cx, 0.03, config.cz]}
				rotation={[-Math.PI / 2, 0, config.rot]}
				receiveShadow
				userData={{ walkable: true }}
			>
				<planeGeometry args={[config.len - 4, 2.7]} />
				<meshStandardMaterial color="#c2b8a7" roughness={0.88} />
			</mesh>

			{/* ကန့်လန့်ဖြတ် လျှောက်လမ်းများ (Cross Aisles) */}
			{[-42, 0, 42].map((ox) => {
				const cosR = Math.cos(config.rot);
				const sinR = Math.sin(config.rot);
				const px = config.cx + ox * cosR;
				const pz = config.cz + ox * sinR;
				return (
					<mesh
						key={`cross-walk-${ox}`}
						position={[px, 0.025, pz]}
						rotation={[-Math.PI / 2, 0, config.rot + Math.PI / 2]}
						receiveShadow
						userData={{ walkable: true }}
					>
						<planeGeometry args={[config.w - 4, 1.8]} />
						<meshStandardMaterial color="#bab1a0" roughness={0.9} />
					</mesh>
				);
			})}

			{/* ======================================================== */}
			{/* ၃။ အုတ်ဂူ ၁၀,၀၀၀ (Instanced Multicolored Graves) */}
			{/* ======================================================== */}
			<instancedMesh
				ref={plinthMeshRef}
				args={[plinthGeometry, undefined, graves.length]}
				castShadow
				receiveShadow
			>
				<meshStandardMaterial roughness={0.72} metalness={0.08} />
			</instancedMesh>

			<instancedMesh
				ref={headstoneMeshRef}
				args={[headstoneGeometry, undefined, graves.length]}
				castShadow
				receiveShadow
			>
				<meshStandardMaterial roughness={0.65} metalness={0.12} />
			</instancedMesh>

			{/* ======================================================== */}
			{/* ၄။ သုသာန် အုတ်တံတိုင်း (Perimeter Brick Walls & Posts) */}
			{/* ======================================================== */}
			{hasWall && (
				<group name="cemetery-walls">
					{wallSegments.map((s) => (
						<group key={s.key} position={[s.x, 0.6, s.z]} rotation={[0, -s.rot, 0]}>
							{/* Wall Body */}
							<mesh castShadow receiveShadow>
								<boxGeometry args={[s.length, 1.2, 0.28]} />
								<meshStandardMaterial color="#f1f5f9" roughness={0.85} />
							</mesh>
							{/* Wall Top Coping Stone */}
							<mesh position={[0, 0.64, 0]} castShadow>
								<boxGeometry args={[s.length + 0.05, 0.08, 0.36]} />
								<meshStandardMaterial color="#cbd5e1" roughness={0.7} />
							</mesh>
						</group>
					))}

					{/* Perimeter Corner & Gate Pillars */}
					{boundary.map((p, idx) => (
						<group key={`corner-pillar-${idx}`} position={[p[0], 0.75, p[1]]}>
							<mesh castShadow receiveShadow>
								<boxGeometry args={[0.55, 1.5, 0.55]} />
								<meshStandardMaterial color="#e2e8f0" roughness={0.8} />
							</mesh>
							{/* Pyramidal Cap */}
							<mesh position={[0, 0.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
								<coneGeometry args={[0.42, 0.35, 4]} />
								<meshStandardMaterial color="#94a3b8" roughness={0.6} />
							</mesh>
						</group>
					))}
				</group>
			)}

			{/* ======================================================== */}
			{/* ၅။ အဝင်မုခ်ဦး (Traditional Myanmar Entrance Archway) */}
			{/* ======================================================== */}
			{hasArch && (
				<group
					position={[entrance.x, 0, entrance.z]}
					rotation={[0, -entrance.rot, 0]}
					name="cemetery-archway"
				>
					{/* Left Gate Pillar */}
					<mesh position={[-3.2, 2.2, 0]} castShadow receiveShadow>
						<boxGeometry args={[0.9, 4.4, 0.9]} />
						<meshStandardMaterial color="#f8fafc" roughness={0.75} />
					</mesh>
					<mesh position={[-3.2, 4.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
						<coneGeometry args={[0.65, 0.6, 4]} />
						<meshStandardMaterial color="#d97706" metalness={0.4} roughness={0.3} />
					</mesh>

					{/* Right Gate Pillar */}
					<mesh position={[3.2, 2.2, 0]} castShadow receiveShadow>
						<boxGeometry args={[0.9, 4.4, 0.9]} />
						<meshStandardMaterial color="#f8fafc" roughness={0.75} />
					</mesh>
					<mesh position={[3.2, 4.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
						<coneGeometry args={[0.65, 0.6, 4]} />
						<meshStandardMaterial color="#d97706" metalness={0.4} roughness={0.3} />
					</mesh>

					{/* Arch Beam Lintel */}
					<mesh position={[0, 4.0, 0]} castShadow receiveShadow>
						<boxGeometry args={[7.3, 0.6, 0.7]} />
						<meshStandardMaterial color="#1e3a5f" roughness={0.5} />
					</mesh>

					{/* Signboard Banner with Cemetery Name */}
					<mesh position={[0, 4.5, 0.38]} castShadow>
						<boxGeometry args={[4.8, 0.65, 0.08]} />
						<meshStandardMaterial color="#991b1b" roughness={0.4} />
					</mesh>

					{/* Multi-tiered Pediment (ပြာသာဒ် မုခ်ခေါင်း) */}
					<mesh position={[0, 4.9, 0]} castShadow>
						<boxGeometry args={[5.2, 0.28, 0.8]} />
						<meshStandardMaterial color="#d97706" metalness={0.5} roughness={0.35} />
					</mesh>
					<mesh position={[0, 5.25, 0]} castShadow>
						<boxGeometry args={[3.8, 0.28, 0.7]} />
						<meshStandardMaterial color="#b45309" metalness={0.5} roughness={0.35} />
					</mesh>
					<mesh position={[0, 5.65, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
						<coneGeometry args={[0.7, 0.75, 4]} />
						<meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.25} />
					</mesh>
				</group>
			)}

			{/* ======================================================== */}
			{/* ၆။ သုသာန် ဇရပ် (Funeral Rest Pavilion / Zayat) */}
			{/* ======================================================== */}
			{hasZayat && (
				<group
					position={[zayatPos.x, 0, zayatPos.z]}
					rotation={[0, -zayatPos.rot, 0]}
					name="cemetery-zayat"
				>
					{/* Raised Concrete Plinth Platform */}
					<mesh position={[0, 0.22, 0]} receiveShadow userData={{ walkable: true }}>
						<boxGeometry args={[9.4, 0.44, 6.8]} />
						<meshStandardMaterial color="#e2e8f0" roughness={0.8} />
					</mesh>
					{/* Plinth Curb / Trim */}
					<mesh position={[0, 0.43, 0]} receiveShadow>
						<boxGeometry args={[9.55, 0.06, 6.95]} />
						<meshStandardMaterial color="#94a3b8" roughness={0.7} />
					</mesh>

					{/* Steps on 4 Sides */}
					{[-3.5, 3.5].map((sx) => (
						<mesh key={`step-x-${sx}`} position={[sx, 0.1, 3.6]} receiveShadow>
							<boxGeometry args={[1.8, 0.2, 0.6]} />
							<meshStandardMaterial color="#cbd5e1" roughness={0.85} />
						</mesh>
					))}

					{/* 8 Teak Timber Columns */}
					{[-4.2, -1.4, 1.4, 4.2].map((cx) =>
						[-2.9, 2.9].map((cz) => (
							<mesh key={`col-${cx}-${cz}`} position={[cx, 1.9, cz]} castShadow receiveShadow>
								<cylinderGeometry args={[0.13, 0.15, 3.0, 10]} />
								<meshStandardMaterial color="#5c3821" roughness={0.75} />
							</mesh>
						)),
					)}

					{/* Roof Structure: Tier 1 Lower Gable Eaves */}
					<mesh position={[0, 3.65, 0]} castShadow receiveShadow>
						<boxGeometry args={[10.6, 0.25, 7.8]} />
						<meshStandardMaterial color="#854d0e" roughness={0.6} />
					</mesh>

					{/* Main Pitched Shingle/Zinc Roof */}
					<mesh position={[0, 4.45, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
						<coneGeometry args={[5.2, 1.6, 4]} />
						<meshStandardMaterial color="#166534" roughness={0.55} metalness={0.15} />
					</mesh>

					{/* Ridge Beam Pinnacle Finial (ခေါင်အထွတ်) */}
					<mesh position={[0, 5.4, 0]} castShadow>
						<coneGeometry args={[0.24, 0.65, 8]} />
						<meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.3} />
					</mesh>

					{/* Interior Benches (နားနေ ခုံရှည်များ) */}
					{[-2.6, 2.6].map((bz) => (
						<mesh key={`bench-${bz}`} position={[0, 0.68, bz]} castShadow receiveShadow>
							<boxGeometry args={[6.2, 0.12, 0.55]} />
							<meshStandardMaterial color="#78350f" roughness={0.7} />
						</mesh>
					))}

					{/* ရေအိုးစင် (Water Pot Stand with Clay Pots) */}
					<group position={[-3.8, 0.44, 2.4]}>
						{/* Stand table */}
						<mesh position={[0, 0.35, 0]} castShadow receiveShadow>
							<boxGeometry args={[1.2, 0.7, 0.6]} />
							<meshStandardMaterial color="#451a03" roughness={0.8} />
						</mesh>
						{/* 2 Clay Water Pots (ရေအိုးများ) */}
						{[-0.32, 0.32].map((ox) => (
							<group key={`pot-${ox}`} position={[ox, 0.92, 0]}>
								<mesh castShadow>
									<sphereGeometry args={[0.22, 12, 10]} />
									<meshStandardMaterial color="#c2410c" roughness={0.85} />
								</mesh>
								{/* Pot Lid */}
								<mesh position={[0, 0.2, 0]} castShadow>
									<cylinderGeometry args={[0.11, 0.15, 0.08, 10]} />
									<meshStandardMaterial color="#9a3412" roughness={0.8} />
								</mesh>
							</group>
						))}
					</group>
				</group>
			)}

			{/* ======================================================== */}
			{/* ၇။ တရုတ်စံပယ်ပင်များနှင့် အရိပ်ရ သစ်ပင်ကြီးများ (Trees) */}
			{/* ======================================================== */}
			{hasTrees && (
				<group name="cemetery-trees">
					{treeSpots.map((t) => {
						if (t.isFrangipani) {
							// Burmese Frangipani (တရုတ်စံပယ်ပင်)
							return (
								<group key={t.key} position={[t.x, 0, t.z]}>
									{/* Gnarled Woody Trunk */}
									<mesh position={[0, 1.2, 0]} castShadow receiveShadow>
										<cylinderGeometry args={[0.14, 0.22, 2.4, 8]} />
										<meshStandardMaterial color="#713f12" roughness={0.88} />
									</mesh>
									{/* Spreading Branches and Foliage */}
									<mesh position={[0, 2.5, 0]} castShadow>
										<sphereGeometry args={[1.35, 8, 8]} />
										<meshStandardMaterial color="#2d5a27" roughness={0.7} />
									</mesh>
									{/* White & Yellow Flower Clusters (စံပယ်ပွင့်ခိုင်များ) */}
									{[
										[0.6, 2.7, 0.5],
										[-0.7, 2.6, -0.4],
										[0.2, 3.1, -0.6],
										[-0.4, 2.8, 0.7],
									].map((pos, pIdx) => (
										<mesh key={`fl-${pIdx}`} position={pos as [number, number, number]}>
											<sphereGeometry args={[0.3, 6, 6]} />
											<meshStandardMaterial
												color="#fef08a"
												emissive="#fef9c3"
												emissiveIntensity={0.25}
												roughness={0.5}
											/>
										</mesh>
									))}
								</group>
							);
						} else {
							// Large Perimeter Shade Tree (အရိပ်ရပင်ကြီး)
							return (
								<group key={t.key} position={[t.x, 0, t.z]}>
									<mesh position={[0, 2.4, 0]} castShadow receiveShadow>
										<cylinderGeometry args={[0.32, 0.48, 4.8, 8]} />
										<meshStandardMaterial color="#451a03" roughness={0.9} />
									</mesh>
									<mesh position={[0, 5.2, 0]} castShadow>
										<sphereGeometry args={[2.8, 10, 10]} />
										<meshStandardMaterial color="#166534" roughness={0.75} />
									</mesh>
									<mesh position={[0.6, 6.8, -0.4]} castShadow>
										<sphereGeometry args={[2.1, 8, 8]} />
										<meshStandardMaterial color="#15803d" roughness={0.72} />
									</mesh>
								</group>
							);
						}
					})}
				</group>
			)}
		</group>
	);
});
