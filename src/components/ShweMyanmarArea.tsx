import React from 'react';
import { Block, Box } from './Primitives';
import {
	shweMyanmarFuelStation,
	shweMyanmarRiceMill,
	shweMyanmarVacantLot,
	shweMyanmarResidential,
	shweMyanmarCrossRoads,
} from '../data/wards/myothar/shweMyanmarArea';

/**
 * သိုလှောင်ရုံတန်း တောင်ဘက်ပိုင်း 3D Scene Component
 * ၁။ ရွှေမြန်မာ စက်သုံးဆီဆိုင် (Shwe Myanmar Petrol Station)
 * ၂။ ဆန်စက်ရုံဝင်း (Rice Mill Compound)
 * ၃။ ဝိုင်းအလွတ်မြေ (Vacant Plot)
 * ၄။ လူနေရပ်ကွက်နှင့် သိန်းထိုက်စံ ဆိုင် (Residential Area & Building Materials Store)
 * ၅။ ကန့်လန့်ဖြတ် လမ်းသွယ်လေးများ (Cross Side Lanes)
 */
export function ShweMyanmarArea() {
	const fuel = shweMyanmarFuelStation;
	const mill = shweMyanmarRiceMill;
	const lot = shweMyanmarVacantLot;
	const res = shweMyanmarResidential;

	return (
		<group name="shwe-myanmar-south-area">
			{/* ၁။ ကန့်လန့်ဖြတ် လမ်းသွယ်လေးများ (Cross Roads at v = -250) */}
			{shweMyanmarCrossRoads.map((road) => (
				<group key={road.id} position={[road.x, 0.03, road.z]} rotation={[0, road.rotation, 0]}>
					<Block y={0.01} w={road.width} h={0.04} d={road.depth} color={road.color} walkable={true} />
					{/* လမ်းဘေး အနားသတ်များ (Road shoulders) */}
					{[-1, 1].map((s) => (
						<Block key={s} z={s * (road.depth / 2 - 0.2)} y={0.03} w={road.width} h={0.04} d={0.4} color="#8a9591" walkable={true} />
					))}
				</group>
			))}

			{/* ၂။ ရွှေမြန်မာ စက်သုံးဆီဆိုင် (Shwe Myanmar Fuel Station) */}
			<group name="shwe-myanmar-fuel-station">
				{/* ကွန်ကရစ် အဝင်ခြံဝင်း (Concrete Forecourt Apron) */}
				<group position={[fuel.pavement.x, 0.02, fuel.pavement.z]} rotation={[0, fuel.pavement.rotation, 0]}>
					<Block y={0.015} w={fuel.pavement.width} h={0.03} d={fuel.pavement.depth} color={fuel.pavement.color} walkable={true} />
					{/* လမ်းဘေး အဝင် အဝါ/အမည်း curb လိုင်း */}
					<Block x={-fuel.pavement.width / 2 + 0.3} y={0.04} w={0.6} h={0.06} d={fuel.pavement.depth} color="#e0a82b" walkable={true} />
				</group>

				{/* ဆီဖြည့် ခုံးမကြီး (Canopy with corporate colors & overhead lighting) */}
				<group position={[fuel.canopy.x, 0, fuel.canopy.z]} rotation={[0, fuel.canopy.rotation, 0]}>
					{/* အမိုးအောက်မျက်နှာကျက် (Ceiling panel with LED glow) */}
					<mesh position={[0, fuel.canopy.clearance, 0]}>
						<boxGeometry args={[fuel.canopy.width - 0.4, 0.1, fuel.canopy.depth - 0.4]} />
						<meshStandardMaterial color="#f8f9fa" emissive="#ffffff" emissiveIntensity={0.15} roughness={0.2} />
					</mesh>
					{/* အမိုးဘေးဘောင် အနီရောင် (Red Fascia) */}
					<mesh position={[0, fuel.canopy.clearance + fuel.canopy.roofThickness / 2, 0]} castShadow>
						<boxGeometry args={[fuel.canopy.width, fuel.canopy.roofThickness, fuel.canopy.depth]} />
						<meshStandardMaterial color={fuel.canopy.fasciaColor} roughness={0.3} />
					</mesh>
					{/* အပြာရောင် အလှလိုင်း (Blue Accent Trim) */}
					<mesh position={[0, fuel.canopy.clearance + fuel.canopy.roofThickness * 0.25, 0]}>
						<boxGeometry args={[fuel.canopy.width + 0.08, fuel.canopy.roofThickness * 0.3, fuel.canopy.depth + 0.08]} />
						<meshStandardMaterial color={fuel.canopy.stripeColor} roughness={0.2} />
					</mesh>
				</group>

				{/* ခုံးမကြီး ဒေါက်တိုင် ၄ တိုင် (Steel Columns) */}
				{fuel.canopy.columns.map((col, idx) => (
					<group key={`canopy-col-${idx}`} position={[col.x, 0, col.z]}>
						<mesh position={[0, fuel.canopy.clearance / 2, 0]} castShadow>
							<cylinderGeometry args={[0.35, 0.4, fuel.canopy.clearance, 16]} />
							<meshStandardMaterial color="#dee2e6" metalness={0.6} roughness={0.3} />
						</mesh>
						{/* တိုင်ခြေခုံ အဝါရောင် (Yellow Base Protector) */}
						<mesh position={[0, 0.4, 0]}>
							<cylinderGeometry args={[0.55, 0.6, 0.8, 16]} />
							<meshStandardMaterial color="#fcc419" roughness={0.4} />
						</mesh>
					</group>
				))}

				{/* ဆီပန့်ခုံများနှင့် ပန့်စက်များ (Pump Islands & Multi-Product Dispensers) */}
				{fuel.islands.map((island) => (
					<group key={island.id} position={[island.x, 0, island.z]} rotation={[0, island.rotation, 0]}>
						{/* မြှင့်ထားသော ကွန်ကရစ် အောက်ခံခုံ (Raised Island Curb) */}
						<Block y={0.12} w={island.width} h={0.22} d={island.depth} color="#e9ecef" walkable={true} />
						{island.pumps.map((pump, pIdx) => (
							<group key={pump.id} position={[0, 0.22, (pIdx - 1) * 5]}>
								{/* ပန့်စက် ကိုယ်ထည် (Pump Body) */}
								<Block y={0.9} w={1.2} h={1.8} d={1.4} color="#f1f3f5" />
								{/* ဆီအမျိုးအစား အရောင်အဖုံး (Grade Color Trim) */}
								<Block y={1.6} w={1.24} h={0.35} d={1.44} color={pump.color} />
								{/* ဒစ်ဂျစ်တယ် မီတာ မျက်နှာပြင် (Digital Display Screen) */}
								{[-1, 1].map((s) => (
									<mesh key={s} position={[s * 0.62, 1.25, 0]}>
										<planeGeometry args={[0.7, 0.4]} />
										<meshStandardMaterial color="#111" emissive="#333" roughness={0.1} />
									</mesh>
								))}
								{/* ဆီပိုက်ခေါင်း (Nozzle Holster) */}
								{[-1, 1].map((s) => (
									<Block key={`nozzle-${s}`} x={s * 0.65} y={0.9} z={0.3} w={0.12} h={0.45} d={0.15} color={pump.color} />
								))}
							</group>
						))}
					</group>
				))}

				{/* စတိုးဆိုင်နှင့် ရုံးခန်း အဆောက်အအုံ (Convenience Store / Office) */}
				<group position={[fuel.office.x, 0, fuel.office.z]} rotation={[0, fuel.office.rotation, 0]}>
					<Block y={0.15} w={fuel.office.width + 1.2} h={0.3} d={fuel.office.depth + 1.2} color="#ced4da" />
					{/* အဆောက်အအုံ ကိုယ်ထည် (Main Walls) */}
					<Block y={fuel.office.height / 2} w={fuel.office.width} h={fuel.office.height} d={fuel.office.depth} color={fuel.office.color} />
					{/* ရှေ့ဘက် မှန်ပြတင်းပေါက်ကြီးများ (Glass Storefront Windows) */}
					<mesh position={[-fuel.office.width / 2 - 0.08, fuel.office.height * 0.45, 0]}>
						<boxGeometry args={[0.15, fuel.office.height * 0.65, fuel.office.depth - 3]} />
						<meshStandardMaterial color="#82c91e" opacity={0.65} transparent={true} metalness={0.7} roughness={0.1} />
					</mesh>
					{/* အမိုး အနားကွပ် (Roof Parapet) */}
					<Block y={fuel.office.height + 0.3} w={fuel.office.width + 0.6} h={0.6} d={fuel.office.depth + 0.6} color={fuel.office.roof} />
					{/* စတိုးဆိုင် အပေါ်ဆိုင်းဘုတ် (Store Front Banner) */}
					<mesh position={[-fuel.office.width / 2 - 0.12, fuel.office.height - 0.4, 0]}>
						<boxGeometry args={[0.1, 0.8, fuel.office.depth - 4]} />
						<meshStandardMaterial color="#c92a2a" roughness={0.3} />
					</mesh>
				</group>

				{/* လမ်းဘေး ဆိုင်းဘုတ်တိုင်ကြီး (Totem / Price Pole Sign) */}
				<group position={[fuel.totem.x, 0, fuel.totem.z]} rotation={[0, fuel.totem.rotation, 0]}>
					{/* အောက်ခံခုံ (Pedestal) */}
					<Block y={0.3} w={fuel.totem.width + 0.6} h={0.6} d={fuel.totem.depth + 0.4} color="#495057" />
					{/* တိုင်ကြီး (Pylon Column) */}
					<Block y={fuel.totem.height / 2} w={fuel.totem.width} h={fuel.totem.height} d={fuel.totem.depth} color="#f8f9fa" />
					{/* ထိပ်ပိုင်း ရွှေမြန်မာ အမှတ်တံဆိပ် အနီကွက် (Red Top Emblem) */}
					<mesh position={[0, fuel.totem.height - 0.9, 0]}>
						<boxGeometry args={[fuel.totem.width + 0.1, 1.6, fuel.totem.depth + 0.1]} />
						<meshStandardMaterial color="#c92a2a" roughness={0.3} />
					</mesh>
					{/* ရွှေဒေါင်း အဝါရောင် အဝိုင်း (Golden Emblem) */}
					{[-1, 1].map((s) => (
						<mesh key={s} position={[0, fuel.totem.height - 0.9, s * (fuel.totem.depth / 2 + 0.08)]}>
							<circleGeometry args={[0.55, 24]} />
							<meshStandardMaterial color="#ffd43b" metalness={0.8} roughness={0.2} />
						</mesh>
					))}
					{/* ဆီဈေးနှုန်း ပြဘုတ် အကွက်များ (Price Displays) */}
					{[
						{ label: '92', color: '#2b8a3e', y: 4.2 },
						{ label: '95', color: '#e03131', y: 3.2 },
						{ label: 'DSL', color: '#f59f00', y: 2.2 },
					].map((row, idx) => (
						<mesh key={idx} position={[0, row.y, fuel.totem.depth / 2 + 0.06]}>
							<boxGeometry args={[fuel.totem.width - 0.4, 0.7, 0.08]} />
							<meshStandardMaterial color="#212529" emissive="#111" />
						</mesh>
					))}
				</group>

				{/* မြေအောက်ဆီကန် အဖုံးများ (Underground Tank Manhole Covers) */}
				{fuel.tanks.map((t, idx) => (
					<mesh key={`tank-${idx}`} position={[t.x, 0.04, t.z]}>
						<cylinderGeometry args={[t.radius, t.radius, 0.05, 16]} />
						<meshStandardMaterial color="#495057" metalness={0.7} roughness={0.3} />
					</mesh>
				))}

				{/* ခြံစည်းရိုး နံရံများ (Perimeter Walls) */}
				{fuel.walls.map((w, idx) => (
					<group key={`fuel-wall-${idx}`} position={[w.x, 0, w.z]} rotation={[0, w.rotation, 0]}>
						<Block y={0.9} w={w.width} h={1.8} d={w.depth} color="#ced4da" />
						{/* တံတိုင်းထိပ် အုပ်ကြွပ် (Coping) */}
						<Block y={1.85} w={w.width + 0.2} h={0.15} d={w.depth} color="#868e96" />
					</group>
				))}
			</group>

			{/* ၃။ ဆန်စက်ရုံဝင်း (Shwe Myanmar Rice Mill Compound) */}
			<group name="shwe-myanmar-rice-mill">
				{/* စပါးလှန်း ကုန်လန်းပြင် (Concrete Drying Yard) */}
				<group position={[mill.dryingYard.x, 0.02, mill.dryingYard.z]} rotation={[0, mill.dryingYard.rotation, 0]}>
					<Block y={0.015} w={mill.dryingYard.width} h={0.03} d={mill.dryingYard.depth} color={mill.dryingYard.color} walkable={true} />
					{/* စပါးလှန်းထားသည့် ရွှေဝါရောင် အကွက်များ (Golden Paddy Grain Drying Strips) */}
					{[-6, 0, 6].map((offset, idx) => (
						<mesh key={`paddy-strip-${idx}`} position={[0, 0.035, offset]}>
							<boxGeometry args={[mill.dryingYard.width - 6, 0.02, 3.8]} />
							<meshStandardMaterial color="#fab005" roughness={0.9} />
						</mesh>
					))}
				</group>

				{/* အဓိက ဆန်စက်ရုံ အဆောက်အအုံကြီး (Main Mill Hall) */}
				<group position={[mill.mainBuilding.x, 0, mill.mainBuilding.z]} rotation={[0, mill.mainBuilding.rotation, 0]}>
					<Block y={0.15} w={mill.mainBuilding.width + 1.2} h={0.3} d={mill.mainBuilding.depth + 1.2} color="#a39a88" />
					{/* နံရံကြီးများ (Factory Walls) */}
					<Block y={mill.mainBuilding.height / 2} w={mill.mainBuilding.width} h={mill.mainBuilding.height} d={mill.mainBuilding.depth} color={mill.mainBuilding.color} />
					{/* စက်ရုံ နှစ်ထပ်စောက် အမိုး (Industrial Gable Roof) */}
					{[-1, 1].map((s) => (
						<mesh
							key={`mill-roof-${s}`}
							position={[s * (mill.mainBuilding.width / 4), mill.mainBuilding.height + 1.6, 0]}
							rotation={[0, 0, -s * Math.atan2(3.2, mill.mainBuilding.width / 2)]}
							castShadow
						>
							<boxGeometry args={[Math.hypot(mill.mainBuilding.width / 2, 3.2) + 1.2, 0.28, mill.mainBuilding.depth + 1.6]} />
							<meshStandardMaterial color={mill.mainBuilding.roof} metalness={0.3} roughness={0.6} />
						</mesh>
					))}
					{/* အမိုးထိပ် လေဝင်လေထွက် မော်နီတာ (Roof Ridge Vent Monitor) */}
					<mesh position={[0, mill.mainBuilding.height + 3.2, 0]} castShadow>
						<boxGeometry args={[3.2, 1.4, mill.mainBuilding.depth - 2]} />
						<meshStandardMaterial color="#556460" />
					</mesh>
					{/* စက်ရုံ ခေါင်းတိုင်နှင့် ဖွဲပြာစုပ်စက် (Cyclone Dust Separator & Exhaust Chimney) */}
					<mesh position={[mill.mainBuilding.width / 2 - 2, mill.mainBuilding.height + 3.5, 6]} castShadow>
						<cylinderGeometry args={[0.9, 1.2, 4.5, 16]} />
						<meshStandardMaterial color="#868e96" metalness={0.7} roughness={0.3} />
					</mesh>
					{/* ကုန်တင်ကုန်ချ တံခါးပေါက်ကြီးများ (Loading Roll-up Bay Doors) */}
					{[-6, 6].map((offset, idx) => (
						<mesh key={`loading-door-${idx}`} position={[mill.mainBuilding.width / 2 + 0.08, 2.2, offset]}>
							<boxGeometry args={[0.15, 4.2, 4.8]} />
							<meshStandardMaterial color="#495057" metalness={0.5} roughness={0.5} />
						</mesh>
					))}
				</group>

				{/* စပါးသိုလှောင်ရုံကြီး (Paddy Storage Warehouse) */}
				<group position={[mill.storageBuilding.x, 0, mill.storageBuilding.z]} rotation={[0, mill.storageBuilding.rotation, 0]}>
					<Block y={0.15} w={mill.storageBuilding.width + 1.0} h={0.3} d={mill.storageBuilding.depth + 1.0} color="#9e917d" />
					<Block y={mill.storageBuilding.height / 2} w={mill.storageBuilding.width} h={mill.storageBuilding.height} d={mill.storageBuilding.depth} color={mill.storageBuilding.color} />
					{/* သိုလှောင်ရုံ အမိုးနီညိုရောင် (Gable Roof) */}
					{[-1, 1].map((s) => (
						<mesh
							key={`paddy-roof-${s}`}
							position={[s * (mill.storageBuilding.width / 4), mill.storageBuilding.height + 1.3, 0]}
							rotation={[0, 0, -s * Math.atan2(2.6, mill.storageBuilding.width / 2)]}
							castShadow
						>
							<boxGeometry args={[Math.hypot(mill.storageBuilding.width / 2, 2.6) + 1.0, 0.25, mill.storageBuilding.depth + 1.2]} />
							<meshStandardMaterial color={mill.storageBuilding.roof} roughness={0.7} />
						</mesh>
					))}
				</group>

				{/* ဂိတ်ရုံးနှင့် ချိန်ခွင် (Gate Office) */}
				<group position={[mill.gateOffice.x, 0, mill.gateOffice.z]} rotation={[0, mill.gateOffice.rotation, 0]}>
					<Block y={mill.gateOffice.height / 2} w={mill.gateOffice.width} h={mill.gateOffice.height} d={mill.gateOffice.depth} color={mill.gateOffice.color} />
					<Block y={mill.gateOffice.height + 0.2} w={mill.gateOffice.width + 0.6} h={0.4} d={mill.gateOffice.depth + 0.6} color={mill.gateOffice.roof} />
					{/* ပြတင်းပေါက် မှန်များ */}
					<mesh position={[0, mill.gateOffice.height * 0.55, mill.gateOffice.depth / 2 + 0.06]}>
						<boxGeometry args={[3.2, 1.4, 0.1]} />
						<meshStandardMaterial color="#74c0fc" opacity={0.7} transparent={true} />
					</mesh>
				</group>

				{/* ဆန်စက် အဝင်ဆိုင်းဘုတ် မုခ်ဦး (Entrance Arch Gate) */}
				<group position={[mill.entranceGate.x, 0, mill.entranceGate.z]} rotation={[0, mill.entranceGate.rotation, 0]}>
					{/* တံခါးတိုင် ၂ တိုင် (Gate Pillars) */}
					{[-mill.entranceGate.depth / 2 + 0.6, mill.entranceGate.depth / 2 - 0.6].map((offset, idx) => (
						<Block key={`gate-pillar-${idx}`} x={0} y={2.4} z={offset} w={1.2} h={4.8} d={1.2} color="#adb5bd" />
					))}
					{/* အပေါ်မုခ်ဦး ဘားတန်း (Overhead Arch Beam) */}
					<Block y={4.5} w={1.4} h={0.9} d={mill.entranceGate.depth} color="#2b8a3e" />
				</group>

				{/* ခြံစည်းရိုး အုတ်တံတိုင်းများ (Mill Perimeter Walls) */}
				{mill.walls.map((w, idx) => (
					<group key={`mill-wall-${idx}`} position={[w.x, 0, w.z]} rotation={[0, w.rotation, 0]}>
						<Block y={1.0} w={w.width} h={2.0} d={w.depth} color="#ced4da" />
						<Block y={2.05} w={w.width} h={0.15} d={w.depth + 0.15} color="#868e96" />
					</group>
				))}
			</group>

			{/* ၄။ မြေကွက်လပ် / ဝိုင်းအလွတ်မြေ (Vacant Lot) */}
			<group name="shwe-myanmar-vacant-lot">
				{/* မြေကွက်ပြင် (Natural Lot Terrain) */}
				<group position={[lot.ground.x, 0.015, lot.ground.z]} rotation={[0, lot.ground.rotation, 0]}>
					<Block y={0.01} w={lot.ground.width} h={0.02} d={lot.ground.depth} color={lot.ground.color} walkable={true} />
					{/* သဲမြေ/မြေနီကွက်များ (Bare Dirt Patches) */}
					{[-18, 12].map((offset, idx) => (
						<mesh key={`dirt-patch-${idx}`} position={[offset, 0.025, (idx - 0.5) * 8]}>
							<circleGeometry args={[6.5, 16]} />
							<meshStandardMaterial color="#c5b68a" roughness={0.95} />
						</mesh>
					))}
				</group>

				{/* သစ်သား တဲအိမ်ငယ် (Field Shed) */}
				<group position={[lot.shed.x, 0, lot.shed.z]} rotation={[0, lot.shed.rotation, 0]}>
					{/* တိုင်ခြေ ၄ တိုင် (Stilts) */}
					<Block y={lot.shed.height / 2} w={lot.shed.width} h={lot.shed.height} d={lot.shed.depth} color={lot.shed.color} />
					{/* တဲအမိုး (Thatched / Tin Roof) */}
					{[-1, 1].map((s) => (
						<mesh
							key={`shed-roof-${s}`}
							position={[s * (lot.shed.width / 4), lot.shed.height + 0.8, 0]}
							rotation={[0, 0, -s * Math.atan2(1.6, lot.shed.width / 2)]}
							castShadow
						>
							<boxGeometry args={[Math.hypot(lot.shed.width / 2, 1.6) + 0.8, 0.18, lot.shed.depth + 0.8]} />
							<meshStandardMaterial color={lot.shed.roof} roughness={0.9} />
						</mesh>
					))}
				</group>

				{/* ခြံစည်းရိုး တိုင်များ (Fence Boundary Rails) */}
				{lot.fences.map((f, idx) => (
					<group key={`lot-fence-${idx}`} position={[f.x, 0, f.z]} rotation={[0, f.rotation, 0]}>
						<Block y={0.65} w={f.width} h={1.3} d={f.depth} color="#8c7853" walkable={false} />
					</group>
				))}

				{/* သစ်ပင်ရိပ်များ (Shade Trees) */}
				{lot.trees.map((t, idx) => (
					<group key={`lot-tree-${idx}`} position={[t.x, 0, t.z]}>
						{/* သစ်ပင် ပင်စည် (Trunk) */}
						<mesh position={[0, 1.8, 0]} castShadow>
							<cylinderGeometry args={[0.3, 0.45, 3.6, 10]} />
							<meshStandardMaterial color="#5c4d3c" roughness={0.9} />
						</mesh>
						{/* သစ်ရွက်အုပ် (Foliage) */}
						<mesh position={[0, 4.2, 0]} castShadow>
							<sphereGeometry args={[t.radius, 12, 10]} />
							<meshStandardMaterial color="#40693a" roughness={0.7} />
						</mesh>
					</group>
				))}
			</group>

			{/* ၅။ လူနေရပ်ကွက် (Residential Houses & Thein Htike San Building Supplies) */}
			<group name="shwe-myanmar-residential-area">
				{/* သိန်းထိုက်စံ ဆောက်လုပ်ရေးပစ္စည်း အရောင်းဆိုင် (Building Materials Store) */}
				<group position={[res.store.x, 0, res.store.z]} rotation={[0, res.store.rotation, 0]}>
					<Block y={0.15} w={res.store.width + 1.0} h={0.3} d={res.store.depth + 1.0} color="#b8afa0" />
					<Block y={res.store.height / 2} w={res.store.width} h={res.store.height} d={res.store.depth} color={res.store.color} />
					{/* ဆိုင်ခေါင်မိုး (Gable Roof) */}
					{[-1, 1].map((s) => (
						<mesh
							key={`store-roof-${s}`}
							position={[s * (res.store.width / 4), res.store.height + 1.1, 0]}
							rotation={[0, 0, -s * Math.atan2(2.2, res.store.width / 2)]}
							castShadow
						>
							<boxGeometry args={[Math.hypot(res.store.width / 2, 2.2) + 0.8, 0.22, res.store.depth + 1.0]} />
							<meshStandardMaterial color={res.store.roof} metalness={0.4} roughness={0.5} />
						</mesh>
					))}
					{/* ဆိုင်ဆိုင်းဘုတ်ကြီး (Prominent Store Signboard) */}
					<mesh position={[0, res.store.height - 0.2, res.store.depth / 2 + 0.1]}>
						<boxGeometry args={[res.store.width - 2, 1.2, 0.12]} />
						<meshStandardMaterial color="#1864ab" roughness={0.3} />
					</mesh>
					{/* အပြင်ဘက်ရှိ အုတ်ပုံ၊ ဘိလပ်မြေအိတ်ပုံ၊ ပိုက်လိုင်းများ (Building Material Stacks) */}
					<Block x={3.5} y={0.6} z={res.store.depth / 2 + 2.2} w={2.8} h={1.2} d={2.2} color="#c92a2a" />
					<Block x={-3.5} y={0.5} z={res.store.depth / 2 + 2.0} w={3.0} h={1.0} d={2.0} color="#868e96" />
				</group>

				{/* လူနေအိမ်များ ၅ လုံး (Residential Myanmar Houses) */}
				{res.houses.map((house) => (
					<group key={house.id} position={[house.x, 0, house.z]} rotation={[0, house.rotation, 0]}>
                        <PorchCandles width={house.width*.7} front={house.depth/2} y={house.height*.4+.06}/>
						{/* အောက်ခံခုံ (Foundation Base) */}
						<Block y={0.15} w={house.width + 0.8} h={0.3} d={house.depth + 0.8} color="#bfae95" />
						{/* အိမ်ကိုယ်ထည် (House Body) */}
						<Block y={house.height / 2} w={house.width} h={house.height} d={house.depth} color={house.color} />
						{/* နှစ်ထပ် ဝရံတာနှင့် ပြတင်းပေါက်များ (Veranda / Balcony) */}
						<Block x={0} y={house.height * 0.4} z={house.depth / 2 + 0.6} w={house.width * 0.7} h={0.12} d={1.4} color="#805d3b" />
						{/* အမိုးစောက် (Traditional Gable Roof) */}
						{[-1, 1].map((s) => (
							<mesh
								key={`res-roof-${house.id}-${s}`}
								position={[s * (house.width / 4), house.height + 1.2, 0]}
								rotation={[0, 0, -s * Math.atan2(2.4, house.width / 2)]}
								castShadow
							>
								<boxGeometry args={[Math.hypot(house.width / 2, 2.4) + 0.9, 0.22, house.depth + 1.1]} />
								<meshStandardMaterial color={house.roof} roughness={0.6} />
							</mesh>
						))}
					</group>
				))}

				{/* လူနေရပ်ကွက် သစ်ပင်များ (Residential Greenery & Palms) */}
				{res.trees.map((t, idx) => (
					<group key={`res-tree-${idx}`} position={[t.x, 0, t.z]}>
						<mesh position={[0, 1.7, 0]} castShadow>
							<cylinderGeometry args={[0.25, 0.38, 3.4, 10]} />
							<meshStandardMaterial color="#504233" roughness={0.9} />
						</mesh>
						<mesh position={[0, 4.0, 0]} castShadow>
							<sphereGeometry args={[t.radius, 12, 10]} />
							<meshStandardMaterial color="#355e3b" roughness={0.7} />
						</mesh>
					</group>
				))}
			</group>
		</group>
	);
}
import {PorchCandles} from './FestivalAnchor';
