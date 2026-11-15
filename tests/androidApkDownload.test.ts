import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  ANDROID_APK_PROMPT_DISMISSED_KEY,
  TELEGRAM_CHANNEL_HANDLE,
  TELEGRAM_CHANNEL_SHORT_LINK,
  TELEGRAM_CHANNEL_URL,
  TELEGRAM_QR_IMAGE_URL,
  isAndroidBrowserEligible,
  isAndroidPhoneUserAgent,
  readAndroidApkPromptDismissed,
  shouldShowAndroidApkAutoPrompt,
  writeAndroidApkPromptDismissed,
} from '../src/game/androidApkDownload.ts';

const ROOT = process.cwd();

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test('Android phone UA detection recognizes Android mobile browsers and excludes desktop, iOS, TV, and native APK', () => {
  const androidChromeUa =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
  const samsungBrowserUa =
    'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
  const windowsDesktopUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  const iphoneUa =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
  const androidTvUa =
    'Mozilla/5.0 (Linux; Android 12; Android TV; SHIELD Android TV) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

  assert.equal(isAndroidPhoneUserAgent(androidChromeUa), true);
  assert.equal(isAndroidPhoneUserAgent(samsungBrowserUa), true);
  assert.equal(isAndroidPhoneUserAgent('', 'Android'), true);
  assert.equal(isAndroidPhoneUserAgent(windowsDesktopUa, 'Win32'), false);
  assert.equal(isAndroidPhoneUserAgent(iphoneUa, 'iPhone'), false);
  assert.equal(isAndroidPhoneUserAgent(androidTvUa, 'Android'), false);

  assert.equal(
    isAndroidBrowserEligible({ userAgent: androidChromeUa, nativeApp: false }),
    true,
  );
  assert.equal(
    isAndroidBrowserEligible({ userAgent: androidChromeUa, nativeApp: true }),
    false,
  );
  assert.equal(
    isAndroidBrowserEligible({ userAgent: windowsDesktopUa, nativeApp: false }),
    false,
  );
  assert.equal(
    isAndroidBrowserEligible({ userAgent: iphoneUa, nativeApp: false }),
    false,
  );
});

test('auto-prompt dismissal checkbox persists opt-out across visits and resets only when cleared', () => {
  const storage = createMemoryStorage();
  const androidUa =
    'Mozilla/5.0 (Linux; Android 14; Redmi Note 13) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36';

  assert.equal(readAndroidApkPromptDismissed(storage), false);
  assert.equal(
    shouldShowAndroidApkAutoPrompt({ userAgent: androidUa, nativeApp: false, storage }),
    true,
  );

  // Closing without ticking the checkbox should keep showing on next visit
  writeAndroidApkPromptDismissed(false, storage);
  assert.equal(readAndroidApkPromptDismissed(storage), false);
  assert.equal(
    shouldShowAndroidApkAutoPrompt({ userAgent: androidUa, nativeApp: false, storage }),
    true,
  );

  // Ticking the checkbox hides the auto-prompt on subsequent visits
  writeAndroidApkPromptDismissed(true, storage);
  assert.equal(storage.getItem(ANDROID_APK_PROMPT_DISMISSED_KEY), '1');
  assert.equal(readAndroidApkPromptDismissed(storage), true);
  assert.equal(
    shouldShowAndroidApkAutoPrompt({ userAgent: androidUa, nativeApp: false, storage }),
    false,
  );

  // Clearing dismissal restores auto-prompt eligibility
  writeAndroidApkPromptDismissed(false, storage);
  assert.equal(
    shouldShowAndroidApkAutoPrompt({ userAgent: androidUa, nativeApp: false, storage }),
    true,
  );
});

test('broken storage access degrades safely without throwing', () => {
  const throwingStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
    getItem: () => {
      throw new Error('storage blocked');
    },
    setItem: () => {
      throw new Error('quota exceeded');
    },
    removeItem: () => {
      throw new Error('storage blocked');
    },
  };

  assert.equal(readAndroidApkPromptDismissed(throwingStorage), false);
  assert.doesNotThrow(() => writeAndroidApkPromptDismissed(true, throwingStorage));
  assert.doesNotThrow(() => writeAndroidApkPromptDismissed(false, throwingStorage));
});

test('Telegram QR asset and Settings Menu / main dialog wiring are intact', () => {
  assert.equal(TELEGRAM_CHANNEL_URL, 'https://t.me/mmregiongame');
  assert.equal(TELEGRAM_CHANNEL_SHORT_LINK, 't.me/mmregiongame');
  assert.equal(TELEGRAM_CHANNEL_HANDLE, '@MMREGIONGAME');
  assert.equal(TELEGRAM_QR_IMAGE_URL, '/telegram-qr.jpg');

  const qrPath = path.join(ROOT, 'public', 'telegram-qr.jpg');
  assert.equal(fs.existsSync(qrPath), true, 'public/telegram-qr.jpg should exist');
  assert.ok(fs.statSync(qrPath).size > 1000, 'public/telegram-qr.jpg should be a non-empty image');

  const dialogSource = fs.readFileSync(
    path.join(ROOT, 'src/components/AndroidApkDownloadDialog.tsx'),
    'utf8',
  );
  assert.ok(dialogSource.includes('TELEGRAM_QR_IMAGE_URL'));
  assert.ok(dialogSource.includes('TELEGRAM_CHANNEL_URL'));
  assert.ok(dialogSource.includes('type="checkbox"'));
  assert.ok(dialogSource.includes("mode === 'auto-prompt'"));

  const settingsSource = fs.readFileSync(
    path.join(ROOT, 'src/components/SettingsMenu.tsx'),
    'utf8',
  );
  assert.ok(settingsSource.includes("'downloadApk'"));
  assert.ok(settingsSource.includes('onOpenApkDownload'));
  assert.ok(settingsSource.includes('APK ဒေါင်းလုဒ် · QR'));

  const mainSource = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
  assert.ok(mainSource.includes('AndroidApkDownloadDialog'));
  assert.ok(mainSource.includes('shouldShowAndroidApkAutoPrompt'));
  assert.ok(mainSource.includes('writeAndroidApkPromptDismissed'));
  assert.ok(mainSource.includes('onOpenApkDownload'));
});
