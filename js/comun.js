/* Funciones compartidas: textos, barra inferior, avisos y service worker. */
(function(){
  'use strict';
  var N=window.Novedades, D=window.Devocional;
  function $(s,r){return (r||document).querySelector(s);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function get(u){return fetch(u,{cache:'no-cache'}).then(function(r){if(!r.ok) throw new Error(u);return r.json();});}
  function params(){return new URLSearchParams(location.search);}

  /* Devuelve la lista de párrafos de un objeto (artículo, devocional, testimonio).
     Acepta "parrafos" como lista o como texto con líneas en blanco, y también "texto" o "contenido". */
  function lista(o){
    if(!o) return [];
    var p=o.parrafos!=null?o.parrafos:(o.texto!=null?o.texto:o.contenido);
    if(Array.isArray(p)) return p.map(String);
    if(typeof p==='string') return p.split(/\n\s*\n/).map(function(s){return s.trim();}).filter(Boolean);
    return [];
  }
  function limpiar(s){return String(s).replace(/^(##\s+|>\s+)/,'');}
  function conSaltos(s){return esc(s).replace(/\n/g,'<br>');}
  /* "## Subtítulo" -> subtítulo; "> Cita" -> cita destacada; el resto -> párrafo. */
  function bloques(arr){
    return arr.map(function(s){
      s=String(s);
      if(/^##\s+/.test(s)) return '<h3 class="sub">'+esc(s.replace(/^##\s+/,''))+'</h3>';
      if(/^>\s+/.test(s)) return '<blockquote class="cita">'+conSaltos(s.replace(/^>\s+/,''))+'</blockquote>';
      return '<p>'+conSaltos(s)+'</p>';
    }).join('');
  }

  var toastT;
  function aviso(msg){
    var e=$('#toast'); if(!e) return;
    e.textContent=msg; e.classList.add('on');
    clearTimeout(toastT); toastT=setTimeout(function(){e.classList.remove('on');},2600);
  }

  /* ---------- Barra inferior ---------- */
  function ico(p){return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';}
  var TABS=[
    {id:'inicio',href:'index.html',nombre:'Inicio',svg:ico('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>')},
    {id:'articulos',href:'articulos.html',nombre:'Artículos',punto:'art',svg:ico('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>')},
    {id:'devocional',href:'devocional.html',nombre:'Devocional',punto:'dev',svg:ico('<path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6z"/><path d="M12 6v13"/>')},
    {id:'recursos',href:'recursos.html',nombre:'Recursos',svg:ico('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>')},
    {id:'contacto',href:'contacto.html',nombre:'Contacto',svg:ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>')}
  ];
  function tabbar(actual){
    var nav=$('#tabbar'); if(!nav) return;
    nav.innerHTML=TABS.map(function(t){
      return '<a class="tab'+(t.id===actual?' activa':'')+'" href="'+t.href+'"'+(t.id===actual?' aria-current="page"':'')+'>'+
        '<span class="tab-ico">'+t.svg+(t.punto?'<span class="tab-punto" data-punto="'+t.punto+'" hidden></span>':'')+'</span>'+
        '<span>'+t.nombre+'</span></a>';
    }).join('');
  }
  function puntos(o){
    var a=$('[data-punto="art"]'), d=$('[data-punto="dev"]');
    if(a) a.hidden=!(o.art>0);
    if(d) d.hidden=!(o.dev>0);
  }
  /* Calcula lo no visto, pinta los puntitos de la barra y el número del ícono. */
  function avisos(arts,devs){
    arts=Array.isArray(arts)?arts:[]; devs=Array.isArray(devs)?devs:[];
    N.iniciar(arts);
    var d=D.elegir(devs);
    var nDev=(d&&N.devNuevo(d.fecha))?1:0;
    var nArt=N.nuevosArt(arts).length;
    puntos({dev:nDev,art:nArt}); N.insignia(nDev+nArt);
    return {dev:nDev,art:nArt};
  }

  /* Aviso cuando la app descargó una versión nueva de sí misma. */
  function avisoNueva(){
    if($('#aviso-nueva')) return;
    var d=document.createElement('div'); d.id='aviso-nueva'; d.setAttribute('role','status');
    d.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));max-width:536px;margin:0 auto;z-index:75;display:flex;align-items:center;gap:10px;padding:10px 12px 10px 16px;border-radius:16px;background:#4F6B58;color:#fff;font-size:.85rem;box-shadow:0 8px 24px rgba(0,0,0,.25)';
    d.innerHTML='<span style="flex:1">Hay una versión nueva de la app.</span><button type="button" style="border:0;border-radius:999px;padding:.5em 1em;background:#fff;color:#4F6B58;font:700 .8rem sans-serif;cursor:pointer">Actualizar</button>';
    d.querySelector('button').addEventListener('click',function(){location.reload();});
    document.body.appendChild(d);
  }
  function registrarSW(){
    if(!('serviceWorker' in navigator)) return;
    var teniaControl=!!navigator.serviceWorker.controller;   /* si ya había una versión instalada, un cambio de control es una actualización */
    navigator.serviceWorker.addEventListener('controllerchange',function(){ if(teniaControl) avisoNueva(); });
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('sw.js').then(function(reg){
        /* Cada vez que se vuelve a la app, se busca si hay una versión nueva. */
        document.addEventListener('visibilitychange',function(){
          if(document.visibilityState==='visible'){ try{reg.update().catch(function(){});}catch(e){} }
        });
      }).catch(function(){});
    });
  }

  /* ---------- Aviso de cierre de esta app ----------
     Avisa que esta versión dejará de funcionar en una fecha y que la app nueva se instala con el enlace que llegó por WhatsApp.
     Además muestra el enlace de la app nueva como TEXTO con un botón "Copiar enlace" (no es un enlace tocable a propósito:
     tocado desde una app instalada se abre en una ventana interna donde no se puede instalar; hay que pegarlo en Chrome o Safari).
     - Antes de la fecha: cartel completo una vez por día ("Entendido") y, el resto del día, una barra chica fija.
     - Desde la fecha: cartel que tapa la app y no se puede cerrar.
     Para cambiar la fecha editá FECHA_CIERRE (formato AAAA-MM-DD).
     Para probar en tu celular, agregá a la dirección: ?cierre=ver (cartel de aviso), ?cierre=final (cartel de cierre)
     o ?cierre=reiniciar (borra lo que recuerda el celular). */
  var FECHA_CIERRE='2026-12-07';
  var ENLACE_NUEVA='https://claudiaklenser-dot.github.io/Mujeres_de_Accion/?desde=v1';
  var K_VISTO='mda_cierre_visto';
  var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
  function esIOS(){
    var ua=navigator.userAgent||'';
    return /iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  }
  function copiarEnlace(inp,btn){
    var ok=function(){btn.textContent='¡Enlace copiado!'; setTimeout(function(){btn.textContent='Copiar enlace';},2200);};
    var respaldo=function(){
      try{ inp.focus(); inp.select(); inp.setSelectionRange(0,inp.value.length); if(document.execCommand('copy')) return ok(); }catch(e){}
      btn.textContent='Mantené apretado el enlace para copiarlo';
    };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(ENLACE_NUEVA).then(ok,respaldo); } else { respaldo(); }
  }
  function claveHoy(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function aUTC(c){ var p=c.split('-'); return Date.UTC(+p[0],+p[1]-1,+p[2]); }
  function diasHasta(c){ return Math.round((aUTC(c)-aUTC(claveHoy()))/86400000); }
  function fechaLarga(c){ var p=c.split('-'); return (+p[2])+' de '+MESES[+p[1]-1]; }

  /* Barra chica y fija, arriba de la barra de pestañas. Al tocarla se abre el cartel completo. */
  function barraCierre(){
    if($('#cierre-barra')||$('#cierre-cartel')) return;
    var tb=$('#tabbar'), alto=(tb&&tb.offsetHeight)||64;
    var b=document.createElement('div');
    b.id='cierre-barra'; b.setAttribute('role','region'); b.setAttribute('aria-label','Aviso: esta app dejará de funcionar');
    b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:'+(alto+10)+'px;z-index:16;box-sizing:border-box;width:calc(100% - 24px);max-width:536px;display:flex;align-items:center;gap:10px;padding:9px 10px 9px 14px;border-radius:14px;background:#4F6B58;color:#fff;font:600 .85rem/1.3 Mulish,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.22)';
    b.innerHTML='<span style="flex:1">'+esc('Esta app dejará de funcionar el '+fechaLarga(FECHA_CIERRE))+'</span>'
      +'<button type="button" id="cierre-barra-ver" style="flex:none;min-height:36px;border:0;border-radius:999px;padding:.4em 1.1em;background:#fff;color:#4F6B58;font:800 .85rem Mulish,system-ui,sans-serif;cursor:pointer">Ver</button>';
    document.body.appendChild(b);
    $('#cierre-barra-ver',b).addEventListener('click',function(){ if(b.parentNode) b.parentNode.removeChild(b); cartelCierre(false,false); });
  }

  /* Cartel a pantalla completa. final=true: ya pasó la fecha, no se puede cerrar. */
  function cartelCierre(final,forzar){
    if($('#cierre-cartel')) return;
    var n=diasHasta(FECHA_CIERRE);
    var titulo=final?'Esta app ya no funciona':'Esta app dejará de funcionar el '+fechaLarga(FECHA_CIERRE);
    var ayuda='Si no lo encontrás, pedí el enlace por mensaje.';
    var cuerpo=final
      ?'Para seguir usando Mujeres de Acción, buscá en tu WhatsApp el mensaje con el enlace de la app nueva e instalala. '+ayuda
      :(n>1?'Faltan '+n+' días. ':(n===1?'Falta 1 día. ':''))+'Buscá en tu WhatsApp el mensaje con el enlace de la app nueva e instalala: es rápido y no perdés nada. '+ayuda;

    var o=document.createElement('div');
    o.id='cierre-cartel'; o.setAttribute('role','dialog'); o.setAttribute('aria-modal','true'); o.setAttribute('aria-labelledby','cierre-titulo');
    o.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;background:#FBF7F1;color:#3b3b3b;font-family:Mulish,system-ui,sans-serif;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom))';
    var h='<div style="margin:auto;width:100%;max-width:420px;text-align:center">'
      +'<div aria-hidden="true" style="font-size:2.4rem;line-height:1;margin-bottom:14px">🌿</div>'
      +'<h1 id="cierre-titulo" style="font:600 1.9rem/1.15 Cormorant Garamond,Georgia,serif;margin:0 0 12px;color:#4F6B58">'+esc(titulo)+'</h1>'
      +'<p style="margin:0 0 24px;font-size:1rem;line-height:1.55">'+esc(cuerpo)+'</p>';
    var ios=esIOS();
    h+='<div style="margin:0 0 20px;padding:14px 16px;border-radius:16px;background:#fff;text-align:left;font-size:.9rem;line-height:1.5;box-shadow:0 1px 6px rgba(0,0,0,.08)">'
      +'<p style="margin:0 0 8px;font-weight:700">¿Perdiste el mensaje? Copiá el enlace:</p>'
      +'<input id="cierre-url" type="text" readonly value="'+esc(ENLACE_NUEVA)+'" aria-label="Enlace de la app nueva" style="box-sizing:border-box;width:100%;padding:.6em .8em;margin-bottom:10px;border:1px solid #d9d2c6;border-radius:10px;font:.82rem Mulish,system-ui,sans-serif;color:#3b3b3b;background:#FBF7F1">'
      +'<button type="button" id="cierre-copiar" style="display:block;width:100%;min-height:48px;border:2px solid #4F6B58;border-radius:999px;background:#fff;color:#4F6B58;font:800 .98rem Mulish,system-ui,sans-serif;cursor:pointer">Copiar enlace</button>'
      +'<ol style="margin:12px 0 0;padding-left:1.2em">'
      +'<li>Tocá <b>Copiar enlace</b>.</li>'
      +'<li>Abrí <b>'+(ios?'Safari':'Chrome')+'</b> y pegá el enlace en la barra de arriba.</li>'
      +'<li>'+(ios?'Tocá <b>Ir</b>, después <b>Compartir</b> y elegí <b>“Agregar a inicio”</b>.':'Tocá <b>Ir</b> y después <b>Instalar la app</b>.')+'</li>'
      +'</ol></div>';
    if(!final){
      h+='<button type="button" id="cierre-ok" style="display:block;width:100%;min-height:54px;border:0;border-radius:999px;padding:.9em 1.2em;background:#4F6B58;color:#fff;font:800 1.02rem Mulish,system-ui,sans-serif;cursor:pointer">Entendido</button>';
    }
    h+='</div>';
    o.innerHTML=h;
    document.body.appendChild(o);
    var overflowAntes=document.documentElement.style.overflow;
    document.documentElement.style.overflow='hidden';
    var ok=$('#cierre-ok',o);
    var cp=$('#cierre-copiar',o), inp=$('#cierre-url',o);
    if(cp&&inp) cp.addEventListener('click',function(){ copiarEnlace(inp,cp); });
    if(ok){
      ok.addEventListener('click',function(){
        if(o.parentNode) o.parentNode.removeChild(o);
        document.documentElement.style.overflow=overflowAntes;
        if(!forzar) lsSet(K_VISTO,claveHoy());
        barraCierre();
      });
      try{ ok.focus({preventScroll:true}); }catch(e){}
    }
  }

  function avisoCierre(){
    var q=location.search||'';
    if(/[?&]cierre=reiniciar/.test(q)){ lsDel(K_VISTO); return; }
    if(/[?&]cierre=final/.test(q)){ cartelCierre(true,true); return; }
    if(/[?&]cierre=ver/.test(q)){ cartelCierre(false,true); return; }
    if($('#cierre-cartel')||$('#cierre-barra')) return;
    if(diasHasta(FECHA_CIERRE)<=0){ cartelCierre(true,false); return; }      /* ya llegó la fecha */
    if(lsGet(K_VISTO)!==claveHoy()) cartelCierre(false,false); else barraCierre();
  }

  var TAB_DE={articulos:'articulos',articulo:'articulos',devocional:'devocional',testimonio:'inicio',recursos:'recursos',contacto:'contacto',inicio:'inicio',editoras:'',mas:''};
  function iniciarPagina(pagina){ tabbar(Object.prototype.hasOwnProperty.call(TAB_DE,pagina)?TAB_DE[pagina]:'inicio'); registrarSW(); avisoCierre(); }

  window.Comun={$:$,esc:esc,get:get,params:params,lista:lista,limpiar:limpiar,conSaltos:conSaltos,bloques:bloques,aviso:aviso,tabbar:tabbar,puntos:puntos,avisos:avisos,iniciarPagina:iniciarPagina};
})();
