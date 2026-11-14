import bpy
result={'scene':bpy.context.scene.name,'scenes':[s.name for s in bpy.data.scenes],'objects':[(o.name,o.type) for o in bpy.data.collections['Optimized Web Character'].objects], 'export_animation_options':[p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties if 'anim' in p.identifier or 'skin' in p.identifier or 'nla' in p.identifier]}
