import math
import json
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'blender' / 'ghostpia'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color=None, texture=None, rough=.55):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    mat.node_tree.nodes.clear()
    shader=mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    output=mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
    shader.inputs['Roughness'].default_value=rough
    if color:
        shader.inputs['Base Color'].default_value=(*color,1)
    if texture:
        image=bpy.data.images.load(str(OUT/'textures'/texture))
        image.pack()
        node=mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image=image
        node.interpolation='Closest'
        mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
    return mat


edge=material('Printed paper edges',(.035,.044,.115))
objects=[]


def block(name, location, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    obj=bpy.context.object
    obj.name=name
    obj.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    bevel=obj.modifiers.new('Small paper edge bevel','BEVEL')
    bevel.width=.035
    bevel.segments=1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    objects.append(obj)
    return obj


# X = width, Y = depth, Z = height. The open long edge is on the left.
shell=block('Closed slipcase',(0,0,0),(14,4,20),edge)
# Printed panels replace the large shell faces, avoiding depth-buffer fighting.
bm=bmesh.new()
bm.from_mesh(shell.data)
panels=[f for f in bm.faces if f.calc_area()>50]
assert len(panels)==6
bmesh.ops.delete(bm,geom=panels,context='FACES_ONLY')
bm.to_mesh(shell.data)
bm.free()


def face(name, corners, texture, rotate=False):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(corners,[],[(0,1,2,3)])
    mesh.uv_layers.new()
    for loop,uv in zip(mesh.uv_layers.active.data,[(0,0),(1,0),(1,1),(0,1)]):
        loop.uv=(1-uv[0],1-uv[1]) if rotate else uv
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material(name,texture=texture+'.png'))
    objects.append(obj)


face('Front illustration',[(-6.965,-2.004,-9.965),(6.965,-2.004,-9.965),(6.965,-2.004,9.965),(-6.965,-2.004,9.965)],'front')
face('Back artwork',[(6.965,2.004,-9.965),(-6.965,2.004,-9.965),(-6.965,2.004,9.965),(6.965,2.004,9.965)],'back')
face('Printed spine',[(7.004,-1.965,-9.965),(7.004,1.965,-9.965),(7.004,1.965,9.965),(7.004,-1.965,9.965)],'spine')
face('Top print',[(-6.965,-1.965,10.004),(6.965,-1.965,10.004),(6.965,1.965,10.004),(-6.965,1.965,10.004)],'top',rotate=True)
face('Bottom print',[(-6.965,1.965,-10.004),(6.965,1.965,-10.004),(6.965,-1.965,-10.004),(-6.965,-1.965,-10.004)],'bottom')
block('Recessed opening shadow',(-6.65,0,0),(.08,3.88,19.8),edge)
# Separate fixed inserts create real depth and gaps without an opening animation.
for name,y,width,height,z,x,color in [
    ('artbook',1.16,1.22,19.3,0,-6.94,(.78,.76,.69)),
    ('novel',-.03,1.02,16.2,1.25,-6.88,(.10,.10,.12)),
    ('game',-1.23,1.12,18.0,-.1,-6.96,(.065,.07,.08))]:
    mat=material(name+' edges',color)
    block(name+' stored insert',(x+.11,y,z),(.22,width,height),mat)
    face(name+' visible edge',[(x-.004,y+width/2-.035,z-height/2+.035),
         (x-.004,y-width/2+.035,z-height/2+.035),
         (x-.004,y-width/2+.035,z+height/2-.035),
         (x-.004,y+width/2-.035,z+height/2-.035)],name)
for y in [-1.97,1.97]:
    block('Slipcase lip',(-7.0,y,0),(.16,.06,20),edge)
for z in [-9.96,9.96]:
    block('Slipcase lip',(-7.0,0,z),(.16,4,.08),edge)

scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.render.resolution_x=900
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=True
scene.world.color=(.35,.35,.35)
scene.view_settings.view_transform='Standard'


def aim(obj, point=(0,0,0)):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()


for location,power,size in [((-15,-25,30),6500,22),((22,-10,12),4200,18),((0,15,24),4800,20)]:
    bpy.ops.object.light_add(type='AREA',location=location)
    lamp=bpy.context.object
    lamp.data.energy=power
    lamp.data.shape='DISK'
    lamp.data.size=size
    aim(lamp)
bpy.ops.object.camera_add(location=(25,-40,20))
camera=bpy.context.object
camera.data.type='ORTHO'
camera.data.ortho_scale=27
aim(camera)
scene.camera=camera
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'ghostpia-limited.glb'),export_format='GLB',use_selection=True,export_yup=True)
bpy.ops.object.select_all(action='DESELECT')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.shading.type='MATERIAL'
            space.overlay.show_extras=False
            space.overlay.show_floor=False
            space.clip_start=.1
            space.clip_end=200
            space.region_3d.view_location=(0,0,0)
            space.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            space.region_3d.view_distance=38
            space.region_3d.view_perspective='ORTHO'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ghostpia-limited.blend'))
for name,pos in [('front',(0,-45,0)),('three-quarter',(25,-40,18)),('back',(-24,40,15)),('opening',(-40,-18,8))]:
    camera.location=pos
    aim(camera)
    scene.render.filepath=str(OUT/('preview-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
triangles=sum(len(p.vertices)-2 for obj in objects for p in obj.data.polygons)
(OUT/'model-report.json').write_text(json.dumps({'triangles':triangles,'dimensions_ratio':[14,4,20],'glb_bytes':(OUT/'ghostpia-limited.glb').stat().st_size},indent=2))
print('GHOSTPIA MODEL COMPLETE', triangles)
