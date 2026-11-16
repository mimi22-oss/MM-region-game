import { useState, memo } from 'react';
import { isGhostDevUiAvailable } from '../game/ghostConfig.ts';
import {
  useGhostDebugStore,
  setSelectedGhostId,
  setGizmosEnabled,
  setGhostDebugOverlayOpen,
  type GhostTelemetryRecord,
} from '../game/audio/ghostDebugStore.ts';

export const GhostAiDebugOverlay = memo(function GhostAiDebugOverlay() {
  if (!isGhostDevUiAvailable()) return null;
  return <GhostAiDebugOverlayInternal />;
});

function GhostAiDebugOverlayInternal() {
  const store = useGhostDebugStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!store.overlayOpen) {
    return (
      <button
        type="button"
        data-testid="ghost-ai-debug-open-button"
        onClick={() => setGhostDebugOverlayOpen(true)}
        style={{
          position: 'fixed',
          right: '12px',
          top: '64px',
          zIndex: 1250,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '8px',
          color: '#38bdf8',
          fontSize: '11px',
          fontWeight: 700,
          padding: '6px 10px',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
        }}
      >
        👻 Ghost AI ({store.ghosts.length})
      </button>
    );
  }

  const selectedGhost = store.selectedGhostId === 'all'
    ? store.ghosts[0]
    : store.ghosts.find((g) => g.ghostId === store.selectedGhostId);

  return (
    <aside
      data-testid="ghost-ai-debug-overlay"
      aria-label="Development Ghost AI Telemetry Overlay"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        right: '12px',
        top: '64px',
        zIndex: 1250,
        width: collapsed ? 'auto' : '360px',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: collapsed ? 'visible' : 'auto',
        background: 'rgba(10, 15, 29, 0.92)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '10px',
        padding: '10px 12px',
        color: '#e2e8f0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '11px',
        lineHeight: 1.35,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'auto',
      }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#38bdf8' }}>
          <span>👻</span>
          <span>Ghost AI Telemetry</span>
          <span style={{ fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 4px', borderRadius: '4px' }}>5Hz</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▢' : '—'}
          </button>
          <button
            type="button"
            onClick={() => setGhostDebugOverlayOpen(false)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
          {/* Controls: Selector + 3D Gizmos toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setSelectedGhostId('all')}
                style={{
                  background: store.selectedGhostId === 'all' ? '#0284c7' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                }}
              >
                All ({store.ghosts.length})
              </button>
              {store.ghosts.map((g) => (
                <button
                  key={g.ghostId}
                  type="button"
                  onClick={() => setSelectedGhostId(g.ghostId)}
                  style={{
                    background: store.selectedGhostId === g.ghostId ? '#0284c7' : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '2px 6px',
                    cursor: 'pointer',
                  }}
                >
                  {g.ghostId}
                </button>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={store.gizmosEnabled}
                onChange={(e) => setGizmosEnabled(e.target.checked)}
              />
              3D Gizmos
            </label>
          </div>

          {store.ghosts.length === 0 ? (
            <div style={{ color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>
              No active ghosts in haunt zone. (Night window or near warehouse required).
            </div>
          ) : selectedGhost ? (
            <GhostCard ghost={selectedGhost} />
          ) : (
            <div style={{ display: 'grid', gap: '6px' }}>
              {store.ghosts.map((g) => (
                <GhostCard key={g.ghostId} ghost={g} compact />
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function GhostCard({ ghost, compact = false }: { ghost: GhostTelemetryRecord; compact?: boolean }) {
  const isChasing = ghost.state === 'CHASING' || ghost.state === 'GRABBING';
  const isObserving = ghost.state === 'OBSERVING_PLAYER' || ghost.state === 'SCARING';
  const stateColor = isChasing ? '#f87171' : isObserving ? '#fbbf24' : '#38bdf8';

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '6px',
        padding: '8px',
        display: 'grid',
        gap: '6px',
      }}
    >
      {/* 1. Entity Identity & Lifecycle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
        <div>
          <strong style={{ color: '#fff' }}>{ghost.ghostId}</strong>{' '}
          <span style={{ color: '#94a3b8' }}>({ghost.personality})</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', fontSize: '10px' }}>
          <span style={{ color: ghost.mountStatus === 'ready' ? '#4ade80' : '#f87171' }}>{ghost.mountStatus}</span>
          <span style={{ color: '#94a3b8' }}>·</span>
          <span style={{ color: ghost.inactivityReason === 'active' ? '#4ade80' : '#fbbf24' }}>{ghost.inactivityReason}</span>
        </div>
      </div>

      {/* 2. State & Sensing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
        <div>
          <span style={{ color: '#94a3b8' }}>State: </span>
          <strong style={{ color: stateColor }}>{ghost.state}</strong>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Detect: </span>
          <span>{ghost.detectionRadiusM}m</span>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Dist: </span>
          <strong>{ghost.distToPlayerM}m</strong>{' '}
          <span style={{ fontSize: '9px', color: ghost.playerDistDeltaM < 0 ? '#f87171' : '#4ade80' }}>
            ({ghost.playerDistDeltaM > 0 ? `+${ghost.playerDistDeltaM}` : ghost.playerDistDeltaM}m)
          </span>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Safe-Zone: </span>
          <span style={{ color: ghost.safeZoneStatus === 'outside' ? '#94a3b8' : '#38bdf8' }}>{ghost.safeZoneStatus}</span>
        </div>
      </div>

      {ghost.lastStateTransition && (
        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
          Transition: {ghost.lastStateTransition.from} → {ghost.lastStateTransition.to} ({ghost.lastStateTransition.ageSec}s ago)
        </div>
      )}

      {/* 3. Movement & Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px' }}>
        <div>
          <span style={{ color: '#94a3b8' }}>Target: </span>
          <span>({ghost.targetPosition.x}, {ghost.targetPosition.z})</span>
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Speed: </span>
          <span>{ghost.velocityMps} m/s</span>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <span style={{ color: '#94a3b8' }}>Path: </span>
          <span>{ghost.pathfindingStatus}</span>{' '}
          <span style={{ fontSize: '9px', color: '#94a3b8' }}>({ghost.replanRatePerSec} replans/s)</span>
        </div>
      </div>

      {/* 4. Combat & Cooldowns */}
      {!compact && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px' }}>
          <div>
            <span style={{ color: '#94a3b8' }}>Encounter: </span>
            <span>{ghost.encounterStats.encounterCount}/{ghost.encounterStats.chaseThreshold}</span>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Grabs: </span>
            <span>{ghost.encounterStats.grabCount}</span>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Scare CD: </span>
            <span>{ghost.attackCooldown.scareCooldownTimer}s</span>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Grab Phase: </span>
            <span>{ghost.attackCooldown.grabPhase}</span>
          </div>
        </div>
      )}

      {/* 5. Audio & Performance */}
      {!compact && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', display: 'grid', gap: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Audio Event:</span>
            <span>{ghost.lastAudioEvent.cue ?? 'none'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Active Voices:</span>
            <span>{ghost.activeVoiceCount.total} total ({ghost.activeVoiceCount.opus} opus, {ghost.activeVoiceCount.synth} synth)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span style={{ color: '#94a3b8' }}>Context State:</span>
            <span style={{ color: '#38bdf8' }}>{ghost.audioContextState}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
            <span>AI: {ghost.microTimings.aiMs}ms · Audio: {ghost.microTimings.audioMs}ms</span>
            <span>{ghost.fps} FPS ({ghost.frameMs}ms)</span>
          </div>
        </div>
      )}
    </div>
  );
}
