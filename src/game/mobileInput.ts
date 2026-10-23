export type MobileInput={active:boolean;forward:number;right:number;sprint:boolean;lookX:number;lookY:number;zoomFactor:number;session:number};
export const createMobileInput=():MobileInput=>({active:false,forward:0,right:0,sprint:false,lookX:0,lookY:0,zoomFactor:1,session:0});
export function resetMobileInput(input:MobileInput){Object.assign(input,{active:false,forward:0,right:0,sprint:false,lookX:0,lookY:0,zoomFactor:1})}
export function touchDirection(direction:string){return direction==='down'?{forward:-1,right:0}:direction==='left'?{forward:0,right:-1}:direction==='right'?{forward:0,right:1}:{forward:1,right:0}}

export function joystickDirection(dx:number,dy:number){
 const length=Math.hypot(dx,dy);
 return length<10?{forward:0,right:0}:{forward:-dy/length,right:dx/length};
}

type Finger={id:number;side:'left'|'right';x:number;y:number;startX:number;startY:number;direction:string};
export class MobileGesture {
 fingers=new Map<number,Finger>();
 pinching=false; blocked=false; baseline=0; previous=0;
 input:MobileInput;
 constructor(input:MobileInput){this.input=input}
 clear(){this.fingers.clear();this.pinching=false;this.blocked=false;resetMobileInput(this.input)}
 down(id:number,side:'left'|'right',x:number,y:number,direction='up'){
  if(this.fingers.size>=2)return;
  this.fingers.set(id,{id,side,x,y,startX:x,startY:y,direction});
  if(this.fingers.size===2){
   const [a,b]=[...this.fingers.values()];this.baseline=this.previous=Math.hypot(a.x-b.x,a.y-b.y);
   a.startX=a.x;a.startY=a.y;b.startX=b.x;b.startY=b.y;
   if(a.side===b.side){resetMobileInput(this.input);this.blocked=true}
  }
  if(!this.blocked&&side==='right')this.input.sprint=true;
 }
 hold(){
  if(this.blocked||this.pinching)return;
  const finger=[...this.fingers.values()].find(f=>f.side==='left');
  if(finger&&!this.input.active)Object.assign(this.input,touchDirection(finger.direction),{active:true,session:this.input.session+1});
 }
 move(id:number,x:number,y:number){
  const f=this.fingers.get(id);if(!f)return;
  const dx=x-f.x,dy=y-f.y;f.x=x;f.y=y;
  if(this.fingers.size===2){
   const [a,b]=[...this.fingers.values()],distance=Math.max(20,Math.hypot(a.x-b.x,a.y-b.y));
   const bothMoved=[a,b].every(p=>Math.hypot(p.x-p.startX,p.y-p.startY)>5);
   if(!this.pinching&&Math.abs(distance-this.baseline)>10&&(a.side===b.side||bothMoved)){
    resetMobileInput(this.input);this.pinching=true;this.blocked=true;
   }
   if(this.pinching){this.input.zoomFactor*=Math.max(20,this.previous)/distance;this.previous=distance;return}
  }
  if(this.blocked)return;
  if(f.side==='right'){this.input.lookX+=dx;this.input.lookY+=dy;return}
  const direction=joystickDirection(x-f.startX,y-f.startY);
  if(direction.forward||direction.right){this.hold();Object.assign(this.input,direction)}
  else if(this.input.active)Object.assign(this.input,direction);
 }
 up(id:number){
  const f=this.fingers.get(id);if(!f)return;this.fingers.delete(id);
  if(this.blocked){resetMobileInput(this.input);if(!this.fingers.size)this.clear();return}
  if(f.side==='left')Object.assign(this.input,{active:false,forward:0,right:0});
  else Object.assign(this.input,{sprint:false,lookX:0,lookY:0});
 }
}
