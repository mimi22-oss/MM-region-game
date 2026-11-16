import { useState, useSyncExternalStore } from 'react';
import { useNetworkState } from '../services/networkStatus';
import type { MultiplayerMode } from '../../shared/network';
import type { MultiplayerSession } from './session';
import './multiplayer.css';

export function MultiplayerPanel({ session, hidden = false }: { session: MultiplayerSession; hidden?: boolean }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const network = useNetworkState();
  const [name, setName] = useState('Guest');
  const [endpoint, setEndpoint] = useState(import.meta.env.VITE_MULTIPLAYER_URL || 'ws://127.0.0.1:2567');
  const [avatar, setAvatar] = useState<'mint' | 'gold'>('mint');
  const active = snapshot.status === 'connected' || snapshot.status === 'connecting';
  const offline = !network.connected;
  const self = snapshot.selfPlayer;
  const primaryGhost = snapshot.ghosts[0] ?? null;

  return <details className="multiplayer-panel" hidden={hidden} onPointerDown={e => e.stopPropagation()}
    onWheel={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()}>
    <summary>Multiplayer · {offline && !active ? 'offline' : snapshot.status}{snapshot.status === 'connected' ? ` · ${snapshot.players.length} nearby` : ''}</summary>
    <p>
      {snapshot.mode === 'authoritative-v2'
        ? 'Authoritative v2: token-authenticated server movement, spatial interest filtering, Ghost AI, and safe-zone combat.'
        : 'Presence v1 (fallback): read-only avatar roster near starting home.'}
    </p>
    {offline && !active && (
      <div role="status" aria-live="polite" style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(245, 158, 11, 0.16)', color: '#fde68a', fontSize: 12 }}>
        Offline mode: multiplayer requires an internet connection. Offline world exploration continues normally.
      </div>
    )}
    <form onSubmit={event => { event.preventDefault(); void session.join(endpoint, name, avatar); }}>
      <label>Mode<select value={snapshot.mode} onChange={e => session.setMode(e.target.value as MultiplayerMode)} disabled={active}>
        <option value="authoritative-v2">Authoritative v2</option>
        <option value="presence-v1">Presence v1 (Rollback)</option>
      </select></label>
      <label>Name<input value={name} onChange={e => setName(e.target.value)} maxLength={24} required disabled={active} /></label>
      <label>Server<input value={endpoint} onChange={e => setEndpoint(e.target.value)} required disabled={active} /></label>
      <label>Avatar<select value={avatar} onChange={e => setAvatar(e.target.value as 'mint' | 'gold')} disabled={active}>
        <option value="mint">Mint robot</option><option value="gold">Gold robot</option>
      </select></label>
      {active ? <button type="button" onClick={session.leave}>{snapshot.status === 'connecting' ? 'Cancel' : 'Leave'}</button>
        : <button type="submit" disabled={offline}>{offline ? 'Offline · Reconnect to Join' : snapshot.mode === 'authoritative-v2' ? 'Join authoritative world' : 'Join presence preview'}</button>}
    </form>
    <div role="status" aria-live="polite">{snapshot.error}</div>
    {snapshot.lastRejection && (
      <div role="status" aria-live="polite" style={{ marginTop: 6, padding: '5px 7px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.2)', color: '#fecaca', fontSize: 12 }}>
        Server check ({snapshot.lastRejection.reason}): {snapshot.lastRejection.message}
      </div>
    )}
    {snapshot.status === 'connected' && <>
      <small>
        Room: {snapshot.roomId} · Mode: {snapshot.mode}
        {snapshot.cellId ? ` · Cell: ${snapshot.cellId}` : ''}
      </small>
      {snapshot.mode === 'authoritative-v2' && self && (
        <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(15, 23, 42, 0.55)', fontSize: 12 }}>
          <div>
            HP: <strong>{self.hp}/{self.maxHp}</strong> · Stamina: <strong>{self.stamina}/{self.maxStamina}</strong>
          </div>
          <div>
            Role: <strong>{self.role}</strong> · {self.inSafeZone ? 'Protected Home' : 'Open World'}
          </div>
          {primaryGhost && (
            <div style={{ marginTop: 6 }}>
              <div>
                Warehouse Ghost ({primaryGhost.state}): <strong>{primaryGhost.hp}/{primaryGhost.maxHp} HP</strong>
              </div>
              {primaryGhost.state !== 'BANISHED' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => session.sendCombatStrike(primaryGhost.id, 'ghost', 'light-strike', self.yaw)}
                  >
                    Light Strike
                  </button>
                  <button
                    type="button"
                    onClick={() => session.sendCombatStrike(primaryGhost.id, 'ghost', 'ward-pulse', self.yaw)}
                  >
                    Ward Pulse
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <ul>{snapshot.players.map(player => <li key={player.sessionId}>{player.name}{player.sessionId === snapshot.sessionId ? ' (you)' : ''} · {player.avatar}</li>)}</ul>
    </>}
  </details>;
}
