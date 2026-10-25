import { driveableCars } from './carRide.ts';
import { angle, farmhouse, toWorld } from '../data/ward.ts';

export type SummonStatus = 'idle' | 'calling' | 'driving' | 'arrived' | 'returning';

// Facing South in world yaw along AH1 highway (angle = Math.PI / 4; increasing v is South):
// Moving forward (+d) along South requires x to increase and z to increase:
// yaw = angle + Math.PI = -3 * Math.PI / 4 = 5 * Math.PI / 4
export const SOUTH_YAW = angle + Math.PI;

// Original parked location of the car (from data/cars.ts):
export const ORIGINAL_PARK_U = 8.5;
export const ORIGINAL_PARK_V = 103.0;
export const ORIGINAL_PARK_YAW = angle;

// Target parking spot:
// Stopped right in front of the main road (AH1) facing South!
// Summon trigger spot is at Scene X/Z: 185.429, 196.050 (Local U/V: -7.510, 269.747) on access road.
// Target parking spot is right by the main road junction at u = -3.8, v = 270.0.
export const TARGET_PARKING_U = -3.8;
export const TARGET_PARKING_V = 270.0;

// User-specified summon trigger location:
// Scene X/Z (m): 185.429, 196.050 | Local U/V (m): -7.510, 269.747
export const SUMMON_TRIGGER_X = 185.429;
export const SUMMON_TRIGGER_Z = 196.050;
export const SUMMON_TRIGGER_U = -7.510;
export const SUMMON_TRIGGER_V = 269.747;

// Car approach start point (approaching South down AH1 main road from North):
export const START_APPROACH_U = -3.8;
export const START_APPROACH_V = 220.0;

export const REQUIRED_STAND_TIME = 3.0; // 3 seconds required standing still

export const carSummonState = {
	status: 'idle' as SummonStatus,
	progress: 0,
	timer: 0,
	arrivedTimer: 0,
	standTimer: 0,
};

export function isPlayerInSummonZone(px: number, pz: number): boolean {
	// 1. Check exact requested coordinates: (185.429, 196.050) / U/V (-7.510, 269.747) with generous detection radius
	const distToPoint = Math.hypot(px - SUMMON_TRIGGER_X, pz - SUMMON_TRIGGER_Z);
	if (distToPoint <= 10.0) return true;

	// 2. Also check farmhouse front doorway / verandah / front gate area
	const dx = px - farmhouse.x;
	const dz = pz - farmhouse.z;
	const c = Math.cos(farmhouse.rotation);
	const s = Math.sin(farmhouse.rotation);
	const lx = c * dx - s * dz;
	const lz = s * dx + c * dz;
	// Doorway: lx=0, lz=5.0. Verandah: lz=5..6.8. Steps: lz=6.8..7.3. Gate: lz=7.5. Driveway: lz=7.5..12.
	return lz >= 4.8 && lz <= 12.0 && Math.abs(lx) <= 4.5;
}

export function updateSummonStand(dt: number, px: number, pz: number, isMoving: boolean, driving: boolean, riding: boolean): void {
	if (driving || riding || !isPlayerInSummonZone(px, pz)) {
		carSummonState.standTimer = 0;
		return;
	}

	// While inside the summon zone, if player stops moving:
	if (!isMoving) {
		carSummonState.standTimer = Math.min(10, carSummonState.standTimer + dt);
	} else {
		// Player is moving/walking: reset stand timer
		carSummonState.standTimer = 0;
	}
}

export function canSummonCar(px: number, pz: number, driving: boolean, riding: boolean): boolean {
	if (driving || riding) return false;
	if (carSummonState.status === 'calling' || carSummonState.status === 'driving' || carSummonState.status === 'arrived') {
		return true;
	}
	if (carSummonState.status === 'returning') return false;
	if (!isPlayerInSummonZone(px, pz)) return false;

	// Must be standing still for at least 3 seconds
	if (carSummonState.standTimer < REQUIRED_STAND_TIME) return false;

	const car = driveableCars[0];
	if (!car) return false;

	const target = toWorld(TARGET_PARKING_U, TARGET_PARKING_V);
	const distToTarget = Math.hypot(car.x - target.x, car.z - target.z);
	// If the car is already parked within 5m of the target spot in front of the main road, no need to summon
	if (distToTarget < 5.0) return false;

	return true;
}

export function startCarSummon(): boolean {
	const car = driveableCars[0];
	if (!car) return false;

	const start = toWorld(START_APPROACH_U, START_APPROACH_V);
	car.x = start.x;
	car.z = start.z;
	car.yaw = SOUTH_YAW;
	car.speed = 0;
	car.steering = 0;
	car.mustLeave = false;

	carSummonState.status = 'driving';
	carSummonState.progress = 0;
	carSummonState.timer = 0;
	carSummonState.arrivedTimer = 0;
	return true;
}

export function startCarReturn(): boolean {
	const car = driveableCars[0];
	if (!car) return false;

	carSummonState.status = 'returning';
	carSummonState.progress = 0;
	carSummonState.timer = 0;
	carSummonState.arrivedTimer = 0;
	carSummonState.standTimer = 0;
	return true;
}

export function stepCarSummon(
	dt: number,
	height: (x: number, z: number) => number,
	px?: number,
	pz?: number,
	driving?: boolean,
	riding?: boolean
): void {
	if (carSummonState.status === 'idle') return;

	const car = driveableCars[0];
	if (!car) {
		carSummonState.status = 'idle';
		return;
	}

	if (carSummonState.status === 'driving') {
		const DRIVE_DURATION = 4.5; // ~4.5s for smooth highway approach driving South
		carSummonState.progress = Math.min(1, carSummonState.progress + dt / DRIVE_DURATION);
		const t = carSummonState.progress;

		// Smooth ease-in-out curve
		const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
		const currentV = START_APPROACH_V + (TARGET_PARKING_V - START_APPROACH_V) * ease;
		const pos = toWorld(TARGET_PARKING_U, currentV);

		const dx = pos.x - car.x;
		const dz = pos.z - car.z;
		const stepDist = Math.hypot(dx, dz);

		car.x = pos.x;
		car.z = pos.z;
		car.yaw = SOUTH_YAW;
		car.speed = dt > 0 ? (stepDist / dt) : 0;
		car.groundY = height(car.x, car.z);
		car.distance += stepDist;
		for (let i = 0; i < 4; i++) {
			car.wheelTravel[i] += stepDist;
		}

		if (carSummonState.progress >= 1) {
			car.speed = 0;
			car.steering = 0;
			car.yaw = SOUTH_YAW;
			carSummonState.status = 'arrived';
			carSummonState.arrivedTimer = 0;
		}
	} else if (carSummonState.status === 'arrived') {
		car.speed = 0;
		car.steering = 0;
		car.yaw = SOUTH_YAW;

		// If player boarded the car, reset summon state immediately
		if (driving || riding) {
			carSummonState.status = 'idle';
			carSummonState.progress = 0;
			carSummonState.timer = 0;
			carSummonState.arrivedTimer = 0;
			return;
		}

		carSummonState.arrivedTimer += dt;

		// Check if player is inside the summon circle (r = 3.5m)
		const distToCircle = px !== undefined && pz !== undefined ? Math.hypot(px - SUMMON_TRIGGER_X, pz - SUMMON_TRIGGER_Z) : 999;
		const inCircle = distToCircle <= 4.0;

		// User requirement: ကားခေါ်လို့ ရောက်ပြီးလို့ 10 second အတွင်းမစီးလျှင် နဲ့ အဝိုင်းထဲမှာ မရှိလျှင် သူ့ဘသာကားက ခေါက်ပြီးမူလနေရာကို ပြန်သွား
		if (carSummonState.arrivedTimer >= 10.0 && !inCircle) {
			startCarReturn();
		} else if (carSummonState.arrivedTimer >= 18.0) {
			startCarReturn();
		}
	} else if (carSummonState.status === 'returning') {
		if (driving || riding) {
			carSummonState.status = 'idle';
			carSummonState.progress = 0;
			carSummonState.timer = 0;
			carSummonState.arrivedTimer = 0;
			return;
		}

		const RETURN_DURATION = 6.0; // 6s smooth autonomous U-turn and drive back to original spot
		carSummonState.progress = Math.min(1, carSummonState.progress + dt / RETURN_DURATION);
		const t = carSummonState.progress;

		let currentU: number;
		let currentV: number;
		let currentYaw: number;
		let steerAngle = 0;

		// Phase 1: U-turn / Turning around ("ခေါက်ပြီး") during first 25% of progress
		if (t < 0.25) {
			const t1 = t / 0.25;
			const e1 = t1 < 0.5 ? 2 * t1 * t1 : 1 - Math.pow(-2 * t1 + 2, 2) / 2;
			currentU = TARGET_PARKING_U + (3.8 - TARGET_PARKING_U) * Math.sin((e1 * Math.PI) / 2);
			currentV = TARGET_PARKING_V + 4.5 * Math.sin(e1 * Math.PI);
			currentYaw = SOUTH_YAW + e1 * Math.PI;
			steerAngle = Math.sin(e1 * Math.PI) * 0.45;
		} else {
			// Phase 2: Driving North along AH1 back to original spot (u = 8.5, v = 103.0)
			const t2 = (t - 0.25) / 0.75;
			const e2 = t2 < 0.5 ? 2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 2) / 2;
			currentU = 3.8 + (ORIGINAL_PARK_U - 3.8) * e2;
			currentV = TARGET_PARKING_V + (ORIGINAL_PARK_V - TARGET_PARKING_V) * e2;
			currentYaw = ORIGINAL_PARK_YAW;
			steerAngle = 0;
		}

		const pos = toWorld(currentU, currentV);
		const dx = pos.x - car.x;
		const dz = pos.z - car.z;
		const stepDist = Math.hypot(dx, dz);

		car.x = pos.x;
		car.z = pos.z;
		car.yaw = currentYaw;
		car.steering = steerAngle;
		car.speed = dt > 0 ? (stepDist / dt) : 0;
		car.groundY = height(car.x, car.z);
		car.distance += stepDist;
		for (let i = 0; i < 4; i++) {
			car.wheelTravel[i] += stepDist;
		}

		if (carSummonState.progress >= 1) {
			const finalPos = toWorld(ORIGINAL_PARK_U, ORIGINAL_PARK_V);
			car.x = finalPos.x;
			car.z = finalPos.z;
			car.yaw = ORIGINAL_PARK_YAW;
			car.speed = 0;
			car.steering = 0;
			carSummonState.status = 'idle';
			carSummonState.progress = 0;
			carSummonState.arrivedTimer = 0;
			carSummonState.standTimer = 0;
		}
	}
}

export function resetCarSummon(): void {
	carSummonState.status = 'idle';
	carSummonState.progress = 0;
	carSummonState.timer = 0;
	carSummonState.arrivedTimer = 0;
	carSummonState.standTimer = 0;
}
