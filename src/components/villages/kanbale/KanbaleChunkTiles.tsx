import { memo, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { MapDataset, type MapDatasetConfig, type MapTileViewProps } from '../../MapDataset';
import kanbaleDatasetJson from '../../../data/kanbaleDataset.json' with { type: 'json' };
import { projectMapPoint } from '../../../game/mapProjection';
import { computeChunkOrigin, worldToOriginLocal } from '../../../game/floatingOrigin';
import {
  acquireSharedStandardMaterial,
  acquireUnitBoxGeometry,
  acquireUnitCylinderGeometry,
  acquireUnitPlaneGeometry,
  acquireUnitSphereGeometry,
} from '../../../game/streamedAssetPool';
import {
  decodeStreamedTileFeatures,
  registerStreamedChunk,
  unregisterStreamedChunk,
} from '../../../game/streamedChunkRegistry';
import { registerGroundRegion, releaseGroundRegion } from '../../../game/groundSurface';
import { subscribeWorldEdits, worldEditVersion, sourceIsEdited } from '../../../game/worldEdits';
import { diagnosticConfig } from '../../../game/diagnosticMode';
import type { DestinationStatus, WorldDestination } from '../../../game/regionLoading';
import type { KanbaleBuildingData } from '../../../data/villages/kanbale/kanbaleBuildings';
import { KanbaleFarmhouse } from './KanbaleFarmhouse';
import { KanbaleSchool } from './KanbaleSchool';

const datasetConfig: MapDatasetConfig = {
  manifest: kanbaleDatasetJson.manifest,
  projection: kanbaleDatasetJson.projection as MapDatasetConfig['projection'],
  travel: { part: 'kanbale', bounds: kanbaleDatasetJson.bounds },
};

const KANBALE_TILE_RADIUS_M = 480;

const KanbaleTileView = memo(function KanbaleTileView({ tile, data, projection }: MapTileViewProps) {
  const { scene } = useThree();
  const groupRef = useRef<Group>(null);
  const plinthRef = useRef<InstancedMesh>(null);
  const wallRef = useRef<InstancedMesh>(null);
  const corniceRef = useRef<InstancedMesh>(null);
  const roofRef = useRef<InstancedMesh>(null);
  const ridgeRef = useRef<InstancedMesh>(null);
  const roadRef = useRef<InstancedMesh>(null);
  const groundRef = useRef<InstancedMesh>(null);
  const trunkRef = useRef<InstancedMesh>(null);
  const canopyRef = useRef<InstancedMesh>(null);

  const editVer = useSyncExternalStore(subscribeWorldEdits, worldEditVersion);

  const poolHandles = useMemo(
    () => ({
      boxGeo: acquireUnitBoxGeometry(),
      planeGeo: acquireUnitPlaneGeometry(),
      cylGeo: acquireUnitCylinderGeometry(),
      sphereGeo: acquireUnitSphereGeometry(),
      plinthMat: acquireSharedStandardMaterial('kanbale:plinth', { color: '#aaa18d', roughness: 0.92 }),
      wallMat: acquireSharedStandardMaterial('kanbale:wall-instance', { color: '#ffffff', roughness: 0.85 }),
      corniceMat: acquireSharedStandardMaterial('kanbale:cornice', { color: '#e6ce9f', roughness: 0.82 }),
      roofMat: acquireSharedStandardMaterial('kanbale:roof-instance', { color: '#ffffff', roughness: 0.65, metalness: 0.12 }),
      roadMat: acquireSharedStandardMaterial('kanbale:road', { color: '#596663', roughness: 0.88, metalness: 0.05 }),
      groundMat: acquireSharedStandardMaterial('kanbale:ground', { color: '#889c62', roughness: 0.92 }),
      trunkMat: acquireSharedStandardMaterial('kanbale:tree-trunk', { color: '#5c4033', roughness: 0.92 }),
      canopyMat: acquireSharedStandardMaterial('kanbale:tree-canopy', { color: '#ffffff', roughness: 0.88 }),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      poolHandles.boxGeo.release();
      poolHandles.planeGeo.release();
      poolHandles.cylGeo.release();
      poolHandles.sphereGeo.release();
      poolHandles.plinthMat.release();
      poolHandles.wallMat.release();
      poolHandles.corniceMat.release();
      poolHandles.roofMat.release();
      poolHandles.roadMat.release();
      poolHandles.groundMat.release();
      poolHandles.trunkMat.release();
      poolHandles.canopyMat.release();
    };
  }, [poolHandles]);

  const decoded = useMemo(
    () => decodeStreamedTileFeatures(data, projection),
    [data, projection],
  );

  const origin = useMemo(() => {
    const corners = [
      projectMapPoint(projection, tile.bbox[0], tile.bbox[1]),
      projectMapPoint(projection, tile.bbox[2], tile.bbox[1]),
      projectMapPoint(projection, tile.bbox[2], tile.bbox[3]),
      projectMapPoint(projection, tile.bbox[0], tile.bbox[3]),
    ];
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minZ = Math.min(...corners.map((c) => c.z));
    const maxZ = Math.max(...corners.map((c) => c.z));
    return computeChunkOrigin(minX, maxX, minZ, maxZ);
  }, [tile.bbox, projection]);

  const activeData = useMemo(() => {
    const visibleBuildings = decoded.buildings.filter((b) => !sourceIsEdited(b.id));
    const customLandmarks = visibleBuildings.filter((b) => Boolean(b.customComponent));
    const standardHouses = diagnosticConfig.disableBuildings
      ? []
      : visibleBuildings.filter((b) => !b.customComponent);
    const visibleRoads = diagnosticConfig.disableOSM
      ? []
      : decoded.roads.filter((r) => !sourceIsEdited(r.id));
    const visibleRoadPlots = decoded.roadPlots.filter((r) => !sourceIsEdited(r.id));
    const visibleTrees = decoded.trees.filter((t) => !sourceIsEdited(t.id));

    const roadSegments: Array<{ mx: number; mz: number; length: number; width: number; rot: number }> = [];
    for (const r of visibleRoads) {
      const pts = r.worldPoints;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        const length = Math.hypot(dx, dz);
        if (length < 0.3) continue;
        roadSegments.push({
          mx: (p1[0] + p2[0]) / 2,
          mz: (p1[1] + p2[1]) / 2,
          length: length + 0.15,
          width: r.width,
          rot: -Math.atan2(dz, dx),
        });
      }
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const b of visibleBuildings) {
      minX = Math.min(minX, b.x - b.width / 2);
      maxX = Math.max(maxX, b.x + b.width / 2);
      minZ = Math.min(minZ, b.z - b.depth / 2);
      maxZ = Math.max(maxZ, b.z + b.depth / 2);
    }
    for (const s of roadSegments) {
      minX = Math.min(minX, s.mx - s.length / 2);
      maxX = Math.max(maxX, s.mx + s.length / 2);
      minZ = Math.min(minZ, s.mz - s.length / 2);
      maxZ = Math.max(maxZ, s.mz + s.length / 2);
    }
    const hasGround = Number.isFinite(minX) && Number.isFinite(minZ);
    const groundBounds = hasGround
      ? {
          cx: (minX + maxX) / 2,
          cz: (minZ + maxZ) / 2,
          w: Math.max(20, maxX - minX + 36),
          d: Math.max(20, maxZ - minZ + 36),
        }
      : { cx: origin.x, cz: origin.z, w: 60, d: 60 };

    return {
      visibleBuildings,
      customLandmarks,
      standardHouses,
      visibleRoads,
      visibleRoadPlots,
      visibleTrees,
      roadSegments,
      groundBounds,
    };
  }, [decoded, editVer, origin]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const matrix = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scale = new Vector3();
    const color = new Color();
    const yAxis = new Vector3(0, 1, 0);
    const zAxis = new Vector3(0, 0, 1);
    const roofRotQ = new Quaternion();
    const slopeOffset = new Vector3();

    const { standardHouses, roadSegments, visibleTrees, groundBounds } = activeData;

    if (groundRef.current) {
      const localG = worldToOriginLocal(groundBounds.cx, groundBounds.cz, origin, -0.05);
      matrix.compose(
        pos.set(localG.x, localG.y, localG.z),
        quat.identity(),
        scale.set(groundBounds.w, 1, groundBounds.d),
      );
      groundRef.current.setMatrixAt(0, matrix);
      groundRef.current.instanceMatrix.needsUpdate = true;
      groundRef.current.computeBoundingSphere();
    }

    if (roadRef.current && roadSegments.length > 0) {
      roadSegments.forEach((s, i) => {
        const localR = worldToOriginLocal(s.mx, s.mz, origin, 0.04);
        quat.setFromAxisAngle(yAxis, s.rot);
        matrix.compose(
          pos.set(localR.x, localR.y, localR.z),
          quat,
          scale.set(s.length, 1, s.width),
        );
        roadRef.current!.setMatrixAt(i, matrix);
      });
      roadRef.current.instanceMatrix.needsUpdate = true;
      roadRef.current.computeBoundingSphere();
    }

    if (
      plinthRef.current &&
      wallRef.current &&
      corniceRef.current &&
      roofRef.current &&
      ridgeRef.current &&
      standardHouses.length > 0
    ) {
      standardHouses.forEach((b, i) => {
        const w = b.houseWidth || Math.max(b.width, 6.5);
        const d = b.houseLength || Math.max(b.depth, 7.5);
        const isTwoStorey = b.area >= 70;
        const wallH = isTwoStorey ? 5.8 : 3.2;
        const pitchH = 1.6;
        const roofY = isTwoStorey ? 6.6 : 4.0;
        const roofAngle = Math.atan2(pitchH, w / 2);
        const slopeLength = Math.hypot(w / 2, pitchH) + 0.8;
        const roofDepth = d + 1.2;

        const localB = worldToOriginLocal(b.x, b.z, origin, 0);
        quat.setFromAxisAngle(yAxis, b.rotation);

        // Plinth
        matrix.compose(pos.set(localB.x, 0.125, localB.z), quat, scale.set(w + 0.3, 0.25, d + 0.3));
        plinthRef.current!.setMatrixAt(i, matrix);

        // Main wall
        matrix.compose(pos.set(localB.x, 0.25 + wallH / 2, localB.z), quat, scale.set(w, wallH, d));
        wallRef.current!.setMatrixAt(i, matrix);
        wallRef.current!.setColorAt(i, color.set(b.wallColor));

        // Eave cornice
        matrix.compose(pos.set(localB.x, 0.25 + wallH + 0.1, localB.z), quat, scale.set(w + 0.4, 0.2, d + 0.4));
        corniceRef.current!.setMatrixAt(i, matrix);

        // Center ridge cap
        matrix.compose(pos.set(localB.x, roofY + 0.16, localB.z), quat, scale.set(0.28, 0.18, roofDepth));
        ridgeRef.current!.setMatrixAt(i, matrix);
        ridgeRef.current!.setColorAt(i, color.set(b.roofColor));

        // Two gable roof slopes (-left and +right)
        for (let side = 0; side < 2; side++) {
          const sign = side === 0 ? -1 : 1;
          slopeOffset.set((sign * (w + 0.4)) / 4, roofY - pitchH / 2 + 0.05, 0).applyQuaternion(quat);
          roofRotQ.copy(quat).multiply(new Quaternion().setFromAxisAngle(zAxis, sign === -1 ? roofAngle : -roofAngle));
          matrix.compose(
            pos.set(localB.x + slopeOffset.x, slopeOffset.y, localB.z + slopeOffset.z),
            roofRotQ,
            scale.set(slopeLength, 0.12, roofDepth),
          );
          const idx = i * 2 + side;
          roofRef.current!.setMatrixAt(idx, matrix);
          roofRef.current!.setColorAt(idx, color.set(b.roofColor));
        }
      });

      plinthRef.current.instanceMatrix.needsUpdate = true;
      wallRef.current.instanceMatrix.needsUpdate = true;
      if (wallRef.current.instanceColor) wallRef.current.instanceColor.needsUpdate = true;
      corniceRef.current.instanceMatrix.needsUpdate = true;
      ridgeRef.current.instanceMatrix.needsUpdate = true;
      if (ridgeRef.current.instanceColor) ridgeRef.current.instanceColor.needsUpdate = true;
      roofRef.current.instanceMatrix.needsUpdate = true;
      if (roofRef.current.instanceColor) roofRef.current.instanceColor.needsUpdate = true;
      plinthRef.current.computeBoundingSphere();
      wallRef.current.computeBoundingSphere();
      roofRef.current.computeBoundingSphere();
    }

    if (trunkRef.current && canopyRef.current && visibleTrees.length > 0) {
      visibleTrees.forEach((t, i) => {
        const isLarge = t.variant === 'large';
        const trunkH = isLarge ? 4.2 : 2.6;
        const trunkR = isLarge ? 0.48 : 0.28;
        const canopyR = isLarge ? 3.8 : 2.2;
        const localT = worldToOriginLocal(t.x, t.z, origin, 0);

        matrix.compose(pos.set(localT.x, trunkH / 2, localT.z), quat.identity(), scale.set(trunkR, trunkH, trunkR));
        trunkRef.current!.setMatrixAt(i, matrix);

        matrix.compose(pos.set(localT.x, trunkH + canopyR * 0.72, localT.z), quat.identity(), scale.set(canopyR, canopyR * 0.85, canopyR));
        canopyRef.current!.setMatrixAt(i, matrix);
        canopyRef.current!.setColorAt(i, color.set(isLarge ? '#2d5a27' : '#3a6b35'));
      });
      trunkRef.current.instanceMatrix.needsUpdate = true;
      canopyRef.current.instanceMatrix.needsUpdate = true;
      if (canopyRef.current.instanceColor) canopyRef.current.instanceColor.needsUpdate = true;
      trunkRef.current.computeBoundingSphere();
      canopyRef.current.computeBoundingSphere();
    }

    const tileKey = `kanbale:${tile.id}`;
    const groundKey = `kanbale-tile-${tile.id}`;
    registerStreamedChunk(tileKey, {
      regionId: 'kanbale',
      buildings: activeData.visibleBuildings,
      trees: activeData.visibleTrees,
      roadPlots: activeData.visibleRoadPlots,
      roads: activeData.visibleRoads,
      labels: decoded.labels,
    });
    registerGroundRegion(scene, groundKey, group);

    return () => {
      unregisterStreamedChunk(tileKey);
      releaseGroundRegion(scene, groundKey);
    };
  }, [activeData, decoded.labels, origin, scene, tile.id]);

  const { customLandmarks, standardHouses, roadSegments, visibleTrees } = activeData;

  return (
    <group
      ref={groupRef}
      name={`kanbale-chunk-${tile.id}`}
      position={[origin.x, 0, origin.z]}
      userData={{ streamedChunkId: tile.id, regionId: 'kanbale' }}
    >
      <instancedMesh
        ref={groundRef}
        args={[poolHandles.planeGeo.resource, poolHandles.groundMat.resource, 1]}
        receiveShadow
        userData={{ walkable: true }}
      />

      {roadSegments.length > 0 && (
        <instancedMesh
          ref={roadRef}
          args={[poolHandles.planeGeo.resource, poolHandles.roadMat.resource, roadSegments.length]}
          receiveShadow
          userData={{ walkable: true }}
        />
      )}

      {standardHouses.length > 0 && (
        <group name={`kanbale-tile-houses-${tile.id}`}>
          <instancedMesh
            ref={plinthRef}
            args={[poolHandles.boxGeo.resource, poolHandles.plinthMat.resource, standardHouses.length]}
            receiveShadow
          />
          <instancedMesh
            ref={wallRef}
            args={[poolHandles.boxGeo.resource, poolHandles.wallMat.resource, standardHouses.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={corniceRef}
            args={[poolHandles.boxGeo.resource, poolHandles.corniceMat.resource, standardHouses.length]}
          />
          <instancedMesh
            ref={roofRef}
            args={[poolHandles.boxGeo.resource, poolHandles.roofMat.resource, standardHouses.length * 2]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={ridgeRef}
            args={[poolHandles.boxGeo.resource, poolHandles.roofMat.resource, standardHouses.length]}
          />
        </group>
      )}

      {visibleTrees.length > 0 && (
        <group name={`kanbale-tile-trees-${tile.id}`}>
          <instancedMesh
            ref={trunkRef}
            args={[poolHandles.cylGeo.resource, poolHandles.trunkMat.resource, visibleTrees.length]}
            castShadow
          />
          <instancedMesh
            ref={canopyRef}
            args={[poolHandles.sphereGeo.resource, poolHandles.canopyMat.resource, visibleTrees.length]}
            castShadow
            receiveShadow
          />
        </group>
      )}

      {customLandmarks.map((b) => {
        const localBuilding: KanbaleBuildingData = {
          id: b.id,
          osmId: b.osmId ?? 0,
          osmType: b.osmType ?? 'way',
          name: b.name,
          lon: 0,
          lat: 0,
          u: 0,
          v: 0,
          x: b.x - origin.x,
          z: b.z - origin.z,
          width: b.width,
          depth: b.depth,
          height: b.height,
          area: b.area,
          wallColor: b.wallColor,
          roofColor: b.roofColor,
          polygonPoints: b.polygonPoints,
          relativePoints: b.relativePoints,
          rotation: b.rotation,
          houseLength: b.houseLength,
          houseWidth: b.houseWidth,
          wallHeight: b.wallHeight,
          roofHeight: b.roofHeight,
        };
        if (b.customComponent === 'KanbaleFarmhouse') {
          return <KanbaleFarmhouse key={b.id} building={localBuilding} />;
        }
        if (b.customComponent === 'KanbaleSchool') {
          return <KanbaleSchool key={b.id} building={localBuilding} />;
        }
        return null;
      })}
    </group>
  );
});

export function KanbaleChunkTiles({
  active = true,
  destination,
  onDestinationStatus,
}: {
  active?: boolean;
  destination?: WorldDestination | null;
  onDestinationStatus?: DestinationStatus;
}) {
  return (
    <MapDataset
      config={datasetConfig}
      view={KanbaleTileView}
      active={active}
      destination={destination}
      onDestinationStatus={onDestinationStatus}
      radiusMeters={KANBALE_TILE_RADIUS_M}
    />
  );
}
