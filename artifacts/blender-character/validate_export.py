import bpy,os,json
from mathutils import Vector
OUT=r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character'
web=bpy.data.scenes['Web Character - Final'];bpy.context.window.scene=web
col=bpy.data.collections['Optimized Web Character'];root=bpy.data.objects['Canolia Character Root']
bpy.context.view_layer.update()
for o in web.objects:o.select_set(False)
for o in col.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
glb=os.path.join(OUT,'reference_model.glb')
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
old=bpy.data.scenes.get('GLB import validation')
if old:bpy.data.scenes.remove(old)
validation=bpy.data.scenes.new('GLB import validation');bpy.context.window.scene=validation
bpy.ops.import_scene.gltf(filepath=glb)
stats=[]
for o in col.objects:
 if o.type=='MESH':
  o.data.calc_loop_triangles();stats.append({'material':o.data.materials[0].name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'triangles':len(o.data.loop_triangles)})
imported=[o for o in validation.objects if o.type=='MESH'];itris=0;bounds=[]
for o in imported:
 o.data.calc_loop_triangles();itris+=len(o.data.loop_triangles);bounds.extend([tuple(o.matrix_world@Vector(v)) for v in o.bound_box])
report={'connection':'Blender local MCP socket bridge localhost:9876; direct execution verified','blender_version':bpy.app.version_string,'export_vertices':sum(s['vertices'] for s in stats),'export_polygons':sum(s['polygons'] for s in stats),'export_triangles':sum(s['triangles'] for s in stats),'mesh_objects':len(stats),'material_count':len(stats),'textures':0,'materials':stats,'glb_validation':{'mesh_objects':len(imported),'triangles':itris,'height_m':max(v[2] for v in bounds)-min(v[2] for v in bounds)},'rigged':False,'notes':['Separate original Scene preserved.','Editable source and reduced final model retained in separate scenes.','Face, swept hairstyle, fabric wrinkles and hands are simplified relative to reference.','Rear head, hood and shoe depth estimated from one front image.','Static model; no skeleton or animations.']}
assert itris==report['export_triangles'],(itris,report['export_triangles'])
assert len(imported)==len(stats)
bpy.context.window.scene=web
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'reference_model.blend'))
bpy.ops.render.render(write_still=True)
report['files']={name:{'path':os.path.join(OUT,name),'bytes':os.path.getsize(os.path.join(OUT,name))} for name in ['reference_model.blend','reference_model.glb','reference_model_render.png']}
with open(os.path.join(OUT,'model_report.json'),'w') as f:json.dump(report,f,indent=2)
result=report
