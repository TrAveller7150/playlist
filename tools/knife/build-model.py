import json
import math
from pathlib import Path
import shutil

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
TOOL = Path(__file__).resolve().parent
ASSETS = TOOL / 'assets'
OUT = TOOL / 'output'
OUT.mkdir(parents=True, exist_ok=True)
original = ROOT / 'knife.blend'
backup = ASSETS / 'source-empty.blend'
if original.exists() and not backup.exists():
    shutil.copy2(original, backup)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):
    bpy.data.materials.remove(material)

atlas = bpy.data.images.load(str(ASSETS / 'stiletto-atlas.png'), check_existing=True)
atlas.pack()
model = bpy.data.collections.new('Stiletto - Damascus')
bpy.context.scene.collection.children.link(model)
materials = {}
for name, metal, rough in [('Steel', .45, .52), ('Wood', 0, .85), ('Inscription', .1, .8)]:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = atlas
    tex.interpolation = 'Closest'
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    materials[name] = mat

RECTS = {
    'blade': (1, 1, 63, 255),
    'blade_back': (65, 1, 127, 255),
    'wood': (129, 1, 191, 191),
    'metal': (193, 1, 223, 255),
    'dark': (130, 195, 156, 252),
    'edge': (162, 195, 188, 252),
    'label': (224, 0, 256, 256),
}


def finish(obj, region='metal', mat='Steel'):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    model.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(materials[mat])
    mesh = obj.data
    mesh.update()
    uv = mesh.uv_layers.new(name='Atlas') if not mesh.uv_layers else mesh.uv_layers[0]
    bounds = [(min(v.co[i] for v in mesh.vertices), max(v.co[i] for v in mesh.vertices)) for i in range(3)]
    for polygon in mesh.polygons:
        face_region = 'blade_back' if region == 'blade' and polygon.normal.y > .1 else region
        x0, y0, x1, y1 = RECTS[face_region]
        normal = polygon.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        axes = (0, 2) if axis == 1 else ((1, 2) if axis == 0 else (0, 1))
        for loop in polygon.loop_indices:
            co = mesh.vertices[mesh.loops[loop].vertex_index].co
            values = [(co[i] - bounds[i][0]) / max(bounds[i][1] - bounds[i][0], 1e-6) for i in axes]
            if normal.y > .1:
                values[0] = 1 - values[0]
            uv.data[loop].uv = ((x0 + values[0] * (x1 - x0)) / 256, 1 - (y1 - values[1] * (y1 - y0)) / 256)
    return obj


def mesh_object(name, verts, faces, region='metal', mat='Steel'):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    return finish(obj, region, mat)


def loft(name, rings, region='metal', mat='Steel'):
    count = len(rings[0])
    verts = [v for ring in rings for v in ring]
    faces = [tuple(reversed(range(count)))]
    for row in range(len(rings) - 1):
        for col in range(count):
            nxt = (col + 1) % count
            faces.append((row * count + col, row * count + nxt, (row + 1) * count + nxt, (row + 1) * count + col))
    faces.append(tuple((len(rings) - 1) * count + i for i in range(count)))
    return mesh_object(name, verts, faces, region, mat)


def rectangle_ring(z, width, depth, bevel=.06, y=0):
    x, d = width / 2, depth / 2
    b = min(bevel, x * .4, d * .4)
    return [(a, c + y, z) for a, c in [(-x + b, -d), (x - b, -d), (x, -d + b), (x, d - b), (x - b, d), (-x + b, d), (-x, d - b), (-x, -d + b)]]


def prism(name, points, depth, region='metal', y=0):
    n = len(points)
    verts = [(x, y - depth / 2, z) for x, z in points] + [(x, y + depth / 2, z) for x, z in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
    return mesh_object(name, verts, faces, region)


def pin(name, x, y, z, radius, depth, region='metal', vertices=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, end_fill_type='NGON', location=(x, y, z), rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)
    return finish(obj, region)


# Both edges converge on the handle axis; paired bevels meet at a central ridge.
rings = []
for z, half_width, thick in [(.30, .25, .047), (1.1, .25, .055), (1.25, .245, .068), (3.15, .215, .059), (4.05, .155, .045), (4.85, .072, .023), (5.45, .001, .001)]:
    ridge = half_width * .18
    rings.append([(-half_width, 0, z), (-ridge, -thick, z), (ridge, -thick, z), (half_width, 0, z), (ridge, thick, z), (-ridge, thick, z)])
blade = loft('Blade - centered taper', rings, 'blade')

# The visible small root hole is retained in the silhouette when inspecting.
hole = pin('Hole cutter', -.14, 0, .83, .067, .4, vertices=10)
bpy.context.view_layer.objects.active = blade
modifier = blade.modifiers.new('Blade root hole', 'BOOLEAN')
modifier.operation = 'DIFFERENCE'
modifier.object = hole
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.data.objects.remove(hole, do_unlink=True)
finish(blade, 'blade')

# Two wood scales leave a visible dark liner along the handle's sides.
loft('Handle liner', [rectangle_ring(z, w, .30) for z, w in [(-5.15, .62), (-4.9, .69), (-1.02, .65), (-.7, .60)]], 'dark')
for side, y in [('Front', -.19), ('Back', .19)]:
    loft('Wood scale - ' + side, [rectangle_ring(z, w, d, .035, y) for z, w, d in [(-4.85, .65, .11), (-4.65, .69, .14), (-1.12, .65, .14), (-.91, .62, .11)]], 'wood', 'Wood')
loft('Upper bolster', [rectangle_ring(z, w, d) for z, w, d in [(-1.04, .67, .49), (-.91, .69, .51), (.24, .62, .48), (.35, .55, .40)]])
loft('Damascus pommel', [rectangle_ring(z, w, d) for z, w, d in [(-5.42, .51, .32), (-5.33, .64, .43), (-4.91, .67, .47), (-4.83, .65, .44)]], 'blade')
loft('Pivot neck', [rectangle_ring(z, w, .25) for z, w in [(.28, .47), (.33, .47), (.36, .44)]])

# Characteristic curved quillons, each reduced to a readable angular outline.
left_guard = [(-.22, -.42), (-.44, -.42), (-.62, -.29), (-.70, -.08), (-.71, .09), (-.60, -.005), (-.43, -.035), (-.25, .10)]
right_guard = [(.24, .08), (.42, .02), (.58, -.10), (.70, -.33), (.71, -.46), (.60, -.42), (.48, -.30), (.25, -.33)]
prism('Left curved guard', left_guard, .25)
prism('Right curved guard', right_guard, .25)

for sign, name in [(-1, 'Front'), (1, 'Back')]:
    for z, radius in [(-.53, .087), (-.84, .038), (-1.39, .056), (-4.56, .056)]:
        pin(name + ' fastener ' + str(z), 0, sign * .257, z, radius, .025, vertices=10)
        if z < -1:
            pin(name + ' screw recess ' + str(z), 0, sign * .274, z, radius * .48, .008, 'dark', 8)
pin('Release button rim', .065, -.273, -2.1, .145, .035, vertices=12)
pin('Release button', .065, -.30, -2.1, .112, .05, vertices=12)
pin('Safety rivet', .085, -.275, -4.07, .071, .03, vertices=10)
prism('Safety slide', [(.06, -3.95), (.11, -3.95), (.11, -3.52), (.06, -3.52)], .023, 'dark', -.269)

label = mesh_object('Personal nameplate', [(-.31, -.29, -2.28), (-.10, -.29, -2.28), (-.10, -.29, .04), (-.31, -.29, .04)], [(0, 1, 2, 3)], 'label', 'Inscription')
for z in (-2.22, -.02):
    pin('Nameplate mounting pin', -.205, -.30, z, .025, .008, vertices=8)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.world.color = (.32, .32, .32)
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast' if 'Medium High Contrast' in [item.identifier for item in scene.view_settings.bl_rna.properties['look'].enum_items] else 'None'


def area(name, location, power, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (-obj.location).to_track_quat('-Z', 'Y').to_euler()


area('Key softbox', (-4, -7, 8), 1100, 7, (1, .94, .84))
area('Fill softbox', (5, -3, 0), 600, 5, (.85, .91, 1))
area('Back rim', (2, 5, 6), 1250, 5, (1, 1, 1))
camera_data = bpy.data.cameras.new('Inspection camera')
camera = bpy.data.objects.new('Inspection camera', camera_data)
scene.collection.objects.link(camera)
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 12.6
scene.camera = camera


def point_camera(location):
    camera.location = location
    camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()


point_camera((3, -20, 3))
scene.render.resolution_x = 640
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100

# Export the asset alone. Lights and the inspection camera stay in the Blend.
bpy.ops.object.select_all(action='DESELECT')
triangles = 0
for obj in model.objects:
    obj.select_set(True)
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
bpy.context.view_layer.objects.active = blade
bpy.ops.export_scene.gltf(filepath=str(OUT / 'stiletto-damascus.glb'), export_format='GLB', use_selection=True, export_yup=True)
for screen in bpy.data.screens:
    for space_area in screen.areas:
        if space_area.type == 'VIEW_3D':
            space_area.spaces.active.shading.type = 'MATERIAL'
            space_area.spaces.active.region_3d.view_distance = 14
            space_area.spaces.active.region_3d.view_location = (0, 0, 0)
            space_area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
            space_area.spaces.active.region_3d.view_perspective = 'ORTHO'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(original))

for name, location in [('front', (0, -20, 0)), ('back', (0, 20, 0)), ('three-quarter', (9, -20, 5)), ('edge', (20, -5, 1))]:
    point_camera(location)
    scene.render.filepath = str(OUT / ('preview-' + name + '.png'))
    bpy.ops.render.render(write_still=True)

point_camera((1, -20, 3))
camera.rotation_euler.rotate_axis('Z', math.pi / 2)
camera_data.ortho_scale = 12.3
scene.render.resolution_x = 256
scene.render.resolution_y = 64
scene.render.filepath = str(OUT / 'knife-sprite.png')
bpy.ops.render.render(write_still=True)

report = {'triangles': triangles, 'objects': len(model.objects), 'texture_size': list(atlas.size), 'glb_bytes': (OUT / 'stiletto-damascus.glb').stat().st_size}
(OUT / 'model-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('MODEL_REPORT=' + json.dumps(report))
