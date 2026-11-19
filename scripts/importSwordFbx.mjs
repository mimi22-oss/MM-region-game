import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {AnimationClip,PropertyBinding,Matrix4,Vector3,Quaternion} from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {retargetMotionClip,cloneTransformHierarchyOnly} from '../src/animation/retargeting/SkeletonRetargeter.ts';
import {parseGlb} from './extract-motions/glbCodec.mjs';

const directory=process.argv[2]??'C:/Users/EBPMyanmar/Downloads';
const files={
 idle:'Standing Idle.fbx',
 jump:'Standing Melee Run Jump Attack.fbx',
 combo:'Standing Melee Combo Attack Ver. 2.fbx',
 block:'Standing Block Idle.fbx',
 walk:'Standing Walk Forward.fbx',
};
function findFbx(name){
 const candidates=[
  resolve(directory,name),
  resolve(directory,name.replace(/ /g,'_')),
  resolve('C:/Users/EBPMyanmar/.gemini/antigravity/brain/4983868b-0875-4705-9a55-10f6270e8452/.user_uploaded',name),
  resolve('C:/Users/EBPMyanmar/.gemini/antigravity/brain/4983868b-0875-4705-9a55-10f6270e8452/.user_uploaded',name.replace(/ /g,'_')),
 ];
 for(const p of candidates)if(existsSync(p))return p;
 return resolve(directory,name);
}
const source={};
for(const [key,name] of Object.entries(files)){
 const filePath=findFbx(name);
 const bytes=readFileSync(filePath);
 const rig=new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 source[key]={rig,clip:rig.animations[0],sha256:createHash('sha256').update(bytes).digest('hex'),file:name};
}
function encode(doc,binary){
 const j=Buffer.from(JSON.stringify(doc));const json=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);
 const bin=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
 const out=Buffer.alloc(28+json.length+bin.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
 out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);
 out.writeUInt32LE(bin.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);bin.copy(out,28+json.length);
 return out;
}
function segment(clip,name,start,end){
 const copy=clip.clone();copy.name=name;
 for(const track of copy.tracks){
  const width=track.getValueSize(),sample=track.InterpolantFactoryMethodLinear();
  const times=[start,...Array.from(track.times).filter(t=>t>start&&t<end),end];
  const values=times.flatMap(t=>Array.from(sample.evaluate(t)));
  track.times=new Float32Array(times.map(t=>t-start));track.values=new Float32Array(values);
 }
 copy.duration=end-start;return copy;
}
const mappings=[
 ['Combat_Idle','idle',0,source.idle.clip.duration],
 ['Slash_Left','combo',.15,.75],['Slash_Right','combo',.75,1.55],
 ['Slash_Overhead','jump',0,source.jump.clip.duration],
 ['Jump_Slash','jump',0,source.jump.clip.duration],
 ['Heavy_Slash','jump',0,source.jump.clip.duration],
 ['Sword_Block','block',0,source.block.clip.duration],
 ['Sword_Walk','walk',0,source.walk.clip.duration],
];
const report={sources:Object.fromEntries(Object.entries(source).map(([k,s])=>[k,{file:s.file,sha256:s.sha256,duration:s.clip.duration,tracks:s.clip.tracks.length}])),characters:{}};
for(const kind of ['boy','girl','canolia-character']){
 const path=resolve('public/models/characters/'+kind+'-combat-animated.glb');
 const original=parseGlb(path),doc=original.gltf;
 if(doc.animations.some(a=>a.name.startsWith('FBX_')))throw Error('Already generated: restore this file from its recorded pre-FBX asset before regeneration.');
 const stripped=structuredClone(doc);delete stripped.images;delete stripped.textures;delete stripped.materials;
 for(const mesh of stripped.meshes)for(const p of mesh.primitives)delete p.material;
 const body=encode(stripped,original.bin);const model=await new GLTFLoader().parseAsync(body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength),'');
 const rig=cloneTransformHierarchyOnly(model.scene);
 const originalNames=new Map();
 // Canolia has its own authored rig. Alias only the temporary transform hierarchy.
 const aliases={Hips:'Hips',Spine:'Spine',Chest:'Spine2',Neck:'Neck',Head:'Head'};
 for(const side of ['L','R'])for(const [a,b] of Object.entries({Clavicle:'Shoulder',UpperArm:'Arm',Forearm:'ForeArm',Hand:'Hand',Thigh:'UpLeg',Shin:'Leg',Foot:'Foot',Toe:'ToeBase'}))aliases[a+'_'+side]=(side==='L'?'Left':'Right')+b;
 if(kind==='canolia-character')rig.traverse(n=>{if(aliases[n.name]){originalNames.set('mixamorig'+aliases[n.name],n.name);n.name='mixamorig'+aliases[n.name];}});
 let chunks=[original.bin],size=original.bin.length;
 function accessor(values,width){
  const bytes=Buffer.from(new Float32Array(values).buffer);
  const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length});chunks.push(bytes);size+=bytes.length;
  const acc={bufferView:view,componentType:5126,count:values.length/width,type:{1:'SCALAR',3:'VEC3',4:'VEC4'}[width]};
  if(width===1){acc.min=[values[0]];acc.max=[values.at(-1)];}
  return doc.accessors.push(acc)-1;
 }
 const authored=[];const retargeted={};
 for(const [name,key,start,end] of mappings){
  if(!retargeted[key]){
   const src=source[key],clip=src.clip.clone();
   // Clamp endpoint sampling without wrapping the original animation's final frame.
   clip.duration+=.001;
   retargeted[key]=retargetMotionClip(clip,src.rig,rig,{rootMotion:'in-place'});
  }
  const clip=segment(retargeted[key],name,start,end);
  const animation={name:'FBX_'+name,samplers:[],channels:[],extras:{source:source[key].file,start,end,rootMotion:'in-place'}};
  for(const track of clip.tracks){
   const dot=track.name.lastIndexOf('.'),raw=track.name.slice(0,dot),bone=originalNames.get(raw)??raw;
   const node=doc.nodes.findIndex(n=>PropertyBinding.sanitizeNodeName(n.name??'')===bone);
   if(node<0)throw Error(kind+': missing '+bone);
   const property=track.name.slice(dot+1),width=track.getValueSize();
   if(doc.nodes[node].matrix){
    const p=new Vector3(),q=new Quaternion(),s=new Vector3();
    new Matrix4().fromArray(doc.nodes[node].matrix).decompose(p,q,s);
    Object.assign(doc.nodes[node],{translation:p.toArray(),rotation:q.toArray(),scale:s.toArray()});delete doc.nodes[node].matrix;
   }
   const input=accessor(Array.from(track.times),1),output=accessor(Array.from(track.values),width);
   animation.channels.push({sampler:animation.samplers.length,target:{node,path:property==='quaternion'?'rotation':'translation'}});
   animation.samplers.push({input,output,interpolation:'LINEAR'});
  }
  doc.animations.push(animation);authored.push({name,duration:clip.duration,tracks:clip.tracks.length});
 }
 doc.buffers[0].byteLength=size;
 const output=encode(doc,Buffer.concat(chunks));writeFileSync(path,output);
 report.characters[kind]={file:path,originalBytes:original.byteLength,bytes:output.length,clips:authored};
}
mkdirSync('artifacts/fbx-combat',{recursive:true});writeFileSync('artifacts/fbx-combat/import.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.characters,null,2));
