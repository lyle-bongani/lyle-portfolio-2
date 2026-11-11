"""Build the detailed hero replacement used by the scroll story.

Run with Blender 5.x:
  blender --background --factory-startup --python tools/build_hero.py -- \
    public/models/hero_candidate.glb tools/hero_candidate.blend tools/hero_candidate.png

The character is intentionally stylised rather than photoreal: the web scene needs a
strong read at a distance, but the extra face, costume and cape geometry gives it a
much better silhouette and close-up presence than the original proxy.
"""

import bpy
import math
import sys
from mathutils import Vector


ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT = ARGS[0] if ARGS else "public/models/hero_candidate.glb"
BLEND = ARGS[1] if len(ARGS) > 1 else None
PREVIEW = ARGS[2] if len(ARGS) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 640
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("Hero Preview World")
scene.world.use_nodes = True
world_bg = scene.world.node_tree.nodes.get("Background")
world_bg.inputs["Color"].default_value = (0.008, 0.006, 0.009, 1.0)
world_bg.inputs["Strength"].default_value = 0.18


def mat(name, rgba, roughness=0.55, metallic=0.0, coat=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*rgba, 1.0)
    material.use_nodes = True
    bsdf = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgba, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.42
    return material


M = {
    "skin": mat("Skin", (0.78, 0.43, 0.27), 0.6, coat=0.08),
    "skin_light": mat("Skin Highlight", (1.0, 0.67, 0.47), 0.5, coat=0.1),
    "skin_shadow": mat("Skin Shadow", (0.42, 0.16, 0.09), 0.7),
    "yellow": mat("Hero Yellow", (0.92, 0.55, 0.035), 0.48, coat=0.14),
    "yellow_light": mat("Suit Highlight", (1.0, 0.73, 0.095), 0.42, coat=0.17),
    "yellow_shadow": mat("Suit Shadow", (0.46, 0.17, 0.02), 0.62),
    "red": mat("Glove Boot Red", (0.56, 0.035, 0.018), 0.38, coat=0.23),
    "red_light": mat("Red Highlight", (0.88, 0.085, 0.035), 0.3, coat=0.28),
    "red_shadow": mat("Red Shadow", (0.19, 0.008, 0.006), 0.62),
    "white": mat("Cape White", (0.86, 0.89, 0.92), 0.68),
    "cape_inner": mat("Cape Inner", (0.36, 0.42, 0.5), 0.82),
    "black": mat("Belt Black", (0.008, 0.01, 0.018), 0.3, metallic=0.18, coat=0.25),
    "gold": mat("Buckle Gold", (0.86, 0.47, 0.055), 0.28, metallic=0.72, coat=0.2),
    "eye": mat("Eye White", (0.97, 0.98, 0.98), 0.28, coat=0.18),
    "ink": mat("Ink Detail", (0.015, 0.008, 0.012), 0.55),
    "mouth": mat("Mouth", (0.32, 0.012, 0.014), 0.45),
}

ROOT = bpy.data.objects.new("Hero_Root", None)
scene.collection.objects.link(ROOT)


def finish(obj, material=None, bevel=0.0, parent=True):
    if material:
        obj.data.materials.append(material)
    if hasattr(obj.data, "polygons"):
        for poly in obj.data.polygons:
            poly.use_smooth = True
    if bevel:
        modifier = obj.modifiers.new("Soft bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    if parent:
        obj.parent = ROOT
    return obj


def uv(name, loc, scale, material, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=loc,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, material)


def cube(name, loc, dimensions, material, bevel=0.04, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, material, bevel=bevel)


def cyl(name, a, b, radius, material, vertices=32, bevel=0.02):
    start, end = Vector(a), Vector(b)
    direction = end - start
    mid = (start + end) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    obj.rotation_mode = "XYZ"
    return finish(obj, material, bevel=bevel)


def cone(name, loc, radius, depth, material, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=radius, radius2=radius * 0.25, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, material, bevel=0.008)


def torus(name, loc, major, minor, material, scale=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=16, major_radius=major, minor_radius=minor, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, material)


def curve(name, points, bevel, material):
    curve_data = bpy.data.curves.new(name, "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 3
    curve_data.bevel_depth = bevel
    curve_data.bevel_resolution = 3
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    scene.collection.objects.link(obj)
    return finish(obj, material)


def cape():
    width, rows, cols = 2.75, 18, 16
    verts = []
    faces = []
    for row in range(rows + 1):
        t = row / rows
        z = 1.55 - t * 3.0
        half = 0.25 + 1.18 * (t ** 0.82)
        for col in range(cols + 1):
            u = col / cols * 2.0 - 1.0
            x = u * half
            wave = math.sin(u * 5.0 + t * 2.2) * 0.055 * t
            y = 0.31 + 0.18 * (1.0 - abs(u)) + wave + 0.05 * t
            z2 = z - 0.08 * math.cos(u * math.pi) * t
            verts.append((x, y, z2))
    for row in range(rows):
        for col in range(cols):
            i = row * (cols + 1) + col
            faces.append((i, i + 1, i + cols + 2, i + cols + 1))
    mesh = bpy.data.meshes.new("CapeMesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Cape", mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(M["white"])
    obj.data.materials.append(M["cape_inner"])
    for poly in mesh.polygons:
        poly.use_smooth = True
    solid = obj.modifiers.new("Cape thickness", "SOLIDIFY")
    solid.thickness = 0.035
    solid.material_offset = 1
    sub = obj.modifiers.new("Cape folds", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 1
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=solid.name)
    bpy.ops.object.modifier_apply(modifier=sub.name)
    obj.select_set(False)
    obj.parent = ROOT
    # Dark fold seams make the cape read in the project's near-black environments.
    for side in (-1, 1):
        for index, x in enumerate((0.22, 0.54, 0.86)):
            curve(
                f"Cape fold {side} {index}",
                [(side * x, 0.276, 1.35), (side * (x + 0.12), 0.30, 0.15), (side * (x + 0.22), 0.37, -1.23)],
                0.012,
                M["cape_inner"],
            )
    return obj


# ---------- torso and cape ----------
cape()
uv("Torso", (0, 0.0, 1.02), (0.49, 0.31, 0.62), M["yellow"], 40, 24)
uv("Chest panel", (0, -0.225, 1.16), (0.40, 0.07, 0.35), M["yellow_light"], 32, 18)
uv("Waist", (0, 0.0, 0.48), (0.46, 0.29, 0.25), M["yellow"], 36, 20)

# Collar, zipper and shoulder fasteners.
torus("Neck collar", (0, 0.0, 1.60), 0.20, 0.065, M["white"], scale=(1.0, 0.82, 1.0))
for side in (-1, 1):
    uv(f"Cape collar {side}", (side * 0.30, 0.04, 1.49), (0.25, 0.20, 0.105), M["white"], 32, 16)
    uv(f"Cape button {side}", (side * 0.30, -0.145, 1.47), (0.07, 0.045, 0.07), M["black"], 24, 16)
cube("Zipper", (0, -0.315, 1.29), (0.065, 0.025, 0.34), M["white"], bevel=0.018)
cube("Zipper shadow", (0, -0.332, 1.29), (0.022, 0.012, 0.31), M["ink"], bevel=0.006)

# Head, neck and the face silhouette.
cyl("Neck", (0, 0.0, 1.47), (0, 0.0, 1.67), 0.14, M["skin"], vertices=32)
uv("Head", (0, -0.01, 1.98), (0.37, 0.32, 0.45), M["skin"], 40, 28)
for side in (-1, 1):
    uv(f"Ear {side}", (side * 0.36, -0.01, 1.99), (0.075, 0.06, 0.12), M["skin"], 28, 18)
    uv(f"Ear inner {side}", (side * 0.375, -0.063, 1.99), (0.033, 0.018, 0.068), M["skin_shadow"], 24, 16)
    eye_x = side * 0.13
    uv(f"Eye {side}", (eye_x, -0.305, 2.08), (0.088, 0.034, 0.057), M["eye"], 28, 16)
    uv(f"Pupil {side}", (eye_x, -0.337, 2.08), (0.026, 0.012, 0.028), M["ink"], 24, 14)
    cube(f"Brow {side}", (eye_x, -0.321, 2.165), (0.145, 0.025, 0.025), M["ink"], bevel=0.01, rotation=(0.0, side * 0.14, side * 0.05))
    uv(f"Eye glint {side}", (eye_x - side * 0.018, -0.35, 2.101), (0.008, 0.004, 0.009), M["white"], 16, 10)
cone("Nose", (0, -0.34, 1.98), 0.035, 0.13, M["skin_shadow"], rotation=(math.pi / 2, 0.0, 0.0))
curve("Mouth", [(-0.075, -0.323, 1.87), (0.0, -0.345, 1.84), (0.075, -0.323, 1.87)], 0.012, M["mouth"])
curve("Lower lip", [(-0.038, -0.328, 1.82), (0.0, -0.346, 1.81), (0.038, -0.328, 1.82)], 0.008, M["skin_shadow"])
uv("Head highlight", (-0.15, -0.27, 2.27), (0.06, 0.025, 0.10), M["skin_light"], 24, 14)

# Arms crossed in the recognisable reference pose.
for side in (-1, 1):
    shoulder = (side * 0.43, 0.0, 1.29)
    elbow = (side * 0.53, -0.13, 0.98)
    wrist = (-side * 0.22, -0.39, 1.16 + side * 0.035)
    cyl(f"Upper arm {side}", shoulder, elbow, 0.145, M["yellow"], vertices=36, bevel=0.025)
    uv(f"Shoulder {side}", shoulder, (0.18, 0.16, 0.17), M["yellow_light"], 32, 18)
    uv(f"Elbow {side}", elbow, (0.15, 0.14, 0.14), M["yellow_shadow"], 28, 16)
    cyl(f"Forearm glove {side}", elbow, wrist, 0.145, M["red"], vertices=36, bevel=0.025)
    uv(f"Fist {side}", wrist, (0.16, 0.13, 0.15), M["red_light"], 32, 20)
    cuff = Vector(elbow).lerp(Vector(wrist), 0.17)
    cyl(f"Glove cuff {side}", cuff - Vector((0, 0, 0.06)), cuff + Vector((0, 0, 0.06)), 0.155, M["red_shadow"], vertices=32, bevel=0.012)
    for finger in range(3):
        curve(
            f"Glove seam {side} {finger}",
            [Vector(wrist) + Vector((side * 0.06 * (finger - 1), -0.12, -0.04)), Vector(wrist) + Vector((side * 0.07 * (finger - 1), -0.14, 0.035))],
            0.009,
            M["red_shadow"],
        )

# Belt, buckle and belt studs.
torus("Belt", (0, 0.0, 0.57), 0.49, 0.065, M["black"], scale=(1.0, 0.70, 1.0))
cube("Belt strap", (0, -0.04, 0.57), (0.95, 0.08, 0.17), M["black"], bevel=0.035)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.17, depth=0.075, location=(0, -0.37, 0.57), rotation=(math.pi / 2, 0.0, 0.0))
buckle = bpy.context.object
buckle.name = "Belt buckle"
finish(buckle, M["gold"], bevel=0.018)
for side in (-1, 1):
    for index in range(3):
        uv(f"Belt stud {side} {index}", (side * (0.30 + index * 0.10), -0.34, 0.57), (0.025, 0.014, 0.025), M["gold"], 16, 10)

# Legs and boots.
for side in (-1, 1):
    hip = (side * 0.20, 0.0, 0.34)
    knee = (side * 0.22, -0.01, -0.28)
    ankle = (side * 0.22, -0.01, -0.78)
    cyl(f"Thigh {side}", hip, knee, 0.175, M["yellow"], vertices=36, bevel=0.03)
    uv(f"Knee {side}", knee, (0.18, 0.16, 0.15), M["yellow_light"], 28, 18)
    cyl(f"Shin {side}", knee, ankle, 0.13, M["yellow_shadow"], vertices=36, bevel=0.026)
    boot_top = (side * 0.22, -0.015, -0.73)
    boot_bottom = (side * 0.22, -0.02, -1.22)
    cyl(f"Boot {side}", boot_top, boot_bottom, 0.175, M["red"], vertices=36, bevel=0.035)
    cube(f"Boot toe {side}", (side * 0.22, -0.17, -1.25), (0.30, 0.38, 0.18), M["red_light"], bevel=0.075)
    cube(f"Boot sole {side}", (side * 0.22, -0.18, -1.34), (0.31, 0.43, 0.055), M["black"], bevel=0.018)
    curve(f"Boot seam {side}", [(side * 0.22, -0.205, -0.88), (side * 0.22, -0.22, -1.16)], 0.012, M["red_shadow"])

# Small costume seams reinforce the anime line-work when the character is distant.
for side in (-1, 1):
    curve(f"Torso seam {side}", [(side * 0.28, -0.315, 1.40), (side * 0.35, -0.315, 1.12), (side * 0.30, -0.315, 0.78)], 0.012, M["yellow_shadow"])


# A neutral studio preview is saved alongside the asset.
if PREVIEW:
    bpy.ops.object.camera_add(location=(3.9, -7.6, 2.3))
    camera = bpy.context.object
    camera.name = "Preview Camera"
    camera.data.lens = 58
    target = Vector((0.0, 0.0, 0.45))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.5, 5.5))
    key = bpy.context.object
    key.data.energy = 900
    key.data.shape = "DISK"
    key.data.size = 4.0
    key.rotation_euler = (target - key.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.light_add(type="AREA", location=(3.5, -1.5, 2.5))
    fill = bpy.context.object
    fill.data.energy = 500
    fill.data.size = 3.0
    fill.rotation_euler = (target - fill.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.light_add(type="AREA", location=(0.0, 2.5, 3.5))
    rim = bpy.context.object
    rim.data.energy = 850
    rim.data.color = (0.35, 0.45, 1.0)
    rim.data.size = 2.5
    rim.rotation_euler = (target - rim.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)

# The preview helpers must not be exported into the web model.
for obj in list(scene.objects):
    if obj.name.startswith("Preview") or obj.type == "LIGHT":
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_apply=True,
    export_materials="EXPORT",
    export_animations=True,
    export_nla_strips=True,
    export_def_bones=False,
)

if BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)

print("OK detailed hero ->", OUT)
