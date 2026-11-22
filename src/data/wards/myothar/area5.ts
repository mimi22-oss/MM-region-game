export type House = { id:string; name:string; x:number; z:number; width:number; depth:number; color:string; rotation:number; roof:string };
export const angle=Math.PI/4;
export function toWorld(u:number,v:number){return {x:u*Math.cos(angle)+v*Math.sin(angle),z:-u*Math.sin(angle)+v*Math.cos(angle)}}

const monasteryOrigin = toWorld(205, 64);
const monasteryStupas = [
 {id:'myothar-monastery-stupa-main', x:213.979, z:-112.147, yaw:4.950652, radius:5, weekdayShrines:true},
 {id:'myothar-monastery-stupa-medium', x:209.222, z:-128.463, yaw:1.570796, radius:2.7, weekdayShrines:false},
 {id:'myothar-monastery-stupa-small', x:197.862, z:-123.834, yaw:1.570796, radius:2, weekdayShrines:false},
].map(p => {
 const dx = p.x - monasteryOrigin.x, dz = p.z - monasteryOrigin.z;
 return {...p, u:dx*Math.cos(angle)-dz*Math.sin(angle), v:dx*Math.sin(angle)+dz*Math.cos(angle)};
});

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
export const uShweHouse=houses.find(h=>h.id==='h79')!;
uShweHouse.name='northNear · အိမ်တန်း 240 · ဦးရွှေအိမ်';
oppositeHome(-182,270,'လမ်းသွယ် ၂ · မြောင်းနောက်အိမ်');houses[houses.length-1].rotation=angle+Math.PI/2;// New rows east of AH1: four homes in the first row, one in the second.
for(const u of [24,46,68,90])oppositeHome(u,270,'အရှေ့တန်း ၁ · အိမ်');
oppositeHome(24,294,'အရှေ့တန်း ၂ · အိမ်');
oppositeHome(152,290,'ဆန်စက်ဝင်း · ရှေ့အိမ်');
oppositeHome(194,326,'ဆန်စက်ဝင်း · သိုလှောင်ရုံဘေးအိမ်');
oppositeHome(24,334,'ဆန်စက်ဘေး · ပထမအိမ်တန်း');
oppositeHome(24,394,'ဆန်စက်ဘေး · နောက်ဆုံးအိမ်တန်း');
for(const h of houses)if(h.x*Math.cos(angle)-h.z*Math.sin(angle)>0)h.rotation=angle-Math.PI/2;
export const KALAY_SIGN_HOUSE_ID = 'h98';
export const kalaySignHouse = houses.find(h => h.id === KALAY_SIGN_HOUSE_ID)!;

/** မြို့သာရပ်ကွက် · နယ်မြေ (၅) ဒေတာ */
export const area5={
 id:'area-5',
 number:5,
 name:'နယ်မြေ (၅)',
 wardName:'မြို့သာရပ်ကွက် · ကလေးမြို့',
 houses,
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
 southernFields:Array.from({length:6},(_,row)=>Array.from({length:5},(_,col)=>({id:`southern-field-${row}-${col}`,u:174+col*42,v:430+row*40,...toWorld(174+col*42,430+row*40),width:36,depth:34,rotation:angle,color:['#7e9c55','#a6af68','#8ca65c'][(row+col)%3]}))).flat(),
 weipula:{name:'ဝေပုလ္လတောင်ကြီး',label:toWorld(-900,5600),
   peaks:[
    // 0: Far West Chin Alpine Peak behind Maha Weipula (wide walkable plateau top)
    {u:-2680,v:6360,radius:920,height:1120,plateau:0.42,skirtPower:1.2,obstacleRadius:6.5},
    // 1: West Chin Shoulder Ridge (wide flat highland plateau)
    {u:-2140,v:5260,radius:640,height:640,plateau:0.46,skirtPower:1.18,obstacleRadius:6.5},
    // 2: မဟာဝေပုလ္လတောင်တော် ပင်မတောင်ကြီး (1,320m climbable massif with broadened summit crown & protected Chin terraces)
    {u:-1560,v:6120,radius:1520,height:1320,plateau:0.085,skirtPower:1.25,obstacleRadius:6.5},
    // 3: Northeast Foothill Ridge (hosts Weipula Terraced Village south of the 10 paddy fields)
    {u:-380,v:4920,radius:330,height:290,plateau:0.38,skirtPower:1.2,obstacleRadius:6.5},
    // 4: West Pass Foothill (clear of AH1 and 10 separation paddy fields)
    {u:-135,v:4760,radius:115,height:110,plateau:0.44,skirtPower:1.18,obstacleRadius:6.5},
    // 5: East Pass Foothill (clear of AH1 and 10 separation paddy fields)
    {u:135,v:4760,radius:115,height:120,plateau:0.44,skirtPower:1.18,obstacleRadius:6.5},
    // 6: East Ridge Shoulder (broad walkable plateau)
    {u:320,v:4920,radius:260,height:280,plateau:0.46,skirtPower:1.18,obstacleRadius:6.5},
    // 7: Grand East Chin Range Peak
    {u:760,v:5480,radius:640,height:1080,plateau:0.42,skirtPower:1.2,obstacleRadius:6.5},
    // 8: Far East Chin Peak
    {u:1280,v:5360,radius:520,height:680,plateau:0.44,skirtPower:1.2,obstacleRadius:6.5},
    // 9: Easternmost Foothill Spur
    {u:1620,v:5160,radius:420,height:420,plateau:0.46,skirtPower:1.18,obstacleRadius:6.5},
    // Western mountain spine connecting Taungphila seamlessly into Weipula massif (broad flat highland plateaus, not pointy cones!)
    ...Array.from({length:37},(_,i)=>470+i*120).map((v,i)=>({u:-630,v,radius:135+(i%4)*8,height:168+(i%5)*16,plateau:0.54,skirtPower:1.15,obstacleRadius:6.5})),
    // Broad flat walkable Western Highland Tableland Mesas (u = -920..-1180, v = 180..4380) for 100+ mountain villages, camps, lakes & forests!
    ...Array.from({length:12},(_,i)=>220+i*375).map((v,i)=>({u:-980-(i%2)*110,v,radius:310,height:132+(i%3)*12,plateau:0.68,skirtPower:1.12,obstacleRadius:1.5}))
   ].map((m,i)=>({...m,id:`weipula-${i}`,...toWorld(m.u,m.v),color:i<10?'#486b52':'#557359',
    ridgeAxis: i === 2 ? .28 : i < 10 ? .35 + i * .29 : Math.PI / 2 + Math.sin(i * .48) * .32,
    ridgeRelief: i === 2 ? .048 : i < 10 ? .09 : i >= 47 ? .015 : .045,
    protectedTerraces: i === 2 ? { plateau: .045 } : undefined,
   }))},
 westernFields:[270,210,330].flatMap((v,row)=>Array.from({length:5},(_,i)=>({id:`western-field-${row}-${i}`,row,u:-216-i*42,v,...toWorld(-216-i*42,v),width:38,depth:54,rotation:angle,color:['#8ba65d','#a6ad63','#719650'][(i+row)%3]}))),
 taungphila:{name:'တောင်ဖီလာတောင်',label:toWorld(-575,230)},
 mountains:[...Array.from({length:5},(_,i)=>({u:-520-(i%2)*20,v:60+i*85,radius:78,height:132+(i%3)*18,plateau:0.56,skirtPower:1.14,obstacleRadius:6.5})),...Array.from({length:3},(_,i)=>({u:-630,v:100+i*120,radius:82,height:162+i*12,plateau:0.58,skirtPower:1.14,obstacleRadius:6.5}))].map((m,i)=>({...m,id:`western-mountain-${i}`,name:'တောင်ဖီလာတောင်',...toWorld(m.u,m.v),color:i<5?'#607b62':'#718487'})),
 crossCanal:{v:282,junctionV:376,depth:3,rotation:angle,
  points:[[125,282],[0,282],[-5,284],[-9,290],[-9,334],[-9,362],[-12,372],[-24,376],[-170,376]],
  bridges:[{u:0,v:282,width:12,depth:7},{u:-9,v:310,width:7,depth:4}]},
 // Two north-south waterways, now joined by an east-west branch, shared by every residential lane.
 canal:{u:-54,v:132.5,width:4,depth:511,...toWorld(-54,132.5),rotation:angle,
  bridges:[-112,-47,40,112,...oppositeLanes,270].map(v=>v-132.5)},
 drains:[{u:-160,v:132.5,...toWorld(-160,132.5),width:4,depth:511,rotation:angle,
  bridges:oppositeLanes.map(v=>v-132.5)}],
 yards:[[-24,204],[-74,204],[-24,222]].map(([u,v])=>({...toWorld(u,v),width:14,depth:13,rotation:angle})),
 sideLots:[222,240].map(v=>({...toWorld(-74,v),width:14,depth:16,rotation:angle})),
 farmNorthLand:{...toWorld(-120,216),width:64,depth:36,rotation:angle,owner:'စိုက်ခင်းအိမ်ပိုင် မြေ'},
 frontLot:{...toWorld(-29,270),width:38,depth:28,rotation:angle},
 farm:{...toWorld(-102,270),width:34,depth:44,rotation:angle},
 pond:{...toWorld(-140,270),width:16,depth:10,rotation:angle},
 farmTrees:[[-132,255],[-148,255],[-148,285],[-132,285]].map(([u,v],i)=>({id:`farm-tree-${i}`,...toWorld(u,v),radius:0.5})),
 openGround:{...toWorld(96,-50),width:100,depth:100,rotation:angle},
 monastery:{...monasteryOrigin,width:96,depth:66,rotation:angle,
  buildings:[
   {id:'mandap',name:'မဏ္ဍပ်',u:-32,v:7,width:19,depth:20,color:'#f4ead2',roof:'#1f5e47'},
   {id:'dhamma',name:'ဓမ္မာရုံ',u:0,v:3,width:25,depth:19,color:'#f4ead2',roof:'#8f1f24'},
   {id:'quarters',name:'ဘုန်းကြီးကျောင်းဆောင်',u:0,v:23,width:27,depth:14,color:'#6b3e26',roof:'#6e2820'},
   {id:'refectory',name:'ဆွမ်းစားဆောင်',u:-32,v:29,width:22,depth:12,color:'#f4ead2',roof:'#8c3b2b'}],
  stupas:monasteryStupas,
 },
 roads:[{id:'farmhouse-access',name:'စိုက်ခင်းအိမ်ဝင်လမ်း',...toWorld(-31.5,270),width:63,depth:3,rotation:angle,main:false},{id:'ah1',name:'AH1',...toWorld(0,2666.69),width:12,depth:5466.62,rotation:angle,main:true},
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
   {id:'cross-canal-verge-tree',u:-7.969,v:282.549,radius:0.65},
  ...pitchLanes.flatMap((v,i)=>[12,145].map((u,j)=>({id:`pitch-shade-${i}-${j}`,u,v:v+5}))),
  ...oppositeLanes.flatMap((v,i)=>[-12,-144].map((u,j)=>({id:`opposite-shade-${i}-${j}`,u,v:v+5}))),
  ...[-112,-47,40,112].map((v,i)=>({id:`old-cross-shade-${i}`,u:-124,v:v+6})),
  {id:'old-lane-shade-1',u:-82,v:-105},{id:'old-lane-shade-2',u:-104,v:-105},
  {id:'monastery-lane-shade-1',u:156,v:20},{id:'monastery-lane-shade-2',u:156,v:114},
 ].map(({id,u,v,radius}: {id:string;u:number;v:number;radius?:number})=>({id,...toWorld(u,v),radius:radius??1.1})),
 trees:[-1,1].flatMap(side=>Array.from({length:32},(_,i)=>({id:`t${side}-${i}`,...toWorld(side*14,-120+i*7.7),radius:0.55}))),
};
