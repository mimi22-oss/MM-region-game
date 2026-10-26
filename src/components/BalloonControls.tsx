import { useEffect, useState, memo } from 'react';
import { balloonInput, clearBalloonInput, type BalloonStatus } from '../game/balloonRide';

export const BalloonControls = memo(function BalloonControls({
	status,
	paused,
	onTopView,
	onZoom,
}: {
	status: BalloonStatus;
	paused: boolean;
	onTopView: () => void;
	onZoom: (direction: number) => void;
}) {
	const [liftActive, setLiftActive] = useState<number>(0);

	useEffect(() => {
		clearBalloonInput();
		return clearBalloonInput;
	}, [paused, status.riding]);

	useEffect(() => {
		const clear = () => {
			clearBalloonInput();
			setLiftActive(0);
		};
		window.addEventListener('blur', clear);
		document.addEventListener('visibilitychange', clear);
		return () => {
			window.removeEventListener('blur', clear);
			document.removeEventListener('visibilitychange', clear);
		};
	}, []);

	if (paused || !status.riding) return null;

	const startLift = (lift: number, e: React.PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch { }
		balloonInput.lift = lift;
		setLiftActive(lift);
	};

	const stopLift = (e?: React.PointerEvent) => {
		if (e) {
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch { }
		}
		balloonInput.lift = 0;
		setLiftActive(0);
	};

	const canExit = status.grounded && status.kmh <= 2;

	return (
		<section className="balloon-controls-layer" aria-label="Balloon ထိန်းချုပ်မှု" onPointerDown={e => e.stopPropagation()}>
			{/* ၁။ အပေါ်ညာဘက် floating HUD: အမြန်နှုန်း၊ အမြင့်၊ မြေပြင်အခြေအနေ */}
			<div className="balloon-dashboard" aria-live="polite">
				<span className="balloon-speedo-icon" aria-hidden="true">🎈</span>
				<div className="balloon-speedo-badge">
					<strong className="balloon-speedo-kmh">{Math.abs(status.kmh)}</strong>
					<small className="balloon-speedo-unit">km/h</small>
				</div>
				<div className="balloon-alt-badge">
					<span className="balloon-alt-label">အမြင့်</span>
					<strong className="balloon-alt-val">{status.altitude}</strong>
					<small className="balloon-alt-unit">m</small>
				</div>
				<span
					className={`balloon-grounded-badge balloon-grounded-${status.grounded ? 'yes' : 'flight'}`}
					title={status.grounded ? 'မြေပြင်ပေါ်' : 'လေထဲတွင်'}
					aria-label={status.grounded ? 'မြေပြင်ပေါ်' : 'လေထဲတွင်'}
				>
					{status.grounded ? (
						<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<line x1="12" y1="3" x2="12" y2="10" />
							<line x1="5" y1="10" x2="19" y2="10" />
							<line x1="8" y1="14" x2="16" y2="14" />
							<line x1="11" y1="18" x2="13" y2="18" />
						</svg>
					) : (
						<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
							<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
						</svg>
					)}
				</span>
			</div>

			{/* အတားအဆီး သတိပေးချက် Chat Ribbon (Character Head Chat Bubble) */}
			{status.blocked && (
				<div className="balloon-notice-pill balloon-chat-ribbon" role="status">
					<span className="balloon-notice-dot" aria-hidden="true" />
					<span className="balloon-chat-ribbon-badge">သတိပေးချက်</span>
					<span className="balloon-chat-ribbon-text">ရှေ့တွင် အတားအဆီးရှိသည် — အမြင့်တင်ပြီး ကျော်ပါ</span>
				</div>
			)}

			{/* ၂။ Joystick ဝန်းကျင် Ring ပုံစံ ထိန်းချုပ်ခလုတ် ၃ ခု (Auto Return, Up, Down) */}
			<div className="balloon-joystick-ring-cluster" aria-label="Joystick ဝန်းကျင် Ring ခလုတ်များ">
				{/* အလှဆင် Circular Ring Track Arc */}
				<div className="balloon-joystick-ring-track" aria-hidden="true" />

				{/* Auto Return Button (ဘောလုံးကွင်းဆီ ၂ဆအမြန်နှုန်းဖြင့် အလိုအလျောက်ပြန်မည်) - Ring 110° */}
				<button
					type="button"
					className={`balloon-orbit-btn balloon-btn-autoreturn${status.autoReturn ? ' balloon-orbit-active balloon-autoreturn-pulse' : ''}`}
					onClick={() => {
						balloonInput.toggleAutoReturn = true;
					}}
					aria-label="ဘောလုံးကွင်းဆီ ၂ဆအမြန်နှုန်းဖြင့် Auto Return (R)"
					title="ဘောလုံးကွင်းဆီ ၂ဆအမြန်နှုန်းဖြင့် Auto Return (R)"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
						<path d="M3 3v5h5" />
					</svg>
					<span className="balloon-orbit-tag">{status.autoReturn ? `${status.returnDist}m` : 'Auto Ret'}</span>
				</button>

				{/* ↑ တက် (Ascend Pedal) - Ring 60° */}
				<button
					type="button"
					className={`balloon-orbit-btn balloon-btn-up${liftActive === 1 ? ' balloon-orbit-active' : ''}`}
					onPointerDown={e => startLift(1, e)}
					onPointerUp={stopLift}
					onPointerCancel={stopLift}
					onLostPointerCapture={stopLift}
					aria-label="အပေါ်တက်ရန် ဖိထားပါ (↑)"
					title="အပေါ်တက်ရန် ဖိထားပါ (↑)"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<polyline points="18 15 12 9 6 15" />
					</svg>
					<span className="balloon-orbit-tag">တက်</span>
				</button>

				{/* ↓ ဆင်း (Descend Pedal) - Ring 10° */}
				<button
					type="button"
					className={`balloon-orbit-btn balloon-btn-down${liftActive === -1 ? ' balloon-orbit-active' : ''}`}
					onPointerDown={e => startLift(-1, e)}
					onPointerUp={stopLift}
					onPointerCancel={stopLift}
					onLostPointerCapture={stopLift}
					aria-label="အောက်ဆင်းရန် ဖိထားပါ (↓)"
					title="အောက်ဆင်းရန် ဖိထားပါ (↓)"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<polyline points="6 9 12 15 18 9" />
					</svg>
					<span className="balloon-orbit-tag">ဆင်း</span>
				</button>
			</div>

			{/* ၃။ မျက်နှာပြင် ညာဘက်အောက်ရှိ Orbital Cluster (Center: ဆင်းမည်, Orbit: Zoom-Out, Zoom-In, Top, View, Stop) */}
			<div className="balloon-right-ring-cluster" aria-label="Balloon ညာဘက်လက် Orbital Cluster">
				{/* အလှဆင် Orbital Ring Track Arc */}
				<div className="balloon-right-ring-track" aria-hidden="true" />

				{/* ဗဟိုခလုတ်: Exit Button in place of mobile-sprint-btn (Balloon မှဆင်းမည်) */}
				<button
					type="button"
					className={`balloon-orbit-btn balloon-return-btn${!canExit ? ' balloon-return-btn-disabled' : ''}`}
					onClick={() => {
						if (canExit) balloonInput.exit = true;
					}}
					aria-label={canExit ? "Balloon မှဆင်းမည် (E)" : "ဆင်းရန် မြေပြင်ပေါ်သို့ အရင်ဆင်းသက်ပါ"}
					title={canExit ? "Balloon မှဆင်းမည် (E)" : "မြေပြင်ပေါ်သို့ ရောက်မှ ဆင်းနိုင်ပါမည်"}
				>
					<div className="balloon-orbit-inner">
						<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M9 14L4 9l5-5" />
							<path d="M4 9h11a5 5 0 0 1 5 5v2" />
						</svg>
						<span className="balloon-orbit-tag">ထွက်</span>
					</div>
				</button>

				{/* + အဝေး (Zoom Out) */}
				<button
					type="button"
					className="balloon-orbit-btn balloon-btn-zoom-out"
					onClick={() => onZoom(1)}
					aria-label="Zoom အဝေးကြည့်ရန် (+)"
					title="Zoom အဝေး (+)"
				>
					<span style={{ fontSize: '15px', fontWeight: 'bold', lineHeight: 1 }}>+</span>
					<span className="balloon-orbit-tag">အဝေး</span>
				</button>

				{/* − အနီး (Zoom In) */}
				<button
					type="button"
					className="balloon-orbit-btn balloon-btn-zoom-in"
					onClick={() => onZoom(-1)}
					aria-label="Zoom အနီးကပ်ကြည့်ရန် (−)"
					title="Zoom အနီးကပ် (−)"
				>
					<span style={{ fontSize: '15px', fontWeight: 'bold', lineHeight: 1 }}>−</span>
					<span className="balloon-orbit-tag">အနီး</span>
				</button>

				{/* အပေါ်မှကြည့် (Top-down aerial view toggle) */}
				<button
					type="button"
					className="balloon-orbit-btn balloon-btn-top"
					onClick={onTopView}
					aria-label="အပေါ်တည့်တည့်မှ ကြည့်ရန် (T)"
					title="အပေါ်တည့်တည့် မြင်ကွင်း (T)"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<polygon points="12 2 2 7 12 12 22 7 12 2" />
						<polyline points="2 17 12 22 22 17" />
						<polyline points="2 12 12 17 22 12" />
					</svg>
					<span className="balloon-orbit-tag">အပေါ်</span>
				</button>

				{/* အတွင်း/အပြင် မြင်ကွင်း (Cockpit/Exterior view toggle) */}
				<button
					type="button"
					className="balloon-orbit-btn balloon-btn-view"
					onClick={() => {
						balloonInput.toggleView = true;
					}}
					aria-label="အတွင်း/အပြင် မြင်ကွင်း (V)"
					title="အတွင်း/အပြင် မြင်ကွင်း ပြောင်းရန် (V)"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
					<span className="balloon-orbit-tag">အတွင်း</span>
				</button>

				{/* ⏸ ရပ် (Hover / Pause cruise / Stop) */}
				<button
					type="button"
					className={`balloon-orbit-btn balloon-btn-stop${status.autoCruise || status.autoReturn ? ' balloon-orbit-active' : ''}`}
					onClick={() => {
						balloonInput.stopCruise = true;
					}}
					aria-label="ခေတ္တရပ်မည် (Space)"
					title="ခေတ္တရပ်မည် (Space)"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
						<rect x="6" y="5" width="4" height="14" rx="1" />
						<rect x="14" y="5" width="4" height="14" rx="1" />
					</svg>
					<span className="balloon-orbit-tag">ရပ်</span>
				</button>
			</div>
		</section>
	);
});
