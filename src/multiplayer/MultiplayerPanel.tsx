import { useState, useSyncExternalStore } from 'react';
import { useNetworkState } from '../services/networkStatus';
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
  return <details className="multiplayer-panel" hidden={hidden} onPointerDown={e => e.stopPropagation()}
    onWheel={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()}>
    <summary>Multiplayer · {offline && !active ? 'offline' : snapshot.status}{snapshot.status === 'connected' ? ` · ${snapshot.players.length} online` : ''}</summary>
    <p>Presence preview: other players appear near the starting home. Movement and world edits stay local.</p>
    {offline && !active && (
      <div role="status" aria-live="polite" style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(245, 158, 11, 0.16)', color: '#fde68a', fontSize: 12 }}>
        Offline mode: multiplayer presence requires an internet connection. Offline world exploration continues normally.
      </div>
    )}
    <form onSubmit={event => { event.preventDefault(); void session.join(endpoint, name, avatar); }}>
      <label>Name<input value={name} onChange={e => setName(e.target.value)} maxLength={24} required disabled={active} /></label>
      <label>Server<input value={endpoint} onChange={e => setEndpoint(e.target.value)} required disabled={active} /></label>
      <label>Presence avatar<select value={avatar} onChange={e => setAvatar(e.target.value as 'mint' | 'gold')} disabled={active}>
        <option value="mint">Mint robot</option><option value="gold">Gold robot</option>
      </select></label>
      {active ? <button type="button" onClick={session.leave}>{snapshot.status === 'connecting' ? 'Cancel' : 'Leave'}</button>
        : <button type="submit" disabled={offline}>{offline ? 'Offline · Reconnect to Join' : 'Join presence preview'}</button>}
    </form>
    <div role="status" aria-live="polite">{snapshot.error}</div>
    {snapshot.status === 'connected' && <>
      <small>Room: {snapshot.roomId}</small>
      <ul>{snapshot.players.map(player => <li key={player.sessionId}>{player.name}{player.sessionId === snapshot.sessionId ? ' (you)' : ''} · {player.avatar}</li>)}</ul>
    </>}
  </details>;
}
