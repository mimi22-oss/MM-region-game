export type MobileDirection = 'up' | 'right' | 'down' | 'left';
export const MOBILE_AUTO_HOLD_MS = 650;
export const MOBILE_AUTO_SPEED_STEP_MS = 800;
export const MOBILE_WALK_LOCK_MS = 3000;
export type MobileInput = {
  walkLocked: boolean;
  lockedSprint: boolean;
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
  walkLocked: false,
  lockedSprint: false,
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
    walkLocked: false,
    lockedSprint: false,
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
  private cameraGesture: 'pan' | 'zoom' | null = null;
  private cameraIntentStart: number | null = null;
  input: MobileInput;
  walkLockEnabled = false;
  private steady: {id:number;x:number;y:number;elapsed:number}|null = null;
  getLockHoldProgress(): number {
    if (!this.walkLockEnabled || !this.steady || this.input.walkLocked || !this.input.active) return 0;
    return Math.min(1, this.steady.elapsed / MOBILE_WALK_LOCK_MS);
  }
  constructor(input: MobileInput) {
    this.input = input;
  }
  clear() {
    const wasAuto = this.input.walkLocked || !!this.input.autoDirection || this.input.stopRequested;
    this.steady=null;
    this.tick = null;
    this.fingers.clear();
    this.pinching = false;
    this.blocked = false;
    this.cameraGesture = null;
    this.cameraIntentStart = null;
    resetMobileInput(this.input);
    if(wasAuto)this.input.stopRequested=true;
  }
  stop() { this.clear(); this.input.stopRequested=true; }
  /** A short press steers; a deliberate hold latches at normal speed. */
  downTick(id:number,direction:MobileDirection,x:number,y:number,anchorX=x,anchorY=y) {
    if(this.walkLockEnabled){
      this.down(id,'left',anchorX,anchorY,direction,true);
      this.move(id,x,y);
      return;
    }
    const wasAuto=!!this.input.autoDirection,sameDirection=this.input.autoDirection===direction,initialSpeed=this.input.moveScale;
    this.down(id,'left',anchorX,anchorY,direction,true);
    if(this.blocked||this.pinching||!this.fingers.has(id))return;
    const finger=this.fingers.get(id)!;finger.x=x;finger.y=y;
    this.tick={id,direction,x,y,elapsed:0,wasAuto,initialSpeed,sameDirection};
    Object.assign(this.input,touchDirection(direction),{active:true,stopRequested:false,session:this.input.session+(sameDirection?0:1)});
    if(wasAuto)this.input.autoDirection=direction;
  }
  advanceTick(milliseconds:number) {
    if(this.walkLockEnabled){
      const steady=this.steady;
      if(!this.input.active||this.blocked||this.pinching){this.steady=null;return;}
      if(!steady||this.input.walkLocked)return;
      steady.elapsed+=Math.max(0,Math.min(250,milliseconds));
      if(steady.elapsed>=MOBILE_WALK_LOCK_MS){
        this.input.walkLocked=true;
        this.input.lockedSprint=this.input.sprint;
      }
      return;
    }
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
    if(this.walkLockEnabled){
      Object.assign(this.input,touchDirection(direction),{active:true,walkLocked:true,stopRequested:false,session:this.input.session+1});
      return;
    }
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
    if (side === 'left' && this.walkLockEnabled && this.input.walkLocked) {
      this.input.session++;
    }
    this.fingers.set(id, { id, side, x, y, startX: x, startY: y, direction });
    if (this.fingers.size === 2) {
      // A latched walk lets the other thumb orbit the camera without steering.
      if(this.walkLockEnabled&&this.input.walkLocked&&new Set([...this.fingers.values()].map(f=>f.side)).size===2)return;
      const [a, b] = [...this.fingers.values()];
      this.baseline = this.previous = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      this.cameraIntentStart = null;
      this.originX = this.centerX = (a.x + b.x) / 2;
      this.originY = this.centerY = (a.y + b.y) / 2;
      a.startX = a.x;
      a.startY = a.y;
      b.startX = b.x;
      b.startY = b.y;
      if (a.side === b.side) {
        const wasAuto=this.input.walkLocked||!!this.input.autoDirection||this.input.stopRequested;this.tick=null;this.steady=null;
        resetMobileInput(this.input);
        if(wasAuto)this.input.stopRequested=true;
        this.blocked = true;
      }
    }
    if (!this.walkLockEnabled && !this.blocked && side === "right" && !this.input.autoDirection) this.input.sprint = true;
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
  move(id: number, x: number, y: number, time = performance.now()) {
    const f = this.fingers.get(id);
    if (!f) return;
    const dx = x - f.x,
      dy = y - f.y;
    f.x = x;
    f.y = y;
    const separateLook=this.walkLockEnabled&&this.input.walkLocked&&this.fingers.size===2&&
      new Set([...this.fingers.values()].map(p=>p.side)).size===2;
    if (this.fingers.size === 2 && !separateLook) {
      const [a, b] = [...this.fingers.values()],
        distance = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      const cx = (a.x + b.x) / 2,
        cy = (a.y + b.y) / 2;
      const ax = a.x - a.startX, ay = a.y - a.startY;
      const bx = b.x - b.startX, by = b.y - b.startY;
      const aMoved = Math.hypot(ax, ay) > 5;
      const bMoved = Math.hypot(bx, by) > 5;
      const bothMoved = aMoved && bMoved;
      if (this.cameraIntentStart === null && (aMoved || bMoved)) this.cameraIntentStart = time;
      const spread = Math.abs(distance - this.baseline);
      const travel = Math.hypot(cx - this.originX, cy - this.originY);
      // Touch events may arrive separately even when two fingers move together.
      const anchoredPinch = !bothMoved && a.side === b.side && this.cameraIntentStart !== null &&
        time - this.cameraIntentStart >= 65 && spread > 17 && spread > travel * 1.5;
      const zoomIntent =
        (bothMoved && spread > 10 && ax * bx + ay * by <= 0) || anchoredPinch;
      const panIntent = bothMoved && travel > 10;
      if (!this.pinching && (zoomIntent || panIntent)) {
        const wasAuto=this.input.walkLocked||!!this.input.autoDirection||this.input.stopRequested;this.tick=null;this.steady=null;
        resetMobileInput(this.input);
        if(wasAuto)this.input.stopRequested=true;
        this.pinching = true;
        this.blocked = true;
        this.cameraGesture = zoomIntent && (!panIntent || spread > travel * 1.3) ? 'zoom' : 'pan';
        if (this.cameraGesture === 'zoom') {
          this.previous = this.baseline + Math.sign(distance - this.baseline) * (anchoredPinch ? 17 : 10);
        } else {
          const deadZone = 10 / travel;
          this.centerX = this.originX + (cx - this.originX) * deadZone;
          this.centerY = this.originY + (cy - this.originY) * deadZone;
        }
      }
      if (this.pinching) {
        if (this.cameraGesture === 'zoom') this.input.zoomFactor *= this.previous / distance;
        else {
          this.input.panX += cx - this.centerX;
          this.input.panY += cy - this.centerY;
        }
        this.previous = distance;
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
    if(this.walkLockEnabled){
      if(!direction.forward&&!direction.right){
        Object.assign(this.input,{active:false,forward:0,right:0,walkLocked:false,lockedSprint:false,sprint:false,stopRequested:true,moveScale:1});
        this.steady=null;
        return;
      }
      const steady=this.steady;
      if(!steady||Math.hypot(x-steady.x,y-steady.y)>14){
        this.steady={id,x,y,elapsed:0};
      }
      if(!this.input.active)this.input.session++;
      Object.assign(this.input,direction,{active:true,stopRequested:false});
      return;
    }
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
      const { panX, panY, zoomFactor, stopRequested } = this.input;
      if (!this.fingers.size) this.clear();
      else resetMobileInput(this.input);
      Object.assign(this.input, { panX, panY, zoomFactor, stopRequested });
      return;
    }
    if (f.side === "left") {
      if(this.walkLockEnabled){
        this.steady=null;
        if(!this.input.walkLocked)Object.assign(this.input,{active:false,forward:0,right:0});
        return;
      }
      if(this.tick?.id===id){
        if(this.tick.wasAuto&&this.tick.sameDirection&&this.tick.elapsed<MOBILE_AUTO_HOLD_MS)this.input.moveScale=1;
        this.tick=null;
      }
      if(this.input.autoDirection)Object.assign(this.input,touchDirection(this.input.autoDirection),{active:true});
      else Object.assign(this.input, { active: false, forward: 0, right: 0 });
    }
    else if(!this.walkLockEnabled)this.input.sprint=false;
  }
}
