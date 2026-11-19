import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {AnimationMixer,LoopOnce,Vector3} from 'three';
const report={};
for(const name of ['Standing Melee Run Jump Attack','Standing Melee Combo Attack Ver. 1']){
 const b=readFileSync('C:/Users/EBPMyanmar/Downloads/'+name+'.fbx');const root=new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const mixer=new AnimationMixer(root),clip=root.animations[0];const a=mixer.clipAction(clip).setLoop(LoopOnce,1);a.clampWhenFinished=true;a.play();
 const hips=root.getObjectByName('mixamorigHips'),hand=root.getObjectByName('mixamorigRightHand'),head=root.getObjectByName('mixamorigHead');
 const rest=hips.position.clone();const rows=[];
 for(let t=0;t<clip.duration;t+=.1){mixer.setTime(t);const h=hips.getWorldPosition(new Vector3()),p=hand.getWorldPosition(new Vector3()).sub(h);rows.push({t:+t.toFixed(2),hand:p.toArray().map(v=>+v.toFixed(1)),hip:h.toArray().map(v=>+v.toFixed(1))});}
 console.log(name,JSON.stringify(rows)); report[name]=rows;
}
mkdirSync('artifacts/fbx-combat',{recursive:true});writeFileSync('artifacts/fbx-combat/source-motion.json',JSON.stringify(report,null,2));
