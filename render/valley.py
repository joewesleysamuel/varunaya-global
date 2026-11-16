"""
Varunaya Global: "The Descent" hero, placeholder plates rendered in Blender Cycles.

Builds a procedural Himalayan valley (snow peak, glacier tongue, river through
boulders, still glacial lake, pine edges) at first light, then renders:
  master (16:9), mobile (9:16) and five chapter close ups.
It also projects each marker's 3D point into the master and mobile cameras and
writes the percentages to markers.json, so the page's markers sit exactly on
the landscape.

These are placeholders until real or generated footage arrives (see README).

Usage:
  python render/valley.py --out out/valley --shots master,mobile,peak,thaw,stone,stillness,vessel
Options: --scale 0.25 (preview size)  --samples 96  --bottle path/to/obelisk.blend
"""
import argparse
import json
import math
import os
import sys

import bpy  # must come first
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="out/valley")
ap.add_argument("--shots", default="master")
ap.add_argument("--scale", type=float, default=1.0)
ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--bottle", default="")
ap.add_argument("--grid", type=int, default=640)
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = np.random.default_rng(7)

# ----------------------------------------------------------------------------
# Heightfield
# ----------------------------------------------------------------------------
N = args.grid
X0, X1, Y0, Y1 = -95.0, 95.0, -14.0, 176.0
xs = np.linspace(X0, X1, N)
ys = np.linspace(Y0, Y1, N)
X, Y = np.meshgrid(xs, ys)  # [row=y, col=x]


def value_noise(cells, seed):
    """Smooth value noise sampled on the grid, lattice of `cells` per side."""
    r = np.random.default_rng(seed).random((cells + 2, cells + 2))
    u = (X - X0) / (X1 - X0) * cells
    v = (Y - Y0) / (Y1 - Y0) * cells
    i, j = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = u - i, v - j
    fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
    a, b = r[j, i], r[j, i + 1]
    c, d = r[j + 1, i], r[j + 1, i + 1]
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv


def fbm(octaves, base, seed, ridged=False, gain=0.5):
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        n = value_noise(base * 2 ** o, seed + o * 31)
        if ridged:
            n = 1.0 - np.abs(2 * n - 1)
            n = n * n
        total = total + n * amp
        norm += amp
        amp *= gain
    return total / norm


def gauss(cx, cy, sx, sy):
    return np.exp(-(((X - cx) / sx) ** 2 + ((Y - cy) / sy) ** 2))


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


ridges = fbm(7, 3, 11, ridged=True)
detail = fbm(6, 10, 50)

# Valley floor rising toward the mountain, walls rising to the sides.
floor = np.maximum(0, Y - 34) * 0.11
width = 9 + 0.17 * np.maximum(Y, 0)
walls = smoothstep(width, width + 46, np.abs(X - 0.06 * Y)) * (12 + 0.3 * np.maximum(Y, 0))
H = floor + walls * (0.55 + 0.7 * ridges)

# Peaks: a massive main summit and two shoulders.
H += gauss(9, 128, 26, 20) * (52 + 26 * ridges)
H += gauss(-38, 138, 22, 18) * (30 + 16 * ridges)
H += gauss(50, 142, 24, 18) * (34 + 16 * ridges)
H += detail * 2.2
# Crags and couloirs: high-frequency ridged noise scaled by altitude, plus
# vertical streaks (noise stretched along the fall line).
crags = fbm(5, 22, 90, ridged=True)
H += crags * np.clip(H / 55, 0, 1) * 9
streak_noise = value_noise(70, 123)
streaks = value_noise(12, 321) * 0.5 + 0.5 * np.sin(X * 0.9 + value_noise(8, 77) * 6)
H -= np.clip(H / 60, 0, 1) * (streaks * 2.2 + streak_noise * 1.2)

# Glacier tongue on the left: smoothed, slightly bulging, flowing down to y~47.
gpath_y = np.clip(Y, 47, 112)
gpath_x = -26 + (gpath_y - 47) * 0.12
glacier = np.exp(-((X - gpath_x) / (5.5 + (gpath_y - 47) * 0.06)) ** 2) * smoothstep(44, 52, Y) * (1 - smoothstep(108, 118, Y))
H = H * (1 - 0.55 * glacier) + (floor + 4 + (Y - 47) * 0.32 + detail * 0.6) * 0.55 * glacier

# Lake basin in the foreground.
lake = np.exp(-(((X + 0.5) / 30) ** 2 + ((Y - 13) / 21) ** 2) ** 2)
H = H * (1 - lake) + (-1.2) * lake
# Near shore: gentle rise behind the camera position.
H = np.where(Y < -3, np.maximum(H, 0.12 + (-3 - Y) * 0.05 + detail * 0.2), H)

# River from the glacier tip to the lake, meandering through boulders.
river_pts = [(-20.5, 49.0), (-16.5, 45.5), (-12.0, 44.0), (-10.5, 40.5), (-6.5, 38.5), (-3.5, 35.5), (-2.0, 32.5)]


def catmull(points, steps=24):
    pts = [points[0]] + points + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = (np.array(p) for p in pts[i - 1:i + 3])
        for s in range(steps):
            t = s / steps
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(np.array(points[-1]))
    return np.array(out)


river = catmull(river_pts)
dist = np.full(H.shape, 1e9)
for px, py in river:
    dist = np.minimum(dist, np.hypot(X - px, Y - py))
channel = np.exp(-(dist / 1.6) ** 2)
H = H - channel * 0.9

# Snow mask: high and not too steep, plus the glacier.
gy, gx = np.gradient(H, ys, xs)
nz = 1 / np.sqrt(1 + gx * gx + gy * gy)
snow = smoothstep(13, 24, H + detail * 5) * smoothstep(0.36, 0.62, nz + (streak_noise - 0.5) * 0.35)
snow = np.clip(snow + glacier * smoothstep(46, 50, Y) * 0.95, 0, 1)


def height_at(x, y):
    fx = (x - X0) / (X1 - X0) * (N - 1)
    fy = (y - Y0) / (Y1 - Y0) * (N - 1)
    i, j = int(fx), int(fy)
    tx, ty = fx - i, fy - j
    a, b, c, d = H[j, i], H[j, i + 1], H[j + 1, i], H[j + 1, i + 1]
    return float((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty)


# ----------------------------------------------------------------------------
# Meshes
# ----------------------------------------------------------------------------
def grid_mesh(name, Z, attr=None):
    verts = np.column_stack([X.ravel(), Y.ravel(), Z.ravel()])
    idx = np.arange(N * N).reshape(N, N)
    a, b = idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel()
    c, d = idx[1:, 1:].ravel(), idx[1:, :-1].ravel()
    faces = np.column_stack([a, b, c, d])
    mesh = bpy.data.meshes.new(name)
    mesh.vertices.add(len(verts))
    mesh.vertices.foreach_set("co", verts.astype(np.float32).ravel())
    mesh.loops.add(faces.size)
    mesh.loops.foreach_set("vertex_index", faces.astype(np.int32).ravel())
    mesh.polygons.add(len(faces))
    mesh.polygons.foreach_set("loop_start", (np.arange(len(faces)) * 4).astype(np.int32))
    mesh.polygons.foreach_set("loop_total", np.full(len(faces), 4, np.int32))
    mesh.polygons.foreach_set("use_smooth", np.ones(len(faces), bool))
    mesh.update(calc_edges=True)
    if attr is not None:
        at = mesh.attributes.new("snow", "FLOAT", "POINT")
        at.data.foreach_set("value", attr.astype(np.float32).ravel())
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]


def add_haze(nt, bsdf, near=30, far=190, amount=0.32, color=(0.5, 0.58, 0.7)):
    """Aerial perspective: distant surfaces fade toward the sky colour."""
    cam = nt.nodes.new("ShaderNodeCameraData")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = near
    mr.inputs["From Max"].default_value = far
    mr.inputs["To Max"].default_value = amount
    nt.links.new(cam.outputs["View Distance"], mr.inputs["Value"])
    emit_strength = nt.nodes.new("ShaderNodeMath")
    emit_strength.operation = "MULTIPLY"
    emit_strength.inputs[1].default_value = 0.45
    nt.links.new(mr.outputs["Result"], emit_strength.inputs[0])
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    nt.links.new(emit_strength.outputs["Value"], bsdf.inputs["Emission Strength"])
    return mr


terrain = grid_mesh("Terrain", H, snow)
tm, tnt, tb = node_mat("Terrain")
attr = tnt.nodes.new("ShaderNodeAttribute")
attr.attribute_name = "snow"
tex = tnt.nodes.new("ShaderNodeTexNoise")
tex.inputs["Scale"].default_value = 0.35
tex.inputs["Detail"].default_value = 8
ramp_rock = tnt.nodes.new("ShaderNodeValToRGB")
ramp_rock.color_ramp.elements[0].color = (0.012, 0.013, 0.014, 1)
ramp_rock.color_ramp.elements[1].color = (0.06, 0.06, 0.06, 1)
tnt.links.new(tex.outputs["Fac"], ramp_rock.inputs["Fac"])
snow_mix = tnt.nodes.new("ShaderNodeMix")
snow_mix.data_type = "RGBA"
snow_mix.inputs["B"].default_value = (0.74, 0.78, 0.84, 1)
tnt.links.new(ramp_rock.outputs["Color"], snow_mix.inputs["A"])
sharpen = tnt.nodes.new("ShaderNodeMapRange")
sharpen.inputs["From Min"].default_value = 0.35
sharpen.inputs["From Max"].default_value = 0.6
tnt.links.new(attr.outputs["Fac"], sharpen.inputs["Value"])
tnt.links.new(sharpen.outputs["Result"], snow_mix.inputs["Factor"])
tnt.links.new(snow_mix.outputs["Result"], tb.inputs["Base Color"])
rough = tnt.nodes.new("ShaderNodeMapRange")
rough.inputs["To Min"].default_value = 0.85
rough.inputs["To Max"].default_value = 0.42
tnt.links.new(sharpen.outputs["Result"], rough.inputs["Value"])
tnt.links.new(rough.outputs["Result"], tb.inputs["Roughness"])
bump = tnt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.6
tex2 = tnt.nodes.new("ShaderNodeTexNoise")
tex2.inputs["Scale"].default_value = 4.5
tex2.inputs["Detail"].default_value = 10
tnt.links.new(tex2.outputs["Fac"], bump.inputs["Height"])
tnt.links.new(bump.outputs["Normal"], tb.inputs["Normal"])
add_haze(tnt, tb)
terrain.data.materials.append(tm)

# Lake: a perfectly still mirror.
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 14, 0.0))
lake_obj = bpy.context.active_object
lake_obj.name = "Lake"
lake_obj.scale = (130, 60, 1)
lm, lnt, lb = node_mat("Lake")
lb.inputs["Base Color"].default_value = (0.004, 0.005, 0.006, 1)
lb.inputs["Roughness"].default_value = 0.008
lb.inputs["IOR"].default_value = 1.33
lb.inputs["Specular IOR Level"].default_value = 0.6
# Faint ripples near the far edge only.
ripple = lnt.nodes.new("ShaderNodeTexWave")
ripple.wave_type = "RINGS"
ripple.inputs["Scale"].default_value = 0.08
ripple.inputs["Distortion"].default_value = 2
lbump = lnt.nodes.new("ShaderNodeBump")
lbump.inputs["Strength"].default_value = 0.004
lnt.links.new(ripple.outputs["Fac"], lbump.inputs["Height"])
lnt.links.new(lbump.outputs["Normal"], lb.inputs["Normal"])
lake_obj.data.materials.append(lm)

# River surface following the channel, sloping down to the lake.
rv = []
rf = []
prev_z = None
for k, (px, py) in enumerate(river):
    nxt = river[min(k + 1, len(river) - 1)] - river[max(k - 1, 0)]
    nrm = np.array([-nxt[1], nxt[0]]) / (np.linalg.norm(nxt) + 1e-9)
    w = 0.75 + 0.35 * (k / len(river))
    z = max(0.02, height_at(px, py) + 0.55)
    if prev_z is not None:
        z = min(z, prev_z)
    prev_z = z
    rv.append((px + nrm[0] * w, py + nrm[1] * w, z))
    rv.append((px - nrm[0] * w, py - nrm[1] * w, z))
    if k:
        i = 2 * k
        rf.append((i - 2, i - 1, i + 1, i))
rmesh = bpy.data.meshes.new("River")
rmesh.from_pydata(rv, [], rf)
river_obj = bpy.data.objects.new("River", rmesh)
bpy.context.collection.objects.link(river_obj)
rm_, rnt, rb = node_mat("River")
rb.inputs["Base Color"].default_value = (0.01, 0.012, 0.014, 1)
rb.inputs["Roughness"].default_value = 0.05
rb.inputs["IOR"].default_value = 1.33
flow = rnt.nodes.new("ShaderNodeTexNoise")
flow.inputs["Scale"].default_value = 6
flow.inputs["Detail"].default_value = 6
rbump = rnt.nodes.new("ShaderNodeBump")
rbump.inputs["Strength"].default_value = 0.15
rnt.links.new(flow.outputs["Fac"], rbump.inputs["Height"])
rnt.links.new(rbump.outputs["Normal"], rb.inputs["Normal"])
river_obj.data.materials.append(rm_)

# Boulders: smooth grey granite along the river and the near shore.
bm_, bnt, bb = node_mat("Granite")
bb.inputs["Roughness"].default_value = 0.6
gnoise = bnt.nodes.new("ShaderNodeTexNoise")
gnoise.inputs["Scale"].default_value = 3
gramp = bnt.nodes.new("ShaderNodeValToRGB")
gramp.color_ramp.elements[0].color = (0.03, 0.03, 0.032, 1)
gramp.color_ramp.elements[1].color = (0.13, 0.13, 0.135, 1)
bnt.links.new(gnoise.outputs["Fac"], gramp.inputs["Fac"])
bnt.links.new(gramp.outputs["Color"], bb.inputs["Base Color"])
add_haze(bnt, bb)

bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1, location=(0, 0, -100))
rock_src = bpy.context.active_object
rock_src.name = "RockSource"
# Voronoi displacement gives faceted, fractured granite instead of pillows.
vor = bpy.data.textures.new("RockFacets", "VORONOI")
vor.noise_scale = 0.9
mod = rock_src.modifiers.new("Facets", "DISPLACE")
mod.texture = vor
mod.strength = 0.42
bpy.ops.object.modifier_apply(modifier="Facets")
disp_tex = bpy.data.textures.new("RockNoise", "CLOUDS")
disp_tex.noise_scale = 0.35
mod = rock_src.modifiers.new("Displace", "DISPLACE")
mod.texture = disp_tex
mod.strength = 0.12
bpy.ops.object.modifier_apply(modifier="Displace")
for p in rock_src.data.polygons:
    p.use_smooth = True
rock_src.data.materials.append(bm_)
rock_src.hide_render = True


def place_rock(x, y, s, flat=0.55, rot=None):
    o = rock_src.copy()
    o.data = rock_src.data
    o.hide_render = False  # the source is hidden; copies must not inherit that
    bpy.context.collection.objects.link(o)
    z = height_at(x, y)
    o.location = (x, y, z + s * flat * 0.35)
    o.scale = (s * (0.9 + rng.random() * 0.4), s * (0.8 + rng.random() * 0.4), s * flat)
    o.rotation_euler = rot or (0, 0, rng.random() * math.tau)
    return o


for k in range(0, len(river), 2):
    px, py = river[k]
    for _ in range(3):
        side = rng.choice([-1, 1])
        off = side * (1.3 + rng.random() * 2.6)
        place_rock(px + off * 0.8 + rng.normal() * 0.4, py + rng.normal() * 0.8, 0.35 + rng.random() ** 2 * 0.9)
for _ in range(26):
    a = rng.random() * math.tau
    place_rock(math.cos(a) * 30 + rng.normal() * 2, 13 + math.sin(a) * 21, 0.4 + rng.random() * 0.8)

# The flat shore stone the bottle stands on.
STONE = Vector((2.2, -5.4, 0))
stone = place_rock(STONE.x, STONE.y, 0.95, flat=0.17, rot=(0, 0, 0.4))
stone.location.z = height_at(STONE.x, STONE.y) + 0.04
# Measure the real top of the stone with a ray, so the bottle stands on it.
bpy.context.view_layer.update()
hit, loc, *_ = scene.ray_cast(bpy.context.evaluated_depsgraph_get(), Vector((STONE.x, STONE.y, 50)), Vector((0, 0, -1)))
STONE_TOP = Vector(loc) if hit else Vector((STONE.x, STONE.y, stone.location.z + 0.17))
print(f"[valley] stone top {tuple(round(c, 3) for c in STONE_TOP)} hit={hit}", flush=True)

# Pine and deodar edges: simple layered cones, read as dark silhouettes.
pm_, pnt, pb = node_mat("Pine")
pb.inputs["Base Color"].default_value = (0.006, 0.009, 0.007, 1)
pb.inputs["Roughness"].default_value = 0.95
add_haze(pnt, pb, amount=0.1)
tree_mesh = None
tiers = 8
for k in range(tiers):
    r = 0.95 * (1 - k / tiers) ** 1.1 + 0.08
    bpy.ops.mesh.primitive_cone_add(vertices=9, radius1=r, depth=0.95, location=(0, 0, 0.55 + k * 0.48 - 100))
    cone = bpy.context.active_object
    cone.rotation_euler = (rng.normal() * 0.05, rng.normal() * 0.05, rng.random() * math.tau)
    for v in cone.data.vertices:  # ragged branch tips
        if v.co.z < 0:
            v.co.x *= 0.75 + rng.random() * 0.55
            v.co.y *= 0.75 + rng.random() * 0.55
            v.co.z += rng.normal() * 0.08
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.07, depth=1.0, location=(0, 0, 0.3 - 100))
parts = [o for o in bpy.context.collection.objects if o.name.startswith(("Cone", "Cylinder"))]
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
tree_src = bpy.context.active_object
tree_src.name = "TreeSource"
tree_src.data.materials.append(pm_)
tree_src.hide_render = True
placed = 0
while placed < 1100:
    x = rng.uniform(-80, 80)
    y = rng.uniform(8, 95)  # nothing right beside the wide lens
    if abs(x) < 15 + max(0, y) * 0.15:
        continue
    z = height_at(x, y)
    if not (0.6 < z < 17) or rng.random() > 0.85:
        continue
    t = tree_src.copy()
    t.data = tree_src.data
    t.hide_render = False
    bpy.context.collection.objects.link(t)
    s = 1.1 + rng.random() * 1.6
    t.location = (x, y, z - 0.2)
    t.scale = (s, s, s * (1.1 + rng.random() * 0.5))
    placed += 1

# Forest edges close to the camera, framing both sides.
near = 0
while near < 260:
    side = rng.choice([-1, 1])
    # Kept back from the 13 mm lens so the edge pines read as trees, not slabs.
    x = side * rng.uniform(16, 40)
    y = rng.uniform(6, 18)
    z = height_at(x, y)
    if z < 0.12:
        continue
    t = tree_src.copy()
    t.data = tree_src.data
    t.hide_render = False
    bpy.context.collection.objects.link(t)
    s = 1.6 + rng.random() * 2.2
    t.location = (x, y, z - 0.2)
    t.scale = (s, s, s * (1.2 + rng.random() * 0.6))
    near += 1

# Moraine boulders across the valley floor.
for _ in range(140):
    x = rng.uniform(-24, 24)
    y = rng.uniform(34, 70)
    if height_at(x, y) < 0.3:
        continue
    place_rock(x, y, 0.3 + rng.random() ** 2 * 1.4)

# Shore pebbles in the foreground.
for _ in range(900):
    x = rng.uniform(-8, 10)
    y = rng.uniform(-8.5, -3.1)
    if (Vector((x, y, 0)) - Vector((STONE.x, STONE.y, 0))).length < 1.1:
        continue
    place_rock(x, y, 0.025 + rng.random() ** 4 * 0.28, flat=0.4)

# ----------------------------------------------------------------------------
# Bottle (chapter 05 only) from the Obelisk scene
# ----------------------------------------------------------------------------
bottle_root = None
if args.bottle and os.path.exists(args.bottle):
    with bpy.data.libraries.load(args.bottle) as (src, dst):
        dst.objects = [n for n in src.objects if n in ("Bottle", "Glass", "Cap", "CapRing", "Wordmark", "Global", "DropletSource")]
    for o in dst.objects:
        if o is not None:
            bpy.context.collection.objects.link(o)
    bottle_root = bpy.data.objects.get("Bottle")
    glass_obj = bpy.data.objects.get("Glass")
    if glass_obj:  # condensation instancing does not survive the import cleanly
        for m in list(glass_obj.modifiers):
            if m.type == "PARTICLE_SYSTEM":
                glass_obj.modifiers.remove(m)
    if bottle_root:
        s = 0.16
        bottle_root.scale = (s, s, s)
        bottle_root.location = (STONE_TOP.x, STONE_TOP.y, STONE_TOP.z - 0.004)  # model origin is its base
        bottle_root.rotation_euler = (0, 0, -0.5)
        bottle_root.hide_render = True

# ----------------------------------------------------------------------------
# Light and sky: first light on the summit
# ----------------------------------------------------------------------------
sun_data = bpy.data.lights.new("Sun", "SUN")
sun_data.energy = 2.3
sun_data.angle = math.radians(1.2)
sun_data.color = (1.0, 0.96, 0.92)
sun = bpy.data.objects.new("Sun", sun_data)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(82), 0, math.radians(104))  # low, raking from the right

world = bpy.data.worlds.new("Sky")
scene.world = world
world.use_nodes = True
wnt = world.node_tree
bg = wnt.nodes["Background"]
sky = wnt.nodes.new("ShaderNodeTexSky")
for kind in ("MULTIPLE_SCATTERING", "SINGLE_SCATTERING", "NISHITA"):
    try:
        sky.sky_type = kind
        break
    except TypeError:
        continue
for attr_name, val in (("sun_elevation", math.radians(4)), ("sun_rotation", math.radians(208)), ("altitude", 3000.0), ("air_density", 1.2), ("dust_density", 0.4)):
    if hasattr(sky, attr_name):
        setattr(sky, attr_name, val)
wnt.links.new(sky.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.22
# The sky as seen by the camera stays dusky; as a light source it fills the
# dawn shadows more, so the foreground shore is not a black band.
fill = wnt.nodes.new("ShaderNodeBackground")
wnt.links.new(sky.outputs["Color"], fill.inputs["Color"])
fill.inputs["Strength"].default_value = 0.75
lp = wnt.nodes.new("ShaderNodeLightPath")
mix_w = wnt.nodes.new("ShaderNodeMixShader")
wnt.links.new(lp.outputs["Is Camera Ray"], mix_w.inputs["Fac"])
wnt.links.new(fill.outputs["Background"], mix_w.inputs[1])
wnt.links.new(bg.outputs["Background"], mix_w.inputs[2])
wnt.links.new(mix_w.outputs["Shader"], wnt.nodes["World Output"].inputs["Surface"])

# ----------------------------------------------------------------------------
# Cameras
# ----------------------------------------------------------------------------
SUMMIT = None
best = -1
for (gx_, gy_) in [(x, y) for x in range(-10, 30, 1) for y in range(110, 145, 1)]:
    h = height_at(gx_, gy_)
    if h > best:
        best, SUMMIT = h, Vector((gx_, gy_, h))
TIP = Vector((river_pts[0][0], river_pts[0][1] + 1.5, height_at(river_pts[0][0], river_pts[0][1] + 1.5)))
STONES = Vector((river[60][0], river[60][1], height_at(*river[60]) + 0.3))
STILL = Vector((7.5, 16, 0))
BESIDE = Vector((STONE_TOP.x - 0.75, STONE_TOP.y + 0.1, STONE_TOP.z + 0.15))

SHOTS = {
    # Framed so every marker sits above the headline block (bottom-left) and the
    # summit clears the nav: 13 mm, axis tilted 1.2 degrees down.
    "master": dict(res=(2560, 1440), loc=(0.6, -10.5, 1.85), target=(3.0, 80, -0.05), lens=13),
    # Mobile: valley in the upper half, the text sits over the near shore.
    "mobile": dict(res=(1080, 1920), loc=(0.8, -11.5, 2.2), target=(2.5, 70, -13.6), lens=14),
    "peak": dict(res=(1920, 1080), loc=(-2, -6, 3.5), target=tuple(SUMMIT + Vector((0, 0, -4))), lens=180),
    "thaw": dict(res=(1920, 1080), loc=tuple(TIP + Vector((7, -14, 4.5))), target=tuple(TIP + Vector((0, 4, 2))), lens=55),
    "stone": dict(res=(1920, 1080), loc=tuple(STONES + Vector((2.6, -5.5, 0.9))), target=tuple(STONES + Vector((-1, 4, -0.2))), lens=24),
    "stillness": dict(res=(1920, 1080), loc=(-1.5, -3.5, 0.32), target=(4, 60, 8), lens=35),
    "vessel": dict(res=(1920, 1080), loc=tuple(STONE_TOP + Vector((-0.45, -1.55, 0.2))), target=tuple(STONE_TOP + Vector((0.0, 0, 0.19))), lens=60, dof=True),
}

cam_data = bpy.data.cameras.new("Camera")
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam
cam_data.clip_end = 1000


def setup(shot):
    cfg = SHOTS[shot]
    scene.render.resolution_x = int(cfg["res"][0] * args.scale)
    scene.render.resolution_y = int(cfg["res"][1] * args.scale)
    cam.location = cfg["loc"]
    d = Vector(cfg["target"]) - Vector(cfg["loc"])
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = cfg["lens"]
    cam_data.sensor_fit = "AUTO"
    cam_data.dof.use_dof = bool(cfg.get("dof"))
    if cfg.get("dof"):
        cam_data.dof.focus_distance = d.length
        cam_data.dof.aperture_fstop = 2.2
    if bottle_root:
        bottle_root.hide_render = shot != "vessel"
        for c in bottle_root.children:
            c.hide_render = shot != "vessel"
    bpy.context.view_layer.update()


def project(p):
    v = world_to_camera_view(scene, cam, Vector(p))
    return [round(v.x * 100, 2), round((1 - v.y) * 100, 2)]


markers = {}
for frame in ("master", "mobile"):
    setup(frame)
    markers[frame] = {
        "peak": project(SUMMIT),
        "thaw": project(TIP),
        "stone": project(STONES),
        "stillness": project(STILL),
        # On mobile the bottle is hidden and marker 05 sits on the far shore line.
        "vessel": project(BESIDE if frame == "master" else Vector((STONE.x + 2.5, 8.0, 0.2))),
        "bottleBase": project(STONE_TOP),
        "frame": list(SHOTS[frame]["res"]),
    }
with open(os.path.join(args.out, "markers.json"), "w") as f:
    json.dump(markers, f, indent=2)
print("[valley] markers", json.dumps(markers), flush=True)
if args.shots == "none":  # projection only, no render
    raise SystemExit(0)

# ----------------------------------------------------------------------------
# Render
# ----------------------------------------------------------------------------
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = args.samples
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass

for shot in args.shots.split(","):
    setup(shot)
    scene.render.filepath = os.path.join(args.out, f"{shot}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[valley] rendered {shot} -> {scene.render.filepath}", flush=True)
