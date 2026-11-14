import bpy,math,os,json
from math import sin,cos,pi
from mathutils import Vector,Matrix,Quaternion
OUT=r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character'
scene=bpy.data.scenes['Web Character - Final'];bpy.context.window.scene=scene
rig=bpy.data.objects['Canolia_Rig'];col=bpy.data.collections['Optimized Web Character'];data=rig.data
spec={b.name:(b.head_local.copy(),b.tail_local.copy(),b.parent.name if b.parent else None) for b in data.bones}
rest={n:data.bones[n].matrix_local.copy() for n in spec};length={n:(v[1]-v[0]).length for n,v in spec.items()}
with open(os.path.join(OUT,'rig_animations.py')) as f:src=f.read()
exec(src[src.index('def smooth('):src.index('weights_summary={}')])
garments=['Hoodie violet cotton','Violet rib knit','Violet stitching','Ivory cord and embroidery','Hood interior']
rig.animation_data.action=None;scene.frame_set(0)
for o in col.objects:
 if o.type!='MESH' or o.data.materials[0].name not in garments:continue
 for v in o.data.vertices:
  x,y,z=v.co
  for g in o.vertex_groups:g.remove([v.index])
  ws=weight_candidates(v.co,o.data.materials[0].name);total=sum(w for _,w in ws)
  for n,w in ws:o.vertex_groups[n].add([v.index],w/total,'REPLACE')
  if abs(x)<.205 and .68<z<.81:
   for g in o.vertex_groups:g.remove([v.index])
   o.vertex_groups['Hips'].add([v.index],1,'REPLACE')
  elif abs(x)<.18 and z>1.20:
   for g in o.vertex_groups:g.remove([v.index])
   o.vertex_groups['Chest'].add([v.index],.7,'REPLACE');o.vertex_groups['Neck'].add([v.index],.3,'REPLACE')
funcs=src[src.index('def ik('):src.index('clips=[')].replace('.38*lift*(1 if s>0 else .84)','.58*lift*(1 if s>0 else .88)')
exec(funcs)
rig.animation_data.action=bpy.data.actions['Vault']
for f in range(55):pose('Vault',f/54);keyframe(f)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'reference_model_animated.blend'))
result={'waist_weights_refined':True,'vault_knee_tuck_refined':True}
