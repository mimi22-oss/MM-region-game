import type { AssetEdit } from './assetAiEdit';
const KEY = 'myanmar-town-built-in-asset-edits-v1';
export function validateBuiltInEdit(value: unknown): AssetEdit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid asset edit.');
  const v = value as AssetEdit;
  if (!Array.isArray(v.scale) || v.scale.length !== 3 || !v.scale.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0.1 && n <= 5)) throw new Error('Scale must be between 0.1 and 5.');
  for (const c of [v.color, v.roofColor]) if (c !== undefined && (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c))) throw new Error('Color must be a six-digit hex color.');
  return { scale: [...v.scale], ...(v.color ? { color: v.color } : {}), ...(v.roofColor ? { roofColor: v.roofColor } : {}) };
}
function read(): Record<string, AssetEdit> {
  try { const data: unknown = JSON.parse(localStorage.getItem(KEY) || '{}'); if (!data || typeof data !== 'object' || Array.isArray(data)) return {}; const result: Record<string, AssetEdit> = {}; for (const [id, edit] of Object.entries(data)) { try { result[id] = validateBuiltInEdit(edit); } catch { /* Ignore invalid stored entries. */ } } return result; } catch { return {}; }
}
let edits: Record<string, AssetEdit> | undefined;
export function getBuiltInEdit(id?: string): AssetEdit | undefined { if (!id) return; edits ??= read(); return edits[id]; }
export function saveBuiltInEdit(id: string, value: AssetEdit): AssetEdit {
  if (!id || id.startsWith('custom:')) throw new Error('Invalid built-in asset ID.');
  const clean = validateBuiltInEdit(value); const next = { ...(edits ?? read()), [id]: clean };
  localStorage.setItem(KEY, JSON.stringify(next)); edits = next;
  return clean;
}
