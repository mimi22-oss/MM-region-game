import { memo } from 'react';
import { ImportedGableRoof } from '../../../ImportedGableRoof.tsx';
import type { MyotharCenterBuildingData } from '../../../../data/wards/myothar/center/index.ts';
import { Block as Box } from '../../../Primitives.tsx';
import { CandleRow, PorchCandles } from '../../../FestivalAnchor.tsx';

export interface MyotharCenterBuildingProps {
  building: MyotharCenterBuildingData;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/**
 * မြို့သာရပ်ကွက် အလယ်ခေါင် အဆောက်အအုံနှင့် ခြံဝန်း 3D Model
 *
 * မြို့သာရပ်ကွက် နယ်မြေ (၅) စတိုင်အတိုင်း သပ်ရပ်သော ခြံဝန်းနှင့် အိမ်များ:
 * ၁။ ခြံဝန်းမြေခင်း (Compound Ground Plinth - Sand/Gravel Yard)
 * ၂။ မျက်နှာစာ သွပ်ပြားခြံစည်းရိုးနှင့် အဝင်ဂိတ်ပေါက် (Front Sheet Fence & Entrance Gate with Posts)
 * ၃။ လက်ဝဲ/လက်ယာ ဘေးခြံစည်းရိုး (Side Wire Mesh Fences)
 * ၄။ အနောက်ဘက် ခြံစည်းရိုး (Back Fence)
 * ၅။ အိမ်ရှေ့ လူသွားလမ်း (Front Walkway Path)
 * ၆။ ပင်မအိမ်ကြီး (Base Plinth, Pitched Gable Roof, Cornice Trim, Windows & Front Veranda)
 * ၇။ သီတင်းကျွတ် ဖရောင်းတိုင် မီးညွှန့်များ (Candle Rows on Fence & Porch)
 */
export const MyotharCenterBuilding = memo(function MyotharCenterBuilding({
  building,
  selected = false,
  onSelect,
}: MyotharCenterBuildingProps) {
  const w = building.houseWidth || 5.0;
  const d = building.houseLength || 6.2;
  const isTwoStorey = building.area >= 70;
  const wallH = building.wallHeight;
  const pitchH = Math.min(building.roofHeight, w * .4);

  // Compound & fence bounds (Area 5 style)
  const sideHalf = building.fenceSideHalf || (building.compoundWidth ? building.compoundWidth / 2 : w / 2 + 1.4);
  const backHalf = building.fenceBackHalf || d / 2 + 1.2;
  const frontHalf = building.fenceFrontHalf || d / 2 + 2.4;
  const fenceW = sideHalf * 2;
  const fenceD = backHalf + frontHalf;
  const fenceCenterZ = (frontHalf - backHalf) / 2;
  const gateW = building.gateWidth || 2.4;
  const halfGate = gateW / 2;
  const houseZ = building.houseZOffset ?? -0.6;

  const eave = Math.max(0, Math.min(.3, sideHalf-w/2-.06, backHalf+houseZ-d/2-.06));
  const porchD = Math.max(0, Math.min(1.5, frontHalf-houseZ-d/2-.4));
  const stepD = Math.min(.3, Math.max(0, frontHalf-houseZ-d/2-porchD-.1));

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect?.(building.id);
  };

  const wallColor = selected ? '#fef08a' : building.wallColor;
  const roofColor = selected ? '#38bdf8' : building.roofColor;
  const fenceColor = building.fenceColor || '#2563a6';

  // Front fence segments calculation
  const leftSheetLen = Math.max(0.2, sideHalf - halfGate);
  const rightSheetLen = Math.max(0.2, sideHalf - halfGate);
  const leftSheetCenterX = (-sideHalf - halfGate) / 2;
  const rightSheetCenterX = (halfGate + sideHalf) / 2;

  // Porch width
  const porchW = Math.min(w * 0.65, 4.4);

  return (
    <group
      position={[building.x, 0, building.z]}
      rotation={[0, building.rotation, 0]}
      onClick={handleClick}
    >
      {/* ======================================================== */}
      {/* ၁။ ခြံဝန်းမြေခင်း (Compound Ground Plinth - Area 5 Yard)  */}
      {/* ======================================================== */}
      <mesh
        position={[0, 0.02, fenceCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[fenceW - 0.1, fenceD - 0.1]} />
        <meshStandardMaterial color="#c5bca8" roughness={0.92} />
      </mesh>

      {/* ======================================================== */}
      {/* ၂။ ခြံစည်းရိုး (Compound Fences - Front, Sides, Back)     */}
      {/* ======================================================== */}
      <group name="compound-fences">
        {/* (က) မျက်နှာစာ ခြံစည်းရိုး (Front Fence with Gate Opening) */}
        <group position={[0, 0, frontHalf]}>
          {/* ဘယ်ဘက် သွပ်ပြားခြံစည်းရိုး (Left Sheet Section) */}
          {leftSheetLen > 0.4 && (
            <>
              <Box
                x={leftSheetCenterX}
                y={0.85}
                z={0}
                w={leftSheetLen}
                h={1.7}
                d={0.06}
                color={fenceColor}
              />
              <Box
                x={leftSheetCenterX}
                y={1.72}
                z={0}
                w={leftSheetLen + 0.04}
                h={0.05}
                d={0.1}
                color="#1d4e89"
              />
              <CandleRow length={leftSheetLen} x={leftSheetCenterX} y={1.74} />
            </>
          )}

          {/* ညာဘက် သွပ်ပြားခြံစည်းရိုး (Right Sheet Section) */}
          {rightSheetLen > 0.4 && (
            <>
              <Box
                x={rightSheetCenterX}
                y={0.85}
                z={0}
                w={rightSheetLen}
                h={1.7}
                d={0.06}
                color={fenceColor}
              />
              <Box
                x={rightSheetCenterX}
                y={1.72}
                z={0}
                w={rightSheetLen + 0.04}
                h={0.05}
                d={0.1}
                color="#1d4e89"
              />
              <CandleRow length={rightSheetLen} x={rightSheetCenterX} y={1.74} />
            </>
          )}

          {/* ခြံတံခါး တိုင် ၂ လုံး (Gate Entrance Posts) */}
          <Box x={-halfGate} y={0.95} z={0} w={0.16} h={1.9} d={0.16} color="#485457" />
          <Box x={halfGate} y={0.95} z={0} w={0.16} h={1.9} d={0.16} color="#485457" />
          <Box x={-halfGate} y={1.92} z={0} w={0.22} h={0.06} d={0.22} color="#1d4e89" />
          <Box x={halfGate} y={1.92} z={0} w={0.22} h={0.06} d={0.22} color="#1d4e89" />

          {/* ထောင့်တိုင် ၂ လုံး (Front Corner Posts) */}
          <Box x={-sideHalf} y={0.9} z={0} w={0.12} h={1.8} d={0.12} color="#566366" />
          <Box x={sideHalf} y={0.9} z={0} w={0.12} h={1.8} d={0.12} color="#566366" />
        </group>

        {/* (ခ) ဘယ်ဘက် ဘေးခြံစည်းရိုး (Left Side Wire Mesh Fence) */}
        <group position={[-sideHalf, 0, fenceCenterZ]}>
          {/* အပေါ်တန်း သံဘား (Top Rail) */}
          <Box x={0} y={1.4} z={0} w={0.05} h={0.05} d={fenceD} color="#68767a" />
          {/* အလယ်တန်း (Mid Rail) */}
          <Box x={0} y={0.75} z={0} w={0.04} h={0.04} d={fenceD} color="#7a898d" />
          {/* အောက်ခြေတန်း (Bottom Rail) */}
          <Box x={0} y={0.15} z={0} w={0.05} h={0.05} d={fenceD} color="#68767a" />
          {/* ဇကာကွက် ပြား (Semi-transparent Wire Mesh Plane) */}
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.02, 1.25, fenceD]} />
            <meshStandardMaterial
              color="#98abb0"
              metalness={0.4}
              roughness={0.5}
              transparent
              opacity={0.35}
            />
          </mesh>
          {/* အလယ်တိုင် (Middle Post) */}
          <Box x={0} y={0.75} z={0} w={0.08} h={1.55} d={0.08} color="#566366" />
        </group>

        {/* (ဂ) ညာဘက် ဘေးခြံစည်းရိုး (Right Side Wire Mesh Fence) */}
        <group position={[sideHalf, 0, fenceCenterZ]}>
          {/* အပေါ်တန်း သံဘား (Top Rail) */}
          <Box x={0} y={1.4} z={0} w={0.05} h={0.05} d={fenceD} color="#68767a" />
          {/* အလယ်တန်း (Mid Rail) */}
          <Box x={0} y={0.75} z={0} w={0.04} h={0.04} d={fenceD} color="#7a898d" />
          {/* အောက်ခြေတန်း (Bottom Rail) */}
          <Box x={0} y={0.15} z={0} w={0.05} h={0.05} d={fenceD} color="#68767a" />
          {/* ဇကာကွက် ပြား (Semi-transparent Wire Mesh Plane) */}
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.02, 1.25, fenceD]} />
            <meshStandardMaterial
              color="#98abb0"
              metalness={0.4}
              roughness={0.5}
              transparent
              opacity={0.35}
            />
          </mesh>
          {/* အလယ်တိုင် (Middle Post) */}
          <Box x={0} y={0.75} z={0} w={0.08} h={1.55} d={0.08} color="#566366" />
        </group>

        {/* (ဃ) အနောက်ဘက် ခြံစည်းရိုး (Back Fence) */}
        <group position={[0, 0, -backHalf]}>
          <Box x={0} y={1.4} z={0} w={fenceW} h={0.05} d={0.05} color="#68767a" />
          <Box x={0} y={0.75} z={0} w={fenceW} h={0.04} d={0.04} color="#7a898d" />
          <Box x={0} y={0.15} z={0} w={fenceW} h={0.05} d={0.05} color="#68767a" />
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[fenceW, 1.25, 0.02]} />
            <meshStandardMaterial
              color="#98abb0"
              metalness={0.4}
              roughness={0.5}
              transparent
              opacity={0.35}
            />
          </mesh>
          {/* အနောက်ထောင့်တိုင်များနှင့် အလယ်တိုင် */}
          <Box x={-sideHalf} y={0.75} z={0} w={0.1} h={1.55} d={0.1} color="#566366" />
          <Box x={sideHalf} y={0.75} z={0} w={0.1} h={1.55} d={0.1} color="#566366" />
          <Box x={0} y={0.75} z={0} w={0.08} h={1.55} d={0.08} color="#566366" />
        </group>
      </group>

      {/* ======================================================== */}
      {/* ၃။ အိမ်ရှေ့ လူသွားလမ်း (Front Walkway Path)               */}
      {/* ======================================================== */}
      {frontHalf - (houseZ + d / 2 + 1.2) > 0.4 && (
        <Box
          x={0}
          y={0.03}
          z={(frontHalf + (houseZ + d / 2 + 1.2)) / 2}
          w={1.2}
          h={0.02}
          d={frontHalf - (houseZ + d / 2 + 1.2)}
          color="#a89b88"
        />
      )}

      {/* ======================================================== */}
      {/* ၄။ ပင်မအိမ်ကြီး (Main House Structure)                    */}
      {/* ======================================================== */}
      <group position={[0, 0, houseZ]}>
        {/* ဖရောင်းတိုင် မီးညွှန့်များ (Porch Candle Lights) */}
        {porchD > .25 && <PorchCandles width={porchW} front={d / 2 + porchD / 2 - .7} />}

        {/* ၁။ အောက်ခြေ အုတ်မြစ်ခုံ (Base Plinth) */}
        <Box
          x={0}
          y={0.15}
          z={0}
          w={w + 0.3}
          h={0.3}
          d={d + 0.3}
          color="#aaa18d"
        />

        {/* ၂။ ပင်မနံရံ (Main Wall Body) */}
        <Box
          x={0}
          y={wallH / 2 + 0.3}
          z={0}
          w={w}
          h={wallH}
          d={d}
          color={wallColor}
        />

        {/* ၃။ အမိုးအောက် ကမ်းဆိုင်းခါးပတ် (Eaves Cornice Trim) */}
        <Box
          x={0}
          y={wallH + 0.28}
          z={0}
          w={w + 2 * eave}
          h={0.15}
          d={d + 2 * eave}
          color="#e6ce9f"
        />

        <ImportedGableRoof width={w} depth={d} eaveY={wallH+.35}
          rise={pitchH} overhang={eave} color={roofColor} wallColor={wallColor}/>

        {/* ၆။ မျက်နှာစာ အဝင်တံခါးနှင့် ပြတင်းပေါက်များ (Front Door & Windows) */}
        <Box
          x={0}
          y={1.15}
          z={d / 2 + 0.05}
          w={Math.min(1.15, w*.3)}
          h={2.0}
          d={0.1}
          color="#5c3a21"
        />
        <Box
          x={-w * 0.3}
          y={1.35}
          z={d / 2 + 0.05}
          w={Math.min(1, w*.22)}
          h={1.2}
          d={0.08}
          color="#7ca1b5"
        />
        <Box
          x={w * 0.3}
          y={1.35}
          z={d / 2 + 0.05}
          w={Math.min(1, w*.22)}
          h={1.2}
          d={0.08}
          color="#7ca1b5"
        />

        {/* ၂ ထပ်ဖြစ်ပါက အပေါ်ထပ် ပြတင်းပေါက်များ */}
        {isTwoStorey && (
          <>
            <Box
              x={-w * 0.3}
              y={4.2}
              z={d / 2 + 0.05}
              w={Math.min(1, w*.22)}
              h={1.2}
              d={0.08}
              color="#7ca1b5"
            />
            <Box
              x={w * 0.3}
              y={4.2}
              z={d / 2 + 0.05}
              w={Math.min(1, w*.22)}
              h={1.2}
              d={0.08}
              color="#7ca1b5"
            />
          </>
        )}

        {/* ၇။ အိမ်ရှေ့ ဝရံတာ ကုန်းပတ် (Front Veranda Deck & Railings) */}
        <Box
          x={0}
          y={0.2}
          z={d / 2 + porchD / 2}
          w={porchW}
          h={0.25}
          d={porchD}
          color="#8d6e63"
        />
        {/* ဝရံတာ တိုင်လုံး ၂ ခု */}
        <Box
          x={-porchW / 2 + 0.1}
          y={1.1}
          z={d / 2 + Math.max(.05, porchD - .1)}
          w={0.12}
          h={1.8}
          d={0.12}
          color="#5c3a21"
        />
        <Box
          x={porchW / 2 - 0.1}
          y={1.1}
          z={d / 2 + Math.max(.05, porchD - .1)}
          w={0.12}
          h={1.8}
          d={0.12}
          color="#5c3a21"
        />
        {/* ဝရံတာ လျှောက်လမ်းဆင်း လှေကားထစ် */}
        <Box
          x={0}
          y={0.1}
          z={d / 2 + porchD + stepD/2}
          w={Math.min(1.4, w*.4)}
          h={0.15}
          d={stepD}
          color="#a89f91"
        />
      </group>
    </group>
  );
});
