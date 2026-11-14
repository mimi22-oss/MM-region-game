import { memo, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';
import { RobotCharacter } from '../components/RobotCharacter';
import { playerPalette } from '../game/robotAppearance';
import { sceneGround } from '../game/groundSurface';
import type { PresencePlayer } from '../../shared/network';
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

export function RemotePlayers({ session }: { session: MultiplayerSession }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <>{snapshot.players.filter(player => player.sessionId !== snapshot.sessionId)
    .map(player => <RemoteAvatar key={player.sessionId} player={player} />)}</>;
}
