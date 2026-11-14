import bpy,os
OUT=r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character'
scene=bpy.data.scenes['Web Character - Final'];bpy.context.window.scene=scene;rig=bpy.data.objects['Canolia_Rig']
for name,frame in [('Vault',27),('Walk',4),('Bike_Drive',15),('Car_Drive',30)]:
 rig.animation_data.action=bpy.data.actions[name];scene.frame_set(frame);scene.render.filepath=os.path.join(OUT,'animation_previews',name+'.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
scene.render.filepath=os.path.join(OUT,'animation_previews','Idle.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'reference_model_animated.blend'))
result={'previews_updated':True}
