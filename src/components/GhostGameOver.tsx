import {requestPlayerRespawn,usePlayerDeathState} from '../game/playerDeath';
export function GhostGameOver(){const state=usePlayerDeathState();if(state.phase==='alive')return null;
 const isZombie=Boolean(state.ghostId?.startsWith('zombie-'));
 return <div role="dialog" aria-modal="true" aria-label="Game Over" style={{position:'fixed',inset:0,zIndex:20000,display:'grid',placeItems:'center',background:'rgba(5,7,15,.88)',color:'#fff'}}>
 <section style={{textAlign:'center',padding:24}}><h1>Game Over</h1><p>{isZombie?'Zombie တိုက်ခိုက်ခံရသဖြင့် Heart Life ၃ ခုလုံး ကုန်သွားပါပြီ။ အိမ် Safe Zone တွင် မူလကနေ ပြန်စနိုင်ပါတယ်။':'သရဲဖမ်းမိသွားပါပြီ။ အိမ် Safe Zone တွင် ပြန်စနိုင်ပါတယ်။'}</p><button disabled={state.phase==='respawning'} onClick={requestPlayerRespawn}>{state.phase==='respawning'?'Respawning…':'အိမ်တွင် ပြန်စမည် · Respawn'}</button></section></div>;
}
