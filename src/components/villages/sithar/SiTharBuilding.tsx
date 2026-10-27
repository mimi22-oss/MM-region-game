import { memo, useMemo } from 'react';
import { CandleRow, PorchCandles } from '../../FestivalAnchor';
import { WireMeshSegment } from '../../House';
import type { SiTharBuildingData } from '../../../data/villages/sithar';
import { Box } from '../../Primitives';
import { sourceIsEdited } from '../../../game/worldEdits';

export interface SiTharBuildingProps {
  building: SiTharBuildingData;
  selected?: boolean;
  onSelect?: (id: string) => void;
  ignoreEdits?: boolean;
}

/**
 * စည်သာရွာ အဆောက်အအုံ Component (Si Thar Village Building 3D Model)
 *
 * မြို့သာရပ်ကွက် နယ်မြေ (၅) နှင့် နတ်မြောင်းရွာ ဗိသုကာစတိုင်:
 * - အောက်ခြေ အုတ်မြစ်ခုံ (Foundation Plinth `#aaa18d`)
 * - ၂ ထပ်အိမ်များအတွက် အောက်ထပ် ပျဉ်ထောင်နံရံ (`#d6cbb6`)၊ ကြမ်းခင်းခါးပတ် (`#71523c`)၊ အထက်ထပ်နံရံ (`wallColor`)
 * - အမိုးအောက် ကမ်းဆိုင်းခါးပတ် (Eaves Cornice Trim `#e6ce9f`)
 * - လက်ဝဲ/လက်ယာ လျှောစင်းသော သွပ်မိုး ၂ ဖက် (Slanted Pitched Convex Roof Panels)
 * - ဗဟို အမိုးခေါင်ထွတ် သွပ်ပြား (Center Roof Ridge Cap `#4a5568`)
 * - မြန်မာ့ရိုးရာ ကျွန်းတံခါး၊ မှန်လိုက်ကာ ပြတင်းပေါက်များနှင့် ဝရံတာ (Door, Windows & Veranda)
 * - အိမ်ရှေ့ ဝရံတာနှင့် လှေကားထစ်၊ ၂ ထပ်အိမ်များအတွက် အပေါ်ထပ်ဝရံတာ လက်ရန်းနှင့် တိုင်လုံးများ
 * - သံဇကာခြံပတ်ခြာလည်နှင့် ဂိတ်တိုင်များ (Wire Mesh Compound Fence & Gate Posts)
 * - ရွာ့အထူးအဆောက်အအုံများ: စည်သာ နှစ်ခြင်းဘုရားကျောင်း (ကားတိုင်)၊ ရန်ကင်းဓမ္မသုခ ကျောင်းတိုက်ကြီး (ပြာသာဒ်)၊ စာကြည့်တိုက်၊ ဘူတာရုံ၊ အုပ်ချုပ်ရေးမှူးရုံး
 */
export const SiTharBuilding = memo(function SiTharBuilding({
  building,
  selected = false,
  onSelect,
  ignoreEdits = false,
}: SiTharBuildingProps) {
  if (!ignoreEdits && sourceIsEdited(building.id)) return null;
  const w = building.houseWidth || building.width || 4.2;
  const d = building.houseLength || building.depth || 2.8;
  const front = d / 2;

  const isTwoStorey = building.storeys === 2 || (building.type === 'house' && building.storeys !== 1) || building.area >= 65;
  const isChurch = building.type === 'church';
  const isMonastery = building.type === 'monastery';
  const isStation = building.type === 'station';
  const isSchool = building.type === 'school';
  const isOffice = building.type === 'office';

  const wallH = isChurch ? 6.2 : isTwoStorey ? 5.8 : isMonastery ? 5.2 : isStation ? 4.2 : isSchool ? 4.2 : 3.2;
  const roofY = isChurch ? 6.8 : isTwoStorey ? 6.6 : isMonastery ? 6.2 : isStation ? 4.8 : isSchool ? 5.0 : 4.0;
  const pitchH = isChurch ? 2.8 : isMonastery ? 2.6 : 1.6;

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

  const showFence = !isChurch && !isMonastery && !isStation;
  const fenceW = building.compoundWidth || (w + 1.6);
  const fenceD = building.compoundDepth || (d + 1.4);

  return (
    <group
      position={[building.x, 0, building.z]}
      rotation={[0, building.rotation, 0]}
      name={`sithar-bldg-${building.id}`}
      onClick={handleClick}
      userData={{
        osmId: building.osmId,
        buildingId: building.id,
        area: building.area,
        name: building.name,
      }}
    >
      {/* ======================================================== */}
      {/* ၀။ သံဇကာခြံစည်းရိုး (Wire Mesh Perimeter Fence & Gate) */}
      {/* ======================================================== */}
      {showFence && (
        <group name="compound-fence">
          {/* အိမ်ဝန်း ခြံမြေပြင် (Individual Compound Lawn/Yard Base) */}
          <mesh
            position={[0, 0.02, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[fenceW - 0.1, fenceD - 0.1]} />
            <meshStandardMaterial color="#8da06b" roughness={0.92} />
          </mesh>

          {/* နောက်ဘက် သံဇကာခြံ (Back Wire Mesh Fence) */}
          <group position={[0, 0, -fenceD / 2]}>
            <WireMeshSegment length={fenceW} />
          </group>

          {/* ဘယ်ဘက် သံဇကာခြံ (Left Wire Mesh Fence) */}
          <group position={[-fenceW / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <WireMeshSegment length={fenceD} />
          </group>

          {/* ညာဘက် သံဇကာခြံ (Right Wire Mesh Fence) */}
          <group position={[fenceW / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <WireMeshSegment length={fenceD} />
          </group>

          {/* အရှေ့ဘက် သံဇကာခြံ တောင်ပံများနှင့် ဂိတ်တံခါး (Front Wire Mesh & Blue Sheet Gate) */}
          {(() => {
            const gateWidth = Math.min(2.0, fenceW * 0.42);
            const wingLen = (fenceW - gateWidth) / 2;
            const wingOffset = gateWidth / 2 + wingLen / 2;
            const halfGate = gateWidth / 2;
            return (
              <group position={[0, 0, fenceD / 2]}>
                {/* ဘယ်ဘက် အရှေ့သံဇကာ */}
                <group position={[-wingOffset, 0, 0]}>
                  <WireMeshSegment length={wingLen} />
                </group>
                {/* ညာဘက် အရှေ့သံဇကာ */}
                <group position={[wingOffset, 0, 0]}>
                  <WireMeshSegment length={wingLen} />
                </group>

                {/* ဂိတ်တိုင် ၂ တိုင် (Steel/Concrete Gate Posts) */}
                {[-halfGate, halfGate].map((gx) => (
                  <group key={`gp-${gx}`} position={[gx, 0, 0]}>
                    <Box position={[0, 0.98, 0]} size={[0.16, 1.96, 0.16]} color="#485457" />
                    <Box position={[0, 1.98, 0]} size={[0.22, 0.06, 0.22]} color="#1d4e89" />
                  </group>
                ))}

                {/* အပြာရောင် သံပန်း/သွပ်ပြား ဂိတ်တံခါး (Blue Sheet Gate Leaf Panel) */}
                <mesh position={[-halfGate / 2, 0.88, 0]} castShadow receiveShadow>
                  <boxGeometry args={[halfGate * 0.94, 1.72, 0.05]} />
                  <meshStandardMaterial color="#2b6cb0" metalness={0.35} roughness={0.45} />
                </mesh>
                <Box position={[-halfGate / 2, 1.75, 0]} size={[halfGate * 0.94, 0.05, 0.08]} color="#1d4e89" />
              </group>
            );
          })()}
        </group>
      )}

      {/* ======================================================== */}
      {/* ၁။ အောက်ခြေ အုတ်မြစ်ခုံ (Foundation Plinth) */}
      {/* ======================================================== */}
      <PorchCandles width={Math.min(w * 0.65, 4.5)} front={front} y={building.type === 'house' ? 0.355 : 0.02} />
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
          {/* စာသင်ဆောင်ရှည် */}
          <Box position={[0, 2.0, 0]} size={[w, 3.8, d]} color={wallColor} />
          {/* ကော်ရစ်ဒါ တိုင်များ */}
          {[-8, -4, 0, 4, 8].map((px) => (
            <Box
              key={`school-pillar-${px}`}
              position={[px, 1.9, front + 0.8]}
              size={[0.25, 3.8, 0.25]}
              color="#ffffff"
            />
          ))}
          {/* ဆိုင်းဘုတ် */}
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
      ) : isChurch ? (
        <>
          {/* ဘုရားကျောင်း ပင်မဆောင်နံရံများ */}
          <Box position={[0, 3.1, 0]} size={[w, 6.0, d]} color={wallColor} />
        </>
      ) : (
        /* တစ်ထပ်တိုက် ပျဉ်ထောင်နံရံ (Single Storey) */
        <Box position={[0, 1.6, 0]} size={[w, 2.9, d]} color={wallColor} />
      )}

      {/* ======================================================== */}
      {/* ၃။ မြို့သာရပ်ကွက် နယ်မြေ (၅) စတိုင် အိမ်ခေါင်မိုး (Myothar Area 5 Pitched Roof) */}
      {/* ======================================================== */}
      <group name="sithar-myothar-style-roof">
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

        {/* ဘုရားကျောင်း စတီပယ်နှင့် ကားတိုင် (Church Steeple & Cross) */}
        {isChurch && (
          <group position={[0, roofY + pitchH / 2 + 0.2, front - 1.2]}>
            <Box position={[0, 1.4, 0]} size={[1.6, 2.6, 1.6]} color="#f8fafc" />
            <Box position={[0, 3.1, 0]} size={[0.24, 1.4, 0.1]} color="#f1f5f9" />
            <Box position={[0, 3.3, 0]} size={[0.9, 0.22, 0.1]} color="#f1f5f9" />
          </group>
        )}

        {/* ဘုန်းတော်ကြီးကျောင်း ပြာသာဒ်အဆင့်များ (Monastery Tiered Spire) */}
        {isMonastery && (
          <group position={[0, roofY + pitchH / 2 + 0.1, 0]}>
            <Box position={[0, 0.5, 0]} size={[w * 0.45, 0.8, d * 0.45]} color="#d97706" />
            <Box position={[0, 1.1, 0]} size={[w * 0.3, 0.6, d * 0.3]} color="#78350f" />
            <Box position={[0, 1.6, 0]} size={[0.4, 1.1, 0.4]} color="#f59e0b" />
          </group>
        )}

        {/* ဘူတာရုံ အမိုးစွန်း ဆိုင်းဘုတ် (Railway Station Awning) */}
        {isStation && (
          <group position={[0, -0.6, front + 0.8]}>
            <Box position={[0, 0, 0]} size={[w * 0.85, 0.14, 1.8]} color="#b91c1c" />
            <Box position={[0, 0.6, 0.2]} size={[w * 0.65, 0.5, 0.08]} color="#1e293b" />
          </group>
        )}
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
