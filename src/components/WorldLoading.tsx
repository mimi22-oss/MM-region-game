import { useEffect, useState } from 'react';
import {
 APP_LOGO_FALLBACK_DATA_URI,
 APP_LOGO_SIZES,
 APP_LOGO_SRC,
 APP_LOGO_SRCSET,
} from '../game/appLogo';
import type { WorldLoadingState } from '../game/regionLoading';

export function WorldLoading({ state, sceneFailed = false }: {
 state: WorldLoadingState;
 sceneFailed?: boolean;
}) {
 const [useFallbackLogo, setUseFallbackLogo] = useState(false);

 // If network drops and recovers while loading, retry the crisp responsive WebP logo
 useEffect(() => {
  if (!useFallbackLogo) return;
  const onOnline = () => setUseFallbackLogo(false);
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
 }, [useFallbackLogo]);

 if (!state.blocking && !sceneFailed) return null;
 const error = state.required.find(item => item.phase === 'error');
 const current = error ?? state.required.find(item => item.phase !== 'ready') ?? state.required[0];
 return <div className="world-loading" data-world-loading="blocking">
  <section className="world-loading-card" aria-label="မြို့ပြင်ဆင်မှု">
   <img
    className="world-loading-logo"
    src={useFallbackLogo ? APP_LOGO_FALLBACK_DATA_URI : APP_LOGO_SRC}
    srcSet={useFallbackLogo ? undefined : APP_LOGO_SRCSET}
    sizes={useFallbackLogo ? undefined : APP_LOGO_SIZES}
    alt="MM Region Game"
    width={116}
    height={116}
    loading="eager"
    decoding="sync"
    fetchPriority="high"
    style={{
     backgroundImage: `url("${APP_LOGO_FALLBACK_DATA_URI}")`,
     backgroundSize: 'cover',
     backgroundPosition: 'center',
    }}
    onError={() => setUseFallbackLogo(true)}
   />
   <div className="world-loading-name" role="status" aria-live="polite" aria-atomic="true">
    {!error && !sceneFailed && <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>}
    <span>{current?.name.split(' · ')[0] ?? 'ကလေးမြို့'}</span>
   </div>
   {(error || sceneFailed) && <>
    <p>{sceneFailed ? 'မြင်ကွင်း ပြင်ဆင်၍မရပါ။' : 'ဒေတာရယူ၍မရပါ။'}</p>
    <button type="button" onClick={() => window.location.reload()}>ပြန်ကြိုးစားမည်</button>
   </>}
  </section>
 </div>;
}
