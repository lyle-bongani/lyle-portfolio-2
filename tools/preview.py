"""Renders a quick contact sheet of tools/world.blend so the models can be checked.
  blender --background tools/world.blend --python tools/preview.py -- out.png [name-filter]
"""
import bpy, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
scene = bpy.context.scene
flt = args[1] if len(args) > 1 else None
roots = [o for o in scene.objects if o.parent is None and (not flt or flt in o.name)]
xs = [o.location.x for o in roots]
cx, span = (min(xs) + max(xs)) / 2, max(xs) - min(xs) + 4
for o in scene.objects:
    top = o
    while top.parent:
        top = top.parent
    o.hide_render = top not in roots
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
cam.data.type = "ORTHO"
cam.data.ortho_scale = span
cam.location = (cx + span * 0.25, -20, 6)
cam.rotation_euler = (Vector((cx, 0, 1)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_cavity = True
scene.render.resolution_x = 1600
scene.render.resolution_y = int(1600 * 4 / span) + 200
scene.render.filepath = args[0]
bpy.ops.render.render(write_still=True)
