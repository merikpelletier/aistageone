bl_info = {
    "name": "AISTAGE Blender Bridge",
    "author": "AISTAGE.ONE",
    "version": (0, 8, 0),
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
    if not obj.get('aistage_character_copy', False):
        raise ValueError('Native modeling tools require an AISTAGE working copy')
    if obj.mode != 'OBJECT':
        raise ValueError('Switch the working copy to Object Mode')
    return obj


def _create_group_from_selection(action):
    # Preserve Blender's actual artist-edited selection; never infer body parts
    # from bounding boxes or apply modifications to the base mesh.
    obj = _character_source(action)
    if not obj.get('aistage_character_copy', False):
        raise ValueError('Create a working copy first')
    if obj.mode != 'EDIT':
        raise ValueError('Select waist vertices in Blender Edit Mode first')
    import bmesh
    bm = bmesh.from_edit_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    selected = [v.index for v in bm.verts if v.select and not v.hide]
    if len(selected) < 10:
        raise ValueError('Select at least 10 vertices of the waist, excluding arms')
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


def _waist_morph(action):
    # Retire the old invented geometry deformation. Never silently fall back.
    raise ValueError('Legacy waist morph disabled. Use native vertex groups and a Lattice Modifier.')


def _execute_command(action):
    kind = action.get('action')
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
        meshes = sorted((obj for obj in bpy.context.scene.objects if obj.type == 'MESH'), key=lambda o: o.name)
        return {'objects': [_mesh_info(obj) for obj in meshes[:100]], 'total_meshes': len(meshes)}
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
        return self._respond(200, {'ok': True, 'bridge': '0.8', 'blender': bpy.app.version_string})

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
        layout.label(text='Bridge 0.8 - AISTAGE.ONE Studio')
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
