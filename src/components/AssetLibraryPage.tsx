import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  ASSET_CATEGORIES,
  ASSET_LIST,
  registerCustomAsset,
  unregisterCustomAsset,
  type AssetCategory,
} from '../game/assetRegistry';
import {
  deleteCustomAsset,
  generateCustomAsset,
  loadCustomAssets,
  saveCustomAsset,
  updateCustomAsset,
  convertPartToPolygon,
  createPolygonPreset,
  type CustomAsset,
  type CustomPart,
  type ShapeKind,
} from '../game/customAssets';
import { CustomAssetModel } from './CustomAssetModel';
import { AssetAiAdd } from './AssetAiAdd';
import { BuiltInAssetEditor } from './BuiltInAssetEditor';
import { createCustomTemplate, type TemplateKind } from '../game/customAssetTemplates';
import './AssetLibraryPage.css';

type CameraAngle = 'perspective' | 'top' | 'front' | 'side';
type DrawMode = 'select' | 'pen' | 'edit-points';
type TransformTool = 'translate' | 'rotate' | 'scale';

type CanvasDragState =
  | { type: 'move-free'; startPos: [number, number, number]; startPointer: [number, number]; startPoints?: [number, number][] }
  | { type: 'move-x'; startPos: [number, number, number]; startPointer: [number, number]; startPoints?: [number, number][] }
  | { type: 'move-z'; startPos: [number, number, number]; startPointer: [number, number]; startPoints?: [number, number][] }
  | { type: 'rotate'; startAngle: number; startRotY: number }
  | { type: 'scale-corner'; corner: 'nw' | 'ne' | 'se' | 'sw'; startSize: [number, number, number]; startPointer: [number, number]; startPoints?: [number, number][] }
  | { type: 'scale-edge'; edge: 'top' | 'bottom' | 'left' | 'right'; startSize: [number, number, number]; startPointer: [number, number]; startPoints?: [number, number][] }
  | { type: 'height'; startHeight: number; startPointerY: number };

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { dist: number; projX: number; projY: number; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { dist: Math.hypot(px - x1, py - y1), projX: x1, projY: y1, t: 0 };
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const dist = Math.hypot(px - projX, py - projY);
  return { dist, projX, projY, t };
}

function Orbit({
  height,
  viewAngle,
  controlsRef,
}: {
  height: number;
  viewAngle: CameraAngle;
  controlsRef?: React.MutableRefObject<OrbitControls | null>;
}) {
  const { camera, gl } = useThree();
  const internalRef = useRef<OrbitControls | null>(null);
  const activeRef = controlsRef ?? internalRef;

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, height / 2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    activeRef.current = controls;
    controls.update();
    return () => {
      controls.dispose();
      activeRef.current = null;
    };
  }, [camera, gl, height, activeRef]);

  useEffect(() => {
    const d = Math.max(height * 2.2, 8);
    const targetY = height / 2;
    if (viewAngle === 'top') {
      camera.position.set(0, d * 1.6, 0.001);
    } else if (viewAngle === 'front') {
      camera.position.set(0, targetY, d * 1.5);
    } else if (viewAngle === 'side') {
      camera.position.set(d * 1.5, targetY, 0);
    } else {
      camera.position.set(d * 1.3, d * 1.1, d * 1.3);
    }
    camera.lookAt(0, targetY, 0);
    if (activeRef.current) {
      activeRef.current.target.set(0, targetY, 0);
      activeRef.current.update();
    }
  }, [viewAngle, camera, height, activeRef]);

  return null;
}

function TransformGizmo({
  part,
  dimensions,
  transformTool,
  snapEnabled,
  onLiveUpdate,
  onBeforeChange,
  orbitControlsRef,
}: {
  part: CustomPart | undefined;
  dimensions?: [number, number, number] | number[];
  transformTool: TransformTool;
  snapEnabled: boolean;
  onLiveUpdate: (p: CustomPart) => void;
  onBeforeChange: () => void;
  orbitControlsRef: React.MutableRefObject<OrbitControls | null>;
}) {
  const { camera, gl, scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const transformRef = useRef<TransformControls | null>(null);
  const isDraggingRef = useRef(false);

  const [w, h, d] = Array.isArray(dimensions) && dimensions.length >= 3 ? dimensions : [2, 2, 2];
  const width = dimensions?.[0] ?? w;
  const height = dimensions?.[1] ?? h;
  const depth = dimensions?.[2] ?? d;

  // Sync group transform with current part when not actively dragging
  useEffect(() => {
    if (!part || isDraggingRef.current || !groupRef.current) return;
    const g = groupRef.current;
    const pos = part.position ?? [0, 0.5, 0];
    const rot = part.rotation ?? [0, 0, 0];
    const sz = part.size ?? [1, 1, 1];
    g.position.set(pos[0] * width, pos[1] * height, pos[2] * depth);
    g.rotation.set((rot[0] * Math.PI) / 180, (rot[1] * Math.PI) / 180, (rot[2] * Math.PI) / 180);
    g.scale.set(Math.max(0.001, sz[0] * width), Math.max(0.001, sz[1] * height), Math.max(0.001, sz[2] * depth));
  }, [part, width, height, depth]);

  useEffect(() => {
    if (!part) return;
    const tc = new TransformControls(camera, gl.domElement);
    transformRef.current = tc;
    const helper = tc.getHelper();
    scene.add(helper);

    if (groupRef.current) {
      tc.attach(groupRef.current);
    }

    const onDraggingChanged = (event: any) => {
      const isDragging = !!event.value;
      isDraggingRef.current = isDragging;
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = !isDragging;
      }
      if (isDragging) {
        onBeforeChange();
      }
    };

    const onChange = () => {
      if (!groupRef.current || !part || !isDraggingRef.current) return;
      const g = groupRef.current;
      const nx = Number((g.position.x / width).toFixed(3));
      const ny = Number((g.position.y / height).toFixed(3));
      const nz = Number((g.position.z / depth).toFixed(3));
      const rx = Math.round((g.rotation.x * 180) / Math.PI);
      const ry = Math.round((g.rotation.y * 180) / Math.PI);
      const rz = Math.round((g.rotation.z * 180) / Math.PI);
      const sx = Math.max(0.02, Number((g.scale.x / width).toFixed(3)));
      const sy = Math.max(0.02, Number((g.scale.y / height).toFixed(3)));
      const sz = Math.max(0.02, Number((g.scale.z / depth).toFixed(3)));

      onLiveUpdate({
        ...part,
        position: [nx, ny, nz],
        rotation: [rx, ry, rz],
        size: [sx, sy, sz],
      });
    };

    tc.addEventListener('dragging-changed', onDraggingChanged);
    tc.addEventListener('change', onChange);

    return () => {
      tc.removeEventListener('dragging-changed', onDraggingChanged);
      tc.removeEventListener('change', onChange);
      tc.detach();
      scene.remove(helper);
      tc.dispose();
      transformRef.current = null;
    };
  }, [camera, gl, scene, part !== undefined, width, height, depth, onBeforeChange, onLiveUpdate, orbitControlsRef]);

  // Update transform mode (translate, rotate, scale)
  useEffect(() => {
    const tc = transformRef.current;
    if (!tc) return;
    tc.setMode(transformTool);
  }, [transformTool]);

  // Update snapping
  useEffect(() => {
    const tc = transformRef.current;
    if (!tc) return;
    if (snapEnabled) {
      tc.setTranslationSnap(0.05 * width);
      tc.setRotationSnap(THREE.MathUtils.degToRad(15));
      tc.setScaleSnap(0.05);
    } else {
      tc.setTranslationSnap(null);
      tc.setRotationSnap(null);
      tc.setScaleSnap(null);
    }
  }, [snapEnabled, width]);

  if (!part) return null;
  return <group ref={groupRef} />;
}

const blank = (): CustomAsset => createCustomTemplate('blank', `custom:${crypto.randomUUID()}`);
const copy = (a: CustomAsset): CustomAsset => {
  const cloned = structuredClone(a);
  return {
    ...cloned,
    dimensions: Array.isArray(cloned.dimensions) && cloned.dimensions.length >= 3 ? cloned.dimensions : [2, 2, 2],
    parts: Array.isArray(cloned.parts) ? cloned.parts : [],
  };
};

// Shape definitions with Myanmar labels and icons
const SHAPE_DEFS: { id: ShapeKind; icon: string; nameMm: string; defaultSize: [number, number, number] }[] = [
  { id: 'box', icon: '📦', nameMm: 'တုံး (Box)', defaultSize: [0.35, 0.35, 0.35] },
  { id: 'cylinder', icon: '🥫', nameMm: 'ဆလင်ဒါ/တိုင် (Cylinder)', defaultSize: [0.25, 0.5, 0.25] },
  { id: 'sphere', icon: '⚽', nameMm: 'လုံးဝန်း (Sphere)', defaultSize: [0.35, 0.35, 0.35] },
  { id: 'cone', icon: '🌲', nameMm: 'ကတော့ချွန် (Cone)', defaultSize: [0.4, 0.5, 0.4] },
  { id: 'pyramid', icon: '🔺', nameMm: 'ပိရမစ် (Pyramid)', defaultSize: [0.5, 0.35, 0.5] },
  { id: 'capsule', icon: '💊', nameMm: 'ဆေးတောင့်/ခြေလက် (Capsule)', defaultSize: [0.22, 0.45, 0.22] },
  { id: 'torus', icon: '🍩', nameMm: 'ကွင်း/ဘီး (Torus Ring)', defaultSize: [0.4, 0.15, 0.4] },
  { id: 'dome', icon: '🕌', nameMm: 'စေတီခုံး/အမိုး (Dome)', defaultSize: [0.45, 0.3, 0.45] },
  { id: 'wedge', icon: '📐', nameMm: '၃ မြှောင့်ခေါင်မိုး (Wedge)', defaultSize: [0.5, 0.35, 0.5] },
  { id: 'polygon', icon: '✒️', nameMm: 'Pen Tool ပုံစံ (Polygon)', defaultSize: [0.5, 0.4, 0.5] },
];

// Rich Myanmar themed color palettes
const COLOR_PALETTES = {
  character: {
    label: '🧍 လူနှင့် အဝတ်အထည် (Character & Fashion)',
    colors: [
      { name: 'ရွှေအိုရောင် အသား', hex: '#e0a97a' },
      { name: 'ညိုချော အသား', hex: '#b87d56' },
      { name: 'ဖြူဝင်း အသား', hex: '#f3c8a8' },
      { name: 'ကြေးညိုရောင်', hex: '#8d5336' },
      { name: 'ဆင်စွယ်ရောင်', hex: '#ffedd5' },
      { name: 'ပုဆိုးနီ/လုံချည်', hex: '#991b1b' },
      { name: 'ပုဆိုးစိမ်းပုတ်', hex: '#14532d' },
      { name: 'တိုက်ပုံနက်ပြာ', hex: '#1e3a8a' },
      { name: 'ပန်းရင့်ရောင်', hex: '#9d174d' },
      { name: 'ခရမ်းရင့်ရောင်', hex: '#581c87' },
      { name: 'ရွှေဝါ ပိုးထည်', hex: '#d97706' },
      { name: 'ပိုးဖြူရောင်', hex: '#f8fafc' },
      { name: 'ကတ္တီပါနက်', hex: '#18181b' },
      { name: 'ဆံပင်နက်ညို', hex: '#291d18' },
    ],
  },
  building: {
    label: '🏠 အဆောက်အအုံ (Building Materials)',
    colors: [
      { name: 'ကျွန်းသစ်ညို', hex: '#78350f' },
      { name: 'ပျဉ်းကတိုးသစ်', hex: '#451a03' },
      { name: 'ပျဉ်ထောင်ဝါးရောင်', hex: '#d4b38c' },
      { name: 'ဓနိ/သက်ငယ်', hex: '#a16207' },
      { name: 'အုတ်နီရောင်', hex: '#b91c1c' },
      { name: 'သွပ်မိုးစိမ်း', hex: '#065f46' },
      { name: 'အုတ်ကြွပ်နီ', hex: '#7f1d1d' },
      { name: 'မိုးပြာရောင် သွပ်', hex: '#3b82f6' },
      { name: 'ထုံးဖြူရံနံရံ', hex: '#f1f5f9' },
      { name: 'သံဇကာပြာ', hex: '#334155' },
      { name: 'ပြတင်းပေါက်မှန်', hex: '#67e8f9' },
      { name: 'ရွှေရောင် စေတီ', hex: '#f59e0b' },
    ],
  },
  nature: {
    label: '🌳 သစ်ပင်နှင့် သဘာဝ (Nature & Plants)',
    colors: [
      { name: 'ရွက်နုစိမ်း', hex: '#4ade80' },
      { name: 'ရွက်ရင့်စိမ်း', hex: '#15803d' },
      { name: 'တောနက်စိမ်း', hex: '#166534' },
      { name: 'ထန်းရွက်စိမ်း', hex: '#365314' },
      { name: 'သံလွင်စိမ်း', hex: '#65a30d' },
      { name: 'သစ်ခေါက်ညို', hex: '#713f12' },
      { name: 'မြေနီရောင်', hex: '#92400e' },
      { name: 'ရွှံ့စေးညို', hex: '#543d2b' },
      { name: 'ကျောက်တုံးပြာ', hex: '#475569' },
      { name: 'ပန်းရောင် ပွင့်ဖူး', hex: '#f43f5e' },
      { name: 'သရက်သီးဝါ', hex: '#eab308' },
      { name: 'မြက်ခင်းစိမ်း', hex: '#22c55e' },
    ],
  },
  accents: {
    label: '✨ ရွှေနှင့် ကျောက်မျက် (Gold & Accents)',
    colors: [
      { name: 'ရွှေစင်ရောင်', hex: '#fbbf24' },
      { name: 'ကြေးနီရောင်', hex: '#b45309' },
      { name: 'မြရတနာစိမ်း', hex: '#059669' },
      { name: 'ပတ္တမြားနီ', hex: '#dc2626' },
      { name: 'နီလာပြာ', hex: '#2563eb' },
      { name: 'မိုးကုတ် ပန်းခရမ်း', hex: '#c084fc' },
      { name: 'မဟူရာနက်', hex: '#09090b' },
      { name: 'ငွေရောင် တောက်ပ', hex: '#e2e8f0' },
    ],
  },
};

export default function AssetLibraryPage() {
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'custom' | 'builtin'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AssetCategory>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomAsset | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [partIndex, setPartIndex] = useState(0);
  const [past, setPast] = useState<CustomAsset[]>([]);
  const [future, setFuture] = useState<CustomAsset[]>([]);
  const [addAI, setAddAI] = useState(false);
  const [model, setModel] = useState('gemini-3.8-flash');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [mobileTab, setMobileTab] = useState<'visual' | 'properties' | 'ai'>('visual');
  const [viewAngle, setViewAngle] = useState<CameraAngle>('perspective');
  const [paletteKey, setPaletteKey] = useState<keyof typeof COLOR_PALETTES>('character');
  const [presetKey, setPresetKey] = useState<'character' | 'building' | 'tree'>('character');

  // Blender-like Transform Tool and Canvas States
  const [drawMode, setDrawMode] = useState<DrawMode>('select');
  const [transformTool, setTransformTool] = useState<TransformTool>('translate');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [canvasDrag, setCanvasDrag] = useState<CanvasDragState | null>(null);
  const [penPoints, setPenPoints] = useState<[number, number][]>([]);
  const [penCursor, setPenCursor] = useState<[number, number] | null>(null);
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);
  const [selectedVertexIdx, setSelectedVertexIdx] = useState<number | null>(null);
  const [hoverEdgePoint, setHoverEdgePoint] = useState<{ index: number; x: number; y: number } | null>(null);

  // Plan-section view toggle: '2d' = SVG top-view, '3d' = full 3D R3F canvas (defaults to '3d')
  const [planView, setPlanView] = useState<'2d' | '3d'>('3d');
  // 3D view angle for plan section
  const [planViewAngle, setPlanViewAngle] = useState<CameraAngle>('perspective');
  const planOrbitRef = useRef<OrbitControls | null>(null);

  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const refresh = () => setRevision(n => n + 1);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ASSET_LIST.filter(a => {
      if (typeFilter === 'custom' && !a.customModel) return false;
      if (typeFilter === 'builtin' && a.customModel) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.nameMm.toLowerCase().includes(q) ||
        a.assetId.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
      );
    });
  }, [query, typeFilter, categoryFilter, revision]);

  const def = ASSET_LIST.find(a => a.assetId === selected);

  const change = (next: CustomAsset) => {
    if (!draft) return;
    setPast(p => [...p.slice(-49), copy(draft)]);
    setFuture([]);
    setDraft(next);
  };

  const edit = (asset: CustomAsset, newAsset = false) => {
    setSelected(asset.id);
    setDraft(copy(asset));
    setIsNew(newAsset);
    setPartIndex(0);
    setPast([]);
    setFuture([]);
    setMessage('');
    setMobileView('editor');
    setDrawMode('select');
    setPenPoints([]);
  };

  const selectBuiltIn = (assetId: string) => {
    setSelected(assetId);
    setDraft(null);
    setMessage('');
    setMobileView('editor');
  };

  const startTemplate = (kind: TemplateKind) => {
    if (draft && !confirm('လက်ရှိ draft ကို ပိတ်ပြီး ပုံစံအသစ် စတင်မလား။ မသိမ်းရသေးသော ပြင်ဆင်မှုများ ပျောက်နိုင်ပါသည်။')) return;
    edit(createCustomTemplate(kind, `custom:${crypto.randomUUID()}`), true);
  };

  const save = () => {
    if (!draft) return;
    try {
      const saved = isNew ? saveCustomAsset(draft) : updateCustomAsset(draft);
      registerCustomAsset(saved);
      setDraft(copy(saved));
      setIsNew(false);
      refresh();
      setMessage('✓ သိမ်းပြီးပါပြီ။ မြေပုံကို ပြန်ဖွင့်လျှင် asset အသစ်ကို အသုံးပြုနိုင်ပါသည်။');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const remove = () => {
    if (!def?.customModel || !confirm(`“${def.name}” ကို ဖျက်မလား။`)) return;
    try {
      deleteCustomAsset(def.assetId);
      unregisterCustomAsset(def.assetId);
      setSelected(null);
      setDraft(null);
      refresh();
      setMessage('Asset ကို ဖျက်ပြီးပါပြီ။');
      setMobileView('list');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const ai = async () => {
    if (!draft) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage('AI ပုံစံ ဖန်တီးနေသည်… ခေတ္တစောင့်ပါ');
    try {
      const result = await generateCustomAsset({
        key: apiKey,
        model,
        prompt,
        signal: controller.signal,
        onRetry: () => setMessage('Gemini ကို ပြန်စမ်းနေသည်…'),
      });
      if (!controller.signal.aborted) {
        change({ ...result, id: draft.id });
        setPartIndex(0);
        setMessage('AI ပုံစံကို preview တွင် ပြထားပါသည်။ "သိမ်းမည်" ကိုနှိပ်မှ သိမ်းမည်။');
      }
    } catch (e) {
      if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : 'Request failed');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const part = draft?.parts[partIndex];
  const updatePart = (p: CustomPart) => {
    if (!draft) return;
    change({ ...draft, parts: draft.parts.map((v, i) => (i === partIndex ? p : v)) });
  };

  const updatePartLive = (p: CustomPart) => {
    if (!draft) return;
    setDraft({ ...draft, parts: draft.parts.map((v, i) => (i === partIndex ? p : v)) });
  };

  const recordHistoryBeforeChange = () => {
    if (!draft) return;
    setPast(p => [...p.slice(-49), copy(draft)]);
    setFuture([]);
  };

  // Add a specific shape directly into the model
  const addShape = (shape: ShapeKind) => {
    if (!draft) return;
    if (draft.parts.length >= 40) {
      setMessage('အစိတ်အပိုင်း အများဆုံး ၄၀ အထိသာ ထည့်သွင်းနိုင်ပါသည်။');
      return;
    }
    const defShape = SHAPE_DEFS.find(s => s.id === shape);
    const size: [number, number, number] = defShape
      ? [defShape.defaultSize[0], defShape.defaultSize[1], defShape.defaultSize[2]]
      : [0.35, 0.35, 0.35];

    let pos: [number, number, number] = [0, size[1] / 2, 0];
    let col = '#2dd4bf';

    if (part) {
      pos = [
        Math.min(0.9, Number((part.position[0] + 0.1).toFixed(3))),
        Math.min(1.5, Number((part.position[1] + size[1]).toFixed(3))),
        Math.min(0.9, Number((part.position[2] + 0.1).toFixed(3))),
      ];
      col = part.color;
    }

    const newPart: CustomPart = {
      shape,
      position: pos,
      size,
      color: col,
    };

    change({ ...draft, parts: [...draft.parts, newPart] });
    setPartIndex(draft.parts.length);
    setMessage(`＋ ${defShape?.nameMm ?? shape} အစိတ်အပိုင်း ထည့်သွင်းပြီးပါပြီ။`);
  };

  // Figma-like Pen Tool: complete drawn polygon
  const finishPenDrawing = () => {
    if (penPoints.length < 3 || !draft) return;
    if (draft.parts.length >= 40) {
      setMessage('အစိတ်အပိုင်း အများဆုံး ၄၀ အထိသာ ထည့်သွင်းနိုင်ပါသည်။');
      return;
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of penPoints) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    const cx = Number(((minX + maxX) / 2).toFixed(3));
    const cz = Number(((minZ + maxZ) / 2).toFixed(3));
    const sx = Math.max(0.06, Number((maxX - minX).toFixed(3)));
    const sz = Math.max(0.06, Number((maxZ - minZ).toFixed(3)));
    const height = 0.35;
    const posY = part ? part.position[1] : height / 2;

    const newPolyPart: CustomPart = {
      shape: 'polygon',
      position: [cx, posY, cz],
      size: [sx, height, sz],
      color: part ? part.color : '#2dd4bf',
      points: penPoints.map(([x, z]) => [x, z]),
    };

    change({ ...draft, parts: [...draft.parts, newPolyPart] });
    setPartIndex(draft.parts.length);
    setPenPoints([]);
    setPenCursor(null);
    setDrawMode('select');
    setMessage(`✓ Pen Tool ဖြင့် အနား ${penPoints.length} ခုပါ 3D Shape အသစ် ဖန်တီးပြီးပါပြီ။`);
  };

  // Add rich preset components
  const addCompoundPreset = (preset: string) => {
    if (!draft) return;
    if (draft.parts.length >= 36) {
      setMessage('အစိတ်အပိုင်း အများဆုံး ၄၀ အထိသာ ထည့်သွင်းနိုင်ပါသည်။');
      return;
    }

    let newParts: CustomPart[] = [];

    if (presetKey === 'character') {
      if (preset === 'headHair') {
        newParts = [
          { shape: 'sphere', position: [0, 0.72, 0], size: [0.32, 0.34, 0.32], color: '#e0a97a' },
          { shape: 'dome', position: [0, 0.84, -0.02], size: [0.34, 0.16, 0.34], color: '#291d18' },
        ];
      } else if (preset === 'torsoLongyi') {
        newParts = [
          { shape: 'box', position: [0, 0.44, 0], size: [0.4, 0.35, 0.25], color: '#1e3a8a' },
          { shape: 'cylinder', position: [0, 0.18, 0], size: [0.28, 0.36, 0.28], color: '#991b1b' },
        ];
      } else if (preset === 'armsPair') {
        newParts = [
          { shape: 'capsule', position: [-0.26, 0.4, 0], size: [0.12, 0.32, 0.12], color: '#1e3a8a' },
          { shape: 'capsule', position: [0.26, 0.4, 0], size: [0.12, 0.32, 0.12], color: '#1e3a8a' },
        ];
      } else if (preset === 'legsPair') {
        newParts = [
          { shape: 'capsule', position: [-0.09, 0.1, 0], size: [0.11, 0.22, 0.11], color: '#b87d56' },
          { shape: 'capsule', position: [0.09, 0.1, 0], size: [0.11, 0.22, 0.11], color: '#b87d56' },
        ];
      }
    } else if (presetKey === 'building') {
      if (preset === 'postBase') {
        newParts = [
          { shape: 'box', position: [-0.35, 0.15, -0.35], size: [0.08, 0.3, 0.08], color: '#78350f' },
          { shape: 'box', position: [0.35, 0.15, -0.35], size: [0.08, 0.3, 0.08], color: '#78350f' },
          { shape: 'box', position: [-0.35, 0.15, 0.35], size: [0.08, 0.3, 0.08], color: '#78350f' },
          { shape: 'box', position: [0.35, 0.15, 0.35], size: [0.08, 0.3, 0.08], color: '#78350f' },
        ];
      } else if (preset === 'tieredRoof') {
        newParts = [
          { shape: 'wedge', position: [0, 0.7, 0], size: [0.95, 0.25, 0.85], color: '#065f46' },
          { shape: 'pyramid', position: [0, 0.9, 0], size: [0.65, 0.25, 0.65], color: '#047857' },
        ];
      } else if (preset === 'pagodaSpire') {
        newParts = [
          { shape: 'box', position: [0, 0.15, 0], size: [0.9, 0.3, 0.9], color: '#b45309' },
          { shape: 'dome', position: [0, 0.45, 0], size: [0.75, 0.35, 0.75], color: '#f59e0b' },
          { shape: 'cone', position: [0, 0.8, 0], size: [0.35, 0.5, 0.35], color: '#fbbf24' },
          { shape: 'torus', position: [0, 0.65, 0], size: [0.45, 0.08, 0.45], color: '#d97706' },
        ];
      } else if (preset === 'dananiVerandah') {
        newParts = [
          { shape: 'box', position: [0, 0.05, 0], size: [0.9, 0.08, 0.9], color: '#d4b38c' },
          { shape: 'wedge', position: [0, 0.55, 0.2], size: [0.95, 0.2, 0.5], color: '#a16207' },
        ];
      }
    } else if (presetKey === 'tree') {
      if (preset === 'trunk') {
        newParts = [
          { shape: 'cylinder', position: [0, 0.25, 0], size: [0.18, 0.5, 0.18], color: '#713f12' },
        ];
      } else if (preset === 'canopy') {
        newParts = [
          { shape: 'sphere', position: [0, 0.72, 0], size: [0.85, 0.48, 0.85], color: '#15803d' },
          { shape: 'sphere', position: [-0.2, 0.65, 0.1], size: [0.55, 0.38, 0.55], color: '#4ade80' },
          { shape: 'sphere', position: [0.2, 0.68, -0.1], size: [0.55, 0.4, 0.55], color: '#166534' },
        ];
      } else if (preset === 'pineTier') {
        newParts = [
          { shape: 'cone', position: [0, 0.45, 0], size: [0.85, 0.4, 0.85], color: '#166534' },
          { shape: 'cone', position: [0, 0.72, 0], size: [0.65, 0.4, 0.65], color: '#15803d' },
        ];
      } else if (preset === 'fronds') {
        newParts = [
          { shape: 'dome', position: [0, 0.75, 0], size: [0.95, 0.25, 0.95], color: '#365314' },
          { shape: 'torus', position: [0, 0.72, 0], size: [0.8, 0.1, 0.8], color: '#65a30d' },
        ];
      }
    }

    if (newParts.length > 0) {
      change({ ...draft, parts: [...draft.parts, ...newParts] });
      setPartIndex(draft.parts.length);
      setMessage(`＋ ${preset} အစိတ်အပိုင်း ထည့်သွင်းပြီးပါပြီ။`);
    }
  };

  // Modeling Power Tools: Symmetry Mirror X
  const mirrorPartX = () => {
    if (!draft || !part) return;
    if (draft.parts.length >= 40) {
      setMessage('အစိတ်အပိုင်း အများဆုံး ၄၀ အထိသာ ထည့်သွင်းနိုင်ပါသည်။');
      return;
    }
    const mirrored: CustomPart = {
      ...structuredClone(part),
      position: [Number((-part.position[0]).toFixed(3)), part.position[1], part.position[2]],
      rotation: part.rotation
        ? [part.rotation[0], Number((-part.rotation[1]).toFixed(3)), Number((-part.rotation[2]).toFixed(3))]
        : undefined,
    };
    change({ ...draft, parts: [...draft.parts, mirrored] });
    setPartIndex(draft.parts.length);
    setMessage('✓ အစိတ်အပိုင်းကို ဝဲ/ယာ အချိုးညီ ပွားပြီးပါပြီ။');
  };

  // Modeling Power Tools: Snap to ground level
  const snapToGround = () => {
    if (!draft || !part) return;
    const groundY = Number((part.size[1] / 2).toFixed(3));
    updatePart({ ...part, position: [part.position[0], groundY, part.position[2]] });
    setMessage('✓ မြေပြင်သို့ အတိအကျ ကပ်ပြီးပါပြီ။');
  };

  // Modeling Power Tools: Center part on X or Z
  const centerPart = (axis: 'x' | 'z' | 'both') => {
    if (!draft || !part) return;
    const pos = [...part.position] as [number, number, number];
    if (axis === 'x' || axis === 'both') pos[0] = 0;
    if (axis === 'z' || axis === 'both') pos[2] = 0;
    updatePart({ ...part, position: pos });
    setMessage(`✓ ဗဟိုသို့ တည့်ပြီးပါပြီ (${axis.toUpperCase()})။`);
  };

  // Modeling Power Tools: Stack on top of previous part
  const stackOnPrevious = () => {
    if (!draft || !part || partIndex === 0) return;
    const below = draft.parts[partIndex - 1];
    const newY = Math.min(1, Number((below.position[1] + below.size[1] / 2 + part.size[1] / 2).toFixed(3)));
    updatePart({ ...part, position: [below.position[0], newY, below.position[2]] });
    setMessage('✓ အောက်ခံ အစိတ်အပိုင်းပေါ်သို့ တင်ပြီးပါပြီ။');
  };

  // Modeling Power Tools: Reorder parts
  const reorderPart = (dir: -1 | 1) => {
    if (!draft || !part) return;
    const targetIdx = partIndex + dir;
    if (targetIdx < 0 || targetIdx >= draft.parts.length) return;
    const nextParts = [...draft.parts];
    const [moved] = nextParts.splice(partIndex, 1);
    nextParts.splice(targetIdx, 0, moved);
    change({ ...draft, parts: nextParts });
    setPartIndex(targetIdx);
  };

  // Convert ANY shape to custom polygon with editable corners and edges
  const convertCurrentPartToPolygon = () => {
    if (!draft || !part) return;
    const poly = convertPartToPolygon(part);
    updatePart(poly);
    setDrawMode('edit-points');
    setSelectedVertexIdx(0);
    setMessage('✓ ပုံသဏ္ဌာန်ကို အနားနှင့် ထောင့်များ စိတ်ကြိုက်ပြင်နိုင်သော Shape အဖြစ် ပြောင်းလဲပြီးပါပြီ။');
  };

  // Delete a vertex from polygon
  const deleteVertex = (targetIdx?: number) => {
    if (!draft || !part || !part.points) return;
    if (part.points.length <= 3) {
      setMessage('အနားပုံစံတစ်ခုတွင် အနည်းဆုံး ထောင့် ၃ ခု ရှိရပါမည်။');
      return;
    }
    const idx = targetIdx ?? selectedVertexIdx;
    if (idx === null || idx < 0 || idx >= part.points.length) return;
    const nextPts = part.points.filter((_, i) => i !== idx);

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of nextPts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const cx = Number(((minX + maxX) / 2).toFixed(3));
    const cz = Number(((minZ + maxZ) / 2).toFixed(3));
    const sx = Math.max(0.04, Number((maxX - minX).toFixed(3)));
    const sz = Math.max(0.04, Number((maxZ - minZ).toFixed(3)));

    updatePart({
      ...part,
      position: [cx, part.position[1], cz],
      size: [sx, part.size[1], sz],
      points: nextPts,
    });
    setSelectedVertexIdx(Math.max(0, idx - 1));
    setMessage(`✓ ထောင့်အမှတ် ${idx + 1} ကို ဖျက်ပြီးပါပြီ (ကျန်ရှိ: ${nextPts.length} ခု)။`);
  };

  // Add vertex at midpoint after selected vertex
  const addVertexAtMidpoint = () => {
    if (!draft || !part || !part.points) return;
    if (part.points.length >= 60) {
      setMessage('အမှတ် အများဆုံး ၆၀ အထိသာ ထည့်သွင်းနိုင်ပါသည်။');
      return;
    }
    const idx = selectedVertexIdx ?? part.points.length - 1;
    const nextIdx = (idx + 1) % part.points.length;
    const p1 = part.points[idx];
    const p2 = part.points[nextIdx];
    const midX = Number(((p1[0] + p2[0]) / 2).toFixed(3));
    const midZ = Number(((p1[1] + p2[1]) / 2).toFixed(3));
    const nextPts = [...part.points];
    nextPts.splice(idx + 1, 0, [midX, midZ]);

    updatePart({ ...part, points: nextPts });
    setSelectedVertexIdx(idx + 1);
    setMessage(`＋ ထောင့်အမှတ် ${idx + 2} အသစ် ထည့်သွင်းပြီးပါပြီ။`);
  };

  // Direct vertex coordinate updates
  const updateSingleVertex = (vIdx: number, newX: number, newZ: number) => {
    if (!draft || !part || !part.points || vIdx < 0 || vIdx >= part.points.length) return;
    const nextPts = [...part.points];
    nextPts[vIdx] = [
      Number(Math.max(-1, Math.min(1, newX)).toFixed(3)),
      Number(Math.max(-1, Math.min(1, newZ)).toFixed(3)),
    ];

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of nextPts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const cx = Number(((minX + maxX) / 2).toFixed(3));
    const cz = Number(((minZ + maxZ) / 2).toFixed(3));
    const sx = Math.max(0.04, Number((maxX - minX).toFixed(3)));
    const sz = Math.max(0.04, Number((maxZ - minZ).toFixed(3)));

    updatePart({
      ...part,
      position: [cx, part.position[1], cz],
      size: [sx, part.size[1], sz],
      points: nextPts,
    });
  };

  const nudgeVertex = (vIdx: number, axis: 'x' | 'z', delta: number) => {
    if (!part?.points || vIdx < 0 || vIdx >= part.points.length) return;
    const cur = part.points[vIdx];
    const nx = axis === 'x' ? cur[0] + delta : cur[0];
    const nz = axis === 'z' ? cur[1] + delta : cur[1];
    updateSingleVertex(vIdx, nx, nz);
  };

  // Apply polygon presets (Rectangle, Triangle, Hexagon, Star, Cross)
  const applyPolygonPreset = (preset: 'box' | 'triangle' | 'hexagon' | 'star' | 'cross') => {
    if (!draft || !part) return;
    const cx = part.position[0];
    const cz = part.position[2];
    const sx = Math.max(0.2, part.size[0]);
    const sz = Math.max(0.2, part.size[2]);
    const newPts = createPolygonPreset(preset, cx, cz, sx, sz);
    updatePart({
      ...part,
      shape: 'polygon',
      points: newPts,
    });
    setSelectedVertexIdx(0);
    setDrawMode('edit-points');
    setMessage(`✓ ${preset} ပုံသဏ္ဌာန် အနားနှင့် ထောင့်များ (${newPts.length} ခု) သတ်မှတ်ပြီးပါပြီ။`);
  };

  // Duplicate active part (Blender Shift+D)
  const duplicatePart = () => {
    if (!draft || !part) return;
    if (draft.parts.length >= 40) {
      setMessage('အစိတ်အပိုင်း အများဆုံး ၄၀ အထိသာ ထည့်သွင်းနိုင်ပါသည်။');
      return;
    }
    const dup: CustomPart = {
      ...structuredClone(part),
      position: [
        Math.min(0.9, Number((part.position[0] + 0.08).toFixed(3))),
        part.position[1],
        Math.min(0.9, Number((part.position[2] + 0.08).toFixed(3))),
      ],
      ...(part.points
        ? {
            points: part.points.map(([px, py]) => [
              Number(Math.max(-1, Math.min(1, px + 0.08)).toFixed(3)),
              Number(Math.max(-1, Math.min(1, py + 0.08)).toFixed(3)),
            ]),
          }
        : {}),
    };
    change({ ...draft, parts: [...draft.parts, dup] });
    setPartIndex(draft.parts.length);
    setMessage('📋 အစိတ်အပိုင်းကို ပွားပြီးပါပြီ (Shift + D)။');
  };

  // Remove active part (Blender X / Delete)
  const removePart = () => {
    if (!draft || draft.parts.length <= 1) {
      setMessage('အနည်းဆုံး အစိတ်အပိုင်း ၁ ခု ကျန်ရှိရပါမည်။');
      return;
    }
    const nextParts = draft.parts.filter((_, i) => i !== partIndex);
    change({ ...draft, parts: nextParts });
    setPartIndex(Math.max(0, partIndex - 1));
    setMessage('✕ အစိတ်အပိုင်းကို ဖျက်ပြီးပါပြီ (X / Delete)။');
  };

  // Full Blender-style keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      // G: Grab / Move
      if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey) {
        setDrawMode('select');
        setTransformTool('translate');
        setMessage('🖐️ Move / Grab Mode (G): Canvas ပေါ်တွင် drag ဆွဲရွှေ့ပါ သို့မဟုတ် X/Z မြှားများကို ဆွဲပါ။');
      }
      // R: Rotate
      else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        setDrawMode('select');
        setTransformTool('rotate');
        setMessage('🔄 Rotate Mode (R): Canvas ပေါ်ရှိ အဝါရောင် ring ကို ဆွဲလှည့်ပါ။');
      }
      // S: Scale
      else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
        setDrawMode('select');
        setTransformTool('scale');
        setMessage('⤢ Scale Mode (S): Bounding box ထောင့်နှင့် အနား handles များကို ဆွဲ၍ အရွယ်အစား ညှိပါ။');
      }
      // Tab: Toggle Edit Mode (Vertices & Edges)
      else if (e.key === 'Tab') {
        e.preventDefault();
        if (drawMode === 'edit-points') {
          setDrawMode('select');
          setMessage('✓ Object Mode (Tab) သို့ ပြန်ပြောင်းပြီးပါပြီ။');
        } else if (part) {
          if (part.shape !== 'polygon') {
            convertCurrentPartToPolygon();
          } else {
            setDrawMode('edit-points');
            setSelectedVertexIdx(0);
            setMessage('📐 Edit Mode (Tab): အနားနှင့် ထောင့်များကို canvas ပေါ်တွင် တိုက်ရိုက် ပြင်ဆင်နိုင်ပါသည်။');
          }
        }
      }
      // Shift + D: Duplicate Part
      else if ((e.key === 'd' || e.key === 'D') && e.shiftKey) {
        e.preventDefault();
        duplicatePart();
      }
      // X or Delete: Delete selected vertex or part
      else if (e.key === 'x' || e.key === 'X' || e.key === 'Delete' || e.key === 'Backspace') {
        if (drawMode === 'edit-points') {
          if (selectedVertexIdx !== null && part?.points && part.points.length > 3) {
            e.preventDefault();
            deleteVertex();
          }
        } else if (drawMode === 'select' && part) {
          e.preventDefault();
          removePart();
        }
      }
      // View Shortcuts: 7 for Top, 1 for Front, 3 for Side
      else if (e.key === '7') {
        setViewAngle('top');
      } else if (e.key === '1') {
        setViewAngle('front');
      } else if (e.key === '3') {
        setViewAngle('side');
      }
      // Escape: Cancel Pen Tool or return to Object Mode
      else if (e.key === 'Escape') {
        if (drawMode === 'pen') {
          setDrawMode('select');
          setPenPoints([]);
          setPenCursor(null);
        } else if (drawMode === 'edit-points') {
          setDrawMode('select');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawMode, transformTool, part, partIndex, draft, selectedVertexIdx]);

  const vectorInput = (
    label: string,
    axisProp: 'position' | 'size' | 'rotation',
    values: [number, number, number],
    min: number,
    max: number,
    step = 0.05,
    onChange: (value: [number, number, number]) => void
  ) => (
    <fieldset className="asset-vector-field">
      <legend>{label}</legend>
      <div className="asset-list-vector">
        {values.map((v, i) => (
          <div key={i} className="asset-nudge-col">
            <label>
              <span className={`axis-tag axis-${['x', 'y', 'z'][i]}`}>
                {['X', 'Y', 'Z'][i]}
              </span>
              <input
                type="number"
                step={step}
                min={min}
                max={max}
                value={Number(v.toFixed(3))}
                onChange={e => {
                  const n = Number(e.target.value);
                  const next: [number, number, number] = [...values];
                  next[i] = Number.isNaN(n) ? 0 : Math.max(min, Math.min(max, n));
                  onChange(next);
                }}
              />
            </label>
            <div className="asset-nudge-btns">
              <button
                type="button"
                className="nudge-btn"
                title={`${['X', 'Y', 'Z'][i]} လျှော့ရန်`}
                onClick={() => {
                  const next: [number, number, number] = [...values];
                  next[i] = Number(Math.max(min, next[i] - step).toFixed(3));
                  onChange(next);
                }}
              >
                -
              </button>
              <button
                type="button"
                className="nudge-btn"
                title={`${['X', 'Y', 'Z'][i]} တိုးရန်`}
                onClick={() => {
                  const next: [number, number, number] = [...values];
                  next[i] = Number(Math.min(max, next[i] + step).toFixed(3));
                  onChange(next);
                }}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );

  const span = draft?.dimensions && Array.isArray(draft.dimensions)
    ? Math.max(...draft.dimensions, 2)
    : 2;

  return (
    <main className={`asset-list-page mobile-view-${mobileView}`}>
      {/* Top Header */}
      <header className="asset-list-header">
        <div className="asset-header-brand">
          <span className="asset-header-logo">🏛️</span>
          <div>
            <h1 className="asset-header-title">မြန်မာ 3D Asset စတူဒီယို</h1>
            <p className="asset-header-sub">Blender-Style Shape Builder · 3D Model Explorer</p>
          </div>
          <span className="asset-header-badge">PROTOTYPE v3.2</span>
        </div>

        <div className="asset-header-actions">
          <div className="asset-search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              placeholder="Asset ရှာရန် (ဥပမာ - ဘုန်းကြီးကျောင်း, palm, အိမ်)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="asset-search-input"
            />
          </div>

          <button
            className="asset-ai-launch-btn"
            onClick={() => setAddAI(true)}
            title="AI ဖြင့် Asset အသစ်ဖန်တီးရန်"
          >
            ✦ AI Asset ထည့်မည်
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className={`asset-list-layout asset-list-body mobile-view-${mobileView}`}>
        {/* Sidebar / Asset List */}
        <aside className="asset-list-sidebar">
          {/* Filter Pills */}
          <div className="asset-filter-pills">
            <button
              className={`pill-btn ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              အားလုံး ({ASSET_LIST.length})
            </button>
            <button
              className={`pill-btn ${typeFilter === 'custom' ? 'active' : ''}`}
              onClick={() => setTypeFilter('custom')}
            >
              စိတ်ကြိုက် ({ASSET_LIST.filter(a => a.customModel).length})
            </button>
            <button
              className={`pill-btn ${typeFilter === 'builtin' ? 'active' : ''}`}
              onClick={() => setTypeFilter('builtin')}
            >
              မူလပုံစံ ({ASSET_LIST.filter(a => !a.customModel).length})
            </button>
          </div>

          {/* Category Filter */}
          <div className="asset-cat-scroll">
            <button
              className={`cat-chip ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              🏷️ All
            </button>
            {ASSET_CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`cat-chip ${categoryFilter === c.id ? 'active' : ''}`}
                onClick={() => setCategoryFilter(c.id)}
              >
                <span>{c.icon}</span> {c.labelMm}
              </button>
            ))}
          </div>

          {/* Fast Template Starters */}
          <div className="asset-templates-card">
            <span className="asset-section-tag">ပုံစံအသစ် စတင်ရန် (Templates)</span>
            <div className="asset-template-buttons">
              <button onClick={() => startTemplate('building')} title="ရိုးရာအိမ်စတင်ရန်">
                🏠 အိမ်/တိုက်
              </button>
              <button onClick={() => startTemplate('tree')} title="သစ်ပင်စတင်ရန်">
                🌳 သစ်ပင်
              </button>
              <button onClick={() => startTemplate('character')} title="လူပုံစံစတင်ရန်">
                🧍 လူ
              </button>
              <button onClick={() => startTemplate('blank')} title="အလွတ်စတင်ရန်">
                ✨ အလွတ်
              </button>
            </div>
          </div>

          {/* Asset List Grid */}
          <div className="asset-list-scroll asset-items-list" role="list">
            {filteredAssets.length === 0 ? (
              <div className="asset-list-no-match asset-empty-state">
                <p>ရှာဖွေမှုနှင့် ကိုက်ညီသော Asset မတွေ့ပါ</p>
              </div>
            ) : (
              filteredAssets.map(a => {
                const isSelected = a.assetId === selected;
                return (
                  <div
                    key={a.assetId}
                    role="listitem"
                    className={`asset-list-item asset-card-item ${isSelected ? 'active selected' : ''}`}
                    onClick={() => {
                      if (a.customModel) {
                        const loaded = loadCustomAssets().find(c => c.id === a.assetId);
                        if (loaded) edit(loaded);
                      } else {
                        selectBuiltIn(a.assetId);
                      }
                    }}
                  >
                    <div className="asset-list-icon asset-card-icon">
                      {a.category === 'buildings' && '🏠'}
                      {a.category === 'nature' && '🌳'}
                      {a.category === 'infrastructure' && '⛩️'}
                      {a.category === 'furniture' && '🪑'}
                      {a.category === 'vehicles' && '🐂'}
                      {a.category === 'cultural' && '🕌'}
                    </div>

                    <div className="asset-item-info asset-card-meta">
                      <div className="asset-card-title-row">
                        <strong className="asset-item-name asset-card-title">{a.nameMm || a.name}</strong>
                        {a.customModel ? (
                          <span className="asset-item-tag tag-custom">CUSTOM</span>
                        ) : (
                          <span className="asset-item-tag tag-builtin">BUILTIN</span>
                        )}
                      </div>
                      <span className="asset-item-sub asset-card-subtitle">{a.name}</span>
                      <div className="asset-card-footer">
                        <span className="asset-card-cat">{a.category}</span>
                        <span className="asset-card-dim">
                          {a.defaultDimensions.width}×{a.defaultDimensions.height ?? 1}×{a.defaultDimensions.depth}m
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Workspace Canvas / Editor */}
        <section className="asset-list-workspace">
          {draft ? (
            <>
              {/* Studio Toolbar Header */}
              <div className="asset-list-title asset-list-titlebar">
                <div className="asset-title-left asset-title-group">
                  <button
                    className="asset-mobile-back-btn asset-back-btn"
                    onClick={() => setMobileView('list')}
                    title="Back to list"
                  >
                    ← စာရင်းသို့
                  </button>
                  <div className="asset-title-text-wrap">
                    <span className="asset-list-eyebrow">
                      {isNew ? '✦ NEW CUSTOM ASSET · DRAFT' : '⚙️ EDIT CUSTOM ASSET'}
                    </span>
                    <h2>{draft.name || 'အမည်မရှိသေးသော ပုံစံ'}</h2>
                    <p>{draft.nameMm || 'အစိတ်အပိုင်းများကို ပြင်ဆင်ပြီး 3D preview ကြည့်နိုင်သည်'}</p>
                  </div>
                </div>

                <div className="asset-list-buttons">
                  <button
                    disabled={!past.length || busy}
                    title="Undo"
                    onClick={() => {
                      setFuture(f => [...f, copy(draft)]);
                      setDraft(past[past.length - 1]);
                      setPast(p => p.slice(0, -1));
                      setPartIndex(0);
                    }}
                  >
                    ↶ Undo
                  </button>
                  <button
                    disabled={!future.length || busy}
                    title="Redo"
                    onClick={() => {
                      setPast(p => [...p, copy(draft)]);
                      setDraft(future[future.length - 1]);
                      setFuture(f => f.slice(0, -1));
                      setPartIndex(0);
                    }}
                  >
                    ↷ Redo
                  </button>
                  <button className="primary" disabled={busy} onClick={save}>
                    သိမ်းမည်
                  </button>
                  {!isNew && (
                    <button className="danger" onClick={remove} disabled={busy}>
                      ဖျက်မည်
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile View Segmented Tabs */}
              <div className="asset-mobile-tabs">
                <button
                  className={mobileTab === 'visual' ? 'active' : ''}
                  onClick={() => setMobileTab('visual')}
                >
                  👁️ 3D မြင်ကွင်း
                </button>
                <button
                  className={mobileTab === 'properties' ? 'active' : ''}
                  onClick={() => setMobileTab('properties')}
                >
                  ⚙️ ပြင်ဆင်ရန်
                </button>
                <button
                  className={mobileTab === 'ai' ? 'active' : ''}
                  onClick={() => setMobileTab('ai')}
                >
                  ✦ AI စနစ်
                </button>
              </div>

              {/* Editor Split View */}
              <div className={`asset-list-editor tab-active-${mobileTab}`}>
                {/* Visual Viewport (3D + 2D Plan with Figma Pen Tool) */}
                <div className="asset-list-visual">
                  {/* 3D Preview Canvas with Camera Presets */}
                  <div className="asset-list-preview">
                    <Canvas
                      camera={{
                        position: [span * 1.5, span * 1.2, span * 1.5],
                        fov: 45,
                        near: 0.01,
                        far: 1000,
                      }}
                    >
                      <ambientLight intensity={1.3} />
                      <directionalLight position={[10, 20, 10]} intensity={2} />
                      <directionalLight position={[-10, 15, -10]} intensity={0.8} />
                      <CustomAssetModel
                        asset={draft}
                        selectedPart={partIndex}
                        onSelectPart={setPartIndex}
                        editMode={drawMode === 'edit-points'}
                        selectedVertexIdx={selectedVertexIdx}
                      />
                      <Orbit height={draft.dimensions?.[1] ?? 2} viewAngle={viewAngle} />
                    </Canvas>

                    {/* Camera Angle Selector Toolbar */}
                    <div className="asset-camera-toolbar">
                      <button
                        className={`camera-btn ${viewAngle === 'perspective' ? 'active' : ''}`}
                        onClick={() => setViewAngle('perspective')}
                        title="3D Orbit Perspective"
                      >
                        👁️ 3D
                      </button>
                      <button
                        className={`camera-btn ${viewAngle === 'top' ? 'active' : ''}`}
                        onClick={() => setViewAngle('top')}
                        title="Top-down View (7)"
                      >
                        ⬆️ Top (7)
                      </button>
                      <button
                        className={`camera-btn ${viewAngle === 'front' ? 'active' : ''}`}
                        onClick={() => setViewAngle('front')}
                        title="Front View (1)"
                      >
                        ➡️ Front (1)
                      </button>
                      <button
                        className={`camera-btn ${viewAngle === 'side' ? 'active' : ''}`}
                        onClick={() => setViewAngle('side')}
                        title="Side View (3)"
                      >
                        ⬅️ Side (3)
                      </button>
                    </div>

                    <span className="asset-preview-badge">3D PREVIEW · ဆွဲလှည့်၍ ကြည့်နိုင်သည်</span>
                  </div>

                  {/* Plan Section: toggles between 2D SVG and 3D editable Canvas */}
                  <div className="asset-list-plan">
                    <div className="asset-plan-header-bar">
                      <div className="asset-plan-info">
                        <strong>
                          {planView === '3d' ? '🖥️ 3D Edit View · ဆွဲလှည့်၍ Part ရွေးနိုင်သည်' : 'အပေါ်မှကြည့်သည့် ပုံစံ (Top View Plan) · Blender Canvas'}
                        </strong>
                        <small>
                          {drawMode === 'pen'
                            ? `✒️ Pen Tool: ကလစ်နှိပ်၍ အမှတ်ချပါ (${penPoints.length} မှတ်) · Enter သို့မဟုတ် အစအမှတ်နှိပ်ပါ`
                            : drawMode === 'edit-points'
                            ? `📐 Edit Mode (Tab): အနား/ထောင့်ပြင်ဆင်မှု (${part?.points?.length ?? 0} မှတ်) · အမှတ်ဆွဲရွှေ့ပါ၊ အနားပေါ်ကလစ်၍ ထောင့်သစ်ချပါ`
                            : transformTool === 'translate'
                            ? '🖐️ Move / Grab (G): X (အနီ)/Z (အပြာ) မြှားဆွဲပါ သို့မဟုတ် ဗဟို square ကို drag ဆွဲရွှေ့ပါ'
                            : transformTool === 'rotate'
                            ? '🔄 Rotate (R): Orbit ring ပေါ်ရှိ အဝါရောင် knob ကို ဆွဲလှည့်ပါ (Snap 15°)'
                            : '⤢ Scale (S): Bounding box ထောင့်များနှင့် အနား handles များကို ဆွဲပါ'}
                        </small>
                      </div>

                      {/* Primary Mode Switcher: 2D / 3D toggle + Object/Edit/Pen modes */}
                      <div className="asset-plan-mode-toggles">
                        {/* View toggle: 3D vs 2D */}
                        <button
                          type="button"
                          className={`plan-mode-btn plan-view-btn ${planView === '3d' ? 'active' : ''}`}
                          onClick={() => setPlanView('3d')}
                          title="Full 3D Edit View (Interactive 3D Blender Canvas)"
                        >
                          🖥️ 3D View
                        </button>
                        <button
                          type="button"
                          className={`plan-mode-btn plan-view-btn ${planView === '2d' ? 'active' : ''}`}
                          onClick={() => setPlanView('2d')}
                          title="Top-View 2D Plan (SVG Blender Canvas)"
                        >
                          📐 2D Plan
                        </button>

                        <div className="plan-mode-divider" />
                        <button
                          type="button"
                          className={`plan-mode-btn ${drawMode === 'select' ? 'active' : ''}`}
                          onClick={() => {
                            setDrawMode('select');
                            setPenPoints([]);
                            setPenCursor(null);
                            setHoverEdgePoint(null);
                          }}
                          title="Object Mode (G, R, S)"
                        >
                          📦 Object
                        </button>
                        <button
                          type="button"
                          className={`plan-mode-btn ${drawMode === 'edit-points' ? 'active' : ''}`}
                          onClick={() => {
                            if (!part) {
                              setMessage('ပြင်ဆင်ရန် အစိတ်အပိုင်းတစ်ခု ရွေးချယ်ပေးပါ။');
                              return;
                            }
                            if (part.shape !== 'polygon') {
                              convertCurrentPartToPolygon();
                            } else {
                              setDrawMode('edit-points');
                              setSelectedVertexIdx(0);
                              setHoverEdgePoint(null);
                              setMessage('📐 Edit Mode (Tab): ထောင့်နှင့် အနားများ ပြင်ဆင်ရန် ဖွင့်ထားပါသည်။');
                            }
                          }}
                          title="Edit Mode / Vertices & Edges (Tab)"
                        >
                          📐 Edit
                        </button>
                        <button
                          type="button"
                          className={`plan-mode-btn pen-btn ${drawMode === 'pen' ? 'active' : ''}`}
                          onClick={() => {
                            setPlanView('2d');
                            setDrawMode('pen');
                            setPenPoints([]);
                            setHoverEdgePoint(null);
                            setMessage('✒️ Figma-style Pen Tool: SVG ပေါ်တွင် click နှိပ်၍ အမှတ်ချဆွဲပါ။');
                          }}
                          title="Figma-like Pen Tool (2D Plan Canvas)"
                        >
                          ✒️ Pen
                        </button>

                        {/* 3D-only: camera angle presets */}
                        {planView === '3d' && (
                          <>
                            <div className="plan-mode-divider" />
                            <button
                              type="button"
                              className={`plan-mode-btn ${planViewAngle === 'perspective' ? 'active' : ''}`}
                              onClick={() => setPlanViewAngle('perspective')}
                              title="Perspective View"
                            >
                              👁️ Orbit
                            </button>
                            <button
                              type="button"
                              className={`plan-mode-btn ${planViewAngle === 'top' ? 'active' : ''}`}
                              onClick={() => setPlanViewAngle('top')}
                              title="Top View (7)"
                            >
                              ⬆️ Top
                            </button>
                            <button
                              type="button"
                              className={`plan-mode-btn ${planViewAngle === 'front' ? 'active' : ''}`}
                              onClick={() => setPlanViewAngle('front')}
                              title="Front View (1)"
                            >
                              ➡️ Front
                            </button>
                            <button
                              type="button"
                              className={`plan-mode-btn ${planViewAngle === 'side' ? 'active' : ''}`}
                              onClick={() => setPlanViewAngle('side')}
                              title="Side View (3)"
                            >
                              ⬅️ Side
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Blender Transform Sub-toolbar when in Object Mode */}
                    {drawMode === 'select' && (
                      <div className="blender-transform-toolbar">
                        <div className="blender-tool-group">
                          <button
                            type="button"
                            className={`blender-tool-btn ${transformTool === 'translate' ? 'active' : ''}`}
                            onClick={() => {
                              setTransformTool('translate');
                              setMessage('🖐️ Move / Grab Mode (G): X/Z မြှားများကို ဆွဲပါ သို့မဟုတ် ဗဟို square ကို drag ဆွဲပါ။');
                            }}
                            title="Move / Translate (G)"
                          >
                            🖐️ Move (G)
                          </button>
                          <button
                            type="button"
                            className={`blender-tool-btn ${transformTool === 'rotate' ? 'active' : ''}`}
                            onClick={() => {
                              setTransformTool('rotate');
                              setMessage('🔄 Rotate Mode (R): Canvas ပေါ်ရှိ အဝါရောင် ring knob ကို ဆွဲလှည့်ပါ။');
                            }}
                            title="Rotate (R)"
                          >
                            🔄 Rotate (R)
                          </button>
                          <button
                            type="button"
                            className={`blender-tool-btn ${transformTool === 'scale' ? 'active' : ''}`}
                            onClick={() => {
                              setTransformTool('scale');
                              setMessage('⤢ Scale Mode (S): Bounding box ထောင့်များနှင့် အနား handles များကို ဆွဲ၍ ညှိပါ။');
                            }}
                            title="Scale (S)"
                          >
                            ⤢ Scale (S)
                          </button>
                        </div>

                        <div className="blender-aux-group">
                          <button
                            type="button"
                            className={`blender-snap-btn ${snapEnabled ? 'active' : ''}`}
                            onClick={() => setSnapEnabled(s => !s)}
                            title="Grid & Angle Snapping (0.05m / 15°)"
                          >
                            🧲 Snap {snapEnabled ? 'ON' : 'OFF'}
                          </button>
                          <button
                            type="button"
                            className="blender-aux-btn"
                            disabled={!part}
                            onClick={duplicatePart}
                            title="Duplicate Part (Shift + D)"
                          >
                            📋 ပွားမည် (Shift+D)
                          </button>
                          <button
                            type="button"
                            className="blender-aux-btn delete"
                            disabled={!part || (draft?.parts.length ?? 0) <= 1}
                            onClick={removePart}
                            title="Delete Part (X / Delete)"
                          >
                            ✕ ဖျက်မည် (X)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pen Tool Action Bar when drawing */}
                    {drawMode === 'pen' && (
                      <div className="asset-pen-actions-bar">
                        <button
                          type="button"
                          className="pen-finish-btn"
                          disabled={penPoints.length < 3}
                          onClick={finishPenDrawing}
                        >
                          ✓ ပုံစံပြီးပြီ (Finish 3D Shape)
                        </button>
                        <button
                          type="button"
                          className="pen-undo-btn"
                          disabled={penPoints.length === 0}
                          onClick={() => setPenPoints(p => p.slice(0, -1))}
                        >
                          ↶ အမှတ်ဖျက် (Undo)
                        </button>
                        <button
                          type="button"
                          className="pen-cancel-btn"
                          onClick={() => {
                            setDrawMode('select');
                            setPenPoints([]);
                            setPenCursor(null);
                          }}
                        >
                          ✕ ထွက်ရန်
                        </button>
                      </div>
                    )}

                    {/* Vertex & Edge Editor Action Bar */}
                    {drawMode === 'edit-points' && part?.shape === 'polygon' && (
                      <div className="asset-vertex-actions-bar">
                        <button
                          type="button"
                          className="vertex-add-btn"
                          onClick={addVertexAtMidpoint}
                          title="Insert a new vertex after selected corner"
                        >
                          ＋ ထောင့်အသစ်ချမည်
                        </button>
                        <button
                          type="button"
                          className="vertex-del-action-btn"
                          disabled={!part.points || part.points.length <= 3}
                          onClick={() => deleteVertex()}
                          title="Delete currently selected corner"
                        >
                          ⌫ ရွေးထားသော ထောင့်ဖျက်မည်
                        </button>
                        <button
                          type="button"
                          className="vertex-done-btn"
                          onClick={() => {
                            setDrawMode('select');
                            setHoverEdgePoint(null);
                            setMessage('✓ အနား/ထောင့် ပြင်ဆင်ခြင်း သိမ်းဆည်းပြီးပါပြီ။');
                          }}
                        >
                          ✓ ပြီးပြီ (Done)
                        </button>
                      </div>
                    )}

                    {/* ──── 3D Editable Canvas (planView === '3d') ──── */}
                    {planView === '3d' ? (
                      <div className="asset-svg-frame asset-plan-3d-frame">
                        <Canvas
                          camera={{
                            position: [span * 1.5, span * 1.2, span * 1.5],
                            fov: 45,
                            near: 0.01,
                            far: 1000,
                          }}
                        >
                          <ambientLight intensity={1.2} />
                          <directionalLight position={[10, 20, 10]} intensity={2.2} />
                          <directionalLight position={[-8, 12, -8]} intensity={0.9} />
                          {/* Ground grid helper */}
                          <gridHelper args={[span * 4, 20, '#1f4d40', '#153228']} position={[0, 0, 0]} />
                          <CustomAssetModel
                            asset={draft}
                            selectedPart={partIndex}
                            onSelectPart={idx => {
                              setPartIndex(idx);
                              setMessage(`✓ Part ${idx + 1} (${draft.parts[idx]?.shape}) ကို 3D View မှ ရွေးပြီးပါပြီ။`);
                            }}
                            editMode={drawMode === 'edit-points'}
                            selectedVertexIdx={selectedVertexIdx}
                          />
                          <TransformGizmo
                            part={part}
                            dimensions={draft.dimensions}
                            transformTool={transformTool}
                            snapEnabled={snapEnabled}
                            onLiveUpdate={updatePartLive}
                            onBeforeChange={recordHistoryBeforeChange}
                            orbitControlsRef={planOrbitRef}
                          />
                          <Orbit
                            height={draft.dimensions?.[1] ?? 2}
                            viewAngle={planViewAngle}
                            controlsRef={planOrbitRef}
                          />
                        </Canvas>

                        {/* Quick 3D Nudge / Transform Buttons Overlay */}
                        {part && (
                          <div className="canvas-3d-quick-tools" aria-label="Quick 3D Transform Controls">
                            <div className="quick-3d-group">
                              <span className="quick-3d-label">X:</span>
                              <button
                                type="button"
                                className="quick-3d-btn"
                                onClick={() => {
                                  recordHistoryBeforeChange();
                                  updatePartLive({ ...part, position: [Number((part.position[0] - 0.05).toFixed(3)), part.position[1], part.position[2]] });
                                }}
                                title="Move -X (0.05m)"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                className="quick-3d-btn"
                                onClick={() => {
                                  recordHistoryBeforeChange();
                                  updatePartLive({ ...part, position: [Number((part.position[0] + 0.05).toFixed(3)), part.position[1], part.position[2]] });
                                }}
                                title="Move +X (0.05m)"
                              >
                                ＋
                              </button>
                            </div>

                            <div className="quick-3d-group">
                              <span className="quick-3d-label">Y:</span>
                              <button
                                type="button"
                                className="quick-3d-btn"
                                onClick={() => {
                                  recordHistoryBeforeChange();
                                  updatePartLive({ ...part, position: [part.position[0], Math.max(0, Number((part.position[1] - 0.05).toFixed(3))), part.position[2]] });
                                }}
                                title="Move -Y (Height)"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                className="quick-3d-btn"
                                onClick={() => {
                                  recordHistoryBeforeChange();
                                  updatePartLive({ ...part, position: [part.position[0], Number((part.position[1] + 0.05).toFixed(3)), part.position[2]] });
                                }}
                                title="Move +Y (Height)"
                              >
                                ＋
                              </button>
                            </div>

                            <div className="quick-3d-group">
                              <span className="quick-3d-label">Z:</span>
                              <button
                                type="button"
                                className="quick-3d-btn"
                                onClick={() => {
                                  recordHistoryBeforeChange();
                                  updatePartLive({ ...part, position: [part.position[0], part.position[1], Number((part.position[2] - 0.05).toFixed(3))] });
                                }}
                                title="Move -Z (0.05m)"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                className="quick-3d-btn"
                                onClick={() => {
                                  recordHistoryBeforeChange();
                                  updatePartLive({ ...part, position: [part.position[0], part.position[1], Number((part.position[2] + 0.05).toFixed(3))] });
                                }}
                                title="Move +Z (0.05m)"
                              >
                                ＋
                              </button>
                            </div>

                            <div className="quick-3d-group">
                              <span className="quick-3d-label">🔄:</span>
                              <button
                                type="button"
                                className="quick-3d-btn"
                                onClick={() => {
                                  recordHistoryBeforeChange();
                                  const cur = part.rotation ?? [0, 0, 0];
                                  const rot: [number, number, number] = [cur[0], (cur[1] - 15 + 360) % 360, cur[2]];
                                  updatePartLive({ ...part, rotation: rot });
                                }}
                                title="Rotate -15°"
                              >
                                ↺
                              </button>
                              <button
                                type="button"
                                className="quick-3d-btn"
                                onClick={() => {
                                  recordHistoryBeforeChange();
                                  const cur = part.rotation ?? [0, 0, 0];
                                  const rot: [number, number, number] = [cur[0], (cur[1] + 15) % 360, cur[2]];
                                  updatePartLive({ ...part, rotation: rot });
                                }}
                                title="Rotate +15°"
                              >
                                ↻
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Part info overlay */}
                        {part && (
                          <div className="canvas-blender-hud" aria-label="3D Plan HUD">
                            <div className="hud-badge active-part">
                              Part {partIndex + 1}/{draft.parts.length} ({part.shape})
                            </div>
                            <div className="hud-badge coord">
                              X: {part.position[0].toFixed(2)} · Y: {part.position[1].toFixed(2)} · Z: {part.position[2].toFixed(2)}
                            </div>
                            <div className="hud-badge size">
                              {part.size[0].toFixed(2)} × {part.size[1].toFixed(2)} × {part.size[2].toFixed(2)}m
                            </div>
                            <div className="hud-badge rot">
                              🔄 {(part.rotation?.[1] ?? 0).toFixed(0)}°
                            </div>
                          </div>
                        )}

                        <span className="asset-preview-badge">
                          3D EDIT · 3D Gizmo (G/R/S) ဆွဲရွှေ့ပါ · Part ကိုနှိပ်ရွေးပါ
                        </span>
                      </div>
                    ) : (
                      /* ──── 2D SVG Blender Canvas (planView === '2d') ──── */
                      <>

                    {/* Interactive SVG Drawing Canvas */}
                    <div className="asset-svg-frame">
                      <svg
                        viewBox="-1 -1 2 2"
                        className={`asset-top-svg mode-${drawMode}`}
                        aria-label="Top view plan & pen tool canvas"
                        onPointerMove={e => {
                          const pt = e.currentTarget.createSVGPoint();
                          pt.x = e.clientX;
                          pt.y = e.clientY;
                          const matrix = e.currentTarget.getScreenCTM();
                          if (!matrix) return;
                          const pos = pt.matrixTransform(matrix.inverse());
                          const nx = Math.max(-1, Math.min(1, Number(pos.x.toFixed(3))));
                          const ny = Math.max(-1, Math.min(1, Number(pos.y.toFixed(3))));

                          if (drawMode === 'pen') {
                            setPenCursor([nx, ny]);
                            return;
                          }

                          if (drawMode === 'edit-points') {
                            if (draggingVertexIdx !== null && part?.points) {
                              const nextPts = [...part.points];
                              nextPts[draggingVertexIdx] = [nx, ny];
                              let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
                              for (const [x, z] of nextPts) {
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (z < minZ) minZ = z;
                                if (z > maxZ) maxZ = z;
                              }
                              const cx = Number(((minX + maxX) / 2).toFixed(3));
                              const cz = Number(((minZ + maxZ) / 2).toFixed(3));
                              const sx = Math.max(0.04, Number((maxX - minX).toFixed(3)));
                              const sz = Math.max(0.04, Number((maxZ - minZ).toFixed(3)));
                              updatePart({
                                ...part,
                                position: [cx, part.position[1], cz],
                                size: [sx, part.size[1], sz],
                                points: nextPts,
                              });
                              setHoverEdgePoint(null);
                              return;
                            }

                            // Detect hover over edge to insert a vertex
                            if (part?.shape === 'polygon' && part.points && part.points.length >= 3) {
                              const pts = part.points;
                              let closest: { index: number; x: number; y: number } | null = null;
                              let minDist = 0.08;
                              for (let i = 0; i < pts.length; i++) {
                                const p1 = pts[i];
                                const p2 = pts[(i + 1) % pts.length];
                                const res = distanceToSegment(nx, ny, p1[0], p1[1], p2[0], p2[1]);
                                if (res.dist < minDist && res.t > 0.08 && res.t < 0.92) {
                                  minDist = res.dist;
                                  closest = { index: i, x: Number(res.projX.toFixed(3)), y: Number(res.projY.toFixed(3)) };
                                }
                              }
                              setHoverEdgePoint(closest);
                            }
                            return;
                          }

                          // Blender-style on-canvas Gizmo and transform dragging
                          if (canvasDrag && part) {
                            const snap = (val: number, step = 0.05) => (snapEnabled ? Math.round(val / step) * step : val);

                            if (canvasDrag.type === 'move-free') {
                              const rawDx = nx - canvasDrag.startPointer[0];
                              const rawDz = ny - canvasDrag.startPointer[1];
                              const newX = Number(Math.max(-0.95, Math.min(0.95, snap(canvasDrag.startPos[0] + rawDx))).toFixed(3));
                              const newZ = Number(Math.max(-0.95, Math.min(0.95, snap(canvasDrag.startPos[2] + rawDz))).toFixed(3));
                              const finalDx = newX - canvasDrag.startPos[0];
                              const finalDz = newZ - canvasDrag.startPos[2];

                              if (part.shape === 'polygon' && canvasDrag.startPoints) {
                                const nextPts = canvasDrag.startPoints.map(([px, pz]) => [
                                  Number(Math.max(-1, Math.min(1, px + finalDx)).toFixed(3)),
                                  Number(Math.max(-1, Math.min(1, pz + finalDz)).toFixed(3)),
                                ] as [number, number]);
                                updatePart({ ...part, position: [newX, part.position[1], newZ], points: nextPts });
                              } else {
                                updatePart({ ...part, position: [newX, part.position[1], newZ] });
                              }
                            } else if (canvasDrag.type === 'move-x') {
                              const rawDx = nx - canvasDrag.startPointer[0];
                              const newX = Number(Math.max(-0.95, Math.min(0.95, snap(canvasDrag.startPos[0] + rawDx))).toFixed(3));
                              const finalDx = newX - canvasDrag.startPos[0];

                              if (part.shape === 'polygon' && canvasDrag.startPoints) {
                                const nextPts = canvasDrag.startPoints.map(([px, pz]) => [
                                  Number(Math.max(-1, Math.min(1, px + finalDx)).toFixed(3)),
                                  pz,
                                ] as [number, number]);
                                updatePart({ ...part, position: [newX, part.position[1], part.position[2]], points: nextPts });
                              } else {
                                updatePart({ ...part, position: [newX, part.position[1], part.position[2]] });
                              }
                            } else if (canvasDrag.type === 'move-z') {
                              const rawDz = ny - canvasDrag.startPointer[1];
                              const newZ = Number(Math.max(-0.95, Math.min(0.95, snap(canvasDrag.startPos[2] + rawDz))).toFixed(3));
                              const finalDz = newZ - canvasDrag.startPos[2];

                              if (part.shape === 'polygon' && canvasDrag.startPoints) {
                                const nextPts = canvasDrag.startPoints.map(([px, pz]) => [
                                  px,
                                  Number(Math.max(-1, Math.min(1, pz + finalDz)).toFixed(3)),
                                ] as [number, number]);
                                updatePart({ ...part, position: [part.position[0], part.position[1], newZ], points: nextPts });
                              } else {
                                updatePart({ ...part, position: [part.position[0], part.position[1], newZ] });
                              }
                            } else if (canvasDrag.type === 'rotate') {
                              const curAngleRad = Math.atan2(ny - part.position[2], nx - part.position[0]);
                              const curAngleDeg = (curAngleRad * 180) / Math.PI;
                              const delta = curAngleDeg - canvasDrag.startAngle;
                              let nextRot = canvasDrag.startRotY - delta;
                              if (snapEnabled) {
                                nextRot = Math.round(nextRot / 15) * 15;
                              }
                              nextRot = ((nextRot % 360) + 360) % 360;
                              updatePart({
                                ...part,
                                rotation: [part.rotation?.[0] ?? 0, Number(nextRot.toFixed(1)), part.rotation?.[2] ?? 0],
                              });
                            } else if (canvasDrag.type === 'scale-corner') {
                              const rawHalfW = Math.abs(nx - part.position[0]);
                              const rawHalfD = Math.abs(ny - part.position[2]);
                              const newW = Math.max(0.06, snap(rawHalfW * 2, 0.05));
                              const newD = Math.max(0.06, snap(rawHalfD * 2, 0.05));

                              if (part.shape === 'polygon' && canvasDrag.startPoints && canvasDrag.startSize[0] > 0 && canvasDrag.startSize[2] > 0) {
                                const scaleX = newW / canvasDrag.startSize[0];
                                const scaleZ = newD / canvasDrag.startSize[2];
                                const cx = part.position[0];
                                const cz = part.position[2];
                                const nextPts = canvasDrag.startPoints.map(([px, pz]) => [
                                  Number(Math.max(-1, Math.min(1, cx + (px - cx) * scaleX)).toFixed(3)),
                                  Number(Math.max(-1, Math.min(1, cz + (pz - cz) * scaleZ)).toFixed(3)),
                                ] as [number, number]);
                                updatePart({
                                  ...part,
                                  size: [Number(newW.toFixed(3)), part.size[1], Number(newD.toFixed(3))],
                                  points: nextPts,
                                });
                              } else {
                                updatePart({
                                  ...part,
                                  size: [Number(newW.toFixed(3)), part.size[1], Number(newD.toFixed(3))],
                                });
                              }
                            } else if (canvasDrag.type === 'scale-edge') {
                              if (canvasDrag.edge === 'left' || canvasDrag.edge === 'right') {
                                const rawHalfW = Math.abs(nx - part.position[0]);
                                const newW = Math.max(0.06, snap(rawHalfW * 2, 0.05));
                                if (part.shape === 'polygon' && canvasDrag.startPoints && canvasDrag.startSize[0] > 0) {
                                  const scaleX = newW / canvasDrag.startSize[0];
                                  const cx = part.position[0];
                                  const nextPts = canvasDrag.startPoints.map(([px, pz]) => [
                                    Number(Math.max(-1, Math.min(1, cx + (px - cx) * scaleX)).toFixed(3)),
                                    pz,
                                  ] as [number, number]);
                                  updatePart({
                                    ...part,
                                    size: [Number(newW.toFixed(3)), part.size[1], part.size[2]],
                                    points: nextPts,
                                  });
                                } else {
                                  updatePart({
                                    ...part,
                                    size: [Number(newW.toFixed(3)), part.size[1], part.size[2]],
                                  });
                                }
                              } else {
                                const rawHalfD = Math.abs(ny - part.position[2]);
                                const newD = Math.max(0.06, snap(rawHalfD * 2, 0.05));
                                if (part.shape === 'polygon' && canvasDrag.startPoints && canvasDrag.startSize[2] > 0) {
                                  const scaleZ = newD / canvasDrag.startSize[2];
                                  const cz = part.position[2];
                                  const nextPts = canvasDrag.startPoints.map(([px, pz]) => [
                                    px,
                                    Number(Math.max(-1, Math.min(1, cz + (pz - cz) * scaleZ)).toFixed(3)),
                                  ] as [number, number]);
                                  updatePart({
                                    ...part,
                                    size: [part.size[0], part.size[1], Number(newD.toFixed(3))],
                                    points: nextPts,
                                  });
                                } else {
                                  updatePart({
                                    ...part,
                                    size: [part.size[0], part.size[1], Number(newD.toFixed(3))],
                                  });
                                }
                              }
                            } else if (canvasDrag.type === 'height') {
                              const ratio = Math.max(0.025, Math.min(1.0, (0.8 - ny) / 1.6));
                              const newH = Math.max(0.05, snap(ratio * 2.0, 0.05));
                              updatePart({
                                ...part,
                                size: [part.size[0], Number(newH.toFixed(3)), part.size[2]],
                              });
                            }
                          }
                        }}
                        onPointerUp={() => {
                          setDraggingVertexIdx(null);
                          setCanvasDrag(null);
                        }}
                        onClick={e => {
                          const pt = e.currentTarget.createSVGPoint();
                          pt.x = e.clientX;
                          pt.y = e.clientY;
                          const matrix = e.currentTarget.getScreenCTM();
                          if (!matrix) return;
                          const pos = pt.matrixTransform(matrix.inverse());
                          const nx = Math.max(-1, Math.min(1, Number(pos.x.toFixed(3))));
                          const ny = Math.max(-1, Math.min(1, Number(pos.y.toFixed(3))));

                          if (drawMode === 'pen') {
                            if (penPoints.length >= 3) {
                              const [p0x, p0y] = penPoints[0];
                              const dist = Math.hypot(nx - p0x, ny - p0y);
                              if (dist < 0.1) {
                                finishPenDrawing();
                                return;
                              }
                            }
                            setPenPoints(prev => [...prev, [nx, ny]]);
                            return;
                          }

                          if (drawMode === 'edit-points' && hoverEdgePoint && part?.points) {
                            const nextPts = [...part.points];
                            nextPts.splice(hoverEdgePoint.index + 1, 0, [hoverEdgePoint.x, hoverEdgePoint.y]);
                            updatePart({ ...part, points: nextPts });
                            setSelectedVertexIdx(hoverEdgePoint.index + 1);
                            setHoverEdgePoint(null);
                            setMessage(`＋ အနားပေါ်တွင် ထောင့်အသစ် (${hoverEdgePoint.index + 2}) ထည့်သွင်းပြီးပါပြီ။`);
                          }
                        }}
                      >
                        {/* Coordinate Grid Background */}
                        <rect x="-1" y="-1" width="2" height="2" fill="#0f1e1a" />
                        <line x1="-1" y1="0" x2="1" y2="0" stroke="#1c3d34" strokeWidth="0.015" />
                        <line x1="0" y1="-1" x2="0" y2="1" stroke="#1c3d34" strokeWidth="0.015" />
                        <circle cx="0" cy="0" r="0.03" fill="#2d5e51" />

                        {/* Parts with Shape-Specific 2D Silhouettes */}
                        {draft.parts.map((p, i) => {
                          const isSelected = i === partIndex;
                          const strokeColor = isSelected ? '#5eead4' : '#475569';
                          const strokeW = isSelected ? 0.035 : 0.012;
                          const rx = p.position[0];
                          const ry = p.position[2];
                          const sx = Math.max(0.04, p.size[0]);
                          const sz = Math.max(0.04, p.size[2]);
                          const rot = -(p.rotation?.[1] ?? 0);

                          const handleShapePointerDown = (e: React.PointerEvent<SVGElement>) => {
                            if (drawMode === 'pen') return;
                            const svg = (e.currentTarget as SVGElement).ownerSVGElement;
                            svg?.setPointerCapture(e.pointerId);
                            setPartIndex(i);
                            if (drawMode === 'select' && transformTool === 'translate') {
                              const pt = svg?.createSVGPoint();
                              if (pt) {
                                pt.x = e.clientX;
                                pt.y = e.clientY;
                                const matrix = svg?.getScreenCTM();
                                if (matrix) {
                                  const pos = pt.matrixTransform(matrix.inverse());
                                  setCanvasDrag({
                                    type: 'move-free',
                                    startPos: [...p.position],
                                    startPointer: [pos.x, pos.y],
                                    startPoints: p.points ? structuredClone(p.points) : undefined,
                                  });
                                }
                              }
                            }
                          };

                          if (p.shape === 'polygon' && p.points && p.points.length >= 3) {
                            const pointsStr = p.points.map(([px, py]) => `${px},${py}`).join(' ');
                            return (
                              <g key={i}>
                                <polygon
                                  points={pointsStr}
                                  fill={p.color}
                                  stroke={strokeColor}
                                  strokeWidth={strokeW}
                                  opacity={0.88}
                                  onPointerDown={handleShapePointerDown}
                                />
                                {isSelected &&
                                  drawMode === 'edit-points' &&
                                  p.points.map(([vx, vy], vIdx) => {
                                    const isCur = vIdx === selectedVertexIdx;
                                    return (
                                      <g key={vIdx}>
                                        {/* Selection ring */}
                                        {isCur && (
                                          <circle
                                            cx={vx}
                                            cy={vy}
                                            r={0.08}
                                            fill="none"
                                            stroke="#10b981"
                                            strokeWidth={0.02}
                                            strokeDasharray="0.03, 0.03"
                                          />
                                        )}
                                        <circle
                                          cx={vx}
                                          cy={vy}
                                          r={isCur ? 0.055 : 0.045}
                                          fill={isCur ? '#fbbf24' : '#ffffff'}
                                          stroke={isCur ? '#b45309' : '#0f766e'}
                                          strokeWidth={0.015}
                                          style={{ cursor: 'grab' }}
                                          onPointerDown={e => {
                                            e.stopPropagation();
                                            e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                                            setDraggingVertexIdx(vIdx);
                                            setSelectedVertexIdx(vIdx);
                                          }}
                                          onContextMenu={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            deleteVertex(vIdx);
                                          }}
                                        />
                                        <text
                                          x={vx}
                                          y={vy - 0.065}
                                          fontSize="0.06"
                                          fontWeight="bold"
                                          fill={isCur ? '#fbbf24' : '#a7f3d0'}
                                          textAnchor="middle"
                                          pointerEvents="none"
                                        >
                                          {vIdx + 1}
                                        </text>
                                      </g>
                                    );
                                  })}

                                {/* Hover '+' indicator on edge to insert a vertex */}
                                {isSelected && drawMode === 'edit-points' && hoverEdgePoint && (
                                  <g className="hover-edge-indicator">
                                    <circle
                                      cx={hoverEdgePoint.x}
                                      cy={hoverEdgePoint.y}
                                      r={0.05}
                                      fill="#10b981"
                                      stroke="#ffffff"
                                      strokeWidth={0.015}
                                      style={{ cursor: 'copy' }}
                                    />
                                    <text
                                      x={hoverEdgePoint.x}
                                      y={hoverEdgePoint.y + 0.02}
                                      fontSize="0.06"
                                      fontWeight="bold"
                                      fill="#ffffff"
                                      textAnchor="middle"
                                      pointerEvents="none"
                                    >
                                      +
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          }

                          if (p.shape === 'sphere' || p.shape === 'dome') {
                            return (
                              <circle
                                key={i}
                                cx={rx}
                                cy={ry}
                                r={Math.max(0.04, Math.min(sx, sz) / 2)}
                                fill={p.color}
                                stroke={strokeColor}
                                strokeWidth={strokeW}
                                onPointerDown={handleShapePointerDown}
                              />
                            );
                          }
                          if (p.shape === 'cylinder' || p.shape === 'cone') {
                            return (
                              <ellipse
                                key={i}
                                transform={`rotate(${rot} ${rx} ${ry})`}
                                cx={rx}
                                cy={ry}
                                rx={sx / 2}
                                ry={sz / 2}
                                fill={p.color}
                                stroke={strokeColor}
                                strokeWidth={strokeW}
                                onPointerDown={handleShapePointerDown}
                              />
                            );
                          }
                          if (p.shape === 'torus') {
                            const rOuter = Math.max(0.06, Math.max(sx, sz) / 2);
                            const rInner = Math.max(0.02, rOuter * 0.55);
                            return (
                              <g
                                key={i}
                                transform={`rotate(${rot} ${rx} ${ry})`}
                                onPointerDown={handleShapePointerDown}
                              >
                                <circle cx={rx} cy={ry} r={rOuter} fill={p.color} stroke={strokeColor} strokeWidth={strokeW} />
                                <circle cx={rx} cy={ry} r={rInner} fill="#0f1e1a" stroke={strokeColor} strokeWidth={strokeW * 0.7} />
                              </g>
                            );
                          }
                          // Box, Pyramid, Wedge, Capsule
                          return (
                            <rect
                              key={i}
                              transform={`rotate(${rot} ${rx} ${ry})`}
                              x={rx - sx / 2}
                              y={ry - sz / 2}
                              width={sx}
                              height={sz}
                              rx={p.shape === 'capsule' ? Math.min(sx, sz) / 2 : p.shape === 'wedge' ? 0.02 : 0}
                              fill={p.color}
                              stroke={strokeColor}
                              strokeWidth={strokeW}
                              onPointerDown={handleShapePointerDown}
                            />
                          );
                        })}

                        {/* Extrusion / Height Ruler Handle (Blender Vertical Y Scale) */}
                        {part && drawMode !== 'pen' && (() => {
                          const h = Math.max(0.05, Math.min(2.0, part.size[1]));
                          const yKnob = 0.8 - (h / 2.0) * 1.6;
                          return (
                            <g className="canvas-height-ruler" aria-label="Height Ruler">
                              {/* Ruler background track */}
                              <line x1="-0.92" y1="-0.8" x2="-0.92" y2="0.8" stroke="#1e293b" strokeWidth="0.03" strokeLinecap="round" />
                              {/* Ticks: 0m, 0.5m, 1.0m, 1.5m, 2.0m */}
                              {[0, 0.5, 1.0, 1.5, 2.0].map(val => {
                                const yVal = 0.8 - (val / 2.0) * 1.6;
                                return (
                                  <g key={val}>
                                    <line x1="-0.95" y1={yVal} x2="-0.89" y2={yVal} stroke="#64748b" strokeWidth="0.008" />
                                    <text x="-0.87" y={yVal + 0.015} fill="#64748b" fontSize="0.04" fontWeight="600">
                                      {val}m
                                    </text>
                                  </g>
                                );
                              })}
                              {/* Active height bar */}
                              <line x1="-0.92" y1="0.8" x2="-0.92" y2={yKnob} stroke="#14b8a6" strokeWidth="0.025" strokeLinecap="round" />
                              {/* Draggable knob */}
                              <circle
                                cx="-0.92"
                                cy={yKnob}
                                r={0.06}
                                fill="#14b8a6"
                                stroke="#ffffff"
                                strokeWidth={0.015}
                                style={{ cursor: 'ns-resize' }}
                                onPointerDown={e => {
                                  e.stopPropagation();
                                  e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                                  const pt = e.currentTarget.ownerSVGElement?.createSVGPoint();
                                  if (!pt) return;
                                  pt.x = e.clientX;
                                  pt.y = e.clientY;
                                  const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
                                  if (!matrix) return;
                                  const pos = pt.matrixTransform(matrix.inverse());
                                  setCanvasDrag({
                                    type: 'height',
                                    startHeight: part.size[1],
                                    startPointerY: pos.y,
                                  });
                                }}
                              />
                              {/* Height readout badge */}
                              <g transform={`translate(-0.68, ${yKnob})`}>
                                <rect x="-0.15" y="-0.045" width="0.30" height="0.09" rx="0.02" fill="#042f2e" stroke="#14b8a6" strokeWidth="0.008" />
                                <text x="0" y="0.015" fill="#5eead4" fontSize="0.045" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                                  ↕ {part.size[1].toFixed(2)}m
                                </text>
                              </g>
                            </g>
                          );
                        })()}

                        {/* Interactive Blender Transform Gizmos on Active Selected Part */}
                        {part && drawMode === 'select' && (() => {
                          const cx = part.position[0];
                          const cz = part.position[2];
                          const sx = Math.max(0.06, part.size[0]);
                          const sz = Math.max(0.06, part.size[2]);
                          const rotDeg = -(part.rotation?.[1] ?? 0);

                          return (
                            <g className="blender-canvas-gizmos">
                              {/* 1. Translate Gizmo (G / Move) */}
                              {transformTool === 'translate' && (
                                <g className="gizmo-translate">
                                  {/* Center Square (Free Move) */}
                                  <rect
                                    x={cx - 0.045}
                                    y={cz - 0.045}
                                    width={0.09}
                                    height={0.09}
                                    rx={0.02}
                                    fill="#10b981"
                                    stroke="#ffffff"
                                    strokeWidth={0.015}
                                    style={{ cursor: 'move' }}
                                    onPointerDown={e => {
                                      e.stopPropagation();
                                      e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                                      const pt = e.currentTarget.ownerSVGElement?.createSVGPoint();
                                      if (!pt) return;
                                      pt.x = e.clientX;
                                      pt.y = e.clientY;
                                      const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
                                      if (!matrix) return;
                                      const pos = pt.matrixTransform(matrix.inverse());
                                      setCanvasDrag({
                                        type: 'move-free',
                                        startPos: [...part.position],
                                        startPointer: [pos.x, pos.y],
                                        startPoints: part.points ? structuredClone(part.points) : undefined,
                                      });
                                    }}
                                  />
                                  <line x1={cx - 0.025} y1={cz} x2={cx + 0.025} y2={cz} stroke="#ffffff" strokeWidth={0.008} pointerEvents="none" />
                                  <line x1={cx} y1={cz - 0.025} x2={cx} y2={cz + 0.025} stroke="#ffffff" strokeWidth={0.008} pointerEvents="none" />

                                  {/* Red X Axis Arrow (Horizontal) */}
                                  <g className="gizmo-axis-x">
                                    <line x1={cx + 0.045} y1={cz} x2={cx + 0.30} y2={cz} stroke="#ef4444" strokeWidth={0.035} strokeLinecap="round" />
                                    <polygon
                                      points={`${cx + 0.38},${cz} ${cx + 0.28},${cz - 0.05} ${cx + 0.28},${cz + 0.05}`}
                                      fill="#ef4444"
                                      stroke="#ffffff"
                                      strokeWidth={0.008}
                                    />
                                    <text x={cx + 0.43} y={cz + 0.025} fill="#ef4444" fontSize="0.065" fontWeight="bold">
                                      X
                                    </text>
                                    <line
                                      x1={cx + 0.045}
                                      y1={cz}
                                      x2={cx + 0.40}
                                      y2={cz}
                                      stroke="transparent"
                                      strokeWidth={0.14}
                                      style={{ cursor: 'ew-resize' }}
                                      onPointerDown={e => {
                                        e.stopPropagation();
                                        e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                                        const pt = e.currentTarget.ownerSVGElement?.createSVGPoint();
                                        if (!pt) return;
                                        pt.x = e.clientX;
                                        pt.y = e.clientY;
                                        const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
                                        if (!matrix) return;
                                        const pos = pt.matrixTransform(matrix.inverse());
                                        setCanvasDrag({
                                          type: 'move-x',
                                          startPos: [...part.position],
                                          startPointer: [pos.x, pos.y],
                                          startPoints: part.points ? structuredClone(part.points) : undefined,
                                        });
                                      }}
                                    />
                                  </g>

                                  {/* Blue Z Axis Arrow (Vertical in plan, Z in 3D) */}
                                  <g className="gizmo-axis-z">
                                    <line x1={cx} y1={cz + 0.045} x2={cx} y2={cz + 0.30} stroke="#3b82f6" strokeWidth={0.035} strokeLinecap="round" />
                                    <polygon
                                      points={`${cx},${cz + 0.38} ${cx - 0.05},${cz + 0.28} ${cx + 0.05},${cz + 0.28}`}
                                      fill="#3b82f6"
                                      stroke="#ffffff"
                                      strokeWidth={0.008}
                                    />
                                    <text x={cx} y={cz + 0.47} fill="#3b82f6" fontSize="0.065" fontWeight="bold" textAnchor="middle">
                                      Z
                                    </text>
                                    <line
                                      x1={cx}
                                      y1={cz + 0.045}
                                      x2={cx}
                                      y2={cz + 0.40}
                                      stroke="transparent"
                                      strokeWidth={0.14}
                                      style={{ cursor: 'ns-resize' }}
                                      onPointerDown={e => {
                                        e.stopPropagation();
                                        e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                                        const pt = e.currentTarget.ownerSVGElement?.createSVGPoint();
                                        if (!pt) return;
                                        pt.x = e.clientX;
                                        pt.y = e.clientY;
                                        const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
                                        if (!matrix) return;
                                        const pos = pt.matrixTransform(matrix.inverse());
                                        setCanvasDrag({
                                          type: 'move-z',
                                          startPos: [...part.position],
                                          startPointer: [pos.x, pos.y],
                                          startPoints: part.points ? structuredClone(part.points) : undefined,
                                        });
                                      }}
                                    />
                                  </g>
                                </g>
                              )}

                              {/* 2. Rotate Gizmo (R / Rotate) */}
                              {transformTool === 'rotate' && (() => {
                                const rRing = Math.max(0.28, Math.max(sx, sz) * 0.72 + 0.08);
                                const curRot = part.rotation?.[1] ?? 0;
                                const angleRad = (-curRot * Math.PI) / 180;
                                const knobX = cx + rRing * Math.cos(angleRad);
                                const knobY = cz + rRing * Math.sin(angleRad);
                                return (
                                  <g className="gizmo-rotate">
                                    <circle cx={cx} cy={cz} r={rRing} fill="none" stroke="#06b6d4" strokeWidth={0.02} strokeDasharray="0.04, 0.03" opacity={0.8} />
                                    {/* Thick invisible hit ring */}
                                    <circle
                                      cx={cx}
                                      cy={cz}
                                      r={rRing}
                                      fill="none"
                                      stroke="transparent"
                                      strokeWidth={0.14}
                                      style={{ cursor: 'crosshair' }}
                                      onPointerDown={e => {
                                        e.stopPropagation();
                                        e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                                        const pt = e.currentTarget.ownerSVGElement?.createSVGPoint();
                                        if (!pt) return;
                                        pt.x = e.clientX;
                                        pt.y = e.clientY;
                                        const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
                                        if (!matrix) return;
                                        const pos = pt.matrixTransform(matrix.inverse());
                                        const startAngle = (Math.atan2(pos.y - cz, pos.x - cx) * 180) / Math.PI;
                                        setCanvasDrag({ type: 'rotate', startAngle, startRotY: curRot });
                                      }}
                                    />
                                    {/* Spoke line */}
                                    <line x1={cx} y1={cz} x2={knobX} y2={knobY} stroke="#fbbf24" strokeWidth={0.02} strokeDasharray="0.02, 0.02" />
                                    {/* Draggable gold knob */}
                                    <circle
                                      cx={knobX}
                                      cy={knobY}
                                      r={0.065}
                                      fill="#fbbf24"
                                      stroke="#78350f"
                                      strokeWidth={0.015}
                                      style={{ cursor: 'grab' }}
                                      onPointerDown={e => {
                                        e.stopPropagation();
                                        e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                                        const pt = e.currentTarget.ownerSVGElement?.createSVGPoint();
                                        if (!pt) return;
                                        pt.x = e.clientX;
                                        pt.y = e.clientY;
                                        const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
                                        if (!matrix) return;
                                        const pos = pt.matrixTransform(matrix.inverse());
                                        const startAngle = (Math.atan2(pos.y - cz, pos.x - cx) * 180) / Math.PI;
                                        setCanvasDrag({ type: 'rotate', startAngle, startRotY: curRot });
                                      }}
                                    />
                                    <circle cx={knobX} cy={knobY} r={0.025} fill="#ffffff" pointerEvents="none" />
                                    {/* Live degree badge */}
                                    <g transform={`translate(${cx}, ${cz - rRing - 0.06})`}>
                                      <rect x="-0.16" y="-0.05" width="0.32" height="0.10" rx="0.025" fill="#0f172a" stroke="#06b6d4" strokeWidth="0.01" />
                                      <text x="0" y="0.01" fill="#22d3ee" fontSize="0.055" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                                        {curRot.toFixed(0)}°
                                      </text>
                                    </g>
                                  </g>
                                );
                              })()}

                              {/* 3. Scale Gizmo (S / Scale) */}
                              {transformTool === 'scale' && (() => {
                                const halfW = sx / 2;
                                const halfD = sz / 2;
                                return (
                                  <g className="gizmo-scale" transform={`rotate(${rotDeg} ${cx} ${cz})`}>
                                    {/* Dashed bounding rectangle */}
                                    <rect
                                      x={cx - halfW}
                                      y={cz - halfD}
                                      width={sx}
                                      height={sz}
                                      fill="none"
                                      stroke="#f59e0b"
                                      strokeWidth={0.02}
                                      strokeDasharray="0.04, 0.03"
                                      opacity={0.9}
                                    />

                                    {/* 4 Corner handles (NW, NE, SE, SW) */}
                                    {[
                                      { corner: 'nw' as const, x: cx - halfW, y: cz - halfD, cursor: 'nwse-resize' },
                                      { corner: 'ne' as const, x: cx + halfW, y: cz - halfD, cursor: 'nesw-resize' },
                                      { corner: 'se' as const, x: cx + halfW, y: cz + halfD, cursor: 'nwse-resize' },
                                      { corner: 'sw' as const, x: cx - halfW, y: cz + halfD, cursor: 'nesw-resize' },
                                    ].map(c => (
                                      <rect
                                        key={c.corner}
                                        x={c.x - 0.04}
                                        y={c.y - 0.04}
                                        width={0.08}
                                        height={0.08}
                                        rx={0.015}
                                        fill="#fbbf24"
                                        stroke="#78350f"
                                        strokeWidth={0.015}
                                        style={{ cursor: c.cursor }}
                                        onPointerDown={e => {
                                          e.stopPropagation();
                                          e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                                          const pt = e.currentTarget.ownerSVGElement?.createSVGPoint();
                                          if (!pt) return;
                                          pt.x = e.clientX;
                                          pt.y = e.clientY;
                                          const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
                                          if (!matrix) return;
                                          const pos = pt.matrixTransform(matrix.inverse());
                                          setCanvasDrag({
                                            type: 'scale-corner',
                                            corner: c.corner,
                                            startSize: [...part.size],
                                            startPointer: [pos.x, pos.y],
                                            startPoints: part.points ? structuredClone(part.points) : undefined,
                                          });
                                        }}
                                      />
                                    ))}

                                    {/* 4 Edge handles (top, bottom, left, right) */}
                                    {[
                                      { edge: 'top' as const, x: cx, y: cz - halfD, w: 0.08, h: 0.04, cursor: 'ns-resize' },
                                      { edge: 'bottom' as const, x: cx, y: cz + halfD, w: 0.08, h: 0.04, cursor: 'ns-resize' },
                                      { edge: 'left' as const, x: cx - halfW, y: cz, w: 0.04, h: 0.08, cursor: 'ew-resize' },
                                      { edge: 'right' as const, x: cx + halfW, y: cz, w: 0.04, h: 0.08, cursor: 'ew-resize' },
                                    ].map(eInfo => (
                                      <rect
                                        key={eInfo.edge}
                                        x={eInfo.x - eInfo.w / 2}
                                        y={eInfo.y - eInfo.h / 2}
                                        width={eInfo.w}
                                        height={eInfo.h}
                                        rx={0.015}
                                        fill="#38bdf8"
                                        stroke="#0369a1"
                                        strokeWidth={0.015}
                                        style={{ cursor: eInfo.cursor }}
                                        onPointerDown={e => {
                                          e.stopPropagation();
                                          e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                                          const pt = e.currentTarget.ownerSVGElement?.createSVGPoint();
                                          if (!pt) return;
                                          pt.x = e.clientX;
                                          pt.y = e.clientY;
                                          const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
                                          if (!matrix) return;
                                          const pos = pt.matrixTransform(matrix.inverse());
                                          setCanvasDrag({
                                            type: 'scale-edge',
                                            edge: eInfo.edge,
                                            startSize: [...part.size],
                                            startPointer: [pos.x, pos.y],
                                            startPoints: part.points ? structuredClone(part.points) : undefined,
                                          });
                                        }}
                                      />
                                    ))}

                                    {/* Live dimension badge */}
                                    <g transform={`translate(${cx}, ${cz + halfD + 0.08})`}>
                                      <rect x="-0.22" y="-0.05" width="0.44" height="0.10" rx="0.025" fill="#0f172a" stroke="#f59e0b" strokeWidth="0.01" />
                                      <text x="0" y="0.01" fill="#fbbf24" fontSize="0.05" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                                        {sx.toFixed(2)}m × {sz.toFixed(2)}m
                                      </text>
                                    </g>
                                  </g>
                                );
                              })()}
                            </g>
                          );
                        })()}

                        {/* Figma-style Pen Tool In-Progress Path Rendering */}
                        {drawMode === 'pen' && (
                          <g className="pen-drawing-overlay">
                            {/* Filled polygon preview if >= 3 points */}
                            {penPoints.length >= 3 && (
                              <polygon
                                points={penPoints.map(([x, y]) => `${x},${y}`).join(' ')}
                                fill="rgba(45, 212, 191, 0.2)"
                                stroke="none"
                              />
                            )}

                            {/* Solid path between placed points */}
                            {penPoints.length > 1 && (
                              <polyline
                                points={penPoints.map(([x, y]) => `${x},${y}`).join(' ')}
                                fill="none"
                                stroke="#5eead4"
                                strokeWidth="0.025"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}

                            {/* Rubberband line to cursor */}
                            {penPoints.length > 0 && penCursor && (
                              <line
                                x1={penPoints[penPoints.length - 1][0]}
                                y1={penPoints[penPoints.length - 1][1]}
                                x2={penCursor[0]}
                                y2={penCursor[1]}
                                stroke="#2dd4bf"
                                strokeWidth="0.02"
                                strokeDasharray="0.04, 0.04"
                              />
                            )}

                            {/* Placed vertex points */}
                            {penPoints.map(([x, y], idx) => (
                              <rect
                                key={idx}
                                x={x - 0.035}
                                y={y - 0.035}
                                width={0.07}
                                height={0.07}
                                fill={idx === 0 ? '#10b981' : '#ffffff'}
                                stroke="#0f766e"
                                strokeWidth={0.015}
                                rx={idx === 0 ? 0.035 : 0.01}
                              />
                            ))}

                            {/* Target close ring around point 0 */}
                            {penPoints.length >= 3 && penCursor && (
                              <circle
                                cx={penPoints[0][0]}
                                cy={penPoints[0][1]}
                                r={0.08}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth={0.02}
                                strokeDasharray="0.03, 0.03"
                              />
                            )}
                          </g>
                        )}
                      </svg>

                      {/* On-Canvas Blender HUD Info Overlay */}
                      {part && (
                        <div className="canvas-blender-hud" aria-label="Part Status HUD">
                          <div className="hud-badge active-part">
                            Part {partIndex + 1}/{draft.parts.length} ({part.shape})
                          </div>
                          <div className="hud-badge coord">
                            X: {part.position[0].toFixed(2)}m · Z: {part.position[2].toFixed(2)}m
                          </div>
                          <div className="hud-badge rot">
                            Rot: {(part.rotation?.[1] ?? 0).toFixed(0)}°
                          </div>
                          <div className="hud-badge size">
                            {part.size[0].toFixed(2)} × {part.size[1].toFixed(2)} × {part.size[2].toFixed(2)}m
                          </div>
                        </div>
                      )}
                    </div>
                    </>
                    )}
                  </div>
                </div>

                {/* Inspector & Comprehensive Drawing Tools */}
                <div className="asset-list-properties">
                  {/* Tool Panel 1: Fast Shape Adder */}
                  <div className="asset-tool-section">
                    <span className="asset-section-tag">＋ Shape အသစ် တိုက်ရိုက်ထည့်ရန်</span>
                    <div className="asset-shape-picker-grid">
                      {SHAPE_DEFS.map(s => (
                        <button
                          key={s.id}
                          className="asset-shape-btn"
                          onClick={() => {
                            if (s.id === 'polygon') {
                              setDrawMode('pen');
                              setPenPoints([]);
                              setMessage('✒️ Pen Tool ကို ဖွင့်ထားပါသည်။ ဘယ်ဘက် Top View ပေါ်တွင် ကလစ်နှိပ်၍ အမှတ်ချဆွဲပါ။');
                            } else {
                              addShape(s.id);
                            }
                          }}
                          title={`${s.nameMm} ထည့်ရန်`}
                          disabled={draft.parts.length >= 40}
                        >
                          <span className="shape-icon">{s.icon}</span>
                          <span className="shape-title">{s.nameMm.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tool Panel 2: Myanmar Component Library Presets */}
                  <div className="asset-tool-section">
                    <span className="asset-section-tag">မြန်မာမှု အစိတ်အပိုင်း အမြန်ထည့်ရန်</span>
                    <div className="asset-subtabs">
                      <button
                        className={presetKey === 'character' ? 'active' : ''}
                        onClick={() => setPresetKey('character')}
                      >
                        🧍 လူ
                      </button>
                      <button
                        className={presetKey === 'building' ? 'active' : ''}
                        onClick={() => setPresetKey('building')}
                      >
                        🏠 အဆောက်အအုံ
                      </button>
                      <button
                        className={presetKey === 'tree' ? 'active' : ''}
                        onClick={() => setPresetKey('tree')}
                      >
                        🌳 သစ်ပင်
                      </button>
                    </div>

                    <div className="asset-preset-buttons-wrap">
                      {presetKey === 'character' && (
                        <>
                          <button onClick={() => addCompoundPreset('headHair')}>
                            👤 ခေါင်းနှင့် ဆံထုံး
                          </button>
                          <button onClick={() => addCompoundPreset('torsoLongyi')}>
                            🥋 ကိုယ်ထည် + လုံချည်
                          </button>
                          <button onClick={() => addCompoundPreset('armsPair')}>
                            💪 လက်မောင်းစုံ
                          </button>
                          <button onClick={() => addCompoundPreset('legsPair')}>
                            🦵 ခြေထောက်စုံ
                          </button>
                        </>
                      )}
                      {presetKey === 'building' && (
                        <>
                          <button onClick={() => addCompoundPreset('postBase')}>
                            🪵 အိမ်တိုင် ၄ လုံး
                          </button>
                          <button onClick={() => addCompoundPreset('tieredRoof')}>
                            ⛩️ ၂ ထပ် ခေါင်မိုး
                          </button>
                          <button onClick={() => addCompoundPreset('pagodaSpire')}>
                            🕌 စေတီ အထွတ်
                          </button>
                          <button onClick={() => addCompoundPreset('dananiVerandah')}>
                            🏡 ဓနိ ကွပ်ပျစ်
                          </button>
                        </>
                      )}
                      {presetKey === 'tree' && (
                        <>
                          <button onClick={() => addCompoundPreset('trunk')}>
                            🪵 သစ်ပင်ပင်စည်
                          </button>
                          <button onClick={() => addCompoundPreset('canopy')}>
                            🌳 သစ်ရွက်အုံ (စိမ်းလန်း)
                          </button>
                          <button onClick={() => addCompoundPreset('pineTier')}>
                            🌲 ထင်းရှူးထပ်
                          </button>
                          <button onClick={() => addCompoundPreset('fronds')}>
                            🌴 ထန်းရွက်/အုန်းရွက်
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tool Panel 3: Active Part Properties & Modeling Power Tools */}
                  <div className="asset-prop-group">
                    <div className="asset-part-header-row">
                      <h3>
                        အစိတ်အပိုင်း #{partIndex + 1} / {draft.parts.length}
                      </h3>
                      <div className="asset-part-reorder-btns">
                        <button
                          type="button"
                          className="reorder-btn"
                          disabled={partIndex <= 0}
                          onClick={() => reorderPart(-1)}
                          title="Move part down in hierarchy"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="reorder-btn"
                          disabled={partIndex >= draft.parts.length - 1}
                          onClick={() => reorderPart(1)}
                          title="Move part up in hierarchy"
                        >
                          ▼
                        </button>
                      </div>
                    </div>

                    {/* Part Select Pills */}
                    <div className="asset-part-select-row">
                      {draft.parts.map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`part-pill ${i === partIndex ? 'active' : ''}`}
                          onClick={() => setPartIndex(i)}
                          title={`${p.shape} #${i + 1}`}
                        >
                          <span className="part-pill-dot" style={{ background: p.color }} />
                          {i + 1}. {p.shape}
                        </button>
                      ))}
                    </div>

                    {part && (
                      <div className="asset-part-fields">
                        <label>
                          <span>ပုံသဏ္ဌာန် (3D Geometry Shape)</span>
                          <select
                            value={part.shape}
                            onChange={e =>
                              updatePart({ ...part, shape: e.target.value as ShapeKind })
                            }
                          >
                            {SHAPE_DEFS.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.icon} {s.nameMm}
                              </option>
                            ))}
                          </select>
                        </label>

                        {/* Convert to Polygon Button if not polygon */}
                        {part.shape !== 'polygon' && (
                          <button
                            type="button"
                            className="convert-polygon-btn"
                            onClick={convertCurrentPartToPolygon}
                            title="Convert current 3D shape into an editable polygon with free vertices and edges"
                          >
                            📐 အနားနှင့် ထောင့်များ စိတ်ကြိုက်ပြင်ဆင်ရန် Polygon အဖြစ်ပြောင်းမည်
                          </button>
                        )}

                        {/* Vertices & Edges Manager when polygon */}
                        {part.shape === 'polygon' && (
                          <div className="asset-vertex-panel">
                            <div className="asset-vertex-panel-header">
                              <span className="vertex-panel-title">
                                📐 ထောင့်နှင့် အနားများ စီမံခန့်ခွဲမှု ({part.points?.length ?? 0} ထောင့်)
                              </span>
                              <button
                                type="button"
                                className={`plan-mode-btn ${drawMode === 'edit-points' ? 'active' : ''}`}
                                onClick={() => {
                                  if (drawMode === 'edit-points') {
                                    setDrawMode('select');
                                  } else {
                                    setDrawMode('edit-points');
                                    setSelectedVertexIdx(0);
                                  }
                                }}
                              >
                                {drawMode === 'edit-points' ? '✓ ပြီးပြီ' : '✏️ Canvas ပေါ်ပြင်မည်'}
                              </button>
                            </div>

                            {/* Polygon Quick Presets */}
                            <div className="asset-vertex-preset-wrap">
                              <span className="preset-label">ပုံသဏ္ဌာန် အမြန်သတ်မှတ်ရန်:</span>
                              <div className="asset-vertex-preset-grid">
                                <button type="button" onClick={() => applyPolygonPreset('box')}>
                                  စတုဂံ
                                </button>
                                <button type="button" onClick={() => applyPolygonPreset('triangle')}>
                                  တြိဂံ
                                </button>
                                <button type="button" onClick={() => applyPolygonPreset('hexagon')}>
                                  ၆ မြှောင့်
                                </button>
                                <button type="button" onClick={() => applyPolygonPreset('star')}>
                                  ကြယ်ပွင့်
                                </button>
                                <button type="button" onClick={() => applyPolygonPreset('cross')}>
                                  ကြက်ခြေခတ်
                                </button>
                              </div>
                            </div>

                            {/* Quick Add/Delete vertex buttons */}
                            <div className="asset-vertex-quick-btns">
                              <button
                                type="button"
                                className="vertex-quick-add"
                                onClick={addVertexAtMidpoint}
                                disabled={(part.points?.length ?? 0) >= 60}
                              >
                                ＋ ထောင့်အသစ်ထည့်မည်
                              </button>
                              <button
                                type="button"
                                className="vertex-quick-del"
                                onClick={() => deleteVertex()}
                                disabled={!part.points || part.points.length <= 3}
                              >
                                ⌫ ရွေးထားသောထောင့်ဖျက်မည်
                              </button>
                            </div>

                            {/* Individual Corner Coordinates Table */}
                            <div className="asset-vertex-list">
                              {part.points?.map(([vx, vz], vIdx) => {
                                const isCur = vIdx === selectedVertexIdx;
                                return (
                                  <div
                                    key={vIdx}
                                    className={`asset-vertex-row ${isCur ? 'active' : ''}`}
                                    onClick={() => setSelectedVertexIdx(vIdx)}
                                  >
                                    <span className="vertex-idx-tag">#{vIdx + 1} ထောင့်:</span>
                                    <div className="vertex-inputs-row">
                                      <div className="vertex-input-unit">
                                        <span className="axis-tag axis-x">X</span>
                                        <input
                                          type="number"
                                          step="0.05"
                                          value={Number(vx.toFixed(3))}
                                          onChange={e =>
                                            updateSingleVertex(vIdx, Number(e.target.value) || 0, vz)
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="vertex-nudge-btn"
                                          onClick={e => {
                                            e.stopPropagation();
                                            nudgeVertex(vIdx, 'x', -0.05);
                                          }}
                                        >
                                          -
                                        </button>
                                        <button
                                          type="button"
                                          className="vertex-nudge-btn"
                                          onClick={e => {
                                            e.stopPropagation();
                                            nudgeVertex(vIdx, 'x', 0.05);
                                          }}
                                        >
                                          +
                                        </button>
                                      </div>
                                      <div className="vertex-input-unit">
                                        <span className="axis-tag axis-z">Z</span>
                                        <input
                                          type="number"
                                          step="0.05"
                                          value={Number(vz.toFixed(3))}
                                          onChange={e =>
                                            updateSingleVertex(vIdx, vx, Number(e.target.value) || 0)
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="vertex-nudge-btn"
                                          onClick={e => {
                                            e.stopPropagation();
                                            nudgeVertex(vIdx, 'z', -0.05);
                                          }}
                                        >
                                          -
                                        </button>
                                        <button
                                          type="button"
                                          className="vertex-nudge-btn"
                                          onClick={e => {
                                            e.stopPropagation();
                                            nudgeVertex(vIdx, 'z', 0.05);
                                          }}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                    {part.points && part.points.length > 3 && (
                                      <button
                                        type="button"
                                        className="vertex-row-del-btn"
                                        title="Delete this corner"
                                        onClick={e => {
                                          e.stopPropagation();
                                          deleteVertex(vIdx);
                                        }}
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Power Tools: Mirror, Snap Ground, Center, Stack */}
                        <div className="asset-power-tools">
                          <button
                            type="button"
                            className="power-tool-btn"
                            onClick={mirrorPartX}
                            title="Mirror part symmetrically across X axis"
                          >
                            🪞 ဝဲ/ယာ အချိုးညီပွား (Mirror X)
                          </button>
                          <button
                            type="button"
                            className="power-tool-btn"
                            onClick={snapToGround}
                            title="Snap part directly to ground level"
                          >
                            ⬇️ မြေပြင်သို့ကပ် (Ground)
                          </button>
                          <button
                            type="button"
                            className="power-tool-btn"
                            onClick={() => centerPart('x')}
                            title="Center along X"
                          >
                            🎯 အလယ်တည့်ရန် (X)
                          </button>
                          {partIndex > 0 && (
                            <button
                              type="button"
                              className="power-tool-btn"
                              onClick={stackOnPrevious}
                              title="Stack directly on top of previous part"
                            >
                              🥞 အပေါ်တင်ရန်
                            </button>
                          )}
                        </div>

                        {/* Color Picker with Themed Myanmar Palettes */}
                        <div className="asset-color-picker-wrap">
                          <div className="asset-color-row">
                            <span>အရောင်</span>
                            <input
                              type="color"
                              value={part.color}
                              onChange={e => updatePart({ ...part, color: e.target.value })}
                              className="asset-color-input"
                            />
                            <span className="asset-color-hex">{part.color}</span>
                          </div>

                          {/* Palette Tabs */}
                          <div className="asset-palette-tabs">
                            <button
                              type="button"
                              className={paletteKey === 'character' ? 'active' : ''}
                              onClick={() => setPaletteKey('character')}
                            >
                              🧍 လူနှင့်အဝတ်
                            </button>
                            <button
                              type="button"
                              className={paletteKey === 'building' ? 'active' : ''}
                              onClick={() => setPaletteKey('building')}
                            >
                              🏠 အိမ်/သစ်/အုတ်
                            </button>
                            <button
                              type="button"
                              className={paletteKey === 'nature' ? 'active' : ''}
                              onClick={() => setPaletteKey('nature')}
                            >
                              🌳 သစ်ပင်သဘာဝ
                            </button>
                            <button
                              type="button"
                              className={paletteKey === 'accents' ? 'active' : ''}
                              onClick={() => setPaletteKey('accents')}
                            >
                              ✨ ရွှေရောင်
                            </button>
                          </div>

                          {/* Themed Swatches */}
                          <div className="asset-swatches-grid">
                            {COLOR_PALETTES[paletteKey].colors.map(c => (
                              <button
                                key={c.hex}
                                type="button"
                                className={`asset-swatch-chip ${part.color.toLowerCase() === c.hex.toLowerCase() ? 'active' : ''}`}
                                style={{ background: c.hex }}
                                title={`${c.name} (${c.hex})`}
                                onClick={() => updatePart({ ...part, color: c.hex })}
                              >
                                <span className="swatch-label">{c.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Transform Inputs with Precision Nudge (+/-) */}
                        {vectorInput(
                          'တည်နေရာ (Position: X, Y, Z)',
                          'position',
                          part.position,
                          -2,
                          2,
                          0.05,
                          position => {
                            if (part.shape === 'polygon' && part.points) {
                              const dx = position[0] - part.position[0];
                              const dz = position[2] - part.position[2];
                              const nextPts = part.points.map(([px, py]) => [
                                Number((px + dx).toFixed(3)),
                                Number((py + dz).toFixed(3)),
                              ] as [number, number]);
                              updatePart({ ...part, position, points: nextPts });
                            } else {
                              updatePart({ ...part, position });
                            }
                          }
                        )}
                        {vectorInput(
                          'အစိတ်အပိုင်း အရွယ်အစား (Size: W, H, D)',
                          'size',
                          part.size,
                          0.02,
                          3,
                          0.05,
                          size => {
                            if (part.shape === 'polygon' && part.points && part.size[0] > 0 && part.size[2] > 0) {
                              const scaleX = size[0] / part.size[0];
                              const scaleZ = size[2] / part.size[2];
                              const cx = part.position[0];
                              const cz = part.position[2];
                              const nextPts = part.points.map(([px, py]) => [
                                Number((cx + (px - cx) * scaleX).toFixed(3)),
                                Number((cz + (py - cz) * scaleZ).toFixed(3)),
                              ] as [number, number]);
                              updatePart({ ...part, size, points: nextPts });
                            } else {
                              updatePart({ ...part, size });
                            }
                          }
                        )}
                        {vectorInput(
                          'လှည့်ထောင့် (Rotation Degrees: X, Y, Z)',
                          'rotation',
                          part.rotation ?? [0, 0, 0],
                          -180,
                          180,
                          15,
                          rotation => updatePart({ ...part, rotation })
                        )}

                        {/* Part Duplicate & Delete Actions */}
                        <div className="asset-part-actions">
                          <button
                            type="button"
                            className="primary"
                            onClick={duplicatePart}
                            title="Duplicate Part (Shift+D)"
                          >
                            📋 အစိတ်အပိုင်း ပွားမည် (Shift+D)
                          </button>
                          <button
                            type="button"
                            className="danger"
                            disabled={draft.parts.length <= 1}
                            onClick={removePart}
                            title="Delete Part (X / Delete)"
                          >
                            ✕ ဖျက်မည် (X)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tool Panel 4: Asset Metadata & Dimension Scales */}
                  <div className="asset-prop-group">
                    <h3>Asset အချက်အလက်နှင့် အတိုင်းအတာ</h3>
                    <label>
                      <span>အမည် (English)</span>
                      <input
                        value={draft.name}
                        onChange={e => change({ ...draft, name: e.target.value })}
                        placeholder="ဥပမာ - Village Teashop"
                      />
                    </label>
                    <label>
                      <span>မြန်မာအမည်</span>
                      <input
                        value={draft.nameMm}
                        onChange={e => change({ ...draft, nameMm: e.target.value })}
                        placeholder="ဥပမာ - ရွာလဘက်ရည်ဆိုင်"
                      />
                    </label>
                    <label>
                      <span>အမျိုးအစား</span>
                      <select
                        value={draft.category}
                        onChange={e =>
                          change({ ...draft, category: e.target.value as CustomAsset['category'] })
                        }
                      >
                        {ASSET_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.labelMm} ({c.label})
                          </option>
                        ))}
                      </select>
                    </label>
                    {vectorInput(
                      'အရွယ်အစား (မီတာ · အကျယ် / အမြင့် / အလျား)',
                      'position',
                      draft.dimensions ?? [2, 2, 2],
                      0.1,
                      100,
                      0.5,
                      dimensions => change({ ...draft, dimensions })
                    )}
                  </div>

                  {/* Tool Panel 5: AI Prompt Generation */}
                  <details className="asset-list-ai">
                    <summary>✦ AI ဖြင့် ပုံစံအသစ် ထပ်ထုတ်ရန် (Gemini 3D)</summary>
                    <div className="asset-ai-content">
                      <label>
                        <span>Gemini Model</span>
                        <input
                          value={model}
                          onChange={e => setModel(e.target.value)}
                          placeholder="gemini-3.8-flash"
                        />
                      </label>
                      <label>
                        <span>API Key (မထည့်လည်း Server Key သုံးနိုင်သည်)</span>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={e => setApiKey(e.target.value)}
                          placeholder="AIzaSy..."
                        />
                      </label>
                      <label>
                        <span>လိုချင်သော 3D Asset အကြောင်း</span>
                        <textarea
                          rows={3}
                          value={prompt}
                          onChange={e => setPrompt(e.target.value)}
                          placeholder="ဥပမာ - အနီရောင်ခေါင်မိုးနဲ့ သစ်သားအိမ်လေး"
                        />
                      </label>
                      <button
                        className="asset-ai-generate-btn"
                        disabled={busy || !prompt.trim()}
                        onClick={ai}
                      >
                        {busy ? '⏳ ဖန်တီးနေသည်…' : '✦ AI ဖြင့် 3D ပြန်ဆွဲရန်'}
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            </>
          ) : selected && def && !def.customModel ? (
            <BuiltInAssetEditor
              def={def}
              onBack={() => setMobileView('list')}
              onSave={() => refresh()}
            />
          ) : (
            <div className="asset-list-empty asset-empty-detail">
              <div className="asset-empty-icon">🏛️</div>
              <h2>3D Asset ရွေးချယ်ပါ</h2>
              <p>ဘယ်ဘက်စာရင်းမှ Asset တစ်ခုကို ရွေးပါ သို့မဟုတ် ပုံစံအသစ် စတင်ပါ</p>
              <div className="asset-empty-actions asset-empty-templates">
                <button className="primary" onClick={() => startTemplate('building')}>
                  🏠 အိမ်ပုံစံစတင်ရန်
                </button>
                <button onClick={() => startTemplate('tree')}>
                  🌳 သစ်ပင်စတင်ရန်
                </button>
                <button onClick={() => startTemplate('character')}>
                  🧍 လူပုံစံစတင်ရန်
                </button>
                <button onClick={() => startTemplate('blank')}>
                  ✨ အလွတ်မှစဆွဲမည်
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Floating Toast Notification */}
      {message && (
        <div className="asset-toast-message" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage('')}>✕</button>
        </div>
      )}

      {/* AI Asset Modal */}
      {addAI && (
        <AssetAiAdd
          onClose={() => setAddAI(false)}
          onSaved={id => {
            const loaded = loadCustomAssets().find(c => c.id === id);
            if (loaded) edit(loaded, false);
            refresh();
          }}
        />
      )}
    </main>
  );
}
