bl_info = {
    "name": "AISTAGE Blender Bridge",
    "author": "AISTAGE.ONE",
    "version": (0, 12, 0),
    "blender": (5, 3, 0),
    "location": "3D Viewport > Sidebar > AISTAGE",
    "description": "Connect AISTAGE.ONE Studio to Blender on this computer",
    "category": "3D View",
}

import bpy
import json
import queue
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = '127.0.0.1'
PORT = 18765
ALLOWED_ORIGINS = {
    'https://aistage.one',
    'https://www.aistage.one',
    'https://aistage-one.vercel.app',
    'http://localhost:5173',
}

_pending = queue.Queue(maxsize=32)
_server = None
_server_thread = None
_token = None
_last_result = 'Not started'


def _number(value):
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and abs(value) <= 10000 and value == value and value not in (float('inf'), float('-inf')))


def _vector(action, key, *, positive=False):
    values = action.get(key)
    if not (isinstance(values, list) and len(values) == 3 and
            all(_number(n) and (not positive or 0.001 <= n <= 1000) for n in values)):
        raise ValueError(f'Invalid {key}: expected three bounded numbers')
    return tuple(values)


def _object_name(action, *, existing=False):
    name = action.get('name')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
        raise ValueError('Invalid object name')
    if existing and name not in bpy.data.objects:
        raise ValueError('Object not found')
    return name


def _mesh_info(obj):
    mesh = obj.data
    return {
        'name': obj.name,
        'vertices': len(mesh.vertices),
        'edges': len(mesh.edges),
        'faces': len(mesh.polygons),
        'quads': sum(1 for p in mesh.polygons if len(p.vertices) == 4),
        'triangles': sum(1 for p in mesh.polygons if len(p.vertices) == 3),
        'working_copy': bool(obj.get('aistage_character_copy', False)),
        'collections': [collection.name for collection in obj.users_collection],
        'visible': bool(obj.visible_get()),
        'attributes': [{'name': attribute.name, 'domain': attribute.domain, 'type': attribute.data_type}
                       for attribute in mesh.attributes if not attribute.is_internal][:30],
        'face_set_count': len(set(item.value for item in mesh.attributes['.sculpt_face_set'].data))
            if '.sculpt_face_set' in mesh.attributes else 0,
        'shape_keys': [key.name for key in mesh.shape_keys.key_blocks] if mesh.shape_keys else [],
    }


def _character_source(action):
    name = _object_name(action, existing=True)
    obj = bpy.data.objects[name]
    if obj.type != 'MESH':
        raise ValueError('Character source must be a mesh object')
    if len(obj.data.vertices) < 50:
        raise ValueError('Select a character mesh, not a primitive')
    return obj


def _make_working_copy(action):
    source = _character_source(action)
    duplicate = source.copy()
    duplicate.data = source.data.copy()
    duplicate.name = 'AISTAGE_CHAR_' + source.name[:55]
    duplicate['aistage_character_copy'] = True
    duplicate['aistage_source_name'] = source.name
    duplicate['aistage_source_mesh'] = source.data.name
    bpy.context.scene.collection.objects.link(duplicate)
    # Never alter the original or automatically delete/replace a scene object.
    return {'object': duplicate.name, 'mesh': _mesh_info(duplicate)}


def _native_inspect(action):
    obj = _character_source(action)
    groups = []
    for group in obj.vertex_groups:
        index = group.index
        assigned = sum(1 for vertex in obj.data.vertices if any(
            element.group == index and element.weight > 0 for element in vertex.groups))
        groups.append({'name': group.name, 'assigned_vertices': assigned})
    shapes = []
    if obj.data.shape_keys:
        shapes = [{'name': key.name, 'value': key.value}
                  for key in obj.data.shape_keys.key_blocks]
    modifiers = [{'name': item.name, 'type': item.type}
                 for item in obj.modifiers]
    return {'object': obj.name, 'vertex_groups': groups,
            'shape_keys': shapes, 'modifiers': modifiers,
            'working_copy': bool(obj.get('aistage_character_copy', False))}


def _editable_character(action):
    obj = _character_source(action)
    if obj.mode != 'OBJECT':
        raise ValueError('Switch the working copy to Object Mode')
    return obj


def _create_group_from_selection(action):
    # Preserve Blender's actual artist-edited selection; never infer body parts
    # from bounding boxes or apply modifications to the base mesh.
    obj = _character_source(action)
    if obj.mode != 'EDIT':
        raise ValueError('Select waist vertices in Blender Edit Mode first')
    import bmesh
    bm = bmesh.from_edit_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    selected = [v.index for v in bm.verts if v.select and not v.hide]
    if len(selected) < 10:
        raise ValueError('Select at least 10 vertices of the waist, excluding arms')
    if bpy.context.view_layer.objects.active != obj:
        raise ValueError('Make the working copy the active Blender object before creating its vertex group')
    import bpy as _bpy
    _bpy.ops.object.mode_set(mode='OBJECT')
    try:
        group = obj.vertex_groups.get('AISTAGE_Waist')
        if group is None:
            group = obj.vertex_groups.new(name='AISTAGE_Waist')
        # Replace only the dedicated group, not unrelated authored weights.
        existing = [v.index for v in obj.data.vertices if any(
            e.group == group.index for e in v.groups)]
        if existing:
            group.remove(existing)
        group.add(selected, 1.0, 'REPLACE')
    finally:
        _bpy.ops.object.mode_set(mode='EDIT')
    return {'object': obj.name, 'vertex_group': group.name,
            'assigned_vertices': len(selected)}


def _create_native_lattice(action):
    obj = _editable_character(action)
    group_name = action.get('vertex_group')
    if not isinstance(group_name, str) or group_name not in obj.vertex_groups:
        raise ValueError('Choose an existing, verified vertex group')
    group = obj.vertex_groups[group_name]
    indices = [v.index for v in obj.data.vertices if any(
        e.group == group.index and e.weight > 0 for e in v.groups)]
    if len(indices) < 10:
        raise ValueError('Vertex group is empty or too small')
    if any(m.type == 'LATTICE' and m.get('aistage_native_lattice')
           and m.vertex_group == group_name for m in obj.modifiers):
        raise ValueError('A lattice is already attached to this vertex group')
    # Native lattice bounds the actual selected region, not a guessed torso band.
    coords = [obj.data.vertices[i].co for i in indices]
    lower = [min(p[k] for p in coords) for k in range(3)]
    upper = [max(p[k] for p in coords) for k in range(3)]
    spans = [upper[k] - lower[k] for k in range(3)]
    if min(spans) < 0.0001:
        raise ValueError('Vertex group has degenerate dimensions')
    cage = bpy.data.lattices.new('AISTAGE_NativeLattice')
    cage.points_u = 4
    cage.points_v = 2
    cage.points_w = 6
    lattice_obj = bpy.data.objects.new('AISTAGE_Lattice_' + obj.name[:45], cage)
    bpy.context.scene.collection.objects.link(lattice_obj)
    lattice_obj.matrix_world = obj.matrix_world @ __import__('mathutils').Matrix.Translation(
        tuple((lower[k] + upper[k]) / 2 for k in range(3))) @ __import__('mathutils').Matrix.Diagonal(
        (spans[0] * 1.10, spans[1] * 1.10, spans[2] * 1.10, 1.0))
    lattice_obj.hide_render = True
    # This tagged modifier is the only one controlled by AISTAGE.
    modifier = obj.modifiers.new('AISTAGE_NativeLattice', 'LATTICE')
    modifier.object = lattice_obj
    modifier.vertex_group = group_name
    modifier['aistage_native_lattice'] = True
    # Disable only the obsolete AISTAGE-generated morph on this working copy;
    # it could otherwise continue distorting arms while the native lattice works.
    old_keys = obj.data.shape_keys
    old_waist = old_keys.key_blocks.get('AISTAGE_Waist') if old_keys else None
    if old_waist:
        old_waist.value = 0.0
    obj['aistage_lattice_object'] = lattice_obj.name
    obj['aistage_lattice_group'] = group_name
    return {'object': obj.name, 'lattice': lattice_obj.name,
            'modifier': modifier.name, 'vertex_group': group_name,
            'assigned_vertices': len(indices)}


def _set_native_lattice_width(action):
    obj = _editable_character(action)
    width = action.get('waist_width')
    if not _number(width) or not 0.75 <= width <= 1.25:
        raise ValueError('waist_width must be between 0.75 and 1.25')
    cage_name = obj.get('aistage_lattice_object')
    cage_obj = bpy.data.objects.get(cage_name) if cage_name else None
    if not cage_obj or cage_obj.type != 'LATTICE':
        raise ValueError('First create a native Lattice Modifier for a vertex group')
    if not any(m.type == 'LATTICE' and m.get('aistage_native_lattice') and
               m.object == cage_obj for m in obj.modifiers):
        raise ValueError('Native lattice modifier is not linked to this character')
    for point in cage_obj.data.points:
        # Blender's own lattice deformation; only points in lattice are adjusted.
        original = point.co
        z = max(0.0, min(1.0, (original.z + 1.0) * 0.5))
        influence = (1.0 - abs(z * 2.0 - 1.0))
        influence = max(0.0, influence)
        influence = influence * influence * (3.0 - 2.0 * influence)
        point.co_deform = (original.x * (1.0 + (width - 1.0) * influence),
                           original.y, original.z)
    cage_obj.data.update_tag()
    return {'object': obj.name, 'lattice': cage_obj.name,
            'vertex_group': obj.get('aistage_lattice_group'),
            'waist_width': width, 'method': 'Blender Lattice Modifier'}


def _set_native_shape_key(action):
    obj = _editable_character(action)
    name = action.get('shape_key')
    value = action.get('value')
    if not isinstance(name, str) or not _number(value) or not 0 <= value <= 1:
        raise ValueError('Invalid shape key or value')
    if not obj.data.shape_keys or name not in obj.data.shape_keys.key_blocks:
        raise ValueError('Shape key not found')
    key = obj.data.shape_keys.key_blocks[name]
    if key.name == 'Basis':
        raise ValueError('Basis cannot be controlled')
    key.value = value
    return {'object': obj.name, 'shape_key': name, 'value': value}


# AISTAGE non-destructive morphology controls for upright human base meshes.
# All values remain in Blender Shape Keys; original mesh vertices are untouched.
MORPH_REGIONS = {
    'head_width': ('head', 'x'), 'head_height': ('head', 'z'),
    'neck_width': ('neck', 'x'), 'shoulders': ('shoulders', 'x'),
    'chest': ('chest', 'xy'), 'waist': ('waist', 'xy'),
    'belly': ('belly', 'y'), 'hips': ('hips', 'x'),
    'buttocks': ('buttocks', 'y'), 'upper_arm': ('upper_arm', 'xy'),
    'forearm': ('forearm', 'xy'), 'hands': ('hands', 'xy'),
    'thighs': ('thighs', 'xy'), 'calves': ('calves', 'xy'),
    'feet': ('feet', 'xy'), 'legs_length': ('legs_length', 'z'),
    'arms_length': ('arms_length', 'z'),
    'face_width': ('face_width', 'x'), 'forehead': ('forehead', 'x'),
    'cheeks': ('cheeks', 'xy'), 'jaw': ('jaw', 'x'),
    'chin': ('chin', 'z'), 'nose_width': ('nose_width', 'x'),
    'nose_length': ('nose_length', 'y'), 'lips': ('lips', 'y'),
    'mouth_width': ('mouth_width', 'x'), 'eyes': ('eyes', 'xy'),
    'eye_spacing': ('eye_spacing', 'x'), 'ears': ('ears', 'x'),
}

def _smooth(value, low, high):
    if high <= low:
        return float(value >= high)
    t = max(0.0, min(1.0, (value - low) / (high - low)))
    return t * t * (3.0 - 2.0 * t)

def _window(value, low, top, fade):
    return _smooth(value, low - fade, low + fade) * (1.0 - _smooth(value, top - fade, top + fade))

def _morph_group_weights(obj, region):
    aliases = {
        'waist': ('waist',), 'hips': ('pelvis', 'hip'), 'chest': ('chest', 'breast', 'torso'),
        'shoulders': ('shoulder', 'clavicle'), 'neck': ('neck',), 'head': ('head',),
        'upper_arm': ('upperarm', 'upper_arm', 'bicep'), 'forearm': ('forearm', 'lowerarm'),
        'hands': ('hand',), 'thighs': ('thigh', 'upperleg'), 'calves': ('calf', 'shin', 'lowerleg'),
        'feet': ('foot',), 'jaw': ('jaw',), 'cheeks': ('cheek',), 'eyes': ('eye',),
        'ears': ('ear',), 'lips': ('lip',), 'nose_width': ('nose',), 'nose_length': ('nose',)
    }
    names = aliases.get(region, ())
    match = [g.index for g in obj.vertex_groups if any(
        a in g.name.casefold().replace(' ', '').replace('.', '').replace('-', '') for a in names)]
    if not match:
        return None
    indices = set(match)
    weights = [max((v.weight for v in vertex.groups if v.group in indices), default=0.0)
               for vertex in obj.data.vertices]
    # Rigging groups sometimes overlap regions. Keep only substantial region weights.
    if sum(1 for w in weights if w > 0.35) < 12:
        return None
    return weights

def _region_weight(region, x, y, z, chest_radius, head_radius, front_sign, front_edge):
    ax = abs(x)
    torso = 1.0 - _smooth(ax, chest_radius * 0.95, chest_radius * 1.45)
    limb = _smooth(ax, chest_radius * 1.05, chest_radius * 1.65)
    face = _smooth(z, .85, .90) * _smooth(y * front_sign, front_edge * .25, front_edge * .55)
    head = _window(z, .85, 1.00, .018)
    if region == 'head': return head
    if region == 'neck': return _window(z, .805, .86, .012) * torso
    if region == 'shoulders': return _window(z, .745, .825, .035)
    if region == 'chest': return _window(z, .665, .78, .038) * torso
    if region == 'waist': return _window(z, .575, .665, .026) * torso
    if region == 'belly': return _window(z, .56, .68, .038) * torso * _smooth(y * front_sign, 0, front_edge * .30)
    if region == 'hips': return _window(z, .49, .58, .035) * torso
    if region == 'buttocks': return _window(z, .47, .56, .034) * torso * (1.0 - _smooth(y * front_sign, -front_edge * .30, 0))
    if region == 'upper_arm': return _window(z, .655, .80, .045) * limb
    if region == 'forearm': return _window(z, .52, .67, .045) * limb
    if region == 'hands': return _window(z, .41, .55, .035) * limb
    if region == 'thighs': return _window(z, .30, .52, .055) * (1.0 - _smooth(ax, chest_radius * .80, chest_radius * 1.60))
    if region == 'calves': return _window(z, .10, .31, .04) * (1.0 - _smooth(ax, chest_radius * .80, chest_radius * 1.65))
    if region == 'feet': return _window(z, 0, .12, .035) * (1.0 - _smooth(ax, chest_radius * 1.1, chest_radius * 1.8))
    if region == 'legs_length': return 1.0 - _smooth(z, .41, .58)
    if region == 'arms_length': return _window(z, .42, .78, .06) * limb
    if region == 'face_width': return face * _window(z, .88, .985, .024)
    if region == 'forehead': return face * _window(z, .948, .985, .015)
    if region == 'cheeks': return face * _window(z, .903, .954, .017) * _smooth(ax, head_radius * .22, head_radius * .47)
    if region == 'jaw': return face * _window(z, .877, .920, .018)
    if region == 'chin': return face * _window(z, .869, .904, .014)
    if region == 'nose_width': return face * _window(z, .912, .954, .015) * (1.0 - _smooth(ax, head_radius * .13, head_radius * .34))
    if region == 'nose_length': return face * _window(z, .913, .947, .014) * (1.0 - _smooth(ax, head_radius * .10, head_radius * .28))
    if region == 'lips': return face * _window(z, .896, .923, .012) * (1.0 - _smooth(ax, head_radius * .25, head_radius * .51))
    if region == 'mouth_width': return face * _window(z, .896, .923, .012) * (1.0 - _smooth(ax, head_radius * .28, head_radius * .62))
    if region == 'eyes': return face * _window(z, .943, .972, .011) * _window(ax, head_radius * .23, head_radius * .75, head_radius * .12)
    if region == 'eye_spacing': return face * _window(z, .943, .972, .011) * _window(ax, head_radius * .23, head_radius * .75, head_radius * .12)
    if region == 'ears': return head * _window(z, .925, .962, .018) * _smooth(ax, head_radius * .67, head_radius * .92)
    return 0.0

def _set_body_morph(action):
    import math
    obj = _editable_character(action)
    part = action.get('part')
    value = action.get('value')
    if part not in MORPH_REGIONS or not _number(value) or not -1 <= value <= 1:
        raise ValueError('Invalid morphology control or value (-1 to +1)')
    if obj.data.library or obj.data.is_library_indirect:
        raise ValueError('Linked Blender mesh is read-only; make it local in Blender first')
    # Do not alter shared mesh datablocks belonging to other objects.
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    region, axis = MORPH_REGIONS[part]
    mesh = obj.data
    if len(mesh.vertices) < 500:
        raise ValueError('Morphology controls require a human mesh (at least 500 vertices)')
    if mesh.shape_keys and mesh.shape_keys.use_relative is False:
        raise ValueError('Absolute Shape Keys are not supported by morphology controls')
    key_name = 'AISTAGE_Morph_' + part
    existing_key = mesh.shape_keys.key_blocks.get(key_name) if mesh.shape_keys else None
    if value == 0 and existing_key is None:
        return {'object': obj.name, 'part': part, 'value': 0.0,
                'applied': False, 'reason': 'Neutral value: no shape key exists to reset'}
    basis = mesh.shape_keys.key_blocks.get('Basis') if mesh.shape_keys else None
    coords = [tuple(v.co) for v in (basis.data if basis else mesh.vertices)]
    min_x, max_x = min(v[0] for v in coords), max(v[0] for v in coords)
    min_y, max_y = min(v[1] for v in coords), max(v[1] for v in coords)
    min_z, max_z = min(v[2] for v in coords), max(v[2] for v in coords)
    height = max_z - min_z
    if height < .001:
        raise ValueError('Invalid mesh height')
    center_x = (min_x + max_x) * .5
    center_y = (min_y + max_y) * .5
    # Coordinates normalized to a canonical upright standing person.
    # Front is Blender -Y for the Blender Studio human base meshes.
    front_sign = -1
    front_edge = max((max_y - min_y) / height, .08)
    middle = sorted(abs(v[0] - center_x) / height for v in coords
                    if .67 <= (v[2] - min_z) / height <= .77)
    chest_radius = middle[int(len(middle) * .45)] if middle else .12
    chest_radius = max(.055, min(.20, chest_radius))
    head_points = [abs(v[0] - center_x) / height for v in coords if
                   .89 <= (v[2] - min_z) / height <= .97]
    head_radius = (sorted(head_points)[int(len(head_points) * .85)]
                   if head_points else .08)
    head_radius = max(.042, min(.14, head_radius))
    # Prefer artist-defined regions if present; no manual setup required for common
    # unrigged upright base meshes, but heuristic masks are topology dependent.
    group_weights = _morph_group_weights(obj, region)
    if not mesh.shape_keys:
        obj.shape_key_add(name='Basis', from_mix=False)
    key = mesh.shape_keys.key_blocks.get(key_name)
    if key is None:
        key = obj.shape_key_add(name=key_name, from_mix=False)
        key.slider_min = -1.0
        key.slider_max = 1.0
        key.value = 0.0
        count = 0
        max_shift = 0.0
        base = mesh.shape_keys.key_blocks[0]
        for i, point in enumerate(key.data):
            px, py, pz = base.data[i].co
            x = (px - center_x) / height
            y = (py - center_y) / height
            z = (pz - min_z) / height
            w = group_weights[i] if group_weights else _region_weight(
                region, x, y, z, chest_radius, head_radius, front_sign, front_edge)
            if w < .005:
                continue
            count += 1
            amt = .15 * height * w
            # Signed Shape Key values grow or shrink a region relative to its center.
            dx = x * amt
            dy = y * amt
            dz = (z - .5) * amt
            if axis == 'x':
                dy = dz = 0
            elif axis == 'y':
                dx = dz = 0
            elif axis == 'z':
                dx = dy = 0
            else:
                dz = 0
            if region in ('legs_length', 'arms_length'):
                dx = dy = 0
                dz = -.22 * height * w
            if region == 'nose_length' or region == 'lips':
                dx = dz = 0
                dy = -.10 * height * w
            if region == 'eye_spacing':
                dx = math.copysign(.025 * height * w, x)
                dy = dz = 0
            point.co = (px + dx, py + dy, pz + dz)
            max_shift = max(max_shift, math.sqrt(dx * dx + dy * dy + dz * dz))
        if count < 12:
            obj.shape_key_remove(key)
            raise ValueError('No suitable vertices found for ' + part + '; nothing changed')
    key.mute = False
    key.value = float(value)
    mesh.update()
    bpy.context.view_layer.update()
    return {'object': obj.name, 'part': part, 'value': key.value, 'applied': True,
            'shape_key': key_name, 'method': 'Blender Shape Key',
            'region_method': 'vertex_group' if group_weights else 'base_mesh_estimate',
            'vertices_changed': count if 'count' in locals() else None,
            'max_offset_mesh_units': max_shift * abs(value) if 'max_shift' in locals() else None}

def _reset_body_morphs(action):
    obj = _editable_character(action)
    keys = obj.data.shape_keys.key_blocks if obj.data.shape_keys else []
    count = 0
    for key in keys:
        if key.name.startswith('AISTAGE_Morph_'):
            key.value = 0.0
            count += 1
    return {'object': obj.name, 'reset': count}

def _waist_morph(action):
    # Retire the old invented geometry deformation. Never silently fall back.
    raise ValueError('Legacy waist morph disabled. Use native vertex groups and a Lattice Modifier.')


def _execute_command(action):
    kind = action.get('action')
    if kind == 'set_body_morph':
        return _set_body_morph(action)
    if kind == 'reset_body_morphs':
        return _reset_body_morphs(action)
    if kind == 'list_body_morphs':
        obj = _character_source(action)
        keys = obj.data.shape_keys.key_blocks if obj.data.shape_keys else []
        return {'object': obj.name, 'controls': list(MORPH_REGIONS.keys()),
                'values': {key.name[len('AISTAGE_Morph_'):]: key.value
                           for key in keys if key.name.startswith('AISTAGE_Morph_')}}
    if kind == 'inspect_native_tools':
        return _native_inspect(action)
    if kind == 'create_vertex_group_from_selection':
        return _create_group_from_selection(action)
    if kind == 'create_native_lattice':
        return _create_native_lattice(action)
    if kind == 'set_native_lattice_width':
        return _set_native_lattice_width(action)
    if kind == 'set_native_shape_key':
        return _set_native_shape_key(action)
    if kind == 'inspect_character_meshes':
        # Character assets frequently comprise many objects; return the actual
        # active mesh first rather than an alphabetically chosen arm or prop.
        active = bpy.context.view_layer.objects.active
        scene_meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        meshes = sorted(scene_meshes, key=lambda obj: (
            0 if obj == active else 1,
            0 if obj.select_get() else 1,
            0 if obj.visible_get() else 1,
            -len(obj.data.vertices),
            obj.name.casefold(),
        ))
        return {'objects': [_mesh_info(obj) for obj in meshes[:100]],
                'active_mesh': active.name if active and active.type == 'MESH' else None,
                'selected_meshes': [obj.name for obj in scene_meshes if obj.select_get()],
                'total_meshes': len(scene_meshes)}
    if kind == 'create_character_copy':
        return _make_working_copy(action)
    if kind == 'set_waist_morph':
        return _waist_morph(action)
    if kind in ('create_cube', 'create_sphere', 'create_cylinder', 'create_plane'):
        name = _object_name(action)
        if kind == 'create_cube':
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1))
        elif kind == 'create_sphere':
            bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.5, location=(0, 0, 1))
        elif kind == 'create_cylinder':
            bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.5, depth=1, location=(0, 0, 1))
        else:
            bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0))
        bpy.context.object.name = name
        return {'object': bpy.context.object.name}
    if kind in ('move_object', 'rotate_object', 'scale_object'):
        name = _object_name(action, existing=True)
        obj = bpy.data.objects[name]
        if kind == 'move_object':
            vector = _vector(action, 'location')
            obj.location = vector
        elif kind == 'rotate_object':
            vector = _vector(action, 'rotation')
            import math
            obj.rotation_euler = [math.radians(value) for value in vector]
        else:
            vector = _vector(action, 'scale', positive=True)
            obj.scale = vector
        return {'object': name, 'values': list(vector)}
    raise ValueError('Unsupported action')


def _process_queue():
    global _last_result
    try:
        for _ in range(8):
            try:
                request, result_holder, done = _pending.get_nowait()
            except queue.Empty:
                break
            try:
                data = _execute_command(request)
                result_holder.update({'ok': True, 'result': data})
                _last_result = 'Last command: success'
            except Exception as exc:
                result_holder.update({'ok': False, 'error': str(exc)})
                _last_result = 'Last command: failed'
            finally:
                done.set()
    except Exception:
        _last_result = 'Command loop error'
    return 0.1 if _server else None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _respond(self, status, data):
        payload = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        origin = self.headers.get('Origin')
        if origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(payload)

    def _trusted_request(self):
        origin = self.headers.get('Origin')
        host = self.headers.get('Host', '')
        return host in {f'127.0.0.1:{PORT}', f'localhost:{PORT}'} and (origin is None or origin in ALLOWED_ORIGINS)

    def do_OPTIONS(self):
        if not self._trusted_request() or self.path not in ('/v1/command', '/v1/health'):
            return self._respond(403, {'ok': False, 'error': 'Origin not permitted'})
        self.send_response(204)
        origin = self.headers.get('Origin')
        if origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Max-Age', '300')
        self.end_headers()

    def do_GET(self):
        if not self._trusted_request():
            return self._respond(403, {'ok': False, 'error': 'Origin not permitted'})
        if self.path != '/v1/health':
            return self._respond(404, {'ok': False, 'error': 'Not found'})
        if not self._authorized():
            return self._respond(401, {'ok': False, 'error': 'Invalid token'})
        return self._respond(200, {'ok': True, 'bridge': '0.12', 'blender': bpy.app.version_string})

    def _authorized(self):
        return bool(_token and secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + _token))

    def do_POST(self):
        if not self._trusted_request():
            return self._respond(403, {'ok': False, 'error': 'Origin not permitted'})
        if self.path != '/v1/command':
            return self._respond(404, {'ok': False, 'error': 'Not found'})
        if not self._authorized():
            return self._respond(401, {'ok': False, 'error': 'Invalid token'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 2 or length > 4096:
                raise ValueError('Invalid body length')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Expected JSON object')
        except (ValueError, json.JSONDecodeError):
            return self._respond(400, {'ok': False, 'error': 'Invalid JSON payload'})
        done = threading.Event()
        result = {}
        try:
            _pending.put_nowait((data, result, done))
        except queue.Full:
            return self._respond(503, {'ok': False, 'error': 'Queue full'})
        if not done.wait(timeout=8):
            return self._respond(504, {'ok': False, 'error': 'Blender main thread did not respond'})
        return self._respond(200 if result.get('ok') else 422, result)


class AISTAGE_OT_test_bridge(bpy.types.Operator):
    bl_idname = 'aistage.test_bridge'
    bl_label = 'Test Blender Bridge'
    bl_options = {'REGISTER', 'UNDO'}
    def execute(self, context):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1))
        context.object.name = 'AISTAGE_Bridge_Test'
        self.report({'INFO'}, 'Local Blender test succeeded')
        return {'FINISHED'}


class AISTAGE_OT_start_server(bpy.types.Operator):
    bl_idname = 'aistage.start_server'
    bl_label = 'Start Local Bridge'
    def execute(self, context):
        global _server, _server_thread, _token, _last_result
        if _server:
            return {'FINISHED'}
        token = secrets.token_urlsafe(32)
        try:
            server = ThreadingHTTPServer((HOST, PORT), Handler)
            server.daemon_threads = True
            server.timeout = 1
        except OSError as exc:
            self.report({'ERROR'}, f'Cannot start local bridge: {exc}')
            return {'CANCELLED'}
        _token = token
        _server = server
        _server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        _server_thread.start()
        if not bpy.app.timers.is_registered(_process_queue):
            bpy.app.timers.register(_process_queue, first_interval=0.1)
        _last_result = 'Listening on 127.0.0.1:18765'
        return {'FINISHED'}


class AISTAGE_OT_stop_server(bpy.types.Operator):
    bl_idname = 'aistage.stop_server'
    bl_label = 'Stop Local Bridge'
    def execute(self, context):
        stop_server()
        return {'FINISHED'}


class AISTAGE_OT_copy_token(bpy.types.Operator):
    bl_idname = 'aistage.copy_token'
    bl_label = 'Copy Test Token'
    def execute(self, context):
        if not _token:
            return {'CANCELLED'}
        context.window_manager.clipboard = _token
        self.report({'INFO'}, 'Local token copied')
        return {'FINISHED'}


class AISTAGE_PT_bridge(bpy.types.Panel):
    bl_label = 'AISTAGE Blender Bridge'
    bl_idname = 'AISTAGE_PT_bridge'
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'AISTAGE'
    def draw(self, context):
        layout = self.layout
        layout.label(text='Bridge 0.12 - AISTAGE.ONE Studio')
        layout.label(text='Open Blender Bridge in Studio')
        layout.operator('aistage.test_bridge', icon='MESH_CUBE')
        if _server:
            layout.label(text='Local server: running')
            layout.operator('aistage.copy_token', icon='COPYDOWN')
            layout.operator('aistage.stop_server', icon='CANCEL')
        else:
            layout.operator('aistage.start_server', icon='PLAY')
        layout.label(text=_last_result)
        try:
            from . import _update_state
            layout.label(text=str(_update_state)[:90])
        except ImportError:
            pass


classes = (AISTAGE_OT_test_bridge, AISTAGE_OT_start_server,
           AISTAGE_OT_stop_server, AISTAGE_OT_copy_token, AISTAGE_PT_bridge)


def stop_server():
    global _server, _server_thread, _token, _last_result
    server = _server
    _server = None
    _token = None
    if server:
        server.shutdown()
        server.server_close()
    _server_thread = None
    _last_result = 'Stopped'


def register():
    for cls in classes:
        bpy.utils.register_class(cls)


def unregister():
    stop_server()
    if bpy.app.timers.is_registered(_process_queue):
        bpy.app.timers.unregister(_process_queue)
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)

if __name__ == '__main__':
    register()
