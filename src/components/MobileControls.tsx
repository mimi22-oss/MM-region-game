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
	const [sprinting, setSprinting] = useState(false);

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
		if (input.current) input.current.sprint = false;
		setHeld(false);
		setSprinting(false);
	}, [input, updateKnob]);

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
				aria-label="ပတ်ဝန်းကျင်ကြည့်ရန် ဆွဲရွှေ့ပါ"
				onPointerDown={(e) => down(e, 'right')}
				onPointerMove={move}
				onPointerUp={release}
				onPointerCancel={release}
				onLostPointerCapture={release}
			/>
			<button
				type="button"
				className={`mobile-sprint-btn${sprinting ? ' mobile-sprint-btn-active' : ''}`}
				aria-label="အမြန်ပြေးရန် ခလုတ် (ပြေး)"
				title="အမြန်ပြေးရန် ဖိထားပါ (ပြေး)"
				onPointerDown={(e) => {
					e.preventDefault();
					e.stopPropagation();
					try {
						e.currentTarget.setPointerCapture(e.pointerId);
					} catch {}
					if (input.current) input.current.sprint = true;
					setSprinting(true);
					onInteract();
				}}
				onPointerUp={(e) => {
					e.preventDefault();
					e.stopPropagation();
					try {
						e.currentTarget.releasePointerCapture(e.pointerId);
					} catch {}
					if (input.current) input.current.sprint = false;
					setSprinting(false);
				}}
				onPointerCancel={() => {
					if (input.current) input.current.sprint = false;
					setSprinting(false);
				}}
				onLostPointerCapture={() => {
					if (input.current) input.current.sprint = false;
					setSprinting(false);
				}}
			>
				<div className="mobile-sprint-btn-inner">
					<svg
						className="mobile-sprint-icon"
						viewBox="0 0 24 24"
						width="26"
						height="26"
						fill="currentColor"
						aria-hidden="true"
					>
						{/* Right footprint (forward stride) */}
						<g transform="translate(15.2, 8.2) rotate(16) scale(0.62)">
							<path d="M -0.5,5 C -2,5 -3.2,3.5 -3.2,1.5 C -3.2,-0.5 -1.8,-2 -1.5,-4 C -1.2,-5.8 -0.5,-7.5 1.5,-7.5 C 3.5,-7.5 4.5,-5.5 4.2,-3.5 C 4,-1.8 2.5,-0.2 2.2,1.5 C 1.8,3.5 1,5 -0.5,5 Z" />
							<circle cx="1.8" cy="-9.6" r="1.3" />
							<circle cx="0.1" cy="-9.0" r="1.0" />
							<circle cx="-1.4" cy="-8.1" r="0.85" />
							<circle cx="-2.7" cy="-7.0" r="0.75" />
							<circle cx="-3.8" cy="-5.6" r="0.65" />
						</g>
						{/* Left footprint (behind stride) */}
						<g transform="translate(8.8, 14.8) rotate(16) scale(0.62)">
							<path d="M 0.5,5 C 2,5 3.2,3.5 3.2,1.5 C 3.2,-0.5 1.8,-2 1.5,-4 C 1.2,-5.8 0.5,-7.5 -1.5,-7.5 C -3.5,-7.5 -4.5,-5.5 -4.2,-3.5 C -4,-1.8 -2.5,-0.2 -2.2,1.5 C -1.8,3.5 -1,5 0.5,5 Z" />
							<circle cx="-1.8" cy="-9.6" r="1.3" />
							<circle cx="-0.1" cy="-9.0" r="1.0" />
							<circle cx="1.4" cy="-8.1" r="0.85" />
							<circle cx="2.7" cy="-7.0" r="0.75" />
							<circle cx="3.8" cy="-5.6" r="0.65" />
						</g>
					</svg>
					<span className="mobile-sprint-label">ပြေး</span>
				</div>
			</button>
		</div>
	);
}
