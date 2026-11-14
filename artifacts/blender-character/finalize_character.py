import bpy, os, json, math
from mathutils import Vector
OUT=r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character'
source=bpy.data.scenes['Reference Character Studio'];bpy.context.window.scene=source
# Last silhouette and material refinements before reduction.
for o in bpy.data.collections['Face'].objects:
 if o.name.startswith('Lower lip'):o.hide_render=True
for o in bpy.data.collections['Hair'].objects:
 if o.type=='MESH' and o.name!='Hair sculpted cap':
  # Compress the tallest locks toward the scalp for a less inflated silhouette.
  for v in o.data.vertices:
   if v.co.z>3.42:v.co.z=3.42+(v.co.z-3.42)*.78
bpy.data.materials['Deep brown iris'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.095,.037,.012,1)
hood=bpy.data.objects['Hood sewn shell']
for v in hood.data.vertices:
 if v.co.z>2.43:v.co.x*=1.12;v.co.z+=.025
floor=bpy.data.materials['Studio light gray'].node_tree.nodes['Principled BSDF'];floor.inputs['Emission Color'].default_value=(.65,.65,.70,1);floor.inputs['Emission Strength'].default_value=.30
# Collect evaluated geometry by material, preserving source editability.
deps=bpy.context.evaluated_depsgraph_get();buckets={};source_triangles=0
for o in list(bpy.data.collections['Canolia Character'].all_objects):
 if o.hide_render or o.type not in {'MESH','CURVE','FONT'}:continue
 ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();source_triangles+=len(me.loop_triangles)
 for tri in me.loop_triangles:
  material=me.materials[tri.material_index] if len(me.materials)>tri.material_index else bpy.data.materials['Hoodie violet cotton']
  key=material.name
  if key not in buckets:buckets[key]={'verts':[],'faces':[],'map':{},'material':material}
  b=buckets[key];indices=[]
  for vi in tri.vertices:
   k=(o.name,vi)
   if k not in b['map']:
    b['map'][k]=len(b['verts']);b['verts'].append(tuple((o.matrix_world@me.vertices[vi].co)*.5))
   indices.append(b['map'][k])
  b['faces'].append(tuple(indices))
 ev.to_mesh_clear()
web=bpy.data.scenes.new('Web Character - Final');bpy.context.window.scene=web
col=bpy.data.collections.new('Optimized Web Character');web.collection.children.link(col)
root=bpy.data.objects.new('Canolia Character Root',None);col.objects.link(root)
root['height_units']='meters';root['rigged']=False;root['reference']='Provided front portrait; back geometry estimated'
stats=[]
for name,b in buckets.items():
 me=bpy.data.meshes.new(name+' geometry');me.from_pydata(b['verts'],[],b['faces']);me.update()
 o=bpy.data.objects.new(name,me);col.objects.link(o);o.parent=root;me.materials.append(b['material'])
 for p in me.polygons:p.use_smooth=True
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if len(me.polygons)>1200:
  mod=o.modifiers.new('Web reduction','DECIMATE');mod.ratio=max(.10,min(.65,65000/source_triangles));mod.use_collapse_triangulate=True
  bpy.ops.object.modifier_apply(modifier=mod.name)
 o.data.calc_loop_triangles();stats.append({'material':name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'triangles':len(o.data.loop_triangles)})
# Final render uses the same optimized geometry that is exported.
st=bpy.data.collections.new('Final studio');web.collection.children.link(st)
for ob in bpy.data.collections['Studio'].objects:
 cp=ob.copy();cp.data=ob.data.copy();st.objects.link(cp);cp.location=ob.location*.5
 if cp.type=='MESH':cp.scale=ob.scale*.5
 elif cp.type=='LIGHT':cp.data.energy*=.25;cp.data.size*=.5
 elif cp.type=='CAMERA':cp.data.ortho_scale*=.5;web.camera=cp
web.world=source.world.copy();web.render.engine='BLENDER_EEVEE';web.render.resolution_x=620;web.render.resolution_y=1280;web.render.resolution_percentage=100
web.render.image_settings.file_format='PNG';web.render.filepath=os.path.join(OUT,'reference_model_render.png');web.view_settings.view_transform='AgX'
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
glb=os.path.join(OUT,'reference_model.glb')
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
# Read back the GLB into a validation scene, independently of the authored meshes.
validation=bpy.data.scenes.new('GLB import validation');bpy.context.window.scene=validation
bpy.ops.import_scene.gltf(filepath=glb)
imported=[o for o in validation.objects if o.type=='MESH'];itris=0;bounds=[]
for o in imported:
 o.data.calc_loop_triangles();itris+=len(o.data.loop_triangles);bounds.extend([tuple(o.matrix_world@Vector(v)) for v in o.bound_box])
report={'connection':'Blender local MCP socket bridge localhost:9876; direct execution verified','blender_version':bpy.app.version_string,'source_evaluated_triangles':source_triangles,'export_vertices':sum(s['vertices'] for s in stats),'export_polygons':sum(s['polygons'] for s in stats),'export_triangles':sum(s['triangles'] for s in stats),'mesh_objects':len(stats),'material_count':len(stats),'textures':0,'materials':stats,'glb_validation':{'mesh_objects':len(imported),'triangles':itris,'height_m':max(v[2] for v in bounds)-min(v[2] for v in bounds)},'rigged':False,'notes':['Separate original Scene preserved.','Editable source and reduced final model retained in separate scenes.','Face, swept hairstyle, fabric wrinkles and hands are simplified relative to reference.','Rear head, hood and shoe depth estimated from one front image.','Static model; no skeleton or animations.']}
assert itris==report['export_triangles'],(itris,report['export_triangles'])
bpy.context.window.scene=web
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  area.spaces.active.region_3d.view_perspective='CAMERA'
  area.spaces.active.clip_end=500
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'reference_model.blend'))
bpy.ops.render.render(write_still=True)
report['files']={name:{'path':os.path.join(OUT,name),'bytes':os.path.getsize(os.path.join(OUT,name))} for name in ['reference_model.blend','reference_model.glb','reference_model_render.png']}
with open(os.path.join(OUT,'model_report.json'),'w') as f:json.dump(report,f,indent=2)
result=report
