import type { WorldLoadingState } from '../game/regionLoading';

export function WorldLoading({ state, sceneFailed = false }: {
 state: WorldLoadingState;
 sceneFailed?: boolean;
}) {
 if (!state.blocking && !sceneFailed) return null;
 const error = state.required.find(item => item.phase === 'error');
 const current = error ?? state.required.find(item => item.phase !== 'ready') ?? state.required[0];
 return <div className="world-loading" data-world-loading="blocking">
  <section className="world-loading-card" aria-label="မြို့ပြင်ဆင်မှု">
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

