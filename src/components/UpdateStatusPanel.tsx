import { useEffect, useState } from 'react';
import {
  otaCoordinator,
  useOtaUpdateState,
  type OtaUpdatePhase,
} from '../services/otaUpdater.ts';
import type { OtaChannel } from '../game/otaCompatibility.ts';

function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
}

function getPhaseBadge(phase: OtaUpdatePhase, online: boolean): { label: string; tone: string } {
  if (!online && phase === 'offline') {
    return { label: 'Offline Ready', tone: 'is-offline' };
  }
  switch (phase) {
    case 'checking':
      return { label: 'Checking...', tone: 'is-busy' };
    case 'update_available':
      return { label: 'Update Available', tone: 'is-available' };
    case 'downloading':
    case 'verifying':
      return { label: 'Syncing...', tone: 'is-busy' };
    case 'ready_to_restart':
      return { label: 'Ready to Apply', tone: 'is-ready' };
    case 'deferred_busy':
      return { label: 'Waiting Safe Moment', tone: 'is-warn' };
    case 'native_apk_required':
      return { label: 'APK Update Required', tone: 'is-warn' };
    case 'rolled_back':
      return { label: 'Rolled Back', tone: 'is-warn' };
    case 'failed':
      return { label: 'Update Failed', tone: 'is-error' };
    case 'up_to_date':
      return { label: 'Up to Date', tone: 'is-ok' };
    case 'applying':
      return { label: 'Restarting...', tone: 'is-busy' };
    default:
      return { label: online ? 'Ready' : 'Offline Ready', tone: online ? 'is-ok' : 'is-offline' };
  }
}

export function UpdateStatusPanel() {
  const ota = useOtaUpdateState();
  const [channelBusy, setChannelBusy] = useState(false);

  const badge = getPhaseBadge(ota.phase, ota.online);
  const canCheck = ota.online && ota.phase !== 'checking' && ota.phase !== 'downloading' && ota.phase !== 'applying';
  const canDownload =
    ota.online &&
    (ota.phase === 'update_available' || ota.phase === 'failed') &&
    Boolean(ota.availableRelease);
  const canRestart = ota.phase === 'ready_to_restart' || ota.phase === 'deferred_busy';
  const showProgress =
    ota.phase === 'downloading' ||
    ota.phase === 'verifying' ||
    ota.phase === 'ready_to_restart';
  const hasCustomOverride =
    ota.activeBundleId !== 'builtin' || ota.activeAssetVersion !== null;

  const handleChannelChange = async (nextChannel: OtaChannel) => {
    setChannelBusy(true);
    try {
      await otaCoordinator.setChannel(nextChannel);
    } finally {
      setChannelBusy(false);
    }
  };

  return (
    <div className="ota-panel">
      <div className="ota-panel-top">
        <div className="ota-meta-grid">
          <div className="ota-meta-item">
            <span>Current Version</span>
            <strong>v{ota.currentVersion}</strong>
          </div>
          <div className="ota-meta-item">
            <span>Native APK</span>
            <strong>
              v{ota.nativeVersion} (code {ota.androidVersionCode})
            </strong>
          </div>
          <div className="ota-meta-item">
            <span>Asset Cache</span>
            <strong>
              {ota.activeAssetVersion ? `v${ota.activeAssetVersion}` : 'Bundled Fallback'}
            </strong>
          </div>
          <div className="ota-meta-item">
            <span>Connection</span>
            <strong className={ota.online ? 'is-online' : 'is-offline-text'}>
              {ota.online ? 'Online' : 'Offline (Playable)'}
            </strong>
          </div>
        </div>
        <span className={`ota-phase-badge ${badge.tone}`}>{badge.label}</span>
      </div>

      {ota.rollbackNotification && (
        <div className="ota-notice ota-notice-warn" role="status">
          <div>
            <strong>Automatic Rollback Protection:</strong> {ota.rollbackNotification.reason}{' '}
            <span>
              (Recovered to v{ota.rollbackNotification.recoveredToVersion})
            </span>
          </div>
          <button
            type="button"
            className="ota-mini-btn"
            onClick={() => otaCoordinator.dismissRollbackNotification()}
          >
            Dismiss
          </button>
        </div>
      )}

      {ota.phase === 'native_apk_required' && (
        <div className="ota-notice ota-notice-warn" role="status">
          <strong>New Android APK Required:</strong> {ota.statusMessage}
        </div>
      )}

      {ota.lastError && ota.phase === 'failed' && (
        <div className="ota-notice ota-notice-error" role="alert">
          <strong>Update Error:</strong> {ota.lastError}
        </div>
      )}

      {ota.phase === 'deferred_busy' && !ota.safety.safeToApplyNow && (
        <div className="ota-notice ota-notice-warn" role="status">
          <strong>Paused Safely:</strong> {ota.safety.summaryMy} ({ota.safety.summaryEn}). Restart will proceed when safe.
        </div>
      )}

      {ota.statusMessage && !(ota.phase === 'failed' && ota.lastError === ota.statusMessage) && (
        <div className="ota-status-line">
          <span>{ota.statusMessage}</span>
          {ota.availableRelease && ota.phase === 'update_available' && (
            <small>
              Next: v{ota.availableRelease.version} · Delta {formatBytesCompact(ota.totalDownloadBytes)}
            </small>
          )}
        </div>
      )}

      {showProgress && (
        <div className="ota-progress-wrap" aria-label="Update download progress">
          <div className="ota-progress-track">
            <div
              className="ota-progress-fill"
              style={{ width: `${Math.max(4, Math.min(100, ota.downloadPercent))}%` }}
            />
          </div>
          <div className="ota-progress-caption">
            <span>{Math.round(ota.downloadPercent)}%</span>
            <span>
              {formatBytesCompact(ota.downloadedBytes)} / {formatBytesCompact(ota.totalDownloadBytes)}
            </span>
          </div>
        </div>
      )}

      <div className="ota-channel-row">
        <span>Release Channel:</span>
        <div className="ota-channel-pills" role="group" aria-label="OTA release channel">
          {(['production', 'staging'] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              disabled={channelBusy || ota.phase === 'downloading'}
              className={`ota-channel-btn${ota.channel === ch ? ' is-selected' : ''}`}
              onClick={() => void handleChannelChange(ch)}
            >
              {ch === 'production' ? 'Production' : 'Staging'}
            </button>
          ))}
        </div>
      </div>

      <div className="ota-actions-row">
        <button
          type="button"
          className="ota-action-btn"
          disabled={!canCheck}
          onClick={() => void otaCoordinator.checkForUpdate()}
        >
          {ota.phase === 'checking' ? 'Checking...' : 'Check Updates'}
        </button>

        {canDownload && (
          <button
            type="button"
            className="ota-action-btn is-primary"
            onClick={() => void otaCoordinator.downloadAvailableUpdate()}
          >
            Download v{ota.availableRelease?.version}
          </button>
        )}

        {canRestart && (
          <button
            type="button"
            className="ota-action-btn is-primary"
            onClick={() => void otaCoordinator.applyUpdateNow()}
          >
            {ota.safety.safeToApplyNow ? 'Restart & Apply' : 'Queue Safe Restart'}
          </button>
        )}

        {hasCustomOverride && (
          <button
            type="button"
            className="ota-action-btn is-subtle"
            onClick={() => void otaCoordinator.rollbackManually()}
          >
            Restore Fallback
          </button>
        )}
      </div>

      {ota.lastCheckedAt && (
        <div className="ota-footer-meta">
          Last checked: {new Date(ota.lastCheckedAt).toLocaleString()} · Offline fallback:{' '}
          {ota.offlineFallbackReady ? 'Verified' : 'Unavailable'}
        </div>
      )}
    </div>
  );
}

export function useOtaAttentionDot(): boolean {
  const ota = useOtaUpdateState();
  return (
    ota.phase === 'update_available' ||
    ota.phase === 'ready_to_restart' ||
    ota.phase === 'deferred_busy' ||
    ota.phase === 'rolled_back' ||
    ota.phase === 'native_apk_required'
  );
}

export function UpdateTriggerButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  const ota = useOtaUpdateState();
  const hasAttentionDot = useOtaAttentionDot();

  return (
    <button
      type="button"
      className={active ? 'settings-btn ota-trigger-btn settings-btn-active' : 'settings-btn ota-trigger-btn'}
      aria-label="App Updates and Offline Cache"
      aria-expanded={active}
      title={`App Updates · v${ota.currentVersion} (${ota.online ? 'Online' : 'Offline'})`}
      onClick={onClick}
    >
      <span aria-hidden="true">↻</span>
      {hasAttentionDot && <span className="ota-trigger-dot" aria-hidden="true" />}
    </button>
  );
}

interface UpdateStatusDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UpdateStatusDialog({ open, onClose }: UpdateStatusDialogProps) {
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="settings-backdrop ota-dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="ota-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="App Updates and Offline Cache"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="ota-dialog-header">
          <div>
            <h2>App Updates &amp; Offline Assets</h2>
            <p>Git-driven Android OTA &amp; verified offline cache manager</p>
          </div>
          <button
            type="button"
            className="settings-menu-close"
            aria-label="Close updates dialog"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <UpdateStatusPanel />
      </section>
    </div>
  );
}

interface UpdateFloatingBannerProps {
  hidden: boolean;
  onOpenUpdates: () => void;
}

export function UpdateFloatingBanner({ hidden, onOpenUpdates }: UpdateFloatingBannerProps) {
  const ota = useOtaUpdateState();
  const [dismissedPhaseKey, setDismissedPhaseKey] = useState<string | null>(null);

  if (hidden || ota.safety.blockingReasons.includes('ghost_grab')) {
    return null;
  }

  const actionable =
    ota.phase === 'ready_to_restart' ||
    ota.phase === 'deferred_busy' ||
    ota.phase === 'rolled_back' ||
    ota.phase === 'native_apk_required' ||
    ota.phase === 'downloading' ||
    ota.phase === 'verifying';

  if (!actionable) return null;

  const phaseKey = `${ota.phase}:${ota.availableRelease?.version ?? ''}:${ota.rollbackNotification?.timestamp ?? ''}`;
  if (dismissedPhaseKey === phaseKey) return null;

  return (
    <aside className="ota-floating-banner" role="status" aria-live="polite">
      <div className="ota-floating-content" onClick={onOpenUpdates}>
        <strong className="ota-floating-title">
          {ota.phase === 'ready_to_restart'
            ? `Update v${ota.availableRelease?.version ?? ''} Ready`
            : ota.phase === 'deferred_busy'
              ? 'Update Waiting for Safe Moment'
              : ota.phase === 'rolled_back'
                ? 'Update Rolled Back Safely'
                : ota.phase === 'native_apk_required'
                  ? 'New Android APK Needed'
                  : `Updating (${Math.round(ota.downloadPercent)}%)`}
        </strong>
        <span className="ota-floating-msg">{ota.statusMessage}</span>
      </div>
      <div className="ota-floating-actions">
        {(ota.phase === 'ready_to_restart' || ota.phase === 'deferred_busy') && (
          <button
            type="button"
            className="ota-floating-btn is-apply"
            onClick={() => void otaCoordinator.applyUpdateNow()}
          >
            {ota.safety.safeToApplyNow ? 'Restart' : 'When Safe'}
          </button>
        )}
        <button
          type="button"
          className="ota-floating-btn"
          aria-label="Close update notice"
          onClick={() => setDismissedPhaseKey(phaseKey)}
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
