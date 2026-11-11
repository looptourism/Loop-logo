#!/usr/bin/env python3
"""Loop lockup as a real 3D scene in Blender (Cycles), rendered headless.

  python3 blender/scene.py --shot lockup --out out/blender/lockup.png
  python3 blender/scene.py --shot action --out out/blender/action.png

Needs `pip install bpy shapely pillow` and build_cache/geometry.json
(`npx tsx scripts/export_geometry.ts build_cache/geometry.json`).

Everything is built here from the logo's measurements: letters and loop are
extruded from the traced wordmark, the globes carry the logo's own continent
drawings in the logo's two tones, and the aeroplane, car and balls are
modelled from simple solids. The floor only catches shadows; the picture is
composited over the flat brand cream afterwards so the background is exact.
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector
from PIL import Image
from shapely.geometry import LineString

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--shot', default='lockup', choices=['lockup', 'action'])
ap.add_argument('--out', required=True)
ap.add_argument('--samples', type=int, default=96)
ap.add_argument('--width', type=int, default=1920)
ap.add_argument('--height', type=int, default=1080)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

G = json.load(open(os.path.join(ROOT, 'build_cache', 'geometry.json')))
SHAPES = json.load(open(os.path.join(ROOT, 'src', 'shapes.json')))
U = 0.01                                    # wordmark pixel -> metre
CREAM = '#FFEEC0'
INK = '#2B2A28'
SLAB = G['SLAB'] * U * 1.6                  # a little more body than the web version
R = G['BALL_R'] * U


def P(x, y, z=0.0):
    """wordmark pixel (x right, y down) -> Blender (x right, y up on the page, z up)"""
    return Vector((x * U, -y * U, z))


def lin(hex_color):
    out = []
    for i in (1, 3, 5):
        c = int(hex_color[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def material(name, color=None, rough=0.5, coat=0.0, metal=0.0, image=None, projected=False, alpha_image=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = coat
    if color:
        b.inputs['Base Color'].default_value = lin(color)
    if image:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(os.path.join(ROOT, 'public', 'assets', image))
        tex.extension = 'EXTEND'
        if projected:                        # the drawing is dropped straight down onto the sphere
            co = nt.nodes.new('ShaderNodeTexCoord')
            mp = nt.nodes.new('ShaderNodeMapping')
            mp.inputs['Scale'].default_value = (1 / (2 * R), 1 / (2 * R), 1)
            mp.inputs['Location'].default_value = (0.5, 0.5, 0)
            nt.links.new(co.outputs['Object'], mp.inputs['Vector'])
            nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
        if alpha_image:
            nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
        else:
            nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    return m


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def extruded(name, polygons, mat, height=SLAB, bevel=0.018):
    """Extrude flat outlines (with holes) into a slab standing on the floor."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = height / 2 - bevel
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    cu.offset = -bevel
    for ring in polygons:
        sp = cu.splines.new('POLY')
        sp.points.add(len(ring) - 1)
        for p, (x, y) in zip(sp.points, ring):
            p.co = (x * U, -y * U, 0, 1)
        sp.use_cyclic_u = True
    ob = link(bpy.data.objects.new(name, cu))
    ob.location.z = height / 2
    ob.data.materials.append(mat)
    return ob


def sphere(name, centre, mat, radius=R):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=96, ring_count=48, location=P(centre['x'], centre['z'], radius))
    ob = bpy.context.object
    ob.name = name
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(mat)
    return ob


def box(name, size, loc, mat, parent=None, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    ob.data.materials.append(mat)
    if bevel:
        md = ob.modifiers.new('bevel', 'BEVEL')
        md.width = bevel
        md.segments = 3
    if parent:
        ob.parent = parent
    return ob


def cyl(name, radius, depth, loc, mat, parent=None, rot=(0, 0, 0), r2=None, verts=48):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=radius if r2 is None else r2, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    bpy.ops.object.shade_auto_smooth() if hasattr(bpy.ops.object, 'shade_auto_smooth') else bpy.ops.object.shade_smooth()
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob


def wing(name, root, tip, span, sweep, thick, mat, parent, origin, side=1, vertical=False):
    """A swept, tapered slab: root chord at the body, tip chord `span` away."""
    x0, x1 = 0.0, -root
    t0, t1 = -sweep, -sweep - tip
    pts = [(x0, 0), (t0, span), (t1, span), (x1, 0)]
    verts, faces = [], []
    for z in (thick / 2, -thick / 2):
        for x, y in pts:
            k = y / span
            zz = z * (1 - 0.6 * k)                          # thinner toward the tip
            verts.append((x, zz, y) if vertical else (x, y * side, zz))
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = link(bpy.data.objects.new(name, me))
    ob.location = origin
    ob.data.materials.append(mat)
    md = ob.modifiers.new('bevel', 'BEVEL')
    md.width = thick * 0.3
    md.segments = 3
    ob.parent = parent
    return ob


def aeroplane(loc, yaw, bank=0.0, pitch=0.0, scale=1.0):
    """A small airliner. Nose along +x. About 5 m long at scale 1."""
    root = link(bpy.data.objects.new('aeroplane', None))
    white = material('plane white', '#FBFAF6', rough=0.22, coat=0.6)
    dark = material('plane ink', INK, rough=0.35, coat=0.3)
    cyl('fuselage', 0.33, 3.0, (0.1, 0, 0), white, root, rot=(0, math.pi / 2, 0))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.33, segments=48, ring_count=24, location=(1.6, 0, 0))
    nose = bpy.context.object
    nose.scale = (2.0, 1, 1)
    bpy.ops.object.shade_smooth()
    nose.data.materials.append(white)
    nose.parent = root
    cyl('tail cone', 0.33, 1.7, (-2.25, 0, 0.06), white, root, rot=(0, -math.pi / 2, 0), r2=0.07)
    box('windscreen', (0.34, 0.5, 0.12), (1.72, 0, 0.17), dark, root, rot=(0, 0.5, 0), bevel=0.04)
    for side in (1, -1):
        wing('wing', 1.25, 0.38, 2.75, 1.25, 0.11, white, root, (0.55, side * 0.2, -0.12), side)
        wing('stabiliser', 0.6, 0.22, 1.0, 0.5, 0.07, white, root, (-2.25, side * 0.08, 0.1), side)
        cyl('engine', 0.17, 0.72, (0.25, side * 1.0, -0.33), dark, root, rot=(0, math.pi / 2, 0))
        cyl('engine lip', 0.185, 0.1, (0.6, side * 1.0, -0.33), white, root, rot=(0, math.pi / 2, 0))
    wing('fin', 0.85, 0.3, 1.05, 0.75, 0.08, dark, root, (-2.05, 0, 0.22), vertical=True)
    root.location = loc
    root.scale = (scale,) * 3
    root.rotation_euler = Euler((bank, -pitch, yaw), 'ZYX')
    return root


def racing_car(loc, yaw, scale=1.0):
    """The same small racing car as the web version: simple solids, nose along +x."""
    root = link(bpy.data.objects.new('car', None))
    red = material('car red', '#D92B22', rough=0.25, coat=0.7)
    dark = material('car dark', '#1C1C1C', rough=0.6)
    box('tub', (0.70, 0.20, 0.10), (-0.08, 0, 0.10), red, root, bevel=0.02)
    cyl('nose', 0.06, 0.5, (0.5, 0, 0.085), red, root, rot=(0, math.pi / 2, 0), r2=0.012, verts=24)
    for s in (1, -1):
        box('pod', (0.40, 0.12, 0.08), (-0.12, s * 0.17, 0.09), red, root, bevel=0.02)
        box('endplate', (0.12, 0.02, 0.18), (-0.60, s * 0.20, 0.17), dark, root)
        for x, r in ((0.44, 0.11), (-0.44, 0.125)):
            cyl('wheel', r, 0.13, (x, s * 0.26, r), dark, root, rot=(math.pi / 2, 0, 0))
    box('engine cover', (0.30, 0.09, 0.10), (-0.26, 0, 0.19), red, root, bevel=0.02)
    box('cockpit', (0.16, 0.10, 0.05), (0.02, 0, 0.16), dark, root, bevel=0.01)
    box('front wing', (0.09, 0.58, 0.025), (0.68, 0, 0.045), dark, root)
    box('rear wing', (0.10, 0.46, 0.03), (-0.60, 0, 0.25), dark, root)
    root.location = loc
    root.scale = (scale,) * 3
    root.rotation_euler = (0, 0, yaw)
    return root


def dashed_route(p0, p1, p2, mat, dash=0.34, gap=0.3, width=0.07):
    """A dashed flight path lying on the floor along a curve p0 -> p2 (control p1)."""
    pts = [p0 * (1 - t) ** 2 + p1 * 2 * (1 - t) * t + p2 * t * t for t in [i / 400 for i in range(401)]]
    travelled, on_until, start = 0.0, dash, None
    for a, b in zip(pts, pts[1:]):
        seg = (b - a).length
        phase = travelled % (dash + gap)
        if phase < dash:
            mid = (a + b) / 2
            box('dash', (seg * 1.05, width, 0.012), (mid.x, mid.y, 0.008), mat, rot=(0, 0, math.atan2(b.y - a.y, b.x - a.x)))
        travelled += seg


# --------------------------------------------------------------- build
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
ink = material('ink', '#191817', rough=0.5, coat=0.15)

ring = LineString(G['centre']).buffer(G['RING_T'] / 2, 24).simplify(0.2)
extruded('loop', [list(ring.exterior.coords)] + [list(i.coords) for i in ring.interiors], ink)
for key, polys in SHAPES.items():
    for i, p in enumerate(polys):
        extruded(f'{key}{i}', [p['outer']] + p['holes'], ink)

if args.shot == 'lockup':
    sphere('globe left', G['LEFT'], material('globe left', rough=0.55, coat=0.1, image='globe_left_top.png', projected=True))
    sphere('globe right', G['RIGHT'], material('globe right', rough=0.55, coat=0.1, image='globe_right_top.png', projected=True))
else:
    sphere('football', G['LEFT'], material('football', rough=0.38, coat=0.2, image='tex_soccer.png')).rotation_euler = (0.5, 0.3, 0.4)
    sphere('tennis ball', G['RIGHT'], material('tennis', rough=0.9, image='tex_tennis.png')).rotation_euler = (0.9, 0.2, 1.1)
    c = G['centre'][len(G['centre']) * 3 // 10]
    c2 = G['centre'][len(G['centre']) * 3 // 10 + 6]
    racing_car(P(c[0], c[1], SLAB), math.atan2(-(c2[1] - c[1]), c2[0] - c[0]), scale=1.05)

# tagline: the logo's own lettering, lying on the floor
t = G['tagline']
bpy.ops.mesh.primitive_plane_add(size=1, location=P(t['dx'] + t['w'] / 2, t['dy'] + t['h'] / 2, 0.004))
tag = bpy.context.object
tag.scale = (t['w'] * U, t['h'] * U, 1)
tag.data.materials.append(material('tagline', INK, rough=0.6, image='tagline.png', alpha_image=True))
tag.visible_shadow = False

# the aeroplane and its route
W, H = G['LOCKUP_W'] * U, G['LOCKUP_H'] * U
plane_at = Vector((W + 3.6, 2.9, 2.6))
aeroplane(plane_at, yaw=math.radians(24), bank=math.radians(-10), pitch=math.radians(4), scale=1.25)
dashed_route(Vector((1.2, 1.0, 0)), Vector((W * 0.6, 6.4, 0)), Vector((plane_at.x - 2.9, plane_at.y - 1.3, 0)), material('route', INK, rough=0.7))

# floor: shows only shadows
bpy.ops.mesh.primitive_plane_add(size=600, location=(W / 2, -H / 2, 0))
floor = bpy.context.object
floor.is_shadow_catcher = True
floor.data.materials.append(material('floor', CREAM, rough=0.9))

# light: a soft sun from the upper left plus cream sky fill
world = bpy.data.worlds.new('world')
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = lin('#FFF6E0')
bg.inputs['Strength'].default_value = 0.7
sc.world = world
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(38), math.radians(-18), math.radians(20)))
sun = bpy.context.object
sun.data.energy = 3.0
sun.data.angle = math.radians(9)

# camera
centre = Vector((W / 2, -H / 2, 0))
bpy.ops.object.camera_add()
cam = bpy.context.object
cam.data.lens = 70
cam.data.sensor_width = 36
sc.camera = cam
aspect = args.width / args.height
if args.shot == 'lockup':
    frac = 0.46 if aspect > 1.2 else (0.8 if aspect < 0.8 else 0.72)
    dist = (W / frac / 2) / (18 / 70)
    cam.location = centre + Vector((0, 0, dist))
    cam.rotation_euler = (0, 0, 0)
else:
    el, az, dist = math.radians(30), math.radians(-22), 44
    cam.location = centre + Vector((dist * math.sin(az) * math.cos(el), -dist * math.cos(az) * math.cos(el), dist * math.sin(el))) + Vector((1.5, 0, 0))
    look = (centre + Vector((1.5, 0.6, 0.6))) - cam.location
    cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()

# render: Cycles on the CPU, transparent film, true colours
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = args.samples
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x, sc.render.resolution_y = args.width, args.height
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
raw = args.out.replace('.png', '_raw.png')
sc.render.filepath = os.path.abspath(raw)
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
bpy.ops.render.render(write_still=True)

# composite over the flat brand cream
fg = Image.open(raw).convert('RGBA')
bgc = Image.new('RGBA', fg.size, tuple(int(CREAM[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
bgc.alpha_composite(fg)
bgc.convert('RGB').save(args.out)
os.remove(raw)
print('wrote', args.out)
