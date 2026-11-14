import bpy, math, os, json, random
from mathutils import Vector
from math import sin, cos, pi
OUT = r'C:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype\artifacts\blender-character'
random.seed(12)
scene = bpy.data.scenes.new('Reference Character Studio')
bpy.context.window.scene = scene
model = bpy.data.collections.new('Canolia Character')
scene.collection.children.link(model)
studio = bpy.data.collections.new('Studio')
scene.collection.children.link(studio)
parts={}
for name in ['Face','Hair','Hoodie','Hands','Joggers','Sneakers']:
 c=bpy.data.collections.new(name); model.children.link(c); parts[name]=c
def mat(name,color,rough=.5,metal=0,sss=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
 p.inputs['Subsurface Weight'].default_value=sss
 return m
skin=mat('Warm peach skin',(0.68,.365,.205),.48,sss=.07)
earmat=mat('Inner ear warm rose',(.52,.19,.13),.6,sss=.05)
lip=mat('Soft warm smile',(.27,.105,.058),.6)
purple=mat('Hoodie violet cotton',(.115,.025,.30),.84)
rib=mat('Violet rib knit',(.09,.018,.23),.86)
hoodinside=mat('Hood interior',(.055,.012,.13),.9)
seammat=mat('Violet stitching',(.15,.038,.34),.85)
ivory=mat('Ivory cord and embroidery',(.83,.79,.68),.65)
pantsmat=mat('Charcoal cotton',(.018,.019,.028),.88)
pantsseam=mat('Charcoal stitching',(.031,.032,.043),.85)
hairmat=mat('Espresso hair',(.019,.012,.011),.38)
hairshine=mat('Warm hair ridges',(.032,.021,.018),.42)
white=mat('Warm white eye',(.92,.87,.77),.23)
iris=mat('Deep brown iris',(.16,.065,.022),.24)
irisrim=mat('Iris outer rim',(.025,.014,.008),.26)
pupil=mat('Pupils',(.003,.002,.001),.12)
shoe=mat('Off white leather',(.76,.76,.72),.58)
sole=mat('White rubber',(.87,.87,.83),.72)
shoeseam=mat('Shoe seams',(.56,.56,.54),.7)
def link(obj,collection):
 for c in list(obj.users_collection): c.objects.unlink(obj)
 collection.objects.link(obj)
def mesh(name,verts,faces,material,part,sub=0):
 me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
 ob=bpy.data.objects.new(name,me); parts[part].objects.link(ob); ob.data.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 if sub:
  mod=ob.modifiers.new('Soft tailored surface','SUBSURF'); mod.levels=sub; mod.render_levels=sub
 return ob
def uv(name,loc,scale,material,part,seg=32,rings=20):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc)
 ob=bpy.context.object; ob.name=name; ob.scale=scale; link(ob,parts[part]); ob.data.materials.append(material)
 for p in ob.data.polygons:p.use_smooth=True
 return ob
def curve(name,pts,radius,material,part,res=12):
 cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=res; cu.bevel_depth=radius; cu.bevel_resolution=3
 sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
 for p,co in zip(sp.bezier_points,pts):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 ob=bpy.data.objects.new(name,cu);parts[part].objects.link(ob);cu.materials.append(material);return ob
def loft(name,rings,material,part,n=40,sub=1):
 # z, center x, center y, half width, half depth
 vs=[]
 for z,x,y,rx,ry in rings:
  vs.extend([(x+rx*cos(t*2*pi/n),y+ry*sin(t*2*pi/n),z) for t in range(n)])
 fs=[tuple(reversed(range(n)))]
 for j in range(len(rings)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 fs.append(tuple((len(rings)-1)*n+i for i in range(n)))
 return mesh(name,vs,fs,material,part,sub)
def tube(name,points,widths,depths,material,part,n=12,sub=1):
 vs=[]
 for j,p in enumerate(points):
  tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)]);tangent.normalize()
  side=tangent.cross(Vector((0,-1,0))).normalized(); normal=side.cross(tangent).normalized()
  for i in range(n):vs.append(tuple(Vector(p)+side*cos(2*pi*i/n)*widths[j]+normal*sin(2*pi*i/n)*depths[j]))
 fs=[tuple(reversed(range(n)))]
 for j in range(len(points)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 fs.append(tuple((len(points)-1)*n+i for i in range(n)))
 return mesh(name,vs,fs,material,part,sub)
# Head: a continuous cheek / jaw surface rather than stacked shapes.
loft('Sculpted head',[(2.51,0,.015,.045,.07),(2.54,0,.008,.15,.15),(2.59,0,.005,.23,.20),(2.68,0,.008,.295,.238),(2.80,0,.012,.335,.265),(2.94,0,.015,.345,.267),(3.09,0,.025,.335,.265),(3.22,0,.04,.32,.255),(3.33,0,.05,.265,.215),(3.40,0,.055,.15,.135),(3.42,0,.055,.025,.03)],skin,'Face',n=64,sub=2)
loft('Neck',[(2.30,0,.02,.14,.13),(2.38,0,.025,.13,.12),(2.54,0,.027,.12,.12),(2.61,0,.035,.16,.14)],skin,'Face')
for s in [-1,1]:
 uv('Ear', (s*.345,.012,2.84),(.097,.065,.13),skin,'Face')
 uv('Ear concha',(s*.388,-.043,2.84),(.040,.018,.076),earmat,'Face')
 uv('Ear inner fold',(s*.371,-.054,2.825),(.022,.017,.045),skin,'Face')
 # spherical whites, shaped upper eyelids, brown corneas
 uv('Eye white',(s*.145,-.236,2.965),(.125,.066,.124),white,'Face',40,24)
 uv('Iris rim',(s*.137,-.294,2.964),(.078,.022,.091),irisrim,'Face')
 uv('Brown iris',(s*.137,-.309,2.964),(.067,.015,.079),iris,'Face')
 uv('Pupil',(s*.137,-.321,2.969),(.043,.009,.059),pupil,'Face')
 uv('Eye catchlight',(s*.137-.021,-.331,3.006),(.017,.005,.020),white,'Face',20,12)
 uv('Tiny eye glint',(s*.137+.022,-.330,2.938),(.006,.003,.007),white,'Face',16,8)
 curve('Upper eyelid',[(s*.145-.12,-.253,2.966),(s*.145-.085,-.275,3.055),(s*.145,-.276,3.085),(s*.145+.085,-.262,3.049),(s*.145+.12,-.248,2.965)],.009,hairmat,'Face')
 curve('Lower eyelid',[(s*.145-.114,-.249,2.95),(s*.145,-.274,2.847),(s*.145+.113,-.246,2.95)],.009,skin,'Face')
 tube('Expressive eyebrow',[(s*.064,-.252,3.13),(s*.102,-.27,3.134),(s*.19,-.257,3.127),(s*.26,-.227,3.103)],[.018,.025,.024,.004],[.013,.017,.015,.004],hairmat,'Face',n=10,sub=2)
uv('Nose bridge',(0,-.237,2.866),(.049,.050,.092),skin,'Face')
uv('Soft nose tip',(0,-.285,2.823),(.061,.056,.046),skin,'Face')
for s in [-1,1]:
 uv('Nose wing',(s*.045,-.272,2.81),(.027,.033,.025),skin,'Face',24,16)
 uv('Nostril',(s*.031,-.311,2.803),(.012,.006,.007),earmat,'Face',20,12)
curve('Gentle smile',[(-.114,-.234,2.735),(-.075,-.260,2.72),(0,-.27,2.715),(.075,-.258,2.726),(.114,-.232,2.743)],.006,lip,'Face')
curve('Lower lip',[(-.084,-.249,2.705),(0,-.263,2.695),(.082,-.248,2.713)],.009,skin,'Face')
# Tailored hoodie with a fuller lower torso.
loft('Hoodie body',[(1.51,0,.035,.30,.17),(1.54,0,.025,.355,.21),(1.62,0,.02,.38,.235),(1.88,0,.02,.36,.23),(2.13,0,.03,.36,.225),(2.30,0,.04,.405,.20),(2.40,0,.04,.35,.17),(2.46,0,.04,.22,.13),(2.47,0,.04,.17,.105)],purple,'Hoodie',n=56,sub=2)
loft('Ribbed waist band',[(1.46,0,.025,.31,.18),(1.48,0,.025,.335,.20),(1.54,0,.025,.345,.205),(1.57,0,.025,.34,.205)],rib,'Hoodie',n=48)
for i in range(70):
 t=2*pi*i/70
 curve('Hem knit rib',[(.335*cos(t),.025+.203*sin(t),1.48),(.34*cos(t),.025+.208*sin(t),1.54)],.0016,seammat,'Hoodie',res=1)
# white undershirt triangle
mesh('Undershirt at collar',[(-.11,-.132,2.43),(0,-.175,2.365),(.11,-.132,2.43)],[(0,1,2)],ivory,'Hoodie')
# Hood shell folded behind the neck. Open U mouth with deep lining.
uv('Hood folded back',(0,.115,2.435),(.29,.19,.165),purple,'Hoodie')
uv('Hood dark opening',(0,.061,2.515),(.232,.155,.077),hoodinside,'Hoodie')
curve('Hood rolled rim',[(-.10,-.141,2.39),(-.25,-.075,2.48),(-.285,.04,2.57),(-.20,.19,2.585),(0,.245,2.59),(.20,.19,2.585),(.285,.04,2.57),(.25,-.075,2.48),(.10,-.141,2.39)],.040,purple,'Hoodie')
for s in [-1,1]:
 loft('Relaxed hoodie sleeve',[(1.53,s*.55,.025,.09,.12),(1.59,s*.56,.025,.105,.14),(1.68,s*.55,.025,.12,.145),(1.79,s*.52,.025,.12,.14),(1.86,s*.49,.03,.13,.145),(1.94,s*.475,.04,.12,.14),(2.10,s*.44,.05,.125,.145),(2.27,s*.39,.05,.14,.15),(2.34,s*.335,.05,.125,.12)],purple,'Hoodie',n=32,sub=2)
 loft('Sleeve rib cuff',[(1.46,s*.55,.022,.083,.098),(1.47,s*.55,.022,.088,.105),(1.55,s*.55,.025,.092,.115),(1.58,s*.55,.025,.096,.12)],rib,'Hoodie',n=32)
 for i in range(28):
  t=2*pi*i/28
  curve('Cuff knit rib',[(s*.55+.089*cos(t),.022+.107*sin(t),1.48),(s*.55+.093*cos(t),.025+.116*sin(t),1.55)],.0015,seammat,'Hoodie',1)
 # subtle seam following sleeve
 curve('Sleeve seam',[(s*.42,-.092,2.26),(s*.49,-.105,1.99),(s*.55,-.114,1.7)],.002,seammat,'Hoodie')
 uv('Cord eyelet',(s*.103,-.177,2.395),(.016,.008,.020),ivory,'Hoodie',20,12)
 curve('Cream drawstring',[(s*.103,-.185,2.399),(s*.106,-.215,2.32),(s*.108,-.224,2.17),(s*.105,-.235,2.03),(s*.112,-.24,1.999)],.0065,ivory,'Hoodie')
 curve('Drawstring metal tip',[(s*.112,-.24,2.016),(s*.112,-.24,1.984)],.007,shoeseam,'Hoodie',1)
# Kangaroo pocket curved patch.
vs=[]; nx=18; nz=10
for j in range(nz+1):
 t=j/nz; z=1.60+t*.29; width=.29-.065*t
 for i in range(nx+1):
  x=(2*i/nx-1)*width; y=.02-.235*math.sqrt(max(.01,1-(x/.38)**2))-.008
  vs.append((x,y,z))
fs=[]
for j in range(nz):
 for i in range(nx):a=j*(nx+1)+i;fs.append((a,a+1,a+nx+2,a+nx+1))
mesh('Kangaroo pouch',vs,fs,purple,'Hoodie',1)
for s in [-1,1]:curve('Pocket slanted opening',[(s*.225,-.178,1.888),(s*.25,-.165,1.77),(s*.287,-.141,1.635)],.004,seammat,'Hoodie')
curve('Pocket upper stitch',[(-.224,-.178,1.89),(0,-.225,1.89),(.224,-.178,1.89)],.0024,seammat,'Hoodie')
# Embroidered line icon and text, all real geometry.
cx=.205; cy=-.192; cz=2.205
curve('Logo rounded badge',[(cx-.039,cy,cz-.034),(cx-.043,cy,cz+.035),(cx-.032,cy,cz+.045),(cx+.039,cy,cz+.043),(cx+.043,cy,cz-.034),(cx-.039,cy,cz-.034)],.0025,ivory,'Hoodie')
curve('Logo wallet outline',[(cx+.024,cy-.003,cz+.02),(cx-.022,cy-.003,cz+.02),(cx-.025,cy-.003,cz-.003),(cx+.023,cy-.003,cz-.003),(cx+.023,cy-.003,cz-.019),(cx-.024,cy-.003,cz-.019)],.002,ivory,'Hoodie')
for k in range(2):curve('Logo ledger line',[(cx-.013,cy-.004,cz+.009-k*.022),(cx+.012,cy-.004,cz+.009-k*.022)],.0015,ivory,'Hoodie',1)
def textobj(name,text,loc,size):
 cu=bpy.data.curves.new(name,'FONT');cu.body=text;cu.align_x='CENTER';cu.size=size;cu.extrude=.0006;cu.resolution_u=5
 ob=bpy.data.objects.new(name,cu);parts['Hoodie'].objects.link(ob);ob.location=loc;ob.rotation_euler=(pi/2,0,0);cu.materials.append(ivory)
textobj('Canolia embroidery','Canolia',(.205,-.201,2.139),.029)
textobj('Expense embroidery','Expense',(.205,-.206,2.106),.029)
# Hands with palms, four tapered fingers and opposed thumb.
for s in [-1,1]:
 uv('Palm',(s*.55,.012,1.38),(.082,.055,.125),skin,'Hands')
 for i in range(4):
  x=s*(.495+i*.035); z=1.335-abs(i-1)*.008; length=[.115,.15,.145,.11][i]
  tube('Finger',[(x,-.005,z),(x+s*.003,-.022,z-length*.38),(x-s*.012,-.043,z-length*.78),(x-s*.025,-.05,z-length)],[.020,.019,.016,.009],[.024,.021,.018,.009],skin,'Hands',n=10,sub=2)
 tube('Thumb',[(s*.494,-.014,1.42),(s*.46,-.033,1.37),(s*.445,-.044,1.315),(s*.457,-.053,1.295)],[.032,.028,.023,.012],[.031,.027,.022,.012],skin,'Hands',n=12,sub=2)
# Joggers, crotch and shaped tapered legs.
loft('Jogger hips',[(1.24,0,.028,.275,.17),(1.34,0,.035,.32,.195),(1.50,0,.04,.315,.19),(1.53,0,.035,.30,.18)],pantsmat,'Joggers',48,2)
for s in [-1,1]:
 loft('Tapered trouser leg',[(.37,s*.23,.025,.105,.11),(.405,s*.23,.025,.132,.13),(.44,s*.23,.025,.14,.14),(.48,s*.226,.025,.125,.132),(.56,s*.223,.028,.13,.14),(.75,s*.215,.035,.143,.15),(.91,s*.20,.035,.145,.16),(1.10,s*.175,.035,.155,.175),(1.28,s*.157,.035,.167,.185),(1.40,s*.155,.035,.163,.18)],pantsmat,'Joggers',40,2)
 loft('Jogger ankle cuff',[(.29,s*.23,.028,.092,.105),(.305,s*.23,.028,.10,.11),(.38,s*.23,.025,.105,.115),(.40,s*.23,.025,.108,.115)],pantsmat,'Joggers',32)
 uv('Cargo side pocket',(s*.329,.014,1.03),(.037,.12,.145),pantsmat,'Joggers')
 curve('Cargo pocket stitching',[(s*.346,-.09,1.15),(s*.354,-.10,1.02),(s*.35,-.09,.92)],.0025,pantsseam,'Joggers')
 curve('Trouser outer seam',[(s*.305,-.063,1.40),(s*.348,-.045,1.11),(s*.344,-.05,.81),(s*.322,-.043,.48)],.002,pantsseam,'Joggers')
curve('Fly seam',[(0,-.157,1.48),(0,-.168,1.38),(.014,-.163,1.29)],.002,pantsseam,'Joggers')
# Sneakers, broad toe box and layered outsoles, sculpted with rings.
for s in [-1,1]:
 x=s*.24
 uv('Ankle',(x,.024,.294),(.08,.083,.08),skin,'Face')
 loft('Purple outsole',[(.025,x,-.075,.132,.245),(.034,x,-.078,.155,.26),(.049,x,-.078,.16,.26),(.061,x,-.078,.15,.25)],purple,'Sneakers',48)
 loft('Rubber midsole',[(.048,x,-.078,.153,.253),(.067,x,-.078,.16,.26),(.105,x,-.078,.16,.256),(.122,x,-.078,.148,.242)],sole,'Sneakers',48)
 loft('Leather shoe upper',[(.096,x,-.074,.146,.235),(.14,x,-.071,.15,.23),(.19,x,-.042,.13,.202),(.25,x,.009,.104,.134),(.29,x,.029,.096,.112),(.315,x,.032,.09,.105)],shoe,'Sneakers',48,2)
 curve('Toe cap stitching',[(x-.124,-.175,.153),(x-.095,-.23,.165),(x,-.255,.173),(x+.095,-.23,.165),(x+.124,-.175,.153)],.0025,shoeseam,'Sneakers')
 uv('Shoe tongue',(x,-.08,.247),(.075,.085,.033),sole,'Sneakers')
 for k in range(5):
  y=-.045-k*.031;z=.275-k*.018;w=.059+k*.006
  curve('White shoelace',[(x-w,y,z),(x,y-.012,z+.01),(x+w,y,z)],.0065,ivory,'Sneakers',8)
  for ss in [-1,1]:uv('Lace eyelet',(x+ss*w,y,z-.002),(.01,.01,.003),shoeseam,'Sneakers',16,8)
 curve('Lace bow left',[(x,-.057,.289),(x-.048,-.04,.307),(x-.055,-.085,.299),(x,-.057,.289)],.005,ivory,'Sneakers')
 curve('Lace bow right',[(x,-.057,.289),(x+.05,-.04,.307),(x+.055,-.087,.299),(x,-.057,.289)],.005,ivory,'Sneakers')
# Hair scalp: custom varying hairline, sides descend around ears.
n=64; nr=14; vs=[]
for j in range(nr+1):
 t=j/nr
 for i in range(n):
  a=2*pi*i/n
  # front = -Y; lower side/back hairline
  front=max(0,-sin(a)); edge=2.91+.27*front
  z=edge+(3.48-edge)*sin(t*pi/2)
  width=.365*cos(t*pi/2);depth=.286*cos(t*pi/2)
  vs.append((width*cos(a),.048+depth*sin(a),z))
fs=[]
for j in range(nr):
 for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
mesh('Hair sculpted cap',vs,fs,hairmat,'Hair',1)
# Swept overlapping locks with tapered ends and fine flow grooves.
def lock(name,pts,width,depth):
 ob=tube(name,pts,[width*.30,width*.88,width,width*.74,width*.04],[depth*.4,depth,depth,depth*.75,.003],hairmat,'Hair',n=12,sub=2)
 for f in [-.43,0,.43]:
  path=[]
  for k,p in enumerate(pts[:-1]):path.append((p[0]+f*width,p[1]-depth*[.4,.95,.95,.7][k]-.001,p[2]+.004))
  path.append(pts[-1]);curve('Hair flow groove',path,.0018,hairshine,'Hair',8)
 return ob
lock('Hero swept fringe',[(.19,-.10,3.40),(.07,-.20,3.48),(-.13,-.27,3.41),(-.29,-.27,3.28),(-.37,-.17,3.22)],.095,.055)
lock('Forehead curl',[(.17,-.20,3.38),(.10,-.285,3.38),(.015,-.302,3.29),(-.015,-.302,3.19),(-.07,-.282,3.145)],.063,.045)
lock('Top sweep',[(.20,.015,3.45),(.08,-.075,3.55),(-.12,-.12,3.53),(-.26,-.12,3.45),(-.30,-.07,3.41)],.10,.054)
lock('Left flowing lock',[(.01,-.18,3.46),(-.16,-.245,3.43),(-.29,-.21,3.34),(-.35,-.16,3.20),(-.40,-.09,3.21)],.075,.043)
lock('Side flick', [(-.15,-.14,3.38),(-.27,-.22,3.32),(-.35,-.19,3.22),(-.37,-.17,3.13),(-.42,-.08,3.16)],.065,.035)
lock('Right temple sweep',[(.20,-.12,3.43),(.29,-.15,3.37),(.33,-.19,3.26),(.35,-.15,3.15),(.40,-.07,3.17)],.082,.048)
lock('Right swept ridge',[(.20,.02,3.45),(.29,-.045,3.44),(.36,-.07,3.34),(.37,-.02,3.24),(.40,.035,3.23)],.07,.047)
lock('Crown tuft',[(.07,.09,3.46),(.01,.035,3.53),(-.02,.0,3.56),(-.07,.0,3.58),(-.10,.04,3.61)],.047,.035)
for s in [-1,1]:
 lock('Temple taper',[(s*.285,.015,3.26),(s*.34,-.045,3.19),(s*.355,-.07,3.10),(s*.335,-.085,3.01),(s*.32,-.08,2.91)],.038,.025)
 for k in range(4):
  y=.06+k*.055
  lock('Back hair lock',[(s*.12,y,3.46-k*.015),(s*.25,y+.018,3.37-k*.02),(s*.33,y,3.19),(s*.33,y-.01,3.04),(s*.28,y-.025,2.94)],.055,.028)
# Studio
floor=mat('Studio light gray',(.62,.63,.66),.9)
bpy.ops.mesh.primitive_plane_add(size=200);ob=bpy.context.object;ob.name='Studio floor';link(ob,studio);ob.data.materials.append(floor)
world=bpy.data.worlds.new('Soft studio world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.62,.64,.70,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45;scene.world=world
def aim(ob,target):ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,energy,size,color):
 d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=loc;aim(o,(0,0,1.9))
area('Large softbox',(-3,-4,6),450,4,(1,.88,.77));area('Front fill',(3,-4,3),280,3,(.8,.87,1));area('Hair rim',(2,2,5),500,3,(.9,.87,1))
d=bpy.data.cameras.new('Reference portrait camera');cam=bpy.data.objects.new('Reference portrait camera',d);studio.objects.link(cam);cam.location=(0,-9,2.6);aim(cam,(0,0,1.82));d.type='ORTHO';d.ortho_scale=3.90;scene.camera=cam
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=620;scene.render.resolution_y=1280;scene.render.resolution_percentage=65
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(OUT,'preview_01.png');scene.view_settings.view_transform='AgX'
scene.render.film_transparent=False
scene['reference_notes']='Front-facing stylized boy from supplied image. Back hair, hood and shoe depth inferred. Separate from original Scene.'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'reference_model.blend'))
result={'scene':scene.name,'model_objects':len(model.all_objects),'materials':len(bpy.data.materials),'file':bpy.data.filepath}
