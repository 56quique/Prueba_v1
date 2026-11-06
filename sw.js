/* Service worker — Mujeres de Acción
   Objetivo: que la app instalada SIEMPRE muestre lo último (páginas, estilos, código, datos, imágenes y PDF)
   y que, sin internet, siga funcionando con lo que ya se vio.

   - Todo lo propio (HTML, CSS, JS, JSON, imágenes, PDF): primero la red, consultando al servidor si cambió
     ("no-cache": si no cambió, el servidor contesta sin reenviar el archivo). Si no hay conexión o tarda
     demasiado, se usa la copia guardada.
   - Tipografías de Google: se guardan la primera vez (no cambian).
   - Se limpian las copias viejas: las de versiones anteriores y las que sobran en la memoria del celular.
   Subí el número de VERSION solo cuando cambie ESTE archivo o la lista PRECARGA. Para publicar contenido
   (artículos, devocionales, imágenes, PDF) no hace falta tocar nada. */
const VERSION = 'mda-v12';
const BASE = VERSION + '-base';     // lo imprescindible para abrir la app sin internet
const EXTRA = VERSION + '-extra';   // lo que se va viendo (imágenes, PDF, datos, etc.); se recorta solo
const MAX_EXTRA = 100;              // cantidad máxima de archivos en EXTRA
const MAX_BYTES = 25 * 1024 * 1024; // no se guardan archivos de más de 25 MB
const ESPERA_RED = 5000;            // ms que se espera a la red antes de usar la copia guardada

const PRECARGA = [
  './', 'index.html', 'manifest.json',
  'articulos.html', 'articulo.html', 'devocional.html', 'testimonio.html', 'recursos.html', 'contacto.html', 'mas.html', 'editoras.html',
  'css/estilos.css',
  'js/app.js', 'js/devocional.js', 'js/novedades.js', 'js/comun.js', 'js/paginas.js', 'js/github.js', 'js/editor.js',
  'icons/icon-192.png', 'icons/icon-512.png'
];
/* El visor de PDF no se descarga al instalar (pesa más de 1 MB): se guarda la primera vez que se usa, pero en BASE para que no se recorte. */
const TARDIAS = ['js/vendor/pdf.esm.min.js', 'js/vendor/pdf.worker.esm.min.js'];
const URLS_BASE = new Set(PRECARGA.concat(TARDIAS).map(u => new URL(u, self.registration.scope).href));
const HOSTS_FUENTES = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(BASE)
      /* Si algún archivo de la lista faltara en el repositorio, igual se instala la versión nueva (antes se frenaba todo). */
      .then(c => Promise.all(PRECARGA.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== BASE && k !== EXTRA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function guardable(res, permitirOpaca) {
  return !!res && ((res.status === 200 && res.type !== 'opaque') || (permitirOpaca && res.type === 'opaque'));
}

function conTimeout(p, ms) {
  return new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error('timeout')), ms);
    p.then(r => { clearTimeout(t); ok(r); }, er => { clearTimeout(t); no(er); });
  });
}

function buscar(req, opciones) { return caches.match(req, opciones); }

async function recortar(cache) {
  const ks = await cache.keys();
  if (ks.length > MAX_EXTRA) await Promise.all(ks.slice(0, ks.length - MAX_EXTRA).map(k => cache.delete(k)));
}

/* Guarda la respuesta: lo imprescindible en BASE, el resto en EXTRA (que se recorta). */
async function guardar(req, res) {
  try {
    const largo = Number(res.headers.get('content-length')) || 0;
    if (largo > MAX_BYTES) return;
    if (URLS_BASE.has(req.url)) {
      await (await caches.open(BASE)).put(req, res);
    } else {
      const c = await caches.open(EXTRA);
      await c.put(req, res);
      await recortar(c);
    }
  } catch (err) { /* si no se puede guardar, no pasa nada: igual se muestra */ }
}

/* Si el archivo ya no existe en el servidor (por ejemplo, un PDF que se borró), también se borra la copia guardada. */
async function olvidar(req) {
  try { for (const n of [BASE, EXTRA]) await (await caches.open(n)).delete(req); } catch (err) { /* nada */ }
}

/* Primero la red (consultando si cambió); si falla o tarda, la copia guardada. */
async function primeroRed(req, opciones) {
  const copia = await buscar(req, opciones);
  const intento = fetch(req, { cache: 'no-cache' }).then(res => {
    if (guardable(res)) guardar(req, res.clone());
    else if (res.status === 404) olvidar(req);
    return res;
  });
  if (!copia) {
    /* Sin copia guardada se espera a la red todo lo que haga falta (por ejemplo, un PDF grande). */
    return intento.catch(async err => {
      if (req.mode === 'navigate') {
        const inicio = await buscar('index.html');
        if (inicio) return inicio;
      }
      throw err;
    });
  }
  try {
    const res = await conTimeout(intento, ESPERA_RED);
    return res.status >= 500 ? copia : res;
  } catch (err) {
    intento.catch(() => {});
    return copia;
  }
}

/* Tipografías: copia guardada al instante y se actualiza por detrás. */
async function copiaYActualiza(req) {
  const copia = await buscar(req);
  const red = fetch(req).then(res => { if (guardable(res, true)) guardar(req, res.clone()); return res; }).catch(() => null);
  return copia || (await red) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;                                   // pedidos por partes: que los resuelva la red
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    return e.respondWith(primeroRed(req, req.mode === 'navigate' ? { ignoreSearch: true } : undefined));
  }
  if (HOSTS_FUENTES.includes(url.hostname)) return e.respondWith(copiaYActualiza(req));
  /* El resto (por ejemplo la API de GitHub del editor) pasa directo, sin guardarse nunca. */
});
