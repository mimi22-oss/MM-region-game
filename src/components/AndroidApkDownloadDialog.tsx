import { useEffect, useState } from 'react';
import {
  TELEGRAM_CHANNEL_HANDLE,
  TELEGRAM_CHANNEL_SHORT_LINK,
  TELEGRAM_CHANNEL_URL,
  TELEGRAM_QR_IMAGE_URL,
} from '../game/androidApkDownload.ts';

export type AndroidApkDialogMode = 'auto-prompt' | 'manual';

export interface AndroidApkDownloadDialogProps {
  open: boolean;
  mode: AndroidApkDialogMode;
  onClose: (dontShowAgain: boolean) => void;
}

export function AndroidApkDownloadDialog({
  open,
  mode,
  onClose,
}: AndroidApkDownloadDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    setDontShowAgain(false);
  }, [open, mode]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose(mode === 'auto-prompt' ? dontShowAgain : false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, mode, dontShowAgain, onClose]);

  if (!open) return null;

  const dismiss = () => {
    onClose(mode === 'auto-prompt' ? dontShowAgain : false);
  };

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(TELEGRAM_CHANNEL_URL);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  return (
    <div
      className="settings-backdrop apk-dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <section
        className="apk-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Android APK Download · Telegram Channel"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="apk-dialog-header">
          <div className="apk-dialog-title-wrap">
            <span className="apk-dialog-badge">ANDROID APK</span>
            <h2>
              {mode === 'auto-prompt'
                ? 'Android ဖုန်းအတွက် APK Download ရယူနိုင်ပါသည်'
                : 'Android APK Download · Telegram Channel'}
            </h2>
            <p>
              {mode === 'auto-prompt'
                ? 'Android ဖုန်းဖြင့် အင်တာနက်မလိုဘဲ (Offline) ချောမွေ့စွာ ကစားနိုင်ရန် Official Telegram Channel မှ APK ကို Download ပြုလုပ်နိုင်ပါသည်။'
                : 'MM Region Game ၏ နောက်ဆုံးထွက် Android APK များကို Telegram Channel မှတစ်ဆင့် တိုက်ရိုက် Download ရယူနိုင်ပါသည်။'}
            </p>
          </div>
          <button
            type="button"
            className="settings-menu-close"
            aria-label="APK download dialog ပိတ်မည်"
            onClick={dismiss}
          >
            ✕
          </button>
        </div>

        <div className="apk-dialog-body">
          <div className="apk-qr-card">
            <img
              src={TELEGRAM_QR_IMAGE_URL}
              alt={`${TELEGRAM_CHANNEL_HANDLE} Telegram Channel QR Code`}
              className="apk-qr-image"
              loading="eager"
            />
            <span className="apk-qr-handle">{TELEGRAM_CHANNEL_HANDLE}</span>
          </div>

          <div className="apk-link-box">
            <span className="apk-link-label">Telegram Channel Link</span>
            <a
              href={TELEGRAM_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="apk-telegram-btn"
              onClick={() => {
                if (mode === 'auto-prompt' && dontShowAgain) {
                  onClose(true);
                }
              }}
            >
              📲 Telegram မှ APK Download လုပ်မည် ({TELEGRAM_CHANNEL_SHORT_LINK})
            </a>
            <div className="apk-link-subrow">
              <code>{TELEGRAM_CHANNEL_URL}</code>
              <button
                type="button"
                className="apk-copy-btn"
                onClick={() => void handleCopyLink()}
              >
                {copied ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
          </div>

          {mode === 'auto-prompt' && (
            <label className="apk-dont-show-row">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <span>နောက်တစ်ကြိမ် ထပ်မပြတော့ပါ (Don&apos;t show again)</span>
            </label>
          )}
        </div>

        <div className="apk-dialog-footer">
          <button
            type="button"
            className="apk-close-btn"
            onClick={dismiss}
          >
            {mode === 'auto-prompt' ? 'ဆက်ကစားမည် · ပိတ်မည်' : 'ပိတ်မည်'}
          </button>
        </div>
      </section>
    </div>
  );
}
