import { memo, useMemo } from 'react';
import {CandleRow,PorchCandles} from '../../FestivalAnchor';
import type { NatmyaungBuildingData } from '../../../data/villages/natmyaung';
import { Box } from '../../Primitives';
import { sourceIsEdited } from '../../../game/worldEdits';

export interface NatmyaungBuildingProps {
  building: NatmyaungBuildingData;
  selected?: boolean;
  onSelect?: (id: string) => void;
  ignoreEdits?: boolean;
}

/**
 * နတ်မြောင်းရွာ အဆောက်အအုံ Component (Nat Myaung Village Building 3D Model)
 *
 * အသုံးပြုသူ တောင်းဆိုချက်:
 * "မြို့သာရပ်ကွက် နယ်မြေ(၅)လိုမျိုးအိမ်လေးတွေလို အိမ်ခေါင်မိုး လုပ်ပေးရမှာပါ။"
 *
 * Myothar Area 5 ရှိ `House.tsx` ၏ အိမ်ခေါင်မိုး ပုံစံအတိုင်း:
 * - အမိုးအောက် ကမ်းဆိုင်းခါးပတ် (Eaves Cornice Trim `#e6ce9f`)
 * - လက်ဝဲ/လက်ယာ လျှောစင်းသော သွပ်မိုး ၂ ဖက် (Slanted Pitched Convex Roof Panels)
 * - ဗဟို အမိုးခေါင်ထွတ် (Center Ridge Cap)
 * - အောက်ခြေ အုတ်မြစ်ခုံ (Base Plinth `#aaa18d`)
 * - မြန်မာ့ရိုးရာ ကျွန်းတံခါး၊ မှန်လိုက်ကာ ပြတင်းပေါက်များနှင့် ဝရံတာ (Door, Windows & Veranda)
 * - ခြံစည်းရိုးနှင့် အဝင်ဂိတ် (Compound Fence)
 */
export const NatmyaungBuilding = memo(function NatmyaungBuilding({
  building,
  selected = false,
  onSelect,
  ignoreEdits = false,
}: NatmyaungBuildingProps) {
  if (!ignoreEdits && sourceIsEdited(building.id)) return null;
  const w = building.houseWidth || Math.max(building.width, 7.0);
  const d = building.houseLength || Math.max(building.depth, 7.5);
  const front = d / 2;

  // Area-based or house-type storey determination (အသုံးပြုသူ တောင်းဆိုချက်: ၂ထပ်အိမ်များ)
  const isTwoStorey = building.storeys === 2 || (building.type === 'house' && building.storeys !== 1) || building.area >= 70;
  const isSchool = building.type === 'school';
  const isMonastery = building.type === 'monastery';
  const isOffice = building.type === 'office';
  const isClinic = building.type === 'clinic';

  const wallH = isTwoStorey ? 5.8 : isSchool ? 4.2 : isMonastery ? 5.2 : 3.2;
  const roofY = isTwoStorey ? 6.6 : isSchool ? 5.0 : isMonastery ? 6.2 : 4.0;
  const pitchH = isMonastery ? 2.6 : 1.6;

  // Exact Myothar Area 5 roof angle & slope calculation
  const roofAngle = useMemo(() => Math.atan2(pitchH, w / 2), [pitchH, w]);
  const slopeLength = useMemo(
    () => Math.hypot(w / 2, pitchH) + 0.8,
    [pitchH, w],
  );
  const roofDepth = d + 1.2;

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect?.(building.id);
  };

  const wallColor = selected ? '#fef08a' : building.wallColor;
  const roofColor = selected ? '#38bdf8' : building.roofColor;

  // Compound fence dimensions (skip fence for open public school and monastery yard)
  const showFence = !isSchool && !isMonastery;
  const fenceW = w + 1.8;
  const fenceD = d + 1.8;

  return (
    <group
      position={[building.x, 0, building.z]}
      rotation={[0, building.rotation, 0]}
      name={`natmyaung-bldg-${building.id}`}
      onClick={handleClick}
      userData={{
        osmId: building.osmId,
        buildingId: building.id,
        area: building.area,
        name: building.name,
      }}
    >
      {/* ======================================================== */}
      {/* ၀။ ခြံစည်းရိုး (Compound Fence) */}
      {/* ======================================================== */}
      {showFence && (
        <group name="compound-fence">
          <CandleRow length={fenceD} x={-fenceW/2} y={1.3} alongZ/>
          <CandleRow length={fenceD} x={fenceW/2} y={1.3} alongZ/>
          {/* နောက်ဘက် ခြံစည်းရိုး */}
          <Box
            position={[0, 0.65, -fenceD / 2]}
            size={[fenceW, 1.3, 0.06]}
            color="#6a4e32"
          />
          {/* ဘယ်ဘက် ခြံစည်းရိုး */}
          <Box
            position={[-fenceW / 2, 0.65, 0]}
            size={[0.06, 1.3, fenceD]}
            color="#6a4e32"
          />
          {/* ညာဘက် ခြံစည်းရိုး */}
          <Box
            position={[fenceW / 2, 0.65, 0]}
            size={[0.06, 1.3, fenceD]}
            color="#6a4e32"
          />
          {/* အရှေ့ဘက် ခြံစည်းရိုး ဘယ်/ညာ (Front Wings with gate opening) */}
          <Box
            position={[-fenceW / 4 - 0.7, 0.65, fenceD / 2]}
            size={[fenceW / 2 - 1.4, 1.3, 0.06]}
            color="#6a4e32"
          />
          <Box
            position={[fenceW / 4 + 0.7, 0.65, fenceD / 2]}
            size={[fenceW / 2 - 1.4, 1.3, 0.06]}
            color="#6a4e32"
          />
          {/* ဂိတ်တိုင် ၂ တိုင် (Gate Posts) */}
          <Box
            position={[-1.3, 0.85, fenceD / 2]}
            size={[0.16, 1.7, 0.16]}
            color="#432811"
          />
          <Box
            position={[1.3, 0.85, fenceD / 2]}
            size={[0.16, 1.7, 0.16]}
            color="#432811"
          />
        </group>
      )}

      {/* ======================================================== */}
      {/* ၁။ အောက်ခြေ အုတ်မြစ်ခုံ (Foundation Plinth) */}
      <PorchCandles width={Math.min(w*.65,4.5)} front={front} y={building.type==='house'?.355:.02}/>
      {/* ======================================================== */}
      <Box
        position={[0, 0.15, 0]}
        size={[w + 0.3, 0.3, d + 0.3]}
        color="#aaa18d"
      />

      {/* ======================================================== */}
      {/* ၂။ အဆောက်အအုံ နံရံများ (Walls) */}
      {/* ======================================================== */}
      {isTwoStorey ? (
        <>
          <Box position={[0, 1.6, 0]} size={[w, 2.8, d]} color="#d6cbb6" />
          <Box
            position={[0, 3.1, 0]}
            size={[w + 0.35, 0.2, d + 0.35]}
            color="#71523c"
          />
          <Box position={[0, 4.5, 0]} size={[w, 2.7, d]} color={wallColor} />
        </>
      ) : isSchool ? (
        <>
          {/* မူလတန်းကျောင်း စာသင်ဆောင်ရှည် */}
          <Box position={[0, 2.0, 0]} size={[w, 3.8, d]} color={wallColor} />
          {/* စာသင်ခန်း ကော်ရစ်ဒါ တိုင်များ (Veranda Pillars) */}
          {[-10, -5, 0, 5, 10].map((px) => (
            <Box
              key={`school-pillar-${px}`}
              position={[px, 1.9, front + 0.8]}
              size={[0.25, 3.8, 0.25]}
              color="#ffffff"
            />
          ))}
          {/* ကျောင်းဆောင် ဆိုင်းဘုတ် (School Signboard) */}
          <Box
            position={[0, 3.6, front + 0.12]}
            size={[w * 0.5, 0.6, 0.08]}
            color="#1e3a8a"
          />
        </>
      ) : isMonastery ? (
        <>
          {/* ဘုန်းတော်ကြီးကျောင်း ပင်မဆောင် */}
          <Box position={[0, 2.5, 0]} size={[w, 4.8, d]} color={wallColor} />
          {/* ရွှေရောင် စိန်တောင်များ (Spire ornament) */}
          <Box position={[0, roofY + pitchH + 0.8, 0]} size={[0.5, 1.6, 0.5]} color="#f59e0b" />
        </>
      ) : (
        /* တစ်ထပ်တိုက် ပျဉ်ထောင်နံရံ (Single Storey) */
        <Box position={[0, 1.6, 0]} size={[w, 2.9, d]} color={wallColor} />
      )}

      {/* ======================================================== */}
      {/* ၃။ မြို့သာရပ်ကွက် နယ်မြေ (၅) စတိုင် အိမ်ခေါင်မိုး (Myothar Area 5 Pitched Roof) */}
      {/* ======================================================== */}
      <group name="myothar-style-roof">
        {/* အမိုးအောက် ကမ်းဆိုင်းတန်း (Cornice / Eaves Band) */}
        <Box
          position={[0, wallH, 0]}
          size={[w + 0.4, 0.15, d + 0.4]}
          color="#e6ce9f"
        />

        {/* လက်ဝဲ/လက်ယာ လျှောစင်းသော သွပ်မိုး ၂ ဖက် (Two Pitched Roof Panels) */}
        {[-1, 1].map((side) => (
          <mesh
            key={`roof-slope-${side}`}
            position={[side * (w / 4), roofY, 0]}
            rotation={[0, 0, -side * roofAngle]}
            castShadow
          >
            <boxGeometry args={[slopeLength, 0.18, roofDepth]} />
            <meshStandardMaterial color={roofColor} roughness={0.85} />
          </mesh>
        ))}

        {/* အမိုးခေါင်ထွတ် သွပ်ပြား (Center Roof Ridge Cap) */}
        <Box
          position={[0, roofY + pitchH / 2 + 0.05, 0]}
          size={[0.26, 0.1, roofDepth + 0.05]}
          color="#4a5568"
        />
      </group>

      {/* ======================================================== */}
      {/* ၄။ မြန်မာ့ရိုးရာ ကျွန်းတံခါးနှင့် ပြတင်းပေါက်များ (Door & Windows) */}
      {/* ======================================================== */}
      <group name="door-and-windows">
        {/* အောက်ထပ် ပင်မ ကျွန်းတံခါး */}
        <Box
          position={[0, 1.45, front + 0.08]}
          size={[1.4, 2.3, 0.16]}
          color="#573f30"
        />

        {/* ပြတင်းပေါက်များ */}
        {[-1, 1].map((side) => (
          <group key={`win-${side}`}>
            <Box
              position={[side * w * 0.31, 1.85, front + 0.07]}
              size={[1.5, 1.4, 0.14]}
              color="#355b59"
            />
            <Box
              position={[side * w * 0.31, 1.85, front + 0.16]}
              size={[0.09, 1.5, 0.07]}
              color="#e6ce9f"
            />
            <Box
              position={[side * w * 0.31, 1.1, front + 0.15]}
              size={[1.7, 0.12, 0.2]}
              color="#e6ce9f"
            />
          </group>
        ))}

        {/* အထက်ထပ် တံခါးနှင့် ပြတင်းပေါက်များ (Upper Storey Windows & Door) */}
        {isTwoStorey && (
          <>
            {/* အထက်ထပ် ဝရံတာထွက် တံခါး */}
            <Box
              position={[0, 4.2, front + 0.08]}
              size={[1.3, 2.2, 0.16]}
              color="#573f30"
            />
            {/* အထက်ထပ် ပြတင်းပေါက်များ */}
            {[-1, 1].map((side) => (
              <group key={`upper-win-${side}`}>
                <Box
                  position={[side * w * 0.31, 4.65, front + 0.07]}
                  size={[1.4, 1.3, 0.14]}
                  color="#355b59"
                />
                <Box
                  position={[side * w * 0.31, 4.65, front + 0.16]}
                  size={[0.08, 1.4, 0.07]}
                  color="#e6ce9f"
                />
                <Box
                  position={[side * w * 0.31, 3.95, front + 0.15]}
                  size={[1.6, 0.12, 0.18]}
                  color="#e6ce9f"
                />
              </group>
            ))}
          </>
        )}
      </group>

      {/* ======================================================== */}
      {/* ၅။ အိမ်ရှေ့ ဝရံတာနှင့် လှေကားထစ် (Front Veranda Balcony & Steps) */}
      {/* ======================================================== */}
      {building.type === 'house' && (
        <group name="front-veranda">
          {/* အောက်ထပ် ဝရံတာ ကြမ်းခင်း */}
          <Box
            position={[0, 0.18, front + 0.8]}
            size={[Math.min(w * 0.65, 4.5), 0.35, 1.5]}
            color="#b9ad94"
          />
          {/* ဝရံတာ ဆင်း/တက် လှေကားထစ် (Steps) */}
          <Box
            position={[0, 0.09, front + 1.7]}
            size={[1.8, 0.18, 0.5]}
            color="#b9ad94"
          />
          {/* အပေါ်ထပ် ဝရံတာ ကြမ်းခင်းနှင့် လက်ရန်း (Upper Balcony Deck & Railing for 2-storey) */}
          {isTwoStorey && (
            <group name="upper-balcony">
              {/* အပေါ်ထပ် ဝရံတာ ကြမ်းခင်း */}
              <Box
                position={[0, 3.05, front + 0.8]}
                size={[Math.min(w * 0.65, 4.5), 0.16, 1.5]}
                color="#b9ad94"
              />
              {/* အပေါ်ထပ် ရှေ့လက်ရန်း */}
              <Box
                position={[0, 3.55, front + 1.5]}
                size={[Math.min(w * 0.65, 4.5), 0.85, 0.06]}
                color="#71523c"
              />
              {/* အပေါ်ထပ် ဘေးလက်ရန်းများ */}
              {[-1, 1].map((side) => (
                <Box
                  key={`upper-rail-side-${side}`}
                  position={[side * (Math.min(w * 0.65, 4.5) / 2 - 0.03), 3.55, front + 0.8]}
                  size={[0.06, 0.85, 1.4]}
                  color="#71523c"
                />
              ))}
            </group>
          )}
          {/* ဝရံတာ တိုင်လုံး ၂ တိုင် (Timber Posts) */}
          {[-1, 1].map((side) => (
            <Box
              key={`balcony-post-${side}`}
              position={[side * (Math.min(w * 0.65, 4.5) / 2 - 0.12), isTwoStorey ? 2.8 : 1.5, front + 1.5]}
              size={[0.16, isTwoStorey ? 5.6 : 2.8, 0.16]}
              color="#71523c"
            />
          ))}
        </group>
      )}

      {/* ======================================================== */}
      {/* ၆။ အဆောက်အအုံ ဆိုင်းဘုတ် (Landmark Name Sign) */}
      {/* ======================================================== */}
      {building.isLandmark && (
        <group position={[0, wallH + 0.6, front + 0.2]}>
          <Box position={[0, 0, 0]} size={[Math.min(w * 0.7, 7.5), 0.7, 0.08]} color="#1e293b" />
          <Box position={[0, 0, -0.01]} size={[Math.min(w * 0.7, 7.5) + 0.1, 0.75, 0.04]} color="#fbbf24" />
        </group>
      )}
    </group>
  );
});
