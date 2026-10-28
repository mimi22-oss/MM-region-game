import { useMemo } from 'react';
import * as THREE from 'three';
import type { CustomAsset, CustomPart } from '../game/customAssets';

function getPartGeometry(part: CustomPart): THREE.BufferGeometry {
  if (part.shape === 'polygon') {
    const pts =
      part.points && part.points.length >= 3
        ? part.points
        : [
            [-0.3, -0.3],
            [0.3, -0.3],
            [0.3, 0.3],
            [-0.3, 0.3],
          ];
    const pos = part.position ?? [0, 0.5, 0];
    const size = part.size ?? [1, 1, 1];
    const cx = pos[0];
    const cz = pos[2];
    const sx = Math.max(0.001, size[0]);
    const sz = Math.max(0.001, size[2]);

    const shape = new THREE.Shape();
    // Normalized coordinates relative to part center so Three.js scale operates accurately
    const p0x = (pts[0][0] - cx) / sx;
    const p0z = (pts[0][1] - cz) / sz;
    shape.moveTo(p0x, -p0z);
    for (let k = 1; k < pts.length; k++) {
      const pkx = (pts[k][0] - cx) / sx;
      const pkz = (pts[k][1] - cz) / sz;
      shape.lineTo(pkx, -pkz);
    }
    shape.closePath();

    const eg = new THREE.ExtrudeGeometry(shape, {
      depth: 1,
      bevelEnabled: false,
    });
    // Center along extrusion axis from -0.5 to +0.5
    eg.translate(0, 0, -0.5);
    // Rotate so top-down 2D footprint extrudes vertically along Y-axis
    eg.rotateX(-Math.PI / 2);
    return eg;
  }

  switch (part.shape) {
    case 'cylinder':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    case 'sphere':
      return new THREE.SphereGeometry(0.5, 24, 18);
    case 'cone':
      return new THREE.ConeGeometry(0.5, 1, 24);
    case 'pyramid':
      return new THREE.ConeGeometry(0.5, 1, 4);
    case 'capsule':
      return new THREE.CapsuleGeometry(0.3, 0.4, 10, 18);
    case 'torus':
      return new THREE.TorusGeometry(0.35, 0.14, 14, 24);
    case 'dome':
      return new THREE.SphereGeometry(0.5, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    case 'wedge':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 3);
    case 'box':
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

function PartMesh({
  part,
  index,
  width,
  height,
  depth,
  color,
  isSelected,
  showVertices,
  selectedVertexIdx,
  onSelectPart,
}: {
  part: CustomPart;
  index: number;
  width: number;
  height: number;
  depth: number;
  color?: string;
  isSelected: boolean;
  showVertices?: boolean;
  selectedVertexIdx?: number | null;
  onSelectPart?: (index: number) => void;
}) {
  const geom = useMemo(
    () => getPartGeometry(part),
    [part.shape, part.points, part.position, part.size]
  );
  const edgesGeom = useMemo(() => new THREE.EdgesGeometry(geom, 24), [geom]);

  const pos = part.position ?? [0, 0.5, 0];
  const size = part.size ?? [1, 1, 1];
  const cx = pos[0];
  const cz = pos[2];
  const sx = Math.max(0.001, size[0]);
  const sz = Math.max(0.001, size[2]);

  return (
    <mesh
      position={[pos[0] * width, pos[1] * height, pos[2] * depth]}
      rotation={
        part.rotation
          ? (part.rotation.map(n => (n * Math.PI) / 180) as [number, number, number])
          : [0, 0, 0]
      }
      scale={[size[0] * width, size[1] * height, size[2] * depth]}
      castShadow
      receiveShadow
      geometry={geom}
      onClick={
        onSelectPart
          ? e => {
              e.stopPropagation();
              onSelectPart(index);
            }
          : undefined
      }
    >
      <meshStandardMaterial
        color={color ?? part.color}
        roughness={0.8}
        metalness={0.1}
        emissive={isSelected ? '#14b8a6' : '#000000'}
        emissiveIntensity={isSelected ? 0.35 : 0}
      />

      {/* 3D Edge Wireframe Lines for Selected Part */}
      {isSelected && (
        <lineSegments geometry={edgesGeom}>
          <lineBasicMaterial color="#5eead4" linewidth={2} />
        </lineSegments>
      )}

      {/* 3D Corner Vertex Indicators when in Vertex Edit Mode */}
      {showVertices &&
        isSelected &&
        part.shape === 'polygon' &&
        part.points?.map(([vx, vz], vIdx) => {
          const normX = (vx - cx) / sx;
          const normZ = (vz - cz) / sz;
          const isCur = vIdx === selectedVertexIdx;
          return (
            <group key={vIdx}>
              {/* Top corner node */}
              <mesh position={[normX, 0.5, normZ]}>
                <sphereGeometry args={[isCur ? 0.08 : 0.05, 8, 8]} />
                <meshBasicMaterial color={isCur ? '#fbbf24' : '#2dd4bf'} />
              </mesh>
              {/* Bottom corner node */}
              <mesh position={[normX, -0.5, normZ]}>
                <sphereGeometry args={[isCur ? 0.08 : 0.05, 8, 8]} />
                <meshBasicMaterial color={isCur ? '#fbbf24' : '#2dd4bf'} />
              </mesh>
            </group>
          );
        })}
    </mesh>
  );
}

export function CustomAssetModel({
  asset,
  dimensions,
  color,
  selectedPart,
  onSelectPart,
  editMode,
  selectedVertexIdx,
}: {
  asset: CustomAsset;
  dimensions?: { width: number; height?: number; depth: number };
  color?: string;
  selectedPart?: number;
  onSelectPart?: (index: number) => void;
  editMode?: boolean;
  selectedVertexIdx?: number | null;
}) {
  const [w, h, d] = Array.isArray(asset.dimensions) && asset.dimensions.length >= 3
    ? asset.dimensions
    : [2, 2, 2];
  const width = dimensions?.width ?? w,
    height = dimensions?.height ?? h,
    depth = dimensions?.depth ?? d;

  return (
    <group>
      {asset.parts.map((p, i) => (
        <PartMesh
          key={i}
          part={p}
          index={i}
          width={width}
          height={height}
          depth={depth}
          color={color}
          isSelected={selectedPart === i}
          showVertices={editMode && selectedPart === i}
          selectedVertexIdx={selectedVertexIdx}
          onSelectPart={onSelectPart}
        />
      ))}
    </group>
  );
}
