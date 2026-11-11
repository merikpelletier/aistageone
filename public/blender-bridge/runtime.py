bl_info = {
    "name": "AISTAGE Blender Bridge",
    "author": "AISTAGE.ONE",
    "version": (0, 7, 0),
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


def _waist_components(mesh, z_low, z_high):
    """Connected components in an anatomical Z band; arm islands remain separate.

    Crucially, connectivity is restricted to edges whose BOTH endpoints lie in
    the band. The arms join the torso above the band, so the connectivity test
    cannot silently walk from the waist into a shoulder or down a hand.
    """
    vertices = mesh.vertices
    eligible = {v.index for v in vertices if z_low < v.co.z < z_high}
    parent = {i: i for i in eligible}
    rank = {}

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for edge in mesh.edges:
        a, b = edge.vertices
        if a not in eligible or b not in eligible:
            continue
        ra, rb = root(a), root(b)
        if ra != rb:
            if rank.get(ra, 0) < rank.get(rb, 0):
                ra, rb = rb, ra
            parent[rb] = ra
            if rank.get(ra, 0) == rank.get(rb, 0):
                rank[ra] = rank.get(ra, 0) + 1

    groups = {}
    for i in eligible:
        groups.setdefault(root(i), []).append(i)
    return list(groups.values())


def _waist_morph(action):
    obj = _character_source(action)
    if not obj.get('aistage_character_copy', False):
        raise ValueError('Morphing is allowed only on an AISTAGE working copy')
    if obj.mode != 'OBJECT':
        raise ValueError('Switch to Object Mode before applying a morph')
    value = action.get('waist_width')
    if not _number(value) or not 0.75 <= value <= 1.25:
        raise ValueError('waist_width must be between 0.75 and 1.25')
    mesh = obj.data
    if not mesh.vertices:
        raise ValueError('Empty mesh')
    # Existing base model is oriented in Blender local Z. No edits to source.
    zmin = min(v.co.z for v in mesh.vertices)
    zmax = max(v.co.z for v in mesh.vertices)
    height = zmax - zmin
    if height < 0.01:
        raise ValueError('Mesh has insufficient vertical extent')

    # This conservative band is intentionally BELOW the shoulder/arm junction
    # in the supported human reference model. Do not expand it up to the armpits.
    lo, hi, mid = (zmin + height * p for p in (0.53, 0.68, 0.605))
    groups = _waist_components(mesh, lo, hi)
    if not groups:
        raise ValueError('No waist-region vertices found')
    xcenter = (min(v.co.x for v in mesh.vertices) + max(v.co.x for v in mesh.vertices)) / 2
    full_width = max(v.co.x for v in mesh.vertices) - min(v.co.x for v in mesh.vertices)
    # Identify central torso island by connectivity and proximity to the model's
    # horizontal center, NOT by height alone (arms overlap waist height).
    central = []
    for group in groups:
        if len(group) < 80:
            continue
        near_mid = [i for i in group if abs(mesh.vertices[i].co.z - mid) < height * 0.018]
        if len(near_mid) < 8:
            continue
        avg_x = sum(mesh.vertices[i].co.x for i in near_mid) / len(near_mid)
        xspan = max(mesh.vertices[i].co.x for i in group) - min(mesh.vertices[i].co.x for i in group)
        if abs(avg_x - xcenter) > full_width * 0.10 or xspan > full_width * 0.72:
            continue
        central.append((len(group), group))
    if not central:
        raise ValueError('Unable to isolate torso safely; no morph was applied')
    central.sort(key=lambda pair: pair[0], reverse=True)
    torso = set(central[0][1])
    if len(torso) < 150:
        raise ValueError('Torso mask too small; no morph was applied')

    # Geometric fail-safe: abort if selected component reaches outer arm region.
    waist_x = [mesh.vertices[i].co.x for i in torso if abs(mesh.vertices[i].co.z - mid) < height * 0.02]
    if not waist_x or max(waist_x) - min(waist_x) > full_width * 0.64:
        raise ValueError('Torso mask overlaps arm region; no morph was applied')
    torso_center = (min(waist_x) + max(waist_x)) / 2

    # Plan every target coordinate before touching any Shape Key.
    # Smooth compact falloff: 0% near ribs/hips, 100% at waist center.
    updates = {}
    for i in torso:
        co = mesh.vertices[i].co
        normalized = (co.z - lo) / (hi - lo)
        if not 0 < normalized < 1:
            continue
        t = 1.0 - abs(normalized * 2.0 - 1.0)
        smooth = t * t * (3.0 - 2.0 * t)
        if smooth < 1e-8:
            continue
        # Waist width operates on the left-right axis only.
        updates[i] = (torso_center + (co.x - torso_center) * (1 + (value - 1) * smooth), co.y, co.z)
    if not updates:
        raise ValueError('Waist mask produced no changes')

    if not mesh.shape_keys:
        obj.shape_key_add(name='Basis', from_mix=False)
    basis = mesh.shape_keys.key_blocks[0]
    key = mesh.shape_keys.key_blocks.get('AISTAGE_Waist')
    if key is None:
        key = obj.shape_key_add(name='AISTAGE_Waist', from_mix=False)
    # Reset obsolete keys from earlier algorithm so no arm distortion persists.
    # The basis remains the same; only our named working-copy key is rewritten.
    for i, base in enumerate(basis.data):
        key.data[i].co = updates.get(i, tuple(base.co))
    key.value = 1.0
    return {'object': obj.name, 'shape_key': key.name, 'waist_width': value,
            'affected_vertices': len(updates), 'protected_vertices': len(mesh.vertices) - len(updates),
            'mask': 'topology_connected_torso_band'}


def _execute_command(action):
    kind = action.get('action')
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
        return self._respond(200, {'ok': True, 'bridge': '0.7', 'blender': bpy.app.version_string})

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
        layout.label(text='Bridge 0.7 - AISTAGE.ONE Studio')
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
