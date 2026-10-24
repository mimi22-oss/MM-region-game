import { useState, type PointerEvent } from 'react';
import type { RideStatus } from '../game/motorcycleRide';

export function RideControls({
	status,
	limit,
	onLimit,
	onBrake,
	onDismount,
}: {
	status: RideStatus;
	limit: number;
	onLimit: (n: number) => void;
	onBrake: (b: boolean) => void;
	onDismount: () => void;
}) {
	const [accelActive, setAccelActive] = useState(false);
	const [brakeActive, setBrakeActive] = useState(false);

	if (!status.riding && !status.near) return null;

	const startAccel = (e: PointerEvent<HTMLButtonElement>) => {
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {}
		setAccelActive(true);
		window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
		window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }));
	};

	const stopAccel = () => {
		setAccelActive(false);
		window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
		window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', bubbles: true }));
	};

	const startBrake = (e: PointerEvent<HTMLButtonElement>) => {
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {}
		setBrakeActive(true);
		onBrake(true);
	};

	const stopBrake = () => {
		setBrakeActive(false);
		onBrake(false);
	};

	return (
		<>
			{/* Mobile Screen: Speedometer below top-right buttons + Action buttons on bottom-right */}
			<section
				className="ride-mobile-orbit"
				aria-label="ဆိုင်ကယ် ထိန်းချုပ်ခလုတ်များ"
				onPointerDown={(e) => e.stopPropagation()}
			>
				{!status.riding ? (
					<div className="ride-near-prompt" role="status">
						🏍️ ဆိုင်ကယ်နား ရပ်လိုက်လျှင် တက်စီးပါမည်…
					</div>
				) : (
					<>
						{/* Mini Floating Speedometer HUD below location-actions & settings icon */}
						<div className="ride-orbit-speedo" aria-live="polite">
							<span className="ride-orbit-speedo-icon">🏍️</span>
							<strong className="ride-orbit-speedo-val">
								{Math.abs(status.kmh)}
							</strong>
							<small className="ride-orbit-speedo-unit">km/h</small>
							{status.kmh < 0 && (
								<span className="ride-orbit-speedo-rev">R</span>
							)}
							<button
								type="button"
								className="ride-orbit-speedo-limit"
								onClick={() => onLimit(limit >= 40 ? 10 : limit + 10)}
								title={`အမြင့်ဆုံးအရှိန်: ${limit} km/h (နှိပ်၍ ပြောင်းပါ)`}
								aria-label={`အမြင့်ဆုံးအရှိန်: ${limit} km/h`}
							>
								{limit}
							</button>
						</div>

						{/* Right Hand Control Buttons Cluster at Bottom-Right */}
						<div className="ride-mobile-actions" aria-label="ညာဘက်လက် ထိန်းချုပ်ခလုတ်များ">
							{/* 1. Leave Icon (ဆိုင်ကယ်မှဆင်းရန် - Inner-Left) */}
							<button
								type="button"
								className="ride-orbit-btn ride-orbit-btn-leave"
								onClick={onDismount}
								aria-label="ဆိုင်ကယ်မှ ဆင်းရန် (Leave motorcycle)"
								title="ဆိုင်ကယ်မှ ဆင်းရန် (Leave)"
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
								<span className="ride-orbit-tag">ဆင်းရန်</span>
							</button>

							{/* 2. Break Icon (ဘရိတ် - Upper-Middle) */}
							<button
								type="button"
								className={`ride-orbit-btn ride-orbit-btn-brake${brakeActive ? ' ride-orbit-active' : ''}`}
								onPointerDown={startBrake}
								onPointerUp={stopBrake}
								onPointerCancel={stopBrake}
								onLostPointerCapture={stopBrake}
								onKeyDown={(e) => {
									if (e.code === 'Space' || e.code === 'Enter') {
										setBrakeActive(true);
										onBrake(true);
									}
								}}
								onKeyUp={stopBrake}
								onBlur={stopBrake}
								aria-label="ဘရိတ်အုပ်ရန် (Brake)"
								title="ဘရိတ်အုပ်ရန် ဖိထားပါ (Brake)"
							>
								<svg
									viewBox="0 0 24 24"
									width="22"
									height="22"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<circle cx="12" cy="12" r="9" />
									<path d="M12 7v6M12 17h.01" />
								</svg>
								<span className="ride-orbit-tag">ဘရိတ်</span>
							</button>

							{/* 3. Accelerate Icon (အရှိန်မြှင့်ရန် - Bottom-Right) */}
							<button
								type="button"
								className={`ride-orbit-btn ride-orbit-btn-accel${accelActive ? ' ride-orbit-active' : ''}`}
								onPointerDown={startAccel}
								onPointerUp={stopAccel}
								onPointerCancel={stopAccel}
								onLostPointerCapture={stopAccel}
								aria-label="အရှိန်မြှင့် မောင်းနှင်ရန် (Accelerate)"
								title="အရှိန်မြှင့်ရန် ဖိထားပါ (Accelerate)"
							>
								<svg
									viewBox="0 0 24 24"
									width="22"
									height="22"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<polyline points="7 14 12 9 17 14" />
									<polyline points="7 19 12 14 17 19" />
								</svg>
								<span className="ride-orbit-tag">အရှိန်</span>
							</button>
						</div>

						{status.notice && (
							<div className="ride-orbit-notice" role="status">
								{status.notice}
							</div>
						)}
					</>
				)}
			</section>

			{/* Desktop Screen: Classic Control Panel at bottom-right */}
			<section
				className="ride-controls ride-controls-desktop"
				aria-label="ဆိုင်ကယ် မောင်းနှင်မှု"
				onPointerDown={(e) => e.stopPropagation()}
			>
				{!status.riding ? (
					<p role="status">ဆိုင်ကယ်နား ရပ်လိုက်လျှင် တက်စီးပါမည်…</p>
				) : (
					<>
						<div className="ride-heading">
							<strong>
								{status.kmh < 0 ? 'နောက်ဆုတ် · R' : 'ဆိုင်ကယ်'}
							</strong>
							<output aria-label="လက်ရှိအရှိန်">
								{Math.abs(status.kmh)} <small>km/h</small>
							</output>
						</div>
						<label htmlFor="ride-speed">
							အမြင့်ဆုံးအရှိန် <b>{limit} km/h</b>
						</label>
						<input
							id="ride-speed"
							type="range"
							min="5"
							max="40"
							step="5"
							value={limit}
							onChange={(e) => onLimit(Number(e.target.value))}
						/>
						<div className="ride-buttons">
							<button
								type="button"
								className="ride-brake"
								onPointerDown={startBrake}
								onPointerUp={stopBrake}
								onPointerCancel={stopBrake}
								onLostPointerCapture={stopBrake}
								onKeyDown={(e) => {
									if (e.code === 'Space' || e.code === 'Enter') {
										setBrakeActive(true);
										onBrake(true);
									}
								}}
								onKeyUp={stopBrake}
								onBlur={stopBrake}
							>
								ဘရိတ်
							</button>
							<button type="button" onClick={onDismount}>
								ဆိုင်ကယ်မှဆင်းရန်
							</button>
						</div>
						<p>
							W / ↑ မောင်း · S / ↓ အရှိန်လျှော့ / နောက်ဆုတ်
							<br />A D / ← → ကွေ့ · Mobile: Joystick ဖြင့် ထိန်းချုပ်ပါ
						</p>
						{status.notice && <p role="status">{status.notice}</p>}
					</>
				)}
			</section>
		</>
	);
}
