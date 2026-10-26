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

const STORAGE_KEY_CURRENT = 'mm_startup_current';
const STORAGE_KEY_LAST_CRASH = 'mm_startup_last_crash';
const STORAGE_KEY_EXIT = 'mm_startup_exit_type';

class StartupDiagnosticsManager {
  private sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  private checkpoints: StartupCheckpoint[] = [];
  private lastCrash: CrashReport | null = null;
  private isGameReady = false;

  constructor() {
    if (typeof window === 'undefined') return;
    this.detectPreviousSession();
    this.setupExitListeners();
    this.setupErrorListeners();
    this.record('app-boot', {
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
      hardwareConcurrency: navigator.hardwareConcurrency,
      mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    });
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
      const raw = sessionStorage.getItem(STORAGE_KEY_CURRENT);
      const exitType = sessionStorage.getItem(STORAGE_KEY_EXIT);
      sessionStorage.removeItem(STORAGE_KEY_EXIT); // reset for current session

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
            ? 'Tab killed abruptly (OOM or WebGL context abort) without unload event'
            : 'Page unloaded or refreshed by user before startup completed',
        };

        sessionStorage.setItem(STORAGE_KEY_LAST_CRASH, JSON.stringify(this.lastCrash));

        if (isConfirmedCrash) {
          console.warn(
            `%c[MOBILE RELOAD CRASH DETECTED]%c Previous reload crashed at stage "${lastCheckpoint.stage}" after ${Math.round(lastCheckpoint.timestampMs)}ms (Heap: ${lastCheckpoint.heapUsedMb ?? 'N/A'}MB).`,
            'background: #d32f2f; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 3px;',
            'color: #d32f2f; font-weight: bold;'
          );
        } else {
          console.info(
            `[StartupDiagnostics] Previous session was interrupted at stage "${lastCheckpoint.stage}" by normal page reload/navigation.`
          );
        }
      }
    } catch (e) {
      console.error('[StartupDiagnostics] Error reading previous crash session:', e);
    }
  }

  private setupExitListeners() {
    const onExit = () => {
      try {
        sessionStorage.setItem(STORAGE_KEY_EXIT, 'normal_exit');
      } catch {}
    };
    window.addEventListener('beforeunload', onExit, { capture: true });
    window.addEventListener('pagehide', onExit, { capture: true });
  }

  private setupErrorListeners() {
    window.addEventListener('error', (event) => {
      if (!this.isGameReady) {
        this.record('startup-error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      if (!this.isGameReady) {
        this.record('startup-error', {
          reason: String(event.reason),
          stack: event.reason?.stack,
        });
      }
    });
  }

  record(stage: StartupStage, details?: Record<string, any>) {
    if (typeof window === 'undefined') return;
    const checkpoint: StartupCheckpoint = {
      stage,
      timestampMs: Math.round(performance.now() * 10) / 10,
      heapUsedMb: this.getHeapMb(),
      details,
    };
    this.checkpoints.push(checkpoint);

    if (stage === 'game-ready') {
      this.isGameReady = true;
    }

    try {
      sessionStorage.setItem(
        STORAGE_KEY_CURRENT,
        JSON.stringify({
          sessionId: this.sessionId,
          checkpoints: this.checkpoints,
          ready: this.isGameReady,
        })
      );
    } catch {}

    if (import.meta.env.DEV || window.location.search.includes('diag')) {
      const mem = checkpoint.heapUsedMb !== undefined ? ` [${checkpoint.heapUsedMb}MB]` : '';
      console.log(`%c[Checkpoint]%c ${stage} +${checkpoint.timestampMs}ms${mem}`, 'color: #0288d1; font-weight: bold;', 'color: inherit;', details ?? '');
    }
  }

  getLastCrash(): CrashReport | null {
    if (this.lastCrash) return this.lastCrash;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_LAST_CRASH);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  getCheckpoints(): StartupCheckpoint[] {
    return [...this.checkpoints];
  }

  clear() {
    sessionStorage.removeItem(STORAGE_KEY_CURRENT);
    sessionStorage.removeItem(STORAGE_KEY_LAST_CRASH);
    sessionStorage.removeItem(STORAGE_KEY_EXIT);
    this.checkpoints = [];
    this.lastCrash = null;
  }
}

export const startupDiagnostics = new StartupDiagnosticsManager();

if (typeof window !== 'undefined') {
  (window as any).__STARTUP_DIAGNOSTICS__ = {
    record: (stage: StartupStage, details?: Record<string, any>) => startupDiagnostics.record(stage, details),
    getCheckpoints: () => startupDiagnostics.getCheckpoints(),
    getLastCrash: () => startupDiagnostics.getLastCrash(),
    clear: () => startupDiagnostics.clear(),
  };
}
