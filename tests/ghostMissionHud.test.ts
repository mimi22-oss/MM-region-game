import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ThreeGhostsMissionHud imports CSS, defines drag & collapse classes, and supports game UI structure', () => {
  const tsx = readFileSync('src/components/ThreeGhostsMissionHud.tsx', 'utf-8');
  const css = readFileSync('src/components/ThreeGhostsMissionHud.css', 'utf-8');

  // Verify CSS import
  assert.ok(tsx.includes("import './ThreeGhostsMissionHud.css'"), 'CSS must be imported');

  // Verify collapse toggle logic and storage keys
  assert.ok(tsx.includes('STORAGE_COLLAPSED_KEY'), 'Should track collapsed preference in storage');
  assert.ok(tsx.includes('STORAGE_POS_KEY'), 'Should track draggable position in storage');
  assert.ok(tsx.includes('toggleCollapse'), 'Should provide toggleCollapse callback');

  // Verify mobile down/up chevron buttons near ghost icon
  assert.ok(tsx.includes('ghost-hud-ghost-emoji'), 'Should contain ghost emoji');
  assert.ok(tsx.includes('ghost-hud-chevron-btn'), 'Should contain chevron toggle button');
  assert.ok(tsx.includes('ghost-hud-pill'), 'Should support collapsed minimal pill view');
  assert.ok(tsx.includes('ghost-hud-card'), 'Should support expanded full gaming card view');

  // Verify draggable pointer event handlers
  assert.ok(tsx.includes('handlePointerDown'), 'Should implement pointer down');
  assert.ok(tsx.includes('handlePointerMove'), 'Should implement pointer move');
  assert.ok(tsx.includes('handlePointerUp'), 'Should implement pointer up');
  assert.ok(tsx.includes('clampPosition'), 'Should clamp draggable position within viewport');

  // Verify Boss HP bars & stages
  assert.ok(tsx.includes('ghost-hud-boss-item'), 'Should render boss HP bars');
  assert.ok(tsx.includes('ghost-hud-hp-bar-track'), 'Should have HP bar track');
  assert.ok(tsx.includes('ghost-hud-hp-bar-fill'), 'Should have HP bar fill');
  assert.ok(tsx.includes('ghost-hud-encounter-grid'), 'Should render encounter nodes');

  // Verify CSS classes exist
  assert.ok(css.includes('.ghost-hud-container'), 'CSS must define container');
  assert.ok(css.includes('.ghost-hud-pill'), 'CSS must define pill');
  assert.ok(css.includes('.ghost-hud-card'), 'CSS must define card');
  assert.ok(css.includes('@media (max-width: 768px)'), 'CSS must include mobile media queries');
});
