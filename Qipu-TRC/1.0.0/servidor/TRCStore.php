<?php
declare(strict_types=1);
require_once __DIR__.'/QipuTRC.php';
/* One immutable frame per position. flock + same-directory atomic rename. Linux/PHP 8.1+. */
final class TRCStore {
 private string $dir;
 function __construct(string $dir){
  TRC::need($dir!==''&&$dir[0]==='/','QIPU_TRC_DATA debe ser una ruta absoluta');
  if(!is_dir($dir)){TRC::need(@mkdir($dir,0700,true)||is_dir($dir),'No se pudo crear directorio');}
  $real=realpath($dir);TRC::need($real!==false&&!is_link($dir),'Directorio inválido');$this->dir=$real;
  $doc=realpath($_SERVER['DOCUMENT_ROOT']??'');if(PHP_SAPI!=='cli'&&$doc!==false)TRC::need($real!==$doc&&!str_starts_with($real,$doc.'/'),'Datos deben quedar fuera del directorio público');
 }
 private function file(int $i):string{return $this->dir.'/'.sprintf('%016d.k5b',$i);}
 private function lock(int $kind,callable $f):mixed{
  $l=fopen($this->dir.'/.writer.lock','c+b');TRC::need($l!==false,'No se pudo abrir lock');try{TRC::need(flock($l,$kind),'No se pudo adquirir lock');return $f();}finally{flock($l,LOCK_UN);fclose($l);}
 }
 private function load():array{
  $files=scandir($this->dir);TRC::need($files!==false,'No se pudo listar');$names=[];
  foreach($files as $name){if(str_ends_with($name,'.k5b')){TRC::need(preg_match('/^[0-9]{16}\.k5b$/D',$name)===1,'Nombre de marco inválido');$names[]=$name;}}
  sort($names,SORT_STRING);$raw='';$i=0;foreach($names as $name){TRC::need($name===sprintf('%016d.k5b',$i),'Discontinuidad física');$p=$this->dir.'/'.$name;TRC::need(is_file($p)&&!is_link($p),'Marco inválido');$b=file_get_contents($p);TRC::need($b!==false,'Lectura fallida');[, $end]=TRC::frame($b);TRC::need($end===strlen($b),'Un marco por archivo');$raw.=$b;$i++;}return [$raw,$i];
 }
 private function syncDir():void{$d=fopen($this->dir,'r');TRC::need($d!==false,'No se pudo abrir directorio');try{TRC::need(fsync($d),'fsync directorio falló');}finally{fclose($d);}}
 private function commit(int $i,string $b):void{
  $dest=$this->file($i);TRC::need(!file_exists($dest),'Posición ya ocupada');$tmp=tempnam($this->dir,'.tmp-');TRC::need($tmp!==false,'Temporal falló');$f=null;
  try{$f=fopen($tmp,'wb');TRC::need($f!==false,'No se pudo escribir');$n=strlen($b);for($p=0;$p<$n;){$k=fwrite($f,substr($b,$p));TRC::need($k!==false&&$k>0,'Escritura incompleta');$p+=$k;}TRC::need(fflush($f)&&fsync($f),'fsync marco falló');fclose($f);$f=null;TRC::need(rename($tmp,$dest),'Rename falló');$this->syncDir();}
  finally{if(is_resource($f))fclose($f);if(file_exists($tmp))@unlink($tmp);}
 }
 function run(stdClass $q):array{
  $read=in_array($q->op??'', ['read','history','export','cut'],true);
  return $this->lock($read?LOCK_SH:LOCK_EX,function()use($q,$read){[$raw,$cut]=$this->load();$p=TRCWorld::plan($raw,$q);
   if($p['suffix']!==''){TRC::need(!$read&&$p['cut']===$cut+1,'Corte incoherente');$this->commit($cut,$p['suffix']);}
   else{TRC::need($p['cut']===$cut,'Corte incoherente');}
   return ['result'=>$p['result'],'cut'=>$p['cut']];
  });
 }
}
