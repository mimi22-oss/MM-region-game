"""Author a seamless sword combat idle for both existing Mixamo combat rigs.

Run from the repository root with Blender 5.2 in background mode. Set
COMBAT_IDLE_OUTPUT to choose a destination when the workspace disk is full.
"""
import json
import math
import os
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import authorBlenderSwordTakes as sword

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('COMBAT_IDLE_OUTPUT', ROOT / 'artifacts' / 'blender-combat-idle'))
OUT.mkdir(parents=True, exist_ok=True)
FPS = 24
DURATION = 3.2
sword.STROKES['Combat_Idle'] = (DURATION, [(0, sword.GUARD), (1, sword.GUARD)])


class IdleFighter(sword.Fighter):
    def pose(self, name, t):
        assert name == 'Combat_Idle'
        self.reset()
        phase = 2 * math.pi * t
        breath = math.sin(2 * phase - .35)
        weight = math.sin(phase - .65)
        yaw, elevation = 19 + 1.2 * weight, 48 + 1.3 * breath
        self.hip_shift = Vector((.024 * weight, -.012 * breath,
                                 -.14 + .006 * breath)) * self.reach
        self.d['Hips'] = sword.turn(5 + 1.4 * weight) @ sword.rot(sword.X, -4.8)
        for bone, blend in [('Spine', .32), ('Spine1', .67), ('Spine2', 1)]:
            self.d[bone] = (sword.turn(5 + blend * (8 + 1.5 * weight))
                            @ sword.rot(sword.X, -4.8 + blend * 1.1 * breath)
                            @ sword.rot(sword.Y, -1.2 * blend * weight))
        self.d['Neck'] = sword.turn(2 - weight) @ sword.rot(sword.X, -2)
        self.d['Head'] = sword.turn(-1.4 - .7 * weight) @ sword.rot(sword.X, -1.5)
        for side, sign in [('Left', 1), ('Right', -1)]:
            self.d[side + 'Shoulder'] = self.d['Spine2'] @ sword.rot(
                sword.Y, -sign * (4 + .5 * breath))
            ankle = side + 'Foot'
            anchor = self.p[ankle] + Vector((sign * .13, -sign * .21, 0)) * self.reach
            self.fit([side + 'UpLeg', side + 'Leg', ankle], anchor,
                     Vector((sign * .23, -1, .1)))
            self.d[ankle] = sword.turn(sign * 6)
        center = (self.pos('LeftArm') + self.pos('RightArm')) * .5
        rad = math.radians
        blade = Vector((-math.sin(rad(yaw)) * math.cos(rad(elevation)),
                        -math.cos(rad(yaw)) * math.cos(rad(elevation)),
                        math.sin(rad(elevation))))
        palm = center + Vector((-.16 + .009 * weight,
                                -.51 + .009 * breath,
                                -.16 + .012 * breath)) * self.reach
        self.hand('Right', palm, blade, Vector((-.9, .28, -.60)), 1)
        free = center + Vector((.78 - .012 * weight,
                                -.60 + .009 * weight,
                                -.40 + .012 * breath)) * self.reach
        self.hand('Left', free, Vector((.3, -.2, .93)),
                  Vector((.9, .22, -.57)), .3)
        return blade


def verify_export(path):
    document, buffer = sword.read_glb(path)
    clip = next(a for a in document['animations'] if a['name'] == 'Combat_Idle')
    assert len(document['animations']) == 23
    assert any(n.get('name') == 'SwordGrip' for n in document['nodes'])
    seam = velocity = 0.0
    for channel in clip['channels']:
        accessor = document['accessors'][clip['samplers'][channel['sampler']]['output']]
        view = document['bufferViews'][accessor['bufferView']]
        width = {'VEC3': 3, 'VEC4': 4}[accessor['type']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride', width * 4)
        count = accessor['count']
        def sample(index):
            return struct.unpack_from('<' + 'f' * width, buffer, offset + index * stride)
        first, second, before_last, last = (sample(i) for i in (0, 1, count-2, count-1))
        seam = max(seam, math.dist(first, last))
        velocity = max(velocity, math.dist(
            [b-a for a, b in zip(first, second)],
            [b-a for a, b in zip(before_last, last)]))
    assert seam < 1e-4 and velocity < 1e-4, (seam, velocity)
    return {'loop_seam_max_channel_delta': seam,
            'loop_velocity_max_channel_delta': velocity,
            'retained_clip_count': len(document['animations']),
            'has_sword_grip_socket': True}


def add_preview_camera(fighter):
    scene = bpy.context.scene
    center = fighter.p['Hips'] + Vector((0, -.08, .06)) * fighter.reach
    height = (fighter.p['Head'] - fighter.p['LeftFoot']).length
    data = bpy.data.cameras.new('Combat idle preview camera')
    camera = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(camera)
    camera.location = center + Vector((1.35, -3.8, 1)) * height
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    data.type, data.ortho_scale = 'ORTHO', height * 1.65
    scene.camera = camera
    for name, offset, energy, color in [
        ('Key', (-1.5, -2.2, 2.5), 550, (1, .89, .73)),
        ('Fill', (2, -1, 1.2), 360, (.67, .79, 1)),
    ]:
        light_data = bpy.data.lights.new(name + ' · combat idle', 'AREA')
        light = bpy.data.objects.new(light_data.name, light_data)
        scene.collection.objects.link(light)
        light.location = center + Vector(offset) * height
        light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
        light_data.energy, light_data.color = energy, color
        light_data.shape, light_data.size = 'DISK', height * 1.4
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'


def author(kind):
    source = ROOT / 'artifacts' / 'blender-combat-rigs' / f'{kind}-combat-animated.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    scene.render.fps = FPS
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    rig.animation_data_clear()
    rig.animation_data_create()
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    fighter = IdleFighter(rig)
    grip = (Matrix.Translation(fighter.p['RightHand'] + fighter.offset['Right'])
            @ (-fighter.axis['Right']).to_track_quat('Z', 'Y').to_matrix().to_4x4())
    action = fighter.make_action('Combat_Idle')
    glb = OUT / f'{kind}-combat-idle.glb'
    metrics = sword.build_export(
        fighter, ROOT / 'public' / 'models' / 'characters' / f'{kind}-combat-animated.glb',
        glb, {'Combat_Idle': action}, grip)['Combat_Idle']
    metrics.update(verify_export(glb))
    sword.attach_preview(fighter, grip)
    rig.animation_data.action = action
    scene.frame_start, scene.frame_end = 0, round(DURATION * FPS)
    scene.frame_set(0)
    add_preview_camera(fighter)
    bpy.context.preferences.filepaths.save_version = 0
    blend = OUT / f'{kind}-combat-idle.blend'
    if blend.exists():
        blend.unlink()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    scene.render.filepath = str(OUT / f'{kind}-combat-idle.png')
    bpy.ops.render.render(write_still=True)
    metrics.update(source=str(source.relative_to(ROOT)), blend=blend.name,
                   glb=glb.name, preview=Path(scene.render.filepath).name)
    return metrics


if __name__ == '__main__':
    report = {kind: author(kind) for kind in ('boy', 'girl')}
    (OUT / 'verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))
