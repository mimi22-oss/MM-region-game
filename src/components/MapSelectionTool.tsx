import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { MAP_DESTINATIONS } from '../game/locationDetect';
import { worldMapLabels } from '../data/mapLabels';
import { MapSelectionMap } from './MapSelectionMap';
import './mapSelection.css';
import { layoutMapLabels } from '../game/mapLabels';
import { exportMapSelection, SELECTION_OPERATIONS, movedSelectionPoints, type SelectionOperation, selectionGeometry, selectionDraftError, defaultWaterWidth, selectionLocationText, selectionAiPrompt, FILL_KINDS, GEO_REFERENCES, insideSelection, readSelectionDraft, SELECTION_STORAGE_KEY, selectionError, selectionGeo, selectionMetrics, simplifySelection, suggestGeoReference, type FillKind, type GeoReference, type MapPoint, type MapSelectionDraft } from '../game/mapSelection';
import WardVillageEditor from './WardVillageEditor';

type Mode = 'draw' | 'polygon' | 'pan' | 'pin' | 'destination';
export default function MapSelectionTool({ focus, onClose }: { focus: MapPoint; onClose: () => void }) {
	const dialog = useRef<HTMLDialogElement>(null), svg = useRef<SVGSVGElement>(null), output = useRef<HTMLTextAreaElement>(null), copyField = useRef<HTMLTextAreaElement>(null);
	const [copyFallback, setCopyFallback] = useState('');
	const [draft, setDraft] = useState<MapSelectionDraft>(() => {
		try { const saved = readSelectionDraft(localStorage.getItem(SELECTION_STORAGE_KEY)); if (saved) return saved; } catch { }
		return { points: [], pins: [], name: '', kind: 'mixed', notes: '', reference: suggestGeoReference(focus) };
	});
	const [view, setView] = useState(() => {
		const points = draft.points;
		if (!points.length) return { ...focus, span: 600 };
		const xs = points.map(p => p.x), zs = points.map(p => p.z);
		return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, span: Math.max(120, (Math.max(...xs) - Math.min(...xs)) * 1.6, (Math.max(...zs) - Math.min(...zs)) * 2) };
	});
	const [size, setSize] = useState({ width: 800, height: 600 }), [mode, setMode] = useState<Mode>('draw'), [stroke, setStroke] = useState<MapPoint[]>([]), [notice, setNotice] = useState('');
	const drag = useRef<{ id: number; mode: Mode; start: MapPoint; points: MapPoint[] } | null>(null);
	const geometry = selectionGeometry(draft.kind), line = geometry === 'LineString', operation = draft.operation ?? 'create';
	const shapeError = useMemo(() => selectionError(draft.points, geometry), [draft.points, geometry]);
	const destinationPoints = useMemo(() => operation === 'move' ? movedSelectionPoints(draft) : [], [draft.points, draft.moveTo, draft.kind, operation]);
	const waterWidth = draft.waterWidth ?? defaultWaterWidth(draft.kind);
	const savedDraft = JSON.stringify({ ...draft, ...(draft.waterWidth !== undefined && (!Number.isFinite(draft.waterWidth) || draft.waterWidth < 0.2 || draft.waterWidth > 500) ? { waterWidth: defaultWaterWidth(draft.kind) } : {}) });
	const error = useMemo(() => selectionDraftError(draft), [draft]);
	const metrics = useMemo(() => selectionMetrics(draft.points, geometry), [draft.points, geometry]);
	const changeKind = (kind: FillKind) => { setDraft(old => ({ ...old, kind, moveTo: undefined, waterWidth: selectionGeometry(kind) === 'LineString' ? defaultWaterWidth(kind) : undefined })); if (mode === 'pin' || mode === 'destination') setMode('draw'); setCopyFallback(''); };
	const changeOperation = (next: SelectionOperation) => { setDraft(old => ({ ...old, operation: next, moveTo: undefined })); setMode('draw'); setNotice(''); setCopyFallback(''); };
	const text = useMemo(() => error ? '' : JSON.stringify(exportMapSelection(draft), null, 2), [draft, error]);
	const scale = view.span / size.width, height = scale * size.height;
	const visibleLabels = useMemo(() => {
		const candidates = worldMapLabels.map(label => ({ id: label.id, x: (label.x - view.x) / scale + size.width / 2, y: (label.z - view.z) / scale + size.height / 2, width: Math.min(320, label.name.length * 7), height: 24, priority: label.priority }));
		const ids = new Set(layoutMapLabels(candidates, size.width, size.height, 25).map(label => label.id));
		return worldMapLabels.filter(label => ids.has(label.id));
	}, [view, scale, size]);
	const centerGeo = selectionGeo(metrics.center, draft.reference);
	useEffect(() => {
		const el = dialog.current!; el.showModal();
		const observer = new ResizeObserver(entries => { const r = entries[0].contentRect; if (r.width && r.height) setSize({ width: r.width, height: r.height }); });
		observer.observe(svg.current!);
		const map = svg.current!, preventScroll = (event: WheelEvent) => event.preventDefault();
		map.addEventListener('wheel', preventScroll, { passive: false });
		return () => { observer.disconnect(); map.removeEventListener('wheel', preventScroll); el.close(); };
	}, []);
	useEffect(() => {
		const timer = window.setTimeout(() => { try { localStorage.setItem(SELECTION_STORAGE_KEY, savedDraft); } catch { setNotice('မူကြမ်း သိမ်းမရပါ။ GeoJSON ကို ဒေါင်းလုဒ်ယူထားပါ။'); } }, 300);
		return () => clearTimeout(timer);
	}, [savedDraft]);
	const close = () => { try { localStorage.setItem(SELECTION_STORAGE_KEY, savedDraft); } catch { } onClose(); };
	const pointAt = (event: { clientX: number; clientY: number }): MapPoint => {
		const matrix = svg.current!.getScreenCTM()!;
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
		return { x: point.x, z: point.y };
	};
	const zoom = (factor: number) => setView(old => ({ ...old, span: Math.min(12000, Math.max(25, old.span * factor)) }));
	const begin = (event: ReactPointerEvent<SVGSVGElement>) => {
		if (event.button !== 0 || drag.current) return;
		event.preventDefault();
		const point = pointAt(event), action = event.shiftKey ? 'pan' : mode;
		if (action === 'destination') {
			if (operation !== 'move' || shapeError) return;
			setDraft(old => ({ ...old, moveTo: point, moveReference: suggestGeoReference(point) })); setMode('pan'); setNotice('နေရာအသစ် ရွေးပြီးပါပြီ။ အပြာသည် မူလနေရာ၊ အစိမ်းသည် ရွှေ့မည့်နေရာ ဖြစ်ပါသည်။'); return;
		}
		if (action === 'polygon') {
			if (draft.points.length >= 512) { setNotice('ထောင့်မှတ် ၅၁၂ ခုအထိသာ ရွေးနိုင်ပါတယ်။'); return; }
			setDraft(old => ({ ...old, points: [...old.points, point], pins: [], moveTo: undefined })); setNotice(''); return;
		}
		if (action === 'pin') {
			if (operation !== 'create' || line || error || !insideSelection(point, draft.points)) { setNotice('နယ်နိမိတ်အတွင်းကို နှိပ်၍ တည်နေရာမှတ်ပါ။'); return; }
			if (draft.pins.length >= 100) { setNotice('နေရာမှတ် ၁၀၀ အထိသာ ထည့်နိုင်ပါတယ်။'); return; }
			setDraft(old => ({ ...old, pins: [...old.pins, { ...point, id: `requested-point-${crypto.randomUUID()}`, name: `${FILL_KINDS[old.kind]} ${old.pins.length + 1}`, kind: old.kind }] })); setNotice(''); return;
		}
		svg.current!.setPointerCapture(event.pointerId);
		drag.current = { id: event.pointerId, mode: action, start: point, points: [point] };
		if (action === 'draw') setStroke([point]);
	};
	const move = (event: ReactPointerEvent<SVGSVGElement>) => {
		const active = drag.current;
		if (!active || active.id !== event.pointerId) return;
		const point = pointAt(event);
		if (active.mode === 'pan') {
			setView(old => ({ ...old, x: old.x + active.start.x - point.x, z: old.z + active.start.z - point.z }));
		} else {
			const last = active.points.at(-1)!;
			if (Math.hypot(point.x - last.x, point.z - last.z) < scale * 3) return;
			if (active.points.length >= 2048) return;
			active.points.push(point); setStroke([...active.points]);
		}
	};
	const finish = (event: ReactPointerEvent<SVGSVGElement>, cancel = false) => {
		const active = drag.current;
		if (!active || active.id !== event.pointerId) return;
		drag.current = null; setStroke([]);
		if (svg.current!.hasPointerCapture(event.pointerId)) svg.current!.releasePointerCapture(event.pointerId);
		if (cancel || active.mode !== 'draw') return;
		const end = pointAt(event), last = active.points.at(-1)!;
		if (Math.hypot(end.x - last.x, end.z - last.z) > 0.001) active.points.push(end);
		let points = simplifySelection(active.points, scale * 1.5);
		if (!line && points.length > 3 && Math.hypot(points[0].x - points.at(-1)!.x, points[0].z - points.at(-1)!.z) < scale * 4) points = points.slice(0, -1);
		const invalid = selectionError(points, geometry);
		if (invalid) { setNotice(invalid); return; }
		setDraft(old => ({ ...old, points, pins: [], moveTo: undefined })); setNotice(line ? 'ရေလမ်း ဆွဲပြီးပါပြီ။ အကျယ်နှင့် ညွှန်ကြားချက်ထည့်ပြီး ကူးယူနိုင်ပါတယ်။' : 'နယ်မြေ ရွေးပြီးပါပြီ။ နေရာမှတ်များနှင့် ဖြည့်စွက်လိုသည့်အကြောင်း ရေးနိုင်ပါတယ်။');
	};
	const copy = async (format: 'geojson' | 'coordinates' | 'ai') => {
		const value = format === 'ai' ? selectionAiPrompt(draft) : format === 'coordinates' ? selectionLocationText(draft) : text;
		try { await navigator.clipboard.writeText(value); setCopyFallback(''); setNotice(format === 'ai' ? 'Gemini / AI အတွက် ညွှန်ကြားချက်နှင့် GeoJSON ကူးယူပြီးပါပြီ။ Gemini chat ထဲတွင် Paste လုပ်ပါ။' : 'တည်နေရာအချက်အလက် ကူးယူပြီးပါပြီ။'); }
		catch {
			setCopyFallback(value);
			requestAnimationFrame(() => { copyField.current?.focus(); copyField.current?.select(); });
			setNotice('အောက်က စာသားကို ရွေးထားပါတယ်။ Copy ကူးယူပါ။');
		}
	};
	const download = () => {
		const url = URL.createObjectURL(new Blob([text], { type: 'application/geo+json;charset=utf-8' }));
		const a = document.createElement('a'); a.href = url; a.download = line ? 'map-waterway-request.geojson' : 'map-area-request.geojson'; a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('GeoJSON ဖိုင် ထုတ်ပေးပြီးပါပြီ။');
	};
	return <dialog ref={dialog} className="map-selection-dialog" aria-labelledby="map-selection-title" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } }} onCancel={event => { event.preventDefault(); close(); }}>
		<header className="map-selection-header"><div><h2 id="map-selection-title">နယ်မြေ / ရေလမ်းဆွဲ · တည်နေရာထုတ်ယူရန်</h2><p>နယ်မြေဝိုက်ပါ သို့မဟုတ် ရေလမ်းဆွဲပြီး AI အတွက် တည်နေရာကူးယူပါ။</p></div><button type="button" onClick={close} aria-label="နယ်မြေရွေးချယ်မှု ပိတ်ရန်">✕ ပိတ်မည်</button></header>
		<div className="map-selection-body">
			<section className="map-selection-workspace" aria-label="နယ်မြေရွေးရန် မြေပုံ">
				<div className="map-selection-operation">
					<label>ဘာလုပ်မလဲ <select aria-label="လုပ်ဆောင်ချက်" value={operation} onChange={e => changeOperation(e.target.value as SelectionOperation)}>{Object.entries(SELECTION_OPERATIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
					<p>{operation === 'create' ? 'အသစ်ထည့်မည့်အရာနှင့် နေရာကို ရွေးပါ။' : operation === 'move' ? '၁။ မူလနေရာကို ဝိုက်/မျဉ်းဆွဲပါ။ ၂။ နေရာအသစ်ရွေးရန် နှိပ်ပြီး မြေပုံပေါ်တွင် နှိပ်ပါ။' : operation === 'delete' ? 'ဖျက်လိုသည့်အရာ၏ မူလနေရာကို ရွေးပြီး အမည် သို့မဟုတ် ID ထည့်ပါ။' : 'ပြင်လိုသည့်အရာ၏ မူလနေရာကို ရွေးပြီး ဘာပြင်မလဲ ရေးပါ။'}</p>
				</div>
				<div className="map-selection-jump map-selection-kind">
					<label>ဆွဲမည့်အရာ <select aria-label="ဆွဲမည့်အရာ" value={draft.kind} onChange={e => changeKind(e.target.value as FillKind)}>{Object.entries(FILL_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
					<span>{line ? 'လမ်းကြောင်းမျဉ်း (LineString)' : 'ပိတ်ထားသော ဧရိယာ (Polygon)'}</span>
					{line && <label>ရေလမ်းအကျယ် (မီတာ)<input aria-label="ရေလမ်းအကျယ် မီတာ" type="number" min="0.2" max="500" step="0.1" value={waterWidth} onChange={e => setDraft(old => ({ ...old, waterWidth: Number(e.target.value) }))} onBlur={() => { if (!Number.isFinite(waterWidth) || waterWidth < 0.2 || waterWidth > 500) setDraft(old => ({ ...old, waterWidth: defaultWaterWidth(old.kind) })); }} /></label>}
				</div>
				<div className="map-selection-toolbar">
					{([['draw', line ? 'လက်ဖြင့်မျဉ်းဆွဲ' : 'လက်ဖြင့်ဝိုက်'], ['polygon', line ? 'လမ်းကြောင်းမှတ်ရွေး' : 'ထောင့်မှတ်ရွေး'], ['pan', 'မြေပုံရွှေ့'], ['pin', 'နေရာမှတ်ထည့်']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} disabled={value === 'pin' && (operation !== 'create' || line || !!error)} onClick={() => { setMode(value); setNotice(''); }}>{label}</button>)}
					{operation === 'move' && <button type="button" aria-pressed={mode === 'destination'} disabled={!!shapeError} onClick={() => { setMode('destination'); setNotice('မြေပုံပေါ်မှာ နေရာအသစ်၏ အလယ်ဗဟိုကို နှိပ်ပါ။'); }}>နေရာအသစ်ရွေးရန်</button>}
					<button type="button" onClick={() => zoom(0.65)} aria-label="မြေပုံချဲ့ရန်">＋</button><button type="button" onClick={() => zoom(1.5)} aria-label="မြေပုံချုံ့ရန်">−</button>
					<button type="button" disabled={!draft.points.length} onClick={() => setDraft(old => ({ ...old, points: old.points.slice(0, -1), pins: [], moveTo: undefined }))}>နောက်ဆုံးမှတ်ပြန်ဖျက်</button>
					<button type="button" onClick={() => { setDraft(old => ({ ...old, points: [], pins: [], moveTo: undefined })); setMode('draw'); setNotice(''); }}>{line ? 'အသစ်ဆွဲမည်' : 'အသစ်ဝိုက်မည်'}</button>
				</div>
				<label className="map-selection-jump">နေရာသို့ မြေပုံရွှေ့ရန် <select defaultValue="" onChange={event => { const dest = MAP_DESTINATIONS.find(d => d.id === event.target.value); if (dest) { setView({ x: dest.x, z: dest.z, span: 600 }); if (!draft.points.length) setDraft(old => ({ ...old, reference: suggestGeoReference(dest) })); } }}><option value="" disabled>လက်ရှိ ကင်မရာနေရာ</option>{MAP_DESTINATIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select><button type="button" onClick={() => setView({ ...focus, span: 600 })}>လက်ရှိနေရာ</button></label>
				<svg ref={svg} className={`map-selection-canvas map-selection-canvas--${mode}`} viewBox={`${view.x - view.span / 2} ${view.z - height / 2} ${view.span} ${height}`} aria-label="ဆွဲဝိုက် သို့မဟုတ် ထောင့်မှတ်နှိပ်ရွေးရန် မြေပုံ" onPointerDown={begin} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} onWheel={event => { if (drag.current) return; zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15); }}>
					<MapSelectionMap />
					<g pointerEvents="none">
						{visibleLabels.map(label => <text key={label.id} x={label.x} y={label.z} fontSize={12 * scale} fill="#233b36" stroke="#fff" strokeWidth={3 * scale} paintOrder="stroke" textAnchor="middle">{label.name}</text>)}
						<circle cx={focus.x} cy={focus.z} r={5 * scale} fill="#2768c7" stroke="white" strokeWidth={2 * scale} />
						{draft.points.length > 0 && (line ? <>
							<polyline data-waterway="width" points={draft.points.map(p => `${p.x},${p.z}`).join(' ')} fill="none" stroke="#36a7d9" strokeOpacity={0.45} strokeWidth={Math.max(0.2, Math.min(500, waterWidth))} strokeLinejoin="round" strokeLinecap="round" />
							<polyline data-waterway="centerline" points={draft.points.map(p => `${p.x},${p.z}`).join(' ')} fill="none" stroke={operation === 'delete' ? '#b33f36' : shapeError ? '#b35a18' : '#1260c5'} strokeWidth={2 * scale} />
						</> : <polygon points={draft.points.map(p => `${p.x},${p.z}`).join(' ')} fill="#2684ff33" stroke={operation === 'delete' ? '#b33f36' : shapeError ? '#b35a18' : '#1260c5'} strokeWidth={2 * scale} />)}
						{draft.points.map((p, i) => <circle key={i} cx={p.x} cy={p.z} r={3 * scale} fill="white" stroke="#1260c5" strokeWidth={scale} />)}
						{operation === 'create' && !line && draft.pins.map((p, i) => <g key={p.id}><circle cx={p.x} cy={p.z} r={9 * scale} fill="#a95620" stroke="white" strokeWidth={scale} /><text x={p.x} y={p.z + 4 * scale} textAnchor="middle" fontSize={11 * scale} fill="white">{i + 1}</text></g>)}
						{operation === 'move' && draft.moveTo && destinationPoints.length > 0 && <>
							<line x1={metrics.center.x} y1={metrics.center.z} x2={draft.moveTo.x} y2={draft.moveTo.z} stroke="#168354" strokeWidth={2 * scale} strokeDasharray={`${6 * scale} ${4 * scale}`} />
							{line ? <polyline data-move-destination="true" points={destinationPoints.map(p => `${p.x},${p.z}`).join(' ')} fill="none" stroke="#168354" strokeWidth={Math.max(2 * scale, waterWidth)} strokeOpacity={0.6} /> : <polygon data-move-destination="true" points={destinationPoints.map(p => `${p.x},${p.z}`).join(' ')} fill="#20b77333" stroke="#168354" strokeWidth={2 * scale} />}
							<circle cx={draft.moveTo.x} cy={draft.moveTo.z} r={5 * scale} fill="#168354" />
							<text x={draft.moveTo.x} y={draft.moveTo.z - 12 * scale} textAnchor="middle" fontSize={12 * scale} fill="#125e3e" stroke="white" strokeWidth={2 * scale} paintOrder="stroke">နေရာအသစ်</text>
						</>}
						<polyline points={stroke.map(p => `${p.x},${p.z}`).join(' ')} fill="none" stroke="#1260c5" strokeWidth={2 * scale} />
					</g>
				</svg>
				<p className="map-selection-help">{mode === 'destination' ? 'နေရာအသစ်၏ အလယ်ဗဟိုကို နှိပ်ပါ။ မူလပုံသဏ္ဌာန်နှင့် အရွယ်အစားအတိုင်း ရွှေ့ပေးပါမည်။' : mode === 'draw' ? (line ? 'မြစ် / ချောင်း / မြောင်း အလယ်ကြောင်းကို ဖိဆွဲပါ။ အစနှင့်အဆုံးကို မပိတ်ပါ။' : 'ဖိဆွဲပြီး နယ်မြေကို ဝိုက်ပါ။ လွှတ်လိုက်လျှင် အဝိုက်ကို ပိတ်ပေးပါမည်။') : mode === 'polygon' ? (line ? 'ရေလမ်းတစ်လျှောက် မှတ်များကို အစဉ်လိုက်နှိပ်ပါ။ အနည်းဆုံး ၂ မှတ် ရွေးပါ။' : 'နယ်နိမိတ် ထောင့်နေရာများကို အစဉ်လိုက်နှိပ်ပါ။ အနည်းဆုံး ၃ မှတ် ရွေးပါ။') : mode === 'pin' ? 'အဝိုက်အတွင်း တစ်နေရာချင်း နှိပ်၍ အိမ်၊ သစ်ပင် စသည့်နေရာမှတ် ထည့်ပါ။' : 'မြေပုံကို ဖိဆွဲ၍ ရွှေ့ပါ။'} Scroll / ＋ − ဖြင့် zoom · Shift + ဆွဲ၍ မြေပုံရွှေ့ · မြောက် ↖</p>
			</section>
			<section className="map-selection-details" aria-label="ဖြည့်စွက်လိုသည့် နေရာအချက်အလက်များ">
				<strong className="map-selection-operation-summary">{SELECTION_OPERATIONS[operation]} · {FILL_KINDS[draft.kind]}</strong>
				<label>{operation === 'create' ? 'နေရာ / ရပ်ကွက်နာမည်' : 'မူလအရာ၏ အမည် (သို့မဟုတ် အောက်တွင် ID ထည့်ပါ)'}<input aria-label="နေရာအမည်" value={draft.name} maxLength={160} onChange={e => setDraft(old => ({ ...old, name: e.target.value }))} /></label>
				{operation !== 'create' && <label>မူလအရာ၏ ID (ရှိလျှင်)<input aria-label="မူလအရာ ID" value={draft.targetId ?? ''} maxLength={200} placeholder="ဥပမာ — way/403027623 သို့မဟုတ် custom-label-…" onChange={e => setDraft(old => ({ ...old, targetId: e.target.value }))} /></label>}
				<label>လုပ်ဆောင်မည့်အရာ အမျိုးအစား<select value={draft.kind} onChange={e => changeKind(e.target.value as FillKind)}>{Object.entries(FILL_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
				<label>အသေးစိတ် ညွှန်ကြားချက်<textarea rows={3} value={draft.notes} maxLength={4000} placeholder={operation === 'update' ? 'ဥပမာ — အမိုးကို အနီရောင်ပြောင်းပြီး အဆောက်အဦကို နှစ်ထပ်ဖြစ်အောင် ပြင်ရန်' : operation === 'delete' ? 'ဥပမာ — အမည်/ID ကိုက်ညီသည့် အဆောက်အဦတစ်လုံးကိုသာ ဖျက်ရန်' : operation === 'move' ? 'ဥပမာ — မူလအိမ်ကို အစိမ်းရောင်နေရာသို့ ရွှေ့ပြီး ID နှင့် ပုံစံကို ထိန်းသိမ်းရန်' : 'ဥပမာ — လမ်းဘေးတွင် အိမ် ၅ လုံး၊ အိမ်နောက်တွင် သစ်ပင်များ ဖြည့်ပေးရန်'} onChange={e => setDraft(old => ({ ...old, notes: e.target.value }))} /></label>
				<label>GeoJSON တည်နေရာ အခြေခံဒေတာ<select value={draft.reference} onChange={e => setDraft(old => ({ ...old, reference: e.target.value as GeoReference }))}>{Object.entries(GEO_REFERENCES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
				<button type="button" onClick={() => setDraft(old => ({ ...old, reference: suggestGeoReference(old.points.length ? metrics.center : view) }))}>ရွေးထားသည့်နေရာအလိုက် Reference ရွေးပေးရန်</button>
				<p className="map-selection-help">Latitude/longitude သည် ရွေးထားသော မြေပုံဒေတာကို အခြေခံထားသည့် ခန့်မှန်းတန်ဖိုးဖြစ်သည်။ Game ထဲမှာ အတိအကျပြန်ဖြည့်ရန် X/Z နှင့် U/V ကိုပါ ထုတ်ပေးထားသည်။</p>
				<p>{error || (line ? `အလျား ${metrics.length.toFixed(1)} m · အကျယ် ${waterWidth} m · မှတ် ${draft.points.length} ခု` : `ဧရိယာ ${metrics.area.toFixed(1)} m² · ထောင့်မှတ် ${draft.points.length} ခု`)}</p>
				{!error && <p className="map-selection-coordinates">အလယ်ဗဟို Lat / Lon: {centerGeo.lat.toFixed(7)}, {centerGeo.lon.toFixed(7)}<br />X / Z: {metrics.center.x.toFixed(3)}, {metrics.center.z.toFixed(3)}</p>}
				{operation === 'create' && !line && draft.pins.map((pin, i) => <div className="map-selection-pin" key={pin.id}><label>နေရာမှတ် {i + 1}<input aria-label={`နေရာမှတ် ${i + 1} အမည်`} value={pin.name} maxLength={160} onChange={e => setDraft(old => ({ ...old, pins: old.pins.map(p => p.id === pin.id ? { ...p, name: e.target.value } : p) }))} /></label><select aria-label={`နေရာမှတ် ${i + 1} အမျိုးအစား`} value={pin.kind} onChange={e => setDraft(old => ({ ...old, pins: old.pins.map(p => p.id === pin.id ? { ...p, kind: e.target.value as FillKind } : p) }))}>{Object.entries(FILL_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button type="button" aria-label={`နေရာမှတ် ${i + 1} ဖျက်ရန်`} onClick={() => setDraft(old => ({ ...old, pins: old.pins.filter(p => p.id !== pin.id) }))}>ဖျက်</button></div>)}
				{operation === 'move' && draft.moveTo && <label>နေရာအသစ် GeoJSON Reference<select aria-label="နေရာအသစ် Reference" value={draft.moveReference ?? draft.reference} onChange={e => setDraft(old => ({ ...old, moveReference: e.target.value as GeoReference }))}>{Object.entries(GEO_REFERENCES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
				{operation === 'move' && draft.moveTo && <p className="map-selection-coordinates">မူလ X/Z: {metrics.center.x.toFixed(3)}, {metrics.center.z.toFixed(3)}<br />နေရာအသစ် X/Z: {draft.moveTo.x.toFixed(3)}, {draft.moveTo.z.toFixed(3)}<br />နေရာအသစ် Lat/Lon: {selectionGeo(draft.moveTo, draft.moveReference ?? draft.reference).lat.toFixed(7)}, {selectionGeo(draft.moveTo, draft.moveReference ?? draft.reference).lon.toFixed(7)}</p>}
				<p className="map-selection-help">ရွေးထားသော လုပ်ဆောင်ချက်ကို GeoJSON နှင့် AI ညွှန်ကြားချက်တွင် ထည့်ပေးမည်။ လက်ရှိမြေပုံကို ဤ tool က တိုက်ရိုက်မပြောင်းသေးပါ။</p>
				<div className="map-selection-export"><button type="button" disabled={!!error} onClick={() => copy('geojson')}>GeoJSON ကူးယူမည်</button><button type="button" disabled={!!error} onClick={download}>.geojson ဒေါင်းလုဒ်</button></div>
				<div className="map-selection-export"><button type="button" disabled={!!error} onClick={() => copy('coordinates')}>Geolocation ကူးယူမည်</button><button type="button" disabled={!!error} onClick={() => copy('ai')}>Gemini / AI အတွက် ကူးယူမည်</button></div>
				<p role="status">{notice}</p>
				{copyFallback && <textarea ref={copyField} readOnly rows={8} value={copyFallback} aria-label="ကူးယူရန် တည်နေရာနှင့် AI ညွှန်ကြားချက်" />}
				<details><summary>Coordinates / GeoJSON ကြည့်ရန်</summary><textarea ref={output} readOnly value={text} rows={8} aria-label="နယ်မြေ GeoJSON" /></details>
				<p className="map-selection-help">မူကြမ်းကို ဒီ browser မှာ သိမ်းထားပေးပါသည်။ Gemini / AI အတွက် ကူးယူမည်ကို နှိပ်ပြီး Gemini chat ထဲ Paste လုပ်၍ ခိုင်းနိုင်ပါသည်။</p>
			</section>
		</div>
	</dialog>;
}
