import { useSyncExternalStore } from 'react';
import {
  DEFAULT_INTRO_DURATION_SEC,
  REDUCED_MOTION_DURATION_SEC,
  clampIntroDuration,
  markFirstEntryCompleted,
  type IntroTrigger,
} from './IntroSettings.ts';

export type IntroStage =
  | 'idle'
  | 'regional-overview'
  | 'town-approach'
  | 'ward-descent'
  | 'neighborhood-flyover'
  | 'player-reveal'
  | 'handoff';

export type IntroOutcome = 'none' | 'completed' | 'skipped' | 'cancelled';

export type IntroTarget = {
  id?: string;
  label: string;
  title: string;
  subtitle: string;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  distance: number;
  bodyScale?: number;
};

export type IntroState = {
  active: boolean;
  stage: IntroStage;
  trigger: IntroTrigger | null;
  progress: number;
  elapsedSec: number;
  durationSec: number;
  reducedMotion: boolean;
  target: IntroTarget | null;
  originX: number | null;
  originZ: number | null;
  ownerId: 'intro' | 'player';
  runId: number;
  lastOutcome: IntroOutcome;
};

export type StartIntroOptions = {
  durationSec?: number;
  reducedMotion?: boolean;
  originX?: number;
  originZ?: number;
};

export const INTRO_STAGE_LABELS: Record<IntroStage, string> = {
  idle: '',
  'regional-overview': 'ဒေသတစ်ဝိုက် ကောင်းကင်မြင်ကွင်း',
  'town-approach': 'မြို့ပေါ်မှ ချဉ်းကပ်ပျံသန်းနေသည်',
  'ward-descent': 'သတ်မှတ်ရပ်ကွက်/ကျေးရွာသို့ ဆင်းသက်နေသည်',
  'neighborhood-flyover': 'ပတ်ဝန်းကျင် မြင်ကွင်း',
  'player-reveal': 'ဇာတ်ကောင်နေရာသို့ ချိန်ညှိနေသည်',
  handoff: 'ကစားသမား ကင်မရာသို့ လွှဲပြောင်းနေသည်',
};

const INITIAL_STATE: IntroState = {
  active: false,
  stage: 'idle',
  trigger: null,
  progress: 0,
  elapsedSec: 0,
  durationSec: DEFAULT_INTRO_DURATION_SEC,
  reducedMotion: false,
  target: null,
  originX: null,
  originZ: null,
  ownerId: 'player',
  runId: 0,
  lastOutcome: 'none',
};

let currentState: IntroState = { ...INITIAL_STATE };
let lastUiEmitProgress = -1;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function stageForProgress(progress: number, reducedMotion = false): IntroStage {
  const clamped = Math.max(0, Math.min(1, progress));
  if (reducedMotion) {
    return clamped >= 0.85 ? 'handoff' : 'player-reveal';
  }
  if (clamped < 0.2) return 'regional-overview';
  if (clamped < 0.44) return 'town-approach';
  if (clamped < 0.68) return 'ward-descent';
  if (clamped < 0.86) return 'neighborhood-flyover';
  if (clamped < 0.96) return 'player-reveal';
  return 'handoff';
}

export function getIntroState(): IntroState {
  return currentState;
}

export function isIntroOwningCamera(state: IntroState = currentState): boolean {
  return state.active && state.ownerId === 'intro';
}

/** High-altitude phase where distant overview suffices and heavy local assets can defer. */
export function isIntroHighAltitude(state: IntroState = currentState): boolean {
  return (
    state.active &&
    !state.reducedMotion &&
    (state.stage === 'regional-overview' || state.progress < 0.3)
  );
}

export function startIntro(
  target: IntroTarget,
  trigger: IntroTrigger,
  options: StartIntroOptions = {},
): IntroState {
  const reducedMotion = Boolean(options.reducedMotion);
  const durationSec = reducedMotion
    ? REDUCED_MOTION_DURATION_SEC
    : clampIntroDuration(options.durationSec ?? DEFAULT_INTRO_DURATION_SEC);

  const originX = Number.isFinite(options.originX) ? (options.originX as number) : null;
  const originZ = Number.isFinite(options.originZ) ? (options.originZ as number) : null;
  const stage = stageForProgress(0, reducedMotion);

  lastUiEmitProgress = 0;
  currentState = {
    active: true,
    stage,
    trigger,
    progress: 0,
    elapsedSec: 0,
    durationSec,
    reducedMotion,
    target: { ...target },
    originX,
    originZ,
    ownerId: 'intro',
    runId: currentState.runId + 1,
    lastOutcome: 'none',
  };
  emit();
  return currentState;
}

export function stepIntro(dt: number): {
  active: boolean;
  reachedEnd: boolean;
  progress: number;
  stage: IntroStage;
} {
  if (!currentState.active) {
    return {
      active: false,
      reachedEnd: false,
      progress: currentState.progress,
      stage: currentState.stage,
    };
  }
  const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
  const elapsedSec = Math.min(currentState.durationSec, currentState.elapsedSec + safeDt);
  const progress =
    currentState.durationSec > 0 ? Math.max(0, Math.min(1, elapsedSec / currentState.durationSec)) : 1;
  const stage = stageForProgress(progress, currentState.reducedMotion);
  const prevStage = currentState.stage;

  currentState = {
    ...currentState,
    elapsedSec,
    progress,
    stage,
  };

  if (stage !== prevStage || progress >= 1 || Math.abs(progress - lastUiEmitProgress) >= 0.08) {
    lastUiEmitProgress = progress;
    emit();
  }

  return {
    active: true,
    reachedEnd: progress >= 1,
    progress,
    stage,
  };
}

export function completeIntro(): IntroState {
  if (!currentState.active) return currentState;
  const trigger = currentState.trigger;
  lastUiEmitProgress = 1;
  currentState = {
    ...currentState,
    active: false,
    stage: 'idle',
    progress: 1,
    elapsedSec: currentState.durationSec,
    ownerId: 'player',
    lastOutcome: 'completed',
  };
  if (trigger === 'entry') {
    markFirstEntryCompleted();
  }
  emit();
  return currentState;
}

export function skipIntro(): IntroState {
  if (!currentState.active) return currentState;
  const trigger = currentState.trigger;
  lastUiEmitProgress = 1;
  currentState = {
    ...currentState,
    active: false,
    stage: 'idle',
    progress: 1,
    ownerId: 'player',
    lastOutcome: 'skipped',
  };
  if (trigger === 'entry') {
    markFirstEntryCompleted();
  }
  emit();
  return currentState;
}

export function cancelIntro(): IntroState {
  if (!currentState.active && currentState.ownerId === 'player') return currentState;
  lastUiEmitProgress = -1;
  currentState = {
    ...currentState,
    active: false,
    stage: 'idle',
    ownerId: 'player',
    lastOutcome: 'cancelled',
  };
  emit();
  return currentState;
}

export function resetIntroState(): IntroState {
  lastUiEmitProgress = -1;
  currentState = { ...INITIAL_STATE };
  emit();
  return currentState;
}

export function subscribeIntroState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIntroState(): IntroState {
  return useSyncExternalStore(subscribeIntroState, getIntroState, getIntroState);
}
