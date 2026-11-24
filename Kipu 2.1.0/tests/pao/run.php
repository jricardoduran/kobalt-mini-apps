<?php
declare(strict_types=1);
require __DIR__.'/../../src/Storage.php';
function check(bool $b,string $m):void{if(!$b)throw new RuntimeException($m);echo "PASS $m\n";}
$root=sys_get_temp_dir().'/pao-'.bin2hex(random_bytes(8)); mkdir($root,0700); $s=new Storage($root);
function stage(string $root,string $id,int $o,string $b):void{$h='PAO1'.pack('J',$o).pack('N',strlen($b));file_put_contents("$root/$id.pending",$h.hash('sha256',$h.$b,true).$b);}
try {
$s->create('test'); $ps=[]; for($i=0;$i<64;$i++){ $p=proc_open([PHP_BINARY,__DIR__.'/worker.php',$root,(string)$i],[0=>['file','/dev/null','r'],1=>['file','/dev/null','w'],2=>STDERR],$pipes);if(!is_resource($p))throw new RuntimeException('proc_open failed');$ps[]=$p; }
$good=true;foreach($ps as $p) if(proc_close($p)!==0)$good=false;check($good,'64 independent writer processes completed');
$b=$s->read('test',0,512)['bytes']; $ids=[]; for($i=0;$i<strlen($b);$i+=8){$r=unpack('Nid/Nmagic',substr($b,$i,8));if($r['magic']!==0xAABBCCDD)throw new RuntimeException('corrupt');$ids[]=$r['id'];}sort($ids);check(strlen($b)===512&&$ids===range(0,63),'512 bytes; all 64 records unique, no interleaving');
check($s->append('test',0,substr($b,0,8))['replayed'],'position replay without duplicate');
try{$s->append('test',0,'wrong');throw new RuntimeException('accepted conflict');}catch(StorageError $e){check($e->status===409,'conflict rejected');}
try{$s->append('test',999,'wrong');throw new RuntimeException('accepted gap');}catch(StorageError $e){check($e->status===409,'gap rejected');}
foreach([0,1,15,32] as $k){$id='crash'.$k;$s->create($id);$s->append($id,0,'old');$r=random_bytes(32);stage($root,$id,3,$r);file_put_contents("$root/$id.bin",substr($r,0,$k),FILE_APPEND);check($s->head($id)['end']===35&&$s->read($id,0,35)['bytes']==='old'.$r&&!file_exists("$root/$id.pending"),"simulated interruption at $k/32 bytes recovered");}
$s->create('bad');stage($root,'bad',0,'abc');file_put_contents("$root/bad.bin",'x',FILE_APPEND);try{$s->head('bad');throw new RuntimeException('accepted corruption');}catch(StorageError $e){check($e->status===503&&file_get_contents("$root/bad.bin")==='x','corruption fail-closed, no truncation');}
$s->create('hash');stage($root,'hash',0,'abc');file_put_contents("$root/hash.pending",'x',FILE_APPEND);try{$s->head('hash');throw new RuntimeException('accepted invalid intent');}catch(StorageError $e){check($e->status===503&&filesize("$root/hash.bin")===0,'malformed intent rejected');}
check($s->read('test',8,16)['bytes']===substr($b,8,16),'byte range read');
check($s->read('test',512,16)['bytes']==='','empty EOF read');
try{$s->create('../escape');throw new RuntimeException('path traversal');}catch(StorageError $e){check($e->status===400,'path traversal rejected');}
check(file_get_contents("$root/test.bin")===$b,'historical prefix unchanged');
}finally{foreach(glob($root.'/*') as $p)unlink($p);rmdir($root);}
