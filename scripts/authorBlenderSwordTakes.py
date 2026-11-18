"""Create two full-body sword takes in the inspected Blender projects.
Run inside Blender, with this file's __file__ set to its repository path.
"""
import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / 'artifacts/blender-combat-rigs'
OUT = ROOT / 'artifacts/blender-sword-takes'
OUT.mkdir(parents=True, exist_ok=True)
X, Y, Z = (Vector(v) for v in ((1,0,0),(0,1,0),(0,0,1)))
C = Matrix.Rotation(-math.pi/2, 4, 'X')
I = Quaternion()
FPS = 24
# Phase, blade yaw/elevation, palm across/forward/up (arm lengths from shoulders),
# pelvis turn, rib-cage turn, leg load, forward weight shift.
GUARD=(15,46,.15,.53,-.32,8,12,.13,0)
STROKES={
 'Slash_Left':(.62,[(0,GUARD),(.23,(-85,18,-.43,.38,-.15,-22,-48,.23,-.09)),
     (.37,(-66,12,-.32,.56,-.13,-13,-30,.20,-.02)),(.52,(0,7,.02,.83,-.18,9,6,.16,.12)),
     (.73,(84,-4,.68,.52,-.23,25,48,.20,.17)),(.83,(94,-13,.64,.39,-.31,27,52,.21,.15)),(1,GUARD)]),
 'Heavy_Slash':(1.1,[(0,GUARD),(.18,(30,89,.17,.48,.17,-10,-18,.20,-.08)),
     (.32,(40,112,.19,.46,.42,-19,-32,.28,-.12)),(.42,(29,104,.13,.52,.46,-12,-21,.22,-.04)),
     (.56,(9,55,.04,.65,.16,5,7,.15,.12)),(.72,(-12,-30,-.09,.65,-.42,18,30,.33,.24)),
     (.81,(-20,-47,-.12,.53,-.52,22,34,.34,.22)),(1,GUARD)])}

def interpolate(keys,t):
    # Cubic Hermite with slope limiting at reversals (held anticipation and clean recoil).
    for i in range(len(keys)-1):
        t0,a=keys[i];t1,b=keys[i+1]
        if t<=t1+1e-8:break
    h=t1-t0;u=max(0,min(1,(t-t0)/h))
    def slope(k,j):
        if k==0 or k==len(keys)-1:return 0
        p,v,n=keys[k-1:k+2]
        left=(v[1][j]-p[1][j])/(v[0]-p[0]);right=(n[1][j]-v[1][j])/(n[0]-v[0])
        return 2*left*right/(left+right) if left*right>0 else 0
    return [(2*u**3-3*u*u+1)*v+(u**3-2*u*u+u)*h*slope(i,j)
            +(-2*u**3+3*u*u)*b[j]+(u**3-u*u)*h*slope(i+1,j) for j,v in enumerate(a)]

def basis(axis,direction):
    x=axis.normalized();y=(direction-x*direction.dot(x)).normalized()
    return Matrix((x,y,x.cross(y))).transposed().to_quaternion()

def rot(axis,degrees):
    return Quaternion(axis,math.radians(degrees))

def turn(yaw):return rot(Z,-yaw)

class Fighter:
    def __init__(self,rig):
        self.rig=rig
        self.b={p.name.split(':')[-1]:p for p in rig.pose.bones}
        self.rest={k:rig.matrix_world@p.bone.matrix_local for k,p in self.b.items()}
        self.p={k:m.translation.copy() for k,m in self.rest.items()}
        self.q={k:m.to_quaternion() for k,m in self.rest.items()}
        self.parent={k:p.parent.name.split(':')[-1] if p.parent else None for k,p in self.b.items()}
        self.reach=sum((self.p[a]-self.p[b]).length for a,b in [('RightArm','RightForeArm'),('RightForeArm','RightHand')])
        skinned=next(o for o in bpy.context.scene.objects if any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers))
        heights=[(skinned.matrix_world@v.co).z for v in skinned.data.vertices]
        self.unit=(max(heights)-min(heights))/1.8
        self.offset={};self.palm={};self.axis={}
        for side in ('Left','Right'):
            hand=side+'Hand'
            self.offset[side]=.62*(self.p[hand+'Middle1']-self.p[hand])
            self.axis[side]=(self.p[hand+'Index1']-self.p[hand+'Pinky1']).normalized()
            self.palm[side]=basis(self.axis[side],self.offset[side])
        self.reset()
    def reset(self):
        self.d={};self.hip_shift=Vector()
    def delta(self,k):
        if k in self.d:return self.d[k]
        parent=self.parent[k]
        return self.delta(parent) if parent else I
    def pos(self,k):
        parent=self.parent[k]
        if not parent:return self.p[k]+self.hip_shift
        return self.pos(parent)+self.delta(parent)@(self.p[k]-self.p[parent])
    def local_q(self,k):
        parent=self.parent[k]
        parent_delta=self.delta(parent) if parent else I
        return self.q[k].inverted()@parent_delta.inverted()@self.delta(k)@self.q[k]
    def fit(self,chain,target,pole):
        a,b,c=chain;root=self.pos(a)
        ab=self.p[b]-self.p[a];bc=self.p[c]-self.p[b];l,m=ab.length,bc.length
        ray=target-root;v=ray.normalized();dist=max(abs(l-m)+1e-6,min(l+m-1e-6,ray.length))
        elbow_axis=(pole-v*pole.dot(v)).normalized()
        along=(l*l-m*m+dist*dist)/(2*dist)
        elbow=root+v*along+elbow_axis*math.sqrt(max(0,l*l-along*along))
        # Transport rest twist with the parent, then rotate the bone toward the solved joint.
        for k,old,new in [(a,ab,elbow-root),(b,bc,root+v*dist-elbow)]:
            inherited=self.delta(self.parent[k])
            self.d[k]=(inherited@old).rotation_difference(new)@inherited
        return (root+v*dist-elbow).normalized()
    def hand(self,side,palm,blade,pole,grip):
        chain=[side+n for n in ('Arm','ForeArm','Hand')];hand=chain[-1]
        # Solve the offset palm, then orient the knuckles down the handle.
        d=self.delta(chain[0])
        for _ in range(5):
            fore=self.fit(chain,palm-d@self.offset[side],pole)
            d=basis(blade,fore)@self.palm[side].inverted()
        self.d[hand]=d
        for finger in ('Index','Middle','Ring','Pinky','Thumb'):
            for joint in range(1,4):
                k=hand+finger+str(joint)
                if k not in self.b:continue
                inherited=self.delta(self.parent[k]);axis=self.axis[side].copy()
                if axis.cross(self.offset[side]).z>0:axis.negate()
                angle=(38 if finger=='Thumb' else (46,64,48)[joint-1])*grip
                self.d[k]=inherited@rot(axis,angle)
    def pose(self,name,t):
        self.reset()
        yaw,elev,x,f,z,hips,chest,load,advance=interpolate(STROKES[name][1],t)
        reach=self.reach;heavy=name=='Heavy_Slash';wave=math.sin(math.pi*t)
        self.hip_shift=Vector((-.08*math.sin(math.radians(hips)), -advance, -load))*reach
        self.d['Hips']=turn(hips)@rot(X,-3-load*12)
        for k,w in [('Spine',.32),('Spine1',.65),('Spine2',1)]:
            self.d[k]=turn(hips+(chest-hips)*w)@rot(X,-3-load*(12+12*w))@rot(Y,-.10*chest*w)
        self.d['Neck']=turn(chest*.38)@rot(X,-3)
        self.d['Head']=turn(chest*.14)@rot(X,-2)
        for side,sign in [('Left',1),('Right',-1)]:
            shoulder=side+'Shoulder'
            self.d[shoulder]=self.d['Spine2']@rot(Y,-sign*(4+(7 if heavy else 3)*wave))
            ankle=side+'Foot'
            anchor=self.p[ankle]+Vector((sign*.13,-sign*.21,0))*reach
            self.fit([side+'UpLeg',side+'Leg',ankle],anchor,Vector((sign*.23,-1,.1)))
            self.d[ankle]=turn(sign*6)
        center=(self.pos('LeftArm')+self.pos('RightArm'))*.5
        rad=math.radians
        blade=Vector((-math.sin(rad(yaw))*math.cos(rad(elev)),-math.cos(rad(yaw))*math.cos(rad(elev)),math.sin(rad(elev))))
        palm=center+Vector((-x,-f,z))*reach
        self.hand('Right',palm,blade,Vector((-.9,.28,-.60)),1)
        pommel=self.pos('RightHand')+self.delta('RightHand')@self.offset['Right']-blade*(.095*self.unit)
        offhand=center+Vector((.53+.23*wave,-.45+.28*wave,-.40-.10*wave))*reach
        if heavy:
            # Acquire during anticipation, release only after the blade has decelerated.
            w=min(1,t/.19,(1-t)/.16);w=w*w*(3-2*w)
        else:w=0
        self.hand('Left',offhand.lerp(pommel,w),Vector((.3,-.2,.93)).lerp(blade,w).normalized(),Vector((.9,.22,-.57)),.36+.64*w)
        return blade
    def make_action(self,name):
        rig=self.rig
        original=bpy.data.actions[name];original.name='Prototype · '+name;original.use_fake_user=True
        action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
        prev={}; duration=STROKES[name][0]; count=round(duration*100)
        for i in range(count+1):
            t=i/count;self.pose(name,t);frame=t*FPS*duration
            hip=self.b['Hips']
            hip.location=self.rest['Hips'].to_3x3().inverted()@self.hip_shift
            hip.keyframe_insert(data_path='location',frame=frame,group=hip.name)
            for k in self.d:
                q=self.local_q(k)
                if k in prev:q.make_compatible(prev[k])
                prev[k]=q.copy()
                p=self.b[k];p.rotation_mode='QUATERNION';p.rotation_quaternion=q
                p.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=p.name)
        return action

def read_glb(path):
    data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0]
    return json.loads(data[20:20+size]),bytearray(data[28+size:])

def gltf_local(node):
    if 'matrix' in node:return Matrix([node['matrix'][i:i+4] for i in range(0,16,4)]).transposed()
    xyzw=node.get('rotation',[0,0,0,1])
    return Matrix.LocRotScale(Vector(node.get('translation',[0,0,0])),
            Quaternion((xyzw[3],*xyzw[:3])),Vector(node.get('scale',[1,1,1])))

def trs(node,matrix):
    loc,q,scale=matrix.decompose()
    node.pop('matrix',None)
    node.update(translation=list(loc),rotation=[q.x,q.y,q.z,q.w],scale=list(scale))

def build_export(fighter,source,output,actions,grip_rest):
    # Write Blender-evaluated motion in each original glTF joint's frame. Keep all original
    # mesh, inverse-bind, texture, material and untouched action buffers verbatim.
    doc,buf=read_glb(source);nodes=doc['nodes']
    ids={n.get('name'):i for i,n in enumerate(nodes)}
    parent={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    rest={}
    def world(i):
        if i not in rest:
            rest[i]=(world(parent[i]) if i in parent else Matrix.Identity(4))@gltf_local(nodes[i])
        return rest[i]
    for i in range(len(nodes)):world(i)
    def accessor(values,width):
        while len(buf)%4:buf.append(0)
        start=len(buf)
        for v in values:buf.extend(struct.pack('<'+'f'*width,*v))
        idx=len(doc['bufferViews'])
        doc['bufferViews'].append(dict(buffer=0,byteOffset=start,byteLength=len(buf)-start))
        spec=dict(bufferView=idx,componentType=5126,count=len(values),type={1:'SCALAR',3:'VEC3',4:'VEC4'}[width])
        if width==1:spec.update(min=[values[0][0]],max=[values[-1][0]])
        doc['accessors'].append(spec)
        return len(doc['accessors'])-1
    rig=fighter.rig;scene=bpy.context.scene;results={}
    # This socket carries the exact hilt calibration previewed in Blender.
    hand=ids[fighter.b['RightHand'].name]
    node={'name':'SwordGrip'};trs(node,world(hand).inverted()@C@grip_rest@C.inverted())
    nodes[hand].setdefault('children',[]).append(len(nodes));nodes.append(node)
    for name,action in actions.items():
        rig.animation_data.action=action;duration=STROKES[name][0];count=round(duration*100)
        curves={};locations=[];worst_grip=0;foot_slip=0;anchors={}
        for i in range(count+1):
            t=i/count;frame=t*duration*FPS
            scene.frame_set(int(frame),subframe=frame-int(frame))
            evaluated=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
            pose={k:evaluated.matrix_world@evaluated.pose.bones[p.name].matrix for k,p in fighter.b.items()}
            def point(k,offset):return pose[k]@fighter.rest[k].inverted()@(fighter.p[k]+offset)
            palm=point('RightHand',fighter.offset['Right'])
            direction=(pose['RightHand']@fighter.rest['RightHand'].inverted()).to_3x3()@fighter.axis['Right']
            left=point('LeftHand',fighter.offset['Left'])
            if name=='Heavy_Slash' and .32<=t<=.75:
                worst_grip=max(worst_grip,(left-(palm-direction.normalized()*.095*fighter.unit)).length/fighter.unit)
            for side in ('Left','Right'):
                k=side+'Foot';pos=pose[k].translation;anchors.setdefault(k,pos.copy())
                foot_slip=max(foot_slip,(pos-anchors[k]).length/fighter.unit)
            posed={}
            for k in fighter.b:
                idx=ids[fighter.b[k].name]
                posed[idx]=C@pose[k]@fighter.rest[k].inverted()@C.inverted()@rest[idx]
            for k in fighter.d:
                idx=ids[fighter.b[k].name];par=parent.get(idx)
                pm=posed[par] if par in posed else rest[par] if par is not None else Matrix.Identity(4)
                local=pm.inverted()@posed[idx];q=local.to_quaternion()
                values=curves.setdefault(idx,[])
                if values:q.make_compatible(Quaternion((values[-1][3],*values[-1][:3])))
                values.append((q.x,q.y,q.z,q.w))
                if k=='Hips':locations.append(tuple(local.translation))
        times=accessor([(duration*i/count,) for i in range(count+1)],1)
        clip=next(a for a in doc['animations'] if a['name']==name);clip['channels']=[];clip['samplers']=[]
        def track(idx,path,data,width):
            sampler=len(clip['samplers']);clip['samplers'].append(dict(input=times,output=accessor(data,width),interpolation='LINEAR'))
            clip['channels'].append(dict(sampler=sampler,target=dict(node=idx,path=path)))
            if 'matrix' in nodes[idx]:trs(nodes[idx],gltf_local(nodes[idx]))
        for idx,values in curves.items():track(idx,'rotation',values,4)
        track(ids[fighter.b['Hips'].name],'translation',locations,3)
        results[name]={'duration':duration,'samples':count+1,'animated_bones':len(curves),
              'ankle_drift_game_m':foot_slip,'support_grip_error_game_m':worst_grip if name=='Heavy_Slash' else None}
    doc['buffers'][0]['byteLength']=len(buf);raw=json.dumps(doc,separators=(',',':')).encode()
    raw+=b' '*(-len(raw)%4);buf+=bytes(-len(buf)%4)
    output.write_bytes(struct.pack('<4sIIII',b'glTF',2,28+len(raw)+len(buf),len(raw),0x4e4f534a)+raw+struct.pack('<II',len(buf),0x004e4942)+buf)
    return results

def attach_preview(f,grip):
    rig=f.rig;rig.animation_data.action=None
    for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    socket=bpy.data.objects.new('SwordGrip',None);bpy.context.scene.collection.objects.link(socket)
    socket.parent=rig;socket.parent_type='BONE';socket.parent_bone=f.b['RightHand'].name
    bpy.context.view_layer.update();socket.matrix_world=grip
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/knife.glb'))
    objects=set(bpy.data.objects)-before
    coords=[o.matrix_world@Vector(corner) for o in objects if o.type=='MESH' for corner in o.bound_box]
    lo=Vector([min(p[i] for p in coords) for i in range(3)]);hi=Vector([max(p[i] for p in coords) for i in range(3)])
    pivot=(lo+hi)*.5;pivot.z=hi.z-.18*(hi.z-lo.z)
    size=.95*f.unit/max(hi-lo)
    for o in objects:
        if o.parent not in objects:
            mat=o.matrix_world.copy();o.parent=socket
            o.matrix_basis=Matrix.Scale(size,4)@Matrix.Translation(-pivot)@mat
    socket.empty_display_size=.03*f.unit
    return socket

def author(kind):
    scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
    scene.render.fps=FPS
    rig.animation_data_clear();rig.animation_data_create()
    for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    f=Fighter(rig)
    grip=Matrix.Translation(f.p['RightHand']+f.offset['Right'])@(-f.axis['Right']).to_track_quat('Z','Y').to_matrix().to_4x4()
    actions={name:f.make_action(name) for name in STROKES}
    results=build_export(f,ROOT/f'public/models/characters/{kind}-combat-animated.glb',OUT/f'{kind}-sword-fighting.glb',actions,grip)
    attach_preview(f,grip)
    # Two strips in one audition track allow playback with Space in the normal viewport.
    track=rig.animation_data.nla_tracks.new();track.name='Sword fighting · one hand / two hands'
    for name,start in [('Slash_Left',1),('Heavy_Slash',23)]:
        strip=track.strips.new(name,start,actions[name]);strip.extrapolation='HOLD'
        scene.timeline_markers.new('One hand' if start==1 else 'Two hands',frame=start)
    scene.frame_start=1;scene.frame_end=50;scene.frame_set(36)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=rig
    for area in bpy.context.window_manager.windows[0].screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.overlay.show_overlays=False
            space.shading.type='SOLID';space.shading.color_type='TEXTURE'
            view=space.region_3d;view.view_rotation=Vector((.46,1,-.14)).to_track_quat('-Z','Y')
            view.view_location=f.p['Hips']+Vector((0,-.1,.1))*f.reach
            view.view_distance=2.0*(f.p['Head']-f.p['LeftFoot']).length
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{kind}-sword-fighting.blend'),compress=True)
    return results

if __name__=='__main__':
    report={}
    for kind in ('girl','boy'):
        bpy.ops.wm.open_mainfile(filepath=str(REF/f'{kind}-combat-animated.blend'))
        report[kind]=author(kind)
    (OUT/'verification.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
