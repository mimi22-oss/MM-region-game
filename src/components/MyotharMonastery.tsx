import { ward } from '../data/ward';
import { getMonasteryBuildingAssetCache } from '../game/monasteryAssets';
import {
  MYOTHAR_FLAGPOLE_LOCAL,
  MYOTHAR_MONASTERY_BUILDINGS,
  MYOTHAR_MONASTERY_STUPAS,
} from '../game/monasteryLayout';
import {
  BuddhistFlagPole,
  MonasteryBuilding,
} from './monastery/MonasteryBuildings';
import { GoldenStupa } from './monastery/GoldenStupa';

/**
 * မြို့သာ နယ်မြေ(၅)ရပ်ကွက် ဘုန်းတော်ကြီးကျောင်း (Myothar Area 5 Theravada Buddhist Monastery)
 *
 * Composes 4 reusable walk-in 2-storey monastery buildings with interior staircases
 * (`သိမ်မဏ္ဍပ် · ဇရပ်`, `ဓမ္မာရုံ`, `ဘုန်းကြီးကျောင်းဆောင်`, `ဆွမ်းစားဆောင် နှင့် ဆွမ်းပစ္စည်းခန်း`),
 * ceremonial courtyard, 6-color Buddhist flag, and 3 golden stupas — backed 100% by
 * the Singleton Memory Reference Cache (`getMonasteryBuildingAssetCache()`).
 */
export function MyotharMonastery() {
  const m = ward.monastery;
  const c = getMonasteryBuildingAssetCache();

  return (
    <group name="myothar-area-5-monastery">
      {/* Monastery Compound Terrace, Courtyard & Refectory Apron */}
      <group position={[m.x, 0, m.z]} rotation={[0, m.rotation, 0]}>
        <mesh
          position={[0, 0.02, 0]}
          scale={[m.width, 0.04, m.depth]}
          geometry={c.unitBoxGeo}
          material={c.courtyardPaveMat}
          receiveShadow
          userData={{ walkable: true }}
        />
        <mesh
          position={[0, 0.05, -18]}
          scale={[80, 0.04, 22]}
          geometry={c.unitBoxGeo}
          material={c.courtyardInnerMat}
          receiveShadow
          userData={{ walkable: true }}
        />
        {/* Ceremonial central walkway linking courtyard to Dhamma Hall */}
        <mesh
          position={[0, 0.065, -14]}
          scale={[5.6, 0.04, 15]}
          geometry={c.unitBoxGeo}
          material={c.ivoryPlinthMat}
          receiveShadow
          userData={{ walkable: true }}
        />
        {/* Paved courtyard apron linking Mandap, Monks' Quarters & Refectory Dining Hall */}
        <mesh
          position={[-32, 0.03, 27]}
          scale={[28, 0.04, 20]}
          geometry={c.unitBoxGeo}
          material={c.courtyardPaveMat}
          receiveShadow
          userData={{ walkable: true }}
        />
        <mesh
          position={[-17.5, 0.055, 25]}
          scale={[10, 0.04, 5.2]}
          geometry={c.unitBoxGeo}
          material={c.ivoryPlinthMat}
          receiveShadow
          userData={{ walkable: true }}
        />
        <BuddhistFlagPole x={MYOTHAR_FLAGPOLE_LOCAL.x} z={MYOTHAR_FLAGPOLE_LOCAL.z} />
      </group>

      {/* 4 Reusable Walk-In 2-Storey Myanmar Monastery Buildings (with Interior Stairs) */}
      {MYOTHAR_MONASTERY_BUILDINGS.map((spec) => (
        <MonasteryBuilding key={spec.id} spec={spec} />
      ))}

      {/* 3 Reusable Myanmar Golden Stupas (`စေတီတော် ၃ ဆူ`) */}
      {MYOTHAR_MONASTERY_STUPAS.map(stupa => (
        <GoldenStupa key={stupa.id} placement={stupa} northYaw={m.rotation} />
      ))}
    </group>
  );
}
