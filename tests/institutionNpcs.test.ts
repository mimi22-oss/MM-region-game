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
  isChurchServiceHours,
  isSchoolOpenHours,
} from '../src/game/institutionNpcPool.ts';
import {
  disposeSchoolBuildingAssetCache,
  getSchoolBuildingAssetCache,
} from '../src/game/schoolBuildingAssets.ts';
import {
  SCHOOL_FLOOR_Y,
  WALKIN_SCHOOL_HALLS,
  canStandWalkInSchoolHalls,
  computeClassroomLayout,
  getSchoolCampusMetrics,
} from '../src/game/schoolClassrooms.ts';

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
  assert.equal(SCHOOL_INSTITUTION_ZONES.length, 8, 'Covers all 8 schools across Kanbale, Htomar, Htauk Kyant, Kyar Inn, and Nat Myaung');

  const schoolRegions = new Set(SCHOOL_INSTITUTION_ZONES.map(z => z.regionId));
  for (const r of ['kanbale', 'htomar', 'htaukkyant', 'kyarinn', 'natmyaung']) {
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

    // Verify separated classroom interiors are populated with BOTH teachers and students!
    const insideRoomMembers = members.filter(m => m.insideClassroom);
    assert.ok(
      insideRoomMembers.length >= 25,
      `School ${sz.id} populates separated classroom interiors (got ${insideRoomMembers.length})`,
    );
    assert.ok(
      insideRoomMembers.every(m => m.worldY === SCHOOL_FLOOR_Y && Boolean(m.roomLabel)),
      `Classroom members stand on classroom floor (${SCHOOL_FLOOR_Y}m) with distinct room labels`,
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

    // 2. Evening at Kyar Inn School -> 0 school students/teachers remain visible!
    pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 1080, 'evening', true);
    const eveningSchoolCount = pool.slots.filter(s => s.member?.institutionKind === 'school').length;
    assert.equal(eveningSchoolCount, 0, 'ALL school students & teachers must be hidden in evening');

    // 3. Night at Kyar Inn School -> 0 school students/teachers remain visible!
    pool.update(kyarinnSchool.centerX, kyarinnSchool.centerZ, 0.05, ['kyarinn'], 1320, 'night', true);
    const nightSchoolCount = pool.slots.filter(s => s.member?.institutionKind === 'school').length;
    assert.equal(nightSchoolCount, 0, 'ALL school students & teachers must be hidden at night');

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
