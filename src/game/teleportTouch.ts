import type { MobileInput } from './mobileInput.ts';

export const TELEPORT_TAP_SLOP_MOUSE = 7;
export const TELEPORT_TAP_SLOP_TOUCH = 16;
export const TELEPORT_PIN_HIT_RADIUS_MOUSE = 75;
export const TELEPORT_PIN_HIT_RADIUS_TOUCH = 96;
export const TELEPORT_ORBIT_START_PX = TELEPORT_TAP_SLOP_TOUCH;

export function isTeleportTap(dx: number, dy: number, pointerType: string): boolean {
	const slop = pointerType === 'touch' ? TELEPORT_TAP_SLOP_TOUCH : TELEPORT_TAP_SLOP_MOUSE;
	return Math.hypot(dx, dy) <= slop;
}

export function teleportPinHitRadius(pointerType: string): number {
	return pointerType === 'touch' ? TELEPORT_PIN_HIT_RADIUS_TOUCH : TELEPORT_PIN_HIT_RADIUS_MOUSE;
}

export interface ClampedTeleportCardPosition {
	left: number;
	top: number;
	placement: 'above' | 'below';
}

/**
 * Clamp the floating teleport confirmation card inside the viewport so it never
 * clips off small mobile portrait or landscape screens.
 */
export function clampTeleportCardPosition(
	screenX: number,
	screenY: number,
	viewportW: number,
	viewportH: number,
	cardWidth = 250,
	cardHeight = 122,
): ClampedTeleportCardPosition {
	const marginX = 12;
	const safeW = Math.max(200, viewportW);
	const safeH = Math.max(200, viewportH);
	const halfW = Math.min(cardWidth / 2, Math.max(88, (safeW - marginX * 2) / 2));
	const left = Math.max(halfW + marginX, Math.min(safeW - halfW - marginX, screenX));

	const topSafeMargin = 58;
	const bottomBannerReserve = 78;
	const verticalOffset = 26;

	if (screenY - cardHeight - verticalOffset < topSafeMargin) {
		const maxBelowTop = Math.max(topSafeMargin, safeH - cardHeight - bottomBannerReserve);
		const top = Math.max(topSafeMargin, Math.min(maxBelowTop, screenY + verticalOffset));
		return { left, top, placement: 'below' };
	}

	const minAboveAnchorY = topSafeMargin + cardHeight + verticalOffset;
	const maxAboveAnchorY = Math.max(minAboveAnchorY, safeH - bottomBannerReserve);
	const top = Math.max(minAboveAnchorY, Math.min(maxAboveAnchorY, screenY));
	return { left, top, placement: 'above' };
}

type TouchPointer = {
	id: number;
	x: number;
	y: number;
	startX: number;
	startY: number;
};

/**
 * Coordinates mobile touch gestures on the 3D canvas while Teleport Mode is active:
 * - Single tap -> places / moves the teleport pin
 * - Single-finger drag away from pin -> orbits camera (lookX/lookY)
 * - Two-finger pinch / drag -> zooms (zoomFactor) or pans (panX/panY) without dropping a pin
 */
export class TeleportTouchController {
	private pointers = new Map<number, TouchPointer>();
	private hadMultiTouch = false;
	private orbiting = false;
	private cameraGesture: 'pan' | 'zoom' | null = null;
	private baseline = 0;
	private previous = 0;
	private originX = 0;
	private originY = 0;
	private centerX = 0;
	private centerY = 0;

	get pointerCount(): number {
		return this.pointers.size;
	}

	get isMultiTouch(): boolean {
		return this.hadMultiTouch || this.pointers.size >= 2;
	}

	reset(): void {
		this.pointers.clear();
		this.hadMultiTouch = false;
		this.orbiting = false;
		this.cameraGesture = null;
		this.baseline = 0;
		this.previous = 0;
	}

	down(id: number, x: number, y: number): { multiTouchStarted: boolean } {
		if (this.pointers.size >= 2 && !this.pointers.has(id)) {
			this.hadMultiTouch = true;
			return { multiTouchStarted: true };
		}
		this.pointers.set(id, { id, x, y, startX: x, startY: y });
		if (this.pointers.size === 2) {
			const [a, b] = [...this.pointers.values()];
			this.hadMultiTouch = true;
			this.orbiting = false;
			this.cameraGesture = null;
			this.baseline = this.previous = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
			this.originX = this.centerX = (a.x + b.x) / 2;
			this.originY = this.centerY = (a.y + b.y) / 2;
			a.startX = a.x;
			a.startY = a.y;
			b.startX = b.x;
			b.startY = b.y;
			return { multiTouchStarted: true };
		}
		return { multiTouchStarted: false };
	}

	move(
		id: number,
		x: number,
		y: number,
		input: MobileInput | null | undefined,
		isPinDragging: boolean,
	): 'camera' | 'idle' {
		const p = this.pointers.get(id);
		if (!p) return 'idle';
		const dx = x - p.x;
		const dy = y - p.y;
		p.x = x;
		p.y = y;

		if (this.pointers.size === 2) {
			if (!input) return 'camera';
			const [a, b] = [...this.pointers.values()];
			const distance = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
			const cx = (a.x + b.x) / 2;
			const cy = (a.y + b.y) / 2;
			const ax = a.x - a.startX;
			const ay = a.y - a.startY;
			const bx = b.x - b.startX;
			const by = b.y - b.startY;
			const spread = Math.abs(distance - this.baseline);
			const travel = Math.hypot(cx - this.originX, cy - this.originY);

			if (!this.cameraGesture) {
				const zoomIntent = spread > 10 && (ax * bx + ay * by <= 0 || spread > travel * 1.4);
				const panIntent = travel > 10;
				if (zoomIntent || panIntent) {
					this.cameraGesture = zoomIntent && (!panIntent || spread > travel * 1.3) ? 'zoom' : 'pan';
					if (this.cameraGesture === 'zoom') {
						this.previous = this.baseline + Math.sign(distance - this.baseline) * 10;
					} else {
						const deadZone = 10 / travel;
						this.centerX = this.originX + (cx - this.originX) * deadZone;
						this.centerY = this.originY + (cy - this.originY) * deadZone;
					}
				}
			}

			if (this.cameraGesture === 'zoom') {
				input.zoomFactor *= this.previous / distance;
			} else if (this.cameraGesture === 'pan') {
				input.panX += cx - this.centerX;
				input.panY += cy - this.centerY;
			}
			this.previous = distance;
			this.centerX = cx;
			this.centerY = cy;
			return 'camera';
		}

		if (this.pointers.size === 1 && !this.hadMultiTouch && !isPinDragging) {
			if (!this.orbiting && Math.hypot(x - p.startX, y - p.startY) > TELEPORT_ORBIT_START_PX) {
				this.orbiting = true;
			}
			if (this.orbiting && input) {
				input.lookX += dx;
				input.lookY += dy;
				return 'camera';
			}
		}

		return 'idle';
	}

	up(
		id: number,
		x: number,
		y: number,
		wasPinDragging: boolean,
	): { shouldPlacePin: boolean; remainingPointers: number } {
		const p = this.pointers.get(id);
		if (!p) {
			return { shouldPlacePin: false, remainingPointers: this.pointers.size };
		}
		this.pointers.delete(id);
		const remainingPointers = this.pointers.size;
		const shouldPlacePin =
			remainingPointers === 0 &&
			!this.hadMultiTouch &&
			!wasPinDragging &&
			!this.orbiting &&
			isTeleportTap(x - p.startX, y - p.startY, 'touch');

		if (remainingPointers === 0) {
			this.hadMultiTouch = false;
			this.orbiting = false;
			this.cameraGesture = null;
		}
		return { shouldPlacePin, remainingPointers };
	}

	cancel(id: number): void {
		this.pointers.delete(id);
		if (this.pointers.size === 0) {
			this.hadMultiTouch = false;
			this.orbiting = false;
			this.cameraGesture = null;
		}
	}
}
