import { useEffect, useRef, useState } from 'react';
import { AssetPreviewCanvas } from './Asset3DRenderer';
import { getBuiltInEdit, saveBuiltInEdit } from '../game/builtInAssetEdits';
import { requestAssetEdit, type AssetEdit } from '../game/assetAiEdit';
import type { AssetDefinition } from '../game/assetRegistry';

export function BuiltInAssetEditor({
  def,
  onSave,
  onBack,
}: {
  def: AssetDefinition;
  onSave: () => void;
  onBack?: () => void;
}) {
  const [edit, setEdit] = useState<AssetEdit>(() => getBuiltInEdit(def.assetId) ?? { scale: [1, 1, 1] });
  const [past, setPast] = useState<AssetEdit[]>([]), [future, setFuture] = useState<AssetEdit[]>([]);
  const [model, setModel] = useState('gemini-3.8-flash'), [key, setKey] = useState(''), [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const change = (next: AssetEdit) => { setPast(p => [...p.slice(-49), edit]); setFuture([]); setEdit(next); };
  const ai = async () => { const controller = new AbortController(); request.current = controller; setBusy(true); setMessage('Gemini ကို တောင်းဆိုနေသည်…'); try { const result = await requestAssetEdit({ apiKey: key, model, prompt, assetName: def.name, current: edit, signal: controller.signal }); if (!controller.signal.aborted) { change(result); setMessage('Preview ကိုစစ်ပြီး သိမ်းနိုင်ပါသည်။'); } } catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : 'Request failed'); } finally { if (!controller.signal.aborted) setBusy(false); } };
  const save = () => { try { setEdit(saveBuiltInEdit(def.assetId, edit)); onSave(); setMessage('Built-in asset ပြင်ဆင်မှုကို သိမ်းပြီးပါပြီ။'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Save failed'); } };

  return (
    <div className="asset-builtin-wrap">
      <div className="asset-list-title">
        <div className="asset-title-left">
          {onBack && (
            <button className="asset-mobile-back-btn" onClick={onBack} title="စာရင်းသို့ ပြန်သွားရန်">
              ← စာရင်းသို့
            </button>
          )}
          <div>
            <span className="asset-list-eyebrow">BUILT-IN ASSET · PREVIEW &amp; EDIT</span>
            <h2>{def.name}</h2>
            <p>{def.nameMm || def.category}</p>
          </div>
        </div>
        <div className="asset-list-buttons">
          <button disabled={busy || !past.length} onClick={() => { setFuture(f => [...f, edit]); setEdit(past[past.length - 1]); setPast(p => p.slice(0, -1)); }}>↶ Undo</button>
          <button disabled={busy || !future.length} onClick={() => { setPast(p => [...p, edit]); setEdit(future[future.length - 1]); setFuture(f => f.slice(0, -1)); }}>↷ Redo</button>
          <button className="primary" disabled={busy} onClick={save}>ပြင်ဆင်မှု သိမ်းမည်</button>
        </div>
      </div>
      <div className="asset-list-editor">
        <div className="asset-list-visual">
          <div className="asset-list-builtin">
            <AssetPreviewCanvas assetId={def.assetId} edit={edit} />
            <span className="asset-preview-badge">3D PREVIEW · BUILT-IN MODEL</span>
          </div>
          <div className="asset-builtin-notes">
            <p>ℹ️ မူရင်း 3D ပုံစံကို ထိန်းသိမ်းထားသည်။ အရောင်ပြောင်းလဲမှုသည် model အလိုက် မတူနိုင်ပါ။</p>
            <p>Editor မှ နေရာချထားသော asset များတွင် အသုံးပြုမည်ဖြစ်ပြီး ရွေးချယ်မှုအရွယ်အစားနှင့် အရောင်များကို စိတ်ကြိုက်ပြောင်းနိုင်ပါသည်။</p>
          </div>
        </div>
        <div className="asset-list-properties">
          <h3>အရွယ်အစားနှင့် စကေး</h3>
          <div className="asset-list-vector">
            {edit.scale.map((v, i) => (
              <label key={i}>
                <span>{['အကျယ် (W)', 'အမြင့် (H)', 'အလျား (D)'][i]}</span>
                <input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={v}
                  onChange={e => {
                    const scale = [...edit.scale] as [number, number, number];
                    scale[i] = Number(e.target.value);
                    change({ ...edit, scale });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="asset-color-options">
            {(['color', 'roofColor'] as const).map(field => (
              <label key={field} className="asset-checkbox-label">
                <div className="asset-checkbox-row">
                  <input
                    type="checkbox"
                    checked={edit[field] !== undefined}
                    onChange={e => {
                      const next = { ...edit };
                      if (e.target.checked) next[field] = field === 'color' ? def.defaultColor ?? '#baa892' : def.defaultRoofColor ?? '#687788';
                      else delete next[field];
                      change(next);
                    }}
                  />
                  <span>{field === 'color' ? 'ကိုယ်ထည် အရောင်' : 'ခေါင်မိုး အရောင်'}</span>
                </div>
                {edit[field] && (
                  <input
                    type="color"
                    className="asset-color-input"
                    value={edit[field]}
                    onChange={e => change({ ...edit, [field]: e.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
          <button className="asset-btn-secondary" onClick={() => change({ scale: [1, 1, 1] })}>
            ↺ မူရင်းပုံစံသို့ ပြန်ထားရန်
          </button>
          <details className="asset-list-ai">
            <summary>✦ AI prompt ဖြင့် ပြင်ဆင်ရန်</summary>
            <label>Gemini model<input value={model} onChange={e => setModel(e.target.value)} /></label>
            <label>API key<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label>
            <label>Prompt<textarea rows={3} placeholder="ဥပမာ - အနီရောင် ခေါင်မိုး၊ အရွယ်အစား အနည်းငယ် ချဲ့ပေးပါ" value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
            <small>Key ကို browser တွင်သာ ယာယီသိမ်းထားပြီး prompt ကို Gemini သို့ ပို့မည်။</small>
            <button disabled={busy || !key.trim() || !prompt.trim()} onClick={ai}>
              {busy ? 'ပြင်ဆင်နေသည်…' : 'AI ဖြင့် ပြင်ရန်'}
            </button>
          </details>
          {message && <p role="status" className="asset-list-message">{message}</p>}
          <small className="asset-notice-text">Built-in asset များသည် ပင်မစနစ်တွင် ပါဝင်ပြီး ဖျက်၍မရပါ။</small>
        </div>
      </div>
    </div>
  );
}
