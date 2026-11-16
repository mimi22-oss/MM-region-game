import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const pairs=[['boy','public/models/characters/boy-combat-animated.glb','src/assets/boy.glb'],['girl','public/models/characters/girl-combat-animated.glb','src/assets/girl.glb'],['canolia','public/models/characters/canolia-character-combat-animated.glb','public/models/canolia-character.glb'],['ghost','public/models/enemies/ghost-woman-combat-animated.glb','public/models/ghost-woman.glb']];
function parse(b){const size=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+size).toString());return {j,bin:b.subarray(28+size)};}
const hash=b=>createHash('sha256').update(b).digest('hex');
const result=[];
for(const [id,file,old] of pairs){
 const bytes=await readFile(file),{j,bin}=parse(bytes),original=parse(await readFile(old)),names=j.nodes.map(n=>n.name??'');
 const clips=j.animations.map(a=>({name:a.name,duration:Math.max(...a.samplers.map(s=>j.accessors[s.input].max[0])),channels:a.channels.length,targets:[...new Set(a.channels.map(c=>names[c.target.node]))],paths:[...new Set(a.channels.map(c=>c.target.path))]}));
 const same=key=>JSON.stringify(j[key])===JSON.stringify(original.j[key]);
 const entry={id,file,bytes:bytes.length,sha256:hash(bytes),clips,bones:j.skins.flatMap(s=>s.joints.map(i=>names[i])),meshCount:j.meshes.length,textureCount:j.textures?.length??0,unchanged:{nodes:same('nodes'),skins:same('skins'),meshes:same('meshes'),materials:same('materials'),images:same('images'),originalBufferPrefix:hash(bin.subarray(0,original.bin.length))===hash(original.bin)}};
 result.push(entry);console.log(JSON.stringify({id,clips:clips.length,durations:clips.map(c=>[c.name,Number(c.duration.toFixed(3))]),unchanged:entry.unchanged}));
}
await mkdir('artifacts/sword-combat',{recursive:true});
await writeFile('artifacts/sword-combat/assets.json',JSON.stringify(result,null,2));
