import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateCustomAsset, generateCustomAsset } from '../src/game/customAssets.ts';

const asset = { id: 'custom:test', name: 'House', nameMm: 'အိမ်', category: 'buildings', dimensions: [8, 6, 10], parts: [{ shape: 'box', position: [0, 0.5, 0], size: [1, 1, 1], color: '#aabbcc' }] };
test('custom asset validates bounded non-executable geometry', () => {
  assert.equal(validateCustomAsset(asset).parts.length, 1);
  assert.throws(() => validateCustomAsset({ ...asset, dimensions: [Infinity, 1, 1] }));
  assert.throws(() => validateCustomAsset({ ...asset, parts: Array(41).fill(asset.parts[0]) }));
  assert.throws(() => validateCustomAsset({ ...asset, parts: [{ ...asset.parts[0], shape: 'script' }] }));
  assert.throws(() => validateCustomAsset({ ...asset, parts: [{ ...asset.parts[0], color: 'url(x)' }] }));
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
