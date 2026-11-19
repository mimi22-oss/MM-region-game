import {readFileSync} from 'node:fs';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
for(const name of ['Standing Idle','Standing Melee Run Jump Attack','Standing Melee Combo Attack Ver. 1','Standing Block Idle','Standing Walk Forward']){
 const b=readFileSync('C:/Users/EBPMyanmar/Downloads/'+name+'.fbx');
 const root=new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 console.log(name,root.animations.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length})));
 console.log(root.children.map(n=>[n.name,n.type]));
}
