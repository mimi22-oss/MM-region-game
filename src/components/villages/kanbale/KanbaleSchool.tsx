import { memo } from 'react';
import { Block as Box } from '../../Primitives.tsx';
import type { KanbaleBuildingData } from '../../../data/villages/kanbale';

export interface KanbaleSchoolProps {
  building: KanbaleBuildingData;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/**
 * ကံပုလဲရွာ အခြေခံပညာကျောင်း (Kanbale Village Primary School)
 *
 * အင်္ဂါရပ်များ:
 * ၁။ စာသင်ဆောင် ၃ ဆောင် (Three Classroom Halls):
 *    - ပင်မ စာသင်ဆောင်ကြီး (Main Classroom Hall with Porch & Signboard)
 *    - လက်ဝဲဘက် စာသင်ဆောင် (Left Classroom Wing)
 *    - လက်ယာဘက် စာသင်ဆောင် (Right Classroom Wing)
 * ၂။ အလယ်တွင် အလံအလေးပြုသည့်နေရာ (Assembly Plaza & National Flagpole):
 *    - ကွန်ကရစ် အဆင့်ဆင့်ခုံ၊ ငွေရောင်အလံတိုင်ရှည်နှင့် မြန်မာနိုင်ငံတော်အလံ
 *    - ကျောင်းသား/သူများ တန်းစီရန် ကွင်းပြင်
 * ၃။ အရှေ့ထိပ်တွင် ဘောလုံးကွင်း (School Football Field):
 *    - မြက်ခင်းစိမ်း ဘောလုံးကွင်း၊ အဖြူရောင်မျဉ်းများ၊ အလယ်စက်ဝိုင်း
 *    - အဖြူရောင် သံပိုက် ဂိုးတိုင် ၂ စုံ (Goalposts with Nets)
 *    - ထောင့်အလံတိုင်များ (Corner Flags)
 */
export const KanbaleSchool = memo(function KanbaleSchool({
  building,
  selected = false,
  onSelect,
}: KanbaleSchoolProps) {
  const rot = building.rotation || 2.4226;

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect?.(building.id);
  };

  const wallColor = selected ? '#fef08a' : '#f8fafc';
  const roofColor = selected ? '#38bdf8' : '#1b4332'; // Classic Myanmar School Emerald Green

  return (
    <group
      position={[building.x, 0, building.z]}
      rotation={[0, rot, 0]}
      name="kanbale-custom-school"
      onClick={handleClick}
      userData={{
        id: building.id,
        osmId: building.osmId,
        custom: true,
        name: 'ကံပုလဲကျောင်း',
      }}
    >
      {/* ======================================================== */}
      {/* ၀။ ကျောင်းဝင်း ပတ်လည် မြေခင်း (School Compound Ground) */}
      {/* ======================================================== */}
      <Box x={6} y={0.03} z={-16} w={42} h={0.06} d={46} color="#d1d5db" walkable={true} />

      {/* ======================================================== */}
      {/* ၁။ ပင်မ စာသင်ဆောင်ကြီး (Main Classroom Hall) */}
      {/* ======================================================== */}
      <group position={[0, 0, 0]}>
        {/* အောက်ခံ ကွန်ကရစ်ခုံ */}
        <Box x={0} y={0.2} z={0} w={27} h={0.4} d={10} color="#e2e8f0" walkable={true} />

        {/* ပင်မနံရံများ */}
        <Box x={0} y={2.1} z={0} w={25} h={3.4} d={8.4} color={wallColor} />

        {/* အမိုးကြီး (Emerald Green Gable Roof with Eaves) */}
        <Box x={0} y={4.3} z={0} w={26.6} h={0.45} d={9.8} color={roofColor} />
        <Box x={0} y={5.0} z={0} w={23.5} h={1.0} d={7.2} color={roofColor} />
        <Box x={0} y={5.7} z={0} w={20.0} h={0.5} d={4.8} color={roofColor} />

        {/* မျက်နှာစာ ဝရန်တာ တိုင်လုံးဖြူများ (Front Veranda Colonnade) */}
        {[-11, -7.5, -4, 0, 4, 7.5, 11].map((colX) => (
          <Box key={`main-col-${colX}`} x={colX} y={2.0} z={-4.4} w={0.4} h={3.2} d={0.4} color="#ffffff" />
        ))}

        {/* ဝရန်တာ အမိုးစွန်း (Porch Eave) */}
        <Box x={0} y={3.8} z={-4.5} w={25.4} h={0.25} d={1.4} color={roofColor} />

        {/* ပြတင်းပေါက်တန်းများ (Louvered Classroom Windows) */}
        {[-9, -5.5, -2, 2, 5.5, 9].map((winX) => (
          <group key={`main-win-${winX}`}>
            <Box x={winX} y={2.1} z={-4.22} w={1.6} h={1.8} d={0.08} color="#0284c7" />
            <Box x={winX} y={2.1} z={-4.24} w={1.75} h={0.08} d={0.12} color="#ffffff" />
          </group>
        ))}

        {/* အလယ် အဝင်မုခ်ဦးနှင့် ကျောင်းဆိုင်းဘုတ်ကြီး (Central Entrance & School Signboard) */}
        <group position={[0, 0, -4.6]}>
          <Box x={0} y={2.0} z={0} w={2.4} h={3.2} d={0.1} color="#0f172a" />
          {/* Signboard Panel */}
          <Box x={0} y={4.2} z={-0.1} w={12.0} h={1.1} d={0.16} color="#14532d" />
          {/* Signboard Gold Trim Frame */}
          <Box x={0} y={4.2} z={-0.12} w={12.2} h={1.25} d={0.06} color="#d97706" />
          {/* Inner Text Band */}
          <Box x={0} y={4.2} z={-0.2} w={11.2} h={0.75} d={0.04} color="#fef08a" />
        </group>
      </group>

      {/* ======================================================== */}
      {/* ၂။ လက်ဝဲဘက် စာသင်ဆောင် (Left Classroom Wing) */}
      {/* ======================================================== */}
      <group position={[-8.5, 0, -7]}>
        {/* အောက်ခံခုံ */}
        <Box x={0} y={0.18} z={0} w={7.6} h={0.36} d={11} color="#e2e8f0" walkable={true} />
        {/* နံရံ */}
        <Box x={0} y={1.9} z={0} w={6.8} h={3.1} d={10} color={wallColor} />
        {/* အမိုး */}
        <Box x={0} y={3.8} z={0} w={7.8} h={0.4} d={11} color={roofColor} />
        <Box x={0} y={4.4} z={0} w={5.8} h={0.8} d={9.5} color={roofColor} />
        {/* ပြတင်းပေါက်များ (Windows facing courtyard) */}
        {[-3, 0, 3].map((wZ) => (
          <Box key={`left-win-${wZ}`} x={3.42} y={1.9} z={wZ} w={0.08} h={1.5} d={1.4} color="#0284c7" />
        ))}
        {/* အဝင်တံခါး */}
        <Box x={3.42} y={1.4} z={-4.5} w={0.1} h={2.2} d={1.4} color="#334155" />
      </group>

      {/* ======================================================== */}
      {/* ၃။ လက်ယာဘက် စာသင်ဆောင် (Right Classroom Wing) */}
      {/* ======================================================== */}
      <group position={[14, 0, -7]}>
        {/* အောက်ခံခုံ */}
        <Box x={0} y={0.18} z={0} w={7.6} h={0.36} d={11} color="#e2e8f0" walkable={true} />
        {/* နံရံ */}
        <Box x={0} y={1.9} z={0} w={6.8} h={3.1} d={10} color={wallColor} />
        {/* အမိုး */}
        <Box x={0} y={3.8} z={0} w={7.8} h={0.4} d={11} color={roofColor} />
        <Box x={0} y={4.4} z={0} w={5.8} h={0.8} d={9.5} color={roofColor} />
        {/* ပြတင်းပေါက်များ (Windows facing courtyard) */}
        {[-3, 0, 3].map((wZ) => (
          <Box key={`right-win-${wZ}`} x={-3.42} y={1.9} z={wZ} w={0.08} h={1.5} d={1.4} color="#0284c7" />
        ))}
        {/* အဝင်တံခါး */}
        <Box x={-3.42} y={1.4} z={-4.5} w={0.1} h={2.2} d={1.4} color="#334155" />
      </group>

      {/* ======================================================== */}
      {/* ၄။ အလယ်တွင် အလံအလေးပြုသည့်နေရာ (Flag Ceremony Plaza) */}
      {/* ======================================================== */}
      <group position={[2.5, 0, -8]}>
        {/* Plaza Paved Ground (Walkable Assembly Ground) */}
        <Box x={0} y={0.06} z={0} w={12} h={0.1} d={9} color="#cbd5e1" walkable={true} />

        {/* Parade Assembly March Lines */}
        {[-3, -1, 1, 3].map((lineX) => (
          <Box key={`parade-line-${lineX}`} x={lineX} y={0.12} z={1.5} w={0.12} h={0.02} d={4.5} color="#ffffff" />
        ))}

        {/* Stepped Flagpole Base Podium (3-Tiered Plinth) */}
        <group position={[0, 0, -2.5]}>
          <Box x={0} y={0.2} z={0} w={3.2} h={0.3} d={3.2} color="#dc2626" />
          <Box x={0} y={0.42} z={0} w={2.4} h={0.25} d={2.4} color="#ffffff" />
          <Box x={0} y={0.62} z={0} w={1.6} h={0.2} d={1.6} color="#dc2626" />

          {/* Stainless Steel Flagpole Mast (11m High) */}
          <Box x={0} y={6.2} z={0} w={0.16} h={11.0} d={0.16} color="#e2e8f0" />
          {/* Golden Finial Sphere on Mast Peak */}
          <Box x={0} y={11.8} z={0} w={0.45} h={0.45} d={0.45} color="#eab308" />

          {/* Republic of the Union of Myanmar Flag (Yellow, Green, Red + White Star) */}
          <group position={[1.4, 10.4, 0]}>
            {/* Top Stripe: Yellow */}
            <Box x={0} y={0.6} z={0} w={2.6} h={0.5} d={0.03} color="#facc15" />
            {/* Middle Stripe: Green */}
            <Box x={0} y={0.1} z={0} w={2.6} h={0.5} d={0.03} color="#16a34a" />
            {/* Bottom Stripe: Red */}
            <Box x={0} y={-0.4} z={0} w={2.6} h={0.5} d={0.03} color="#dc2626" />
            {/* Large Centered 5-Point White Star Emissary */}
            <Box x={0} y={0.1} z={0.03} w={0.65} h={0.65} d={0.02} color="#ffffff" />
          </group>
        </group>
      </group>

      {/* ======================================================== */}
      {/* ၅။ အရှေ့ထိပ်တွင် ဘောလုံးကွင်း (School Football Field) */}
      {/* ======================================================== */}
      <group position={[15, 0, -26]}>
        {/* Lush Green Turf Pitch (24m x 15m, Walkable) */}
        <Box x={0} y={0.05} z={0} w={15} h={0.08} d={22} color="#2d6a4f" walkable={true} />

        {/* Pitch Boundary Chalk Lines (White) */}
        {/* Outer Touchlines (Sides) */}
        <Box x={-7.2} y={0.1} z={0} w={0.16} h={0.02} d={21.6} color="#f8fafc" />
        <Box x={7.2} y={0.1} z={0} w={0.16} h={0.02} d={21.6} color="#f8fafc" />
        {/* Goal Lines (North & South Ends) */}
        <Box x={0} y={0.1} z={-10.7} w={14.4} h={0.02} d={0.16} color="#f8fafc" />
        <Box x={0} y={0.1} z={10.7} w={14.4} h={0.02} d={0.16} color="#f8fafc" />
        {/* Halfway Line */}
        <Box x={0} y={0.1} z={0} w={14.4} h={0.02} d={0.16} color="#f8fafc" />
        {/* Center Kickoff Circle */}
        <Box x={0} y={0.1} z={0} w={3.6} h={0.02} d={3.6} color="#f8fafc" />
        <Box x={0} y={0.11} z={0} w={3.2} h={0.02} d={3.2} color="#2d6a4f" />
        {/* Center Kickoff Spot */}
        <Box x={0} y={0.12} z={0} w={0.4} h={0.02} d={0.4} color="#ffffff" />

        {/* Penalty Boxes */}
        {/* South Goal Penalty Area */}
        <Box x={0} y={0.1} z={8.5} w={6.0} h={0.02} d={0.14} color="#f8fafc" />
        <Box x={-3.0} y={0.1} z={9.6} w={0.14} h={0.02} d={2.2} color="#f8fafc" />
        <Box x={3.0} y={0.1} z={9.6} w={0.14} h={0.02} d={2.2} color="#f8fafc" />

        {/* North Goal Penalty Area */}
        <Box x={0} y={0.1} z={-8.5} w={6.0} h={0.02} d={0.14} color="#f8fafc" />
        <Box x={-3.0} y={0.1} z={-9.6} w={0.14} h={0.02} d={2.2} color="#f8fafc" />
        <Box x={3.0} y={0.1} z={-9.6} w={0.14} h={0.02} d={2.2} color="#f8fafc" />

        {/* Goalpost 1 (South End, facing north) */}
        <group position={[0, 0, 10.7]}>
          {/* Crossbar */}
          <Box x={0} y={2.2} z={0} w={3.4} h={0.12} d={0.12} color="#ffffff" />
          {/* Uprights */}
          <Box x={-1.7} y={1.1} z={0} w={0.12} h={2.2} d={0.12} color="#ffffff" />
          <Box x={1.7} y={1.1} z={0} w={0.12} h={2.2} d={0.12} color="#ffffff" />
          {/* Net Mesh Box */}
          <Box x={0} y={1.1} z={0.5} w={3.3} h={2.1} d={0.9} color="#e2e8f0" />
        </group>

        {/* Goalpost 2 (North End, facing south) */}
        <group position={[0, 0, -10.7]}>
          {/* Crossbar */}
          <Box x={0} y={2.2} z={0} w={3.4} h={0.12} d={0.12} color="#ffffff" />
          {/* Uprights */}
          <Box x={-1.7} y={1.1} z={0} w={0.12} h={2.2} d={0.12} color="#ffffff" />
          <Box x={1.7} y={1.1} z={0} w={0.12} h={2.2} d={0.12} color="#ffffff" />
          {/* Net Mesh Box */}
          <Box x={0} y={1.1} z={-0.5} w={3.3} h={2.1} d={0.9} color="#e2e8f0" />
        </group>

        {/* Corner Flags */}
        {[
          [-7.2, -10.7],
          [7.2, -10.7],
          [-7.2, 10.7],
          [7.2, 10.7],
        ].map(([cx, cz], i) => (
          <group key={`cflag-${i}`} position={[cx, 0, cz]}>
            {/* Pole */}
            <Box x={0} y={0.75} z={0} w={0.06} h={1.5} d={0.06} color="#fde047" />
            {/* Red Pennant */}
            <Box x={0.15} y={1.35} z={0} w={0.3} h={0.25} d={0.02} color="#ef4444" />
          </group>
        ))}
      </group>
    </group>
  );
});
