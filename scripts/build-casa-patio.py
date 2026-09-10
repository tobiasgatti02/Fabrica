"""Original Casa Patio production model. Blender 4.5+, metres, deterministic seed.
Run: blender -b --python scripts/build-casa-patio.py
Exports split exterior/interior GLBs, editable .blend, and matching fallback renders.
"""
import bpy, math, random, pathlib, json
from mathutils import Vector
R=pathlib.Path(__file__).resolve().parents[1]
A=R/'assets/casa-patio'; OUT=R/'web/public/models'; IMG=R/'web/public/images'
random.seed(41)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
# All authoring coordinates use the web convention: X right, Y up, Z toward visitor.
def xyz(p): return (p[0],-p[2],p[1])
def material(name, color, rough=.65, metal=0, texture=None):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
 if texture:
  for kind, socket in [('Diffuse','Base Color'),('rough','Roughness'),('nor_gl','Normal')]:
   p=A/f'{texture}_{kind}.jpg'
   if not p.exists(): continue
   img=bpy.data.images.load(str(p),check_existing=True)
   if kind=='Diffuse' and texture=='fabric_pattern_07': continue
   if kind!='Diffuse': img.colorspace_settings.name='Non-Color'
   tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=img
   if kind=='nor_gl':
    n=m.node_tree.nodes.new('ShaderNodeNormalMap'); n.inputs['Strength'].default_value=.38
    m.node_tree.links.new(tex.outputs['Color'],n.inputs['Color']);m.node_tree.links.new(n.outputs['Normal'],bs.inputs[socket])
   else:m.node_tree.links.new(tex.outputs['Color'],bs.inputs[socket])
 return m
concrete=material('Concrete / honed mineral',(.65,.63,.57),.82,texture='concrete_wall_006')
plaster=material('Limewash / warm white',(.73,.70,.63),.94)
oak=material('Oak / natural grain',(.38,.23,.12),.55,texture='oak_wood_planks')
bronze=material('Anodised bronze',(.11,.095,.065),.31,.72)
linen=material('Linen / woven ecru',(.63,.57,.45),.96,texture='fabric_pattern_07')
stone=material('Travertine',(.58,.53,.42),.72)
soil=material('Gravel',(.35,.33,.27),1,texture='gravel_floor_01')
sand=material('Site / limestone dust',(.57,.55,.49),1)
leafm=[material('Olive leaf '+str(i),c,.82) for i,c in enumerate([(.19,.23,.10),(.28,.32,.16),(.35,.37,.21)])]
bark=material('Olive / bark',(.19,.14,.085),.95)
black=material('Shadow gaps',(.025,.027,.023),.55)
ceramic=material('Ceramic / iron oxide',(.28,.105,.054),.9)
glass=material('Architectural glass',(.72,.84,.83),.085,.1)
gbs=glass.node_tree.nodes.get('Principled BSDF');gbs.inputs['Transmission Weight'].default_value=.98;gbs.inputs['IOR'].default_value=1.45
water=material('Still water',(.09,.23,.21),.13,.48)
lightmat=material('Warm LED',(.9,.68,.32),.45);bs=lightmat.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.65,.28,1);bs.inputs['Emission Strength'].default_value=2
roots={}
def root(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o); roots[name]=o;return o
for n in ['terrain','foundation','framing','walls','roof','windows','finishes','landscape','interior']:root(n)
def unit(name, stage, start, end, lift=.35):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=roots[stage]
 o['start']=start;o['end']=end;o['lift']=lift;return o
T=roots['terrain']
def finish(o,name,mat,parent,bevel=0):
 o.name=name;o.data.materials.append(mat);o.parent=parent
 if bevel:
  mod=o.modifiers.new('Manufactured edge','BEVEL');mod.width=bevel;mod.segments=4;mod.harden_normals=True
  for poly in o.data.polygons:poly.use_smooth=True
  mod=o.modifiers.new('Corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True
 return o
# Box UVs use real-world projections to prevent stretching across walls and boards.
def box(name,p,s,mat,parent,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object;o.dimensions=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 uv=o.data.uv_layers.active
 for poly in o.data.polygons:
  normal=poly.normal; axes=(0,1) if abs(normal.z)>.5 else ((0,2) if abs(normal.y)>.5 else (1,2))
  for li in poly.loop_indices:
   co=o.data.vertices[o.data.loops[li].vertex_index].co
   uvscale=14 if mat==linen else .55
   uv.data[li].uv=(co[axes[0]]*uvscale+.5,co[axes[1]]*uvscale+.5)
 return finish(o,name,mat,parent,min(bevel,min(s)/3))
def cylinder(name,p,r,depth,mat,parent,r2=None,vertices=20):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r if r2 is None else r2,radius2=r,depth=depth,location=xyz(p));o=bpy.context.object
 for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
 return finish(o,name,mat,parent,.008)
def branch(a,b,r,parent):
 av=Vector(xyz(a));bv=Vector(xyz(b));d=bv-av
 o=cylinder('Olive branch',tuple((Vector(a)+Vector(b))/2),r*.5,d.length,bark,parent,r2=r,vertices=7)
 o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
# A planted court, no toy-like floating plinth.
box('Ground',(0,-.32,0),(2000,.2,2000),sand,T,0)
box('Courtyard gravel',(-4.9,-.19,.3),(3.5,.05,9.6),soil,T)
box('Garden gravel',(5.8,-.19,-.4),(1.4,.05,8.2),soil,T)
for x in [-3.6,4.7]:
 for z in [-3.3,2.7]:
  box('Survey peg',(x,-.05,z),(.04,.36,.04),oak,T,0)
for z in [-3.3,2.7]:box('Survey line',(.55,-.017,z),(8.3,.009,.009),plaster,T,0)
# Footings assemble before the slab.
for i,x in enumerate([-3.55,.5,4.55]):
 for j,z in enumerate([-3.15,2.6]):
  u=unit('Footing_%d_%d'%(i,j),'foundation',.145+i*.008+j*.007,.20+i*.008+j*.007,-.28)
  box('Concrete pad',(x,-.06,z),(.9,.3,.9),concrete,u)
for i,z in enumerate([-3.2,2.65]):
 u=unit('Grade_beam_'+str(i),'foundation',.17+i*.012,.24+i*.012,-.25)
 box('Reinforced grade beam',(.5,.035,z),(8.9,.3,.35),concrete,u)
u=unit('Raft_slab','foundation',.215,.29,-.22)
box('Floor slab',(.5,.255,-.25),(9,.28,6.65),concrete,u,.028)
for i in range(2):box('Floating entry step',(.3,.05+i*.15,3.55-i*.47),(6.2,.13,.8),concrete,u,.025)
# Steel has thickness and real I-shaped sections.
for i,x in enumerate([-3.65,.5,4.65]):
 for j,z in enumerate([-3.25,2.7]):
  u=unit('Column_%d_%d'%(i,j),'framing',.295+i*.012+j*.006,.36+i*.012+j*.006,1.1)
  for dx in [-.073,.073]:box('Column flange',(x+dx,1.82,z),(.028,2.86,.17),bronze,u,.005)
  box('Column web',(x,1.82,z),(.14,2.86,.026),bronze,u,.004)
  box('Anchor plate',(x,.42,z),(.26,.045,.26),bronze,u,.006)
for i,z in enumerate([-3.25,2.7]):
 u=unit('Longitudinal_beam_'+str(i),'framing',.355+i*.02,.425+i*.01,1.4)
 for y in [3.19,3.36]:box('Beam flange',(.5,y,z),(8.6,.028,.19),bronze,u,.004)
 box('Beam web',(.5,3.27,z),(8.6,.17,.027),bronze,u,.004)
for i,x in enumerate([-3.65,.5,4.65]):
 u=unit('Cross_beam_'+str(i),'framing',.38+i*.008,.44+i*.008,1)
 box('Cross beam',(x,3.27,-.25),(.16,.2,6.1),bronze,u,.005)
# Masonry panels install sequentially; front portal is unobstructed at x=0.
wall_specs=[('Back',(.5,1.78,-3.25),(8.5,2.78,.22)),('West',(-3.65,1.78,-.25),(.24,2.78,6.1)),('East solid',(4.65,1.78,-2.05),(.24,2.78,2.5)),('Front cedar',(3.32,1.78,2.7),(2.55,2.78,.23)),('Front stone',(-3,1.78,2.7),(1.25,2.78,.24))]
for i,(name,p,s) in enumerate(wall_specs):
 u=unit('Panel_'+str(i),'walls',.447+i*.012,.51+i*.012,.65);box(name,p,s,plaster if i<3 else concrete,u,.018)
# A slab with parapet, shadow reveal, and inset timber ceiling.
u=unit('Roof_cassette','roof',.535,.615,2.15)
box('Concrete canopy',(.5,3.47,-.25),(9.75,.25,7.4),concrete,u,.024)
box('Roof membrane',(.5,3.609,-.25),(9.4,.035,7.06),soil,u,.004)
for z in [-3.88,3.38]:box('Parapet edge',(.5,3.67,z),(9.73,.18,.12),concrete,u,.01)
for x in [-4.31,5.31]:box('Parapet return',(x,3.67,-.25),(.12,.18,7.26),concrete,u,.01)
box('Recessed timber soffit',(.5,3.316,-.25),(9.4,.035,7.07),oak,u,.004)
# Independent glazing modules and metal reveals. Central portal left open for camera.
for i,(x,w) in enumerate([(-1.66,1.37),(1.39,1.25)]):
 u=unit('Glazing_front_'+str(i),'windows',.605+i*.013,.67+i*.013,.32)
 for xx in [x-w/2,x+w/2]:box('Mullion',(xx,1.82,2.74),(.042,2.85,.10),bronze,u,.005)
 for yy in [.42,3.22]:box('Transom',(x,yy,2.74),(w+.04,.045,.10),bronze,u,.004)
 box('Glass panel',(x,1.82,2.735),(w-.045,2.76,.012),glass,u,.001)
u=unit('Sliding_portal','windows',.625,.688,.22)
for y in [.42,3.22]:box('Recessed sliding track',(-.1,y,2.74),(4.45,.035,.18),bronze,u,.003)
for i in range(2):
 z=.1+i*1.7;u=unit('Glazing_side_'+str(i),'windows',.625+i*.01,.687+i*.01,.22)
 for zz in [z-.85,z+.85]:box('Side mullion',(4.69,1.82,zz),(.09,2.85,.045),bronze,u,.004)
 for y in [.42,3.22]:box('Side transom',(4.69,y,z),(.09,.045,1.7),bronze,u,.003)
 box('Side glass',(4.685,1.82,z),(.012,2.76,1.66),glass,u,.001)
# Finishes have joints, grain and edge detail.
u=unit('Oak_screen','finishes',.662,.735,.22)
for i in range(31):box('Vertical oak batten',(2.085+i*.083,1.8,2.866),(.044,2.8,.09),oak,u,.006)
u=unit('Oak_floor','finishes',.65,.723,.06)
for i in range(24):
 for j in range(3):box('Floor board',(-3.42+i*.342,.411,-2.22+j*1.975),(.337,.025,1.966),oak,u,.003)
u=unit('Terrace','finishes',.69,.752,.15)
for i in range(14):box('Travertine paver',(-3.13+i*.54,.402,3.05),(.53,.05,.48),stone,u,.004)
for i in range(6):box('Garden stepping stone',(5.6,-.09,3.6-i*.83),(1.0,.12,.64),concrete,u,.025)
u=unit('Reflecting_pool','landscape',.685,.775,.1)
box('Pool dark recess',(-5.05,-.13,1.8),(2.1,.055,4),black,u)
for x in [-6.15,-3.95]:box('Pool coping',(x,-.025,1.8),(.16,.2,4.28),stone,u)
for z in [-.28,3.88]:box('Pool coping',(-5.05,-.025,z),(2.2,.2,.16),stone,u)
box('Water',(-5.05,-.055,1.8),(2.04,.012,3.95),water,u,.001)
# Olive trees: branching trunks and thousands of actual bent leaf polygons.
def tree(pos,height,parent,seed):
 rng=random.Random(seed); x,y,z=pos
 branch((x,y,z),(x+.12,y+height*.62,z-.06),.12,parent)
 tips=[]
 for i in range(11):
  a=i*2.4; spread=rng.uniform(.5,1.1)*height*.38
  end=(x+math.cos(a)*spread,y+height*rng.uniform(.57,.94),z+math.sin(a)*spread)
  branch((x+.06,y+height*.36,z),end,.036,parent);tips.append(end)
 verts=[];faces=[];indices=[]
 for i in range(2300):
  tip=Vector(rng.choice(tips));p=tip+Vector((rng.gauss(0,.4),rng.gauss(0,.34),rng.gauss(0,.4)))
  angle=rng.random()*math.tau;length=rng.uniform(.08,.16);width=length*.23
  d=Vector((math.cos(angle),rng.uniform(-.6,.6),math.sin(angle)))*length
  v=Vector((-math.sin(angle),.15,math.cos(angle)))*width
  pts=[p-d,p+v,p+Vector((0,.016,0)),p-v,p+d];n=len(verts);verts.extend([xyz(t) for t in pts]);faces.extend([(n,n+1,n+2),(n,n+2,n+3),(n+1,n+4,n+2),(n+2,n+4,n+3)]);indices.extend([i%3]*4)
 mesh=bpy.data.meshes.new('Olive foliage');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Olive foliage',mesh);bpy.context.collection.objects.link(o);o.parent=parent
 for m in leafm:mesh.materials.append(m)
 for poly,idx in zip(mesh.polygons,indices):poly.material_index=idx
 for m in leafm:m.use_backface_culling=False
# Existing mature trees anchor every construction stage.
tree((-6.8,-.17,-2.65),4.35,T,8);tree((7.0,-.17,-3.65),3.55,T,31)
# Low perennial grasses, merged into a single mesh per garden.
u=unit('Planting','landscape',.71,.79,.08)
verts=[];faces=[]
for i in range(950):
 x=random.choice([-6.1,5.9])+random.uniform(-.35,.35);z=random.uniform(-3.8,3.8);h=random.uniform(.10,.42);a=random.random()*math.tau;w=.013;n=len(verts)
 verts.extend([xyz((x-w,-.15,z)),xyz((x+w,-.15,z)),xyz((x+math.cos(a)*h*.45,h-.15,z+math.sin(a)*h*.45))]);faces.append((n,n+1,n+2))
me=bpy.data.meshes.new('Perennial blades');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('Perennial grasses',me);bpy.context.collection.objects.link(o);o.parent=u;me.materials.append(leafm[1])
# Interior, a distinct lazy-loaded asset using the same coordinates.
I=roots['interior']
box('Woven rug',(-1.42,.438,-.55),(3.6,.024,2.7),linen,I,.008)
box('Sofa oak plinth',(-1.75,.53,-1.73),(2.88,.18,1.02),oak,I,.045)
for i in range(3):
 x=-2.65+i*.89
 box('Upholstered seat',(x,.745,-1.59),(.86,.29,.98),linen,I,.10)
 back=box('Upholstered back',(x,1.13,-2.05),(.87,.68,.24),linen,I,.11);back.rotation_euler.x=math.radians(8)
for x in [-3.19,-.30]:box('Sofa arm',(x,.87,-1.63),(.22,.62,1.08),linen,I,.085)
for x in [-2.76,-.65]:
 o=box('Linen scatter cushion',(x,1.05,-1.80),(.43,.41,.14),plaster,I,.065);o.rotation_euler=(.18,.15,.2)
cylinder('Coffee table stone',(-1.36,.78,-.08),.68,.09,stone,I,vertices=48)
cylinder('Coffee table base',(-1.36,.6,-.08),.30,.30,oak,I,vertices=32)
box('Book',(-1.52,.843,-.13),(.36,.028,.25),plaster,I,.004)
cylinder('Ceramic bowl',(-1.05,.88,-.08),.11,.06,ceramic,I,r2=.055,vertices=28)
# Kitchen cabinetry with reveals, stone splashback and independent doors.
box('Kitchen cabinet body',(2.62,.94,-2.77),(3.65,1.08,.7),black,I)
for i in range(6):box('Oak cabinet front',(1.1+i*.61,.94,-2.395),(.592,1.01,.035),oak,I,.008)
box('Stone worktop',(2.62,1.505,-2.74),(3.76,.055,.83),stone,I,.015)
box('Splashback',(2.62,1.8,-3.115),(3.75,.54,.055),stone,I,.008)
box('Floating kitchen shelf',(2.60,2.3,-3.01),(3.7,.045,.40),oak,I,.009)
for i in range(5):cylinder('Stoneware on shelf',(1.15+i*.32,2.43,-2.99),.075,.22,plaster if i%2 else ceramic,I,r2=.06)
box('Kitchen island',(2.4,.96,-.78),(1.45,1.08,1.28),oak,I,.018)
box('Island stone top',(2.4,1.535,-.78),(1.6,.065,1.43),stone,I,.018)
for z in [-.98,-.26]:
 cylinder('Stool seat',(3.65,.92,z),.25,.065,oak,I,vertices=32)
 for dx,dz in [(-.15,-.15),(.15,-.15),(-.15,.15),(.15,.15)]:cylinder('Stool leg',(3.65+dx,.665,z+dz),.025,.49,bronze,I,vertices=10)
# Curtains create soft folded geometry and believable depth at side glazing.
for xx in [4.41]:
 verts=[];faces=[]
 for i in range(45):
  z=.35+i*.021;wave=math.sin(i*.8)*.036
  verts.extend([xyz((xx+wave,.45,z)),xyz((xx+wave,3.24,z))])
  if i:faces.append((2*i-2,2*i,2*i+1,2*i-1))
 me=bpy.data.meshes.new('Pleated curtain');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('Linen curtain',me);bpy.context.collection.objects.link(o);o.parent=I;me.materials.append(linen)
# Art frame is modeled as a blank relief panel, not a generated illustration.
box('Relief frame',(-1.6,2.1,-3.1),(1.65,1.18,.065),oak,I,.005)
box('Relief paper',(-1.6,2.1,-3.055),(1.56,1.09,.015),plaster,I,.001)
for i in range(8):box('Relief fold',(-2.15+i*.155,2.1,-3.028),(.038,.72,.035),stone,I,.005)
cylinder('Pendant stem',(.2,2.96,-1.12),.009,.58,bronze,I,vertices=10)
cylinder('Pendant shade',(.2,2.58,-1.12),.18,.22,oak,I,r2=.46,vertices=48)
cylinder('Pendant diffuser',(.2,2.468,-1.12),.40,.008,lightmat,I,vertices=40)
box('Under shelf LED',(2.6,2.267,-2.86),(3.4,.008,.022),lightmat,I,.001)
cylinder('Floor vase',(-3.2,.72,-2.72),.19,.62,ceramic,I,r2=.14,vertices=32)
# Merge mature trees by material to keep draw calls bounded.
for rt in [T,roots['landscape'],I]:
 bpy.ops.object.select_all(action='DESELECT')
 # Keep furniture objects editable. Only natural geometry is joined.
 candidates=[o for o in rt.children_recursive if o.type=='MESH' and ('Olive' in o.name)]
 if candidates:
  for o in candidates:o.select_set(True)
  bpy.context.view_layer.objects.active=candidates[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join();bpy.context.object.name='Mature olive trees';bpy.context.object.parent=rt
# Batch parts inside each assembly; retain stage transforms and original source script.
for parent in [o for o in bpy.data.objects if o.type=='EMPTY']:
 parts=[o for o in parent.children if o.type=='MESH']
 if len(parts)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
 bpy.context.object.name=parent.name+'_geometry'
# Export geometry and embedded PBR textures, with Draco decoder hosted beside it.
def export(name,groups):
 bpy.ops.object.select_all(action='DESELECT')
 for group in groups:
  group.select_set(True)
  for o in group.children_recursive:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/name),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_image_format='JPEG',export_jpeg_quality=82,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
export('casa-patio-exterior.glb',[o for n,o in roots.items() if n!='interior'])
export('casa-patio-interior.glb',[I])
# Same model, offline reference renders for meaningful low-power/WebGL fallbacks.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='WEBP';scene.render.image_settings.quality=86
world=bpy.data.worlds.new('Afternoon environment');scene.world=world;world.use_nodes=True
nd=world.node_tree.nodes.new('ShaderNodeTexEnvironment');nd.image=bpy.data.images.load(str(R/'web/public/environment/rosendal-plains-1k.hdr'))
world.node_tree.links.new(nd.outputs['Color'],world.node_tree.nodes.get('Background').inputs['Color']);world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.55
bpy.ops.object.light_add(type='AREA',location=xyz((-7,10,7)));sun=bpy.context.object;sun.name='Large soft daylight';sun.data.energy=2000;sun.data.shape='DISK';sun.data.size=5;sun.rotation_euler=(Vector(xyz((0,0,0)))-sun.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=xyz((.1,2.8,-1)));bpy.context.object.data.energy=65;bpy.context.object.data.color=(1,.75,.46);bpy.context.object.data.size=3
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.clip_start=.05;camera.data.clip_end=250;camera.data.lens=40
scene.view_settings.view_transform='AgX'
def camera_at(p,target,lens=40):
 camera.location=xyz(p);camera.rotation_euler=(Vector(xyz(target))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=lens
camera_at((12,9,17),(-1.6,1,0),40)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(A/'casa-patio.blend'))
# Explicit render switch keeps regeneration of GLBs cheap.
import sys
if '--render' in sys.argv or '--render-interior' in sys.argv:
 for name,p,target,lens,hidden in [
 ('casa-patio-exterior',(12,9,17),(-1.6,1,0),40,[]),
 ('casa-patio-interior',(.03,1.76,1.32),(.05,1.45,-2.8),19,[]),
 ('casa-patio-terrain',(12,9,17),(-1.6,1,0),40,[k for k in roots if k!='terrain']),
 ('casa-patio-foundation',(12,9,17),(-1.6,1,0),40,['framing','walls','roof','windows','finishes','landscape','interior']),
 ('casa-patio-framing',(12,9,17),(-1.6,1,0),40,['walls','roof','windows','finishes','landscape','interior']),
 ('casa-patio-shell',(12,9,17),(-1.6,1,0),40,['windows','finishes','landscape','interior']),
 ('casa-patio-finishes',(12,9,17),(-1.6,1,0),40,['interior'])]:
  if '--render-interior' in sys.argv and name!='casa-patio-interior':continue
  for k,o in roots.items():
   for c in o.children_recursive:c.hide_render=k in hidden
  camera_at(p,target,lens);scene.render.filepath=str(IMG/(name+'.webp'));bpy.ops.render.render(write_still=True)
print('CASA_PATIO_ASSETS_COMPLETE')
