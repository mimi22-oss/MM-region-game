import bpy,os,json,struct,math
from mathutils import Vector
OUT=r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character'
scene=bpy.data.scenes['Web Character - Final'];bpy.context.window.scene=scene
col=bpy.data.collections['Optimized Web Character'];rig=bpy.data.objects['Canolia_Rig']
old=bpy.data.scenes.get('Animated GLB validation')
if old:
 imported_actions=set()
 for o in list(old.objects):
  if o.animation_data:
   if o.animation_data.action:imported_actions.add(o.animation_data.action)
   for track in o.animation_data.nla_tracks:
    for strip in track.strips:imported_actions.add(strip.action)
  bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.scenes.remove(old)
 for action in imported_actions:
  if action.name not in ['Idle','Walk','Vault','Bike_Mount','Bike_Idle','Bike_Drive','Car_Drive','Swim_Idle','Swim_Forward']:bpy.data.actions.remove(action)
with open(os.path.join(OUT,'animation_report.json')) as f:report=json.load(f)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
for o in scene.objects:o.select_set(False)
for o in col.objects:o.select_set(True)
bpy.context.view_layer.objects.active=rig
path=os.path.join(OUT,'reference_model_animated.glb')
bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=False,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_all_influences=False,export_cameras=False,export_lights=False,export_extras=True,export_anim_single_armature=True)
with open(path,'rb') as f:
 header=f.read(12);size,kind=struct.unpack('<II',f.read(8));doc=json.loads(f.read(size))
names=[a['name'] for a in doc.get('animations',[])]
expected=[c['name'] for c in report['clips']]
assert sorted(names)==sorted(expected),(names,expected)
assert len(doc.get('skins',[]))>0
primitives=[p for me in doc['meshes'] for p in me['primitives']]
assert all('JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes'] for p in primitives)
for a in doc['animations']:
 assert a['channels'] and a['samplers']
rig.animation_data.action=None
validation=bpy.data.scenes.new('Animated GLB validation');bpy.context.window.scene=validation
bpy.ops.import_scene.gltf(filepath=path)
imported_rigs=[o for o in validation.objects if o.type=='ARMATURE'];assert len(imported_rigs)==1
ir=imported_rigs[0];tracks=ir.animation_data.nla_tracks if ir.animation_data else []
imported_actions=[]
for track in tracks:
 for strip in track.strips:
  imported_actions.append(strip.action)
 track.mute=True
assert len(imported_actions)==9,(len(imported_actions),[t.name for t in tracks])
for action in imported_actions:
 ir.animation_data.action=action;validation.frame_set(int((action.frame_range.x+action.frame_range.y)/2));bpy.context.view_layer.update()
 assert all(math.isfinite(v) for pb in ir.pose.bones for row in pb.matrix for v in row)
ir.animation_data.action=None
bpy.context.window.scene=scene;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
report['export_validation']={'animations':names,'skins':len(doc['skins']),'skinned_primitives':len(primitives),'reimported_actions':len(imported_actions),'reimported_rigs':len(imported_rigs),'all_reimported_midpoints_finite':True,'glb_bytes':os.path.getsize(path)}
report['files']={'blend':os.path.join(OUT,'reference_model_animated.blend'),'glb':path}
with open(os.path.join(OUT,'animation_report.json'),'w') as f:json.dump(report,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=report['files']['blend'])
result=report['export_validation']
