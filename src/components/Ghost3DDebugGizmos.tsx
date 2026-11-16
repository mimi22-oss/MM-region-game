import { useMemo, memo } from 'react';
import { DoubleSide, Vector3 } from 'three';
import { isGhostDevUiAvailable } from '../game/ghostConfig.ts';
import { useGhostDebugStore } from '../game/audio/ghostDebugStore.ts';
import { getPlayerHomeBoundary } from '../game/playerHomeProtection.ts';

// Dummy raycast to prevent any debug gizmo from blocking player clicks or raycasts
const noRaycast = () => {};

export const Ghost3DDebugGizmos = memo(function Ghost3DDebugGizmos() {
  if (!isGhostDevUiAvailable()) return null;
  return <Ghost3DDebugGizmosInternal />;
});

function Ghost3DDebugGizmosInternal() {
  const store = useGhostDebugStore();
  const homeBoundary = useMemo(() => getPlayerHomeBoundary(), []);

  if (!store.gizmosEnabled || store.ghosts.length === 0) {
    return null;
  }

  const selectedId = store.selectedGhostId;
  const filteredGhosts = selectedId === 'all'
    ? store.ghosts
    : store.ghosts.filter((g) => g.ghostId === selectedId);

  return (
    <group name="ghost-3d-debug-gizmos" raycast={noRaycast}>
      {/* 1. Monastery Safe-Zone Boundary Gizmo */}
      {homeBoundary.kind === 'circle' && (
        <group raycast={noRaycast}>
          {/* Inner Protection Ring */}
          <mesh
            position={[homeBoundary.x, 0.04, homeBoundary.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={noRaycast}
          >
            <ringGeometry args={[Math.max(0.1, homeBoundary.radius - 0.2), homeBoundary.radius, 64]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.65} side={DoubleSide} />
          </mesh>
          {/* Outer Retreat Buffer Ring (+5m) */}
          <mesh
            position={[homeBoundary.x, 0.03, homeBoundary.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={noRaycast}
          >
            <ringGeometry args={[homeBoundary.radius + 4.8, homeBoundary.radius + 5.0, 64]} />
            <meshBasicMaterial color="#2979ff" transparent opacity={0.45} side={DoubleSide} />
          </mesh>
        </group>
      )}

      {/* 2. Per-Ghost Spatial Gizmos */}
      {filteredGhosts.map((g) => {
        const isChasing = g.state === 'CHASING' || g.state === 'GRABBING';
        const isObserving = g.state === 'OBSERVING_PLAYER' || g.state === 'SCARING';
        const ringColor = isChasing ? '#ff1744' : isObserving ? '#ffab00' : '#00e5ff';
        const radius = g.detectionRadiusM || 25;

        // Path line vertices
        const pathPoints: Vector3[] = [];
        if (g.pathWaypoints && g.pathWaypoints.length > 0) {
          pathPoints.push(new Vector3(g.targetPosition.x, 0.1, g.targetPosition.z));
          for (const wp of g.pathWaypoints) {
            pathPoints.push(new Vector3(wp.x, 0.1, wp.z));
          }
        }

        return (
          <group key={g.ghostId} name={`gizmo-${g.ghostId}`} raycast={noRaycast}>
            {/* Detection Radius Ring */}
            <mesh
              position={[g.targetPosition.x, 0.05, g.targetPosition.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={noRaycast}
            >
              <ringGeometry args={[Math.max(0.1, radius - 0.2), radius, 48]} />
              <meshBasicMaterial color={ringColor} transparent opacity={0.5} side={DoubleSide} />
            </mesh>

            {/* Attack / Grab Radius Ring (1.65m crimson) */}
            <mesh
              position={[g.targetPosition.x, 0.06, g.targetPosition.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={noRaycast}
            >
              <ringGeometry args={[1.50, 1.65, 32]} />
              <meshBasicMaterial color="#ff1744" transparent opacity={0.8} side={DoubleSide} />
            </mesh>

            {/* Waypoint Path Node Spheres */}
            {g.pathWaypoints.map((wp, idx) => (
              <mesh key={idx} position={[wp.x, 0.2, wp.z]} raycast={noRaycast}>
                <sphereGeometry args={[0.22, 10, 10]} />
                <meshBasicMaterial color="#ffd600" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
