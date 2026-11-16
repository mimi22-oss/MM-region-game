import {
  DEFAULT_INTRO_DURATION_SEC,
  MAX_INTRO_DURATION_SEC,
  MIN_INTRO_DURATION_SEC,
  updateIntroSettings,
  useIntroSettings,
  type IntroPlayMode,
} from '../game/IntroSettings.ts';
import {
  INTRO_STAGE_LABELS,
  skipIntro,
  useIntroState,
} from '../game/IntroStateMachine.ts';

const MODE_OPTIONS: Array<{ id: IntroPlayMode; label: string; detail: string }> = [
  { id: 'first-entry', label: 'ပထမဆုံးအကြိမ်သာ', detail: 'First entry only' },
  { id: 'every-entry', label: 'ဂိမ်းဖွင့်တိုင်း', detail: 'Every entry' },
  { id: 'travel-entry', label: 'နေရာပြောင်းတိုင်း', detail: 'Location travel' },
  { id: 'off', label: 'ပိတ်ထားမည်', detail: 'Off' },
];

export function IntroOverlay({ hidden = false }: { hidden?: boolean }) {
  const intro = useIntroState();
  if (hidden || !intro.active) return null;

  const pct = Math.max(0, Math.min(100, Math.round(intro.progress * 100)));
  const title = intro.target?.title ?? intro.target?.label ?? '';
  const stageText = INTRO_STAGE_LABELS[intro.stage] || '';

  return (
    <div
      className="cinematic-intro-overlay"
      data-stage={intro.stage}
      data-testid="cinematic-intro-overlay"
      role="region"
      aria-label="ကောင်းကင်မြင်ကွင်း မိတ်ဆက်"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cinematic-intro-banner">
        <span className="cinematic-intro-badge">DRONE INTRO</span>
        <strong className="cinematic-intro-title">{title}</strong>
        {stageText && <span className="cinematic-intro-stage">{stageText}</span>}
        <div
          className="cinematic-intro-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span className="cinematic-intro-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <button
        type="button"
        className="cinematic-skip-btn"
        data-testid="skip-intro-btn"
        aria-label="Skip Intro"
        onClick={(e) => {
          e.stopPropagation();
          skipIntro();
        }}
      >
        <span>ကျော်မည် </span>
        <kbd>Esc</kbd>
      </button>
    </div>
  );
}

export function IntroSettingsPanel({
  onReplay,
}: {
  onReplay?: () => void;
}) {
  const settings = useIntroSettings();

  return (
    <section className="time-controls environment-settings intro-settings" aria-label="Drone Intro Settings">
      <div className="time-header">
        <span className="time-title">ကောင်းကင်မြင်ကွင်း မိတ်ဆက် (Drone Intro)</span>
        <span className="time-status-pill">{settings.durationSec.toFixed(1)}s</span>
      </div>
      <div className="environment-periods">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            data-intro-mode={opt.id}
            className={`time-btn${settings.mode === opt.id ? ' time-btn-active' : ''}`}
            aria-pressed={settings.mode === opt.id}
            onClick={() => updateIntroSettings({ mode: opt.id })}
          >
            <span>{opt.label}</span>
            <small>{opt.detail}</small>
          </button>
        ))}
      </div>
      <label className="environment-volume">
        ကြာချိန် (Duration)
        <output>{settings.durationSec || DEFAULT_INTRO_DURATION_SEC}s</output>
        <input
          type="range"
          min={MIN_INTRO_DURATION_SEC}
          max={MAX_INTRO_DURATION_SEC}
          step="0.5"
          aria-label="Drone Intro Duration"
          value={settings.durationSec}
          onChange={(e) => updateIntroSettings({ durationSec: Number(e.target.value) })}
        />
      </label>
      <label className="environment-sound">
        <input
          type="checkbox"
          checked={settings.respectReducedMotion}
          onChange={(e) => updateIntroSettings({ respectReducedMotion: e.target.checked })}
        />
        Reduced Motion ဦးစားပေးမည်
      </label>
      {onReplay && (
        <button
          type="button"
          className="time-btn"
          data-testid="replay-intro-btn"
          onClick={onReplay}
        >
          ▶ ယခု Drone Intro ပြန်ကြည့်မည်
        </button>
      )}
    </section>
  );
}
