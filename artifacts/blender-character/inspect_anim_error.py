import bpy
result={'meshes':[(o.name,len(o.data.vertices),[m.name if m else None for m in o.data.materials],len(o.vertex_groups)) for o in bpy.data.collections['Optimized Web Character'].objects if o.type=='MESH'],'rigs':[(o.name,len(o.data.bones)) for o in bpy.context.scene.objects if o.type=='ARMATURE']}
