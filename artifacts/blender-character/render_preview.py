import bpy
bpy.context.scene.render.filepath = r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character\preview_01.png'
bpy.ops.render.render(write_still=True)
result={'render':bpy.context.scene.render.filepath}
