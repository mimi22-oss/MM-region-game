import { memo, useMemo } from 'react';
import type { KanbaleBuildingData } from '../../../data/villages/kanbale';
import { Box } from '../../Primitives';

export interface KanbaleBuildingProps {
  building: KanbaleBuildingData;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/**
 * ကံပုလဲရွာ အိမ် Component (Kanbale Village House 3D Model)
 *
 * အသုံးပြုသူ တောင်းဆိုချက်:
 * "မြို့သာရပ်ကွက် နယ်မြေ(၅)လိုမျိုးအိမ်လေးတွေလို အိမ်ခေါင်မိုး လုပ်ပေးရမှာပါ။"
 *
 * Myothar Area 5 ရှိ `House.tsx` ၏ အိမ်ခေါင်မိုး ပုံစံအတိုင်း:
 * - အမိုးအောက် ကမ်းဆိုင်းခါးပတ် (Eaves Cornice Trim `#e6ce9f`)
 * - လက်ဝဲ/လက်ယာ လျှောစင်းသော သွပ်မိုး ၂ ဖက် (Slanted Pitched Roof Panels)
 * - ဗဟို အမိုးခေါင်ထွတ် (Center Ridge Cap)
 * - အောက်ခြေ အုတ်မြစ်ခုံ (Base Plinth `#aaa18d`)
 * - မြန်မာ့ရိုးရာ ကျွန်းတံခါး၊ မှန်လိုက်ကာ ပြတင်းပေါက်များနှင့် ဝရံတာ (Door, Windows & Veranda)
 * - ခြံစည်းရိုးနှင့် အဝင်ဂိတ် (Compound Fence)
 */
export const KanbaleBuilding = memo(function KanbaleBuilding({
  building,
  selected = false,
  onSelect,
}: KanbaleBuildingProps) {
  // Dimensions along frontage (w) and ridge depth (d)
  const w = building.houseWidth || Math.max(building.width, 6.5);
  const d = building.houseLength || Math.max(building.depth, 7.5);
  const front = d / 2;
  const balconyWidth = Math.min(w * 0.65, 5.0);

  // Area-based storey determination (match authentic Myanmar township proportions)
  const isTwoStorey = building.area >= 70;
  const wallH = isTwoStorey ? 5.8 : 3.2;
  const roofY = isTwoStorey ? 6.6 : 4.0;
  const pitchH = 1.6;

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

  // Compound fence dimensions
  const fenceW = w + 3.2;
  const fenceD = d + 3.8;

  return (
    <group
      position={[building.x, 0, building.z]}
      rotation={[0, building.rotation, 0]}
      name={`kanbale-house-${building.id}`}
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
      <group name="compound-fence">
        {/* နောက်ဘက် ခြံစည်းရိုး (Rear Fence) */}
        <Box
          position={[0, 0.65, -fenceD / 2]}
          size={[fenceW, 1.3, 0.06]}
          color="#6a4e32"
        />
        {/* ဘယ်ဘက် ခြံစည်းရိုး (Left Fence) */}
        <Box
          position={[-fenceW / 2, 0.65, 0]}
          size={[0.06, 1.3, fenceD]}
          color="#6a4e32"
        />
        {/* ညာဘက် ခြံစည်းရိုး (Right Fence) */}
        <Box
          position={[fenceW / 2, 0.65, 0]}
          size={[0.06, 1.3, fenceD]}
          color="#6a4e32"
        />
        {/* အရှေ့ဘက် ခြံစည်းရိုး ဘယ်/ညာ (Front Fence Wings with open gate) */}
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

      {/* ======================================================== */}
      {/* ၁။ အောက်ခြေ အုတ်မြစ်ခုံ (Foundation Plinth) */}
      {/* ======================================================== */}
      <Box
        position={[0, 0.15, 0]}
        size={[w + 0.3, 0.3, d + 0.3]}
        color="#aaa18d"
      />

      {/* ======================================================== */}
      {/* ၂။ အိမ်နံရံများ (Walls - Storeys based on area) */}
      {/* ======================================================== */}
      {isTwoStorey ? (
        <>
          {/* အောက်ထပ် နံရံ (Ground Floor) */}
          <Box position={[0, 1.6, 0]} size={[w, 2.8, d]} color="#d6cbb6" />
          {/* ကြားခံ ခါးပတ် (Floor Divider Band) */}
          <Box
            position={[0, 3.1, 0]}
            size={[w + 0.35, 0.2, d + 0.35]}
            color="#71523c"
          />
          {/* အထက်ထပ် နံရံ (Upper Floor) */}
          <Box position={[0, 4.5, 0]} size={[w, 2.7, d]} color={wallColor} />
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
        {/* အောက်ထပ် ပင်မ ကျွန်းတံခါး (Ground Floor Entrance Door) */}
        <Box
          position={[0, 1.45, front + 0.08]}
          size={[1.4, 2.3, 0.16]}
          color="#573f30"
        />

        {/* ပြတင်းပေါက်များ (Louver Windows with Teal Shutters & Cream Trim) */}
        {[-1, 1].map((side) => (
          <group key={`win-${side}`}>
            {/* အရှေ့ဘက် ပြတင်းပေါက် (Front Window) */}
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

            {/* ဘေးနံရံ ပြတင်းပေါက် (Side Window) */}
            <Box
              position={[side * (w / 2 + 0.06), 1.85, 0]}
              size={[0.12, 1.4, 1.7]}
              color="#355b59"
            />
            <Box
              position={[side * (w / 2 + 0.14), 1.85, 0]}
              size={[0.08, 1.5, 0.09]}
              color="#e6ce9f"
            />
          </group>
        ))}

        {/* အထက်ထပ်ရှိပါက အထက်ထပ် တံခါးနှင့် ပြတင်းပေါက်များ (Upper Storey Windows) */}
        {isTwoStorey && (
          <>
            <Box
              position={[0, 4.65, front + 0.08]}
              size={[1.4, 2.3, 0.16]}
              color="#573f30"
            />
            {[-1, 1].map((side) => (
              <group key={`upper-win-${side}`}>
                <Box
                  position={[side * w * 0.31, 4.85, front + 0.07]}
                  size={[1.5, 1.4, 0.14]}
                  color="#355b59"
                />
                <Box
                  position={[side * w * 0.31, 4.85, front + 0.16]}
                  size={[0.09, 1.5, 0.07]}
                  color="#e6ce9f"
                />
                <Box
                  position={[side * w * 0.31, 4.1, front + 0.15]}
                  size={[1.7, 0.12, 0.2]}
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
      <group name="front-veranda">
        <Box
          position={[0, 0.18, front + 0.8]}
          size={[balconyWidth, 0.35, 1.6]}
          color="#b9ad94"
        />
        {/* ဝရံတာ ဆင်း/တက် လှေကားထစ် (Steps) */}
        <Box
          position={[0, 0.09, front + 1.8]}
          size={[2.0, 0.18, 0.6]}
          color="#b9ad94"
        />
        {/* ဝရံတာ တိုင်လုံး ၂ တိုင် (Timber Posts) */}
        {[-1, 1].map((side) => (
          <Box
            key={`balcony-post-${side}`}
            position={[side * (balconyWidth / 2 - 0.15), 1.5, front + 1.4]}
            size={[0.18, 2.8, 0.18]}
            color="#71523c"
          />
        ))}
      </group>

      {/* ရွေးချယ်ထားပါက မီးရောင်ပြသခြင်း (Selection Highlight) */}
      {selected && (
        <pointLight
          position={[0, roofY + 2.0, 0]}
          intensity={2.8}
          distance={14}
          color="#38bdf8"
        />
      )}
    </group>
  );
});
