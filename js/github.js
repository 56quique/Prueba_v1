/* Acceso a GitHub para el editor.
   - La llave (token) se guarda en este celular CIFRADA con la contraseña de la editora (AES-GCM + PBKDF2).
   - Nunca se sube al repositorio ni se guarda en texto plano. */
(function(){
  'use strict';
  var CLAVE='mda_editor_llave', enc=new TextEncoder(), dec=new TextDecoder();
  var ses={token:null,owner:'',repo:'',rama:'main',api:'https://api.github.com'};

  /* ---------- base64 ---------- */
  function aB64(buf){var b=new Uint8Array(buf),s='',n=0x8000;for(var i=0;i<b.length;i+=n) s+=String.fromCharCode.apply(null,b.subarray(i,i+n));return btoa(s);}
  function deB64(s){var bin=atob(String(s).replace(/\s/g,'')),b=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++) b[i]=bin.charCodeAt(i);return b;}
  function textoB64(t){return aB64(enc.encode(t));}
  function b64Texto(s){return dec.decode(deB64(s));}
  function blobB64(blob){
    return new Promise(function(ok,no){
      var r=new FileReader();
      r.onload=function(){ok(String(r.result).split(',')[1]||'');};
      r.onerror=function(){no(new Error('No se pudo leer el archivo.'));};
      r.readAsDataURL(blob);
    });
  }

  /* ---------- llave cifrada ---------- */
  function clave(pass,salt){
    return crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']).then(function(k){
      return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:310000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    });
  }
  function hayLlave(){try{return !!localStorage.getItem(CLAVE);}catch(e){return false;}}
  function olvidarLlave(){try{localStorage.removeItem(CLAVE);}catch(e){} ses.token=null;}
  function guardarLlave(token,pass){
    var salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
    return clave(pass,salt).then(function(k){return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},k,enc.encode(token));})
      .then(function(c){localStorage.setItem(CLAVE,JSON.stringify({v:1,s:aB64(salt),i:aB64(iv),c:aB64(c)}));});
  }
  function abrirLlave(pass){
    var r=null; try{r=JSON.parse(localStorage.getItem(CLAVE));}catch(e){}
    if(!r) return Promise.reject(new Error('No hay llave guardada en este celular.'));
    return clave(pass,deB64(r.s)).then(function(k){return crypto.subtle.decrypt({name:'AES-GCM',iv:deB64(r.i)},k,deB64(r.c));})
      .then(function(b){return dec.decode(b);},function(){var e=new Error('Contraseña incorrecta.');e.clave=true;throw e;});
  }

  /* ---------- API de GitHub ---------- */
  function usar(token,cfg){ses.token=token;ses.owner=cfg.owner;ses.repo=cfg.repo;ses.rama=cfg.rama||'main';if(cfg.api) ses.api=cfg.api;}
  function cerrar(){ses.token=null;}
  var MSG={
    401:'La llave de GitHub no es válida o venció. Hay que generar una nueva.',
    403:'GitHub rechazó la operación (permisos o límite de uso). Revisá que la llave tenga permiso "Contents: Read and write" sobre este repositorio.',
    404:'No se encontró el repositorio o el archivo. Revisá data/editor.json y que la llave tenga acceso a este repositorio.',
    409:'Alguien modificó el archivo al mismo tiempo. Intentá de nuevo.',
    422:'GitHub no pudo aplicar el cambio. Intentá de nuevo.'
  };
  function err(status){var e=new Error(MSG[status]||('GitHub respondió con el error '+status+'.'));e.status=status;return e;}
  function llamar(ruta,o){
    o=o||{};
    var h={'Authorization':'Bearer '+ses.token,'Accept':o.accept||'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    if(o.body) h['Content-Type']='application/json';
    return fetch(ses.api+ruta,{method:o.method||'GET',headers:h,body:o.body,cache:'no-store'});
  }
  function rutaRepo(){return '/repos/'+encodeURIComponent(ses.owner)+'/'+encodeURIComponent(ses.repo);}
  function rutaArch(p){return rutaRepo()+'/contents/'+p.split('/').map(encodeURIComponent).join('/');}

  function verificar(){
    return llamar(rutaRepo()).then(function(r){if(!r.ok) throw err(r.status);return r.json();}).then(function(j){
      if(j.permissions&&j.permissions.push===false){var e=new Error('La llave solo permite leer. Hace falta permiso de escritura (Contents: Read and write).');e.status=403;throw e;}
      return true;
    });
  }
  function obtener(ruta){
    return llamar(rutaArch(ruta)+'?ref='+encodeURIComponent(ses.rama)).then(function(r){
      if(r.status===404) return null;
      if(!r.ok) throw err(r.status);
      return r.json();
    });
  }
  function parsear(t,ruta){try{return JSON.parse(t);}catch(e){throw new Error('El archivo '+ruta+' no tiene un formato válido.');}}
  function leerJSON(ruta){
    return obtener(ruta).then(function(j){
      if(!j) return {datos:[],sha:null};
      if(j.content) return {datos:parsear(b64Texto(j.content),ruta),sha:j.sha};
      return llamar(rutaArch(ruta)+'?ref='+encodeURIComponent(ses.rama),{accept:'application/vnd.github.raw+json'})
        .then(function(r){if(!r.ok) throw err(r.status);return r.text();})
        .then(function(t){return {datos:parsear(t,ruta),sha:j.sha};});
    });
  }
  function poner(ruta,b64,msg,sha){
    var body={message:msg,content:b64,branch:ses.rama}; if(sha) body.sha=sha;
    return llamar(rutaArch(ruta),{method:'PUT',body:JSON.stringify(body)}).then(function(r){if(!r.ok) throw err(r.status);return r.json();});
  }
  function reintentar(fn){
    function intento(n){return fn().catch(function(e){if(n<1&&(e.status===409||e.status===422)) return intento(n+1);throw e;});}
    return intento(0);
  }
  /* Sube un archivo (imagen o PDF); si ya existe lo reemplaza. */
  function subir(ruta,blob,msg){
    return blobB64(blob).then(function(b64){
      return reintentar(function(){return obtener(ruta).then(function(j){return poner(ruta,b64,msg,j&&j.sha);});});
    });
  }
  /* Lee el JSON actual, aplica el cambio y lo guarda (siempre sobre la última versión). */
  function modificarJSON(ruta,fn,msg){
    return reintentar(function(){
      return leerJSON(ruta).then(function(r){
        var nuevo=fn(r.datos);
        return poner(ruta,textoB64(JSON.stringify(nuevo,null,2)+'\n'),msg,r.sha).then(function(){return nuevo;});
      });
    });
  }
  function mensajeError(e){
    if(e&&e.clave) return e.message;
    if(e&&e.status) return e.message;
    if(e instanceof TypeError) return 'No hay conexión con GitHub. Revisá tu internet; tu borrador queda guardado.';
    return (e&&e.message)||'Ocurrió un error inesperado.';
  }

  window.GH={hayLlave:hayLlave,olvidarLlave:olvidarLlave,guardarLlave:guardarLlave,abrirLlave:abrirLlave,usar:usar,cerrar:cerrar,
    verificar:verificar,leerJSON:leerJSON,subir:subir,modificarJSON:modificarJSON,mensajeError:mensajeError};
})();
