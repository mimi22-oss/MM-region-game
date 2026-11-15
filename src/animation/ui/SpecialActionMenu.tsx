import { useEffect, useRef } from 'react';
import { useAppearance } from '../../game/appearanceStore';
import {
  shouldUseGlbCharacter,
  useCharacterRendererMode,
} from '../../game/characterRenderer';
import { cancelVehicleRequest, isVehicleWaitingActiveState } from '../../game/vehicleWaiting';
import { retryLastSpecialAction } from '../actions/SpecialActionManager';
import { useSpecialActions } from '../hooks/useSpecialActions';

export interface SpecialActionMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: string;
  disabledReason?: string | null;
}

export function SpecialActionMenu({
  open,
  onOpenChange,
  character,
  disabledReason,
}: SpecialActionMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const appearance = useAppearance();
  const rendererMode = useCharacterRendererMode();
  const { state, vehicleWaiting, dances, interactions, toggleDance, setLoop, stop } =
    useSpecialActions();

  const glbSupported =
    character === 'cartoon' && shouldUseGlbCharacter(appearance.human.preset, rendererMode);
  const effectiveDisabled = !glbSupported
    ? 'Boy / Girl 3D GLB character ဖြင့်သာ Action animation များ ကစားနိုင်ပါမည်။'
    : disabledReason ?? null;

  const isPlaying = state.activeActionId !== null;
  const activeDance = dances.find((d) => d.id === state.activeActionId);
  const isWaitingActive = isVehicleWaitingActiveState(vehicleWaiting.state);
  const waitingMotion = interactions[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  const statusLabel = (() => {
    if (effectiveDisabled && !isWaitingActive) return effectiveDisabled;
    if (state.status === 'loading') return 'Loading motion…';
    if (state.activeActionId === 'vehicle-wait' || isWaitingActive) {
      return `Waiting (${vehicleWaiting.approachPercent}%)`;
    }
    if (activeDance) return `Playing: ${activeDance.label}`;
    return 'Choose an action';
  })();

  return (
    <div className="action-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`action-menu-trigger${isPlaying || open ? ' location-btn-active' : ''}`}
        aria-label="အကနှင့် အပြုအမူများ · Special Actions"
        aria-expanded={open}
        title="အကနှင့် အပြုအမူများ · Special Actions"
        onClick={() => onOpenChange(!open)}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="4.5" r="2" />
          <path d="M9 10.5 12 8.5l4.5 2.5" />
          <path d="M6.5 12.5 9 10.5v4.5l-2.5 5" />
          <path d="m12 14.5 3.5 5.5" />
          <path d="m9 15 3-0.5" />
        </svg>
      </button>

      {open && (
        <div
          className="action-menu-popover"
          role="dialog"
          aria-label="အထူးလှုပ်ရှားမှု မီနူး · Special Action Menu"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="action-menu-header">
            <div>
              <strong>Actions · လှုပ်ရှားမှုများ</strong>
              <span className="action-menu-subtitle">{statusLabel}</span>
            </div>
            <button
              type="button"
              className="action-menu-close"
              aria-label="Close action menu"
              onClick={() => onOpenChange(false)}
            >
              ✕
            </button>
          </div>

          {effectiveDisabled && (
            <div className="action-menu-notice" role="status">
              {effectiveDisabled}
            </div>
          )}

          {state.error && (
            <div className="action-menu-notice action-menu-error" role="alert">
              <span>{state.error}</span>{' '}
              <button
                type="button"
                className="action-retry-btn"
                onClick={() => retryLastSpecialAction()}
              >
                Retry
              </button>
            </div>
          )}

          <div className="action-menu-controls">
            <button
              type="button"
              className={`action-pill-btn${state.loop ? ' is-on' : ''}`}
              aria-pressed={state.loop}
              disabled={!glbSupported}
              onClick={() => setLoop(!state.loop)}
            >
              ↻ Loop {state.loop ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              className="action-pill-btn action-stop-btn"
              disabled={!isPlaying || isWaitingActive}
              onClick={() => {
                stop();
                onOpenChange(false);
              }}
            >
              ■ Stop
            </button>
          </div>

          <section className="action-menu-section" aria-label="Dance">
            <div className="action-menu-section-title">Dance · အကများ</div>
            <div className="action-menu-grid">
              {dances.map((action) => {
                const selected = state.activeActionId === action.id;
                const loading = selected && state.status === 'loading';
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={!!effectiveDisabled}
                    aria-pressed={selected}
                    className={`action-dance-btn${selected ? ' is-active' : ''}${loading ? ' is-loading' : ''}`}
                    onClick={() => {
                      toggleDance(action.id);
                      onOpenChange(false);
                    }}
                  >
                    <span className="action-dance-title">
                      {action.label}
                      {loading ? ' …' : selected ? ' ●' : ''}
                    </span>
                    <span className="action-dance-sub">
                      {action.myanmarLabel} · {Math.round(action.durationSec)}s
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="action-menu-section" aria-label="Interactions">
            <div className="action-menu-section-title">Interactions · အပြုအမူများ</div>
            <div className={`action-interaction-card${isWaitingActive ? ' is-active' : ''}`}>
              <div className="action-interaction-info">
                <span className="action-interaction-title">
                  {waitingMotion?.label ?? 'Vehicle Waiting'}
                  {state.activeActionId === 'vehicle-wait' && state.status === 'loading'
                    ? ' · Loading…'
                    : isWaitingActive
                      ? ' · Active'
                      : ''}
                </span>
                <span className="action-interaction-sub">
                  {isWaitingActive
                    ? `ကားစောင့်နေသည် · Auto-triggered (${vehicleWaiting.approachPercent}%)`
                    : vehicleWaiting.state === 'VEHICLE_ARRIVED'
                      ? 'Vehicle arrived · Enter Vehicle button ready'
                      : 'Auto-triggered by Call Vehicle lifecycle'}
                </span>
              </div>
              {isWaitingActive && (
                <button
                  type="button"
                  className="action-interaction-cancel"
                  onClick={() => {
                    cancelVehicleRequest('user');
                    onOpenChange(false);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
