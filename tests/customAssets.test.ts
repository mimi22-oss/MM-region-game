import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateCustomAsset, generateCustomAsset, saveCustomAsset, updateCustomAsset, deleteCustomAsset, loadCustomAssets, countAssetPlacements } from '../src/game/customAssets.ts';
import { createCustomTemplate } from '../src/game/customAssetTemplates.ts';

const asset = { id: 'custom:test', name: 'House', nameMm: 'အိမ်', category: 'buildings', dimensions: [8, 6, 10], parts: [{ shape: 'box', position: [0, 0.5, 0], size: [1, 1, 1], color: '#aabbcc' }] };
test('custom asset validates bounded non-executable geometry', () => {
  assert.equal(validateCustomAsset(asset).parts.length, 1);
  for (const s of ['box', 'cylinder', 'sphere', 'cone', 'pyramid', 'capsule', 'torus', 'dome', 'wedge'] as const) {
    assert.equal(validateCustomAsset({ ...asset, parts: [{ ...asset.parts[0], shape: s }] }).parts[0].shape, s);
  }
  assert.throws(() => validateCustomAsset({ ...asset, dimensions: [Infinity, 1, 1] }));
  assert.throws(() => validateCustomAsset({ ...asset, parts: Array(41).fill(asset.parts[0]) }));
  assert.throws(() => validateCustomAsset({ ...asset, parts: [{ ...asset.parts[0], shape: 'script' }] }));
  assert.throws(() => validateCustomAsset({ ...asset, parts: [{ ...asset.parts[0], color: 'url(x)' }] }));
});
test('character, building and tree templates preserve part rotations through validation', () => {
  for (const kind of ['blank', 'character', 'building', 'tree'] as const) {
    const original = createCustomTemplate(kind, 'custom:template');
    assert.deepEqual(validateCustomAsset(original), original);
    assert.ok(original.parts.length > 0 && original.parts.length <= 40);
  }
  const rotated = createCustomTemplate('building', 'custom:template');
  assert.deepEqual(validateCustomAsset(rotated).parts[1].rotation, [0, 45, 0]);
  assert.throws(() => validateCustomAsset({ ...rotated, parts: [{ ...rotated.parts[0], rotation: [Infinity, 0, 0] }] }));
});
test('Gemini response becomes a validated asset and key stays in header', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => { assert.ok(!String(url).includes('secret')); assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'secret'); const body = JSON.parse(String(init?.body)); assert.deepEqual(body.generationConfig.responseJsonSchema.properties.parts.items.required, ['shape', 'position', 'size', 'color']); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...asset, parts: [{ ...asset.parts[0], shape: 'Cube', color: '#abc' }, { ...asset.parts[0], color: 'Brown' }] }) }] } }] })); };
    const result = await generateCustomAsset({ key: 'secret', model: 'gemini-test', prompt: 'a house' });
    assert.match(result.id, /^custom:/); assert.equal(result.name, 'House'); assert.equal(result.parts[0].shape, 'box'); assert.equal(result.parts[0].color, '#aabbcc'); assert.equal(result.parts[1].color, '#a52a2a');
  } finally { globalThis.fetch = original; }
});
test('invalid part errors identify the field', () => {
  assert.throws(() => validateCustomAsset({ ...asset, parts: [{ ...asset.parts[0], size: [1, 0, 1] }] }), /part 1: size/);
  assert.throws(() => validateCustomAsset({ ...asset, parts: [{ ...asset.parts[0], position: [0, 4, 0] }] }), /part 1: position/);
});
test('schema rejection retries once without schema, other errors are shown without key', async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++; const body = JSON.parse(String(init?.body));
      if (calls === 1) { assert.ok(body.generationConfig.responseJsonSchema); return Response.json({ error: { message: 'Invalid response schema: too complex' } }, { status: 400 }); }
      assert.equal(body.generationConfig.responseJsonSchema, undefined);
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(asset) }] } }] });
    };
    assert.equal((await generateCustomAsset({ key: 'secret', model: 'gemini-test', prompt: 'house' })).name, 'House');
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'API key secret invalid' } }, { status: 400 }); };
    await assert.rejects(generateCustomAsset({ key: 'secret', model: 'gemini-test', prompt: 'house' }), e => e instanceof Error && e.message.includes('[redacted]') && !e.message.includes('secret'));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
test('generic invalid argument retries without schema', async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++;
      if (calls === 1) return Response.json({ error: { message: 'Request contains an invalid argument.' } }, { status: 400 });
      assert.equal(JSON.parse(String(init?.body)).generationConfig.responseJsonSchema, undefined);
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(asset) }] } }] });
    };
    assert.equal((await generateCustomAsset({ key: 'secret', model: 'gemini-test', prompt: 'house' })).name, 'House');
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
test('503 retries once and reports a continued outage', async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0, notices = 0;
    globalThis.fetch = async () => { calls++; return calls === 1 ? Response.json({ error: { message: 'Deadline expired' } }, { status: 503, headers: { 'retry-after': '0' } }) : Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(asset) }] } }] }); };
    await generateCustomAsset({ key: 'secret', model: 'gemini-test', prompt: 'house', onRetry: () => notices++ });
    assert.equal(calls, 2); assert.equal(notices, 1);
    calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'Deadline expired' } }, { status: 503, headers: { 'retry-after': '0' } }); };
    await assert.rejects(generateCustomAsset({ key: 'secret', model: 'gemini-test', prompt: 'house' }), /HTTP 503/);
    assert.equal(calls, 2);
    calls = 0;
    const controller = new AbortController();
    await assert.rejects(generateCustomAsset({ key: 'secret', model: 'gemini-test', prompt: 'house', signal: controller.signal, onRetry: () => controller.abort() }), { name: 'AbortError' });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
test('asset CRUD persists changes and refuses deletion while used on a map', () => {
  const data = new Map<string, string>();
  const old = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k), clear: () => data.clear() } });
  try {
    const original = validateCustomAsset(asset); saveCustomAsset(original);
    updateCustomAsset({ ...original, name: 'Updated' }); assert.equal(loadCustomAssets()[0].name, 'Updated');
    data.set('mm-editor-region-v1:test', JSON.stringify({ features: [{ assetId: original.id }] }));
    assert.equal(countAssetPlacements(original.id), 1); assert.throws(() => deleteCustomAsset(original.id));
    data.delete('mm-editor-region-v1:test'); deleteCustomAsset(original.id); assert.equal(loadCustomAssets().length, 0);
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: old }); }
});
