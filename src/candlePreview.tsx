import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Candle,CandleHolder,CandleInHolder,CandleAnimation} from './components/Candle';
function Orbit(){const {camera,gl}=useThree();useEffect(()=>{const controls=new OrbitControls(camera,gl.domElement);controls.target.set(0,.25,0);controls.minDistance=1.5;controls.maxDistance=6;controls.maxPolarAngle=Math.PI*.49;controls.update();return ()=>controls.dispose();},[camera,gl]);return null;}
function Preview(){
 const [night,setNight]=useState(true);
 return <main style={{background:'#0c1428',color:'#fff4d9',minHeight:'100dvh',fontFamily:'system-ui,sans-serif'}}>
  <header style={{padding:'20px 6vw 4px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div><small style={{color:'#eab560'}}>သီတင်းကျွတ် မီးထွန်းပွဲ</small><h1 style={{fontSize:24,margin:'8px 0'}}>ဖယောင်းတိုင် နှင့် မီးခွက်</h1></div><button onClick={()=>setNight(!night)} style={{padding:'10px 20px',borderRadius:24,border:'1px solid #eab560',color:'#ffe5ae',background:'transparent',cursor:'pointer'}}>{night?'နေ့အလင်းဖြင့် ကြည့်ရန်':'ညအလင်းဖြင့် ကြည့်ရန်'}</button></header>
  <div style={{height:'62dvh',minHeight:300}}><Canvas dpr={[1,1.5]} camera={{position:[1.4,1.3,2.8],fov:40,near:.01}}>
   <color attach="background" args={[night?'#0c1428':'#d7dfdf']}/><ambientLight intensity={night?.5:1.8}/><directionalLight position={[2,4,3]} intensity={night?1.0:2.5} color={night?'#ffc98e':'#ffffff'}/>
   <CandleAnimation/><Orbit/>
   <Candle position={[-.85,.06,0]} scale={1.4}/><CandleHolder position={[0,.06,0]} scale={1.4}/><CandleInHolder position={[.85,.06,0]} scale={1.4}/>
   {[-.85,0,.85].map(x=><mesh key={x} position={[x,0,0]}><cylinderGeometry args={[.46,.48,.12,48]}/><meshStandardMaterial color={night?'#243650':'#a5aeba'} roughness={.75}/></mesh>)}
  </Canvas></div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,textAlign:'center',maxWidth:1000,margin:'0 auto',padding:'0 16px'}}>{[['ဖယောင်းတိုင်','သံဇကာပေါ်တွင် ထွန်းရန်'],['မီးခွက်','သီးသန့် အလှဆင်မီးခွက်'],['ဖယောင်းတိုင် + မီးခွက်','အိမ်ရှေ့၊ စားပွဲပေါ်တွင် ထွန်းရန်']].map(([title,detail])=><div key={title}><strong>{title}</strong><p style={{color:'#b8c4db',fontSize:13,lineHeight:1.8}}>{detail}</p></div>)}</div>
  <p style={{textAlign:'center',color:'#b8c4db',fontSize:13,padding:16}}>ဆွဲလှည့်၍ ကြည့်နိုင်ပါသည် · Scroll / Pinch ဖြင့် အနီးအဝေး ကြည့်နိုင်ပါသည်</p>
 </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview/></React.StrictMode>);
