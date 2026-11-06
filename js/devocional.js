/* Elige el devocional del día según la fecha del dispositivo.
   - Si hay uno para hoy, lo muestra.
   - Si falta la fecha de hoy, muestra el último cargado hasta hoy.
   - Si todos son futuros, muestra el más próximo. */
(function(){
  'use strict';
  var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function pad(n){return (n<10?'0':'')+n;}
  function hoyISO(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function fechaLarga(iso){
    var p=String(iso).split('-');
    return parseInt(p[2],10)+' de '+MESES[parseInt(p[1],10)-1]+' de '+p[0];
  }
  function elegir(lista){
    if(!Array.isArray(lista)||!lista.length) return null;
    var hoy=hoyISO();
    var ord=lista.slice().sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;});
    var elegido=null;
    for(var i=0;i<ord.length;i++){ if(ord[i].fecha<=hoy) elegido=ord[i]; }
    return elegido||ord[0];
  }
  window.Devocional={elegir:elegir,fechaLarga:fechaLarga,hoyISO:hoyISO};
})();
