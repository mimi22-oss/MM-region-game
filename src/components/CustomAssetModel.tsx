import type { CustomAsset } from '../game/customAssets';

export function CustomAssetModel({ asset, dimensions, color }: { asset: CustomAsset; dimensions?: { width: number; height?: number; depth: number }; color?: string }) {
  const [w, h, d] = asset.dimensions;
  const width = dimensions?.width ?? w, height = dimensions?.height ?? h, depth = dimensions?.depth ?? d;
  return <group>{asset.parts.map((p, i) => <mesh key={i} position={[p.position[0] * width, p.position[1] * height, p.position[2] * depth]} scale={[p.size[0] * width, p.size[1] * height, p.size[2] * depth]} castShadow receiveShadow>
    {p.shape === 'box' ? <boxGeometry args={[1, 1, 1]} /> : p.shape === 'cylinder' ? <cylinderGeometry args={[0.5, 0.5, 1, 12]} /> : p.shape === 'cone' ? <coneGeometry args={[0.5, 1, 12]} /> : <sphereGeometry args={[0.5, 12, 8]} />}
    <meshStandardMaterial color={color ?? p.color} roughness={0.85} />
  </mesh>)}</group>;
}
