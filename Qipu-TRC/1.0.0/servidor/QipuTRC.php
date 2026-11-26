<?php
declare(strict_types=1);
/* Qipu TRC 1.0.0 — perfil estructural A, K5B sin cambios. PHP >= 8.1, 64 bits. */
final class TRC {
 const MAX=9007199254740991, BODY=1048576, TYPE=65520;
 static function need(bool $ok,string $m='Solicitud inválida'):void{if(!$ok)throw new RuntimeException($m);}
 static function nat(mixed $x):bool{return is_int($x)&&$x>=0&&$x<=self::MAX;}
 static function ar(mixed $x,int $n):array{self::need(is_array($x)&&array_is_list($x)&&count($x)===$n,'Aridad inválida');return $x;}
 static function route(mixed $r):array{self::need(is_array($r)&&array_is_list($r),'Ruta inválida');foreach($r as $p)self::need(self::nat($p),'Ruta inválida');return $r;}
 static function check(mixed $x,int $d=0):void{
  self::need($d<=64,'Contenido demasiado profundo');
  if($x===null||is_bool($x)||is_int($x)&&$x>=-self::MAX&&$x<=self::MAX)return;
  if(is_string($x)){self::need(preg_match('//u',$x)===1,'Unicode inválido');return;}
  if(is_array($x)){self::need(array_is_list($x),'Lista inválida');foreach($x as $v)self::check($v,$d+1);return;}
  self::need($x instanceof stdClass,'JSON inválido');foreach($x as $k=>$v){self::check((string)$k,$d+1);self::check($v,$d+1);}
 }
 static function name(mixed $x):bool{if(!is_string($x)||$x===''||preg_match('//u',$x)!==1)return false;return preg_match_all('/./us',$x)+preg_match_all('/[\x{10000}-\x{10FFFF}]/u',$x)<=200;}
 static function jsOrder(mixed $x):mixed{
  if(is_array($x))return array_map([self::class,'jsOrder'],$x);
  if(!($x instanceof stdClass))return $x;
  $num=[];$rest=[];foreach($x as $k=>$v){$k=(string)$k;if(preg_match('/^(0|[1-9][0-9]{0,9})$/D',$k)&&strlen($k)<=10&&(float)$k<4294967295)$num[$k]=$v;else $rest[$k]=$v;}
  ksort($num,SORT_NUMERIC);$o=new stdClass;foreach([$num,$rest] as $a)foreach($a as $k=>$v)$o->{(string)$k}=self::jsOrder($v);return $o;
 }
 static function json(mixed $x):string{return json_encode(self::jsOrder($x),JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_LINE_TERMINATORS);}
 static function normalize(mixed $x):mixed{if(is_float($x)&&is_finite($x)&&floor($x)===$x&&abs($x)<=self::MAX)return (int)$x;if(is_array($x))return array_map([self::class,'normalize'],$x);if($x instanceof stdClass){foreach($x as $k=>$v)$x->{$k}=self::normalize($v);}return $x;}
 static function parse(string $s):mixed{$x=self::normalize(json_decode($s,false,512,JSON_THROW_ON_ERROR));self::check($x);return $x;}
 static function eq(mixed $a,mixed $b):bool{return self::json($a)===self::json($b);}
 static function unhex(mixed $x):string{self::need(is_string($x)&&strlen($x)%2===0&&preg_match('/^[0-9a-f]*$/D',$x)===1,'Hex canónico requerido');return hex2bin($x);}
 static function encode(array $e):string{
  self::check($e);$b=self::json($e);$n=strlen($b);self::need($n<=self::BODY,'Longitud fuera de límite');$k=$n<=255?1:($n<=65535?2:3);
  $p=pack('nC',self::TYPE,$k-1).substr(pack('N',$n),4-$k).$b;return $p.hash('sha256',"QIPU-K5B-1\0".$p,true);
 }
 static function frame(string $raw,int $o=0):array{
  self::need($o>=0&&$o+4<=strlen($raw),'Encabezado truncado');$type=unpack('n',substr($raw,$o,2))[1];self::need($type===self::TYPE,'TRC-A requiere tratamiento 65520');$k=ord($raw[$o+2])+1;
  self::need($k<=3&&$o+3+$k<=strlen($raw),'Longitud inválida');$n=0;for($j=0;$j<$k;$j++)$n=($n<<8)|ord($raw[$o+3+$j]);self::need($n<=self::BODY&&$k===($n<=255?1:($n<=65535?2:3)),'Longitud no canónica');$p=$o+3+$k;$end=$p+$n+32;self::need($end<=strlen($raw),'Registro truncado');
  self::need(hash_equals(hash('sha256',"QIPU-K5B-1\0".substr($raw,$o,$end-$o-32),true),substr($raw,$end-32,32)),'Hash no coincide');$body=substr($raw,$p,$n);$e=self::parse($body);self::need(self::json($e)===$body,'JSON de marco no canónico');return [$e,$end,substr($raw,$o,$end-$o)];
 }
 static function verify(mixed $e,bool $root=true):void{
  [$op,$r,$x]=self::ar($e,3);self::route($r);self::need(in_array($op,['TABLE','COL','ID','ITEM','OPEN','SET','ADD','SUB','MOUNT','APPEND','TX'],true),'Tratamiento fuera de TRC-A');
  if($op==='MOUNT'){[$p,$h]=self::ar($x,2);self::need($p==='A','TRC utiliza perfil A');self::validate(self::unhex($h),false);}
  if($op==='APPEND')self::validate(self::unhex($x),false);
  if($op==='TX'){self::need($root,'TX solo raíz');[,,$events]=self::ar($x,3);self::need(is_array($events),'TX inválida');foreach($events as $q)self::verify($q,false);}
 }
 static function validate(string $raw,bool $root=true):void{for($o=0;$o<strlen($raw);$o=$end){[$e,$end]=self::frame($raw,$o);self::verify($e,$root);}}
}
final class TRCWorld {
 private array $scopes=[], $receipts=[];
 private int $next=1;
 function __construct(){$this->init(0);}
 private function init(int $id):void{$this->scopes[$id]=['seq'=>1,'counts'=>[0=>0],'names'=>[],'pos'=>[],'slots'=>[],'records'=>[],'cuts'=>[],'root'=>['kind'=>'root','id'=>0,'axis'=>0]];}
 private function countAxis(int $s,int $a):int{TRC::need(isset($this->scopes[$s]['counts'][$a]),'Eje inexistente');return $this->scopes[$s]['counts'][$a];}
 private function alloc(int $s):int{return $this->scopes[$s]['seq']++;}
 private function axis(int $s):int{$a=$this->alloc($s);$this->scopes[$s]['counts'][$a]=0;return $a;}
 private function node(int $s,string $kind,int $axis,?int $rows=null):array{$n=['kind'=>$kind,'id'=>$this->alloc($s),'axis'=>$axis];if($rows!==null)$n['rows']=$rows;return $n;}
 private function table(int $s):array{$a=$this->axis($s);$b=$this->axis($s);return $this->node($s,'table',$a,$b);}
 private function vector(int $s):array{return $this->node($s,'vector',$this->axis($s));}
 private function introduce(int $s,int $a,mixed $name):int{
  TRC::need(TRC::name($name),'Nombre inválido');$key='n:'.$name;if(isset($this->scopes[$s]['pos'][$a][$key]))return $this->scopes[$s]['pos'][$a][$key];
  $i=$this->countAxis($s,$a);TRC::need($i<65536,'Capacidad de eje');$this->scopes[$s]['names'][$a][$i]=$name;$this->scopes[$s]['pos'][$a][$key]=$i;$this->scopes[$s]['counts'][$a]=$i+1;return $i;
 }
 private function slot(int $s,int $id,int $i):?array{return $this->scopes[$s]['slots'][$id][$i]??null;}
 private function put(int $s,array $parent,int $i,array $n):void{$this->scopes[$s]['slots'][$parent['id']][$i]=$n;}
 private function locate(int $s,array $r):array{
  $n=$this->scopes[$s]['root'];$parent=null;$i=null;
  foreach(TRC::route($r) as $p){TRC::need($n!==null&&!in_array($n['kind'],['value','trajectory'],true),'Contenido terminal, ausente o frontera');TRC::need($p<$this->countAxis($s,$n['axis']),'Posición inexistente');$parent=$n;$i=$p;$n=$this->slot($s,$parent['id'],$p);}
  return [$n,$parent,$i];
 }
 private function cell(?array $parent):bool{return $parent!==null&&in_array($parent['kind'],['column','vector'],true);}
 private function local(int $s,array $e):void{
  [$op,$r,$x]=TRC::ar($e,3);[$n,$parent,$i]=$this->locate($s,$r);$kind=$n['kind']??null;
  switch($op){
   case 'TABLE':TRC::need($kind==='root','TABLE exige raíz');$j=$this->introduce($s,$n['axis'],$x);if($this->slot($s,$n['id'],$j)===null)$this->put($s,$n,$j,$this->table($s));return;
   case 'COL':TRC::need($kind==='table','COL exige tabla');$j=$this->introduce($s,$n['axis'],$x);if($this->slot($s,$n['id'],$j)===null)$this->put($s,$n,$j,$this->node($s,'column',$n['rows']));return;
   case 'ID':TRC::need($kind==='table','ID exige tabla');$this->introduce($s,$n['rows'],$x);return;
   case 'ITEM':TRC::need($kind==='vector','ITEM exige vector');$this->introduce($s,$n['axis'],$x);return;
   case 'OPEN':TRC::need($this->cell($parent)&&in_array($x,['table','vector'],true),'OPEN exige celda y clase');TRC::need($n===null||$kind===$x,'Clase incompatible');if($n===null)$this->put($s,$parent,$i,$x==='table'?$this->table($s):$this->vector($s));return;
   case 'SET':TRC::need($this->cell($parent)&&($n===null||$kind==='value'),'SET exige celda terminal');$this->put($s,$parent,$i,['kind'=>'value','value'=>$x]);return;
   case 'ADD':case 'SUB':TRC::need($this->cell($parent)&&$kind==='value'&&TRC::nat($n['value'])&&TRC::nat($x),'Diferencial requiere natural existente');$v=$n['value']+($op==='ADD'?$x:-$x);TRC::need(TRC::nat($v),'Natural fuera de dominio');$this->put($s,$parent,$i,['kind'=>'value','value'=>$v]);return;
   default:throw new RuntimeException('Tratamiento inválido');
  }
 }
 private function effect(int $s,array $e,int $cut,bool $allowTx=false,?string $raw=null):void{
  [$op,$r,$x]=TRC::ar($e,3);
  if($op==='TX'){
   TRC::need($allowTx&&$s===0&&$r===[],'TX solo raíz');[$origin,$checks,$events]=TRC::ar($x,3);
   TRC::need(TRC::name($origin)&&is_array($checks)&&is_array($events)&&count($events)>0,'TX inválida');$key='o:'.$origin;TRC::need(!isset($this->receipts[$key]),'Origen ya reconocido');
   foreach($checks as $c){[$p,$expected]=TRC::ar($c,2);TRC::need(TRC::eq($this->read($p)['data'],$expected),'PRECONDICION_NO_CUMPLIDA');}
   foreach($events as $q)$this->effect($s,$q,$cut);
   $this->receipts[$key]=['cut'=>$cut,'raw'=>$raw];return;
  }
  if($op==='MOUNT'){[$p,$hex]=TRC::ar($x,2);TRC::need($p==='A','TRC utiliza perfil A');[$n,$parent,$i]=$this->locate($s,$r);TRC::need($n===null&&$this->cell($parent),'Montaje exige celda ausente');$child=$this->next++;$this->put($s,$parent,$i,['kind'=>'trajectory','id'=>$child,'profile'=>'A']);$this->init($child);$this->fold($child,TRC::unhex($hex),$cut);return;}
  if($op==='APPEND'){[$n]=$this->locate($s,$r);TRC::need(($n['kind']??null)==='trajectory','APPEND exige trayectoria');$b=TRC::unhex($x);TRC::need($b!=='','Sufijo vacío');$this->fold($n['id'],$b,$cut);return;}
  $this->local($s,$e);
 }
 private function fold(int $s,string $bytes,int $cut,bool $allowTx=false):void{
  for($o=0;$o<strlen($bytes);$o=$end){[$e,$end,$raw]=TRC::frame($bytes,$o);$this->effect($s,$e,$cut,$allowTx,$raw);$this->scopes[$s]['records'][]=$raw;$this->scopes[$s]['cuts'][]=$cut;}
 }
 function append(string $bytes,bool $strict=false):mixed{
  [$e,$end]=TRC::frame($bytes);TRC::need($end===strlen($bytes),'Un acontecimiento exterior por append');TRC::verify($e);
  if($e[0]==='TX'){[,,$x]=$e;[$origin]=TRC::ar($x,3);TRC::need(TRC::name($origin),'Origen inválido');$key='o:'.$origin;if(isset($this->receipts[$key])){$old=$this->receipts[$key];TRC::need(!$strict,'Origen repetido físicamente en replay');TRC::need(hash_equals($old['raw'],$bytes),'CONFLICTO_ORIGEN');return ['cut'=>$old['cut'],'replayed'=>true];}}
  $v=clone $this;$cut=$this->cut()+1;$v->fold(0,$bytes,$cut,true);$this->scopes=$v->scopes;$this->receipts=$v->receipts;$this->next=$v->next;return $e[0]==='TX'?['cut'=>$cut,'replayed'=>false]:$cut;
 }
 function submit(array $e):mixed{TRC::check($e);return $this->append(TRC::encode($e));}
 private function navigate(array $r,bool $enterFinal=true):array{
  TRC::route($r);$s=0;$n=$this->scopes[$s]['root'];$path=[];$bounds=[];$seen=[];$steps=0;
  $access=function(array $key)use(&$seen,&$steps){$seen[TRC::json($key)]=true;$steps++;};$access([$s,'root']);
  $enter=function()use(&$s,&$n,&$path,&$bounds,$access){while(($n['kind']??null)==='trajectory'){$bounds[]=['scope'=>$s,'path'=>$path,'child'=>$n['id'],'profile'=>'A'];$s=$n['id'];$path=[];$access([$s,'root']);$n=$this->scopes[$s]['root'];}};
  foreach($r as $p){$enter();TRC::need($n!==null&&$n['kind']!=='value','Ruta terminal o ausente');$access([$s,'count',$n['axis']]);TRC::need($p<$this->countAxis($s,$n['axis']),'Posición inexistente');$access([$s,'slot',$n['id'],$p]);$n=$this->slot($s,$n['id'],$p);$path[]=$p;}
  if($enterFinal)$enter();return [$s,$n,$path,$bounds,$seen,$steps];
 }
 function read(array $r=[],bool $enterFinal=true):array{
  [$s,$n,$path,$bounds,$seen,$steps]=$this->navigate($r,$enterFinal);
  if($n===null)$data=['absent'];elseif($n['kind']==='value')$data=['value',$n['value']];elseif($n['kind']==='trajectory')$data=['trajectory','A',$n['id']];else{$a=$n['axis'];$seen[TRC::json([$s,'count',$a])]=true;$steps++;$xs=[];for($i=0;$i<$this->countAxis($s,$a);$i++){$seen[TRC::json([$s,'name',$a,$i])]=true;$steps++;$xs[]=[$i,$this->scopes[$s]['names'][$a][$i]];}$data=['context',$xs];}
  return ['data'=>$data,'scope'=>$s,'localPath'=>$path,'boundaries'=>$bounds,'reads'=>count($seen),'steps'=>$steps,'cut'=>$this->cut()];
 }
 function recognized(mixed $origin,array $checks,string $op,array $r,mixed $x):mixed{
  TRC::need(in_array($op,['TABLE','COL','ID','ITEM','OPEN','SET','ADD','SUB','MOUNT'],true),'Tratamiento inválido');[$s,,$path,$bounds]=$this->navigate($r,$op!=='MOUNT');
  $e=[$op,$path,$x];TRC::verify($e,false);$raw=TRC::encode($e);for($i=count($bounds)-1;$i>=0;$i--){$e=['APPEND',$bounds[$i]['path'],bin2hex($raw)];$raw=TRC::encode($e);}return $this->submit(['TX',[],[$origin,$checks,[$e]]]);
 }
 function cut(int $s=0):int{TRC::need(isset($this->scopes[$s]),'Trayectoria desconocida');return count($this->scopes[$s]['records']);}
 function export(int $s=0,?int $end=null):string{$n=$this->cut($s);$end??=$n;TRC::need(TRC::nat($end)&&$end<=$n,'Corte fuera de rango');return implode('',array_slice($this->scopes[$s]['records'],0,$end));}
 private function scope(array $r):int{if($r===[])return 0;[, $n]=$this->navigate($r,false);TRC::need(($n['kind']??null)==='trajectory','Ruta no constituye trayectoria');return $n['id'];}
 function history(array $r=[],int $from=0,?int $to=null):array{$id=$this->scope($r);$n=$this->cut($id);$to??=$n;TRC::need($from>=0&&$from<=$to&&$to<=$n,'Rango histórico inválido');$records=[];for($i=$from;$i<$to;$i++){$raw=$this->scopes[$id]['records'][$i];[$e]=TRC::frame($raw);$records[]=['position'=>$i,'rootCut'=>$this->scopes[$id]['cuts'][$i],'event'=>$e,'hex'=>bin2hex($raw)];}return ['scope'=>$id,'profile'=>'A','cut'=>$n,'rootCut'=>$this->cut(),'from'=>$from,'to'=>$to,'records'=>$records];}
 static function replay(string $raw):self{$w=new self;for($o=0;$o<strlen($raw);$o=$end){[,$end,$b]=TRC::frame($raw,$o);$w->append($b,true);}return $w;}
 function execute(stdClass $q):mixed{
  TRC::check($q);$r=TRC::route($q->route??[]);$op=$q->op??'';if(in_array($op,['read','history','export'],true)&&isset($q->cut)){TRC::need(TRC::nat($q->cut),'Corte inválido');$w=self::replay($this->export(0,$q->cut));$qq=clone $q;unset($qq->cut);return $w->execute($qq);}
  return match($op){
   'write'=>$this->recognized($q->origin??null,$q->checks??[],$q->treatment??'',$r,property_exists($q,'content')?$q->content:throw new RuntimeException('Contenido requerido')),
   'submit'=>$this->submit($q->event??[]),
   'transaction'=>$this->submit(['TX',[],[$q->origin??null,$q->checks??[],$q->events??[]]]),
   'read'=>$this->read($r,($q->enterFinal??true)!==false),
   'history'=>$this->history($r,$q->from??0,$q->to??null),
   'export'=>['hex'=>bin2hex($this->export($this->scope($r),$q->end??null)),'cut'=>$this->cut($this->scope($r))],
   'cut'=>['cut'=>$this->cut()],
   default=>throw new RuntimeException('Operación desconocida')
  };
 }
 static function plan(string $raw,stdClass $q):array{$w=self::replay($raw);$before=$w->cut();$result=$w->execute($q);$all=$w->export();TRC::need($w->cut()===$before||$w->cut()===$before+1,'Un marco raíz por solicitud');TRC::need(str_starts_with($all,$raw),'Prefijo alterado');return ['result'=>$result,'cut'=>$w->cut(),'suffix'=>substr($all,strlen($raw))];}
}
