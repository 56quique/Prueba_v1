/* Avisos dentro de la app: marca "Nuevo" y número en el ícono.
   Guarda en este dispositivo qué devocionales y artículos ya vio la usuaria.
   La primera vez que se abre, los artículos que ya existían se toman como vistos
   (así no aparece todo como "Nuevo"); el devocional del día sí. */
(function(){
  'use strict';
  var CLAVE='mda_novedades_v1', est=null;

  function cargar(){
    if(est) return est;
    var o=null;
    try{ o=JSON.parse(localStorage.getItem(CLAVE)); }catch(e){}
    est=(o&&typeof o==='object')?o:{};
    est.dev=Array.isArray(est.dev)?est.dev:[];
    est.art=Array.isArray(est.art)?est.art:[];
    est.base=!!est.base;
    return est;
  }
  function guardar(){ try{ localStorage.setItem(CLAVE,JSON.stringify(est)); }catch(e){} }

  function iniciar(articulos){
    var s=cargar();
    if(!s.base){
      (articulos||[]).forEach(function(a){ if(s.art.indexOf(a.id)<0) s.art.push(a.id); });
      s.base=true; guardar();
    }
  }
  function devNuevo(f){ return cargar().dev.indexOf(f)<0; }
  function artNuevo(id){ return cargar().art.indexOf(id)<0; }
  function marcarDev(f){ var s=cargar(); if(s.dev.indexOf(f)<0){ s.dev.push(f); s.dev=s.dev.slice(-90); guardar(); } }
  function marcarArt(id){ var s=cargar(); if(s.art.indexOf(id)<0){ s.art.push(id); s.art=s.art.slice(-300); guardar(); } }
  function nuevosArt(arts){ return (arts||[]).filter(function(a){ return artNuevo(a.id); }); }

  /* Número sobre el ícono de la app instalada (donde el sistema lo permite). */
  function insignia(n){
    try{
      if(n>0 && navigator.setAppBadge) navigator.setAppBadge(n);
      else if(navigator.clearAppBadge) navigator.clearAppBadge();
    }catch(e){}
  }

  window.Novedades={iniciar:iniciar,devNuevo:devNuevo,artNuevo:artNuevo,marcarDev:marcarDev,marcarArt:marcarArt,nuevosArt:nuevosArt,insignia:insignia};
})();
