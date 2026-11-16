import { memo, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';
import { RobotCharacter } from '../components/RobotCharacter';
import { playerPalette } from '../game/robotAppearance';
import { sceneGround } from '../game/groundSurface';
import { setGhostThreatActive } from '../game/ghostConfig';
import type { PresencePlayer, WorldSnapshotGhost } from '../../shared/network';
import type { MultiplayerSession } from './session';

const noRaycast = () => {};
const goldPalette = { ...playerPalette, shell: '#f3cb70', accent: '#8868df' };

const RemoteAvatar = memo(function RemoteAvatar({ player }: { player: PresencePlayer }) {
  const root = useRef<Group>(null);
  const wheels = useRef<Group>(null);
  useLayoutEffect(() => {
    // Presence visuals must not intercept teleport picking or the chase-camera ray.
    root.current?.traverse(object => { if (object instanceof Mesh) object.raycast = noRaycast; });
  }, []);
  useFrame(({ scene, clock }) => {
    if (root.current) root.current.position.y = sceneGround(scene, clock.elapsedTime).height(player.x, player.z) + player.y;
  });
  return <group ref={root} name={`remote-player-${player.sessionId}`}
    position={[player.x, player.y, player.z]} rotation={[0, player.yaw, 0]}>
    <RobotCharacter wheels={wheels} palette={player.avatar === 'gold' ? goldPalette : playerPalette} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .025, 0]}>
      <ringGeometry args={[.65, .75, 24]} />
      <meshBasicMaterial color="#82c8ff" />
    </mesh>
  </group>;
});

const AuthoritativeGhostMarker = memo(function AuthoritativeGhostMarker({
  ghost,
}: {
  ghost: WorldSnapshotGhost;
}) {
  const root = useRef<Group>(null);

  // F04: sync ghost threat state into HorrorAudioMixer / HauntedWarehouseAudioZone
  useEffect(() => {
    const isThreat = ghost.state === 'CHASING' || ghost.state === 'GRABBING';
    setGhostThreatActive(ghost.id, isThreat);
    return () => {
      setGhostThreatActive(ghost.id, false);
    };
  }, [ghost.id, ghost.state]);

  useLayoutEffect(() => {
    root.current?.traverse(object => { if (object instanceof Mesh) object.raycast = noRaycast; });
  }, []);

  useFrame(({ scene, clock }) => {
    if (root.current) root.current.position.y = sceneGround(scene, clock.elapsedTime).height(ghost.x, ghost.z) + 0.05;
  });

  if (ghost.state === 'BANISHED') return null;
  const isHostile = ghost.state === 'GRABBING' || ghost.state === 'CHASING';
  const ringColor = ghost.homeProtected ? '#22c55e' : isHostile ? '#ef4444' : '#c084fc';
  const eyeColor = isHostile ? '#ff1a1a' : '#38bdf8';
  const bodyColor = isHostile ? '#ff4d6d' : '#a78bfa';
  const bodyEmissive = isHostile ? '#ef4444' : '#7c3aed';

  return (
    <group
      ref={root}
      name={`authoritative-ghost-${ghost.id}`}
      position={[ghost.x, 0.05, ghost.z]}
      rotation={[0, ghost.yaw, 0]}
    >
      {/* Ground status indicator ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.7, 0.95, 24]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.7} />
      </mesh>
      {/* 3D Ethereal spectral apparition */}
      <group position={[0, 1.1, 0]}>
        {/* Floating ethereal torso */}
        <mesh position={[0, 0.1, 0]}>
          <coneGeometry args={[0.42, 1.3, 16, 1, true]} />
          <meshStandardMaterial
            color={bodyColor}
            transparent
            opacity={0.65}
            roughness={0.2}
            emissive={bodyEmissive}
            emissiveIntensity={ghost.state === 'GRABBING' ? 1.2 : 0.6}
          />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.72, 0]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial
            color="#e2e8f0"
            transparent
            opacity={0.8}
            emissive={isHostile ? '#dc2626' : '#8b5cf6'}
            emissiveIntensity={0.5}
          />
        </mesh>
        {/* Spectral glowing eyes */}
        <mesh position={[0.07, 0.74, 0.18]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
        <mesh position={[-0.07, 0.74, 0.18]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
      </group>
    </group>
  );
});

export function RemotePlayers({ session }: { session: MultiplayerSession }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <>
    {snapshot.players
      .filter(player => player.sessionId !== snapshot.sessionId)
      .map(player => <RemoteAvatar key={player.sessionId} player={player} />)}
    {snapshot.mode === 'authoritative-v2' &&
      snapshot.ghosts.map(ghost => <AuthoritativeGhostMarker key={ghost.id} ghost={ghost} />)}
  </>;
}
