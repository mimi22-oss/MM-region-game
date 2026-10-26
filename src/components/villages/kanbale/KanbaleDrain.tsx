import { memo, useMemo, useRef } from 'react';
import { Group, MeshStandardMaterial } from 'three';
import { useRegionFrame as useFrame } from '../../RegionActivity';
import { Block } from '../../Primitives';
import { kanbaleDrain } from '../../../data/villages/kanbale/kanbaleDrain';

/**
 * ကံပုလဲရွာနှင့် မြို့သာရပ်ကွက်ကြား ရေနုတ်မြောင်း (Waterway Drain 3D Component)
 *
 * အဓိက Feature များ:
 * ၁။ OpenStreetMap / GeoJSON Centerline အတိုင်း ၈ မှတ်ဆက်သွယ်ထားသော 3D ရေနုတ်မြောင်း
 * ၂။ Width: scene_width_m (၁ မီတာ) တိကျစွာ သတ်မှတ်ထားသော ရေမျက်နှာပြင်
 * ၃။ မြေပြင်အောက် ချိုင့်ဝှမ်းသဏ္ဌာန် မြေနီ/ကွန်ကရစ်မြောင်းဘောင် (y = 0.05m) နှင့် ရေမျက်နှာပြင် (y = 0.12m)
 * ၄။ AH1 အာရှလမ်းမကြီး ဖြတ်ကူးရာနေရာ (u = 0, v = -140.60) တွင် လမ်းမကြီးအမြင့် (y = 0.18m) အတိုင်း
 *    ပြေပြစ်ချောမွေ့သော ကတ္တရာတံတားပြင်နှင့် ဘေးဘက် ကွန်ကရစ်လက်ရန်းများ (Safety Parapets)
 * ၅။ ကံပုလဲ ရွာတွင်းလမ်း ဆက်သွယ်ရာ တံတားငယ် (Culvert Slab)
 * ၆။ Collision စနစ်နှင့် ပေါင်းစပ်ထားပြီး လမ်းမကြီးပေါ်တွင် ကားနှင့် ကာတွန်းလူ ချောမွေ့စွာ ဖြတ်သန်းနိုင်ခြင်း
 */
export const KanbaleDrain = memo(function KanbaleDrain() {
  const waterMatRef = useRef<MeshStandardMaterial>(null);

  // ၁။ Polyline Segments တွက်ချက်ခြင်း
  const segments = useMemo(() => {
    return kanbaleDrain.points.slice(1).map(([u, v], i) => {
      const [a, b] = kanbaleDrain.points[i];
      const du = u - a;
      const dv = v - b;
      const length = Math.hypot(du, dv);
      const angleRot = -Math.atan2(dv, du);
      return {
        a,
        b,
        u,
        v,
        midU: (a + u) / 2,
        midV: (b + v) / 2,
        length,
        rotation: angleRot,
      };
    });
  }, []);

  // ၂။ ရေမျက်နှာပြင် လင်းလက်မှု သိမ်မွေ့စွာ လှုပ်ရှားခြင်း (Gentle Surface Shimmer)
  useFrame(({ clock }) => {
    if (waterMatRef.current) {
      waterMatRef.current.opacity = 0.84 + 0.08 * Math.sin(clock.elapsedTime * 1.8);
    }
  });

  const drainWidth = kanbaleDrain.depth; // 1.0 meter
  const bedWidth = drainWidth + 0.6; // 1.6 meters (earth/concrete bank)

  return (
    <group name="kanbale-waterway-drain" rotation={[0, kanbaleDrain.rotation, 0]}>
      {/* ======================================================== */}
      {/* ၁။ ရေနုတ်မြောင်း ဘောင်နှင့် ရေမျက်နှာပြင် Segments */}
      {/* ======================================================== */}
      {segments.map((s, i) => (
        <group
          key={`drain-seg-${i}`}
          position={[s.midU, 0, s.midV]}
          rotation={[0, s.rotation, 0]}
        >
          {/* မြောင်းကြမ်းပြင်နှင့် ကွန်ကရစ်/မြေသားဘောင် (Channel Bed) */}
          <Block
            x={0}
            y={0.05}
            z={0}
            w={s.length}
            h={0.10}
            d={bedWidth}
            color="#736952"
          />

          {/* ရေပြင်အလွှာ (Water Ribbon Surface, Width = 1.0m) */}
          <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[s.length, drainWidth]} />
            <meshStandardMaterial
              ref={i === 0 ? waterMatRef : undefined}
              color="#4d9395"
              metalness={0.25}
              roughness={0.35}
              transparent
              opacity={0.88}
            />
          </mesh>
        </group>
      ))}

      {/* ======================================================== */}
      {/* ၂။ ကွေ့ကောက်ရာ မျဉ်းဆုံမှတ်များ (Joint Disks) */}
      {/* ======================================================== */}
      {kanbaleDrain.points.map(([u, v], i) => (
        <group key={`drain-joint-${i}`} position={[u, 0, v]}>
          <mesh position={[0, 0.051, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[bedWidth / 2, 20]} />
            <meshStandardMaterial color="#736952" />
          </mesh>
          <mesh position={[0, 0.121, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[drainWidth / 2, 20]} />
            <meshStandardMaterial
              color="#4d9395"
              metalness={0.25}
              roughness={0.35}
              transparent
              opacity={0.88}
            />
          </mesh>
        </group>
      ))}

      {/* ======================================================== */}
      {/* ၃။ AH1 အာရှလမ်းမကြီး ဖြတ်ကူးတံတား (u = 0, v = -140.60) */}
      {/* ======================================================== */}
      <group position={[0, 0, -140.60]}>
        {/* လမ်းမကြီး ကတ္တရာပြင်နှင့် ညီညာသော လမ်းကူးတံတား (Walkable Deck, y = 0.18) */}
        <Block
          walkable
          x={0}
          y={0.18}
          z={0}
          w={14.0}
          h={0.06}
          d={4.5}
          color="#697574"
        />

        {/* အနောက်ဘက် လမ်းပခုံး ကွန်ကရစ်လက်ရန်း (West Parapet, u = -6.5) */}
        <Block
          walkable
          x={-6.5}
          y={0.42}
          z={0}
          w={0.34}
          h={0.48}
          d={4.5}
          color="#d6cfb9"
        />
        <Block
          x={-6.5}
          y={0.68}
          z={0}
          w={0.40}
          h={0.12}
          d={4.6}
          color="#eee8d5"
        />

        {/* အရှေ့ဘက် လမ်းပခုံး ကွန်ကရစ်လက်ရန်း (East Parapet, u = 6.5) */}
        <Block
          walkable
          x={6.5}
          y={0.42}
          z={0}
          w={0.34}
          h={0.48}
          d={4.5}
          color="#d6cfb9"
        />
        <Block
          x={6.5}
          y={0.68}
          z={0}
          w={0.40}
          h={0.12}
          d={4.6}
          color="#eee8d5"
        />

        {/* တံတားထိပ် တိုင်လုံးလေးများ (Corner End Posts) */}
        {[-2.2, 2.2].flatMap((pz) =>
          [-6.5, 6.5].map((px) => (
            <Block
              key={`post-${px}-${pz}`}
              x={px}
              y={0.46}
              z={pz}
              w={0.46}
              h={0.60}
              d={0.46}
              color="#d6cfb9"
            />
          ))
        )}

        {/* လမ်းအောက် ရေပြွန်ပေါက် (Culvert Headwalls) */}
        {[-6.7, 6.7].map((px) => (
          <Block
            key={`headwall-${px}`}
            x={px}
            y={0.08}
            z={0}
            w={0.25}
            h={0.16}
            d={1.8}
            color="#5c564b"
          />
        ))}
      </group>

      {/* ======================================================== */}
      {/* ၄။ ကံပုလဲ ရွာတွင်းလမ်း ဆက်စပ်ရာ တံတားငယ် (u = 551.5, v = 22.0) */}
      {/* ======================================================== */}
      <group position={[551.5, 0, 22.0]}>
        <Block
          walkable
          x={0}
          y={0.12}
          z={0}
          w={6.0}
          h={0.12}
          d={6.0}
          color="#b7ad95"
        />
      </group>
    </group>
  );
});
