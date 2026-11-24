#!/usr/bin/env python3
"""Run original Qipu 2.0.0 and an isolated 3-node test variant; never changes source ZIP."""
import os, sys, pathlib, tempfile, zipfile, shutil, subprocess, time, socket, signal, json, hashlib, re, urllib.request
HERE=pathlib.Path(__file__).resolve().parent
ARCHIVE=pathlib.Path(sys.argv[1]).resolve()
EXPECTED='a63cc7f47bfa9d0e1906e1a641b8b51ad0909748362ddc996883ba995d9d6dbb'
assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()==EXPECTED,'Se requiere el ZIP original Qipu 2.0.0'
with tempfile.TemporaryDirectory(prefix='qipu-advanced-') as t:
    temp=pathlib.Path(t)
    with zipfile.ZipFile(ARCHIVE) as z:
        assert z.testzip() is None
        z.extractall(temp)
    original=temp/'qipu_2.0.0'; variant=temp/'variant'; shutil.copytree(original,variant)
    replacements={'src/Qipu.php':[("const NODES=['A','B'];","const NODES=['A','B','C'];"),("['C','QA','QB','RA','RB']","['C','QA','QB','QC','RA','RB','RC']")], 'public/js/model.js':[("['A','B'].includes(o.node)","['A','B','C'].includes(o.node)")]}
    for rel,pairs in replacements.items():
        p=variant/rel;s=p.read_text()
        for a,b in pairs:
            assert a in s,(rel,a);s=s.replace(a,b)
        p.write_text(s)
    assert (original/'src/Storage.php').read_bytes()==(variant/'src/Storage.php').read_bytes()
    print('SHA-256 ZIP original: '+EXPECTED,flush=True)
    print('Variante de prueba: exclusivamente habilitación de C en PHP y JS; PAO intacto.',flush=True)
    def run_case(name,project,round_number):
        data=temp/f'{name}-{round_number}';data.mkdir(mode=0o700)
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        env={**os.environ,'QIPU_ROOT':str(data),'QIPU_PROJECT':str(project),'QIPU_URL':f'http://127.0.0.1:{port}/api.php','PHP_CLI_SERVER_WORKERS':'4','QIPU_ROUND':str(round_number)}
        log=data/'server.log';print(f'\n=== {name} / ronda {round_number} / {project.name} ===',flush=True)
        with log.open('w') as f:
            server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(project/'public')],env=env,stdout=f,stderr=f,start_new_session=True)
            try:
                for _ in range(100):
                    try:
                        with urllib.request.urlopen(env['QIPU_URL']+'?op=head&stream=C',timeout=1) as r: assert r.status==200
                        break
                    except Exception:
                        if server.poll() is not None:raise RuntimeError(log.read_text())
                        time.sleep(.05)
                else:raise RuntimeError('No inició PHP')
                proc=subprocess.run(['node',str(HERE/'advanced.cjs'),name],env=env,text=True,capture_output=True,timeout=90)
                print(proc.stdout,end='',flush=True)
                if proc.returncode:print(proc.stderr,flush=True);raise RuntimeError('Prueba fallida')
            finally:
                os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=5)
        logs=log.read_text();pids=set(re.findall(r'\[(\d+)\].*?\bAccepted\b',logs));print('PHP PIDs que aceptaron conexiones: '+','.join(sorted(pids)),flush=True)
        assert len(pids)>1 if name!='limit' else len(pids)>=1
        n=int(re.search(r'TOTAL (\d+)/\d+',proc.stdout)[1]);r=re.search(r'^RESULT (.+)$',proc.stdout,re.M)
        return dict(scenario=name,round=round_number,variant=project.name,checks=n,workers=len(pids),result=json.loads(r[1]) if r else {})
    results=[run_case('limit',original,1)]
    for i in range(1,7):results.append(run_case('one',variant,i))
    for i in range(1,7):results.append(run_case('two',variant,i))
    results.append(run_case('three',original,1))
    print('\n=== RESUMEN ===\n'+json.dumps(results,ensure_ascii=False,indent=2),flush=True)
    print('TOTAL ADVANCED '+str(sum(x['checks'] for x in results)),flush=True)
    (HERE/'resultados.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
