<?php
declare(strict_types=1);
require_once __DIR__.'/Storage.php';
// Demo contracts. PAO remains unaware of all of this.
final class QipuDemo {
 const CAP=4194304, MAXBODY=1048576, NOTE=100, REQUEST=101, CANON=111;
 const NODES=['A','B'];
 private Storage $s;
 function __construct(private string $root){$this->s=new Storage($root);}
 static function ok(bool $v,string $m='Invalid record',int $status=422):void{if(!$v)throw new StorageError($status,$m);}
 static function json(mixed $x):string{return json_encode($x,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}
 static function frame(int $t,string $body):string{
  $n=strlen($body);self::ok($n<=self::MAXBODY,'Body too large');$k=$n<=255?1:($n<=65535?2:3);$p=pack('nC',$t,$k-1).substr(pack('N',$n),4-$k).$body;return $p.hash('sha256',"QIPU-K5B-1\0".$p,true);
 }
 static function scan(string $b):array{$r=[];$i=0;$size=strlen($b);while($i<$size){$start=$i;self::ok($size-$i>=4,'Truncated header');$t=unpack('n',substr($b,$i,2))[1];$i+=2;$k=ord($b[$i++])+1;self::ok($k<=3&&$i+$k<=$size,'Invalid length width');$n=unpack('N',str_pad(substr($b,$i,$k),4,"\0",STR_PAD_LEFT))[1];$i+=$k;self::ok($n<=self::MAXBODY&&($n<=255?1:($n<=65535?2:3))===$k&&$i+$n+32<=$size,'Invalid length or truncated body');$body=substr($b,$i,$n);$i+=$n;self::ok(hash_equals(hash('sha256',"QIPU-K5B-1\0".substr($b,$start,$i-$start),true),substr($b,$i,32)),'Hash mismatch');$i+=32;$r[]=['t'=>$t,'body'=>$body,'raw'=>substr($b,$start,$i-$start),'offset'=>$start,'end'=>$i];}return $r;}
 static function obj(string $b):array{$x=json_decode($b,true,32,JSON_THROW_ON_ERROR);self::ok(is_array($x)&&!array_is_list($x),'Object required');return $x;}
 static function keys(array $a,array $k):void{$actual=array_keys($a);sort($actual);sort($k);self::ok($actual===$k,'Invalid fields');}
 static function num(mixed $x,int $max=1000000000):int{self::ok(is_int($x)&&$x>=0&&$x<=$max,'Natural out of demo range');return $x;}
 static function txt(mixed $s,int $max=200):string{self::ok(is_string($s)&&strlen($s)>0&&strlen($s)<=$max&&preg_match('//u',$s)===1&&!str_starts_with($s,"\xEF\xBB\xBF"),'Invalid text');return $s;}
 static function sku(mixed $s):string{self::ok(is_string($s)&&preg_match('/\A[A-Z0-9_-]{1,40}\z/',$s)===1,'Invalid SKU');return $s;}
 // A named fact is a semantic assertion, never a CREATE instruction.
 static function kind(mixed $k):int{self::ok(is_int($k)&&$k>=0&&$k<=3,'Invalid parameter kind');return $k;}
 static function value(int $k,mixed $v):void{if($k===0)self::txt($v);elseif($k===3)self::ok(is_bool($v),'Boolean required');else self::num($v);}
 static function factArgs(array $x):array{
  $scope=$x['scope']??null;self::ok(in_array($scope,['table','vector','entity','cell'],true),'Invalid assertion scope');
  $keys=['op','scope','table'];if($scope==='vector'||$scope==='cell')$keys=array_merge($keys,['parameter','kind']);if($scope==='entity'||$scope==='cell')$keys[]='identity';if($scope==='cell')$keys[]='value';self::keys($x,$keys);
  $table=self::txt($x['table']);if($scope==='table')return [0,$table];if($scope==='entity')return [2,$table,self::txt($x['identity'])];
  $p=self::txt($x['parameter']);$k=self::kind($x['kind']);if($scope==='vector')return [1,$table,$p,$k];self::value($k,$x['value']);return [3,$table,self::txt($x['identity']),$p,$k,$x['value']];
 }
 static function request(array $x):array{if(($x['op']??null)==='product'){self::keys($x,['op','sku','name','price','stock']);self::sku($x['sku']);self::txt($x['name']);self::num($x['price']);self::num($x['stock']);}elseif(($x['op']??null)==='sale'){self::keys($x,['op','sku','qty']);self::sku($x['sku']);self::ok(self::num($x['qty'])>0,'Positive quantity required');}elseif(($x['op']??null)==='fact'){self::factArgs($x);}else self::ok(false,'Unknown request');return $x;}
 static function nat(int $n,int $w=4):string{self::ok($n>=0&&$n<=9007199254740991,'Natural out of range');$s=decbin($n);self::ok(strlen($s)<=2**$w,'Natural exceeds profile');return str_pad(decbin(strlen($s)-1),$w,'0',STR_PAD_LEFT).$s;}
 static function textbits(string $s):string{$b=self::nat(strlen($s),6);foreach(str_split($s) as $c)$b.=str_pad(decbin(ord($c)),8,'0',STR_PAD_LEFT);return $b;}
 static function op(int $t,array $a):string{$n=fn($x)=>self::nat($x);$v=fn($x)=>self::nat($x,6);$s=fn($x)=>self::textbits($x);
  if($t===13){$b=$n($a[0]).$s($a[1]);$b.=match($a[0]){0=>'',1=>$s($a[2]).$n($a[3]),2=>$s($a[2]),3=>$s($a[2]).$s($a[3]).$n($a[4]).match($a[4]){0=>$s($a[5]),1,2=>$v($a[5]),3=>$n((int)$a[5]),default=>throw new StorageError(422,'Invalid kind')},default=>throw new StorageError(422,'Invalid scope')};}
  else $b=match($t){4=>$n($a[0]).$n($a[1]).$n($a[2]).$s($a[3]),5,6,8,12=>$n($a[0]).$n($a[1]).$n($a[2]).$v($a[3]),9,10=>$n($a[0]).$n($a[1]).$n($a[2]),11=>$n($a[0]).$n($a[1]).$n($a[2]).$n((int)$a[3]),7=>$n($a[0]).$n($a[1]).$n(count($a[2])).implode('',array_map(fn($l)=>$n($l[0]).$v($l[1]).$v($l[2]),$a[2])),default=>throw new StorageError(422,'Unsupported contract')};$b=str_pad($b,(int)ceil(strlen($b)/8)*8,'0');return self::frame($t,implode('',array_map(fn($x)=>chr(bindec($x)),str_split($b,8))));}
 static function decodeOp(string $raw):array{$rs=self::scan($raw);self::ok(count($rs)===1,'One contract frame required');$r=$rs[0];$b='';foreach(str_split($r['body']) as $c)$b.=str_pad(decbin(ord($c)),8,'0',STR_PAD_LEFT);$p=0;
  $take=function(int $k)use(&$p,$b){self::ok($p+$k<=strlen($b),'Truncated K2P');$x=substr($b,$p,$k);$p+=$k;return $x;};
  $n=function(int $w=4)use($take){$k=bindec($take($w))+1;self::ok($k<=53,'K2P range');$s=$take($k);self::ok($k===1||$s[0]==='1','Noncanonical K2P');return (int)bindec($s);};
  $s=function()use($n,$take){$k=$n(6);self::ok($k<=1000,'Text limit');$s='';for($i=0;$i<$k;$i++)$s.=chr(bindec($take(8)));return self::txt($s,1000);};
  $bool=function()use($n){$x=$n();self::ok($x<=1,'Boolean required');return (bool)$x;};
  $t=$r['t'];switch($t){case 13:$scope=$n();$a=[$scope,$s()];switch($scope){case 0:break;case 1:$a[]=$s();$a[]=self::kind($n());break;case 2:$a[]=$s();break;case 3:$a[]=$s();$a[]=$s();$k=self::kind($n());$a[]=$k;$a[]=match($k){0=>$s(),1,2=>$n(6),3=>$bool()};break;default:throw new StorageError(422,'Unknown scope');}break;
  case 4:$a=[$n(),$n(),$n(),$s()];break;case 5:case 6:case 8:case 12:$a=[$n(),$n(),$n(),$n(6)];break;case 9:case 10:$a=[$n(),$n(),$n()];break;case 11:$a=[$n(),$n(),$n(),$bool()];break;case 7:$a=[$n(),$n(),[]];$count=$n();self::ok($count>0&&$count<=1000,'Sale count');for($i=0;$i<$count;$i++)$a[2][]=[$n(),$n(6),$n(6)];break;default:throw new StorageError(422,'Unknown inner contract');}
  self::ok(strlen($b)-$p<8&&trim(substr($b,$p),'0')==='','Invalid padding');return [$t,$a];
 }
 // Derived indexes are not written to C. Prefix ':' prevents PHP numeric-key coercion.
 static function indexes(array $d):array{$ix=['tables'=>[],'vectors'=>[],'entities'=>[]];foreach($d as $t=>$tab){$ix['tables'][':'.$tab['name']]=$t;foreach($tab['vectors'] as $v=>$x)$ix['vectors'][$t][':'.$x['name']]=$v;foreach($tab['entities'] as $i=>$x)$ix['entities'][$t][':'.$x]=$i;}return $ix;}
 static function apply(array &$d,int $t,array $a,?array &$ix=null):void{
  if($ix===null)$ix=self::indexes($d);
  if($t===13){$scope=$a[0];$name=self::txt($a[1]);self::ok(in_array($scope,[0,1,2,3],true),'Invalid scope');
   // Validate all named fields and existing parameter type before mutating any derived structure.
   $e=null;$p=null;$k=null;if($scope===2||$scope===3)$e=self::txt($a[2]);if($scope===1){$p=self::txt($a[2]);$k=self::kind($a[3]);}if($scope===3){$p=self::txt($a[3]);$k=self::kind($a[4]);self::value($k,$a[5]);}
   $ti=$ix['tables'][':'.$name]??count($d);self::ok($ti<65536,'Table capacity');$tab=$d[$ti]??['entities'=>[],'vectors'=>[]];
   $ei=$e===null?null:($ix['entities'][$ti][':'.$e]??count($tab['entities']));$vi=$p===null?null:($ix['vectors'][$ti][':'.$p]??count($tab['vectors']));self::ok(($ei===null||$ei<65536)&&($vi===null||$vi<65536),'Identity capacity');if($vi!==null&&isset($tab['vectors'][$vi]))self::ok($tab['vectors'][$vi]['kind']===$k,'Incompatible parameter kind',409);
   if(!isset($d[$ti])){$d[]=['name'=>$name,'entities'=>[],'vectors'=>[],'sales'=>[]];$ix['tables'][':'.$name]=$ti;}
   if($ei!==null&&!isset($d[$ti]['entities'][$ei])){$d[$ti]['entities'][]=$e;$ix['entities'][$ti][':'.$e]=$ei;}
   if($vi!==null&&!isset($d[$ti]['vectors'][$vi])){$d[$ti]['vectors'][]=['name'=>$p,'kind'=>$k,'values'=>[]];$ix['vectors'][$ti][':'.$p]=$vi;}
   if($scope===3)$d[$ti]['vectors'][$vi]['values'][$ei]=$a[5];return;
  }
  self::ok(isset($d[$a[0]]),'Missing table');$tab=&$d[$a[0]];self::ok(isset($tab['vectors'][$a[1]]),'Missing vector');$v=&$tab['vectors'][$a[1]];
  if($t===7){self::ok($v['kind']===2,'Stock vector required');$next=$v['values'];$total=0;foreach($a[2] as [$i,$q,$p]){self::ok(isset($next[$i])&&is_int($next[$i])&&$q>0&&$next[$i]>=$q,'Insufficient stock',409);$next[$i]-=$q;$total+=$q*$p;self::ok(is_int($total)&&$total<=9007199254740991,'Sale total overflow');}$v['values']=$next;$tab['sales'][]=['lines'=>$a[2],'total'=>$total];return;}
  self::ok(isset($tab['entities'][$a[2]]),'Missing entity');$i=$a[2];if($t===9||$t===10){self::ok($v['kind']!==2,'Stock requires explicit natural');if($t===9)$v['values'][$i]=null;else unset($v['values'][$i]);return;}
  $expected=[4=>0,5=>2,6=>2,8=>1,11=>3,12=>2][$t]??-1;self::ok($v['kind']===$expected,'Invalid cell');$x=$a[3];self::value($expected,$x);if($t===6||$t===12){self::ok(isset($v['values'][$i])&&is_int($v['values'][$i]),'Missing stock');$x=$v['values'][$i]+($t===6?$x:-$x);self::num($x);} $v['values'][$i]=$x;
 }
 static function productOps(array $q):array{return [[13,[3,'Producto',$q['sku'],'Nombre',0,$q['name']]],[13,[3,'Producto',$q['sku'],'Precio',1,$q['price']]],[13,[3,'Producto',$q['sku'],'Stock',2,$q['stock']]]];}
 static function genesis():array{return self::productOps(['sku'=>'SKU-A','name'=>'Camisa','price'=>35000,'stock'=>20]);}
 static function resolve(array $d,array $q):array{if($q['op']==='fact')return [[13,self::factArgs($q)]];if($q['op']==='product')return self::productOps($q);$ix=self::indexes($d);$t=$ix['tables'][':Producto']??null;self::ok($t!==null,'Product type not constituted',409);$i=$ix['entities'][$t][':'.$q['sku']]??null;$v=$ix['vectors'][$t][':Stock']??null;$p=$ix['vectors'][$t][':Precio']??null;self::ok($i!==null&&$v!==null&&$p!==null&&$d[$t]['vectors'][$p]['kind']===1&&isset($d[$t]['vectors'][$p]['values'][$i]),'SKU or price not constituted',409);return [[7,[$t,$v,[[$i,$q['qty'],$d[$t]['vectors'][$p]['values'][$i]]]]]];}
 // Export cells as objects, including empty cells, to preserve sparse slots and null vs absent.
 static function view(array $d):array{foreach($d as &$t)foreach($t['vectors'] as &$v)$v['values']=(object)$v['values'];unset($t,$v);return $d;}
 static function canonical(?array $origin,array $ops):string{return self::frame(self::CANON,self::json(['origin'=>$origin,'frames'=>array_map(fn($x)=>base64_encode(self::op($x[0],$x[1])),$ops)]));}
 static function replay(string $b):array{$d=[];$ix=self::indexes($d);$seen=[];$records=self::scan($b);foreach($records as $i=>$r){self::ok($r['t']===self::CANON,'Invalid canonical type');$x=self::obj($r['body']);self::keys($x,['origin','frames']);self::ok(is_array($x['frames'])&&array_is_list($x['frames'])&&count($x['frames'])>0,'Empty canonical batch');$ops=[];foreach($x['frames'] as $f){self::ok(is_string($f),'Invalid inner frame');$bytes=base64_decode($f,true);self::ok($bytes!==false,'Invalid base64');$ops[]=self::decodeOp($bytes);}if($i===0){self::ok($x['origin']===null&&$ops===self::genesis(),'Invalid genesis');}else{$o=$x['origin'];self::ok(is_array($o),'Missing origin');self::keys($o,['node','index']);self::ok(in_array($o['node'],self::NODES,true),'Invalid origin');self::num($o['index']);$key=$o['node'].':'.$o['index'];self::ok(!isset($seen[$key]),'Duplicate recognition');$seen[$key]=['record'=>$i,'ops'=>$ops,'before'=>$d];}foreach($ops as [$t,$a])self::apply($d,$t,$a,$ix);}return ['state'=>$d,'origins'=>$seen,'records'=>count($records)];}
 static function decisionByte(int $i,int $bit):string{return chr(128*$bit+$i%128);}
 private function init():void{foreach(['C','QA','QB','RA','RB'] as $id){try{$this->s->head($id);}catch(StorageError $e){if($e->status!==404)throw $e;$this->s->create($id);}}if($this->s->head('C')['end']===0)$this->s->append('C',0,self::canonical(null,self::genesis()));}
 function locked(callable $f):mixed{$l=fopen($this->root.'/authority.lock','c+b');if(!$l)throw new StorageError(503,'Authority lock unavailable');try{self::ok(flock($l,LOCK_EX),'Authority lock unavailable',503);$this->init();return $f();}finally{fclose($l);}}
 private function all(string $id):string{$n=$this->s->head($id)['end'];self::ok($n<=self::CAP,'Demo stream limit reached',503);return $this->s->read($id,0,$n)['bytes'];}
 private function write(string $id,int $o,string $b):array{self::ok($o+strlen($b)<=self::CAP,'Demo stream limit',413);return $this->s->append($id,$o,$b);}
 static function stream(string $s):string{self::ok(in_array($s,['C','QA','QB','RA','RB'],true),'Invalid stream',400);return $s;}
 function cut(string $id,?int $o=null):array{$b=$this->all(self::stream($id));$n=strlen($b);$o??=$n;self::ok($o>=0&&$o<=$n,'Beyond end',416);return ['end'=>$n,'offset'=>$o,'sha256'=>hash('sha256',substr($b,0,$o))];}
 function read(string $id,int $o,int $n):array{return $this->s->read(self::stream($id),$o,min($n,self::CAP));}
 function submit(string $node,int $index,int $o,string $raw):array{self::replay($this->all('C'));self::ok(in_array($node,self::NODES,true),'Invalid node',400);$r=self::scan($raw);self::ok(count($r)===1&&$r[0]['t']===self::REQUEST,'One request frame required');self::request(self::obj($r[0]['body']));$q=$this->all('Q'.$node);$rs=self::scan($q);$n=count($rs);self::ok($index<=$n,'Request gap',409);$expected=$index===$n?strlen($q):$rs[$index]['offset'];self::ok($o===$expected,'Request offset mismatch',409);if($index<$n)self::ok($rs[$index]['raw']===$raw,'Request conflict',409);return $this->write('Q'.$node,$o,$raw);}
 private function snapshot(bool $recover=true):array{$c=self::replay($this->all('C'));$q=[];$r=[];foreach(self::NODES as $j){$q[$j]=self::scan($this->all('Q'.$j));foreach($q[$j] as &$rec){self::ok($rec['t']===self::REQUEST,'Invalid Q type');$rec['request']=self::request(self::obj($rec['body']));}unset($rec);$r[$j]=$this->all('R'.$j);self::ok(strlen($r[$j])<=count($q[$j]),'Response ahead of requests');for($i=0;$i<strlen($r[$j]);$i++){ $b=ord($r[$j][$i]);self::ok(($b%128)===$i%128,'Response marker mismatch');self::ok(($b>=128)===isset($c['origins'][$j.':'.$i]),'Recognition mismatch');}}
  foreach($c['origins'] as $key=>$origin){[$j,$i]=explode(':',$key);$i=(int)$i;self::ok(isset($q[$j][$i]),'Origin without request');self::ok(self::resolve($origin['before'],$q[$j][$i]['request'])===$origin['ops'],'Canonical effect differs from request');if($i>=strlen($r[$j])){self::ok($i===strlen($r[$j]),'Recognition gap');if($recover){$b=self::decisionByte($i,1);$this->write('R'.$j,$i,$b);$r[$j].=$b;}}}return ['c'=>$c,'q'=>$q,'r'=>$r];}
 function pending():array{$z=$this->snapshot();$out=[];foreach(self::NODES as $j){$i=strlen($z['r'][$j]);$out[$j]=['requests'=>count($z['q'][$j]),'responses'=>$i,'next'=>$z['q'][$j][$i]['request']??null,'nextIndex'=>$i];}return ['nodes'=>$out,'canonical'=>self::view($z['c']['state']),'records'=>$z['c']['records']];}
 function decide(string $j,int $i,int $bit,bool $interrupt=false):array{self::ok(in_array($j,self::NODES,true)&&in_array($bit,[0,1],true),'Invalid decision',400);$z=$this->snapshot();$n=strlen($z['r'][$j]);if($i<$n){self::ok(ord($z['r'][$j][$i])===ord(self::decisionByte($i,$bit)),'Decision immutable',409);return ['status'=>'replayed'];}self::ok($i===$n&&isset($z['q'][$j][$i]),'Not next pending request',409);if($bit){$ops=self::resolve($z['c']['state'],$z['q'][$j][$i]['request']);$d=$z['c']['state'];$ix=self::indexes($d);foreach($ops as [$t,$a])self::apply($d,$t,$a,$ix);$o=$this->s->head('C')['end'];$this->write('C',$o,self::canonical(['node'=>$j,'index'=>$i],$ops));if($interrupt)throw new RuntimeException('Simulated interruption after C');}$this->write('R'.$j,$i,self::decisionByte($i,$bit));return ['status'=>'constituted'];}
}
