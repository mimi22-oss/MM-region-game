export type House = { id:string; name:string; x:number; z:number; width:number; depth:number; color:string; rotation:number; roof:string };
export const angle=Math.PI/4;
export function toWorld(u:number,v:number){return {x:u*Math.cos(angle)+v*Math.sin(angle),z:-u*Math.sin(angle)+v*Math.cos(angle)}}
const houses:House[]=[];
for(let row=0;row<3;row++)for(let n=0;n<7;n++){
 const i=houses.length;
 houses.push({id:`h${i+1}`,name:`မြို့သာအိမ် ${i+1}`,...toWorld(-66-row*22,-90+n*29),width:9+i%3,depth:9+i%3,color:['#bd9973','#d8c7a3','#a9b9b0'][i%3],rotation:angle,roof:['#8b5545','#849699','#a39a85'][i%3]});
}
// Five lanes beside the pitch; every interval contains exactly two house rows.
export const pitchLanes=[128,158,188,218,248];
export const oppositeLanes=[128,192,310,382];
for(let block=0;block<pitchLanes.length-1;block++)for(const offset of [9,21])for(const u of [24,46,68,90,112,134]){
 const i=houses.length;houses.push({id:`h${i+1}`,name:`ကွင်းဘေးအိမ် ${i+1}`,...toWorld(u,pitchLanes[block]+offset),width:9,depth:7,color:['#d8c7a3','#bfa58a','#a9b9b0'][i%3],rotation:angle,roof:['#8b5545','#849699','#a39a85'][i%3]});
}
function oppositeHome(u:number,v:number,name:string){const i=houses.length;houses.push({id:`h${i+1}`,name,...toWorld(u,v),width:10,depth:9,color:'#d8c7a3',rotation:angle,roof:i%2?'#849699':'#8b5545'})}
// User-defined north points toward the warehouse/tree corridor (decreasing v).
export const residentialRows={northFar:[140,158,176],northNear:[204,222,240],southNear:[296],southFar:[328,346,364]};
for(const [group,rows] of Object.entries(residentialRows))for(const v of rows)for(const u of [-24,-74]){
 if(group==='northNear'&&u===-74&&v!==residentialRows.northNear[0])continue;
 oppositeHome(u,v,`${group} · အိမ်တန်း ${v}`);
}
oppositeHome(-72,270,'လမ်းသွယ် ၂ · စိုက်ခင်းအိမ်');houses[houses.length-1].rotation=angle+Math.PI/2;
export const farmhouse=houses[houses.length-1];
oppositeHome(-182,270,'လမ်းသွယ် ၂ · မြောင်းနောက်အိမ်');houses[houses.length-1].rotation=angle+Math.PI/2;// New rows east of AH1: four homes in the first row, one in the second.
for(const u of [24,46,68,90])oppositeHome(u,270,'အရှေ့တန်း ၁ · အိမ်');
oppositeHome(24,294,'အရှေ့တန်း ၂ · အိမ်');
oppositeHome(152,290,'ဆန်စက်ဝင်း · ရှေ့အိမ်');
oppositeHome(194,326,'ဆန်စက်ဝင်း · သိုလှောင်ရုံဘေးအိမ်');
oppositeHome(24,334,'ဆန်စက်ဘေး · ပထမအိမ်တန်း');
oppositeHome(24,394,'ဆန်စက်ဘေး · နောက်ဆုံးအိမ်တန်း');
for(const h of houses)if(h.x*Math.cos(angle)-h.z*Math.sin(angle)>0)h.rotation=angle-Math.PI/2;export const ward={
 name:'မြို့သာရပ်ကွက် · ကလေးမြို့',size:820,spawn:toWorld(0,105),
 description:'ပေးထားသော မြေပုံကို မှီငြမ်းထားသော ခန့်မှန်း 3D ပုံစံ',houses,
 warehouses:[-1,1].flatMap(side=>[-75,-25,25,75].map((v,i)=>({id:`warehouse${side}-${i}`,...toWorld(side*34,v),width:21,depth:35,rotation:angle,color:side<0?'#c0b7a3':'#b6beb7',roof:i%2?'#83564b':'#879598'}))),
 pitch:{...toWorld(112,64),width:60,depth:96,rotation:angle},
 riceMill:{
  buildings:[
   {id:'rice-mill',name:'ဆန်စက်ရုံ',...toWorld(98,326),width:40,depth:42,rotation:angle,color:'#cbbd98',roof:'#c4af7d'},
   {id:'paddy-store',name:'စပါးသိုလှောင်ရုံ',...toWorld(154,326),width:38,depth:40,rotation:angle,color:'#c1ae88',roof:'#a7866b'}],
  yard:{...toWorld(44,316),width:60,depth:20,rotation:angle},
  paths:[{...toWorld(106,302),width:196,depth:3,rotation:angle},{...toWorld(126,326),width:10,depth:46,rotation:angle}],
  fields:[351,372].map((v,i)=>({...toWorld(44,v),width:60,depth:16,rotation:angle,color:i?'#879963':'#6f9257'}))
 },
 crossCanal:{v:282,junctionV:376,depth:3,rotation:angle,
  points:[[125,282],[0,282],[-5,284],[-9,290],[-9,334],[-9,362],[-12,372],[-24,376],[-170,376]],
  bridges:[{u:0,v:282,width:12,depth:7},{u:-9,v:310,width:7,depth:4}]},
 // Two north-south waterways, now joined by an east-west branch., shared by every residential lane.
 canal:{u:-54,v:132.5,width:4,depth:511,...toWorld(-54,132.5),rotation:angle,
  bridges:[-112,-47,40,112,...oppositeLanes,270].map(v=>v-132.5)},
 drains:[{u:-160,v:132.5,...toWorld(-160,132.5),width:4,depth:511,rotation:angle,
  bridges:oppositeLanes.map(v=>v-132.5)}], yards:[[-24,204],[-74,204],[-24,222]].map(([u,v])=>({...toWorld(u,v),width:14,depth:13,rotation:angle})),
 sideLots:[222,240].map(v=>({...toWorld(-74,v),width:14,depth:16,rotation:angle})),
 farmNorthLand:{...toWorld(-120,216),width:64,depth:36,rotation:angle,owner:'စိုက်ခင်းအိမ်ပိုင် မြေ'}, frontLot:{...toWorld(-29,270),width:38,depth:28,rotation:angle},
 farm:{...toWorld(-102,270),width:34,depth:44,rotation:angle},
 pond:{...toWorld(-140,270),width:16,depth:10,rotation:angle},
 farmTrees:[[-132,255],[-148,255],[-148,285],[-132,285]].map(([u,v],i)=>({id:`farm-tree-${i}`,...toWorld(u,v),radius:0.5})),
 openGround:{...toWorld(96,-50),width:100,depth:100,rotation:angle},
 monastery:{...toWorld(205,64),width:96,depth:66,rotation:angle,
  buildings:[
   {id:'mandap',name:'မဏ္ဍပ်',u:-32,v:7,width:19,depth:20,color:'#d8cfb7',roof:'#8b9caa'},
   {id:'dhamma',name:'ဓမ္မာရုံ',u:0,v:3,width:25,depth:19,color:'#e7d7b4',roof:'#547b69'},
   {id:'quarters',name:'ဘုန်းကြီးကျောင်းဆောင်',u:0,v:23,width:27,depth:14,color:'#bda382',roof:'#80564d'}],
  stupas:[{u:31,v:9,radius:5},{u:34,v:-10,radius:2.7},{u:23,v:-14,radius:2}],
 },
 roads:[{id:'farmhouse-access',name:'စိုက်ခင်းအိမ်ဝင်လမ်း',...toWorld(-31.5,270),width:63,depth:3,rotation:angle,main:false},{id:'ah1',name:'AH1',...toWorld(0,0),width:12,depth:790,rotation:angle,main:true},
 ...[-77,-99].map((u,i)=>({id:`lane${i}`,name:'ရပ်ကွက်လမ်း',...toWorld(u,0),width:5,depth:226,rotation:angle,main:false})),
 ...[-112,-47,40,112].map((v,i)=>({id:`cross${i}`,name:'လမ်းသွယ်',...toWorld(-57,v),width:114,depth:5,rotation:angle,main:false})),
 {id:'pitch-monastery-lane',name:'ကွင်းနှင့်ကျောင်းကြားလမ်း',...toWorld(150,68),width:5,depth:124,rotation:angle,main:false},
 ...pitchLanes.map((v,i)=>({id:`pitch-lane-${i+1}`,name:`ကွင်းဘေးလမ်းသွယ် ${i+1}`,...toWorld(77,v),width:154,depth:4,rotation:angle,main:false})),
 ...oppositeLanes.map((v,i)=>({id:`opposite-lane-${i+1}`,name:`မျက်နှာချင်းဆိုင်လမ်းသွယ် ${i+1}`,...toWorld(-92,v),width:184,depth:4,rotation:angle,main:false}))],
 fields:[[-84,-180],[220,-80]].map(([u,v],i)=>({...toWorld(u,v),width:44,depth:28,rotation:angle,color:['#a3aa65','#b5a571'][i]})),
 largeTrees:[
  {id:'front-lot-tree',u:-10,v:258},
  {id:'east-row-canal-tree',u:56,v:277},
  {id:'east-first-row-road-tree',u:12,v:270},
  {id:'rice-mill-yard-front-tree',u:12,v:316},
  ...pitchLanes.flatMap((v,i)=>[12,145].map((u,j)=>({id:`pitch-shade-${i}-${j}`,u,v:v+5}))),
  ...oppositeLanes.flatMap((v,i)=>[-12,-144].map((u,j)=>({id:`opposite-shade-${i}-${j}`,u,v:v+5}))),
  ...[-112,-47,40,112].map((v,i)=>({id:`old-cross-shade-${i}`,u:-124,v:v+6})),
  {id:'old-lane-shade-1',u:-82,v:-105},{id:'old-lane-shade-2',u:-104,v:-105},
  {id:'monastery-lane-shade-1',u:156,v:20},{id:'monastery-lane-shade-2',u:156,v:114},
 ].map(({id,u,v})=>({id,...toWorld(u,v),radius:1.1})),
 trees:[-1,1].flatMap(side=>Array.from({length:32},(_,i)=>({id:`t${side}-${i}`,...toWorld(side*14,-120+i*7.7),radius:0.55}))),
};















