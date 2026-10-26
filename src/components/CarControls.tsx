import { useEffect, useState, useRef, memo, type ReactNode } from 'react';
import { LifeMeter } from './LifeMeter';
import { carInput, clearCarInput, gearLabel, shiftCar, selectAutomaticRange, MAX_STEERING, STEERING_RATIO, type CarGear, type CarStatus } from '../game/carRide';
import { startCarSummon } from '../game/carSummon';

function SteeringWheel({ steering }: { steering: number }) {
	const drag = useRef<{ id: number; last: number; angle: number; cx: number; cy: number } | null>(null);
	const release = () => { drag.current = null; carInput.steer = 0; };
	return (
		<button
			type="button"
			className="car-steering-wheel"
			aria-label="စီယာတိုင် ဆွဲလှည့်ရန်"
			title="ဆွဲလှည့်ပါ · A / D"
			onPointerDown={event => {
				event.preventDefault();
				const box = event.currentTarget.getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height / 2;
				drag.current = { id: event.pointerId, last: Math.atan2(event.clientY - cy, event.clientX - cx), angle: steering * STEERING_RATIO, cx, cy };
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={event => {
				const state = drag.current;
				if (!state || state.id !== event.pointerId) return;
				const next = Math.atan2(event.clientY - state.cy, event.clientX - state.cx);
				state.angle = Math.max(-MAX_STEERING * STEERING_RATIO, Math.min(MAX_STEERING * STEERING_RATIO, state.angle + Math.atan2(Math.sin(next - state.last), Math.cos(next - state.last))));
				state.last = next;
				carInput.steer = state.angle / (MAX_STEERING * STEERING_RATIO);
			}}
			onPointerUp={release}
			onPointerCancel={release}
			onLostPointerCapture={release}
			onBlur={release}
			onKeyDown={event => {
				if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
					event.preventDefault();
					event.stopPropagation();
					carInput.steer = event.code === 'ArrowLeft' || event.code === 'KeyA' ? -1 : 1;
				}
			}}
			onKeyUp={event => {
				if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
					event.preventDefault();
					event.stopPropagation();
					release();
				}
			}}
		>
			<svg viewBox="0 0 80 80" aria-hidden="true" style={{ transform: `rotate(${steering * STEERING_RATIO}rad)` }}>
				<defs>
					<linearGradient id="wheelRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#475569" />
						<stop offset="50%" stopColor="#1e293b" />
						<stop offset="100%" stopColor="#0f172a" />
					</linearGradient>
					<linearGradient id="spokeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" stopColor="#94a3b8" />
						<stop offset="100%" stopColor="#475569" />
					</linearGradient>
				</defs>
				{/* Outer Wheel Rim */}
				<circle cx="40" cy="40" r="34" fill="none" stroke="url(#wheelRimGrad)" strokeWidth="8" />
				<circle cx="40" cy="40" r="37.5" fill="none" stroke="#64748b" strokeWidth="1" strokeOpacity="0.5" />
				<circle cx="40" cy="40" r="30.5" fill="none" stroke="#0f172a" strokeWidth="1" />
				{/* Top Centering Marker Strip */}
				<path d="M40 2.5V9.5" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />
				{/* Left & Right & Bottom Wheel Spokes */}
				<path d="M10 33L31 39M70 33L49 39M40 48V69" fill="none" stroke="url(#spokeGrad)" strokeWidth="6" strokeLinecap="round" />
				{/* Center Hub & Horn Pad */}
				<circle cx="40" cy="40" r="11" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
				<circle cx="40" cy="40" r="7" fill="#0f172a" />
				<circle cx="40" cy="40" r="3" fill="#f59e0b" />
			</svg>
			<div className="car-wheel-tag">
				<span>စီယာတိုင်</span>
				<small>A / D</small>
			</div>
		</button>
	);
}

function Hold({
	label,
	className = '',
	children,
	action,
}: {
	label: string;
	className?: string;
	children: ReactNode;
	action: (held: boolean) => void;
}) {
	const [held, setHeld] = useState(false);
	const pointer = useRef<number | null>(null), latestAction = useRef(action);
	latestAction.current = action;

	useEffect(() => {
		const release = () => { pointer.current = null; setHeld(false); latestAction.current(false); };
		const visibility = () => { if (document.hidden) release(); };
		window.addEventListener('blur', release);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			window.removeEventListener('blur', release);
			document.removeEventListener('visibilitychange', visibility);
			latestAction.current(false);
		};
	}, []);

	const change = (value: boolean) => { setHeld(value); action(value); };

	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={held}
			className={`car-orbit-btn ${className} ${held ? 'car-orbit-active is-held' : ''}`}
			onPointerDown={event => {
				event.preventDefault();
				pointer.current = event.pointerId;
				event.currentTarget.setPointerCapture(event.pointerId);
				change(true);
			}}
			onPointerUp={event => {
				if (pointer.current === event.pointerId) {
					pointer.current = null;
					change(false);
				}
			}}
			onPointerCancel={event => {
				if (pointer.current === event.pointerId) {
					pointer.current = null;
					change(false);
				}
			}}
			onLostPointerCapture={event => {
				if (pointer.current === event.pointerId) {
					pointer.current = null;
					change(false);
				}
			}}
			onKeyDown={event => {
				if (event.code === 'Space' || event.code === 'Enter') {
					event.preventDefault();
					event.stopPropagation();
					change(true);
				}
			}}
			onKeyUp={event => {
				if (event.code === 'Space' || event.code === 'Enter') {
					event.preventDefault();
					event.stopPropagation();
					change(false);
				}
			}}
			onBlur={() => {
				if (pointer.current === null) change(false);
			}}
		>
			{children}
		</button>
	);
}

export const CarControls = memo(function CarControls({ status }: { status: CarStatus }) {
 const automatic=status.transmission==='automatic';
	useEffect(() => {
		const release = () => clearCarInput();
		window.addEventListener('blur', release);
		const visibility = () => { if (document.hidden) release(); };
		document.addEventListener('visibilitychange', visibility);
		return () => {
			release();
			window.removeEventListener('blur', release);
			document.removeEventListener('visibilitychange', visibility);
		};
	}, []);

	if (!status.driving && !status.near && !status.canSummon && (!status.summonStatus || status.summonStatus === 'idle' || status.summonStatus === 'returning')) return null;

	return (
		<section className={`car-controls${status.driving ? ' car-controls-driving' : ''}`} aria-label="ကားမောင်း ထိန်းချုပ်မှု" onPointerDown={event => event.stopPropagation()}>
			{!status.driving ? (
				<>
					{status.near && (
						<p className="car-near-prompt" role="status">
							<span className="car-prompt-icon">🚗</span>
							<span>ကားတံခါးနား ရပ်လိုက်လျှင် ဝင်ထိုင်ပါမည်…</span>
						</p>
					)}
					{!status.near && (status.canSummon || (status.summonStatus && status.summonStatus !== 'idle' && status.summonStatus !== 'returning')) && (
						<div className="car-summon-card" role="region" aria-label="ကားခေါ်ယူမှု">
							{(!status.summonStatus || status.summonStatus === 'idle') && (
								<div className="car-summon-row">
									<span className="car-summon-prompt-icon">🚗</span>
									<span className="car-summon-text">ကားခေါ်မည်</span>
									<button
										type="button"
										className="car-summon-btn"
										onClick={() => startCarSummon()}
										aria-label="ကားခေါ်မည်"
										title="main လမ်းမကြီးရှေ့သို့ ကားခေါ်မည်"
									>
										<span>📞 ခေါ်မည်</span>
									</button>
								</div>
							)}
							{status.summonStatus === 'driving' && (
								<div className="car-summon-row car-summon-active">
									<span className="car-summon-spinner" aria-hidden="true" />
									<span className="car-summon-text">🚗 ကားလေး လာနေပါပြီ ခဏစောင့်ပါ…</span>
								</div>
							)}
							{status.summonStatus === 'arrived' && (
								<div className="car-summon-row car-summon-arrived">
									<span className="car-summon-arrived-icon" aria-hidden="true">✅</span>
									<span className="car-summon-text">ကား လမ်းမကြီးရှေ့သို့ ရောက်ရှိပါပြီ!</span>
								</div>
							)}
						</div>
					)}
				</>
			) : (
				<>
					{/* ၁။ ဘယ်ဘက် စတီယာရင်ခွေ (Steering Wheel on Left for Laptop / Desktop) */}
					<div className="car-steering-panel">
						<SteeringWheel steering={status.steering} />
					</div>

					{/* ၂။ အပေါ်ညာဘက် floating HUD: အမြန်နှုန်းနှင့် RPM (Top-Right HUD below location-actions & settings-wrap, like motorcycle) */}
					<div className="car-dashboard" aria-live="polite">
						<span className="car-speedo-icon" aria-hidden="true">🚗</span>
						<div className="car-speedo-badge">
							<strong className="car-speedo-kmh">{Math.abs(status.kmh)}</strong>
							<small className="car-speedo-unit">km/h</small>
						</div>
						<span className={`car-gear-readout car-gear-readout-${status.gear === -1 ? 'r' : status.gear === 0 ? 'n' : 'fwd'}`} aria-label={`ဂီယာ ${automatic?(status.automaticRange==='D'?`D${status.gear}`:status.automaticRange):gearLabel(status.gear)}`}>
							{automatic?(status.automaticRange==='D'?`D${status.gear}`:status.automaticRange):gearLabel(status.gear)}
						</span>
						<span className="car-rpm-badge">
							{status.rpm.toLocaleString()} <small>RPM</small>
						</span>
						<span className="ride-orbit-lives"><LifeMeter lives={status.lives ?? 3}/></span>
					</div>

					{/* ၃။ မျက်နှာပြင် အလယ်အောက် လမ်းညွှန်ချက် (Center-Bottom Instruction Floating Pill) */}
					<div className={`car-instruction${status.notice ? ' car-instruction-alert' : ''}`} role="status">
						<span className="car-instruction-dot" />
						<span>
							{status.notice || (automatic?'ဘရိတ်ဖိ → D (1) / R → ဘရိတ်လွှတ် → W လီဗာ · N လွတ်ဂီယာ':status.clutch
								? 'ကလပ်ဖိထားသည် · ဂီယာရွေးပြီး ကလပ်လွှတ်ပါ'
								: status.gear === 0
									? 'ကလပ်ဖိ → ဂီယာ 1 → ကလပ်လွှတ် → လီဗာ'
									: 'W လီဗာ · A/D ကွေ့ · Space ဘရိတ် · C ကလပ် · V မြင်ကွင်း')}
						</span>
					</div>

					{/* ၃။ စတီယာရင်ခွေ အပေါ်ရှိ အဝိုက်ပုံ ဂီယာခလုတ်များ (Upper Arc: R, N | Lower Arc: 1, 2, 3, 4) */}
                    {automatic?<div className="car-shifter-panel car-auto-selector" aria-label="Auto ဂီယာ">{(['P','R','N','D'] as const).map(range=><button type="button" key={range} aria-pressed={status.automaticRange===range} onPointerDown={event=>{event.preventDefault();selectAutomaticRange(range);}} onClick={event=>{if(event.detail===0)selectAutomaticRange(range);}}>{range}</button>)}</div>:<>
					<div className="car-shifter-panel" aria-label="ဂီယာရွေးရန်">
						<div className="car-gearbox car-gearbox-arc">
							{/* အပေါ်အဝိုက် circle: R, N (Upper Arc above 1, 2, 3, 4) */}
							<div className="car-gear-arc car-gear-arc-upper" aria-label="R နှင့် N ဂီယာများ">
								{([-1, 0] as CarGear[]).map(gear => (
									<button
										type="button"
										key={gear}
										className={`car-gear-knob car-gear-${gear === -1 ? 'r' : 'n'}`}
										aria-pressed={status.gear === gear}
										title={`ဂီယာ ${gearLabel(gear)}`}
										onPointerDown={event => {
											event.preventDefault();
											shiftCar(gear, status.clutch || carInput.clutch);
										}}
										onClick={event => {
											if (event.detail === 0) shiftCar(gear, status.clutch || carInput.clutch);
										}}
									>
										<span>{gearLabel(gear)}</span>
									</button>
								))}
							</div>

							{/* အောက်အဝိုက် circle: 1, 2, 3, 4 (Lower Arc directly above steering wheel) */}
							<div className="car-gear-arc car-gear-arc-lower" aria-label="ရှေ့သို့ ဂီယာများ ၁၊ ၂၊ ၃၊ ၄">
								{([1, 2, 3, 4] as CarGear[]).map(gear => (
									<button
										type="button"
										key={gear}
										className={`car-gear-knob car-gear-fwd-${gear}`}
										aria-pressed={status.gear === gear}
										title={`ဂီယာ ${gearLabel(gear)}`}
										onPointerDown={event => {
											event.preventDefault();
											shiftCar(gear, status.clutch || carInput.clutch);
										}}
										onClick={event => {
											if (event.detail === 0) shiftCar(gear, status.clutch || carInput.clutch);
										}}
									>
										<span>{gearLabel(gear)}</span>
									</button>
								))}
							</div>
						</div>
					</div>

                    </>}
					{/* ၄။ ညာဘက် အစုအဝိုင်းပုံစံ ကားမောင်းခလုတ်များ (Circular Orbit Cluster: Clutch, Brake, Throttle) */}
					<div className="car-pedals" aria-label="ကားမောင်း ခြေနင်းခလုတ်များ">
						{/* ကလပ် (Clutch Orbit Button) */}
						{!automatic&&<Hold label="ကလပ်" className="car-orbit-clutch" action={held => { carInput.clutch = held; }}>
							<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<circle cx="12" cy="12" r="9" strokeDasharray="4 2" />
								<circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity="0.25" />
								<path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
							</svg>
							<span className="car-orbit-tag">ကလပ်</span>
							<small className="car-orbit-key">C</small>
						</Hold>}

						{/* ဘရိတ် (Brake Orbit Button) */}
						<Hold label="ဘရိတ်" className="car-orbit-brake" action={held => { carInput.brake = held; }}>
							<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<circle cx="12" cy="12" r="8" />
								<path d="M12 7.5v6M12 16.5h.01" />
								<path d="M4 8a9.5 9.5 0 0 0 0 8M20 8a9.5 9.5 0 0 1 0 8" />
							</svg>
							<span className="car-orbit-tag">ဘရိတ်</span>
							<small className="car-orbit-key">Space</small>
						</Hold>

						{/* လီဗာ (Throttle / Accelerator Orbit Button) */}
						<Hold label="လီဗာ" className="car-orbit-throttle" action={held => { carInput.throttle = held; }}>
							<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<polyline points="7 14 12 9 17 14" />
								<polyline points="7 19 12 14 17 19" />
								<line x1="12" y1="5" x2="12" y2="9" />
							</svg>
							<span className="car-orbit-tag">လီဗာ</span>
							<small className="car-orbit-key">W</small>
						</Hold>
					</div>

					{/* ၅။ ကင်မရာ / မြင်ကွင်း ပြောင်းရန် စက်ဝိုင်းပုံခလုတ် (Circular Camera / View Toggle directly above car-exit-btn) */}
					<button
						type="button"
						className={`car-view-btn${status.first ? ' car-view-btn-interior' : ''}`}
						onClick={() => {
							document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
						}}
						aria-label="မြင်ကွင်းပြောင်းမည် (View Toggle · V)"
						title="မြင်ကွင်းပြောင်းမည် (အတွင်းခန်း / အပြင်ဘက် · V)"
					>
						<svg
							viewBox="0 0 24 24"
							width="20"
							height="20"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
							<circle cx="12" cy="13" r="4" />
						</svg>
						<span className="car-view-tag">မြင်ကွင်း</span>
						<small className="car-view-key">V</small>
					</button>

					{/* ၆။ ကားမှဆင်းမည် စက်ဝိုင်းပုံခလုတ် (Circular Exit Button directly above car-pedals) */}
					<button
						type="button"
						className="car-exit-btn"
						onClick={() => { carInput.exit = true; }}
						aria-label="ကားမှဆင်းမည် (Exit)"
						title="ကားမှဆင်းမည် (Exit · E)"
					>
						<svg
							viewBox="0 0 24 24"
							width="20"
							height="20"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.3"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
							<polyline points="16 17 21 12 16 7" />
							<line x1="21" y1="12" x2="9" y2="12" />
						</svg>
						<span className="car-exit-tag">ဆင်း</span>
						<small className="car-exit-key">E</small>
					</button>
				</>
			)}
		</section>
	);
});
