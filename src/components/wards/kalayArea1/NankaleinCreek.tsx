import { memo, useRef, useMemo } from 'react';
import { useRegionFrame as useFrame } from '../../RegionActivity.tsx';
import { Group } from 'three';
import { nankaleinCreek, nankaleinBridge } from '../../../data/wards/kalayArea1/kalayArea1Data.ts';
import { Block as Box } from '../../Primitives.tsx';

/**
 * နန်းကလိန်ချောင်း (Nankalein Creek) နှင့် တံတားကြီး (AH1 Nankalein Big Bridge)
 *
 * တည်နေရာ:
 * - မြို့သာရပ်ကွက် အလယ် (နယ်မြေ ၁ မှ ၇) နှင့် ကလေးမြို့ နယ်မြေ (၁) ကြား
 * - AH1 မိန်းလမ်းမကြီးကို ကန့်လန့်ဖြတ် စီးဆင်းသော ချောင်းကြီး
 * - AH1 လမ်းမပေါ်တွင် နန်းကလိန်ချောင်း တံတားကြီး (ကွန်ကရစ် တံတားကြီး)
 */
export const NankaleinCreek = memo(function NankaleinCreek() {
	const flowRef = useRef<Group>(null);

	// Creek segments calculation
	const segments = useMemo(() => {
		const pts = nankaleinCreek.worldPoints;
		const list: {
			mx: number;
			mz: number;
			length: number;
			rot: number;
		}[] = [];

		for (let i = 0; i < pts.length - 1; i++) {
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const dx = p2[0] - p1[0];
			const dz = p2[1] - p1[1];
			const length = Math.hypot(dx, dz);
			if (length < 0.1) continue;

			const mx = (p1[0] + p2[0]) / 2;
			const mz = (p1[1] + p2[1]) / 2;
			const rot = -Math.atan2(dz, dx);

			list.push({ mx, mz, length: length + 0.3, rot });
		}
		return list;
	}, []);

	// Flow animation for creek ripples
	useFrame(({ clock }) => {
		if (flowRef.current) {
			const t = clock.elapsedTime * 1.8;
			flowRef.current.children.forEach((child, i) => {
				child.position.x = Math.sin(t * 0.8 + i * 1.5) * 0.4;
			});
		}
	});

	const b = nankaleinBridge;

	return (
		<group name="nankalein-chaung-and-bridge">
			{/* ======================================================== */}
			{/* ၁။ နန်းကလိန်ချောင်း ရေစီးလမ်းကြောင်း (Riverbed Trench) */}
			{/* ======================================================== */}
			<group name="nankalein-creek-channel">
				{segments.map((s, idx) => (
					<group key={`creek-seg-${idx}`} position={[s.mx, 0, s.mz]} rotation={[0, s.rot, 0]}>
						{/* Riverbed deep earth trench base */}
						<mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
							<planeGeometry args={[s.length, nankaleinCreek.trenchWidth]} />
							<meshStandardMaterial color="#554d38" roughness={0.95} />
						</mesh>

						{/* Sloped natural riverbanks (South bank) */}
						<mesh position={[0, -0.1, -nankaleinCreek.trenchWidth / 2 + 2]} rotation={[-Math.PI / 2 + 0.15, 0, 0]}>
							<planeGeometry args={[s.length, 4.5]} />
							<meshStandardMaterial color="#636c4b" roughness={0.9} />
						</mesh>

						{/* Sloped natural riverbanks (North bank) */}
						<mesh position={[0, -0.1, nankaleinCreek.trenchWidth / 2 - 2]} rotation={[-Math.PI / 2 - 0.15, 0, 0]}>
							<planeGeometry args={[s.length, 4.5]} />
							<meshStandardMaterial color="#636c4b" roughness={0.9} />
						</mesh>

						{/* Flowing Water Surface */}
						<mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
							<planeGeometry args={[s.length, nankaleinCreek.waterWidth]} />
							<meshStandardMaterial
								color="#3a8a8e"
								roughness={0.25}
								metalness={0.2}
								transparent
								opacity={0.88}
							/>
						</mesh>

						{/* Water foam and flow accents */}
						<group ref={flowRef}>
							{[-4, 0, 4].map((offset, fIdx) => (
								<mesh
									key={`foam-${fIdx}`}
									position={[0, 0.065, offset]}
									rotation={[-Math.PI / 2, 0, 0]}
								>
									<planeGeometry args={[s.length * 0.7, 0.45]} />
									<meshBasicMaterial color="#b2e2d9" transparent opacity={0.4} />
								</mesh>
							))}
						</group>
					</group>
				))}
			</group>

			{/* ======================================================== */}
			{/* ၂။ နန်းကလိန်ချောင်း တံတားကြီး (AH1 Large Highway Bridge) */}
			{/* ======================================================== */}
			<group position={[b.x, 0, b.z]} rotation={[0, b.rotation, 0]} name="nankalein-big-bridge">
				{/* (က) တံတား တိုင်ကြီးများနှင့် အောက်ခံ အုတ်ခုံ (Heavy Concrete Abutments) */}
				{/* South Abutment */}
				<Box x={0} y={0.1} z={b.length / 2 - 2} w={b.width + 1.2} h={1.4} d={4.2} color="#73716a" />
				{/* North Abutment */}
				<Box x={0} y={0.1} z={-b.length / 2 + 2} w={b.width + 1.2} h={1.4} d={4.2} color="#73716a" />

				{/* Central Pier in Creek */}
				<group position={[0, -0.2, 0]}>
					<mesh position={[-3.5, 0.2, 0]}>
						<cylinderGeometry args={[0.9, 1.1, 1.6, 16]} />
						<meshStandardMaterial color="#73716a" roughness={0.88} />
					</mesh>
					<mesh position={[3.5, 0.2, 0]}>
						<cylinderGeometry args={[0.9, 1.1, 1.6, 16]} />
						<meshStandardMaterial color="#73716a" roughness={0.88} />
					</mesh>
					{/* Pier Cap Beam */}
					<Box x={0} y={1.05} z={0} w={b.width - 0.5} h={0.5} d={2.2} color="#828078" />
				</group>

				{/* (ခ) တံတား ကတ္တရာလမ်းပြင် (Walkable & Drivable Bridge Asphalt Deck) */}
				<mesh
					position={[0, b.deckY, 0]}
					rotation={[-Math.PI / 2, 0, 0]}
					receiveShadow
					userData={{ walkable: true }}
				>
					<planeGeometry args={[b.roadWidth, b.length]} />
					<meshStandardMaterial color="#4f5957" roughness={0.8} metalness={0.08} />
				</mesh>

				{/* AH1 Bridge Yellow Dashed Centerline */}
				{[-10, -5, 0, 5, 10].map((vz) => (
					<mesh key={`b-stripe-${vz}`} position={[0, b.deckY + 0.02, vz]} rotation={[-Math.PI / 2, 0, 0]}>
						<planeGeometry args={[0.2, 3.2]} />
						<meshStandardMaterial color="#e9d9a2" roughness={0.6} />
					</mesh>
				))}

				{/* (ဂ) တံတား ဘေး လမ်းလျှောက်စင်္ကြံများ (Pedestrian Walkway Sidewalks with Curbs) */}
				{[-1, 1].map((side) => {
					const walkX = side * (b.roadWidth / 2 + b.walkwayWidth / 2);
					const curbX = side * (b.roadWidth / 2 + 0.15);
					return (
						<group key={`sidewalk-${side}`}>
							{/* Concrete Curb Stone */}
							<Box x={curbX} y={b.curbY - 0.04} z={0} w={0.3} h={0.22} d={b.length} color="#a69f8d" />

							{/* Walkway Slab (Walkable) */}
							<Box
								x={walkX}
								y={b.curbY}
								z={0}
								w={b.walkwayWidth}
								h={0.2}
								d={b.length}
								color="#b0aa99"
								walkable
							/>

							{/* (ဃ) ကွန်ကရစ် လက်ရန်းတိုင်များနှင့် အကာအရံများ (Solid Parapet Rails) */}
							{/* Parapet Base Beam */}
							<Box
								x={side * (b.width / 2 - 0.1)}
								y={b.curbY + 0.25}
								z={0}
								w={0.28}
								h={0.32}
								d={b.length}
								color="#8f8c82"
							/>
							{/* Upper Handrail Tube */}
							<Box
								x={side * (b.width / 2 - 0.1)}
								y={b.railingY}
								z={0}
								w={0.2}
								h={0.16}
								d={b.length}
								color="#274d47"
							/>

							{/* Railing Vertical Posts */}
							{Array.from({ length: 9 }, (_, pi) => {
								const pz = -b.length / 2 + 2 + pi * (b.length - 4) / 8;
								return (
									<group key={`post-${pi}`}>
										<Box
											x={side * (b.width / 2 - 0.1)}
											y={b.curbY + 0.38}
											z={pz}
											w={0.26}
											h={0.65}
											d={0.26}
											color="#a8a499"
										/>
										{/* Corner End Reflectors on Approach Ends */}
										{(pi === 0 || pi === 8) && (
											<mesh position={[side * (b.width / 2 - 0.1), b.railingY + 0.15, pz]}>
												<boxGeometry args={[0.18, 0.22, 0.18]} />
												<meshStandardMaterial
													color={pi === 0 ? '#ef4444' : '#ffffff'}
													emissive={pi === 0 ? '#b91c1c' : '#d4d4d4'}
													emissiveIntensity={0.5}
												/>
											</mesh>
										)}
									</group>
								);
							})}
						</group>
					);
				})}

				{/* (င) မြန်မာ့တံတား ဆိုင်းဘုတ်ကြီးများ (Authentic Myanmar Bridge Signposts at Approaches) */}
				{/* South Approach Signboard (Facing Traffic from Myothar Center) */}
				<group position={[b.width / 2 + 1.2, 0, b.length / 2 + 1.5]}>
					{/* Dual Posts */}
					<Box x={-0.8} y={1.2} z={0} w={0.12} h={2.4} d={0.12} color="#334155" />
					<Box x={0.8} y={1.2} z={0} w={0.12} h={2.4} d={0.12} color="#334155" />
					{/* Sign Plate - Classic Emerald Green with Gold Border */}
					<Box x={0} y={2.1} z={0} w={2.2} h={0.9} d={0.08} color="#14532d" />
					<Box x={0} y={2.1} z={0.045} w={2.1} h={0.82} d={0.02} color="#15803d" />
					{/* Gold Crest Bar */}
					<Box x={0} y={2.45} z={0.05} w={1.8} h={0.08} d={0.03} color="#f59e0b" />
					<Box x={0} y={1.85} z={0.05} w={1.8} h={0.06} d={0.03} color="#f59e0b" />
				</group>

				{/* North Approach Signboard (Facing Traffic from Area 1) */}
				<group position={[-b.width / 2 - 1.2, 0, -b.length / 2 - 1.5]}>
					<Box x={-0.8} y={1.2} z={0} w={0.12} h={2.4} d={0.12} color="#334155" />
					<Box x={0.8} y={1.2} z={0} w={0.12} h={2.4} d={0.12} color="#334155" />
					<Box x={0} y={2.1} z={0} w={2.2} h={0.9} d={0.08} color="#14532d" />
					<Box x={0} y={2.1} z={-0.045} w={2.1} h={0.82} d={0.02} color="#15803d" />
					<Box x={0} y={2.45} z={-0.05} w={1.8} h={0.08} d={0.03} color="#f59e0b" />
					<Box x={0} y={1.85} z={-0.05} w={1.8} h={0.06} d={0.03} color="#f59e0b" />
				</group>
			</group>
		</group>
	);
});
