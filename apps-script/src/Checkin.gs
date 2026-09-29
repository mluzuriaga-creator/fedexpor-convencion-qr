/**
 * Registro de llegadas (SPEC §10). Toda escritura con LockService e idempotente por clientId.
 * Modo PRUEBA: se anota en la pestaña Pruebas y no toca el Maestro.
 * Una llegada solo la registra un lector con clave: la página /c nunca escribe.
 */

var DESHACER_MAX_OPERADOR = 5;        // últimos registros propios que un operador puede deshacer
var DESHACER_VENTANA_MS = 10 * 60 * 1000;
var CLIENTID_CACHE_SEG = 21600;       // 6 h: reintentos del mismo registro devuelven la misma respuesta

function horaLocal_(ms) { return fmtFecha_(new Date(ms || Date.now()), 'HH:mm:ss'); }

function datosPersona_(cfg, r) {
  var id = parsearId_(r[M.ID]);
  return { uid: String(r[M.UID]), id: r[M.ID], nombre: etiquetaNombre_(cfg, r),
    empresa: esCupoSinNombre_(r) ? '' : String(r[M.EMPRESA] || ''), tipo: tipoCredencial_(cfg, id ? id.sigla : '', r[M.FUENTE]),
    cupo: esCupoSinNombre_(r), stickerMano: cfg.corte && r[M.STICKER] !== 'Sí',
    hora: String(r[M.HORA] || ''), lector: String(r[M.LECTOR] || ''), retirado: r[M.ESTADO_INSC] === ESTADO_RETIRADO };
}

function versionPruebas_(cfg) { return String(cfg.valores.PRUEBA_VERSION || '1'); }

/**
 * b: { lector, token | uid, clientId, horaDispositivo, reactivar }
 * Respuestas: OK · YA · INVALIDO · RETIRADO · CERRADO (antes de la apertura) · REPETIDO (mismo clientId)
 */
function registrarLlegada_(b, origen) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cache = CacheService.getScriptCache();
  var claveCid = b.clientId ? 'cid_' + b.clientId : '';
  if (claveCid) { var previo = cache.get(claveCid); if (previo) return JSON.parse(previo); }

  var estado = estadoLector_(b.lector);
  if (!estado.abierto) return { ok: false, codigo: 'CERRADO', mensaje: 'Próximamente inicia el evento', datos: { apertura: estado.apertura } };

  var lock = tomarBloqueo_(10000);
  var res;
  try {
    var cfg = leerConfig_(ss), m = leerMaestro_(ss);
    var i = -1;
    for (var k = 0; k < m.filas.length; k++) {
      var r0 = m.filas[k];
      if (!r0[M.UID]) continue;
      if ((b.token && String(r0[M.TOKEN]) === String(b.token)) || (!b.token && b.uid && String(r0[M.UID]) === String(b.uid))) { i = k; break; }
    }
    var hora = horaDispositivoValida_(b.horaDispositivo) || horaLocal_();
    if (i === -1) {
      res = { ok: false, codigo: 'INVALIDO', mensaje: 'Código no válido' };
      anotarPrueba_(ss, estado.modo, b, 'INVALIDO', '', '', String(b.token || b.uid || '').slice(0, 8) + '…');
    } else {
      var r = m.filas[i], d = datosPersona_(cfg, r);
      if (estado.modo === 'PRUEBA') {
        res = llegadaPrueba_(ss, cfg, b, d, origen, hora, cache);
      } else if (d.retirado && !(esMaster_(b.lector) && b.reactivar)) {
        res = { ok: false, codigo: 'RETIRADO', mensaje: 'Inscripción retirada. Derivar a supervisor.', datos: d };
        registrarBitacora_(ss, [eventoBitacora_('CANCELADO_INTENTO', d.uid, d.id, origen, b.lector)]);
      } else if (r[M.ESTADO] === LLEGO) {
        // Ya ingresó. Si este registro (hecho sin señal) es más temprano, gana la hora más temprana.
        if (hora < String(r[M.HORA] || '99')) {
          m.hoja.getRange(i + 2, M.HORA + 1, 1, 2).setValues([[hora, b.lector]]);
          registrarBitacora_(ss, [eventoBitacora_('DUPLICADO', d.uid, d.id, 'Se conserva la hora más temprana ' + hora + ' (antes ' + r[M.HORA] + ' ' + r[M.LECTOR] + ')', b.lector)]);
          d.hora = hora; d.lector = b.lector;
          res = { ok: true, codigo: 'OK', mensaje: 'Acceso correcto', datos: d };
        } else {
          registrarBitacora_(ss, [eventoBitacora_('DUPLICADO', d.uid, d.id, 'Ya había ingresado ' + r[M.HORA] + ' ' + r[M.LECTOR], b.lector)]);
          res = { ok: false, codigo: 'YA', mensaje: 'Ya ingresó', datos: d };
        }
      } else {
        m.hoja.getRange(i + 2, M.ESTADO + 1, 1, 4).setValues([[LLEGO, hora, b.lector, origen]]);
        var accion = d.retirado ? 'REACTIVADO' : (origen === 'Manual' ? 'MANUAL' : 'INGRESO');
        registrarBitacora_(ss, [[new Date(), b.horaDispositivo ? String(b.horaDispositivo) : '', b.lector, accion, d.uid, d.id, origen, b.clientId || '']]);
        recordarParaDeshacer_(cache, b.lector, d.uid);
        d.hora = hora; d.lector = b.lector;
        res = { ok: true, codigo: 'OK', mensaje: d.retirado ? 'Reactivado y registrado' : 'Acceso correcto', datos: d };
        cache.remove('panel');
      }
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  if (claveCid) cache.put(claveCid, JSON.stringify(res), CLIENTID_CACHE_SEG);
  return res;
}

/** Hora del teléfono (registro hecho sin señal) si es de hoy y no del futuro; si no, se usa la del servidor. */
function horaDispositivoValida_(v) {
  var t = Number(v);
  if (!t || t > Date.now() + 60000 || Date.now() - t > 12 * 3600 * 1000) return '';
  if (fmtFecha_(new Date(t), 'yyyy-MM-dd') !== fmtFecha_(new Date(), 'yyyy-MM-dd')) return '';
  return horaLocal_(t);
}

function anotarPrueba_(ss, modo, b, accion, uid, id, detalle) {
  if (modo !== 'PRUEBA') return;
  var h = ss.getSheetByName(HOJA.PRUEBAS);
  if (!h) return;
  asegurarFilas_(h, h.getLastRow() + 1);
  h.getRange(h.getLastRow() + 1, 1, 1, 8).setValues([[new Date(), b.horaDispositivo ? String(b.horaDispositivo) : '', b.lector, accion, uid, id, detalle, b.clientId || '']]);
}

/** Simulacro: mismos colores y reglas, pero solo en la pestaña Pruebas. El Maestro no cambia. */
function llegadaPrueba_(ss, cfg, b, d, origen, hora, cache) {
  var k = 'prueba_' + versionPruebas_(cfg) + '_' + d.uid;
  if (d.retirado && !(esMaster_(b.lector) && b.reactivar)) {
    anotarPrueba_(ss, 'PRUEBA', b, 'CANCELADO_INTENTO', d.uid, d.id, origen);
    return { ok: false, codigo: 'RETIRADO', mensaje: 'Inscripción retirada. Derivar a supervisor.', datos: d };
  }
  var previo = cache.get(k);
  if (previo) {
    var p = JSON.parse(previo);
    d.hora = p.h; d.lector = p.l;
    anotarPrueba_(ss, 'PRUEBA', b, 'DUPLICADO', d.uid, d.id, 'Ya ingresó ' + p.h + ' ' + p.l);
    return { ok: false, codigo: 'YA', mensaje: 'Ya ingresó (prueba)', datos: d };
  }
  cache.put(k, JSON.stringify({ h: hora, l: b.lector }), CLIENTID_CACHE_SEG);
  anotarPrueba_(ss, 'PRUEBA', b, origen === 'Manual' ? 'MANUAL' : 'INGRESO', d.uid, d.id, origen);
  recordarParaDeshacer_(cache, b.lector, d.uid);
  d.hora = hora; d.lector = b.lector;
  return { ok: true, codigo: 'OK', mensaje: 'Acceso correcto (prueba)', datos: d };
}

function recordarParaDeshacer_(cache, lector, uid) {
  var k = 'recientes_' + lector, l = JSON.parse(cache.get(k) || '[]');
  l.unshift({ u: uid, t: Date.now() });
  cache.put(k, JSON.stringify(l.slice(0, DESHACER_MAX_OPERADOR)), CLIENTID_CACHE_SEG);
}

/** Operador: sus últimos 5 registros, dentro de 10 min. Máster: cualquiera. */
function deshacerLlegada_(b) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), cache = CacheService.getScriptCache();
  var estado = estadoLector_(b.lector);
  if (!esMaster_(b.lector)) {
    var l = JSON.parse(cache.get('recientes_' + b.lector) || '[]');
    var ok = l.some(function (x) { return x.u === b.uid && Date.now() - x.t <= DESHACER_VENTANA_MS; });
    if (!ok) return { ok: false, codigo: 'NO_PERMITIDO', mensaje: 'Solo puede deshacer sus últimos ' + DESHACER_MAX_OPERADOR + ' registros, dentro de 10 minutos. Pida ayuda a un máster.' };
  }
  var cfg = leerConfig_(ss);
  if (estado.modo === 'PRUEBA') {
    cache.remove('prueba_' + versionPruebas_(cfg) + '_' + b.uid);
    anotarPrueba_(ss, 'PRUEBA', b, 'DESHACER', b.uid, '', '');
    return { ok: true, codigo: 'OK', mensaje: 'Registro deshecho (prueba)' };
  }
  var lock = tomarBloqueo_(10000);
  try {
    var m = leerMaestro_(ss);
    for (var i = 0; i < m.filas.length; i++) {
      var r = m.filas[i];
      if (String(r[M.UID]) !== String(b.uid)) continue;
      if (r[M.ESTADO] !== LLEGO) return { ok: false, codigo: 'SIN_LLEGADA', mensaje: 'Esta persona no tiene llegada registrada' };
      m.hoja.getRange(i + 2, M.ESTADO + 1, 1, 4).setValues([['', '', '', '']]);
      registrarBitacora_(ss, [eventoBitacora_('DESHACER', r[M.UID], r[M.ID], 'Llegada ' + r[M.HORA] + ' ' + r[M.LECTOR] + ' deshecha', b.lector)]);
      cache.remove('panel');
      SpreadsheetApp.flush();
      return { ok: true, codigo: 'OK', mensaje: 'Registro deshecho' };
    }
    return { ok: false, codigo: 'INVALIDO', mensaje: 'Persona no encontrada' };
  } finally {
    lock.releaseLock();
  }
}

/** Observación o nombre anotado en la mesa para un cupo. Se agrega en la columna Observación y en la Bitácora. */
function agregarObservacion_(b, etiqueta) {
  var texto = String(b.texto || '').trim().slice(0, 300);
  if (!texto) return { ok: false, codigo: 'VACIO', mensaje: 'Escriba el texto' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (estadoLector_(b.lector).modo === 'PRUEBA') {
    anotarPrueba_(ss, 'PRUEBA', b, etiqueta === 'Nombre en mesa' ? 'NOMBRE_CUPO' : 'OBSERVACION', b.uid, '', texto);
    return { ok: true, codigo: 'OK', mensaje: 'Guardado (prueba)' };
  }
  var lock = tomarBloqueo_(10000);
  try {
    var m = leerMaestro_(ss);
    for (var i = 0; i < m.filas.length; i++) {
      var r = m.filas[i];
      if (String(r[M.UID]) !== String(b.uid)) continue;
      var previo = String(r[M.OBS] || '');
      var nuevo = (previo ? previo + ' | ' : '') + etiqueta + ': ' + texto + ' (' + b.lector + ' ' + horaLocal_() + ')';
      m.hoja.getRange(i + 2, M.OBS + 1).setValue(nuevo);
      registrarBitacora_(ss, [eventoBitacora_(etiqueta === 'Nombre en mesa' ? 'NOMBRE_CUPO' : 'OBSERVACION', r[M.UID], r[M.ID], texto, b.lector)]);
      SpreadsheetApp.flush();
      return { ok: true, codigo: 'OK', mensaje: 'Guardado' };
    }
    return { ok: false, codigo: 'INVALIDO', mensaje: 'Persona no encontrada' };
  } finally {
    lock.releaseLock();
  }
}

function cambiarModo_(b) {
  if (!esMaster_(b.lector)) return { ok: false, codigo: 'NO_PERMITIDO', mensaje: 'Solo un lector máster cambia el modo' };
  var modo = String(b.modo || '').toUpperCase();
  if (modo !== 'PRUEBA' && modo !== 'REAL') return { ok: false, codigo: 'MODO', mensaje: 'Modo inválido' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = tomarBloqueo_(10000);
  try {
    escribirConfig_(ss, 'MODO', modo);
    registrarBitacora_(ss, [eventoBitacora_('MODO', '', '', 'MODO = ' + modo, b.lector)]);
  } finally { lock.releaseLock(); }
  return { ok: true, codigo: 'OK', mensaje: 'Modo ' + modo, datos: estadoLector_(b.lector) };
}

/**
 * Registro en sitio (NR): crea la fila en la pestaña «Registro en sitio» (con su UID, para que la sincronización
 * la reconozca) y en el Maestro con llegada ya registrada. Sticker a mano.
 */
function registroEnSitio_(b) {
  var nombre = String(b.nombre || '').trim(), empresa = String(b.empresa || '').trim();
  if (!nombre || !empresa) return { ok: false, codigo: 'DATOS', mensaje: 'Nombre y empresa son obligatorios' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var estado = estadoLector_(b.lector);
  if (!estado.abierto) return { ok: false, codigo: 'CERRADO', mensaje: 'Próximamente inicia el evento' };
  var cache = CacheService.getScriptCache(), claveCid = b.clientId ? 'cid_' + b.clientId : '';
  if (claveCid) { var previo = cache.get(claveCid); if (previo) return JSON.parse(previo); }
  if (estado.modo === 'PRUEBA') {
    anotarPrueba_(ss, 'PRUEBA', b, 'EN_SITIO', '', '0NR', nombre + ' · ' + empresa);
    return { ok: true, codigo: 'OK', mensaje: 'Registro en sitio (prueba)', datos: { id: '0NR', nombre: nombre, empresa: empresa, tipo: 'Registro en sitio', stickerMano: true } };
  }
  var lock = tomarBloqueo_(10000), res;
  try {
    var cfg = leerConfig_(ss);
    var o = cfg.origenes.filter(function (x) { return x.sigla === 'NR'; })[0];
    if (!o) throw new Error('Config no declara la pestaña de Registro en sitio (sigla NR)');
    var hoja = ss.getSheetByName(o.hoja);
    var enc = localizarEncabezado_(hoja, cfg.filasBusqueda);
    if (!enc) throw new Error('No se encontró el encabezado de «' + o.hoja + '»');
    var col = function (h) { var i = enc.indice[normTexto_(h)]; if (i === undefined) throw new Error('Falta «' + h + '» en «' + o.hoja + '»'); return i; };
    var cN = col(ENC.nombre), cE = col(ENC.empresa), cC = col(ENC.cargo), cM = col(ENC.correo), cT = col(ENC.telefono), cU = col(ENC.uid);
    // Primera fila vacía dentro de la tabla (debajo del encabezado).
    var nDatos = Math.max(hoja.getMaxRows() - enc.fila, 1);
    var nombres = hoja.getRange(enc.fila + 1, cN + 1, nDatos, 1).getValues();
    var k = 0; while (k < nombres.length && String(nombres[k][0]).trim()) k++;
    var filaHoja = enc.fila + 1 + k;
    asegurarFilas_(hoja, filaHoja);
    var ancho = Math.max(cN, cE, cC, cM, cT, cU) + 1;
    var fila = hoja.getRange(filaHoja, 1, 1, ancho).getValues()[0];
    var uid = nuevoUid_();
    fila[cN] = nombre; fila[cE] = empresa; fila[cC] = String(b.cargo || '').trim();
    fila[cM] = String(b.correo || '').trim(); fila[cT] = String(b.celular || '').trim(); fila[cU] = uid;
    hoja.getRange(filaHoja, 1, 1, ancho).setValues([fila]);

    var m = leerMaestro_(ss), asignador = crearAsignadorIds_(m.filas);
    var id = asignador.siguiente('NR');
    PropertiesService.getScriptProperties().setProperties(asignador.propiedades(), false);
    var r = MAESTRO_COLUMNAS.map(function () { return ''; });
    var ahora = new Date(), hora = horaLocal_();
    r[M.UID] = uid; r[M.ID] = id; r[M.FUENTE] = o.tipo; r[M.NOMBRE] = nombre; r[M.EMPRESA] = empresa; r[M.CARGO] = fila[cC];
    r[M.CORREO] = fila[cM]; r[M.CELULAR] = fila[cT]; r[M.ESTADO_INSC] = ESTADO_ACTIVO; r[M.STICKER] = 'No';
    r[M.ESTADO] = LLEGO; r[M.HORA] = hora; r[M.LECTOR] = b.lector; r[M.ORIGEN] = 'En sitio';
    r[M.TOKEN] = nuevoToken_(); r[M.PESTANA] = o.hoja; r[M.ALTA] = ahora; r[M.ACTUALIZADO] = ahora;
    r[M.ENVIAR] = false; r[M.WA_ENVIADO] = false;
    asegurarFilas_(m.hoja, m.filas.length + 2);
    m.hoja.getRange(m.filas.length + 2, 1, 1, MAESTRO_COLUMNAS.length).setValues([r]);
    registrarBitacora_(ss, [[ahora, '', b.lector, 'EN_SITIO', uid, id, nombre + ' · ' + empresa, b.clientId || '']]);
    cache.remove('panel');
    SpreadsheetApp.flush();
    res = { ok: true, codigo: 'OK', mensaje: 'Registrado en sitio', datos: { uid: uid, id: id, nombre: nombre, empresa: empresa, tipo: o.tipo, stickerMano: true, hora: hora, lector: b.lector } };
  } finally {
    lock.releaseLock();
  }
  if (claveCid) cache.put(claveCid, JSON.stringify(res), CLIENTID_CACHE_SEG);
  return res;
}

/** Menú: vacía la pestaña Pruebas y reinicia el simulacro (los registros de prueba anteriores dejan de contar). */
function menuLimpiarPruebas() {
  var ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ui.alert('Limpiar pruebas', 'Se vacía la pestaña Pruebas y se reinicia el simulacro. El Maestro no cambia. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var lock = tomarBloqueo_(30000);
  try {
    var h = ss.getSheetByName(HOJA.PRUEBAS);
    if (h && h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).clearContent();
    var cfg = leerConfig_(ss);
    escribirConfig_(ss, 'PRUEBA_VERSION', String(Number(versionPruebas_(cfg)) + 1));
    registrarBitacora_(ss, [eventoBitacora_('LIMPIAR_PRUEBAS', '', '', 'Pestaña Pruebas vaciada')]);
  } finally { lock.releaseLock(); }
  ui.alert('Pruebas limpias. Recuerde activar el modo REAL desde un lector máster antes de abrir el registro.');
}
