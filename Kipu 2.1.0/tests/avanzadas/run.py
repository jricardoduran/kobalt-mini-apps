"""Run the advanced scenarios against Qipu 2.1 with dynamic registrations, no patches."""
import os, pathlib, tempfile, subprocess, time, socket, signal, json, re, urllib.request
HERE=pathlib.Path(__file__).resolve().parent
PROJECT=HERE.parent.parent
results=[]
for case,rounds in [('one',6),('two',6),('three',1)]:
    for round_no in range(1,rounds+1):
        with tempfile.TemporaryDirectory(prefix='qipu-adv21-') as data:
            with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
            url=f'http://127.0.0.1:{port}/api.php';env={**os.environ,'QIPU_ROOT':data,'QIPU_PROJECT':str(PROJECT),'QIPU_URL':url,'PHP_CLI_SERVER_WORKERS':'4','QIPU_ROUND':str(round_no)}
            print(f'=== {case} / {round_no} ===',flush=True)
            with open(pathlib.Path(data)/'server.log','w') as log:
                server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(PROJECT/'public')],env=env,stdout=log,stderr=log,start_new_session=True)
                try:
                    for _ in range(100):
                        try:
                            with urllib.request.urlopen(url+'?op=nodes',timeout=1) as r:assert json.load(r)['nodes']==[]
                            break
                        except OSError:time.sleep(.05)
                    else:raise RuntimeError('PHP no inicia')
                    p=subprocess.run(['node',str(HERE/'advanced.cjs'),case],env=env,text=True,capture_output=True,timeout=90)
                    print(p.stdout,end='',flush=True);assert p.returncode==0,p.stderr
                    n=int(re.search(r'TOTAL (\d+)/\d+',p.stdout)[1]);r=re.search(r'^RESULT (.+)$',p.stdout,re.M)
                    logs=(pathlib.Path(data)/'server.log').read_text();workers=len(set(re.findall(r'\[(\d+)\].*?\bAccepted\b',logs)));assert workers>1
                    results.append(dict(scenario=case,round=round_no,checks=n,workers=workers,result=json.loads(r[1])))
                finally:os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=5)
print('TOTAL ADVANCED '+str(sum(x['checks'] for x in results)),flush=True)
(HERE/'resultados.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
