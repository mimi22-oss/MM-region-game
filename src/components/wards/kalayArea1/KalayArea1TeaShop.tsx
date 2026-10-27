import { memo } from 'react';
import { nankaleinTeaShopData, type TVData, type TeaTableData } from '../../../data/wards/kalayArea1/kalayArea1TeaShop.ts';
import { sourceIsEdited } from '../../../game/worldEdits';

/**
 * Ceramic Myanmar Tea Cup Component (မြန်မာ့ရိုးရာ လက်ဖက်ရည်ခွက်ကလေး)
 * Body, handle, and golden-brown milk tea liquid top surface
 */
function TeaCup({ x, y, z }: { x: number; y: number; z: number }) {
	return (
		<group position={[x, y, z]}>
			{/* Ceramic / Glass Cup Body */}
			<mesh position={[0, 0.045, 0]} castShadow>
				<cylinderGeometry args={[0.042, 0.035, 0.09, 8]} />
				<meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.1} />
			</mesh>
			{/* Milk Tea Liquid (ရွှေဝါရောင် လက်ဖက်ရည်အရည်) */}
			<mesh position={[0, 0.082, 0]}>
				<cylinderGeometry args={[0.038, 0.038, 0.006, 8]} />
				<meshStandardMaterial color="#c68a4c" roughness={0.3} />
			</mesh>
			{/* Cup Handle (ခွက်လက်ကိုင်) */}
			<mesh position={[0.045, 0.045, 0]} rotation={[0, 0, Math.PI / 2]}>
				<torusGeometry args={[0.022, 0.006, 6, 8, Math.PI]} />
				<meshStandardMaterial color="#f8fafc" roughness={0.2} />
			</mesh>
		</group>
	);
}

/**
 * Tea Table with 4 Stools, 4 Tea Cups, and a Teapot
 * (စားပွဲ ၁ လုံး၊ ထိုင်ခုံ ၄ လုံး၊ လက်ဖက်ရည် ၄ ခွက်စီနှင့် ရေနွေးကြမ်းကရား)
 */
export function TeaTable({ table }: { table: TeaTableData }) {
	const isOutdoor = table.isOutdoor;

	return (
		<group position={[table.du, 0, table.dv]}>
			{/* Table Surface */}
			<mesh position={[0, 0.72, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[0.75, 0.75, 0.06, 12]} />
				<meshStandardMaterial
					color={isOutdoor ? '#1e3a8a' : '#78350f'}
					roughness={0.6}
				/>
			</mesh>
			{/* Pedestal Leg */}
			<mesh position={[0, 0.36, 0]} castShadow>
				<cylinderGeometry args={[0.08, 0.12, 0.68, 8]} />
				<meshStandardMaterial color="#1e293b" roughness={0.5} />
			</mesh>
			{/* Pedestal Base */}
			<mesh position={[0, 0.02, 0]}>
				<cylinderGeometry args={[0.38, 0.38, 0.04, 8]} />
				<meshStandardMaterial color="#1e293b" roughness={0.5} />
			</mesh>

			{/* Center Traditional Burmese Teapot (ရေနွေးကြမ်းကရား) */}
			{table.hasTeapot && (
				<group position={[0, 0.75, 0]}>
					<mesh position={[0, 0.075, 0]} castShadow>
						<sphereGeometry args={[0.075, 8, 8]} />
						<meshStandardMaterial color="#d97706" roughness={0.35} />
					</mesh>
					<mesh position={[0, 0.14, 0]}>
						<cylinderGeometry args={[0.035, 0.035, 0.03, 8]} />
						<meshStandardMaterial color="#b45309" roughness={0.4} />
					</mesh>
					{/* Teapot Spout */}
					<mesh position={[0.07, 0.08, 0]} rotation={[0, 0, -0.6]}>
						<cylinderGeometry args={[0.015, 0.022, 0.08, 6]} />
						<meshStandardMaterial color="#d97706" roughness={0.35} />
					</mesh>
				</group>
			)}

			{/* ၄ ခွက်စီ တင်ထားသော လက်ဖက်ရည်ခွက်များ (Exactly 4 Tea Cups) */}
			{[
				[-0.26, 0.75, -0.2],
				[0.26, 0.75, -0.2],
				[-0.26, 0.75, 0.2],
				[0.26, 0.75, 0.2],
			].map(([cx, cy, cz], idx) => (
				<TeaCup key={`cup-${table.id}-${idx}`} x={cx} y={cy} z={cz} />
			))}

			{/* ၄ လုံးစီ ထားရှိသော ထိုင်ခုံငယ်များ (4 Stools per table) */}
			{[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((ang, sIdx) => {
				const sx = Math.cos(ang) * 0.95;
				const sz = Math.sin(ang) * 0.95;
				return (
					<group key={`stool-${table.id}-${sIdx}`} position={[sx, 0, sz]}>
						<mesh position={[0, 0.42, 0]} castShadow>
							<cylinderGeometry args={[0.22, 0.22, 0.04, 8]} />
							<meshStandardMaterial
								color={isOutdoor ? (sIdx % 2 === 0 ? '#ef4444' : '#3b82f6') : '#92400e'}
								roughness={0.7}
							/>
						</mesh>
						<mesh position={[0, 0.2, 0]}>
							<cylinderGeometry args={[0.035, 0.07, 0.4, 6]} />
							<meshStandardMaterial color="#1e293b" roughness={0.5} />
						</mesh>
					</group>
				);
			})}
		</group>
	);
}

/**
 * Wall-Mounted TV Component (နံရံကပ် တီဗွီကြီး)
 */
function WallMountedTV({ tv }: { tv: TVData }) {
	return (
		<group position={[tv.du, tv.y, tv.dv]} rotation={[0, tv.rotY, 0]}>
			{/* Wall Bracket */}
			<mesh position={[0, 0, -0.06]}>
				<boxGeometry args={[0.6, 0.6, 0.08]} />
				<meshStandardMaterial color="#0f172a" roughness={0.8} />
			</mesh>
			{/* TV Bezel / Frame */}
			<mesh position={[0, 0, 0]} castShadow>
				<boxGeometry args={[tv.width, tv.height, 0.06]} />
				<meshStandardMaterial color="#09090b" roughness={0.3} />
			</mesh>
			{/* TV Screen (Broadcast picture / channel) */}
			<mesh position={[0, 0, 0.035]}>
				<planeGeometry args={[tv.width - 0.08, tv.height - 0.08]} />
				<meshBasicMaterial
					color={tv.channel === 'football' ? '#22c55e' : '#0284c7'}
				/>
			</mesh>
			{/* Screen Broadcast Glow Light */}
			<pointLight
				position={[0, 0, 0.5]}
				color={tv.channel === 'football' ? '#4ade80' : '#38bdf8'}
				intensity={1.8}
				distance={8}
				decay={2}
			/>
		</group>
	);
}

/**
 * နန်းကလိန် လက်ဖက်ရည်ဆိုင် 3D Component
 */
export const KalayArea1TeaShop = memo(function KalayArea1TeaShop({
	onSelect,
	ignoreEdits = false,
}: {
	onSelect?: () => void;
	ignoreEdits?: boolean;
}) {
	if (!ignoreEdits && sourceIsEdited(nankaleinTeaShopData.id)) return null;
	const shop = nankaleinTeaShopData;

	return (
		<group
			name="kalay-area-1-tea-shop-3d"
			position={[shop.x, 0, shop.z]}
			rotation={[0, shop.rotation, 0]}
			onClick={(e) => {
				e.stopPropagation();
				onSelect?.();
			}}
		>
			{/* ======================================================== */}
			{/* ၁။ အပြင်ဘက် ဝရံတာ ကွန်ကရစ်ခင်း (Outdoor Dining Patio Deck) */}
			{/* ======================================================== */}
			<mesh
				userData={{ walkable: true }}
				position={[shop.outdoor.centerU - shop.u, shop.outdoor.floorY / 2, 0]}
				receiveShadow
			>
				<boxGeometry args={[shop.outdoor.width, shop.outdoor.floorY, shop.outdoor.depth]} />
				<meshStandardMaterial color="#cbd5e1" roughness={0.85} />
			</mesh>

			{/* ======================================================== */}
			{/* ၂။ ဆိုင်အတွင်း ပင်မကြမ်းခင်း (Indoor Walkable Tiled Floor) */}
			{/* ======================================================== */}
			<mesh
				userData={{ walkable: true }}
				position={[shop.indoor.centerU - shop.u, shop.indoor.floorY / 2, 0]}
				receiveShadow
			>
				<boxGeometry args={[shop.indoor.width, shop.indoor.floorY, shop.indoor.depth]} />
				<meshStandardMaterial color="#f1f5f9" roughness={0.7} />
			</mesh>

			{/* ======================================================== */}
			{/* ၃။ နံရံများ (Indoor Walls)                                */}
			{/* ======================================================== */}
			{/* Rear Wall (West / Back) */}
			<mesh position={[-5.95, shop.indoor.wallHeight / 2, 0]} castShadow receiveShadow>
				<boxGeometry args={[0.3, shop.indoor.wallHeight, shop.indoor.depth]} />
				<meshStandardMaterial color="#94a3b8" roughness={0.8} />
			</mesh>
			{/* North Side Wall */}
			<mesh position={[-2.95, shop.indoor.wallHeight / 2, 8.95]} castShadow receiveShadow>
				<boxGeometry args={[6.1, shop.indoor.wallHeight, 0.3]} />
				<meshStandardMaterial color="#94a3b8" roughness={0.8} />
			</mesh>
			{/* South Side Wall */}
			<mesh position={[-2.95, shop.indoor.wallHeight / 2, -8.95]} castShadow receiveShadow>
				<boxGeometry args={[6.1, shop.indoor.wallHeight, 0.3]} />
				<meshStandardMaterial color="#94a3b8" roughness={0.8} />
			</mesh>

			{/* Front Pillars (တိုင်လုံး ၄ တိုင် - အရှေ့ AH1 ဘက်သို့ ပွင့်လင်းမြင်သာ) */}
			{[-9.0, -3.0, 3.0, 9.0].map((pz) => (
				<mesh key={`front-col-${pz}`} position={[0.1, shop.indoor.wallHeight / 2, pz]} castShadow>
					<cylinderGeometry args={[0.16, 0.2, shop.indoor.wallHeight, 8]} />
					<meshStandardMaterial color="#78350f" roughness={0.7} />
				</mesh>
			))}

			{/* ======================================================== */}
			{/* ၄။ သွပ်မိုး အမိုးနှင့် အမိုးစွန်း (Corrugated Tin Roof & Awning) */}
			{/* ======================================================== */}
			{/* Main Indoor Roof */}
			<mesh
				position={[-2.95, shop.indoor.wallHeight + 0.35, 0]}
				rotation={[0, 0, -0.08]}
				castShadow
			>
				<boxGeometry args={[6.8, 0.25, 19.2]} />
				<meshStandardMaterial color="#b91c1c" roughness={0.55} />
			</mesh>
			{/* Front Extended Awning over Outdoor Patio */}
			<mesh
				position={[2.4, shop.indoor.wallHeight - 0.2, 0]}
				rotation={[0, 0, -0.15]}
				castShadow
			>
				<boxGeometry args={[4.8, 0.15, 20.4]} />
				<meshStandardMaterial color="#1e3a8a" roughness={0.6} />
			</mesh>

			{/* ======================================================== */}
			{/* ၅။ လက်ဖက်ရည်ဖျော် ကောင်တာနှင့် ရေနွေးငွေ့အိုး (Tea Counter)*/}
			{/* ======================================================== */}
			<group position={[-4.5, 0.22, 0]}>
				{/* Main Teak Counter Base */}
				<mesh position={[0, 0.5, 0]} castShadow receiveShadow>
					<boxGeometry args={[1.4, 1.0, 4.2]} />
					<meshStandardMaterial color="#78350f" roughness={0.7} />
				</mesh>
				{/* Stainless Steel Counter Top */}
				<mesh position={[0, 1.02, 0]}>
					<boxGeometry args={[1.5, 0.05, 4.3]} />
					<meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.2} />
				</mesh>
				{/* Large Traditional Tea Boiler / Kettle (ရေနွေးငွေ့အိုးကြီး) */}
				<mesh position={[-0.2, 1.25, 0.8]} castShadow>
					<cylinderGeometry args={[0.26, 0.3, 0.45, 12]} />
					<meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.2} />
				</mesh>
				{/* Glass Snack Display Case (စမူဆာ၊ ပေါက်စီ မှန်ဗီရို) */}
				<mesh position={[0, 1.35, -0.9]} castShadow>
					<boxGeometry args={[0.9, 0.65, 1.4]} />
					<meshStandardMaterial color="#e0f2fe" opacity={0.6} transparent roughness={0.1} />
				</mesh>
			</group>

			{/* ======================================================== */}
			{/* ၆။ တီဗွီ ၂ လုံး (2 Flat-Screen Wall-Mounted TVs)           */}
			{/* ======================================================== */}
			{shop.tvs.map((tv) => (
				<WallMountedTV key={tv.id} tv={tv} />
			))}

			{/* ======================================================== */}
			{/* ၇။ စားပွဲ ၁၂ လုံး (အထဲ ၆ လုံး + အပြင် ၆ လုံး)                 */}
			{/* ======================================================== */}
			{shop.tables.map((tbl) => (
				<TeaTable key={tbl.id} table={tbl} />
			))}

			{/* ======================================================== */}
			{/* ၈။ ဆိုင်ဆိုင်းဘုတ်ကြီး (Tea Shop Roadside Signboard)         */}
			{/* ======================================================== */}
			<group position={[4.6, 2.9, 0]} rotation={[0, -Math.PI / 2, 0]}>
				{/* Signboard Post Backing */}
				<mesh position={[0, 0, 0]} castShadow>
					<boxGeometry args={[7.2, 1.1, 0.14]} />
					<meshStandardMaterial color="#78350f" roughness={0.8} />
				</mesh>
				{/* Signboard Yellow Banner */}
				<mesh position={[0, 0, 0.08]}>
					<boxGeometry args={[6.8, 0.88, 0.02]} />
					<meshStandardMaterial color="#fef08a" roughness={0.3} />
				</mesh>
			</group>

			{/* Warm Golden Night Lighting (ညဘက် မီးရောင် နွေးထွေးမှု) */}
			<pointLight position={[-2.8, 3.2, 0]} color="#fbbf24" intensity={2.8} distance={15} decay={2} />
			<pointLight position={[2.5, 2.8, 0]} color="#fed7aa" intensity={2.2} distance={12} decay={2} />
		</group>
	);
});
