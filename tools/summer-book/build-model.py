from pathlib import Path
import json
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'blender' / 'summer-book'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
objects = []


def material(name, texture=None, color=(.065,.24,.24)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    shader = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
    shader.inputs['Roughness'].default_value = .76
    shader.inputs['Base Color'].default_value = (*color,1)
    if texture:
        image = bpy.data.images.load(str(OUT / 'textures' / (texture + '.png')))
        image.pack()
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        node.interpolation = 'Closest'
        mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
    return mat


edge = material('Thin printed cover edge')


def panel(name, verts, faces, uvs, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    mesh.uv_layers.new()
    for polygon in mesh.polygons:
        for loop in polygon.loop_indices:
            mesh.uv_layers.active.data[loop].uv = uvs[mesh.loops[loop].vertex_index]
    obj = bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    objects.append(obj)
    return obj


# Estimated proportions from the photographs, in centimeters; right-hand binding.
width, height, depth = 14.8, 21, 1.45
for name, side in [('front',-1),('back',1)]:
    verts, uvs, faces = [], [], []
    for row in range(3):
        v = row / 2
        for col in range(9):
            u = col / 8
            x = (u-.5)*width*(-side)
            curl = .035 * ((width/2-x)/width)**2
            y = side*(depth/2 + curl + .012*math.sin(v*math.pi)*(width/2-x)/width)
            verts.append((x,y,(v-.5)*height))
            uvs.append((u,v))
    for row in range(2):
        for col in range(8):
            i = row*9+col
            faces.append((i,i+1,i+10,i+9))
    obj = panel('Soft cover - '+name,verts,faces,uvs,material(name,name))
    obj.data.materials.append(edge)
    solid = obj.modifiers.new('Paper cover thickness','SOLIDIFY')
    solid.thickness = .035
    solid.offset = -1
    solid.material_offset = 1
    solid.material_offset_rim = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=solid.name)

verts, uvs, faces = [], [], []
for z,v in [(-height/2,0),(height/2,1)]:
    for col in range(9):
        u = col/8
        verts.append((width/2+.09*math.sin(math.pi*u), (u-.5)*depth, z))
        uvs.append((u,v))
for col in range(8):
    faces.append((col,col+1,col+10,col+9))
panel('Rounded printed spine',verts,faces,uvs,material('spine','spine'))

bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,0))
pages = bpy.context.object
pages.name = 'Closed page block'
pages.dimensions = (width-.20,depth-.12,height-.20)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
pages.data.materials.append(material('Paper strata','pages'))
if not pages.data.uv_layers:
    pages.data.uv_layers.new()
for polygon in pages.data.polygons:
    for loop in polygon.loop_indices:
        co = pages.data.vertices[pages.data.loops[loop].vertex_index].co
        u = co.y/(depth-.12)+.5
        v = co.z/(height-.20)+.5 if abs(polygon.normal.x)>.5 else co.x/(width-.20)+.5
        pages.data.uv_layers.active.data[loop].uv = (u,v)
bevel = pages.modifiers.new('Tiny page edge bevel','BEVEL')
bevel.width = .022
bevel.segments = 1
bpy.ops.object.modifier_apply(modifier=bevel.name)
objects.append(pages)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 800
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.world.color = (.35,.35,.35)
scene.view_settings.view_transform = 'Standard'
scene.view_settings.exposure = .55


def aim(obj):
    obj.rotation_euler = (-obj.location).to_track_quat('-Z','Y').to_euler()


for location,power,size in [((-15,-25,30),4800,22),((22,-10,12),3000,18),((0,15,24),4200,20)]:
    bpy.ops.object.light_add(type='AREA',location=location)
    lamp = bpy.context.object
    lamp.data.energy = power
    lamp.data.size = size
    aim(lamp)
bpy.ops.object.camera_add(location=(25,-40,18))
camera = bpy.context.object
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 27
aim(camera)
scene.camera = camera

bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'summer-angel-book.glb'),export_format='GLB',use_selection=True,export_yup=True)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space = area.spaces.active
            space.shading.type = 'MATERIAL'
            space.overlay.show_extras = False
            space.overlay.show_floor = False
            space.region_3d.view_location = (0,0,0)
            space.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
            space.region_3d.view_distance = 35
            space.region_3d.view_perspective = 'ORTHO'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'summer-angel-book.blend'))
for name,location in [('front',(0,-45,0)),('three-quarter',(25,-40,18)),('back',(22,40,12)),('pages',(-32,-24,18)),('spine',(40,-12,10))]:
    camera.location = location
    aim(camera)
    scene.render.filepath = str(OUT/('preview-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
report = {'triangles':sum(len(p.vertices)-2 for obj in objects for p in obj.data.polygons),'estimated_dimensions_cm':[width,depth,height],'glb_bytes':(OUT/'summer-angel-book.glb').stat().st_size,'binding':'right','belly_band':'baked into cover textures'}
(OUT/'model-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
