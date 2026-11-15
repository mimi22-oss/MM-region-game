import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { parkedCars } from '../src/data/cars.ts';
import { createGlbHuman } from '../src/game/glbHuman.ts';
import { driveableCars, enterCar, parkCar } from '../src/game/carRide.ts';
import { carSummonState, stepCarSummon, SUMMON_TRIGGER_X, SUMMON_TRIGGER_Z } from '../src/game/carSummon.ts';
import {
	clearSpecialActionCache,
	getSpecialAction,
	getSpecialActionCacheStats,
	getSpecialActionState,
	listSpecialActions,
	loadSpecialActionClipForRig,
	retargetAnimationClipToRig,
	setSpecialActionLoop,
	stopSpecialAction,
} from '../src/game/specialActions.ts';
import {
	acceptVehicleRequest,
	beginEnteringVehicle,
	cancelVehicleRequest,
	completeVehicleBoarding,
	getCarBoardingTarget,
	getVehicleWaitingConfig,
	getVehicleWaitingState,
	interruptVehicleWaiting,
	isVehicleWaitingActiveState,
	isVehicleWaitingPickupLocked,
	registerVehicleWaitingConfig,
	requestVehiclePickup,
	resetVehicleWaiting,
	stepVehicleWaiting,
} from '../src/game/vehicleWaiting.ts';

const car = driveableCars[0];

async function parseGlbStripTextures(relativePath: string): Promise<GLTF> {
	const bytes = await readFile(new URL(relativePath, import.meta.url));
	const jsonLength = bytes.readUInt32LE(12);
	const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
	delete json.images;
	delete json.textures;
	delete json.samplers;
	delete json.materials;
	for (const mesh of json.meshes ?? []) {
		for (const primitive of mesh.primitives ?? []) delete primitive.material;
	}
	const rawJson = JSON.stringify(json);
	const encoded = Buffer.from(rawJson.padEnd(Math.ceil(rawJson.length / 4) * 4, ' '));
	const bin = bytes.subarray(20 + jsonLength);
	const buffer = Buffer.alloc(20 + encoded.length + bin.length);
	bytes.copy(buffer, 0, 0, 12);
	buffer.writeUInt32LE(buffer.length, 8);
	buffer.writeUInt32LE(encoded.length, 12);
	buffer.writeUInt32LE(0x4e4f534a, 16);
	encoded.copy(buffer, 20);
	bin.copy(buffer, 20 + encoded.length);
	return new GLTFLoader().parseAsync(
		buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
		''
	);
}

async function parseAnimationOnlyGlb(
	relativePath: string
): Promise<{ gltf: GLTF; byteLength: number; json: Record<string, unknown> }> {
	const bytes = await readFile(new URL(relativePath, import.meta.url));
	const jsonLength = bytes.readUInt32LE(12);
	const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()) as Record<string, unknown>;
	const gltf = await new GLTFLoader().parseAsync(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
		''
	);
	return { gltf, byteLength: bytes.length, json };
}

beforeEach(() => {
	parkCar();
	Object.assign(car, {
		...parkedCars[0],
		model: 'compact',
		transmission: 'manual',
		yaw: parkedCars[0].rotation,
		speed: 0,
		distance: 0,
		steering: 0,
		wheelTravel: [0, 0, 0, 0],
		mustLeave: false,
	});
	resetVehicleWaiting();
	stopSpecialAction();
	setSpecialActionLoop(true);
});

test('extracted wait_car GLB has zero meshes/images/scale tracks and matches source wait.001 duration', async () => {
	const srcInfo = await stat(new URL('../boy wait.glb', import.meta.url));
	const srcGltf = await parseGlbStripTextures('../boy wait.glb');
	const waitDef = getSpecialAction('vehicle-wait');
	assert.ok(waitDef, 'vehicle-wait registered in Motion Registry');
	assert.equal(getSpecialAction('wait_car')?.id, 'vehicle-wait', 'legacy wait_car alias resolves cleanly');
	assert.equal(waitDef.category, 'interactions');
	assert.equal(waitDef.clipName, 'wait.001');

	// Verify vehicle-wait does not pollute dance menu listings
	const danceIds = listSpecialActions('dance').map(d => d.id);
	assert.equal(danceIds.includes('vehicle-wait'), false);

	const { gltf, byteLength, json } = await parseAnimationOnlyGlb(`../public${waitDef.assetUrl}`);
	assert.equal(json.meshes, undefined);
	assert.equal(json.images, undefined);
	assert.equal(json.textures, undefined);
	assert.equal(json.materials, undefined);
	assert.equal(json.skins, undefined);
	assert.ok(byteLength < srcInfo.size * 0.1, `extracted wait GLB (${byteLength}) < 10% of source (${srcInfo.size})`);

	let meshCount = 0;
	gltf.scene.traverse(obj => {
		if ((obj as { isMesh?: boolean }).isMesh) meshCount++;
	});
	assert.equal(meshCount, 0);
	assert.equal(gltf.animations.length, 1);
	const clip = gltf.animations[0];
	assert.equal(clip.name, 'wait.001');
	assert.ok(clip.tracks.every(t => !t.name.endsWith('.scale')));

	const srcClip = srcGltf.animations[0];
	assert.ok(Math.abs(clip.duration - srcClip.duration) < 1e-3);
});

test('retargets wait.001 onto boy.glb & girl.glb with zero horizontal drift and clean Idle/Walk/Jump blending', async () => {
	const [boyModel, girlModel, waitAsset] = await Promise.all([
		parseGlbStripTextures('../src/assets/boy.glb'),
		parseGlbStripTextures('../src/assets/girl.glb'),
		parseAnimationOnlyGlb('../public/motions/interactions/vehicle-wait.glb'),
	]);

	for (const [preset, model] of [
		['boy', boyModel],
		['girl', girlModel],
	] as const) {
		const avatar = createGlbHuman(model.scene, { preset });
		const clip = retargetAnimationClipToRig(waitAsset.gltf.animations[0], waitAsset.gltf.scene, model.scene);
		assert.ok(clip.tracks.length >= 50, `${preset} preserves full skeleton tracks`);
		for (const track of clip.tracks) {
			for (let i = 0; i < track.values.length; i++) {
				assert.ok(Number.isFinite(track.values[i]), `${preset} track ${track.name}[${i}] is finite`);
			}
		}

		// Smooth crossfade Idle -> wait.001 (~0.28s)
		avatar.setSpecialClip(clip, { loop: true, crossFadeSec: 0.28 });
		avatar.update({ speed: 0, distance: 0 }, false, undefined, 0.08);
		const midIn = avatar.specialBlend();
		assert.ok(midIn > 0 && midIn < 1, `${preset} smoothly crossfades into wait.001 (${midIn.toFixed(3)})`);

		for (let f = 0; f < 30; f++) {
			avatar.update({ speed: 0, distance: 0 }, false, undefined, 0.032);
		}
		assert.ok(avatar.specialBlend() > 0.99);
		assert.equal(avatar.specialClipName(), 'wait.001');

		avatar.root.updateMatrixWorld(true);
		const bounds = new Box3().setFromObject(avatar.root);
		const size = bounds.getSize(new Vector3());
		assert.ok(Math.abs(avatar.root.position.x) < 1e-4 && Math.abs(avatar.root.position.z) < 1e-4, 'root stays anchored');
		assert.ok(bounds.min.y > -0.1 && bounds.min.y < 0.2, `${preset} feet near floor (${bounds.min.y.toFixed(3)})`);
		assert.ok(size.y > 1.2 && size.y < 2.1, `${preset} height stays valid (${size.y.toFixed(3)})`);

		// Transition wait.001 -> Idle gracefully
		avatar.setSpecialClip(null);
		for (let f = 0; f < 40; f++) avatar.update({ speed: 0, distance: 0 }, false, undefined, 0.032);
		assert.equal(avatar.specialBlend(), 0);
		assert.equal(avatar.specialClipName(), null);

		// Verify Walk / Jump override wait.001 with zero conflict
		avatar.setSpecialClip(clip, { loop: true });
		for (let f = 0; f < 25; f++) avatar.update({ speed: 0, distance: 0 }, false, undefined, 0.032);
		for (let f = 0; f < 30; f++) avatar.update({ speed: 4.0, distance: f * 0.08 }, false, undefined, 0.032);
		assert.equal(avatar.clip(), 'walk');
		assert.equal(avatar.specialBlend(), 0);

		avatar.setSpecialClip(clip, { loop: true });
		for (let f = 0; f < 25; f++) avatar.update({ speed: 0, distance: 0 }, false, undefined, 0.032);
		for (let f = 0; f < 30; f++) avatar.update({ speed: 0, distance: 0, airborne: true }, false, undefined, 0.032);
		assert.equal(avatar.clip(), 'jump');
		assert.equal(avatar.specialBlend(), 0);

		avatar.dispose();
	}
});

test('vehicle waiting state machine walks all 8 states from Call to Ride and Exit', () => {
	// Even if user previously disabled dance looping, waiting clip must loop
	setSpecialActionLoop(false);

	assert.equal(getVehicleWaitingState().state, 'IDLE');
	assert.equal(requestVehiclePickup('car', { pickupX: SUMMON_TRIGGER_X, pickupZ: SUMMON_TRIGGER_Z }), true);

	let snap = getVehicleWaitingState();
	assert.equal(snap.state, 'CALLING_VEHICLE');
	assert.equal(carSummonState.status, 'calling');
	assert.equal(isVehicleWaitingPickupLocked(snap.state), true);

	// Duplicate calls must be ignored during active lifecycle
	assert.equal(requestVehiclePickup('car'), false);

	// Request accepted -> WAITING_FOR_VEHICLE -> starts vehicle-wait in loop
	assert.equal(acceptVehicleRequest(), true);
	snap = getVehicleWaitingState();
	assert.equal(snap.state, 'WAITING_FOR_VEHICLE');
	assert.equal(carSummonState.status, 'driving');
	assert.equal(isVehicleWaitingActiveState(snap.state), true);
	assert.equal(getSpecialActionState().activeActionId, 'vehicle-wait');
	assert.equal(getSpecialActionState().loop, true);

	// Step car summon halfway until threshold -> VEHICLE_APPROACHING, wait.001 continues
	for (let i = 0; i < 80; i++) {
		stepCarSummon(0.05, () => 0, SUMMON_TRIGGER_X, SUMMON_TRIGGER_Z, false, false);
		stepVehicleWaiting(0.05);
	}
	snap = getVehicleWaitingState();
	assert.equal(snap.state, 'VEHICLE_APPROACHING');
	assert.equal(getSpecialActionState().activeActionId, 'vehicle-wait');
	assert.equal(getSpecialActionState().loop, true);
	assert.equal(requestVehiclePickup('car'), false, 'no duplicate call during approach');

	// Complete approach -> vehicle stops at pickup spot -> VEHICLE_ARRIVED & stop waiting clip
	for (let i = 0; i < 80; i++) {
		stepCarSummon(0.05, () => 0, SUMMON_TRIGGER_X, SUMMON_TRIGGER_Z, false, false);
		stepVehicleWaiting(0.05);
	}
	snap = getVehicleWaitingState();
	assert.equal(carSummonState.status, 'arrived');
	assert.equal(car.speed, 0);
	assert.equal(snap.state, 'VEHICLE_ARRIVED');
	assert.equal(isVehicleWaitingPickupLocked(snap.state), false);
	assert.equal(getSpecialActionState().activeActionId, null, 'stops waiting animation on arrival');

	// Tap Enter Vehicle -> ENTERING_VEHICLE -> boarding completes -> RIDING_VEHICLE
	const door = getCarBoardingTarget(car, SUMMON_TRIGGER_X, SUMMON_TRIGGER_Z);
	assert.ok(Math.hypot(door.x - car.x, door.z - car.z) > 1.0);
	assert.equal(beginEnteringVehicle(), true);
	assert.equal(beginEnteringVehicle(), false, 'duplicate Enter trigger prevented');
	assert.equal(getVehicleWaitingState().state, 'ENTERING_VEHICLE');

	enterCar(car);
	completeVehicleBoarding();
	assert.equal(getVehicleWaitingState().state, 'RIDING_VEHICLE');

	// Exit car -> settles back to IDLE
	parkCar();
	stepVehicleWaiting(0.05);
	assert.equal(getVehicleWaitingState().state, 'IDLE');
});

test('cancellation, interruption, repeated requests, cache reuse, and future vehicle types work cleanly', async () => {
	clearSpecialActionCache();
	let fetchCount = 0;
	const mockLoader = async (url: string) => {
		fetchCount++;
		const { gltf } = await parseAnimationOnlyGlb(`../public${url}`);
		return gltf;
	};
	const boyModel = await parseGlbStripTextures('../src/assets/boy.glb');

	// First request + lazy clip load
	assert.equal(requestVehiclePickup('car', { acceptImmediately: true }), true);
	assert.equal(getVehicleWaitingState().state, 'WAITING_FOR_VEHICLE');
	await loadSpecialActionClipForRig('vehicle-wait', 'boy', boyModel.scene, mockLoader);
	assert.equal(fetchCount, 1);

	// User cancels -> CANCELLED -> stops waiting clip -> car returns -> IDLE after reset delay
	assert.equal(cancelVehicleRequest('user'), true);
	assert.equal(getVehicleWaitingState().state, 'CANCELLED');
	assert.equal(getVehicleWaitingState().cancelReason, 'user');
	assert.equal(getSpecialActionState().activeActionId, null);
	assert.equal(carSummonState.status, 'returning');

	for (let i = 0; i < 140; i++) {
		stepCarSummon(0.05, () => 0);
		stepVehicleWaiting(0.05);
	}
	assert.equal(carSummonState.status, 'idle');
	assert.equal(getVehicleWaitingState().state, 'IDLE');

	// Second request hits LRU cache (no duplicate GLB download!) and handles interruption cleanly
	assert.equal(requestVehiclePickup('car', { acceptImmediately: true }), true);
	await loadSpecialActionClipForRig('vehicle-wait', 'boy', boyModel.scene, mockLoader);
	assert.equal(fetchCount, 1, 'repeated waiting request reuses cached vehicle-wait clip');
	assert.ok(getSpecialActionCacheStats().clipCount >= 1);

	assert.equal(interruptVehicleWaiting(), true);
	assert.equal(getVehicleWaitingState().state, 'CANCELLED');
	assert.equal(getVehicleWaitingState().cancelReason, 'interrupted');
	assert.equal(getSpecialActionState().activeActionId, null);

	// Future vehicle compatibility config registration
	registerVehicleWaitingConfig({
		vehicleType: 'taxi',
		waitActionId: 'vehicle-wait',
		label: 'Taxi',
		myanmarLabel: 'တက္ကစီ',
		approachProgressThreshold: 0.4,
		callAcceptDelaySec: 0.2,
		cancelResetDelaySec: 1.0,
	});
	assert.equal(getVehicleWaitingConfig('taxi').label, 'Taxi');

	resetVehicleWaiting();
});
