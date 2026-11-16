import {useEffect,useState} from 'react';
import {ATTACKS,type CombatCommand} from '../../game/combat/AttackDefinitions';
import {playerCombat} from '../../game/combat/combatRuntime';
import {requestThreeGhostsAction,selectSwordAttack} from '../ThreeGhostsMissionScene';

export function CombatControls(){
 const [command,setCommand]=useState<CombatCommand>('combo');
 const [status,setStatus]=useState('');
 useEffect(()=>{const timer=window.setInterval(()=>setStatus(playerCombat.capable?`${playerCombat.phase} · ${playerCombat.clip??'Combat Idle'}${playerCombat.comboIndex>=0?` · ${playerCombat.comboIndex+1}/6`:''}`:'Choose Boy / Girl GLB or Canolia in Appearance'),150);return()=>window.clearInterval(timer);},[]);
 const button={padding:'7px 9px',margin:'4px 4px 0 0'};
 return <div aria-label="Sword combat controls">
  <div style={{marginTop:6,fontSize:11}} role="status">{status}</div>
  <label>Attack <select aria-label="Sword attack style" value={command} onChange={e=>{const next=e.target.value as CombatCommand;setCommand(next);selectSwordAttack(next);}}>
   <option value="combo">Six-hit combo (F)</option>
   {Object.keys(ATTACKS).map(name=><option key={name} value={name}>{name.replaceAll('_',' ')}</option>)}
  </select></label>
  <div><button type="button" style={button} onClick={()=>requestThreeGhostsAction('attack')}>⚔ Attack (F)</button><button type="button" style={button} onClick={()=>requestThreeGhostsAction('Heavy_Slash')}>Heavy (Shift+F)</button></div>
  <div>{(['Sword_Block','Sword_Parry','Dodge_Left','Dodge_Right'] as const).map(name=><button key={name} type="button" style={button} onClick={()=>requestThreeGhostsAction(name)}>{name.replaceAll('_',' ')}</button>)}</div>
  <small>F ကို swing နောက်ပိုင်းမှာ ထပ်နှိပ်၍ combo ဆက်ပါ။</small>
 </div>;
}
