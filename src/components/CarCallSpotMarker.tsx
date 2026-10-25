import { useRef } from 'react';
import { useRegionFrame as useFrame } from './RegionActivity';
import { Group, Mesh, MeshBasicMaterial, DoubleSide } from 'three';
import { carSummonState, SUMMON_TRIGGER_X, SUMMON_TRIGGER_Z } from '../game/carSummon';
import { carRide } from '../game/carRide';

/**
 * Animated 3D Ground Summon Zone & Floating Downward Arrow at:
 * Scene X/Z: 185.429, 196.050 (Local U/V: -7.510, 269.747)
 * Features:
 * - Large 3.5m radius ground circle with glowing concentric rings
 * - Smoothly rotating outer dashed tick markers
 * - Expanding animated radar ripple wave
 * - 3D Golden/Cyan arrow hovering and pointing down with bobbing & rotation animation
 */
export function CarCallSpotMarker() {
	const rootRef = useRef<Group>(null);
	const innerSpinRef = useRef<Group>(null);
	const pulseRef = useRef<Mesh>(null);
	const pulseMatRef = useRef<MeshBasicMaterial>(null);
	const chargeRef = useRef<Mesh>(null);
	const chargeMatRef = useRef<MeshBasicMaterial>(null);

	useFrame(({ clock }, delta) => {
		// Visibility: visible when not driving and car has not yet arrived
		const isDrivingCar = !!carRide.carId;
		const isArrived = carSummonState.status === 'arrived';
		const visible = !isDrivingCar && !isArrived;

		if (rootRef.current) {
			rootRef.current.visible = visible;
		}
		if (!visible) return;

		// 1. Rotating ground dashed ring
		if (innerSpinRef.current) {
			innerSpinRef.current.rotation.y += delta * 0.55;
		}

		// 3. Expanding pulse wave ring (radar beacon)
		if (pulseRef.current && pulseMatRef.current) {
			const t = (clock.elapsedTime * 0.75) % 1;
			const scale = 0.35 + t * 0.85;
			pulseRef.current.scale.set(scale, scale, 1);
			pulseMatRef.current.opacity = (1 - t) * 0.65;
		}

		// 4. 3-Second Stand Progress Ring (Charges from 0 to 1 as player stands still)
		if (chargeRef.current && chargeMatRef.current) {
			const ratio = Math.min(1, Math.max(0, carSummonState.standTimer / 3.0));
			if (ratio > 0.01) {
				chargeRef.current.visible = true;
				chargeRef.current.scale.set(0.1 + ratio * 0.9, 0.1 + ratio * 0.9, 1);
				chargeMatRef.current.opacity = 0.35 + ratio * 0.55;
			} else {
				chargeRef.current.visible = false;
			}
		}
	});

	// Colors adapt if summon is actively in progress
	const isIncoming = carSummonState.status === 'driving';
	const baseColor = isIncoming ? '#10b981' : '#0284c7';
	const rimColor = isIncoming ? '#34d399' : '#38bdf8';

	return (
		<group
			ref={rootRef}
			position={[SUMMON_TRIGGER_X, 0.16, SUMMON_TRIGGER_Z]}
			name="car-call-spot-marker"
			userData={{ dynamic: true }}
		>
			{/* ======================================================== */}
			{/* ၁။ အောက်ခြေ စက်ဝိုင်းကြီး (Large 3.5m Ground Animated Circle) */}
			{/* ======================================================== */}
			{/* အောက်ခံ အလင်းပြား (Semi-transparent glowing ground disc) */}
			<mesh rotation={[-Math.PI / 2, 0, 0]}>
				<ringGeometry args={[0.1, 3.45, 64]} />
				<meshBasicMaterial color={baseColor} transparent opacity={0.20} side={DoubleSide} />
			</mesh>

			{/* အပြင်ဆုံး အလင်းစက်ဝိုင်းဘောင် (Outer vibrant glowing boundary ring: r=3.35..3.52m) */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
				<ringGeometry args={[3.32, 3.52, 64]} />
				<meshBasicMaterial color={rimColor} transparent opacity={0.9} side={DoubleSide} />
			</mesh>

			{/* အလယ် အထပ်စက်ဝိုင်းဘောင် (Middle accent ring: r=2.2m) */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
				<ringGeometry args={[2.14, 2.24, 48]} />
				<meshBasicMaterial color={rimColor} transparent opacity={0.65} side={DoubleSide} />
			</mesh>

			{/* ဗဟို အချက်ပြစက်ဝိုင်းငယ် (Center beacon disc: r=0.7m) */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
				<ringGeometry args={[0, 0.7, 32]} />
				<meshBasicMaterial color={baseColor} transparent opacity={0.45} side={DoubleSide} />
			</mesh>

			{/* ၂။ လည်ပတ်နေသော အစင်းကြောင်းများ (Rotating Dashed Ring at r=2.75m) */}
			<group ref={innerSpinRef} position={[0, 0.012, 0]}>
				{Array.from({ length: 12 }, (_, i) => {
					const angle = (i * Math.PI * 2) / 12;
					return (
						<mesh
							key={i}
							position={[Math.cos(angle) * 2.75, 0, Math.sin(angle) * 2.75]}
							rotation={[-Math.PI / 2, 0, -angle]}
						>
							<planeGeometry args={[0.42, 0.07]} />
							<meshBasicMaterial color={rimColor} side={DoubleSide} />
						</mesh>
					);
				})}
			</group>

			{/* ၃။ လှိုင်းတွန့် အဝိုင်း (Expanding animated pulse ripple wave) */}
			<mesh
				ref={pulseRef}
				rotation={[-Math.PI / 2, 0, 0]}
				position={[0, 0.015, 0]}
			>
				<ringGeometry args={[3.1, 3.38, 48]} />
				<meshBasicMaterial
					ref={pulseMatRef}
					color={rimColor}
					transparent
					opacity={0.6}
					side={DoubleSide}
				/>
			</mesh>

			{/* ၄။ ၃ စက္ကန့် ရပ်နေစဉ် အားသွင်းပြည့်လာသော အဝိုင်း (3-second charge progress disk) */}
			<mesh
				ref={chargeRef}
				visible={false}
				rotation={[-Math.PI / 2, 0, 0]}
				position={[0, 0.02, 0]}
			>
				<ringGeometry args={[0, 1.8, 48]} />
				<meshBasicMaterial
					ref={chargeMatRef}
					color="#fbbf24"
					transparent
					opacity={0.7}
					side={DoubleSide}
				/>
			</mesh>
		</group>
	);
}
