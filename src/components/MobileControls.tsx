import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent } from 'react';
import { MobileGesture, type MobileInput, type MobileDirection } from '../game/mobileInput';

export function MobileControls({
	input,
	disabled,
	canJump = false,
	flying = false,
	onInteract,
}: {
	input: RefObject<MobileInput>;
	disabled: boolean;
	canJump?: boolean;
	flying?: boolean;
	onInteract: () => void;
}) {
	const gesture = useRef(new MobileGesture(input.current));
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [held, setHeld] = useState(false);
	const [sprinting, setSprinting] = useState(false);
	const [autoMove,setAutoMove]=useState<{direction:MobileDirection|null;speed:number}>({direction:null,speed:1});

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

	const syncAuto = useCallback(() => {
        const current=input.current;
        setAutoMove(old=>old.direction===current.autoDirection&&old.speed===current.moveScale?old:{direction:current.autoDirection,speed:current.moveScale});
        setHeld(current.active||gesture.current.pinching);
        if(current.autoDirection)updateKnob(current.right*30,-current.forward*30,true);
        else if(!current.active)updateKnob(0,0,false);
    },[input,updateKnob]);
    useEffect(()=>{
        if(disabled||(!held&&!autoMove.direction))return;
        let last=performance.now();
        const interval=setInterval(()=>{const now=performance.now();gesture.current.advanceTick(now-last);last=now;syncAuto();},50);
        return ()=>clearInterval(interval);
    },[disabled,held,autoMove.direction,syncAuto]);

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
        syncAuto();
	}, [input, updateKnob,syncAuto]);

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
        const tick=(e.target as HTMLElement).closest<HTMLElement>('[data-direction]')?.dataset.direction as MobileDirection|undefined;

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

        if(side==='left'&&tick)gesture.current.downTick(e.pointerId,tick,e.clientX,e.clientY,startX,startY);
        else gesture.current.down(e.pointerId, side, startX, startY, direction);
		e.currentTarget.setPointerCapture(e.pointerId);
		onInteract();

		if (side === 'left'&&!tick) {
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
        syncAuto();
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
        syncAuto();
	};

	const release = (e: PointerEvent<HTMLDivElement>) => {
        if((e.type==='pointercancel'||e.type==='lostpointercapture')&&gesture.current.fingers.has(e.pointerId)){
            gesture.current.stop();
        }else gesture.current.up(e.pointerId);
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
        syncAuto();
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
                    <div className="mobile-joystick-ring">
                        <div className="mobile-joystick-crosshair mobile-joystick-crosshair-v" />
                        <div className="mobile-joystick-crosshair mobile-joystick-crosshair-h" />
                        <div className="mobile-joystick-inner-ring" />
                        {(['up','right','down','left'] as const).map((direction,i)=><button
                            key={direction} type="button" data-direction={direction}
                            className={`mobile-joystick-tick mobile-joystick-tick-${direction}`}
                            aria-label={`${['ရှေ့','ညာ','နောက်','ဘယ်'][i]} · ဖိထားလျှင် Auto`}
                            aria-pressed={autoMove.direction===direction}
                            title="ဖိထားရန်: Auto · ထပ်ဖိထားရန်: အရှိန်တိုး · တစ်ချက်နှိပ်ရန်: ပုံမှန်အရှိန်"
                            onClick={e=>{if(e.detail===0){gesture.current.activateTick(direction);onInteract();syncAuto();}}}
                        >{['▲','▶','▼','◀'][i]}</button>)}
                    </div>
                    {autoMove.direction&&<>
                        <div className="mobile-auto-status" role="status">Auto · {autoMove.speed}×</div>
                        <button type="button" className="mobile-auto-stop" aria-label="Auto ရပ်မည်"
                            onPointerDown={e=>{e.preventDefault();e.stopPropagation();clear();gesture.current.stop();syncAuto();onInteract();}}
                            onClick={e=>{if(e.detail===0){clear();gesture.current.stop();syncAuto();onInteract();}}}>■</button>
                    </>}

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
			{canJump && <button type="button" className="mobile-sprint-btn mobile-jump-btn"
                aria-label="ခုန်ရန် (Space)" title="ခုန်ရန် · Space"
                onPointerDown={e => {e.preventDefault();e.stopPropagation();input.current.jump=true;onInteract();}}
                onClick={e => {if(e.detail===0){input.current.jump=true;onInteract();}}}>
                <div className="mobile-sprint-btn-inner">
                    <svg className="mobile-sprint-icon mobile-jump-icon" viewBox="0 0 100 100" width="36" height="36" aria-hidden="true">
                        {/* Trailing leg */}
                        <path d="M 40.7,45.6 L 40.0,47.1 L 39.6,48.9 L 39.1,50.5 L 38.1,51.6 L 36.7,52.3 L 35.0,52.7 L 33.1,52.8 L 31.1,52.7 L 28.9,52.5 L 26.8,52.3 L 24.8,52.1 L 23.0,52.1 L 21.4,52.3 L 20.2,52.8 L 19.4,53.6 L 19.0,54.8 L 19.1,56.2 L 19.5,57.6 L 20.2,59.0 L 21.2,60.1 L 22.5,60.9 L 23.9,61.6 L 25.6,62.0 L 27.3,62.3 L 29.2,62.3 L 31.2,62.2 L 33.2,61.9 L 35.1,61.3 L 37.1,60.6 L 38.9,59.8 L 40.7,58.7 L 42.3,57.5 L 43.7,56.2 L 44.9,54.6 L 45.8,53.0 L 46.5,51.4 L 47.0,49.8 L 47.2,48.4 L 47.2,47.2 L 47.0,46.4 L 45.9,45.7 L 44.2,45.1 L 42.2,45.0 L 40.7,45.6 Z" fill="currentColor" />
                        {/* Torso & Leading leg */}
                        <path d="M 53.2,16.4 L 53.6,19.6 L 53.2,23.1 L 50.7,24.0 L 47.2,23.7 L 44.1,24.6 L 41.7,27.0 L 40.0,30.5 L 39.2,34.5 L 39.4,38.6 L 40.5,42.0 L 42.6,44.0 L 45.8,44.5 L 49.5,44.0 L 53.6,43.0 L 57.7,41.9 L 61.4,41.4 L 64.6,41.8 L 67.5,43.1 L 70.3,45.4 L 73.2,48.2 L 76.4,50.5 L 79.8,51.3 L 82.6,49.9 L 82.4,47.5 L 80.0,44.7 L 77.2,42.1 L 74.0,39.7 L 70.8,37.8 L 67.6,36.4 L 64.5,35.6 L 61.2,35.5 L 57.4,36.0 L 53.0,36.9 L 49.0,37.6 L 47.0,37.4 L 47.9,36.3 L 51.1,35.4 L 54.3,33.7 L 56.3,30.7 L 57.3,27.1 L 58.1,23.4 L 57.8,20.0 L 55.4,17.1 L 53.2,16.4 Z" fill="currentColor" />
                        {/* Front arm */}
                        <path d="M 76.2,14.7 L 75.3,15.2 L 74.4,16.1 L 73.6,17.2 L 72.8,18.6 L 72.0,19.9 L 71.2,21.3 L 70.3,22.5 L 69.3,23.5 L 68.3,24.1 L 67.1,24.4 L 65.8,24.2 L 64.5,23.7 L 63.2,23.3 L 62.0,23.0 L 60.9,23.2 L 60.0,23.7 L 59.4,24.6 L 59.1,25.6 L 59.2,26.7 L 59.7,27.7 L 60.7,28.5 L 62.0,29.2 L 63.5,29.8 L 65.1,30.1 L 66.6,30.3 L 68.1,30.4 L 69.4,30.2 L 70.5,29.8 L 71.5,29.3 L 72.5,28.6 L 73.5,27.7 L 74.5,26.7 L 75.5,25.6 L 76.5,24.3 L 77.5,23.0 L 78.3,21.6 L 79.1,20.2 L 79.6,18.9 L 79.9,17.6 L 79.6,16.4 L 79.1,15.5 L 78.2,14.9 L 77.2,14.6 L 76.2,14.7 Z" fill="currentColor" />
                        {/* Back arm */}
                        <path d="M 39.4,11.3 L 38.1,11.7 L 36.8,12.4 L 35.6,13.4 L 34.4,14.6 L 33.0,15.9 L 31.5,17.3 L 30.0,18.6 L 28.5,20.0 L 27.3,21.4 L 26.3,22.7 L 25.7,23.9 L 25.6,25.0 L 26.1,26.0 L 27.2,26.7 L 28.5,27.1 L 29.9,26.7 L 31.2,25.8 L 32.5,24.4 L 33.7,22.8 L 34.9,21.1 L 36.1,19.6 L 37.3,18.3 L 38.5,17.6 L 39.8,17.5 L 41.0,18.0 L 42.3,19.1 L 43.7,20.3 L 45.1,21.4 L 46.6,22.2 L 48.1,22.5 L 49.5,22.5 L 50.8,22.2 L 51.7,21.6 L 52.2,20.7 L 52.2,19.6 L 51.6,18.4 L 50.7,17.1 L 49.5,15.8 L 48.0,14.6 L 46.3,13.5 L 44.5,12.5 L 42.7,11.8 L 41.0,11.4 L 39.4,11.3 Z" fill="currentColor" />
                        {/* Head */}
                        <circle cx="64.2" cy="13.2" r="6.6" fill="currentColor" />
                        {/* Hurdle: Front stand & foot */}
                        <path d="M 29.8,75.9 L 29.8,88.8 L 28.8,89.9 L 24.1,89.9 L 23.1,90.4 L 22.6,91.9 L 23.6,93.0 L 43.3,93.0 L 44.3,91.9 L 43.8,89.9 L 32.9,89.3 L 32.4,74.8 Z" fill="#38bdf8" />
                        {/* Hurdle: Rear stand & foot */}
                        <path d="M 53.6,65.0 L 53.6,79.0 L 52.1,80.5 L 46.9,80.5 L 45.9,81.1 L 45.9,82.6 L 46.9,83.6 L 66.6,83.1 L 66.0,80.5 L 57.2,80.0 L 56.7,78.5 L 56.2,64.0 Z" fill="#38bdf8" />
                        {/* Hurdle: Top bar */}
                        <path d="M 56.7,57.2 L 55.7,56.7 L 53.1,57.2 L 51.0,58.8 L 42.8,62.4 L 41.2,62.4 L 39.1,64.0 L 30.3,67.6 L 30.8,73.8 L 41.2,68.6 L 55.2,62.9 L 56.7,61.9 Z" fill="#38bdf8" />
                    </svg><span className="mobile-sprint-label">ခုန်</span>
                </div>
            </button>}
			{!flying && <button
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
			</button>}
		</div>
	);
}
