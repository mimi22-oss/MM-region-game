import {
  disposeChristianChurchAssetCache,
  getChristianChurchAssetCache,
  type ChristianChurchAssetCache,
} from '../game/christianChurchAssets';

export {
  disposeChristianChurchAssetCache,
  getChristianChurchAssetCache,
  type ChristianChurchAssetCache,
};

export type ChristianChurchVariant =
  | 'sanctuary'
  | 'bell-tower'
  | 'kingdom-hall'
  | 'steeple-church';

export interface ChristianChurchProps {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  wallColor: string;
  roofColor: string;
  variant: ChristianChurchVariant;
  /** Used by 'steeple-church' (e.g. Kyar Inn Baptist, IBC, CJC, St. Peter Catholic Church). */
  steepleHeight?: number;
  isCatholic?: boolean;
}

/**
 * ခရစ်ယာန် ဘုရားကျောင်း လက်ဝါးကပ်တိုင် (Dedicated Reusable Christian Cross Component)
 */
export function ChristianCross({
  y,
  axis = 'x',
  bright = false,
}: {
  y: number;
  axis?: 'x' | 'z';
  bright?: boolean;
}) {
  const c = getChristianChurchAssetCache();
  const mat = bright ? c.steepleCrossGoldMat : c.crossGoldMat;
  const thickness = bright ? 0.25 : 0.32;
  const crossArmY = bright ? 1.6 : 1.7;

  return (
    <group name="christian-cross" position={[0, y, 0]}>
      <mesh
        position={[0, 1.2, 0]}
        scale={[thickness, 2.4, thickness]}
        geometry={c.unitBoxGeo}
        material={mat}
        castShadow
      />
      <mesh
        position={[0, crossArmY, 0]}
        scale={axis === 'x' ? [1.5, thickness, thickness] : [thickness, thickness, 1.5]}
        geometry={c.unitBoxGeo}
        material={mat}
        castShadow
      />
    </group>
  );
}

/**
 * ခရစ်ယာန် ဘုရားကျောင်း သီးသန့် Component (Dedicated Standalone Christian Church Component)
 *
 * Distinct from traditional residential houses and Buddhist monasteries.
 * Preserves authentic architecture for:
 *  - 'sanctuary': Catholic sanctuary hall with pitched roof, tall side windows, front doors & golden cross
 *    (e.g. St. Assumption Catholic Church, Thar Yar Gone)
 *  - 'bell-tower': Standalone church bell tower with pyramid spire & golden cross
 *    (e.g. St. Assumption Church Bell Tower, Thar Yar Gone)
 *  - 'kingdom-hall': Kingdom Hall of Jehovah's Witnesses worship hall
 *  - 'steeple-church': Full sanctuary + integrated bell tower / Gothic or pyramid spire + golden cross
 *    (e.g. Baptist, IBC, CJC & St. Peter Catholic Churches in Kyar Inn)
 */
export function ChristianChurch({
  id,
  name,
  x,
  z,
  width,
  depth,
  height,
  rotation,
  wallColor,
  roofColor,
  variant,
  steepleHeight,
  isCatholic = false,
}: ChristianChurchProps) {
  const c = getChristianChurchAssetCache();

  if (variant === 'steeple-church') {
    const steepleH = steepleHeight ?? height + 6;
    const pitch = 3.2;
    const spireHeight = isCatholic ? 7.2 : 5.2;
    const spireRadius = isCatholic ? 2.8 : 3.4;

    return (
      <group
        name={`christian-church-${id}`}
        userData={{ churchId: id, name, variant }}
        position={[x, 0, z]}
        rotation={[0, rotation, 0]}
      >
        {/* အောက်ခြေ ကျောက်သား ပန္နက် */}
        <mesh
          position={[0, 0.25, 0]}
          scale={[width + 1.6, 0.5, depth + 1.6]}
          geometry={c.unitBoxGeo}
          material={c.kyarinnPlinthMat}
          receiveShadow
        />

        {/* ပင်မ ဝတ်ပြုဆောင်မကြီး (Sanctuary Hall) */}
        <mesh
          position={[0, height / 2, 0]}
          scale={[width, height, depth]}
          geometry={c.unitBoxGeo}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={wallColor} roughness={0.85} />
        </mesh>

        {/* စောက်နက်သော ခရစ်ယာန် ဘုရားကျောင်း အမိုး */}
        {([-1, 1] as const).map(s => (
          <mesh
            key={`roof-${s}`}
            position={[0, height + 1.2, s * (depth / 4)]}
            rotation={[s * Math.atan2(pitch, depth / 2), 0, 0]}
            scale={[width + 1.4, 0.28, Math.hypot(depth / 2, pitch) + 1]}
            geometry={c.unitBoxGeo}
            castShadow
          >
            <meshStandardMaterial color={roofColor} roughness={0.7} />
          </mesh>
        ))}

        {/* ခေါင်းလောင်းမျှော်စင် (Bell Tower / Steeple) */}
        <group position={[-width / 2 + 3.5, 0, 0]}>
          <mesh
            position={[0, steepleH / 2, 0]}
            scale={[6, steepleH, 6]}
            geometry={c.unitBoxGeo}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
          {([-1, 1] as const).map(sx => (
            <mesh
              key={`louver-${sx}`}
              position={[sx * 2.5, steepleH - 1.8, 0]}
              scale={[0.15, 2.2, 2]}
              geometry={c.unitBoxGeo}
              material={c.towerLouverMat}
            />
          ))}
          <mesh
            position={[0, steepleH + spireHeight / 2, 0]}
            scale={[spireRadius, spireHeight, spireRadius]}
            geometry={isCatholic ? c.gothicSpireGeo : c.pyramidSpireGeo}
            castShadow
          >
            <meshStandardMaterial color={roofColor} roughness={0.6} />
          </mesh>
          <ChristianCross y={steepleH + (isCatholic ? 7.8 : 5.8)} axis="z" bright />
        </group>

        {/* ဘုရားကျောင်း မျက်နှာစာ ဝင်ပေါက်တံခါးကြီးနှင့် ပြတင်းပေါက်ရှည်များ */}
        <mesh
          position={[-width / 2 - 0.15, 2.2, 0]}
          scale={[0.3, 3.4, 2.6]}
          geometry={c.unitBoxGeo}
          material={c.steepleDoorMat}
        />
        {[-6, 0, 6].map(xx => (
          <group key={`win-${xx}`}>
            <mesh
              position={[xx, height * 0.55, depth / 2 + 0.08]}
              scale={[1.8, 3.2, 0.14]}
              geometry={c.unitBoxGeo}
              material={c.tallWindowGlassMat}
            />
            <mesh
              position={[xx, height * 0.55, -depth / 2 - 0.08]}
              scale={[1.8, 3.2, 0.14]}
              geometry={c.unitBoxGeo}
              material={c.tallWindowGlassMat}
            />
          </group>
        ))}
      </group>
    );
  }

  // 'sanctuary', 'bell-tower', and 'kingdom-hall' (e.g. St. Assumption Catholic Church, Bell Tower, Kingdom Hall)
  return (
    <group
      name={`christian-church-${id}`}
      userData={{ churchId: id, name, variant }}
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
    >
      {/* အောက်ခြေ ကျောက်သား ပန္နက်ခုံ */}
      <mesh
        position={[0, 0.2, 0]}
        scale={[width + 1.8, 0.4, depth + 1.8]}
        geometry={c.unitBoxGeo}
        material={c.plinthStoneMat}
        receiveShadow
      />

      {variant === 'bell-tower' ? (
        <>
          <mesh
            position={[0, height / 2, 0]}
            scale={[width, height, depth]}
            geometry={c.unitBoxGeo}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
          <mesh
            position={[0, height - 3, 0]}
            scale={[width + 0.4, 0.5, depth + 0.4]}
            geometry={c.unitBoxGeo}
            material={c.corniceMat}
          />
          <mesh
            position={[0, height + 2.4, 0]}
            scale={[width * 0.78, 4.8, width * 0.78]}
            geometry={c.pyramidSpireGeo}
            castShadow
          >
            <meshStandardMaterial color={roofColor} roughness={0.7} />
          </mesh>
          <ChristianCross y={height + 4.6} axis="x" />
        </>
      ) : (
        <>
          {/* ပင်မ ဝတ်ပြုဆောင်မကြီး */}
          <mesh
            position={[0, height / 2, 0]}
            scale={[width, height, depth]}
            geometry={c.unitBoxGeo}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
          {/* အမိုးစောက် ၂ ဖက် */}
          {([-1, 1] as const).map(s => (
            <mesh
              key={`slope-${s}`}
              position={[s * (width / 4), height + 1.1, 0]}
              rotation={[0, 0, -s * Math.atan2(2.2, width / 2)]}
              scale={[Math.hypot(width / 2, 2.2) + 1.4, 0.24, depth + 1.6]}
              geometry={c.unitBoxGeo}
              castShadow
            >
              <meshStandardMaterial color={roofColor} roughness={0.72} />
            </mesh>
          ))}
          {variant === 'sanctuary' && (
            <>
              {/* ဘုရားကျောင်း ဘေးပြတင်းပေါက်များနှင့် ရှေ့တံခါးကြီး */}
              {([-1, 1] as const).map(s =>
                [-5, 0, 5].map(zz => (
                  <mesh
                    key={`win-${s}-${zz}`}
                    position={[s * (width / 2 + 0.05), 4.2, zz]}
                    scale={[0.15, 2.6, 1.3]}
                    geometry={c.unitBoxGeo}
                    material={c.sanctuaryWindowMat}
                  />
                )),
              )}
              <mesh
                position={[0, 2.1, depth / 2 + 0.08]}
                scale={[2.6, 3.8, 0.15]}
                geometry={c.unitBoxGeo}
                material={c.sanctuaryDoorMat}
              />
              <ChristianCross y={height + 2.4} axis="x" />
            </>
          )}
        </>
      )}
    </group>
  );
}
