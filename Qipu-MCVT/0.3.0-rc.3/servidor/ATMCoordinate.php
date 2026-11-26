<?php
declare(strict_types=1);
require_once __DIR__.'/ATM.php';
final class ATMCoordinate {
    function __construct(private array $s){}
    private function get(...$k):mixed{return Motor::get($this->s,...$k);}
    private static function need(bool $x,string $m):void{QipuDemo::ok($x,$m);}
    private static function nat(mixed $x):bool{return is_int($x)&&$x>=0&&$x<=9007199254740991;}
    private static function sel(mixed $x):bool{return self::nat($x)||is_string($x);}
    private static function ar(mixed $x,int $n):array{self::need(is_array($x)&&array_is_list($x)&&count($x)===$n,'Aridad inválida');return $x;}
    private static function keys(array $x,array $ks):void{self::need(count($x)===count($ks)&&!array_diff($ks,array_keys($x)),'Campos externos inválidos');}
    private static function scope(string $c):void{self::need((bool)preg_match('~\\A[A-Za-z0-9_:./-]{1,200}\\z~D',$c),'Contexto inválido');}
    private static function packet(array $p,string $context):array{
        self::scope($context);
        if(array_is_list($p)){self::ar($p,2);self::need($p[0]===$context,'Contexto incompatible');$q=$p[1];}
        else{self::need(($p['context']??null)===$context,'Contexto incompatible');$op=$p['op']??null;
            if(in_array($op,['SET','ADD','SUB'],true)){if(array_key_exists('coordinates',$p)){self::keys($p,['context','op','coordinates','value']);$c=self::ar($p['coordinates'],3);foreach($c as $v)self::need(self::nat($v),'Coordenadas numéricas requeridas');$q=[$op,$c,$p['value']];}
                else{self::keys($p,['context','op','table','parameter','identity','value']);foreach(['table','parameter','identity'] as $k)self::need(is_string($p[$k]),'Nombres requeridos');$q=[$op,[$p['table'],$p['parameter'],$p['identity']],$p['value']];}}
            elseif($op==='ID'){self::keys($p,['context','op','table','identity']);self::need(is_string($p['table'])&&is_string($p['identity']),'Nombres requeridos');$q=[$op,[$p['table'],$p['identity']]];}
            elseif($op==='ACT'){self::keys($p,['context','op','action','rows']);$q=[$op,$p['action'],$p['rows']];}
            else throw new StorageError(422,'Tratamiento externo desconocido');}
        self::need(is_array($q)&&array_is_list($q)&&count($q)>0,'Intención inválida');return $q;
    }
    private function table(mixed $t):array{self::need(self::nat($t),'Tabla numérica requerida');$m=$this->get('table',$t);self::need($m!==null,'Tabla no constituida');return $m;}
    private function vector(mixed $t,mixed $v):array{self::need(self::nat($v),'Vector numérico requerido');$x=$this->get('vector',$t,$v);self::need($x!==null,'Vector no constituido');return $x;}
    private function identity(mixed $t,mixed $i):string{self::need(self::nat($i),'Identidad numérica requerida');$x=$this->get('entity',$t,$i);self::need($x!==null,'Identidad no constituida');return $x;}
    private function geometry(int $t):array{$m=$this->table($t);$ids=[];$vs=[];for($i=0;$i<$m['entities'];$i++)$ids[]=$this->identity($t,$i);for($v=0;$v<$m['vectors'];$v++){$x=$this->vector($t,$v);$vs[]=[$x['name'],$x['domain']];}return [$m['name'],$ids,$vs];}
    function read(array $p=[]):mixed{self::need(array_is_list($p)&&count($p)<=3,'Ruta inválida');foreach($p as $x)self::need(self::nat($x),'Ruta [t,v,i] inválida');$out=[];
        if(!$p){for($t=0;$t<($this->get('tableCount')??0);$t++)$out[]=$this->geometry($t);return $out;}
        $t=$p[0];$m=$this->table($t);if(count($p)===1)return $this->geometry($t);$v=$p[1];$this->vector($t,$v);
        if(count($p)===2){for($i=0;$i<$m['entities'];$i++){$x=$this->get('cell',$t,$v,$i);if($x!==null)$out[]=[$i,$x];}return $out;}$this->identity($t,$p[2]);return $this->get('cell',$t,$v,$p[2]);}
    function contract():array{$c=$this->get('schema')??['types'=>[],'fields'=>[],'actions'=>[]];$t=fn($n)=>array_search($n,$c['types'],true);$fs=[];$as=[];
        foreach($c['fields'] as $x)$fs[]=[$t($x['table']),$x['name'],$x['domain'],$x['allow'],$x['constitutive']];
        foreach($c['actions'] as $a){$ins=[];$eff=[];$names=array_column($a['inputs'],'name');foreach($a['inputs'] as $x)$ins[]=[$x['name'],$x['domain'],$x['positive']];
            foreach($a['effects'] as $x){$f=null;foreach($c['fields'] as $j=>$y)if($y['table']===$a['table']&&$y['name']===$x['parameter']){$f=$j;break;}$eff[]=[$f,$x['operation'],array_search($x['input'],$names,true)];}
            $as[]=[$a['name'],$t($a['table']),$ins,$eff,array_map(fn($n)=>array_search($n,$names,true),$a['measure'])];}
        return [$c['types'],$fs,$as];}
    function project(int $t,int $i):array{$m=$this->table($t);$id=$this->identity($t,$i);$out=[];for($v=0;$v<$m['vectors'];$v++){$x=$this->get('cell',$t,$v,$i);if($x!==null)$out[]=[$v,$x];}return [$t,$i,$id,$out];}
    function external(int $t,int $i):array{$p=$this->project($t,$i);$a=[];foreach($p[3] as [$v,$x])$a[$this->vector($t,$v)['name']]=$x;return ['identity'=>$p[2],'parameters'=>(object)$a];}
    function compile(array $input,string $context):array{$q=self::packet($input,$context);$op=$q[0];
        if(in_array($op,['SET','ADD','SUB'],true)){self::ar($q,3);[$t,$v,$i]=self::ar($q[1],3);foreach([$t,$v,$i] as $z)self::need(self::sel($z),'Selector inválido');$legacy=[$op,$t,$i,$v,$q[2]];}
        elseif($op==='ID'){self::ar($q,2);[$t,$i]=self::ar($q[1],2);self::need(self::sel($t)&&self::sel($i),'Selector inválido');$legacy=[$op,$t,$i];}
        elseif($op==='ACT'){self::ar($q,3);self::need(self::sel($q[1])&&is_array($q[2])&&array_is_list($q[2]),'Acción inválida');$legacy=$q;}
        elseif($op==='DEF'){self::ar($q,4);$legacy=$q;}else throw new StorageError(422,'Tratamiento desconocido');
        $e=(new ATMGeometry($this->s))->translate($legacy);QipuDemo::request($e);$normalized=$q;
        if(in_array($e['op'],['assert','identity'],true)){$t=$this->get('tableName',$e['table']);$i=$t===null?null:$this->get('entityName',$t,$e['identity']);
            if($e['op']==='assert'){$v=$t===null?null:$this->get('vectorName',$t,$e['parameter']);$normalized=[$op,[$t??$e['table'],$v??$e['parameter'],$i??$e['identity']],$e['value']];$legacy=[$op,$e['table'],$e['identity'],$e['parameter'],$e['value']];}
            else{$normalized=[$op,[$t??$e['table'],$i??$e['identity']]];$legacy=[$op,$e['table'],$e['identity']];}}
        elseif($e['op']==='action'){$c=$this->get('schema');$a=array_search($e['name'],array_column($c['actions'],'name'),true);$t=$this->get('tableName',$c['actions'][$a]['table']);$rs=[];$ls=[];foreach($e['rows'] as $r){$i=$t===null?null:$this->get('entityName',$t,$r['identity']);$rs[]=[$i??$r['identity'],...$r['values']];$ls[]=[$r['identity'],...$r['values']];}$normalized=[$op,$a,$rs];$legacy=[$op,$e['name'],$ls];}
        return ['intent'=>$normalized,'legacy'=>$legacy,'event'=>$e];}
}
final class ATMCoordinateAuthority {
    function __construct(private ATMAuthority $authority,private string $context){QipuDemo::ok((bool)preg_match('~\\A[A-Za-z0-9_:./-]{1,200}\\z~D',$context),'Contexto inválido');}
    private function query(callable $f):array{$b=$this->authority->state();return ['context'=>$this->context,'cut'=>$b['records'],'data'=>$f(new ATMCoordinate($b['state']))];}
    function init():array{return $this->authority->init();}
    function read(array $p=[]):array{return $this->query(fn($g)=>$g->read($p));}
    function contract():array{return $this->query(fn($g)=>$g->contract());}
    function project(int $t,int $i):array{return $this->query(fn($g)=>$g->project($t,$i));}
    function json(int $t,int $i):array{return $this->query(fn($g)=>$g->external($t,$i));}
    function prepare(array $input,array $origin):string{$b=$this->query(fn($g)=>$g->compile($input,$this->context));return $this->authority->prepare($b['data']['legacy'],$origin);}
    function append(string $raw,int $timeout=10000,bool $queue=true):array{return $this->authority->append($raw,$timeout,$queue);}
    function submit(array $input,array $origin):array{return $this->append($this->prepare($input,$origin));}
}
