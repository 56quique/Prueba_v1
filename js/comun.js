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

  var TAB_DE={articulos:'articulos',articulo:'articulos',devocional:'devocional',testimonio:'inicio',recursos:'recursos',contacto:'contacto',inicio:'inicio',editoras:'',mas:''};
  function iniciarPagina(pagina){ tabbar(Object.prototype.hasOwnProperty.call(TAB_DE,pagina)?TAB_DE[pagina]:'inicio'); registrarSW(); }

  window.Comun={$:$,esc:esc,get:get,params:params,lista:lista,limpiar:limpiar,conSaltos:conSaltos,bloques:bloques,aviso:aviso,tabbar:tabbar,puntos:puntos,avisos:avisos,iniciarPagina:iniciarPagina};
})();
