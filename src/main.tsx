import React, { Component, useEffect, useCallback, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { Town } from './components/Town';
import { KalayWardsPlan } from './components/wards';
import { KalayVillagesPlan } from './components/villages';
import { Player, MIN_ZOOM, MAX_ZOOM, type TeleportTarget } from './components/Player';
import { ward, toWorld } from './data/ward';
import './style.css';

const MAP_DESTINATIONS = [
 { id: 'myothar-area-5', label: 'မြို့သာရပ်ကွက် · နယ်မြေ (၅)', title: ward.name, subtitle: `AH1 · Myothar · ${ward.currentArea} · Kalay`, ...ward.spawn, yaw: 0, pitch: -0.14, distance: 8 },
 { id: 'tharsi', label: 'သာစည်ရွာ', title: 'သာစည်ရွာ · ကလေးမြို့နယ်', subtitle: 'AH1 · Thar Si Village · Kalay', ...toWorld(0, 796), yaw: Math.PI / 4, pitch: -0.18, distance: 12 },
 { id: 'chinsai', label: 'ချင်းဆိုင်ရွာ', title: 'ချင်းဆိုင်ရွာ · ကလေးမြို့နယ်', subtitle: 'AH1 · Chin Sai Village · Kalay', ...toWorld(0, 1150), yaw: Math.PI / 4, pitch: -0.18, distance: 12 },
 { id: 'zingalin', label: 'ဇင်းကလင်းကျေးရွာ', title: 'ဇင်းကလင်းကျေးရွာ · ကလေးမြို့နယ်', subtitle: 'AH1 · Zingalin Village · Kalay', ...toWorld(0, 1510), yaw: Math.PI / 4, pitch: -0.18, distance: 12 },
 { id: 'htomar', label: 'ထိုမာကျေးရွာ', title: 'ထိုမာကျေးရွာ · ကလေးမြို့နယ်', subtitle: 'East of AH1 · Htomar Village · Kalay', ...toWorld(256, 1927), yaw: -Math.PI * 3 / 4, pitch: -0.18, distance: 14 },
 { id: 'tharyargone', label: 'သာယာကုန်းကျေးရွာ', title: 'သာယာကုန်းကျေးရွာ · ကလေးမြို့နယ်', subtitle: 'AH1 · Thar Yar Gone Village · St. Assumption Church · Kalay', ...toWorld(0, 2700), yaw: Math.PI / 4, pitch: -0.18, distance: 12 },
];
class SceneError extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className="error">3D scene မဖွင့်နိုင်ပါ။ WebGL / hardware acceleration ဖွင့်ထားသော desktop browser ဖြင့် ပြန်စမ်းပါ။</div>:this.props.children}
}
function App(){
 const [first,setFirst]=useState(false);const [locked,setLocked]=useState(false);const [pos,setPos]=useState(ward.spawn);
 const [mapOpen,setMapOpen]=useState(false);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [sceneActive,setSceneActive]=useState(false);
 const [topDown,setTopDown]=useState(false);
 const [zoom,setZoom]=useState(6);
 const [activeLocId,setActiveLocId]=useState('myothar-area-5');
 const [teleportTarget,setTeleportTarget]=useState<TeleportTarget|null>(null);
 const activeDest=MAP_DESTINATIONS.find(d=>d.id===activeLocId)??MAP_DESTINATIONS[0];
 const handleSelectLocation=useCallback((id:string)=>{
  const dest=MAP_DESTINATIONS.find(d=>d.id===id);
  if(!dest)return;
  if(document.pointerLockElement)document.exitPointerLock();
  setActiveLocId(id);
  setMapOpen(false);
  setSettingsOpen(false);
  setFirst(false);
  setTopDown(false);
  setZoom(dest.distance);
  setTeleportTarget({x:dest.x,z:dest.z,yaw:dest.yaw,pitch:dest.pitch,distance:dest.distance,seq:Date.now()});
 },[]);
 useEffect(()=>{
  const close=(e:KeyboardEvent)=>{
   if(e.code==="Escape"){
    setMapOpen(false);
    setSettingsOpen(false);
    setSceneActive(false);
   }
  };
  document.addEventListener("keydown",close);
  return ()=>document.removeEventListener("keydown",close);
 },[]);
 const position=useCallback((x:number,z:number)=>setPos({x,z}),[]);
 const handleLock=useCallback((isLocked:boolean)=>{
  setLocked(isLocked);
  setSceneActive(isLocked);
  if(isLocked)setSettingsOpen(false);
 },[]);
 const toggleTopDown=()=>{
  if(document.pointerLockElement)document.exitPointerLock();
  setTopDown(prev=>{
   const next=!prev;
   if(next){setFirst(false);setZoom(z=>Math.max(z,260));}
   else setZoom(6);
   return next;
  });
 };
 const stepZoom=(dir:number)=>{
  setFirst(false);
  setZoom(z=>{
   const raw=dir>0?Math.max(z+2,z*1.35):Math.min(z-1,z/1.35);
   return Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,Math.round(raw*10)/10));
  });
 };
 const hideHud=locked||sceneActive;
 return <main>
 <div className="scene-wrap" onClick={()=>{if(!mapOpen){setSceneActive(true);setSettingsOpen(false);}}}><SceneError><Canvas shadows camera={{position:[0,5,33],fov:65,near:0.1,far:9000}} dpr={[1,1.75]}><Town/><Player mapOpen={mapOpen} topDown={topDown} zoom={zoom} teleportTarget={teleportTarget} onMode={setFirst} onTopDown={setTopDown} onZoom={setZoom} onLock={handleLock} onPosition={position}/></Canvas></SceneError></div>
 <header><span className="eyebrow">EXPLORE MYANMAR / 01</span><h1>{activeDest.title}</h1><p>{activeDest.subtitle}</p></header>
 <div className="settings-wrap">
  <button type="button" className={settingsOpen?"settings-btn settings-btn-active":"settings-btn"} aria-label="အသုံးပြုနည်း လမ်းညွှန်နှင့် ဆက်တင်" aria-expanded={settingsOpen} title="အသုံးပြုနည်း လမ်းညွှန် (Settings & Guide)" onClick={()=>{if(document.pointerLockElement)document.exitPointerLock();setSettingsOpen(v=>!v);}}>⚙</button>
  {settingsOpen&&<section className="settings-menu" aria-label="အသုံးပြုနည်း လမ်းညွှန်">
   <div className="guide-item">
    <div className="guide-header">
     <strong>အသုံးပြုနည်း လမ်းညွှန် · GUIDE</strong>
     <div className="badge"><span/> MAP STUDY · {ward.currentArea} <b>{ward.size} × {ward.size} m</b></div>
    </div>
    <div className="cam-controls" aria-label="3D camera controls">
     <button type="button" className={topDown?"cam-btn cam-btn-active":"cam-btn"} aria-pressed={topDown} onClick={toggleTopDown}>{topDown?"✓ ကောင်းကင်တည့်တည့် · TOP-DOWN":"ကောင်းကင်တည့်တည့် · TOP-DOWN (T)"}</button>
     <div className="cam-zoom-row">
      <button type="button" className="cam-btn" onClick={()=>stepZoom(-1)} title="Zoom in">＋ Zoom In</button>
      <button type="button" className="cam-btn" onClick={()=>stepZoom(1)} title="Zoom out">－ Zoom Out</button>
     </div>
    </div>
    <ul className="guide-list">
     <li><kbd>W A S D / ↑ ↓ ← →</kbd><span>လမ်းလျှောက် / မြေပုံရွှေ့ရန်</span></li>
     <li><kbd>Shift + Drag</kbd><span>မြေပုံကို ဆွဲရွှေ့ရန် (Pan)</span></li>
     <li><kbd>Shift</kbd><span>အမြန်ပြေးရန်</span></li>
     <li><kbd>Scroll</kbd><span>Zoom အဝင် / အထွက်</span></li>
     <li><kbd>T</kbd><span>ကောင်းကင်တည့်တည့် ကြည့်ရန်</span></li>
     <li><kbd>V</kbd><span>မြင်ကွင်းပြောင်းရန် (1st / 3rd)</span></li>
     <li><kbd>R</kbd><span>မူလနေရာ (အစသို့)</span></li>
     <li><kbd>Esc</kbd><span>Mouse လွှတ်ရန် / ပိတ်ရန်</span></li>
    </ul>
   </div>
  </section>}
 </div>
 {!hideHud&&!mapOpen&&!topDown&&zoom<=10&&<section className="welcome"><span className="eyebrow">မင်္ဂလာပါ</span><h2>ရပ်ကွက်ထဲ လမ်းလျှောက်ကြမယ်</h2><p>စတင်ရန် မြင်ကွင်းကို နှိပ်ပါ။<br/>Mouse ဖြင့် ပတ်ဝန်းကျင်ကို ကြည့်နိုင်ပြီး Scroll ဖြင့် 3D မြေပုံလို Zoom အဝင်အထွက် လုပ်နိုင်ပါတယ်။</p><strong>Click the scene to explore →</strong><small>Desktop keyboard & mouse · Scroll to zoom · T for sky view</small></section>}
 {locked&&<div className="crosshair">+</div>}
 <aside className={mapOpen?"map map-expanded":"map"} aria-label="Ward plan" onClick={()=>{if(!mapOpen){if(document.pointerLockElement)document.exitPointerLock();setSettingsOpen(false);setMapOpen(true);}}}>
  <button type="button" className="map-toggle" aria-expanded={mapOpen} onClick={e=>{e.stopPropagation();if(document.pointerLockElement)document.exitPointerLock();setSettingsOpen(false);setMapOpen(v=>!v);}}>{mapOpen?`✕ ပိတ်ရန် · WARD PLAN (${activeDest.label})`:"WARD PLAN ↗"}<b>မြောက် ↖</b></button>
  {mapOpen&&<div className="map-jump-bar" aria-label="နယ်မြေနှင့် ရွာများသို့ တိုက်ရိုက်သွားရန်">
   <span>နယ်မြေ / ရွာ ရွေး၍ 3D Scene သို့ သွားရန် —</span>
   {MAP_DESTINATIONS.map(d=><button key={d.id} type="button" className={activeLocId===d.id?"map-jump-btn map-jump-btn-active":"map-jump-btn"} onClick={e=>{e.stopPropagation();handleSelectLocation(d.id);}}>📍 {d.label} ↗</button>)}
  </div>}
  <svg viewBox={`${-ward.size/2-5} ${-ward.size/2-5} ${ward.size+10} ${ward.size+10}`} aria-label="မြို့သာရပ်ကွက် မြေပုံ">
   <rect x={-ward.size/2} y={-ward.size/2} width={ward.size} height={ward.size} fill="#92a36b"/>
   <KalayWardsPlan labels={mapOpen} onSelectLocation={handleSelectLocation}/>
   <KalayVillagesPlan labels={mapOpen} onSelectLocation={handleSelectLocation}/>
   <circle cx={pos.x} cy={pos.z} r="4" fill="#fff4b3" stroke="#173d35" strokeWidth="2"/>
  </svg>
  <small>{ward.currentArea} · သာစည် · ချင်းဆိုင် · ဇင်းကလင်း · ထိုမာ · သာယာကုန်း</small>
  {mapOpen&&<p className="map-help">မြေပုံပေါ်ရှိ သက်ဆိုင်ရာ ရပ်ကွက် / ရွာကို တိုက်ရိုက်နှိပ်၍ 3D မြင်ကွင်းသို့ သွားနိုင်ပါသည် · Esc ပိတ်ရန်</p>}
 </aside>
 <footer className={hideHud?"footer-clean":""}>{!hideHud&&<div><kbd>W A S D / ↑ ↓ ← →</kbd> လမ်းလျှောက် <kbd>Shift + Drag</kbd> မြေပုံဆွဲရွှေ့ <kbd>Shift</kbd> ပြေး <kbd>Scroll</kbd> Zoom <kbd>T</kbd> ကောင်းကင်တည့်တည့် <kbd>V</kbd> မြင်ကွင်း <kbd>R</kbd> အစသို့ <kbd>Esc</kbd> လွှတ်ရန်</div>}<span>{topDown?'TOP-DOWN SKY':first?'FIRST PERSON':'THIRD PERSON'} · ZOOM {Math.round(zoom)}m · {pos.x.toFixed(1)}, {pos.z.toFixed(1)} m</span></footer>
 </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
