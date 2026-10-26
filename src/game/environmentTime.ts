export type TimePeriod = 'morning' | 'day' | 'evening' | 'night';
export type TimeMode = 'auto' | TimePeriod;
export type EnvironmentPreferences = {mode: TimeMode; sound: boolean; volume: number};
export const ENVIRONMENT_STORAGE_KEY = 'mm-town-environment-v1';
export const TIME_PERIODS: {id: TimePeriod; label: string; icon: string; range: string; minute: number}[] = [
 {id:'morning',label:'မနက်',icon:'🌅',range:'05:00 – 10:59',minute:420},
 {id:'day',label:'နေ့လယ်',icon:'☀️',range:'11:00 – 16:29',minute:780},
 {id:'evening',label:'ညနေ',icon:'🌇',range:'16:30 – 18:59',minute:1020},
 {id:'night',label:'ည',icon:'🌙',range:'19:00 – 04:59',minute:1260},
];
export function periodAtMinute(minute: number): TimePeriod {
 const m=((minute%1440)+1440)%1440;
 return m<300||m>=1140?'night':m<660?'morning':m<990?'day':'evening';
}
/** Uses the device's timezone, including DST; no GPS or network permission is required. */
export function localMinute(date = new Date()) {return date.getHours()*60+date.getMinutes()+date.getSeconds()/60;}
export function environmentMinute(mode: TimeMode, date = new Date()) {
 return mode==='auto'?localMinute(date):TIME_PERIODS.find(p=>p.id===mode)!.minute;
}
export function parseEnvironmentPreferences(raw: string|null): EnvironmentPreferences {
 const defaults:EnvironmentPreferences={mode:'auto',sound:true,volume:.3};
 try {
  const value=JSON.parse(raw??'null');
  if(!value||typeof value!=='object')return defaults;
  return {
   mode:value.mode==='auto'||TIME_PERIODS.some(p=>p.id===value.mode)?value.mode:'auto',
   sound:typeof value.sound==='boolean'?value.sound:true,
   volume:typeof value.volume==='number'&&Number.isFinite(value.volume)?Math.max(0,Math.min(1,value.volume)):.3,
  };
 }catch{return defaults;}
}
export function savedEnvironmentPreferences(){
 try{return parseEnvironmentPreferences(localStorage.getItem(ENVIRONMENT_STORAGE_KEY));}catch{return parseEnvironmentPreferences(null);}
}

export type EnvironmentPalette = {
 sky:string; horizon:string; fog:string; sun:string; ambient:string; ground:string;
 sunlight:number; ambientLight:number; elevation:number; azimuth:number;
 fogNear:number; fogFar:number; lamps:number; stars:number; shadowSoftness:number;
};
const night:EnvironmentPalette={sky:'#071020',horizon:'#172842',fog:'#111e30',sun:'#a9c9ff',ambient:'#a6bddc',ground:'#566957',sunlight:.7,ambientLight:1,elevation:.65,azimuth:-1.4,fogNear:1500,fogFar:7000,lamps:1,stars:1,shadowSoftness:4};
const dawn:EnvironmentPalette={sky:'#596a9d',horizon:'#efb7b0',fog:'#bdafb0',sun:'#ffba85',ambient:'#c5c0d5',ground:'#7a8061',sunlight:.85,ambientLight:1.15,elevation:.14,azimuth:1.4,fogNear:250,fogFar:5200,lamps:.65,stars:.1,shadowSoftness:4};
const morning:EnvironmentPalette={sky:'#8bbddc',horizon:'#f5dfba',fog:'#d2ded7',sun:'#ffe6ad',ambient:'#e5eff2',ground:'#8c9868',sunlight:2,ambientLight:1.65,elevation:.4,azimuth:1.2,fogNear:700,fogFar:6500,lamps:0,stars:0,shadowSoftness:3.5};
const day:EnvironmentPalette={sky:'#62b6eb',horizon:'#d8edee',fog:'#c6ded8',sun:'#fff5dd',ambient:'#e5f2ee',ground:'#92a36b',sunlight:2.6,ambientLight:2,elevation:1.25,azimuth:0,fogNear:2200,fogFar:7500,lamps:0,stars:0,shadowSoftness:1.2};
const evening:EnvironmentPalette={sky:'#8173b2',horizon:'#ffb07a',fog:'#d3aaa1',sun:'#ffac65',ambient:'#d5b6d5',ground:'#8d8663',sunlight:1.75,ambientLight:1.35,elevation:.25,azimuth:-1.3,fogNear:1200,fogFar:6800,lamps:.2,stars:0,shadowSoftness:4};
const dusk:EnvironmentPalette={sky:'#302c59',horizon:'#ca818f',fog:'#6d607c',sun:'#efb1a1',ambient:'#b7acca',ground:'#697463',sunlight:.9,ambientLight:1.2,elevation:.12,azimuth:-1.5,fogNear:1200,fogFar:6800,lamps:1,stars:.55,shadowSoftness:4};
/** Continuous daily keyframes; the label boundaries remain the user's exact schedule. */
export const ENVIRONMENT_KEYFRAMES: {minute:number;palette:EnvironmentPalette}[] = [
 {minute:0,palette:night},{minute:285,palette:night},{minute:300,palette:dawn},
 {minute:420,palette:morning},{minute:660,palette:day},{minute:870,palette:day},
 {minute:990,palette:evening},{minute:1110,palette:dusk},{minute:1140,palette:night},{minute:1440,palette:night},
];
export function environmentBlend(minute:number){
 const m=((minute%1440)+1440)%1440;
 const index=ENVIRONMENT_KEYFRAMES.findIndex((frame,i)=>i>0&&m<frame.minute);
 const b=ENVIRONMENT_KEYFRAMES[index<0?ENVIRONMENT_KEYFRAMES.length-1:index];
 const a=ENVIRONMENT_KEYFRAMES[Math.max(0,(index<0?ENVIRONMENT_KEYFRAMES.length-1:index)-1)];
 const t=Math.max(0,Math.min(1,(m-a.minute)/(b.minute-a.minute)));
 return {a:a.palette,b:b.palette,t:t*t*(3-2*t)};
}
