<?php
require __DIR__.'/../../src/Storage.php';
$s=new Storage($argv[1]); $i=(int)$argv[2]; $b=pack('N2',$i,0xAABBCCDD);
for($j=0;$j<500;$j++) { $o=$s->head('test')['end']; try { $s->append('test',$o,$b); exit(0); } catch(StorageError $e){if($e->status!==409) throw $e; usleep(random_int(100,3000));} }
exit(1);
