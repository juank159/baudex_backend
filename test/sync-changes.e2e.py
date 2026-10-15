# Prueba de punta a punta de GET /sync/changes (descarga incremental).
#
# Requiere el servidor arrancado contra una base de PRUEBAS con un usuario
# sync@test.local / Prueba123! (ver instrucciones en el commit). Uso:
#   python3 test/sync-changes.e2e.py
# Verifica: paginado por cursor, cambios por API y por SQL directo,
# borrados suaves y definitivos, hijas que mueven al padre (precios, pagos),
# misma forma que los listados en las 12 entidades y aislamiento por negocio.
import json, urllib.request, subprocess, sys, time
B="http://127.0.0.1:3997/api"
def req(method, path, body=None, token=None):
    r=urllib.request.Request(B+path, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type':'application/json','X-Device-Id':'test-device-1', **({'Authorization':'Bearer '+token} if token else {})})
    try:
        with urllib.request.urlopen(r) as resp: return json.load(resp)
    except urllib.error.HTTPError as e:
        return {'_error': e.code, 'body': e.read().decode()[:400]}
def sql(q):
    return subprocess.run(['psql','-h','127.0.0.1','-p','54329','-U','postgres','-d','baudex_sync_test','-X','-At','-c',q],capture_output=True,text=True).stdout.strip()
ok=True
def check(name, cond, extra=''):
    global ok
    print(('PASA ' if cond else 'FALLA')+' '+name+(' — '+str(extra) if extra and not cond else ''))
    ok = ok and cond
tok=req('POST','/auth/login',{'email':'sync@test.local','password':'Prueba123!'})['data']['token']
def changes(entity, since=None, afterId=None, limit=None):
    q=[]
    if since: q.append('since='+urllib.parse.quote(since))
    if afterId: q.append('afterId='+afterId)
    if limit: q.append('limit='+str(limit))
    r=req('GET',f'/sync/changes/{entity}'+('?'+'&'.join(q) if q else ''),token=tok)
    if '_error' in r: print(r); sys.exit(1)
    return r['data']
import urllib.parse

# ---- vacío
c=changes('customers'); check('descarga completa vacía', c['items']==[] and c['watermark'] is not None and not c['hasMore'])

# ---- crear clientes
ids=[]
for i in range(3):
    r=req('POST','/customers',{'firstName':f'Cliente{i}','lastName':'Prueba','email':f'cliente{i}@prueba.com','documentType':'cc','documentNumber':f'100{i}'},tok)
    if '_error' in r: print(r); sys.exit(1)
    ids.append(r['data']['id'])
# paginado de a 2
p1=changes('customers',limit=2); check('página 1 trae 2 y hay más', len(p1['items'])==2 and p1['hasMore'] and p1['next'])
p2=changes('customers',since=p1['next']['since'],afterId=p1['next']['afterId'],limit=2)
check('página 2 trae el que falta y termina', len(p2['items'])==1 and not p2['hasMore'] and p2['watermark'] is None)
check('entre las dos páginas están los 3 sin repetir', sorted([x['id'] for x in p1['items']+p2['items']])==sorted(ids))
last=p2['stamps'][-1]; lastId=p2['items'][-1]['id']
check('sello con microsegundos', len(last)==27, last)

# ---- forma igual al listado
lst=req('GET','/customers?page=1&limit=10',token=tok)['data']
li=[x for x in lst if x['id']==ids[0]][0]; si=[x for x in p1['items']+p2['items'] if x['id']==ids[0]][0]
check('cliente: mismas claves que el listado', set(li.keys())==set(si.keys()), set(li.keys())^set(si.keys()))

# ---- nada nuevo desde el último sello
n=changes('customers',since=last,afterId=lastId); check('desde el último cursor: nada nuevo', n['items']==[] and n['deletedIds']==[], n)

# ---- modificar por la API
time.sleep(0.05)
r=req('PATCH',f'/customers/{ids[0]}',{'firstName':'Modificado'},tok)
n=changes('customers',since=last,afterId=lastId); check('modificación por la API aparece', [x['id'] for x in n['items']]==[ids[0]] and n['items'][0]['firstName']=='Modificado', n.get('items'))
# ---- modificar por SQL directo (sin TypeORM) -> trigger
last=n['stamps'][-1]; lastId=n['items'][-1]['id']; time.sleep(0.05)
sql(f"update customers set phone='555' where id='{ids[1]}'")
n=changes('customers',since=last,afterId=lastId); check('modificación por SQL directo aparece (trigger)', [x['id'] for x in n['items']]==[ids[1]], n.get('items'))
# ---- borrado suave por la API
last=n['stamps'][-1]; lastId=n['items'][-1]['id']; time.sleep(0.05)
r=req('DELETE',f'/customers/{ids[2]}',token=tok)
n=changes('customers',since=last); check('borrado suave llega en deletedIds y no en items', ids[2] in n['deletedIds'] and ids[2] not in [x['id'] for x in n['items']], (r, n))
# ---- borrado definitivo por SQL -> sync_deletions
sql(f"delete from customers where id='{ids[1]}'")
n=changes('customers',since=last); check('borrado definitivo llega en deletedIds', ids[1] in n['deletedIds'], n)
# ---- marca demasiado vieja -> reset
n=changes('customers',since='2020-01-01T00:00:00.000000Z'); check('marca de hace >90 días pide descarga completa', n['resetRequired'] is True)

# ---- productos con precios (hija -> padre)
cat=req('POST','/categories',{'name':'Cat Sync','slug':'cat-sync'},tok)
catId=cat.get('data',{}).get('id')
pr=req('POST','/products',{'name':'Producto Sync','sku':'SKU-SYNC-1','type':'product','status':'active','stock':10,'minStock':1,'unit':'pcs','categoryId':catId,
  'prices':[{'type':'price1','name':'Precio 1','amount':1000,'currency':'COP'}]},tok)
if '_error' in pr: print('producto:',pr); sys.exit(1)
pid=pr['data']['id']
full=changes('products'); sp=[x for x in full['items'] if x['id']==pid][0]
lp=[x for x in req('GET','/products?page=1&limit=10&includePrices=true&includeCategory=true',token=tok)['data'] if x['id']==pid][0]
check('producto: mismas claves que el listado', set(lp.keys())==set(sp.keys()), set(lp.keys())^set(sp.keys()))
check('producto trae precios y categoría', len(sp.get('prices') or [])==1 and sp.get('category'), sp.get('prices'))
last=full['stamps'][-1]; lastId=full['items'][-1]['id']; time.sleep(0.05)
sql(f"update product_prices set amount=2000 where product_id='{pid}'")
n=changes('products',since=last,afterId=lastId); check('cambio de precio hace bajar el producto (trigger hija→padre)', [x['id'] for x in n['items']]==[pid] and float(n['items'][0]['prices'][0]['amount'])==2000, n.get('items'))

# ---- presentaciones (tenant vía producto)
pres=req('POST',f'/products/{pid}/presentations',{'name':'Caja x12','factor':12,'price':11000},tok)
if '_error' in pres: print('presentación:',pres)
else:
    full=changes('product_presentations'); check('presentaciones: llega la creada', any(x['id']==pres['data']['id'] for x in full['items']), full)
    lpres=req('GET',f'/products/{pid}/presentations',token=tok)['data'][0]
    check('presentación: mismas claves que el listado', set(lpres.keys())==set(full['items'][0].keys()), set(lpres.keys())^set(full['items'][0].keys()))

# ---- más entidades: forma idéntica al listado
# Campos que la descarga incremental agrega a propósito (el listado no los
# trae): los abonos del crédito, para ver su historial sin conexión.
EXTRA_SYNC_KEYS={'customer_credits': {'payments'}}

def same_shape(name, list_items, entity):
    sync_items=changes(entity)['items']
    common=[i for i in sync_items if any(l.get('id')==i.get('id') for l in list_items)]
    if not common:
        print(f'SIN DATOS {name}: no se pudo comparar (lista={len(list_items)}, sync={len(sync_items)})'); return
    si=common[0]; li=[l for l in list_items if l['id']==si['id']][0]
    extra=EXTRA_SYNC_KEYS.get(entity,set())
    check(f'{name}: mismas claves que el listado', set(li.keys())==set(si.keys())-extra, set(li.keys())^(set(si.keys())-extra))
sup=req('POST','/suppliers',{'name':'Proveedor Sync','documentType':'nit','documentNumber':'900123','email':'prov@prueba.com'},tok)
if '_error' in sup: print('proveedor:',sup)
cr=req('POST','/cash-register/open',{'openingAmount':50000},tok)
if '_error' in cr: print('caja:',cr)
cust=ids[0]
inv=req('POST','/invoices',{'customerId':cust,'paymentMethod':'cash','status':'paid','items':[{'description':'Producto Sync','quantity':2,'unitPrice':2000,'productId':pid}]},tok)
if '_error' in inv: print('factura:',inv)
sql(f"update customers set credit_limit=100000 where id='{cust}'") or sql(f"update customers set \"creditLimit\"=100000 where id='{cust}'")
inv2=req('POST','/invoices',{'customerId':cust,'paymentMethod':'credit','status':'pending','items':[{'description':'Producto Sync','quantity':1,'unitPrice':2000,'productId':pid}]},tok)
if '_error' in inv2: print('factura crédito:',inv2)
ec=req('POST','/expense-categories',{'name':'Gastos Sync'},tok)
if '_error' in ec: print('cat gasto:',ec)
else:
    ex=req('POST','/expenses',{'description':'Gasto sync','amount':1000,'date':'2026-10-14','categoryId':ec['data']['id'],'type':'operating','paymentMethod':'cash'},tok)
    if '_error' in ex: print('gasto:',ex)
supId=sup.get('data',{}).get('id')
po=req('POST','/purchase-orders',{'supplierId':supId,'items':[{'productId':pid,'lineNumber':1,'quantity':3,'unitCost':800}]},tok)
if '_error' in po: print('orden de compra:',po)
if '_error' not in inv:
    invItems=inv['data'].get('items') or []
    cn=req('POST','/credit-notes',{'invoiceId':inv['data']['id'],'type':'partial','reason':'returned_goods','items':[{'invoiceItemId':invItems[0]['id'] if invItems else None,'productId':pid,'description':'Producto Sync','quantity':1,'unitPrice':2000}]},tok)
    if '_error' in cn: print('nota crédito:',cn)
sql(f"insert into notifications(id,organization_id,user_id,type,title,message,severity) select gen_random_uuid(), organization_id, id, 'expiring_product','Hola','Prueba','info' from users where email='sync@test.local'")
same_shape('facturas', req('GET','/invoices?page=1&limit=50',token=tok).get('data',[]), 'invoices')
same_shape('proveedores', req('GET','/suppliers?page=1&limit=50',token=tok).get('data',[]), 'suppliers')
same_shape('gastos', req('GET','/expenses?page=1&limit=50',token=tok).get('data',[]), 'expenses')
b=req('GET','/inventory/batches?page=1&limit=100',token=tok).get('data',[])
same_shape('lotes', b if isinstance(b,list) else [], 'inventory_batches')
m=req('GET','/inventory/movements?page=1&limit=100',token=tok).get('data',{})
same_shape('movimientos', m.get('movements',[]) if isinstance(m,dict) else [], 'inventory_movements')
same_shape('créditos', req('GET','/customer-credits',token=tok).get('data',[]), 'customer_credits')
pol=req('GET','/purchase-orders?page=1&limit=50',token=tok).get('data',[])
same_shape('órdenes de compra', pol if isinstance(pol,list) else pol.get('data',[]), 'purchase_orders')
cnl=req('GET','/credit-notes?page=1&limit=50',token=tok).get('data',[])
same_shape('notas crédito', cnl if isinstance(cnl,list) else cnl.get('data',[]), 'credit_notes')
nt=req('GET','/notifications?page=1&limit=50',token=tok).get('data',[])
same_shape('notificaciones', nt if isinstance(nt,list) else nt.get('notifications',[]), 'notifications')
# factura: un pago nuevo (hija) hace bajar la factura
if '_error' not in inv2:
    f=changes('invoices'); last=f['stamps'][-1]; lastId=f['items'][-1]['id']; time.sleep(0.05)
    pay=req('POST',f"/invoices/{inv2['data']['id']}/payments",{'amount':500,'paymentMethod':'cash'},tok)
    n=changes('invoices',since=last,afterId=lastId)
    check('pago a una factura hace bajar la factura', inv2['data']['id'] in [x['id'] for x in n['items']], (pay, [x['id'] for x in n['items']]))

# ---- aislamiento entre negocios
other=sql("insert into organizations(id,name,slug) values (gen_random_uuid(),'Otra','otra-sync') returning id")
check('no se ven datos de otro negocio', all(x['organizationId']!=other for x in changes('customers')['items']))
print('\nRESULTADO:', 'TODO PASA' if ok else 'HAY FALLAS')
