"""Inspect the supplied combat rigs with Blender. Run from the repository root:
blender --background --factory-startup --python-exit-code 1 --python scripts/inspectBlenderCombatRigs.py
"""
import hashlib
import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "blender-combat-rigs"
SOURCES = [
    ROOT / "public/models/characters/boy-combat-animated.glb",
    ROOT / "public/models/characters/girl-combat-animated.glb",
    ROOT / "public/models/enemies/ghost-woman-combat-animated.glb",
]


def vec(v):
    return [round(float(x), 7) for x in v]


def inspect_source(path):
    data = path.read_bytes()
    size, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4e4f534a
    return json.loads(data[20:20 + size]), hashlib.sha256(data).hexdigest()


def inspect_one(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    model, digest = inspect_source(path)
    bpy.ops.import_scene.gltf(filepath=str(path))
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    assert len(rigs) == 1, [o.name for o in rigs]
    rig, = rigs
    skin, = model['skins']
    joints = {model['nodes'][i]['name'] for i in skin['joints']}
    bones = rig.data.bones
    # Resolve anatomical labels against actual imported names and validate each chain below.
    by_suffix = {b.name.split(':')[-1]: b for b in bones if b.name in joints}
    chains = {
        'torso': ['Hips','Spine','Spine1','Spine2','Neck','Head'],
        **{s+' arm': ['Spine2']+[s+n for n in ['Shoulder','Arm','ForeArm','Hand']] for s in ['Left','Right']},
        **{s+' leg': ['Hips']+[s+n for n in ['UpLeg','Leg','Foot','ToeBase']] for s in ['Left','Right']},
    }
    resolved = {}
    for label, names in chains.items():
        chain = [by_suffix[n] for n in names]
        assert all(b.parent == a for a,b in zip(chain,chain[1:])), (label,chain)
        resolved[label] = [b.name for b in chain]
    assert joints.issubset(bones.keys()), joints.difference(bones.keys())
    def head(label):
        return rig.matrix_world @ by_suffix[label].head_local
    up = Vector((0,0,1))
    forward = sum((head(s+'ToeBase')-head(s+'Foot') for s in ['Left','Right']), Vector())
    forward.z = 0
    forward.normalize()
    arms = {s:round(math.degrees((head(s+'Hand')-head(s+'Arm')).angle(up))-90,2) for s in ['Left','Right']}
    actions = {}
    for anim in model['animations']:
        action = bpy.data.actions.get(anim['name'])
        assert action is not None, (path,anim['name'],list(bpy.data.actions.keys()))
        action.use_fake_user = True
        tracks = anim['channels']
        actions[action.name] = {
            'blender_frames':vec(action.frame_range),
            'duration_s':max(model['accessors'][sam['input']]['max'][0] for sam in anim['samplers']),
            'channels':[{ 'bone': model['nodes'][c['target']['node']]['name'], 'property': c['target']['path'],
                'keys':model['accessors'][anim['samplers'][c['sampler']]['input']]['count']} for c in tracks],
        }
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    constraints = [(p.name,c.name,c.type) for p in rig.pose.bones for c in p.constraints]
    shapes = {p.custom_shape.name for p in rig.pose.bones if p.custom_shape}
    body_forward = (head('LeftArm') - head('RightArm')).cross(up).normalized()
    parents = {b.name:b.parent.name if b.parent else None for b in bones}
    report = dict(source=path.relative_to(ROOT).as_posix(),sha256=digest,armature=rig.name,
        source_skin_joint_count=len(joints),blender_bone_count=len(bones),chains=resolved,
        world_up=[0,0,1],toe_forward_blender_world=vec(forward),
        shoulder_forward_blender_world=vec(body_forward),arm_degrees_below_horizontal=arms,
        blender_bones=[dict(name=b.name,parent=parents[b.name],deform=b.use_deform,
            head=vec(rig.matrix_world @ b.head_local),tail=vec(rig.matrix_world @ b.tail_local)) for b in bones],
        armature_world_matrix=[vec(row) for row in rig.matrix_world],
        meshes=[dict(name=o.name,vertices=len(o.data.vertices),faces=len(o.data.polygons),
            armature_binding=any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)) for o in meshes],
        materials=[m.name for m in bpy.data.materials],source_images=[i.get('name','') for i in model.get('images',[])],
        constraints=constraints,importer_bone_display_objects=sorted(shapes),
        object_constraints=[(c.name,c.type) for c in rig.constraints],actions=actions)
    bound = [m for m in report['meshes'] if m['armature_binding']]
    assert len(bound) == len(model['meshes'])
    assert all(m['armature_binding'] or m['name'] in shapes for m in report['meshes'])
    bpy.ops.file.pack_all()
    images=[im for im in bpy.data.images if im.source=='FILE']
    assert all(im.packed_file for im in images)
    report['packed_images']=[dict(name=im.name,pixels=list(im.size)) for im in images]
    scene=bpy.context.scene
    report['fps']=scene.render.fps/scene.render.fps_base
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    # Frame the imported character in the saved workspace. No object transforms are applied.
    feet=(head('LeftFoot')+head('RightFoot'))*.5
    center=(feet+head('Head'))*.5
    height=(head('Head')-feet).length
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            view=area.spaces.active.region_3d
            view.view_rotation=(-forward).to_track_quat('-Z','Y')
            view.view_location=center
            view.view_distance=height*2.2
    target=OUT/(path.stem+'.blend')
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(target))
    rig=bpy.data.objects[report['armature']]
    assert set(bpy.data.actions.keys())==set(actions)
    assert {b.name:b.parent.name if b.parent else None for b in rig.data.bones}==parents
    assert all(im.packed_file for im in bpy.data.images if im.source=='FILE')
    for mesh in bound:
        data = bpy.data.objects[mesh['name']].data
        assert (len(data.vertices),len(data.polygons))==(mesh['vertices'],mesh['faces'])
    assert sorted(bpy.data.materials.keys())==sorted(report['materials'])
    report['verified_reopened_blend']=target.name

    # Disposable solver probe on the reopened copy. The following changes are never saved.
    scene=bpy.context.scene
    rig.animation_data_clear()
    rig.data.pose_position='POSE'
    for p in rig.pose.bones:
        p.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    probes={}
    for label,names in resolved.items():
        if label=='torso':continue
        upper,lower,end=names[-3:] if label.endswith('arm') else names[1:4]
        a,b,c=[rig.pose.bones[n] for n in (upper,lower,end)]
        origin=rig.matrix_world @ a.head
        tip=rig.matrix_world @ c.head
        span=(tip-origin).length
        target_pos=origin+.80*(tip-origin)+forward*(.12*span)
        marker=bpy.data.objects.new('Disposable IK target',None)
        scene.collection.objects.link(marker)
        marker.location=target_pos
        constraint=c.constraints.new('IK')
        constraint.target=marker
        constraint.use_tail=False
        constraint.chain_count=2
        bpy.context.view_layer.update()
        evaluated=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        result=evaluated.matrix_world @ evaluated.pose.bones[end].head
        probes[label]={'chain':[upper,lower,end],'initial_target_distance':(tip-target_pos).length,
            'achieved_error':(result-target_pos).length,'error_percent_span':100*(result-target_pos).length/span}
        assert probes[label]['error_percent_span'] < .1, (label,probes[label])
        c.constraints.remove(constraint)
        bpy.data.objects.remove(marker,do_unlink=True)
        bpy.context.view_layer.update()
    report['temporary_ik_tests']=probes
    assert inspect_source(path)[1]==digest
    return report


OUT.mkdir(exist_ok=True,parents=True)
results=[inspect_one(p) for p in SOURCES]
(OUT/'inspection.json').write_text(json.dumps({'blender':bpy.app.version_string,'rigs':results},indent=2),encoding='utf-8')
for r in results:
    print('RIG REPORT',r['armature'],r['source_skin_joint_count'],r['blender_bone_count'],r['arm_degrees_below_horizontal'],r['toe_forward_blender_world'],r['temporary_ik_tests'])

