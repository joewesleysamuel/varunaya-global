"""
Varunaya Global: "Obelisk" bottle, rendered in Blender Cycles.

Builds the bottle procedurally (no external assets), lights it in a softbox
studio and renders transparent frames (with a contact shadow) that the website
scrubs with scroll.

Usage (Blender 4.2+ / bpy 5.x):
  python render/obelisk.py --shot turntable --out out/turntable --frames 0-119
  python render/obelisk.py --shot dolly     --out out/dolly     --frames 0-71
  python render/obelisk.py --shot test      --out out/test
Options: --res 1000x1500  --samples 96  --font path/to/font.ttf

Or inside Blender:  blender -b -P render/obelisk.py -- --shot turntable ...
"""
import argparse
import math
import os
import sys

import bpy  # must come first: it makes bmesh and mathutils importable
import bmesh
from mathutils import Vector

# ----------------------------------------------------------------------------
# Arguments
# ----------------------------------------------------------------------------
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument("--shot", default="test", choices=["test", "turntable", "dolly", "detail", "none"])
ap.add_argument("--out", default="out/test")
ap.add_argument("--frames", default="0-0")
ap.add_argument("--total", type=int, default=0, help="frames in the full shot (defaults to end of --frames + 1)")
ap.add_argument("--res", default="1000x1500")
ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--font", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "bricolage-800.ttf"))
ap.add_argument("--font-light", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "bricolage-500.ttf"))
ap.add_argument("--droplets", type=int, default=1400)
ap.add_argument("--save-blend", default="", help="save the bottle scene to a .blend (used by render/valley.py)")
args = ap.parse_args(argv)

f0, f1 = (int(x) for x in args.frames.split("-"))
TOTAL = args.total or (f1 + 1)
RES_X, RES_Y = (int(x) for x in args.res.split("x"))

# ----------------------------------------------------------------------------
# Scene reset
# ----------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ----------------------------------------------------------------------------
# Geometry: lofted body, square section with soft corners, easing to a round neck
# ----------------------------------------------------------------------------
# (z, half width, superellipse exponent). n=2 is a circle; n~8 a soft square.
PROFILE = [
    (0.000, 0.262, 6.0),
    (0.006, 0.288, 7.0),
    (0.022, 0.304, 8.0),
    (0.050, 0.310, 8.5),
    (1.560, 0.310, 8.5),
    (1.640, 0.306, 8.0),
    (1.720, 0.288, 6.5),
    (1.790, 0.250, 4.8),
    (1.850, 0.200, 3.4),
    (1.900, 0.158, 2.5),
    (1.940, 0.132, 2.1),
    (1.965, 0.124, 2.0),
    (2.060, 0.124, 2.0),
]
RING = 160
# Slimmer than the raw table: the body walls scale, the neck does not.
SLIM = 0.9
PROFILE = [(z, w * SLIM if w > 0.13 else w, n) for z, w, n in PROFILE]


def superellipse(n, w, k):
    """Point k of RING on a superellipse of half width w."""
    t = 2 * math.pi * k / RING
    c, s = math.cos(t), math.sin(t)
    x = w * math.copysign(abs(c) ** (2 / n), c)
    y = w * math.copysign(abs(s) ** (2 / n), s)
    return x, y


def smooth_profile(points, steps=6):
    """Catmull-Rom resample of the profile so the shoulder is fluid."""
    out = []
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)
                for j in range(3)
            ))
    out.append(points[-1])
    return out


def loft(name, profile, cap_bottom=True, cap_top=True):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for z, w, n in profile:
        rings.append([bm.verts.new((*superellipse(max(2.0, n), w, k), z)) for k in range(RING)])
    for a, b in zip(rings, rings[1:]):
        for k in range(RING):
            bm.faces.new((a[k], a[(k + 1) % RING], b[(k + 1) % RING], b[k]))
    if cap_bottom:
        c = bm.verts.new((0, 0, profile[0][0]))
        for k in range(RING):
            bm.faces.new((rings[0][(k + 1) % RING], rings[0][k], c))
    if cap_top:
        c = bm.verts.new((0, 0, profile[-1][0]))
        for k in range(RING):
            bm.faces.new((rings[-1][k], rings[-1][(k + 1) % RING], c))
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    for p in mesh.polygons:
        p.use_smooth = True
    bpy.context.collection.objects.link(obj)
    return obj


root = bpy.data.objects.new("Bottle", None)
bpy.context.collection.objects.link(root)

body = loft("Glass", smooth_profile(PROFILE))
body.parent = root

# Cap: heavy, square-shouldered, echoing the body. Polished black chrome.
CAP = [
    (2.000, 0.150, 5.5),
    (2.004, 0.160, 6.0),
    (2.016, 0.166, 6.5),
    (2.380, 0.166, 6.5),
    (2.396, 0.161, 6.0),
    (2.404, 0.150, 5.5),
]
cap = loft("Cap", smooth_profile(CAP, 4))
cap.parent = root
# A hairline groove where the cap meets the shoulder line.
ring = loft("CapRing", [(1.992, 0.128, 2.0), (2.000, 0.138, 2.0), (2.004, 0.138, 2.0)], cap_bottom=False)
ring.parent = root


def text_obj(name, body_text, font, size, extrude=0.0012):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body_text
    curve.font = bpy.data.fonts.load(font)
    curve.size = size
    curve.extrude = extrude
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.space_character = 0.96
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return obj


# Wordmark runs vertically up the front face, like a flacon.
FACE = 0.3102 * SLIM
mark = text_obj("Wordmark", "varunaya", args.font, 0.19)
mark.rotation_euler = (math.radians(90), math.radians(-90), 0)
mark.location = (0.0, -FACE, 0.86)
mark.parent = root
small = text_obj("Global", "Global", args.font_light, 0.048, 0.0008)
small.rotation_euler = (math.radians(90), 0, 0)
small.location = (0.0, -FACE, 0.2)
small.parent = root

# ----------------------------------------------------------------------------
# Materials
# ----------------------------------------------------------------------------
def principled(name, **inputs):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    for k, v in inputs.items():
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = v
    return mat, bsdf


# Satin black glass: soft broad highlights.
satin, satin_bsdf = principled(
    "SatinBlack",
    **{"Base Color": (0.004, 0.004, 0.0045, 1), "Roughness": 0.26, "Specular IOR Level": 0.4,
       "Coat Weight": 0.25, "Coat Roughness": 0.12, "IOR": 1.5},
)
# Micro texture so the satin reads as a real finish, not CG plastic.
nt = satin.node_tree
noise = nt.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 900.0
noise.inputs["Detail"].default_value = 4.0
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.025
nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], satin_bsdf.inputs["Normal"])

gloss, _ = principled(
    "GlossBlack",
    **{"Base Color": (0.003, 0.003, 0.003, 1), "Roughness": 0.04, "Coat Weight": 1.0, "Coat Roughness": 0.0},
)
chrome, _ = principled(
    "BlackChrome",
    **{"Base Color": (0.06, 0.06, 0.065, 1), "Metallic": 1.0, "Roughness": 0.07},
)
water, _ = principled(
    "Droplet",
    **{"Base Color": (1, 1, 1, 1), "Roughness": 0.0, "Transmission Weight": 1.0, "IOR": 1.333},
)

body.data.materials.append(satin)
cap.data.materials.append(chrome)
ring.data.materials.append(gloss)
mark.data.materials.append(gloss)
small.data.materials.append(gloss)

# ----------------------------------------------------------------------------
# Condensation: instanced droplets aligned to the surface normal
# ----------------------------------------------------------------------------
if args.droplets > 0:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=(0, 0, -50))
    drop = bpy.context.active_object
    drop.name = "DropletSource"
    drop.scale = (1.0, 1.0, 0.42)  # flattened dome; local Z aligns to the normal
    bpy.ops.object.transform_apply(scale=True)
    drop.data.materials.append(water)
    for p in drop.data.polygons:
        p.use_smooth = True
    drop.hide_render = False
    drop.visible_camera = True

    # Emit only from the straight walls (not base, shoulder or neck).
    vg = body.vertex_groups.new(name="walls")
    vg.add([v.index for v in body.data.vertices if 0.12 < v.co.z < 1.62], 1.0, "REPLACE")

    psys_mod = body.modifiers.new("Condensation", "PARTICLE_SYSTEM")
    ps = psys_mod.particle_system
    ps.vertex_group_density = "walls"
    ps.seed = 11
    st = ps.settings
    st.type = "HAIR"
    st.use_advanced_hair = True
    st.count = args.droplets
    st.hair_length = 1.0
    st.emit_from = "FACE"
    st.distribution = "RAND"
    st.use_even_distribution = True
    st.render_type = "OBJECT"
    st.instance_object = drop
    st.particle_size = 0.0065
    st.size_random = 0.75
    st.use_rotations = True
    st.rotation_mode = "NOR"
    st.use_rotation_instance = False
    st.display_method = "NONE"

# ----------------------------------------------------------------------------
# Studio: softboxes that read as long streaks on black, plus a shadow catcher
# ----------------------------------------------------------------------------
def area(name, size, size_y, power, loc, target=(0, 0, 1.1), shadow=True):
    light = bpy.data.lights.new(name, "AREA")
    light.shape = "RECTANGLE"
    light.size = size
    light.size_y = size_y
    light.energy = power
    light.use_shadow = shadow  # only the top box casts the contact shadow
    obj = bpy.data.objects.new(name, light)
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    direction = Vector(target) - Vector(loc)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    obj.visible_camera = False
    return obj


area("StripLeft", 0.3, 4.0, 480, (-2.6, 0.9, 1.3), shadow=False)
area("StripRight", 0.3, 4.0, 480, (2.6, 0.9, 1.3), shadow=False)
area("Top", 2.2, 2.2, 150, (0.0, 0.2, 4.4))
area("FrontFill", 0.12, 3.0, 22, (-1.6, -3.0, 1.2), shadow=False)
area("Kicker", 0.25, 2.4, 30, (2.0, -2.2, 1.6), shadow=False)

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.02, 0.022, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0

bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = "ShadowCatcher"
floor.is_shadow_catcher = True
floor.visible_glossy = False  # no grey floor reflection in the black glass

# ----------------------------------------------------------------------------
# Camera and animation
# ----------------------------------------------------------------------------
cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 85
cam_data.sensor_width = 36
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam


def aim(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def ease(t):
    return t * t * (3 - 2 * t)


def pose(frame):
    """Bottle turn (radians), camera position and target for a frame."""
    t = frame / max(1, TOTAL - 1)
    if args.shot == "turntable":
        # A full turn, starting slightly off-front so the first frame has depth.
        return (-0.35 + t * 2 * math.pi, Vector((0.0, -9.2, 1.62)), Vector((0, 0, 1.18)))
    if args.shot == "dolly":
        # Push in from the full bottle to the cap and the top of the wordmark.
        e = ease(t)
        cam_loc = Vector((0.0, -9.2, 1.62)).lerp(Vector((0.55, -2.4, 2.18)), e)
        target = Vector((0, 0, 1.18)).lerp(Vector((0, 0, 1.92)), e)
        return (-0.35 + 0.55 * e, cam_loc, target)
    if args.shot == "detail":
        return (-0.2, Vector((0.35, -1.55, 1.25)), Vector((0, 0, 1.12)))
    return (-0.35, Vector((0.0, -9.2, 1.62)), Vector((0, 0, 1.18)))


# ----------------------------------------------------------------------------
# Render settings
# ----------------------------------------------------------------------------
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = args.samples
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.015
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
scene.cycles.max_bounces = 10
scene.cycles.transmission_bounces = 10
scene.cycles.glossy_bounces = 6
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.render.film_transparent = True
scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass

if args.save_blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save_blend))
    print(f"[obelisk] saved {args.save_blend}", flush=True)
if args.shot == "none":
    raise SystemExit(0)

os.makedirs(args.out, exist_ok=True)
for frame in range(f0, f1 + 1):
    turn, cam_loc, target = pose(frame)
    root.rotation_euler = (0, 0, turn)
    cam.location = cam_loc
    aim(cam, target)
    bpy.context.view_layer.update()
    scene.render.filepath = os.path.join(args.out, f"frame_{frame:04d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[obelisk] {args.shot} frame {frame} -> {scene.render.filepath}", flush=True)
