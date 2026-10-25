export type FestivalPlacement={x:number;y:number;z:number;holder?:boolean};
/** Metadata survives static batching; RegionBuilder turns it into tiled instances. */
export function FestivalAnchor({items}:{items:FestivalPlacement[]}){return <group name="festival-anchor" userData={{dynamic:true,festivalCandles:items}}/>;}
export function CandleRow({length,y=1.475,z=0,x=0,alongZ=false}:{length:number;y?:number;z?:number;x?:number;alongZ?:boolean}){
 const count=Math.max(1,Math.floor(length/.55));
 return <FestivalAnchor items={Array.from({length:count},(_,i)=>{const offset=(i+.5)*length/count-length/2;return {x:x+(alongZ?0:offset),y,z:z+(alongZ?offset:0)};})}/>;
}
export function PorchCandles({width,front,y=.355}:{width:number;front:number;y?:number}){
 const outer=Math.max(.45,width/2-.3),inner=Math.max(.25,outer-.6);
 return <FestivalAnchor items={[-outer,-inner,inner,outer].map(x=>({x,y,z:front+.7,holder:true}))}/>;
}
