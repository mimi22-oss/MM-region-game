export const SUPPORTED_SHAPES = [
  'box',
  'cylinder',
  'sphere',
  'cone',
  'pyramid',
  'capsule',
  'torus',
  'dome',
  'wedge',
  'polygon',
] as const;
export type ShapeKind = typeof SUPPORTED_SHAPES[number];
export type CustomPart = { shape: ShapeKind; position: [number, number, number]; size: [number, number, number]; color: string; rotation?: [number, number, number]; points?: [number, number][] };
export type CustomAsset = { id: string; name: string; nameMm: string; category: 'buildings' | 'nature' | 'infrastructure' | 'furniture' | 'vehicles' | 'cultural'; dimensions: [number, number, number]; parts: CustomPart[] };
const KEY = 'myanmar-town-custom-assets-v1';
const categories = ['buildings', 'nature', 'infrastructure', 'furniture', 'vehicles', 'cultural'];
const vector = (v: unknown, min: number, max: number): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);
const colors: Record<string, string> = { red:'#ff0000', orange:'#ffa500', yellow:'#ffff00', green:'#008000', blue:'#0000ff', purple:'#800080', pink:'#ffc0cb', brown:'#a52a2a', white:'#ffffff', black:'#000000', gray:'#808080', grey:'#808080', beige:'#f5f5dc', tan:'#d2b48c', gold:'#ffd700' };
const shapeAliases: Record<string, ShapeKind> = {
  cube: 'box',
  cuboid: 'box',
  ball: 'sphere',
  pill: 'capsule',
  ring: 'torus',
  donut: 'torus',
  wheel: 'torus',
  hemisphere: 'dome',
  half_sphere: 'dome',
  roof: 'wedge',
  prism: 'wedge',
  triangular: 'wedge',
  tube: 'cylinder',
  pole: 'cylinder',
  path: 'polygon',
  freeform: 'polygon',
  extrude: 'polygon',
};
function normalizeColor(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const color = value.trim().toLowerCase();
  if (colors[color]) return colors[color];
  if (/^#?[0-9a-f]{3}$/.test(color)) { const c = color.replace('#', ''); return `#${[...c].map(x => x + x).join('')}`; }
  if (/^#?[0-9a-f]{6}$/.test(color)) return `#${color.replace('#', '')}`;
  return value;
}
function normalizeGeneratedParts(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map(part => {
    if (!part || typeof part !== 'object' || Array.isArray(part)) return part;
    const p = part as Record<string, unknown>;
    const rawShape = typeof p.shape === 'string' ? p.shape.trim().toLowerCase() : '';
    const shape = shapeAliases[rawShape] ?? (SUPPORTED_SHAPES.includes(rawShape as ShapeKind) ? (rawShape as ShapeKind) : 'box');
    const pos = Array.isArray(p.position) && p.position.length === 3
      ? p.position.map(n => typeof n === 'number' && Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : n)
      : p.position;
    const sz = Array.isArray(p.size) && p.size.length === 3
      ? p.size.map(n => typeof n === 'number' && Number.isFinite(n) ? Math.max(0.01, Math.min(2, n)) : n)
      : p.size;
    const pts = Array.isArray(p.points)
      ? p.points.filter(pt => Array.isArray(pt) && pt.length === 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number').map(pt => [Math.max(-1, Math.min(1, pt[0])), Math.max(-1, Math.min(1, pt[1]))] as [number, number])
      : undefined;
    return { ...p, shape, position: pos, size: sz, color: normalizeColor(p.color), ...(pts && pts.length >= 3 ? { points: pts } : {}) };
  });
}
const vectorSchema = (description: string, minimum: number, maximum: number) => ({ type: 'array', items: { type: 'number', minimum, maximum }, minItems: 3, maxItems: 3, description });
const assetSchema = {
  type: 'object', properties: {
    name: { type: 'string' }, nameMm: { type: 'string' }, category: { type: 'string', enum: categories },
    dimensions: vectorSchema('Width, height, depth in metres, each from 0.1 to 100.', 0.1, 100),
    parts: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'object', properties: {
      shape: { type: 'string', enum: ['box', 'cylinder', 'sphere', 'cone', 'pyramid', 'capsule', 'torus', 'dome', 'wedge', 'polygon'] },
      position: vectorSchema('Normalized x, y, z, each from -1 to 1.', -1, 1),
      size: vectorSchema('Normalized x, y, z sizes, each from 0.01 to 2.', 0.01, 2),
      color: { type: 'string', description: 'Six-digit hexadecimal color, e.g. #ff8800.' },
    }, required: ['shape', 'position', 'size', 'color'] } },
  }, required: ['name', 'nameMm', 'category', 'dimensions', 'parts'],
};
export function validateCustomAsset(value: unknown): CustomAsset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid asset data.');
  const a = value as CustomAsset;
  if (typeof a.id !== 'string' || !/^custom:[a-zA-Z0-9-]{1,80}$/.test(a.id) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 80 || typeof a.nameMm !== 'string' || a.nameMm.length > 100 || !categories.includes(a.category) || !vector(a.dimensions, 0.1, 100) || !Array.isArray(a.parts) || a.parts.length < 1 || a.parts.length > 40) throw new Error('Invalid asset details or too many parts.');
  for (const [index, p] of a.parts.entries()) {
    const prefix = `3D part ${index + 1}`;
    if (!p || !SUPPORTED_SHAPES.includes(p.shape as ShapeKind)) throw new Error(`${prefix}: unsupported shape.`);
    if (!vector(p.position, -1, 1)) throw new Error(`${prefix}: position must contain 3 numbers from -1 to 1.`);
    if (!vector(p.size, 0.01, 2)) throw new Error(`${prefix}: size must contain 3 numbers from 0.01 to 2.`);
    if (p.rotation !== undefined && !vector(p.rotation, -180, 180)) throw new Error(`${prefix}: rotation must contain 3 angles from -180 to 180.`);
    if (typeof p.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(p.color)) throw new Error(`${prefix}: color must be a six-digit hex color.`);
    if (p.points !== undefined) {
      if (!Array.isArray(p.points) || p.points.length < 3 || p.points.length > 60) throw new Error(`${prefix}: polygon points must contain 3 to 60 coordinates.`);
      for (const pt of p.points) {
        if (!Array.isArray(pt) || pt.length !== 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number' || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1]) || pt[0] < -1 || pt[0] > 1 || pt[1] < -1 || pt[1] > 1) {
          throw new Error(`${prefix}: polygon coordinate must contain 2 numbers from -1 to 1.`);
        }
      }
    }
  }
  return { id: a.id, name: a.name.trim(), nameMm: a.nameMm.trim(), category: a.category, dimensions: [...a.dimensions], parts: a.parts.map(p => ({ shape: p.shape, position: [...p.position], size: [...p.size], color: p.color, ...(p.rotation ? { rotation: [...p.rotation] } : {}), ...(p.points ? { points: p.points.map(pt => [pt[0], pt[1]] as [number, number]) } : {}) })) };
}

export function convertPartToPolygon(part: CustomPart): CustomPart {
  if (part.shape === 'polygon' && part.points && part.points.length >= 3) {
    return part;
  }
  const cx = part.position[0];
  const cz = part.position[2];
  const sx = Math.max(0.04, part.size[0]);
  const sz = Math.max(0.04, part.size[2]);
  const hx = sx / 2;
  const hz = sz / 2;

  let points: [number, number][];

  if (part.shape === 'wedge') {
    points = [
      [Number(Math.max(-1, Math.min(1, cx - hx)).toFixed(3)), Number(Math.max(-1, Math.min(1, cz + hz)).toFixed(3))],
      [Number(Math.max(-1, Math.min(1, cx + hx)).toFixed(3)), Number(Math.max(-1, Math.min(1, cz + hz)).toFixed(3))],
      [Number(Math.max(-1, Math.min(1, cx)).toFixed(3)), Number(Math.max(-1, Math.min(1, cz - hz)).toFixed(3))],
    ];
  } else if (
    part.shape === 'cylinder' ||
    part.shape === 'cone' ||
    part.shape === 'sphere' ||
    part.shape === 'dome' ||
    part.shape === 'capsule' ||
    part.shape === 'torus'
  ) {
    const count = 8;
    points = [];
    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count;
      const px = Number(Math.max(-1, Math.min(1, cx + hx * Math.cos(angle))).toFixed(3));
      const pz = Number(Math.max(-1, Math.min(1, cz + hz * Math.sin(angle))).toFixed(3));
      points.push([px, pz]);
    }
  } else {
    // Box, pyramid, or default rectangle
    points = [
      [Number(Math.max(-1, Math.min(1, cx - hx)).toFixed(3)), Number(Math.max(-1, Math.min(1, cz - hz)).toFixed(3))],
      [Number(Math.max(-1, Math.min(1, cx + hx)).toFixed(3)), Number(Math.max(-1, Math.min(1, cz - hz)).toFixed(3))],
      [Number(Math.max(-1, Math.min(1, cx + hx)).toFixed(3)), Number(Math.max(-1, Math.min(1, cz + hz)).toFixed(3))],
      [Number(Math.max(-1, Math.min(1, cx - hx)).toFixed(3)), Number(Math.max(-1, Math.min(1, cz + hz)).toFixed(3))],
    ];
  }

  return {
    ...part,
    shape: 'polygon',
    points,
  };
}

export function createPolygonPreset(
  preset: 'box' | 'triangle' | 'hexagon' | 'star' | 'cross',
  cx = 0,
  cz = 0,
  sx = 0.5,
  sz = 0.5
): [number, number][] {
  const hx = sx / 2;
  const hz = sz / 2;
  const clamp = (n: number) => Number(Math.max(-1, Math.min(1, n)).toFixed(3));

  if (preset === 'triangle') {
    return [
      [clamp(cx - hx), clamp(cz + hz)],
      [clamp(cx + hx), clamp(cz + hz)],
      [clamp(cx), clamp(cz - hz)],
    ];
  }
  if (preset === 'hexagon') {
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * 2 * Math.PI) / 6 - Math.PI / 2;
      pts.push([clamp(cx + hx * Math.cos(a)), clamp(cz + hz * Math.sin(a))]);
    }
    return pts;
  }
  if (preset === 'star') {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 1 : 0.45;
      const a = (i * 2 * Math.PI) / 10 - Math.PI / 2;
      pts.push([clamp(cx + hx * r * Math.cos(a)), clamp(cz + hz * r * Math.sin(a))]);
    }
    return pts;
  }
  if (preset === 'cross') {
    const w1 = hx * 0.35, w2 = hx;
    const d1 = hz * 0.35, d2 = hz;
    return [
      [clamp(cx - w1), clamp(cz - d2)],
      [clamp(cx + w1), clamp(cz - d2)],
      [clamp(cx + w1), clamp(cz - d1)],
      [clamp(cx + w2), clamp(cz - d1)],
      [clamp(cx + w2), clamp(cz + d1)],
      [clamp(cx + w1), clamp(cz + d1)],
      [clamp(cx + w1), clamp(cz + d2)],
      [clamp(cx - w1), clamp(cz + d2)],
      [clamp(cx - w1), clamp(cz + d1)],
      [clamp(cx - w2), clamp(cz + d1)],
      [clamp(cx - w2), clamp(cz - d1)],
      [clamp(cx - w1), clamp(cz - d1)],
    ];
  }
  // Default rectangle
  return [
    [clamp(cx - hx), clamp(cz - hz)],
    [clamp(cx + hx), clamp(cz - hz)],
    [clamp(cx + hx), clamp(cz + hz)],
    [clamp(cx - hx), clamp(cz + hz)],
  ];
}
export function loadCustomAssets(): CustomAsset[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(data) || data.length > 200) return []; return data.flatMap(v => { try { return [validateCustomAsset(v)]; } catch { return []; } }); } catch { return []; }
}
export function saveCustomAsset(asset: CustomAsset): CustomAsset {
  const clean = validateCustomAsset(asset); const all = loadCustomAssets();
  if (all.some(a => a.id === clean.id)) throw new Error('Asset ID already exists.');
  if (all.length >= 200) throw new Error('Asset library limit reached.');
  localStorage.setItem(KEY, JSON.stringify([...all, clean]));
  return clean;
}
export function updateCustomAsset(asset: CustomAsset): CustomAsset {
  const clean = validateCustomAsset(asset); const all = loadCustomAssets();
  const index = all.findIndex(a => a.id === clean.id);
  if (index < 0) throw new Error('Asset not found.');
  all[index] = clean; localStorage.setItem(KEY, JSON.stringify(all)); return clean;
}
export function countAssetPlacements(id: string): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !(key.startsWith('mm-editor-region-v1:') || key === 'myanmar-town-world-layout-v1')) continue;
    try { const layout = JSON.parse(localStorage.getItem(key) || 'null'); if (Array.isArray(layout?.features)) count += layout.features.filter((f: { assetId?: string }) => f?.assetId === id).length; } catch { throw new Error(`Could not inspect saved map ${key}; deletion cancelled.`); }
  }
  return count;
}
export function deleteCustomAsset(id: string): void {
  if (countAssetPlacements(id)) throw new Error('ဤ asset ကို မြေပုံပေါ်တွင် အသုံးပြုထားသည်။ အရင်ဖယ်ရှားပြီးမှ ဖျက်နိုင်ပါသည်။');
  const all = loadCustomAssets(); if (!all.some(a => a.id === id)) throw new Error('Asset not found.');
  localStorage.setItem(KEY, JSON.stringify(all.filter(a => a.id !== id)));
}
export async function generateCustomAsset(opts: { key: string; model: string; prompt: string; signal?: AbortSignal; onRetry?: () => void }): Promise<CustomAsset> {
  const model = opts.model.trim().replace(/^models\//, '');
  if (!/^[a-zA-Z0-9._-]+$/.test(model) || !opts.key.trim() || !opts.prompt.trim()) throw new Error('Enter a valid model, API key and prompt.');
  const textPrompt = `Create a 3D model from simple geometric parts for this request: ${opts.prompt}\nReturn JSON with name, nameMm, category, dimensions [width,height,depth] and parts [{shape,position,size,color}]. Category must be one of ${categories.join(', ')}; shape must be box, cylinder, sphere or cone. Dimensions are in metres, 0.1 to 100. Part coordinates and sizes are relative to dimensions: x and z centred at 0, ground y=0. Position components must be -1 to 1; size components must be 0.01 to 2. All colors must be six-digit hexadecimal, for example #ff8800. Use at most 40 parts.`;
  let retriedUnavailable = false;
  const send = async (useSchema: boolean) => {
    const request = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', signal: opts.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.key.trim() }, body: JSON.stringify({ contents: [{ parts: [{ text: textPrompt }] }], generationConfig: { responseMimeType: 'application/json', ...(useSchema ? { responseJsonSchema: assetSchema } : {}) } }) });
    let result = await request();
    if (result.status === 503 && !retriedUnavailable) {
      const retryAfter = result.headers.get('retry-after');
      const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : retryAfter ? Math.max(0, (Date.parse(retryAfter) - Date.now()) / 1000) : 2;
      if (Number.isFinite(seconds) && seconds <= 10) {
        retriedUnavailable = true; opts.onRetry?.();
        await new Promise<void>((resolve, reject) => {
          if (opts.signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
          const cancel = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
          const timer = setTimeout(() => { opts.signal?.removeEventListener('abort', cancel); resolve(); }, Math.max(0, seconds) * 1000);
          opts.signal?.addEventListener('abort', cancel, { once: true });
        });
        result = await request();
      }
    }
    return result;
  };
  const errorDetails = async (response: Response) => {
    try {
      const body = await response.json(); const error = body?.error;
      const info = Array.isArray(error?.details) ? error.details.flatMap((item: { reason?: unknown; fieldViolations?: unknown }) => {
        const parts = typeof item.reason === 'string' ? [item.reason] : [];
        if (Array.isArray(item.fieldViolations)) for (const field of item.fieldViolations) if (typeof field?.field === 'string' && typeof field?.description === 'string') parts.push(`${field.field}: ${field.description}`);
        return parts;
      }) : [];
      return [typeof error?.message === 'string' ? error.message : '', ...info].filter(Boolean).join(' — ');
    } catch { return ''; }
  };
  let response = await send(true);
  let details = response.ok ? '' : await errorDetails(response);
  // Google sometimes reports schema errors as a generic INVALID_ARGUMENT without identifying the field.
  // Retry this narrow generic case as well as explicit schema errors, but not key or billing errors.
  const schemaError = /schema/i.test(details) && /invalid|unsupported|complex|too many|constraint|not supported|cannot|unable/i.test(details);
  const genericInvalid = /^request contains an invalid argument\.?$/i.test(details.trim());
  if (response.status === 400 && (schemaError || genericInvalid)) {
    response = await send(false);
    details = response.ok ? '' : await errorDetails(response);
  }
  if (!response.ok) {
    const safe = details.split(opts.key.trim()).join('[redacted]').replace(/AIza[\w-]+/g, '[redacted]').slice(0, 500);
    if (response.status === 503) throw new Error(`Gemini ဝန်ဆောင်မှုက အချိန်မီ မတုံ့ပြန်နိုင်ပါ (HTTP 503)။ ခဏစောင့်ပြီး ထပ်စမ်းပါ သို့မဟုတ် အခြားရရှိနိုင်သော model ကို ရွေးပါ။${safe ? ` ${safe}` : ''}`);
    throw new Error(`Gemini HTTP ${response.status}${safe ? `: ${safe}` : '. Check model, key and quota.'}`);
  }
  const data = await response.json(); const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
  let parsed: Record<string, unknown>; try { parsed = JSON.parse(text); } catch { throw new Error('Gemini returned invalid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Gemini returned invalid asset data.');
  return validateCustomAsset({ ...parsed, parts: normalizeGeneratedParts(parsed.parts), id: `custom:${crypto.randomUUID()}` });
}
