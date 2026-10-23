import type { VillageMeta } from '../types.ts';

/**
 * ကလေးမြို့နယ်အတွင်းရှိ ကျေးရွာများ (Villages) စုစည်းမှု။
 *
 * ကျေးရွာအသစ် တစ်ခု ထပ်ထည့်လိုပါက -
 * ၁။ `src/data/villages/<village-name>/index.ts` (နှင့် လိုအပ်ပါက `area1.ts`, `area2.ts` စသည့် နယ်မြေ/ရွာပိုင်းဖိုင်များ) ဆောက်ပါ။
 * ၂။ `src/components/villages/<village-name>/index.tsx` တွင် 3D နှင့် 2D Map Plan component ဆောက်ပါ။
 * ၃။ ဤ `kalayVillages` array တွင် ထည့်သွင်းချိတ်ဆက်ပါ။
 */
export const kalayVillages: VillageMeta[] = [];

