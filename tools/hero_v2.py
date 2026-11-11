"""Hero v2: the caped hero with heroic proportions, real fists and boots, a cape mantle,
a skeleton and four movement cycles. Exports a GLB for the site and saves a .blend.

  blender --background --factory-startup --python tools/hero_v2.py -- public/models/hero.glb tools/hero_v2.blend tools/hero_v2.png
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector as V, Matrix, Quaternion, kdtree

args = sys.argv[sys.argv.index("--") + 1:]
OUT, BLEND, PNG = args[0], args[1], (args[2] if len(args) > 2 else None)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = bpy.data.collections.new("Hero")
scene.collection.children.link(col)
vl = bpy.context.view_layer
dg = lambda: bpy.context.evaluated_depsgraph_get()


def mat(name, rgb, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    m.diffuse_color = (*rgb, 1)
    return m


M = dict(
    suit=mat("Hero_Suit", (0.96, 0.66, 0.03), 0.6),
    red=mat("Hero_Red", (0.62, 0.04, 0.025), 0.42),
    white=mat("Hero_White", (0.9, 0.9, 0.9), 0.7),
    black=mat("Hero_Black", (0.012, 0.012, 0.014), 0.45),
    gold=mat("Hero_Gold", (0.82, 0.55, 0.08), 0.3, 0.85),
    skin=mat("Hero_Skin", (0.93, 0.68, 0.52), 0.55),
    shade=mat("Hero_SkinShade", (0.62, 0.38, 0.28), 0.6),
    grey=mat("Hero_Grey", (0.45, 0.46, 0.48), 0.35, 0.8),
)
PARTS = {}  # name -> (object, how to weight it)


def keep(obj, weight):
    PARTS[obj.name] = (obj, weight)
    return obj


def real(name, obj, material):
    vl.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg()))
    me.name = name
    me.materials.clear()
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = True
    out = bpy.data.objects.new(name, me)
    col.objects.link(out)
    bpy.data.objects.remove(obj, do_unlink=True)
    return out


def skin(name, pts, edges, radii, material, weight="auto", sub=3):
    me = bpy.data.meshes.new(name + "_src")
    me.from_pydata([tuple(p) for p in pts], edges, [])
    ob = bpy.data.objects.new(name + "_src", me)
    col.objects.link(ob)
    sk = ob.modifiers.new("Skin", "SKIN")
    sk.use_smooth_shade = True
    d = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        d[i].radius = r if isinstance(r, tuple) else (r, r)
        d[i].use_root = i == 0
    s = ob.modifiers.new("Sub", "SUBSURF")
    s.levels = sub
    return keep(real(name, ob, material), weight)


def from_bm(name, bm, material, weight):
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return keep(ob, weight)


def ball(name, c, r, sc, material, weight, seg=32, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(8, seg // 2), radius=r)
    for v in bm.verts:
        p = V((v.co.x * sc[0], v.co.y * sc[1], v.co.z * sc[2]))
        if rot:
            p = rot @ p
        v.co = p + V(c)
    return from_bm(name, bm, material, weight)


def ring(name, c, rx, ry, minor, squash, material, weight, seg=48, mseg=14, tilt=0.0, xform=None):
    bm = bmesh.new()
    rows = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        row = []
        for j in range(mseg):
            b = 2 * math.pi * j / mseg
            p = V(((rx + minor * math.cos(b)) * math.cos(a), (ry + minor * math.cos(b)) * math.sin(a),
                   minor * squash * math.sin(b) + tilt * math.sin(a)))
            if xform:
                p = xform @ p
            row.append(bm.verts.new(p + V(c)))
        rows.append(row)
    for i in range(seg):
        for j in range(mseg):
            bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % mseg], rows[i][(j + 1) % mseg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return from_bm(name, bm, material, weight)


# ================= rest pose: T-pose, facing -Y, Z up =================
front, right, up = V((0, -1, 0)), V((1, 0, 0)), V((0, 0, 1))
pelvis, chest, neck, head = V((0, 0, 0.98)), V((0, -0.008, 1.4)), V((0, 0, 1.55)), V((0, 0, 1.665))
ARM_Z = 1.48
J = {}
for s, sx in (("L", 1), ("R", -1)):
    J["sh" + s] = V((0.225 * sx, 0, ARM_Z)); J["el" + s] = V((0.5 * sx, 0, ARM_Z)); J["wr" + s] = V((0.77 * sx, 0, ARM_Z))
    J["hip" + s] = V((0.108 * sx, 0, 0.93)); J["kn" + s] = V((0.116 * sx, -0.014, 0.52))
    J["an" + s] = V((0.122 * sx, 0.02, 0.1)); J["toe" + s] = V((0.128 * sx, -0.17, 0.04))

# ---- body: one suit with a real silhouette (waist, ribs, chest, delts, biceps, quads) ----
pts = [pelvis, V((0, 0, 1.09)), V((0, -0.004, 1.23)), chest, V((0, 0, 1.475))]
edges = [(0, 1), (1, 2), (2, 3), (3, 4)]
radii = [(0.172, 0.126), (0.148, 0.108), (0.186, 0.124), (0.218, 0.136), (0.17, 0.11)]
for s, sx in (("L", 1), ("R", -1)):
    sh, el, wr = J["sh" + s], J["el" + s], J["wr" + s]
    i = len(pts)
    pts += [sh, sh.lerp(el, 0.42), sh.lerp(el, 0.8), el, el.lerp(wr, 0.28), el.lerp(wr, 0.5)]
    edges += [(4, i), (i, i + 1), (i + 1, i + 2), (i + 2, i + 3), (i + 3, i + 4), (i + 4, i + 5)]
    radii += [0.104, 0.083, 0.07, 0.06, 0.066, 0.058]
    hip, kn, an = J["hip" + s], J["kn" + s], J["an" + s]
    i = len(pts)
    pts += [hip, hip.lerp(kn, 0.4) + V((0.004 * sx, -0.012, 0)), hip.lerp(kn, 0.8), kn, kn.lerp(an, 0.2) + V((0, 0.012, 0)), kn.lerp(an, 0.4)]
    edges += [(0, i), (i, i + 1), (i + 1, i + 2), (i + 2, i + 3), (i + 3, i + 4), (i + 4, i + 5)]
    radii += [0.122, 0.116, 0.09, 0.078, 0.086, 0.07]
skin("H_Suit", pts, edges, radii, M["suit"])

for s, sx in (("L", 1), ("R", -1)):
    el, wr = J["el" + s], J["wr" + s]
    d = (wr - el).normalized()
    X = Matrix.Rotation(math.pi / 2, 3, 'Y')
    # glove: flared cuff, sleeve, and a proper fist
    skin("H_Glove" + s, [el.lerp(wr, 0.4), el.lerp(wr, 0.52), el.lerp(wr, 0.8), wr], [(0, 1), (1, 2), (2, 3)],
         [0.078, 0.07, 0.062, 0.056], M["red"], "forearm." + s)
    ring("H_Cuff" + s, el.lerp(wr, 0.4), 0.08, 0.08, 0.017, 1.0, M["red"], "forearm." + s, 32, 10, xform=X)
    ring("H_CuffB" + s, el.lerp(wr, 0.47), 0.073, 0.073, 0.009, 1.0, M["red"], "forearm." + s, 32, 8, xform=X)
    fist = wr + d * 0.095
    ball("H_Fist" + s, fist, 1.0, (0.078, 0.062, 0.066), M["red"], "hand." + s, 28)
    for k in range(4):   # knuckles and curled fingers
        ball(f"H_Knuckle{s}{k}", fist + d * 0.058 + V((0, (k - 1.5) * 0.029, 0.03)), 0.021, (1.2, 0.72, 1.0), M["red"], "hand." + s, 14)
        ball(f"H_Finger{s}{k}", fist + d * 0.05 + V((0, (k - 1.5) * 0.029, -0.012)), 0.02, (1.5, 0.72, 1.6), M["red"], "hand." + s, 14)
    ball("H_Thumb" + s, fist + d * 0.01 + V((0, -0.058, -0.012)), 0.027, (1.7, 0.85, 0.9), M["red"], "hand." + s, 16)

    kn, an, toe = J["kn" + s], J["an" + s], J["toe" + s]
    top = kn.lerp(an, 0.24)
    skin("H_Boot" + s, [top, kn.lerp(an, 0.5), an + V((0, 0, 0.04)), an + V((0, -0.02, -0.03)), an.lerp(toe, 0.6) + V((0, 0, -0.012)), toe],
         [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)], [0.09, 0.08, 0.07, (0.066, 0.058), (0.066, 0.05), (0.06, 0.04)], M["red"])
    ring("H_BootCuff" + s, top, 0.092, 0.092, 0.018, 1.0, M["red"], "shin." + s, 32, 10)
    ball("H_Sole" + s, an.lerp(toe, 0.48) + V((0, 0.012, -0.05)), 1.0, (0.066, 0.15, 0.016), M["black"], "foot." + s, 24)
    ball("H_Heel" + s, an + V((0, 0.05, -0.052)), 1.0, (0.056, 0.048, 0.024), M["black"], "foot." + s, 16)

# ---- head ----
skin("H_Neck", [chest.lerp(neck, 0.35), neck, head], [(0, 1), (1, 2)], [0.074, 0.066, 0.066], M["skin"], sub=2)
hc = head + V((0, 0, 0.05))
HR = (0.115, 0.125, 0.156)   # half-widths of the egg
hd = ball("H_Head", hc, 1.0, HR, M["skin"], "head", 56)
for v in hd.data.vertices:   # narrower jaw, a little chin
    z = (v.co.z - hc.z) / HR[2]
    if z < 0:
        v.co.x = hc.x + (v.co.x - hc.x) * (1 + z * 0.26)
        v.co.y = hc.y + (v.co.y - hc.y) * (1 + z * 0.14) + z * 0.012


def on_face(x, z, lift=0.0):
    """A point on the front of the head at sideways offset x and height offset z."""
    k = 1 - (x / HR[0]) ** 2 - (z / HR[2]) ** 2
    jaw = 1 + min(0, z / HR[2]) * 0.14
    return hc + V((x, -HR[1] * math.sqrt(max(k, 0.01)) * jaw - lift + min(0, z / HR[2]) * 0.012, z))


def facing(x, z):
    """Rotation that turns something built facing forward so it lies flat on the head there."""
    n = V((x / HR[0] ** 2, -math.sqrt(max(1 - (x / HR[0]) ** 2 - (z / HR[2]) ** 2, 0.01)) / HR[1], z / HR[2] ** 2)).normalized()
    return V((0, -1, 0)).rotation_difference(n).to_matrix()


for sx in (-1, 1):
    ball(f"H_Ear{sx}", hc + right * sx * 0.112 - up * 0.02, 0.036, (0.38, 0.72, 1.2), M["skin"], "head", 20)
    ball(f"H_EarIn{sx}", hc + right * sx * 0.121 - up * 0.022 + front * 0.004, 0.02, (0.2, 0.6, 1.1), M["shade"], "head", 12)
    e = on_face(sx * 0.046, 0.026)
    F = facing(sx * 0.046, 0.026)
    ball(f"H_Eye{sx}", e + V((0, 0.004, 0)), 0.03, (1.18, 0.2, 0.8), M["white"], "head", 28, rot=F)
    ball(f"H_EyeRim{sx}", e + V((0, 0.0075, 0)), 0.0325, (1.18, 0.2, 0.82), M["black"], "head", 28, rot=F)
    ball(f"H_Lid{sx}", on_face(sx * 0.046, 0.048, 0.001), 0.034, (1.14, 0.16, 0.085), M["black"], "head", 16, rot=F)
    ball(f"H_Pupil{sx}", on_face(sx * 0.045, 0.024, 0.004), 0.0058, (1, 0.35, 1), M["black"], "head", 12, rot=F)
    ball(f"H_Brow{sx}", on_face(sx * 0.047, 0.07, 0.001), 0.029, (1.0, 0.16, 0.07), M["black"], "head", 16,
         rot=facing(sx * 0.047, 0.07) @ Matrix.Rotation(math.radians(-5 * sx), 3, 'Y'))
ball("H_Nose", on_face(0.004, -0.02, 0.001), 0.011, (0.3, 0.3, 1.25), M["shade"], "head", 12)
ball("H_Mouth", on_face(0, -0.07, 0.0015), 0.024, (1.0, 0.16, 0.06), M["black"], "head", 16)

# ---- belt, buckle, zip, collar, mantle ----
waist = V((0, 0, 1.085))
ring("H_Belt", waist, 0.155, 0.112, 0.024, 1.45, M["black"], "spine", 64, 12)
ball("H_Buckle", waist + front * 0.138, 0.058, (1, 0.26, 1), M["gold"], "spine", 32)
ring("H_BuckleRim", waist + front * 0.152, 0.04, 0.04, 0.009, 1.0, M["gold"], "spine", 28, 8, xform=Matrix.Rotation(math.pi / 2, 3, 'X'))
base = V((0, 0, 1.505))
ring("H_Collar", base, 0.085, 0.078, 0.028, 0.75, M["white"], "chest", 48, 12, tilt=-0.012)
ball("H_Placket", V((0, -0.134, 1.4)), 1.0, (0.036, 0.012, 0.1), M["white"], "chest", 20)
ball("H_Zip", V((0, -0.146, 1.385)), 1.0, (0.009, 0.006, 0.075), M["grey"], "chest", 12)
ring("H_ZipPull", V((0, -0.15, 1.455)), 0.014, 0.014, 0.005, 1.0, M["grey"], "chest", 16, 6, xform=Matrix.Rotation(math.pi / 2, 3, 'X'))
# the cape's shoulder mantle, pinned by two round buttons
ring("H_Mantle", V((0, 0.02, 1.5)), 0.185, 0.128, 0.05, 0.78, M["white"], "chest", 64, 16, tilt=-0.05)
for sx in (-1, 1):
    ball(f"H_Button{sx}", V((sx * 0.15, -0.118, 1.452)), 0.037, (1, 0.5, 1), M["black"], "chest", 24)
    ball(f"H_ButtonShine{sx}", V((sx * 0.141, -0.136, 1.462)), 0.009, (1, 0.5, 1), M["grey"], "chest", 10)

# ---- cape ----
bm = bmesh.new()
U, Vn, length = 22, 34, 1.3
grid = []
for v in range(Vn + 1):
    t = v / Vn
    row = []
    for u in range(U + 1):
        x = (u / U - 0.5) * 2
        half = 0.215 + 0.42 * t ** 0.85
        p = V((x * half, 0.115 + 0.2 * t * t + (1 - x * x) * 0.04, 1.49 - length * t))
        p.y += math.sin(u * 1.05 + v * 0.28) * 0.036 * t          # folds
        p.z += math.sin(u * 1.05) * 0.03 * t * t                  # scalloped hem
        row.append(bm.verts.new(p))
    grid.append(row)
for v in range(Vn):
    for u in range(U):
        bm.faces.new((grid[v][u], grid[v][u + 1], grid[v + 1][u + 1], grid[v + 1][u]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
cape_src = from_bm("H_Cape_src", bm, M["white"], "cape")
del PARTS["H_Cape_src"]
cape_src.modifiers.new("Solid", "SOLIDIFY").thickness = 0.012
cape = keep(real("H_Cape", cape_src, M["white"]), "cape")

# ================= skeleton =================
arm = bpy.data.armatures.new("HeroRig")
rig = bpy.data.objects.new("HeroRig", arm)
col.objects.link(rig)
vl.objects.active = rig
bones = [
    ("hips", (0, 0, 0.98), (0, 0, 1.12), None), ("spine", (0, 0, 1.12), (0, 0, 1.32), "hips"),
    ("chest", (0, 0, 1.32), (0, 0, 1.53), "spine"), ("neck", (0, 0, 1.53), (0, 0, 1.63), "chest"),
    ("head", (0, 0, 1.63), (0, 0, 1.9), "neck"),
    ("cape1", (0, 0.115, 1.48), (0, 0.16, 1.08), "chest"), ("cape2", (0, 0.16, 1.08), (0, 0.25, 0.66), "cape1"),
    ("cape3", (0, 0.25, 0.66), (0, 0.37, 0.22), "cape2"),
]
for s, sx in (("L", 1), ("R", -1)):
    bones += [
        ("shoulder." + s, (0.05 * sx, 0, ARM_Z), (0.225 * sx, 0, ARM_Z), "chest"),
        ("upper_arm." + s, (0.225 * sx, 0, ARM_Z), (0.5 * sx, 0, ARM_Z), "shoulder." + s),
        ("forearm." + s, (0.5 * sx, 0, ARM_Z), (0.77 * sx, 0, ARM_Z), "upper_arm." + s),
        ("hand." + s, (0.77 * sx, 0, ARM_Z), (0.95 * sx, 0, ARM_Z), "forearm." + s),
        ("thigh." + s, tuple(J["hip" + s]), tuple(J["kn" + s]), "hips"),
        ("shin." + s, tuple(J["kn" + s]), tuple(J["an" + s]), "thigh." + s),
        ("foot." + s, tuple(J["an" + s]), tuple(J["toe" + s]), "shin." + s),
    ]
with bpy.context.temp_override(active_object=rig, object=rig):
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones
    for name, h, t, parent in bones:
        b = eb.new(name)
        b.head, b.tail = h, t
        if parent:
            b.parent = eb[parent]
            b.use_connect = (V(h) - eb[parent].tail).length < 1e-4
    for n in ("cape1", "cape2", "cape3"):
        eb[n].use_deform = False
    bpy.ops.object.mode_set(mode='OBJECT')


def join(name, objs):
    for o in vl.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    vl.objects.active = objs[0]
    with bpy.context.temp_override(active_object=objs[0], object=objs[0], selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


auto = [o for o, w in PARTS.values() if w == "auto"]
body = join("Hero_Body", [PARTS["H_Suit"][0]] + [o for o in auto if o.name != "H_Suit"])
for o in vl.objects:
    o.select_set(False)
body.select_set(True)
rig.select_set(True)
vl.objects.active = rig
with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[body, rig], selected_editable_objects=[body, rig]):
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for b in arm.bones:
    if b.name.startswith("cape"):
        b.use_deform = True
# anything the automatic weighting missed borrows from its nearest neighbour
me = body.data
has = [any(g.weight > 0 for g in v.groups) for v in me.vertices]
kd = kdtree.KDTree(max(1, sum(has)))
for v in me.vertices:
    if has[v.index]:
        kd.insert(v.co, v.index)
kd.balance()
stray = 0
for v in me.vertices:
    if not has[v.index]:
        _, idx, _ = kd.find(v.co)
        for g in me.vertices[idx].groups:
            if g.weight > 0:
                body.vertex_groups[g.group].add([v.index], g.weight, 'REPLACE')
        stray += 1

rigid = []
for o, w in PARTS.values():
    if w in ("auto",) or o.name not in bpy.data.objects:
        continue
    if w == "cape":
        zs = [v.co.z for v in o.data.vertices]
        top, bot = max(zs), min(zs)
        names, stops = ["chest", "cape1", "cape2", "cape3"], [0.0, 0.3, 0.62, 1.0]
        groups = [o.vertex_groups.new(name=n) for n in names]
        for v in o.data.vertices:
            t = (top - v.co.z) / (top - bot)
            for i, g in enumerate(groups):
                lo = stops[i - 1] if i > 0 else -1
                hi = stops[i + 1] if i < 3 else 2
                wgt = max(0.0, 1 - abs(t - stops[i]) / ((hi - stops[i]) if t > stops[i] else (stops[i] - lo)))
                if wgt > 0:
                    g.add([v.index], wgt, 'REPLACE')
    else:
        o.vertex_groups.new(name=w).add(range(len(o.data.vertices)), 1.0, 'REPLACE')
    rigid.append(o)
hero = join("Hero", [body] + rigid)
hero.parent = rig
mod = next((m for m in hero.modifiers if m.type == 'ARMATURE'), None) or hero.modifiers.new("Armature", "ARMATURE")
mod.object = rig

# ================= movement =================
AX = {'x': V((1, 0, 0)), 'y': V((0, 1, 0)), 'z': V((0, 0, 1))}


def R(*steps):
    q = Quaternion()
    for axis, deg in steps:
        q = Quaternion(AX[axis], math.radians(deg)) @ q
    return q


pb = rig.pose.bones
rest = {b.name: b.bone.matrix_local.to_quaternion() for b in pb}
for b in pb:
    b.rotation_mode = 'QUATERNION'
rig.animation_data_create()
ad = rig.animation_data


def make(name, frames, pose):
    act = bpy.data.actions.new("Hero_" + name)
    ad.action = act
    for f in range(0, frames + 1, 2):
        rots, bob = pose(2 * math.pi * f / frames)
        for bone in pb.keys():
            q = rots.get(bone, Quaternion())
            pb[bone].rotation_quaternion = rest[bone].inverted() @ q @ rest[bone]
            pb[bone].keyframe_insert("rotation_quaternion", frame=f + 1)
        pb["hips"].location = (0, bob, 0)
        pb["hips"].keyframe_insert("location", frame=f + 1)
    ad.action = None
    tr = ad.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 1, act)


s, c = math.sin, math.cos


def walk(p):
    return {
        "hips": R(('z', 4 * s(p))), "chest": R(('z', -7 * s(p)), ('x', 2)), "head": R(('z', 3 * s(p))),
        "thigh.L": R(('x', -28 * s(p))), "thigh.R": R(('x', 28 * s(p))),
        "shin.L": R(('x', 6 + 46 * max(0, c(p)))), "shin.R": R(('x', 6 + 46 * max(0, -c(p)))),
        "foot.L": R(('x', -10 * s(p))), "foot.R": R(('x', 10 * s(p))),
        "upper_arm.L": R(('y', 76), ('x', 24 * s(p))), "upper_arm.R": R(('y', -76), ('x', -24 * s(p))),
        "forearm.L": R(('z', -(18 + 10 * s(p)))), "forearm.R": R(('z', 18 - 10 * s(p))),
        "cape1": R(('x', 9 + 4 * s(2 * p))), "cape2": R(('x', 7 + 6 * s(2 * p - 0.9))), "cape3": R(('x', 7 + 9 * s(2 * p - 1.8))),
    }, 0.02 * c(2 * p) - 0.02


def run(p):
    return {
        "hips": R(('z', 7 * s(p)), ('x', 13)), "chest": R(('z', -12 * s(p)), ('x', 4)), "head": R(('x', -10), ('z', 4 * s(p))),
        "thigh.L": R(('x', -6 - 48 * s(p))), "thigh.R": R(('x', -6 + 48 * s(p))),
        "shin.L": R(('x', 16 + 78 * max(0, c(p)))), "shin.R": R(('x', 16 + 78 * max(0, -c(p)))),
        "foot.L": R(('x', -16 * s(p))), "foot.R": R(('x', 16 * s(p))),
        "upper_arm.L": R(('y', 72), ('x', 48 * s(p))), "upper_arm.R": R(('y', -72), ('x', -48 * s(p))),
        "forearm.L": R(('z', -(78 + 12 * s(p)))), "forearm.R": R(('z', 78 - 12 * s(p))),
        "cape1": R(('x', 34 + 6 * s(2 * p))), "cape2": R(('x', 20 + 10 * s(2 * p - 0.9))), "cape3": R(('x', 14 + 16 * s(2 * p - 1.8))),
    }, 0.035 * c(2 * p) - 0.04


def fly(p):
    return {
        "hips": R(('x', 80), ('y', 4 * s(p))), "spine": R(('x', -4)), "neck": R(('x', -22)), "head": R(('x', -42)),
        "upper_arm.R": R(('y', 84), ('x', -4)), "forearm.R": R(('z', 4)),
        "upper_arm.L": R(('y', 78), ('x', 10)), "forearm.L": R(('z', -14)),
        "thigh.L": R(('x', 6 + 3 * s(p))), "thigh.R": R(('x', 12 - 3 * s(p))),
        "shin.L": R(('x', 8)), "shin.R": R(('x', 18 + 4 * s(p))),
        "foot.L": R(('x', 38)), "foot.R": R(('x', 38)),
        "cape1": R(('x', 12 + 7 * s(2 * p))), "cape2": R(('x', 4 + 11 * s(2 * p - 1.0))), "cape3": R(('x', 2 + 16 * s(2 * p - 2.0))),
    }, 0.0


def idle(p):
    return {
        "chest": R(('x', 1.5 * s(p))), "head": R(('x', -2 + 1.5 * s(p)), ('z', 3 * s(p * 0.5))),
        "upper_arm.L": R(('y', 78), ('x', 2 * s(p))), "upper_arm.R": R(('y', -78), ('x', 2 * s(p))),
        "forearm.L": R(('z', -8)), "forearm.R": R(('z', 8)),
        "cape1": R(('x', 4 + 2 * s(p))), "cape2": R(('x', 3 + 3 * s(p - 0.8))), "cape3": R(('x', 3 + 4 * s(p - 1.6))),
    }, 0.004 * s(p)


make("Walk", 32, walk); make("Run", 20, run); make("Fly", 40, fly); make("Idle", 48, idle)
for b in pb:
    b.rotation_quaternion = Quaternion()
    b.location = (0, 0, 0)

# ================= export =================
for o in vl.objects:
    o.select_set(False)
hero.select_set(True)
rig.select_set(True)
vl.objects.active = rig
with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[hero, rig]):
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=False,
                              export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
                              export_force_sampling=True, export_frame_step=2, export_optimize_animation_size=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))

if PNG:
    # a check sheet: idle from the front and three-quarter, mid-run, and flying
    for t in ad.nla_tracks:
        t.mute = True
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True
    scene.display.shading.show_object_outline = True
    scene.render.resolution_x, scene.render.resolution_y = 700, 900
    scene.render.film_transparent = False
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    scene.camera = cam
    shots = [("Idle", 1, (0, -6, 1.0), 2.3, "front"), ("Idle", 1, (3.6, -4.6, 1.5), 2.3, "three_quarter"),
             ("Idle", 1, (0, -3, 1.72), 0.62, "face"), ("Run", 7, (5, -2.2, 1.2), 2.5, "run"), ("Fly", 1, (4.5, -3, 2.2), 2.9, "fly")]
    for act, frame, loc, scale, tag in shots:
        ad.action = bpy.data.actions["Hero_" + act]
        scene.frame_set(frame)
        cam.data.ortho_scale = scale
        cam.location = loc
        tgt = V((0, 0, 1.72)) if tag == "face" else V((0, 0.15, 0.98))
        cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.abspath(PNG).replace(".png", f"_{tag}.png")
        bpy.ops.render.render(write_still=True)

tris = sum(len(p.vertices) - 2 for p in hero.data.polygons)
print("OK hero v2:", tris, "triangles, stray verts fixed:", stray, "->", OUT)
