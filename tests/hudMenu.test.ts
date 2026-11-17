import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

test('top-right HUD consolidates location, teleport, actions, updates, and settings behind the menu toggle button', () => {
  const mainSource = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(ROOT, 'src/style.css'), 'utf8');

  // Menu toggle state defaults closed
  assert.ok(mainSource.includes('const [hudMenuOpen, setHudMenuOpen] = useState(false);'));
  assert.ok(mainSource.includes('hud-menu-btn'));

  // All 5 controls live inside the hudMenuOpen reveal block
  const gateIdx = mainSource.indexOf('{hudMenuOpen && !mapOpen && !settingsOpen && (');
  const menuBtnIdx = mainSource.indexOf('hud-menu-btn', gateIdx);
  assert.ok(gateIdx !== -1, 'hudMenuOpen gate block should exist in main.tsx');
  assert.ok(menuBtnIdx > gateIdx, 'hud-menu-btn should sit after the gated tray');

  const gatedSlice = mainSource.slice(gateIdx, menuBtnIdx);
  assert.ok(gatedSlice.includes('className="location-actions"'), 'locate actions inside menu tray');
  assert.ok(gatedSlice.includes('handleToggleTeleportMode'), 'teleport button inside menu tray');
  assert.ok(gatedSlice.includes('<ActionMenu'), 'Special Actions button inside menu tray');
  assert.ok(gatedSlice.includes('<WeaponMenu'), 'earned weapons are selectable inside the main menu');
  assert.ok(gatedSlice.includes('<UpdateTriggerButton'), 'App Updates icon inside menu tray');
  assert.ok(gatedSlice.includes('settings-btn'), 'settings-btn inside menu tray');
  assert.ok(gatedSlice.includes('setSettingsOpen(true)'), 'clicking settings-btn opens settings-menu dialog');

  // SettingsMenu remains mounted inside settings-wrap regardless of hudMenuOpen
  const settingsDialogIdx = mainSource.indexOf('<SettingsMenu', menuBtnIdx);
  assert.ok(settingsDialogIdx > menuBtnIdx, 'SettingsMenu renders in settings-wrap when settingsOpen');

  // CSS positions location-actions statically in the flex bar and anchors action-menu-popover to right: 0
  assert.match(cssSource, /\.location-actions\s*\{[^}]*position:\s*static;/);
  assert.match(cssSource, /\.action-menu-wrap\s*\{[^}]*position:\s*static;/);
  assert.match(cssSource, /\.location-actions\s+\.action-menu-popover\s*\{[^}]*right:\s*0;/);
});
