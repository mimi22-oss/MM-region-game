import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateBuiltInEdit, getBuiltInEdit, saveBuiltInEdit } from '../src/game/builtInAssetEdits.ts';

test('built-in edits validate and persist without replacing the model ID', () => {
  const data = new Map<string, string>(); const old = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) } });
  try {
    const edit = { scale: [1, 2, 1] as [number, number, number], color: '#aabbcc' };
    saveBuiltInEdit('building:myothar-house', edit);
    assert.deepEqual(getBuiltInEdit('building:myothar-house'), edit);
    assert.throws(() => validateBuiltInEdit({ scale: [1, 0, 1] }));
    assert.throws(() => validateBuiltInEdit({ scale: [1, 1, 1], color: 'url(x)' }));
    assert.throws(() => saveBuiltInEdit('custom:123', edit));
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: old }); }
});
