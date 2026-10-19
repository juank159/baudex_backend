"""E2E local: una venta con un producto NO registrado mandado con su id temporal
de la app (`temp_…` / `unregistered_…`) se acepta como producto temporal; un id
inválido de otro tipo se sigue rechazando. Backend de prueba en el 3997."""
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
sql(f"update organizations set settings = coalesce(settings,'{{}}'::jsonb) || '{{\"cashRegisterEnabled\": false}}'::jsonb where id='{org}'")
st, c = call('POST', '/customers', {'firstName': 'Cliente', 'lastName': 'Temp', 'documentType': 'cc',
                                    'documentNumber': str(uuid.uuid4().int)[:9], 'email': f'{uuid.uuid4().hex[:8]}@t.local'}, token)
cust = c['id']


def sale(product_id):
    return call('POST', '/invoices', {
        'customerId': cust, 'paymentMethod': 'cash', 'status': 'paid', 'skipStockValidation': True,
        'items': [{'productId': product_id, 'description': 'd', 'quantity': 1, 'unitPrice': 5000}],
    }, token)


st, inv = sale('temp_1760900000000')
check('venta con producto no registrado (temp_…) se acepta', st == 201, f'{st} {inv.get("message", "") if st != 201 else ""}')
if st == 201:
    item = sql(f"select coalesce(\"productId\"::text,'null') || '|' || description || '|' || subtotal from invoice_items where \"invoiceId\"='{inv['id']}'")
    check('el ítem queda como temporal, con su descripción y valor', item.startswith('null|') or 'd|5000' in item, item)
    check('total correcto', float(inv.get('total', 0)) == 5000, f"{inv.get('total')}")

st, inv2 = sale('unregistered_abc')
check('venta con producto no registrado (unregistered_…) se acepta', st == 201, f'{st}')

st, inv3 = sale('product_offline_123')
check('un producto creado sin conexión no resuelto se sigue rechazando (la app espera)', st == 400, f'{st}')

st, inv4 = sale('no-es-un-id')
check('un id inválido cualquiera se sigue rechazando', st == 400, f'{st}')

print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS')
