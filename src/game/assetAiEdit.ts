export type AssetEdit = { scale: [number, number, number]; color?: string; roofColor?: string };

/** Only data, never executable code, is accepted from the model. */
export function parseAssetEdit(value: unknown, current: AssetEdit): AssetEdit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI response must be a JSON object.');
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).some(k => !['scale', 'color', 'roofColor'].includes(k))) throw new Error('AI returned unsupported properties.');
  const result: AssetEdit = { ...current, scale: [...current.scale] };
  if (obj.scale !== undefined) {
    if (!Array.isArray(obj.scale) || obj.scale.length !== 3 || !obj.scale.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0.1 && n <= 5)) throw new Error('Scale must contain three numbers between 0.1 and 5.');
    result.scale = obj.scale as [number, number, number];
  }
  for (const key of ['color', 'roofColor'] as const) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(obj[key] as string)) throw new Error(`${key} must be a six-digit hex color.`);
      result[key] = obj[key] as string;
    }
  }
  if (!Object.keys(obj).length) throw new Error('AI did not return any editable properties.');
  return result;
}

export async function requestAssetEdit(options: { apiKey: string; model: string; prompt: string; assetName: string; current: AssetEdit; signal?: AbortSignal }): Promise<AssetEdit> {
  const model = options.model.trim().replace(/^models\//, '');
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid Gemini model name.');
  if (!options.apiKey.trim() || !options.prompt.trim()) throw new Error('Enter an API key and prompt.');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal: options.signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey.trim() },
    body: JSON.stringify({ contents: [{ parts: [{ text: `Edit the existing 3D asset ${options.assetName}. Current properties: ${JSON.stringify(options.current)}. User request: ${options.prompt}\nReturn only a JSON object containing the changed properties. Allowed properties: scale [x,y,z] absolute multipliers from 0.1 to 5, color and roofColor as #RRGGBB. Do not invent geometry or return code. If the request cannot be represented by these properties return {}.` }] }], generationConfig: { responseMimeType: 'application/json' } }),
  });
  if (!response.ok) throw new Error(`Gemini request failed (HTTP ${response.status}). Check the model, key and quota.`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('');
  if (!text) throw new Error('Gemini returned no editable response.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gemini returned invalid JSON.'); }
  return parseAssetEdit(parsed, options.current);
}
