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

  /* ---------- Pase a la versión nueva ----------
     Cartel a pantalla completa que invita a pasar a la app nueva (otra dirección).
     - Etapa A (ETAPA_B=false): tiene "Ahora no", que lo oculta DIAS_AHORA_NO días.
     - Etapa B (ETAPA_B=true): sin "Ahora no"; aparece siempre.
     - Sin internet no aparece: la app vieja sigue funcionando como siempre.
     - Para probar en tu celular: agregá ?pase=ver a la dirección (lo muestra aunque lo hayas pospuesto o ya lo hayas usado)
       y ?pase=reiniciar para borrar lo que recuerda este celular. */
  var NUEVA='https://claudiaklenser-dot.github.io/Mujeres_de_Accion/';
  var ETAPA_B=false;
  var DIAS_AHORA_NO=2;
  var K_POSPUESTO='mda_pase_pospuesto', K_HECHO='mda_pase_hecho';

  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
  function esIOS(){
    var ua=navigator.userAgent||'';
    return /iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  }
  /* Borra las copias de imágenes, PDF y datos guardadas en el celular. Queda lo mínimo para que la app abra. */
  function limpiarCopias(){
    if(!window.caches||!caches.keys) return Promise.resolve();
    return caches.keys().then(function(ks){
      return Promise.all(ks.filter(function(k){return /^mda-.*-extra$/.test(k);}).map(function(k){return caches.delete(k);}));
    }).catch(function(){});
  }
  function copiarEnlace(inp,btn){
    var ok=function(){btn.textContent='¡Enlace copiado!'; setTimeout(function(){btn.textContent='Copiar enlace';},2200);};
    var respaldo=function(){
      try{ inp.focus(); inp.select(); inp.setSelectionRange(0,inp.value.length); if(document.execCommand('copy')) return ok(); }catch(e){}
      btn.textContent='Mantené apretado el enlace para copiarlo';
    };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(NUEVA).then(ok,respaldo); } else { respaldo(); }
  }

  function puertaNueva(){
    var q=location.search||'';
    if(/[?&]pase=reiniciar/.test(q)){ lsDel(K_POSPUESTO); lsDel(K_HECHO); return; }
    var forzar=/[?&]pase=ver/.test(q);
    if($('#pase-nueva')) return;
    if(!forzar){
      if(navigator.onLine===false) return;                       /* sin internet la app vieja sigue como siempre */
      if(!ETAPA_B){
        var t=parseInt(lsGet(K_POSPUESTO),10);
        if(t&&Date.now()-t<DIAS_AHORA_NO*86400000) return;
      }
    }
    var hecho=!forzar&&lsGet(K_HECHO)==='1';
    var ios=esIOS();

    var titulo=hecho?'Ya estás en la versión nueva':'Mujeres de Acción tiene una versión nueva';
    var cuerpo=hecho
      ?'Si ya instalaste la nueva (la del ícono verde), podés borrar este ícono. Mantené apretado el ícono y elegí “'+(ios?'Eliminar app':'Desinstalar')+'”.'
      :'Ahora la app te avisa cuando hay algo nuevo, y tiene todo el contenido de siempre. Pasar es un toque y no perdés nada.';
    var boton=hecho?'Abrir la versión nueva':'Pasar a la nueva versión';

    var o=document.createElement('div');
    o.id='pase-nueva'; o.setAttribute('role','dialog'); o.setAttribute('aria-modal','true'); o.setAttribute('aria-labelledby','pase-titulo');
    o.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;background:#FBF7F1;color:#3b3b3b;font-family:Mulish,system-ui,sans-serif;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom))';

    var h='<div style="margin:auto;width:100%;max-width:420px;text-align:center">'
      +'<div aria-hidden="true" style="font-size:2.4rem;line-height:1;margin-bottom:14px">🌿</div>'
      +'<h1 id="pase-titulo" style="font:600 1.9rem/1.15 Cormorant Garamond,Georgia,serif;margin:0 0 12px;color:#4F6B58">'+esc(titulo)+'</h1>'
      +'<p style="margin:0 0 24px;font-size:1rem;line-height:1.55">'+esc(cuerpo)+'</p>'
      +'<button type="button" id="pase-ir" style="display:block;width:100%;min-height:54px;border:0;border-radius:999px;padding:.9em 1.2em;background:#4F6B58;color:#fff;font:800 1.02rem Mulish,system-ui,sans-serif;cursor:pointer">'+esc(boton)+'</button>'
      +'<p id="pase-msg" role="status" style="min-height:1.3em;margin:10px 0 0;font-size:.85rem;color:#8a3b3b"></p>';
    if(ios){
      h+='<div style="margin-top:14px;padding:14px 16px;border-radius:16px;background:#fff;text-align:left;font-size:.88rem;line-height:1.5;box-shadow:0 1px 6px rgba(0,0,0,.08)">'
        +'<p style="margin:0 0 8px;font-weight:700">En iPhone, para instalarla:</p>'
        +'<ol style="margin:0 0 12px;padding-left:1.2em"><li>Abrí Safari y pegá el enlace.</li><li>Tocá el botón Compartir.</li><li>Elegí “Agregar a inicio”.</li></ol>'
        +'<input id="pase-url" type="text" readonly value="'+esc(NUEVA)+'" aria-label="Enlace de la versión nueva" style="box-sizing:border-box;width:100%;padding:.6em .8em;margin-bottom:10px;border:1px solid #d9d2c6;border-radius:10px;font:.82rem Mulish,system-ui,sans-serif;color:#3b3b3b;background:#FBF7F1">'
        +'<button type="button" id="pase-copiar" style="display:block;width:100%;min-height:46px;border:2px solid #4F6B58;border-radius:999px;background:#fff;color:#4F6B58;font:800 .95rem Mulish,system-ui,sans-serif;cursor:pointer">Copiar enlace</button>'
        +'</div>';
    }
    if(!ETAPA_B){
      h+='<button type="button" id="pase-ahora-no" style="margin-top:16px;border:0;background:none;padding:10px 14px;color:#6b6b6b;font:600 .9rem Mulish,system-ui,sans-serif;text-decoration:underline;cursor:pointer">Ahora no</button>';
    }
    h+='</div>';
    o.innerHTML=h;
    document.body.appendChild(o);
    var overflowAntes=document.documentElement.style.overflow;
    document.documentElement.style.overflow='hidden';

    var ir=$('#pase-ir',o), msg=$('#pase-msg',o), nada=$('#pase-ahora-no',o), cp=$('#pase-copiar',o), inp=$('#pase-url',o);
    function cerrar(){ if(o.parentNode) o.parentNode.removeChild(o); document.documentElement.style.overflow=overflowAntes; }

    ir.addEventListener('click',function(){
      if(navigator.onLine===false){ msg.textContent='Necesitás conexión a internet para pasar a la nueva versión.'; return; }
      msg.textContent=''; ir.disabled=true;
      if(!forzar) lsSet(K_HECHO,'1');
      Promise.race([limpiarCopias(),new Promise(function(r){setTimeout(r,800);})]).then(function(){ location.assign(NUEVA); });
      setTimeout(function(){ ir.disabled=false; },3000);   /* si la nueva se abre encima y se vuelve, el botón queda usable */
    });
    if(nada) nada.addEventListener('click',function(){ lsSet(K_POSPUESTO,String(Date.now())); cerrar(); });
    if(cp&&inp) cp.addEventListener('click',function(){ copiarEnlace(inp,cp); });
    try{ ir.focus({preventScroll:true}); }catch(e){}
  }

  var TAB_DE={articulos:'articulos',articulo:'articulos',devocional:'devocional',testimonio:'inicio',recursos:'recursos',contacto:'contacto',inicio:'inicio',editoras:'',mas:''};
  function iniciarPagina(pagina){ tabbar(Object.prototype.hasOwnProperty.call(TAB_DE,pagina)?TAB_DE[pagina]:'inicio'); registrarSW(); puertaNueva(); }

  window.Comun={$:$,esc:esc,get:get,params:params,lista:lista,limpiar:limpiar,conSaltos:conSaltos,bloques:bloques,aviso:aviso,tabbar:tabbar,puntos:puntos,avisos:avisos,iniciarPagina:iniciarPagina};
})();
