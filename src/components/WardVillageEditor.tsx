import React, { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
	aiLayoutPrompt,
	downloadLayout,
	emptyLayout,
	type FeatureKind,
	type LayoutFeature,
	type Point2,
	type WorldLayout,
	validLayout,
} from '../game/worldLayout';
import './WardVillageEditor.css';
import {
	REGIONS,
	regionCenter,
	loadRegionLayout,
	saveRegionLayout,
	importGeoJSONFeatures,
} from '../game/editorRegions';
import { ExistingRegionPlan } from './ExistingRegionPlan';
import './EditorExtensions.css';
import {
	ASSET_REGISTRY,
	ASSET_LIST,
	ASSET_CATEGORIES,
	searchAssets,
	getAssetDefinition,
	type AssetCategory,
	type AssetDefinition,
} from '../game/assetRegistry';
import { AssetAiEditor } from './AssetAiEditor';
import { AssetAiAdd } from './AssetAiAdd';
import type { AssetEdit } from '../game/assetAiEdit';
import { getBuiltInEdit } from '../game/builtInAssetEdits';
import { getRegionAuthoredFeatures } from '../game/regionObjectsMigration';
import { deleteSelection, editVertex, expandGroups, extendLine, joinLines, removeVertex, transformSelection } from '../game/layoutTransforms';

const icons: Record<FeatureKind, string> = {
	ward: '🗺️',
	block: '🔲',
	road: '🛣️',
	house: '🏠',
	school: '🏫',
	hospital: '🏥',
	office: '🏢',
	shop: '🛒',
	market: '🏬',
	tree: '🌳',
	toilet: '🚽',
	well: '🪣',
	religious: '⛩️',
	farm: '🌾',
	furniture: '🪑',
	vehicle: '🚗',
	cultural: '🪔',
	custom: '📍',
};

const objectKinds: FeatureKind[] = [
	'house',
	'school',
	'hospital',
	'office',
	'shop',
	'market',
	'tree',
	'toilet',
	'well',
	'religious',
	'farm',
	'furniture',
	'vehicle',
	'cultural',
	'custom',
];

const isShape = (kind: FeatureKind) => kind === 'ward' || kind === 'block';
const isLine = (kind: FeatureKind) => kind === 'road';
const isPathOrLine = (f?: LayoutFeature | null) => {
	if (!f) return false;
	return f.kind === 'road' || f.metadata?.category === 'canal' || f.metadata?.category === 'drain' || (f.points && f.points.length >= 2 && !isShape(f.kind));
};
const uid = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const path = (points: Point2[], closed = false) =>
	points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.z}`).join(' ') + (closed ? ' Z' : '');

const centroid = (pts: Point2[]) => ({
	x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
	z: pts.reduce((a, p) => a + p.z, 0) / pts.length,
});

/**
 * Renders a mini 2D footprint SVG thumbnail for asset cards in the library.
 */
function AssetCardThumbnail({ def }: { def: AssetDefinition }) {
	const fp = def.footprint;
	const w = fp.defaultWidth;
	const d = fp.defaultDepth;
	const maxDim = Math.max(w, d, 1);
	const pad = maxDim * 0.2;
	const span = maxDim + pad * 2;

	return (
		<svg
			viewBox={`${-span / 2} ${-span / 2} ${span} ${span}`}
			width="100%"
			height="100%"
			style={{ display: 'block' }}
		>
			{fp.shape === 'circle' ? (
				<circle cx={0} cy={0} r={w / 2} fill={fp.color} stroke={fp.stroke} strokeWidth={span * 0.04} />
			) : (
				<rect
					x={-w / 2}
					y={-d / 2}
					width={w}
					height={d}
					fill={fp.color}
					stroke={fp.stroke}
					strokeWidth={span * 0.04}
					rx={Math.min(w, d) * 0.06}
				/>
			)}
			{fp.roofRidge && (
				<line
					x1={0}
					y1={-d / 2}
					x2={0}
					y2={d / 2}
					stroke="#1e293b"
					strokeWidth={span * 0.03}
					strokeDasharray={`${span * 0.05} ${span * 0.03}`}
				/>
			)}
			{fp.subElements?.map((sub, idx) =>
				sub.type === 'rect' ? (
					<rect
						key={idx}
						x={sub.x}
						y={sub.y}
						width={sub.width}
						height={sub.height}
						fill={sub.color || '#94a3b8'}
						stroke={sub.stroke || '#475569'}
						strokeWidth={span * 0.02}
					/>
				) : sub.type === 'circle' ? (
					<circle
						key={idx}
						cx={sub.x}
						cy={sub.y}
						r={sub.r}
						fill={sub.color || '#94a3b8'}
						stroke={sub.stroke || '#475569'}
						strokeWidth={span * 0.02}
					/>
				) : null
			)}
		</svg>
	);
}

export default function WardVillageEditor({
	initialCenter = { x: 0, z: 0 },
	onClose,
}: {
	initialCenter?: Point2;
	onClose?: () => void;
}) {
	const [region, setRegion] = useState('myothar');
	const [layout, setLayout] = useState<WorldLayout>(() => loadRegionLayout('myothar'));
	const [reference, setReference] = useState<{
		url: string;
		opacity: number;
		x: number;
		z: number;
		width: number;
		height: number;
	} | null>(null);

	const imageFile = useRef<HTMLInputElement>(null);
	const geoFile = useRef<HTMLInputElement>(null);
	const [history, setHistory] = useState<WorldLayout[]>([]);
	const [future, setFuture] = useState<WorldLayout[]>([]);

	// Editor mode & sidebar tabs
	const [sidebarTab, setSidebarTab] = useState<'draw' | 'assets'>('assets');
	const [kind, setKind] = useState<FeatureKind>('house');
	const [mode, setMode] = useState<'draw' | 'select' | 'box' | 'pan'>('select');
	const [draft, setDraft] = useState<Point2[]>([]);
	const [selection, setSelection] = useState<string[]>([]);
	const selected = selection[0] ?? null;
	const setSelected = (id: string | null) => { setSelection(id ? [id] : []); setVertex(null); };
	const [vertex, setVertex] = useState<number | null>(null);
	const [extendEnd, setExtendEnd] = useState<'start' | 'end' | null>(null);
	const [selectionBox, setSelectionBox] = useState<{ start: Point2; end: Point2 } | null>(null);
	const [groupSelectMode, setGroupSelectMode] = useState(true);
	const [moveStep, setMoveStep] = useState(5);
	const [turnDegrees, setTurnDegrees] = useState(15);
	const [resizePercent, setResizePercent] = useState(110);
	const [savedLayout, setSavedLayout] = useState(layout);
	const dirty = layout !== savedLayout;
	const layoutRef = useRef(layout);
	layoutRef.current = layout;
	const updateLayout = (next: WorldLayout) => { layoutRef.current = next; setLayout(next); };

	// Asset Library State
	const [assetSearchQuery, setAssetSearchQuery] = useState('');
	const [assetCategory, setAssetCategory] = useState<AssetCategory | undefined>(undefined);
	const [placingAssetId, setPlacingAssetId] = useState<string | null>(null);
	const [placingEdit, setPlacingEdit] = useState<AssetEdit | null>(null);
	const [previewModalAssetId, setPreviewModalAssetId] = useState<string | null>(null);
	const [showAssetAdd, setShowAssetAdd] = useState(false);
	const [assetRevision, setAssetRevision] = useState(0);

	// Label visibility toggle on 2D map
	const [showNames, setShowNames] = useState<boolean>(() => {
		return localStorage.getItem('mm-editor-show-names') === 'true';
	});

	// Viewport
	const [view, setView] = useState(() => ({
		...regionCenter('myothar', initialCenter),
		span: 1100,
	}));
	const [roadWidth, setRoadWidth] = useState(5);
	const [message, setMessage] = useState(
		'Asset Library ready. Select an asset to place on map or use 3D preview.'
	);

	const svg = useRef<SVGSVGElement>(null);
	const file = useRef<HTMLInputElement>(null);
	const drag = useRef<{ pointer: number; last: Point2; start: Point2; before: WorldLayout; ids?: string[]; vertex?: number; box?: boolean; additive?: boolean; changed?: boolean } | null>(null);
	const [size, setSize] = useState({ w: 900, h: 600 });

	useEffect(() => {
		if (!svg.current) return;
		const observer = new ResizeObserver((entries) => {
			const r = entries[0].contentRect;
			if (r.width && r.height) setSize({ w: r.width, h: r.height });
		});
		observer.observe(svg.current);
		return () => observer.disconnect();
	}, []);

	const scale = view.span / Math.max(1, size.w);
	const height = (view.span * size.h) / Math.max(1, size.w);

	const commit = (next: WorldLayout, before = layoutRef.current) => {
		if (next === before) return;
		setHistory((h) => [...h.slice(-49), before]);
		setFuture([]);
		updateLayout(next);
		setSavedLayout(next);
		try {
			saveRegionLayout(region, next);
		} catch (e) {
			console.warn('Auto-save error:', e);
		}
	};

	const save = () => {
		try {
			saveRegionLayout(region, layoutRef.current);
			setSavedLayout(layoutRef.current);
			setMessage('သိမ်းပြီးပါပြီ — 3D မြေပုံကို ပြောင်းလဲပြီးပါပြီ။ Saved to this device.');
		} catch {
			setMessage('Local save failed. Export JSON to keep your work.');
		}
	};

	const undo = () => {
		if (!history.length) return;
		const previous = history[history.length - 1];
		setHistory((h) => h.slice(0, -1));
		setFuture((f) => [...f, layout]);
		updateLayout(previous);
		setSavedLayout(previous);
		try { saveRegionLayout(region, previous); } catch { }
	};

	const redo = () => {
		if (!future.length) return;
		const next = future[future.length - 1];
		setFuture((f) => f.slice(0, -1));
		setHistory((h) => [...h, layout]);
		updateLayout(next);
		setSavedLayout(next);
		try { saveRegionLayout(region, next); } catch { }
	};

	const handleClose = () => {
		try {
			saveRegionLayout(region, layoutRef.current);
			setSavedLayout(layoutRef.current);
		} catch (e) {
			console.warn('Auto-save on close error:', e);
		}
		onClose?.();
	};

	const pointAt = (event: { clientX: number; clientY: number }): Point2 => {
		const rect = svg.current!.getBoundingClientRect();
		return {
			x: view.x + ((event.clientX - rect.left) / rect.width - 0.5) * view.span,
			z: view.z + ((event.clientY - rect.top) / rect.height - 0.5) * height,
		};
	};

	const current = layout.features.find((f) => f.id === selected);

	// Create drawn feature
	const create = (points: Point2[], type = kind) => {
		const minimum = isShape(type) ? 3 : isLine(type) ? 2 : 1;
		if (points.length < minimum) {
			setMessage(`Need at least ${minimum} point(s).`);
			return;
		}
		const feature: LayoutFeature = {
			id: uid(),
			kind: type,
			name: `${type} ${layout.features.filter((f) => f.kind === type).length + 1}`,
			points,
			width: isLine(type) ? roadWidth : undefined,
			size: 8,
			wardId: type === 'ward' ? undefined : layout.features.find((f) => f.kind === 'ward')?.id,
			isCustomPlaced: true,
		};
		commit({ ...layout, features: [...layout.features, feature] });
		setDraft([]);
		setSelected(feature.id);
		setMessage(`Created ${feature.name}`);
	};

	// Place 3D asset instance
	const placeAssetInstance = (point: Point2, assetId: string) => {
		const def = getAssetDefinition(assetId);
		if (!def) return;

		const kindMap: Record<AssetCategory, FeatureKind> = {
			buildings: 'house',
			nature: 'tree',
			infrastructure: 'custom',
			furniture: 'furniture',
			vehicles: 'vehicle',
			cultural: 'cultural',
		};

		const newFeature: LayoutFeature = {
			id: uid(),
			kind: kindMap[def.category] || 'custom',
			name: `${def.name} ${layout.features.filter((f) => f.assetId === def.assetId).length + 1}`,
			assetId: def.assetId,
			points: [point],
			rotation: def.defaultRotation,
			dimensions: { ...def.defaultDimensions },
			scale: placingEdit?.scale ?? def.defaultScale,
			color: placingEdit?.color ?? def.defaultColor,
			roofColor: placingEdit?.roofColor ?? def.defaultRoofColor,
			isCustomPlaced: true,
		};

		commit({ ...layout, features: [...layout.features, newFeature] });
		setSelected(newFeature.id);
		setPlacingEdit(null);
		setMode('select');
		setMessage(`Placed ${newFeature.name} at X:${point.x.toFixed(1)} Z:${point.z.toFixed(1)}`);
	};

	const down = (e: ReactPointerEvent<SVGSVGElement>) => {
		// Right-click (2) or middle-click (1) pans freely in any mode
		if (e.button === 1 || e.button === 2) {
			e.preventDefault();
			const p = pointAt(e);
			drag.current = { pointer: e.pointerId, last: p, start: p, before: layoutRef.current };
			svg.current?.setPointerCapture(e.pointerId);
			return;
		}
		if (e.button !== 0) return;
		e.preventDefault();
		const p = pointAt(e);
		const begin = (extra: Partial<NonNullable<typeof drag.current>>) => {
			drag.current = { pointer: e.pointerId, last: p, start: p, before: layoutRef.current, ...extra };
			svg.current?.setPointerCapture(e.pointerId);
		};

		if (mode === 'pan' || e.shiftKey) {
			begin({});
			return;
		}

		if (extendEnd && current && isPathOrLine(current)) {
			patch(extendLine(current, p, extendEnd));
			setVertex(extendEnd === 'start' ? 0 : current.points.length);
			return;
		}

		if (mode === 'box') {
			setSelectionBox({ start: p, end: p });
			begin({ box: true, additive: e.ctrlKey || e.metaKey });
			return;
		}

		if (placingAssetId) {
			placeAssetInstance(p, placingAssetId);
			return;
		}

		if (mode === 'select') {
			const target = (e.target as Element).closest('[data-feature-id]');
			const id = target?.getAttribute('data-feature-id') || null;
			const vertexElement = (e.target as Element).closest('[data-vertex]');
			if (id && vertexElement) {
				const index = Number(vertexElement.getAttribute('data-vertex'));
				setVertex(index);
				begin({ ids: [id], vertex: index });
				return;
			}
			setVertex(null);
			if (id) {
				const shouldExpand = (groupSelectMode && !e.altKey) || (!groupSelectMode && e.altKey);
				const ids = shouldExpand ? expandGroups(layout, [id]) : [id];
				if (e.ctrlKey || e.metaKey) {
					setSelection(old => old.includes(id) ? old.filter(item => !ids.includes(item)) : [...new Set([...old, ...ids])]);
					return;
				}
				const moving = selection.includes(id) ? selection : ids;
				setSelection(moving);
				begin({ ids: moving });
			} else {
				// On mobile touch on empty canvas, pan the map!
				if (e.pointerType === 'touch') {
					begin({});
				} else {
					setSelectionBox({ start: p, end: p });
					begin({ box: true, additive: e.ctrlKey || e.metaKey });
				}
			}
			return;
		}

		if (isShape(kind) || isLine(kind)) {
			setDraft((old) => [...old, p]);
		} else {
			create([p]);
		}
	};

	const move = (e: ReactPointerEvent<SVGSVGElement>) => {
		const d = drag.current;
		if (!d || d.pointer !== e.pointerId) return;
		const p = pointAt(e);
		if (d.box) {
			d.last = p;
			setSelectionBox({ start: d.start, end: p });
		} else if (d.ids) {
			const dx = p.x - d.start.x, dz = p.z - d.start.z;
			d.changed = Math.hypot(dx, dz) > 0.001;
			if (d.vertex !== undefined) {
				updateLayout({ ...d.before, features: d.before.features.map(f => f.id === d.ids![0] ? editVertex(f, d.vertex!, p) : f) });
			} else updateLayout(transformSelection(d.before, d.ids, { dx, dz }));
		} else {
			const dx = p.x - d.last.x, dz = p.z - d.last.z;
			setView((old) => ({ ...old, x: old.x - dx, z: old.z - dz }));
		}
	};

	const up = (e: ReactPointerEvent<SVGSVGElement>, cancelled = false) => {
		const d = drag.current;
		if (!d || d.pointer !== e.pointerId) return;
		drag.current = null;
		if (svg.current?.hasPointerCapture(e.pointerId)) {
			svg.current.releasePointerCapture(e.pointerId);
		}
		if (d.box) {
			if (!cancelled) {
				const minX = Math.min(d.start.x, d.last.x), maxX = Math.max(d.start.x, d.last.x);
				const minZ = Math.min(d.start.z, d.last.z), maxZ = Math.max(d.start.z, d.last.z);
				const ids = expandGroups(layout, layout.features.filter(f => f.points.every(p => p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ)).map(f => f.id));
				setSelection(old => d.additive ? [...new Set([...old, ...ids])] : ids);
				setVertex(null);
			}
			setSelectionBox(null);
		} else if (d.ids) {
			if (cancelled || !d.changed) updateLayout(d.before);
			else commit(layoutRef.current, d.before);
		}
	};

	const finish = () => {
		if (draft.length) create(draft);
	};

	const patch = (change: Partial<LayoutFeature>) => {
		if (!selected) return;
		if (selection.length > 1 && change.rotation !== undefined && current) {
			commit(transformSelection(layout, selection, { angle: change.rotation - (current.rotation ?? 0) }));
			return;
		}
		if (selection.length > 1 && change.points?.length === 1 && current?.points.length === 1) {
			commit(transformSelection(layout, selection, { dx: change.points[0].x - current.points[0].x, dz: change.points[0].z - current.points[0].z }));
			return;
		}
		commit({
			...layout,
			features: layout.features.map((f) => (f.id === selected ? { ...f, ...change } : f)),
		});
	};

	const deleteSelected = () => {
		if (!selection.length) return;
		commit(deleteSelection(layout, selection));
		setSelected(null);
	};

	const duplicateSelected = () => {
		const groups = new Map<string, string>();
		const copies = layout.features.filter(f => selection.includes(f.id)).map(f => {
			if (f.groupId && !groups.has(f.groupId)) groups.set(f.groupId, uid());
			const metadata = Object.fromEntries(Object.entries(f.metadata ?? {}).filter(([key]) => key !== 'authored' && !key.startsWith('source')));
			return { ...f, id: uid(), groupId: f.groupId ? groups.get(f.groupId) : undefined, name: `${f.name} copy`, metadata, isCustomPlaced: true, points: f.points.map(p => ({ x: p.x + 10, z: p.z + 10 })) };
		});
		commit({ ...layout, features: [...layout.features, ...copies] });
		setSelection(copies.map(f => f.id));
	};

	const cancelInteraction = () => {
		const active = drag.current;
		drag.current = null;
		if (active) {
			updateLayout(active.before);
			if (svg.current?.hasPointerCapture(active.pointer)) svg.current.releasePointerCapture(active.pointer);
		}
		setSelectionBox(null);
		setDraft([]);
		setExtendEnd(null);
		setPlacingAssetId(null);
		setMode('select');
	};

	useEffect(() => {
		const key = (e: KeyboardEvent) => {
			const editing = (e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]');
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
			if (editing) return;
			if (e.key === 'Escape') {
				if (showAssetAdd || previewModalAssetId) return;
				const hadActive = Boolean(drag.current || selectionBox || draft.length || placingAssetId || extendEnd);
				cancelInteraction();
				if (!hadActive && onClose) {
					e.preventDefault();
					handleClose();
				}
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
			if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
		};
		window.addEventListener('keydown', key, true);
		return () => window.removeEventListener('keydown', key, true);
	});

	useEffect(() => {
		if (!dirty) return;
		const leave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
		window.addEventListener('beforeunload', leave);
		return () => window.removeEventListener('beforeunload', leave);
	}, [dirty]);

	const counts = useMemo(
		() =>
			layout.features.reduce((a, f) => {
				a[f.kind] = (a[f.kind] || 0) + 1;
				return a;
			}, {} as Record<string, number>),
		[layout]
	);

	const filteredAssets = useMemo(() => {
		return searchAssets(assetSearchQuery, assetCategory);
	}, [assetSearchQuery, assetCategory, assetRevision]);

	const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		if (!f) return;
		try {
			const parsed: unknown = JSON.parse(await f.text());
			if (!validLayout(parsed)) throw Error('Invalid layout schema');
			commit(parsed);
			setDraft([]);
			setSelected(null);
			setMessage('Imported layout successfully.');
		} catch (err) {
			setMessage(`Import failed: ${String(err)}`);
		}
		e.target.value = '';
	};

	const handleImportAuthoredObjects = () => {
		const authored = getRegionAuthoredFeatures(region);
		if (!authored.length) {
			setMessage(`No authored objects configured for region '${region}'.`);
			return;
		}
		const existingIds = new Set(layout.features.map((f) => f.id));
		const toAdd = authored.filter((f) => !existingIds.has(f.id));
		if (!toAdd.length) {
			setMessage(`All ${authored.length} authored objects for '${region}' are already in the layout.`);
			return;
		}
		const restored = new Set(toAdd.map(f => f.metadata?.sourceId));
		commit({ ...layout, features: [...layout.features, ...toAdd], deletedSourceIds: layout.deletedSourceIds?.filter(id => !restored.has(id)) });
		setSelection(toAdd.map(f => f.id));
		setMessage(`Imported ${toAdd.length} authored 3D objects into editable layout.`);
	};

	return (
		<div className="wve-root">
			{showAssetAdd && <AssetAiAdd onClose={() => setShowAssetAdd(false)} onSaved={(id) => { setAssetRevision(n => n + 1); setAssetSearchQuery(''); setAssetCategory(undefined); setMessage(`Asset အသစ် သိမ်းပြီးပါပြီ: ${getAssetDefinition(id)?.name ?? id}`); }} />}
			{/* 3D Preview Modal */}
			{previewModalAssetId && (
				<AssetAiEditor
					assetId={previewModalAssetId}
					onClose={() => setPreviewModalAssetId(null)}
					onPlace={(id, edit) => {
						setPlacingAssetId(id);
						setPlacingEdit(edit);
						setMode('draw');
						const def = getAssetDefinition(id);
						setMessage(`Click on 2D map to place instance of: ${def?.name ?? id}`);
					}}
				/>
			)}

			{/* Redesigned Unified Editor Header */}
			<header className="wve-header">
				<div className="wve-header-top">
					<div className="wve-header-brand">
						<span className="wve-brand-icon">🗺️</span>
						<div className="wve-brand-text">
							<span className="wve-title wve-label-full">Myanmar Town Editor</span>
							<span className="wve-title wve-label-short">MM Editor</span>
							<span className="wve-subtitle">2D World & 3D Asset Studio</span>
						</div>
					</div>

					<div className="wve-header-inputs">
						<div className="wve-input-pill" title="Village / Layout Name">
							<span className="wve-pill-label">Name:</span>
							<input
								className="wve-name-input"
								aria-label="Village name"
								value={layout.name}
								onChange={(e) => commit({ ...layout, name: e.target.value })}
								placeholder="Village Name"
							/>
						</div>

						<div className="wve-input-pill" title="Active Region">
							<span className="wve-pill-label">Region:</span>
							<select
								className="wve-region-select"
								value={region}
								onChange={(e) => {
									const id = e.target.value;
									if (dirty && !window.confirm('Save မလုပ်ရသေးသော အပြောင်းအလဲများကို ပယ်ဖျက်ပြီး ရွာပြောင်းမလား? Discard unsaved changes?')) return;
									setRegion(id);
									const next = loadRegionLayout(id);
									updateLayout(next);
									setSavedLayout(next);
									setView((v) => ({ ...v, ...regionCenter(id, initialCenter), span: 1100 }));
									setHistory([]);
									setFuture([]);
									setSelected(null);
									setDraft([]);
									setExtendEnd(null);
									setPlacingAssetId(null);
									setMessage(`Loaded region '${id}'.`);
								}}
							>
								{REGIONS.map((r) => (
									<option key={r.id} value={r.id}>
										{r.name}
									</option>
								))}
							</select>
						</div>
					</div>

					<div className="wve-header-actions">
						<button
							className="wve-btn-primary"
							title="Save edits and update the 3D world (Ctrl/Cmd+S)"
							onClick={save}
						>
							💾 Save{dirty ? ' *' : ''}
						</button>
						<button
							className="wve-btn-discard"
							disabled={!dirty}
							onClick={() => {
								if (!window.confirm('Unsaved edits အားလုံးကို ပယ်ဖျက်မလား?')) return;
								cancelInteraction(); updateLayout(savedLayout); setHistory([]); setFuture([]); setSelected(null);
								setMessage('Unsaved changes discarded.');
							}}
						>
							<span className="wve-label-full">Discard</span>
							<span className="wve-label-short">↺</span>
						</button>
						<button className="wve-btn-export" title="Export layout as JSON file" onClick={() => downloadLayout(layout)}>
							📤 Export
						</button>
						<button className="wve-btn-import" title="Import village layout JSON" onClick={() => file.current?.click()}>
							📥 Import
						</button>
						<button
							className="wve-btn-ai"
							title="Copy prompt for AI village recreation"
							onClick={() =>
								navigator.clipboard.writeText(aiLayoutPrompt(layout)).then(
									() => setMessage('AI prompt copied.'),
									() => setMessage('Clipboard blocked; export JSON instead.')
								)
							}
						>
							✨ AI Prompt
						</button>

						{onClose && (
							<button
								type="button"
								className="wve-close-btn"
								disabled={showAssetAdd || !!previewModalAssetId}
								onClick={handleClose}
								title={showAssetAdd || previewModalAssetId ? '3D မော်ဒယ် တည်းဖြတ်နေချိန် Close ကို ပိတ်ထားပါသည်' : 'Save & Close Editor'}
								aria-label="Save & Close Editor"
							>
								✕<span className="wve-label-full"> Close</span>
							</button>
						)}
					</div>
				</div>

				{/* Unified Tools Bar */}
				<div className="wve-header-tools">
					<div className="wve-tools-left">
						<button
							className="wve-tool-btn wve-mobile-only"
							title="Export layout as JSON file"
							onClick={() => downloadLayout(layout)}
						>
							📤 Export
						</button>
						<button
							className="wve-tool-btn wve-mobile-only"
							title="Import village layout JSON"
							onClick={() => file.current?.click()}
						>
							📥 Import
						</button>
						<button
							className="wve-tool-btn wve-mobile-only"
							title="Copy prompt for AI village recreation"
							onClick={() =>
								navigator.clipboard.writeText(aiLayoutPrompt(layout)).then(
									() => setMessage('AI prompt copied.'),
									() => setMessage('Clipboard blocked; export JSON instead.')
								)
							}
						>
							✨ AI
						</button>

						<button
							className="wve-tool-btn highlight"
							title="Import authored 3D buildings, roads and trees for this region into editable features"
							onClick={handleImportAuthoredObjects}
						>
							<span className="wve-label-full">📥 Import Region 3D Objects</span>
							<span className="wve-label-short">📥 3D Objects</span>
						</button>

						<button
							className={`wve-tool-btn ${groupSelectMode ? 'active' : ''}`}
							title="Group Selection Mode: When ON, selecting any part of a group (e.g. goalpost of a football pitch) selects the whole group. Hold Alt when clicking to select a single part."
							onClick={() => {
								setGroupSelectMode((v) => !v);
								setMessage(!groupSelectMode ? 'Group Selection Mode: Clicking an item selects the whole assembly.' : 'Part Selection Mode: Clicking selects only the individual item.');
							}}
						>
							<span className="wve-label-full">{groupSelectMode ? '🔗 Group Mode (အစု)' : '🎯 Part Mode (တစ်ခုတည်း)'}</span>
							<span className="wve-label-short">{groupSelectMode ? '🔗 Group' : '🎯 Part'}</span>
						</button>

						<button
							className="wve-tool-btn"
							title="Import GeoJSON features"
							onClick={() => geoFile.current?.click()}
						>
							<span className="wve-label-full">📂 Import GeoJSON</span>
							<span className="wve-label-short">📂 GeoJSON</span>
						</button>

						<button
							className={`wve-tool-btn ${reference ? 'active' : ''}`}
							title="Upload reference overlay image"
							onClick={() => imageFile.current?.click()}
						>
							<span className="wve-label-full">🖼️ {reference ? 'Change Reference Image' : 'Add Reference Image'}</span>
							<span className="wve-label-short">🖼️ {reference ? 'Ref Image' : '+ Image'}</span>
						</button>

						{reference && (
							<div className="wve-reference-controls">
								<span className="wve-tool-label">Opacity:</span>
								<input
									type="range"
									min="0"
									max="1"
									step="0.05"
									value={reference.opacity}
									onChange={(e) =>
										setReference((v) => v && { ...v, opacity: Number(e.target.value) })
									}
								/>
								<button
									className="wve-tool-btn-sm"
									onClick={() =>
										setReference(
											(v) => v && { ...v, x: view.x, z: view.z, width: view.span, height: height }
										)
									}
								>
									Fit View
								</button>
								<button className="wve-tool-btn-sm danger" onClick={() => setReference(null)}>
									Remove
								</button>
							</div>
						)}
					</div>

					<div className="wve-tools-right">
						<button
							type="button"
							className={`wve-name-toggle-btn ${showNames ? 'active' : ''}`}
							title="2D မြေပုံပေါ်တွင် အမည်များ ဖော်ပြခြင်း/ဖျောက်ခြင်း Toggle (Names On/Off)"
							onClick={() => {
								const next = !showNames;
								setShowNames(next);
								try {
									localStorage.setItem('mm-editor-show-names', String(next));
								} catch { }
								setMessage(next ? '🏷️ အမည်များ ပြထားသည် (Names shown on map)' : '🏷️ အမည်များ ဖျောက်ထားသည် (Names hidden on map)');
							}}
						>
							<span className={`wve-toggle-indicator ${showNames ? 'on' : 'off'}`}>
								{showNames ? '✓' : ''}
							</span>
							<span className="wve-label-full">🏷️ အမည်များ ပြရန် (Names)</span>
							<span className="wve-label-short">🏷️ အမည်များ</span>
						</button>
						<span className="wve-badge-pill">
							<span className="wve-label-full">Region: </span><strong>{REGIONS.find((r) => r.id === region)?.name.split(' ')[0] ?? region}</strong>
						</span>
						<span className="wve-badge-pill">
							<strong>{layout.features.length}</strong> <span className="wve-label-full">Features</span><span className="wve-label-short">ခု</span>
						</span>
					</div>
				</div>

				<input ref={file} type="file" accept=".json,application/json" hidden onChange={importFile} />
				<input
					ref={imageFile}
					hidden
					type="file"
					accept="image/png,image/jpeg,image/webp"
					onChange={(e) => {
						const f = e.target.files?.[0];
						if (f) {
							if (reference) URL.revokeObjectURL(reference.url);
							setReference({
								url: URL.createObjectURL(f),
								opacity: 0.65,
								x: view.x,
								z: view.z,
								width: view.span,
								height: height,
							});
						}
						e.target.value = '';
					}}
				/>
				<input
					ref={geoFile}
					hidden
					type="file"
					accept=".geojson,.json,application/json"
					onChange={async (e) => {
						const f = e.target.files?.[0];
						if (!f) return;
						try {
							const json = JSON.parse(await f.text());
							const result = importGeoJSONFeatures(json);
							commit({ ...layout, features: [...layout.features, ...result] });
							setMessage(`Imported ${result.length} mapped features.`);
						} catch (err) {
							setMessage(`GeoJSON import error: ${String(err)}`);
						}
						e.target.value = '';
					}}
				/>
			</header>

			{/* Main Workspace Grid: Sidebar | 2D Map Canvas | Inspector */}
			<div className="wve-main">
				{/* Left Sidebar */}
				<aside className="wve-sidebar">
					{/* Tab Switcher */}
					<div className="wve-tabs">
						<button
							className={sidebarTab === 'assets' ? 'active' : ''}
							onClick={() => setSidebarTab('assets')}
						>
							📦 3D Asset Library
						</button>
						<button
							className={sidebarTab === 'draw' ? 'active' : ''}
							onClick={() => {
								setSidebarTab('draw');
								setPlacingAssetId(null);
							}}
						>
							✏️ Draw Shapes
						</button>
					</div>

					{/* Mode Controls */}
					<div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
						<button
							className={mode === 'select' && !placingAssetId ? 'active' : ''}
							style={{ flex: 1 }}
							onClick={() => {
								setMode('select');
								setPlacingAssetId(null);
								setDraft([]);
							}}
						>
							↖ Select / Move
						</button>
						<button
							className={mode === 'pan' ? 'active' : ''}
							style={{ flex: 1 }}
							onClick={() => {
								setMode('pan');
								setPlacingAssetId(null);
								setDraft([]);
							}}
						>
							✋ Pan
						</button>
					</div>

					<div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
						<button onClick={undo} disabled={!history.length} style={{ flex: 1 }}>
							↶ Undo
						</button>
						<button onClick={redo} disabled={!future.length} style={{ flex: 1 }}>
							↷ Redo
						</button>
					</div>
					<button className={mode === 'box' ? 'active' : ''} onClick={() => {
						setMode('box'); setPlacingAssetId(null); setExtendEnd(null); setDraft([]);
					}}>▧ Box select / တစ်စုရွေးရန်</button>

					{/* TAB 1: 3D ASSET LIBRARY */}
					{sidebarTab === 'assets' && (
						<div>
							{placingAssetId && (
								<div
									style={{
										padding: '8px',
										background: '#fef08a',
										borderRadius: '6px',
										marginBottom: '8px',
										fontSize: '11px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
									}}
								>
									<span>
										➕ Click map to place: <strong>{getAssetDefinition(placingAssetId)?.name}</strong>
									</span>
									<button
										onClick={() => {
											setPlacingAssetId(null);
											setMode('select');
											setMessage('Placement cancelled.');
										}}
										style={{ padding: '2px 6px', fontSize: '10px' }}
									>
										Cancel
									</button>
								</div>
							)}

							{/* Search Box */}
							<button onClick={() => setShowAssetAdd(true)} style={{ width: '100%', marginBottom: 10 }}>✨ AI 3D Add · Asset အသစ်ဖန်တီးရန်</button>
							<div className="wve-asset-search">
								<input
									type="text"
									placeholder="🔍 Search 3D assets..."
									value={assetSearchQuery}
									onChange={(e) => setAssetSearchQuery(e.target.value)}
								/>
							</div>

							{/* Category Filter Pills */}
							<div className="wve-category-pills">
								<button
									className={assetCategory === undefined ? 'active' : ''}
									onClick={() => setAssetCategory(undefined)}
								>
									All ({ASSET_LIST.length})
								</button>
								{ASSET_CATEGORIES.map((cat) => (
									<button
										key={cat.id}
										className={assetCategory === cat.id ? 'active' : ''}
										onClick={() => setAssetCategory(cat.id)}
									>
										{cat.icon} {cat.label}
									</button>
								))}
							</div>

							{/* Asset Cards List */}
							<div className="wve-asset-list">
								{filteredAssets.map((def) => (
									<div
										key={def.assetId}
										className={`wve-asset-card ${placingAssetId === def.assetId ? 'selected' : ''}`}
										onClick={() => setPreviewModalAssetId(def.assetId)}
									>
										<div className="wve-asset-thumb">
											<AssetCardThumbnail def={def} />
										</div>
										<div className="wve-asset-info">
											<div className="wve-asset-title" title={def.name}>
												{def.name}
											</div>
											<div className="wve-asset-subtitle" title={def.nameMm}>
												{def.nameMm}
											</div>
											<div className="wve-asset-meta">
												{def.defaultDimensions.width}m × {def.defaultDimensions.depth}m ·{' '}
												{def.category}
											</div>
										</div>
										<div className="wve-asset-actions">
											<button
												title="3D Interactive Preview"
												onClick={(e) => { e.stopPropagation(); setPreviewModalAssetId(def.assetId); }}
											>
												👁️ 3D
											</button>
											<button
												className={placingAssetId === def.assetId ? 'active' : ''}
												title="Place instance on 2D Map"
												onClick={(e) => {
													e.stopPropagation();
													setPlacingEdit(null);
													setPlacingAssetId(def.assetId);
													setMode('draw');
													setMessage(`Click on 2D map to place instance of: ${def.name}`);
												}}
											>
												➕ Place
											</button>
										</div>
									</div>
								))}
								{filteredAssets.length === 0 && (
									<div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
										No assets matched "{assetSearchQuery}".
									</div>
								)}
							</div>
						</div>
					)}

					{/* TAB 2: VECTOR DRAWING TOOLS */}
					{sidebarTab === 'draw' && (
						<div>
							<h3>Drawing tools</h3>
							<div className="wve-toolgrid">
								{(['ward', 'block', 'road', ...objectKinds] as FeatureKind[]).map((k) => (
									<button
										key={k}
										className={kind === k && mode === 'draw' && !placingAssetId ? 'active' : ''}
										onClick={() => {
											setKind(k);
											setMode('draw');
											setPlacingAssetId(null);
											setDraft([]);
										}}
									>
										{icons[k]} {k}
									</button>
								))}
							</div>

							{isLine(kind) && mode === 'draw' && (
								<label>
									Road width (m)
									<input
										type="number"
										min="0.5"
										max="100"
										value={roadWidth}
										onChange={(e) => setRoadWidth(Math.max(0.5, Number(e.target.value) || 0.5))}
									/>
								</label>
							)}

							{draft.length > 0 && (
								<>
									<p>{draft.length} points in draft</p>
									<button onClick={finish}>✓ Finish shape</button>
									<button onClick={() => setDraft([])}>Cancel drawing</button>
								</>
							)}
						</div>
					)}

					<hr />
					<h3>Village summary</h3>
					{Object.entries(counts).map(([k, v]) => (
						<div key={k}>
							{icons[k as FeatureKind] || '📍'} {k}: {v}
						</div>
					))}
					<p className="wve-help">
						Ctrl/Cmd + click: ရွေးချယ်မှုထပ်ထည့်။ Blank map ကို ဆွဲဝိုက်ပြီး တစ်စုရွေးပါ။
						Shift + drag: pan · wheel: zoom · Esc: cancel · Ctrl/Cmd+S: Save.
					</p>
				</aside>

				{/* Center: 2D Map SVG Viewport */}
				<div className="wve-map">
					<svg
						ref={svg}
						className={mode === 'pan' ? 'panning' : ''}
						viewBox={`${view.x - view.span / 2} ${view.z - height / 2} ${view.span} ${height}`}
						preserveAspectRatio="none"
						onPointerDown={down}
						onPointerMove={move}
						onPointerUp={up}
						onPointerCancel={(e) => up(e, true)}
						onDoubleClick={(e) => {
							e.preventDefault();
							if (mode === 'draw') finish();
						}}
						onWheel={(e) => {
							e.preventDefault();
							if (e.ctrlKey || e.metaKey) {
								const factor = e.deltaY > 0 ? 1.12 : 0.89;
								setView((v) => ({
									...v,
									span: Math.max(15, Math.min(30000, v.span * factor)),
								}));
							} else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
								// Horizontal trackpad swipe or mouse wheel scroll right-to-left
								const dx = e.deltaX * scale;
								setView((v) => ({ ...v, x: v.x + dx }));
							} else if (e.shiftKey) {
								// Shift + wheel scrolls horizontally
								const dx = (e.deltaY || e.deltaX) * scale;
								setView((v) => ({ ...v, x: v.x + dx }));
							} else {
								const factor = e.deltaY > 0 ? 1.12 : 0.89;
								setView((v) => ({
									...v,
									span: Math.max(15, Math.min(30000, v.span * factor)),
									x: v.x + (e.deltaX ? e.deltaX * scale : 0),
								}));
							}
						}}
						onContextMenu={(e) => e.preventDefault()}
					>
						{/* Background grass/terrain */}
						<rect
							x={view.x - view.span / 2}
							y={view.z - height / 2}
							width={view.span}
							height={height}
							fill="#d6dfc8"
						/>

						{/* Reference Image */}
						{reference && (
							<image
								href={reference.url}
								x={reference.x - reference.width / 2}
								y={reference.z - reference.height / 2}
								width={reference.width}
								height={reference.height}
								opacity={reference.opacity}
								preserveAspectRatio="none"
								pointerEvents="none"
							/>
						)}

						{/* Read-only existing region background when layout has no features */}
						{layout.features.length === 0 && <ExistingRegionPlan region={region} />}

						{/* Render Layout Features */}
						{layout.features.map((f) => {
							const polygon = isShape(f.kind);
							const isCanal = f.metadata?.category === 'canal' || f.metadata?.category === 'drain';
							const pathLine = isLine(f.kind) || isCanal || (f.points.length >= 2 && !polygon);
							const p = f.points[0];
							if (!p) return null;

							const isSelected = selection.includes(f.id);
							const def = getAssetDefinition(f.assetId);

							// 1. RENDER POLYGON SHAPE
							if (polygon) {
								const strokeColor = isSelected
									? '#ef4444'
									: f.kind === 'ward'
										? '#2563eb'
										: '#d97706';
								const fillColor = f.kind === 'ward' ? '#60a5fa20' : '#fbbf2430';
								return (
									<g
										key={f.id}
										data-feature-id={f.id}
										style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
									>
										<path
											d={path(f.points, true)}
											fill={fillColor}
											stroke={strokeColor}
											strokeWidth={Math.max(scale * 2, 1)}
											vectorEffect="non-scaling-stroke"
										>
											<title>{f.name}</title>
										</path>
										{showNames && (
											<text
												x={centroid(f.points).x}
												y={centroid(f.points).z}
												textAnchor="middle"
												fontSize={Math.max(2, scale * 12)}
												fill="#172554"
												stroke="#ffffff"
												strokeWidth={Math.max(0.8, scale * 2.5)}
												paintOrder="stroke fill"
												strokeLinejoin="round"
												fontWeight="700"
												pointerEvents="none"
											>
												{f.name}
											</text>
										)}
									</g>
								);
							}

							// 2. RENDER ROAD OR CANAL RIBBON
							if (pathLine) {
								const strokeColor = isSelected ? '#ef4444' : isCanal ? '#0284c7' : '#888780';
								return (
									<g
										key={f.id}
										data-feature-id={f.id}
										style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
									>
										<path
											d={path(f.points)}
											fill="none"
											stroke={strokeColor}
											strokeWidth={f.width || (isCanal ? 4 : 5)}
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<title>{f.name}</title>
										</path>
										{showNames && (
											<text
												x={centroid(f.points).x}
												y={centroid(f.points).z}
												textAnchor="middle"
												fontSize={Math.max(2, scale * 11)}
												fill={isCanal ? '#0369a1' : '#1e293b'}
												stroke="#ffffff"
												strokeWidth={Math.max(0.8, scale * 2.5)}
												paintOrder="stroke fill"
												strokeLinejoin="round"
												fontWeight="600"
												pointerEvents="none"
											>
												{f.name}
											</text>
										)}
									</g>
								);
							}

							// 3. RENDER ASSET / POINT FEATURE WITH ACCURATE SVG FOOTPRINT
							const builtinEdit = def?.customModel ? undefined : getBuiltInEdit(f.assetId);
							const w = (f.dimensions?.width ?? def?.defaultDimensions.width ?? f.size ?? 8) * (Array.isArray(f.scale) ? f.scale[0] : (f.scale ?? 1)) * (builtinEdit?.scale[0] ?? 1);
							const d = (f.dimensions?.depth ?? def?.defaultDimensions.depth ?? f.size ?? 8) * (Array.isArray(f.scale) ? f.scale[2] : (f.scale ?? 1)) * (builtinEdit?.scale[2] ?? 1);
							// In SVG, positive rotation is clockwise. Three.js rotation is in radians.
							const rotDeg = -((f.rotation ?? 0) * 180) / Math.PI;
							const fp = def?.footprint;

							return (
								<g
									key={f.id}
									data-feature-id={f.id}
									transform={`translate(${p.x}, ${p.z}) rotate(${rotDeg})`}
									style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
								>
									{/* Accurate Asset Footprint */}
									{fp?.shape === 'circle' ? (
										<ellipse
											cx={0}
											cy={0}
											rx={w / 2}
											ry={d / 2}
											fill={f.color || fp.color}
											stroke={isSelected ? '#ef4444' : fp.stroke}
											strokeWidth={Math.max(scale * 1.5, 0.4)}
										/>
									) : (
										<rect
											x={-w / 2}
											y={-d / 2}
											width={w}
											height={d}
											fill={f.color || fp?.color || (isSelected ? '#fde68a' : '#ffffffdd')}
											stroke={isSelected ? '#ef4444' : fp?.stroke || '#334155'}
											strokeWidth={Math.max(scale * 1.5, 0.4)}
											rx={Math.min(w, d) * 0.06}
										/>
									)}

									{/* Roof Ridge Line */}
									{fp?.roofRidge && (
										<line
											x1={0}
											y1={-d / 2}
											x2={0}
											y2={d / 2}
											stroke="#1e293b"
											strokeWidth={Math.max(scale * 0.8, 0.3)}
											strokeDasharray={`${scale * 2} ${scale}`}
										/>
									)}

									{/* Footprint Sub-elements */}
									{fp?.subElements?.map((sub, idx) =>
										sub.type === 'rect' ? (
											<rect
												key={idx}
												x={sub.x}
												y={sub.y}
												width={sub.width}
												height={sub.height}
												fill={sub.color || '#94a3b8'}
												stroke={sub.stroke || '#475569'}
												strokeWidth={Math.max(scale * 0.5, 0.2)}
											/>
										) : sub.type === 'circle' ? (
											<circle
												key={idx}
												cx={sub.x}
												cy={sub.y}
												r={sub.r}
												fill={sub.color || '#94a3b8'}
												stroke={sub.stroke || '#475569'}
												strokeWidth={Math.max(scale * 0.5, 0.2)}
											/>
										) : null
									)}

									{/* Center Icon badge */}
									<circle
										cx={0}
										cy={0}
										r={Math.max(2.5, scale * 6)}
										fill="#ffffffdd"
										stroke="#475569"
										strokeWidth={Math.max(scale * 0.5, 0.2)}
									/>
									<text
										x={0}
										y={0}
										textAnchor="middle"
										dominantBaseline="central"
										fontSize={Math.max(7, scale * 10)}
										pointerEvents="none"
									>
										{icons[f.kind] || '📍'}
									</text>

									{/* Selection indicator & Front facing orientation arrow */}
									{isSelected && (
										<>
											<rect
												x={-w / 2 - scale * 2}
												y={-d / 2 - scale * 2}
												width={w + scale * 4}
												height={d + scale * 4}
												fill="none"
												stroke="#ef4444"
												strokeWidth={Math.max(scale * 1.2, 0.4)}
												strokeDasharray={`${scale * 3} ${scale * 2}`}
											/>
											{/* Orientation arrow pointing forward (along -Z / Top) */}
											<polygon
												points={`0,${-d / 2 - scale * 7} ${-scale * 3.5},${-d / 2 - scale * 2} ${scale * 3.5},${-d / 2 - scale * 2}`}
												fill="#ef4444"
											/>
										</>
									)}

									<title>{f.name}</title>

									{/* Label */}
									{showNames && (
										<text
											x={0}
											y={d / 2 + Math.max(2, scale * 12)}
											textAnchor="middle"
											fontSize={Math.max(1.8, scale * 10)}
											fill="#0f172a"
											stroke="#ffffff"
											strokeWidth={Math.max(0.6, scale * 2)}
											paintOrder="stroke fill"
											strokeLinejoin="round"
											fontWeight="600"
											pointerEvents="none"
										>
											{f.name}
										</text>
									)}
								</g>
							);
						})}

						{/* Handles stay in world coordinates, including closed polygon rings. */}
						{selection.length === 1 && current && (isPathOrLine(current) || isShape(current.kind)) && mode === 'select' && !placingAssetId && (
							<g data-feature-id={current.id}>
								{current.points.map((p, i) => (
									<circle key={i} data-vertex={i} cx={p.x} cy={p.z} r={scale * 6}
										fill={vertex === i ? '#f59e0b' : '#38bdf8'} stroke="#0369a1" strokeWidth={scale * 1.8}
										style={{ cursor: 'grab' }}><title>အမှတ် {i + 1} - ဆွဲရွှေ့ပြီး အကွေ့ပြင်ပါ (Vertex {i + 1}: drag to reshape curve)</title></circle>
								))}
							</g>
						)}
						{selectionBox && <rect
							x={Math.min(selectionBox.start.x, selectionBox.end.x)} y={Math.min(selectionBox.start.z, selectionBox.end.z)}
							width={Math.abs(selectionBox.end.x - selectionBox.start.x)} height={Math.abs(selectionBox.end.z - selectionBox.start.z)}
							fill="#2563eb22" stroke="#2563eb" strokeWidth={scale * 1.5} strokeDasharray={`${scale * 5} ${scale * 3}`} pointerEvents="none"
						/>}

						{/* Drawing draft points */}
						{draft.length > 0 && (
							<>
								<path
									d={path(draft)}
									fill="none"
									stroke="#ec4899"
									strokeWidth={Math.max(scale * 3, 1)}
									strokeDasharray={`${scale * 7} ${scale * 4}`}
								/>
								{draft.map((pt, i) => (
									<circle key={i} cx={pt.x} cy={pt.z} r={scale * 5} fill="#ec4899" />
								))}
							</>
						)}
					</svg>

					{/* Map controls & badge */}
					<div className="wve-map-controls">
						<button
							type="button"
							className="wve-map-ctrl-btn"
							title="Zoom in (ချဲ့ရန်)"
							onClick={() => setView((v) => ({ ...v, span: Math.max(15, v.span * 0.8) }))}
						>
							＋
						</button>
						<button
							type="button"
							className="wve-map-ctrl-btn"
							title="Zoom out (ချုံ့ရန်)"
							onClick={() => setView((v) => ({ ...v, span: Math.min(30000, v.span * 1.25) }))}
						>
							－
						</button>
						<button
							type="button"
							className="wve-map-ctrl-btn"
							title="Center view (အလယ်သို့)"
							onClick={() => {
								const c = regionCenter(region, initialCenter);
								setView((v) => ({ ...v, x: c.x, z: c.z, span: 1100 }));
							}}
						>
							⊙
						</button>
					</div>

					<div className="wve-mapbadge">
						X {view.x.toFixed(0)} · Z {view.z.toFixed(0)} · span {view.span.toFixed(0)}m
					</div>

					<button
						type="button"
						className="wve-map-scroll-down-btn"
						title="Scroll to inspector and tools below"
						onClick={() => {
							const el = document.querySelector('.wve-inspector') || document.querySelector('.wve-sidebar');
							el?.scrollIntoView({ behavior: 'smooth' });
						}}
					>
						⬇️ Tools & Inspector သို့ ဆွဲကြည့်ရန်
					</button>
				</div>

				{/* Right Inspector */}
				<aside className="wve-inspector">
					<div className="wve-inspector-header">
						<h3>Inspector</h3>
						<button
							type="button"
							className="wve-scroll-top-btn"
							title="Scroll back up to map"
							onClick={() => {
								const el = document.querySelector('.wve-map');
								el?.scrollIntoView({ behavior: 'smooth' });
							}}
						>
							⬆️ မြေပုံသို့
						</button>
					</div>
					{/* Multi-selection tools when more than 1 feature is selected */}
					{selection.length > 1 && (
						<section className="wve-selection-tools" aria-label="Multi-selection tools">
							<strong>📦 {selection.length} ခု အစုလိုက် ရွေးထားသည် (Multi-selection)</strong>
							<div className="wve-tool-grid">
								<button disabled={selection.length < 2} onClick={() => {
									const groupId = uid();
									commit({ ...layout, features: layout.features.map(f => selection.includes(f.id) ? { ...f, groupId } : f) });
									setMessage('Grouped. Click any member to move the complete assembly.');
								}}>Group / တစ်စုဖွဲ့</button>
								<button disabled={!layout.features.some(f => selection.includes(f.id) && f.groupId)} onClick={() => {
									commit({ ...layout, features: layout.features.map(f => selection.includes(f.id) ? { ...f, groupId: undefined } : f) });
								}}>Ungroup / ခွဲရန်</button>
							</div>
							<label>ရွှေ့ရန် အကွာအဝေး (m)<input type="number" min="0.1" step="1" value={moveStep} onChange={e => setMoveStep(Math.max(0.1, Number(e.target.value) || 0.1))} /></label>
							<div className="wve-tool-grid four">
								<button title="Move north" onClick={() => commit(transformSelection(layout, selection, { dz: -moveStep }))}>↑</button>
								<button title="Move west" onClick={() => commit(transformSelection(layout, selection, { dx: -moveStep }))}>←</button>
								<button title="Move east" onClick={() => commit(transformSelection(layout, selection, { dx: moveStep }))}>→</button>
								<button title="Move south" onClick={() => commit(transformSelection(layout, selection, { dz: moveStep }))}>↓</button>
							</div>
							<label>တစ်စုလုံး လှည့်ရန် (°)<input type="number" value={turnDegrees} onChange={e => setTurnDegrees(Number(e.target.value) || 0)} /></label>
							<div className="wve-tool-grid">
								<button onClick={() => commit(transformSelection(layout, selection, { angle: -turnDegrees * Math.PI / 180 }))}>↶ Rotate</button>
								<button onClick={() => commit(transformSelection(layout, selection, { angle: turnDegrees * Math.PI / 180 }))}>↷ Rotate</button>
							</div>
							<label>တစ်စုလုံး အရွယ်ပြောင်းရန် (%)<input type="number" min="1" max="1000" value={resizePercent} onChange={e => setResizePercent(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} /></label>
							<button onClick={() => commit(transformSelection(layout, selection, { scale: resizePercent / 100 }))}>Resize selection</button>
							{selection.length === 2 && selection.every(id => layout.features.find(f => f.id === id)?.kind === 'road') && <button onClick={() => {
								commit(joinLines(layout, selection[0], selection[1])); setSelected(selection[0]);
								setMessage('Joined nearest endpoints. Drag vertices to adjust the connection.');
							}}>Join paths / လမ်းဆက်ရန်</button>}
							<div className="wve-tool-grid">
								<button onClick={duplicateSelected}>📋 Duplicate selection</button>
								<button onClick={deleteSelected}>🗑 Delete selection</button>
							</div>
						</section>
					)}

					{/* Dedicated building & house tools for individual houses/buildings */}
					{selection.length === 1 && current && !isPathOrLine(current) && !isShape(current.kind) && (
						<section className="wve-selection-tools" aria-label="Building tools">
							<div className="wve-selected-name-badge">
								<span className="wve-selected-name-icon">{icons[current.kind] || '🏠'}</span>
								<span className="wve-selected-name-title" title={current.name}>{current.name}</span>
								{current.assetId && (
									<button
										className="wve-btn-preview"
										style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto' }}
										onClick={() => setPreviewModalAssetId(current.assetId!)}
									>
										👁️ 3D Preview
									</button>
								)}
							</div>
							<label className="wve-name-label">
								အမည် (Name):
								<input
									type="text"
									className="wve-name-input"
									value={current.name}
									onChange={(e) => patch({ name: e.target.value })}
									placeholder="Object Name"
								/>
							</label>
							<p className="wve-help">
								မြေပုံပေါ်တွင် ဆွဲရွှေ့ပါ သို့မဟုတ် အောက်ပါ controls များဖြင့် တိကျစွာ ပြင်ဆင်ပါ။
							</p>

							{/* Position controls */}
							<label>
								ရွှေ့ရန် အကွာအဝေး (m)
								<input
									type="number"
									min="0.1"
									step="0.5"
									value={moveStep}
									onChange={(e) => setMoveStep(Math.max(0.1, Number(e.target.value) || 0.1))}
								/>
							</label>
							<div className="wve-tool-grid four">
								<button title="Move north" onClick={() => commit(transformSelection(layout, selection, { dz: -moveStep }))}>↑ North</button>
								<button title="Move west" onClick={() => commit(transformSelection(layout, selection, { dx: -moveStep }))}>← West</button>
								<button title="Move east" onClick={() => commit(transformSelection(layout, selection, { dx: moveStep }))}>→ East</button>
								<button title="Move south" onClick={() => commit(transformSelection(layout, selection, { dz: moveStep }))}>↓ South</button>
							</div>

							{/* Quick Rotation Buttons */}
							<label>
								ထောင့်လှည့်ရန် (Rotation): {Math.round(-((current.rotation ?? 0) * 180) / Math.PI)}°
							</label>
							<div className="wve-tool-grid four">
								<button title="Rotate -45°" onClick={() => patch({ rotation: (current.rotation ?? 0) - Math.PI / 4 })}>↶ -45°</button>
								<button title="Rotate +45°" onClick={() => patch({ rotation: (current.rotation ?? 0) + Math.PI / 4 })}>↷ +45°</button>
								<button title="Face North (0°)" onClick={() => patch({ rotation: 0 })}>0° (North)</button>
								<button title="Face East (90°)" onClick={() => patch({ rotation: Math.PI / 2 })}>90° (East)</button>
							</div>
							<div className="wve-tool-grid four">
								<button title="Rotate -15°" onClick={() => patch({ rotation: (current.rotation ?? 0) - Math.PI / 12 })}>↶ -15°</button>
								<button title="Rotate +15°" onClick={() => patch({ rotation: (current.rotation ?? 0) + Math.PI / 12 })}>↷ +15°</button>
								<button title="Face South (180°)" onClick={() => patch({ rotation: Math.PI })}>180° (South)</button>
								<button title="Face West (270°)" onClick={() => patch({ rotation: (3 * Math.PI) / 2 })}>270° (West)</button>
							</div>

							{/* Quick Actions */}
							<div className="wve-tool-grid">
								<button onClick={duplicateSelected}>📋 Duplicate / မိတ္တူပွား</button>
								<button style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' }} onClick={deleteSelected}>🗑 Delete / ဖျက်ရန်</button>
							</div>
						</section>
					)}

					{/* Path geometry tools for roads and canals */}
					{selection.length === 1 && current && (isPathOrLine(current) || isShape(current.kind)) && (
						<section className="wve-selection-tools" aria-label="Path geometry">
							<div className="wve-selected-name-badge">
								<span className="wve-selected-name-icon">{isPathOrLine(current) ? (current.metadata?.category === 'canal' ? '🌊' : '🛣️') : '🗺️'}</span>
								<span className="wve-selected-name-title" title={current.name}>{current.name}</span>
							</div>
							<label className="wve-name-label">
								အမည် (Name):
								<input
									type="text"
									className="wve-name-input"
									value={current.name}
									onChange={(e) => patch({ name: e.target.value })}
									placeholder="Object Name"
								/>
							</label>
							<strong>{isPathOrLine(current) ? '🛣️ လမ်း / ရေမြောင်း ကွေ့နှင့် အမှတ်များ ပြင်ဆင်ရန် (Curve & Path Points)' : '🗺️ နယ်မြေ / ဘလောက် အမှတ်များ ပြင်ဆင်ရန်'}</strong>
							<p className="wve-help">အပြာစက်များကို ဆွဲပြီး လမ်းကွေ့၊ အနားသတ် ပြင်ပါ။ Add Point ဖြင့် အကွေ့အသစ် ထည့်ပါ။</p>
							<label>အမှတ်ရွေးပါ / Vertex:
								<select value={vertex ?? ''} onChange={e => setVertex(e.target.value === '' ? null : Number(e.target.value))}>
									<option value="">Select point</option>
									{current.points.map((p, i) => <option key={i} value={i}>Point {i + 1} ({p.x.toFixed(1)}, {p.z.toFixed(1)})</option>)}
								</select>
							</label>
							<div className="wve-tool-grid">
								<button onClick={() => {
									const atIndex = vertex !== null ? vertex : current.points.length - 1;
									const p = current.points[atIndex];
									const q = current.points[atIndex + 1] ?? current.points[atIndex - 1] ?? { x: p.x + 5, z: p.z + 5 };
									const points = [...current.points];
									const at = atIndex + 1;
									points.splice(at, 0, { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 });
									patch({ points });
									setVertex(at);
									setMessage(`Point ${at + 1} added. Drag it on map to create curve.`);
								}}>
									➕ အမှတ်အသစ် ထည့်ရန် / Add Point
								</button>
								<button disabled={vertex === null || current.points.length <= (isPathOrLine(current) ? 2 : 3)} onClick={() => {
									try {
										patch(removeVertex(current, vertex!));
										setVertex(null);
										setMessage('Vertex removed.');
									} catch (error) {
										setMessage(String(error));
									}
								}}>
									➖ အမှတ်ဖျက်ရန် / Remove Point
								</button>
							</div>
							{isPathOrLine(current) && <div className="wve-tool-grid">
								<button className={extendEnd === 'start' ? 'active' : ''} onClick={() => { setExtendEnd(extendEnd === 'start' ? null : 'start'); setMode('select'); setPlacingAssetId(null); }}>📐 အစမှ ဆက်ဆွဲရန် / Extend start</button>
								<button className={extendEnd === 'end' ? 'active' : ''} onClick={() => { setExtendEnd(extendEnd === 'end' ? null : 'end'); setMode('select'); setPlacingAssetId(null); }}>📐 အဆုံးမှ ဆက်ဆွဲရန် / Extend end</button>
							</div>}
							{extendEnd && <p role="status" style={{ background: '#fef08a', padding: '6px 8px', borderRadius: '4px', fontSize: '11px' }}>မြေပုံကို နှိပ်ပြီး ဆက်ဆွဲပါ။ Click map to append point. <button onClick={() => setExtendEnd(null)}>Done / ပြီးပြီ</button></p>}
						</section>
					)}
					{current ? (
						<>
							{selection.length > 1 && <p className="wve-help">အောက်ပါ အမည်၊ အရောင်နှင့် model သည် ပထမရွေးထားသော object အတွက် ဖြစ်သည်။ အပေါ်က controls ဖြင့် တစ်စုလုံး ပြင်နိုင်သည်။</p>}

							{/* Group membership tools */}
							{current.groupId && (
								<div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', margin: '8px 0', fontSize: '11px' }}>
									<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
										<span style={{ fontWeight: 600 }}>🔗 အစုဝင် (Group Member)</span>
										<code style={{ fontSize: '10px', background: '#e2e8f0', padding: '2px 4px', borderRadius: '3px' }}>{current.groupId}</code>
									</div>
									<div className="wve-tool-grid">
										<button
											title="Select all features belonging to this group"
											onClick={() => {
												const allIds = expandGroups(layout, [current.id]);
												setSelection(allIds);
												setMessage(`Selected all ${allIds.length} parts of group '${current.groupId}'.`);
											}}
										>
											🔗 အစုတစ်ခုလုံး ရွေးရန် / Select Group
										</button>
										<button
											title="Select only this single component"
											onClick={() => {
												setSelection([current.id]);
												setMessage(`Selected single part: ${current.name}`);
											}}
										>
											🎯 ဤတစ်ခုတည်း ရွေးရန် / Select Single Part
										</button>
										<button
											title="Ungroup this item"
											onClick={() => {
												patch({ groupId: undefined });
												setMessage('Item ungrouped.');
											}}
										>
											🔓 အစုခွဲရန် / Ungroup
										</button>
									</div>
								</div>
							)}

							{/* Linked 3D Asset Information */}
							{current.assetId && (
								<div
									style={{
										padding: '8px',
										background: '#f1f5f9',
										borderRadius: '6px',
										margin: '8px 0',
										fontSize: '11px',
									}}
								>
									<div style={{ fontWeight: 600, color: '#0f172a' }}>
										{getAssetDefinition(current.assetId)?.name}
									</div>
									<div style={{ color: '#0284c7' }}>
										{getAssetDefinition(current.assetId)?.nameMm}
									</div>
									<div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>
										Asset: <code>{current.assetId}</code>
									</div>
								</div>
							)}

							{/* Replace Asset Dropdown */}
							<label>
								Replace 3D Asset
								<select
									value={current.assetId || ''}
									onChange={(e) => {
										const nextId = e.target.value || undefined;
										const nextDef = getAssetDefinition(nextId);
										patch({
											assetId: nextId,
											dimensions: nextDef ? { ...nextDef.defaultDimensions } : current.dimensions,
											color: nextDef?.defaultColor,
											roofColor: nextDef?.defaultRoofColor,
										});
									}}
								>
									<option value="">-- Generic Vector Shape --</option>
									{ASSET_LIST.map((a) => (
										<option key={a.assetId} value={a.assetId}>
											{a.name} ({a.category})
										</option>
									))}
								</select>
							</label>

							<p style={{ margin: '6px 0', fontSize: '11px', color: '#64748b' }}>
								Type: {icons[current.kind]} {current.kind} · ID: <small>{current.id}</small>
							</p>

							{/* Road Width */}
							{current.kind === 'road' && (
								<label>
									Width (m)
									<input
										type="number"
										min="0.5"
										value={current.width || 5}
										onChange={(e) => patch({ width: Math.max(0.5, Number(e.target.value) || 0.5) })}
									/>
								</label>
							)}

							{/* 3D Asset & Point Feature Controls */}
							{!isShape(current.kind) && !isLine(current.kind) && (
								<>
									<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
										<label>
											X (m)
											<input
												type="number"
												step="0.5"
												value={current.points[0]?.x ?? 0}
												onChange={(e) =>
													patch({
														points: [{ ...current.points[0], x: Number(e.target.value) }],
													})
												}
											/>
										</label>
										<label>
											Z (m)
											<input
												type="number"
												step="0.5"
												value={current.points[0]?.z ?? 0}
												onChange={(e) =>
													patch({
														points: [{ ...current.points[0], z: Number(e.target.value) }],
													})
												}
											/>
										</label>
									</div>

									{/* Rotation Controls: Slider, Number, and Step Buttons */}
									<label>
										Rotation: {(((current.rotation ?? 0) * 180) / Math.PI).toFixed(0)}°
										<input
											type="range"
											min="-180"
											max="180"
											step="5"
											value={Math.round((((current.rotation ?? 0) * 180) / Math.PI) || 0)}
											onChange={(e) => patch({ rotation: (Number(e.target.value) * Math.PI) / 180 })}
										/>
									</label>
									<div className="wve-rot-controls">
										<button
											onClick={() =>
												patch({ rotation: (current.rotation ?? 0) - Math.PI / 4 })
											}
										>
											-45°
										</button>
										<button
											onClick={() =>
												patch({ rotation: (current.rotation ?? 0) + Math.PI / 4 })
											}
										>
											+45°
										</button>
										<button onClick={() => patch({ rotation: 0 })}>0° (North)</button>
										<button onClick={() => patch({ rotation: Math.PI / 2 })}>90° (East)</button>
									</div>

									{/* Dimensions: Width and Depth */}
									<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
										<label>
											Width (m)
											<input
												type="number"
												min="0.2"
												step="0.5"
												value={current.dimensions?.width ?? current.size ?? 8}
												onChange={(e) => {
													const val = Math.max(0.2, Number(e.target.value) || 0.2);
													patch({
														dimensions: {
															width: val,
															depth: current.dimensions?.depth ?? current.size ?? 8,
														},
														size: val,
													});
												}}
											/>
										</label>
										<label>
											Depth (m)
											<input
												type="number"
												min="0.2"
												step="0.5"
												value={current.dimensions?.depth ?? current.size ?? 8}
												onChange={(e) => {
													const val = Math.max(0.2, Number(e.target.value) || 0.2);
													patch({
														dimensions: {
															width: current.dimensions?.width ?? current.size ?? 8,
															depth: val,
														},
													});
												}}
											/>
										</label>
									</div>

									{/* Colors */}
									<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
										<label>
											Wall / Color
											<input
												type="color"
												value={current.color || '#baa892'}
												onChange={(e) => patch({ color: e.target.value })}
												style={{ height: '32px', padding: '2px', cursor: 'pointer' }}
											/>
										</label>
										<label>
											Roof / Accent
											<input
												type="color"
												value={current.roofColor || '#687788'}
												onChange={(e) => patch({ roofColor: e.target.value })}
												style={{ height: '32px', padding: '2px', cursor: 'pointer' }}
											/>
										</label>
									</div>
								</>
							)}

							{/* Ward / Block Association */}
							{current.kind !== 'ward' && (
								<label>
									Ward
									<select
										value={current.wardId || ''}
										onChange={(e) => patch({ wardId: e.target.value || undefined })}
									>
										<option value="">None</option>
										{layout.features
											.filter((f) => f.kind === 'ward')
											.map((f) => (
												<option key={f.id} value={f.id}>
													{f.name}
												</option>
											))}
									</select>
								</label>
							)}

							{current.kind !== 'block' && current.kind !== 'ward' && (
								<label>
									Block
									<select
										value={current.blockId || ''}
										onChange={(e) => patch({ blockId: e.target.value || undefined })}
									>
										<option value="">None</option>
										{layout.features
											.filter((f) => f.kind === 'block')
											.map((f) => (
												<option key={f.id} value={f.id}>
													{f.name}
												</option>
											))}
									</select>
								</label>
							)}

							{/* Action Buttons */}
							<div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
								<button
									style={{ flex: 1 }}
									onClick={duplicateSelected}
								>
									📋 Duplicate
								</button>
								<button
									style={{ flex: 1, backgroundColor: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' }}
									onClick={deleteSelected}
								>
									🗑️ Delete
								</button>
							</div>
						</>
					) : (
						<p className="wve-help">
							Select an asset on the map to modify its 3D model, rotation, dimensions, colors,
							coordinates, or to duplicate/delete it.
						</p>
					)}

					<hr />
					<button
						onClick={() => {
							if (window.confirm('Clear all features in this village layout?')) {
								commit(deleteSelection(layout, layout.features.map(f => f.id)));
								setSelected(null);
								setDraft([]);
							}
						}}
						style={{ width: '100%', color: '#dc2626' }}
					>
						Clear layout
					</button>
				</aside>
			</div>

			{/* Editor Status Footer */}
			<footer className="wve-status">
				<div>
					{message} · <strong>{layout.features.length}</strong> features in region '{region}'
				</div>
				<div role="status">{dirty ? 'မသိမ်းရသေးပါ · Save နှိပ်မှ 3D ပြောင်းမည်' : 'Saved locally'}</div>
			</footer>
		</div>
	);
}
