export type MobileInput={active:boolean;forward:number;right:number;sprint:boolean;lookX:number;lookY:number;session:number};
export const createMobileInput=():MobileInput=>({active:false,forward:0,right:0,sprint:false,lookX:0,lookY:0,session:0});
export function resetMobileInput(input:MobileInput){Object.assign(input,{active:false,forward:0,right:0,sprint:false,lookX:0,lookY:0})}
export function touchDirection(direction:string){return direction==='down'?{forward:-1,right:0}:direction==='left'?{forward:0,right:-1}:direction==='right'?{forward:0,right:1}:{forward:1,right:0}}
