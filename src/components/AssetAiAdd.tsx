import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { generateCustomAsset, saveCustomAsset, type CustomAsset } from '../game/customAssets';
import { registerCustomAsset } from '../game/assetRegistry';
import { CustomAssetModel } from './CustomAssetModel';
import { NeuralGridOverlay } from './NeuralGridLoader';
import './AssetAiEditor.css';

export function AssetAiAdd({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const [model, setModel] = useState('gemini-3.8-flash');
  const [key, setKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [asset, setAsset] = useState<CustomAsset | null>(null);
  const [past, setPast] = useState<(CustomAsset | null)[]>([]);
  const [future, setFuture] = useState<(CustomAsset | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const generate = async () => {
    const controller = new AbortController(); request.current = controller; setBusy(true); setMessage('3D ပုံစံ ဖန်တီးနေသည်…');
    try { const next = await generateCustomAsset({ key, model, prompt, signal: controller.signal, onRetry: () => setMessage('Gemini ခေတ္တမအားလပ်သဖြင့် ခဏစောင့်ပြီး ပြန်စမ်းနေသည်…') }); if (!controller.signal.aborted) { setPast(p => [...p.slice(-19), asset]); setFuture([]); setAsset(next); setMessage('Preview ကို စစ်ပြီး Asset Library ထဲ သိမ်းနိုင်ပါသည်။'); } }
    catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : 'Request failed.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const save = () => { if (!asset) return; try { const saved = saveCustomAsset(asset); registerCustomAsset(saved); onSaved(saved.id); onClose(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Save failed.'); } };
  const span = asset ? Math.max(...asset.dimensions) : 8;
  return <div
    className="asset-ai-backdrop"
    onClick={e => { if (!busy && e.target === e.currentTarget) onClose(); }}
    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape' && !busy) onClose(); }}
  ><section className="asset-ai-dialog" role="dialog" aria-modal="true" aria-label="AI 3D add">
    <header>
      <strong>✨ AI 3D Asset အသစ်ဖန်တီးရန်</strong>
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
    <div className="asset-ai-body"><div className="asset-ai-preview" style={{ background: '#0f172a' }}>
      {asset ? <Canvas key={asset.id} camera={{ position: [span * 1.5, span * 1.2, span * 1.5], fov: 45, near: 0.01, far: 1000 }} onCreated={({ camera }) => camera.lookAt(0, asset.dimensions[1] / 2, 0)}><ambientLight intensity={1.4} /><directionalLight position={[10, 20, 10]} intensity={2} /><CustomAssetModel asset={asset} /></Canvas> : (!busy && <p style={{ padding: 20, color: '#cbd5e1' }}>ဖန်တီးပြီးနောက် 3D preview ကို ဤနေရာတွင် ပြပါမည်။</p>)}
      {busy && <NeuralGridOverlay title={message || 'AI 3D ဖန်တီးနေသည်…'} />}
    </div><div className="asset-ai-controls">
      <p>ရိုးရှင်းသော 3D အစိတ်အပိုင်းများဖြင့် asset အသစ် ဖန်တီးပါ။</p>
      <label>Gemini model<input value={model} onChange={e => setModel(e.target.value)} /></label>
      <label>Gemini API key<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label>
      <small>Key ကို ဤ dialog ဖွင့်ထားချိန်တွင်သာ မှတ်ထားပြီး prompt ကို Gemini သို့ ပို့ပါမည်။ Asset ကို ဤစက်ပေါ်တွင် သိမ်းပါမည်။</small>
      <label>လိုချင်သော 3D asset<textarea rows={4} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="ဥပမာ — အနီရောင်ခေါင်မိုးနဲ့ သစ်သားအိမ်လေး" /></label>
      <button disabled={busy || !key.trim() || !prompt.trim()} onClick={generate}>{busy ? 'ဖန်တီးနေသည်…' : '✨ ဖန်တီးမည်'}</button>
      <div className="asset-ai-actions"><button disabled={busy || !past.length} onClick={() => { setFuture(f => [...f, asset]); setAsset(past[past.length - 1]); setPast(p => p.slice(0, -1)); }}>↶ Undo</button><button disabled={busy || !future.length} onClick={() => { setPast(p => [...p, asset]); setAsset(future[future.length - 1]); setFuture(f => f.slice(0, -1)); }}>↷ Redo</button></div>
      {asset && <><label>Asset name<input value={asset.name} maxLength={80} onChange={e => setAsset({ ...asset, name: e.target.value })} /></label><label>မြန်မာအမည်<input value={asset.nameMm} maxLength={100} onChange={e => setAsset({ ...asset, nameMm: e.target.value })} /></label></>}
      <div className="asset-ai-message" aria-live="polite">{message}</div><button className="asset-ai-place" disabled={!asset || busy} onClick={save}>💾 Asset Library ထဲ သိမ်းမည်</button>
    </div></div>
  </section></div>;
}
