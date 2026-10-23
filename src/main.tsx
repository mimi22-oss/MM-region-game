import React, { Component, useEffect, useCallback, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { Town } from './components/Town';
import { FARMHOUSE_NAME, houseFenceBounds, houseVisualRotation } from './components/House';
import { Player, MIN_ZOOM, MAX_ZOOM } from './components/Player';
import { ward } from './data/ward';
import './style.css';
import { RiceMillPlan } from './components/RiceMillPlan';
class SceneError extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className="error">3D scene မဖွင့်နိုင်ပါ။ WebGL / hardware acceleration ဖွင့်ထားသော desktop browser ဖြင့် ပြန်စမ်းပါ။</div>:this.props.children}
}
function App(){
 const [first,setFirst]=useState(false);const [locked,setLocked]=useState(false);const [pos,setPos]=useState(ward.spawn);
 const [mapOpen,setMapOpen]=useState(false);
 const [topDown,setTopDown]=useState(false);
 const [zoom,setZoom]=useState(6);
 useEffect(()=>{if(!mapOpen)return;const close=(e:KeyboardEvent)=>{if(e.code==="Escape")setMapOpen(false)};document.addEventListener("keydown",close);return ()=>document.removeEventListener("keydown",close)},[mapOpen]);
 const position=useCallback((x:number,z:number)=>setPos({x,z}),[]);
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
 return <main>
 <SceneError><Canvas shadows camera={{position:[0,5,33],fov:65,near:0.1,far:2500}} dpr={[1,1.75]}><Town/><Player mapOpen={mapOpen} topDown={topDown} zoom={zoom} onMode={setFirst} onTopDown={setTopDown} onZoom={setZoom} onLock={setLocked} onPosition={position}/></Canvas></SceneError>
 <header><span className="eyebrow">EXPLORE MYANMAR / 01</span><h1>{ward.name}</h1><p>AH1 · Myothar · Kalay</p></header>
 <div className="badge"><span/> MAP STUDY <b>820 × 820 m</b></div>
 <div className="cam-controls" aria-label="3D camera controls">
  <button type="button" className={topDown?"cam-btn cam-btn-active":"cam-btn"} aria-pressed={topDown} onClick={toggleTopDown}>{topDown?"✓ ကောင်းကင်တည့်တည့် · TOP-DOWN":"ကောင်းကင်တည့်တည့် · TOP-DOWN (T)"}</button>
  <button type="button" className="cam-btn" onClick={()=>stepZoom(-1)} title="Zoom in">＋ Zoom In</button>
  <button type="button" className="cam-btn" onClick={()=>stepZoom(1)} title="Zoom out">－ Zoom Out</button>
 </div>
 {!locked&&!mapOpen&&!topDown&&zoom<=10&&<section className="welcome"><span className="eyebrow">မင်္ဂလာပါ</span><h2>ရပ်ကွက်ထဲ လမ်းလျှောက်ကြမယ်</h2><p>စတင်ရန် မြင်ကွင်းကို နှိပ်ပါ။<br/>Mouse ဖြင့် ပတ်ဝန်းကျင်ကို ကြည့်နိုင်ပြီး Scroll ဖြင့် 3D မြေပုံလို Zoom အဝင်အထွက် လုပ်နိုင်ပါတယ်။</p><strong>Click the scene to explore →</strong><small>Desktop keyboard & mouse · Scroll to zoom · T for sky view</small></section>}
 {locked&&<div className="crosshair">+</div>}
 <aside className={mapOpen?"map map-expanded":"map"} aria-label="Ward plan"><button className="map-toggle" aria-expanded={mapOpen} onClick={()=>{if(document.pointerLockElement)document.exitPointerLock();setMapOpen(v=>!v)}}>{mapOpen?"✕ ပိတ်ရန် · WARD PLAN":"WARD PLAN ↗"}<b>မြောက် ↖</b></button><svg viewBox="-415 -415 830 830" aria-label="မြို့သာရပ်ကွက် မြေပုံ"><rect x="-410" y="-410" width="820" height="820" fill="#92a36b"/>{ward.fields.map((f,i)=><rect key={`f${i}`} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}{ward.roads.map(r=><rect key={r.id} x={r.x-r.width/2} y={r.z-r.depth/2} width={r.width} height={r.depth} fill={r.main?'#657371':'#d4bd98'} transform={`rotate(${-r.rotation*180/Math.PI} ${r.x} ${r.z})`}/>)}<g transform={`translate(${ward.openGround.x} ${ward.openGround.z}) rotate(${-ward.openGround.rotation*180/Math.PI})`}><rect x={-ward.openGround.width/2} y={-ward.openGround.depth/2} width={ward.openGround.width} height={ward.openGround.depth} fill="#b8ac83"/>{mapOpen&&<text textAnchor="middle" fontSize="7">ကွက်လပ်ပြင်ကြီး</text>}</g><g transform={`translate(${ward.pitch.x} ${ward.pitch.z}) rotate(${-ward.pitch.rotation*180/Math.PI})`}><rect x="-30" y="-48" width="60" height="96" fill="#668b50" stroke="#eee9d2"/><path d="M-30 0H30" stroke="#eee9d2"/><circle r="9" fill="none" stroke="#eee9d2"/>{mapOpen&&<text y="20" textAnchor="middle" fontSize="6" fill="#fff">ဘောလုံးကွင်း</text>}</g>{ward.warehouses.map(w=><rect key={w.id} x={w.x-w.width/2} y={w.z-w.depth/2} width={w.width} height={w.depth} fill={w.roof} stroke="#e1d5bb" transform={`rotate(${-w.rotation*180/Math.PI} ${w.x} ${w.z})`}/>)}<g transform={`translate(${ward.frontLot.x} ${ward.frontLot.z}) rotate(${-ward.frontLot.rotation*180/Math.PI})`}><rect x={-ward.frontLot.width/2} y={-ward.frontLot.depth/2} width={ward.frontLot.width} height={ward.frontLot.depth} fill="#c1b590"/><line x1={ward.frontLot.width/2} y1={-ward.frontLot.depth/2} x2={ward.frontLot.width/2} y2={-1.7} stroke="#2563a6" strokeWidth="1.2"/><line x1={ward.frontLot.width/2} y1={1.7} x2={ward.frontLot.width/2} y2={ward.frontLot.depth/2} stroke="#2563a6" strokeWidth="1.2"/>{mapOpen&&<text textAnchor="middle" fontSize="5">မြေကွက်လပ်</text>}</g><g transform={`translate(${ward.farmNorthLand.x} ${ward.farmNorthLand.z}) rotate(${-ward.farmNorthLand.rotation*180/Math.PI})`}><rect x="-32" y="-18" width="64" height="36" fill="#b1b77c" stroke="#d8c68b"/>{mapOpen&&<text textAnchor="middle" fontSize="4.5">{ward.farmNorthLand.owner}</text>}</g>{ward.sideLots.map((l,i)=><g key={`empty${i}`} transform={`translate(${l.x} ${l.z}) rotate(${-l.rotation*180/Math.PI})`}><rect x={-l.width/2} y={-l.depth/2} width={l.width} height={l.depth} fill="#c1b590" stroke="#d8c68b"/>{mapOpen&&<text textAnchor="middle" fontSize="3">မြေကွက်လပ်</text>}</g>)}{ward.roads.filter(r=>r.id==='farmhouse-access').map(r=><rect key={r.id} x={r.x-r.width/2} y={r.z-r.depth/2} width={r.width} height={r.depth} fill="#d4bd98" transform={`rotate(${-r.rotation*180/Math.PI} ${r.x} ${r.z})`}/>)}{[ward.canal,...ward.drains].map((c,i)=><g key={`canal${i}`} transform={`translate(${c.x} ${c.z}) rotate(${-c.rotation*180/Math.PI})`}><rect x={-c.width/2} y={-c.depth/2} width={c.width} height={c.depth} fill="#4d9395"/>{c.bridges.map(v=><rect key={v} x={-c.width/2-1} y={v-2.5} width={c.width+2} height="5" fill="#d6cfb9"/>)}</g>)}{[...ward.yards,ward.farm].map((p,i)=><rect key={`plot${i}`} x={p.x-p.width/2} y={p.z-p.depth/2} width={p.width} height={p.depth} fill={i<ward.yards.length?'#b7ad83':'#a6a66e'} stroke="#8b9367" transform={`rotate(${-p.rotation*180/Math.PI} ${p.x} ${p.z})`}/>)}<rect x={ward.pond.x-ward.pond.width/2} y={ward.pond.z-ward.pond.depth/2} width={ward.pond.width} height={ward.pond.depth} fill="#548f94" stroke="#97825c" strokeWidth="2" transform={`rotate(${-ward.pond.rotation*180/Math.PI} ${ward.pond.x} ${ward.pond.z})`}/>{ward.farmTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="2.4" fill="#547b48"/>)}<g transform={`translate(${ward.monastery.x} ${ward.monastery.z}) rotate(${-ward.monastery.rotation*180/Math.PI})`}><rect x="-48" y="-33" width="96" height="66" fill="#b9b08a" stroke="#eee2b8"/>{ward.monastery.buildings.map(b=><g key={b.id}><rect x={b.u-b.width/2} y={b.v-b.depth/2} width={b.width} height={b.depth} fill={b.roof}/>{mapOpen&&<text x={b.u} y={b.v} textAnchor="middle" fontSize="3.5" fill="#fff">{b.name}</text>}</g>)}{ward.monastery.stupas.map((p,i)=><circle key={i} cx={p.u} cy={p.v} r={p.radius} fill="#edc856"/>)}{mapOpen&&<text x="0" y="-18" fontSize="5" textAnchor="middle">ကျောင်းဝင်း ကွင်းပြင်</text>}</g><g transform={`rotate(${-ward.crossCanal.rotation*180/Math.PI})`}><polyline points={ward.crossCanal.points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#4d9395" strokeWidth={ward.crossCanal.depth} strokeLinejoin="round" strokeLinecap="round"/>{ward.crossCanal.bridges.map((b,i)=><rect key={i} x={b.u-b.width/2} y={b.v-b.depth/2} width={b.width} height={b.depth} fill="#b7ad95"/>)}</g><RiceMillPlan labels={mapOpen}/>{ward.houses.map(h=>{const {sideHalf,backHalf,frontHalf}=houseFenceBounds(h);const rot=houseVisualRotation(h);return <g key={h.id}><g transform={`translate(${h.x} ${h.z}) rotate(${-rot*180/Math.PI})`}>{h.name!==FARMHOUSE_NAME&&<><line x1={-sideHalf} y1={-backHalf} x2={-sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8"/><line x1={sideHalf} y1={-backHalf} x2={sideHalf} y2={frontHalf} stroke="#68767a" strokeWidth="0.6" strokeDasharray="1.2 0.8"/><line x1={-sideHalf} y1={frontHalf} x2={-1.3} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1"/><line x1={1.3} y1={frontHalf} x2={sideHalf} y2={frontHalf} stroke="#2563a6" strokeWidth="1.1"/></>}<rect x={-h.width/2} y={-h.depth/2} width={h.width} height={h.depth} fill={h.roof}/></g></g>})}{ward.trees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="5.8" fill="#365a42"/>)}{ward.largeTrees.map(t=><circle key={t.id} cx={t.x} cy={t.z} r="6.5" fill="#486e40" stroke="#739451" strokeWidth="0.6"/>)}<circle cx={pos.x} cy={pos.z} r="4" fill="#fff4b3" stroke="#173d35" strokeWidth="2"/><text x="55" y="-90" fontSize="15" fill="#fff">AH1</text></svg><small>{ward.houses.length} HOMES · 8 ဂိုဒေါင် · ဘောလုံးကွင်း</small>{mapOpen&&<p className="map-help">မြောက် ↖ ဂိုဒေါင်ဘက် · အရှေ့ ↗ လမ်းမဘက် · အနောက် ↙ စိုက်ခင်းဘက် · တောင် ↘ · Esc ပိတ်ရန်</p>}</aside>
 <footer><div><kbd>W A S D / ↑ ↓ ← →</kbd> လမ်းလျှောက် <kbd>Shift</kbd> ပြေး <kbd>Scroll</kbd> Zoom <kbd>T</kbd> ကောင်းကင်တည့်တည့် <kbd>V</kbd> မြင်ကွင်း <kbd>R</kbd> အစသို့ <kbd>Esc</kbd> လွှတ်ရန်</div><span>{topDown?'TOP-DOWN SKY':first?'FIRST PERSON':'THIRD PERSON'} · ZOOM {Math.round(zoom)}m · {pos.x.toFixed(1)}, {pos.z.toFixed(1)} m</span></footer>
 </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);

