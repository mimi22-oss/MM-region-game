import test from 'node:test';
import assert from 'node:assert/strict';
import {HorrorAnimationSync,GhostHorrorAudio,HORROR_PRESETS} from '../src/game/ghostAudio.ts';
import {GameAudioRuntime} from '../src/game/gameAudio.ts';
test('all horror presets remain silent and safe before gesture/context creation',()=>{
 const engine=new GhostHorrorAudio();for(const preset of HORROR_PRESETS)engine.play(preset);
 assert.equal(HORROR_PRESETS.length,22);assert.equal(engine.diagnostics.contextState,'locked');assert.equal(engine.diagnostics.voices,0);engine.dispose();
 const runtime=new GameAudioRuntime();runtime.setLevels({master:NaN,ghost:Infinity,ambience:-1});assert.equal(runtime.context,null);
});
test('animation starts, contact phases, and stride phase crossings emit once, without timer catch-up',()=>{
 const sync=new HorrorAnimationSync(),events:string[]=[];
 const frame={state:'SCARING',clip:'freaky',clipTime:0,clipDuration:1,moving:false,grabPhase:'none',visible:true};
 const step=()=>sync.step(frame,p=>events.push(p));step();step();assert.deepEqual(events,['ghost_scream']);
 frame.clip='laugh_01';step();step();assert.equal(events.at(-1),'ghost_evil_laugh');
 frame.state='FLEEING';frame.clip='flee_01';frame.moving=true;frame.clipDuration=2;step();
 frame.clipTime=.6;step();step();assert.equal(events.filter(e=>e==='ghost_footsteps').length,1);
 frame.clipTime=1.9;step();assert.equal(events.filter(e=>e==='ghost_footsteps').length,2);
 frame.clipTime=.1;step();assert.equal(events.filter(e=>e==='ghost_footsteps').length,3);
 frame.grabPhase='neck-grab';step();step();assert.equal(events.filter(e=>e==='ghost_grab').length,1);assert.ok(events.includes('player_struggle'));
 frame.grabPhase='player-fall';step();assert.equal(events.at(-1),'player_fall');
 frame.state='DESPAWNING';step();assert.ok(events.includes('ghost_disappear'));
});

test('home retreat and fade audio fire once per state, without duplicate fade cues',()=>{
 const sync=new HorrorAnimationSync(),events:string[]=[];
 const frame={state:'RETREAT',clip:'depressed',clipTime:0,clipDuration:2,moving:false,grabPhase:'none',visible:true};
 for(let i=0;i<10;i++)sync.step(frame,p=>events.push(p));
 assert.deepEqual(events,['ghost_hesitation','ghost_low_laugh']);
 frame.state='FADE_OUT';for(let i=0;i<10;i++)sync.step(frame,p=>events.push(p));
 assert.deepEqual(events.slice(2),['ghost_retreat_whoosh','ghost_fade_ambient']);
});
