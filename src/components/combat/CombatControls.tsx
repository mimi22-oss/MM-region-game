import {useEffect,useState} from 'react';
import {ATTACKS,type CombatCommand} from '../../game/combat/AttackDefinitions';
import {playerCombat} from '../../game/combat/combatRuntime';
import {requestSwordAttack,selectSwordAttack,selectedSwordAttack} from '../../game/combat/combatInput';

export function CombatControls(){
 const [command,setCommand]=useState<CombatCommand>(selectedSwordAttack);
 const [status,setStatus]=useState('');
 useEffect(()=>{
  const timer=window.setInterval(()=>setStatus(playerCombat.capable?`${playerCombat.phase} · ${playerCombat.clip??'Combat Idle'}${playerCombat.comboIndex>=0?` · ${playerCombat.comboIndex+1}/6`:''}`:'Choose Boy / Girl GLB or Canolia in Appearance'),150);
  return()=>window.clearInterval(timer);
 },[]);

 return <div className="ghost-hud-combat-wrap" aria-label="Sword combat controls">
  <div className="ghost-hud-section-header">
   <span>⚔️ တိုက်ခိုက်ရေး (Combat)</span>
   <span className="ghost-hud-badge-tag" style={{background:'rgba(239,68,68,0.25)',color:'#fca5a5'}}>Active</span>
  </div>

  <div className="ghost-hud-combat-status" role="status">
   {status}
  </div>

  <label style={{display:'flex',flexDirection:'column',gap:3,fontSize:11,color:'#cbd5e1'}}>
   <span>တိုက်ခိုက်မှုပုံစံ (Attack Style):</span>
   <select
    className="ghost-hud-combat-select"
    aria-label="Sword attack style"
    value={command}
    onChange={e=>{
     const next=e.target.value as CombatCommand;
     setCommand(next);
     selectSwordAttack(next);
    }}
   >
    <option value="combo">Six-hit combo (F)</option>
    {Object.keys(ATTACKS).map(name=><option key={name} value={name}>{name.replaceAll('_',' ')}</option>)}
   </select>
  </label>

  <div className="ghost-hud-combat-actions">
   <button type="button" className="ghost-hud-combat-btn" onClick={()=>requestSwordAttack('attack')}>
    ⚔ Attack (F)
   </button>
   <button type="button" className="ghost-hud-combat-btn" onClick={()=>requestSwordAttack('Heavy_Slash')}>
    💥 Heavy (Shift+F)
   </button>
  </div>

  <div className="ghost-hud-combat-actions">
   {(['Sword_Block','Sword_Parry','Dodge_Left','Dodge_Right'] as const).map(name=>(
    <button key={name} type="button" className="ghost-hud-combat-btn defend" onClick={()=>requestSwordAttack(name)}>
     {name==='Sword_Block'?'🛡 Block':name==='Sword_Parry'?'⚡ Parry':name==='Dodge_Left'?'◀ Dodge L':'▶ Dodge R'}
    </button>
   ))}
  </div>

  <div className="ghost-hud-combat-tip">
   💡 F ကို ဓားယမ်းပြီးနောက် ထပ်နှိပ်၍ combo ဆက်တိုက်တိုက်ခိုက်ပါ။
  </div>
 </div>;
}
