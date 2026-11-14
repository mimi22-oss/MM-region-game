import bpy,os,json,math
from mathutils import Vector
OUT=r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character'
scene=bpy.data.scenes['Web Character - Final'];bpy.context.window.scene=scene
rig=bpy.data.objects['Canolia_Rig'];col=bpy.data.collections['Optimized Web Character']
with open(os.path.join(OUT,'animation_report.json')) as f:report=json.load(f)
checks=[]
for clip in report['clips']:
 rig.animation_data.action=bpy.data.actions[clip['name']]
 poses=[]
 for frame in [0,clip['frames']//4,clip['frames']//2,3*clip['frames']//4,clip['frames']]:
  scene.frame_set(frame);bpy.context.view_layer.update()
  assert all(math.isfinite(v) for pb in rig.pose.bones for row in pb.matrix for v in row)
  poses.append({n:list(rig.pose.bones[n].head) for n in ['Hips','Head','Hand_L','Hand_R','Foot_L','Foot_R']})
 first,last=poses[0],poses[-1]
 delta=max((Vector(first[n])-Vector(last[n])).length for n in first)
 if clip['loop']:assert delta<.0001,(clip['name'],delta)
 checks.append({'name':clip['name'],'sampled_frames':5,'loop_endpoint_error_m':delta,'finite_transforms':True})
missing=0
for o in col.objects:
 if o.type=='MESH':missing+=sum(1 for v in o.data.vertices if sum(g.weight for g in v.groups)<.99)
assert missing==0,missing
report['checks']=checks;report['unweighted_vertices']=missing
cam=scene.camera;cam.location=(2.8,-5,2.05);cam.rotation_euler=(Vector((0,-.03,.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.18
scene.render.resolution_x=320;scene.render.resolution_y=420;scene.render.resolution_percentage=100
os.makedirs(os.path.join(OUT,'animation_previews'),exist_ok=True)
for clip in report['clips']:
 rig.animation_data.action=bpy.data.actions[clip['name']]
 frame=clip['frames']//2
 if clip['name']=='Walk':frame=4
 if clip['name']=='Bike_Mount':frame=clip['frames']
 if clip['name']=='Swim_Forward':frame=6
 scene.frame_set(frame);scene.render.filepath=os.path.join(OUT,'animation_previews',clip['name']+'.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
with open(os.path.join(OUT,'animation_report.json'),'w') as f:json.dump(report,f,indent=2)
result={'checks':checks,'unweighted_vertices':missing,'previews':os.path.join(OUT,'animation_previews')}
