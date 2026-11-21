import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { Group } from 'three';
import {
  tharYarGoneVillage,
  tharYarGoneStream,
  tharYarGoneLandmarks,
  tharYarGoneLandmarkBuildings,
  type TharYarGoneLandmarkBuilding,
} from '../../../data/villages/tharyargone';
import { angle, toWorld } from '../../../data/ward';
import { MainRoad } from '../../MainRoad';
import { Lanes } from '../../Lane';
import { Field } from '../../Field';
import { PolylineCanal } from '../../Canal';
import { houseVisualRotation } from '../../House';
import { ChinTraditionalHouseBatch, type ChinHouseBatchItem } from '../../ChinTraditionalHouse';
import { ChristianChurch, type ChristianChurchVariant } from '../../ChristianChurch';
import { Tree } from '../../Tree';
import { Block } from '../../Primitives';
import { sourceIsEdited } from '../../../game/worldEdits';
import { registerGroundRegion, releaseGroundRegion } from '../../../game/groundSurface';
import { defaultChinCompoundBounds } from '../../../game/chinVillagerPool';

const CHIN_TIMBER_WALLS = [
  '#6a482d',
  '#5c3b22',
  '#785233',
  '#4d311d',
  '#634227',
  '#734c2f',
] as const;

const CHIN_ROOF_COLORS = [
  '#7d3c2e',
  '#8a4435',
  '#2f523b',
  '#4f3d2e',
  '#52463e',
  '#3e5446',
] as const;

const VILLAGE_GROUND_POS = toWorld(-138, 2700);

function churchVariantForLandmark(
  kind: TharYarGoneLandmarkBuilding['kind'],
): ChristianChurchVariant | null {
  if (kind === 'church') return 'sanctuary';
  if (kind === 'tower') return 'bell-tower';
  if (kind === 'hall') return 'kingdom-hall';
  return null;
}

/** သာယာကုန်းကျေးရွာ၏ ဘုရားကျောင်းမဟုတ်သော အထင်ကရ အဆောက်အအုံများ (တည်းခိုခန်း၊ ဆိုင်၊ ဆန်စက်) */
function NonChurchLandmarkBuilding({ b }: { b: TharYarGoneLandmarkBuilding }) {
  const slope = (h: number) =>
    [-1, 1].map(s => (
      <mesh
        key={s}
        position={[s * (b.width / 4), h, 0]}
        rotation={[0, 0, -s * Math.atan2(2.2, b.width / 2)]}
        castShadow
      >
        <boxGeometry args={[Math.hypot(b.width / 2, 2.2) + 1.4, 0.24, b.depth + 1.6]} />
        <meshStandardMaterial color={b.roof} />
      </mesh>
    ));

  return (
    <group position={[b.x, 0, b.z]} rotation={[0, b.rotation, 0]}>
      <Block y={0.2} w={b.width + 1.8} h={0.4} d={b.depth + 1.8} color="#cfc4a9" />
      <Block y={b.height / 2} w={b.width} h={b.height} d={b.depth} color={b.color} />
      {slope(b.height + 1.1)}
      {b.kind === 'mill' && (
        <>
          <Block x={b.width / 2 - 3} y={b.height + 4} w={2.6} h={8} d={2.6} color="#8f8a82" />
          <Block
            x={-b.width / 4}
            y={b.height / 2 + 0.5}
            z={b.depth / 2 + 0.08}
            w={5}
            h={b.height - 2}
            d={0.15}
            color="#6e6a5a"
          />
        </>
      )}
      {b.kind === 'guesthouse' && (
        <Block
          y={b.height + 0.4}
          z={b.depth / 2 + 0.1}
          w={b.width * 0.7}
          h={0.8}
          d={0.14}
          color="#2a5c8a"
        />
      )}
      {b.kind === 'shop' && (
        <>
          <Block y={3.1} z={b.depth / 2 + 1.2} w={b.width + 0.8} h={0.16} d={2.4} color="#3b6e5c" />
          <Block y={3.7} z={b.depth / 2 + 2.3} w={b.width * 0.85} h={0.6} d={0.14} color="#c45b3e" />
        </>
      )}
    </group>
  );
}

/**
 * သာယာကုန်းကျေးရွာ (Thar Yar Gone Village) — 3D Scene Component
 * - လူနေအိမ်အားလုံးကို ကျယ်ဝန်းသော အိမ်ခြံဝန်း + အိမ်နှင့်တွဲနေသော အလိုအလျောက်ပွင့်ပိတ် အိမ်တံခါးပါ
 *   ချင်းရိုးရာ အောက်ချင်းငှက်ခေါင်မိုးအိမ်များ (`<ChinTraditionalHouseBatch flatGround showCompoundFence />`) ဖြင့် ပြသသည်။
 * - ချင်းရွာဖြစ်သောကြောင့် ချင်းလူမျိုးစု ရွာသူရွာသားများသာ (`<ChinVillagePopulation>`, တစ်အိမ်လျှင် ၁ ဦး မှ ၁၀ ဦး random,
 *   Singleton Memory Reference Cache + Fixed Object Pool) နေထိုင်သွားလာကြသည်။
 * - ခရစ်ယာန်ဘုရားကျောင်းများ (St. Assumption Catholic Church & Bell Tower, Kingdom Hall) ကို
 *   သီးသန့် `<ChristianChurch />` component ဖြင့် မူလအတိုင်း ထိန်းသိမ်းပြသထားသည်။
 */
export function TharYarGoneVillage() {
  const { scene } = useThree();
  const groundGroupRef = useRef<Group>(null);
  const walkableHousesRef = useRef<Group>(null);

  const chinResidentialHouses = useMemo<ChinHouseBatchItem[]>(() => {
    const residential = tharYarGoneVillage.houses.filter(
      h => !h.id.startsWith('tyg-landmark-') && !sourceIsEdited(h.id),
    );
    return residential.map((h, i) => {
      const isTwoStorey = i % 5 === 2;
      return {
        id: h.id,
        x: h.x,
        z: h.z,
        baseY: 0,
        width: h.width,
        depth: h.depth,
        height: isTwoStorey ? 4.7 : 3.65,
        rotation: houseVisualRotation(h),
        wallColor: CHIN_TIMBER_WALLS[i % CHIN_TIMBER_WALLS.length],
        roofColor: CHIN_ROOF_COLORS[(i * 3 + 1) % CHIN_ROOF_COLORS.length],
        hornbillScale: isTwoStorey ? 1.15 : 1.04,
        compound: defaultChinCompoundBounds(h.width, h.depth),
      };
    });
  }, []);

  useEffect(() => {
    if (groundGroupRef.current) {
      registerGroundRegion(scene, 'tharyargone-village-ground', groundGroupRef.current);
    }
    if (walkableHousesRef.current) {
      registerGroundRegion(scene, 'tharyargone-chin-house-decks', walkableHousesRef.current);
    }
    return () => {
      releaseGroundRegion(scene, 'tharyargone-chin-house-decks');
      releaseGroundRegion(scene, 'tharyargone-village-ground');
    };
  }, [scene]);

  return (
    <group name="village-tharyargone">
      {/* သာယာကုန်းကျေးရွာ မြေပြင်အခင်း (Dedicated Walkable Village Ground Plane cleanly below lanes & yards) */}
      <group ref={groundGroupRef} name="tharyargone-ground-surface">
        <mesh
          userData={{ walkable: true }}
          position={[VILLAGE_GROUND_POS.x, 0.008, VILLAGE_GROUND_POS.z]}
          rotation={[0, angle, 0]}
          receiveShadow
        >
          <boxGeometry args={[254, 0.016, 336]} />
          <meshStandardMaterial color="#738b56" roughness={0.95} />
        </mesh>
      </group>

      {tharYarGoneVillage.separationFields.map((f, i) => (
        <Field key={f.id ?? `tyg-sep-${i}`} f={f} bunded />
      ))}
      {tharYarGoneStream && <PolylineCanal p={tharYarGoneStream} />}
      {tharYarGoneLandmarks.map(m => (
        <group key={m.id} position={[m.x, 0, m.z]} rotation={[0, m.rotation, 0]}>
          <Block y={0.03} w={m.width} h={0.06} d={m.depth} color="#d1c7a8" />
        </group>
      ))}
      <MainRoad roads={tharYarGoneVillage.roads} />
      <Lanes roads={tharYarGoneVillage.roads} />
      {tharYarGoneVillage.fields.map((f, i) => (
        <Field key={f.id ?? `tyg-f-${i}`} f={f} bunded />
      ))}
      {tharYarGoneVillage.bundedFields.map((f, i) => (
        <Field key={f.id ?? `tyg-bf-${i}`} f={f} bunded />
      ))}

      {/* သာယာကုန်းကျေးရွာ ချင်းရိုးရာ အောက်ချင်းငှက်ခေါင်မိုးအိမ် + ကျယ်ဝန်းသော အိမ်ခြံဝန်း
          (အိမ်နှင့်တွဲနေသော ပွင့်ပိတ်တံခါးများနှင့် ချင်းလူမျိုးစု ၁–၁၀ ဦး/အိမ်ကို StreamedWorld မှ <ChinVillageBots /> က live မောင်းနှင်သည်) */}
      <ChinTraditionalHouseBatch
        houses={chinResidentialHouses}
        name="tharyargone-chin-hornbill-houses"
        walkableGroupRef={walkableHousesRef}
        flatGround
        showCompoundFence
        omitStaticDoorLeaves
      />

      {/* ခရစ်ယာန်ဘုရားကျောင်းများ (သီးသန့် ChristianChurch component) နှင့် ကျန်အထင်ကရ အဆောက်အအုံများ */}
      {tharYarGoneLandmarkBuildings.map(b => {
        const churchVariant = churchVariantForLandmark(b.kind);
        if (churchVariant) {
          return (
            <ChristianChurch
              key={b.id}
              id={b.id}
              name={b.name}
              x={b.x}
              z={b.z}
              width={b.width}
              depth={b.depth}
              height={b.height}
              rotation={b.rotation}
              wallColor={b.color}
              roofColor={b.roof}
              variant={churchVariant}
            />
          );
        }
        return <NonChurchLandmarkBuilding key={b.id} b={b} />;
      })}

      {tharYarGoneVillage.largeTrees.map((t, i) => (
        <Tree key={t.id} t={t} i={i} variant="large" />
      ))}
      {tharYarGoneVillage.trees.map((t, i) => (
        <Tree key={t.id} t={t} i={i} variant="canopy" />
      ))}
      {tharYarGoneVillage.farmTrees.map(t => (
        <Tree key={t.id} t={t} variant="farm" />
      ))}
    </group>
  );
}

/** သာယာကုန်းကျေးရွာ (Thar Yar Gone Village) — 2D Map Plan SVG Component */
export function TharYarGoneVillagePlan({
  labels,
  onSelectLocation,
}: {
  labels: boolean;
  onSelectLocation?: (id: string) => void;
}) {
  const wc = tharYarGoneStream;
  const residentialHouses = tharYarGoneVillage.houses.filter(h => !h.id.startsWith('tyg-landmark-'));
  return (
    <g
      id="village-tharyargone-plan"
      className={labels ? 'map-region-clickable' : undefined}
      onClick={
        labels && onSelectLocation
          ? e => {
              e.stopPropagation();
              onSelectLocation('tharyargone');
            }
          : undefined
      }
    >
      {tharYarGoneVillage.separationFields.map(f => (
        <rect
          key={f.id}
          x={f.x - f.width / 2}
          y={f.z - f.depth / 2}
          width={f.width}
          height={f.depth}
          fill={f.color}
          stroke="#c1b57f"
          strokeWidth="0.9"
          transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
        />
      ))}
      {wc && (
        <g transform={`rotate(${(-wc.rotation * 180) / Math.PI})`}>
          <polyline
            points={wc.points.map(p => p.join(',')).join(' ')}
            fill="none"
            stroke="#4d9395"
            strokeWidth={wc.depth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      )}
      {tharYarGoneLandmarks.map(m => (
        <rect
          key={m.id}
          x={m.x - m.width / 2}
          y={m.z - m.depth / 2}
          width={m.width}
          height={m.depth}
          fill="#d1c7a8"
          stroke="#8a7f5d"
          strokeWidth="0.8"
          transform={`rotate(${(-m.rotation * 180) / Math.PI} ${m.x} ${m.z})`}
        />
      ))}
      {tharYarGoneVillage.bundedFields.map(f => (
        <rect
          key={f.id}
          x={f.x - f.width / 2}
          y={f.z - f.depth / 2}
          width={f.width}
          height={f.depth}
          fill={f.color}
          stroke="#c1b57f"
          strokeWidth="0.9"
          transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
        />
      ))}
      {tharYarGoneVillage.fields.map(f => (
        <rect
          key={f.id}
          x={f.x - f.width / 2}
          y={f.z - f.depth / 2}
          width={f.width}
          height={f.depth}
          fill={f.color}
          stroke="#c1b57f"
          strokeWidth="0.8"
          transform={`rotate(${(-f.rotation * 180) / Math.PI} ${f.x} ${f.z})`}
        />
      ))}
      {tharYarGoneVillage.roads.map(r => (
        <rect
          key={r.id}
          x={r.x - r.width / 2}
          y={r.z - r.depth / 2}
          width={r.width}
          height={r.depth}
          fill={r.main ? '#657371' : '#d4bd98'}
          transform={`rotate(${(-r.rotation * 180) / Math.PI} ${r.x} ${r.z})`}
        />
      ))}
      {tharYarGoneLandmarkBuildings.map(b => (
        <rect
          key={b.id}
          x={b.x - b.width / 2}
          y={b.z - b.depth / 2}
          width={b.width}
          height={b.depth}
          fill={b.roof}
          stroke="#fff3d1"
          strokeWidth="0.8"
          transform={`rotate(${(-b.rotation * 180) / Math.PI} ${b.x} ${b.z})`}
        />
      ))}
      {residentialHouses.map((h, i) => {
        const { sideHalf, backHalf, frontHalf } = defaultChinCompoundBounds(h.width, h.depth);
        const rot = houseVisualRotation(h);
        const roofFill = CHIN_ROOF_COLORS[(i * 3 + 1) % CHIN_ROOF_COLORS.length];
        return (
          <g key={h.id}>
            <g transform={`translate(${h.x} ${h.z}) rotate(${(-rot * 180) / Math.PI})`}>
              <line
                x1={-sideHalf}
                y1={-backHalf}
                x2={-sideHalf}
                y2={frontHalf}
                stroke="#68767a"
                strokeWidth="0.6"
                strokeDasharray="1.2 0.8"
              />
              <line
                x1={sideHalf}
                y1={-backHalf}
                x2={sideHalf}
                y2={frontHalf}
                stroke="#68767a"
                strokeWidth="0.6"
                strokeDasharray="1.2 0.8"
              />
              <line x1={-sideHalf} y1={-backHalf} x2={sideHalf} y2={-backHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8" />
              <line x1={-sideHalf} y1={frontHalf} x2={-1.5} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1" />
              <line x1={1.5} y1={frontHalf} x2={sideHalf} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1" />
              <rect x={-h.width / 2} y={-h.depth / 2} width={h.width} height={h.depth} fill={roofFill} />
            </g>
          </g>
        );
      })}
      {tharYarGoneVillage.farmTrees.map(t => (
        <circle key={t.id} cx={t.x} cy={t.z} r="2.4" fill="#547b48" />
      ))}
      {tharYarGoneVillage.trees.map(t => (
        <circle key={t.id} cx={t.x} cy={t.z} r="5.8" fill="#365a42" />
      ))}
      {tharYarGoneVillage.largeTrees.map(t => (
        <circle key={t.id} cx={t.x} cy={t.z} r="6.5" fill="#486e40" stroke="#739451" strokeWidth="0.6" />
      ))}
      {labels && (
        <>
          <text
            x={tharYarGoneVillage.labelPos.x}
            y={tharYarGoneVillage.labelPos.z}
            textAnchor="middle"
            fontSize="14"
            fill="#fff9dc"
            stroke="#173d35"
            strokeWidth="0.45"
          >
            {tharYarGoneVillage.name} ↗
          </text>
          {tharYarGoneLandmarkBuildings
            .filter(b => b.kind !== 'tower' && b.kind !== 'shop')
            .map(b => (
              <text
                key={b.id}
                x={b.x}
                y={b.z - 10}
                textAnchor="middle"
                fontSize="8.5"
                fill="#fff6d6"
                stroke="#2d3b36"
                strokeWidth="0.3"
              >
                {b.name}
              </text>
            ))}
        </>
      )}
    </g>
  );
}
