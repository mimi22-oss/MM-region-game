import { memo, type ReactNode } from 'react';
import { MyotharWardPlan, KalayArea1Plan } from './wards';
import { TharSiVillagePlan, ChinSaiVillagePlan, ZingalinVillagePlan, HtomarVillagePlan, TharYarGoneVillagePlan, HtaukKyantVillagePlan, KyarInnVillagePlan, SiTharPlan, KanbalePlan, NatmyaungPlan } from './villages';

/** Read-only existing SVG world plan. Editor overlay features render above this layer. */
export const ExistingRegionPlan = memo(function ExistingRegionPlan({region}:{region:string}) {
 const common={labels:true};
 const plans:Record<string,ReactNode>={
  myotha:<MyotharWardPlan {...common}/>,
  myothar:<MyotharWardPlan {...common}/>,
  'kalay-area-1':<KalayArea1Plan {...common}/>,
  tharsi:<TharSiVillagePlan {...common}/>,
  chinsai:<ChinSaiVillagePlan {...common}/>,
  zingalin:<ZingalinVillagePlan {...common}/>,
  htomar:<HtomarVillagePlan {...common}/>,
  tharyargone:<TharYarGoneVillagePlan {...common}/>,
  htaukkyant:<HtaukKyantVillagePlan {...common}/>,
  kyarinn:<KyarInnVillagePlan {...common}/>,
  sitha:<SiTharPlan {...common}/>,
  sithar:<SiTharPlan {...common}/>,
  kanbale:<KanbalePlan {...common}/>,
  natmyaung:<NatmyaungPlan {...common}/>
 };
 return <g aria-label="Existing world plan (reference)" pointerEvents="none">{plans[region]??null}</g>;
});
