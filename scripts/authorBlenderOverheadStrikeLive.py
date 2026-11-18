"""Author the two-handed overhead strike in the currently connected Blender scene.

Run this file with the Blender MCP execute_blender_code tool, from the open
3D View workspace. It uses the active Mixamo armature and saves a new .blend.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype')
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'scripts'))
import authorBlenderSwordTakes as sword

OUTPUT = Path(r'D:\Myanmar-Town-Prototype-overhead-strike')
OUTPUT.mkdir(parents=True, exist_ok=True)
FPS = 24
DURATION = 2.0
ACTION_NAME = 'Overhead_Strike_TwoHanded_DeepStep'

# Time, blade yaw/elevation, right-palm across/forward/up, hips/chest turn,
# pelvis load/advance, right-foot step, backward torso lean.
KEYS = [
    (0.00, (12, 57, .13, .52, -.24,   8,  12, .15, -.03, 0,  7)),
    (0.22, ( 5, 99, .06, .39,  .24,  -8, -18, .22, -.07, 0, 13)),
    (0.38, ( 8,118, .03, .36,  .44, -17, -31, .28, -.08,.12,15)),
    (0.52, ( 7, 92, .06, .44,  .32,  -5,  -9, .29,  .24,.62, 7)),
    (0.66, (-1, 10, .04, .71, -.13,  12,  23, .30,  .75, 1,-2)),
    (0.77, (-9,-42, .12, .67, -.46,  22,  38, .33,  .90, 1,-5)),
    (0.86, (-8,-56, .13, .58, -.52,  25,  40, .32,  .92, 1,-3)),
    (1.00, (12, 31, .11, .51, -.28,  14,  22, .27,  .85, 1, 0)),
]


class OverheadFighter(sword.Fighter):
    def pose(self, t):
        self.reset()
        yaw, elevation, across, forward, up, hips, chest, load, advance, step, lean = sword.interpolate(KEYS, t)
        reach = self.reach
        self.hip_shift = Vector((-.06 * math.sin(math.radians(hips)), -advance, -load)) * reach
        self.d['Hips'] = sword.turn(hips) @ sword.rot(sword.X, -3 - lean * .45)
        for name, blend in [('Spine', .32), ('Spine1', .66), ('Spine2', 1)]:
            self.d[name] = (sword.turn(hips + (chest - hips) * blend)
                            @ sword.rot(sword.X, -3 - lean * blend)
                            @ sword.rot(sword.Y, -.10 * chest * blend))
        self.d['Neck'] = sword.turn(chest * .36) @ sword.rot(sword.X, -2)
        self.d['Head'] = sword.turn(chest * .16) @ sword.rot(sword.X, -2)
        for side, sign in [('Left', 1), ('Right', -1)]:
            self.d[side + 'Shoulder'] = self.d['Spine2'] @ sword.rot(
                sword.Y, -sign * (6 + 2 * math.sin(math.pi * t)))
            foot = side + 'Foot'
            anchor = self.p[foot] + Vector((sign * .13, -sign * .21, 0)) * reach
            if side == 'Right':
                anchor += Vector((-.04 * step, -1.80 * step,
                                  .25 * max(0, math.sin(math.pi * step)))) * reach
            self.fit([side + 'UpLeg', side + 'Leg', foot], anchor,
                     Vector((sign * .23, -1, .10)))
            self.d[foot] = sword.turn(sign * 6 - (5 * step if side == 'Right' else 0))
        center = (self.pos('LeftArm') + self.pos('RightArm')) * .5
        az, el = math.radians(yaw), math.radians(elevation)
        blade = Vector((-math.sin(az) * math.cos(el),
                        -math.cos(az) * math.cos(el), math.sin(el)))
        right_palm = center + Vector((-across, -forward, up)) * reach
        self.hand('Right', right_palm, blade, Vector((-.9, .28, -.6)), 1)
        # Both palms hold the same hilt from guard through recoil.
        left_palm = (self.pos('RightHand')
                     + self.delta('RightHand') @ self.offset['Right']
                     - blade * (.095 * self.unit))
        self.hand('Left', left_palm, blade, Vector((.9, .22, -.57)), 1)


def main():
    scene = bpy.context.scene
    rig = bpy.context.view_layer.objects.active
    assert rig and rig.type == 'ARMATURE', 'Select the warrior armature in the 3D View'
    assert all('mixamorig:' + name in rig.pose.bones for name in
               ('Hips', 'Spine2', 'RightHand', 'LeftHand', 'RightFoot', 'LeftFoot'))
    assert ACTION_NAME not in bpy.data.actions, 'Action already exists; inspect it before rerunning'
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    fighter = OverheadFighter(rig)
    rig.animation_data_create()
    action = bpy.data.actions.new(ACTION_NAME)
    action.use_fake_user = True
    rig.animation_data.action = action
    previous = {}
    samples = round(DURATION * 60)
    for index in range(samples + 1):
        t = index / samples
        frame = 1 + t * DURATION * FPS
        fighter.pose(t)
        hip = fighter.b['Hips']
        hip.location = fighter.rest['Hips'].to_3x3().inverted() @ fighter.hip_shift
        hip.keyframe_insert(data_path='location', frame=frame, group=hip.name)
        for name in fighter.d:
            rotation = fighter.local_q(name)
            if name in previous:
                rotation.make_compatible(previous[name])
            previous[name] = rotation.copy()
            bone = fighter.b[name]
            bone.rotation_mode = 'QUATERNION'
            bone.rotation_quaternion = rotation
            bone.keyframe_insert(data_path='rotation_quaternion', frame=frame,
                                 group=bone.name)
    grip = (Matrix.Translation(fighter.p['RightHand'] + fighter.offset['Right'])
            @ (-fighter.axis['Right']).to_track_quat('Z', 'Y').to_matrix().to_4x4())
    socket = bpy.data.objects.get('OverheadStrike_SwordGrip')
    if socket is None:
        socket = sword.attach_preview(fighter, grip)
        socket.name = 'OverheadStrike_SwordGrip'
    rig.animation_data.action = action
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, 49
    for name, frame in [('Guard', 1), ('Raise', 19), ('Step', 26),
                        ('Impact', 37), ('Follow through', 42), ('Recover', 49)]:
        if name not in scene.timeline_markers:
            scene.timeline_markers.new(name, frame=frame)
    # Isolate the active warrior in the 3D View without deleting the other rig.
    for other in scene.objects:
        if other.type == 'ARMATURE' and other != rig:
            other.hide_set(True)
            for child in other.children:
                child.hide_set(True)
    for view_area in bpy.context.screen.areas:
        if view_area.type == 'VIEW_3D':
            space = view_area.spaces.active
            space.overlay.show_overlays = False
            space.shading.type = 'MATERIAL'
            view = space.region_3d
            view.view_rotation = Vector((1.15, 1, -.10)).to_track_quat('-Z', 'Y')
            view.view_location = fighter.p['Hips'] + Vector((0, -.08, .10)) * fighter.reach
            view.view_distance = 2.1 * (fighter.p['Head'] - fighter.p['LeftFoot']).length
    scene.frame_set(37)
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.context.preferences.filepaths.save_version = 0
    target = OUTPUT / 'boy-overhead-strike-deep-step.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
    return {'saved': str(target), 'action': action.name, 'duration_seconds': DURATION,
            'frames': [scene.frame_start, scene.frame_end], 'key_samples': samples + 1,
            'rig': rig.name, 'sword_socket': socket.name}


result = main()
