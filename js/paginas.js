/* Pantallas internas: artículos, artículo, devocional, testimonio, recursos y contacto. */
(function(){
  'use strict';
  var C=window.Comun, N=window.Novedades, D=window.Devocional;
  var esc=C.esc, cont=document.getElementById('contenido');
  var pagina=cont.getAttribute('data-pagina');

  function img(src){return src?'<img src="'+esc(src)+'" alt="" loading="lazy" onerror="this.remove()">':'';}
  function portada(src){return src?'<div class="portada">'+img(src)+'</div>':'';}
  function error(msg){cont.innerHTML='<div class="error-carga">'+esc(msg)+'</div>';}
  function vacio(msg){cont.innerHTML='<p class="vacio">'+esc(msg)+'</p>';}
  function sinDatos(){error('No se pudieron cargar los datos. Revisá tu conexión e intentá de nuevo.');}
  function porFecha(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;}
  function fechaTxt(f){return (f&&/^\d{4}-\d{2}-\d{2}$/.test(f))?D.fechaLarga(f):'';}
  function devs(){return C.get('data/devocionales.json').catch(function(){return [];});}
  function base(){return Promise.all([C.get('data/articulos.json').catch(function(){return [];}),devs()]);}

  /* ---------- Artículos ---------- */
  function pArticulos(){
    base().then(function(r){
      var arts=Array.isArray(r[0])?r[0]:[];
      C.avisos(arts,r[1]);
      if(!arts.length) return vacio('Todavía no hay artículos publicados.');
      var orden=arts.slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');});
      var cats=[]; orden.forEach(function(a){if(a.categoria&&cats.indexOf(a.categoria)<0) cats.push(a.categoria);});
      var actual=C.params().get('cat')||'Todas';
      if(actual!=='Todas'&&cats.indexOf(actual)<0) actual='Todas';
      cont.innerHTML='<div class="chips" id="chips"></div><div class="lista" id="lista-art"></div>';
      function tarjeta(a){
        return '<a class="item-art" href="articulo.html?id='+encodeURIComponent(a.id)+'">'+
          '<span class="item-img">'+img(a.imagen)+'</span>'+
          '<span class="item-cuerpo">'+
            '<span class="fila-etiqueta">'+(a.categoria?'<span class="etiqueta">'+esc(a.categoria)+'</span>':'')+(N.artNuevo(a.id)?'<span class="nuevo">Nuevo</span>':'')+'</span>'+
            '<h3>'+esc(a.titulo)+'</h3>'+
            (a.resumen?'<span class="resumen">'+esc(a.resumen)+'</span>':'')+
            (fechaTxt(a.fecha)?'<span class="fecha">'+esc(fechaTxt(a.fecha))+'</span>':'')+
          '</span></a>';
      }
      function pintar(){
        document.getElementById('chips').innerHTML=['Todas'].concat(cats).map(function(c){
          return '<button type="button" class="chip'+(c===actual?' activa':'')+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>';
        }).join('');
        var items=orden.filter(function(a){return actual==='Todas'||a.categoria===actual;});
        document.getElementById('lista-art').innerHTML=items.length?items.map(tarjeta).join(''):'<p class="vacio">Todavía no hay artículos en esta categoría.</p>';
      }
      cont.addEventListener('click',function(e){var b=e.target.closest('[data-cat]'); if(b){actual=b.getAttribute('data-cat'); pintar();}});
      pintar();
    }).catch(sinDatos);
  }

  /* ---------- Artículo ---------- */
  function pArticulo(){
    var id=C.params().get('id');
    base().then(function(r){
      var arts=Array.isArray(r[0])?r[0]:[];
      var a=arts.filter(function(x){return String(x.id)===String(id);})[0];
      if(!a){ C.avisos(arts,r[1]); return vacio('No encontramos este artículo.'); }
      document.title=a.titulo+' · Mujeres de Acción';
      var texto=C.lista(a), desc=Array.isArray(a.descargas)?a.descargas:[];
      cont.innerHTML='<article class="lectura">'+portada(a.imagen)+
        (a.categoria?'<div class="fila-etiqueta"><span class="etiqueta">'+esc(a.categoria)+'</span></div>':'')+
        '<h2>'+esc(a.titulo)+'</h2>'+
        (fechaTxt(a.fecha)?'<p class="meta">'+esc(fechaTxt(a.fecha))+'</p>':'')+
        (a.versiculo?'<blockquote class="cita versiculo">'+C.conSaltos(a.versiculo)+'</blockquote>':'')+
        '<div class="cuerpo">'+(texto.length?C.bloques(texto):'<p>'+esc(a.resumen||'')+'</p><p class="aviso-vacio">El texto completo de este artículo todavía no está cargado.</p>')+'</div>'+
        (desc.length?'<div class="descargas"><h3>Para descargar</h3>'+desc.map(function(d){
          return '<a class="btn-leer btn-descarga" href="'+esc(d.archivo)+'" download target="_blank" rel="noopener">'+esc(d.titulo||'Descargar')+'</a>';
        }).join('')+'</div>':'')+
        '<div class="nav-lect"><a class="btn-sec" href="articulos.html">‹ Todos los artículos</a></div></article>';
      N.marcarArt(a.id); C.avisos(arts,r[1]);
    }).catch(sinDatos);
  }

  /* ---------- Devocional ---------- */
  /* Introducción del mes ("Tema de noviembre"): se toma de data/mes.json según el mes del devocional que se está mirando. */
  function temaMes(temas,fecha){
    var k=String(fecha).slice(0,7), t=temas.filter(function(x){return x&&x.mes===k;})[0];
    if(!t||!/^\d{4}-\d{2}$/.test(k)) return '';
    var tx=C.lista(t); if(!tx.length&&!t.titulo) return '';
    var nombre=D.fechaLarga(k+'-01').split(' de ')[1];
    return '<section class="tema-mes" aria-label="Tema de '+esc(nombre)+'">'+
      '<span class="etiqueta">Tema de '+esc(nombre)+'</span>'+
      (t.titulo?'<h3>'+esc(t.titulo)+'</h3>':'')+
      '<div class="texto-fade cuerpo-tema">'+C.bloques(tx)+'</div>'+
      '<button type="button" class="btn-leer" data-tema aria-expanded="false">Leer más</button></section>';
  }

  function pDevocional(){
    Promise.all([C.get('data/devocionales.json'),C.get('data/articulos.json').catch(function(){return [];}),
      fetch('data/mes.json',{cache:'no-cache'}).then(function(x){return x.ok?x.json():[];}).catch(function(){return [];})]).then(function(r){
      var todos=Array.isArray(r[0])?r[0]:[], arts=r[1], temas=Array.isArray(r[2])?r[2]:[];
      if(!todos.length) return vacio('Todavía no hay devocionales cargados.');
      var hoy=D.hoyISO();
      /* Solo se muestran los publicados (fecha de hoy o anterior). */
      var disp=todos.filter(function(x){return x.fecha<=hoy;}).sort(porFecha);
      if(!disp.length) disp=[D.elegir(todos)];
      var pedido=C.params().get('fecha');
      var el=disp.filter(function(x){return x.fecha===pedido;})[0]||D.elegir(todos);
      var i=disp.indexOf(el), ant=disp[i-1], sig=disp[i+1];
      var texto=C.lista(el);
      var previos=disp.filter(function(x){return x!==el;}).reverse().slice(0,30);
      document.title=el.titulo+' · Mujeres de Acción';
      cont.innerHTML=temaMes(temas,el.fecha)+'<article class="lectura">'+portada(el.imagen)+
        '<div class="fila-etiqueta"><span class="etiqueta">'+(el.fecha===hoy?'Devocional de hoy':'Devocional')+'</span></div>'+
        '<p class="meta">'+esc(fechaTxt(el.fecha))+'</p>'+
        '<h2>'+esc(el.titulo)+'</h2>'+
        (el.referencia?'<p class="referencia">'+esc(el.referencia)+'</p>':'')+
        '<div class="cuerpo">'+C.bloques(texto)+'</div>'+
        '<div class="nav-lect">'+
          (ant?'<a class="btn-sec" href="devocional.html?fecha='+encodeURIComponent(ant.fecha)+'">‹ Anterior</a>':'<span></span>')+
          (sig?'<a class="btn-sec" href="devocional.html?fecha='+encodeURIComponent(sig.fecha)+'">Siguiente ›</a>':'<span></span>')+
        '</div></article>'+
        (previos.length?'<section class="anteriores"><h3>Devocionales anteriores</h3><div class="lista">'+previos.map(function(x){
          return '<a class="item-dev" href="devocional.html?fecha='+encodeURIComponent(x.fecha)+'"><span class="fecha">'+esc(fechaTxt(x.fecha))+'</span><span>'+esc(x.titulo)+'</span></a>';
        }).join('')+'</div></section>':'');
      N.marcarDev(el.fecha); C.avisos(arts,todos);
      var tf=cont.querySelector('.tema-mes .texto-fade');
      if(tf&&tf.clientHeight>0&&tf.scrollHeight<=tf.clientHeight+2) cont.querySelector('.tema-mes').classList.add('corto');   /* si es corto, no hace falta "Leer más" */
      cont.addEventListener('click',function(ev){
        var b=ev.target.closest('[data-tema]'); if(!b) return;
        var s=cont.querySelector('.tema-mes'), abierta=s.classList.toggle('abierta');
        b.textContent=abierta?'Leer menos':'Leer más'; b.setAttribute('aria-expanded',String(abierta));
      });
    }).catch(sinDatos);
  }

  /* ---------- Testimonio ---------- */
  function pTestimonio(){
    C.get('data/testimonio.json').then(function(t){
      var texto=C.lista(t);
      document.title=(t.titulo||'Testimonio')+' · Mujeres de Acción';
      cont.innerHTML='<article class="lectura">'+portada(t.imagen||'img/testimonio.webp')+
        '<div class="fila-etiqueta"><span class="etiqueta">'+esc(t.etiqueta||'Testimonio')+'</span></div>'+
        '<h2>'+esc(t.titulo||'Testimonio')+'</h2>'+
        '<div class="cuerpo">'+(texto.length?C.bloques(texto):'<p class="aviso-vacio">El testimonio todavía no está cargado.</p>')+'</div>'+
        '<div class="nav-lect"><a class="btn-sec" href="index.html">‹ Volver al inicio</a></div></article>';
    }).catch(sinDatos);
  }

  /* ---------- Recursos (con vista previa de PDF) ---------- */
  var pdfLib=null;
  /* El visor (PDF.js) se descarga recién cuando alguien toca "Vista previa". */
  function cargarPdfJs(){
    if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if(pdfLib) return pdfLib;
    var importar=new Function('u','return import(u)');   /* así un navegador muy viejo no rompe el resto de la página */
    pdfLib=importar(new URL('js/vendor/pdf.esm.min.js',document.baseURI).href).then(function(m){
      m.GlobalWorkerOptions.workerSrc=new URL('js/vendor/pdf.worker.esm.min.js',document.baseURI).href;
      window.pdfjsLib=m; return m;
    }).catch(function(er){pdfLib=null;throw er;});
    return pdfLib;
  }

  function abrirVistaPdf(item){
    var url=new URL(item.archivo,document.baseURI).href;
    var nombre=item.archivo.split('?')[0].split('/').pop()||'documento.pdf';
    try{nombre=decodeURIComponent(nombre);}catch(x){}
    var e={doc:null,total:0,pag:1,tarea:null,blob:null,cerrado:false};
    var cuerpoPrev=document.body.style.overflow, toast=document.getElementById('toast'), zPrev=toast?toast.style.zIndex:'';
    var o=document.createElement('div');
    o.className='pdf-vista'; o.setAttribute('role','dialog'); o.setAttribute('aria-modal','true'); o.setAttribute('aria-label','Vista previa de '+item.titulo);
    o.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;z-index:70;display:flex;flex-direction:column;background:#FBF7F1';
    o.innerHTML=
      '<div style="padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:#DCE5D8;color:#4F6B58;font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(item.titulo)+'</div>'+
      '<div class="pdf-cuerpo" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:12px;background:#EFE8DE">'+
        '<p class="pdf-msg" style="text-align:center;color:#6B6F75;margin:30px 10px">Cargando vista previa…</p>'+
        '<canvas class="pdf-lienzo" style="display:none;width:100%;height:auto;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.15);border-radius:4px"></canvas>'+
      '</div>'+
      '<div style="padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:#FBF7F1;border-top:1px solid rgba(80,60,40,.12)">'+
        '<div class="pdf-pag" style="display:none;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">'+
          '<button type="button" class="btn-sec peq" data-pdf="ant">‹ Anterior</button><span class="pdf-num" style="font-size:.85rem;color:#6B6F75"></span><button type="button" class="btn-sec peq" data-pdf="sig">Siguiente ›</button></div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
          '<a class="btn-leer btn-descarga" href="'+esc(item.archivo)+'" download target="_blank" rel="noopener" style="justify-content:center">Descargar</a>'+
          '<button type="button" class="btn-sec" data-pdf="compartir" style="justify-content:center">Compartir</button>'+
          '<button type="button" class="btn-sec" data-pdf="cerrar" style="justify-content:center;grid-column:1/-1">Cerrar vista previa</button>'+
        '</div></div>';
    document.body.appendChild(o);
    document.body.style.overflow='hidden'; if(toast) toast.style.zIndex='80';
    try{history.pushState({mdaPdf:1},'');}catch(x){}   /* así el botón "atrás" del celular cierra la vista previa */

    function quitar(){
      if(e.cerrado) return; e.cerrado=true;
      if(e.tarea){try{e.tarea.cancel();}catch(x){}}
      if(e.doc){try{e.doc.destroy();}catch(x){}}
      window.removeEventListener('popstate',quitar); document.removeEventListener('keydown',tecla);
      document.body.style.overflow=cuerpoPrev; if(toast) toast.style.zIndex=zPrev;
      o.remove();
    }
    function cerrar(){ if(history.state&&history.state.mdaPdf) history.back(); else quitar(); }
    function tecla(ev){ if(ev.key==='Escape') cerrar(); }
    window.addEventListener('popstate',quitar); document.addEventListener('keydown',tecla);

    function q(s){return o.querySelector(s);}
    function msg(t){var m=q('.pdf-msg'); m.textContent=t; m.style.display=t?'block':'none';}
    function pager(){
      var p=q('.pdf-pag'); if(e.total<2){p.style.display='none';return;}
      p.style.display='flex'; q('.pdf-num').textContent='Página '+e.pag+' de '+e.total;
      var a=q('[data-pdf="ant"]'), s=q('[data-pdf="sig"]');
      a.disabled=e.pag<=1; s.disabled=e.pag>=e.total; a.style.opacity=a.disabled?.4:1; s.style.opacity=s.disabled?.4:1;
    }
    function pintar(n){
      e.pag=n;
      if(e.tarea){try{e.tarea.cancel();}catch(x){}}
      e.doc.getPage(n).then(function(pg){
        var cuerpo=q('.pdf-cuerpo'), ancho=Math.max(200,cuerpo.clientWidth-24);
        var v1=pg.getViewport({scale:1}), dpr=Math.min(window.devicePixelRatio||1,3);
        var vp=pg.getViewport({scale:(ancho/v1.width)*dpr});
        var cv=q('.pdf-lienzo'); cv.width=Math.floor(vp.width); cv.height=Math.floor(vp.height);
        e.tarea=pg.render({canvasContext:cv.getContext('2d'),canvas:cv,viewport:vp});
        return e.tarea.promise.then(function(){ cv.style.display='block'; msg(''); cuerpo.scrollTop=0; pager(); });
      }).catch(function(er){
        if(er&&er.name==='RenderingCancelledException') return;
        if(!e.cerrado) msg('No se pudo mostrar la vista previa. Podés descargar el archivo igual.');
      });
    }
    function copiarEnlace(){
      if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function(){C.aviso('Enlace copiado.');},function(){C.aviso('No se pudo compartir.');});
      else C.aviso('No se pudo compartir.');
    }
    /* Se comparte el archivo PDF; si el celular no puede, el enlace; y si tampoco, se copia el enlace. */
    function compartir(){
      var f=null;
      try{ if(e.blob&&window.File) f=new File([e.blob],nombre,{type:'application/pdf'}); }catch(x){}
      if(navigator.share){
        var datos=(f&&navigator.canShare&&navigator.canShare({files:[f]}))?{files:[f],title:item.titulo}:{title:item.titulo,url:url};
        navigator.share(datos).catch(function(er){ if(!er||er.name!=='AbortError') copiarEnlace(); });
      } else copiarEnlace();
    }
    o.addEventListener('click',function(ev){
      var b=ev.target.closest('[data-pdf]'); if(!b) return;
      var a=b.getAttribute('data-pdf');
      if(a==='cerrar') cerrar();
      else if(a==='compartir') compartir();
      else if(a==='ant'&&e.doc&&e.pag>1) pintar(e.pag-1);
      else if(a==='sig'&&e.doc&&e.pag<e.total) pintar(e.pag+1);
    });

    /* Se baja el archivo una sola vez: sirve para dibujar la vista previa y para compartirlo. */
    Promise.all([cargarPdfJs(),fetch(url).then(function(r){if(!r.ok) throw new Error('archivo');return r.arrayBuffer();})]).then(function(r){
      e.blob=new Blob([r[1]],{type:'application/pdf'});
      return r[0].getDocument({data:new Uint8Array(r[1].slice(0)),isEvalSupported:false,enableXfa:false}).promise;
    }).then(function(doc){
      if(e.cerrado){try{doc.destroy();}catch(x){} return;}
      e.doc=doc; e.total=doc.numPages; pintar(1);
    }).catch(function(){ if(!e.cerrado) msg('No se pudo mostrar la vista previa. Podés descargar el archivo igual.'); });
  }

  function pRecursos(){
    C.get('data/recursos.json').then(function(items){
      items=(Array.isArray(items)?items:[]).filter(function(x){return x&&x.archivo;});
      if(!items.length) return vacio('Todavía no hay recursos para descargar.');
      cont.innerHTML='<p class="intro">Materiales para ver, descargar y compartir.</p><div class="lista">'+items.map(function(x,i){
        return '<div class="recurso">'+
          '<span class="recurso-ico" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/></svg></span>'+
          '<div class="recurso-cuerpo"><h3>'+esc(x.titulo)+'</h3>'+(x.descripcion?'<p>'+esc(x.descripcion)+'</p>':'')+
          '<button type="button" class="btn-leer" data-vista="'+i+'">Vista previa</button></div></div>';
      }).join('')+'</div>';
      cont.addEventListener('click',function(ev){
        var b=ev.target.closest('[data-vista]'); if(b) abrirVistaPdf(items[+b.getAttribute('data-vista')]);
      });
    }).catch(sinDatos);
  }

  /* ---------- Más: galería de imágenes ---------- */
  function abrirVistaImagen(lista,inicio){
    var e={i:inicio,cerrado:false,blob:null};
    var cuerpoPrev=document.body.style.overflow, toast=document.getElementById('toast'), zPrev=toast?toast.style.zIndex:'';
    var o=document.createElement('div');
    o.className='img-vista'; o.setAttribute('role','dialog'); o.setAttribute('aria-modal','true');
    o.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;z-index:70;display:flex;flex-direction:column;background:#FBF7F1';
    o.innerHTML=
      '<div style="padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:#DCE5D8;color:#4F6B58;overflow:hidden">'+
        '<div class="img-titulo" style="font-weight:700;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>'+
        '<div class="img-cuenta" style="font-size:.75rem;opacity:.85"></div></div>'+
      '<div class="img-cuerpo" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:10px;background:#EFE8DE;overflow:hidden">'+
        '<p class="img-msg" style="color:#6B6F75;margin:0">Cargando…</p>'+
        '<img class="img-grande" alt="" style="display:none;max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.15)">'+
      '</div>'+
      '<div style="padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:#FBF7F1;border-top:1px solid rgba(80,60,40,.12)">'+
        '<div class="img-pag" style="display:none;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">'+
          '<button type="button" class="btn-sec peq" data-im="ant">‹ Anterior</button><span style="font-size:.8rem;color:#6B6F75">También podés deslizar</span><button type="button" class="btn-sec peq" data-im="sig">Siguiente ›</button></div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
          '<a class="btn-leer btn-descarga" href="#" download target="_blank" rel="noopener" style="justify-content:center">Descargar</a>'+
          '<button type="button" class="btn-sec" data-im="compartir" style="justify-content:center">Compartir</button>'+
          '<button type="button" class="btn-sec" data-im="cerrar" style="justify-content:center;grid-column:1/-1">Cerrar vista previa</button>'+
        '</div></div>';
    document.body.appendChild(o);
    document.body.style.overflow='hidden'; if(toast) toast.style.zIndex='80';
    try{history.pushState({mdaVista:1},'');}catch(x){}   /* el botón "atrás" del celular cierra la vista previa */

    function quitar(){
      if(e.cerrado) return; e.cerrado=true;
      window.removeEventListener('popstate',quitar); document.removeEventListener('keydown',tecla);
      document.body.style.overflow=cuerpoPrev; if(toast) toast.style.zIndex=zPrev;
      o.remove();
    }
    function cerrar(){ if(history.state&&history.state.mdaVista) history.back(); else quitar(); }
    function tecla(ev){ if(ev.key==='Escape') cerrar(); else if(ev.key==='ArrowLeft') ir(-1); else if(ev.key==='ArrowRight') ir(1); }
    window.addEventListener('popstate',quitar); document.addEventListener('keydown',tecla);

    function q(s){return o.querySelector(s);}
    function nombreDe(r){var n=String(r).split('?')[0].split('/').pop()||'imagen'; try{n=decodeURIComponent(n);}catch(x){} return n;}
    function tipoDe(n){return /\.png$/i.test(n)?'image/png':(/\.jpe?g$/i.test(n)?'image/jpeg':'image/webp');}
    function mostrar(i){
      e.i=i; e.blob=null; var it=lista[i];
      q('.img-titulo').textContent=it.titulo||''; q('.img-cuenta').textContent=lista.length>1?((i+1)+' de '+lista.length):'';
      var im=q('.img-grande'), m=q('.img-msg'); im.style.display='none'; m.style.display='block'; m.textContent='Cargando…';
      im.onload=function(){ if(e.cerrado) return; m.style.display='none'; im.style.display='block'; };
      im.onerror=function(){ m.textContent='No se pudo cargar la imagen. Podés intentar descargarla.'; };
      im.alt=it.titulo||''; im.src=it.imagen;
      var dl=q('a[download]'); dl.href=it.imagen; dl.setAttribute('download',nombreDe(it.imagen));
      var pg=q('.img-pag'); pg.style.display=lista.length>1?'flex':'none';
      var ba=q('[data-im="ant"]'), bs=q('[data-im="sig"]');
      ba.disabled=i<=0; bs.disabled=i>=lista.length-1; ba.style.opacity=ba.disabled?.4:1; bs.style.opacity=bs.disabled?.4:1;
      /* Se baja el archivo por adelantado para poder compartirlo en el momento en que se toca el botón. */
      fetch(it.imagen).then(function(r){return r.ok?r.blob():null;}).then(function(b){ if(b&&e.i===i&&!e.cerrado) e.blob=b; }).catch(function(){});
    }
    function ir(d){ var n=e.i+d; if(n>=0&&n<lista.length) mostrar(n); }
    function copiarEnlace(u){
      if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(function(){C.aviso('Enlace copiado.');},function(){C.aviso('No se pudo compartir.');});
      else C.aviso('No se pudo compartir.');
    }
    /* Se comparte la imagen; si el celular no puede, el enlace; y si tampoco, se copia el enlace. */
    function compartir(){
      var it=lista[e.i], u=new URL(it.imagen,document.baseURI).href, n=nombreDe(it.imagen), f=null;
      try{ if(e.blob&&window.File) f=new File([e.blob],n,{type:e.blob.type||tipoDe(n)}); }catch(x){}
      if(navigator.share){
        var datos=(f&&navigator.canShare&&navigator.canShare({files:[f]}))?{files:[f],title:it.titulo||''}:{title:it.titulo||'',url:u};
        navigator.share(datos).catch(function(er){ if(!er||er.name!=='AbortError') copiarEnlace(u); });
      } else copiarEnlace(u);
    }
    o.addEventListener('click',function(ev){
      var b=ev.target.closest('[data-im]'); if(!b) return;
      var a=b.getAttribute('data-im');
      if(a==='cerrar') cerrar(); else if(a==='compartir') compartir(); else if(a==='ant') ir(-1); else if(a==='sig') ir(1);
    });
    /* Deslizar hacia los costados para cambiar de imagen */
    var x0=null, cu=q('.img-cuerpo');
    cu.addEventListener('touchstart',function(ev){ x0=ev.touches.length===1?ev.touches[0].clientX:null; },{passive:true});
    cu.addEventListener('touchend',function(ev){
      if(x0===null) return; var dx=ev.changedTouches[0].clientX-x0; x0=null;
      if(Math.abs(dx)>70) ir(dx<0?1:-1);
    });
    mostrar(inicio);
  }

  function pMas(){
    fetch('data/mas.json',{cache:'no-cache'}).then(function(r){
      if(r.status===404) return [];
      if(!r.ok) throw new Error('mas');
      return r.json();
    }).then(function(items){
      items=(Array.isArray(items)?items:[]).filter(function(x){return x&&x.imagen;});
      if(!items.length) return vacio('Todavía no hay imágenes. ¡Pronto habrá más!');
      cont.innerHTML='<p class="intro">Imágenes para ver, descargar y compartir.</p><div class="galeria">'+items.map(function(x,i){
        return '<button type="button" class="gal-item" data-img="'+i+'" aria-label="Ver '+esc(x.titulo||'imagen')+'">'+
          '<img src="'+esc(x.miniatura||x.imagen)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">'+
          '<span>'+esc(x.titulo||'')+'</span></button>';
      }).join('')+'</div>';
      cont.addEventListener('click',function(ev){
        var b=ev.target.closest('[data-img]'); if(b) abrirVistaImagen(items,+b.getAttribute('data-img'));
      });
    }).catch(sinDatos);
  }

  /* ---------- Contacto (por correo, sin servidor) ---------- */
  function pContacto(){
    C.get('data/contacto.json').then(function(c){
      var mail=c.correo||'', o=c.oracion||{};
      function mailto(asunto,cuerpo){return 'mailto:'+mail+'?subject='+encodeURIComponent(asunto)+'&body='+encodeURIComponent(cuerpo);}
      cont.innerHTML=
        '<p class="intro">'+esc(c.intro||'')+'</p>'+
        '<a class="btn-leer grande" id="mail-directo" href="'+esc(mailto(c.asunto||'Contacto',c.saludo||''))+'">Escribinos por correo</a>'+
        '<p class="mail-txt">'+esc(mail)+'</p>'+
        '<section class="oracion"><h3>'+esc(o.titulo||'Pedido de oración')+'</h3>'+
        '<p>'+esc(o.texto||'')+'</p>'+
        '<form class="form" id="form-oracion">'+
          '<label for="f-nombre">Tu nombre (opcional)</label><input id="f-nombre" type="text" autocomplete="given-name">'+
          '<label for="f-pedido">Tu pedido</label><textarea id="f-pedido" rows="5" required></textarea>'+
          '<div class="acciones"><button type="submit" class="btn-leer">Enviar por correo</button>'+
          '<button type="button" class="btn-sec" id="f-copiar">Copiar mensaje</button></div>'+
          '<p class="nota">Se abrirá tu aplicación de correo con el mensaje listo. Si no se abre, usá “Copiar mensaje” y pegalo en tu correo.</p>'+
        '</form></section>';
      function armar(){
        var n=document.getElementById('f-nombre').value.trim(), p=document.getElementById('f-pedido').value.trim();
        return {asunto:o.asunto||'Pedido de oración',cuerpo:(n?'Nombre: '+n+'\n\n':'')+p};
      }
      document.getElementById('form-oracion').addEventListener('submit',function(e){
        e.preventDefault(); var m=armar(); location.href=mailto(m.asunto,m.cuerpo);
      });
      document.getElementById('f-copiar').addEventListener('click',function(){
        var p=document.getElementById('f-pedido').value.trim();
        if(!p){C.aviso('Escribí primero tu pedido.');return;}
        var m=armar(), txt='Para: '+mail+'\nAsunto: '+m.asunto+'\n\n'+m.cuerpo;
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(txt).then(function(){C.aviso('Mensaje copiado.');},function(){C.aviso('No se pudo copiar.');});
        } else C.aviso('No se pudo copiar.');
      });
    }).catch(sinDatos);
  }

  var rutas={articulos:pArticulos,articulo:pArticulo,devocional:pDevocional,testimonio:pTestimonio,recursos:pRecursos,contacto:pContacto,mas:pMas};
  C.iniciarPagina(pagina);
  (rutas[pagina]||function(){})();
  base().then(function(b){C.avisos(b[0],b[1]);});
})();
