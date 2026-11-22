import assert from 'node:assert/strict';
import test from 'node:test';
import { toWorld } from '../src/data/ward.ts';
import { canStand } from '../src/game/collision.ts';
import { MAP_DESTINATIONS, detectLocation } from '../src/game/locationDetect.ts';
import {
  WALKIN_SCHOOL_HALLS,
  clearClassroomNotice,
  computeClassroomLayout,
  getClassroomNoticeSnapshot,
  notifyBlockedClassroomAt,
  setSchoolClassInSession,
} from '../src/game/schoolClassrooms.ts';

test('Background NPC/world canStand queries near locked school classrooms NEVER fire the classroom alert toast', () => {
  const hkMain =
    WALKIN_SCHOOL_HALLS.find((h) => h.regionId === 'htaukkyant') ?? WALKIN_SCHOOL_HALLS[0];
  assert.ok(hkMain, 'Htaukkyant school hall exists');
  const layout = computeClassroomLayout(hkMain);
  const room = layout.classrooms[0];
  const c = Math.cos(layout.canonicalRotation);
  const s = Math.sin(layout.canonicalRotation);
  const doorwayX = hkMain.x + room.doorX * c + layout.zFrontWall * s;
  const doorwayZ = hkMain.z - room.doorX * s + layout.zFrontWall * c;

  try {
    clearClassroomNotice();
    setSchoolClassInSession(true);

    // Background collision check (e.g., NPCs/bots/cars/wildlife calling canStand) blocks entry silently
    assert.equal(canStand(doorwayX, doorwayZ), false);
    assert.equal(
      getClassroomNoticeSnapshot(),
      null,
      'Global canStand() must NOT emit classroom alert toasts when player is elsewhere',
    );

    // Explicit player-only attempt right at the locked classroom doorway DOES emit the alert with hall coordinates
    assert.equal(notifyBlockedClassroomAt(doorwayX, doorwayZ), true);
    const notice = getClassroomNoticeSnapshot();
    assert.ok(notice, 'Player trying to enter locked classroom gets the notice');
    assert.equal(notice!.hallId, hkMain.id);
    assert.equal(notice!.hallX, hkMain.x);
    assert.equal(notice!.hallZ, hkMain.z);
    assert.ok(notice!.message.includes('စာသင်နေပါသည်'));
  } finally {
    setSchoolClassInSession(false);
    clearClassroomNotice();
  }
});

test('Mountain regions NEVER trigger valley village/ward location alerts (Htaukkyant, Natmyaung, Tharsi, etc.)', () => {
  const forbiddenValleyIds = new Set([
    'myothar-area-5',
    'myothar-center',
    'tharsi',
    'chinsai',
    'zingalin',
    'htomar',
    'tharyargone',
    'htaukkyant',
    'kyarinn',
    'kyarinn-lake',
    'sithar',
    'natmyaung',
    'kanbale',
  ]);

  const mountainSampleUVs: Array<[number, number, string]> = [
    [-580, 260, 'Taungphila summit plateau'],
    [-1000, 350, 'Western Highland north mesa'],
    [-1000, 850, 'Western Highland west of Tharsi'],
    [-1000, 1200, 'Western Highland west of Chinsai'],
    [-1000, 1500, 'Western Highland west of Zingalin'],
    [-1000, 2000, 'Western Highland west of Htomar'],
    [-1000, 2650, 'Western Highland west of Tharyargone'],
    [-1000, 3250, 'Western Highland west of Htaukkyant'],
    [-1000, 3900, 'Western Highland west of Kyarinn'],
    [-1000, 4250, 'Western Highland west of Natmyaung'],
    [-1560, 5200, 'Maha Weipula mid slope'],
    [-1560, 6100, 'Maha Weipula summit'],
    [1100, 5300, 'East Chin mountain range'],
  ];

  for (const [u, v, label] of mountainSampleUVs) {
    const w = toWorld(u, v);
    const loc = detectLocation(w.x, w.z);
    assert.equal(
      forbiddenValleyIds.has(loc.id),
      false,
      `${label} (u=${u}, v=${v}) must NOT report valley village "${loc.id}"`,
    );
  }

  // Every official village/ward/landmark destination still resolves accurately!
  for (const dest of MAP_DESTINATIONS) {
    const loc = detectLocation(dest.x, dest.z);
    assert.equal(loc.id, dest.id, `Destination ${dest.id} resolves cleanly to itself`);
  }
});
