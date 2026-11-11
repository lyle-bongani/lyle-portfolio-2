"""Builds every model the site uses and exports them in one GLB.

Run headless:
  blender --background --factory-startup --python tools/build_assets.py -- public/models/world.glb tools/world.blend

Everything is exported at the origin; the site places it. The saved .blend lays the
objects out in a row so they can be looked at and edited by hand.
"""
import bpy, bmesh, math, random, sys
from mathutils import Vector, Matrix, noise

args = sys.argv[sys.argv.index("--") + 1:]
OUT = args[0]
BLEND = args[1] if len(args) > 1 else None

random.seed(4)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def mat(name, rgb, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


M = {
    "rock": mat("Rock", (0.06, 0.055, 0.06), 0.85),
    "dark": mat("Dark", (0.02, 0.02, 0.025), 0.45, 0.4),
    "screen": mat("Screen", (0.8, 0.8, 0.8), 0.3),
    "light": mat("Light", (1, 0.3, 0.15), 0.3),
    "glass": mat("Glass", (1, 0.6, 0.7), 0.05),
    "shirt": mat("Shirt", (0.9, 0.9, 0.88), 0.85),
    "skin": mat("Skin", (0.93, 0.68, 0.52), 0.6),
    "pants": mat("Pants", (0.05, 0.05, 0.07), 0.8),
    "shoes": mat("Shoes", (0.88, 0.88, 0.86), 0.6),
    "hair": mat("Hair", (0.015, 0.012, 0.01), 0.7),
    "suit": mat("Suit", (0.95, 0.68, 0.06), 0.7),
    "red": mat("Red", (0.62, 0.05, 0.03), 0.5),
    "white": mat("White", (0.9, 0.9, 0.9), 0.75),
    "black": mat("Black", (0.012, 0.012, 0.014), 0.5),
    "gold": mat("Gold", (0.8, 0.52, 0.08), 0.35, 0.8),
}


def finish(name, bm, material, smooth=False, parent=None, bevel=0.0):
    mesh = bpy.data.meshes.new(name)
    if smooth:
        for f in bm.faces:
            f.smooth = True
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    if bevel:
        b = obj.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 3
        b.limit_method = "ANGLE"
    if parent:
        obj.parent = parent
    return obj


def box(bm, size, loc=(0, 0, 0), rot=None):
    m = Matrix.Translation(loc)
    if rot:
        m = m @ rot
    m = m @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def screen(name, w, h, loc, parent=None):
    """A flat panel facing -Y (the front), with UVs, for a picture or a light."""
    # the UV layer has to exist first, or create_grid quietly skips the UVs
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    m = Matrix.Translation(loc) @ Matrix.Rotation(math.pi / 2, 4, "X") @ Matrix.Diagonal((w, h, 1, 1))
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5, matrix=m, calc_uvs=True)
    return finish(name, bm, M["screen"], parent=parent)


def empty(name):
    e = bpy.data.objects.new(name, None)
    col.objects.link(e)
    return e


# ---------- rocks ----------
def boulder(name, seed, detail=5):
    r = random.Random(seed)
    off = Vector((r.uniform(0, 50), r.uniform(0, 50), r.uniform(0, 50)))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
    planes = [Vector((r.gauss(0, 1), r.gauss(0, 1), r.gauss(0, 1))).normalized() for _ in range(9)]
    cuts = [r.uniform(0.62, 0.8) for _ in planes]
    sc = Vector((r.uniform(0.85, 1.25), r.uniform(0.7, 1.0), r.uniform(0.75, 1.1)))
    for v in bm.verts:
        d = v.co.normalized()
        n = noise.noise(d * 1.3 + off) * 0.3 + noise.noise(d * 3.6 + off) * 0.09
        p = d * (1 + n)
        for pl, cut in zip(planes, cuts):  # knock flat faces into it so it reads as broken stone
            over = p.dot(pl) - cut
            if over > 0:
                p -= pl * over * 0.92
        if detail > 3:
            # ridged noise gives cracks and sharp crests; fine noise gives grain
            crag = noise.ridged_multi_fractal(d * 2.3 + off, 1.0, 2.1, 5, 1.0, 2.0)
            pits = noise.voronoi(d * 5.0 + off)[0][0]
            grain = noise.turbulence(d * 14 + off, 3, False)
            p += d * (crag * 0.035 - 0.05 + min(pits, 0.5) * 0.09 + grain * 0.012)
        v.co = Vector((p.x * sc.x, p.y * sc.y, p.z * sc.z))
    obj = finish(name, bm, M["rock"], smooth=True)
    if detail > 4:
        dec = obj.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = 0.45
    return obj


for i in range(5):
    boulder(f"Rock_{i}", 100 + i * 7)
boulder("Rock_Lo", 171, detail=3)  # cheap one for the asteroid field

# ---------- desktop monitor ----------
mon = empty("Monitor")
bm = bmesh.new()
box(bm, (1.7, 0.07, 1.02), (0, 0, 1.0))
box(bm, (1.7, 0.075, 0.2), (0, 0, 0.4))
finish("Monitor_Body", bm, M["dark"], parent=mon, bevel=0.02)
bm = bmesh.new()
box(bm, (0.3, 0.05, 0.5), (0, 0.09, 0.2), Matrix.Rotation(math.radians(12), 4, "X"))
box(bm, (0.62, 0.42, 0.025), (0, 0.06, 0.0))
finish("Monitor_Stand", bm, M["shoes"], parent=mon, bevel=0.012)
screen("Monitor_Screen", 1.62, 0.94, (0, -0.037, 1.0), parent=mon)

# ---------- old tube monitor ----------
crt = empty("CRT")
bm = bmesh.new()
box(bm, (1.15, 0.5, 0.95), (0, 0, 0.6))
box(bm, (0.85, 0.6, 0.72), (0, 0.45, 0.6))
box(bm, (0.7, 0.5, 0.12), (0, 0.1, 0.06))
finish("CRT_Body", bm, M["dark"], parent=crt, bevel=0.04)
screen("CRT_Screen", 0.92, 0.7, (0, -0.252, 0.63), parent=crt)

# ---------- headstone ----------
bm = bmesh.new()
pts = [(-0.38, 0), (0.38, 0), (0.38, 0.75)]
pts += [(0.38 * math.cos(a), 0.75 + 0.38 * math.sin(a)) for a in [math.pi * k / 12 for k in range(1, 12)]]
pts += [(-0.38, 0.75)]
verts = [bm.verts.new((x, -0.08, z)) for x, z in pts]
face = bm.faces.new(verts)
ext = bmesh.ops.extrude_face_region(bm, geom=[face])
bmesh.ops.translate(bm, verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)], vec=(0, 0.16, 0))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
finish("Headstone", bm, M["rock"], bevel=0.012)


# ---------- frames ----------
def frame(name, w, h, bar, depth):
    bm = bmesh.new()
    box(bm, (bar, depth, h), (-w / 2 + bar / 2, 0, h / 2))
    box(bm, (bar, depth, h), (w / 2 - bar / 2, 0, h / 2))
    box(bm, (w, depth, bar), (0, 0, h - bar / 2))
    box(bm, (w, depth, bar), (0, 0, bar / 2))
    return finish(name, bm, M["dark"], bevel=0.01)


frame("Frame", 2.1, 3.1, 0.11, 0.11)
door = empty("Door")
frame("Door_Frame", 1.5, 3.2, 0.14, 0.2).parent = door
screen("Door_Light", 1.22, 2.92, (0, 0, 1.6), parent=door)

# ---------- glass egg ----------
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=0.9)
for v in bm.verts:
    v.co.z *= 1.5 if v.co.z > 0 else 1.05
    v.co.z += 0.95
finish("Egg", bm, M["glass"], smooth=True)


# ---------- the figure, in four poses ----------
def skin(name, pts, edges, radii, material, parent, sub=2):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(p) for p in pts], edges, [])
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    sk = obj.modifiers.new("Skin", "SKIN")
    sk.use_smooth_shade = True
    data = mesh.skin_vertices[0].data
    for i, r in enumerate(radii):
        data[i].radius = r if isinstance(r, tuple) else (r, r)
        data[i].use_root = i == 0
    s = obj.modifiers.new("Sub", "SUBSURF")
    s.levels = sub
    mesh.materials.append(material)
    obj.parent = parent
    return obj


def ball(name, centre, radius, scale, material, parent):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=radius)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + Vector(centre)
    return finish(name, bm, material, smooth=True, parent=parent)


def figure(name, J):
    """The caped hero: bald, yellow suit, red gloves and boots, white cape, black belt."""
    J = {k: Vector(v) for k, v in J.items()}
    root = empty(name)
    up = (J["head"] - J["neck"]).normalized()
    front = Vector((0, -1, 0))
    front = (front - up * front.dot(up)).normalized()
    right = front.cross(up).normalized()  # the figure's own left is +X

    # suit: torso, arms to mid-forearm, legs to just under the knee
    pts, edges, radii = [J["pelvis"], J["chest"]], [(0, 1)], [(0.17, 0.12), (0.2, 0.135)]
    for s_ in ("L", "R"):
        sh, el, wr = J["sh" + s_], J["el" + s_], J["wr" + s_]
        i = len(pts)
        pts += [sh, el, el.lerp(wr, 0.45)]
        edges += [(1, i), (i, i + 1), (i + 1, i + 2)]
        radii += [0.09, 0.066, 0.058]
        hip, kn, an = J["hip" + s_], J["kn" + s_], J["an" + s_]
        i = len(pts)
        pts += [hip, kn, kn.lerp(an, 0.22)]
        edges += [(0, i), (i, i + 1), (i + 1, i + 2)]
        radii += [0.105, 0.078, 0.066]
    skin(f"{name}_Suit", pts, edges, radii, M["suit"], root)

    for s_ in ("L", "R"):
        el, wr = J["el" + s_], J["wr" + s_]
        d = (wr - el).normalized()
        skin(f"{name}_Glove{s_}", [el.lerp(wr, 0.4), el.lerp(wr, 0.55), wr, wr + d * 0.07],
             [(0, 1), (1, 2), (2, 3)], [0.072, 0.066, 0.056, 0.06], M["red"], root)
        ball(f"{name}_Fist{s_}", wr + d * 0.1, 0.068, (1, 1, 1), M["red"], root)
        kn, an, toe = J["kn" + s_], J["an" + s_], J["toe" + s_]
        skin(f"{name}_Boot{s_}", [kn.lerp(an, 0.18), kn.lerp(an, 0.3), an, toe],
             [(0, 1), (1, 2), (2, 3)], [0.08, 0.074, 0.064, (0.066, 0.05)], M["red"], root)

    # head: a smooth egg, small ears, and the famous blank face
    skin(f"{name}_Neck", [J["chest"].lerp(J["neck"], 0.4), J["neck"], J["head"]], [(0, 1), (1, 2)],
         [0.06, 0.054, 0.056], M["skin"], root)
    hc = J["head"] + up * 0.04
    ball(f"{name}_Head", hc, 0.128, (0.9, 0.98, 1.2), M["skin"], root)
    for sx in (-1, 1):
        ball(f"{name}_Ear{sx}", hc + right * sx * 0.113 - up * 0.01, 0.03, (0.5, 0.8, 1.2), M["skin"], root)
        eye = hc + front * 0.108 + right * sx * 0.046 + up * 0.03
        ball(f"{name}_Eye{sx}", eye, 0.034, (1.0, 0.35, 0.72), M["white"], root)
        ball(f"{name}_Pupil{sx}", eye + front * 0.012, 0.0065, (1, 0.6, 1), M["black"], root)
        ball(f"{name}_Brow{sx}", eye + up * 0.044 + front * 0.004, 0.03, (1.0, 0.25, 0.1), M["black"], root)
    ball(f"{name}_Mouth", hc + front * 0.116 - up * 0.062, 0.02, (1.0, 0.25, 0.09), M["black"], root)

    # belt, buckle, collar and the two cape buttons
    waist = J["pelvis"].lerp(J["chest"], 0.18)
    ball(f"{name}_Belt", waist, 1.0, (0.182, 0.135, 0.036), M["black"], root)
    ball(f"{name}_Buckle", waist + front * 0.128, 0.05, (1, 0.3, 1), M["gold"], root)
    base = J["chest"].lerp(J["neck"], 0.45)
    ball(f"{name}_Collar", base - front * 0.02, 1.0, (0.215, 0.15, 0.05), M["white"], root)
    for sx in (-1, 1):
        ball(f"{name}_Button{sx}", base + right * sx * 0.15 + front * 0.085 - up * 0.01, 0.03, (1, 0.6, 1), M["black"], root)

    # cape: a sheet hung from the shoulders that falls straight down and flares out
    bm = bmesh.new()
    U, Vn, length = 10, 14, 1.12
    back = -front
    grid = []
    for v in range(Vn + 1):
        t = v / Vn
        row = []
        for u in range(U + 1):
            x = (u / U - 0.5) * 2
            half = 0.2 + 0.3 * t
            p = base + right * x * half + back * (0.085 + 0.2 * t * t + (1 - x * x) * 0.03)
            p += back * math.sin(u * 1.9 + v * 0.35) * 0.035 * t
            p.z -= length * t
            if p.z < 0.03:  # reached the ground: lie along it
                p += back * (0.03 - p.z) * 0.9
                p.z = 0.03 + (u % 2) * 0.004
            row.append(bm.verts.new(p))
        grid.append(row)
    for v in range(Vn):
        for u in range(U):
            bm.faces.new((grid[v][u], grid[v][u + 1], grid[v + 1][u + 1], grid[v + 1][u]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    cape = finish(f"{name}_Cape", bm, M["white"], smooth=True, parent=root)
    sol = cape.modifiers.new("Solid", "SOLIDIFY")
    sol.thickness = 0.012
    return root


def mirror(d):
    """Fill in the right side from the left where a pose is symmetric."""
    out = dict(d)
    for k, v in d.items():
        if k.endswith("L") and k[:-1] + "R" not in d:
            out[k[:-1] + "R"] = (-v[0], v[1], v[2])
    return out


# standing, arms wide, chin up
figure("Figure_Rise", mirror({
    "pelvis": (0, 0, 0.95), "chest": (0, 0.01, 1.38), "neck": (0, 0.02, 1.52), "head": (0, 0.05, 1.64),
    "shL": (0.19, 0, 1.44), "elL": (0.47, 0.02, 1.37), "wrL": (0.74, 0, 1.33),
    "hipL": (0.1, 0, 0.92), "knL": (0.11, -0.02, 0.5), "anL": (0.12, 0.02, 0.09), "toeL": (0.13, -0.14, 0.04),
}))
# sitting on the ground, knees up, seen from behind
figure("Figure_Sit", mirror({
    "pelvis": (0, 0, 0.13), "chest": (0, -0.1, 0.55), "neck": (0, -0.13, 0.68), "head": (0, -0.16, 0.8),
    "shL": (0.19, -0.1, 0.6), "elL": (0.27, -0.3, 0.42), "wrL": (0.2, -0.5, 0.5),
    "hipL": (0.1, -0.03, 0.13), "knL": (0.15, -0.4, 0.48), "anL": (0.15, -0.62, 0.09), "toeL": (0.15, -0.76, 0.05),
}))
# one arm reaching ahead; the site lays this one flat so it flies
figure("Figure_Fly", {
    "pelvis": (0, 0, 0.95), "chest": (0, 0, 1.38), "neck": (0, -0.03, 1.52), "head": (0, -0.07, 1.63),
    "shR": (-0.19, 0, 1.44), "elR": (-0.22, -0.04, 1.75), "wrR": (-0.2, -0.06, 2.02),
    "shL": (0.19, 0, 1.44), "elL": (0.28, 0.06, 1.15), "wrL": (0.31, 0.1, 0.88),
    "hipL": (0.1, 0, 0.92), "knL": (0.1, 0.03, 0.5), "anL": (0.1, 0.13, 0.1), "toeL": (0.1, 0.12, -0.06),
    "hipR": (-0.1, 0, 0.92), "knR": (-0.1, -0.07, 0.52), "anR": (-0.1, 0.11, 0.15), "toeR": (-0.1, 0.11, -0.01),
})
# mid-stride
figure("Figure_Run", {
    "pelvis": (0, 0, 0.93), "chest": (0, -0.09, 1.34), "neck": (0, -0.12, 1.48), "head": (0, -0.15, 1.6),
    "shL": (0.19, -0.09, 1.4), "elL": (0.24, -0.2, 1.17), "wrL": (0.2, -0.42, 1.28),
    "shR": (-0.19, -0.09, 1.4), "elR": (-0.24, 0.12, 1.2), "wrR": (-0.25, 0.33, 1.1),
    "hipL": (0.1, 0, 0.9), "knL": (0.1, 0.13, 0.5), "anL": (0.1, 0.5, 0.4), "toeL": (0.1, 0.56, 0.26),
    "hipR": (-0.1, 0, 0.9), "knR": (-0.1, -0.3, 0.6), "anR": (-0.1, -0.24, 0.18), "toeR": (-0.1, -0.39, 0.13),
})

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_materials="EXPORT")

if BLEND:
    roots = [o for o in scene.objects if o.parent is None]
    for i, o in enumerate(sorted(roots, key=lambda o: o.name)):
        o.location.x = (i - len(roots) / 2) * 3.2
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)

print("OK", len([o for o in scene.objects if o.type == "MESH"]), "meshes ->", OUT)
