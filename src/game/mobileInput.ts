export type MobileDirection = 'up' | 'right' | 'down' | 'left';
export const MOBILE_AUTO_HOLD_MS = 650;
export const MOBILE_AUTO_SPEED_STEP_MS = 800;
export type MobileInput = {
  active: boolean;
  forward: number;
  right: number;
  sprint: boolean;
  jump: boolean;
  autoDirection: MobileDirection | null;
  moveScale: number;
  stopRequested: boolean;
  lookX: number;
  lookY: number;
  panX: number;
  panY: number;
  zoomFactor: number;
  session: number;
};
export const createMobileInput = (): MobileInput => ({
  active: false,
  forward: 0,
  right: 0,
  sprint: false,
  jump: false,
  autoDirection: null,
  moveScale: 1,
  stopRequested: false,
  lookX: 0,
  lookY: 0,
  panX: 0,
  panY: 0,
  zoomFactor: 1,
  session: 0,
});
export function resetMobileInput(input: MobileInput) {
  Object.assign(input, {
    active: false,
    forward: 0,
    right: 0,
    sprint: false,
    jump: false,
    autoDirection: null,
    moveScale: 1,
    stopRequested: false,
    lookX: 0,
    lookY: 0,
    panX: 0,
    panY: 0,
    zoomFactor: 1,
  });
}
export function touchDirection(direction: string) {
  return direction === "down"
    ? { forward: -1, right: 0 }
    : direction === "left"
      ? { forward: 0, right: -1 }
      : direction === "right"
        ? { forward: 0, right: 1 }
        : { forward: 1, right: 0 };
}

export function joystickDirection(dx: number, dy: number) {
  const length = Math.hypot(dx, dy);
  return length < 10
    ? { forward: 0, right: 0 }
    : { forward: -dy / length, right: dx / length };
}

type Finger = {
  id: number;
  side: "left" | "right";
  x: number;
  y: number;
  startX: number;
  startY: number;
  direction: string;
};
export class MobileGesture {
  tick: {id:number;direction:MobileDirection;x:number;y:number;elapsed:number;wasAuto:boolean;initialSpeed:number;sameDirection:boolean} | null = null;
  fingers = new Map<number, Finger>();
  pinching = false;
  blocked = false;
  baseline = 0;
  previous = 0;
  centerX = 0;
  centerY = 0;
  originX = 0;
  originY = 0;
  input: MobileInput;
  constructor(input: MobileInput) {
    this.input = input;
  }
  clear() {
    const wasAuto = !!this.input.autoDirection || this.input.stopRequested;
    this.tick = null;
    this.fingers.clear();
    this.pinching = false;
    this.blocked = false;
    resetMobileInput(this.input);
    if(wasAuto)this.input.stopRequested=true;
  }
  stop() { this.clear(); this.input.stopRequested=true; }
  /** A short press steers; a deliberate hold latches at normal speed. */
  downTick(id:number,direction:MobileDirection,x:number,y:number,anchorX=x,anchorY=y) {
    const wasAuto=!!this.input.autoDirection,sameDirection=this.input.autoDirection===direction,initialSpeed=this.input.moveScale;
    this.down(id,'left',anchorX,anchorY,direction,true);
    if(this.blocked||this.pinching||!this.fingers.has(id))return;
    const finger=this.fingers.get(id)!;finger.x=x;finger.y=y;
    this.tick={id,direction,x,y,elapsed:0,wasAuto,initialSpeed,sameDirection};
    Object.assign(this.input,touchDirection(direction),{active:true,stopRequested:false,session:this.input.session+(sameDirection?0:1)});
    if(wasAuto)this.input.autoDirection=direction;
  }
  advanceTick(milliseconds:number) {
    const tick=this.tick;
    if(!tick||this.blocked||this.pinching||!this.input.active){this.tick=null;return;}
    tick.elapsed+=Math.max(0,Math.min(250,milliseconds));
    if(tick.elapsed<MOBILE_AUTO_HOLD_MS)return;
    this.input.autoDirection=tick.direction;
    const steps=Math.floor((tick.elapsed-MOBILE_AUTO_HOLD_MS)/MOBILE_AUTO_SPEED_STEP_MS)+(tick.wasAuto?1:0);
    this.input.moveScale=Math.min(2,tick.initialSpeed+steps*.25);
  }
  /** Keyboard/assistive activation does not require a pointer hold. */
  activateTick(direction:MobileDirection) {
    if(this.blocked||this.pinching)return;
    const same=this.input.autoDirection===direction;
    Object.assign(this.input,touchDirection(direction),{active:true,autoDirection:direction,moveScale:same?Math.min(2,this.input.moveScale+.25):1,stopRequested:false,session:this.input.session+(same?0:1)});
  }
  down(
    id: number,
    side: "left" | "right",
    x: number,
    y: number,
    direction = "up",
    tick = false,
  ) {
    if (this.fingers.size >= 2) return;
    if(side==='left'&&!tick&&this.input.autoDirection){
      Object.assign(this.input,{autoDirection:null,moveScale:1,active:false,forward:0,right:0,stopRequested:true});
    }
    this.fingers.set(id, { id, side, x, y, startX: x, startY: y, direction });
    if (this.fingers.size === 2) {
      const [a, b] = [...this.fingers.values()];
      this.baseline = this.previous = Math.hypot(a.x - b.x, a.y - b.y);
      this.originX = this.centerX = (a.x + b.x) / 2;
      this.originY = this.centerY = (a.y + b.y) / 2;
      a.startX = a.x;
      a.startY = a.y;
      b.startX = b.x;
      b.startY = b.y;
      if (a.side === b.side) {
        const wasAuto=!!this.input.autoDirection||this.input.stopRequested;this.tick=null;
        resetMobileInput(this.input);
        if(wasAuto)this.input.stopRequested=true;
        this.blocked = true;
      }
    }
    if (!this.blocked && side === "right" && !this.input.autoDirection) this.input.sprint = true;
  }
  hold() {
    if (this.blocked || this.pinching) return;
    const finger = [...this.fingers.values()].find((f) => f.side === "left");
    if (finger && !this.input.active)
      Object.assign(this.input, touchDirection(finger.direction), {
        active: true,
        session: this.input.session + 1,
      });
  }
  move(id: number, x: number, y: number) {
    const f = this.fingers.get(id);
    if (!f) return;
    const dx = x - f.x,
      dy = y - f.y;
    f.x = x;
    f.y = y;
    if (this.fingers.size === 2) {
      const [a, b] = [...this.fingers.values()],
        distance = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      const cx = (a.x + b.x) / 2,
        cy = (a.y + b.y) / 2;
      const bothMoved = [a, b].every(
        (p) => Math.hypot(p.x - p.startX, p.y - p.startY) > 5,
      );
      const zoomIntent =
        Math.abs(distance - this.baseline) > 10 &&
        (a.side === b.side || bothMoved);
      const panIntent =
        bothMoved && Math.hypot(cx - this.originX, cy - this.originY) > 10;
      if (!this.pinching && (zoomIntent || panIntent)) {
        const wasAuto=!!this.input.autoDirection||this.input.stopRequested;this.tick=null;
        resetMobileInput(this.input);
        if(wasAuto)this.input.stopRequested=true;
        this.pinching = true;
        this.blocked = true;
      }
      if (this.pinching) {
        this.input.zoomFactor *= Math.max(20, this.previous) / distance;
        this.previous = distance;
        this.input.panX += cx - this.centerX;
        this.input.panY += cy - this.centerY;
        this.centerX = cx;
        this.centerY = cy;
        return;
      }
    }
    if (this.blocked) return;
    if (f.side === "right") {
      this.input.lookX += dx;
      this.input.lookY += dy;
      return;
    }
    if(this.tick?.id===id){
      if(Math.hypot(x-this.tick.x,y-this.tick.y)<12)return;
      if(this.input.autoDirection)this.input.stopRequested=true;
      this.tick=null;this.input.autoDirection=null;this.input.moveScale=1;
    }
    const direction = joystickDirection(x - f.startX, y - f.startY);
    if (direction.forward || direction.right) {
      this.hold();
      Object.assign(this.input, direction);
    } else if (this.input.active) Object.assign(this.input, direction);
  }
  up(id: number) {
    const f = this.fingers.get(id);
    if (!f) return;
    this.fingers.delete(id);
    if (this.blocked) {
      const stop=this.input.stopRequested;
      resetMobileInput(this.input);this.input.stopRequested=stop;
      if (!this.fingers.size) this.clear();
      return;
    }
    if (f.side === "left") {
      if(this.tick?.id===id){
        if(this.tick.wasAuto&&this.tick.sameDirection&&this.tick.elapsed<MOBILE_AUTO_HOLD_MS)this.input.moveScale=1;
        this.tick=null;
      }
      if(this.input.autoDirection)Object.assign(this.input,touchDirection(this.input.autoDirection),{active:true});
      else Object.assign(this.input, { active: false, forward: 0, right: 0 });
    }
    else Object.assign(this.input, { sprint: false, lookX: 0, lookY: 0 });
  }
}
