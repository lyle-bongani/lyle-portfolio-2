"""Builds our solar system in Blender: every body as a textured sphere (plus Saturn's ring),
each surface painted procedurally, exported in one GLB for the site.

  blender --background --factory-startup --python tools/solar_system.py -- public/models/solar.glb tools/solar_system.blend tools/solar_system.png
"""
import bpy, bmesh, math, sys, os
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
OUT, BLEND, PNG = args[0], args[1], (args[2] if len(args) > 2 else None)
TEX = os.path.join(os.path.dirname(os.path.abspath(BLEND)), "textures")
os.makedirs(TEX, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = np.random.default_rng(11)

# ---------- noise on a sphere (seamless: sampled in 3D, not in the flat picture) ----------


def grid(w, h):
    lon = np.linspace(-np.pi, np.pi, w, endpoint=False, dtype=np.float32)[None, :]
    lat = np.linspace(-np.pi / 2, np.pi / 2, h, dtype=np.float32)[:, None]
    P = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat) * np.ones_like(lon)], axis=-1)
    return P, np.broadcast_to(lat, (h, w)), np.broadcast_to(lon, (h, w))


def hash3(i, j, k):
    n = i.astype(np.uint64) * np.uint64(374761393) + j.astype(np.uint64) * np.uint64(668265263) + k.astype(np.uint64) * np.uint64(2147483647)
    n = (n ^ (n >> np.uint64(13))) * np.uint64(1274126177)
    n = n ^ (n >> np.uint64(16))
    return (n & np.uint64(0xFFFFFF)).astype(np.float32) / np.float32(0xFFFFFF)


def vnoise(P):
    i = np.floor(P).astype(np.int64)
    f = P - i
    u = f * f * (3 - 2 * f)
    x, y, z = i[..., 0], i[..., 1], i[..., 2]
    ux, uy, uz = u[..., 0], u[..., 1], u[..., 2]

    def c(a, b, d):
        return hash3(x + a, y + b, z + d)

    x00 = c(0, 0, 0) * (1 - ux) + c(1, 0, 0) * ux
    x10 = c(0, 1, 0) * (1 - ux) + c(1, 1, 0) * ux
    x01 = c(0, 0, 1) * (1 - ux) + c(1, 0, 1) * ux
    x11 = c(0, 1, 1) * (1 - ux) + c(1, 1, 1) * ux
    return (x00 * (1 - uy) + x10 * uy) * (1 - uz) + (x01 * (1 - uy) + x11 * uy) * uz


def fbm(P, octaves=5, scale=1.0, offset=0.0, gain=0.5):
    total, amp, norm = 0, 1.0, 0
    Q = P * scale + offset
    for _ in range(octaves):
        total = total + vnoise(Q) * amp
        norm += amp
        amp *= gain
        Q = Q * 2.03 + 17.3
    return total / norm


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def ramp(t, stops):
    """Colour from a list of (position, (r, g, b))."""
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,), np.float32)
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        k = np.clip((t - p0) / (p1 - p0), 0, 1)[..., None]
        seg = ((t >= p0) & (t <= p1))[..., None]
        out = np.where(seg, np.array(c0, np.float32) * (1 - k) + np.array(c1, np.float32) * k, out)
    out = np.where((t < stops[0][0])[..., None], np.array(stops[0][1], np.float32), out)
    return np.where((t > stops[-1][0])[..., None], np.array(stops[-1][1], np.float32), out)


def mix(a, b, k):
    return a * (1 - k[..., None]) + np.array(b, np.float32) * k[..., None]


def craters(P, shade, count, rmin, rmax):
    """Punch craters into a brightness map: darker floor, bright raised rim."""
    for _ in range(count):
        c = rng.normal(size=3)
        c /= np.linalg.norm(c)
        r = rmin + (rmax - rmin) * rng.random() ** 2.5
        d = P @ c.astype(np.float32)
        near = d > math.cos(min(r * 1.35, 3.0))
        t = np.arccos(np.clip(d[near], -1, 1)) / r
        k = np.where(t < 0.82, 0.74 + 0.1 * t, np.where(t < 1.08, 1.22 - 0.2 * np.abs(t - 0.95) / 0.13, 1.0))
        shade[near] *= k
    return shade


# ---------- the surfaces ----------


def earth(P, lat, lon):
    h = fbm(P, 6, 2.1, 3.7)
    land = sstep(0.515, 0.535, h)
    sea = ramp(h / 0.52, [(0.0, (0.004, 0.02, 0.09)), (0.8, (0.01, 0.07, 0.25)), (1.0, (0.03, 0.22, 0.42))])
    dry = fbm(P, 4, 3.3, 9.1)
    ground = ramp((h - 0.52) * 7 + dry * 0.25, [(0.0, (0.07, 0.24, 0.06)), (0.35, (0.14, 0.3, 0.08)), (0.6, (0.42, 0.36, 0.2)), (1.0, (0.3, 0.24, 0.18))])
    desert = sstep(0.2, 0.34, np.abs(lat)) * (1 - sstep(0.4, 0.6, np.abs(lat))) * sstep(0.45, 0.6, dry)
    ground = mix(ground, (0.72, 0.6, 0.38), desert * 0.8)
    img = sea * (1 - land[..., None]) + ground * land[..., None]
    ice = sstep(1.08, 1.22, np.abs(lat) + (fbm(P, 4, 5, 2.2) - 0.5) * 0.35)
    img = mix(img, (0.93, 0.95, 0.97), ice)
    warp = fbm(P, 3, 1.6, 31.0)
    cloud = sstep(0.52, 0.72, fbm(P + (warp[..., None] - 0.5) * 0.9, 6, 3.4, 5.5))
    return mix(img, (0.96, 0.97, 0.98), cloud * 0.78)


def moon(P, lat, lon):
    shade = 0.36 + fbm(P, 6, 3.0, 1.1) * 0.42
    mare = 1 - sstep(0.4, 0.5, fbm(P, 4, 1.25, 8.4))
    shade *= 1 - mare * 0.42
    shade = craters(P, shade, 230, 0.02, 0.2)
    return np.clip(shade, 0, 1)[..., None] * np.array((0.86, 0.85, 0.84), np.float32)


def mercury(P, lat, lon):
    shade = 0.3 + fbm(P, 6, 3.4, 4.4) * 0.4
    shade = craters(P, shade, 300, 0.015, 0.16)
    return np.clip(shade, 0, 1)[..., None] * np.array((0.78, 0.7, 0.62), np.float32)


def venus(P, lat, lon):
    w = fbm(P, 5, 1.8, 6.6)
    t = np.sin(lat * 5.5 + w * 7.0 + lon * 0.6) * 0.5 + 0.5
    img = ramp(t * 0.75 + fbm(P, 5, 5.0, 2.0) * 0.25, [(0.0, (0.62, 0.42, 0.16)), (0.5, (0.82, 0.66, 0.36)), (1.0, (0.93, 0.84, 0.6))])
    return img


def mars(P, lat, lon):
    h = fbm(P, 6, 2.4, 12.2)
    img = ramp(h, [(0.25, (0.3, 0.1, 0.045)), (0.5, (0.62, 0.25, 0.1)), (0.75, (0.8, 0.42, 0.22))])
    dark = 1 - sstep(0.4, 0.52, fbm(P, 4, 1.15, 5.0))
    img = mix(img, (0.2, 0.085, 0.055), dark * 0.75)
    shade = craters(P, np.ones(h.shape, np.float32), 70, 0.02, 0.1)
    img = img * shade[..., None]
    ice = sstep(1.3, 1.4, np.abs(lat) + (fbm(P, 4, 6, 3.0) - 0.5) * 0.25)
    return mix(img, (0.93, 0.92, 0.9), ice)


def bands(P, lat, lon, freq, turb, palette, contrast=1.0):
    y = np.sin(lat)
    w = fbm(P * np.array((1.6, 1.6, 5.5), np.float32), 5, 2.0, 4.0)
    t = y * freq + (w - 0.5) * turb
    v = (np.sin(t) * 0.5 + 0.5) * 0.65 + (np.sin(t * 2.7 + 1.3) * 0.5 + 0.5) * 0.35
    v = 0.5 + (v - 0.5) * contrast
    return ramp(v, palette), w


def jupiter(P, lat, lon):
    img, w = bands(P, lat, lon, 11.0, 2.4, [(0.0, (0.42, 0.24, 0.13)), (0.3, (0.66, 0.4, 0.22)), (0.55, (0.8, 0.66, 0.5)), (0.8, (0.9, 0.84, 0.74)), (1.0, (0.72, 0.5, 0.32))])
    # the Great Red Spot
    dl = (lon - 0.7 + np.pi) % (2 * np.pi) - np.pi
    d = (dl / 0.24) ** 2 + ((lat + 0.38) / 0.115) ** 2
    spot = 1 - sstep(0.55, 1.0, d)
    swirl = np.sin(np.sqrt(d) * 14 + w * 6) * 0.08
    return mix(img, (0.68, 0.22, 0.1), np.clip(spot * (0.9 + swirl), 0, 1))


def saturn(P, lat, lon):
    img, _ = bands(P, lat, lon, 9.0, 0.8, [(0.0, (0.66, 0.54, 0.34)), (0.5, (0.83, 0.73, 0.5)), (1.0, (0.92, 0.85, 0.66))], 0.7)
    return img


def uranus(P, lat, lon):
    img, _ = bands(P, lat, lon, 5.0, 0.4, [(0.0, (0.5, 0.78, 0.82)), (1.0, (0.68, 0.9, 0.92))], 0.5)
    return img


def neptune(P, lat, lon):
    img, w = bands(P, lat, lon, 7.0, 1.6, [(0.0, (0.06, 0.14, 0.52)), (0.6, (0.14, 0.3, 0.8)), (1.0, (0.3, 0.52, 0.95))])
    wisp = sstep(0.68, 0.8, fbm(P * np.array((1.0, 1.0, 6.0), np.float32), 5, 3.0, 9.0))
    dl = (lon + 1.0 + np.pi) % (2 * np.pi) - np.pi
    spot = 1 - sstep(0.5, 1.0, (dl / 0.2) ** 2 + ((lat + 0.35) / 0.1) ** 2)
    return mix(mix(img, (0.03, 0.06, 0.3), spot * 0.8), (0.9, 0.95, 1.0), wisp * 0.5)


def pluto(P, lat, lon):
    h = fbm(P, 6, 2.6, 21.0)
    img = ramp(h, [(0.25, (0.3, 0.2, 0.14)), (0.5, (0.6, 0.48, 0.36)), (0.75, (0.8, 0.7, 0.58))])
    belt = (1 - sstep(0.15, 0.4, np.abs(lat + 0.15))) * (1 - sstep(0.42, 0.55, fbm(P, 4, 1.4, 2.0)))
    img = mix(img, (0.2, 0.1, 0.07), belt * 0.8)
    # the pale heart (Tombaugh Regio)
    x = ((lon + np.pi) % (2 * np.pi) - np.pi) / 0.55
    y = (lat - 0.12) / 0.5
    heart = (x * x + y * y - 1) ** 3 - x * x * y ** 3
    img = mix(img, (0.93, 0.89, 0.82), 1 - sstep(-0.02, 0.03, heart))
    shade = craters(P, np.ones(h.shape, np.float32), 60, 0.02, 0.09)
    return img * shade[..., None]


def nova(P, lat, lon):
    h = fbm(P, 6, 2.0, 40.0)
    land = sstep(0.5, 0.53, h)
    sea = ramp(h / 0.5, [(0.0, (0.01, 0.06, 0.14)), (1.0, (0.04, 0.4, 0.46))])
    ground = ramp((h - 0.5) * 6, [(0.0, (0.5, 0.2, 0.5)), (0.5, (0.8, 0.45, 0.6)), (1.0, (0.95, 0.85, 0.8))])
    img = sea * (1 - land[..., None]) + ground * land[..., None]
    cloud = sstep(0.55, 0.75, fbm(P, 6, 3.0, 77.0))
    return mix(img, (0.9, 0.98, 1.0), cloud * 0.7)


def sun(P, lat, lon):
    g = fbm(P, 6, 7.0, 3.0) * 0.6 + fbm(P, 4, 2.0, 8.0) * 0.4
    return ramp(g, [(0.25, (0.9, 0.25, 0.02)), (0.5, (1.0, 0.6, 0.1)), (0.75, (1.0, 0.92, 0.6))])


# name, painter, texture width
BODIES = [("Sun", sun, 1024), ("Mercury", mercury, 1024), ("Venus", venus, 1024), ("Earth", earth, 2048), ("Moon", moon, 2048),
          ("Mars", mars, 2048), ("Jupiter", jupiter, 2048), ("Saturn", saturn, 2048), ("Uranus", uranus, 1024),
          ("Neptune", neptune, 1024), ("Pluto", pluto, 2048), ("Nova", nova, 2048)]


def image(name, rgb, alpha=None, fmt="JPEG"):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=alpha is not None)
    px = np.ones((h, w, 4), np.float32)
    px[..., :3] = np.clip(rgb, 0, 1)
    if alpha is not None:
        px[..., 3] = alpha
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.join(TEX, name + (".jpg" if fmt == "JPEG" else ".png"))
    img.file_format = fmt
    img.save()
    return img


def material(name, img, rough=0.9, alpha=False, emit=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    if emit:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 2.0
    if alpha:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        m.surface_render_method = "BLENDED"
    return m


objs = []
for i, (name, paint, w) in enumerate(BODIES):
    P, lat, lon = grid(w, w // 2)
    img = image(name, paint(P, lat, lon))
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=1.0, calc_uvs=True)
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material(name, img, emit=name == "Sun"))
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    objs.append(ob)
    print("painted", name)

# Saturn's ring: a flat disc whose picture runs from the inner edge to the outer, with the Cassini gap
w = 1024
r = np.linspace(0, 1, w, dtype=np.float32)
fine = (np.sin(r * 180) * 0.5 + 0.5) * 0.35 + rng.random(w, dtype=np.float32) * 0.3 + 0.35
alpha = fine * sstep(0.0, 0.05, r) * (1 - sstep(0.94, 1.0, r))
alpha *= 1 - (sstep(0.56, 0.585, r) * (1 - sstep(0.625, 0.65, r))) * 0.95   # Cassini division
alpha *= 0.45 + 0.55 * sstep(0.18, 0.3, r)                                   # faint inner ring
col = ramp(r, [(0.0, (0.5, 0.42, 0.32)), (0.4, (0.82, 0.72, 0.52)), (0.7, (0.9, 0.82, 0.66)), (1.0, (0.62, 0.55, 0.45))])
ring_img = image("SaturnRing", np.tile(col[None, :, :], (16, 1, 1)), np.tile(alpha[None, :], (16, 1)), "PNG")
bm = bmesh.new()
uv = bm.loops.layers.uv.new("UVMap")
INNER, OUTER, SEG = 1.25, 2.3, 128
ring_verts = [(bm.verts.new((math.cos(a) * INNER, math.sin(a) * INNER, 0)), bm.verts.new((math.cos(a) * OUTER, math.sin(a) * OUTER, 0)))
              for a in [2 * math.pi * k / SEG for k in range(SEG)]]
for k in range(SEG):
    (a0, b0), (a1, b1) = ring_verts[k], ring_verts[(k + 1) % SEG]
    f = bm.faces.new((a0, b0, b1, a1))
    for l, u in zip(f.loops, (0, 1, 1, 0)):
        l[uv].uv = (u, 0.5)
me = bpy.data.meshes.new("SaturnRing")
bm.to_mesh(me)
bm.free()
me.materials.append(material("SaturnRing", ring_img, alpha=True))
ring = bpy.data.objects.new("SaturnRing", me)
scene.collection.objects.link(ring)
objs.append(ring)

for o in bpy.context.view_layer.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_image_format="AUTO")

# lay them out in a row for the .blend, ring around Saturn
for i, o in enumerate(objs[:-1]):
    o.location.x = i * 3.2
ring.location.x = objs[7].location.x
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))

if PNG:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 3.2 * 6.2
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "TEXTURE"
    scene.render.resolution_x, scene.render.resolution_y = 1900, 640
    for row, tag in ((0, "a"), (1, "b")):
        cam.location = (3.2 * (2.5 + row * 6), -30, 2.0)
        cam.rotation_euler = (math.radians(86), 0, 0)
        scene.render.filepath = os.path.abspath(PNG).replace(".png", f"_{tag}.png")
        bpy.ops.render.render(write_still=True)

print("OK solar system ->", OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")
