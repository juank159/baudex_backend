"""E2E local: repetir una acción de orden de compra que ya se aplicó no es un
error (reintentos de la cola de la app), y recibir dos veces nunca suma stock
dos veces. Backend de prueba en el puerto 3997, BD baudex_sync_test."""
import json, subprocess, uuid, urllib.request, urllib.error

API = 'http://127.0.0.1:3997/api'
PSQL = ['psql', '-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'baudex_sync_test', '-X', '-At', '-c']
ok = True


def sql(q):
    return subprocess.run(PSQL + [q], capture_output=True, text=True).stdout.strip()


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req) as r:
            raw = json.loads(r.read() or b'{}')
            return r.status, raw.get('data', raw) if isinstance(raw, dict) else raw
    except urllib.error.HTTPError as e:
        raw = json.loads(e.read() or b'{}')
        return e.code, raw


def check(name, cond, extra=''):
    global ok
    print(('OK   ' if cond else 'FALLA'), name, extra)
    ok = ok and cond


st, login = call('POST', '/auth/login', {'email': 'sync@test.local', 'password': 'Prueba123!'})
token = login.get('token') or login.get('accessToken')
org = sql("select organization_id from users where email='sync@test.local'")
cat = sql(f"select id from categories where organization_id='{org}' limit 1") or \
    sql(f"insert into categories(id,name,slug,organization_id,status) values (gen_random_uuid(),'Compras','compras','{org}','active') returning id").splitlines()[0]
st, sup = call('POST', '/suppliers', {'name': 'Proveedor ' + uuid.uuid4().hex[:5], 'documentType': 'nit',
                                      'documentNumber': str(uuid.uuid4().int)[:9]}, token)
check('proveedor creado', st in (200, 201), f'{st} {sup if st >= 300 else ""}')
st, prod = call('POST', '/products', {'name': 'Harina', 'sku': 'HAR' + uuid.uuid4().hex[:5], 'categoryId': cat, 'stock': 0,
                                      'prices': [{'type': 'price1', 'name': 'P', 'amount': 3000}, {'type': 'cost', 'name': 'C', 'amount': 2000}]}, token)
pid = prod['id']


def stock():
    return float(sql(f"select stock from products where id='{pid}'") or 0)


st, po = call('POST', '/purchase-orders', {'supplierId': sup['id'], 'items': [
    {'productId': pid, 'lineNumber': 1, 'quantity': 10, 'unitCost': 2000}]}, token)
check('orden creada', st in (200, 201), f'{st} {po if st >= 300 else ""}')
po_id = po['id']

st1, a1 = call('POST', f'/purchase-orders/{po_id}/approve', {}, token)
st2, a2 = call('POST', f'/purchase-orders/{po_id}/approve', {}, token)
check('aprobar', st1 in (200, 201) and a1.get('status') == 'approved', f'{st1}')
check('aprobar otra vez (reintento) no es error', st2 in (200, 201) and a2.get('status') == 'approved', f'{st2} {a2.get("status")}')

item_id = sql(f"select id from purchase_order_items where \"purchaseOrderId\"='{po_id}'")
receive = {'receivedItems': [{'purchaseOrderItemId': item_id, 'receivedQuantity': 10}]}
before = stock()
st, r1 = call('POST', f'/purchase-orders/{po_id}/receive', receive, token)
after_first = stock()
check('recibir', st in (200, 201) and r1.get('status') == 'received', f'{st} {r1 if st >= 300 else ""}')
check('el stock subió 10', after_first - before == 10, f'{before} → {after_first}')

st, r2 = call('POST', f'/purchase-orders/{po_id}/receive', receive, token)
check('recibir otra vez (reintento) no es error', st in (200, 201) and r2.get('status') == 'received', f'{st} {r2.get("status")}')
check('el stock NO sube dos veces', stock() == after_first, f'{stock()}')
batches = sql(f"select count(*) from inventory_batches where \"purchaseOrderId\"='{po_id}'") or \
    sql(f"select count(*) from inventory_batches where purchase_order_id='{po_id}'")
check('un solo lote para la orden', batches == '1', batches)

st, a3 = call('POST', f'/purchase-orders/{po_id}/approve', {}, token)
check('aprobar una orden ya recibida (reintento) no es error y no la cambia',
      st in (200, 201) and a3.get('status') == 'received', f'{st} {a3.get("status")}')

st, c = call('POST', f'/purchase-orders/{po_id}/cancel', {'reason': 'x'}, token)
check('cancelar una orden recibida sigue rechazándose', st == 400, f'{st}')

st, po2 = call('POST', '/purchase-orders', {'supplierId': sup['id'], 'items': [
    {'productId': pid, 'lineNumber': 1, 'quantity': 1, 'unitCost': 2000}]}, token)
call('POST', f'/purchase-orders/{po2["id"]}/cancel', {'reason': 'x'}, token)
st, c2 = call('POST', f'/purchase-orders/{po2["id"]}/cancel', {'reason': 'x'}, token)
check('cancelar otra vez (reintento) no es error', st in (200, 201), f'{st}')
st, a4 = call('POST', f'/purchase-orders/{po2["id"]}/approve', {}, token)
check('aprobar una orden cancelada sigue rechazándose', st == 400, f'{st}')

print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS')
