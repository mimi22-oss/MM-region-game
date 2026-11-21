import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  disposeInstitutionNpcCache,
  getInstitutionNpcCache,
} from '../src/game/institutionNpcAssets.ts';
import { getWeipulaVillagerCache } from '../src/game/weipulaVillagers.ts';
import {
  CHURCH_INSTITUTION_ZONES,
  InstitutionNpcFixedPoolController,
  SCHOOL_INSTITUTION_ZONES,
  SCHOOL_MAX_STUDENTS,
  SCHOOL_MIN_STUDENTS,
  buildInstitutionNpcRoster,
  computeClassroomLessonState,
  isChurchServiceHours,
  isSchoolOpenHours,
  resolveSchoolPeriod,
} from '../src/game/institutionNpcPool.ts';
import {
  disposeSchoolBuildingAssetCache,
  getSchoolBuildingAssetCache,
} from '../src/game/schoolBuildingAssets.ts';
import {
  SCHOOL_FLOOR_Y,
  STUDENTS_PER_CLASSROOM,
  WALKIN_SCHOOL_HALLS,
  canStandWalkInSchoolHalls,
  clearClassroomNotice,
  computeClassroomLayout,
  evictFromLockedClassroom,
  findNearestSchoolHall,
  getClassroomNoticeSnapshot,
  getHallBlackboardAnchors,
  getHallDeskSeats,
  getSchoolCampusMetrics,
  setSchoolClassInSession,
} from '../src/game/schoolClassrooms.ts';
import { formatSchoolClock12h } from '../src/game/schoolSchedule.ts';
import { THARSI_SCHOOL_COMPOUND, canStandTharSiSchoolCampus, tharSiVillage } from '../src/data/villages/tharsi/index.ts';
import {
  MYOTHAR_SCHOOL_COMPOUND,
  MYOTHAR_SCHOOL_CONNECTING_ROAD_ID,
  canStandMyotharSchoolCampus,
  myotharCenterBuildings,
  myotharCenterRoads,
} from '../src/data/wards/myothar/center/index.ts';
import { toWorld } from '../src/data/ward.ts';
import { canStand } from '../src/game/collision.ts';
import {
  SCHOOL_HALL_POOL_DESKTOP,
  SCHOOL_HALL_POOL_MOBILE,
  SchoolHallFixedPoolController,
} from '../src/game/schoolHallPool.ts';
import { detectLocation } from '../src/game/locationDetect.ts';

test('InstitutionNpcAssetCache is a strict Singleton reusing shared body geometries with zero duplication', () => {
  const base = getWeipulaVillagerCache();
  const c1 = getInstitutionNpcCache();
  const c2 = getInstitutionNpcCache();
  assert.strictEqual(c1, c2, 'Returns the exact same singleton reference');
  assert.strictEqual(c1.base, base, 'Reuses shared WeipulaVillagerCache body geometries');
  assert.ok(c1.cassockBlackMat && c1.clericalCollarMat && c1.sisterHabitMat && c1.crossGoldMat);
  assert.ok(c1.schoolWhiteMat && c1.schoolGreenMat && c1.backpackGeo && c1.bibleGeo);

  disposeInstitutionNpcCache();
  const c3 = getInstitutionNpcCache();
  assert.notStrictEqual(c3, c1, 'Recreates cleanly after explicit disposal');
  disposeInstitutionNpcCache();
});

test('Every Christian church has Pastors/Sisters and every village school has Teachers & Students', () => {
  assert.equal(CHURCH_INSTITUTION_ZONES.length, 8, 'Covers all 8 Christian churches across Tharyargone, Kyar Inn, and Si Thar');
  assert.equal(SCHOOL_INSTITUTION_ZONES.length, 10, 'Covers all 10 schools across Kanbale, Htomar, Htauk Kyant, Kyar Inn, Nat Myaung, Thar Si, and Myothar');

  const schoolRegions = new Set(SCHOOL_INSTITUTION_ZONES.map(z => z.regionId));
  for (const r of ['kanbale', 'htomar', 'htaukkyant', 'kyarinn', 'natmyaung', 'tharsi', 'myothar']) {
    assert.ok(schoolRegions.has(r), `School region ${r} is populated with students & teachers`);
  }

  const roster = buildInstitutionNpcRoster();
  for (const cz of CHURCH_INSTITUTION_ZONES) {
    const members = roster.filter(m => m.zoneId === cz.id);
    assert.ok(members.length >= 4, `Church ${cz.id} has clergy`);
    const roles = new Set(members.map(m => m.role));
    if (cz.denomination === 'catholic') {
      assert.ok(roles.has('catholic-priest') && roles.has('catholic-sister'), `Catholic church ${cz.id} has Priest & Sister`);
    } else {
      assert.ok(roles.has('pastor-man') && roles.has('pastor-woman'), `Church ${cz.id} has Pastor & Lady Pastor`);
    }
  }

  for (const sz of SCHOOL_INSTITUTION_ZONES) {
    const members = roster.filter(m => m.zoneId === sz.id);
    const students = members.filter(m => m.role === 'student-boy' || m.role === 'student-girl');
    const teachers = members.filter(m => m.role === 'teacher-man' || m.role === 'teacher-woman');
    assert.ok(
      students.length >= SCHOOL_MIN_STUDENTS && students.length <= SCHOOL_MAX_STUDENTS,
      `School ${sz.id} must have 50..100 students, got ${students.length}`,
    );
    assert.ok(teachers.length >= 6, `School ${sz.id} has >=6 teachers, got ${teachers.length}`);
    const roles = new Set(members.map(m => m.role));
    assert.ok(roles.has('teacher-man') && roles.has('teacher-woman'), `School ${sz.id} has male & female teachers`);
    assert.ok(roles.has('student-boy') && roles.has('student-girl'), `School ${sz.id} has boy & girl students`);

    // Verify separated classroom interiors (BOTH 1F & 2F!) are populated with 1 teacher/room & ZERO overlapping seats!
    const insideRoomMembers = members.filter(m => m.insideClassroom);
    assert.ok(
      insideRoomMembers.length >= 25,
      `School ${sz.id} populates separated classroom interiors (got ${insideRoomMembers.length})`,
    );
    assert.ok(
      insideRoomMembers.every(m => m.worldY >= SCHOOL_FLOOR_Y && Boolean(m.roomLabel)),
      `Classroom members stand on valid 1F/2F floor (>=${SCHOOL_FLOOR_Y}m) with distinct room labels`,
    );

    // Verify ZERO overlapping desk seats & even student distribution across EVERY room (1F + 2F)
    const seatedStudents = students.filter(s => s.deskSeat);
    const uniqueSeatKeys = new Set(
      seatedStudents.map(
        s =>
          `${s.deskSeat!.hallId}:f${s.deskSeat!.storey}:r${s.deskSeat!.roomIndex}:${s.deskSeat!.lx.toFixed(3)}:${s.deskSeat!.lz.toFixed(3)}`,
      ),
    );
    assert.equal(
      uniqueSeatKeys.size,
      seatedStudents.length,
      `School ${sz.id} must have ZERO overlapping desk seats (${uniqueSeatKeys.size} unique vs ${seatedStudents.length} seated)`,
    );

    const schoolHalls = WALKIN_SCHOOL_HALLS.filter(h => h.schoolZoneId === sz.id);
    const allBoards = schoolHalls.flatMap(h => getHallBlackboardAnchors(h));
    const roomCounts = new Map<string, number>();
    for (const b of allBoards) {
      roomCounts.set(`${b.hallId}:f${b.storey}:r${b.roomIndex}`, 0);
    }
    for (const s of seatedStudents) {
      const rk = `${s.deskSeat!.hallId}:f${s.deskSeat!.storey}:r${s.deskSeat!.roomIndex}`;
      roomCounts.set(rk, (roomCounts.get(rk) ?? 0) + 1);
    }
    const countsArr = [...roomCounts.values()];
    const minPerRoom = Math.min(...countsArr);
    const maxPerRoom = Math.max(...countsArr);
    assert.equal(
      minPerRoom,
      STUDENTS_PER_CLASSROOM,
      `School ${sz.id} fills EVERY classroom (1F+2F) with exactly ${STUDENTS_PER_CLASSROOM} students, got min=${minPerRoom}`,
    );
    assert.equal(
      maxPerRoom,
      STUDENTS_PER_CLASSROOM,
      `School ${sz.id} fills EVERY classroom (1F+2F) with exactly ${STUDENTS_PER_CLASSROOM} students, got max=${maxPerRoom}`,
    );

    // Verify 1 dedicated teacher per separated classroom (both 1F and 2F!)
    const assignedBoardIds = new Set(teachers.filter(t => t.boardAnchor).map(t => t.boardAnchor!.id));
    assert.equal(
      assignedBoardIds.size,
      allBoards.length,
      `School ${sz.id} assigns 1 dedicated teacher to EVERY classroom (1F+2F): ${assignedBoardIds.size} vs ${allBoards.length}`,
    );
  }
});

test('Multi-classroom 20-house-scale school halls use Singleton cache, separate classrooms cleanly, and allow walking through open doorways', () => {
  const s1 = getSchoolBuildingAssetCache();
  const s2 = getSchoolBuildingAssetCache();
  assert.strictEqual(s1, s2, 'SchoolBuildingAssetCache returns strict Singleton reference');
  assert.ok(s1.unitBoxGeo && s1.chalkboardMat && s1.deskTopMat && s1.partitionWallMat);
  disposeSchoolBuildingAssetCache();

  // Verify 20-house-scale campus metrics (~975 m²+ / 13–22 separated classrooms) for major village schools
  for (const zid of [
    'school-kyarinn-bems',
    'school-htaukkyant-behs',
    'school-htomar-behs',
    'school-kanbale',
    'school-tharsi-behs',
    'school-myothar-behs',
  ]) {
    const metrics = getSchoolCampusMetrics(zid);
    assert.ok(
      metrics.roomCount >= 13,
      `School ${zid} must have many separated classrooms (>=13), got ${metrics.roomCount}`,
    );
    assert.ok(
      metrics.floorAreaSqM >= 950,
      `School ${zid} must be scaled to ~20 houses (>=950 m²), got ${metrics.floorAreaSqM} m² (${metrics.houseEquivalents} houses)`,
    );
  }

  // Verify walk-in collision: open classroom doorway & interior are walkable; rear & partition walls block!
  const kyarInnNorthHall = WALKIN_SCHOOL_HALLS.find(h => h.id === 'ki-school-north-hall-1')!;
  assert.ok(kyarInnNorthHall);
  const layout = computeClassroomLayout(kyarInnNorthHall);
  const firstRoom = layout.classrooms[0];
  const c = Math.cos(layout.canonicalRotation);
  const s = Math.sin(layout.canonicalRotation);
  const toHallWorld = (lx: number, lz: number) => ({
    x: kyarInnNorthHall.x + lx * c + lz * s,
    z: kyarInnNorthHall.z - lx * s + lz * c,
  });

  // 1. Standing on open corridor veranda -> WALKABLE
  const verandaPt = toHallWorld(firstRoom.doorX, layout.zFrontWall + 1.0);
  assert.equal(canStandWalkInSchoolHalls(verandaPt.x, verandaPt.z), true, 'Corridor veranda is walkable');

  // 2. Walking straight through the open classroom doorway -> WALKABLE
  const doorwayPt = toHallWorld(firstRoom.doorX, layout.zFrontWall);
  assert.equal(canStandWalkInSchoolHalls(doorwayPt.x, doorwayPt.z), true, 'Open classroom doorway is walkable');

  // 3. Standing inside the separated classroom -> WALKABLE
  const insidePt = toHallWorld(firstRoom.cx, (layout.zBack + layout.zFrontWall) / 2);
  assert.equal(canStandWalkInSchoolHalls(insidePt.x, insidePt.z), true, 'Separated classroom interior is walkable');

  // 4. Walking into the interior partition wall between Room 1 and Room 2 -> BLOCKED
  const partitionPt = toHallWorld(firstRoom.xMax, (layout.zBack + layout.zFrontWall) / 2);
  assert.equal(canStandWalkInSchoolHalls(partitionPt.x, partitionPt.z), false, 'Interior partition wall separates classrooms solidly');

  // 5. Walking into rear exterior wall -> BLOCKED
  const backWallPt = toHallWorld(firstRoom.cx, layout.zBack);
  assert.equal(canStandWalkInSchoolHalls(backWallPt.x, backWallPt.z), false, 'Rear exterior wall blocks clipping');
});

test('School students & teachers are visible in morning/day and strictly HIDDEN in evening & night via Fixed Object Pool', () => {
  // Time-of-day rules
  assert.equal(isSchoolOpenHours(540, 'morning'), true);
  assert.equal(isSchoolOpenHours(780, 'day'), true);
  assert.equal(isSchoolOpenHours(1080, 'evening'), false, 'School NPCs MUST hide in evening');
  assert.equal(isSchoolOpenHours(1320, 'night'), false, 'School NPCs MUST hide at night');

  assert.equal(isChurchServiceHours(540, 'morning'), true);
  assert.equal(isChurchServiceHours(780, 'day'), true);
  assert.equal(isChurchServiceHours(1080, 'evening'), true);
  assert.equal(isChurchServiceHours(1320, 'night'), false);

  const pool = new InstitutionNpcFixedPoolController(32, 200);
  const kyarinnSchool = SCHOOL_INSTITUTION_ZONES.find(z => z.id === 'school-kyarinn-bems')!;
  const kyarinnChurch = CHURCH_INSTITUTION_ZONES.find(z => z.id === 'church-kyarinn-st-peter')!;

  try {
    // 1. Daytime at Kyar Inn School -> students & teachers fill the fixed pool
    pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 780, 'day', true);
    const daySchoolCount = pool.slots.filter(s => s.member?.institutionKind === 'school').length;
    assert.ok(daySchoolCount >= 12, `Expected >=12 active school NPCs during day, got ${daySchoolCount}`);

    // 2. Evening at Kyar Inn School -> STRICTLY 0 school students/teachers & 0 live chalkboards!
    pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 1080, 'evening', true);
    const eveningSchoolCount = pool.slots.filter(s => s.member?.institutionKind === 'school').length;
    assert.equal(eveningSchoolCount, 0, 'ALL school students & teachers must be hidden in evening');
    assert.equal(pool.boardSlots.filter(b => b.anchor !== null).length, 0, 'Zero live chalkboards in evening');

    // 3. Night & 04:00 PM–06:29 AM -> STRICTLY 0 school students/teachers & 0 live chalkboards!
    for (const [min, mode] of [
      [960, 'auto'],
      [1320, 'night'],
      [300, 'auto'],
      [389, 'auto'],
    ] as const) {
      pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], min, mode, true);
      assert.equal(
        pool.slots.filter(s => s.member?.institutionKind === 'school').length,
        0,
        `ALL school NPCs must be hidden at min=${min} mode=${mode}`,
      );
      assert.equal(
        pool.boardSlots.filter(b => b.anchor !== null).length,
        0,
        `ALL chalkboards must be hidden at min=${min} mode=${mode}`,
      );
    }

    // 4. Evening at St. Peter Catholic Church -> Priest & Sisters remain visible for evening service!
    pool.update(kyarinnChurch.centerX, kyarinnChurch.centerZ, 0.05, ['kyarinn'], 1080, 'evening', true);
    const eveningChurchCount = pool.slots.filter(s => s.member?.institutionKind === 'church').length;
    assert.ok(eveningChurchCount >= 4, `Expected >=4 clergy at church in evening, got ${eveningChurchCount}`);

    // Fixed capacity invariant
    assert.equal(pool.slots.length, 32);
  } finally {
    pool.dispose();
  }

  // Verify live wiring inside StreamedWorld.tsx
  const streamedWorldSrc = readFileSync('src/components/StreamedWorld.tsx', 'utf8');
  assert.ok(streamedWorldSrc.includes('<VillageInstitutionBots'), 'StreamedWorld mounts live VillageInstitutionBots');
});

test('Myanmar school timetable drives 06:30-07:00 home commute, morning play, 8:30-10:15/10:30-12:00/13:00-15:30 classes, 10:15-10:30 play, 12:00-13:00 lunch, and evening/night hide', () => {
  // 1. Exact Myanmar school bell timetable periods
  assert.equal(resolveSchoolPeriod(360, 'auto'), 'closed', '06:00 AM is before 06:30 departure');
  assert.equal(resolveSchoolPeriod(390, 'auto'), 'commute-to-school', '06:30 AM students leave homes for school');
  assert.equal(resolveSchoolPeriod(405, 'auto'), 'commute-to-school', '06:45 AM students walking from homes to school');
  assert.equal(resolveSchoolPeriod(420, 'auto'), 'morning-play', '07:00 AM all students arrive at school & play');
  assert.equal(resolveSchoolPeriod(509, 'auto'), 'morning-play', '08:29 AM still morning play before 8:30 bell');
  assert.equal(resolveSchoolPeriod(510, 'auto'), 'class', '08:30 AM starts Class 1 (8:30–10:15)');
  assert.equal(resolveSchoolPeriod(614, 'auto'), 'class', '10:14 AM still Class 1');
  assert.equal(resolveSchoolPeriod(615, 'auto'), 'morning-play', '10:15 AM starts Recess Playtime (10:15–10:30)');
  assert.equal(resolveSchoolPeriod(629, 'auto'), 'morning-play', '10:29 AM still Recess Playtime');
  assert.equal(resolveSchoolPeriod(630, 'auto'), 'class', '10:30 AM starts Class 2 (10:30–12:00)');
  assert.equal(resolveSchoolPeriod(719, 'auto'), 'class', '11:59 AM still Class 2');
  assert.equal(resolveSchoolPeriod(720, 'auto'), 'lunch-break', '12:00 PM starts Lunch Break (12:00–13:00)');
  assert.equal(resolveSchoolPeriod(750, 'auto'), 'lunch-break', '12:30 PM is Lunch Break');
  assert.equal(resolveSchoolPeriod(780, 'auto'), 'class', '01:00 PM starts Class 3 (13:00–15:30)');
  assert.equal(resolveSchoolPeriod(929, 'auto'), 'class', '03:29 PM still Class 3');
  assert.equal(resolveSchoolPeriod(930, 'auto'), 'commute-home', '03:30 PM dismissal — walking home');
  assert.equal(resolveSchoolPeriod(960, 'auto'), 'closed', '04:00 PM school closed');
  assert.equal(resolveSchoolPeriod(1020, 'evening'), 'closed', 'Evening hides school');
  assert.equal(resolveSchoolPeriod(1260, 'night'), 'closed', 'Night hides school');

  // 2. Classroom teaching cycle: Write -> Full Board Wait-Copy -> Erase -> Explain
  const sWrite = computeClassroomLessonState(7.0, 0);
  assert.equal(sWrite.phase, 'writing');
  assert.ok(sWrite.boardFullness > 0.3 && sWrite.boardFullness < 0.7, 'Board fills progressively while teacher writes');

  const sWait = computeClassroomLessonState(18.0, 0);
  assert.equal(sWait.phase, 'waiting-copy');
  assert.equal(sWait.boardFullness, 1, 'Board stays 100% full while teacher waits for students to copy');
  assert.ok(sWait.lineFill.every(v => v === 1), 'All 6 chalk lines are full during waiting-copy');

  const sErase = computeClassroomLessonState(25.0, 0);
  assert.equal(sErase.phase, 'erasing');
  assert.ok(sErase.boardFullness > 0 && sErase.boardFullness < 1, 'Chalk lines wipe away progressively while erasing');

  const sExplain = computeClassroomLessonState(28.5, 0);
  assert.equal(sExplain.phase, 'explaining');
  assert.equal(sExplain.boardFullness, 0, 'Board is wiped clean after erasing completes');

  // 3. Live pool transitions: 06:40 commute -> 07:00 arrival play -> 08:30 class -> 10:20 recess play -> 12:30 lunch -> 13:00 class -> evening hidden
  const pool = new InstitutionNpcFixedPoolController(144, 220, undefined, 32);
  const kyarinnSchool = SCHOOL_INSTITUTION_ZONES.find(z => z.id === 'school-kyarinn-bems')!;
  try {
    // 06:40 AM (minute=400): students & teachers actively commuting from village homes toward school!
    const commuteRes = pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 400, 'auto', true);
    assert.equal(commuteRes.schoolPeriod, 'commute-to-school');
    const commuting = pool.slots.map(s => s.member).filter(m => m?.classActivity === 'commute-to-school');
    assert.ok(commuting.length >= 20, `Expected students walking from village homes to school at 06:40 AM, got ${commuting.length}`);

    // 07:00 AM (minute=420): 100% of students arrived at school and playing on the yard!
    const arrivalRes = pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 420, 'auto', true);
    assert.equal(arrivalRes.schoolPeriod, 'morning-play');
    const morningPlayMembers = pool.slots.map(s => s.member).filter(m => m?.institutionKind === 'school');
    assert.ok(morningPlayMembers.length >= 40);
    assert.ok(morningPlayMembers.every(m => !m!.seated && m!.classActivity === 'play'), 'All students arrived at school by 07:00 AM and are playing');

    // 08:30 AM (minute=510): Class 1 — seated students copying (15/room!) & teachers writing/sitting-resting/erasing on live blackboards!
    const classRes = pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 510, 'auto', true);
    assert.equal(classRes.schoolPeriod, 'class');
    const activeMembers = pool.slots.map(s => s.member).filter(Boolean);
    const seatedStudents = activeMembers.filter(m => m!.seated && m!.classActivity === 'student-copy');
    const teachingTeachers = activeMembers.filter(
      m =>
        m!.classActivity === 'teaching-write' ||
        m!.classActivity === 'teaching-sit-rest' ||
        m!.classActivity === 'teaching-wait' ||
        m!.classActivity === 'teaching-erase' ||
        m!.classActivity === 'teaching-explain',
    );
    const activeBoards = pool.boardSlots.filter(b => b.anchor !== null && b.lesson !== null);
    assert.ok(seatedStudents.length >= 90, `Expected >=90 seated copying students during 8:30 class, got ${seatedStudents.length}`);
    assert.ok(teachingTeachers.length >= 8, `Expected >=8 teachers in classrooms during 8:30 class, got ${teachingTeachers.length}`);
    assert.ok(activeBoards.length >= 10, `Expected >=10 live animated chalkboards during 8:30 class, got ${activeBoards.length}`);

    // 10:20 AM (minute=620): Recess Playtime (10:15–10:30)
    const recessRes = pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 620, 'auto', true);
    assert.equal(recessRes.schoolPeriod, 'morning-play');
    const recessMembers = pool.slots.map(s => s.member).filter(m => m?.institutionKind === 'school');
    assert.ok(recessMembers.every(m => !m!.seated && m!.classActivity === 'play'), 'Students play outside during 10:15–10:30 break');

    // 12:30 PM (minute=750): Lunch Break (12:00–13:00)
    const lunchRes = pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 750, 'auto', true);
    assert.equal(lunchRes.schoolPeriod, 'lunch-break');
    const lunchMembers = pool.slots.map(s => s.member).filter(m => m?.institutionKind === 'school');
    assert.equal(lunchMembers.filter(m => m!.seated).length, 0, 'No students seated at desks during 12–1 lunch break');
    assert.ok(lunchMembers.every(m => m!.classActivity === 'lunch'), 'School members switch to lunch break behavior');

    // 02:30 PM (minute=870): Afternoon Class (13:00–15:30)
    const pmClassRes = pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 870, 'auto', true);
    assert.equal(pmClassRes.schoolPeriod, 'class');
    assert.ok(pool.slots.filter(s => s.member?.seated).length >= 40, 'Students seated in classrooms during 1:00–3:30 PM class');

    // 03:30 PM (minute=935): Dismissal — walking home from school (`commute-home`)
    const dismissRes = pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 935, 'auto', true);
    assert.equal(dismissRes.schoolPeriod, 'commute-home');
    const goingHome = pool.slots.map(s => s.member).filter(m => m?.institutionKind === 'school');
    assert.ok(goingHome.length >= 20, 'Students/teachers walking home during 03:30–03:59 PM');
    assert.equal(goingHome.filter(m => m!.seated).length, 0, 'Zero seated students during dismissal');
    assert.equal(pool.boardSlots.filter(b => b.anchor !== null).length, 0, 'Zero active chalkboards during dismissal');

    // 04:00 PM – 06:29 AM / Evening / Night -> STRICTLY 0 school NPCs and 0 active chalkboards!
    pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 1020, 'evening', true);
    assert.equal(pool.slots.filter(s => s.member?.institutionKind === 'school').length, 0);
    assert.equal(pool.boardSlots.filter(b => b.anchor !== null).length, 0);
  } finally {
    pool.dispose();
  }
});

test('2nd-floor classrooms, class-time classroom lock + Burmese toast, and teacher sit-at-desk-chair resting cycle work cleanly', () => {
  // 1. Verify 2-storey schools have true walkable 2nd-floor classrooms, seats, blackboards, & exterior stairs
  const twoStoreyHalls = WALKIN_SCHOOL_HALLS.filter(h => h.storeys === 2);
  assert.ok(twoStoreyHalls.length >= 6, `Expected >=6 two-storey walk-in school halls, got ${twoStoreyHalls.length}`);
  for (const h of twoStoreyHalls) {
    const layout = computeClassroomLayout(h);
    assert.ok(layout.upperClassrooms.length === layout.classrooms.length);
    assert.ok(layout.upperFloorY > layout.floorY + 3.0);
    const seats = getHallDeskSeats(h);
    const boards = getHallBlackboardAnchors(h);
    assert.ok(seats.some(s => s.storey === 0) && seats.some(s => s.storey === 1), `Hall ${h.id} seats both 1F and 2F`);
    assert.ok(boards.some(b => b.storey === 0) && boards.some(b => b.storey === 1), `Hall ${h.id} has 1F and 2F blackboards`);
    assert.ok(boards.every(b => Number.isFinite(b.teacherChairLx) && Number.isFinite(b.teacherChairLz)));
  }

  // 2. Verify class-time classroom entry lock + transient Burmese toast notice (and break-time unlock)
  const hkMain = WALKIN_SCHOOL_HALLS.find(h => h.id === 'hk-landmark-school-main')!;
  const layout = computeClassroomLayout(hkMain);
  const room = layout.classrooms[1];
  const c = Math.cos(layout.canonicalRotation);
  const s = Math.sin(layout.canonicalRotation);
  const toW = (lx: number, lz: number) => ({
    x: hkMain.x + lx * c + lz * s,
    z: hkMain.z - lx * s + lz * c,
  });
  const verandaPt = toW(room.doorX, layout.zFrontWall + 1.1);
  const doorwayPt = toW(room.doorX, layout.zFrontWall);
  const insidePt = toW(room.cx, (layout.zBack + layout.zFrontWall) / 2);

  try {
    clearClassroomNotice();
    setSchoolClassInSession(true);
    assert.equal(canStandWalkInSchoolHalls(verandaPt.x, verandaPt.z), true, 'Veranda stays walkable during class time');
    assert.equal(canStandWalkInSchoolHalls(doorwayPt.x, doorwayPt.z), false, 'Classroom doorway blocks entry during class');
    assert.equal(canStandWalkInSchoolHalls(insidePt.x, insidePt.z), false, 'Classroom interior blocks entry during class');
    const notice = getClassroomNoticeSnapshot();
    assert.ok(notice && notice.message.includes('စာသင်နေပါသည်'), 'Emits transient Burmese class-in-session toast');

    const evicted = evictFromLockedClassroom(insidePt.x, insidePt.z);
    assert.ok(evicted, 'Evicts player cleanly onto veranda if class bell rings while indoors');
    assert.equal(canStandWalkInSchoolHalls(evicted!.x, evicted!.z), true, 'Eviction target on veranda is walkable');

    setSchoolClassInSession(false);
    assert.equal(canStandWalkInSchoolHalls(doorwayPt.x, doorwayPt.z), true, 'Break time unlocks classroom doorways');
    assert.equal(canStandWalkInSchoolHalls(insidePt.x, insidePt.z), true, 'Break time allows walking inside classrooms');
  } finally {
    setSchoolClassInSession(false);
    clearClassroomNotice();
  }

  // 3. Verify Teacher Cycle: Stand & Write -> Sit Resting at Desk Chair Watching Students -> Stand & Erase
  const pool = new InstitutionNpcFixedPoolController(120, 220, undefined, 32);
  const nmHigh = SCHOOL_INSTITUTION_ZONES.find(z => z.id === 'school-natmyaung-high')!;
  try {
    const seen = new Set<string>();
    let sawSeatedTeacherOnChair = false;
    let sawUpperFloorStudent = false;
    let sawUpperFloorTeacher = false;
    for (let step = 0; step < 640; step++) {
      pool.update(nmHigh.centerX, nmHigh.centerZ, 0.05, ['natmyaung'], 540, 'auto', step === 0);
      for (const slot of pool.slots) {
        const m = slot.member;
        if (!m || m.zoneId !== 'school-natmyaung-high') continue;
        if (m.deskSeat && m.deskSeat.storey === 1 && m.seated) sawUpperFloorStudent = true;
        if (m.boardAnchor) {
          seen.add(m.classActivity);
          if (m.boardAnchor.storey === 1) sawUpperFloorTeacher = true;
          if (m.classActivity === 'teaching-sit-rest' && m.seated) sawSeatedTeacherOnChair = true;
        }
      }
    }
    assert.ok(sawUpperFloorStudent, '2nd-floor students are actively seated at 2nd-floor desks');
    assert.ok(sawUpperFloorTeacher, '2nd-floor teachers are actively teaching in 2nd-floor classrooms');
    assert.ok(seen.has('teaching-write'), 'Teacher writes on blackboard');
    assert.ok(sawSeatedTeacherOnChair, 'Teacher sits down resting on desk chair watching students after writing');
    assert.ok(seen.has('teaching-erase'), 'Teacher stands back up and erases the blackboard');
  } finally {
    pool.dispose();
  }

  // 4. Verify regular non-dorm classroom halls have STRICTLY 0 NPCs during 04:00 PM–06:29 AM / evening / night,
  //    AND school clock HUD detection (`findNearestSchoolHall` + `formatSchoolClock12h`) works cleanly!
  assert.equal(formatSchoolClock12h(960), '04:00 PM');
  assert.equal(formatSchoolClock12h(389), '06:29 AM');
  assert.equal(formatSchoolClock12h(510), '08:30 AM');
  assert.equal(formatSchoolClock12h(720), '12:00 PM');
  assert.equal(formatSchoolClock12h(1260), '09:00 PM');

  const regularClassroomHall = WALKIN_SCHOOL_HALLS.find(h => h.id === 'ki-school-north-hall-1')!;
  assert.equal(regularClassroomHall.dormRole, undefined);
  assert.equal(findNearestSchoolHall(regularClassroomHall.x, regularClassroomHall.z)?.id, regularClassroomHall.id);
  assert.equal(findNearestSchoolHall(0, 0), null, 'Far from any school does not hide Mission HUD');

  const checkPool = new InstitutionNpcFixedPoolController(144, 220, undefined, 32);
  try {
    // Transition straight from 01:00 PM class -> 04:00 PM, 04:05 PM, evening, night, 05:00 AM, 06:29 AM -> 100% hidden (0)!
    checkPool.update(regularClassroomHall.x, regularClassroomHall.z, 0.05, ['kyarinn'], 780, 'day', true);
    assert.ok(checkPool.slots.filter(s => s.member?.institutionKind === 'school').length >= 90);
    for (const [min, mode] of [
      [960, 'auto'],
      [965, 'auto'],
      [1020, 'evening'],
      [1260, 'night'],
      [300, 'auto'],
      [389, 'auto'],
    ] as const) {
      checkPool.update(regularClassroomHall.x, regularClassroomHall.z, 0.05, ['kyarinn'], min, mode, true);
      assert.equal(
        checkPool.slots.filter(s => s.member?.institutionKind === 'school').length,
        0,
        `ALL school students & teachers must be strictly hidden at min=${min} mode=${mode}`,
      );
      assert.equal(
        checkPool.boardSlots.filter(b => b.anchor !== null).length,
        0,
        `ALL chalkboards must be strictly hidden at min=${min} mode=${mode}`,
      );
    }
  } finally {
    checkPool.dispose();
  }
});

test('Thar Si School expands Ward 6 geometry cleanly with ZERO removed houses, flagpole, 3 resting pavilions, 18 classrooms, and live students/teachers', () => {
  // 1. ALL 320 original Thar Si houses are preserved (ZERO houses removed!)
  assert.equal(tharSiVillage.houses.length, 320, 'All 320 original Thar Si houses are preserved');

  // 2. Flagpole podium blocks walking; resting pavilions & assembly plaza & entrance gate are walkable!
  assert.equal(
    canStandTharSiSchoolCampus(THARSI_SCHOOL_COMPOUND.flagpole.x, THARSI_SCHOOL_COMPOUND.flagpole.z),
    false,
    'Flagpole stepped podium blocks walking',
  );
  assert.equal(
    canStand(THARSI_SCHOOL_COMPOUND.entranceGate.x, THARSI_SCHOOL_COMPOUND.entranceGate.z),
    true,
    'Wide North school entrance gate on Thar Si Main Road is walkable',
  );
  for (const pav of THARSI_SCHOOL_COMPOUND.restPavilions) {
    assert.equal(canStand(pav.x, pav.z), true, `Resting pavilion ${pav.id} interior is walkable`);
  }

  // 3. Location detection recognizes BOTH Thar Si School AND expanded Ward 6 cleanly!
  const schoolLoc = detectLocation(THARSI_SCHOOL_COMPOUND.flagpole.x, THARSI_SCHOOL_COMPOUND.flagpole.z);
  assert.equal(schoolLoc.id, 'tharsi');
  assert.ok(schoolLoc.subArea?.includes('သာစည်ကျောင်း'), `Expected သာစည်ကျောင်း, got ${schoolLoc.subArea}`);

  // 4. Verify live pool populates Thar Si School during class (15 students/room + 1 teacher/room) and hides 100% after 4 PM
  const pool = new InstitutionNpcFixedPoolController(144, 220, undefined, 32);
  try {
    pool.update(THARSI_SCHOOL_COMPOUND.flagpole.x, THARSI_SCHOOL_COMPOUND.flagpole.z, 0.05, ['tharsi'], 540, 'auto', true);
    const activeSeated = pool.slots.filter(s => s.member?.zoneId === 'school-tharsi-behs' && s.member.seated);
    const activeTeachers = pool.slots.filter(s => s.member?.zoneId === 'school-tharsi-behs' && Boolean(s.member.boardAnchor));
    assert.ok(activeSeated.length >= 90, `Thar Si School seats >=90 nearby students during class, got ${activeSeated.length}`);
    assert.ok(activeTeachers.length >= 8, `Thar Si School has >=8 active classroom teachers, got ${activeTeachers.length}`);

    pool.update(THARSI_SCHOOL_COMPOUND.flagpole.x, THARSI_SCHOOL_COMPOUND.flagpole.z, 0.05, ['tharsi'], 960, 'auto', true);
    assert.equal(pool.slots.filter(s => s.member?.institutionKind === 'school').length, 0, 'Thar Si School hides 100% at 4:00 PM');
  } finally {
    pool.dispose();
  }
});

test('Myothar School sits cleanly in Myothar Center open compound with ZERO OSM building overlaps, flagpole, resting pavilions, 16 classrooms, and live students/teachers', () => {
  // 1. ZERO overlap with any existing Myothar Center OSM buildings inside the compound footprint
  const overlapping = myotharCenterBuildings.filter(
    b => b.u >= -166 && b.u <= -102 && b.v >= -954 && b.v <= -894,
  );
  assert.equal(overlapping.length, 0, 'Myothar School compound removes/overlaps ZERO existing OSM houses');

  // 2. Flagpole blocks; East entrance gate, connected road corridor, & resting pavilions are walkable!
  assert.equal(
    canStandMyotharSchoolCampus(MYOTHAR_SCHOOL_COMPOUND.flagpole.x, MYOTHAR_SCHOOL_COMPOUND.flagpole.z),
    false,
    'Myothar School flagpole podium blocks walking',
  );
  assert.equal(
    canStand(MYOTHAR_SCHOOL_COMPOUND.entranceGate.x, MYOTHAR_SCHOOL_COMPOUND.entranceGate.z),
    true,
    'Myothar School East entrance gate is walkable',
  );
  const connRoad = myotharCenterRoads.find(r => r.id === MYOTHAR_SCHOOL_CONNECTING_ROAD_ID)!;
  const lastPt = connRoad.worldPoints[connRoad.worldPoints.length - 1];
  assert.ok(
    Math.hypot(lastPt[0] - MYOTHAR_SCHOOL_COMPOUND.entranceGate.x, lastPt[1] - MYOTHAR_SCHOOL_COMPOUND.entranceGate.z) < 1.0,
    'way/239609161 connects directly into Myothar School East gate',
  );
  for (const sampleU of [-65, -75, -80, -88, -95, -103]) {
    const pt = toWorld(sampleU, -927.2);
    assert.equal(canStand(pt.x, pt.z), true, `School connecting road at u=${sampleU} is completely clear of houses`);
  }
  const movedHouse = myotharCenterBuildings.find(b => b.id === 'way/403019921')!;
  assert.equal(movedHouse.u, -82.0);
  assert.equal(movedHouse.v, -911.0);
  assert.equal(canStand(movedHouse.x, movedHouse.z), false, 'Relocated house still has solid collision at its new plot');
  for (const pav of MYOTHAR_SCHOOL_COMPOUND.restPavilions) {
    assert.equal(canStand(pav.x, pav.z), true, `Resting pavilion ${pav.id} interior is walkable`);
  }

  // 3. Location detection recognizes မြို့သာကျောင်း
  const schoolLoc = detectLocation(MYOTHAR_SCHOOL_COMPOUND.flagpole.x, MYOTHAR_SCHOOL_COMPOUND.flagpole.z);
  assert.equal(schoolLoc.id, 'myothar-school');
  assert.ok(schoolLoc.subArea?.includes('မြို့သာကျောင်း'));

  // 4. Live pool populates Myothar School during class and hides 100% after 4:00 PM
  const pool = new InstitutionNpcFixedPoolController(144, 220, undefined, 32);
  try {
    pool.update(MYOTHAR_SCHOOL_COMPOUND.flagpole.x, MYOTHAR_SCHOOL_COMPOUND.flagpole.z, 0.05, ['myothar'], 540, 'auto', true);
    const activeSeated = pool.slots.filter(s => s.member?.zoneId === 'school-myothar-behs' && s.member.seated);
    const activeTeachers = pool.slots.filter(s => s.member?.zoneId === 'school-myothar-behs' && Boolean(s.member.boardAnchor));
    assert.ok(activeSeated.length >= 90, `Myothar School seats >=90 nearby students during class, got ${activeSeated.length}`);
    assert.ok(activeTeachers.length >= 8, `Myothar School has >=8 active classroom teachers, got ${activeTeachers.length}`);

    pool.update(MYOTHAR_SCHOOL_COMPOUND.flagpole.x, MYOTHAR_SCHOOL_COMPOUND.flagpole.z, 0.05, ['myothar'], 960, 'auto', true);
    assert.equal(pool.slots.filter(s => s.member?.institutionKind === 'school').length, 0, 'Myothar School hides 100% at 4:00 PM');
  } finally {
    pool.dispose();
  }
});

test('ALL 10 schools (32 halls) run through ONE Singleton Memory Reference Cache + Fixed Object Pool with zero duplication across villages', () => {
  assert.equal(WALKIN_SCHOOL_HALLS.length, 32, 'All 32 walk-in halls across all 10 schools are registered in single source');

  const desktopPool = new SchoolHallFixedPoolController(SCHOOL_HALL_POOL_DESKTOP, 260);
  const mobilePool = new SchoolHallFixedPoolController(SCHOOL_HALL_POOL_MOBILE, 190);

  try {
    // 1. Travel to Myothar School -> binds all 3 Myothar halls into fixed slots
    const r1 = desktopPool.rebalance(MYOTHAR_SCHOOL_COMPOUND.x, MYOTHAR_SCHOOL_COMPOUND.z, ['myothar']);
    assert.equal(r1.changed, true);
    assert.equal(r1.activeCount, 3);
    const slotMapBefore = new Map(desktopPool.slots.filter(s => s.hall).map(s => [s.hall!.id, s.slotIndex]));

    // 2. Sticky slot invariant: rebalancing nearby keeps exact same slot indices with changed=false!
    const r1Sticky = desktopPool.rebalance(MYOTHAR_SCHOOL_COMPOUND.x + 2, MYOTHAR_SCHOOL_COMPOUND.z + 2, ['myothar']);
    assert.equal(r1Sticky.changed, false, 'Sticky fixed slots avoid remounts when staying near same school');
    for (const [hallId, prevSlot] of slotMapBefore.entries()) {
      assert.equal(desktopPool.slots[prevSlot].hall?.id, hallId);
    }

    // 3. Travel to Thar Si School -> recycles the exact same fixed slot array (capacity never grows!)
    const r2 = desktopPool.rebalance(THARSI_SCHOOL_COMPOUND.x, THARSI_SCHOOL_COMPOUND.z, ['tharsi']);
    assert.equal(r2.changed, true);
    assert.equal(r2.activeCount, 3);
    assert.equal(desktopPool.slots.length, SCHOOL_HALL_POOL_DESKTOP, 'Fixed desktop slot array length never grows');

    // 4. Travel to largest campus (Htauk Kyant BEHS, 6 halls) on BOTH desktop & mobile pools -> all 6 fit cleanly!
    const hkMain = WALKIN_SCHOOL_HALLS.find(h => h.id === 'hk-landmark-school-main')!;
    const rMobile = mobilePool.rebalance(hkMain.x, hkMain.z, ['htaukkyant']);
    assert.equal(rMobile.activeCount, 6, 'Mobile fixed pool (8 slots) covers all 6 halls of largest campus');
    assert.equal(mobilePool.slots.length, SCHOOL_HALL_POOL_MOBILE);

    // 5. Verify StreamedWorld mounts <PooledSchoolHalls> centrally and village components do NOT duplicate <SchoolClassroomHall>
    const streamedWorldSrc = readFileSync('src/components/StreamedWorld.tsx', 'utf8');
    assert.ok(streamedWorldSrc.includes('<PooledSchoolHalls'), 'StreamedWorld mounts unified PooledSchoolHalls');
    for (const file of [
      'src/components/SchoolCampusView.tsx',
      'src/components/villages/htaukkyant/index.tsx',
      'src/components/villages/htomar/index.tsx',
      'src/components/villages/kyarinn/index.tsx',
      'src/components/villages/natmyaung/NatmyaungBuilding.tsx',
    ]) {
      const src = readFileSync(file, 'utf8');
      assert.equal(
        src.includes('<SchoolClassroomHall'),
        false,
        `${file} must not duplicate <SchoolClassroomHall> outside Fixed Object Pool`,
      );
    }
  } finally {
    desktopPool.dispose();
    mobilePool.dispose();
  }
});
