import { memo, useMemo } from 'react';
import { Shape } from 'three';
import { cemeteryToWorld, createCemeteryLayout, getCemeteryGrave, MYOTHAR_CEMETERY_BOUNDARY } from '../game/cemeteryLayout';
import {
	BURMESE_TOMB_PALETTES,
	BurmeseTomb,
	BurmeseTombInstancedBatch,
	CemeteryTomb,
	getCemeteryTombAssetCache,
	type BurmeseTombProps,
	type CemeteryTombKind,
	type CemeteryTombProps,
	type InstancedTombRecord,
} from './cemetery/BurmeseTomb';

export {
	BURMESE_TOMB_PALETTES,
	BurmeseTomb,
	BurmeseTombInstancedBatch,
	CemeteryTomb,
	getCemeteryTombAssetCache,
	type BurmeseTombProps,
	type CemeteryTombKind,
	type CemeteryTombProps,
	type InstancedTombRecord,
};

export interface CemeteryProps {
	/** Boundary polygon in scene [x, z] coordinates (4 or more points). */
	boundary?: readonly (readonly [number, number])[];
	/** Explicit center position [x, z] if boundary not provided or to override. */
	center?: [number, number];
	/** Rotation angle in radians (default: computed from boundary or 0). */
	rotation?: number;
	/** Length of cemetery in meters (if boundary not provided). */
	length?: number;
	/** Width of cemetery in meters (if boundary not provided). */
	width?: number;
	/** Optional cap. By default, fill the available grave plots. */
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

export const defaultMyotharCemeteryBoundary = MYOTHAR_CEMETERY_BOUNDARY;

function pathShape(points: readonly (readonly [number, number])[]) {
	const shape = new Shape();
	for (const [i, [x, z]] of points.entries()) {
		if (i === 0) shape.moveTo(x, -z);
		else shape.lineTo(x, -z);
	}
	shape.closePath();
	return shape;
}

export const Cemetery = memo(function Cemetery({
	boundary = defaultMyotharCemeteryBoundary,
	center,
	rotation,
	length,
	width,
	graveCount = Infinity,
	name = 'သင်္ချိုင်း (ကံပုလဲ)',
	township = 'ကံပုလဲ · ကလေးမြို့',
	hasWall = true,
	hasArch = true,
	hasZayat = true,
	hasTrees = true,
	position = [0, 0, 0],
}: CemeteryProps) {
	const tombCache = getCemeteryTombAssetCache();
	const archSignMat = useMemo(
		() => tombCache.getArchSignMat(name, township),
		[tombCache, name, township],
	);

	const config = useMemo(() => createCemeteryLayout({ boundary, center, rotation, length, width, hasZayat, hasTrees }),
		[boundary, center, rotation, length, width, hasZayat, hasTrees]);
	const { plots, features } = useMemo(() => {
		const plots = new Map<string, InstancedTombRecord[]>();
		const features: Array<BurmeseTombProps & { key: string }> = [];
		let count = 0;
		for (let row = 0; row < config.rows.length && count < graveCount; row++) {
			for (let column = 0; column < config.columns && count < graveCount; column++) {
				const plot = getCemeteryGrave(config, row, column);
				if (!plot) continue;
				count++;
				const world = cemeteryToWorld(config, plot.x, plot.z);
				const rotation = -config.rot + (plot.z < 0 ? Math.PI / 2 : -Math.PI / 2);
				const variant = (row * 13 + column * 7) % BURMESE_TOMB_PALETTES.length;
				const palette = BURMESE_TOMB_PALETTES[variant];
				if (plot.epitaph) {
					features.push({ ...world, key: `${row}-${column}`, rotation, scale: plot.scale, bodyColor: palette.body,
						epitaphTitle: plot.epitaph[0], epitaphSubtitle: plot.epitaph[1] });
					continue;
				}
				const block = `${Math.floor(column / 15)}-${Math.floor(row / 6)}`;
				const list = plots.get(block) ?? [];
				if (list.length === 0) plots.set(block, list);
				list.push({ ...world, rotation, tilt: 0, scaleY: .95 + variant * .012, bodyColor: palette.body, accentColor: palette.accent });
			}
		}
		return { plots, features };
	}, [config, graveCount]);
	const surfaces = useMemo(() => [
		{ id: 'ground', kind: 'ground', shape: pathShape(config.outline) },
		...config.paths.map(path => ({ ...path, shape: pathShape(path.points) })),
	], [config]);
	const zayatPos = cemeteryToWorld(config, config.zayatX, 0);
	const { entrance, walls } = config;

	// ၇။ တရုတ်စံပယ်ပင်များနှင့် အရိပ်ရပင်များ (Frangipani & Shading Trees)
	const treeSpots = useMemo(() => {
		if (!hasTrees) return [];
		const list: { key: string; x: number; z: number; isFrangipani: boolean }[] = [];
		const { cx, cz, rot } = config;
		const cosR = Math.cos(rot);
		const sinR = Math.sin(rot);

		// Frangipani trees along central avenue
		const frangipaniXOffsets = config.treeOffsets;
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
		if (config.points.length >= 4) {
			config.points.forEach((p, idx) => {
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
			<group position={[config.cx, 0, config.cz]} rotation={[0, -config.rot, 0]} name="cemetery-footpaths">
				{surfaces.map(({ id, kind, shape }) => (
					<mesh key={id} name={id}
						position={[0, kind === 'ground' ? .012 : kind === 'avenue' ? .047 : kind === 'cross' ? .037 : .029, 0]}
						rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ walkable: true }}>
						<shapeGeometry args={[shape]} />
						<meshStandardMaterial color={kind === 'ground' ? '#76865f' : kind === 'row' ? '#ac9b7e' : '#c5b7a0'} roughness={.95} />
					</mesh>
				))}
			</group>

			{[...plots].map(([key, tombs]) => <BurmeseTombInstancedBatch key={key} tombs={tombs} />)}
			{features.map(({ key, ...tomb }) => <BurmeseTomb key={key} {...tomb} />)}

			{/* ======================================================== */}
			{/* ၄။ သုသာန် အုတ်တံတိုင်း (Perimeter Brick Walls & Posts) */}
			{/* ======================================================== */}
			{hasWall && (
				<group name="cemetery-walls">
					{walls.map((s) => (
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
					{config.points.map((p, idx) => (
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

					{/* Signboard Banner with Cemetery Name (`သင်္ချိုင်း (ကံပုလဲ)`) */}
					<mesh position={[0, 4.5, 0]} castShadow material={archSignMat}>
						<boxGeometry args={[4.8, 0.72, 0.76]} />
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
					rotation={[0, -config.rot, 0]}
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
