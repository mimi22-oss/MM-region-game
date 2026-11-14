import bpy, math, os
from math import sin,cos,pi
from mathutils import Vector
scene=bpy.data.scenes['Reference Character Studio'];bpy.context.window.scene=scene
OUT=r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character'
def merge_soft(names,label,voxel):
 bpy.ops.object.select_all(action='DESELECT')
 obs=[o for o in scene.objects if any(o.name==n or o.name.startswith(n+'.') for n in names)]
 for o in obs:
  o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.convert(target='MESH')
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name=label
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 m=o.modifiers.new('Continuous fabric','REMESH');m.mode='VOXEL';m.voxel_size=voxel; m.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=m.name)
 m=o.modifiers.new('Relax fabric','SMOOTH');m.factor=.65;m.iterations=5;bpy.ops.object.modifier_apply(modifier=m.name)
 m=o.modifiers.new('Fabric triangulation budget','DECIMATE');m.ratio=.4;bpy.ops.object.modifier_apply(modifier=m.name)
 for p in o.data.polygons:p.use_smooth=True
merge_soft(['Hoodie body','Relaxed hoodie sleeve'],'Continuous hoodie body and sleeves',.009)
merge_soft(['Jogger hips','Tapered trouser leg'],'Continuous jogger trousers',.009)
# Recess and soften eyes. All moves are within this new character.
for o in list(bpy.data.collections['Face'].objects):
 if o.name.startswith(('Eye white','Iris rim','Brown iris','Pupil','Eye catchlight','Tiny eye glint')):
  o.location.y+=.025
  o.scale.x*=.94;o.scale.z*=.94
 if o.name.startswith('Lower eyelid'):o.hide_render=True;o.hide_viewport=True
 if o.name.startswith('Upper eyelid'):
  o.location.y+=.020;o.data.bevel_depth=.006
 if o.name.startswith('Expressive eyebrow'):
  # keep matte eyebrows visually distinct from the shining scalp
  pass
# Fuller cheeks and head width, ears slightly higher.
head=bpy.data.objects['Sculpted head'];head.scale.x=1.055
for o in bpy.data.collections['Face'].objects:
 if o.name.startswith(('Ear','Ear concha','Ear inner fold')):o.location.x*=1.025;o.location.z+=.018
hair=bpy.data.materials['Espresso hair'];hair.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.60
hair.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.012,.008,.007,1)
bpy.data.materials['Warm hair ridges'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.66
for o in bpy.data.collections['Hair'].objects:
 if o.name.startswith('Hair flow groove'):o.data.bevel_depth=.001
# Replace the floating collar forms with a continuous hood shell, open at the neck.
col=bpy.data.collections['Hoodie']
for name in ['Hood folded back','Hood dark opening','Hood rolled rim','Undershirt at collar']:
 o=bpy.data.objects.get(name)
 if o:bpy.data.objects.remove(o,do_unlink=True)
verts=[];faces=[];N=64
# Outer bottom, outer lip, inner lip, inner bottom.
for r in range(4):
 for i in range(N):
  a=2*pi*i/N;front=max(0,-sin(a));back=max(0,sin(a))
  if r==0:rx,ry,z=.205,.145,2.39-.035*front
  elif r==1:rx,ry,z=.285,.205,2.51+.06*back-.15*front
  elif r==2:rx,ry,z=.226,.153,2.51+.055*back-.15*front
  else:rx,ry,z=.145,.107,2.42-.05*front
  verts.append((rx*cos(a),.043+ry*sin(a),z))
for j in range(3):
 for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
me=bpy.data.meshes.new('Hood sewn shell');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Hood sewn shell',me);col.objects.link(o)
me.materials.append(bpy.data.materials['Hoodie violet cotton']);me.materials.append(bpy.data.materials['Hood interior'])
for p in me.polygons:p.use_smooth=True;p.material_index=1 if p.index>=2*N else 0
m=o.modifiers.new('Soft hood edge','SUBSURF');m.levels=2
me=bpy.data.meshes.new('Cotton undershirt');me.from_pydata([(-.105,-.131,2.43),(0,-.177,2.365),(.105,-.131,2.43)],[],[(0,1,2)]);o=bpy.data.objects.new('Cotton undershirt',me);col.objects.link(o);me.materials.append(bpy.data.materials['Ivory cord and embroidery'])
# Increase hand length subtly and reduce obvious finger segmentation.
for o in bpy.data.collections['Hands'].objects:
 o.location.z-=.012
# Less contrast on embroidery stitches and a brighter neutral backdrop.
bpy.data.materials['Violet stitching'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.113,.025,.26,1)
bpy.data.materials['Hoodie violet cotton'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.09,.013,.255,1)
bpy.data.materials['Studio light gray'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.78,.78,.80,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
scene.render.filepath=os.path.join(OUT,'preview_02.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'reference_model.blend'))
bpy.ops.render.render(write_still=True)
result={'render':scene.render.filepath,'objects':len(bpy.data.collections['Canolia Character'].all_objects)}
