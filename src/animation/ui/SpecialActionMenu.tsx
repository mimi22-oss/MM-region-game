import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppearance } from '../../game/appearanceStore';
import {
  shouldUseGlbCharacter,
  useCharacterRendererMode,
} from '../../game/characterRenderer';
import { cancelVehicleRequest, isVehicleWaitingActiveState } from '../../game/vehicleWaiting';
import { retryLastSpecialAction } from '../actions/SpecialActionManager';
import type {
  MotionDefinition,
  MotionId,
  MotionSubgroup,
  UiActionCategory,
} from '../core/MotionRegistry';
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
  const {
    state,
    vehicleWaiting,
    categories,
    activeDefinition,
    getCategoryGroups,
    play,
    trigger,
    setLoop,
    stop,
  } = useSpecialActions();

  const [activeTab, setActiveTab] = useState<UiActionCategory>('dance');
  const [expandedSubgroups, setExpandedSubgroups] = useState<
    Partial<Record<MotionSubgroup, boolean>>
  >({});
  const [selectedByTab, setSelectedByTab] = useState<Partial<Record<UiActionCategory, MotionId>>>(
    {},
  );
  const [loopOverrides, setLoopOverrides] = useState<Record<string, boolean>>({});

  const glbSupported =
    character === 'cartoon' && shouldUseGlbCharacter(appearance.human.preset, rendererMode);
  const effectiveDisabled = !glbSupported
    ? 'Boy / Girl 3D GLB character ဖြင့်သာ Action animation များ ကစားနိုင်ပါမည်။'
    : disabledReason ?? null;

  const categoryGroups = useMemo(
    () => getCategoryGroups(activeTab),
    [getCategoryGroups, activeTab],
  );

  const isWaitingActive = isVehicleWaitingActiveState(vehicleWaiting.state);
  const isPlaying = state.activeActionId !== null;
  const activeManualDef =
    activeDefinition && !activeDefinition.autoTriggeredOnly ? activeDefinition : null;

  const selectedIdInTab = useMemo(() => {
    const candidate = selectedByTab[activeTab];
    if (
      candidate &&
      categoryGroups.some((g) => g.actions.some((action) => action.id === candidate))
    ) {
      return candidate;
    }
    return categoryGroups[0]?.actions[0]?.id ?? null;
  }, [activeTab, categoryGroups, selectedByTab]);

  const selectedDefInTab = useMemo<MotionDefinition | null>(() => {
    if (!selectedIdInTab) return null;
    for (const group of categoryGroups) {
      const found = group.actions.find((action) => action.id === selectedIdInTab);
      if (found) return found;
    }
    return null;
  }, [categoryGroups, selectedIdInTab]);

  const targetActionDef =
    activeManualDef && activeManualDef.category === activeTab
      ? activeManualDef
      : selectedDefInTab ?? activeManualDef;

  const isLoopControlActive =
    activeManualDef !== null && activeManualDef.id === targetActionDef?.id;
  const effectiveLoopValue = targetActionDef
    ? isLoopControlActive
      ? state.loop
      : (loopOverrides[targetActionDef.id] ?? targetActionDef.defaultLoop)
    : false;
  const canToggleLoop =
    glbSupported &&
    !isWaitingActive &&
    Boolean(targetActionDef?.allowLoopToggle) &&
    Boolean(activeManualDef ? activeManualDef.allowLoopToggle : true);

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
    if (state.status === 'loading' && activeDefinition) {
      return `Loading ${activeDefinition.label}…`;
    }
    if (state.activeActionId === 'vehicle-wait' || isWaitingActive) {
      return `Waiting for vehicle (${vehicleWaiting.approachPercent}%)`;
    }
    if (activeManualDef) {
      const loopTag = state.loop ? 'Loop' : 'Once';
      return `${activeManualDef.label} · ${loopTag}`;
    }
    if (targetActionDef) {
      return `Ready: ${targetActionDef.label}`;
    }
    return 'Choose an action';
  })();

  function handleSelectAction(action: MotionDefinition) {
    setSelectedByTab((prev) => ({ ...prev, [activeTab]: action.id }));
    const customLoop =
      action.allowLoopToggle && action.id in loopOverrides ? loopOverrides[action.id] : undefined;
    trigger(action.id, customLoop !== undefined ? { loop: customLoop } : undefined);
  }

  function handlePlayOrReplay() {
    if (!targetActionDef) return;
    const customLoop =
      targetActionDef.allowLoopToggle && targetActionDef.id in loopOverrides
        ? loopOverrides[targetActionDef.id]
        : undefined;
    setSelectedByTab((prev) => ({ ...prev, [activeTab]: targetActionDef.id }));
    play(targetActionDef.id, {
      loop: isLoopControlActive ? state.loop : customLoop,
      restart: true,
    });
  }

  function handleToggleLoop() {
    if (!targetActionDef || !targetActionDef.allowLoopToggle) return;
    const nextLoop = !effectiveLoopValue;
    setLoopOverrides((prev) => ({ ...prev, [targetActionDef.id]: nextLoop }));
    if (isLoopControlActive) {
      setLoop(nextLoop);
    }
  }

  function toggleSubgroup(subgroup: MotionSubgroup, defaultExpanded: boolean) {
    setExpandedSubgroups((prev) => ({
      ...prev,
      [subgroup]: !(prev[subgroup] ?? defaultExpanded),
    }));
  }

  return (
    <div className="action-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`action-menu-trigger${isPlaying || open ? ' location-btn-active' : ''}`}
        aria-label="အကနှင့် လှုပ်ရှားမှုများ · Special Actions"
        aria-expanded={open}
        title="အကနှင့် လှုပ်ရှားမှုများ · Special Actions"
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
          onWheel={(e) => e.stopPropagation()}
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

          <div className="action-menu-tabs" role="tablist" aria-label="Action categories">
            {categories.map((cat) => {
              const selected = activeTab === cat.id;
              const hasActiveAction = activeManualDef?.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`action-tab-btn${selected ? ' is-active' : ''}${hasActiveAction ? ' has-running' : ''}`}
                  onClick={() => setActiveTab(cat.id)}
                >
                  <span className="action-tab-label">{cat.label}</span>
                  <span className="action-tab-count" aria-label={`${cat.count} actions`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="action-menu-controls">
            <button
              type="button"
              className={`action-pill-btn action-play-btn${activeManualDef && activeManualDef.id === targetActionDef?.id ? ' is-on' : ''}`}
              disabled={!!effectiveDisabled || !targetActionDef || isWaitingActive}
              onClick={handlePlayOrReplay}
            >
              {activeManualDef && activeManualDef.id === targetActionDef?.id ? '↻ Replay' : '▶ Play'}
            </button>
            <button
              type="button"
              className="action-pill-btn action-stop-btn"
              disabled={!isPlaying || isWaitingActive}
              onClick={() => stop()}
            >
              ■ Stop
            </button>
            <button
              type="button"
              className={`action-pill-btn${canToggleLoop && effectiveLoopValue ? ' is-on' : ''}`}
              aria-pressed={canToggleLoop ? effectiveLoopValue : false}
              disabled={!canToggleLoop}
              title={
                targetActionDef?.allowLoopToggle
                  ? 'Toggle repeating loop playback'
                  : 'This motion plays once cleanly and returns to locomotion'
              }
              onClick={handleToggleLoop}
            >
              {!targetActionDef || targetActionDef.allowLoopToggle
                ? `↻ Loop ${effectiveLoopValue ? 'On' : 'Off'}`
                : '• One-shot'}
            </button>
          </div>

          <div className="action-menu-body" role="tabpanel" aria-label={activeTab}>
            {categoryGroups.map(({ subgroup, actions }) => {
              const expanded = expandedSubgroups[subgroup.id] ?? subgroup.defaultExpanded;
              const panelId = `action-subgroup-${subgroup.id}`;
              return (
                <section key={subgroup.id} className="action-accordion">
                  <button
                    type="button"
                    className={`action-accordion-trigger${expanded ? ' is-open' : ''}`}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => toggleSubgroup(subgroup.id, subgroup.defaultExpanded)}
                  >
                    <span className="action-accordion-labels">
                      <span className="action-accordion-title">{subgroup.label}</span>
                      <span className="action-accordion-sub">{subgroup.myanmarLabel}</span>
                    </span>
                    <span className="action-accordion-meta">
                      <span className="action-accordion-count">{actions.length}</span>
                      <span className="action-accordion-chevron" aria-hidden="true">
                        {expanded ? '▾' : '▸'}
                      </span>
                    </span>
                  </button>

                  {expanded && (
                    <div id={panelId} className="action-menu-grid">
                      {actions.map((action) => {
                        const isRunning = state.activeActionId === action.id;
                        const isSelected = !isRunning && targetActionDef?.id === action.id;
                        const loading = isRunning && state.status === 'loading';
                        return (
                          <button
                            key={action.id}
                            type="button"
                            disabled={!!effectiveDisabled || isWaitingActive}
                            aria-pressed={isRunning}
                            className={`action-dance-btn${isRunning ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}${loading ? ' is-loading' : ''}`}
                            onClick={() => handleSelectAction(action)}
                          >
                            <span className="action-dance-title">
                              {action.label}
                              {loading ? ' …' : isRunning ? ' ●' : ''}
                            </span>
                            <span className="action-dance-sub">
                              {action.myanmarLabel} · {action.durationSec.toFixed(1)}s
                              {action.defaultLoop ? ' · ↻' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className={`action-interaction-card${isWaitingActive ? ' is-active' : ''}`}>
            <div className="action-interaction-info">
              <span className="action-interaction-title">
                Vehicle Waiting
                {state.activeActionId === 'vehicle-wait' && state.status === 'loading'
                  ? ' · Loading…'
                  : isWaitingActive
                    ? ` · ${vehicleWaiting.approachPercent}%`
                    : ''}
              </span>
              <span className="action-interaction-sub">
                {isWaitingActive
                  ? 'ကားစောင့်နေသည် · Auto-controlled'
                  : vehicleWaiting.state === 'VEHICLE_ARRIVED'
                    ? 'Vehicle arrived · Ready to board'
                    : 'Auto-controlled by Call Vehicle'}
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
        </div>
      )}
    </div>
  );
}
