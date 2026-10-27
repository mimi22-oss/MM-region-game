export type CustomPart = { shape: 'box' | 'cylinder' | 'sphere' | 'cone'; position: [number, number, number]; size: [number, number, number]; color: string };
export type CustomAsset = { id: string; name: string; nameMm: string; category: 'buildings' | 'nature' | 'infrastructure' | 'furniture' | 'vehicles' | 'cultural'; dimensions: [number, number, number]; parts: CustomPart[] };
const KEY = 'myanmar-town-custom-assets-v1';
const categories = ['buildings', 'nature', 'infrastructure', 'furniture', 'vehicles', 'cultural'];
const vector = (v: unknown, min: number, max: number): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);
const colors: Record<string, string> = { red:'#ff0000', orange:'#ffa500', yellow:'#ffff00', green:'#008000', blue:'#0000ff', purple:'#800080', pink:'#ffc0cb', brown:'#a52a2a', white:'#ffffff', black:'#000000', gray:'#808080', grey:'#808080', beige:'#f5f5dc', tan:'#d2b48c', gold:'#ffd700' };
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
    const shape = typeof p.shape === 'string' ? p.shape.trim().toLowerCase() : p.shape;
    return { ...p, shape: shape === 'cube' ? 'box' : shape, color: normalizeColor(p.color) };
  });
}
const vectorSchema = (description: string, minimum: number, maximum: number) => ({ type: 'array', items: { type: 'number', minimum, maximum }, minItems: 3, maxItems: 3, description });
const assetSchema = {
  type: 'object', properties: {
    name: { type: 'string' }, nameMm: { type: 'string' }, category: { type: 'string', enum: categories },
    dimensions: vectorSchema('Width, height, depth in metres, each from 0.1 to 100.', 0.1, 100),
    parts: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'object', properties: {
      shape: { type: 'string', enum: ['box', 'cylinder', 'sphere', 'cone'] },
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
    if (!p || !['box', 'cylinder', 'sphere', 'cone'].includes(p.shape)) throw new Error(`${prefix}: unsupported shape.`);
    if (!vector(p.position, -1, 1)) throw new Error(`${prefix}: position must contain 3 numbers from -1 to 1.`);
    if (!vector(p.size, 0.01, 2)) throw new Error(`${prefix}: size must contain 3 numbers from 0.01 to 2.`);
    if (typeof p.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(p.color)) throw new Error(`${prefix}: color must be a six-digit hex color.`);
  }
  return { id: a.id, name: a.name.trim(), nameMm: a.nameMm.trim(), category: a.category, dimensions: [...a.dimensions], parts: a.parts.map(p => ({ shape: p.shape, position: [...p.position], size: [...p.size], color: p.color })) };
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
