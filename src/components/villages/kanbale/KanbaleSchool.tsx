import { memo } from 'react';
import { Block as Box } from '../../Primitives.tsx';
import { SchoolClassroomHall } from '../../SchoolClassroomHall.tsx';
import { SchoolFlagpole } from '../../SchoolCampusView.tsx';
import { WALKIN_SCHOOL_HALL_BY_ID } from '../../../game/schoolClassrooms.ts';
import type { KanbaleBuildingData } from '../../../data/villages/kanbale';

export interface KanbaleSchoolProps {
  building: KanbaleBuildingData;
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** Standalone asset preview only; in the live world, classroom halls are pooled via `<PooledSchoolHalls>`. */
  previewMode?: boolean;
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
  previewMode = false,
}: KanbaleSchoolProps) {
  const rot = building.rotation || 2.4226;

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect?.(building.id);
  };

  const mainHallSpec = WALKIN_SCHOOL_HALL_BY_ID.get('kanbale-school-main-hall')!;
  const leftWingSpec = WALKIN_SCHOOL_HALL_BY_ID.get('kanbale-school-left-wing')!;
  const rightWingSpec = WALKIN_SCHOOL_HALL_BY_ID.get('kanbale-school-right-wing')!;

  return (
    <group name="kanbale-custom-school-root">
      {/* In live world, halls are rendered via Fixed Object Pool (`<PooledSchoolHalls>`); previewMode keeps Asset3DRenderer intact */}
      {previewMode && (
        <>
          <SchoolClassroomHall spec={mainHallSpec} selected={selected} onClick={handleClick} />
          <SchoolClassroomHall spec={leftWingSpec} selected={selected} onClick={handleClick} />
          <SchoolClassroomHall spec={rightWingSpec} selected={selected} onClick={handleClick} />
        </>
      )}

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
        <Box x={2.5} y={0.03} z={-16} w={46} h={0.06} d={48} color="#d1d5db" walkable={true} />

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

        {/* Shared Singleton Stepped Flagpole Base Podium & Myanmar Flag */}
        <SchoolFlagpole name="kanbale-school-flagpole" x={0} z={-2.5} rotation={0} />
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
    </group>
  );
});
