import { periodAtMinute, type TimeMode } from './environmentTime.ts';

/**
 * ============================================================================
 * Authentic Myanmar Basic Education School Daily Timetable & Classroom Lesson Cycle
 * (မြန်မာအခြေခံပညာကျောင်း နေ့စဉ်အချိန်ဇယား နှင့် စာသင်ခန်း သင်ကြားမှုစက်ဝန်း)
 * ============================================================================
 *
 * Exact Daily Bell Schedule (based on game clock minute `0..1439` + `timeMode`):
 * - `06:30 – 06:59` (390–419)  : `commute-to-school` — အိမ်များမှ ကျောင်းသို့ လျှောက်လာချိန် (၇:၀၀ နာရီတွင် အားလုံး ကျောင်းရောက်)
 * - `07:00 – 08:29` (420–509)  : `morning-play`      — မနက်ပိုင်း ကျောင်းကွင်းပြင် ကစားချိန်
 * - `08:30 – 10:14` (510–614)  : `class`             — ကျောင်းတက်ချိန် (၁) (08:30 AM – 10:15 AM)
 * - `10:15 – 10:29` (615–629)  : `morning-play`      — မနက်ပိုင်း ကစားချိန် (10:15 AM – 10:30 AM)
 * - `10:30 – 11:59` (630–719)  : `class`             — ကျောင်းတက်ချိန် (၂) (10:30 AM – 12:00 PM)
 * - `12:00 – 12:59` (720–779)  : `lunch-break`       — ထမင်းစားနားချိန် (12:00 PM – 01:00 PM)
 * - `13:00 – 15:29` (780–929)  : `class`             — ကျောင်းတက်ချိန် (၃) (01:00 PM – 03:30 PM)
 * - `15:30 – 15:59` (930–959)  : `commute-home`      — ကျောင်းဆင်းချိန် · အိမ်သို့ ပြန်ချိန် (03:30 PM – 04:00 PM)
 * - `16:00 – 06:29` or `evening`/`night` mode: `closed` (Hide all school NPCs)
 */

export type SchoolPeriod =
  | 'commute-to-school'
  | 'morning-play'
  | 'class'
  | 'lunch-break'
  | 'commute-home'
  | 'closed';

export const SCHOOL_COMMUTE_START_MIN = 390; // 06:30 AM
export const SCHOOL_ARRIVAL_MIN = 420;       // 07:00 AM
export const SCHOOL_CLASS1_START_MIN = 510;  // 08:30 AM
export const SCHOOL_RECESS_START_MIN = 615;  // 10:15 AM
export const SCHOOL_CLASS2_START_MIN = 630;  // 10:30 AM
export const SCHOOL_LUNCH_START_MIN = 720;   // 12:00 PM
export const SCHOOL_CLASS3_START_MIN = 780;  // 01:00 PM
export const SCHOOL_DISMISS_MIN = 930;       // 03:30 PM
export const SCHOOL_CLOSED_MIN = 960;        // 04:00 PM

export type ClassroomLessonPhase =
  | 'writing'
  | 'waiting-copy'
  | 'erasing'
  | 'explaining';

export const CHALK_LINE_COUNT = 6;
export const LESSON_CYCLE_SECONDS = 30.0;
const WRITE_END_SEC = 14.0;
const WAIT_COPY_END_SEC = 22.0;
const ERASE_END_SEC = 27.5;

export interface ClassroomLessonState {
  readonly phase: ClassroomLessonPhase;
  /** Normalized progress `0..1` inside the current phase */
  readonly phaseProgress: number;
  /** Visible width fraction `0..1` for each of the 6 chalk lines (top to bottom) */
  readonly lineFill: readonly number[];
  /** Left-edge erased fraction `0..1` for each of the 6 chalk lines while erasing */
  readonly lineErasedLeft: readonly number[];
  /** Currently active chalk line index `0..5` */
  readonly activeLineIndex: number;
  /** Normalized horizontal hand target `-0.5 .. +0.5` across blackboard width */
  readonly cursorNormX: number;
  /** Normalized vertical hand target `-0.5 .. +0.5` across blackboard height */
  readonly cursorNormY: number;
  /** Aggregate chalk coverage `0..1` on the board */
  readonly boardFullness: number;
}

export function effectiveSchoolMinute(minute: number, timeMode?: TimeMode): number {
  let m = ((minute % 1440) + 1440) % 1440;
  if (timeMode === 'morning' && periodAtMinute(m) !== 'morning') {
    m = 420; // 07:00 AM morning preset -> everyone arrived at school, morning play
  } else if (timeMode === 'day' && periodAtMinute(m) !== 'day') {
    m = 780; // 01:00 PM day preset -> afternoon class
  }
  return m;
}

/**
 * Resolves the exact Myanmar school bell period from `(minute, timeMode)`.
 */
export function resolveSchoolPeriod(minute: number, timeMode?: TimeMode): SchoolPeriod {
  if (timeMode === 'evening' || timeMode === 'night') return 'closed';

  const m = effectiveSchoolMinute(minute, timeMode);
  if (m < SCHOOL_COMMUTE_START_MIN || m >= SCHOOL_CLOSED_MIN) return 'closed';
  if (m < SCHOOL_ARRIVAL_MIN) return 'commute-to-school';
  if (m < SCHOOL_CLASS1_START_MIN) return 'morning-play';
  if (m < SCHOOL_RECESS_START_MIN) return 'class';
  if (m < SCHOOL_CLASS2_START_MIN) return 'morning-play';
  if (m < SCHOOL_LUNCH_START_MIN) return 'class';
  if (m < SCHOOL_CLASS3_START_MIN) return 'lunch-break';
  if (m < SCHOOL_DISMISS_MIN) return 'class';
  return 'commute-home';
}

/**
 * Returns normalized `0..1` commute progress (`0 = at village home`, `1 = arrived at school`)
 * for a student/teacher staggered cleanly between `06:30 AM` and `07:00 AM`
 * (or reverse `1 -> 0` going home between `03:30 PM` and `04:00 PM`).
 */
export function computeSchoolCommuteProgress(
  minute: number,
  timeMode: TimeMode | undefined,
  memberSeed: number,
): { atSchool: boolean; progress: number } {
  const period = resolveSchoolPeriod(minute, timeMode);
  if (period === 'commute-to-school') {
    const m = effectiveSchoolMinute(minute, timeMode);
    const staggerFrac = (((memberSeed >>> 0) % 100) / 100);
    // Leave home staggered between 06:30–06:38 AM, arrive at school staggered 06:48–07:00 AM
    const departMin = SCHOOL_COMMUTE_START_MIN + staggerFrac * 8;
    const arriveMin = SCHOOL_ARRIVAL_MIN - (1 - staggerFrac) * 12;
    if (m <= departMin) return { atSchool: false, progress: 0 };
    if (m >= arriveMin) return { atSchool: true, progress: 1 };
    return {
      atSchool: false,
      progress: (m - departMin) / Math.max(1, arriveMin - departMin),
    };
  }
  if (period === 'commute-home') {
    const m = effectiveSchoolMinute(minute, timeMode);
    const staggerFrac = (((memberSeed >>> 0) % 100) / 100);
    const departMin = SCHOOL_DISMISS_MIN + staggerFrac * 5;
    const homeMin = SCHOOL_CLOSED_MIN - (1 - staggerFrac) * 8;
    if (m <= departMin) return { atSchool: true, progress: 1 };
    if (m >= homeMin) return { atSchool: false, progress: 0 };
    return {
      atSchool: false,
      progress: 1 - (m - departMin) / Math.max(1, homeMin - departMin),
    };
  }
  return { atSchool: period !== 'closed', progress: period === 'closed' ? 0 : 1 };
}

export function formatSchoolClock12h(minute: number): string {
  const total = Math.floor((((minute % 1440) + 1440) % 1440));
  const h24 = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${suffix}`;
}

export function schoolPeriodLabelMy(period: SchoolPeriod): string {
  switch (period) {
    case 'commute-to-school':
      return 'မနက် ၆:၃၀–၇:၀၀ အိမ်မှ ကျောင်းသို့ သွားချိန်';
    case 'morning-play':
      return 'ကစားချိန်';
    case 'class':
      return 'ကျောင်းတက် စာသင်ချိန်';
    case 'lunch-break':
      return 'နေ့လည် ၁၂:၀၀–၁:၀၀ ထမင်းစားနားချိန်';
    case 'commute-home':
      return 'ညနေ ၃:၃၀ ကျောင်းဆင်း အိမ်ပြန်ချိန်';
    case 'closed':
      return 'ကျောင်းပိတ်ချိန်';
  }
}

/**
 * Deterministic 30-second repeating classroom teaching cycle per separated room:
 * 1. `writing` (0–14s): Teacher writes 6 lines of chalk from top-left to bottom-right until full.
 * 2. `waiting-copy` (14–22s): Board is 100% full; teacher turns toward class & waits while students copy.
 * 3. `erasing` (22–27.5s): Teacher turns back with blackboard duster (`ဘုတ်ဖျက်`) & wipes all 6 lines clean.
 * 4. `explaining` (27.5–30s): Clean board; teacher turns to class & introduces the next lesson.
 */
export function computeClassroomLessonState(
  elapsedSeconds: number,
  roomSeed = 0,
): ClassroomLessonState {
  const offset = (((roomSeed * 4.37) % LESSON_CYCLE_SECONDS) + LESSON_CYCLE_SECONDS) % LESSON_CYCLE_SECONDS;
  const t = (((elapsedSeconds + offset) % LESSON_CYCLE_SECONDS) + LESSON_CYCLE_SECONDS) % LESSON_CYCLE_SECONDS;

  const lineFill = [0, 0, 0, 0, 0, 0];
  const lineErasedLeft = [0, 0, 0, 0, 0, 0];

  if (t < WRITE_END_SEC) {
    const p = t / WRITE_END_SEC;
    const scaled = p * CHALK_LINE_COUNT;
    const activeLineIndex = Math.min(CHALK_LINE_COUNT - 1, Math.floor(scaled));
    const lineProg = Math.min(1, Math.max(0, scaled - activeLineIndex));

    for (let i = 0; i < CHALK_LINE_COUNT; i++) {
      if (i < activeLineIndex) lineFill[i] = 1;
      else if (i === activeLineIndex) lineFill[i] = lineProg;
      else lineFill[i] = 0;
    }

    return {
      phase: 'writing',
      phaseProgress: p,
      lineFill,
      lineErasedLeft,
      activeLineIndex,
      cursorNormX: lineProg - 0.5,
      cursorNormY: 0.42 - (activeLineIndex / (CHALK_LINE_COUNT - 1)) * 0.84,
      boardFullness: p,
    };
  }

  if (t < WAIT_COPY_END_SEC) {
    const p = (t - WRITE_END_SEC) / (WAIT_COPY_END_SEC - WRITE_END_SEC);
    for (let i = 0; i < CHALK_LINE_COUNT; i++) lineFill[i] = 1;
    return {
      phase: 'waiting-copy',
      phaseProgress: p,
      lineFill,
      lineErasedLeft,
      activeLineIndex: CHALK_LINE_COUNT - 1,
      cursorNormX: 0,
      cursorNormY: 0,
      boardFullness: 1,
    };
  }

  if (t < ERASE_END_SEC) {
    const p = (t - WAIT_COPY_END_SEC) / (ERASE_END_SEC - WAIT_COPY_END_SEC);
    const scaled = p * CHALK_LINE_COUNT;
    const activeLineIndex = Math.min(CHALK_LINE_COUNT - 1, Math.floor(scaled));
    const lineProg = Math.min(1, Math.max(0, scaled - activeLineIndex));

    let remainingSum = 0;
    for (let i = 0; i < CHALK_LINE_COUNT; i++) {
      if (i < activeLineIndex) {
        lineFill[i] = 0;
        lineErasedLeft[i] = 1;
      } else if (i === activeLineIndex) {
        lineFill[i] = 1 - lineProg;
        lineErasedLeft[i] = lineProg;
      } else {
        lineFill[i] = 1;
        lineErasedLeft[i] = 0;
      }
      remainingSum += lineFill[i];
    }

    return {
      phase: 'erasing',
      phaseProgress: p,
      lineFill,
      lineErasedLeft,
      activeLineIndex,
      cursorNormX: lineProg - 0.5,
      cursorNormY: 0.42 - (activeLineIndex / (CHALK_LINE_COUNT - 1)) * 0.84,
      boardFullness: remainingSum / CHALK_LINE_COUNT,
    };
  }

  const p = (t - ERASE_END_SEC) / (LESSON_CYCLE_SECONDS - ERASE_END_SEC);
  return {
    phase: 'explaining',
    phaseProgress: p,
    lineFill,
    lineErasedLeft,
    activeLineIndex: 0,
    cursorNormX: 0,
    cursorNormY: 0,
    boardFullness: 0,
  };
}
