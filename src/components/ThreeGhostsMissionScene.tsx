import {playerCombat} from '../game/combat/combatRuntime';
import type {CombatCommand} from '../game/combat/AttackDefinitions';
import {requestSwordAttack} from '../game/combat/combatInput';
import { getGhostRuntime } from '../game/missions/ghostRuntimeRegistry';
import { swordGuardClear, updateGhostGuard } from '../game/missions/ghostGuardCoordinator';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { GhostSwordModel } from './GhostSwordModel';
import {getPlayerDeathState} from '../game/playerDeath';
import { area5 } from '../data/wards/myothar/area5';

import { currentCar } from '../game/carRide';
import { balloonRide } from '../game/balloonRide';
import { motorcycleRide } from '../game/motorcycleRide';
import {
  GHOST_IDS, ENCOUNTER_RADIUS_M,
  SWORD_PICKUP_RADIUS_M, collectGhostSword,
  getThreeGhostsProgress, isGhostDefeated, markGhostEncounter,
} from '../game/missions/threeGhostsMission';

/** Commands originate in user input, not a render loop. */
let pendingAction: 'interact' | null = null;
export function requestThreeGhostsAction(action: 'attack' | 'interact' | CombatCommand) {
 if(action==='interact'){pendingAction=action;return;}
 requestSwordAttack(action);
}
export const ghostMissionProximity = { nearSword: false, nearGhost: false, pickupReady: false, pickupProgress: 0, lastMessage: '' };

export function ThreeGhostsMissionScene() {
  const { scene } = useThree();
  const sword = useRef<Group>(null);
  const playerRef = useRef<Group | null>(null);
  const playerPos = useMemo(() => new Vector3(), []);
  const pickupStarted = useRef<number|null>(null);
  const lastDevMapUpdate = useRef(-Infinity);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    return () => {
      window.dispatchEvent(new CustomEvent('mm-ghost-debug-positions', {
        detail: { player: null, ghosts: [] },
      }));
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyE') requestThreeGhostsAction('interact');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useFrame(({ clock }) => {
    const progress = getThreeGhostsProgress();
    if (sword.current) {
      sword.current.visible = progress.encountered.length === 3 && !progress.swordCollected;
      sword.current.rotation.y += 0.008;
      sword.current.position.y = 2.5 + Math.sin(clock.elapsedTime * 1.6) * 0.25;
    }
    if (!playerRef.current?.parent) playerRef.current = scene.getObjectByName('player-avatar') as Group | null;
    const player = playerRef.current;
    if (!player) return;
    player.getWorldPosition(playerPos);
    const onFoot = !currentCar() && !balloonRide.riding && !motorcycleRide.riding;
    const ghostPositions: Array<{ id: string; distance: number }> = [];
    for (const id of GHOST_IDS) {
      if (isGhostDefeated(id)) continue;
      const runtime = getGhostRuntime(id);
      if (!runtime || !runtime.active) continue;
      const distance = Math.hypot(runtime.x - playerPos.x, runtime.z - playerPos.z);
      ghostPositions.push({ id, distance });
      // 8m horizontal radius, unique ghost ID, on foot. Render visibility is irrelevant.
      if (onFoot && distance <= ENCOUNTER_RADIUS_M) markGhostEncounter(id);
    }
    updateGhostGuard(clock.elapsedTime,playerPos.x,playerPos.z);
    if (clock.elapsedTime - lastDevMapUpdate.current >= 0.25) {
      lastDevMapUpdate.current = clock.elapsedTime;
      // Hidden render roots can lag behind AI; the publisher resolves the current source.
      const ghosts = GHOST_IDS.map(id => {
        const runtime = getGhostRuntime(id);
        return runtime ? { ...runtime } : { id, source: 'unavailable' as const };
      });
      window.dispatchEvent(new CustomEvent('mm-ghost-debug-positions', { detail: {
        player: { x: playerPos.x, z: playerPos.z, yaw: player.rotation.y }, ghosts,
      } }));
    }
    const nearSword = Math.hypot(playerPos.x-area5.pitch.x,playerPos.z-area5.pitch.z)<=SWORD_PICKUP_RADIUS_M;
    const alive=getPlayerDeathState().phase==='alive';
    const clear=swordGuardClear(20);
    const canPickup=progress.encountered.length===3&&!progress.swordCollected&&nearSword&&onFoot&&alive&&clear&&!playerCombat.paused;
    const action=pendingAction;pendingAction=null;
    if(!canPickup)pickupStarted.current=null;
    if(action==='interact'&&canPickup&&pickupStarted.current===null)pickupStarted.current=clock.elapsedTime;
    if(pickupStarted.current!==null&&clock.elapsedTime-pickupStarted.current>=2){
      if(collectGhostSword()){ghostMissionProximity.lastMessage='ဓား လက်ထဲရောက်ပါပြီ! F ဖြင့် combo တိုက်ခိုက်ပါ။';if(sword.current)sword.current.visible=false;}
      pickupStarted.current=null;
    }
    ghostMissionProximity.pickupReady=clear&&alive;
    ghostMissionProximity.pickupProgress=pickupStarted.current===null?0:Math.min(1,(clock.elapsedTime-pickupStarted.current)/2);
    ghostMissionProximity.nearSword=nearSword&&onFoot&&!getThreeGhostsProgress().swordCollected&&progress.encountered.length===3;
    ghostMissionProximity.nearGhost=onFoot&&ghostPositions.some(g=>g.distance<3);
    if(playerCombat.message)ghostMissionProximity.lastMessage=playerCombat.message;

  });

  return <group ref={sword} name="ghost-mission-sword" position={[area5.pitch.x, 2.5, area5.pitch.z]}>
    <GhostSwordModel/>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.75, 0]}>
      <torusGeometry args={[1.3, 0.09, 8, 40]} />
      <meshBasicMaterial color="#ff4a70" />
    </mesh>
    <pointLight color="#ff4255" intensity={3} distance={15} />
  </group>;
}
