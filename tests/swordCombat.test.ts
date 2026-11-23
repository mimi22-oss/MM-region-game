import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AnimationClip,AnimationMixer,Group,Quaternion,QuaternionKeyframeTrack,Raycaster,Sprite,SpriteMaterial,Vector3,PropertyBinding} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createCameraObstructionQuery} from '../src/game/cameraObstruction.ts';
import {CombatController,HEAVY_SLASH_LANDING_NORMALIZED} from '../src/game/combat/CombatController.ts';
import {CombatAnimationDriver} from '../src/game/combat/CombatAnimationDriver.ts';
import {ATTACKS,COMBAT_CLIPS,COMBO} from '../src/game/combat/AttackDefinitions.ts';
import {SwordHitDetection} from '../src/game/combat/SwordHitDetection.ts';
import {GHOST_REACTION_DELAY_MAX_SEC,GHOST_REACTION_DELAY_MIN_SEC,GuardMeleeController,sampleGhostReactionDelay} from '../src/game/combat/GuardMeleeController.ts';
import {getGhostKnockbackDistance,isPlayerKnockbackActive,isPlayerKnockbackCameraActive,resetPlayerKnockback,stepPlayerKnockback,stepPlayerKnockbackCamera,triggerPlayerKnockback} from '../src/game/combat/playerKnockback.ts';
import {getMotion} from '../src/animation/core/MotionRegistry.ts';
import {requestGhostReaction,ghostCombatReaction,finishGhostReaction,setGhostCombatEngaged,ghostCombatMovementLocked,clearGhostCombatReaction} from '../src/game/combat/GhostCombatReactions.ts';
import {playerCombat,registerCombatWeapon,registerCombatTarget,sampleCombatBlade,combatEffects,REQUIRE_GHOST_GROUP_SHIELD} from '../src/game/combat/combatRuntime.ts';
import {registerGhostRuntime} from '../src/game/missions/ghostRuntimeRegistry.ts';
import {GHOST_IDS,markGhostEncounter,collectGhostSword,getThreeGhostsProgress,damageMissionGhost} from '../src/game/missions/threeGhostsMission.ts';

function ready(){const state=new CombatController();state.capable=true;state.context(true,true);return state;}
function synthetic(){
 const root=new Group(),bone=new Group();bone.name='hand';root.add(bone);
 const clips=COMBAT_CLIPS.map(name=>new AnimationClip(name,.6,[new QuaternionKeyframeTrack('hand.quaternion',[0,.3,.6],[0,0,0,1,0,.7,0,.7141428,0,0,0,1])]));
 const state=new CombatController(),mixer=new AnimationMixer(root);state.context(true,true);
 const samples:{phase:string;seq:number;time:number}[]=[];
 const driver=new CombatAnimationDriver(mixer,root,clips,state,active=>{if(active)samples.push({phase:state.phase,seq:state.sequence,time:driver.actionTime});});
 return {root,state,mixer,driver,samples};
}
test('buffered six-hit combo advances once in its window; timeout, early input and recovery are enforced',()=>{
 const comboList: readonly string[] = COMBO;
 assert.equal(comboList.includes('Heavy_Slash'),false,'Slash button combo must not include Heavy_Slash');
 assert.equal(comboList.includes('Slash_Overhead'),false,'Slash button combo must not share Heavy_Slash overhead move');
 assert.equal(comboList.includes('Jump_Slash'),false,'Slash button combo must not share Heavy_Slash jump move');
 const s=ready();assert.equal(s.request('combo'),true);assert.equal(s.clip,COMBO[0]);assert.equal(s.request('combo'),false);
 for(let i=0;i<COMBO.length-1;i++){
  s.sample(.6);assert.equal(s.request('combo'),true);assert.equal(s.request('combo'),false);
  s.finish(s.sequence);assert.equal(s.clip,COMBO[i+1]);assert.equal(s.phase,'STARTUP');
 }
 s.finish(s.sequence);assert.equal(s.actionActive,false);assert.equal(s.movementLocked,false);
 s.idleStep(.71);s.request('combo');assert.equal(s.clip,'Slash_Left');
 s.sample(.99);assert.equal(s.request('combo'),false);

 // Heavy_Slash must stay silent at start/windup and fire ground-slam cue ONCE at landing!
 const hs=ready();
 let startCalls=0,heavyImpactCalls=0;
 hs.onAttackStart=()=>{startCalls++;};
 hs.onHeavySlashImpact=()=>{heavyImpactCalls++;};
 assert.equal(hs.request('Heavy_Slash'),true);
 assert.equal(startCalls,0,'Heavy_Slash must NOT play slash audio at animation start');
 hs.sample(0.2);hs.sample(0.45);
 assert.equal(heavyImpactCalls,0,'Heavy_Slash must stay silent during leap/windup before ground landing');
 hs.sample(HEAVY_SLASH_LANDING_NORMALIZED);
 assert.equal(heavyImpactCalls,1,'Heavy_Slash plays ground impact audio right upon landing');
 hs.sample(0.65);hs.sample(0.9);
 assert.equal(heavyImpactCalls,1,'Heavy_Slash ground impact audio fires exactly once per swing');
});
test('death, incapacitation, pause and unequip suppress attacks; defensive windows are bounded',()=>{
 const s=ready();s.request('Sword_Parry');s.sample(.3);assert.equal(s.defend(),'parry');s.sample(.9);assert.equal(s.defend(),'none');
 s.context(true,false);assert.equal(s.actionActive,false);assert.equal(s.request('combo'),false);
 s.context(true,true,true);assert.equal(s.request('combo'),false);
 s.context(true,true,false,true);assert.equal(s.phase,'DEAD');assert.equal(s.request('combo'),false);
 s.context(false,true);assert.equal(s.request('combo'),false);
 s.context(true,true);assert.equal(s.interrupt('Knockback'),true);assert.equal(s.phase,'KNOCKBACK');
});
test('one mixer finishes actions, never restarts on renders, and samples only active clip time at 15/30/60Hz',()=>{
 const counts=[];
 for(const hz of [15,30,60]){
  const {state,mixer,driver,samples}=synthetic();state.request('combo');
  const seq=state.sequence;for(let i=0;i<hz;i++)driver.update(1/hz);
  assert.equal(state.sequence,seq);assert.equal(state.actionActive,false);assert.equal(driver.currentClip,'Combat_Idle');
  assert.ok(samples.length>0);assert.ok(samples.every(s=>s.phase==='ACTIVE'&&s.time>=.6*ATTACKS.Slash_Left!.activeStart-1e-6&&s.time<=.6*ATTACKS.Slash_Left!.activeEnd+1e-6));
  counts.push(samples.length);driver.dispose();
  assert.equal((mixer as unknown as {_listeners:{finished?:unknown[]}})._listeners.finished?.length??0,0);
 }
 assert.ok(Math.max(...counts)-Math.min(...counts)<=1,JSON.stringify(counts));
});
test('replacement animation owners and cleanup cannot disable a new character driver',()=>{
 const {state,mixer,root,driver}=synthetic();
 const clips=COMBAT_CLIPS.map(n=>new AnimationClip(n,1,[]));
 const replacement=new CombatAnimationDriver(mixer,root,clips,state);driver.dispose();
 assert.equal(state.capable,true);assert.equal(state.request('combo'),true);replacement.dispose();assert.equal(state.capable,false);
});
test('swept blade hits across a frame and misses remote/behind volumes, including point segments',()=>{
 const d=new SwordHitDetection(),a=new Vector3(0,.3,0),b=new Vector3(0,1.7,0);
 assert.equal(d.sweptBlade(new Vector3(-1,.7,0),new Vector3(-1,1.2,0),new Vector3(1,.7,0),new Vector3(1,1.2,0),a,b,.2),true);
 assert.equal(d.sweptBlade(new Vector3(2,.7,0),new Vector3(2,1.2,0),new Vector3(3,.7,0),new Vector3(3,1.2,0),a,b,.2),false);
 assert.equal(d.segmentDistanceSq(new Vector3(-1,0,0),new Vector3(1,0,0),new Vector3(),new Vector3()),0);
});
test('guard contact follows animation marker; protection, parry and invalid contact preempt death',()=>{
 const g=new GuardMeleeController(.1,.2),input={dt:.05,valid:true,protected:false,distance:1,attackNormalized:0,defence:'none' as const,x:1,z:1};
 g.step(input);assert.equal(g.started,true);assert.equal(g.interaction.active,false);
 for(let i=0;i<20;i++)g.step(input);assert.equal(g.interaction.active,false);
 g.step({...input,attackNormalized:.5});assert.equal(g.interaction.phase,'neck-grab');
 g.step({...input,protected:true});assert.equal(g.interaction.active,false);assert.equal(g.killed,false);
 const parry=new GuardMeleeController();parry.step(input);parry.step({...input,attackNormalized:.5,defence:'parry'});assert.equal(parry.parried,true);assert.equal(parry.interaction.active,false);
 const caught=new GuardMeleeController(.1,.2);caught.step(input);caught.step({...input,attackNormalized:.5});
 let killed=0;for(let i=0;i<10;i++){caught.step(input);if(caught.killed)killed++;}assert.equal(killed,1);
 // Sword-equipped player: ghost waits random 1-3s before reacting/striking, never instant-grabs, and lands 1-Heart hit (like Zombie)
 assert.equal(GHOST_REACTION_DELAY_MIN_SEC,1.0);
 assert.equal(GHOST_REACTION_DELAY_MAX_SEC,3.0);
 assert.equal(sampleGhostReactionDelay(()=>0),1.0);
 assert.equal(sampleGhostReactionDelay(()=>1),3.0);
 const duel=new GuardMeleeController();
 // Approaches at 1.35m -> enters wait (1-3s random delay), does NOT immediately swing or grab!
 duel.step({...input,dt:0.05,distance:1.35,swordEquipped:true,rng:()=>0});
 assert.equal(duel.waiting,true,'Ghost should enter 1-3s wait delay before reacting');
 assert.equal(duel.started,false,'Ghost must not immediately attack upon closing distance');
 assert.equal(duel.interaction.active,false,'Ghost must not instant-grab sword player');
 // Advance 0.7s (< 1.0s min delay): still waiting so player has time to slash!
 for(let i=0;i<7;i++)duel.step({...input,dt:0.1,distance:1.35,swordEquipped:true,rng:()=>0});
 assert.equal(duel.started,false,'Ghost must still wait before 1s elapsed');
 // Advance past 1.0s: ghost now starts attack windup
 for(let i=0;i<6;i++){duel.step({...input,dt:0.1,distance:1.35,swordEquipped:true,rng:()=>0});if(duel.started)break;}
 assert.equal(duel.started,true,'Ghost swings after 1-3s random hesitation delay');
 // If player slashes during ghost windup, ghost resets into another 1-3s wait
 duel.step({...input,dt:0.05,distance:1.35,swordEquipped:true,playerAttacking:true,rng:()=>0});
 assert.equal(duel.waiting,true,'Slashing during windup resets ghost into 1-3s wait');
 // Advance past 1.0s again so ghost starts a fresh windup
 for(let i=0;i<12;i++){duel.step({...input,dt:0.1,distance:1.35,swordEquipped:true,rng:()=>0});if(duel.started)break;}
 assert.equal(duel.started,true,'Ghost swings again after 1-3s clash delay');
 // Strike connects at normalized >= 0.5: sets hitLanded=true (-1 Heart like Zombie), NOT instant grab/kill!
 duel.step({...input,dt:0.05,distance:1.35,swordEquipped:true,attackNormalized:0.55,rng:()=>0.5});
 assert.equal(duel.hitLanded,true,'Ghost sword-duel strike must emit hitLanded (-1 Heart like Zombie)');
 assert.equal(duel.killed,false,'Single ghost strike must not insta-kill player');
 assert.equal(duel.interaction.active,false,'Ghost sword-duel strike must not lock player in neck-grab');
 assert.equal(duel.waiting,true,'Ghost enters next 1-3s random wait after striking');
 // Camera obstruction raycast must safely ignore floating Sprites even when ray.camera is unset
 const camScene=new Group();
 const sprite=new Sprite(new SpriteMaterial());
 sprite.position.set(0,1,-2);
 camScene.add(sprite);
 const query=createCameraObstructionQuery();
 const ray=new Raycaster(new Vector3(0,1,0),new Vector3(0,0,-1));
 assert.doesNotThrow(()=>query(ray,camScene,null,false,null),'cameraObstruction must never throw on Sprite when ray.camera is unset');

 // Ghost strike knockback: ghost-1 = 4.0m, ghost-2 = 6.0m, ghost-3 = 10.0m with airborne arc & cinematic drone view
 assert.equal(getMotion('flying-back-away')?.assetUrl,'/motions/movement/flying-back-away.glb');
 for(const [gid,expectedDist] of [['ghost-1',4.0],['ghost-2',6.0],['ghost-3',10.0]] as const){
  resetPlayerKnockback();
  assert.equal(getGhostKnockbackDistance(gid),expectedDist);
  const pos={x:10,z:12};
  triggerPlayerKnockback({ghostId:gid,ghostX:10,ghostZ:10,playerX:pos.x,playerZ:pos.z,cameraX:14,cameraZ:13});
  assert.equal(isPlayerKnockbackActive(),true);
  assert.equal(isPlayerKnockbackCameraActive(),true);
  let maxLift=0;
  let maxDroneElevation=0;
  let maxFovBoost=0;
  for(let i=0;i<30;i++){
   const step=stepPlayerKnockback(0.05,pos,()=>true);
   maxLift=Math.max(maxLift,step.liftY);
   const cam=stepPlayerKnockbackCamera(0.05,pos.x,0,pos.z);
   if(cam){
    maxDroneElevation=Math.max(maxDroneElevation,cam.camY);
    maxFovBoost=Math.max(maxFovBoost,cam.fovBoostDeg);
   }
  }
  assert.equal(isPlayerKnockbackActive(),false);
  assert.ok(Math.abs((pos.z-12)-expectedDist)<0.05,`${gid} should knock player back ${expectedDist}m, got ${(pos.z-12).toFixed(3)}m`);
  assert.ok(maxLift>=0.5,`${gid} knockback should launch player visibly airborne (got ${maxLift.toFixed(2)}m)`);
  assert.ok(maxDroneElevation>=3.0,`${gid} drone camera should elevate above ground (got ${maxDroneElevation.toFixed(2)}m)`);
  assert.ok(maxFovBoost>=4.0,`${gid} drone camera should apply dynamic FOV boost (got ${maxFovBoost.toFixed(2)}deg)`);
  // Advance remaining hold + return duration so drone camera finishes cleanly
  for(let i=0;i<40;i++)stepPlayerKnockbackCamera(0.05,pos.x,0,pos.z);
  assert.equal(isPlayerKnockbackCameraActive(),false,`${gid} drone camera should return smoothly to normal camera`);
 }
 // Fatal death keeps knockback drone orbiting smoothly for the full 5s pre-Game-Over window
 resetPlayerKnockback();
 triggerPlayerKnockback({ghostId:'ghost-3',ghostX:10,ghostZ:10,playerX:10,playerZ:12,cameraX:14,cameraZ:13});
 let fatalPose=null;
 for(let i=0;i<100;i++)fatalPose=stepPlayerKnockbackCamera(0.05,10,0,22,{fatalHold:true});
 assert.ok(fatalPose&&isPlayerKnockbackCameraActive(),'Fatal death drone view stays active across full 5.0s showcase before Game Over');
 resetPlayerKnockback();
});
test('ghost reaction and engagement state stays independent; stale completion cannot clear a newer stun',()=>{
 const seq=requestGhostReaction('test-1','Ghost_Hit');requestGhostReaction('test-2','Ghost_Attack');
 setGhostCombatEngaged('test-2',true);requestGhostReaction('test-1','Ghost_Death');finishGhostReaction('test-1',seq);
 assert.equal(ghostCombatReaction('test-1')?.stunned,true);assert.equal(ghostCombatMovementLocked('test-2'),true);
 clearGhostCombatReaction('test-1');assert.ok(ghostCombatReaction('test-2'));clearGhostCombatReaction('test-2');
});

test('real damage resolver requires active blade contact, facing and group clearance; hits once, emits impacts and death',()=>{
 GHOST_IDS.forEach(markGhostEncounter);collectGhostSword();
 playerCombat.capable=true;playerCombat.context(true,true);playerCombat.cancel();
 const avatar=new Group(),weapon=new Group(),base=new Group(),tip=new Group(),ghost=new Group();
 avatar.position.set(124.45,0,-33.94);weapon.position.set(124.45,0,-34.94);ghost.position.copy(weapon.position);
 base.name='sword-blade-base';tip.name='sword-blade-tip';base.position.y=.5;tip.position.y=1.2;weapon.add(base,tip);
 const releaseWeapon=registerCombatWeapon(weapon,avatar),releaseTarget=registerCombatTarget('ghost-1',{root:ghost,height:1.8,radius:.3});
 const runtime=registerGhostRuntime('ghost-1');runtime.report(ghost.position.x,ghost.position.z,true,'wait');
 const hp=()=>getThreeGhostsProgress().hp['ghost-1'];
 playerCombat.request('combo');const initial=hp();sampleCombatBlade(true);assert.equal(hp(),initial,'startup cannot damage even if caller passes active');
 playerCombat.sample(.4);sampleCombatBlade(true);assert.equal(hp(),initial-10);
 const lastPopup=combatEffects.damagePopups[(combatEffects.damagePopupHead-1+combatEffects.damagePopups.length)%combatEffects.damagePopups.length];
 assert.equal(lastPopup.text,'-10 HP','Sword hit must emit floating -10 HP damage popup');
 const impacts=combatEffects.impactHead;for(let i=0;i<20;i++)sampleCombatBlade(true);
 assert.equal(hp(),initial-10);assert.equal(combatEffects.impactHead,impacts);
 playerCombat.finish(playerCombat.sequence);playerCombat.request('combo');playerCombat.sample(.4);
 const other=registerGhostRuntime('ghost-2');other.report(avatar.position.x+5,avatar.position.z,true,'wait');sampleCombatBlade(true);
 assert.equal(hp(),REQUIRE_GHOST_GROUP_SHIELD?initial-10:initial-20,REQUIRE_GHOST_GROUP_SHIELD?'group shield blocks':'sword hits even when 2+ ghosts are nearby while group shield is disabled');
 other.release();
 playerCombat.finish(playerCombat.sequence);playerCombat.request('combo');playerCombat.sample(.4);
 const hpAfterSecond=hp();
 ghost.position.z=avatar.position.z+1;weapon.position.z=ghost.position.z;sampleCombatBlade(true);assert.equal(hp(),hpAfterSecond,'behind-facing overlap misses');
 ghost.position.z=avatar.position.z-1;weapon.position.z=ghost.position.z;weapon.position.x+=4;sampleCombatBlade(true);assert.equal(hp(),hpAfterSecond,'actual blade miss');
 weapon.position.x=ghost.position.x;damageMissionGhost('ghost-1',hp()-10);sampleCombatBlade(true);
 assert.equal(hp(),0);assert.equal(ghostCombatReaction('ghost-1')?.clip,'Ghost_Death');
 const deathSeq=ghostCombatReaction('ghost-1')?.seq;sampleCombatBlade(true);assert.equal(ghostCombatReaction('ghost-1')?.seq,deathSeq);
 releaseWeapon();releaseTarget();runtime.release();playerCombat.context(false,false);
});

function strippedGlb(path:string){
 const bytes=readFileSync(path),length=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+length).toString());
 delete j.images;delete j.textures;delete j.materials;for(const mesh of j.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 const json=Buffer.from(JSON.stringify(j)),pad=(4-json.length%4)%4,body=Buffer.concat([json,Buffer.alloc(pad,32)]),bin=bytes.subarray(20+length);
 const out=Buffer.alloc(20+body.length+bin.length);bytes.copy(out,0,0,12);out.writeUInt32LE(out.length,8);out.writeUInt32LE(body.length,12);out.writeUInt32LE(0x4e4f534a,16);body.copy(out,20);bin.copy(out,20+body.length);
 return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength);
}
test('all supplied GLBs load: counts, bindings, finite transforms and every exact combat clip playback',async()=>{
 for(const [id,count] of [['boy',23],['girl',23],['canolia-character',32],['ghost-woman',4]] as const){
  const ghost=id==='ghost-woman',file=ghost?'public/models/enemies/ghost-woman-combat-animated.glb':`public/models/characters/${id}-combat-animated.glb`;
  const model=await new GLTFLoader().parseAsync(strippedGlb(file),'');assert.equal(model.animations.length,count+(ghost?0:8),id);
  const mixer=new AnimationMixer(model.scene);
  for(const clip of model.animations){
   assert.ok(clip.duration>0);
   for(const track of clip.tracks){const binding=PropertyBinding.parseTrackName(track.name);assert.ok(PropertyBinding.findNode(model.scene,binding.nodeName),`${id}:${track.name}`);}
   const action=mixer.clipAction(clip).reset().play();mixer.update(clip.duration*.5);
   model.scene.traverse(o=>assert.ok(Number.isFinite(o.quaternion.lengthSq()),`${id}:${clip.name}`));action.stop();
  }
  mixer.stopAllAction();mixer.uncacheRoot(model.scene);
 }
});
import {Box3} from 'three';
import {fitSwordClips,combatGrip,twoHanded} from '../src/game/combat/SwordPose.ts';

test('production rigs place the support palm on the pommel for two-hand cuts and release it for horizontal cuts',async(t)=>{
 for(const id of ['boy','girl','canolia-character']){
  const model=await new GLTFLoader().parseAsync(strippedGlb('public/models/characters/'+id+'-combat-animated.glb'),'');
  const root=model.scene;
  if(id!=='canolia-character')root.scale.multiplyScalar(1.8/new Box3().setFromObject(root).getSize(new Vector3()).y);
  root.rotation.y=Math.PI;
  const clips=fitSwordClips(root,model.animations);
  const right=root.getObjectByName('mixamorigRightHand')??root.getObjectByName('Hand_R')!;
  const left=root.getObjectByName('mixamorigLeftHand')??root.getObjectByName('Hand_L')!;
  const knuckle=left.getObjectByName('mixamorigLeftHandMiddle1');
  const palm=knuckle?left.worldToLocal(knuckle.getWorldPosition(new Vector3())).multiplyScalar(.62):new Vector3();
  const grip=combatGrip(right)!;
  const weapon=new Group();right.add(weapon);
  weapon.position.copy(grip.position);weapon.quaternion.copy(grip.rotation);weapon.scale.set(1,1,1).divide(right.getWorldScale(new Vector3()));
  const mixer=new AnimationMixer(root);
  let worstGrip=0,closestFreeHand=Infinity;
  const hips=root.getObjectByName('mixamorigHips')??root.getObjectByName('Hips')!;
  const ankle=root.getObjectByName('mixamorigLeftFoot')??root.getObjectByName('Foot_L')!;
  const ankleR=root.getObjectByName('mixamorigRightFoot')??root.getObjectByName('Foot_R')!;
  root.updateWorldMatrix(true,true);
  const restFootLY=ankle.getWorldPosition(new Vector3()).y;
  const restFootRY=ankleR.getWorldPosition(new Vector3()).y;
  for(const clip of clips.filter(c=>['Sword_Walk','Sword_Run','Combat_Strafe_Left','Combat_Strafe_Right','Dodge_Left','Dodge_Right','Hit_React','Knockback'].includes(c.name))){
   const action=mixer.clipAction(clip).reset().play();
   let maxLiftL=-Infinity,maxLiftR=-Infinity,maxBothLift=-Infinity,minLZ=Infinity,maxLZ=-Infinity,minRZ=Infinity,maxRZ=-Infinity;
   for(let i=0;i<=12;i++){
    action.time=clip.duration*(i/12);mixer.update(0);root.updateWorldMatrix(true,true);
    const lPos=ankle.getWorldPosition(new Vector3()),rPos=ankleR.getWorldPosition(new Vector3());
    const liftL=lPos.y-restFootLY,liftR=rPos.y-restFootRY;
    maxLiftL=Math.max(maxLiftL,liftL);maxLiftR=Math.max(maxLiftR,liftR);
    maxBothLift=Math.max(maxBothLift,Math.min(liftL,liftR));
    minLZ=Math.min(minLZ,lPos.z);maxLZ=Math.max(maxLZ,lPos.z);
    minRZ=Math.min(minRZ,rPos.z);maxRZ=Math.max(maxRZ,rPos.z);
   }
   assert.ok(maxLiftL<.12&&maxLiftR<.12,`${id} ${clip.name} keeps feet grounded (liftL=${maxLiftL}, liftR=${maxLiftR})`);
   assert.ok(maxBothLift<.03,`${id} ${clip.name} never lifts both legs into the air (bothLift=${maxBothLift})`);
   if(clip.name==='Sword_Walk'||clip.name==='Sword_Run'){
    assert.ok(maxLZ-minLZ>.18&&maxRZ-minRZ>.18,`${id} ${clip.name} alternates full walking stride`);
   }
   action.stop();
  }
  for(const clip of clips.filter(c=>twoHanded(c.name)||['Slash_Left','Slash_Right','Slash_Rising'].includes(c.name))){
   const action=mixer.clipAction(clip).play();
   let maxGap=0,minGap=Infinity;
   const tips:Vector3[]=[],ankles:Vector3[]=[];
   const restHip=hips.getWorldPosition(new Vector3());
   const def=ATTACKS[clip.name as keyof typeof ATTACKS];
   for(let i=0;i<=12;i++){
    const start=def?.activeStart??.24,end=def?.activeEnd??.72;
    action.time=clip.duration*(start+(end-start)*i/12);mixer.update(0);
    const gap=left.localToWorld(palm.clone()).distanceTo(weapon.localToWorld(new Vector3(0,.095,-.015)));
    maxGap=Math.max(maxGap,gap);minGap=Math.min(minGap,gap);
    ankles.push(ankle.getWorldPosition(new Vector3()));
    tips.push(weapon.localToWorld(new Vector3(0,-.804,-.015)));
   }
   const sweep=tips.at(-1)!.sub(tips[0]);
   if(twoHanded(clip.name))worstGrip=Math.max(worstGrip,maxGap);
   else closestFreeHand=Math.min(closestFreeHand,minGap);
   if(clip.name==='Heavy_Slash'){
    assert.ok(restHip.y-hips.getWorldPosition(new Vector3()).y>.02,id+' transfers weight into heavy stance');
    assert.ok(ankles.every(p=>p.distanceTo(ankles[0])<.035),id+' keeps lead foot planted');
   }
   if(twoHanded(clip.name))assert.ok(maxGap<.045,id+' '+clip.name+' pommel gap '+maxGap);
   else assert.ok(minGap>.12,id+' '+clip.name+' unexpectedly two-handed '+minGap);
   if(clip.name==='Slash_Left')assert.ok(sweep.x>.45,id+' left-right '+sweep.x);
   if(clip.name==='Slash_Right')assert.ok(sweep.x<-.45,id+' right-left '+sweep.x);
   if(clip.name==='Slash_Overhead')assert.ok(sweep.y<-.5,id+' overhead '+sweep.y);
   if(clip.name==='Slash_Rising')assert.ok(sweep.y>.5,id+' rising '+sweep.y);
   action.stop();
  }
  t.diagnostic(id+' max two-hand gap '+(100*worstGrip).toFixed(2)+' cm; minimum free-hand clearance '+(100*closestFreeHand).toFixed(2)+' cm');
  mixer.uncacheRoot(root);
 }
});


test('FBX sword clips own the mixer pose on all player rigs and retain full-body keyframes',async()=>{
 for(const id of ['boy','girl','canolia-character']){
  const model=await new GLTFLoader().parseAsync(strippedGlb('public/models/characters/'+id+'-combat-animated.glb'),'');
  const controller=ready(),mixer=new AnimationMixer(model.scene);
  const driver=new CombatAnimationDriver(mixer,model.scene,model.animations,controller);
  for(const name of ['Slash_Left','Slash_Right','Slash_Overhead','Heavy_Slash','Jump_Slash','Sword_Block'] as const){
   const source=model.animations.find(c=>c.name==='FBX_'+name)!;
   assert.ok(source.tracks.length>=22,id+' '+name+' must animate torso, arms and legs');
   assert.equal(controller.request(name),true);
   driver.update(.1);assert.equal(driver.usesAuthoredPose,true);
   assert.equal(driver.currentClip,name);
   assert.equal(driver.clips.get(name)!.duration,source.duration);
   assert.deepEqual(driver.clips.get(name)!.tracks[0].values,source.tracks[0].values);
   for(let i=0;i<Math.ceil(source.duration*60)+2;i++)driver.update(1/60);
   assert.equal(controller.actionActive,false,id+' '+name+' completes');
  }
  controller.speed=0;driver.update(.1);
  assert.equal(driver.currentClip,'Combat_Idle');assert.equal(driver.usesAuthoredPose,true);
  controller.speed=2;driver.update(.1);
  assert.equal(driver.currentClip,'Sword_Walk');assert.equal(driver.usesAuthoredPose,true);
  driver.dispose();
 }
});
