import { useEffect, useMemo } from 'react';
import { BoxGeometry, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { TerrainPeak } from '../game/mountainTerrain';
import { buildWeipulaRoadSurface } from '../game/weipulaRoadSurface';
import type { PitchedRoadSegment } from '../game/weipulaClimb';

const asphalt = new MeshStandardMaterial({ color: '#4c5050', roughness: .91 });
const roadbed = new MeshStandardMaterial({ vertexColors: true, roughness: .95, side: DoubleSide });
const roadEdge = new MeshBasicMaterial({ color: '#dfded3' });
const lanePaint = new MeshBasicMaterial({ color: '#e4bd51' });
const guardrail = new MeshStandardMaterial({ color: '#acb0a8', roughness: .78, side: DoubleSide });
const pierMaterial = new MeshStandardMaterial({ color: '#817b6e', roughness: .94 });
const pierGeometry = new BoxGeometry(1, 1, 1);

export function WeipulaRoad({ segments, peaks }: {
  segments: readonly PitchedRoadSegment[];
  peaks: readonly TerrainPeak[];
}) {
  const chunks = useMemo(() => buildWeipulaRoadSurface(segments, peaks), [segments, peaks]);
  useEffect(() => () => {
    for (const chunk of chunks) {
      chunk.asphalt.dispose();
      chunk.earth.dispose();
      chunk.edge.dispose();
      chunk.center.dispose();
      chunk.guard.dispose();
    }
  }, [chunks]);

  return <group name="weipula-switchback-road">
    {chunks.map((chunk, i) => <group key={i} position={[chunk.x, 0, chunk.z]}>
      <mesh geometry={chunk.asphalt} material={asphalt} receiveShadow userData={{ walkable: true }} />
      <mesh geometry={chunk.earth} material={roadbed} receiveShadow />
      <mesh geometry={chunk.edge} material={roadEdge} />
      <mesh geometry={chunk.center} material={lanePaint} />
      {Boolean(chunk.guard.index?.count) && <mesh geometry={chunk.guard} material={guardrail} />}
      {chunk.piers.map((p, j) => <mesh key={j} geometry={pierGeometry} material={pierMaterial}
        position={[p.x, (p.top + p.bottom) / 2, p.z]} rotation={[0, p.yaw, 0]}
        scale={[p.width, p.top - p.bottom, 2.35]} />)}
    </group>)}
  </group>;
}
