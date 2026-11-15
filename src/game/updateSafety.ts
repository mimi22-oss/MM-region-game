export type UpdateBlockingReason =
  | 'ghost_chase'
  | 'ghost_grab'
  | 'vehicle_ride'
  | 'car_drive'
  | 'balloon_ride'
  | 'cinematic_intro'
  | 'scene_loading'
  | 'active_interaction';

export interface UpdateBusyContext {
  readonly ghostThreatActive: boolean;
  readonly ghostGrabActive: boolean;
  readonly ridingMotorcycle: boolean;
  readonly drivingCar: boolean;
  readonly ridingBalloon: boolean;
  readonly introActive: boolean;
  readonly sceneLoading: boolean;
  readonly activeModalBlocking?: boolean;
}

export interface UpdateSafetyEvaluation {
  readonly safeToApplyNow: boolean;
  readonly safeToDownloadInBackground: boolean;
  readonly blockingReasons: readonly UpdateBlockingReason[];
  readonly summaryMy: string;
  readonly summaryEn: string;
}

const REASON_LABELS_MY: Record<UpdateBlockingReason, string> = {
  ghost_chase: 'သရဲလိုက်နေချိန် ဖြစ်နေပါသည်',
  ghost_grab: 'သရဲဖမ်းဆီးမှု ဖြစ်ပွားနေပါသည်',
  vehicle_ride: 'ဆိုင်ကယ်စီးနေချိန် ဖြစ်နေပါသည်',
  car_drive: 'ကားမောင်းနေချိန် ဖြစ်နေပါသည်',
  balloon_ride: 'မိုးပျံပူဖောင်း စီးနေချိန် ဖြစ်နေပါသည်',
  cinematic_intro: 'Drone Intro ပြသနေပါသည်',
  scene_loading: 'မြင်ကွင်း တင်နေဆဲ ဖြစ်ပါသည်',
  active_interaction: 'အရေးကြီးလုပ်ဆောင်ချက် ဖွင့်ထားပါသည်',
};

const REASON_LABELS_EN: Record<UpdateBlockingReason, string> = {
  ghost_chase: 'Active ghost encounter/chase',
  ghost_grab: 'Ghost grab sequence in progress',
  vehicle_ride: 'Motorcycle ride in progress',
  car_drive: 'Driving car',
  balloon_ride: 'Hot-air balloon ride in progress',
  cinematic_intro: 'Cinematic drone intro playing',
  scene_loading: '3D scene is loading',
  active_interaction: 'Active shop/modal interaction open',
};

/**
 * Never interrupts active gameplay boundaries (ghost chases/grabs, vehicle/balloon rides,
 * cinematic intro, loading, or active modal interactions) when applying an OTA restart or swap.
 * Background downloading remains permitted except during fatal scene load or active ghost grab.
 */
export function evaluateUpdateApplySafety(ctx: UpdateBusyContext): UpdateSafetyEvaluation {
  const reasons: UpdateBlockingReason[] = [];
  if (ctx.ghostGrabActive) reasons.push('ghost_grab');
  if (ctx.ghostThreatActive) reasons.push('ghost_chase');
  if (ctx.ridingMotorcycle) reasons.push('vehicle_ride');
  if (ctx.drivingCar) reasons.push('car_drive');
  if (ctx.ridingBalloon) reasons.push('balloon_ride');
  if (ctx.introActive) reasons.push('cinematic_intro');
  if (ctx.sceneLoading) reasons.push('scene_loading');
  if (ctx.activeModalBlocking) reasons.push('active_interaction');

  const safeToApplyNow = reasons.length === 0;
  const safeToDownloadInBackground = !ctx.sceneLoading && !ctx.ghostGrabActive;

  return {
    safeToApplyNow,
    safeToDownloadInBackground,
    blockingReasons: reasons,
    summaryMy: safeToApplyNow
      ? 'အပ်ဒိတ်တင်ရန် အဆင်သင့်ဖြစ်ပါသည်'
      : reasons.map((r) => REASON_LABELS_MY[r]).join(' · '),
    summaryEn: safeToApplyNow
      ? 'Safe to apply update now'
      : reasons.map((r) => REASON_LABELS_EN[r]).join('; '),
  };
}

export interface SafeBoundaryApplyResult {
  readonly applied: boolean;
  readonly deferred: boolean;
  readonly safety: UpdateSafetyEvaluation;
  readonly saveFlushed: boolean;
}

export async function runAtSafeUpdateBoundary(
  ctx: UpdateBusyContext,
  flushSaveFn: () => unknown,
  applyFn: () => Promise<void> | void,
): Promise<SafeBoundaryApplyResult> {
  const safety = evaluateUpdateApplySafety(ctx);
  if (!safety.safeToApplyNow) {
    return {
      applied: false,
      deferred: true,
      safety,
      saveFlushed: false,
    };
  }

  let saveFlushed = false;
  try {
    flushSaveFn();
    saveFlushed = true;
  } catch {
    // Save flushing failure should not crash boundary evaluation; proceed safely
  }

  await applyFn();
  return {
    applied: true,
    deferred: false,
    safety,
    saveFlushed,
  };
}
