import { lazy, Suspense, useEffect, useState } from 'react';
const GhostDevMap = import.meta.env.DEV ? lazy(() => import('./GhostDevMap')) : null;
import { GHOST_IDS, GHOST_STATS, useThreeGhostsMission } from '../game/missions/threeGhostsMission';
import { ghostMissionProximity, requestThreeGhostsAction } from './ThreeGhostsMissionScene';
import {CombatControls} from './combat/CombatControls';

export function ThreeGhostsMissionHud() {
  const progress = useThreeGhostsMission();

  const [pickup,setPickup]=useState({near:false,ready:false,progress:0});
  const [message, setMessage] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => {

      setPickup(previous=>previous.near===ghostMissionProximity.nearSword&&previous.ready===ghostMissionProximity.pickupReady&&previous.progress===ghostMissionProximity.pickupProgress?previous:{near:ghostMissionProximity.nearSword,ready:ghostMissionProximity.pickupReady,progress:ghostMissionProximity.pickupProgress});
      setMessage(ghostMissionProximity.lastMessage);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  return <div style={{position:'absolute',top:'max(64px, env(safe-area-inset-top))',left:12,zIndex:25,
    background:'rgba(10,10,18,.78)',color:'white',padding:'10px 12px',borderRadius:12,
    fontSize:13,maxWidth:270,pointerEvents:'auto'}} aria-label="Ghost Mission">
    <strong>👻 Ghost Mission {progress.completed ? '✓ Completed' : ''}</strong>
    {GhostDevMap && <Suspense fallback={null}><GhostDevMap /></Suspense>}
    <div>Encounter: {progress.encountered.length}/3</div>
    <div>Sword: {progress.swordCollected ? '✓ Collected' : progress.encountered.length === 3 ? '⚔ Football Field · E နှိပ်၍ 2s ယူပါ' : '🔒 Locked'}</div>
    {GHOST_IDS.map(id => <div key={id}>{id} ({GHOST_STATS[id].scale}×): {progress.hp[id]}/{GHOST_STATS[id].maxHp} HP</div>)}
    {progress.completed ? <div>🚗 Car & 🎈 Balloon unlocked!</div> : <div style={{opacity:.8}}>ကားနဲ့ပူပေါင်းကို Mission ပြီးမှ စီးနိုင်မယ်။</div>}
    {message && <div role="status" style={{color:'#ffce91',marginTop:4}}>{message}</div>}
    {pickup.near&&!progress.swordCollected&&<div>{!pickup.ready?<span>Ghost ၃ ကောင်လုံး ဓားနှင့် 20m ကျော်ဝေးရပါမည်။</span>:<button type="button" onClick={()=>requestThreeGhostsAction('interact')}>⚔ Pick up (E) {pickup.progress>0?`${Math.round(pickup.progress*100)}%`:''}</button>}</div>}
    {progress.swordCollected&&!progress.completed&&<CombatControls/>}
  </div>;
}
