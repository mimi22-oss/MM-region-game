export function NeuralGrid({ className = '' }: { className?: string }) {
  return (
    <div className={`loader loader-grid ${className}`.trim()} role="status">
      <span className="sr-only">Loading</span>
      <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    </div>
  );
}

export function NeuralGridOverlay({
  title = 'AI 3D ဖန်တီးနေသည်…',
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="asset-ai-loading-overlay" role="status" aria-live="polite">
      <NeuralGrid />
      {title && <div className="asset-ai-loading-title">{title}</div>}
      {subtitle && <div>{subtitle}</div>}
    </div>
  );
}

export const NeuralGridLoader = NeuralGridOverlay;
