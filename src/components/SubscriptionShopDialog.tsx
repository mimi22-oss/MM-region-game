import { useCallback, useEffect, useRef, useState } from 'react';
import { SUBSCRIPTION_WEBSITE_URL } from '../data/subscriptionBillboard';
import {
  isAllowedShopUrl,
  openSubscriptionShop,
  type SubscriptionShopState,
} from '../game/subscriptionShop';

interface SubscriptionShopDialogProps {
  isOpen: boolean;
  url: string;
  title: string;
  onClose: () => void;
}

export function SubscriptionShopDialog({
  isOpen,
  url,
  title,
  onClose,
}: SubscriptionShopDialogProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const safeUrl = isAllowedShopUrl(url) ? url : SUBSCRIPTION_WEBSITE_URL;

  const [reloadNonce, setReloadNonce] = useState(0);
  const [embedStatus, setEmbedStatus] = useState<'loading' | 'loaded' | 'fallback'>('loading');
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setEmbedStatus('loading');
    setNoticeDismissed(false);

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frameId = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && prev.isConnected && prev.tagName !== 'BODY') {
        try {
          prev.focus();
        } catch {
          // Ignore focus restore errors
        }
      }
    };
  }, [isOpen, safeUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, onClose]);

  const handleReload = useCallback(() => {
    setEmbedStatus('loading');
    setReloadNonce((n) => n + 1);
  }, []);

  const handleOpenExternal = useCallback(() => {
    window.open(safeUrl, '_blank', 'noopener,noreferrer');
  }, [safeUrl]);

  if (!isOpen) return null;

  let displayHost = safeUrl;
  try {
    displayHost = new URL(safeUrl).host;
  } catch {
    displayHost = safeUrl;
  }

  return (
    <div
      className="subshop-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subshop-dialog-title"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div
        className="subshop-modal"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') e.stopPropagation();
        }}
        onKeyUp={(e) => e.stopPropagation()}
      >
        <div className="subshop-header">
          <div className="subshop-brand">
            <span className="subshop-icon" aria-hidden="true">
              🛍️
            </span>
            <div className="subshop-title-group">
              <h2 id="subshop-dialog-title" className="subshop-title">
                {title}
              </h2>
              <p className="subshop-url" title={safeUrl}>
                {displayHost}
              </p>
            </div>
          </div>

          <div className="subshop-actions">
            <button
              type="button"
              className="subshop-btn subshop-btn-ghost"
              onClick={handleReload}
              title="Reload website"
              aria-label="Reload website"
            >
              ↻ <span className="subshop-btn-label">Reload</span>
            </button>

            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="subshop-btn subshop-btn-primary"
              aria-label="Open Subscription Shop in external browser tab"
            >
              <span>Open in Browser</span>
              <span aria-hidden="true">↗</span>
            </a>

            <button
              ref={closeBtnRef}
              type="button"
              className="subshop-btn subshop-btn-close"
              onClick={onClose}
              aria-label="Close Subscription Shop"
              title="Close (Esc)"
            >
              ✕ <span className="subshop-btn-label">Close</span>
            </button>
          </div>
        </div>

        {!noticeDismissed && embedStatus !== 'fallback' && (
          <div className="subshop-notice" role="status">
            <span className="subshop-notice-text">
              {embedStatus === 'loading'
                ? 'Loading storefront… If this website refuses embedded framing (CSP/X-Frame policy) or login cookies, use Open in Browser ↗.'
                : 'If the page inside is blank or refuses to connect (site CSP/frame policy or login cookies), open it directly in your browser tab.'}
            </span>
            <div className="subshop-notice-actions">
              <button
                type="button"
                className="subshop-notice-link"
                onClick={() => setEmbedStatus('fallback')}
              >
                Fallback View
              </button>
              <button
                type="button"
                className="subshop-notice-dismiss"
                onClick={() => setNoticeDismissed(true)}
                aria-label="Dismiss notice"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="subshop-body">
          {embedStatus === 'fallback' ? (
            <div className="subshop-fallback-card">
              <div className="subshop-fallback-badge">External Storefront Mode</div>
              <h3 className="subshop-fallback-heading">{title}</h3>
              <p className="subshop-fallback-desc">
                Embedded framing may be restricted by the target website&apos;s security headers
                (<code>Content-Security-Policy: frame-ancestors</code>) or third-party session
                cookie rules. Your player location in Myanmar Town remains saved while you shop.
              </p>
              <div className="subshop-fallback-cta">
                <button
                  type="button"
                  className="subshop-btn subshop-btn-primary subshop-btn-lg"
                  onClick={handleOpenExternal}
                >
                  Open Subscription Shop in New Tab ↗
                </button>
                <button
                  type="button"
                  className="subshop-btn subshop-btn-ghost subshop-btn-lg"
                  onClick={handleReload}
                >
                  Retry Embedded View
                </button>
                <button
                  type="button"
                  className="subshop-btn subshop-btn-close subshop-btn-lg"
                  onClick={onClose}
                >
                  Return to Game
                </button>
              </div>
            </div>
          ) : (
            <>
              {embedStatus === 'loading' && (
                <div className="subshop-loading-pill" aria-live="polite">
                  Connecting to {displayHost}…
                </div>
              )}
              <iframe
                key={`${safeUrl}:${reloadNonce}`}
                src={safeUrl}
                title={`${title} Website`}
                className="subshop-iframe"
                loading="eager"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-write"
                onLoad={() => setEmbedStatus('loaded')}
                onError={() => setEmbedStatus('fallback')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface SubscriptionProximityPromptProps {
  shop: SubscriptionShopState;
  visible: boolean;
}

export function SubscriptionProximityPrompt({
  shop,
  visible,
}: SubscriptionProximityPromptProps) {
  if (!visible || shop.isOpen || !shop.isNearBillboard) return null;

  return (
    <div
      className="subshop-proximity-wrap"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="subshop-proximity-btn"
        onClick={(e) => {
          e.stopPropagation();
          openSubscriptionShop('proximity-action');
        }}
      >
        <span className="subshop-proximity-icon" aria-hidden="true">
          🛍️
        </span>
        <span className="subshop-proximity-copy">
          <strong>{shop.title}</strong>
          <span>
            {shop.playerDistanceM !== null ? `${shop.playerDistanceM.toFixed(1)} m · ` : ''}
            Press E or Tap to Open
          </span>
        </span>
        <span className="subshop-proximity-key">E</span>
      </button>
    </div>
  );
}
