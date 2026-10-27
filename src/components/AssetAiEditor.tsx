import { useEffect, useRef, useState } from 'react';
import { AssetPreviewCanvas } from './Asset3DRenderer';
import { getAssetDefinition } from '../game/assetRegistry';
import { requestAssetEdit, type AssetEdit } from '../game/assetAiEdit';
import { NeuralGridOverlay } from './NeuralGridLoader';
import './AssetAiEditor.css';

export function AssetAiEditor({ assetId, onClose, onPlace }: { assetId: string; onClose: () => void; onPlace: (id: string, edit: AssetEdit) => void }) {
  const def = getAssetDefinition(assetId)!;
  const initial: AssetEdit = { scale: Array.isArray(def.defaultScale) ? [def.defaultScale[0], def.defaultScale[1], def.defaultScale[2]] : [def.defaultScale, def.defaultScale, def.defaultScale], color: def.defaultColor, roofColor: def.defaultRoofColor };
  const [edit, setEdit] = useState(initial);
  const [past, setPast] = useState<AssetEdit[]>([]);
  const [future, setFuture] = useState<AssetEdit[]>([]);
  const [model, setModel] = useState('gemini-3.8-flash');
  const [key, setKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const apply = (next: AssetEdit) => { setPast(p => [...p.slice(-49), edit]); setFuture([]); setEdit(next); };
  const undo = () => { if (!past.length || busy) return; setFuture(f => [...f, edit]); setEdit(past[past.length - 1]); setPast(p => p.slice(0, -1)); };
  const redo = () => { if (!future.length || busy) return; setPast(p => [...p, edit]); setEdit(future[future.length - 1]); setFuture(f => f.slice(0, -1)); };
  const generate = async () => {
    const controller = new AbortController(); request.current = controller; setBusy(true); setMessage('Gemini ကို တောင်းဆိုနေသည်…');
    try {
      const next = await requestAssetEdit({ apiKey: key, model, prompt, assetName: def.name, current: edit, signal: controller.signal });
      if (!controller.signal.aborted) { apply(next); setMessage('ပြင်ဆင်ပြီးပါပြီ။ Preview ကိုစစ်ပြီး Place လုပ်နိုင်ပါသည်။'); }
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <div
    className="asset-ai-backdrop"
    onClick={e => { if (!busy && e.target === e.currentTarget) onClose(); }}
    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape' && !busy) onClose(); }}
  >
    <section className="asset-ai-dialog" role="dialog" aria-modal="true" aria-label={`${def.name} 3D editor`}>
      <header>
        <strong>{def.name} · {def.nameMm}</strong>
        <button
          type="button"
          className="asset-ai-close-btn"
          aria-label="Close"
          disabled={busy}
          onClick={() => { if (!busy) onClose(); }}
        >
          ✕
        </button>
      </header>
      <div className="asset-ai-body">
        <div className="asset-ai-preview">
          <AssetPreviewCanvas assetId={assetId} edit={edit} />
          {busy && <NeuralGridOverlay title={message || 'AI 3D ပြင်ဆင်နေသည်…'} />}
        </div>
        <div className="asset-ai-controls">
          <p>AI ဖြင့် အရွယ်အစားနှင့် အရောင်ကို ပြင်ပါ။ မော်ဒယ်အချို့တွင် အရောင်ပြောင်းလဲမှု မပါဝင်နိုင်ပါ။ ပုံစံအသစ်ကို မထုတ်ပေးပါ။</p>
          <label>Gemini model<input value={model} onChange={e => setModel(e.target.value)} placeholder="gemini-3.8-flash" /></label>
          <label>Gemini API key<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="API key" /></label>
          <small>Key ကို ဤ dialog ဖွင့်ထားချိန်တွင်သာ မှတ်ထားပြီး Gemini သို့ တိုက်ရိုက်ပို့သည်။ Prompt နှင့် asset အချက်အလက်များလည်း Google သို့ ပို့မည်။</small>
          <label>AI prompt<textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="ဥပမာ — အိမ်ကို နှစ်ဆမြင့်ပြီး ခေါင်မိုးကို အနီရောင်ပြောင်းပါ" rows={4} /></label>
          <button onClick={generate} disabled={busy || !prompt.trim() || !key.trim()}>{busy ? 'ပြင်ဆင်နေသည်…' : '✨ AI ဖြင့် ပြင်မည်'}</button>
          <div className="asset-ai-actions"><button onClick={undo} disabled={!past.length || busy}>↶ Undo</button><button onClick={redo} disabled={!future.length || busy}>↷ Redo</button></div>
          <div aria-live="polite" className="asset-ai-message">{message}</div>
          <button className="asset-ai-place" disabled={busy} onClick={() => { onPlace(assetId, edit); onClose(); }}>➕ ဤပုံစံကို မြေပုံပေါ်ထားမည်</button>
        </div>
      </div>
    </section>
  </div>;
}
