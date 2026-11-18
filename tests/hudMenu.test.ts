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

test('WeaponMenu provides a circular HUD trigger, floating armory drawer, and preserves select[aria-label="Weapon"]', () => {
  const weaponSource = fs.readFileSync(path.join(ROOT, 'src/components/combat/WeaponMenu.tsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(ROOT, 'src/style.css'), 'utf8');

  // Compatibility with combat verification scripts (select[aria-label="Weapon"])
  assert.ok(weaponSource.includes('aria-label="Weapon"'), 'native select retains aria-label="Weapon"');
  assert.ok(weaponSource.includes('value="ghost-sword"'), 'ghost-sword option remains selectable');
  assert.ok(weaponSource.includes('selectMissionWeapon'), 'updates mission equipped weapon');

  // Interactive armory UI elements
  assert.ok(weaponSource.includes('weapon-menu-trigger'), 'circular HUD trigger button exists');
  assert.ok(weaponSource.includes('weapon-menu-popover'), 'floating armory popover exists');
  assert.ok(weaponSource.includes('weapon-card-list'), 'visual weapon cards exist');
  assert.ok(weaponSource.includes('role="radiogroup"'), 'weapon options use accessible radiogroup semantics');

  // CSS rules for trigger, floating popover, night mode, and right-aligned vertical HUD column
  assert.match(cssSource, /\.settings-wrap\.settings-wrap-open\s*\{[^}]*align-items:\s*flex-end;/);
  assert.match(cssSource, /\.weapon-menu-trigger\s*\{[^}]*border-radius:\s*50%;/);
  assert.match(cssSource, /\.weapon-menu-popover\s*\{[^}]*position:\s*fixed;/);
  assert.match(cssSource, /main\.night-mode\s+\.weapon-menu-popover\s*\{/);
});
