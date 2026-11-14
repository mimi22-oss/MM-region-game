import bpy, math, os, json
from mathutils import Vector, Matrix, Quaternion
from math import sin,cos,pi
OUT=r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character'
scene=bpy.data.scenes['Web Character - Final'];bpy.context.window.scene=scene
col=bpy.data.collections['Optimized Web Character'];root=bpy.data.objects['Canolia Character Root']
scene.render.fps=30
oldrig=bpy.data.objects.get('Canolia_Rig')
if oldrig:
 for o in col.objects:
  if o.type=='MESH':
   if o.parent==oldrig:o.parent=root
   o.vertex_groups.clear()
   for mod in list(o.modifiers):
    if mod.type=='ARMATURE' and mod.object==oldrig:o.modifiers.remove(mod)
 bpy.data.objects.remove(oldrig,do_unlink=True)
missing=[o for o in col.objects if o.type=='MESH' and (not o.data.materials or o.data.materials[0] is None)]
if missing:
 with bpy.data.libraries.load(os.path.join(OUT,'rig_material_source.blend'),link=False) as (src,dst):
  dst.materials=[o.name for o in missing if o.name in src.materials]
 for o in missing:
  material=bpy.data.materials.get(o.name)
  if material is None:raise RuntimeError('Missing original material: '+o.name)
  o.data.materials.clear();o.data.materials.append(material)
bpy.ops.object.select_all(action='DESELECT')
data=bpy.data.armatures.new('Canolia humanoid skeleton');rig=bpy.data.objects.new('Canolia_Rig',data);col.objects.link(rig);rig.parent=root;rig.show_in_front=True
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
spec={}
def bone(name,h,t,parent=None,deform=True):
 b=data.edit_bones.new(name);b.head=h;b.tail=t;b.use_deform=deform
 if parent:b.parent=data.edit_bones[parent]
 spec[name]=(Vector(h),Vector(t),parent)
bone('Root',(0,0,0),(0,0,.12),None,False)
bone('Hips',(0,.017,.69),(0,.017,.80),'Root')
bone('Spine',(0,.017,.80),(0,.017,.99),'Hips')
bone('Chest',(0,.017,.99),(0,.017,1.17),'Spine')
bone('Neck',(0,.017,1.17),(0,.017,1.29),'Chest')
bone('Head',(0,.017,1.29),(0,.017,1.64),'Neck')
for s,suffix in [(-1,'L'),(1,'R')]:
 bone('Clavicle_'+suffix,(0,.017,1.15),(s*.185,.025,1.145),'Chest')
 bone('UpperArm_'+suffix,(s*.185,.025,1.145),(s*.245,.017,.965),'Clavicle_'+suffix)
 bone('Forearm_'+suffix,(s*.245,.017,.965),(s*.275,.012,.752),'UpperArm_'+suffix)
 bone('Hand_'+suffix,(s*.275,.012,.752),(s*.277,-.006,.657),'Forearm_'+suffix)
 bone('Thigh_'+suffix,(s*.078,.017,.69),(s*.105,.017,.43),'Hips')
 bone('Shin_'+suffix,(s*.105,.017,.43),(s*.115,.014,.17),'Thigh_'+suffix)
 bone('Foot_'+suffix,(s*.115,.014,.17),(s*.115,-.105,.07),'Shin_'+suffix)
 bone('Toe_'+suffix,(s*.115,-.105,.07),(s*.115,-.16,.055),'Foot_'+suffix)
bpy.ops.object.mode_set(mode='OBJECT')
rest={n:data.bones[n].matrix_local.copy() for n in spec}
length={n:(v[1]-v[0]).length for n,v in spec.items()}
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def distseg(p,a,b):
 d=b-a;t=max(0,min(1,(p-a).dot(d)/d.length_squared));return (p-a-d*t).length
def weight_candidates(p,material):
 x,y,z=p;suffix='R' if x>=0 else 'L';ax=abs(x)
 if z>1.285:return [('Head',1)]
 if z>1.205 and ax<.14:
  t=smooth(1.205,1.285,z);return [('Neck',1-t),('Head',t)]
 # Arms separated from torso by an anatomical sloping boundary.
 if z>.575 and ax>(.205 if z<1.06 else .245-(z-1.06)*.55):
  if z<.73:return [('Hand_'+suffix,1)]
  names=['UpperArm_'+suffix,'Forearm_'+suffix,'Hand_'+suffix]
 elif z<.755:
  if z<.105:return [('Foot_'+suffix,.6),('Toe_'+suffix,.4)]
  names=['Thigh_'+suffix,'Shin_'+suffix,'Foot_'+suffix]
  if z>.65:names+=['Hips']
 else:names=['Hips','Spine','Chest','Neck']
 ds=[(n,distseg(p,spec[n][0],spec[n][1])) for n in names]
 ds.sort(key=lambda a:a[1]);ds=ds[:3]
 # Smooth compact influence near joints; avoids motion leaking across limbs.
 best=ds[0][1];ws=[(n,math.exp(-((d*d-best*best)/(.045**2)))) for n,d in ds]
 total=sum(w for _,w in ws);return [(n,w/total) for n,w in ws if w/total>.004]
weights_summary={};meshes=[o for o in col.objects if o.type=='MESH']
for o in meshes:
 groups={n:o.vertex_groups.new(name=n) for n in spec if n!='Root'}
 for v in o.data.vertices:
  ws=weight_candidates(v.co,o.data.materials[0].name);total=sum(w for _,w in ws)
  for n,w in ws:groups[n].add([v.index],w/total,'REPLACE')
 mod=o.modifiers.new('Humanoid skin deformation','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
 o.parent=rig
 weights_summary[o.name]=len(o.data.vertices)
def ik(a,target,l1,l2,pole):
 delta=target-a;d=max(.001,min(delta.length,l1+l2-.001));u=delta.normalized();side=Vector(pole)-u*Vector(pole).dot(u)
 if side.length<.001:side=Vector((0,-1,0))
 side.normalize();along=(l1*l1-l2*l2+d*d)/(2*d);height=math.sqrt(max(0,l1*l1-along*along))
 return a+u*along+side*height,a+u*d
def desired(name,h,t):
 a,b,_=spec[name];q=(b-a).rotation_difference(t-h)
 m=(q.to_matrix().to_4x4()@rest[name]);m.translation=h;return m
def pose(kind,t):
 phase=2*pi*t;matrices={}; hip=Vector((0,.017,.69));lean=0;bob=0
 if kind=='Idle':bob=.003*sin(phase)
 elif kind=='Walk':bob=.009*cos(phase*2)
 elif kind=='Vault':
  lift=sin(pi*t)**2;hip.z+=.32*lift-.045*sin(2*pi*t);lean=.32*sin(pi*t)
 elif kind in ['Bike_Idle','Bike_Drive','Bike_Mount']:
  blend=smooth(0,1,t) if kind=='Bike_Mount' else 1
  hip.z-=.075*blend;lean=.20*blend
  if kind=='Bike_Drive':bob=.003*sin(phase*3)
 elif kind=='Car_Drive':hip.z-=.15;lean=-.05
 elif kind=='Swim_Idle':hip.z+=.08+.018*sin(phase);lean=.12
 elif kind=='Swim_Forward':hip.z=.68+.008*sin(phase*2);lean=pi*.46
 hip.z+=bob;R=Matrix.Rotation(lean,3,'X')
 def body(p):return hip+R@(Vector(p)-spec['Hips'][0])
 def put(n,h,t):matrices[n]=desired(n,Vector(h),Vector(t))
 put('Root',Vector((0,0,0)),Vector((0,0,.12)))
 for n in ['Hips','Spine','Chest','Neck','Head']:put(n,body(spec[n][0]),body(spec[n][1]))
 for s,suffix in [(-1,'L'),(1,'R')]:
  ph=phase+(pi if s<0 else 0);hipjoint=hip+Vector((s*.078,0,0));ankle=Vector((s*.115,.014,.17));legpole=(0,-1,0);footdir=Vector((0,-.119,-.10));armroot=body(spec['UpperArm_'+suffix][0]);wrist=body(spec['Forearm_'+suffix][1]);armpole=(s*.5,-.7,-.3);handdir=R@Vector((s*.002,-.018,-.095))
  if kind=='Idle':wrist.y-=.005*sin(phase)
  elif kind=='Walk':
   ankle.y+=.145*cos(ph);ankle.z+=.075*max(0,sin(ph));wrist.y-=.09*cos(ph);wrist.z+=.008*sin(ph)
   footdir=Matrix.Rotation(.15*sin(ph),3,'X')@footdir
  elif kind=='Vault':
   lift=sin(pi*t)**2;ankle.y-=.10*lift;ankle.z+=.38*lift*(1 if s>0 else .84);wrist=armroot+Vector((s*.09,-.26*sin(pi*t),-.34+.25*lift));handdir=Vector((0,-.04,-.08))
  elif kind in ['Bike_Idle','Bike_Drive','Bike_Mount']:
   blend=smooth(0,1,t) if kind=='Bike_Mount' else 1
   target=Vector((s*.165,.035,.32))
   if kind=='Bike_Idle' and s<0:target=Vector((s*.24,.03,.17))
   ankle=ankle.lerp(target,blend);legpole=(s*.5,-1,0)
   if kind=='Bike_Mount' and s>0:ankle.z+=.30*sin(pi*t)**2;ankle.x+=.15*sin(pi*t)
   grip=Vector((s*.235,-.315,.99));wrist=wrist.lerp(grip,blend);handdir=handdir.lerp(Vector((0,-.085,-.015)),blend);armpole=(s*.5,.2,-1)
   footdir=Vector((0,-.15,-.025))
   if kind=='Bike_Drive':wrist.z+=.0015*sin(phase*3)
  elif kind=='Car_Drive':
   ankle=Vector((s*.13,-.31,.22));legpole=(s*.2,-1,.3);footdir=Vector((0,-.14,-.05))
   steer=.045*sin(phase);wrist=Vector((s*.16,-.30,.91+s*steer));handdir=Vector((-s*.035,-.075,.02));armpole=(s*.5,.5,-1)
  elif kind=='Swim_Idle':
   ankle=hip+Vector((s*.15,.035+.07*sin(ph),-.43));legpole=(s*.2,-1,0)
   wrist=armroot+Vector((s*(.23+.035*sin(phase)),-.13+.07*cos(phase),-.15));armpole=(s,.2,-.5);handdir=Vector((s*.075,-.04,0));footdir=Vector((0,-.12,-.05))
  elif kind=='Swim_Forward':
   ankle=hipjoint+Vector((s*.03,.47,.02+.055*sin(ph)));legpole=(0,1,-1);footdir=Vector((0,.13,-.02))
   # Alternating freestyle arm recovery and underwater pull.
   wrist=armroot+Vector((s*.08,-.35*cos(ph),.22*sin(ph)));armpole=(s,.1,.7);handdir=Vector((0,-.095*cos(ph),.065*sin(ph)))
  knee,ankle=ik(hipjoint,ankle,length['Thigh_'+suffix],length['Shin_'+suffix],legpole)
  put('Thigh_'+suffix,hipjoint,knee);put('Shin_'+suffix,knee,ankle)
  footend=ankle+footdir.normalized()*length['Foot_'+suffix];put('Foot_'+suffix,ankle,footend)
  toeend=footend+footdir.normalized()*length['Toe_'+suffix];put('Toe_'+suffix,footend,toeend)
  put('Clavicle_'+suffix,body(spec['Clavicle_'+suffix][0]),armroot)
  elbow,wrist=ik(armroot,wrist,length['UpperArm_'+suffix],length['Forearm_'+suffix],armpole)
  put('UpperArm_'+suffix,armroot,elbow);put('Forearm_'+suffix,elbow,wrist);put('Hand_'+suffix,wrist,wrist+handdir.normalized()*length['Hand_'+suffix])
 for n in spec:
  parent=spec[n][2]
  basis=rest[n].inverted()@(rest[parent]@matrices[parent].inverted() if parent else Matrix.Identity(4))@matrices[n]
  pb=rig.pose.bones[n];pb.rotation_mode='QUATERNION';loc,rot,scale=basis.decompose();pb.location=loc;pb.rotation_quaternion=rot;pb.scale=(1,1,1)
def keyframe(frame):
 for pb in rig.pose.bones:
  pb.keyframe_insert(data_path='location',frame=frame,group=pb.name);pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=pb.name)
clips=[('Idle',72,True),('Walk',30,True),('Vault',54,False),('Bike_Mount',66,False),('Bike_Idle',60,True),('Bike_Drive',30,True),('Car_Drive',60,True),('Swim_Idle',60,True),('Swim_Forward',48,True)]
rig.animation_data_create();clipinfo=[]
for name,frames,loop in clips:
 action=bpy.data.actions.new(name);rig.animation_data.action=action
 for f in range(frames+1):pose(name,f/frames);keyframe(f)
 action.use_fake_user=True;action['loop']=loop;action['in_place']=True
 track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=frames;track.mute=True
 clipinfo.append({'name':name,'duration':frames/30,'frames':frames,'loop':loop,'in_place':True})
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_start=0;scene.frame_end=72;scene.frame_set(0)
rig['clip_usage']='All clips keep Root at origin. Vault has vertical hips motion. Bike and car require vehicle-specific seat/grip alignment. Bike_Idle left foot rests down.'
rig['forward_axis']='-Y in Blender, +Z after glTF Y-up conversion'
report={'rig':rig.name,'bones':len(spec),'skinned_meshes':len(meshes),'clips':clipinfo,'notes':['Static original files preserved; animated outputs use _animated suffix.','Procedural humanoid weights and hand-authored animation poses.','No vehicle or fence is included. Align vehicle seat, handlebars, steering wheel and obstacle in application.','Vault translation over a fence must be supplied by the application.','All clips in place; root stays at origin.','Bike_Mount is a standing-to-seated transition; tune vehicle placement.']}
with open(os.path.join(OUT,'animation_report.json'),'w') as f:json.dump(report,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'reference_model_animated.blend'))
result=report
