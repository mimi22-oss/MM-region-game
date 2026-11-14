import bpy
web=bpy.data.scenes['Web Character - Final'];bpy.context.window.scene=web
for o in bpy.data.collections['Optimized Web Character'].objects:
 if o.type=='MESH' and o.data.materials[0].name=='Warm hair ridges':
  for v in o.data.vertices:
   if v.co.z>1.71:v.co.z=1.71+(v.co.z-1.71)*.78
for o in bpy.data.collections['Hair'].objects:
 if o.type=='CURVE' and o.name.startswith('Hair flow groove'):
  for sp in o.data.splines:
   for p in sp.bezier_points:
    if p.co.z>3.42:p.co.z=3.42+(p.co.z-3.42)*.78
result={'hair_details_corrected':True}
