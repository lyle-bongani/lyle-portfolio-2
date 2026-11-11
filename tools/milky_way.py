"""Builds the Milky Way in Blender: a disc with a painted barred-spiral galaxy on it
(arms, dust lanes, a warm core, pink star-forming knots and thousands of stars).

  blender --background --factory-startup --python tools/milky_way.py -- public/models/milkyway.glb tools/milky_way.blend
"""
import bpy, bmesh, sys, os
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
OUT, BLEND = args[0], args[1]
TEX = os.path.join(os.path.dirname(os.path.abspath(BLEND)), "textures")
os.makedirs(TEX, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = np.random.default_rng(5)
N = 2048


def hash2(i, j):
    n = i.astype(np.uint64) * np.uint64(374761393) + j.astype(np.uint64) * np.uint64(668265263)
    n = (n ^ (n >> np.uint64(13))) * np.uint64(1274126177)
    n = n ^ (n >> np.uint64(16))
    return (n & np.uint64(0xFFFFFF)).astype(np.float32) / np.float32(0xFFFFFF)


def vnoise(x, y):
    xi, yi = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    fx, fy = x - xi, y - yi
    ux, uy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = hash2(xi, yi) * (1 - ux) + hash2(xi + 1, yi) * ux
    b = hash2(xi, yi + 1) * (1 - ux) + hash2(xi + 1, yi + 1) * ux
    return a * (1 - uy) + b * uy


def fbm(x, y, octaves=5):
    total, amp, norm = 0, 1.0, 0
    for _ in range(octaves):
        total = total + vnoise(x, y) * amp
        norm += amp
        amp *= 0.5
        x, y = x * 2.03 + 13.1, y * 2.03 + 7.7
    return total / norm


def sstep(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


ax = np.linspace(-1, 1, N, dtype=np.float32)
x, y = np.meshgrid(ax, ax)
r = np.sqrt(x * x + y * y)
th = np.arctan2(y, x)

# two main arms and two fainter ones, wound as a logarithmic spiral, roughened with noise
wind = np.log(r * 9 + 1) * 3.1
rough = (fbm(x * 5 + 3, y * 5 + 9) - 0.5) * 1.6
main = (0.5 + 0.5 * np.cos(2 * (th - wind) + rough)) ** 3
minor = (0.5 + 0.5 * np.cos(2 * (th - wind) + np.pi + rough * 1.3)) ** 5 * 0.45
arms = np.clip(main + minor, 0, 1)
fall = np.exp(-r * 3.1) * (1 - sstep(0.82, 1.0, r))
disc = arms * fall * 3.2 + fall * 0.35
clumps = 0.55 + fbm(x * 22, y * 22, 4) * 0.9
disc *= clumps

# dust lanes hug the inner edge of each arm
lane = (0.5 + 0.5 * np.cos(2 * (th - wind) + rough - 0.9)) ** 6
dust = 1 - lane * 0.75 * sstep(0.05, 0.2, r) * (0.4 + fbm(x * 14 + 5, y * 14, 4))
disc *= np.clip(dust, 0.12, 1)

# the bar and the bright, warm core
bar = np.exp(-((x * np.cos(0.5) + y * np.sin(0.5)) / 0.2) ** 2 - ((-x * np.sin(0.5) + y * np.cos(0.5)) / 0.06) ** 2)
core = np.exp(-(r / 0.085) ** 2) * 2.4 + np.exp(-(r / 0.2) ** 2) * 0.55 + bar * 0.6

blue = np.array((0.5, 0.68, 1.0), np.float32)
warm = np.array((1.0, 0.82, 0.55), np.float32)
pink = np.array((1.0, 0.35, 0.6), np.float32)
img = disc[..., None] * (blue * (1 - np.exp(-r * 4))[..., None] + warm * np.exp(-r * 4)[..., None]) + core[..., None] * warm
# pink star-forming regions, scattered along the arms
knots = sstep(0.74, 0.86, fbm(x * 40 + 2, y * 40 + 6, 3)) * arms * fall * 5
img += knots[..., None] * pink

# stars: thousands of points, denser toward the arms and the core
count = 26000
rr = rng.random(count) ** 0.6
aa = rng.random(count) * 2 * np.pi
sx = ((rr * np.cos(aa)) * 0.5 + 0.5) * (N - 1)
sy = ((rr * np.sin(aa)) * 0.5 + 0.5) * (N - 1)
ix, iy = sx.astype(int), sy.astype(int)
keep = rng.random(count) < np.clip(arms[iy, ix] * 0.9 + np.exp(-rr * 3) + 0.12, 0, 1)
ix, iy = ix[keep], iy[keep]
bright = (0.35 + rng.random(len(ix)) ** 3 * 1.4)[:, None] * (0.8 + rng.random((len(ix), 3)) * 0.2) * (1 - sstep(0.85, 1.0, rr[keep]))[:, None]
np.add.at(img, (iy, ix), bright.astype(np.float32))
for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):   # a soft cross so each star is more than one pixel
    np.add.at(img, (np.clip(iy + dy, 0, N - 1), np.clip(ix + dx, 0, N - 1)), (bright * 0.3).astype(np.float32))

img = 1 - np.exp(-img * 1.25)                         # soft roll-off instead of clipping
px = np.ones((N, N, 4), np.float32)
px[..., :3] = np.clip(img, 0, 1)
image = bpy.data.images.new("MilkyWay", N, N)
image.pixels.foreach_set(px.ravel())
image.filepath_raw = os.path.join(TEX, "MilkyWay.jpg")
image.file_format = "JPEG"
image.save()

bm = bmesh.new()
uv = bm.loops.layers.uv.new("UVMap")
vs = [bm.verts.new(p) for p in ((-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0))]
face = bm.faces.new(vs)
for loop, c in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
    loop[uv].uv = c
mesh = bpy.data.meshes.new("MilkyWay")
bm.to_mesh(mesh)
bm.free()
mat = bpy.data.materials.new("MilkyWay")
mat.use_nodes = True
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = image
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
bsdf.inputs["Emission Strength"].default_value = 1.5
mesh.materials.append(mat)
obj = bpy.data.objects.new("MilkyWay", mesh)
bpy.context.scene.collection.objects.link(obj)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="AUTO")
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))
print("OK milky way ->", OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")
