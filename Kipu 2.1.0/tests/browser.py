"""Actual Chromium IndexedDB and application UI via direct local PHP HTTP.
Exit 77 if browser navigation is administratively blocked. No simulated storage."""
import os, sys, pathlib, tempfile, subprocess, socket, time, urllib.request, urllib.error, json, signal, concurrent.futures
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='qipu-browser-') as tmp:
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    backend=f'http://127.0.0.1:{port}'; env={**os.environ,'QIPU_ROOT':tmp,'PHP_CLI_SERVER_WORKERS':'4'}
    log=open(pathlib.Path(tmp)/'server.log','w'); server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public')],env=env,stdout=log,stderr=log,start_new_session=True)
    checks=0
    def check(b,label):
        global checks
        assert b,label; checks+=1; print('PASS',label,flush=True)
    def req(op,args={},body=None):
        from urllib.parse import urlencode
        u=backend+'/api.php?'+urlencode({'op':op,**args});r=urllib.request.Request(u,data=body)
        with urllib.request.urlopen(r,timeout=15) as h:return json.loads(h.read())
    try:
        for _ in range(100):
            try:req('nodes');break
            except OSError:time.sleep(.05)
        else:raise RuntimeError('PHP no inicia')
        check(req('nodes')['nodes']==[],'Registro vacío en servidor HTTP')
        # Concurrent submissions of same and different names via 4 PHP workers.
        names=['Bodega','Bodega','Tienda_2','Tienda_2','Punto-3','Punto-3']
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as e:rs=list(e.map(lambda n:req('register',{'node':n},b''),names))
        check(len(req('nodes')['nodes'])==3 and len({(r['node'],r['index']) for r in rs})==3 and sum(not r['replayed'] for r in rs)==3,'6 registros HTTP concurrentes: 3 identidades y 3 reintentos')
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path=os.getenv('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
            c=b.new_context(); page=c.new_page()
            try:page.goto(backend+'/',timeout=7000);page.wait_for_function("document.querySelector('#message')?.textContent.includes('Listo')",timeout=5000)
            except Exception as e:
                if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(e):raise
                print('BLOQUEADO: '+str(e).splitlines()[0],flush=True)
                print('2/2 pruebas HTTP de registro; IndexedDB y UI NO ejecutadas (salida 77).',flush=True);b.close();sys.exit(77)
            origin=backend;api_log=[]
            c.on('request',lambda r:api_log.append(r.url) if '/api.php?' in r.url else None)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            def click(pg,id):pg.locator('#'+id).click();pg.wait_for_function('!busy')
            def open_node(pg,n):pg.fill('#node',n);click(pg,'openNode');assert pg.locator('#activeNode').inner_text()==n
            def val(pg,script):return pg.evaluate(script)
            def store(pg):return val(pg,"async()=>{let r=await load(node);return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Array.from(v)]))}")
            check(val(page,'isSecureContext && !!indexedDB && !!crypto.subtle'),'Chromium en contexto seguro con IndexedDB y Web Crypto reales')
            open_node(page,'Offline-4');click(page,'readC');check(val(page,'canonical.state[0].vectors[2].values[0]')==20,'Adquisición de C antes de registrar nodo')
            page.uncheck('#online');before=len(api_log);page.fill('#noteText','Nota privada offline');click(page,'note');click(page,'localFact');page.fill('#qty','5');click(page,'sale');local0=store(page)
            check(val(page,'local.history.length===3 && local.q.length===1 && working.state[0].vectors[2].values[0]===15 && local.privateState.length===1') and len(api_log)==before,'Offline: nota, hecho privado, venta; ninguna llamada API')
            check('Offline-4' not in req('nodes')['nodes'],'Localidad offline todavía no constituida remotamente')
            page.reload();page.wait_for_function("document.querySelector('#message')?.textContent.includes('Listo')");open_node(page,'Offline-4');check(store(page)==local0 and val(page,'working.state[0].vectors[2].values[0]')==15,'Recarga real: bytes L/C/R y derivación recuperados de IndexedDB')
            click(page,'publish');check(req('pending')['nodes']['Offline-4']['requests']==1 and store(page)==local0,'Publicación registra nodo dinámico y solo Q; L intacta')
            click(page,'publish');check(req('pending')['nodes']['Offline-4']['requests']==1,'Repetición de publicación no duplica')
            click(page,'pending');page.locator('#queue .record').filter(has_text='Nodo Offline-4:').get_by_role('button',name='Aceptar').click();page.wait_for_function('!busy');click(page,'readR');check(val(page,'streams.R[0]===128 && working.state[0].vectors[2].values[0]===15 && canonical.state[0].vectors[2].values[0]===20'),'R antes de C: aceptación conserva provisional')
            click(page,'readC');after=store(page);check(val(page,'canonical.state[0].vectors[2].values[0]===15 && working.state[0].vectors[2].values[0]===15') and after['L']==local0['L'] and after['C'][:len(local0['C'])]==local0['C'],'C completa incorporación, sin duplicar ni modificar prefijo')
            click(page,'constat');check('coinciden' in page.locator('#message').inner_text(),'Constatación de prefijos por API')
            click(page,'rebuild');check(store(page)==after and 'idénticos' in page.locator('#message').inner_text(),'Reconstrucción de derivados desde persistencia real')
            # Another browser context represents a distinct local storage, not a second name sharing a DB.
            c2=b.new_context();
            pg=c2.new_page();pg.goto(origin+'/');pg.wait_for_function("document.querySelector('#message')?.textContent.includes('Listo')");open_node(pg,'Punto-3');check(val(pg,'local.history.length===0 && streams.C.length===0'),'Segundo contexto: IndexedDB independiente')
            click(pg,'readC');check(val(pg,'JSON.stringify(canonical.state)')==val(page,'JSON.stringify(canonical.state)'),'Convergencia canónica entre contextos de navegador')
            # Two tabs with same local identity and stale prefix. The actual IDB transaction must reject second append.
            tab=c.new_page();tab.goto(origin+'/');tab.wait_for_function("document.querySelector('#message')?.textContent.includes('Listo')");open_node(tab,'Offline-4');page.uncheck('#online');tab.uncheck('#online');page.fill('#noteText','Primer escritor');click(page,'note');tab.fill('#noteText','Prefijo obsoleto');click(tab,'note');check('Otro escritor' in tab.locator('#message').inner_text(),'Dos pestañas: escritura sobre prefijo obsoleto abortada')
            click(tab,'rebuild');tab.fill('#noteText','Segundo escritor tras reconstruir');click(tab,'note');check(val(tab,'local.history.length===5 && local.q.length===1'),'Tras reconstruir, segundo escritor añade sin pérdida')
            # Actual transport loss while the page is already loaded (no Service Worker).
            tab.check('#online');c.set_offline(True);tab.fill('#qty','1');click(tab,'sale');lost=store(tab)
            check(val(tab,'local.q.length===2') and 'publicación pendiente' in tab.locator('#message').inner_text(),'Fallo real de red: solicitud durable antes del intento HTTP')
            c.set_offline(False);click(tab,'publish');check(req('pending')['nodes']['Offline-4']['requests']==2 and store(tab)==lost,'Reconexión: publica exactamente el sufijo sin modificar L')
            check(not errors,'Sin errores JavaScript no controlados en página principal')
            b.close()
        print(f'{checks}/{checks} comprobaciones HTTP dinámico + navegador',flush=True)
    finally:
        os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=10);log.close()
