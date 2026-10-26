import { memo } from 'react';
import { Block } from '../../Primitives';
import type { KanbaleBuildingData } from '../../../data/villages/kanbale';

export interface KanbaleRiceMillProps {
  building: KanbaleBuildingData;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/**
 * ကံပုလဲရွာ ဆန်စက် (Kanbale Rice Mill Model)
 * OSM Building ID `way/403027697` အတွက် သီးသန့် အသေးစိတ် တည်ဆောက်ထားသော Custom 3D Component ဖြစ်သည်။
 *
 * အင်္ဂါရပ်များ:
 * - ပင်မ ဆန်ကြိတ်ခွဲရေး စက်ရုံကြီး (Main Milling & Processing Hall)
 * - စပါးလှန်းပြင်နှင့် ကွန်ကရစ် အဝင်ခြံဝင်း (Forecourt Pavement & Paddy Drying Yard)
 * - ဆန်စက် မီးခိုးခေါင်းတိုင်ကြီး (Industrial Boiler Exhaust Chimney)
 * - စပါးသွန်းကျင်းနှင့် သယ်ယူစက်ခုံး (Grain Intake Hopper & Bucket Elevator)
 * - သိုလှောင်ထားသော ဆန်အိတ်/စပါးအိတ်ပုံများ (Stacked Rice & Paddy Burlap Sacks)
 * - ဖွဲနု/ဖွဲကြမ်း သိုလှောင်ရုံခွဲ (Chaff & Rice Husk Storage Bay)
 * - "ဆန်စက်" ပင်မဆိုင်းဘုတ်ကြီး (Prominent Rice Mill Signboard)
 */
export const KanbaleRiceMill = memo(function KanbaleRiceMill({
  building,
  selected = false,
  onSelect,
}: KanbaleRiceMillProps) {
  // Rotated to align with the access road on the west
  const rot = building.rotation || 2.88;

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect?.(building.id);
  };

  const wallColor = selected ? '#fef08a' : '#c8ba9d';
  const roofColor = selected ? '#38bdf8' : '#475569';

  return (
    <group
      position={[building.x, 0, building.z]}
      rotation={[0, rot, 0]}
      name="kanbale-custom-rice-mill"
      onClick={handleClick}
      userData={{
        id: building.id,
        osmId: building.osmId,
        custom: true,
        name: 'ဆန်စက်',
      }}
    >
      {/* ======================================================== */}
      {/* ၁။ စပါးလှန်းပြင်နှင့် ကွန်ကရစ် အောက်ခံခုံ (Concrete Drying Yard) */}
      {/* ======================================================== */}
      <Block x={0} y={0.08} z={0} w={32} h={0.16} d={30} color="#cbd5e1" walkable={true} />

      {/* ======================================================== */}
      {/* ၂။ ပင်မ ဆန်ကြိတ်ခွဲရေး စက်ရုံဆောင်ကြီး (Main Milling Hall) */}
      {/* ======================================================== */}
      {/* စက်ရုံ ပင်မနံရံများ */}
      <Block x={-1} y={3.2} z={-2} w={22} h={6.2} d={18} color={wallColor} />

      {/* ပင်မ သွပ်မိုးကြီး (Gabled Industrial Roof) */}
      <Block x={-1} y={6.5} z={-2} w={23.5} h={0.5} d={19.5} color={roofColor} />

      {/* အမိုးခေါင် အငွေ့ထွက် လေဝင်လေထွက်ဆောင် (Roof Monitor / Clerestory) */}
      <group position={[-1, 7.3, -2]}>
        <Block x={0} y={0.5} z={0} w={12} h={1.0} d={10} color="#334155" />
        <Block x={0} y={1.1} z={0} w={13} h={0.25} d={11} color="#1e293b" />
      </group>

      {/* ======================================================== */}
      {/* ၃။ စက်ရုံ မီးခိုးခေါင်းတိုင်ကြီး (Industrial Smokestack / Chimney) */}
      {/* ======================================================== */}
      <group position={[11, 0, -8]}>
        {/* မီးဖိုအောက်ခံ အုတ်ခုံ (Furnace Base) */}
        <Block x={0} y={1.2} z={0} w={3.4} h={2.4} d={3.4} color="#8c3a2b" />
        {/* ခေါင်းတိုင်လုံး (Tall Steel Stack) */}
        <mesh position={[0, 7.0, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.95, 10, 16]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* ခေါင်းတိုင် ထိပ်ပိုင်း အနီ/အဝါ အချက်ပြကွင်းများ */}
        <mesh position={[0, 11.2, 0]}>
          <cylinderGeometry args={[0.72, 0.72, 0.8, 16]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <mesh position={[0, 10.2, 0]}>
          <cylinderGeometry args={[0.75, 0.75, 0.8, 16]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      </group>

      {/* ======================================================== */}
      {/* ၄။ စပါးသွန်းကျင်းနှင့် သယ်ယူစက် (Paddy Hopper & Bucket Elevator) */}
      {/* ======================================================== */}
      <group position={[-12.5, 0, 1]}>
        {/* စပါးသွန်းကျင်း ကွန်ကရစ်ဘောင် */}
        <Block x={0} y={0.5} z={0} w={3.5} h={1.0} d={4.0} color="#94a3b8" />
        {/* စပါးပုံ (Paddy Grain in Hopper) */}
        <Block x={0} y={0.8} z={0} w={2.8} h={0.4} d={3.2} color="#d97706" />
        {/* ဒေါင်လိုက် စပါးတင်စက် (Vertical Bucket Elevator Column) */}
        <mesh position={[1.4, 4.2, 0]}>
          <boxGeometry args={[0.9, 7.8, 0.9]} />
          <meshStandardMaterial color="#475569" metalness={0.5} />
        </mesh>
      </group>

      {/* ======================================================== */}
      {/* ၅။ ဆန်အိတ်နှင့် စပါးအိတ် သိုလှောင်ပုံများ (Stacked Rice Sacks) */}
      {/* ======================================================== */}
      <group position={[-6, 0, 8]}>
        {/* ဆန်အိတ် အဆင့်ဆင့် ပုံထားခြင်း */}
        <Block x={0} y={0.4} z={0} w={4.2} h={0.8} d={2.6} color="#d4a373" />
        <Block x={0} y={1.1} z={0} w={3.6} h={0.7} d={2.2} color="#c2956c" />
        <Block x={0} y={1.7} z={0} w={2.8} h={0.6} d={1.8} color="#d4a373" />
      </group>

      <group position={[4, 0, 8.5]}>
        <Block x={0} y={0.45} z={0} w={4.8} h={0.9} d={2.4} color="#c2956c" />
        <Block x={0} y={1.25} z={0} w={4.0} h={0.8} d={2.0} color="#d4a373" />
      </group>

      {/* ======================================================== */}
      {/* ၆။ ဖွဲနု/ဖွဲကြမ်း သိုလှောင်ရုံ အဖီ (Husk & Bran Lean-to Shed) */}
      {/* ======================================================== */}
      <group position={[11, 0, 2]}>
        <Block x={0} y={2.0} z={0} w={4.5} h={4.0} d={10} color="#9ca3af" />
        <Block x={0} y={4.1} z={0} w={5.0} h={0.3} d={10.5} color="#475569" />
        {/* ဖွဲနုပုံ (Rice Bran Pile) */}
        <Block x={-0.4} y={0.5} z={0} w={2.8} h={1.0} d={6.0} color="#eab308" />
      </group>

      {/* ======================================================== */}
      {/* ၇။ ဆန်စက် ပင်မဆိုင်းဘုတ်ကြီး (Main "ဆန်စက်" Signboard) */}
      {/* ======================================================== */}
      <group position={[-1, 5.2, 7.2]}>
        {/* ဆိုင်းဘုတ် အောက်ခံဘောင် အနီရောင် (Red Corporate Mill Board) */}
        <Block x={0} y={0} z={0} w={9.5} h={1.6} d={0.2} color="#b91c1c" />
        {/* ရွှေဝါရောင် ကွပ်ထားသော ဘောင်လိုင်း */}
        <Block x={0} y={0} z={0.12} w={9.2} h={1.3} d={0.06} color="#f59e0b" />
        {/* အတွင်း အပြာရောင်စာသားပြား */}
        <Block x={0} y={0} z={0.16} w={8.6} h={0.95} d={0.04} color="#1e3a8a" />
        {/* အဖြူရောင် စာသားအတုံးများ (Symbolic Burmese Text Blocks) */}
        <Block x={-2.4} y={0} z={0.2} w={1.2} h={0.5} d={0.05} color="#ffffff" />
        <Block x={-0.8} y={0} z={0.2} w={1.2} h={0.5} d={0.05} color="#ffffff" />
        <Block x={0.8} y={0} z={0.2} w={1.2} h={0.5} d={0.05} color="#ffffff" />
        <Block x={2.4} y={0} z={0.2} w={1.2} h={0.5} d={0.05} color="#ffffff" />
      </group>

      {/* လမ်းဘေး အဝင် တိုင်ဆိုင်းဘုတ်ငယ် (Roadside Signboard Pole) */}
      <group position={[-14, 0, 11]}>
        <Block x={0} y={1.8} z={0} w={0.25} h={3.6} d={0.25} color="#334155" />
        <Block x={0} y={2.9} z={0} w={3.2} h={1.2} d={0.15} color="#b91c1c" />
        <Block x={0} y={2.9} z={0.09} w={2.9} h={0.9} d={0.05} color="#f59e0b" />
      </group>
    </group>
  );
});
