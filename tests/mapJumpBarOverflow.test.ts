import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('map-jump-bar in src/style.css has vertical overflow scroll to prevent top-down overflow', () => {
  const cssPath = path.resolve(__dirname, '../src/style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify .map-jump-bar overflow properties
  assert.ok(css.includes('.map-jump-bar {'), '.map-jump-bar selector exists');
  assert.ok(css.includes('overflow-y: auto;'), 'map-jump-bar has overflow-y: auto');
  assert.ok(css.includes('overflow-x: hidden;'), 'map-jump-bar has overflow-x: hidden');
  assert.ok(css.includes('max-height: min(140px, 25dvh);'), 'map-jump-bar has bounded max-height');
  assert.ok(css.includes('scrollbar-width: thin;'), 'map-jump-bar has scrollbar-width: thin');
  assert.ok(css.includes('.map-jump-bar::-webkit-scrollbar'), 'map-jump-bar has webkit scrollbar styles');
  assert.ok(css.includes('main.night-mode .map-jump-bar::-webkit-scrollbar-thumb'), 'night mode scrollbar styles exist');

  // Verify .map-expanded has overflow: hidden
  assert.ok(css.includes('.map-expanded {'), '.map-expanded selector exists');
  assert.ok(css.includes('overflow: hidden;'), 'map-expanded has overflow: hidden');
});
