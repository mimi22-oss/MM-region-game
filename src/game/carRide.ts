import { parkedCars } from '../data/cars.ts';
import type {CarAppearance,CarModel} from '../data/appearance';

export type CarGear = -1 | 0 | 1 | 2 | 3 | 4;
export const driveableCars = parkedCars.map(car => ({ ...car, model:'compact' as CarModel, transmission:'manual' as CarAppearance['transmission'], yaw: car.rotation, speed: 0, groundY: 0, pitch: 0, roll: 0, distance: 0, steering: 0, wheelTravel: [0,0,0,0], mustLeave: false }));
export type DriveableCar = typeof driveableCars[number];
export const carInput = { throttle: false, brake: false, clutch: false, steer: 0, exit: false };
export type AutomaticRange='P'|'R'|'N'|'D';
export const carRide = { carId: null as string | null, gear: 0 as CarGear, automaticRange:'P' as AutomaticRange, rpm: 850, nearId: null as string | null, nearTime: 0, notice: '', interior: true };
export type CarStatus = { transmission?:CarAppearance['transmission']; automaticRange?:AutomaticRange; driving: boolean; near: boolean; kmh: number; gear: CarGear; rpm: number; clutch: boolean; notice: string; steering: number; first?: boolean; canSummon?: boolean; summonStatus?: 'idle' | 'calling' | 'driving' | 'arrived' | 'returning'; lives?: number; };
export const MAX_STEERING = .55;
export const STEERING_RATIO = 15;
/** Ackermann geometry: the inside front tire turns more sharply than the outside tire. */
export function frontWheelAngle(steering:number,side:number,size=1){
 if(Math.abs(steering)<1e-6)return 0;
 const wheelbase=2.08*size,radius=wheelbase/Math.tan(Math.abs(steering));
 return -Math.sign(steering)*Math.atan(wheelbase/(radius-side*Math.sign(steering)*.79*size));
}
export function wheelStepDistances(distance:number,steering:number,size=1){
 if(Math.abs(steering)<1e-6)return [distance,distance,distance,distance];
 const wheelbase=2.08*size,radius=wheelbase/Math.tan(Math.abs(steering)),centerRadius=Math.hypot(radius,wheelbase/2);
 return [-1,1].flatMap(side=>{
  const rearRadius=radius-side*Math.sign(steering)*.79*size;
  return [Math.hypot(rearRadius,wheelbase),rearRadius].map(r=>distance*r/centerRadius);
 });
}
export const currentCar = () => driveableCars.find(car => car.id === carRide.carId);
export const gearLabel = (gear: CarGear) => gear === -1 ? 'R' : gear === 0 ? 'N' : String(gear);
export function clearCarInput() { Object.assign(carInput, { throttle: false, brake: false, clutch: false, steer: 0, exit: false }); }
export const gearSpeed = (gear: CarGear) => ({ '-1': 10, 0: 0, 1: 20, 2: 40, 3: 65, 4: 100 }[gear] / 3.6);

export function selectAutomaticRange(range:AutomaticRange,brake=carInput.brake){
 const car=currentCar();if(!car||car.transmission!=='automatic')return false;
 if(range===carRide.automaticRange)return true;
 if(range!=='N'&&!brake){carRide.notice='ဘရိတ်ဖိပြီး P / R / D ရွေးပါ';return false;}
 if((range==='P'&&Math.abs(car.speed)>.2)||(range==='R'&&car.speed>.2)||(range==='D'&&car.speed<-.2)){carRide.notice='ဦးတည်ချက်ပြောင်းရန် ကားကို အရင်ရပ်ပါ';return false;}
 carRide.automaticRange=range;carRide.gear=range==='D'?1:range==='R'?-1:0;carRide.notice='';return true;
}
export function configurePlayerCar(appearance:CarAppearance){
 const car=driveableCars[0];car.color=appearance.color;
 // Model and transmission changes are deferred until the player leaves the car.
 if(currentCar()!==car){car.model=appearance.model;car.transmission=appearance.transmission;}
}
export function shiftCar(gear: CarGear, clutch = carInput.clutch, brake=carInput.brake) {
 const car = currentCar();
 if (!car)return false;
 if(car.transmission==='automatic')return selectAutomaticRange(gear<0?'R':gear===0?'N':'D',brake);
 if(gear===carRide.gear)return false;
 if (!clutch) { carRide.notice = 'ဂီယာပြောင်းရန် ကလပ်ကို ဖိထားပါ'; return false; }
 if ((gear === -1 && car.speed > .2) || (gear > 0 && car.speed < -.2)) { carRide.notice = 'ဦးတည်ချက်ပြောင်းရန် ကားကို အရင်ရပ်ပါ'; return false; }
 if (gear !== 0 && Math.abs(car.speed) > gearSpeed(gear) * 1.1) { carRide.notice = 'ဒီဂီယာအတွက် အရှိန်လျှော့ပါ'; return false; }
 carRide.gear = gear; carRide.notice = ''; return true;
}

/** Boarding is only possible at a clear side door; leaving needs a full step away before re-entry. */
export function nearbyCar(x: number, z: number, clear: (x: number, z: number) => boolean) {
 return driveableCars.find(car => {
  const dx = x - car.x, dz = z - car.z;
  if (Math.hypot(dx, dz) > 3.6) car.mustLeave = false;
  if (car.mustLeave || carRide.carId === car.id) return false;
  const c = Math.cos(car.yaw), s = Math.sin(car.yaw), u = c * dx - s * dz, v = s * dx + c * dz;
  if (Math.abs(v) > 1.2 * car.size || Math.abs(u) > car.width * car.size / 2 + 1.3) return false;
  const door = Math.sign(u || 1) * (car.width * car.size / 2 + .55);
  const px = car.x + c * door, pz = car.z - s * door;
  return [0, .25, .5, .75, 1].every(t => clear(x + (px - x) * t, z + (pz - z) * t));
 });
}
export function enterCar(car: DriveableCar) {
 carRide.carId = car.id; carRide.automaticRange='P'; carRide.gear = 0; carRide.nearTime = 0; carRide.nearId = null; carRide.notice = '';
 car.speed = 0; clearCarInput();
}
export function carExitSpot(clear: (x: number, z: number) => boolean) {
 const car = currentCar(); if (!car) return null;
 if (Math.abs(car.speed) > .2) { carRide.notice = 'ကားမှဆင်းရန် ဘရိတ်နှိပ်ပြီး ရပ်ပါ'; return null; }
 const c = Math.cos(car.yaw), s = Math.sin(car.yaw);
 for (const side of [1, -1]) for (const v of [0, .6, -.6]) {
  const u = side * (car.width * car.size / 2 + .8), x = car.x + c * u + s * v, z = car.z - s * u + c * v;
  if (clear(x, z)) return { x, z };
 }
 carRide.notice = 'ကားတံခါးဘေးတွင် ဆင်းရန် နေရာမလွတ်ပါ'; return null;
}
export function parkCar() {
 const car = currentCar(); if (car) { car.speed = 0; car.steering = 0; car.mustLeave = true; }
 carRide.carId = null; carRide.automaticRange='P'; carRide.gear = 0; carRide.rpm = 850; carRide.nearTime = 0; carRide.notice = ''; clearCarInput();
}

/** Dense perimeter samples plus swept 10 cm steps stop the whole body at thin obstacles. */
export function carFootprintClear(car: DriveableCar, x: number, z: number, yaw: number, clear: (x: number, z: number) => boolean) {
 const c = Math.cos(yaw), s = Math.sin(yaw), w = car.width * car.size / 2, l = car.depth * car.size / 2;
 for (let row = 0; row <= 8; row++) for (let col = 0; col <= 4; col++) {
  if (row !== 0 && row !== 8 && col !== 0 && col !== 4 && !(row === 4 && col === 2)) continue;
  const u = -w + col * w / 2, v = -l + row * l / 4;
  if (!clear(x + c * u + s * v, z - s * u + c * v)) return false;
 }
 return true;
}
export function stepCar(dt: number, throttle: number, steer: number, brake: boolean, clutch: boolean, paused: boolean, clear: (x: number, z: number) => boolean) {
 const impact={blocked:false,speed:0};
 const car = currentCar(); if (!car) return impact;
 dt = Math.min(.05, Math.max(0, dt));
 if (paused) { car.speed = 0; car.steering = 0; return impact; }
 if(car.transmission==='automatic'){
  clutch=false;
  if(carRide.automaticRange==='P'){car.speed=0;brake=true;carRide.gear=0;}
  else if(carRide.automaticRange==='N')carRide.gear=0;
  else if(carRide.automaticRange==='R')carRide.gear=-1;
  else {
   const kmh=Math.abs(car.speed)*3.6,g=Math.max(1,carRide.gear);
   carRide.gear=(g<4&&kmh>[0,17,34,56][g]?g+1:g>1&&kmh<[0,0,12,26,44][g]?g-1:g) as CarGear;
  }
 }
 const gear = carRide.gear, limit = gearSpeed(gear), gas = Math.max(0, Math.min(1, throttle));
 if (brake) car.speed = Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - 10 * dt);
 else if (gas && !clutch && gear !== 0) {
  const direction = gear < 0 ? -1 : 1, acceleration = gear < 0 ? 2.2 : [0, 4.8, 3.6, 2.7, 1.9][gear];
  car.speed += direction * acceleration * gas * dt;
  car.speed = Math.max(-limit, Math.min(limit, car.speed));
 } else car.speed = Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - (clutch || gear === 0 ? .45 : 1.4) * dt);
 // Limit requested curvature to roughly 0.56 g at speed; a full keyboard press
 // must not produce a parking-speed turning radius on the highway.
 const speedLimit=Math.atan(2.08*car.size*5.5/Math.max(1,car.speed*car.speed));
 const desiredSteering = Math.max(-1, Math.min(1, steer)) * Math.min(MAX_STEERING,speedLimit);
 const steeringRate=Math.abs(steer)>.01?.85:.35+Math.min(1,Math.abs(car.speed)/12);
 car.steering+=Math.max(-steeringRate*dt,Math.min(steeringRate*dt,desiredSteering-car.steering));
 const distance = car.speed * dt, steps = Math.max(1, Math.ceil(Math.abs(distance) / .1));
 for (let i = 0; i < steps; i++) {
  const d = distance / steps,beta=Math.atan(.5*Math.tan(car.steering));
  const yaw = car.yaw - d * Math.cos(beta)*Math.tan(car.steering) / (2.08 * car.size),heading=(car.yaw+yaw)/2-beta;
  const x = car.x - Math.sin(heading) * d, z = car.z - Math.cos(heading) * d;
  if (!carFootprintClear(car, x, z, yaw, clear)) { impact.blocked=true;impact.speed=Math.abs(car.speed);car.speed = 0; carRide.notice = 'ရှေ့တွင် အတားအဆီးရှိပါသည်'; break; }
  car.x = x; car.z = z; car.yaw = yaw; car.distance += d;
  wheelStepDistances(d,car.steering,car.size).forEach((travel,i)=>{car.wheelTravel[i]+=travel;});
 }
 const rpm = clutch || gear === 0 ? 850 + gas * 5000 : 850 + Math.abs(car.speed) / Math.max(1, limit) * 5000;
 carRide.rpm += (rpm - carRide.rpm) * Math.min(1, dt * 8);
 return impact;
}
