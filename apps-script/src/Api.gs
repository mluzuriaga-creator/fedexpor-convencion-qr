/**
 * API del Web App (SPEC §13). La usan el lector (con clave) y el panel (público, sin datos de contacto).
 * Los POST llegan con Content-Type text/plain y JSON en el cuerpo (evita el preflight CORS).
 * Respuesta siempre { ok, codigo, mensaje, datos }.
 */

/** Lector → propiedad de Script Properties con su clave. */
var LECTORES = {
  'M1-A': 'KEY_M1A', 'M1-B': 'KEY_M1B', 'M2-A': 'KEY_M2A', 'M2-B': 'KEY_M2B',
  'MASTER-1': 'KEY_MASTER1', 'MASTER-2': 'KEY_MASTER2'
};
var API_INTENTOS_MAX = 8;          // claves erradas por lector antes de bloquear
var API_BLOQUEO_SEG = 600;         // 10 min de bloqueo
var PANEL_CACHE_SEG = 10;

function esMaster_(lector) { return String(lector || '').indexOf('MASTER') === 0; }

function respuesta_(ok, codigo, mensaje, datos) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok, codigo: codigo, mensaje: mensaje || '', datos: datos || null }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.action) || '';
    if (a === 'config') return respuesta_(true, 'OK', '', configPublica_());
    if (a === 'panel') return respuesta_(true, 'OK', '', panelDatos_());
    return respuesta_(false, 'ACCION', 'Acción desconocida');
  } catch (err) {
    return respuesta_(false, 'ERROR', String(err.message || err));
  }
}

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return respuesta_(false, 'FORMATO', 'Solicitud inválida'); }
  try {
    var auth = autenticar_(b.lector, b.clave);
    if (!auth.ok) return respuesta_(false, auth.codigo, auth.mensaje);
    switch (b.action) {
      case 'login': return respuesta_(true, 'OK', '', estadoLector_(b.lector));
      case 'padron': return respuesta_(true, 'OK', '', padron_());
      case 'checkin': return resultado_(registrarLlegada_(b, 'QR'));
      case 'checkin_manual': return resultado_(registrarLlegada_(b, 'Manual'));
      case 'deshacer': return resultado_(deshacerLlegada_(b));
      case 'observacion': return resultado_(agregarObservacion_(b, 'Observación'));
      case 'nombre_cupo': return resultado_(agregarObservacion_(b, 'Nombre en mesa'));
      case 'en_sitio': return resultado_(registroEnSitio_(b));
      case 'modo': return resultado_(cambiarModo_(b));
      default: return respuesta_(false, 'ACCION', 'Acción desconocida');
    }
  } catch (err) {
    return respuesta_(false, 'ERROR', String(err.message || err));
  }
}

function resultado_(r) { return respuesta_(r.ok, r.codigo, r.mensaje, r.datos); }

/** Valida lector + clave contra Script Properties. Bloquea 10 min tras varios intentos fallidos. */
function autenticar_(lector, clave) {
  var prop = LECTORES[String(lector || '')];
  if (!prop) return { ok: false, codigo: 'LECTOR', mensaje: 'Lector desconocido' };
  var cache = CacheService.getScriptCache(), kf = 'fallos_' + prop;
  var fallos = Number(cache.get(kf) || 0);
  if (fallos >= API_INTENTOS_MAX) return { ok: false, codigo: 'BLOQUEADO', mensaje: 'Demasiados intentos. Espere 10 minutos.' };
  var esperada = PropertiesService.getScriptProperties().getProperty(prop);
  if (!esperada) return { ok: false, codigo: 'SIN_CLAVE', mensaje: 'Este lector no tiene clave configurada (' + prop + ').' };
  if (String(clave || '') !== String(esperada)) {
    cache.put(kf, String(fallos + 1), API_BLOQUEO_SEG);
    return { ok: false, codigo: 'CLAVE', mensaje: 'Clave incorrecta' };
  }
  return { ok: true };
}

/** Modo y apertura. En PRUEBA todos escanean (a la pestaña Pruebas). En REAL, los operadores desde la apertura; los máster siempre. */
function estadoLector_(lector) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = leerConfig_(ss);
  var modo = String(cfg.valores.MODO || 'PRUEBA').toUpperCase() === 'REAL' ? 'REAL' : 'PRUEBA';
  var apertura = aperturaMs_(cfg);
  var abierto = modo === 'PRUEBA' || esMaster_(lector) || Date.now() >= apertura;
  return { lector: lector, master: esMaster_(lector), modo: modo, abierto: abierto, apertura: apertura,
    evento: cfg.valores.EVENTO_NOMBRE, fecha: cfg.valores.EVENTO_FECHA, lugar: cfg.valores.EVENTO_LUGAR, corte: cfg.corte };
}

function aperturaMs_(cfg) {
  var f = String(cfg.valores.EVENTO_FECHA_ISO || '2026-09-30'), h = String(cfg.valores.EVENTO_APERTURA_REGISTRO || '07:00');
  return new Date(f + 'T' + (h.length === 5 ? h : '07:00') + ':00-05:00').getTime(); // America/Guayaquil (UTC−5, sin horario de verano)
}

function configPublica_() {
  var cfg = leerConfig_(SpreadsheetApp.getActiveSpreadsheet());
  return { evento: cfg.valores.EVENTO_NOMBRE, fecha: cfg.valores.EVENTO_FECHA, hora: cfg.valores.EVENTO_HORA,
    lugar: cfg.valores.EVENTO_LUGAR, agenda: cfg.valores.URL_AGENDA };
}

// ---------------------------------------------------------------------------
// Padrón para el lector (con clave): permite validar al instante y funcionar sin señal
// ---------------------------------------------------------------------------

function padron_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = leerConfig_(ss), m = leerMaestro_(ss);
  var lista = [];
  m.filas.forEach(function (r) {
    if (!r[M.UID] || !parsearId_(r[M.ID])) return;
    var id = parsearId_(r[M.ID]);
    lista.push({
      t: String(r[M.TOKEN]), u: String(r[M.UID]), id: r[M.ID], n: etiquetaNombre_(cfg, r),
      e: esCupoSinNombre_(r) ? '' : String(r[M.EMPRESA] || ''), tp: tipoCredencial_(cfg, id.sigla, r[M.FUENTE]),
      ret: r[M.ESTADO_INSC] === ESTADO_RETIRADO, cupo: esCupoSinNombre_(r),
      ll: r[M.ESTADO] === LLEGO, h: String(r[M.ESTADO + 1] || ''), l: String(r[M.ESTADO + 2] || ''),
      sm: cfg.corte && r[M.STICKER] !== 'Sí'
    });
  });
  var e = estadoLector_('');
  return { generado: Date.now(), modo: e.modo, personas: lista };
}

// ---------------------------------------------------------------------------
// Panel en vivo (público): sin correo ni celular. Caché de 10 s.
// ---------------------------------------------------------------------------

function panelDatos_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('panel');
  if (c) return JSON.parse(c);
  var ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = leerConfig_(ss), m = leerMaestro_(ss);
  var activos = [], llegaron = [], porTipo = {}, porLector = {}, franjas = {};
  m.filas.forEach(function (r) {
    if (!r[M.UID] || !parsearId_(r[M.ID])) return;
    var llego = r[M.ESTADO] === LLEGO;
    if (r[M.ESTADO_INSC] !== ESTADO_ACTIVO && !llego) return;
    var id = parsearId_(r[M.ID]), tipo = tipoCredencial_(cfg, id.sigla, r[M.FUENTE]);
    var p = { id: r[M.ID], n: etiquetaNombre_(cfg, r), e: esCupoSinNombre_(r) ? '' : String(r[M.EMPRESA] || ''),
      c: esCupoSinNombre_(r) ? '' : String(r[M.CARGO] || ''), tp: tipo, h: String(r[M.ESTADO + 1] || ''),
      l: String(r[M.ESTADO + 2] || ''), o: String(r[M.ESTADO + 3] || '') };
    porTipo[tipo] = porTipo[tipo] || { esperados: 0, llegaron: 0 };
    if (r[M.ESTADO_INSC] === ESTADO_ACTIVO) { porTipo[tipo].esperados++; activos.push(p); }
    if (llego) {
      porTipo[tipo].llegaron++; llegaron.push(p);
      porLector[p.l] = (porLector[p.l] || 0) + 1;
      var hh = /^(\d{2}):(\d{2})/.exec(p.h);
      if (hh) { var k = hh[1] + ':' + ('0' + Math.floor(Number(hh[2]) / 15) * 15).slice(-2); franjas[k] = (franjas[k] || 0) + 1; }
    }
  });
  llegaron.sort(function (a, b) { return a.h < b.h ? 1 : -1; });
  var faltan = activos.filter(function (p) { return !p.h; });
  var datos = {
    generado: fmtFecha_(new Date(), 'HH:mm:ss'), evento: cfg.valores.EVENTO_NOMBRE,
    esperados: activos.length, llegaron: llegaron.length, faltan: faltan.length,
    porTipo: porTipo, porLector: porLector, franjas: franjas,
    ultimos: llegaron.slice(0, 10), listaLlegaron: llegaron, listaFaltan: faltan,
    enSitio: llegaron.filter(function (p) { return p.o === 'En sitio'; })
  };
  try { cache.put('panel', JSON.stringify(datos), PANEL_CACHE_SEG); } catch (err) { /* respuesta grande: sin caché */ }
  return datos;
}
