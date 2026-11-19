import {AnimationClip, Bone, Euler, Matrix4, Object3D, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack} from 'three';
import {createLimbFitter} from '../characterRig.ts';
import {ATTACKS, COMBAT_CLIPS, type CombatClip} from './AttackDefinitions.ts';

// Blade yaw and elevation in fighter space (degrees), from chamber to follow-through.
type Stroke = readonly [number, number, number, number];
const strokes: Partial<Record<CombatClip, Stroke>> = {
  Slash_Left: [-80, 8, 84, 0], Slash_Right: [82, 7, -84, 0],
  Slash_Diagonal_Left: [-62, 65, 64, -32], Slash_Diagonal_Right: [64, 65, -62, -32],
  Slash_Overhead: [3, 104, -5, -47], Slash_Rising: [-27, -54, 24, 69],
  Slash_Middle: [72, -8, -68, -9], Sword_Thrust: [10, 3, -2, 0],
  Heavy_Slash: [26, 111, -23, -49], Spin_Slash: [-76, 16, 70, 5],
  Jump_Slash: [-13, 99, 16, -44], Combo_Finisher: [-66, 84, 63, -37],
  Sword_Block: [-33, 70, -30, 72], Sword_Parry: [-38, 58, 63, 48],
};
const combatClipSet = new Set<string>(COMBAT_CLIPS);
export function twoHanded(clip: string) {
  return ['Slash_Overhead','Heavy_Slash','Jump_Slash','Combo_Finisher','Sword_Block'].includes(clip);
}
const smooth = (value: number) => { const t=Math.max(0,Math.min(1,value)); return t*t*(3-2*t); };
const radians=Math.PI/180;
type Grip = { rotation: Quaternion; position: Vector3 };
const grips=new WeakMap<Object3D,Grip>();
export const combatGrip=(hand:Object3D)=>grips.get(hand);
type Prepared={clips:readonly AnimationClip[];grip:Grip};
const cache=new WeakMap<readonly AnimationClip[],Prepared>();

/** Fit the sparse authored clips to this rig once. Playback uses ordinary mixer tracks. */
export function fitSwordClips(root:Object3D, clips:readonly AnimationClip[]):readonly AnimationClip[] {
  const bone=(mixamo:string,custom:string)=>(root.getObjectByName('mixamorig'+mixamo)??root.getObjectByName(custom)) as Bone;
  const right=bone('RightHand','Hand_R');
  if (!right) return clips;
  const cached=cache.get(clips);
  if(cached){grips.set(right,cached.grip);return cached.clips;}
  const chain=(side:'Left'|'Right',leg=false)=>{
    const suffix=side==='Left'?'_L':'_R';
    const a=bone(side+(leg?'UpLeg':'Arm'),(leg?'Thigh':'UpperArm')+suffix);
    const b=bone(side+(leg?'Leg':'ForeArm'),(leg?'Shin':'Forearm')+suffix);
    const c=bone(side+(leg?'Foot':'Hand'),(leg?'Foot':'Hand')+suffix);
    return {a,b,c,fit:createLimbFitter(a,b,c)};
  };
  const main=chain('Right'),support=chain('Left'),legs=[chain('Left',true),chain('Right',true)];
  const hips=bone('Hips','Hips'),chest=bone('Spine2','Chest');
  const world=(o:Object3D)=>o.getWorldPosition(new Vector3());
  const orientation=(o:Object3D)=>o.getWorldQuaternion(new Quaternion());
  const reach=world(main.a).distanceTo(world(main.b))+world(main.b).distanceTo(world(main.c));
  // Both supplied meshes face model +Z. Canolia names its hand bones on opposite X sides from Mixamo.
  const lateral=new Vector3(-1,0,0).applyQuaternion(orientation(root));lateral.y=0;lateral.normalize();
  const handedness=Math.sign(world(main.a).sub(world(support.a)).dot(lateral))||1;
  const up=new Vector3(0,1,0),back=lateral.clone().cross(up);
  const frame=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(lateral,up,back));
  const direction=(x:number,y:number,z:number)=>new Vector3(x,y,z).applyQuaternion(frame);
  const center=world(main.a).lerp(world(support.a),.5);
  const anchors=legs.map(l=>({position:world(l.c),orientation:orientation(l.c)}));
  const hipPosition=world(hips),armPole=direction(handedness,-.75,.45),supportPole=direction(-handedness,-.72,.4);
  const setOrientation=(o:Object3D,q:Quaternion)=>o.quaternion.copy(orientation(o.parent!).invert().multiply(q));
  const handOffset=(hand:Bone,side:string)=>{
    const knuckle=hand.getObjectByName('mixamorig'+side+'HandMiddle1');
    return knuckle?hand.worldToLocal(world(knuckle)).multiplyScalar(.62):new Vector3();
  };
  const mainOffset=handOffset(main.c,'Right'),supportOffset=handOffset(support.c,'Left');
  const palmShift=(hand:Bone,offset:Vector3,q:Quaternion)=>offset.clone().multiply(hand.getWorldScale(new Vector3())).applyQuaternion(q);
  const weaponOrientation=(yaw:number,elevation:number)=>frame.clone().multiply(
    new Quaternion().setFromEuler(new Euler((90+elevation)*radians,-yaw*radians,0,'YXZ')));
  const touched=[hips,chest,main.a,main.b,main.c,support.a,support.b,support.c,...legs.flatMap(l=>[l.a,l.b,l.c])];
  const rest=touched.map(o=>({o,q:o.quaternion.clone(),p:o.position.clone()}));
  function reset(){for(const {o,q,p} of rest){o.quaternion.copy(q);o.position.copy(p);}}
  const guardPoint=center.clone().add(direction(.20*handedness,-.38,-.55).multiplyScalar(reach));
  main.fit(guardPoint,armPole);
  const guardBlade=weaponOrientation(18,43);
  const grip={rotation:orientation(main.c).invert().multiply(guardBlade),position:mainOffset};
  const index=main.c.getObjectByName('mixamorigRightHandIndex1');
  const pinky=main.c.getObjectByName('mixamorigRightHandPinky1');
  if(index&&pinky){
    const across=main.c.worldToLocal(world(index)).sub(main.c.worldToLocal(world(pinky))).normalize();
    grip.rotation.setFromUnitVectors(new Vector3(0,-1,0),across);
  }
  const leftGuard=center.clone().add(direction(-.46*handedness,-.40,-.37).multiplyScalar(reach));
  support.fit(leftGuard,supportPole);
  const leftNeutral=orientation(support.c);
  const leftGrip=leftNeutral.clone().invert().multiply(guardBlade);
  reset();

  const fitted=clips.map(source=>{
    const name=source.name as CombatClip,stroke=strokes[name];
    const walking=name==='Sword_Walk'||name==='Sword_Run'||name.startsWith('Combat_Strafe');
    if(!combatClipSet.has(name))return source;
    const bindings=touched.map(o=>({o,values:[] as number[]}));
    const times:number[]=[],translations:number[]=[];
    const steps=Math.max(12,Math.ceil(source.duration*30)),two=twoHanded(name);
    const start=ATTACKS[name]?.activeStart??.24,end=ATTACKS[name]?.activeEnd??.72;
    const run=name==='Sword_Run';
    const strafe=name==='Combat_Strafe_Left'?-1:name==='Combat_Strafe_Right'?1:0;
    const dodge=name==='Dodge_Left'?-1:name==='Dodge_Right'?1:0;
    const recoil=name==='Knockback'?.22:name==='Hit_React'?.12:0;
    for(let i=0;i<=steps;i++){
      reset();
      const t=i/steps,time=t*source.duration,phase=t*Math.PI*2,pulse=Math.sin(Math.PI*t);
      const draw=stroke?smooth(t/start):0,release=1-smooth((t-end)/(1-end));
      const weight=draw*release,cut=smooth((t-start)/(end-start));
      const lerp=(a:number,b:number,w:number)=>a+(b-a)*w;
      const walkSwing=walking?Math.sin(phase)*(run?8:4):0;
      const walkBob=walking?Math.cos(phase*2)*(run?5:2.5):0;
      const yaw=(stroke?lerp(18,lerp(stroke[0],stroke[2],cut),weight):18)+walkSwing;
      const elevation=(stroke?lerp(43,lerp(stroke[1],stroke[3],cut),weight):43)+walkBob-recoil*35*pulse;
      const spin=name==='Spin_Slash'?-2*Math.PI*cut:0;
      const turn=(yaw-18)*radians*.31,hipTurn=-turn*.62+spin;
      const load=weight*(two?.19:.12);
      if(walking){
        const swayX=Math.cos(phase)*(strafe?.028*strafe:.014*handedness);
        const bounceY=-(run?.055:.03)+Math.cos(phase*2)*(run?.024:.012);
        const leanZ=-(run?.035:.015);
        hips.position.copy(hips.parent!.worldToLocal(hipPosition.clone().add(direction(
          reach*swayX, reach*bounceY, reach*leanZ))));
        const walkHipYaw=strafe?0:(run?.10:.065)*Math.sin(phase)*handedness;
        setOrientation(hips,new Quaternion().setFromAxisAngle(up,walkHipYaw).multiply(orientation(hips)));
        const chestRot=new Quaternion().setFromAxisAngle(up,-walkHipYaw*.85-.08*handedness)
          .multiply(new Quaternion().setFromAxisAngle(lateral,run?-.12:-.04));
        setOrientation(chest,chestRot.multiply(orientation(chest)));
        for(let j=0;j<legs.length;j++){
          const side=(j===0?-1:1)*handedness;
          const legPhase=phase+(j===0?0:Math.PI);
          const swing=Math.max(0,Math.cos(legPhase));
          const liftY=swing*swing*(run?.16:.08);
          const stepX=strafe?(side*.05+strafe*Math.sin(legPhase)*.22):side*.02;
          const stepZ=strafe?-Math.cos(legPhase)*.05:-Math.sin(legPhase)*(run?.50:.34);
          const step=direction(stepX,liftY,stepZ).multiplyScalar(reach).add(anchors[j].position);
          legs[j].fit(step,direction(side*.12,.10,-1));
          const footPitch=Math.sin(legPhase)*(run?.24:.16)-swing*(run?.18:.10);
          setOrientation(legs[j].c,new Quaternion().setFromAxisAngle(lateral,footPitch).multiply(anchors[j].orientation));
        }
      }else{
        const dodgeX=dodge*.22*pulse*handedness;
        const recoilZ=recoil*pulse;
        hips.position.copy(hips.parent!.worldToLocal(hipPosition.clone().add(direction(
          reach*(.03+.15*Math.sin(turn)+dodgeX), -reach*(.12+load+.06*Math.abs(dodge)*pulse), -reach*(.03+weight*.09-recoilZ)))));
        setOrientation(hips,new Quaternion().setFromAxisAngle(up,hipTurn).multiply(orientation(hips)));
        const chestTurn=new Quaternion().setFromAxisAngle(up,-turn*.48)
          .multiply(new Quaternion().setFromAxisAngle(lateral,recoil*1.1*pulse));
        setOrientation(chest,chestTurn.multiply(orientation(chest)));
        for(let j=0;j<legs.length;j++){
          const side=(j===0?-1:1)*handedness;
          const step=direction(side*.12+dodgeX*.65,0,side*.19+recoilZ*.4).multiplyScalar(reach);
          step.add(anchors[j].position);
          if(name==='Jump_Slash')step.y+=reach*.24*Math.sin(Math.PI*t);
          if(dodge&&((dodge<0)===(j===0)))step.y+=reach*.05*pulse;
          if(spin)step.sub(hipPosition).applyAxisAngle(up,spin).add(hipPosition);
          legs[j].fit(step,direction(side*.20,.06,-1).applyAxisAngle(up,spin));
          setOrientation(legs[j].c,new Quaternion().setFromAxisAngle(up,spin).multiply(anchors[j].orientation));
        }
      }
      const blade=weaponOrientation(yaw,elevation).premultiply(new Quaternion().setFromAxisAngle(up,spin));
      const rightQ=blade.clone().multiply(grip.rotation.clone().invert());
      const extension=name==='Sword_Thrust'?lerp(.22,.95,cut):.62;
      const chamber=new Vector3((two?.21:.59)*Math.sin(yaw*radians),
        -.16+.57*Math.sin(elevation*radians),-extension+.19*Math.abs(Math.sin(yaw*radians)));
      const path=new Vector3(.2*handedness,-.38,-.55).lerp(chamber,weight).multiplyScalar(reach).applyQuaternion(frame).applyAxisAngle(up,spin);
      const shoulderCenter=world(main.a).lerp(world(support.a),.5);
      main.fit(path.add(shoulderCenter).sub(palmShift(main.c,mainOffset,rightQ)),armPole.clone().applyAxisAngle(up,spin));
      setOrientation(main.c,rightQ);
      const pommel=world(main.c).add(palmShift(main.c,mainOffset,rightQ))
        .add(new Vector3(0,.095,-.015).applyQuaternion(blade));
      const leftQ=leftNeutral.clone().slerp(blade.clone().multiply(leftGrip.clone().invert()),two?weight:0);
      const free=direction((- .46-.23*weight)*handedness,-.40-.14*weight,-.37+.22*weight).multiplyScalar(reach)
        .applyAxisAngle(up,spin).add(shoulderCenter);
      support.fit(free.lerp(pommel,two?weight:0).sub(palmShift(support.c,supportOffset,leftQ)),supportPole.clone().applyAxisAngle(up,spin));
      setOrientation(support.c,leftQ);
      times.push(time);translations.push(...hips.position.toArray());
      for(const binding of bindings)binding.values.push(...binding.o.quaternion.toArray());
    }
    reset();
    const replaced=new Set(bindings.map(({o})=>o.name+'.quaternion'));
    replaced.add(hips.name+'.position');
    const tracks=source.tracks.filter(track=>!replaced.has(track.name));
    for(const {o,values} of bindings)tracks.push(new QuaternionKeyframeTrack(o.name+'.quaternion',times,values));
    tracks.push(new VectorKeyframeTrack(hips.name+'.position',times,translations));
    return new AnimationClip(name,source.duration,tracks);
  });
  root.updateWorldMatrix(true,true);
  grips.set(right,grip);cache.set(clips,{clips:fitted,grip});
  return fitted;
}
