import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

test('Phase 2 Android APK: MainActivity implements sticky immersive WindowInsetsCompat and cutout shortEdges', () => {
  const javaPath = path.join(ROOT, 'android/app/src/main/java/com/mmregion/town3d/MainActivity.java');
  assert.ok(fs.existsSync(javaPath), 'MainActivity.java must exist');
  const java = fs.readFileSync(javaPath, 'utf8');

  // AndroidX WindowInsetsControllerCompat imports and usage
  assert.ok(java.includes('WindowCompat.setDecorFitsSystemWindows'), 'setDecorFitsSystemWindows must be called');
  assert.ok(java.includes('WindowInsetsControllerCompat'), 'WindowInsetsControllerCompat must be used');
  assert.ok(java.includes('WindowInsetsCompat.Type.systemBars()'), 'systemBars must be hidden');
  assert.ok(java.includes('BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE'), 'Sticky swipe behavior must be configured');

  // Cutout handling for landscape
  assert.ok(java.includes('LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES'), 'Cutout shortEdges must be configured');

  // Focus and lifecycle restore
  assert.ok(java.includes('onWindowFocusChanged'), 'onWindowFocusChanged must restore immersive mode');
  assert.ok(java.includes('onResume'), 'onResume must restore immersive mode');

  // Styles transparent system bars
  const stylesPath = path.join(ROOT, 'android/app/src/main/res/values/styles.xml');
  const styles = fs.readFileSync(stylesPath, 'utf8');
  assert.ok(styles.includes('android:statusBarColor'), 'statusBarColor must be configured');
  assert.ok(styles.includes('android:navigationBarColor'), 'navigationBarColor must be configured');
});

test('Phase 3 Mobile Web: PWA manifest, viewport fit, and fullscreen controls', () => {
  const manifestPath = path.join(ROOT, 'public/manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.display, 'fullscreen');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  assert.equal(manifest.theme_color, '#143d36');

  // index.html linking
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('manifest.webmanifest'), 'index.html must link manifest.webmanifest');
  assert.ok(indexHtml.includes('viewport-fit=cover'), 'index.html must have viewport-fit=cover');
  assert.ok(indexHtml.includes('apple-mobile-web-app-capable'), 'index.html must have apple-mobile-web-app-capable');

  // main.tsx fullscreen button
  const mainTsx = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
  assert.ok(mainTsx.includes('useFullscreen'), 'main.tsx must use useFullscreen');
  assert.ok(mainTsx.includes('toggleFullscreen'), 'main.tsx must provide toggleFullscreen action');
  assert.ok(mainTsx.includes('isFullscreen'), 'main.tsx must track isFullscreen');

  // SettingsMenu fullscreen tile
  const settingsMenu = fs.readFileSync(path.join(ROOT, 'src/components/SettingsMenu.tsx'), 'utf8');
  assert.ok(settingsMenu.includes('fullscreen-toggle'), 'SettingsMenu must include fullscreen toggle tile');
});

test('Phase 4 CSS: Viewport fallback and safe-area insets', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/style.css'), 'utf8');

  // Viewport dvh with vh fallback
  assert.ok(css.includes('height: 100vh;'), 'main must define 100vh fallback');
  assert.ok(css.includes('height: 100dvh;'), 'main must define 100dvh');

  // Safe area handling for HUD
  assert.ok(css.includes('env(safe-area-inset-top'), 'HUD must account for safe-area-inset-top');
  assert.ok(css.includes('env(safe-area-inset-right'), 'HUD must account for safe-area-inset-right');
  assert.ok(css.includes('env(safe-area-inset-bottom'), 'HUD must account for safe-area-inset-bottom');
  assert.ok(css.includes('env(safe-area-inset-left'), 'HUD must account for safe-area-inset-left');
});

test('fullscreenManager logic: safe execution in SSR/headless environments', async () => {
  const {
    isFullscreenSupported,
    isFullscreenActive,
    isStandaloneDisplay,
    getFullscreenState,
    requestFullscreen,
    exitFullscreen,
    toggleFullscreen,
    subscribeFullscreen,
  } = await import('../src/game/fullscreenManager.ts');

  // In Node environment without DOM, all checks should degrade safely without throwing
  assert.equal(typeof isFullscreenSupported(), 'boolean');
  assert.equal(typeof isFullscreenActive(), 'boolean');
  assert.equal(typeof isStandaloneDisplay(), 'boolean');

  const state = getFullscreenState();
  assert.equal(typeof state.supported, 'boolean');
  assert.equal(typeof state.active, 'boolean');
  assert.equal(typeof state.standalone, 'boolean');

  // Calling actions without DOM should safely resolve false without throwing
  const reqRes = await requestFullscreen();
  assert.equal(reqRes, false);

  const exitRes = await exitFullscreen();
  assert.equal(exitRes, false);

  const toggleRes = await toggleFullscreen();
  assert.equal(toggleRes, false);

  let notified = false;
  const unsub = subscribeFullscreen(() => {
    notified = true;
  });
  assert.equal(notified, true);
  unsub();
});
