import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Settings menu and FestivalSettings contain no-overflow styling for small screens', () => {
  const festivalSettingsPath = path.resolve(__dirname, '../src/festivals/FestivalSettings.tsx');
  const festivalSource = fs.readFileSync(festivalSettingsPath, 'utf8');

  // 1. Festival Zone select box
  assert.ok(
    festivalSource.includes("aria-label=\"ပွဲတော်နယ်မြေ ရွေးချယ်ရန်\""),
    'Festival zone select exists'
  );
  assert.ok(
    festivalSource.includes("textOverflow: 'ellipsis'"),
    'Festival zone select has textOverflow ellipsis'
  );
  assert.ok(
    festivalSource.includes("boxSizing: 'border-box'"),
    'Festival zone select has boxSizing border-box'
  );
  assert.ok(
    festivalSource.includes("maxWidth: '100%'"),
    'Festival zone select has maxWidth 100%'
  );

  // 2. Balloons per zone range input
  assert.ok(
    festivalSource.includes("aria-label=\"ဇုန်တစ်ခုလျှင် မီးပုံးပျံအရေအတွက်\""),
    'Balloons per zone range exists'
  );

  // 3. Quality Preset select box
  assert.ok(
    festivalSource.includes("aria-label=\"Quality Preset\""),
    'Quality preset select exists'
  );

  // 4. Custom Zone responsive grid
  assert.ok(
    festivalSource.includes("repeat(auto-fit, minmax(80px, 1fr))"),
    'Custom zone inputs use auto-fit minmax grid'
  );
});

test('CSS rules in src/style.css prevent horizontal overflow in settings-menu and components', () => {
  const cssPath = path.resolve(__dirname, '../src/style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // .settings-menu containment
  assert.ok(css.includes('max-width: 100vw;'), 'settings-menu has max-width: 100vw');
  assert.ok(css.includes('.settings-menu select'), 'settings-menu select defensive styling exists');
  assert.ok(css.includes('text-overflow: ellipsis;'), 'select has text-overflow: ellipsis');

  // .time-btn containment
  assert.ok(css.includes('.time-btn'), 'time-btn rule exists');
  assert.ok(css.includes('word-break: break-word;'), 'time-btn has word-break: break-word');

  // .character-options containment
  assert.ok(css.includes('.character-options button'), 'character-options button exists');

  // .environment-volume containment
  assert.ok(css.includes('.environment-volume input'), 'environment-volume input exists');

  // .settings-detail-card containment
  assert.ok(
    css.includes('.settings-detail-card {\r\n\tmin-width: 0;\r\n\tmax-width: 100%;\r\n\tbox-sizing: border-box;\r\n\toverflow: hidden;') ||
    css.includes('.settings-detail-card {\n\tmin-width: 0;\n\tmax-width: 100%;\n\tbox-sizing: border-box;\n\toverflow: hidden;'),
    'settings-detail-card has overflow: hidden and box-sizing: border-box'
  );

  // Responsive small-screen media queries (<= 420px, <= 380px, <= 350px)
  assert.ok(css.includes('@media (max-width: 420px)'), 'media query 420px exists');
  assert.ok(css.includes('@media (max-width: 380px)'), 'media query 380px exists');
  assert.ok(css.includes('@media (max-width: 350px)'), 'media query 350px exists');
});
