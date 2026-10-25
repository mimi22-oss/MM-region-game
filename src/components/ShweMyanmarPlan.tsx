import React from 'react';
import {
	shweMyanmarFuelStation,
	shweMyanmarRiceMill,
	shweMyanmarVacantLot,
	shweMyanmarResidential,
	shweMyanmarCrossRoads,
} from '../data/wards/myothar/shweMyanmarArea';

/**
 * သိုလှောင်ရုံတန်း တောင်ဘက်ပိုင်း 2D Map SVG Plan Component
 * Minimap နှင့် Full Expanded Map များတွင် ပြသရန်
 */
export function ShweMyanmarPlan({
	labels = true,
	onSelectLocation,
}: {
	labels?: boolean;
	onSelectLocation?: (id: string) => void;
}) {
	const fuel = shweMyanmarFuelStation;
	const mill = shweMyanmarRiceMill;
	const lot = shweMyanmarVacantLot;
	const res = shweMyanmarResidential;

	return (
		<g id="shwe-myanmar-south-plan">
			{/* ၁။ ကန့်လန့်ဖြတ် လမ်းသွယ် (Cross Roads based on map4.png) */}
			{shweMyanmarCrossRoads.map((road) => (
				<g key={`plan-${road.id}`} transform={`translate(${road.x} ${road.z}) rotate(${(-road.rotation * 180) / Math.PI})`}>
					<rect
						x={-road.width / 2}
						y={-road.depth / 2}
						width={road.width}
						height={road.depth}
						fill="#616c68"
						stroke="#4a5350"
						strokeWidth="0.4"
					/>
				</g>
			))}
			{labels && (
				<g transform={`translate(${shweMyanmarCrossRoads[0].x + 10} ${shweMyanmarCrossRoads[0].z - 6}) rotate(${(-shweMyanmarCrossRoads[0].rotation * 180) / Math.PI})`}>
					<text
						textAnchor="middle"
						fontSize="4.2"
						fill="#fff"
						stroke="#1e293b"
						strokeWidth="0.6"
						fontWeight="bold"
					>
						ကန့်လန့်ဖြတ်လမ်းသွယ်
					</text>
				</g>
			)}

			{/* ၂။ ရွှေမြန်မာ စက်သုံးဆီဆိုင် (Shwe Myanmar Fuel Station) */}
			<g
				id="plan-shwe-myanmar-fuel"
				className={labels ? 'map-region-clickable' : undefined}
				onClick={
					labels && onSelectLocation
						? (e) => {
								e.stopPropagation();
								onSelectLocation(fuel.id);
						  }
						: undefined
				}
				style={{ cursor: labels ? 'pointer' : 'default' }}
			>
				{/* ခြံဝင်း ကွန်ကရစ် အောက်ခံ (Pavement) */}
				<g transform={`translate(${fuel.pavement.x} ${fuel.pavement.z}) rotate(${(-fuel.pavement.rotation * 180) / Math.PI})`}>
					<rect
						x={-fuel.pavement.width / 2}
						y={-fuel.pavement.depth / 2}
						width={fuel.pavement.width}
						height={fuel.pavement.depth}
						fill="#cfd4d8"
						stroke="#adb5bd"
						strokeWidth="0.5"
						rx="2"
					/>
				</g>
				{/* စတိုးနှင့်ရုံးခန်း (Office) */}
				<g transform={`translate(${fuel.office.x} ${fuel.office.z}) rotate(${(-fuel.office.rotation * 180) / Math.PI})`}>
					<rect
						x={-fuel.office.width / 2}
						y={-fuel.office.depth / 2}
						width={fuel.office.width}
						height={fuel.office.depth}
						fill="#343a40"
						stroke="#adb5bd"
						strokeWidth="0.5"
					/>
				</g>
				{/* ဆီဖြည့် ခုံးမကြီး (Canopy with Red/Blue Top) */}
				<g transform={`translate(${fuel.canopy.x} ${fuel.canopy.z}) rotate(${(-fuel.canopy.rotation * 180) / Math.PI})`}>
					<rect
						x={-fuel.canopy.width / 2}
						y={-fuel.canopy.depth / 2}
						width={fuel.canopy.width}
						height={fuel.canopy.depth}
						fill="#c92a2a"
						stroke="#f8f9fa"
						strokeWidth="0.8"
						rx="1.5"
					/>
					<rect
						x={-fuel.canopy.width / 2 + 1}
						y={-fuel.canopy.depth / 2 + 1}
						width={fuel.canopy.width - 2}
						height={fuel.canopy.depth - 2}
						fill="#1864ab"
					/>
					{/* ဆီပန့်ကျွန်းများ (Islands) */}
					{[-3, 3].map((offX, idx) => (
						<rect key={idx} x={offX - 0.6} y={-8} width="1.2" height="16" fill="#f8f9fa" rx="0.5" />
					))}
				</g>
				{/* ဆိုင်းဘုတ် (Totem Marker) */}
				<g transform={`translate(${fuel.totem.x} ${fuel.totem.z})`}>
					<circle r="2.8" fill="#c92a2a" stroke="#ffd43b" strokeWidth="0.8" />
					<text y="0.8" textAnchor="middle" fontSize="2.2" fill="#fff" fontWeight="bold">
						⛽
					</text>
				</g>
				{labels && (
					<text
						x={fuel.canopy.x}
						y={fuel.canopy.z - 8}
						textAnchor="middle"
						fontSize="4.8"
						fill="#c92a2a"
						stroke="#fff"
						strokeWidth="0.6"
						fontWeight="bold"
					>
						ရွှေမြန်မာ စက်သုံးဆီ ↗
					</text>
				)}
			</g>

			{/* ၃။ ဆန်စက်ရုံဝင်း (Shwe Myanmar Rice Mill) */}
			<g
				id="plan-shwe-myanmar-rice-mill"
				className={labels ? 'map-region-clickable' : undefined}
				onClick={
					labels && onSelectLocation
						? (e) => {
								e.stopPropagation();
								onSelectLocation(mill.id);
						  }
						: undefined
				}
				style={{ cursor: labels ? 'pointer' : 'default' }}
			>
				{/* ကုန်လန်း စပါးလှန်းပြင် (Drying Yard) */}
				<g transform={`translate(${mill.dryingYard.x} ${mill.dryingYard.z}) rotate(${(-mill.dryingYard.rotation * 180) / Math.PI})`}>
					<rect
						x={-mill.dryingYard.width / 2}
						y={-mill.dryingYard.depth / 2}
						width={mill.dryingYard.width}
						height={mill.dryingYard.depth}
						fill="#d4cbb5"
						stroke="#bfae95"
						strokeWidth="0.5"
					/>
					{/* ရွှေဝါရောင် စပါးကွက်များ */}
					{[-6, 0, 6].map((offset, idx) => (
						<rect key={idx} x={-mill.dryingYard.width / 2 + 3} y={offset - 1.5} width={mill.dryingYard.width - 6} height="3" fill="#fab005" opacity="0.85" />
					))}
				</g>
				{/* စပါးသိုလှောင်ရုံ (Paddy Shed) */}
				<g transform={`translate(${mill.storageBuilding.x} ${mill.storageBuilding.z}) rotate(${(-mill.storageBuilding.rotation * 180) / Math.PI})`}>
					<rect
						x={-mill.storageBuilding.width / 2}
						y={-mill.storageBuilding.depth / 2}
						width={mill.storageBuilding.width}
						height={mill.storageBuilding.depth}
						fill={mill.storageBuilding.roof}
						stroke="#e2d0a5"
						strokeWidth="0.5"
					/>
				</g>
				{/* အဓိက ဆန်စက်ရုံ အဆောက်အအုံ (Main Hall) */}
				<g transform={`translate(${mill.mainBuilding.x} ${mill.mainBuilding.z}) rotate(${(-mill.mainBuilding.rotation * 180) / Math.PI})`}>
					<rect
						x={-mill.mainBuilding.width / 2}
						y={-mill.mainBuilding.depth / 2}
						width={mill.mainBuilding.width}
						height={mill.mainBuilding.depth}
						fill={mill.mainBuilding.roof}
						stroke="#adb5bd"
						strokeWidth="0.6"
					/>
					<line y1={-mill.mainBuilding.depth / 2} y2={mill.mainBuilding.depth / 2} stroke="#495057" strokeWidth="0.8" />
				</g>
				{/* ဂိတ်မုခ်ဦး (Entrance Gate) */}
				<g transform={`translate(${mill.entranceGate.x} ${mill.entranceGate.z})`}>
					<circle r="2.2" fill="#2b8a3e" stroke="#fff" strokeWidth="0.5" />
					<text y="0.7" textAnchor="middle" fontSize="1.8" fill="#fff" fontWeight="bold">
						🏭
					</text>
				</g>
				{labels && (
					<text
						x={mill.mainBuilding.x}
						y={mill.mainBuilding.z - 8}
						textAnchor="middle"
						fontSize="4.8"
						fill="#2b8a3e"
						stroke="#fff"
						strokeWidth="0.6"
						fontWeight="bold"
					>
						ဆန်စက် ↗
					</text>
				)}
			</g>

			{/* ၄။ မြေကွက်လပ် / ဝိုင်းအလွတ်မြေ (Vacant Lot) */}
			<g
				id="plan-shwe-myanmar-vacant-lot"
				className={labels ? 'map-region-clickable' : undefined}
				onClick={
					labels && onSelectLocation
						? (e) => {
								e.stopPropagation();
								onSelectLocation(lot.id);
						  }
						: undefined
				}
				style={{ cursor: labels ? 'pointer' : 'default' }}
			>
				{/* မြေကွက်အလွတ် အကျယ်အဝန်း (Ground) */}
				<g transform={`translate(${lot.ground.x} ${lot.ground.z}) rotate(${(-lot.ground.rotation * 180) / Math.PI})`}>
					<rect
						x={-lot.ground.width / 2}
						y={-lot.ground.depth / 2}
						width={lot.ground.width}
						height={lot.ground.depth}
						fill={lot.ground.color}
						stroke="#8c7853"
						strokeWidth="0.6"
						strokeDasharray="2 1.5"
					/>
				</g>
				{/* တဲအိမ်ငယ် (Shed) */}
				<g transform={`translate(${lot.shed.x} ${lot.shed.z}) rotate(${(-lot.shed.rotation * 180) / Math.PI})`}>
					<rect
						x={-lot.shed.width / 2}
						y={-lot.shed.depth / 2}
						width={lot.shed.width}
						height={lot.shed.depth}
						fill={lot.shed.roof}
						stroke="#5c4d3c"
						strokeWidth="0.4"
					/>
				</g>
				{/* သစ်ပင်များ (Trees) */}
				{lot.trees.map((t, idx) => (
					<circle key={`lot-plan-tree-${idx}`} cx={t.x} cy={t.z} r={t.radius} fill="#40693a" opacity="0.8" />
				))}
				{labels && (
					<text
						x={lot.ground.x}
						y={lot.ground.z}
						textAnchor="middle"
						fontSize="4.5"
						fill="#5c4d3c"
						stroke="#fff"
						strokeWidth="0.5"
						fontWeight="bold"
					>
						မြေကွက်လပ် (ဝိုင်းအလွတ်မြေ) ↗
					</text>
				)}
			</g>

			{/* ၅။ လူနေရပ်ကွက် (Residential Houses & Store) */}
			<g
				id="plan-shwe-myanmar-residential"
				className={labels ? 'map-region-clickable' : undefined}
				onClick={
					labels && onSelectLocation
						? (e) => {
								e.stopPropagation();
								onSelectLocation(res.id);
						  }
						: undefined
				}
				style={{ cursor: labels ? 'pointer' : 'default' }}
			>
				{/* သိန်းထိုက်စံ ဆောက်လုပ်ရေးပစ္စည်း အရောင်းဆိုင် (Thein Htike San Store) */}
				<g transform={`translate(${res.store.x} ${res.store.z}) rotate(${(-res.store.rotation * 180) / Math.PI})`}>
					<rect
						x={-res.store.width / 2}
						y={-res.store.depth / 2}
						width={res.store.width}
						height={res.store.depth}
						fill={res.store.roof}
						stroke="#1864ab"
						strokeWidth="0.6"
					/>
					{labels && (
						<text y="0.8" textAnchor="middle" fontSize="2.0" fill="#fff" fontWeight="bold">
							သိန်းထိုက်စံ
						</text>
					)}
				</g>
				{/* လူနေအိမ်များ (Houses) */}
				{res.houses.map((house) => (
					<g key={`plan-${house.id}`} transform={`translate(${house.x} ${house.z}) rotate(${(-house.rotation * 180) / Math.PI})`}>
						<rect
							x={-house.width / 2}
							y={-house.depth / 2}
							width={house.width}
							height={house.depth}
							fill={house.roof}
							stroke="#868e96"
							strokeWidth="0.4"
						/>
					</g>
				))}
				{/* သစ်ပင်များ (Trees) */}
				{res.trees.map((t, idx) => (
					<circle key={`res-plan-tree-${idx}`} cx={t.x} cy={t.z} r={t.radius} fill="#355e3b" opacity="0.8" />
				))}
				{labels && (
					<text
						x={res.houses[1].x}
						y={res.houses[1].z - 6}
						textAnchor="middle"
						fontSize="4.6"
						fill="#1864ab"
						stroke="#fff"
						strokeWidth="0.5"
						fontWeight="bold"
					>
						လူနေရပ်ကွက် ↗
					</text>
				)}
			</g>
		</g>
	);
}
