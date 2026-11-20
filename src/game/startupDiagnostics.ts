export type StartupStage =
  | 'app-boot'
  | 'canvas-init'
  | 'webgl-created'
  | 'map-data-load'
  | 'map-parse'
  | 'building-geom'
  | 'texture-load'
  | 'lighting-init'
  | 'first-frame'
  | 'game-ready'
  | 'webgl-context-lost'
  | 'webgl-context-restored'
  | 'startup-error';

export interface StartupCheckpoint {
  stage: StartupStage;
  timestampMs: number;
  heapUsedMb?: number;
  details?: Record<string, any>;
}

export interface CrashReport {
  sessionId: string;
  crashedAt: string;
  isConfirmedCrash: boolean;
  lastCompletedStage: StartupStage;
  totalTimeMs: number;
  lastHeapUsedMb?: number;
  checkpoints: StartupCheckpoint[];
  reason?: string;
}

export interface StartupStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StartupSummary {
  sessionId: string;
  ready: boolean;
  firstFrameMs: number | null;
  timeToReadyMs: number | null;
  contextLostCount: number;
  contextRestoredCount: number;
  lastCompletedStage: StartupStage | null;
  lastCrash: CrashReport | null;
  checkpoints: StartupCheckpoint[];
}

const STORAGE_KEY_CURRENT = 'mm_startup_current';
const STORAGE_KEY_LAST_CRASH = 'mm_startup_last_crash';
const STORAGE_KEY_EXIT = 'mm_startup_exit_type';

/**
 * Identifies errors and unhandled promise rejections originating from third-party browser
 * extensions (such as injected `200.js` / `19200.js` scripts reading `M_ID` or `chrome-extension://` URLs)
 * so they do not pollute game startup diagnostics or console error logs.
 */
export function isThirdPartyExtensionError(info: {
  message?: string;
  filename?: string;
  stack?: string;
}): boolean {
  const combined = `${info.message ?? ''} ${info.filename ?? ''} ${info.stack ?? ''}`;
  if (!combined.trim()) return false;
  if (
    /(?:chrome-extension|moz-extension|safari-web-extension|ms-browser-extension):\/\//i.test(
      combined,
    )
  ) {
    return true;
  }
  if (/reading\s+'M_ID'/i.test(combined) || /\b\d*200\.js:\d+/i.test(combined)) {
    return true;
  }
  return false;
}

function readStorageItem(primary: StartupStorageAdapter | null, secondary: StartupStorageAdapter | null, key: string): string | null {
  try {
    const val = primary?.getItem(key);
    if (val !== null && val !== undefined) return val;
  } catch {}
  try {
    return secondary?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorageItem(primary: StartupStorageAdapter | null, secondary: StartupStorageAdapter | null, key: string, value: string): void {
  try {
    primary?.setItem(key, value);
  } catch {}
  try {
    secondary?.setItem(key, value);
  } catch {}
}

function removeStorageItem(primary: StartupStorageAdapter | null, secondary: StartupStorageAdapter | null, key: string): void {
  try {
    primary?.removeItem(key);
  } catch {}
  try {
    secondary?.removeItem(key);
  } catch {}
}

export class StartupDiagnosticsManager {
  private sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  private checkpoints: StartupCheckpoint[] = [];
  private lastCrash: CrashReport | null = null;
  private isGameReady = false;
  private contextLostCount = 0;
  private contextRestoredCount = 0;
  private readonly sessionStore: StartupStorageAdapter | null;
  private readonly persistentStore: StartupStorageAdapter | null;

  constructor(options?: {
    sessionStore?: StartupStorageAdapter | null;
    persistentStore?: StartupStorageAdapter | null;
    autoBoot?: boolean;
  }) {
    const hasCustomStores = options?.sessionStore !== undefined || options?.persistentStore !== undefined;
    if (!hasCustomStores && typeof window === 'undefined') {
      this.sessionStore = null;
      this.persistentStore = null;
      return;
    }

    this.sessionStore =
      options?.sessionStore !== undefined
        ? options.sessionStore
        : typeof window !== 'undefined'
          ? (window.sessionStorage ?? null)
          : null;
    this.persistentStore =
      options?.persistentStore !== undefined
        ? options.persistentStore
        : typeof window !== 'undefined'
          ? (window.localStorage ?? null)
          : null;

    this.detectPreviousSession();

    if (typeof window !== 'undefined' && options?.autoBoot !== false && !hasCustomStores) {
      this.setupExitListeners();
      this.setupErrorListeners();
      this.record('app-boot', {
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
        hardwareConcurrency: navigator.hardwareConcurrency,
        mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
      });
    }
  }

  private getHeapMb(): number | undefined {
    const memory = (performance as any)?.memory;
    if (memory && typeof memory.usedJSHeapSize === 'number') {
      return Math.round((memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
    }
    return undefined;
  }

  private detectPreviousSession() {
    try {
      const raw = readStorageItem(this.sessionStore, this.persistentStore, STORAGE_KEY_CURRENT);
      const exitType = readStorageItem(this.sessionStore, this.persistentStore, STORAGE_KEY_EXIT);
      removeStorageItem(this.sessionStore, this.persistentStore, STORAGE_KEY_EXIT);

      if (!raw) return;
      const prev = JSON.parse(raw) as { sessionId: string; checkpoints: StartupCheckpoint[]; ready: boolean };
      if (!prev.ready && prev.checkpoints && prev.checkpoints.length > 0) {
        const lastCheckpoint = prev.checkpoints[prev.checkpoints.length - 1];
        const isConfirmedCrash = exitType !== 'normal_exit';

        this.lastCrash = {
          sessionId: prev.sessionId,
          crashedAt: new Date().toISOString(),
          isConfirmedCrash,
          lastCompletedStage: lastCheckpoint.stage,
          totalTimeMs: Math.round(lastCheckpoint.timestampMs),
          lastHeapUsedMb: lastCheckpoint.heapUsedMb,
          checkpoints: prev.checkpoints,
          reason: isConfirmedCrash
            ? 'App or WebView killed abruptly (OOM or WebGL context abort) without unload event'
            : 'Page unloaded or refreshed by user before startup completed',
        };

        writeStorageItem(
          this.sessionStore,
          this.persistentStore,
          STORAGE_KEY_LAST_CRASH,
          JSON.stringify(this.lastCrash),
        );

        if (isConfirmedCrash) {
          console.warn(
            `%c[MOBILE RELOAD CRASH DETECTED]%c Previous launch crashed at stage "${lastCheckpoint.stage}" after ${Math.round(lastCheckpoint.timestampMs)}ms (Heap: ${lastCheckpoint.heapUsedMb ?? 'N/A'}MB).`,
            'background: #d32f2f; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 3px;',
            'color: #d32f2f; font-weight: bold;',
          );
        } else {
          console.info(
            `[StartupDiagnostics] Previous session was interrupted at stage "${lastCheckpoint.stage}" by normal page reload/navigation.`,
          );
        }
      }
    } catch (e) {
      console.error('[StartupDiagnostics] Error reading previous crash session:', e);
    }
  }

  private setupExitListeners() {
    const onExit = () => {
      writeStorageItem(this.sessionStore, this.persistentStore, STORAGE_KEY_EXIT, 'normal_exit');
    };
    window.addEventListener('beforeunload', onExit, { capture: true });
    window.addEventListener('pagehide', onExit, { capture: true });
  }

  private setupErrorListeners() {
    window.addEventListener(
      'error',
      (event) => {
        if (
          isThirdPartyExtensionError({
            message: event.message,
            filename: event.filename,
            stack: event.error?.stack,
          })
        ) {
          event.preventDefault();
          return;
        }
        if (!this.isGameReady) {
          this.record('startup-error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          });
        }
      },
      { capture: true },
    );

    window.addEventListener(
      'unhandledrejection',
      (event) => {
        const reasonStr = String(event.reason);
        const stackStr = event.reason?.stack;
        if (
          isThirdPartyExtensionError({
            message: reasonStr,
            stack: stackStr,
          })
        ) {
          event.preventDefault();
          return;
        }
        if (!this.isGameReady) {
          this.record('startup-error', {
            reason: reasonStr,
            stack: stackStr,
          });
        }
      },
      { capture: true },
    );
  }

  record(stage: StartupStage, details?: Record<string, any>) {
    if (!this.sessionStore && !this.persistentStore && typeof window === 'undefined') return;
    // Once game-ready is reached, ignore repeated streaming map-data-load / building-geom checkpoints
    if (
      this.isGameReady &&
      stage !== 'webgl-context-lost' &&
      stage !== 'webgl-context-restored'
    ) {
      return;
    }
    const nowMs = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    const checkpoint: StartupCheckpoint = {
      stage,
      timestampMs: Math.round(nowMs * 10) / 10,
      heapUsedMb: this.getHeapMb(),
      details,
    };
    this.checkpoints.push(checkpoint);

    if (stage === 'game-ready') {
      this.isGameReady = true;
    } else if (stage === 'webgl-context-lost') {
      this.contextLostCount += 1;
    } else if (stage === 'webgl-context-restored') {
      this.contextRestoredCount += 1;
    }

    writeStorageItem(
      this.sessionStore,
      this.persistentStore,
      STORAGE_KEY_CURRENT,
      JSON.stringify({
        sessionId: this.sessionId,
        checkpoints: this.checkpoints,
        ready: this.isGameReady,
      }),
    );

    const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
    const hasDiagParam = typeof window !== 'undefined' && window.location?.search?.includes('diag');
    if (isDev || hasDiagParam) {
      const mem = checkpoint.heapUsedMb !== undefined ? ` [${checkpoint.heapUsedMb}MB]` : '';
      console.log(`%c[Checkpoint]%c ${stage} +${checkpoint.timestampMs}ms${mem}`, 'color: #0288d1; font-weight: bold;', 'color: inherit;', details ?? '');
    }
  }

  getLastCrash(): CrashReport | null {
    if (this.lastCrash) return this.lastCrash;
    try {
      const raw = readStorageItem(this.sessionStore, this.persistentStore, STORAGE_KEY_LAST_CRASH);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  getCheckpoints(): StartupCheckpoint[] {
    return [...this.checkpoints];
  }

  getFirstFrameMs(): number | null {
    const cp = this.checkpoints.find((c) => c.stage === 'first-frame');
    return cp ? cp.timestampMs : null;
  }

  getTimeToReadyMs(): number | null {
    const cp = this.checkpoints.find((c) => c.stage === 'game-ready');
    return cp ? cp.timestampMs : null;
  }

  getContextLostCount(): number {
    return this.contextLostCount;
  }

  getStartupSummary(): StartupSummary {
    const last = this.checkpoints.length > 0 ? this.checkpoints[this.checkpoints.length - 1] : null;
    return {
      sessionId: this.sessionId,
      ready: this.isGameReady,
      firstFrameMs: this.getFirstFrameMs(),
      timeToReadyMs: this.getTimeToReadyMs(),
      contextLostCount: this.contextLostCount,
      contextRestoredCount: this.contextRestoredCount,
      lastCompletedStage: last ? last.stage : null,
      lastCrash: this.getLastCrash(),
      checkpoints: this.getCheckpoints(),
    };
  }

  clear() {
    removeStorageItem(this.sessionStore, this.persistentStore, STORAGE_KEY_CURRENT);
    removeStorageItem(this.sessionStore, this.persistentStore, STORAGE_KEY_LAST_CRASH);
    removeStorageItem(this.sessionStore, this.persistentStore, STORAGE_KEY_EXIT);
    this.checkpoints = [];
    this.lastCrash = null;
    this.isGameReady = false;
    this.contextLostCount = 0;
    this.contextRestoredCount = 0;
  }
}

export const startupDiagnostics = new StartupDiagnosticsManager();

if (typeof window !== 'undefined') {
  (window as any).__STARTUP_DIAGNOSTICS__ = {
    record: (stage: StartupStage, details?: Record<string, any>) => startupDiagnostics.record(stage, details),
    getCheckpoints: () => startupDiagnostics.getCheckpoints(),
    getLastCrash: () => startupDiagnostics.getLastCrash(),
    getStartupSummary: () => startupDiagnostics.getStartupSummary(),
    clear: () => startupDiagnostics.clear(),
  };
}
