import { memo } from 'react';
import {CandleRow,PorchCandles} from '../../FestivalAnchor';
import type { KanbaleBuildingData } from '../../../data/villages/kanbale';
import { Box } from '../../Primitives';

export interface KanbaleFarmhouseProps {
  building: KanbaleBuildingData;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/**
 * ကံပုလဲရွာ စံပြ စိုက်ခင်းအိမ် (Kanbale Custom Farmhouse Model)
 * OSM Building ID `way/403027623` အတွက် သီးသန့် အသေးစိတ် တည်ဆောက်ထားသော Custom TSX Component ဖြစ်သည်။
 *
 * ပါဝင်သော အစိတ်အပိုင်းများ:
 * - ခြံစည်းရိုးနှင့် သစ်သားခြံတံခါး (Compound Fence & Front Gate)
 * - လမ်းလျှောက်နိုင်သော ကြမ်းပြင်များ (Walkable Foundations & Teak Flooring)
 * - မြန်မာ့ရိုးရာ သွပ်မိုး၊ အမိုးစွန်း၊ ပြတင်းပေါက်၊ တံခါး (Roof, Eaves, Louver Windows & Doors)
 * - ဧည့်ခန်း (Living Room): လက်ဖက်ရည်ဝိုင်းခုံ၊ ကော်ဇော၊ ဖျာ
 * - အိပ်ခန်း (Bedroom): သစ်သားကုတင်၊ မွေ့ယာ၊ ခေါင်းအုံး၊ ဗီရို
 * - မီးဖိုဆောင် အဖီ (Kitchen Lean-to Annex): ရိုးရာမီးဖိုခုံ၊ မြေအိုး ရေအိုးစင်၊ မီးဖိုချောင်သုံးပစ္စည်းများ
 */
export const KanbaleFarmhouse = memo(function KanbaleFarmhouse({
  building,
  selected = false,
  onSelect,
}: KanbaleFarmhouseProps) {
  // OSM Building Footprint Rotation and Position
  // way/403027623 is oriented along angle ~ -54 deg (-0.946 rad)
  const rot = -0.946;

  // Building footprint dimensions
  const houseW = 12.0;
  const houseD = 8.5;
  const porchD = 2.4;

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect?.(building.id);
  };

  return (
    <group
      position={[building.x, 0, building.z]}
      rotation={[0, rot, 0]}
      name="kanbale-custom-farmhouse"
      onClick={handleClick}
      userData={{
        id: building.id,
        osmId: building.osmId,
        custom: true,
        name: 'ကံပုလဲ စံပြစိုက်ခင်းအိမ် (Kanbale Farmhouse)',
      }}
    >
      {/* ======================================================== */}
      {/* ၀။ ခြံစည်းရိုးနှင့် ခြံတံခါး (Compound Fence & Gate) */}
      {/* ======================================================== */}
      <group name="farmhouse-fence">
        <CandleRow length={18} x={-11} z={.5} y={1.5} alongZ/>
        <CandleRow length={18} x={11} z={.5} y={1.5} alongZ/>
        <PorchCandles width={houseW} front={houseD/2} y={.32}/>
        {/* အနောက်ဘက် ခြံစည်းရိုး (Back Fence) */}
        <Box position={[0, 0.75, -8.5]} size={[22, 1.5, 0.08]} color="#7c5835" />
        {/* ဘယ်ဘက် ခြံစည်းရိုး (Left Fence) */}
        <Box position={[-11, 0.75, 0.5]} size={[0.08, 1.5, 18]} color="#7c5835" />
        {/* ညာဘက် ခြံစည်းရိုး (Right Fence) */}
        <Box position={[11, 0.75, 0.5]} size={[0.08, 1.5, 18]} color="#7c5835" />

        {/* အရှေ့ဘက် ခြံစည်းရိုး (Front Fence - Left and Right wings with 3.5m open entrance in middle) */}
        <Box position={[-6.5, 0.75, 9.5]} size={[9, 1.5, 0.08]} color="#7c5835" />
        <Box position={[6.5, 0.75, 9.5]} size={[9, 1.5, 0.08]} color="#7c5835" />

        {/* ခြံတံခါးတိုင် ၂ တိုင် (Wooden Gate Posts) */}
        <Box position={[-1.9, 1.1, 9.5]} size={[0.25, 2.2, 0.25]} color="#4a331c" />
        <Box position={[1.9, 1.1, 9.5]} size={[0.25, 2.2, 0.25]} color="#4a331c" />
      </group>

      {/* ======================================================== */}
      {/* ၁။ ဖောင်ဒေးရှင်းနှင့် ကြမ်းခင်း (Walkable Foundations & Floors) */}
      {/* ======================================================== */}
      {/* အောက်ခြေ ကွန်ကရစ် အုတ်မြစ် (Base Foundation Plinth) */}
      <mesh position={[0, 0.15, 0]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[houseW + 0.6, 0.3, houseD + porchD + 0.6]} />
        <meshStandardMaterial color="#8a8475" roughness={0.9} />
      </mesh>

      {/* ပင်မအိမ် ပျဉ်ခင်းကြမ်းပြင် (Walkable Teak Floor) */}
      <mesh position={[0, 0.31, -porchD / 2]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[houseW, 0.02, houseD]} />
        <meshStandardMaterial color="#94653a" roughness={0.5} />
      </mesh>

      {/* အိမ်ရှေ့ ဝရံတာ အဖီကြမ်းပြင် (Walkable Front Veranda / Porch Floor) */}
      <mesh position={[0, 0.31, houseD / 2]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[houseW, 0.02, porchD]} />
        <meshStandardMaterial color="#a67c4e" roughness={0.6} />
      </mesh>

      {/* ဝရံတာ ဆင်း/တက် လှေကားထစ်များ (Porch Steps) */}
      <mesh position={[0, 0.15, houseD / 2 + porchD / 2 + 0.3]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[2.8, 0.15, 0.6]} />
        <meshStandardMaterial color="#787366" roughness={0.8} />
      </mesh>

      {/* ======================================================== */}
      {/* ၂။ နံရံများ၊ တိုင်များနှင့် အခန်းဖွဲ့စည်းမှု (Walls, Teak Pillars & Rooms) */}
      {/* ======================================================== */}
      {/* အိမ်ထောင့် တိုင်လုံးကြီးများ (Heavy Timber Corner Posts) */}
      {[-houseW / 2, houseW / 2].map((px) =>
        [-houseD / 2 - porchD / 2, houseD / 2 - porchD / 2, houseD / 2 + porchD / 2].map((pz, idx) => (
          <Box key={`post-${px}-${idx}`} position={[px, 1.8, pz]} size={[0.22, 3.2, 0.22]} color="#53371e" />
        )),
      )}

      {/* နောက်ဘက် နံရံ (Back Wall) */}
      <Box position={[0, 1.8, -houseD / 2 - porchD / 2]} size={[houseW, 3.0, 0.15]} color="#ba8f62" />

      {/* ဘယ်ဘက် အပြင်နံရံ (Left Outer Wall) */}
      <Box position={[-houseW / 2, 1.8, -porchD / 2]} size={[0.15, 3.0, houseD]} color="#ba8f62" />

      {/* ညာဘက် အပြင်နံရံ (Right Outer Wall) */}
      <Box position={[houseW / 2, 1.8, -porchD / 2]} size={[0.15, 3.0, houseD]} color="#ba8f62" />

      {/* အိမ်ရှေ့ အခန်းဖွဲ့နံရံ (Front Wall with Double Doors & 2 Windows) */}
      {/* အလယ် အဝင်တံခါးပေါက် ဘယ်/ညာ အကာများ */}
      <Box position={[-4.2, 1.8, houseD / 2 - porchD / 2]} size={[3.6, 3.0, 0.15]} color="#ba8f62" />
      <Box position={[4.2, 1.8, houseD / 2 - porchD / 2]} size={[3.6, 3.0, 0.15]} color="#ba8f62" />
      <Box position={[0, 2.7, houseD / 2 - porchD / 2]} size={[2.4, 0.8, 0.15]} color="#ba8f62" />

      {/* အခန်းဖွဲ့ အလယ်နံရံ - ဧည့်ခန်း နှင့် အိပ်ခန်း ကြား (Interior Partition Wall) */}
      <Box position={[0.2, 1.8, -porchD / 2 - 0.4]} size={[0.12, 3.0, houseD - 0.8]} color="#a1784d" />

      {/* ======================================================== */}
      {/* ၃။ အိမ်အတွင်း ပရိဘောဂများ (Interior Furnishings) */}
      {/* ======================================================== */}
      {/* [က] ဧည့်ခန်း (Living Room - Left Section x = -3.0): လက်ဖက်ရည်ဝိုင်း၊ ကော်ဇော */}
      <group name="living-room" position={[-2.8, 0.32, -porchD / 2]}>
        {/* ရိုးရာ ယွန်းဖျာခင်း (Myanmar Bamboo Mat / Rug) */}
        <mesh position={[0, 0.01, 0]} receiveShadow userData={{ walkable: true }}>
          <boxGeometry args={[3.2, 0.01, 2.6]} />
          <meshStandardMaterial color="#822f2b" roughness={0.7} />
        </mesh>
        {/* သစ်သား လက်ဖက်ရည်ဝိုင်းခုံပု (Traditional Low Tea Table) */}
        <Box position={[0, 0.22, 0]} size={[1.4, 0.38, 1.1]} color="#4e311a" />
        {/* လက်ဖက်ရည်အိုးနှင့် ခွက်များ (Burmese Teapot & Cups) */}
        <Box position={[0, 0.45, 0]} size={[0.2, 0.18, 0.2]} color="#cfd8dc" />
        <Box position={[0.25, 0.43, 0.1]} size={[0.1, 0.09, 0.1]} color="#cfd8dc" />
        <Box position={[-0.25, 0.43, -0.1]} size={[0.1, 0.09, 0.1]} color="#cfd8dc" />
      </group>

      {/* [ခ] အိပ်ခန်း (Bedroom - Right Section x = 3.0): သစ်သားကုတင်၊ မွေ့ယာ၊ ဗီရို */}
      <group name="bedroom" position={[3.2, 0.32, -porchD / 2 - 1.2]}>
        {/* သစ်သား ကုတင်ဘောင် (Teak Bed Frame) */}
        <Box position={[0, 0.28, 0]} size={[2.2, 0.45, 2.6]} color="#5a381d" />
        {/* အိပ်ယာ မွေ့ယာနှင့် အခင်း (Mattress & White Bedding) */}
        <Box position={[0, 0.54, 0]} size={[2.0, 0.12, 2.4]} color="#f1f5f9" />
        {/* ခေါင်းအုံး (Pillows) */}
        <Box position={[-0.45, 0.63, -0.9]} size={[0.65, 0.12, 0.4]} color="#93c5fd" />
        <Box position={[0.45, 0.63, -0.9]} size={[0.65, 0.12, 0.4]} color="#93c5fd" />
        {/* စောင် (Folded Blanket) */}
        <Box position={[0, 0.62, 0.6]} size={[1.8, 0.08, 0.8]} color="#3b82f6" />
        {/* အဝတ်ဗီရို (Wooden Wardrobe against wall) */}
        <Box position={[2.2, 1.2, 1.5]} size={[0.7, 2.1, 1.4]} color="#3e2411" />
      </group>

      {/* [ဂ] မီးဖိုဆောင် အဖီ (Kitchen Lean-to Annex on Rear Left) */}
      <group name="kitchen-annex" position={[-4.0, 0.32, -houseD / 2 - porchD / 2 + 1.2]}>
        {/* ရိုးရာ မီးဖိုခုံ (Brick Cooking Hearth) */}
        <Box position={[0, 0.3, 0]} size={[1.5, 0.55, 0.9]} color="#874735" />
        {/* ဒယ်အိုး နှင့် ချက်ပြုတ်အိုး (Cooking Pots) */}
        <Box position={[-0.35, 0.62, 0]} size={[0.3, 0.15, 0.3]} color="#374151" />
        <Box position={[0.35, 0.62, 0]} size={[0.26, 0.12, 0.26]} color="#475569" />
        {/* သောက်ရေအိုးစင် (Burmese Clay Water Pot Stand) */}
        <Box position={[1.4, 0.4, 0]} size={[0.6, 0.75, 0.6]} color="#6b4423" />
        <Box position={[1.4, 0.88, 0]} size={[0.36, 0.32, 0.36]} color="#b45309" />
      </group>

      {/* ======================================================== */}
      {/* ၄။ အိမ်အမိုးနှင့် အမိုးစွန်းများ (Double Gable Roof with Overhangs) */}
      {/* ======================================================== */}
      <group name="farmhouse-roof" position={[0, 3.3, -porchD / 4]}>
        {/* ပင်မအိမ် သွပ်မိုး ဘယ်ဘက်စောင်း (Left Roof Slope) */}
        <mesh position={[-houseW / 4 - 0.2, 0.75, 0]} rotation={[0, 0, Math.PI / 7]} castShadow>
          <boxGeometry args={[houseW / 2 + 0.8, 0.08, houseD + porchD + 1.2]} />
          <meshStandardMaterial color={selected ? '#38bdf8' : '#718096'} metalness={0.4} roughness={0.35} />
        </mesh>
        {/* ပင်မအိမ် သွပ်မိုး ညာဘက်စောင်း (Right Roof Slope) */}
        <mesh position={[houseW / 4 + 0.2, 0.75, 0]} rotation={[0, 0, -Math.PI / 7]} castShadow>
          <boxGeometry args={[houseW / 2 + 0.8, 0.08, houseD + porchD + 1.2]} />
          <meshStandardMaterial color={selected ? '#38bdf8' : '#718096'} metalness={0.4} roughness={0.35} />
        </mesh>
        {/* အမိုးခေါင် သွပ်ပြား (Roof Ridge Cap) */}
        <Box position={[0, 1.48, 0]} size={[0.4, 0.1, houseD + porchD + 1.25]} color="#4a5568" />
      </group>

      {/* အလင်းရောင်နှင့် ညမီးသီး (Warm Porch Light) */}
      <pointLight position={[0, 2.6, houseD / 2 - porchD / 2 + 1.0]} intensity={1.5} distance={10} color="#ffedd5" />
    </group>
  );
});
