import { angle,toWorld } from './wards/myothar/area5.ts';
/** AH1-local estate outline excludes neighboring homes and the public northern lane. */
export const estateOutline:[number,number][]=[[-154,196],[-86,196],[-86,213],[-65,213],[-65,254],[-10,254],[-10,286],[-82,286],[-82,294],[-154,294]];
export type EstatePanel={u:number;v:number;length:number;alongU:boolean;raised:boolean};
export const estatePanels:EstatePanel[]=[];
for(let i=0;i<estateOutline.length;i++){
 const a=estateOutline[i],b=estateOutline[(i+1)%estateOutline.length],alongU=a[1]===b[1];
 const low=Math.min(alongU?a[0]:a[1],alongU?b[0]:b[1]),high=Math.max(alongU?a[0]:a[1],alongU?b[0]:b[1]);
 const cuts=[low,high];
 if(alongU&&low< -56&&high> -52)cuts.push(-56,-52);
 if(!alongU&&a[0]===-10)cuts.push(268.3,271.7);
 cuts.sort((a,b)=>a-b);
 for(let j=1;j<cuts.length;j++){
  const start=cuts[j-1],end=cuts[j];
  if(!alongU&&a[0]===-10&&start===268.3)continue;
  const n=Math.ceil((end-start)/5);
  for(let k=0;k<n;k++){const m=start+(k+.5)*(end-start)/n;
   estatePanels.push({u:alongU?m:a[0],v:alongU?a[1]:m,length:(end-start)/n,alongU,raised:alongU&&m>=-56&&m<=-52});
  }
 }
}
export function insideEstate(u:number,v:number){let inside=false;for(let i=0,j=estateOutline.length-1;i<estateOutline.length;j=i++){
 const a=estateOutline[i],b=estateOutline[j];
 const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((u-a[0])*dx+(v-a[1])*dz)/(dx*dx+dz*dz)));
 if(Math.hypot(u-a[0]-t*dx,v-a[1]-t*dz)<1e-6)return true;
 if((a[1]>v)!==(b[1]>v)&&u<(b[0]-a[0])*(v-a[1])/(b[1]-a[1])+a[0])inside=!inside;
}return inside}
export function estateFenceBlocks(x:number,z:number,r=.4){const u=x*Math.cos(angle)-z*Math.sin(angle),v=x*Math.sin(angle)+z*Math.cos(angle);
 if(u< -155||u> -9||v<195||v>295)return false;
 return estatePanels.some(p=>{const along=p.alongU?u-p.u:v-p.v,across=p.alongU?v-p.v:u-p.u;return Math.hypot(Math.max(0,Math.abs(along)-p.length/2),across)<r+.06});
}
// Inset palms follow the perimeter, skipping the entrance, canal, house and cultivated center.
export const estatePalms:{id:string;u:number;v:number;x:number;z:number}[]=[];
for(let u=-150;u<=-14;u+=8)for(let v=200;v<=290;v+=8){
 if(!insideEstate(u,v)||Math.abs(u+54)<5||Math.hypot(u+10,v-270)<7)continue;
 const nearEdge=estatePanels.some(p=>Math.hypot(p.alongU?Math.max(0,Math.abs(u-p.u)-p.length/2):u-p.u,p.alongU?v-p.v:Math.max(0,Math.abs(v-p.v)-p.length/2))<4.5);
 if(nearEdge&&!(u>-83&&u<-61&&v>249&&v<282)&&!(u<=-148&&v>=252&&v<=292))estatePalms.push({id:`areca-${u}-${v}`,u,v,...toWorld(u,v)});
}
