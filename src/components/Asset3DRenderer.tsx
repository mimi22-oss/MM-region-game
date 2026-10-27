import React, { memo, useMemo, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LayoutFeature } from '../game/worldLayout';
import { getAssetDefinition, ASSET_REGISTRY, type AssetDefinition } from '../game/assetRegistry';
import { angle, farmhouse } from '../data/ward';
import { uShweHouseCoords } from '../data/ushwehouse';
import { nankaleinTeaShopData } from '../data/wards/kalayArea1/kalayArea1TeaShop';
import { TOIL_X, TOIL_Z, TOIL_ROT } from './ToiletBlock';
import { PUMP_X, PUMP_Z, PUMP_ROT } from './WaterPump';
import { kalaySignCoords, KALAY_SIGN_ROTATION } from '../data/kalaySignboard';
import { area5 } from '../data/wards/myothar/area5';

// Authoritative 3D Components
import { House, WireMeshSegment, BlueSheetFrontFence } from './House';
import { SiTharBuilding } from './villages/sithar/SiTharBuilding';
import { NatmyaungBuilding } from './villages/natmyaung/NatmyaungBuilding';
import { FarmhouseBuilding } from './Farmhouse';
import { UShweHouse } from './ushwehouse';
import { KalayArea1TeaShop, TeaTable } from './wards/kalayArea1/KalayArea1TeaShop';
import { KanbaleSchool } from './villages/kanbale/KanbaleSchool';
import { KanbaleRiceMill } from './villages/kanbale/KanbaleRiceMill';
import { ToiletBlock } from './ToiletBlock';
import { Tree } from './Tree';
import { MangoTree } from './MangoTrees';
import { TamarindTree } from './TamarindTrees';
import { WaterPump } from './WaterPump';
import { KalaySignboard } from './KalaySignboard';
import { FootballPitch } from './wards/myothar/FootballPitch';
import { MotorcycleModel } from './Motorcycle';
import { Car } from './Car';
import { MyanmarFireBalloon } from './MyanmarFireBalloon';
import { CandleInHolder } from './Candle';
import { Box } from './Primitives';

export function FootballGoalModel({ width = 7.44, height = 2.44, depth = 2.44 }: { width?: number; height?: number; depth?: number }) {
  const halfW = width / 2;
  const postThickness = 0.12;
  return (
    <group name="football-goal">
      {[-1, 1].map((s) => (
        <Box key={s} position={[s * halfW, height / 2, 0]} size={[postThickness, height, postThickness]} color="#ffffff" />
      ))}
      <Box position={[0, height, 0]} size={[width + postThickness, postThickness, postThickness]} color="#ffffff" />
      {[-1, 1].map((s) => (
        <Box key={s} position={[s * halfW, 0.05, depth / 2]} size={[postThickness, 0.08, depth]} color="#e2e8f0" />
      ))}
      <Box position={[0, 0.05, depth]} size={[width, 0.08, postThickness]} color="#e2e8f0" />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * halfW, height / 2, depth / 2]} rotation={[Math.atan2(depth, height), 0, 0]}>
          <boxGeometry args={[0.06, Math.hypot(height, depth), 0.06]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      ))}
    </group>
  );
}

export function FootballCenterCircleModel({ radius = 9.15 }: { radius?: number }) {
  return (
    <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[Math.max(0.1, radius - 0.15), radius, 64]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
}

export function FootballLinesModel({ width = 60, depth = 96 }: { width?: number; depth?: number }) {
  const halfW = width / 2;
  const halfD = depth / 2;
  return (
    <group position={[0, 0.12, 0]}>
      {[-1, 1].map((s) => (
        <Box key={s} position={[s * halfW, 0, 0]} size={[0.15, 0.04, depth]} color="#eee9d2" />
      ))}
      {[-1, 1].map((s) => (
        <Box key={s} position={[0, 0, s * halfD]} size={[width, 0.04, 0.15]} color="#eee9d2" />
      ))}
      <Box position={[0, 0, 0]} size={[width, 0.04, 0.15]} color="#eee9d2" />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box position={[0, 0, s * (halfD - 16)]} size={[36, 0.04, 0.15]} color="#eee9d2" />
          {[-1, 1].map((t) => (
            <Box key={t} position={[t * 18, 0, s * (halfD - 8)]} size={[0.15, 0.04, 16]} color="#eee9d2" />
          ))}
        </group>
      ))}
    </group>
  );
}

export function FootballSurfaceModel({ width = 68, depth = 104 }: { width?: number; depth?: number }) {
  const stripeCount = 8;
  const stripeLen = depth / stripeCount;
  return (
    <group position={[0, 0.04, 0]}>
      <Box position={[0, 0, 0]} size={[width, 0.08, depth]} color="#81925c" />
      {Array.from({ length: stripeCount }, (_, i) => (
        <Box
          key={i}
          position={[0, 0.05, -depth / 2 + stripeLen / 2 + i * stripeLen]}
          size={[Math.max(1, width - 8), 0.04, stripeLen]}
          color={i % 2 ? '#668b50' : '#719858'}
        />
      ))}
    </group>
  );
}

export interface Asset3DInstanceProps {
  assetId?: string;
  position?: [number, number, number];
  rotation?: number; // radians around Y
  scale?: [number, number, number] | number;
  dimensions?: { width: number; depth: number; height?: number };
  color?: string;
  roofColor?: string;
  id?: string;
  name?: string;
  feature?: LayoutFeature;
  selected?: boolean;
  onClick?: (e: unknown) => void;
}

/**
 * Procedural standalone warehouse building matching Warehouses.tsx geometry
 */
function SingleWarehouseModel({
  width = 14,
  depth = 22,
  color = '#607d8b',
  roofColor = '#455a64',
}: {
  width?: number;
  depth?: number;
  color?: string;
  roofColor?: string;
}) {
  const pitchAngle = Math.atan2(1.6, width / 2);
  const slopeLen = Math.hypot(width / 2, 1.6) + 1.0;
  return (
    <group name="single-warehouse">
      <Box position={[0, 0.15, 0]} size={[width + 2, 0.3, depth + 2]} color="#baa98d" />
      <Box position={[0, 3.5, 0]} size={[width, 7, depth]} color={color} />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (width / 4), 7.8, 0]}
          rotation={[0, 0, -side * pitchAngle]}
          castShadow
        >
          <boxGeometry args={[slopeLen, 0.22, depth + 1.8]} />
          <meshStandardMaterial color={roofColor} roughness={0.8} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            position={[side * (width / 2 + 0.04), 2.4, 0]}
            size={[0.12, 4.8, Math.min(8, depth * 0.4)]}
            color="#526564"
          />
        </group>
      ))}
    </group>
  );
}

/**
 * Universal 3D Asset Instance component.
 * Selects the exact authoritative TSX mesh corresponding to assetId.
 */
export const Asset3DInstance = memo(function Asset3DInstance(props: Asset3DInstanceProps) {
  const {
    assetId = props.feature?.assetId,
    position = [props.feature?.points[0]?.x ?? 0, 0, props.feature?.points[0]?.z ?? 0],
    rotation = props.feature?.rotation ?? 0,
    scale = props.feature?.scale ?? 1,
    dimensions = props.feature?.dimensions,
    color = props.feature?.color,
    roofColor = props.feature?.roofColor,
    id = props.feature?.id ?? 'asset-instance',
    name = props.feature?.name ?? 'Asset Instance',
    selected = false,
    onClick,
  } = props;

  const def: AssetDefinition | undefined = getAssetDefinition(assetId);
  const effectiveWidth = dimensions?.width ?? def?.defaultDimensions.width ?? 8;
  const effectiveDepth = dimensions?.depth ?? def?.defaultDimensions.depth ?? 8;
  const effectiveColor = color ?? def?.defaultColor ?? '#baa892';
  const effectiveRoof = roofColor ?? def?.defaultRoofColor ?? '#687788';

  const scaleVec: [number, number, number] = Array.isArray(scale)
    ? scale
    : [scale, scale, scale];

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onClick?.(e);
  };

  // Render content based on assetId
  let content: React.ReactNode = null;

  switch (assetId) {
    case 'building:myothar-house': {
      // House.tsx expects rotation = angle + Math.PI/2 at (0,0).
      // We counter-rotate inside group so net rotation is exactly `rotation`.
      const netRot = rotation - (angle + Math.PI / 2);
      content = (
        <group rotation={[0, netRot, 0]}>
          <House
            ignoreEdits
            h={
              {
                id,
                name,
                x: 0,
                z: 0,
                width: effectiveWidth,
                depth: effectiveDepth,
                color: effectiveColor,
                roof: effectiveRoof,
              } as any
            }
          />
        </group>
      );
      break;
    }

    case 'building:sithar-house': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <SiTharBuilding
            ignoreEdits
            building={
              {
                id,
                type: 'house',
                x: 0,
                z: 0,
                houseWidth: effectiveWidth,
                houseLength: effectiveDepth,
                width: effectiveWidth,
                depth: effectiveDepth,
                wallColor: effectiveColor,
                roofColor: effectiveRoof,
                rotation: 0,
                storeys: 2,
                area: effectiveWidth * effectiveDepth,
              } as any
            }
            selected={selected}
          />
        </group>
      );
      break;
    }

    case 'building:natmyaung-house': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <NatmyaungBuilding
            ignoreEdits
            building={
              {
                id,
                type: 'house',
                x: 0,
                z: 0,
                houseWidth: effectiveWidth,
                houseLength: effectiveDepth,
                width: effectiveWidth,
                depth: effectiveDepth,
                wallColor: effectiveColor,
                roofColor: effectiveRoof,
                rotation: 0,
                storeys: 2,
                area: effectiveWidth * effectiveDepth,
              } as any
            }
            selected={selected}
          />
        </group>
      );
      break;
    }

    case 'building:farmhouse': {
      // FarmhouseBuilding is hardcoded to farmhouse.x / farmhouse.z and rot.
      // Offset by -farmhouse coords and counter-rotate.
      const fhRot = angle + Math.PI / 2;
      content = (
        <group
          position={[-farmhouse.x, 0, -farmhouse.z]}
          rotation={[0, rotation - fhRot, 0]}
        >
          <FarmhouseBuilding ignoreEdits />
        </group>
      );
      break;
    }

    case 'building:u-shwe-house': {
      const usRot = angle + Math.PI / 2;
      content = (
        <group
          position={[-uShweHouseCoords.x, 0, -uShweHouseCoords.z]}
          rotation={[0, rotation - usRot, 0]}
        >
          <UShweHouse ignoreEdits />
        </group>
      );
      break;
    }

    case 'building:tea-shop': {
      const ts = nankaleinTeaShopData;
      content = (
        <group
          position={[-ts.x, 0, -ts.z]}
          rotation={[0, rotation - ts.rotation, 0]}
        >
          <KalayArea1TeaShop ignoreEdits />
        </group>
      );
      break;
    }

    case 'building:village-school': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <KanbaleSchool
            building={
              {
                id,
                name: 'Village School',
                type: 'school',
                x: 0,
                z: 0,
                rotation: 0,
                area: effectiveWidth * effectiveDepth,
              } as any
            }
            selected={selected}
          />
        </group>
      );
      break;
    }

    case 'building:rice-mill': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <KanbaleRiceMill
            building={
              {
                id,
                name: 'Rice Mill',
                type: 'ricemill',
                x: 0,
                z: 0,
                rotation: 0,
                area: effectiveWidth * effectiveDepth,
              } as any
            }
            selected={selected}
          />
        </group>
      );
      break;
    }

    case 'building:warehouse': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <SingleWarehouseModel
            width={effectiveWidth}
            depth={effectiveDepth}
            color={effectiveColor}
            roofColor={effectiveRoof}
          />
        </group>
      );
      break;
    }

    case 'building:toilet-block': {
      content = (
        <group
          position={[-TOIL_X, 0, -TOIL_Z]}
          rotation={[0, rotation - TOIL_ROT, 0]}
        >
          <ToiletBlock />
        </group>
      );
      break;
    }

    case 'nature:shade-tree': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <Tree t={{ id, x: 0, z: 0, radius: 1.2 }} variant="large" />
        </group>
      );
      break;
    }

    case 'nature:canopy-tree': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <Tree t={{ id, x: 0, z: 0, radius: 0.9 }} variant="canopy" />
        </group>
      );
      break;
    }

    case 'nature:farm-tree': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <Tree t={{ id, x: 0, z: 0, radius: 0.6 }} variant="farm" />
        </group>
      );
      break;
    }

    case 'nature:mango-tree': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <MangoTree t={{ id, x: 0, z: 0, seed: 1 } as any} />
        </group>
      );
      break;
    }

    case 'nature:tamarind-tree': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <TamarindTree t={{ id, x: 0, z: 0, seed: 1 } as any} />
        </group>
      );
      break;
    }

    case 'infrastructure:water-pump': {
      content = (
        <group
          position={[-PUMP_X, 0, -PUMP_Z]}
          rotation={[0, rotation - PUMP_ROT, 0]}
        >
          <WaterPump />
        </group>
      );
      break;
    }

    case 'infrastructure:kalay-signboard': {
      content = (
        <group
          position={[-kalaySignCoords.x, 0, -kalaySignCoords.z]}
          rotation={[0, rotation - KALAY_SIGN_ROTATION, 0]}
        >
          <KalaySignboard />
        </group>
      );
      break;
    }

    case 'infrastructure:wire-fence': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <WireMeshSegment length={effectiveWidth} />
        </group>
      );
      break;
    }

    case 'infrastructure:home-gate': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <BlueSheetFrontFence width={effectiveWidth} />
        </group>
      );
      break;
    }

    case 'infrastructure:football-pitch': {
      const pitch = area5.pitch;
      content = (
        <group
          position={[-pitch.x, 0, -pitch.z]}
          rotation={[0, rotation - pitch.rotation, 0]}
        >
          <FootballPitch />
        </group>
      );
      break;
    }

    case 'infrastructure:football-goal': {
      const w = effectiveWidth || 7.44;
      const d = effectiveDepth || 2.44;
      const h = dimensions?.height ?? def?.defaultDimensions.height ?? 2.44;
      content = (
        <group rotation={[0, rotation, 0]}>
          <FootballGoalModel width={w} depth={d} height={h} />
        </group>
      );
      break;
    }

    case 'infrastructure:football-center-circle': {
      const r = (effectiveWidth || 18.3) / 2;
      content = (
        <group rotation={[0, rotation, 0]}>
          <FootballCenterCircleModel radius={r} />
        </group>
      );
      break;
    }

    case 'infrastructure:football-lines': {
      const w = effectiveWidth || 60;
      const d = effectiveDepth || 96;
      content = (
        <group rotation={[0, rotation, 0]}>
          <FootballLinesModel width={w} depth={d} />
        </group>
      );
      break;
    }

    case 'infrastructure:football-pitch-surface': {
      const w = effectiveWidth || 68;
      const d = effectiveDepth || 104;
      content = (
        <group rotation={[0, rotation, 0]}>
          <FootballSurfaceModel width={w} depth={d} />
        </group>
      );
      break;
    }

    case 'vehicle:motorcycle': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <MotorcycleModel />
        </group>
      );
      break;
    }

    case 'vehicle:compact-car': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <Car color={effectiveColor} model="compact" />
        </group>
      );
      break;
    }

    case 'vehicle:fire-balloon': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <MyanmarFireBalloon floating showCandle hasLight={false} />
        </group>
      );
      break;
    }

    case 'cultural:candle-in-holder': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <CandleInHolder lit hasLight={false} flameScale={1.3} />
        </group>
      );
      break;
    }

    case 'furniture:tea-table': {
      content = (
        <group rotation={[0, rotation, 0]}>
          <TeaTable table={{ id, du: 0, dv: 0, isOutdoor: true, seats: 4 } as any} />
        </group>
      );
      break;
    }

    default: {
      // Fallback: clean architectural building matching dimensions
      content = (
        <group rotation={[0, rotation, 0]}>
          <Box position={[0, 0.1, 0]} size={[effectiveWidth, 0.2, effectiveDepth]} color="#94a3b8" />
          <Box position={[0, 1.8, 0]} size={[effectiveWidth - 0.2, 3.2, effectiveDepth - 0.2]} color={effectiveColor} />
          <mesh position={[0, 3.8, 0]} castShadow>
            <coneGeometry args={[Math.hypot(effectiveWidth, effectiveDepth) * 0.45, 1.4, 4]} />
            <meshStandardMaterial color={effectiveRoof} roughness={0.7} />
          </mesh>
        </group>
      );
      break;
    }
  }

  return (
    <group
      position={position}
      scale={scaleVec}
      onClick={handleClick}
      name={`asset-instance-${id}`}
    >
      {content}
      {selected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[
              Math.max(effectiveWidth, effectiveDepth) * 0.65,
              Math.max(effectiveWidth, effectiveDepth) * 0.65 + 0.35,
              32,
            ]}
          />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      )}
    </group>
  );
});

/**
 * OrbitControls Camera Controller for the 3D Preview Canvas
 */
function PreviewCameraController({
  target = [0, 1.5, 0],
  distance = 12,
  autoRotate = true,
}: {
  target?: [number, number, number];
  distance?: number;
  autoRotate?: boolean;
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<ThreeOrbitControls | null>(null);

  useEffect(() => {
    camera.position.set(distance * 0.85, distance * 0.65, distance * 0.85);
    camera.lookAt(...target);

    const controls = new ThreeOrbitControls(camera, gl.domElement);
    controls.target.set(...target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.2;
    controls.maxDistance = distance * 4;
    controls.minDistance = 0.8;
    controlsRef.current = controls;

    let animId: number;
    const animate = () => {
      controls.update();
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, distance, autoRotate, target]);

  return null;
}

/**
 * Standalone interactive 3D Canvas Preview for any registered asset.
 * Rendered inside the Asset Library Panel / Modal.
 */
export function AssetPreviewCanvas({
  assetId,
  autoRotate = true,
}: {
  assetId: string;
  autoRotate?: boolean;
}) {
  const def = getAssetDefinition(assetId);
  const dims = def?.defaultDimensions ?? { width: 8, depth: 8, height: 6 };
  const maxSpan = Math.max(dims.width, dims.depth, dims.height ?? 6);
  const camDistance = Math.max(4.0, maxSpan * 1.6);
  const targetY = Math.min(3.5, (dims.height ?? 6) * 0.35);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'radial-gradient(circle at 50% 30%, #334155, #0f172a)' }}>
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 500 }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[15, 25, 20]} intensity={2.0} castShadow />
        <directionalLight position={[-15, 10, -10]} intensity={0.6} />

        {/* Circular ground presentation pedestal */}
        <mesh position={[0, -0.05, 0]} receiveShadow>
          <cylinderGeometry args={[maxSpan * 0.9 + 2, maxSpan * 0.9 + 2, 0.1, 48]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[maxSpan * 0.9 + 1.8, maxSpan * 0.9 + 2.0, 48]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
        </mesh>

        <Asset3DInstance
          assetId={assetId}
          position={[0, 0, 0]}
          rotation={0}
        />

        <PreviewCameraController
          target={[0, targetY, 0]}
          distance={camDistance}
          autoRotate={autoRotate}
        />
      </Canvas>
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: 12,
        color: '#94a3b8',
        fontSize: '11px',
        pointerEvents: 'none',
        textShadow: '0 1px 2px #000'
      }}>
        🖱️ Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}

/**
 * Asset 3D Modal Dialog for inspect/preview with place button
 */
export function Asset3DPreviewModal({
  assetId,
  onClose,
  onPlace,
}: {
  assetId: string;
  onClose: () => void;
  onPlace: (assetId: string) => void;
}) {
  const def = getAssetDefinition(assetId);
  if (!def) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '850px',
        maxWidth: '94vw',
        height: '560px',
        maxHeight: '90vh',
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #334155',
        color: '#f8fafc',
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid #334155',
        }}>
          <div>
            <span style={{ fontSize: '18px', fontWeight: 600 }}>{def.name}</span>
            <span style={{ marginLeft: '10px', color: '#38bdf8', fontSize: '14px' }}>{def.nameMm}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body: 3D Viewport on Left, Specs on Right */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ flex: '1 1 60%', height: '100%', position: 'relative' }}>
            <AssetPreviewCanvas assetId={assetId} />
          </div>

          <div style={{
            flex: '0 0 320px',
            padding: '20px',
            backgroundColor: '#1e293b',
            borderLeft: '1px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflowY: 'auto',
          }}>
            <div>
              <div style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#334155', fontSize: '12px', color: '#38bdf8', marginBottom: '12px', textTransform: 'uppercase' }}>
                {def.category}
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#cbd5e1', margin: '0 0 16px 0' }}>
                {def.description}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Asset ID</span>
                  <code style={{ color: '#facc15', fontSize: '11px' }}>{def.assetId}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Component</span>
                  <span style={{ color: '#f8fafc' }}>{def.sourceComponent}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Footprint</span>
                  <span style={{ color: '#f8fafc' }}>{def.defaultDimensions.width}m × {def.defaultDimensions.depth}m</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Height</span>
                  <span style={{ color: '#f8fafc' }}>{def.defaultDimensions.height ?? 'Variable'}m</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Collision</span>
                  <span style={{ color: '#f8fafc', textTransform: 'capitalize' }}>{def.collision.type}</span>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {def.tags.map(t => (
                  <span key={t} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#0f172a', color: '#94a3b8' }}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  onPlace(assetId);
                  onClose();
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#0284c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>➕</span> Place on Map
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#334155',
                  color: '#e2e8f0',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
