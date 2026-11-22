import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createMobileInput } from '../src/game/mobileInput.ts';
import {
	TeleportTouchController,
	clampTeleportCardPosition,
	isTeleportTap,
	teleportPinHitRadius,
} from '../src/game/teleportTouch.ts';

const ROOT = process.cwd();

test('TeleportTouchController places pin on single touch tap with finger slop tolerance', () => {
	const ctrl = new TeleportTouchController();
	const input = createMobileInput();

	assert.equal(ctrl.down(1, 200, 320).multiTouchStarted, false);
	// Slight finger shift (11px) during a tap should NOT trigger orbit and SHOULD still drop a pin
	assert.equal(ctrl.move(1, 208, 327, input, false), 'idle');
	assert.equal(input.lookX, 0);
	assert.equal(input.lookY, 0);

	const result = ctrl.up(1, 208, 327, false);
	assert.equal(result.shouldPlacePin, true);
	assert.equal(result.remainingPointers, 0);
	assert.equal(isTeleportTap(8, 7, 'touch'), true);
	assert.equal(isTeleportTap(8, 7, 'mouse'), false);
	assert.ok(teleportPinHitRadius('touch') > teleportPinHitRadius('mouse'));
});

test('TeleportTouchController orbits camera on single-finger drag without dropping a pin', () => {
	const ctrl = new TeleportTouchController();
	const input = createMobileInput();

	ctrl.down(1, 180, 300);
	assert.equal(ctrl.move(1, 220, 312, input, false), 'camera');
	assert.ok(input.lookX > 0, 'horizontal drag feeds lookX');
	assert.ok(input.lookY > 0, 'vertical drag feeds lookY');

	const res = ctrl.up(1, 220, 312, false);
	assert.equal(res.shouldPlacePin, false);
});

test('TeleportTouchController handles 2-finger pinch zoom and pan without dropping a pin', () => {
	const ctrl = new TeleportTouchController();
	const input = createMobileInput();

	// 2-finger pinch spread -> zoom in (zoomFactor < 1)
	assert.equal(ctrl.down(1, 120, 260).multiTouchStarted, false);
	assert.equal(ctrl.down(2, 220, 260).multiTouchStarted, true);
	assert.equal(ctrl.isMultiTouch, true);

	ctrl.move(1, 90, 260, input, false);
	ctrl.move(2, 250, 260, input, false);
	assert.ok(input.zoomFactor < 1, `pinch spread zooms in (got ${input.zoomFactor})`);

	assert.equal(ctrl.up(1, 90, 260, false).shouldPlacePin, false);
	assert.equal(ctrl.up(2, 250, 260, false).shouldPlacePin, false);

	// 2-finger parallel drag -> camera pan (panX / panY)
	const panInput = createMobileInput();
	ctrl.down(3, 140, 260);
	ctrl.down(4, 240, 260);
	ctrl.move(3, 175, 295, panInput, false);
	ctrl.move(4, 275, 295, panInput, false);
	assert.ok(Math.hypot(panInput.panX, panInput.panY) > 0, 'two-finger drag pans camera');
	assert.equal(ctrl.up(3, 175, 295, false).shouldPlacePin, false);
	assert.equal(ctrl.up(4, 275, 295, false).shouldPlacePin, false);

	// After lifting both fingers, next clean single tap works again
	ctrl.down(5, 190, 310);
	assert.equal(ctrl.up(5, 192, 311, false).shouldPlacePin, true);
});

test('TeleportTouchController resets cleanly on pointercancel and suppresses pin drop after pin drag', () => {
	const ctrl = new TeleportTouchController();
	const input = createMobileInput();

	ctrl.down(10, 150, 240);
	ctrl.move(10, 180, 260, input, true); // Pin dragging: must NOT orbit camera
	assert.equal(input.lookX, 0);
	assert.equal(ctrl.up(10, 180, 260, true).shouldPlacePin, false);

	ctrl.down(11, 100, 100);
	ctrl.down(12, 200, 100);
	ctrl.cancel(11);
	ctrl.cancel(12);
	assert.equal(ctrl.pointerCount, 0);
	assert.equal(ctrl.isMultiTouch, false);
});

test('clampTeleportCardPosition keeps confirm card inside mobile portrait and landscape screens', () => {
	// Near left + top edge on 360x740 portrait phone -> clamped horizontally and flipped below pin
	const topLeft = clampTeleportCardPosition(20, 40, 360, 740, 250, 120);
	assert.equal(topLeft.placement, 'below');
	assert.ok(topLeft.left >= 137, `left edge clamped (${topLeft.left})`);
	assert.ok(topLeft.top >= 58 && topLeft.top <= 740 - 120 - 78);

	// Near right + middle on 360x740 portrait phone -> clamped inside right edge
	const rightMid = clampTeleportCardPosition(355, 420, 360, 740, 250, 120);
	assert.equal(rightMid.placement, 'above');
	assert.ok(rightMid.left <= 360 - 137, `right edge clamped (${rightMid.left})`);

	// Compact landscape phone 740x360
	const landscapeTop = clampTeleportCardPosition(370, 80, 740, 360, 250, 120);
	assert.equal(landscapeTop.placement, 'below');
	assert.ok(landscapeTop.top + 120 <= 360, 'card stays above bottom edge in landscape');
});

test('mobile Teleport Mode disables MobileControls overlay and wires touch gestures into TeleportPicker', () => {
	const mainSource = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
	const pickerSource = fs.readFileSync(path.join(ROOT, 'src/components/TeleportPicker.tsx'), 'utf8');

	assert.match(
		mainSource,
		/<MobileControls[\s\S]*?disabled=\{[^}]*teleportMode[^}]*\}/,
		'MobileControls steps aside during teleportMode so touch taps reach the 3D canvas',
	);
	assert.match(
		mainSource,
		/<TeleportPicker[\s\S]*?mobileInput=\{mobileInput\}/,
		'TeleportPicker receives mobileInput for touch camera orbit/pan/zoom during teleport mode',
	);
	assert.ok(mainSource.includes('<TeleportConfirmOverlay'), 'TeleportConfirmOverlay renders teleport-confirm-anchor for confirmation & cancel');
	assert.equal(mainSource.includes('<TeleportModeBanner'), false, 'Redundant TeleportModeBanner is removed');
	assert.ok(pickerSource.includes("dom.style.touchAction = 'none'"), 'Canvas disables browser touch scroll while picking');
	assert.ok(pickerSource.includes('pointercancel'), 'TeleportPicker handles pointercancel cleanly on mobile');
});
