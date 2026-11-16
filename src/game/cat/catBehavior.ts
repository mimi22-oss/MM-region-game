import { farmhouse } from '../../data/ward.ts';
import { homeAccess, localPoint } from '../homeAccess.ts';
import { playCatMeow, startCatPurr, stopCatPurr } from './catAudio.ts';

export type CatState =
  | 'SLEEPING'
  | 'WAKING'
  | 'STRETCHING'
  | 'IDLE'
  | 'SITTING'
  | 'SIT_LOOK_UP'
  | 'WALKING'
  | 'RUNNING'
  | 'FOLLOWING'
  | 'RUBBING'
  | 'PETTING'
  | 'GROOMING'
  | 'PLAYING'
  | 'EATING'
  | 'STARTLED'
  | 'LYING_DOWN';

export type CatPersonality = 'friendly' | 'playful' | 'sleepy' | 'curious';

export interface CatWayPoint {
  lx: number;
  lz: number;
  area: 'house' | 'porch' | 'yard';
  label: string;
}

/** Pre-authored interesting spots in the player's home and yard */
export const CAT_SPOTS = {
  livingRoomRug: { lx: 1.8, lz: -0.8, area: 'house', label: 'ဧည့်ခန်း ကော်ဇော' },
  hallwayCenter: { lx: 0.2, lz: 2.2, area: 'house', label: 'အိမ်လယ်ခန်း' },
  bedroomRug: { lx: -2.8, lz: -1.2, area: 'house', label: 'အိပ်ခန်း ကော်ဇော' },
  kitchenBowls: { lx: 7.2, lz: 1.8, area: 'house', label: 'မီးဖိုချောင် အစာခွက်' },
  porchSunny: { lx: 0.0, lz: 5.8, area: 'porch', label: 'အိမ်ရှေ့ ဝရန်တာ' },
  yardGarden: { lx: -4.5, lz: 3.5, area: 'yard', label: 'ပန်းခြံဘေး' },
  yardPlayArea: { lx: 4.5, lz: 3.5, area: 'yard', label: 'ခြံဝင်း ကစားကွင်း' },
  yardGatePost: { lx: 1.2, lz: 6.8, area: 'yard', label: 'ခြံတံခါးဝ' },
} as const;

/** Hard boundary box in local coordinates (yard fence perimeter) */
export const YARD_BOUNDS = {
  minX: -8.2,
  maxX: 16.8,
  minZ: -6.8,
  maxZ: 7.15, // Absolute limit before the street gate — cat never crosses past 7.15
} as const;

export const HOUSE_BOUNDS = {
  minX: -5.4,
  maxX: 14.5,
  minZ: -4.4,
  maxZ: 4.6, // Inside front door
} as const;

export function clampToCompound(lx: number, lz: number): { lx: number; lz: number } {
  return {
    lx: Math.max(YARD_BOUNDS.minX, Math.min(YARD_BOUNDS.maxX, lx)),
    lz: Math.max(YARD_BOUNDS.minZ, Math.min(YARD_BOUNDS.maxZ, lz)),
  };
}

export function isInsideHouse(lx: number, lz: number): boolean {
  return (
    lx >= HOUSE_BOUNDS.minX &&
    lx <= HOUSE_BOUNDS.maxX &&
    lz >= HOUSE_BOUNDS.minZ &&
    lz <= HOUSE_BOUNDS.maxZ
  );
}

/** Accurate surface elevation based on area */
export function getSurfaceHeight(lx: number, lz: number): number {
  if (isInsideHouse(lx, lz)) {
    return 0.185; // On top of wooden floor planks (0.18) and woven rugs (0.185)
  }
  // Front verandah porch platform: lx in [-1.8, 1.8], lz in [5.0, 6.8]
  if (Math.abs(lx) <= 1.8 && lz >= 5.0 && lz <= 6.8) {
    return 0.23;
  }
  // Entrance steps: lx in [-1.5, 1.5], lz in (6.8, 7.3]
  if (Math.abs(lx) <= 1.5 && lz > 6.8 && lz <= 7.3) {
    return 0.12;
  }
  // Compound yard ground level
  return 0.02;
}

export function localToWorld(lx: number, lz: number): { x: number; z: number } {
  const rot = farmhouse.rotation;
  return {
    x: farmhouse.x + lx * Math.cos(rot) + lz * Math.sin(rot),
    z: farmhouse.z - lx * Math.sin(rot) + lz * Math.cos(rot),
  };
}

export function worldToLocal(wx: number, wz: number): { lx: number; lz: number } {
  const p = localPoint(wx, wz, farmhouse.x, farmhouse.z, farmhouse.rotation);
  return { lx: p.x, lz: p.z };
}

export class CatBehaviorController {
  public state: CatState = 'SLEEPING';
  public personality: CatPersonality = 'friendly';

  // Cat position in local farmhouse coordinates
  public lx: number = CAT_SPOTS.livingRoomRug.lx;
  public lz: number = CAT_SPOTS.livingRoomRug.lz;
  public y: number = 0.185; // on top of wooden floor / rug
  public rotationY: number = 0; // facing front door entrance (+Z)

  // Targets and navigation
  public targetLx: number = CAT_SPOTS.livingRoomRug.lx;
  public targetLz: number = CAT_SPOTS.livingRoomRug.lz;
  public moveSpeed: number = 0.65; // meters/sec matching Walk animation cadence
  public stateTimer: number = 3.0; // short initial nap before getting up
  public purring: boolean = false;
  public isPettingActive: boolean = false;

  // Interaction cooldowns
  public lastMeowTime = 0;
  public lastRubTime = 0;
  public lastPlayTime = 0;
  public lastEatTime = 0;

  constructor(personality: CatPersonality = 'friendly') {
    this.personality = personality;
  }

  /**
   * Main simulation tick called every frame.
   */
  public update(dt: number, playerWorldX: number, playerWorldZ: number): void {
    const isDoorOpen = homeAccess.open.door >= 0.85;
    const playerLocal = worldToLocal(playerWorldX, playerWorldZ);
    const distToPlayer = Math.hypot(this.lx - playerLocal.lx, this.lz - playerLocal.lz);
    const playerInCompound =
      playerLocal.lx >= YARD_BOUNDS.minX &&
      playerLocal.lx <= YARD_BOUNDS.maxX &&
      playerLocal.lz >= YARD_BOUNDS.minZ &&
      playerLocal.lz <= YARD_BOUNDS.maxZ + 0.5;

    this.stateTimer -= dt;
    this.y = getSurfaceHeight(this.lx, this.lz);

    // Handle Petting State
    if (this.isPettingActive) {
      this.state = 'PETTING';
      if (!this.purring) {
        startCatPurr(0.4);
        this.purring = true;
      }
      // Look toward player
      this.turnToward(playerLocal.lx, playerLocal.lz, dt * 4);
      return;
    } else if (this.state === 'PETTING' && !this.isPettingActive) {
      stopCatPurr();
      this.purring = false;
      this.state = 'SIT_LOOK_UP';
      this.stateTimer = 4.0;
    }

    // State machine transitions
    switch (this.state) {
      case 'SLEEPING': {
        if (!this.purring && Math.random() < 0.002) {
          startCatPurr(0.2);
          this.purring = true;
        }
        // Wake up when player approaches or timer expires
        if ((distToPlayer < 3.2 && playerInCompound) || this.stateTimer <= 0) {
          if (this.purring) {
            stopCatPurr();
            this.purring = false;
          }
          this.state = 'WAKING';
          this.stateTimer = 2.2; // WakeUp clip duration
        }
        break;
      }

      case 'WAKING': {
        if (this.stateTimer <= 0) {
          this.state = 'STRETCHING';
          this.stateTimer = 3.0; // Stretch clip duration
          playCatMeow('soft', 0.4);
        }
        break;
      }

      case 'STRETCHING': {
        if (this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 2.5 + Math.random() * 3.0;
        }
        break;
      }

      case 'IDLE': {
        // Player is nearby in the same area
        if (playerInCompound && distToPlayer < 2.0) {
          if (this.personality === 'friendly' && Date.now() - this.lastRubTime > 15000) {
            this.state = 'RUBBING';
            this.stateTimer = 5.0;
            this.lastRubTime = Date.now();
            playCatMeow('greeting', 0.55);
            break;
          } else {
            this.state = 'SIT_LOOK_UP';
            this.stateTimer = 3.0 + Math.random() * 3.0;
            break;
          }
        }

        if (this.stateTimer <= 0) {
          this.pickNextAutonomousActivity(isDoorOpen, playerInCompound, playerLocal, distToPlayer);
        }
        break;
      }

      case 'SITTING': {
        if (playerInCompound && distToPlayer < 2.2) {
          this.state = 'SIT_LOOK_UP';
          this.stateTimer = 3.5;
          this.turnToward(playerLocal.lx, playerLocal.lz, dt * 3);
          break;
        }
        if (this.stateTimer <= 0) {
          this.pickNextAutonomousActivity(isDoorOpen, playerInCompound, playerLocal, distToPlayer);
        }
        break;
      }

      case 'SIT_LOOK_UP': {
        this.turnToward(playerLocal.lx, playerLocal.lz, dt * 3.5);
        if (distToPlayer > 3.5 || !playerInCompound) {
          this.state = 'IDLE';
          this.stateTimer = 2.0;
          break;
        }
        if (this.stateTimer <= 0) {
          if (Math.random() < 0.4 && Date.now() - this.lastMeowTime > 12000) {
            playCatMeow('curious', 0.5);
            this.lastMeowTime = Date.now();
          }
          this.pickNextAutonomousActivity(isDoorOpen, playerInCompound, playerLocal, distToPlayer);
        }
        break;
      }

      case 'WALKING': {
        this.moveTowardTarget(dt, this.moveSpeed);
        const reached = Math.hypot(this.lx - this.targetLx, this.lz - this.targetLz) < 0.15;
        if (reached || this.stateTimer <= 0) {
          // Arrived at destination
          if (Math.hypot(this.lx - CAT_SPOTS.kitchenBowls.lx, this.lz - CAT_SPOTS.kitchenBowls.lz) < 0.6) {
            this.state = 'EATING';
            this.stateTimer = 5.0;
            this.lastEatTime = Date.now();
          } else if (Math.hypot(this.lx - CAT_SPOTS.yardGarden.lx, this.lz - CAT_SPOTS.yardGarden.lz) < 1.0) {
            this.state = 'PLAYING';
            this.stateTimer = 4.5;
            this.lastPlayTime = Date.now();
          } else if (Math.random() < 0.35) {
            this.state = 'GROOMING';
            this.stateTimer = 4.0;
          } else {
            this.state = 'SITTING';
            this.stateTimer = 3.0 + Math.random() * 4.0;
          }
        }
        break;
      }

      case 'RUNNING': {
        this.moveTowardTarget(dt, this.moveSpeed * 1.8);
        const reached = Math.hypot(this.lx - this.targetLx, this.lz - this.targetLz) < 0.25;
        if (reached || this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 2.0;
        }
        break;
      }

      case 'FOLLOWING': {
        // Strict compound constraint: do not follow beyond yard bounds
        const targetX = Math.max(YARD_BOUNDS.minX + 0.5, Math.min(YARD_BOUNDS.maxX - 0.5, playerLocal.lx));
        const targetZ = Math.max(YARD_BOUNDS.minZ + 0.5, Math.min(YARD_BOUNDS.maxZ - 0.3, playerLocal.lz));

        // If door is closed and player is outside, cat stops at door
        if (!isDoorOpen && !isInsideHouse(playerLocal.lx, playerLocal.lz)) {
          this.targetLx = 0;
          this.targetLz = 4.2;
        } else {
          this.targetLx = targetX;
          this.targetLz = targetZ;
        }

        const dToTarget = Math.hypot(this.lx - this.targetLx, this.lz - this.targetLz);
        if (dToTarget > 1.2) {
          this.moveTowardTarget(dt, dToTarget > 3.0 ? this.moveSpeed * 1.6 : this.moveSpeed);
        } else {
          this.turnToward(playerLocal.lx, playerLocal.lz, dt * 3);
          if (this.stateTimer <= 0) {
            this.state = 'RUBBING';
            this.stateTimer = 4.5;
          }
        }

        // If player left compound, stop following
        if (!playerInCompound || playerLocal.lz > YARD_BOUNDS.maxZ + 0.5) {
          this.state = 'SIT_LOOK_UP';
          this.stateTimer = 5.0;
          playCatMeow('soft', 0.45);
        }
        break;
      }

      case 'RUBBING': {
        this.turnToward(playerLocal.lx, playerLocal.lz, dt * 2.5);
        if (distToPlayer > 1.8 || !playerInCompound) {
          this.state = 'IDLE';
          this.stateTimer = 2.0;
          break;
        }
        if (this.stateTimer <= 0) {
          this.state = 'SIT_LOOK_UP';
          this.stateTimer = 4.0;
        }
        break;
      }

      case 'GROOMING': {
        if (this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 2.0;
        }
        break;
      }

      case 'PLAYING': {
        if (this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 3.0;
        }
        break;
      }

      case 'EATING': {
        if (this.stateTimer <= 0) {
          this.state = 'GROOMING';
          this.stateTimer = 3.5;
        }
        break;
      }

      case 'LYING_DOWN': {
        if (this.stateTimer <= 0) {
          this.state = 'SLEEPING';
          this.stateTimer = 18.0 + Math.random() * 25.0; // Long cozy nap
        }
        break;
      }
    }

    // Adapt ground height using accurate surface elevation
    const targetY = getSurfaceHeight(this.lx, this.lz);
    this.y += (targetY - this.y) * Math.min(1, dt * 8);
  }

  /**
   * Intelligently selects the next activity based on environment, door status, and personality.
   */
  private pickNextAutonomousActivity(
    isDoorOpen: boolean,
    playerInCompound: boolean,
    playerLocal: { lx: number; lz: number },
    distToPlayer: number
  ): void {
    // 1. Follow or greet player if nearby in the same accessible zone
    if (playerInCompound && distToPlayer < 5.0 && distToPlayer > 1.4) {
      const canReachPlayer = isDoorOpen || isInsideHouse(playerLocal.lx, playerLocal.lz);
      if (canReachPlayer && Math.random() < 0.6) {
        this.state = 'FOLLOWING';
        this.stateTimer = 8.0;
        return;
      }
    }

    // 2. Hungry? Go to food bowls
    if (Date.now() - this.lastEatTime > 60000 && Math.random() < 0.5) {
      this.targetLx = CAT_SPOTS.kitchenBowls.lx;
      this.targetLz = CAT_SPOTS.kitchenBowls.lz;
      this.state = 'WALKING';
      this.stateTimer = 12.0;
      return;
    }

    // 3. Sleepy? Nap on rug
    if (Math.random() < (this.personality === 'sleepy' ? 0.55 : 0.25)) {
      const rug = Math.random() < 0.6 ? CAT_SPOTS.livingRoomRug : CAT_SPOTS.bedroomRug;
      this.targetLx = rug.lx + (Math.random() - 0.5) * 0.6;
      this.targetLz = rug.lz + (Math.random() - 0.5) * 0.6;
      const distToRug = Math.hypot(this.lx - this.targetLx, this.lz - this.targetLz);
      if (distToRug < 0.5) {
        this.state = 'LYING_DOWN';
        this.stateTimer = 2.4;
      } else {
        this.state = 'WALKING';
        this.stateTimer = 10.0;
      }
      return;
    }

    // 4. Explore out into the yard if door is open!
    if (isDoorOpen && Math.random() < 0.65) {
      const yardSpots = [CAT_SPOTS.yardGarden, CAT_SPOTS.yardPlayArea, CAT_SPOTS.porchSunny];
      const chosen = yardSpots[Math.floor(Math.random() * yardSpots.length)];
      this.targetLx = chosen.lx + (Math.random() - 0.5) * 1.5;
      this.targetLz = chosen.lz + (Math.random() - 0.5) * 1.0;
      // Clamp target strictly to yard bounds
      const clamped = clampToCompound(this.targetLx, this.targetLz);
      this.targetLx = clamped.lx;
      this.targetLz = clamped.lz;
      this.state = Math.random() < 0.3 ? 'RUNNING' : 'WALKING';
      this.stateTimer = 12.0;
      return;
    }

    // 5. Wander inside the house
    const houseSpots = [CAT_SPOTS.livingRoomRug, CAT_SPOTS.bedroomRug, CAT_SPOTS.hallwayCenter];
    const spot = houseSpots[Math.floor(Math.random() * houseSpots.length)];
    this.targetLx = spot.lx + (Math.random() - 0.5) * 1.2;
    this.targetLz = spot.lz + (Math.random() - 0.5) * 1.2;
    this.state = 'WALKING';
    this.stateTimer = 8.0;
  }

  private turnToward(targetLx: number, targetLz: number, turnRate: number): void {
    const dx = targetLx - this.lx;
    const dz = targetLz - this.lz;
    if (Math.hypot(dx, dz) < 0.05) return;
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - this.rotationY;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.rotationY += diff * Math.min(1, turnRate);
  }

  private moveTowardTarget(dt: number, speed: number): void {
    const dx = this.targetLx - this.lx;
    const dz = this.targetLz - this.lz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return;

    this.turnToward(this.targetLx, this.targetLz, dt * 5.0);

    const step = Math.min(dist, speed * dt);
    const nextLx = this.lx + (dx / dist) * step;
    const nextLz = this.lz + (dz / dist) * step;

    // Strict Compound Boundary clamp
    const clamped = clampToCompound(nextLx, nextLz);
    this.lx = clamped.lx;
    this.lz = clamped.lz;
  }
}
