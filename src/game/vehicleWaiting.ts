import { useSyncExternalStore } from 'react';
import { currentCar, driveableCars, type DriveableCar } from './carRide.ts';
import {
	carSummonState,
	resetCarSummon,
	startCarReturn,
	startCarSummon,
	SUMMON_TRIGGER_X,
	SUMMON_TRIGGER_Z,
} from './carSummon.ts';
import {
	getSpecialAction,
	getSpecialActionState,
	playSpecialAction,
	resolveSpecialActionId,
	stopSpecialAction,
	type SpecialActionId,
} from './specialActions.ts';

export type VehicleWaitingState =
	| 'IDLE'
	| 'CALLING_VEHICLE'
	| 'WAITING_FOR_VEHICLE'
	| 'VEHICLE_APPROACHING'
	| 'VEHICLE_ARRIVED'
	| 'ENTERING_VEHICLE'
	| 'RIDING_VEHICLE'
	| 'CANCELLED';

export type WaitableVehicleType = 'car' | 'motorcycle' | 'taxi' | 'bus' | 'pickup';
export type VehicleCancelReason = 'user' | 'timeout' | 'interrupted' | 'failed';

export interface VehicleWaitingConfig {
	readonly vehicleType: WaitableVehicleType;
	readonly waitActionId: SpecialActionId;
	readonly label: string;
	readonly myanmarLabel: string;
	readonly approachProgressThreshold: number;
	readonly callAcceptDelaySec: number;
	readonly cancelResetDelaySec: number;
}

export interface VehicleWaitingSnapshot {
	readonly state: VehicleWaitingState;
	readonly vehicleType: WaitableVehicleType;
	readonly requestId: number;
	readonly waitActionId: SpecialActionId;
	readonly pickupPosition: { readonly x: number; readonly z: number } | null;
	readonly approachPercent: number;
	readonly cancelReason: VehicleCancelReason | null;
}

export interface RequestVehicleOptions {
	pickupX?: number;
	pickupZ?: number;
	acceptImmediately?: boolean;
	playAnimation?: boolean;
}

export interface StepVehicleWaitingOptions {
	playAnimation?: boolean;
	driving?: boolean;
	balloonRiding?: boolean;
	motorcycleRiding?: boolean;
	crashed?: boolean;
	airborne?: boolean;
}

const DEFAULT_CONFIGS: VehicleWaitingConfig[] = [
	{
		vehicleType: 'car',
		waitActionId: 'vehicle-wait',
		label: 'Car',
		myanmarLabel: 'ကား',
		approachProgressThreshold: 0.45,
		callAcceptDelaySec: 0.22,
		cancelResetDelaySec: 1.2,
	},
];

const configRegistry = new Map<WaitableVehicleType, VehicleWaitingConfig>(
	DEFAULT_CONFIGS.map(cfg => [cfg.vehicleType, cfg])
);

export function registerVehicleWaitingConfig(config: VehicleWaitingConfig): void {
	configRegistry.set(config.vehicleType, config);
}

export function getVehicleWaitingConfig(vehicleType: WaitableVehicleType = 'car'): VehicleWaitingConfig {
	return configRegistry.get(vehicleType) ?? DEFAULT_CONFIGS[0];
}

export function isVehicleWaitingActiveState(state: VehicleWaitingState): boolean {
	return state === 'WAITING_FOR_VEHICLE' || state === 'VEHICLE_APPROACHING';
}

export function isVehicleWaitingPickupLocked(state: VehicleWaitingState): boolean {
	return state === 'CALLING_VEHICLE' || state === 'WAITING_FOR_VEHICLE' || state === 'VEHICLE_APPROACHING';
}

interface InternalWaitingRuntime {
	state: VehicleWaitingState;
	vehicleType: WaitableVehicleType;
	requestId: number;
	waitActionId: SpecialActionId;
	pickupPosition: { x: number; z: number } | null;
	approachPercent: number;
	cancelReason: VehicleCancelReason | null;
	playAnimation: boolean;
	callingTimer: number;
	cancelledTimer: number;
	enteringTimer: number;
}

const runtime: InternalWaitingRuntime = {
	state: 'IDLE',
	vehicleType: 'car',
	requestId: 0,
	waitActionId: 'vehicle-wait',
	pickupPosition: null,
	approachPercent: 0,
	cancelReason: null,
	playAnimation: true,
	callingTimer: 0,
	cancelledTimer: 0,
	enteringTimer: 0,
};

let snapshot: VehicleWaitingSnapshot = {
	state: runtime.state,
	vehicleType: runtime.vehicleType,
	requestId: runtime.requestId,
	waitActionId: runtime.waitActionId,
	pickupPosition: runtime.pickupPosition,
	approachPercent: runtime.approachPercent,
	cancelReason: runtime.cancelReason,
};

const listeners = new Set<() => void>();

function syncSnapshot(force = false): void {
	const changed =
		force ||
		snapshot.state !== runtime.state ||
		snapshot.vehicleType !== runtime.vehicleType ||
		snapshot.requestId !== runtime.requestId ||
		snapshot.waitActionId !== runtime.waitActionId ||
		snapshot.approachPercent !== runtime.approachPercent ||
		snapshot.cancelReason !== runtime.cancelReason ||
		snapshot.pickupPosition?.x !== runtime.pickupPosition?.x ||
		snapshot.pickupPosition?.z !== runtime.pickupPosition?.z;

	if (!changed) return;

	snapshot = {
		state: runtime.state,
		vehicleType: runtime.vehicleType,
		requestId: runtime.requestId,
		waitActionId: runtime.waitActionId,
		pickupPosition: runtime.pickupPosition ? { ...runtime.pickupPosition } : null,
		approachPercent: runtime.approachPercent,
		cancelReason: runtime.cancelReason,
	};
	for (const listener of listeners) listener();
}

function stopWaitingClipIfActive(): void {
	const activeId = getSpecialActionState().activeActionId;
	if (!activeId) return;
	const def = getSpecialAction(activeId);
	if (def?.category === 'interactions') {
		stopSpecialAction();
	}
}

function ensureWaitingClipPlaying(): void {
	if (!runtime.playAnimation) return;
	const canonicalWaitId = resolveSpecialActionId(runtime.waitActionId);
	const special = getSpecialActionState();
	if (special.activeActionId === canonicalWaitId && special.loop && special.status !== 'error') {
		return;
	}
	playSpecialAction(canonicalWaitId, { loop: true });
}

function transitionToCancelled(reason: VehicleCancelReason): boolean {
	if (runtime.state === 'IDLE' || runtime.state === 'CANCELLED' || runtime.state === 'RIDING_VEHICLE') {
		return false;
	}
	stopWaitingClipIfActive();
	if (carSummonState.status === 'calling') {
		carSummonState.status = 'idle';
		carSummonState.progress = 0;
		carSummonState.timer = 0;
		carSummonState.arrivedTimer = 0;
	} else if (carSummonState.status === 'driving' || carSummonState.status === 'arrived') {
		startCarReturn();
	}
	runtime.state = 'CANCELLED';
	runtime.cancelReason = reason;
	runtime.callingTimer = 0;
	runtime.enteringTimer = 0;
	runtime.cancelledTimer = 0;
	runtime.approachPercent = 0;
	syncSnapshot();
	return true;
}

export function requestVehiclePickup(
	vehicleType: WaitableVehicleType = 'car',
	options?: RequestVehicleOptions
): boolean {
	// Prevent duplicate vehicle requests while one is in progress or boarded
	if (runtime.state !== 'IDLE' && runtime.state !== 'CANCELLED') {
		return false;
	}
	const car = driveableCars[0];
	if (!car || currentCar() || carSummonState.status === 'returning') {
		return false;
	}

	const cfg = getVehicleWaitingConfig(vehicleType);
	// Clear any unrelated special action (e.g. a dance) cleanly before calling
	if (getSpecialActionState().activeActionId !== null) {
		stopSpecialAction();
	}

	runtime.vehicleType = cfg.vehicleType;
	runtime.waitActionId = cfg.waitActionId;
	runtime.requestId += 1;
	runtime.pickupPosition = {
		x: options?.pickupX ?? SUMMON_TRIGGER_X,
		z: options?.pickupZ ?? SUMMON_TRIGGER_Z,
	};
	runtime.approachPercent = 0;
	runtime.cancelReason = null;
	runtime.playAnimation = options?.playAnimation ?? true;
	runtime.callingTimer = 0;
	runtime.cancelledTimer = 0;
	runtime.enteringTimer = 0;
	runtime.state = 'CALLING_VEHICLE';
	carSummonState.status = 'calling';
	syncSnapshot();

	if (options?.acceptImmediately) {
		return acceptVehicleRequest();
	}
	return true;
}

export function acceptVehicleRequest(): boolean {
	if (runtime.state !== 'CALLING_VEHICLE') return false;
	if (!startCarSummon()) {
		return transitionToCancelled('failed');
	}
	runtime.state = 'WAITING_FOR_VEHICLE';
	runtime.callingTimer = 0;
	runtime.approachPercent = 0;
	ensureWaitingClipPlaying();
	syncSnapshot();
	return true;
}

export function cancelVehicleRequest(reason: VehicleCancelReason = 'user'): boolean {
	return transitionToCancelled(reason);
}

export function interruptVehicleWaiting(): boolean {
	if (runtime.state === 'IDLE') return false;
	if (runtime.state === 'RIDING_VEHICLE' || runtime.state === 'CANCELLED') {
		stopWaitingClipIfActive();
		runtime.state = 'IDLE';
		runtime.cancelReason = null;
		runtime.pickupPosition = null;
		runtime.callingTimer = 0;
		runtime.enteringTimer = 0;
		runtime.cancelledTimer = 0;
		runtime.approachPercent = 0;
		syncSnapshot();
		return true;
	}
	return transitionToCancelled('interrupted');
}

export function beginEnteringVehicle(): boolean {
	if (runtime.state !== 'VEHICLE_ARRIVED') return false;
	const car = driveableCars[0];
	if (!car || carSummonState.status !== 'arrived') return false;

	stopWaitingClipIfActive();
	carSummonState.arrivedTimer = 0;
	runtime.enteringTimer = 0;
	runtime.state = 'ENTERING_VEHICLE';
	syncSnapshot();
	return true;
}

export function completeVehicleBoarding(): boolean {
	if (runtime.state === 'RIDING_VEHICLE') return false;
	stopWaitingClipIfActive();
	runtime.enteringTimer = 0;
	runtime.state = 'RIDING_VEHICLE';
	runtime.cancelReason = null;
	syncSnapshot();
	return true;
}

export function getCarBoardingTarget(
	car: DriveableCar,
	playerX: number,
	playerZ: number
): { x: number; z: number } {
	const c = Math.cos(car.yaw);
	const s = Math.sin(car.yaw);
	const dx = playerX - car.x;
	const dz = playerZ - car.z;
	const u = c * dx - s * dz;
	const doorU = Math.sign(u || 1) * ((car.width * car.size) / 2 + 0.55);
	return {
		x: car.x + c * doorU,
		z: car.z - s * doorU,
	};
}

export function stepVehicleWaiting(dt: number, options?: StepVehicleWaitingOptions): VehicleWaitingSnapshot {
	const cfg = getVehicleWaitingConfig(runtime.vehicleType);
	const driving = options?.driving ?? !!currentCar();
	const conflictingGameplay =
		Boolean(options?.balloonRiding) ||
		Boolean(options?.motorcycleRiding) ||
		Boolean(options?.crashed) ||
		Boolean(options?.airborne);

	if (options?.playAnimation !== undefined) {
		runtime.playAnimation = options.playAnimation;
		if (!runtime.playAnimation) stopWaitingClipIfActive();
	}

	if (driving) {
		if (runtime.state !== 'RIDING_VEHICLE') {
			completeVehicleBoarding();
		}
		return snapshot;
	}

	if (runtime.state === 'RIDING_VEHICLE') {
		// Player exited vehicle
		runtime.state = 'IDLE';
		runtime.pickupPosition = null;
		runtime.approachPercent = 0;
		runtime.cancelReason = null;
		syncSnapshot();
		return snapshot;
	}

	if (conflictingGameplay && runtime.state !== 'IDLE' && runtime.state !== 'CANCELLED') {
		transitionToCancelled('interrupted');
		return snapshot;
	}

	if (runtime.state === 'CALLING_VEHICLE') {
		runtime.callingTimer += Math.max(0, dt);
		if (runtime.callingTimer >= cfg.callAcceptDelaySec) {
			acceptVehicleRequest();
		}
		return snapshot;
	}

	if (runtime.state === 'WAITING_FOR_VEHICLE' || runtime.state === 'VEHICLE_APPROACHING') {
		const car = driveableCars[0];
		if (!car || (carSummonState.status !== 'driving' && carSummonState.status !== 'arrived')) {
			transitionToCancelled('failed');
			return snapshot;
		}

		// Quantize progress to 5% increments so HUD stays reactive without per-frame React churn
		const quantizedPercent = Math.min(100, Math.max(0, Math.round(carSummonState.progress * 20) * 5));
		runtime.approachPercent = quantizedPercent;

		// Require vehicle to finish approaching AND come to a full stop before marking arrived
		if (carSummonState.status === 'arrived' && Math.abs(car.speed) < 1e-3) {
			stopWaitingClipIfActive();
			runtime.state = 'VEHICLE_ARRIVED';
			runtime.approachPercent = 100;
			syncSnapshot();
			return snapshot;
		}

		if (
			runtime.state === 'WAITING_FOR_VEHICLE' &&
			carSummonState.progress >= cfg.approachProgressThreshold
		) {
			runtime.state = 'VEHICLE_APPROACHING';
		}

		ensureWaitingClipPlaying();
		syncSnapshot();
		return snapshot;
	}

	if (runtime.state === 'VEHICLE_ARRIVED') {
		if (carSummonState.status === 'returning' || carSummonState.status === 'idle') {
			transitionToCancelled('timeout');
		}
		return snapshot;
	}

	if (runtime.state === 'ENTERING_VEHICLE') {
		runtime.enteringTimer += Math.max(0, dt);
		if (carSummonState.status === 'returning' || carSummonState.status === 'idle' || runtime.enteringTimer > 2.5) {
			transitionToCancelled('failed');
		}
		return snapshot;
	}

	if (runtime.state === 'CANCELLED') {
		runtime.cancelledTimer += Math.max(0, dt);
		if (runtime.cancelledTimer >= cfg.cancelResetDelaySec) {
			runtime.state = 'IDLE';
			runtime.cancelReason = null;
			runtime.pickupPosition = null;
			runtime.cancelledTimer = 0;
			syncSnapshot();
		}
	}

	return snapshot;
}

export function finishVehicleCancelNotice(): void {
	if (runtime.state !== 'CANCELLED') return;
	runtime.state = 'IDLE';
	runtime.cancelReason = null;
	runtime.pickupPosition = null;
	runtime.cancelledTimer = 0;
	syncSnapshot();
}

export function resetVehicleWaiting(resetSummon = true): void {
	stopWaitingClipIfActive();
	if (resetSummon) {
		resetCarSummon();
	}
	runtime.state = 'IDLE';
	runtime.vehicleType = 'car';
	runtime.waitActionId = 'vehicle-wait';
	runtime.pickupPosition = null;
	runtime.approachPercent = 0;
	runtime.cancelReason = null;
	runtime.playAnimation = true;
	runtime.callingTimer = 0;
	runtime.cancelledTimer = 0;
	runtime.enteringTimer = 0;
	syncSnapshot();
}

export function getVehicleWaitingState(): VehicleWaitingSnapshot {
	return snapshot;
}

export function subscribeVehicleWaiting(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useVehicleWaiting(): VehicleWaitingSnapshot {
	return useSyncExternalStore(
		subscribeVehicleWaiting,
		getVehicleWaitingState,
		getVehicleWaitingState
	);
}
