import { useState } from 'react';
import { diagnosticConfig } from '../game/diagnosticMode';
import { isGhostDevUiAvailable, useGhostDevSettings } from '../game/ghostConfig';
import {
  runDiagnosticTestAudio,
  useAudioDiagnostics,
} from '../game/audio/horrorAudioDiagnostics';

export function isAudioDiagnosticsAvailable(): boolean {
  return isGhostDevUiAvailable() || diagnosticConfig.enabled;
}

export function AudioDiagnosticsContent({ compact = false }: { compact?: boolean }) {
  const diag = useAudioDiagnostics();
  const [testing, setTesting] = useState(false);

  const handleTestAudio = async () => {
    setTesting(true);
    try {
      await runDiagnosticTestAudio();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      data-testid="audio-diagnostics-content"
      style={{
        display: 'grid',
        gap: compact ? '4px' : '6px',
        fontSize: compact ? '11px' : '12px',
        lineHeight: 1.35,
        color: '#e5eef5',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <span>AudioContext</span>
        <strong data-diag="context-state">{diag.audioContextState}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <span>Sound Enabled</span>
        <strong data-diag="sound-enabled">{diag.soundEnabled ? 'ON' : 'MUTED'}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <span>Master Volume</span>
        <strong data-diag="master-volume">{Math.round(diag.masterVolume * 100)}%</strong>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '4px' }}>
        <div style={{ opacity: 0.78, marginBottom: '2px' }}>Active Audio Buses</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 8px' }}>
          <span>Ambience</span>
          <span>
            {Math.round(diag.activeBuses.ambience.gain * 100)}% · {diag.activeBuses.ambience.activeVoices}v
          </span>
          <span>Ghost Effects</span>
          <span>
            {Math.round(diag.activeBuses.ghostEffects.gain * 100)}% · {diag.activeBuses.ghostEffects.activeVoices}v
          </span>
          <span>Horror Events</span>
          <span>
            {Math.round(diag.activeBuses.horrorEvents.gain * 100)}% · {diag.activeBuses.horrorEvents.activeVoices}v
          </span>
          <span>Chase Music</span>
          <span>
            {Math.round(diag.activeBuses.chaseMusic.gain * 100)}% · {diag.activeBuses.chaseMusic.activeVoices}v
          </span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <span>Warehouse Zone</span>
          <strong>
            {diag.warehouseZoneStatus.band} ({diag.warehouseZoneStatus.bedMode})
          </strong>
        </div>
        <div style={{ opacity: 0.8 }}>
          inZone={String(diag.warehouseZoneStatus.inZone)} · preloaded={String(diag.warehouseZoneStatus.preloaded)} ·
          dist={diag.warehouseZoneStatus.distanceM ?? '-'}m · {diag.warehouseZoneStatus.period}
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <span>Current Ghost</span>
          <strong>
            {diag.currentGhostState
              ? `${diag.currentGhostState.ghostId} · ${diag.currentGhostState.state}`
              : 'inactive'}
          </strong>
        </div>
        {diag.currentGhostState && (
          <div style={{ opacity: 0.8 }}>
            dist={diag.currentGhostState.distToPlayerM ?? '-'}m · chase={String(diag.currentGhostState.chaseActive)}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '4px' }}>
        <div>
          Current File: <code data-diag="current-file">{diag.currentAudioFile ?? 'none'}</code>
        </div>
        <div>
          Opus Support:{' '}
          <strong data-diag="opus-support">
            {diag.opusSupport.supported ? 'supported' : 'unsupported (procedural fallback)'}
          </strong>{' '}
          <span style={{ opacity: 0.72 }}>({diag.opusSupport.detail})</span>
        </div>
        <div>
          Last Error:{' '}
          <span data-diag="last-error" style={{ color: diag.lastPlaybackError ? '#fda4af' : '#94a3b8' }}>
            {diag.lastPlaybackError ?? 'none'}
          </span>
        </div>
      </div>

      <button
        type="button"
        data-testid="diag-test-audio-btn"
        disabled={testing}
        onClick={() => void handleTestAudio()}
        style={{
          marginTop: '2px',
          padding: '6px 10px',
          borderRadius: '8px',
          border: '1px solid rgba(125, 211, 252, 0.45)',
          background: 'rgba(14, 116, 144, 0.38)',
          color: '#f8fafc',
          fontWeight: 600,
          cursor: testing ? 'wait' : 'pointer',
        }}
      >
        {testing ? 'Testing Audio…' : '🔊 Test Audio'}
      </button>
    </div>
  );
}

export function AudioDiagnosticsPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  useGhostDevSettings();
  if (!isAudioDiagnosticsAvailable()) return null;
  return <AudioDiagnosticsOverlay defaultOpen={defaultOpen} />;
}

function AudioDiagnosticsOverlay({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const diag = useAudioDiagnostics();

  return (
    <aside
      data-testid="audio-diagnostics-panel"
      aria-label="Development Audio Diagnostics"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: '12px',
        bottom: '84px',
        zIndex: 1200,
        maxWidth: open ? '310px' : 'auto',
        background: 'rgba(10, 17, 24, 0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(148, 163, 184, 0.3)',
        borderRadius: '10px',
        padding: open ? '10px 12px' : '4px 8px',
        color: '#e5eef5',
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <button
          type="button"
          data-testid="audio-diagnostics-toggle"
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#bae6fd',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {open ? '▾ Audio Diag (Dev)' : `🔊 Audio: ${diag.audioContextState}`}
        </button>
        {!open && diag.lastPlaybackError && (
          <span title={diag.lastPlaybackError} style={{ color: '#fda4af', fontSize: '11px' }}>
            ⚠
          </span>
        )}
      </div>
      {open && (
        <div style={{ marginTop: '8px' }}>
          <AudioDiagnosticsContent compact />
        </div>
      )}
    </aside>
  );
}
