import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseAssetEdit, requestAssetEdit } from '../src/game/assetAiEdit.ts';

test('AI edits merge valid data and reject unsafe or invalid output', () => {
  const base = { scale: [1, 1, 1] as [number, number, number], color: '#ffffff' };
  assert.deepEqual(parseAssetEdit({ scale: [1, 2, 1], roofColor: '#ff0000' }, base), { ...base, scale: [1, 2, 1], roofColor: '#ff0000' });
  for (const invalid of [{ scale: [1, 0, 1] }, { scale: [1, 2, 100] }, { color: 'url(x)' }, { code: 'alert(1)' }, {}]) assert.throws(() => parseAssetEdit(invalid, base));
});

test('Gemini request uses key header and validates returned data', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /models\/gemini-test:generateContent$/);
      assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'secret');
      assert.ok(!String(url).includes('secret'));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"scale":[1,2,1]}' }] } }] }), { status: 200 });
    };
    assert.deepEqual(await requestAssetEdit({ apiKey: 'secret', model: 'gemini-test', prompt: 'taller', assetName: 'house', current: { scale: [1, 1, 1] } }), { scale: [1, 2, 1] });
  } finally { globalThis.fetch = original; }
});
