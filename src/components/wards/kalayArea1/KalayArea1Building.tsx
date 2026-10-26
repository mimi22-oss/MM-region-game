import { memo } from 'react';
import { ImportedGableRoof } from '../../ImportedGableRoof.tsx';
import type { KalayArea1BuildingData } from '../../../data/wards/kalayArea1/kalayArea1Buildings.ts';
import { Block as Box } from '../../Primitives.tsx';

export interface KalayArea1BuildingProps {
	building: KalayArea1BuildingData;
	selected?: boolean;
	onSelect?: (id: string) => void;
}

/**
 * ကလေးမြို့ နယ်မြေ (၁) အဆောက်အအုံနှင့် ခြံဝန်း 3D Model
 */
export const KalayArea1Building = memo(function KalayArea1Building({
	building,
	selected = false,
	onSelect,
}: KalayArea1BuildingProps) {
	const w = building.houseWidth || 5.0;
	const d = building.houseLength || 6.2;
	const isTwoStorey = building.area >= 70;
	const wallH = building.wallHeight ?? 3.0;
	const pitchH = Math.min(building.roofHeight ?? 1.5, w * 0.4);

	// Compound & fence bounds
	const sideHalf = building.fenceSideHalf || w / 2 + 1.4;
	const backHalf = building.fenceBackHalf || d / 2 + 1.2;
	const frontHalf = building.fenceFrontHalf || d / 2 + 2.2;
	const fenceW = sideHalf * 2;
	const fenceD = backHalf + frontHalf;
	const fenceCenterZ = (frontHalf - backHalf) / 2;
	const gateW = building.gateWidth || 2.4;
	const halfGate = gateW / 2;
	const houseZ = building.houseZOffset ?? -0.4;

	const handleClick = (e: { stopPropagation: () => void }) => {
		e.stopPropagation();
		onSelect?.(building.id);
	};

	const wallColor = selected ? '#fef08a' : building.wallColor;
	const roofColor = selected ? '#38bdf8' : building.roofColor;
	const fenceColor = building.fenceColor || '#2563a6';

	// Front fence segments calculation
	const leftSheetLen = Math.max(0.2, sideHalf - halfGate);
	const rightSheetLen = Math.max(0.2, sideHalf - halfGate);
	const leftSheetCenterX = (-sideHalf - halfGate) / 2;
	const rightSheetCenterX = (halfGate + sideHalf) / 2;

	// Porch width
	const porchW = Math.min(w * 0.65, 4.0);

	return (
		<group
			position={[building.x, 0, building.z]}
			rotation={[0, building.rotation, 0]}
			onClick={handleClick}
		>
			{/* ၁။ ခြံဝန်းမြေခင်း (Compound Ground Yard) */}
			<mesh
				position={[0, 0.02, fenceCenterZ]}
				rotation={[-Math.PI / 2, 0, 0]}
				receiveShadow
			>
				<planeGeometry args={[fenceW - 0.1, fenceD - 0.1]} />
				<meshStandardMaterial color="#c5bca8" roughness={0.92} />
			</mesh>

			{/* ၂။ ခြံစည်းရိုး (Compound Fences) */}
			<group name="compound-fences">
				{/* မျက်နှာစာ ခြံစည်းရိုး (Front Fence with Gate Opening) */}
				<group position={[0, 0, frontHalf]}>
					{leftSheetLen > 0.4 && (
						<>
							<Box x={leftSheetCenterX} y={0.85} z={0} w={leftSheetLen} h={1.7} d={0.06} color={fenceColor} />
							<Box x={leftSheetCenterX} y={1.72} z={0} w={leftSheetLen + 0.04} h={0.05} d={0.08} color="#d1d5db" />
						</>
					)}
					{rightSheetLen > 0.4 && (
						<>
							<Box x={rightSheetCenterX} y={0.85} z={0} w={rightSheetLen} h={1.7} d={0.06} color={fenceColor} />
							<Box x={rightSheetCenterX} y={1.72} z={0} w={rightSheetLen + 0.04} h={0.05} d={0.08} color="#d1d5db" />
						</>
					)}
					{/* Gate Posts */}
					<Box x={-halfGate} y={1.05} z={0} w={0.16} h={2.1} d={0.16} color="#78716c" />
					<Box x={halfGate} y={1.05} z={0} w={0.16} h={2.1} d={0.16} color="#78716c" />
				</group>

				{/* ဘယ်ဘက် ဘေးခြံစည်းရိုး (Left Side Fence) */}
				<Box x={-sideHalf} y={0.8} z={fenceCenterZ} w={0.05} h={1.6} d={fenceD} color="#4b5563" />
				{/* ညာဘက် ဘေးခြံစည်းရိုး (Right Side Fence) */}
				<Box x={sideHalf} y={0.8} z={fenceCenterZ} w={0.05} h={1.6} d={fenceD} color="#4b5563" />
				{/* အနောက်ဘက် ခြံစည်းရိုး (Back Fence) */}
				<Box x={0} y={0.8} z={-backHalf} w={fenceW} h={1.6} d={0.05} color="#4b5563" />
			</group>

			{/* ၃။ ပင်မအိမ်ကြီး (Main House Body) */}
			<group position={[0, 0, houseZ]} name="main-house">
				{/* Plinth */}
				<Box x={0} y={0.15} z={0} w={w + 0.2} h={0.3} d={d + 0.2} color="#a8a29e" />

				{/* House Walls */}
				<Box x={0} y={0.3 + wallH / 2} z={0} w={w} h={wallH} d={d} color={wallColor} />

				{/* Gable Roof with ImportedGableRoof component */}
				<ImportedGableRoof
					width={w}
					depth={d}
					eaveY={0.3 + wallH}
					rise={pitchH}
					overhang={0.32}
					color={roofColor}
					wallColor={wallColor}
				/>

				{/* Windows on sides */}
				{[-1, 1].map((s) => (
					<Box
						key={`win-${s}`}
						x={s * (w / 2 + 0.02)}
						y={0.3 + wallH * 0.55}
						z={0}
						w={0.04}
						h={1.1}
						d={1.2}
						color="#334155"
					/>
				))}

				{/* Front Veranda & Door */}
				<group position={[0, 0, d / 2 + 0.6]}>
					<Box x={0} y={0.12} z={0} w={porchW} h={0.24} d={1.2} color="#94a3b8" />
					<Box x={0} y={1.2} z={-0.58} w={1.0} h={1.9} d={0.05} color="#475569" />
					{/* Porch posts */}
					<Box x={-porchW / 2 + 0.15} y={1.1} z={0.45} w={0.1} h={2.2} d={0.1} color="#64748b" />
					<Box x={porchW / 2 - 0.15} y={1.1} z={0.45} w={0.1} h={2.2} d={0.1} color="#64748b" />
					{/* Porch roof */}
					<Box x={0} y={2.25} z={0} w={porchW + 0.2} h={0.1} d={1.4} color={roofColor} />
				</group>
			</group>
		</group>
	);
});
