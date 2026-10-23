import { useMemo } from 'react';
import { ward, toWorld, angle } from '../data/ward';
import { buildMountainTiles, mountainHeight, type TerrainPeak } from '../game/mountainTerrain';

const distantMountainTiers = [
	// ဒုတိယဆင့် တောင်တန်းများ (Inner Chin Hills: v = 4800 ~ 5200)
	...[-950, -750, -550, -350, -150, 60, 260, 460, 680, 880].map((u, i) => {
		const v = 4850 + (i % 3) * 120;
		const height = 750 + (i % 4) * 80;
		const radius = 175 + (i % 3) * 15;
		return {
			id: `distant-chin-tier2-${i}`,
			u,
			v,
			...toWorld(u, v),
			height,
			radius,
			color: i % 2 ? '#3b5443' : '#334c3d',
		};
	}),
	// တတိယဆင့် တောင်တန်းကြီးများ (High Chin Range: v = 5400 ~ 5800)
	...[-1100, -850, -600, -350, -100, 150, 400, 650, 900].map((u, i) => {
		const v = 5500 + (i % 2) * 160;
		const height = 980 + (i % 3) * 120;
		const radius = 220 + (i % 3) * 20;
		return {
			id: `distant-chin-tier3-${i}`,
			u,
			v,
			...toWorld(u, v),
			height,
			radius,
			color: '#364d55',
		};
	}),
	// စတုတ္ထဆင့် အဝေးဆုံး မိုးကုတ်စက်ဝိုင်း တောင်တန်း (Atmospheric Horizon Ridges: v = 6200)
	...[-1200, -800, -400, 0, 400, 800, 1200].map((u, i) => {
		const v = 6200;
		const height = 1200 + (i % 3) * 100;
		const radius = 260;
		return {
			id: `distant-chin-tier4-${i}`,
			u,
			v,
			...toWorld(u, v),
			height,
			radius,
			color: '#3d5261',
		};
	}),
];


const foreground=[...ward.mountains,...ward.weipula.peaks];
function RidgeSurface({peaks,step=10,haze=0}:{peaks:TerrainPeak[];step?:number;haze?:number}){
 const tiles=useMemo(()=>buildMountainTiles(peaks,step,haze),[peaks,step,haze]);
 return <>{tiles.map(t=>{const p=toWorld(t.u,t.v);return <mesh key={t.key} position={[p.x,0,p.z]} rotation={[0,angle,0]} geometry={t.geometry} receiveShadow>
  <meshStandardMaterial vertexColors roughness={1}/>
 </mesh>})}</>;
}
export function Mountains(){
 const summit=ward.weipula.peaks[2];
 const summitHeight=mountainHeight(summit.u,summit.v,foreground);
 return <group name="forested-ridge-terrain">
  <RidgeSurface peaks={foreground}/>
  <RidgeSurface peaks={distantMountainTiers} step={20} haze={0.5}/>
  <group position={[summit.x,summitHeight,summit.z]}>
   <mesh position={[0,2,0]}><boxGeometry args={[14,4,14]}/><meshStandardMaterial color="#eae4d2"/></mesh>
   <mesh position={[0,9,0]}><cylinderGeometry args={[3,5.5,10,12]}/><meshStandardMaterial color="#f2ca4b" metalness={0.4} roughness={0.4}/></mesh>
   <mesh position={[0,17,0]}><coneGeometry args={[1.6,6,10]}/><meshStandardMaterial color="#fad54d"/></mesh>
  </group>
 </group>;
}

export function WesternLandscapePlan() {
	const mahaWeipulaPeak = ward.weipula.peaks[2];

	return (
		<>
			{[...ward.westernFields, ...ward.southernFields].map(f => (
				<rect
					key={f.id}
					x={f.x - f.width / 2}
					y={f.z - f.depth / 2}
					width={f.width}
					height={f.depth}
					fill={f.color}
					stroke="#c1b57f"
					strokeWidth="1"
					transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
				/>
			))}
			{/* အဆင့်ဆင့် တောင်တန်းများ အောက်ခြေ ပတ်လည်လိုင်း (Tiered Mountain Contours) */}
			{[...ward.mountains, ...ward.weipula.peaks].map(m => (
				<g key={m.id}>
					{/* တောင်ခြေ ပထမဆင့် */}
					<circle cx={m.x} cy={m.z} r={m.radius * 1.25} fill="#2f4534" opacity="0.35" />
					{/* တောင်ခါးပန်း ဒုတိယဆင့် */}
					<circle cx={m.x} cy={m.z} r={m.radius * 0.75} fill={m.color} stroke="#466049" strokeWidth="1" />
					{/* လုံးဝိုင်းသော တောင်ထိပ်ကြော တတိယဆင့် */}
					<circle cx={m.x} cy={m.z} r={m.radius * 0.28} fill="#628067" />
				</g>
			))}
			{/* မဟာဝေပုလ္လတောင်တော် စေတီတော် အမှတ်အသား */}
			{mahaWeipulaPeak && (
				<g transform={`translate(${mahaWeipulaPeak.x} ${mahaWeipulaPeak.z})`}>
					<circle r="9" fill="#f2c844" stroke="#ffffff" strokeWidth="1.5" />
					<text y="3" textAnchor="middle" fontSize="10">🛕</text>
					<text
						y="-14"
						textAnchor="middle"
						fontSize="13"
						fontWeight="bold"
						fill="#f5da62"
						stroke="#254230"
						strokeWidth="2.5"
						paintOrder="stroke fill"
					>
						မဟာဝေပုလ္လတောင်တော်
					</text>
				</g>
			)}
			<text x={ward.taungphila.label.x} y={ward.taungphila.label.z} textAnchor="middle" fontSize="26" fill="#f3edcb" stroke="#304b4b" strokeWidth="0.6">
				{ward.taungphila.name}
			</text>
			<text x={ward.weipula.label.x} y={ward.weipula.label.z} textAnchor="middle" fontSize="26" fill="#f3edcb" stroke="#304b4b" strokeWidth="0.6">
				{ward.weipula.name}
			</text>
		</>
	);
}
