import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent } from 'react';
import { MobileGesture, type MobileInput } from '../game/mobileInput';

export function MobileControls({
	input,
	disabled,
	onInteract,
}: {
	input: RefObject<MobileInput>;
	disabled: boolean;
	onInteract: () => void;
}) {
	const gesture = useRef(new MobileGesture(input.current));
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [held, setHeld] = useState(false);

	const baseRef = useRef<HTMLDivElement | null>(null);
	const knobRef = useRef<HTMLDivElement | null>(null);
	const activePointerId = useRef<number | null>(null);
	const joystickAnchor = useRef<{ cx: number; cy: number } | null>(null);

	const updateKnob = useCallback((dx: number, dy: number, active: boolean) => {
		if (!knobRef.current) return;
		if (!active) {
			knobRef.current.style.transition = 'transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
			knobRef.current.style.transform = 'translate(0px, 0px)';
			return;
		}
		const MAX_RADIUS = 38;
		const dist = Math.hypot(dx, dy);
		const clamped = Math.min(dist, MAX_RADIUS);
		const kx = dist > 0 ? (dx / dist) * clamped : 0;
		const ky = dist > 0 ? (dy / dist) * clamped : 0;
		knobRef.current.style.transition = 'none';
		knobRef.current.style.transform = `translate(${kx.toFixed(1)}px, ${ky.toFixed(1)}px)`;
	}, []);

	const clear = useCallback(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		activePointerId.current = null;
		joystickAnchor.current = null;
		updateKnob(0, 0, false);
		gesture.current.clear();
		setHeld(false);
	}, [updateKnob]);

	useEffect(() => {
		clear();
		const visibility = () => {
			if (document.hidden) clear();
		};
		const media = matchMedia('(max-width: 760px), (hover: none) and (pointer: coarse)');
		const changed = () => {
			if (!media.matches) clear();
		};
		window.addEventListener('blur', clear);
		document.addEventListener('visibilitychange', visibility);
		media.addEventListener('change', changed);
		return () => {
			clear();
			window.removeEventListener('blur', clear);
			document.removeEventListener('visibilitychange', visibility);
			media.removeEventListener('change', changed);
		};
	}, [disabled, clear]);

	const down = (e: PointerEvent<HTMLDivElement>, side: 'left' | 'right') => {
		if (disabled || e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();

		let startX = e.clientX;
		let startY = e.clientY;
		let direction = 'up';

		if (side === 'left') {
			activePointerId.current = e.pointerId;
			if (baseRef.current) {
				const rect = baseRef.current.getBoundingClientRect();
				const cx = rect.left + rect.width / 2;
				const cy = rect.top + rect.height / 2;
				const dFromCenter = Math.hypot(e.clientX - cx, e.clientY - cy);
				if (dFromCenter <= rect.width * 0.75) {
					startX = cx;
					startY = cy;
					joystickAnchor.current = { cx, cy };
					const dx = e.clientX - cx;
					const dy = e.clientY - cy;
					if (Math.hypot(dx, dy) >= 10) {
						direction =
							Math.abs(dx) > Math.abs(dy)
								? dx > 0
									? 'right'
									: 'left'
								: dy > 0
									? 'down'
									: 'up';
					}
				} else {
					joystickAnchor.current = { cx: e.clientX, cy: e.clientY };
				}
			} else {
				joystickAnchor.current = { cx: e.clientX, cy: e.clientY };
			}
		}

		gesture.current.down(e.pointerId, side, startX, startY, direction);
		e.currentTarget.setPointerCapture(e.pointerId);
		onInteract();

		if (side === 'left') {
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			updateKnob(dx, dy, true);
			if (Math.hypot(dx, dy) >= 10) {
				gesture.current.move(e.pointerId, e.clientX, e.clientY);
			} else if (!timer.current) {
				timer.current = setTimeout(() => {
					timer.current = null;
					gesture.current.hold();
					setHeld(input.current.active);
				}, 220);
			}
		}
		setHeld(input.current.active);
	};

	const move = (e: PointerEvent<HTMLDivElement>) => {
		e.preventDefault();
		gesture.current.move(e.pointerId, e.clientX, e.clientY);
		if (e.pointerId === activePointerId.current && joystickAnchor.current) {
			const dx = e.clientX - joystickAnchor.current.cx;
			const dy = e.clientY - joystickAnchor.current.cy;
			updateKnob(dx, dy, true);
		}
		setHeld(input.current.active || gesture.current.pinching);
	};

	const release = (e: PointerEvent<HTMLDivElement>) => {
		gesture.current.up(e.pointerId);
		if (e.pointerId === activePointerId.current) {
			activePointerId.current = null;
			joystickAnchor.current = null;
			updateKnob(0, 0, false);
		}
		if (!gesture.current.fingers.size && timer.current) {
			clearTimeout(timer.current);
			timer.current = null;
		}
		setHeld(input.current.active || gesture.current.pinching);
	};

	if (disabled) return null;

	return (
		<div
			className={`mobile-controls${held ? ' mobile-controls-held' : ''}`}
			onContextMenu={(e) => e.preventDefault()}
		>
			<div
				className="mobile-move-zone"
				onPointerDown={(e) => down(e, 'left')}
				onPointerMove={move}
				onPointerUp={release}
				onPointerCancel={release}
				onLostPointerCapture={release}
			>
				<div
					ref={baseRef}
					className={`mobile-joystick mobile-direction-pad${held ? ' mobile-joystick-active' : ''}`}
					aria-label="360 ဒီဂရီ လမ်းကြောင်း ထိန်းချုပ် Joystick"
				>
					<div className="mobile-joystick-ring" aria-hidden="true">
						<div className="mobile-joystick-crosshair mobile-joystick-crosshair-v" />
						<div className="mobile-joystick-crosshair mobile-joystick-crosshair-h" />
						<div className="mobile-joystick-inner-ring" />
						<span className="mobile-joystick-tick mobile-joystick-tick-up" data-direction="up">
							▲
						</span>
						<span
							className="mobile-joystick-tick mobile-joystick-tick-right"
							data-direction="right"
						>
							▶
						</span>
						<span className="mobile-joystick-tick mobile-joystick-tick-down" data-direction="down">
							▼
						</span>
						<span className="mobile-joystick-tick mobile-joystick-tick-left" data-direction="left">
							◀
						</span>
					</div>

					<div ref={knobRef} className="mobile-joystick-knob" aria-hidden="true">
						<div className="mobile-joystick-knob-core" />
					</div>
				</div>
			</div>
			<div
				className="mobile-run-zone"
				aria-label="အမြန်ပြေးရန် ဖိထားပါ၊ ပတ်ဝန်းကျင်ကြည့်ရန် ဆွဲရွှေ့ပါ"
				onPointerDown={(e) => down(e, 'right')}
				onPointerMove={move}
				onPointerUp={release}
				onPointerCancel={release}
				onLostPointerCapture={release}
			/>
		</div>
	);
}
