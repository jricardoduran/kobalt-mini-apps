<?php
declare(strict_types=1);
require_once __DIR__.'/Kernel.php';
final class ATMGeometry {
    function __construct(private array $s){}
    private function get(...$k):mixed{return Motor::get($this->s,...$k);}
    private function schema():array{return $this->get('schema')??['types'=>[],'fields'=>[],'actions'=>[]];}
    private static function need(bool $x,string $m):void{QipuDemo::ok($x,$m);}
    private static function arr(mixed $x,int $n):array{self::need(is_array($x)&&array_is_list($x)&&count($x)===$n,'Aridad inválida');return $x;}
    private function table(mixed $t):string{
        if(is_string($t)){self::need(in_array($t,$this->schema()['types'],true),'Tipo no declarado');return $t;}
        self::need(is_int($t)&&$t>=0,'Tabla inválida');$x=$this->get('table',$t);self::need($x!==null,'Tabla no constituida');return $x['name'];
    }
    private function entity(string $t,mixed $i):string{
        if(is_string($i))return Motor::text($i);
        self::need(is_int($i)&&$i>=0,'Entidad inválida');$x=$this->get('entity',$this->get('tableName',$t),$i);self::need($x!==null,'Entidad no constituida');return $x;
    }
    private function field(string $t,mixed $v):string{
        if(is_string($v)){foreach($this->schema()['fields'] as $f)if($f['table']===$t&&$f['name']===$v)return $v;throw new StorageError(422,'Parámetro no declarado');}
        self::need(is_int($v)&&$v>=0,'Vector inválido');$x=$this->get('vector',$this->get('tableName',$t),$v);self::need($x!==null,'Vector no constituido');return $x['name'];
    }
    private function action(mixed $a):array{
        $as=$this->schema()['actions'];if(is_string($a)){foreach($as as $x)if($x['name']===$a)return $x;}elseif(is_int($a)&&$a>=0&&isset($as[$a]))return $as[$a];throw new StorageError(422,'Acción no declarada');
    }
    function meta():array{
        $c=$this->schema();$types=[];$actions=[];
        foreach($c['types'] as $t){$p=$this->get('tableName',$t);$m=$this->get('table',$p);$ids=[];$fs=[];
            for($i=0;$i<($m['entities']??0);$i++)$ids[]=$this->get('entity',$p,$i);
            foreach($c['fields'] as $f)if($f['table']===$t)$fs[]=['nombre'=>$f['name'],'pos'=>$this->get('vectorName',$p,$f['name']),'dominio'=>$f['domain'],'operaciones'=>$f['allow'],'constitutivo'=>$f['constitutive']];
            usort($fs,fn($a,$b)=>($a['pos']??PHP_INT_MAX)<=>($b['pos']??PHP_INT_MAX));$types[]=['nombre'=>$t,'pos'=>$p,'entidades'=>$ids,'parametros'=>$fs];
        }
        foreach($c['actions'] as $i=>$a)$actions[]=['pos'=>$i]+$a;return ['tipos'=>$types,'acciones'=>$actions];
    }
    function read(array $path=[]):mixed{
        self::need(array_is_list($path)&&count($path)<=3,'Ruta inválida');if(!$path)return $this->meta();
        $t=$this->table($path[0]);$p=$this->get('tableName',$t);$m=$this->get('table',$p);
        if(count($path)===1){foreach($this->meta()['tipos'] as $x)if($x['nombre']===$t)return $x;}
        self::need($m!==null,'Tabla no constituida');$vp=function($v)use($t,$p){$x=$this->get('vectorName',$p,$this->field($t,$v));self::need($x!==null,'Vector no constituido');return $x;};$out=[];
        if(count($path)===3&&$path[1]===null){$v=$vp($path[2]);for($i=0;$i<$m['entities'];$i++){$x=$this->get('cell',$p,$v,$i);if($x!==null)$out[]=[$i,$x];}return $out;}
        $i=$this->get('entityName',$p,$this->entity($t,$path[1]));self::need($i!==null,'Entidad no constituida');
        if(count($path)===2){for($v=0;$v<$m['vectors'];$v++){$x=$this->get('cell',$p,$v,$i);if($x!==null)$out[]=[$v,$x];}return $out;}return $this->get('cell',$p,$vp($path[2]),$i);
    }
    function json(mixed $t,mixed $i):array{$n=$this->table($t);$p=$this->get('tableName',$n);$a=[];foreach($this->read([$t,$i]) as [$v,$x])$a[$this->get('vector',$p,$v)['name']]=$x;return ['identity'=>$this->entity($n,$i),'parameters'=>(object)$a];}
    function translate(array $q):array{
        self::need(array_is_list($q)&&count($q)>0,'Solicitud secuencial');$op=array_shift($q);
        if(in_array($op,['SET','ADD','SUB'],true)){self::arr($q,4);$t=$this->table($q[0]);return ['op'=>'assert','table'=>$t,'identity'=>$this->entity($t,$q[1]),'parameter'=>$this->field($t,$q[2]),'operation'=>$op,'value'=>$q[3]];}
        if($op==='ID'){self::arr($q,2);$t=$this->table($q[0]);return ['op'=>'identity','table'=>$t,'identity'=>$this->entity($t,$q[1])];}
        if($op==='ACT'){self::arr($q,2);$a=$this->action($q[0]);self::need(is_array($q[1])&&array_is_list($q[1]),'Filas inválidas');$rows=[];foreach($q[1] as $r){self::need(is_array($r)&&array_is_list($r)&&count($r)>0,'Fila inválida');$rows[]=['identity'=>$this->entity($a['table'],$r[0]),'values'=>array_slice($r,1)];}return ['op'=>'action','name'=>$a['name'],'rows'=>$rows];}
        if($op==='DEF'){self::arr($q,3);[$ts,$fs,$as]=$q;foreach([$ts,$fs,$as] as $v)self::need(is_array($v)&&array_is_list($v),'Declaraciones inválidas');$fields=[];$actions=[];
            foreach($fs as $f){self::arr($f,5);$fields[]=['table'=>$f[0],'name'=>$f[1],'domain'=>$f[2],'allow'=>$f[3],'constitutive'=>$f[4]];}
            foreach($as as $a){self::arr($a,5);$ins=[];$eff=[];foreach($a[2] as $f){self::arr($f,3);$ins[]=['name'=>$f[0],'domain'=>$f[1],'positive'=>$f[2]];}foreach($a[3] as $f){self::arr($f,3);$eff[]=['parameter'=>$f[0],'operation'=>$f[1],'input'=>$f[2]];}$actions[]=['name'=>$a[0],'table'=>$a[1],'inputs'=>$ins,'effects'=>$eff,'measure'=>$a[4]];}
            return ['op'=>'contract','types'=>$ts,'fields'=>$fields,'actions'=>$actions];}
        throw new StorageError(422,'Operación desconocida');
    }
    function prepare(array $q,array $o):string{self::arr($o,2);self::need(QipuDemo::validNode($o[0]),'Origen inválido');QipuDemo::num($o[1]);return QipuDemo::frame(120,QipuDemo::json(['origin'=>['node'=>$o[0],'index'=>$o[1]],'event'=>$this->translate($q)]));}
}
final class ATMAuthority {
    private Storage $storage;private CanonicalLog $log;
    function __construct(private string $root,private string $id){QipuDemo::ok((bool)preg_match('/\A[A-Za-z0-9_-]{1,80}\z/',$id),'Contexto inválido');$this->storage=new Storage($root);$this->log=new CanonicalLog($this->storage,$id);}
    function state():array{return $this->log->synchronize();}
    function read(array $p=[]):array{$b=$this->state();return ['cut'=>$b['records'],'data'=>(new ATMGeometry($b['state']))->read($p)];}
    function json(mixed $t,mixed $i):array{$b=$this->state();return ['cut'=>$b['records'],'data'=>(new ATMGeometry($b['state']))->json($t,$i)];}
    function prepare(array $q,array $o):string{$b=$this->state();QipuDemo::ok($b['records']>0,'Inicialización requerida');return (new ATMGeometry($b['state']))->prepare($q,$o);}
    function init():array{return $this->append(QipuDemo::frame(120,QipuDemo::json(['origin'=>null,'event'=>QipuDemo::genesis()])));}
    private function historical(string $raw,array $p):?array{
        $b=$this->state();$known=$p['key']===null?($b['records']>0?['record'=>0,'offset'=>0,'length'=>$b['genesisLength']]:null):($b['origins'][$p['key']]??null);
        if($known===null)return null;$old=$this->storage->read($this->id,$known['offset'],$known['length'])['bytes'];QipuDemo::ok(hash_equals($old,$raw),'Origin conflict: different bytes',409);
        return ['record'=>$known['record'],'cut'=>$known['record']+1,'end'=>$known['offset']+$known['length'],'head'=>$b['end'],'replayed'=>true];
    }
    function append(string $raw,int $timeout=10000,bool $queue=true):array{
        QipuDemo::ok($timeout>0&&$timeout<=60000,'Timeout inválido');$r=QipuDemo::scan($raw);QipuDemo::ok(count($r)===1,'Un registro completo requerido');$p=QipuDemo::intent($r[0]);
        if(($old=$this->historical($raw,$p))!==null)return $old;
        if(!$queue)return $this->log->append($raw);
        // Separate per-trajectory queue; PAO's lock and CAS remain authoritative.
        $f=fopen($this->root.'/.atm-queue-'.$this->id,'c');if(!$f)throw new StorageError(503,'Cola no disponible');$start=hrtime(true);
        try{while(!flock($f,LOCK_EX|LOCK_NB)){if((hrtime(true)-$start)/1000000>=$timeout)throw new StorageError(503,'LOCK_TIMEOUT: conserve origen y bytes');usleep(2000);}return $this->log->append($raw);}
        finally{flock($f,LOCK_UN);fclose($f);}
    }
}
