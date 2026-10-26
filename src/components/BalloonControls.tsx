import { useEffect, useState } from 'react';
import { balloonInput, clearBalloonInput, type BalloonStatus } from '../game/balloonRide';

export function BalloonControls({
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
		} catch {}
		balloonInput.lift = lift;
		setLiftActive(lift);
	};

	const stopLift = (e?: React.PointerEvent) => {
		if (e) {
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {}
		}
		balloonInput.lift = 0;
		setLiftActive(0);
	};

	const canExit = status.grounded && status.kmh <= 2;

	return (
		<section className="balloon-controls-layer" aria-label="Balloon ထိန်းချုပ်မှု" onPointerDown={e => e.stopPropagation()}>
			{/* ၁။ အပေါ်ညာဘက် floating HUD: အမြန်နှုန်း၊ အမြင့်နှင့် မြေပြင်အခြေအနေ (Top-Right Dashboard like car-dashboard / car-speedo-badge) */}
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
				<span className={`balloon-grounded-badge balloon-grounded-${status.grounded ? 'yes' : 'flight'}`}>
					{status.grounded ? 'မြေပြင်ပေါ်' : 'လေထဲတွင်'}
				</span>
			</div>

			{/* အတားအဆီး သတိပေးချက် Notice pill */}
			{status.blocked && (
				<div className="balloon-notice-pill" role="status">
					<span className="balloon-notice-dot" />
					<span>ရှေ့တွင် အတားအဆီးရှိသည် — အမြင့်တင်ပြီး ကျော်ပါ</span>
				</div>
			)}

			{/* ၂။ မျက်နှာပြင် ညာဘက်အောက်ရှိ အကွေးပုံ ထိန်းချုပ်ခလုတ်များ (Curved Orbit Pedals Cluster & Return Button) */}
			<div className="balloon-mobile-controls" aria-label="Balloon ညာဘက်လက် ထိန်းချုပ်ခလုတ်များ">
				{/* Return / Exit Button in place of mobile-sprint-btn */}
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
						<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M9 14L4 9l5-5"/>
							<path d="M4 9h11a5 5 0 0 1 5 5v2"/>
						</svg>
						<span className="balloon-orbit-tag">ဆင်းမည်</span>
					</div>
				</button>

				{/* ↑ တက် (Ascend Pedal) */}
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
					<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<polyline points="18 15 12 9 6 15"/>
					</svg>
					<span className="balloon-orbit-tag">တက်</span>
				</button>

				{/* ↓ ဆင်း (Descend Pedal) */}
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
					<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<polyline points="6 9 12 15 18 9"/>
					</svg>
					<span className="balloon-orbit-tag">ဆင်း</span>
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
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
						<circle cx="12" cy="12" r="3"/>
					</svg>
					<span className="balloon-orbit-tag">အတွင်း</span>
				</button>

				{/* အပေါ်မှကြည့် (Top-down aerial view toggle) */}
				<button
					type="button"
					className="balloon-orbit-btn balloon-btn-top"
					onClick={onTopView}
					aria-label="အပေါ်တည့်တည့်မှ ကြည့်ရန် (T)"
					title="အပေါ်တည့်တည့် မြင်ကွင်း (T)"
				>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<polygon points="12 2 2 7 12 12 22 7 12 2"/>
						<polyline points="2 17 12 22 22 17"/>
						<polyline points="2 12 12 17 22 12"/>
					</svg>
					<span className="balloon-orbit-tag">အပေါ်</span>
				</button>

				{/* − အနီး (Zoom In) */}
				<button
					type="button"
					className="balloon-orbit-btn balloon-btn-zoom-in"
					onClick={() => onZoom(-1)}
					aria-label="Zoom အနီးကပ်ကြည့်ရန် (−)"
					title="Zoom အနီးကပ် (−)"
				>
					<span style={{ fontSize: '16px', fontWeight: 'bold', lineHeight: 1 }}>−</span>
					<span className="balloon-orbit-tag">အနီး</span>
				</button>

				{/* + အဝေး (Zoom Out) */}
				<button
					type="button"
					className="balloon-orbit-btn balloon-btn-zoom-out"
					onClick={() => onZoom(1)}
					aria-label="Zoom အဝေးကြည့်ရန် (+)"
					title="Zoom အဝေး (+)"
				>
					<span style={{ fontSize: '16px', fontWeight: 'bold', lineHeight: 1 }}>+</span>
					<span className="balloon-orbit-tag">အဝေး</span>
				</button>
			</div>
		</section>
	);
}
