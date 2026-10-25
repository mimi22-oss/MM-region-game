import {useState,type ReactNode} from 'react';
import {CAR_MODELS,HUMAN_PRESETS,defaultAppearance,type HumanPreset,type HumanAppearance,type RobotAppearance,type CarAppearance} from '../data/appearance';
import {setAppearance,useAppearance} from '../game/appearanceStore';
import type {CharacterKind} from './CharacterPicker';
const labels:Record<HumanPreset,string>={boy:'Boy · လူငယ်',girl:'Girl · မိန်းကလေး',mother:'Mother · အမေ',grandmother:'Grandmother · အဘွား',grandfather:'Grandfather · အဖိုး',father:'Father · အဖေ'};
function Field({label,children}:{label:string;children:ReactNode}){return <label className="appearance-field"><span>{label}</span>{children}</label>;}
function Choice<T extends string>({label,value,options,onChange}:{label:string;value:T;options:readonly (readonly [T,string])[];onChange:(v:T)=>void}){
 return <Field label={label}><select value={value} onChange={e=>onChange(e.target.value as T)}>{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></Field>;
}
function Color({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <Field label={label}><input type="color" value={value} onChange={e=>onChange(e.target.value)}/></Field>;}
export function AppearanceSettings({kind,onKindChange,characterLocked=false,carLocked=false}:{kind:CharacterKind;onKindChange:(v:CharacterKind)=>void;characterLocked?:boolean;carLocked?:boolean}){
 const settings=useAppearance(),[tab,setTab]=useState<'human'|'robot'|'car'>(kind==='robot'?'robot':'human');
 const human=(patch:Partial<HumanAppearance>)=>setAppearance({...settings,human:{...settings.human,...patch}});
 const robot=(patch:Partial<RobotAppearance>)=>setAppearance({...settings,robot:{...settings.robot,...patch}});
 const car=(patch:Partial<CarAppearance>)=>setAppearance({...settings,car:{...settings.car,...patch}});
 const defaults=defaultAppearance();
 return <section className="appearance-settings" aria-label="ပုံစံပြင်ဆင်ရန်">
  <div className="appearance-tabs" role="tablist" aria-label="ပြင်ဆင်မည့် အမျိုးအစား">{([['human','လူ'],['robot','Robot'],['car','ကား']] as const).map(([id,label])=><button type="button" key={id} id={`appearance-tab-${id}`} role="tab" aria-selected={tab===id} aria-controls={`appearance-panel-${id}`} onClick={()=>{setTab(id);if(id!=='car'&&!characterLocked)onKindChange(id==='human'?'cartoon':'robot');}}>{label}</button>)}</div>
  <div role="tabpanel" id={`appearance-panel-${tab}`} aria-labelledby={`appearance-tab-${tab}`}>
   {tab==='human'&&<>
    <Choice label="လူပုံစံ" value={settings.human.preset} options={Object.entries(labels) as [HumanPreset,string][]} onChange={preset=>setAppearance({...settings,human:{...HUMAN_PRESETS[preset]}})}/>
    <Choice label="ဆံပင်ပုံစံ" value={settings.human.hair} options={[["swept","ဘေးခွဲ"],["bob","ဆံပင်တို"],["long","ဆံပင်ရှည်"],["bun","ဆံထုံး"]]} onChange={hair=>human({hair})}/>
    <div className="appearance-colors"><Color label="ဆံပင်အရောင်" value={settings.human.hairColor} onChange={hairColor=>human({hairColor})}/><Color label="အသားအရောင်" value={settings.human.skin} onChange={skin=>human({skin})}/></div>
    <Choice label="မျက်နှာပုံစံ" value={settings.human.face} options={[["oval","ဘဲဥပုံ"],["round","မျက်နှာဝိုင်း"],["mature","အသက်ကြီးပုံစံ"]]} onChange={face=>human({face})}/>
    <Choice label="အဝတ်အစား" value={settings.human.clothes} options={[["hoodie","Hoodie"],["shirt","အင်္ကျီ"],["dress","ဂါဝန်"],["longyi","အင်္ကျီ + လုံချည်"]]} onChange={clothes=>human({clothes})}/>
    <div className="appearance-colors"><Color label="အင်္ကျီအရောင်" value={settings.human.clothingColor} onChange={clothingColor=>human({clothingColor})}/><Color label="ဘောင်းဘီ / လုံချည်" value={settings.human.trousersColor} onChange={trousersColor=>human({trousersColor})}/></div>
    <Field label={`အရပ် · ${Math.round(settings.human.height*100)}%`}><input aria-label="အရပ်" type="range" min=".8" max="1.2" step=".01" value={settings.human.height} onChange={e=>human({height:Number(e.target.value)})}/></Field>
    <Choice label="ဖိနပ်ပုံစံ" value={settings.human.shoes} options={[["sneakers","Sneakers"],["boots","Boots"],["sandals","ခြေညှပ်ဖိနပ်"]]} onChange={shoes=>human({shoes})}/>
    <Color label="ဖိနပ်အရောင်" value={settings.human.shoeColor} onChange={shoeColor=>human({shoeColor})}/>
    <p>လူဇာတ်ကောင်နှင့် ယာဉ်မောင်းတွင် သုံးပါမည်။ စီးနင်းချိန်တွင် ထိုင်ခုံနှင့် ကိုက်ညီအောင် အရပ်ကို ညှိပေးသည်။</p>
   </>}
   {tab==='robot'&&<>
    <div className="appearance-colors"><Color label="Robot အရောင်" value={settings.robot.color} onChange={color=>robot({color})}/><Color label="အလှဆင်အရောင်" value={settings.robot.accent} onChange={accent=>robot({accent})}/></div>
    <Field label={`Robot အရွယ် · ${Math.round(settings.robot.size*100)}%`}><input aria-label="Robot အရွယ်" type="range" min=".75" max="1.25" step=".01" value={settings.robot.size} onChange={e=>robot({size:Number(e.target.value)})}/></Field>
    <Choice label="ခြေထောက်" value={settings.robot.legs} options={[["wheels","ဘီးနှစ်ဘီး"],["feet","ခြေထောက်နှစ်ဖက်"],["tracks","သံကြိုးဘီး"]]} onChange={legs=>robot({legs})}/>
    <Choice label="လက်ပုံစံ" value={settings.robot.hands} options={[["rounded","လက်ဝိုင်း"],["claw","ညှပ်လက်"],["gripper","လက်ချောင်းသုံးချောင်း"]]} onChange={hands=>robot({hands})}/>
    {characterLocked&&<p>ဆင်းပြီးနောက် Robot ဇာတ်ကောင်ကို ရွေးနိုင်ပါသည်။</p>}
   </>}
   {tab==='car'&&<>
    <p>မိမိခေါ်ယူစီးနင်းသည့် ကားကို ပြောင်းပါမည်။</p>
    <fieldset disabled={carLocked} className="appearance-vehicle-options">
     <Choice label="ကားပုံစံ" value={settings.car.model} options={Object.entries(CAR_MODELS).map(([key,value])=>[key as CarAppearance['model'],value.label])} onChange={model=>car({model})}/>
     <Choice label="ဂီယာစနစ်" value={settings.car.transmission} options={[["manual","Manual · ကလပ် + ဂီယာ 1–4"],["automatic","Auto · P / R / N / D"]]} onChange={transmission=>car({transmission})}/>
    </fieldset>
    <Color label="ကားအရောင်" value={settings.car.color} onChange={color=>car({color})}/>
    {carLocked&&<p>ကားပုံစံနှင့် ဂီယာစနစ် ပြောင်းရန် ကားပေါ်မှ အရင်ဆင်းပါ။</p>}
    <p>ကားများသည် ဒီဂိမ်းအတွက် ဖန်တီးထားသော ပုံစံများ ဖြစ်ပါသည်။</p>
   </>}
   <button className="appearance-reset" type="button" disabled={tab==='car'&&carLocked} onClick={()=>setAppearance({...settings,[tab]:defaults[tab]})}>ဤအမျိုးအစားကို မူလအတိုင်း ပြန်ထားမည်</button>
  </div>
  <small className="appearance-saved">ရွေးချယ်မှုများကို ဤ browser တွင် အလိုအလျောက် မှတ်ထားပါသည်။</small>
 </section>;
}
