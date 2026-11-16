import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  CatBehaviorController,
  clampToCompound,
  isInsideHouse,
  YARD_BOUNDS,
  HOUSE_BOUNDS,
  CAT_SPOTS,
  localToWorld,
  worldToLocal,
} from '../src/game/cat/catBehavior.ts';
import { playCatMeow, startCatPurr, stopCatPurr } from '../src/game/cat/catAudio.ts';
import { homeAccess } from '../src/game/homeAccess.ts';

const ROOT = process.cwd();

test('Cat Companion GLB: public/models/cat_animated_all.glb contains all 14 animation clips and valid glTF structure', () => {
  const glbPath = path.join(ROOT, 'public/models/cat_animated_all.glb');
  assert.ok(fs.existsSync(glbPath), 'cat_animated_all.glb must exist in public/models');

  const buf = fs.readFileSync(glbPath);
  const magic = buf.readUInt32LE(0);
  assert.equal(magic, 0x46546c67, 'Valid glTF magic');

  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));

  const clipNames = json.animations.map((a: { name: string }) => a.name);
  const requiredClips = [
    'Idle',
    'Walk',
    'Run',
    'Sit',
    'SitLookUp',
    'Stretch',
    'Rub',
    'Petting',
    'Groom',
    'Play',
    'Eat',
    'LieDown',
    'Sleep',
    'WakeUp',
  ];

  for (const req of requiredClips) {
    assert.ok(clipNames.includes(req), `Clip ${req} must be present in cat GLB`);
  }
});

test('Cat Behavior: starts sleeping inside house on cozy rug', () => {
  const cat = new CatBehaviorController('friendly');
  assert.equal(cat.state, 'SLEEPING');
  assert.ok(isInsideHouse(cat.lx, cat.lz), 'Initial position must be inside the house');
  assert.equal(cat.lx, CAT_SPOTS.livingRoomRug.lx);
  assert.equal(cat.lz, CAT_SPOTS.livingRoomRug.lz);
});

test('Cat Behavior: strict compound boundary enforcement — never escapes outside yard', () => {
  const cat = new CatBehaviorController('curious');

  // Attempt to target beyond front gate into the street (lz = 15.0)
  cat.lx = 0;
  cat.lz = 6.0;
  cat.targetLx = 0;
  cat.targetLz = 15.0; // street outside

  // Simulate multiple movement ticks
  for (let i = 0; i < 60; i++) {
    cat.update(0.1, 0, 20); // Player is out in the street
  }

  assert.ok(cat.lz <= YARD_BOUNDS.maxZ, `Cat lz (${cat.lz}) must never cross past ${YARD_BOUNDS.maxZ}`);
  assert.ok(cat.lx >= YARD_BOUNDS.minX, `Cat lx (${cat.lx}) must stay within left fence`);
  assert.ok(cat.lx <= YARD_BOUNDS.maxX, `Cat lx (${cat.lx}) must stay within right fence`);
});

test('Cat Behavior: door closed keeps cat inside house interior', () => {
  const cat = new CatBehaviorController('playful');
  cat.state = 'IDLE';
  cat.stateTimer = 0;

  // Door closed
  homeAccess.open.door = 0;

  // Simulate autonomous pick
  cat.update(0.1, 100, 100);

  // When door is closed, any picked destination must remain inside house
  assert.ok(
    isInsideHouse(cat.targetLx, cat.targetLz),
    `Target (${cat.targetLx}, ${cat.targetLz}) must stay inside house when door is closed`
  );
});

test('Cat Behavior: petting interaction activates petting state and purring', () => {
  const cat = new CatBehaviorController('friendly');
  cat.state = 'SITTING';

  // Player pets cat nearby
  const nearPlayerWorld = localToWorld(cat.lx + 0.5, cat.lz + 0.5);
  cat.isPettingActive = true;
  cat.update(0.1, nearPlayerWorld.x, nearPlayerWorld.z);

  assert.equal(cat.state, 'PETTING');
  assert.equal(cat.purring, true);

  // Player releases petting
  cat.isPettingActive = false;
  cat.update(0.1, nearPlayerWorld.x, nearPlayerWorld.z);

  assert.equal(cat.state, 'SIT_LOOK_UP');
  assert.equal(cat.purring, false);
});

test('Cat Audio: meow and purr functions operate safely in headless environment', () => {
  assert.doesNotThrow(() => {
    playCatMeow('greeting', 0.5);
    playCatMeow('curious', 0.5);
    playCatMeow('soft', 0.5);
    playCatMeow('chirp', 0.5);
    playCatMeow('purr_trill', 0.5);
    startCatPurr(0.3);
    stopCatPurr();
  });
});
