"""E2E local: la deuda del cliente siempre es la suma de sus créditos pendientes
(backend de prueba en el puerto 3997, BD baudex_sync_test)."""
import json, subprocess, uuid, urllib.request, urllib.error

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


st, login = call('POST', '/auth/login', {'email': 'sync@test.local', 'password': 'Prueba123!'})
token = login.get('token') or login.get('accessToken')
org = sql("select organization_id from users where email='sync@test.local'")
sql(f"update organizations set settings = coalesce(settings,'{{}}'::jsonb) || '{{\"cashRegisterEnabled\": false}}'::jsonb where id='{org}'")
cat = sql(f"select id from categories where organization_id='{org}' and slug='deuda' limit 1") or \
    sql(f"insert into categories(id,name,slug,organization_id,status) values (gen_random_uuid(),'Deuda','deuda','{org}','active') returning id").splitlines()[0]
st, c = call('POST', '/customers', {'firstName': 'Deuda', 'lastName': 'Prueba', 'documentType': 'cc',
                                    'documentNumber': str(uuid.uuid4().int)[:9], 'email': f'{uuid.uuid4().hex[:8]}@test.local'}, token)
cust = c['id']
sql(f'update customers set "creditLimit" = 10000000 where id={chr(39)}{cust}{chr(39)}')
st, prod = call('POST', '/products', {'name': 'Panela', 'sku': 'PAN' + uuid.uuid4().hex[:5], 'categoryId': cat, 'stock': 1000,
                                      'prices': [{'type': 'price1', 'name': 'P', 'amount': 3000}, {'type': 'cost', 'name': 'C', 'amount': 2000}]}, token)
pid = prod['id']


def debt():
    return sql(f"select \"currentBalance\"::numeric, credit_balance::numeric, (select coalesce(sum(balance_due),0) from customer_credits "
               f"where customer_id='{cust}' and deleted_at is null and status in ('pending','partially_paid','overdue')) "
               f"from customers where id='{cust}'").split('|')


def expect(name, amount):
    cur, cb, real = (float(x) for x in debt())
    check(name, cur == cb == real == amount, f'current={cur} credit_balance={cb} créditos={real} esperado={amount}')


def credit_invoice(qty):
    st, inv = call('POST', '/invoices', {'customerId': cust, 'paymentMethod': 'credit', 'status': 'pending', 'skipStockValidation': True,
                                         'items': [{'productId': pid, 'description': 'Panela', 'quantity': qty, 'unitPrice': 3000}],
                                         'metadata': {'isPureCreditInvoice': True}}, token)
    return inv.get('id'), sql(f"select id from customer_credits where invoice_id='{inv.get('id')}'")


expect('cliente nuevo sin deuda', 0)
inv1, cr1 = credit_invoice(2)
expect('venta a crédito de 6.000', 6000)
inv2, cr2 = credit_invoice(5)
expect('segunda venta a crédito de 15.000', 21000)

st, _ = call('POST', f'/customer-credits/{cr1}/payments', {'amount': 6000, 'paymentMethod': 'cash'}, token,
             {'Idempotency-Key': str(uuid.uuid4())})
expect('abono que paga el primer crédito', 15000)

st, _ = call('POST', f'/invoices/{inv2}/payments', {'amount': 5000, 'paymentMethod': 'cash'}, token,
             {'Idempotency-Key': str(uuid.uuid4())})
expect(f'pago parcial desde la factura ({st})', 10000)

pay_id = sql(f"select id from payments where \"invoiceId\"='{inv2}' and deleted_at is null order by created_at desc limit 1")
st, _ = call('DELETE', f'/invoices/{inv2}/payments/{pay_id}', None, token)
expect(f'pago de factura eliminado: vuelve la deuda ({st})', 15000)

st, cr3 = call('POST', '/customer-credits', {'customerId': cust, 'originalAmount': 4000, 'description': 'Fiado manual'}, token)
expect(f'crédito manual de 4.000 ({st})', 19000)

st, _ = call('POST', f'/customer-credits/{cr3.get("id")}/cancel', {}, token)
expect(f'crédito manual cancelado ({st})', 15000)

st, _ = call('POST', f'/invoices/{inv2}/cancel', {}, token)
expect(f'factura a crédito anulada ({st})', 0)

before = sql(f"select updated_at from customers where id='{cust}'")
inv3, cr3b = credit_invoice(1)
st, ch = call('GET', f'/sync/changes/customers?since=1970-01-01T00:00:00.000000Z&limit=500', None, token)
row = [x for x in ch.get('items', []) if x.get('id') == cust]
check('la descarga incremental trae al cliente con la deuda nueva',
      bool(row) and float(row[0].get('currentBalance', -1)) == 3000 and sql(f"select updated_at from customers where id='{cust}'") != before,
      f"{row[0].get('currentBalance') if row else None}")

print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS')
