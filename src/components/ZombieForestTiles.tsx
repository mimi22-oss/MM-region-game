import { useLayoutEffect, useRef } from 'react';
import {
  Color,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { MapDataset, type MapDatasetConfig, type MapTileViewProps } from './MapDataset';
import { projectMapPoint } from '../game/mapProjection';
import { mobileQuality } from '../game/sceneBudget';
import {
  registerStreamedChunk,
  unregisterStreamedChunk,
  type StreamedTreeRecord,
} from '../game/streamedChunkRegistry';
import type { MapLabel } from '../game/mapLabels';
import datasetConfig from '../data/tharsiZombieForestDataset.json';

const BASE_Y_SCALE = 17.6 / 18.2;

// Shared module-level geometries & materials matching Tree.tsx variant="large"
// (zero per-tile GPU geometry allocations and 4 total draw calls per tile).
const trunkGeo = new CylinderGeometry(0.55, 0.95, 11, 10);
const branchGeo = new CylinderGeometry(0.2, 0.45, 5, 7);
const mainCanopyGeo = new IcosahedronGeometry(6.5, mobileQuality ? 0 : 1);
const sideCanopyGeo = new IcosahedronGeometry(3.8, mobileQuality ? 0 : 1);

const barkMat = new MeshStandardMaterial({ color: '#71543b', roughness: 1 });
const canopyMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 1 });

function ZombieForestTile({ tile, data, projection }: MapTileViewProps) {
  const trunkRef = useRef<InstancedMesh>(null);
  const branchRef = useRef<InstancedMesh>(null);
  const crownRef = useRef<InstancedMesh>(null);
  const sideCrownRef = useRef<InstancedMesh>(null);
  const count = data.features.length;

  useLayoutEffect(() => {
    const trunkMesh = trunkRef.current;
    const branchMesh = branchRef.current;
    const crownMesh = crownRef.current;
    const sideMesh = sideCrownRef.current;
    if (!trunkMesh || !branchMesh || !crownMesh || !sideMesh || count === 0) return;

    const parentM = new Matrix4();
    const localM = new Matrix4();
    const finalM = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scale = new Vector3();
    const euler = new Euler();
    const color = new Color();

    const trees: StreamedTreeRecord[] = [];
    let branchIdx = 0;
    let sideIdx = 0;

    for (let i = 0; i < count; i++) {
      const f = data.features[i];
      const p = f.properties ?? {};
      const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
      const world = projectMapPoint(projection, coords[0], coords[1]);
      const radius = Number(p.radius ?? 0.95);
      const yaw = Number(p.yaw ?? 0);
      const yScale = BASE_Y_SCALE * Number(p.scaleY ?? 1);
      const mainColor = String(p.color ?? (i % 2 ? '#486e40' : '#567e47'));
      const sideColor = String(p.sideColor ?? '#62874b');

      trees.push({
        id: String(f.id ?? `tharsi-zombie-forest-${tile.id}-${i}`),
        x: world.x,
        z: world.z,
        radius,
        variant: 'large',
      });

      // Tree root transform: position(x, 0, z), rotationY(yaw), scale(1, yScale, 1)
      quat.setFromEuler(euler.set(0, yaw, 0));
      parentM.compose(pos.set(world.x, 0, world.z), quat, scale.set(1, yScale, 1));

      // 1. Main trunk at local (0, 5.5, 0)
      localM.makeTranslation(0, 5.5, 0);
      finalM.multiplyMatrices(parentM, localM);
      trunkMesh.setMatrixAt(i, finalM);

      // 2. Two angled upper branches at local (±1.8, 10, 0), rotZ = ∓0.8
      for (const side of [-1, 1]) {
        quat.setFromEuler(euler.set(0, 0, -side * 0.8));
        localM.compose(pos.set(side * 1.8, 10, 0), quat, scale.set(1, 1, 1));
        finalM.multiplyMatrices(parentM, localM);
        branchMesh.setMatrixAt(branchIdx++, finalM);
      }

      // 3. Main canopy at local (0, 13, 0), scale (1, 0.8, 1)
      quat.identity();
      localM.compose(pos.set(0, 13, 0), quat, scale.set(1, 0.8, 1));
      finalM.multiplyMatrices(parentM, localM);
      crownMesh.setMatrixAt(i, finalM);
      crownMesh.setColorAt(i, color.set(mainColor));

      // 4. Two side canopies at local (±3.5, 11.6, 1)
      for (const side of [-1, 1]) {
        localM.makeTranslation(side * 3.5, 11.6, 1);
        finalM.multiplyMatrices(parentM, localM);
        sideMesh.setMatrixAt(sideIdx, finalM);
        sideMesh.setColorAt(sideIdx++, color.set(sideColor));
      }
    }

    for (const m of [trunkMesh, branchMesh, crownMesh, sideMesh]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      m.computeBoundingBox();
    }

    const labels: MapLabel[] =
      tile.id === '000000'
        ? datasetConfig.labels.map((lbl) => ({
            id: lbl.id,
            name: lbl.text,
            x: lbl.x,
            z: lbl.z,
            kind: 'place' as const,
            priority: 58,
          }))
        : [];

    const tileKey = `tharsi-zombie-forest:${tile.id}`;
    registerStreamedChunk(tileKey, {
      regionId: 'tharsi-zombie-forest',
      trees,
      labels,
    });

    return () => {
      unregisterStreamedChunk(tileKey);
    };
  }, [count, data, projection, tile.id]);

  if (count === 0) return null;

  return (
    <group name={`tile-zombie-forest-${tile.id}`}>
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, barkMat, count]}
        castShadow={!mobileQuality}
        receiveShadow
      />
      <instancedMesh
        ref={branchRef}
        args={[branchGeo, barkMat, count * 2]}
        castShadow={!mobileQuality}
      />
      <instancedMesh
        ref={crownRef}
        args={[mainCanopyGeo, canopyMat, count]}
        castShadow={!mobileQuality}
        receiveShadow
      />
      <instancedMesh
        ref={sideCrownRef}
        args={[sideCanopyGeo, canopyMat, count * 2]}
        castShadow={!mobileQuality}
      />
    </group>
  );
}

const mapConfig: MapDatasetConfig = {
  manifest: datasetConfig.manifest,
  projection: datasetConfig.projection as MapDatasetConfig['projection'],
};

export function ZombieForestTiles() {
  return <MapDataset config={mapConfig} view={ZombieForestTile} />;
}
