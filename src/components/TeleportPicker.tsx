import { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
	Vector2,
	Vector3,
	Raycaster,
	Plane,
	Group,
	Mesh,
	MeshBasicMaterial,
	DoubleSide,
	Camera,
	Scene,
	WebGLRenderer,
} from 'three';
import { sceneGround } from '../game/groundSurface';
import { canStand } from '../game/collision';
import { findTeleportSpot } from '../game/cameraNavigation';
import { robotLocation } from '../game/robotLocation';

export interface TeleportPin {
	x: number;
	y: number;
	z: number;
	safeX: number;
	safeZ: number;
	isAdjusted: boolean;
}

export interface ScreenPosition {
	x: number;
	y: number;
	visible: boolean;
}

/** Helper: Raycast from screen pixels (clientX, clientY) to ground surface */
function raycastGround(
	clientX: number,
	clientY: number,
	camera: Camera,
	scene: Scene,
	gl: WebGLRenderer,
	time: number
): { x: number; y: number; z: number } | null {
	const rect = gl.domElement.getBoundingClientRect();
	const mouse = new Vector2(
		((clientX - rect.left) / rect.width) * 2 - 1,
		-((clientY - rect.top) / rect.height) * 2 + 1
	);

	const raycaster = new Raycaster();
	raycaster.setFromCamera(mouse, camera);

	let hitPoint: Vector3 | null = null;
	const intersects = raycaster.intersectObjects(scene.children, true);
	for (const hit of intersects) {
		const name = hit.object.name ?? '';
		if (
			name.includes('player') ||
			name.includes('teleport') ||
			name.includes('marker') ||
			name.includes('arrow') ||
			name.includes('sky') ||
			name.includes('wheel') ||
			hit.object.type === 'Line' ||
			hit.object.type === 'Points'
		) {
			continue;
		}
		hitPoint = hit.point;
		break;
	}

	if (!hitPoint) {
		const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
		const hit = new Vector3();
		if (raycaster.ray.intersectPlane(groundPlane, hit)) {
			hitPoint = hit;
		}
	}

	if (hitPoint) {
		const ground = sceneGround(scene, time);
		const groundY = ground.height(hitPoint.x, hitPoint.z);
		const y = Math.max(hitPoint.y, groundY);
		return { x: hitPoint.x, y, z: hitPoint.z };
	}
	return null;
}

/**
 * 3D Teleport Picker component inside <Canvas>
 * - Tapping/clicking on ground places teleport pin.
 * - Pressing and dragging ("ဖိရွေ့") the pointer circle moves it smoothly in real time.
 * - Projects pin to 2D screen coordinates for the floating confirmation card.
 */
export function TeleportPicker({
	active,
	pin,
	onPickPin,
	onScreenPos,
	onDraggingChange,
}: {
	active: boolean;
	pin: TeleportPin | null;
	onPickPin: (pin: TeleportPin) => void;
	onScreenPos: (pos: ScreenPosition | null) => void;
	onDraggingChange?: (dragging: boolean) => void;
}) {
	const { camera, scene, gl, clock } = useThree();
	const pinRef = useRef(pin);
	pinRef.current = pin;

	const [isDragging, setIsDragging] = useState(false);
	const isDraggingRef = useRef(false);

	useEffect(() => {
		if (!active) return;
		const dom = gl.domElement;
		dom.style.cursor = 'crosshair';

		let downX = 0;
		let downY = 0;

		const isNearCircle = (clientX: number, clientY: number): boolean => {
			if (!pinRef.current) return false;
			// 1. Check 3D distance to pin
			const hit = raycastGround(clientX, clientY, camera, scene, gl, clock.elapsedTime);
			if (hit) {
				const dist3D = Math.hypot(hit.x - pinRef.current.x, hit.z - pinRef.current.z);
				if (dist3D < 3.2) return true;
			}
			// 2. Check 2D projected screen distance
			const vec = new Vector3(pinRef.current.x, pinRef.current.y + 0.1, pinRef.current.z);
			vec.project(camera);
			if (vec.z < 1) {
				const sx = (vec.x * 0.5 + 0.5) * window.innerWidth;
				const sy = (-(vec.y * 0.5) + 0.5) * window.innerHeight;
				const dist2D = Math.hypot(clientX - sx, clientY - sy);
				if (dist2D < 75) return true;
			}
			return false;
		};

		const onPointerDown = (e: PointerEvent) => {
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				target.closest('.teleport-confirm-card, .location-actions, .settings-wrap, .guide-dialog-modal, .mobile-actions')
			) {
				return;
			}

			downX = e.clientX;
			downY = e.clientY;

			// If pin already exists and user touched on/near the circle, initiate circle dragging ("ဖိရွေ့")!
			if (pinRef.current && isNearCircle(e.clientX, e.clientY)) {
				isDraggingRef.current = true;
				setIsDragging(true);
				onDraggingChange?.(true);
				dom.style.cursor = 'grabbing';
				try {
					dom.setPointerCapture(e.pointerId);
				} catch {}
				e.stopPropagation();
			}
		};

		const onPointerMove = (e: PointerEvent) => {
			if (isDraggingRef.current) {
				// While dragging the circle: raycast ground and update pin position smoothly in real time!
				const hit = raycastGround(e.clientX, e.clientY, camera, scene, gl, clock.elapsedTime);
				if (hit) {
					onPickPin({
						x: hit.x,
						y: hit.y,
						z: hit.z,
						safeX: hit.x,
						safeZ: hit.z,
						isAdjusted: false,
					});
				}
				return;
			}

			// Hover feedback over the circle
			if (pinRef.current && isNearCircle(e.clientX, e.clientY)) {
				dom.style.cursor = 'grab';
			} else {
				dom.style.cursor = 'crosshair';
			}
		};

		const onPointerUp = (e: PointerEvent) => {
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				target.closest('.teleport-confirm-card, .location-actions, .settings-wrap, .guide-dialog-modal, .mobile-actions')
			) {
				return;
			}

			if (isDraggingRef.current) {
				isDraggingRef.current = false;
				setIsDragging(false);
				onDraggingChange?.(false);
				dom.style.cursor = 'crosshair';
				try {
					dom.releasePointerCapture(e.pointerId);
				} catch {}

				// Snap to nearest walkable spot upon release
				if (pinRef.current) {
					const safe = findTeleportSpot(pinRef.current.x, pinRef.current.z, canStand);
					const safeX = safe ? safe.x : pinRef.current.x;
					const safeZ = safe ? safe.z : pinRef.current.z;
					const isAdjusted = safe ? Math.hypot(safe.x - pinRef.current.x, safe.z - pinRef.current.z) > 0.3 : false;
					onPickPin({
						...pinRef.current,
						safeX,
						safeZ,
						isAdjusted,
					});
				}
				return;
			}

			// If not dragging circle, check if user tapped ground (dist <= 7px)
			const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
			if (dist <= 7) {
				const hit = raycastGround(e.clientX, e.clientY, camera, scene, gl, clock.elapsedTime);
				if (hit) {
					const safe = findTeleportSpot(hit.x, hit.z, canStand);
					const safeX = safe ? safe.x : hit.x;
					const safeZ = safe ? safe.z : hit.z;
					const isAdjusted = safe ? Math.hypot(safe.x - hit.x, safe.z - hit.z) > 0.3 : false;
					onPickPin({
						x: hit.x,
						y: hit.y,
						z: hit.z,
						safeX,
						safeZ,
						isAdjusted,
					});
				}
			}
		};

		dom.addEventListener('pointerdown', onPointerDown);
		dom.addEventListener('pointermove', onPointerMove);
		dom.addEventListener('pointerup', onPointerUp);

		return () => {
			dom.style.cursor = '';
			dom.removeEventListener('pointerdown', onPointerDown);
			dom.removeEventListener('pointermove', onPointerMove);
			dom.removeEventListener('pointerup', onPointerUp);
			onDraggingChange?.(false);
		};
	}, [active, camera, scene, gl, clock, onPickPin, onDraggingChange]);

	// Project 3D pin position to 2D screen coordinates in real-time
	useFrame(() => {
		if (!pin || !active) {
			onScreenPos(null);
			return;
		}

		const vec = new Vector3(pin.x, pin.y + 1.8, pin.z);
		vec.project(camera);

		const inFront = vec.z < 1;
		const screenX = (vec.x * 0.5 + 0.5) * window.innerWidth;
		const screenY = (-(vec.y * 0.5) + 0.5) * window.innerHeight;

		onScreenPos({
			x: screenX,
			y: screenY,
			visible: inFront,
		});
	});

	if (!active || !pin) return null;

	return (
		<Teleport3DMarker
			x={pin.x}
			y={pin.y}
			z={pin.z}
			isAdjusted={pin.isAdjusted}
			isDragging={isDragging}
		/>
	);
}

/**
 * Animated 3D Ground Circle Marker:
 * - Concentric glowing rings on terrain
 * - Animated expanding sonar radar pulse
 * - Rotating dashed ring
 * - Vertical beacon beam and bobbing 3D arrow
 * - Highlights and elevates during drag
 */
function Teleport3DMarker({
	x,
	y,
	z,
	isAdjusted,
	isDragging,
}: {
	x: number;
	y: number;
	z: number;
	isAdjusted: boolean;
	isDragging: boolean;
}) {
	const arrowRef = useRef<Group>(null);
	const pulseRef = useRef<Mesh>(null);
	const pulseMatRef = useRef<MeshBasicMaterial>(null);
	const spinRingRef = useRef<Group>(null);

	useFrame(({ clock }, delta) => {
		const t = clock.elapsedTime;

		// 1. Arrow bobbing and continuous rotation
		if (arrowRef.current) {
			const lift = isDragging ? 0.45 : 0;
			arrowRef.current.position.y = y + 1.75 + lift + Math.sin(t * 3.5) * 0.22;
			arrowRef.current.rotation.y = t * (isDragging ? 3.5 : 1.8);
		}

		// 2. Rotating ground dashed ring
		if (spinRingRef.current) {
			spinRingRef.current.rotation.z += delta * (isDragging ? 2.8 : 1.2);
		}

		// 3. Expanding sonar pulse wave
		if (pulseRef.current && pulseMatRef.current) {
			const wave = (t * (isDragging ? 1.5 : 0.9)) % 1;
			const scale = 0.45 + wave * 1.5;
			pulseRef.current.scale.set(scale, scale, 1);
			pulseMatRef.current.opacity = (1 - wave) * 0.75;
		}
	});

	const mainColor = isDragging ? '#38bdf8' : isAdjusted ? '#f59e0b' : '#06b6d4';
	const glowColor = isDragging ? '#7dd3fc' : isAdjusted ? '#fbbf24' : '#38bdf8';
	const coreColor = isDragging ? '#0284c7' : isAdjusted ? '#d97706' : '#10b981';

	return (
		<group position={[0, 0, 0]} name="teleport-target-marker">
			{/* Ground Circles (Oriented flat on ground) */}
			<group position={[x, y + 0.06, z]} rotation={[-Math.PI / 2, 0, 0]}>
				{/* Expanding Sonar Pulse Ring */}
				<mesh ref={pulseRef}>
					<ringGeometry args={[1.2, 1.4, 36]} />
					<meshBasicMaterial ref={pulseMatRef} color={glowColor} transparent opacity={0.6} side={DoubleSide} />
				</mesh>

				{/* Rotating Dashed Middle Ring */}
				<group ref={spinRingRef}>
					<ringGeometry args={[0.82, 0.98, 36]} />
					<meshBasicMaterial color={mainColor} transparent opacity={0.9} side={DoubleSide} />
				</group>

				{/* Outer Drag Handle Ring */}
				<mesh>
					<ringGeometry args={[1.42, 1.55, 36]} />
					<meshBasicMaterial
						color={isDragging ? '#ffffff' : glowColor}
						transparent
						opacity={isDragging ? 0.85 : 0.4}
						side={DoubleSide}
					/>
				</mesh>

				{/* Inner Glowing Core Disc */}
				<mesh>
					<circleGeometry args={[0.55, 32]} />
					<meshBasicMaterial color={coreColor} transparent opacity={0.45} side={DoubleSide} />
				</mesh>

				{/* Center High-intensity Target Dot */}
				<mesh>
					<circleGeometry args={[0.18, 24]} />
					<meshBasicMaterial color="#ffffff" side={DoubleSide} />
				</mesh>
			</group>

			{/* Vertical Beacon Light Column */}
			<mesh position={[x, y + 1.25, z]}>
				<cylinderGeometry args={[0.06, 0.35, 2.5, 16, 1, true]} />
				<meshBasicMaterial color={glowColor} transparent opacity={isDragging ? 0.5 : 0.3} side={DoubleSide} depthWrite={false} />
			</mesh>

			{/* Floating 3D Target Arrow */}
			<group ref={arrowRef} position={[x, y + 1.8, z]}>
				{/* Downward pointing Cone */}
				<mesh position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]}>
					<coneGeometry args={[0.24, 0.55, 16]} />
					<meshStandardMaterial color={mainColor} emissive={coreColor} emissiveIntensity={0.8} />
				</mesh>

				{/* Glowing Halo Ring above Cone */}
				<mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
					<torusGeometry args={[0.22, 0.045, 8, 24]} />
					<meshStandardMaterial color={glowColor} emissive={mainColor} emissiveIntensity={0.7} />
				</mesh>
			</group>
		</group>
	);
}

/**
 * Floating Confirmation Overlay anchored in screen-space directly above the 3D circle marker.
 * Displays:
 * - Checkmark icon button (✓ အတည်ပြုမည် / Confirm Teleport)
 * - Cross icon button (✕ ပယ်ဖျက် / Cancel)
 * - Location info & Geolocation coordinates (Place name, Lat, Lng, Distance)
 * - Direct drag hint indicator
 */
export function TeleportConfirmOverlay({
	screenX,
	screenY,
	visible,
	pin,
	playerX,
	playerZ,
	playerYaw,
	onConfirm,
	onCancel,
}: {
	screenX: number;
	screenY: number;
	visible: boolean;
	pin: TeleportPin;
	playerX: number;
	playerZ: number;
	playerYaw: number;
	onConfirm: (pin: TeleportPin) => void;
	onCancel: () => void;
}) {
	if (!visible) return null;

	// Calculate geolocation via robotLocation(safeX, safeZ, yaw)
	const targetX = pin.safeX;
	const targetZ = pin.safeZ;
	const geo = robotLocation(targetX, targetZ, playerYaw);
	const distance = Math.hypot(targetX - playerX, targetZ - playerZ);
	const placeName = geo.place.subArea ?? geo.place.label;

	return (
		<div
			className="teleport-confirm-anchor"
			style={{
				left: `${screenX}px`,
				top: `${screenY}px`,
			}}
			onPointerDown={(e) => e.stopPropagation()}
		>
			<div className="teleport-confirm-card" role="dialog" aria-label="Teleport အတည်ပြုခြင်း">
				{/* Header info */}
				<div className="teleport-confirm-info">
					<div className="teleport-confirm-title-row">
						<span className="teleport-confirm-pin-icon" aria-hidden="true">
							📍
						</span>
						<strong className="teleport-confirm-placename">{placeName}</strong>
						<span className="teleport-confirm-dist">
							{Math.round(distance)}m
						</span>
					</div>

					{pin.isAdjusted && (
						<div className="teleport-confirm-adjusted-hint">
							<span>⚠️ အနီးဆုံး လျှောက်လှမ်းနိုင်သည့် နေရာသို့ ချိန်ညှိထားပါသည်</span>
						</div>
					)}
				</div>

				{/* Action Buttons: Confirm Checkmark (✓) and Cancel Cross (✕) */}
				<div className="teleport-confirm-actions">
					{/* Confirm Checkmark Button */}
					<button
						type="button"
						className="teleport-btn-confirm"
						onClick={() => onConfirm(pin)}
						aria-label="ဤနေရာသို့ သွားမည် (✓)"
						title="ဤနေရာသို့ သွားမည် (✓)"
					>
						<svg
							viewBox="0 0 24 24"
							width="20"
							height="20"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.8"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
					</button>

					{/* Cancel Cross Button */}
					<button
						type="button"
						className="teleport-btn-cancel"
						onClick={onCancel}
						aria-label="ပယ်ဖျက်မည် (Cancel)"
						title="ပယ်ဖျက်မည် (✕)"
					>
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.6"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>

				{/* Speech arrow pointing down to 3D marker */}
				<div className="teleport-confirm-tail" aria-hidden="true" />
			</div>
		</div>
	);
}
