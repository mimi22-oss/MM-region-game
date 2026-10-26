import { memo } from 'react';
import { Block as Box } from '../../../Primitives.tsx';
import {
  myotharCenterPOIs,
  myotharCenterBuildings,
  type MyotharCenterPOI,
  type MyotharCenterBuildingData,
} from '../../../../data/wards/myothar/center/index.ts';
import { KanbaleRiceMill } from '../../../villages/kanbale/KanbaleRiceMill.tsx';

/**
 * မြို့သာရပ်ကွက် အလယ်ခေါင် အထင်ကရနေရာများ 3D Custom Landmarks
 *
 * ၁။ မြို့သာကျောင်းတိုက် (ဘုန်းတော်ကြီးကျောင်းနှင့် ပြာသာဒ်အမိုးတော်)
 * ၂။ Pyae Phyo Kyaw (PPK) Petrol Station (ဆီဖြည့်ခုံးမကြီး၊ ဆီပန့်များနှင့် ဈေးနှုန်းဆိုင်းဘုတ်)
 * ၃။ OSO ENERGY 4 - PETROL STATION (အစိမ်းရောင်နှင့် အဝါရောင် ခေတ်မီ စက်သုံးဆီဆိုင်)
 * ၄။ ကိုလွင်ဦး (ကားလုပ်ငန်း) (ကားဝပ်ရှော့၊ ကားတင်စင်နှင့် ပြင်ဆင်ရေးရုံ)
 * ၅။ Good Brothers' (GBS) Kalay (လယ်ယာသုံး စက်ကိရိယာ အရောင်းပြခန်း)
 * ၆။ Min Kan Kaung - Restaurant (မင်းကံကောင်း စားသောက်ဆိုင်နှင့် ဥယျာဉ်လက်ဖက်ရည်ဆိုင်)
 * ၇။ လရောင် Mobile (ဖုန်းနှင့် အီလက်ထရောနစ် အရောင်းဆိုင်)
 * ၈။ သိန်းထိုက်စံ ကုန်မာနှင့် အိမ်ဆောက်အရောင်းဆိုင် ဆိုင်ခွဲ (၂)
 * ၉။ နှင်းသဇင် - ကလေး ကုမ္ပဏီ လီမိတက်
 * ၁၀။ ရဲတံခွန် အရောင်းဆိုင်
 * ၁၁။ ဆန်စက် (Rice Mill Complex & Chimney)
 */
export const MyotharCenterLandmarks = memo(function MyotharCenterLandmarks() {
  // POI Lookups
  const monastery = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name === 'မြို့သာကျောင်းတိုက်')!;
  const ppkFuel = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('PPK'))!;
  const osoFuel = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('OSO'))!;
  const workshop = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('ကိုလွင်ဦး'))!;
  const gbs = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('Good Brothers'))!;
  const restaurant = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('Min Kan Kaung'))!;
  const mobileShop = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('လရောင်'))!;
  const hardwareShop = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('သိန်းထိုက်စံ'))!;
  const companyLtd = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('နှင်းသဇင်'))!;
  const yeDagun = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('ရဲတံခွန်'))!;
  const zambuHein = myotharCenterPOIs.find((p: MyotharCenterPOI) => p.name.includes('ဇမ္ဗူဟိန်း'));
  const riceMillBuilding = myotharCenterBuildings.find((b: MyotharCenterBuildingData) => b.id === 'way/403027697');

  return (
    <group name="myothar-center-landmarks">
      {/* ======================================================== */}
      {/* ၁။ မြို့သာကျောင်းတိုက် (Myothar Monastery) */}
      {/* ======================================================== */}
      {monastery && (
        <group position={[monastery.x, 0, monastery.z]}>
          {/* ကျောင်းဝင်း အောက်ခံ ကွန်ကရစ်ခုံ */}
          <Box x={0} y={0.2} z={0} w={24} h={0.4} d={20} color="#c8baa1" />

          {/* ပင်မ ဓမ္မာရုံဆောင်ကြီး (Main Dhamma Hall) */}
          <Box x={0} y={2.5} z={0} w={18} h={4.2} d={14} color="#d4a373" />

          {/* မြန်မာ့ရိုးရာ ကျွန်းတိုင်လုံးကြီးများ (Teak Columns) */}
          {[-7.5, 7.5].map((cx) =>
            [-5.5, 0, 5.5].map((cz) => (
              <Box
                key={`mon-col-${cx}-${cz}`}
                x={cx}
                y={2.2}
                z={cz}
                w={0.5}
                h={4.0}
                d={0.5}
                color="#5c3818"
              />
            ))
          )}

          {/* အမိုး အဆင့် (၁) - Lower Tier */}
          <Box x={0} y={4.8} z={0} w={20} h={0.4} d={16} color="#8c3a2b" />

          {/* အမိုး အဆင့် (၂) - Middle Tier */}
          <Box x={0} y={5.6} z={0} w={15} h={0.35} d={12} color="#7a3225" />

          {/* ပြာသာဒ် အထွတ် အဆင့် (၃) - Pyatthat Tier */}
          <Box x={0} y={6.5} z={0} w={10} h={0.35} d={8} color="#68291d" />

          {/* ရွှေရောင် ထိပ်ဖူးစေတီနှင့် တံခွန်တိုင် (Golden Finial Spire) */}
          <Box x={0} y={7.6} z={0} w={1.2} h={1.8} d={1.2} color="#d4af37" />
          <Box x={0} y={8.7} z={0} w={0.4} h={1.4} d={0.4} color="#ffd700" />

          {/* ကျောင်းတိုက် အဝင်မုခ်ဦး (Monastery Entrance Archway) */}
          <group position={[0, 0, 11]}>
            <Box x={-3} y={2.2} z={0} w={0.8} h={4.4} d={0.8} color="#d4af37" />
            <Box x={3} y={2.2} z={0} w={0.8} h={4.4} d={0.8} color="#d4af37" />
            <Box x={0} y={4.2} z={0} w={7.4} h={1.0} d={1.0} color="#8c3a2b" />
            <Box x={0} y={4.8} z={0} w={4.0} h={0.4} d={0.6} color="#ffd700" />
          </group>

          {/* ခေါင်းလောင်းစင် (Bell Pavilion) */}
          <group position={[10, 0, 8]}>
            <Box x={0} y={0.2} z={0} w={3.5} h={0.4} d={3.5} color="#b0a28f" />
            <Box x={-1.2} y={1.8} z={-1.2} w={0.3} h={3.2} d={0.3} color="#8c3a2b" />
            <Box x={1.2} y={1.8} z={-1.2} w={0.3} h={3.2} d={0.3} color="#8c3a2b" />
            <Box x={-1.2} y={1.8} z={1.2} w={0.3} h={3.2} d={0.3} color="#8c3a2b" />
            <Box x={1.2} y={1.8} z={1.2} w={0.3} h={3.2} d={0.3} color="#8c3a2b" />
            {/* ကြေးခေါင်းလောင်း */}
            <Box x={0} y={2.2} z={0} w={0.9} h={1.2} d={0.9} color="#c59b27" />
            {/* ခေါင်းလောင်းစင် အမိုး */}
            <Box x={0} y={3.6} z={0} w={4.0} h={0.4} d={4.0} color="#8c3a2b" />
          </group>
        </group>
      )}

      {/* ======================================================== */}
      {/* ၂။ Pyae Phyo Kyaw (PPK) Petrol Station */}
      {/* ======================================================== */}
      {ppkFuel && (
        <group position={[ppkFuel.x, 0, ppkFuel.z]}>
          {/* ကွန်ကရစ် အဝင်ကြမ်းခင်း (Forecourt Pavement) */}
          <Box x={0} y={0.08} z={0} w={34} h={0.16} d={26} color="#cfd4d8" />

          {/* ဆီဖြည့် ခုံးမကြီး (Main Canopy) */}
          <group position={[0, 0, 0]}>
            {/* တိုင် ၄ တိုင် (Canopy Columns) */}
            <Box x={-8} y={2.8} z={-4} w={0.9} h={5.6} d={0.9} color="#f8f9fa" />
            <Box x={8} y={2.8} z={-4} w={0.9} h={5.6} d={0.9} color="#f8f9fa" />
            <Box x={-8} y={2.8} z={4} w={0.9} h={5.6} d={0.9} color="#f8f9fa" />
            <Box x={8} y={2.8} z={4} w={0.9} h={5.6} d={0.9} color="#f8f9fa" />

            {/* ခုံးမ အမိုးပြား (Canopy Roof Deck) */}
            <Box x={0} y={5.8} z={0} w={24} h={0.9} d={16} color="#e03131" />
            {/* အပြာရောင် ခါးပတ် (Blue Branding Band) */}
            <Box x={0} y={5.6} z={0} w={24.2} h={0.35} d={16.2} color="#1971c2" />

            {/* ဆီဖြည့် ပန့်ကျွန်း ၄ ခု (Dispenser Pump Islands) */}
            {[-8, 8].map((px) =>
              [-3, 3].map((pz) => (
                <group key={`ppk-pump-${px}-${pz}`} position={[px, 0, pz]}>
                  {/* ကွန်ကရစ်ခုံ */}
                  <Box x={0} y={0.2} z={0} w={1.6} h={0.3} d={3.0} color="#f1f3f5" />
                  {/* ပန့်စက်အိမ် (Dispenser Unit) */}
                  <Box x={0} y={1.2} z={0} w={0.9} h={1.7} d={1.4} color="#343a40" />
                  {/* ဒစ်ဂျစ်တယ် မျက်နှာပြင် */}
                  <Box x={0.46} y={1.4} z={0} w={0.06} h={0.6} d={0.9} color="#74c0fc" />
                  <Box x={-0.46} y={1.4} z={0} w={0.06} h={0.6} d={0.9} color="#74c0fc" />
                </group>
              ))
            )}
          </group>

          {/* စတိုးဆိုင်နှင့် ရုံးခန်း (Station Minimart & Office) */}
          <group position={[0, 0, -10]}>
            <Box x={0} y={1.9} z={0} w={16} h={3.8} d={6} color="#e9ecef" />
            {/* ဆိုင်မျက်နှာစာ မှန်ပြတင်း */}
            <Box x={0} y={1.6} z={3.05} w={12} h={2.2} d={0.1} color="#4dabf7" />
          </group>

          {/* AH1 လမ်းဘေး ဓာတ်ဆီဆိုင် ဈေးနှုန်း တိုင်ဆိုင်းဘုတ်ကြီး (High Totem Price Sign) */}
          <group position={[14, 0, 10]}>
            <Box x={0} y={4.0} z={0} w={0.5} h={8.0} d={0.5} color="#495057" />
            <Box x={0} y={6.2} z={0} w={2.8} h={3.2} d={0.6} color="#c92a2a" />
            <Box x={0} y={6.2} z={0.35} w={2.4} h={1.0} d={0.1} color="#fcc419" />
          </group>
        </group>
      )}

      {/* ======================================================== */}
      {/* ၃။ OSO ENERGY 4 - PETROL STATION */}
      {/* ======================================================== */}
      {osoFuel && (
        <group position={[osoFuel.x, 0, osoFuel.z]} rotation={[0, 2.55, 0]}>
          {/* ကွန်ကရစ် အဝင်ကြမ်းခင်း */}
          <Box x={0} y={0.08} z={0} w={28} h={0.16} d={24} color="#dee2e6" />

          {/* OSO စိမ်း/ဝါ ခေတ်မီ ခုံးမကြီး */}
          <Box x={-6} y={2.7} z={0} w={0.8} h={5.4} d={0.8} color="#2b8a3e" />
          <Box x={6} y={2.7} z={0} w={0.8} h={5.4} d={0.8} color="#2b8a3e" />

          {/* အမိုးခုံးမ (Canopy) */}
          <Box x={0} y={5.6} z={0} w={20} h={0.8} d={14} color="#2f9e44" />
          <Box x={0} y={5.4} z={0} w={20.2} h={0.3} d={14.2} color="#fab005" />

          {/* ဆီပန့်များ */}
          {[-5, 5].map((ox) => (
            <group key={`oso-pump-${ox}`} position={[ox, 0, 0]}>
              <Box x={0} y={0.2} z={0} w={1.5} h={0.3} d={3.2} color="#f8f9fa" />
              <Box x={0} y={1.2} z={0} w={0.8} h={1.7} d={1.5} color="#212529" />
              <Box x={0.42} y={1.3} z={0} w={0.06} h={0.5} d={0.8} color="#fab005" />
            </group>
          ))}

          {/* OSO Energy Totem Signboard */}
          <group position={[11, 0, 9]}>
            <Box x={0} y={3.8} z={0} w={0.4} h={7.6} d={0.4} color="#212529" />
            <Box x={0} y={5.8} z={0} w={2.4} h={3.0} d={0.5} color="#2f9e44" />
            <Box x={0} y={6.6} z={0.28} w={2.0} h={0.8} d={0.08} color="#fab005" />
          </group>
        </group>
      )}

      {/* ======================================================== */}
      {/* ၄။ ကိုလွင်ဦး (ကားလုပ်ငန်း) */}
      {/* ======================================================== */}
      {workshop && (
        <group position={[workshop.x, 0, workshop.z]}>
          {/* ဝပ်ရှော့ ကွန်ကရစ်ပြင် */}
          <Box x={0} y={0.1} z={0} w={22} h={0.2} d={18} color="#adb5bd" />

          {/* သံမဏိ သွပ်မိုးကြီးမားသော ဝပ်ရှော့ရုံ (Steel Truss Garage Bay) */}
          <Box x={0} y={2.6} z={-5} w={18} h={5.0} d={7} color="#495057" />
          <Box x={0} y={5.2} z={-2} w={19} h={0.3} d={13} color="#868e96" />

          {/* ကားမတင်စင် (Hydraulic Vehicle Hoist) */}
          <group position={[-4, 0, 2]}>
            <Box x={-1.2} y={1.5} z={0} w={0.25} h={3.0} d={0.25} color="#339af0" />
            <Box x={1.2} y={1.5} z={0} w={0.25} h={3.0} d={0.25} color="#339af0" />
            <Box x={0} y={1.4} z={0} w={2.6} h={0.15} d={4.2} color="#ffd43b" />
          </group>

          {/* ဘီးတာယာပုံများနှင့် အပိုပစ္စည်းစင် (Tires & Parts) */}
          <group position={[6, 0, 3]}>
            <Box x={0} y={0.5} z={0} w={1.2} h={1.0} d={1.2} color="#1a1a1a" />
            <Box x={1.4} y={0.5} z={0} w={1.2} h={1.0} d={1.2} color="#1a1a1a" />
          </group>

          {/* ဆိုင်းဘုတ် (Workshop Signboard) */}
          <Box x={0} y={4.6} z={4.2} w={7.0} h={1.1} d={0.15} color="#1864ab" />
        </group>
      )}

      {/* ======================================================== */}
      {/* ၅။ Good Brothers' (GBS) Kalay */}
      {/* ======================================================== */}
      {gbs && (
        <group position={[gbs.x, 0, gbs.z]} rotation={[0, 2.37, 0]}>
          {/* Showroom အဆောက်အအုံ */}
          <Box x={0} y={2.2} z={-3} w={20} h={4.4} d={12} color="#f8f9fa" />
          {/* Glass Facade */}
          <Box x={0} y={1.8} z={3.05} w={16} h={2.6} d={0.1} color="#4dabf7" />

          {/* GBS Blue Corporate Branding */}
          <Box x={0} y={4.2} z={3.1} w={18} h={1.1} d={0.15} color="#1c7ed6" />

          {/* ပြသထားသော လယ်ယာသုံး ထွန်စက် (Display Tractor) */}
          <group position={[6, 0, 7]}>
            <Box x={0} y={0.6} z={0} w={2.0} h={1.2} d={3.2} color="#fa5252" />
            <Box x={0} y={1.4} z={-0.4} w={1.6} h={0.9} d={1.6} color="#f8f9fa" />
            {/* ဘီးကြီးများ */}
            <Box x={-1.1} y={0.6} z={-0.8} w={0.4} h={1.2} d={1.2} color="#212529" />
            <Box x={1.1} y={0.6} z={-0.8} w={0.4} h={1.2} d={1.2} color="#212529" />
          </group>
        </group>
      )}

      {/* ======================================================== */}
      {/* ၆။ Min Kan Kaung - Restaurant */}
      {/* ======================================================== */}
      {restaurant && (
        <group position={[restaurant.x, 0, restaurant.z]} rotation={[0, 0.75, 0]}>
          {/* စားသောက်ဆိုင် ပင်မအဆောက်အအုံ */}
          <Box x={0} y={2.0} z={-4} w={16} h={4.0} d={10} color="#d4a373" />
          {/* သစ်သား ဝရံတာ */}
          <Box x={0} y={0.2} z={3} w={18} h={0.4} d={6} color="#8d6e63" />

          {/* ပြင်ပ ထီးနှင့် စားပွဲဝိုင်းများ (Outdoor Dining Tables & Parasols) */}
          {[-4, 0, 4].map((tx) => (
            <group key={`rest-table-${tx}`} position={[tx, 0.4, 3]}>
              <Box x={0} y={0.4} z={0} w={1.2} h={0.8} d={1.2} color="#5c3818" />
              {/* ထီးရိုးနှင့် ထီးအုပ် (Parasol) */}
              <Box x={0} y={1.4} z={0} w={0.08} h={1.6} d={0.08} color="#adb5bd" />
              <Box x={0} y={2.2} z={0} w={2.2} h={0.25} d={2.2} color="#fa5252" />
            </group>
          ))}

          {/* ဆိုင်ဆိုင်းဘုတ် "မင်းကံကောင်း စားသောက်ဆိုင်" */}
          <Box x={0} y={3.8} z={1.1} w={6.5} h={1.0} d={0.15} color="#e67700" />
        </group>
      )}

      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* ဇမ္ဗူဟိန်း လယ်ယာသုံးစက်နှင့်အပိုပစ္စည်း */}
      {/* ======================================================== */}
      {zambuHein && (
        <group position={[zambuHein.x, 0, zambuHein.z]} rotation={[0, -1.01, 0]}>
          {/* အရောင်းပြခန်း ကွန်ကရစ် အောက်ခံပြင် */}
          <Box x={0} y={0.08} z={0} w={24} h={0.16} d={20} color="#cbd5e1" />

          {/* ပင်မ အရောင်းပြခန်းနှင့် သိုလှောင်ရုံကြီး */}
          <Box x={0} y={2.6} z={-4} w={20} h={5.0} d={10} color="#e2e8f0" />
          <Box x={0} y={5.2} z={-4} w={21} h={0.4} d={11} color="#334155" />

          {/* မှန်ပြတင်းပေါက်ကြီးများ (Glass Showroom Display) */}
          <Box x={-4} y={1.8} z={1.05} w={10} h={2.6} d={0.1} color="#38bdf8" />

          {/* ဆိုင်ဆိုင်းဘုတ် "ဇမ္ဗူဟိန်း လယ်ယာသုံးစက်နှင့်အပိုပစ္စည်း" */}
          <Box x={-4} y={4.2} z={1.15} w={11} h={1.1} d={0.15} color="#b91c1c" />
          <Box x={-4} y={3.8} z={1.25} w={10} h={0.2} d={0.08} color="#f59e0b" />

          {/* လယ်ယာသုံး လက်တွန်းထွန်စက် (Power Tiller / Walk-behind Tractor) */}
          <group position={[4.5, 0, 3]}>
            <Box x={0} y={0.7} z={0.5} w={1.2} h={0.8} d={2.2} color="#dc2626" />
            <Box x={0} y={1.2} z={-0.6} w={1.4} h={0.1} d={1.4} color="#1e293b" />
            <Box x={-0.7} y={0.5} z={0.6} w={0.25} h={1.0} d={1.0} color="#0f172a" />
            <Box x={0.7} y={0.5} z={0.6} w={0.25} h={1.0} d={1.0} color="#0f172a" />
          </group>

          {/* စက်အပိုပစ္စည်း စင်များနှင့် ဘီးတာယာများ (Spare Parts & Implement Attachments) */}
          <group position={[7, 0, -2]}>
            <Box x={0} y={0.8} z={0} w={1.8} h={1.6} d={3.0} color="#475569" />
            <Box x={0} y={1.8} z={0} w={1.6} h={0.2} d={2.8} color="#94a3b8" />
            <Box x={-0.2} y={2.2} z={0} w={0.8} h={0.6} d={2.2} color="#d97706" />
          </group>
        </group>
      )}

      {/* ======================================================== */}
      {/* ၇။ လရောင် Mobile */}
      {/* ======================================================== */}
      {mobileShop && (
        <group position={[mobileShop.x, 0, mobileShop.z]} rotation={[0, -0.69, 0]}>
          <Box x={0} y={2.4} z={0} w={12} h={4.8} d={10} color="#f1f3f5" />
          {/* Glass Storefront */}
          <Box x={0} y={1.8} z={5.05} w={9} h={2.6} d={0.1} color="#339af0" />
          {/* လရောင် Mobile Billboard */}
          <Box x={0} y={4.2} z={5.1} w={10} h={1.3} d={0.18} color="#7950f2" />
        </group>
      )}

      {/* ======================================================== */}
      {/* ၈။ သိန်းထိုက်စံ ကုန်မာနှင့် အိမ်ဆောက်အရောင်းဆိုင် ဆိုင်ခွဲ (၂) */}
      {/* ======================================================== */}
      {hardwareShop && (
        <group position={[hardwareShop.x, 0, hardwareShop.z]}>
          <Box x={0} y={2.2} z={-2} w={15} h={4.4} d={11} color="#ced4da" />
          {/* သွပ်မိုးကြီး */}
          <Box x={0} y={4.6} z={-2} w={16.5} h={0.4} d={12.5} color="#495057" />
          {/* စတိုသိုလှောင်ရုံ သစ်သားနှင့် ဘိလပ်မြေပုံများ */}
          <Box x={-5} y={0.8} z={5} w={2.5} h={1.4} d={3.0} color="#a67c52" />
          <Box x={-1.5} y={0.6} z={5} w={2.8} h={1.0} d={2.5} color="#868e96" />
          {/* ဆိုင်းဘုတ် (Blue Signboard) */}
          <Box x={0} y={4.0} z={3.6} w={7.5} h={1.1} d={0.15} color="#1864ab" />
        </group>
      )}

      {/* ======================================================== */}
      {/* ၉။ နှင်းသဇင် - ကလေး ကုမ္ပဏီ လီမိတက် */}
      {/* ======================================================== */}
      {companyLtd && (
        <group position={[companyLtd.x, 0, companyLtd.z]} rotation={[0, 2.42, 0]}>
          <Box x={0} y={3.0} z={0} w={14} h={6.0} d={12} color="#f8f9fa" />
          {/* ပြတင်းပေါက်တန်း */}
          <Box x={0} y={2.0} z={6.05} w={10} h={1.8} d={0.1} color="#4dabf7" />
          <Box x={0} y={4.4} z={6.05} w={10} h={1.8} d={0.1} color="#4dabf7" />
          {/* ဆိုင်းဘုတ် */}
          <Box x={0} y={5.6} z={6.1} w={9.0} h={1.0} d={0.15} color="#0ca678" />
        </group>
      )}

      {/* ======================================================== */}
      {/* ၁၀။ ရဲတံခွန် */}
      {/* ======================================================== */}
      {yeDagun && (
        <group position={[yeDagun.x, 0, yeDagun.z]} rotation={[0, -0.83, 0]}>
          <Box x={0} y={2.2} z={0} w={11} h={4.4} d={9} color="#e9ecef" />
          <Box x={0} y={1.6} z={4.55} w={8} h={2.2} d={0.1} color="#74c0fc" />
          <Box x={0} y={3.8} z={4.6} w={6.5} h={1.0} d={0.15} color="#d6336c" />
        </group>
      )}

      {/* ======================================================== */}
      {/* ၁၁။ ဆန်စက် (Rice Mill Complex & Chimney) */}
      {/* ======================================================== */}
      {riceMillBuilding && (
        <KanbaleRiceMill building={riceMillBuilding as any} />
      )}
    </group>
  );
});
