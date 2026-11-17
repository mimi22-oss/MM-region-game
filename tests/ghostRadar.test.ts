import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { circularRadarProjection, clampToRadarCircle } from '../src/game/missions/ghostDevMapModel.ts';

test('circularRadarProjection produces uniform 1:1 scale and centered coordinates', () => {
  const points = [
    { x: 100, z: -50 },
    { x: 200, z: 50 },
  ];
  const proj = circularRadarProjection(points, 200, 20);

  // Center should be (150, 0)
  assert.equal(proj.centerX, 150);
  assert.equal(proj.centerZ, 0);
  assert.equal(proj.cx, 100);
  assert.equal(proj.cy, 100);

  // Mapping center should yield cx, cy (100, 100)
  assert.equal(proj.x(150), 100);
  assert.equal(proj.y(0), 100);

  // Radius should be size / 2 - 4 = 96
  assert.equal(proj.radius, 96);
  assert.ok(proj.scale > 0, 'scale must be positive');
});

test('clampToRadarCircle correctly clamps out-of-bounds radar markers to circle rim', () => {
  // Point inside circle (dist = 50 <= 88)
  const inside = clampToRadarCircle(100 + 30, 100 + 40, 100, 100, 88);
  assert.equal(inside.clamped, false);
  assert.equal(inside.x, 130);
  assert.equal(inside.y, 140);

  // Point outside circle (dist = 100 > 88) along X axis
  const outsideX = clampToRadarCircle(200, 100, 100, 100, 88);
  assert.equal(outsideX.clamped, true);
  assert.equal(Math.round(outsideX.x), 188);
  assert.equal(outsideX.y, 100);

  // Point outside diagonally
  const outsideDiag = clampToRadarCircle(200, 200, 100, 100, 88);
  assert.equal(outsideDiag.clamped, true);
  const distFromCenter = Math.hypot(outsideDiag.x - 100, outsideDiag.y - 100);
  assert.ok(Math.abs(distFromCenter - 88) < 0.001, 'Clamped distance must equal maxRadius');
});

test('GhostRadar component and CSS support draggable placement, clean HUD, and size scaling', () => {
  const tsx = readFileSync('src/components/GhostRadar.tsx', 'utf-8');
  const css = readFileSync('src/components/GhostRadar.css', 'utf-8');

  // Must import styling and radar projection
  assert.ok(tsx.includes("import './GhostRadar.css'"), 'Must import GhostRadar.css');
  assert.ok(tsx.includes('circularRadarProjection'), 'Must use circularRadarProjection');
  assert.ok(tsx.includes('clampToRadarCircle'), 'Must use clampToRadarCircle');

  // Must support draggable pointer events (handlePointerDown, handlePointerMove, handlePointerUp)
  assert.ok(tsx.includes('handlePointerDown'), 'Must handle pointer down for dragging');
  assert.ok(tsx.includes('handlePointerMove'), 'Must handle pointer move for dragging');
  assert.ok(tsx.includes('handlePointerUp'), 'Must handle pointer up for dragging');
  assert.ok(tsx.includes('clampPosition'), 'Must clamp draggable position within viewport bounds');

  // Must store draggable position and size mode in localStorage
  assert.ok(tsx.includes('STORAGE_POS_KEY'), 'Must define STORAGE_POS_KEY');
  assert.ok(tsx.includes('STORAGE_SIZE_KEY'), 'Must define STORAGE_SIZE_KEY');

  // Must support size scaling (normal, large, minimized)
  assert.ok(tsx.includes("'normal'"), 'Must support normal size');
  assert.ok(tsx.includes("'large'"), 'Must support large size');
  assert.ok(tsx.includes("'minimized'"), 'Must support minimized floating size');

  // Minimized floating circular badge must render ghost emoji and badge
  assert.ok(tsx.includes('ghost-radar-minimized'), 'Must render ghost-radar-minimized button');
  assert.ok(tsx.includes('ghost-radar-badge'), 'Must render active ghost count badge');

  // Zero extraneous debug text (strictly prohibited per user request)
  assert.ok(!tsx.includes('World X/Z · 4 updates/sec'), 'Must NOT contain dev debug text');
  assert.ok(!tsx.includes('fixed world scale'), 'Must NOT contain fixed world scale text');
  assert.ok(!tsx.includes('APPROXIMATE SPAWN'), 'Must NOT contain approximate spawn text');

  // Sweep cone must be removed per user request
  assert.ok(!tsx.includes('ghost-radar-sweep'), 'Radar sweep cone must be removed from TSX');
  assert.ok(!css.includes('.ghost-radar-sweep'), 'Radar sweep cone animation must be removed from CSS');

  // CSS classes for responsive sizes and dragging
  assert.ok(css.includes('.ghost-radar-widget'), 'CSS must define .ghost-radar-widget');
  assert.ok(css.includes('.ghost-radar-circle'), 'CSS must define .ghost-radar-circle');
  assert.ok(css.includes('.ghost-radar-size-normal'), 'CSS must define .ghost-radar-size-normal');
  assert.ok(css.includes('.ghost-radar-size-large'), 'CSS must define .ghost-radar-size-large');
  assert.ok(css.includes('.ghost-radar-minimized'), 'CSS must define .ghost-radar-minimized');
  assert.ok(css.includes('.ghost-radar-default-pos'), 'CSS must define .ghost-radar-default-pos');
  assert.ok(css.includes('@media (max-width: 600px)'), 'CSS must include mobile breakpoint');
});
