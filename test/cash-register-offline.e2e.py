"""E2E local: caja, ventas y abonos sin conexión contra el backend de prueba (puerto 3997, BD baudex_sync_test)."""
import json, subprocess, uuid, datetime, urllib.request, urllib.error

API = 'http://127.0.0.1:3997/api'
PSQL = ['psql', '-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'baudex_sync_test', '-X', '-At', '-c']
ok = True


def sql(q):
    return subprocess.run(PSQL + [q], capture_output=True, text=True).stdout.strip()


def call(method, path, body=None, token=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
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


def iso(dt):
    return dt.astimezone(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')


now = datetime.datetime.now(datetime.timezone.utc)
st, login = call('POST', '/auth/login', {'email': 'sync@test.local', 'password': 'Prueba123!'})
token = login.get('token') or login.get('accessToken')
org = sql("select organization_id from users where email='sync@test.local'")
sql(f"update organizations set settings = coalesce(settings,'{{}}'::jsonb) || '{{\"cashRegisterEnabled\": true}}'::jsonb where id='{org}'")
cat = sql(f"insert into categories(id,name,slug,organization_id,status) values (gen_random_uuid(),'General','general','{org}','active') returning id").splitlines()[0]
cust = sql(f"select id from customers where organization_id='{org}' limit 1")
if not cust:
    st, c = call('POST', '/customers', {'firstName': 'Cliente', 'lastName': 'Prueba', 'documentType': 'cc', 'documentNumber': '123456', 'email': 'c@test.local'}, token)
    cust = c['id']
sql(f'update customers set "creditLimit" = 10000000 where id={chr(39)}{cust}{chr(39)}')
st, prod = call('POST', '/products', {'name': 'Arroz', 'sku': 'ARZ1', 'categoryId': cat, 'stock': 100,
                                      'prices': [{'type': 'price1', 'name': 'P', 'amount': 2500}, {'type': 'cost', 'name': 'C', 'amount': 1500}]}, token)
pid = prod['id']

# ── 1. Apertura sin conexión (id + hora del equipo), reenvío idempotente ──
reg_id = str(uuid.uuid4())
opened_at = now - datetime.timedelta(hours=3)
body = {'openingAmount': 100000, 'id': reg_id, 'openedAt': iso(opened_at)}
st1, r1 = call('POST', '/cash-register/open', body, token)
st2, r2 = call('POST', '/cash-register/open', body, token)
check('apertura con id del equipo', st1 == 201 and r1.get('id') == reg_id, f'{st1}')
check('reenvío de la misma apertura no duplica', st2 in (200, 201) and r2.get('id') == reg_id,
      f"{st2} cajas={sql(f'select count(*) from cash_registers where organization_id={chr(39)}{org}{chr(39)}')}")
db_opened = sql(f"select to_char(opened_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from cash_registers where id='{reg_id}'")
check('apertura conserva la hora del equipo', db_opened == opened_at.strftime('%Y-%m-%d %H:%M'), db_opened)
st3, r3 = call('POST', '/cash-register/open', {'openingAmount': 5, 'id': str(uuid.uuid4())}, token)
check('otra apertura con caja abierta → 409', st3 == 409, f'{st3}')

# ── 2. Venta en efectivo hecha sin conexión durante el turno ──
sold_at = now - datetime.timedelta(hours=2)
inv = {'customerId': cust, 'paymentMethod': 'cash', 'status': 'paid', 'skipStockValidation': True,
       'items': [{'productId': pid, 'description': 'Arroz', 'quantity': 4, 'unitPrice': 2500}],
       'metadata': {'soldAt': iso(sold_at)}}
st, i1 = call('POST', '/invoices', inv, token)
pay_date = sql(f"select to_char(\"paymentDate\" at time zone 'UTC','YYYY-MM-DD HH24:MI') from payments where \"invoiceId\"='{i1.get('id')}'")
check('venta sin conexión: pago con la hora real de la venta', pay_date == sold_at.strftime('%Y-%m-%d %H:%M'), f'{st} {pay_date}')

# ── 3. Cierre sin conexión (hora del equipo) + reenvío idempotente ──
closed_at = now - datetime.timedelta(hours=1)
cbody = {'closingActualAmount': 110000, 'closedAt': iso(closed_at)}
stc1, c1 = call('POST', f'/cash-register/{reg_id}/close', cbody, token)
stc2, c2 = call('POST', f'/cash-register/{reg_id}/close', cbody, token)
check('cierre con hora del equipo', stc1 == 200 and c1.get('status') == 'closed', f'{stc1}')
check('cuadre incluye la venta sin conexión (esperado 110000)', float(c1.get('closingExpectedAmount', 0)) == 110000,
      f"esperado={c1.get('closingExpectedAmount')} dif={c1.get('closingDifference')}")
check('reenvío del mismo cierre no falla', stc2 == 200, f'{stc2}')

# ── 4. Venta sin conexión que sube con la caja ya cerrada → se acepta ──
late = dict(inv, metadata={'soldAt': iso(now - datetime.timedelta(minutes=70))})
st, i2 = call('POST', '/invoices', late, token)
check('venta sin conexión con caja cerrada se acepta', st == 201, f'{st} {i2.get("message", "")}')

# ── 5. Venta EN VIVO en efectivo sin caja abierta → se rechaza ──
live = dict(inv); live.pop('metadata')
st, i3 = call('POST', '/invoices', live, token)
check('venta en vivo sin caja abierta se rechaza', st == 400, f'{st}')

# ── 6. Abono en efectivo hecho sin conexión con la caja cerrada → se acepta ──
cr_inv = {'customerId': cust, 'paymentMethod': 'credit', 'status': 'pending', 'skipStockValidation': True,
          'items': [{'productId': pid, 'description': 'Arroz', 'quantity': 2, 'unitPrice': 2500}],
          'metadata': {'isPureCreditInvoice': True}}
st, ci = call('POST', '/invoices', cr_inv, token)
credit_id = sql(f"select id from customer_credits where invoice_id='{ci.get('id')}'")
if not credit_id:
    st, cr = call('POST', '/customer-credits', {'customerId': cust, 'originalAmount': 5000, 'description': 'Prueba'}, token)
    credit_id = cr.get('id')
old_pay = (now - datetime.timedelta(minutes=50)).isoformat().replace('+00:00', 'Z')
st, p = call('POST', f'/customer-credits/{credit_id}/payments',
             {'amount': 1000, 'paymentMethod': 'cash', 'paymentDate': old_pay},
             token, {'Idempotency-Key': str(uuid.uuid4())})
check('abono sin conexión con caja cerrada se acepta', st in (200, 201), f'{st} {p.get("message", "") if isinstance(p, dict) else ""}')
st, p2 = call('POST', f'/customer-credits/{credit_id}/payments', {'amount': 500, 'paymentMethod': 'cash'},
              token, {'Idempotency-Key': str(uuid.uuid4())})
check('abono en vivo sin caja abierta se rechaza', st == 400, f'{st}')

# ── 7. Créditos con sus abonos en la descarga incremental ──
st, ch = call('GET', '/sync/changes/customer_credits?since=1970-01-01T00:00:00.000000Z&limit=50', None, token)
items = ch.get('items', [])
match = [c for c in items if c.get('id') == credit_id]
pays = match[0].get('payments') if match else None
check('descarga incremental trae los abonos del crédito', bool(pays) and len(pays) >= 1, f'abonos={len(pays or [])}')

print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS')
