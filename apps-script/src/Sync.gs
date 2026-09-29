/**
 * Sincronización pestañas origen → Maestro (SPEC §5).
 *
 * El script SOLO lee las pestañas declaradas en Config y SOLO escribe su columna
 * «UID (no editar)». Nunca ordena, mueve ni borra nada en ellas.
 * En el Maestro nada se borra: quien desaparece pasa a Retirado.
 * Una sincronización nunca revierte una llegada.
 */

var MAESTRO_COLUMNAS = [
  'UID', 'ID', 'Fuente', 'Nombre', 'Empresa', 'Cargo', 'Correo', 'Celular', 'Estado inscripción', 'Alertas',
  'Generar', 'Credencial', 'Enviar correo', 'Estado correo', 'WhatsApp', 'WA enviado', 'Recordatorio 1', 'Recordatorio 2',
  'Sticker impreso', 'Estado', 'Hora de llegada', 'Lector', 'Origen registro', 'Observación', 'Bienvenida', 'Token',
  'Pestaña', 'Alta', 'Actualizado', 'IDs anteriores', 'Huella credencial', 'Cupo de', 'Cupo n°'
];

// Índices 0-based de las columnas del Maestro.
var M = {
  UID: 0, ID: 1, FUENTE: 2, NOMBRE: 3, EMPRESA: 4, CARGO: 5, CORREO: 6, CELULAR: 7, ESTADO_INSC: 8, ALERTAS: 9,
  CREDENCIAL: 11, ENVIAR: 12, ESTADO_CORREO: 13, WHATSAPP: 14, WA_ENVIADO: 15, RECORDATORIO_1: 16, RECORDATORIO_2: 17, STICKER: 18, ESTADO: 19, HORA: 20, LECTOR: 21, ORIGEN: 22, OBS: 23, TOKEN: 25, PESTANA: 26, ALTA: 27, ACTUALIZADO: 28, IDS_ANT: 29, HUELLA: 30, CUPO_DE: 31, CUPO_N: 32
};
// Columnas agregadas en etapas posteriores: si faltan al final del Maestro, se agregan solas.
var MAESTRO_COLUMNAS_BASE = 30;

var ESTADO_ACTIVO = 'Activo';
var ESTADO_RETIRADO = 'Retirado';
var LLEGO = 'Llegó';

var ALERTA = {
  SIN_CORREO: 'Sin correo',
  SIN_CELULAR: 'Sin celular',
  SIN_AMBOS: 'Sin correo ni celular',
  CORREO_INVALIDO: 'Correo inválido',
  CELULAR_INVALIDO: 'Celular inválido',
  CORREO_COMPARTIDO: 'Correo compartido',
  CAMBIO_FUENTE: 'Cambió de fuente',
  CAMBIO_TIPO: 'Cambió de tipo',
  DOS_SUBCATEGORIAS: 'Revisar: Diplomado y B2B a la vez',
  RETIRADO_TRAS_LLEGAR: 'Revisar: retirado tras llegar',
  CREDENCIAL_DESACTUALIZADA: 'Credencial desactualizada',
  SIN_LINK_PUBLICO: 'Sin link público',
  CUPO_SIN_NOMBRE: 'Cupo sin nombre'
};
// Las que recalcula la sincronización. Cualquier otra alerta del Maestro se conserva.
var ALERTAS_SYNC = [ALERTA.SIN_CORREO, ALERTA.SIN_CELULAR, ALERTA.SIN_AMBOS, ALERTA.CORREO_INVALIDO,
  ALERTA.CELULAR_INVALIDO, ALERTA.CORREO_COMPARTIDO, ALERTA.CAMBIO_FUENTE, ALERTA.CAMBIO_TIPO,
  ALERTA.DOS_SUBCATEGORIAS, ALERTA.RETIRADO_TRAS_LLEGAR, ALERTA.CREDENCIAL_DESACTUALIZADA, ALERTA.CUPO_SIN_NOMBRE];

/** Fila del Maestro que es un cupo todavía sin persona. */
function esCupoSinNombre_(r) {
  return !String(r[M.NOMBRE] || '').trim() && !!String(r[M.CUPO_DE] || '').trim();
}
var SEP_ALERTAS = ' · ';
// Alerta variable («… de 3S»): también la recalcula la sincronización.
var PREFIJO_POSIBLE_DUPLICADO = 'Revisar: posible duplicado de ';
var PALABRAS_VACIAS = ['de', 'del', 'la', 'las', 'los', 'y', 'e'];

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

function menuSincronizar() {
  try {
    var r = sincronizar_({ interactivo: true });
    mostrarTexto_('Sincronizar Maestro', informeSincronizacion_(r));
  } catch (e) {
    SpreadsheetApp.getUi().alert('La sincronización se detuvo', String(e.message || e), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * opts.interactivo: pide confirmación con un diálogo si hay muchos retiros.
 * opts.confirmarRetiros: true acepta los retiros sin diálogo (solo para pruebas); false pausa.
 * Devuelve { estado: 'OK' | 'PAUSA' | 'CANCELADO' | 'ERROR', ... }.
 */
function sincronizar_(opts) {
  opts = opts || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = leerConfig_(ss);

  // 1) Plan sin bloqueo, para poder preguntar sin frenar a otros procesos.
  var plan = planificar_(ss, cfg);
  if (!plan.ok) return detener_(ss, plan);

  var confirmados = null;
  if (plan.retirosNuevos.length > cfg.maxRetiros) {
    if (opts.confirmarRetiros === true) {
      confirmados = plan.retirosNuevos.map(function (x) { return x.uid; });
    } else if (opts.interactivo) {
      var ui = SpreadsheetApp.getUi();
      var lista = plan.retirosNuevos.map(function (x) { return '• ' + x.id + ' — ' + x.nombre + ' (' + x.pestana + ')'; });
      var resp = ui.alert('Confirmar retiros',
        plan.retirosNuevos.length + ' personas ya no aparecen en ninguna pestaña y pasarían a Retirado:\n\n' +
        lista.join('\n') + '\n\nSus ID no se reutilizan. ¿Continuar?', ui.ButtonSet.YES_NO);
      if (resp !== ui.Button.YES) {
        registrarBitacora_(ss, [eventoBitacora_('SYNC_CANCELADA', '', '', 'El responsable no confirmó ' + plan.retirosNuevos.length + ' retiros')]);
        return { estado: 'CANCELADO', plan: plan };
      }
      confirmados = plan.retirosNuevos.map(function (x) { return x.uid; });
    } else {
      return { estado: 'PAUSA', plan: plan, retiros: plan.retirosNuevos };
    }
  }

  // 2) Bajo bloqueo: se recalcula el plan y se escribe.
  var lock = tomarBloqueo_(30000);
  try {
    cfg = leerConfig_(ss);
    plan = planificar_(ss, cfg);
    if (!plan.ok) return detener_(ss, plan);
    if (plan.retirosNuevos.length > cfg.maxRetiros) {
      var cubiertos = confirmados && plan.retirosNuevos.every(function (x) { return confirmados.indexOf(x.uid) !== -1; });
      if (!cubiertos) {
        return { estado: 'PAUSA', plan: plan, retiros: plan.retirosNuevos,
          mensaje: 'La lista de retiros cambió mientras se confirmaba. Vuelva a sincronizar.' };
      }
    }
    plan.respaldo = respaldarMaestro_(ss, cfg, plan.maestro);
    aplicar_(ss, cfg, plan);
    return { estado: 'OK', plan: plan };
  } finally {
    lock.releaseLock();
  }
}

function detener_(ss, plan) {
  registrarBitacora_(ss, [eventoBitacora_('SYNC_DETENIDA', '', '', plan.errores.join(' | '))]);
  return { estado: 'ERROR', errores: plan.errores, plan: plan };
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function leerMaestro_(ss) {
  var hoja = ss.getSheetByName(HOJA.MAESTRO);
  if (!hoja) throw new Error('Falta la pestaña Maestro. Ejecute «Fedexpor QR → Instalar / reparar estructura».');
  var nCol = MAESTRO_COLUMNAS.length;
  if (hoja.getMaxColumns() < nCol) hoja.insertColumnsAfter(hoja.getMaxColumns(), nCol - hoja.getMaxColumns());
  var enc = hoja.getRange(1, 1, 1, nCol).getDisplayValues()[0];
  // Columnas agregadas en etapas posteriores: se completan solas si faltan AL FINAL (nunca se mueve nada).
  var baseOk = MAESTRO_COLUMNAS.slice(0, MAESTRO_COLUMNAS_BASE).every(function (c, i) { return String(enc[i]).trim() === c; });
  if (baseOk) {
    var primeraVacia = -1;
    for (var j = MAESTRO_COLUMNAS_BASE; j < nCol; j++) { if (String(enc[j]).trim() === '') { primeraVacia = j; break; } }
    var restoVacio = primeraVacia !== -1 && enc.slice(primeraVacia).every(function (x) { return String(x).trim() === ''; });
    var previasOk = primeraVacia !== -1 && MAESTRO_COLUMNAS.slice(0, primeraVacia).every(function (c, i) { return String(enc[i]).trim() === c; });
    if (restoVacio && previasOk) {
      var agregar = MAESTRO_COLUMNAS.slice(primeraVacia);
      hoja.getRange(1, primeraVacia + 1, 1, agregar.length).setValues([agregar])
        .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
      enc = hoja.getRange(1, 1, 1, nCol).getDisplayValues()[0];
    }
  }
  for (var i = 0; i < nCol; i++) {
    if (String(enc[i]).trim() !== MAESTRO_COLUMNAS[i]) {
      throw new Error('El encabezado de la columna ' + columnaLetra_(i + 1) + ' del Maestro fue modificado ("' + enc[i] +
        '" en vez de "' + MAESTRO_COLUMNAS[i] + '"). No se sincroniza.');
    }
  }
  var n = hoja.getLastRow() - 1;
  var filas = n > 0 ? hoja.getRange(2, 1, n, nCol).getValues() : [];
  // El Maestro termina en la última fila con UID: las casillas vacías (FALSO) no cuentan como datos.
  var ultima = filas.length - 1;
  while (ultima >= 0 && !String(filas[ultima][M.UID] || '').trim()) ultima--;
  filas = filas.slice(0, ultima + 1);
  return { hoja: hoja, filas: filas };
}

/**
 * Compacta el Maestro: sube las filas con UID para que no queden filas vacías entre ellas.
 * Conserva valores, fórmulas (links de credencial y WhatsApp) y casillas. No cambia ningún dato de nadie.
 * Devuelve cuántas filas vacías se eliminaron del medio.
 */
function compactarMaestro_(ss) {
  var hoja = ss.getSheetByName(HOJA.MAESTRO), nCol = MAESTRO_COLUMNAS.length;
  var n = hoja.getLastRow() - 1;
  if (n < 1) return 0;
  var rg = hoja.getRange(2, 1, n, nCol);
  var vals = rg.getValues(), forms = rg.getFormulas();
  var conUid = [], huecos = 0, visto = false;
  for (var i = vals.length - 1; i >= 0; i--) {
    var tiene = String(vals[i][M.UID] || '').trim() !== '';
    if (tiene) visto = true; else if (visto) huecos++;
  }
  if (!huecos) return 0;
  vals.forEach(function (r, i) {
    if (!String(r[M.UID] || '').trim()) return;
    conUid.push(r.map(function (v, j) { return forms[i][j] || v; }));
  });
  var vacia = MAESTRO_COLUMNAS.map(function (c, j) { return j === M.ENVIAR || j === M.WA_ENVIADO ? false : ''; });
  var salida = conUid.concat(vals.slice(conUid.length).map(function () { return vacia.slice(); }));
  rg.setValues(salida);
  SpreadsheetApp.flush();
  return huecos;
}

/**
 * ¿La fila es un cupo sin persona?
 *  - Nombre vacío o «Por confirmar».
 *  - El nombre del dueño, solo o seguido de un número («Banco Pichincha», «Banco Pichincha 1»).
 *  - «Texto + número» cuyo texto aparece dentro del dueño o de la empresa de la fila
 *    («GPS Group 1» con auspiciante «GPS Group - Blue Energy»; «DDOS Ecuador S.A. 1» con empresa
 *    «Industria de Alimentos DDOS Ecuador S.A.»). Se exige el número para no confundir a una persona.
 */
function esTextoDeCupo_(nombre, dueno, empresa) {
  if (!String(nombre || '').trim() || esPorConfirmar_(nombre)) return true;
  var n = normTexto_(nombre), d = normTexto_(dueno), e = normTexto_(empresa);
  if (d && n.indexOf(d) === 0 && /^((cupo|invitado|pase|n|no)\s*)?\d*$/.test(n.slice(d.length).trim())) return true;
  var m = /^(.*?)\s*(?:(?:cupo|invitado|pase|n|no)\s*)?(\d+)$/.exec(n);
  if (!m) return false;
  var base = m[1].trim();
  if (base.length < 3) return false;
  return (d && (d.indexOf(base) !== -1 || base.indexOf(d) === 0)) || (e && e.indexOf(base) !== -1);
}

/** Dueño de un cupo: primera línea de la celda, sin viñetas («GPS Group\n- Blue Energy» → «GPS Group»). */
function duenoCanonico_(s) {
  var lineas = String(s == null ? '' : s).split(/\r?\n/).map(function (x) { return x.replace(/^[\s\-–•·*]+/, '').trim(); })
    .filter(String);
  return lineas.length ? lineas[0] : '';
}

/** Lee una pestaña origen: solo las columnas que el sistema usa (nunca CI ni las ignoradas). */
function leerOrigen_(ss, o, cfg) {
  var hoja = ss.getSheetByName(o.hoja);
  var enc = localizarEncabezado_(hoja, cfg.filasBusqueda);
  if (!enc) return { error: 'Pestaña "' + o.hoja + '": no se encontró el encabezado «Nombre» en las primeras ' + cfg.filasBusqueda + ' filas' };

  var cols = {}, faltan = [];
  Object.keys(ENC).forEach(function (k) {
    var i = enc.indice[normTexto_(ENC[k])];
    if (i === undefined) faltan.push(ENC[k]); else cols[k] = i;
  });
  var colsSub = o.subcategorias.map(function (sc) {
    var i = enc.indice[normTexto_(sc.encabezado)];
    if (i === undefined) faltan.push(sc.encabezado);
    return i;
  });
  var colDueno = null;
  if (o.cupo) {
    colDueno = enc.indice[normTexto_(o.cupo.columna)];
    if (colDueno === undefined) faltan.push(o.cupo.columna);
  }
  var colsObs = (o.alertasObs || []).map(function (a) {
    var i = enc.indice[normTexto_(a.encabezado)];
    if (i === undefined) faltan.push(a.encabezado);
    return i;
  });
  if (faltan.length) {
    var extra = faltan.indexOf(ENC.uid) !== -1 ? ' (la columna UID la crea «Instalar / reparar estructura»)' : '';
    return { error: 'Pestaña "' + o.hoja + '": falta el encabezado ' + faltan.map(function (x) { return '«' + x + '»'; }).join(', ') + extra };
  }

  var avisos = [];
  if (o.filaEncabezado && enc.fila !== o.filaEncabezado) {
    avisos.push('Pestaña "' + o.hoja + '": encabezado encontrado en la fila ' + enc.fila + ' (Config espera la ' + o.filaEncabezado + '). Se usa la encontrada.');
  }

  var nDatos = hoja.getLastRow() - enc.fila;
  var filas = [], uidsActuales = [];
  if (nDatos > 0) {
    var leer = function (c) { return hoja.getRange(enc.fila + 1, c + 1, nDatos, 1).getDisplayValues(); };
    var vNombre = leer(cols.nombre), vEmpresa = leer(cols.empresa), vCargo = leer(cols.cargo),
      vCorreo = leer(cols.correo), vTel = leer(cols.telefono), vUid = leer(cols.uid);
    var vSub = colsSub.map(leer);
    var vDueno = colDueno !== null ? leer(colDueno) : null;
    var vObs = colsObs.map(leer);

    for (var k = 0; k < nDatos; k++) {
      uidsActuales.push(String(vUid[k][0]).trim());
      var f = {
        k: k, filaHoja: enc.fila + 1 + k,
        nombre: String(vNombre[k][0]).trim(), empresa: String(vEmpresa[k][0]).trim(), cargo: String(vCargo[k][0]).trim(),
        correo: String(vCorreo[k][0]).trim(), telefono: String(vTel[k][0]).trim(), uid: String(vUid[k][0]).trim()
      };
      f.dueno = vDueno ? duenoCanonico_(vDueno[k][0]) : '';
      f.alertasObs = (o.alertasObs || []).filter(function (a, j) { return compacto_(vObs[j][k][0]).indexOf(a.palabra) !== -1; })
        .map(function (a) { return a.texto; });
      if (o.cupo && f.dueno && esTextoDeCupo_(f.nombre, f.dueno, f.empresa)) {
        // Cupo: tiene dueño pero todavía no tiene persona. Recibe ID y QR como «Invitado N de DUEÑO».
        f.valida = true; f.esCupo = true;
        f.nombreOriginal = f.nombre; f.nombre = ''; f.cargo = '';
        f.sigla = o.sigla; f.dosSubcategorias = false; f.tipo = cfg.tipoPorSigla[o.sigla];
      } else if (!f.nombre) {
        f.valida = false;
        f.motivo = (f.empresa || f.correo || f.telefono) ? 'Sin nombre (con otros datos)' : 'Vacía';
      } else if (esPorConfirmar_(f.nombre)) {
        f.valida = false; f.motivo = 'Por confirmar';
      } else {
        f.valida = true;
        var coinciden = [];
        o.subcategorias.forEach(function (sc, j) {
          if (compacto_(vSub[j][k][0]).indexOf(sc.palabra) !== -1 && coinciden.indexOf(sc.sigla) === -1) coinciden.push(sc.sigla);
        });
        f.sigla = coinciden.length === 1 ? coinciden[0] : o.sigla;
        f.dosSubcategorias = coinciden.length > 1;
        f.tipo = cfg.tipoPorSigla[f.sigla];
      }
      filas.push(f);
    }
  }
  return { o: o, hoja: hoja, filaEnc: enc.fila, colUid: cols.uid, nDatos: Math.max(nDatos, 0),
    filas: filas, uidsActuales: uidsActuales, avisos: avisos };
}

// ---------------------------------------------------------------------------
// Plan (no escribe nada)
// ---------------------------------------------------------------------------

function planificar_(ss, cfg) {
  var errores = [];
  var declaradas = cfg.origenes.map(function (o) { return o.hoja; });
  var noDeclaradas = ss.getSheets().map(function (h) { return h.getName(); })
    .filter(function (n) { return declaradas.indexOf(n) === -1; });

  // Una pestaña declarada que no existe detiene TODO: nunca se interpreta como retiro masivo.
  cfg.origenes.forEach(function (o) {
    if (!ss.getSheetByName(o.hoja)) errores.push('No existe la pestaña declarada "' + o.hoja + '" (¿fue renombrada?). Nadie pasa a Retirado.');
  });
  if (errores.length) return { ok: false, errores: errores };

  var origenes = [];
  cfg.origenes.forEach(function (o) {
    var r = leerOrigen_(ss, o, cfg);
    if (r.error) errores.push(r.error + '. Nadie pasa a Retirado.'); else origenes.push(r);
  });
  if (errores.length) return { ok: false, errores: errores };

  var maestro = leerMaestro_(ss);
  var mf = maestro.filas;
  var ahora = new Date();
  var eventos = [];

  // Índices del Maestro (incluye Retirados).
  var porUid = {}, porCorreo = {}, porNombreEmpresa = {};
  mf.forEach(function (r, i) {
    var uid = String(r[M.UID]).trim();
    if (!uid) return;
    porUid[uid] = i;
    var c = normCorreo_(r[M.CORREO]);
    if (c) (porCorreo[c] = porCorreo[c] || []).push(i);
    var ne = normTexto_(r[M.NOMBRE]) + '|' + normTexto_(r[M.EMPRESA]);
    (porNombreEmpresa[ne] = porNombreEmpresa[ne] || []).push(i);
  });

  var validas = [], omitidas = {};
  origenes.forEach(function (or) {
    or.filas.forEach(function (f) {
      f.origen = or;
      if (f.valida) validas.push(f);
      else if (f.motivo !== 'Vacía') {
        var key = or.o.hoja + ' · ' + f.motivo;
        omitidas[key] = (omitidas[key] || 0) + 1;
      }
    });
  });

  var reclamado = {}; // índice Maestro → fila origen
  function reclamar(i, f, tipo, via) {
    reclamado[i] = f;
    f.asignacion = { tipo: tipo, idx: i, via: via || '' };
  }

  // Paso 1: UID existente + huella (nombre o correo coincide). Si varias filas traen el mismo UID,
  // gana la que más coincide; las demás siguen a la cascada.
  var filasPorUid = {};
  validas.forEach(function (f) {
    if (f.uid && porUid[f.uid] !== undefined) (filasPorUid[f.uid] = filasPorUid[f.uid] || []).push(f);
  });
  Object.keys(filasPorUid).forEach(function (uid) {
    var i = porUid[uid], m = mf[i];
    var mejor = null, mejorP = 0;
    filasPorUid[uid].forEach(function (f) {
      var mismoDueno = !!f.dueno && normTexto_(f.dueno) === normTexto_(duenoCanonico_(m[M.CUPO_DE]));
      var p;
      if (f.esCupo) {
        // Sigue siendo cupo del mismo dueño (o era una fila «Banco X 1» registrada antes como persona).
        var mSinNombre = !String(m[M.NOMBRE] || '').trim() && String(m[M.PESTANA]) === f.origen.o.hoja;
        p = (mismoDueno || mSinNombre || (f.nombreOriginal && normTexto_(f.nombreOriginal) === normTexto_(m[M.NOMBRE]))) ? 2 : 0;
      } else if (esCupoSinNombre_(m)) {
        p = mismoDueno ? 2 : 0; // cupo asignado: se escribió la persona en la fila del cupo
        if (p) f.cupoAsignado = true;
      } else {
        p = (normTexto_(f.nombre) === normTexto_(m[M.NOMBRE]) ? 1 : 0) +
          (normCorreo_(f.correo) && normCorreo_(f.correo) === normCorreo_(m[M.CORREO]) ? 1 : 0);
      }
      if (p > mejorP) { mejor = f; mejorP = p; }
    });
    filasPorUid[uid].forEach(function (f) { if (f !== mejor) f.cupoAsignado = false; });
    if (mejor) reclamar(i, mejor, 'MISMA');
    if (filasPorUid[uid].length > 1) {
      eventos.push(eventoBitacora_('SYNC_UID_DUPLICADO', uid, m[M.ID], filasPorUid[uid].length + ' filas traían el mismo UID; se conservó en la que coincide con la huella'));
    }
  });

  // Pasos 2 y 3: sin UID, o UID desalineado → buscar por correo / correo+nombre / nombre+empresa (incluye Retirados).
  var vistos = {};
  function claveDuplicado(f) { return normTexto_(f.nombre) + '|' + normCorreo_(f.correo) + '|' + normTexto_(f.empresa); }
  validas.forEach(function (f) { if (f.asignacion && !f.esCupo) vistos[claveDuplicado(f)] = f; });

  function libres(lista) { return (lista || []).filter(function (i) { return reclamado[i] === undefined; }); }

  validas.forEach(function (f) {
    if (f.asignacion || f.esCupo) return; // los cupos se resuelven después
    var clave = claveDuplicado(f);
    if (vistos[clave]) { f.asignacion = { tipo: 'DUPLICADA', de: vistos[clave] }; return; }

    var correo = normCorreo_(f.correo), nombre = normTexto_(f.nombre);
    var res = null, via = '', ambiguos = null;

    if (correo) {
      var todos = porCorreo[correo] || [];
      var lib = libres(todos);
      if (todos.length > 1 || lib.length > 1) {
        // Correo compartido: se exige también el nombre.
        var conNombre = lib.filter(function (i) { return normTexto_(mf[i][M.NOMBRE]) === nombre; });
        if (conNombre.length === 1) { res = conNombre[0]; via = 'correo y nombre'; }
        else if (conNombre.length > 1) ambiguos = conNombre;
      } else if (lib.length === 1) {
        res = lib[0];
        via = normTexto_(mf[res][M.NOMBRE]) === nombre ? 'correo' : 'correo (con otro nombre)';
      }
    }
    if (res === null && !ambiguos) {
      var libNE = libres(porNombreEmpresa[nombre + '|' + normTexto_(f.empresa)]);
      if (libNE.length === 1) { res = libNE[0]; via = 'nombre y empresa'; }
      else if (libNE.length > 1) ambiguos = libNE;
    }

    if (ambiguos) {
      f.asignacion = { tipo: 'AMBIGUA', candidatos: ambiguos.map(function (i) { return mf[i][M.ID]; }) };
    } else if (res !== null) {
      reclamar(res, f, 'RECUPERADA', via);
    } else {
      f.asignacion = { tipo: 'NUEVA' };
    }
    vistos[clave] = f;
  });

  // Cupos sin UID válido: toman uno libre del mismo dueño y pestaña (son intercambiables mientras no tengan persona).
  // Primero una fila «Banco X 1» que ya existía como persona con ese mismo texto; luego cualquier cupo libre del dueño.
  function cuposLibres(f) {
    return mf.map(function (r, i) { return i; }).filter(function (i) {
      var r = mf[i];
      return String(r[M.UID] || '') && reclamado[i] === undefined && String(r[M.PESTANA]) === f.origen.o.hoja &&
        esCupoSinNombre_(r) && normTexto_(duenoCanonico_(r[M.CUPO_DE])) === normTexto_(f.dueno);
    }).sort(function (a, b) {
      var ea = mf[a][M.ESTADO_INSC] === ESTADO_ACTIVO ? 0 : 1, eb = mf[b][M.ESTADO_INSC] === ESTADO_ACTIVO ? 0 : 1;
      var na = (parsearId_(mf[a][M.ID]) || {}).numero || 0, nb = (parsearId_(mf[b][M.ID]) || {}).numero || 0;
      return ea - eb || na - nb;
    });
  }
  validas.forEach(function (f) {
    if (f.asignacion || !f.esCupo) return;
    var legado = f.nombreOriginal ? libres(porNombreEmpresa[normTexto_(f.nombreOriginal) + '|' + normTexto_(f.empresa)]) : [];
    if (legado.length === 1) { reclamar(legado[0], f, 'RECUPERADA', 'cupo (texto del nombre)'); return; }
    var l = cuposLibres(f);
    if (l.length) reclamar(l[0], f, 'RECUPERADA', 'cupo del mismo dueño');
    else f.asignacion = { tipo: 'NUEVA' };
  });
  // Persona nueva con dueño: si quedó un cupo libre de ese dueño (su fila se borró), lo ocupa y hereda su ID y QR.
  validas.forEach(function (f) {
    if (f.esCupo || !f.dueno || !f.asignacion || f.asignacion.tipo !== 'NUEVA' || !f.origen.o.cupo) return;
    var l = cuposLibres(f);
    if (l.length) { reclamar(l[0], f, 'RECUPERADA', 'cupo asignado'); f.cupoAsignado = true; }
  });

  // Paso 4 + reasignación de subcategoría, en el orden actual de filas.
  var asignador = crearAsignadorIds_(mf);
  var mNuevo = mf.map(function (r) { return r.slice(); });
  var nuevas = [], reasignados = [], recuperados = [], reparados = [], actualizados = 0;
  var alertasExtra = {}; // clave (índice o 'n'+k) → alertas calculadas aquí
  var siglasFamilia = function (o) { return [o.sigla].concat(o.subcategorias.map(function (sc) { return sc.sigla; })); };
  // «Invitado N de DUEÑO»: N se asigna una vez por cupo y no cambia aunque otros cupos reciban persona.
  var maxCupoN = {};
  mf.forEach(function (r) {
    var d = normTexto_(duenoCanonico_(r[M.CUPO_DE])), n = Number(r[M.CUPO_N]) || 0;
    if (d && n > (maxCupoN[d] || 0)) maxCupoN[d] = n;
  });
  function siguienteCupoN(dueno) { var d = normTexto_(dueno); maxCupoN[d] = (maxCupoN[d] || 0) + 1; return maxCupoN[d]; }
  var cuposAsignados = [];

  validas.forEach(function (f) {
    var a = f.asignacion, o = f.origen.o;
    if (a.tipo === 'NUEVA') {
      var fila = MAESTRO_COLUMNAS.map(function () { return ''; });
      fila[M.UID] = nuevoUid_();
      fila[M.ID] = asignador.siguiente(f.sigla);
      fila[M.FUENTE] = f.tipo;
      fila[M.NOMBRE] = f.nombre; fila[M.EMPRESA] = f.empresa; fila[M.CARGO] = f.cargo;
      fila[M.CORREO] = f.correo; fila[M.CELULAR] = f.telefono;
      fila[M.ESTADO_INSC] = ESTADO_ACTIVO;
      fila[M.STICKER] = cfg.corte ? 'No' : '';
      fila[M.TOKEN] = nuevoToken_();
      fila[M.PESTANA] = o.hoja;
      fila[M.ALTA] = ahora; fila[M.ACTUALIZADO] = ahora;
      fila[M.CUPO_DE] = f.dueno || '';
      if (f.esCupo) fila[M.CUPO_N] = siguienteCupoN(f.dueno);
      a.uid = fila[M.UID];
      a.nuevaPos = nuevas.length;
      alertasExtra['n' + nuevas.length] = (f.dosSubcategorias ? [ALERTA.DOS_SUBCATEGORIAS] : []).concat(f.alertasObs || []);
      nuevas.push(fila);
      eventos.push(eventoBitacora_('SYNC_ALTA', fila[M.UID], fila[M.ID], (f.esCupo ? 'Cupo ' + fila[M.CUPO_N] + ' de ' + f.dueno : f.nombre) + ' · ' + o.hoja + ' fila ' + f.filaHoja));
      return;
    }
    if (a.tipo !== 'MISMA' && a.tipo !== 'RECUPERADA') return;

    var i = a.idx, r = mNuevo[i], antes = mf[i];
    a.uid = String(r[M.UID]).trim();
    var extra = [];

    var via = a.tipo === 'MISMA' ? 'UID' : a.via;
    if (antes[M.ESTADO_INSC] === ESTADO_RETIRADO) {
      recuperados.push({ id: r[M.ID], nombre: f.nombre, via: via });
      eventos.push(eventoBitacora_('SYNC_RECUPERADO', a.uid, r[M.ID], 'Vuelve a Activo, reconocido por ' + via + ' · ' + o.hoja + ' fila ' + f.filaHoja));
    } else if (a.tipo === 'RECUPERADA') {
      reparados.push({ id: r[M.ID], nombre: f.nombre, via: via });
      eventos.push(eventoBitacora_('SYNC_UID_REPARADO', a.uid, r[M.ID], 'Reconocido por ' + via + ' · ' + o.hoja + ' fila ' + f.filaHoja));
    }

    var datos = [f.tipo, f.nombre, f.empresa, f.cargo, f.correo, f.telefono];
    var previos = [r[M.FUENTE], r[M.NOMBRE], r[M.EMPRESA], r[M.CARGO], r[M.CORREO], r[M.CELULAR]].map(String);
    var cambio = datos.some(function (d, j) { return d !== previos[j]; });
    r[M.FUENTE] = f.tipo; r[M.NOMBRE] = f.nombre; r[M.EMPRESA] = f.empresa; r[M.CARGO] = f.cargo;
    r[M.CORREO] = f.correo; r[M.CELULAR] = f.telefono;
    r[M.ESTADO_INSC] = ESTADO_ACTIVO;
    r[M.PESTANA] = o.hoja;
    if (String(r[M.CUPO_DE] || '') !== (f.dueno || '')) cambio = true;
    r[M.CUPO_DE] = f.dueno || '';
    if (f.esCupo && !Number(r[M.CUPO_N])) { r[M.CUPO_N] = siguienteCupoN(f.dueno); cambio = true; }
    if (f.cupoAsignado) {
      cuposAsignados.push({ id: r[M.ID], nombre: f.nombre, dueno: f.dueno });
      eventos.push(eventoBitacora_('SYNC_CUPO_ASIGNADO', a.uid, r[M.ID], 'Cupo ' + (r[M.CUPO_N] || '') + ' de ' + f.dueno + ' → ' + f.nombre + '. Conserva ID y QR.'));
    }

    // La sigla debe seguir a la persona (observación o pestaña). Antes del corte se reasigna el ID;
    // después del corte el ID queda fijo (el sticker ya está impreso) y se marca la alerta.
    var id = parsearId_(r[M.ID]);
    if (id && id.sigla !== f.sigla) {
      var mismaPestana = siglasFamilia(o).indexOf(id.sigla) !== -1;
      if (!cfg.corte) {
        var anterior = r[M.ID];
        var motivo = mismaPestana ? 'cambió la observación' : 'cambió de pestaña';
        r[M.ID] = asignador.siguiente(f.sigla);
        r[M.IDS_ANT] = String(r[M.IDS_ANT] || '') ? r[M.IDS_ANT] + ', ' + anterior : anterior;
        if (String(r[M.CREDENCIAL] || '')) extra.push(ALERTA.CREDENCIAL_DESACTUALIZADA);
        reasignados.push({ de: anterior, a: r[M.ID], nombre: f.nombre, motivo: motivo });
        eventos.push(eventoBitacora_('SYNC_ID_REASIGNADO', a.uid, r[M.ID], anterior + ' → ' + r[M.ID] + ' (' + motivo + ', antes del corte). El número ' + anterior + ' no se reutiliza.'));
        cambio = true;
      } else {
        extra.push(mismaPestana ? ALERTA.CAMBIO_TIPO : ALERTA.CAMBIO_FUENTE);
      }
    }
    if (f.dosSubcategorias) extra.push(ALERTA.DOS_SUBCATEGORIAS);
    extra = extra.concat(f.alertasObs || []);
    if (cfg.corte && String(r[M.STICKER]) === '') r[M.STICKER] = 'No';
    if (cambio) { r[M.ACTUALIZADO] = ahora; actualizados++; }
    alertasExtra[i] = extra;
  });

  // Retiros: quien no apareció en ninguna pestaña declarada.
  var retirosNuevos = [];
  mf.forEach(function (r, i) {
    var uid = String(r[M.UID]).trim();
    if (!uid || reclamado[i] !== undefined) return;
    if (r[M.ESTADO_INSC] !== ESTADO_RETIRADO) {
      mNuevo[i][M.ESTADO_INSC] = ESTADO_RETIRADO;
      mNuevo[i][M.ACTUALIZADO] = ahora;
      retirosNuevos.push({ uid: uid, id: r[M.ID], nombre: r[M.NOMBRE], pestana: r[M.PESTANA], llego: r[M.ESTADO] === LLEGO });
      eventos.push(eventoBitacora_('SYNC_RETIRADO', uid, r[M.ID], r[M.NOMBRE] + ' ya no aparece en ninguna pestaña declarada' +
        (r[M.ESTADO] === LLEGO ? ' (YA HABÍA LLEGADO: se conserva la llegada)' : '')));
    }
  });

  // Alertas: se recalculan las de la sincronización y se conservan las demás.
  var activas = mNuevo.concat(nuevas).filter(function (r) { return r[M.UID] && r[M.ESTADO_INSC] === ESTADO_ACTIVO; });
  var personasActivas = activas.filter(function (r) { return !esCupoSinNombre_(r); });
  var usoCorreo = {};
  personasActivas.forEach(function (r) { var c = normCorreo_(r[M.CORREO]); if (c) usoCorreo[c] = (usoCorreo[c] || 0) + 1; });
  var posiblesDuplicados = posiblesDuplicados_(personasActivas);
  var dupPorFila = new Map();
  posiblesDuplicados.forEach(function (par) {
    [[par[0], par[1]], [par[1], par[0]]].forEach(function (x) {
      var l = dupPorFila.get(x[0]) || [];
      l.push(PREFIJO_POSIBLE_DUPLICADO + x[1][M.ID]);
      dupPorFila.set(x[0], l);
    });
  });
  function calcularAlertas(r, extra) {
    var conservadas = String(r[M.ALERTAS] || '').split(SEP_ALERTAS).map(function (x) { return x.trim(); })
      .filter(function (x) { return x && ALERTAS_SYNC.indexOf(x) === -1 && x.indexOf(PREFIJO_POSIBLE_DUPLICADO) !== 0 && cfg.textosAlertasObs.indexOf(x) === -1; });
    extra = (extra || []).concat(dupPorFila.get(r) || []);
    var nuevasA = [];
    if (r[M.ESTADO_INSC] === ESTADO_ACTIVO && esCupoSinNombre_(r)) {
      nuevasA.push(ALERTA.CUPO_SIN_NOMBRE);
    } else if (r[M.ESTADO_INSC] === ESTADO_ACTIVO) {
      var correo = String(r[M.CORREO] || '').trim(), cel = String(r[M.CELULAR] || '').trim();
      if (!correo && !cel) nuevasA.push(ALERTA.SIN_AMBOS);
      else if (!correo) nuevasA.push(ALERTA.SIN_CORREO);
      else if (!cel) nuevasA.push(ALERTA.SIN_CELULAR);
      if (correo && !correoValido_(correo)) nuevasA.push(ALERTA.CORREO_INVALIDO);
      if (cel && !normalizarCelular_(cel)) nuevasA.push(ALERTA.CELULAR_INVALIDO);
      if (correo && usoCorreo[normCorreo_(correo)] > 1) nuevasA.push(ALERTA.CORREO_COMPARTIDO);
      if (String(r[M.CREDENCIAL] || '') && String(r[M.HUELLA] || '') && r[M.HUELLA] !== huellaCredencial_(r, cfg)) {
        nuevasA.push(ALERTA.CREDENCIAL_DESACTUALIZADA);
      }
    } else if (r[M.ESTADO] === LLEGO) {
      nuevasA.push(ALERTA.RETIRADO_TRAS_LLEGAR);
    }
    (extra || []).forEach(function (x) { if (nuevasA.indexOf(x) === -1 && conservadas.indexOf(x) === -1) nuevasA.push(x); });
    return nuevasA.concat(conservadas).join(SEP_ALERTAS);
  }
  mNuevo.forEach(function (r, i) { if (r[M.UID]) r[M.ALERTAS] = calcularAlertas(r, alertasExtra[i]); });
  nuevas.forEach(function (r, k) { r[M.ALERTAS] = calcularAlertas(r, alertasExtra['n' + k]); });

  // Columna UID de cada pestaña: se reescribe completa con el UID correcto (se repara sola).
  var cambiosUid = [];
  origenes.forEach(function (or) {
    var deseado = or.filas.map(function (f) {
      var a = f.valida && f.asignacion;
      return a && a.uid ? a.uid : '';
    });
    var difieren = deseado.filter(function (u, k) { return u !== or.uidsActuales[k]; }).length;
    if (difieren) cambiosUid.push({ hoja: or.hoja, nombre: or.o.hoja, filaIni: or.filaEnc + 1, col: or.colUid + 1, valores: deseado, cambios: difieren });
  });

  var duplicadas = validas.filter(function (f) { return f.asignacion.tipo === 'DUPLICADA'; });
  var ambiguas = validas.filter(function (f) { return f.asignacion.tipo === 'AMBIGUA'; });
  duplicadas.forEach(function (f) {
    var d = f.asignacion.de;
    eventos.push(eventoBitacora_('SYNC_FILA_DUPLICADA', '', '', f.nombre + ' · ' + f.origen.o.hoja + ' fila ' + f.filaHoja +
      ' repite a ' + d.origen.o.hoja + ' fila ' + d.filaHoja + '. No recibe ID.'));
  });
  ambiguas.forEach(function (f) {
    eventos.push(eventoBitacora_('SYNC_AMBIGUA', '', '', f.nombre + ' · ' + f.origen.o.hoja + ' fila ' + f.filaHoja +
      ': coincide con ' + f.asignacion.candidatos.join(', ') + '. No se asignó nada.'));
  });

  var avisos = [];
  origenes.forEach(function (or) { avisos = avisos.concat(or.avisos); });

  return {
    ok: true, cfg: cfg, origenes: origenes, maestro: maestro, mNuevo: mNuevo, nuevas: nuevas,
    retirosNuevos: retirosNuevos, reasignados: reasignados, recuperados: recuperados, reparados: reparados,
    duplicadas: duplicadas, ambiguas: ambiguas, posiblesDuplicados: posiblesDuplicados, cuposAsignados: cuposAsignados, actualizados: actualizados, cambiosUid: cambiosUid,
    omitidas: omitidas, noDeclaradas: noDeclaradas, avisos: avisos, eventos: eventos,
    contadores: asignador.propiedades(), ahora: ahora
  };
}

/**
 * Pares de personas activas que podrían ser la misma: todas las palabras del nombre más corto
 * (mínimo 2, sin «de», «la»…) están en el más largo, o mismo correo en pestañas distintas.
 * Solo alerta; nunca une ni borra.
 */
function posiblesDuplicados_(activas) {
  var items = activas.map(function (r) {
    return {
      r: r, correo: normCorreo_(r[M.CORREO]), pestana: r[M.PESTANA],
      palabras: normTexto_(r[M.NOMBRE]).split(' ').filter(function (t) { return t.length > 1 && PALABRAS_VACIAS.indexOf(t) === -1; })
    };
  });
  var pares = [];
  for (var i = 0; i < items.length; i++) {
    for (var j = i + 1; j < items.length; j++) {
      var a = items[i], b = items[j];
      var corto = a.palabras.length <= b.palabras.length ? a : b, largo = corto === a ? b : a;
      var porNombre = corto.palabras.length >= 2 && corto.palabras.every(function (t) { return largo.palabras.indexOf(t) !== -1; });
      var porCorreo = a.correo && a.correo === b.correo && a.pestana !== b.pestana;
      if (porNombre || porCorreo) pares.push([a.r, b.r]);
    }
  }
  return pares;
}

// ---------------------------------------------------------------------------
// Escritura (siempre bajo bloqueo, por lotes)
// ---------------------------------------------------------------------------

function aplicar_(ss, cfg, plan) {
  // Primero los contadores: si algo falla después, un número se pierde pero nunca se repite.
  var props = plan.contadores;
  if (Object.keys(props).length) PropertiesService.getScriptProperties().setProperties(props, false);

  var h = plan.maestro.hoja, filas = plan.mNuevo, n = filas.length;
  if (n) {
    // Solo columnas de la sincronización: A–J, S y Z–AD. No toca casillas, llegadas ni observaciones.
    h.getRange(2, 1, n, 10).setValues(filas.map(function (r) { return r.slice(0, 10); }));
    h.getRange(2, M.STICKER + 1, n, 1).setValues(filas.map(function (r) { return [r[M.STICKER]]; }));
    h.getRange(2, M.TOKEN + 1, n, 5).setValues(filas.map(function (r) { return r.slice(M.TOKEN, M.TOKEN + 5); }));
    h.getRange(2, M.CUPO_DE + 1, n, 2).setValues(filas.map(function (r) { return [r[M.CUPO_DE], r[M.CUPO_N]]; }));
  }
  if (plan.nuevas.length) {
    asegurarFilas_(h, n + 1 + plan.nuevas.length);
    h.getRange(n + 2, 1, plan.nuevas.length, MAESTRO_COLUMNAS.length).setValues(plan.nuevas);
  }

  plan.cambiosUid.forEach(function (c) {
    c.hoja.getRange(c.filaIni, c.col, c.valores.length, 1).setValues(c.valores.map(function (u) { return [u]; }));
  });

  var resumen = resumenSincronizacion_(plan);
  registrarBitacora_(ss, plan.eventos.concat([eventoBitacora_('SYNC_OK', '', '', resumen)]));
  escribirConfig_(ss, 'ULTIMA_SINCRONIZACION', fmtFecha_(plan.ahora) + ' · ' + resumen);
  SpreadsheetApp.flush();
}

function respaldarMaestro_(ss, cfg, maestro) {
  var carpeta = null;
  var id = cfg.valores.CARPETA_RESPALDOS_ID;
  if (id) { try { carpeta = DriveApp.getFolderById(id); } catch (e) { carpeta = null; } }
  if (!carpeta) {
    carpeta = DriveApp.createFolder('Respaldos Maestro · ' + ss.getName());
    escribirConfig_(ss, 'CARPETA_RESPALDOS_ID', carpeta.getId());
  }
  var celda = function (v) {
    if (v instanceof Date) v = fmtFecha_(v);
    var s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  var csv = [MAESTRO_COLUMNAS].concat(maestro.filas).map(function (r) { return r.map(celda).join(','); }).join('\r\n');
  var nombre = 'Maestro ' + fmtFecha_(new Date(), 'yyyy-MM-dd HH.mm.ss') + '.csv';
  carpeta.createFile(nombre, '﻿' + csv, MimeType.CSV);

  var archivos = [];
  var it = carpeta.getFiles();
  while (it.hasNext()) archivos.push(it.next());
  archivos.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  archivos.slice(cfg.respaldos).forEach(function (f) { f.setTrashed(true); });
  return nombre;
}

// ---------------------------------------------------------------------------
// Bitácora e informe
// ---------------------------------------------------------------------------

function eventoBitacora_(accion, uid, id, detalle, lector) {
  return [new Date(), '', lector || 'Sistema', accion, uid || '', id || '', detalle || '', ''];
}

function registrarBitacora_(ss, filas) {
  if (!filas.length) return;
  var hoja = ss.getSheetByName(HOJA.BITACORA);
  if (!hoja) return;
  asegurarFilas_(hoja, hoja.getLastRow() + filas.length);
  hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
}

function resumenSincronizacion_(plan) {
  var activos = plan.mNuevo.concat(plan.nuevas).filter(function (r) { return r[M.UID] && r[M.ESTADO_INSC] === ESTADO_ACTIVO; }).length;
  return activos + ' activos · ' + plan.nuevas.length + ' nuevos · ' + plan.recuperados.length + ' recuperados · ' +
    plan.retirosNuevos.length + ' retirados · ' + plan.reasignados.length + ' ID reasignados · ' +
    plan.ambiguas.length + ' ambiguos · ' + plan.duplicadas.length + ' filas duplicadas · ' +
    plan.posiblesDuplicados.length + ' posibles duplicados';
}

function informeSincronizacion_(r) {
  var L = [];
  var p = r.plan;
  if (r.estado === 'ERROR') {
    L.push('✖ SINCRONIZACIÓN DETENIDA. No se escribió nada y nadie pasó a Retirado.', '');
    (r.errores || []).forEach(function (e) { L.push('• ' + e); });
    return L;
  }
  if (r.estado === 'CANCELADO') return ['Sincronización cancelada. No se escribió nada.'];
  if (r.estado === 'PAUSA') {
    L.push('⏸ SINCRONIZACIÓN EN PAUSA. No se escribió nada.', r.mensaje || '', '');
    L.push(r.retiros.length + ' personas pasarían a Retirado:');
    r.retiros.forEach(function (x) { L.push('  • ' + x.id + ' — ' + x.nombre + ' (' + x.pestana + ')'); });
    return L;
  }

  L.push('✔ Sincronización completa · ' + fmtFecha_(p.ahora), resumenSincronizacion_(p), '');
  L.push('PESTAÑAS LEÍDAS');
  p.origenes.forEach(function (or) {
    var n = or.filas.filter(function (f) { return f.valida; }).length;
    L.push('  • ' + or.o.hoja + ' [' + or.o.sigla + ']: ' + n + ' personas (encabezado fila ' + or.filaEnc + ')');
  });
  L.push('NO SE LEEN: ' + (p.noDeclaradas.length ? p.noDeclaradas.join(', ') : '(ninguna)'));
  var om = Object.keys(p.omitidas);
  if (om.length) { L.push('', 'FILAS OMITIDAS'); om.forEach(function (k) { L.push('  • ' + k + ': ' + p.omitidas[k]); }); }
  if (p.avisos.length) { L.push('', 'AVISOS'); p.avisos.forEach(function (a) { L.push('  ⚠ ' + a); }); }

  var porSigla = {};
  p.mNuevo.concat(p.nuevas).forEach(function (x) {
    var id = parsearId_(x[M.ID]);
    if (id && x[M.ESTADO_INSC] === ESTADO_ACTIVO) porSigla[id.sigla] = (porSigla[id.sigla] || 0) + 1;
  });
  L.push('', 'ACTIVOS POR SIGLA');
  p.cfg.ordenSiglas.forEach(function (s) { if (porSigla[s]) L.push('  • ' + s + ': ' + porSigla[s]); });

  function lista(titulo, arr, fmt) {
    if (!arr.length) return;
    L.push('', titulo + ' (' + arr.length + ')');
    arr.forEach(function (x) { L.push('  • ' + fmt(x)); });
  }
  lista('NUEVOS', p.nuevas, function (x) { return x[M.ID] + ' — ' + x[M.NOMBRE] + ' (' + x[M.PESTANA] + ')'; });
  lista('RECUPERADOS (vuelven a Activo con su mismo ID)', p.recuperados, function (x) { return x.id + ' — ' + x.nombre + ' · por ' + x.via; });
  lista('RETIRADOS', p.retirosNuevos, function (x) { return x.id + ' — ' + x.nombre + (x.llego ? '  ⚠ YA HABÍA LLEGADO' : ''); });
  lista('ID REASIGNADOS (antes del corte)', p.reasignados, function (x) { return x.de + ' → ' + x.a + ' — ' + x.nombre + ' · ' + x.motivo; });
  lista('CUPOS ASIGNADOS (conservan ID y QR)', p.cuposAsignados || [], function (x) { return x.id + ' — ' + x.nombre + ' · cupo de ' + x.dueno; });
  var cupos = {};
  p.mNuevo.concat(p.nuevas).forEach(function (x) {
    if (x[M.UID] && x[M.ESTADO_INSC] === ESTADO_ACTIVO && esCupoSinNombre_(x)) cupos[x[M.CUPO_DE]] = (cupos[x[M.CUPO_DE]] || 0) + 1;
  });
  var dCupos = Object.keys(cupos).sort();
  if (dCupos.length) {
    L.push('', 'CUPOS SIN NOMBRE (' + dCupos.reduce(function (s, k) { return s + cupos[k]; }, 0) + ')');
    dCupos.forEach(function (k) { L.push('  • ' + k + ': ' + cupos[k]); });
  }
  lista('UID REPARADOS (fila movida o reescrita)', p.reparados, function (x) { return x.id + ' — ' + x.nombre + ' · por ' + x.via; });
  lista('⚠ AMBIGUOS: no se asignó nada, revisar', p.ambiguas, function (f) { return f.nombre + ' · ' + f.origen.o.hoja + ' fila ' + f.filaHoja + ' · coincide con ' + f.asignacion.candidatos.join(', '); });
  lista('⚠ POSIBLES DUPLICADOS: revisar (no se unió ni borró a nadie)', p.posiblesDuplicados, function (x) {
    return x[0][M.ID] + ' — ' + x[0][M.NOMBRE] + ' (' + x[0][M.PESTANA] + ')  ↔  ' + x[1][M.ID] + ' — ' + x[1][M.NOMBRE] + ' (' + x[1][M.PESTANA] + ')';
  });
  lista('⚠ FILAS DUPLICADAS: no reciben ID', p.duplicadas, function (f) { return f.nombre + ' · ' + f.origen.o.hoja + ' fila ' + f.filaHoja; });
  var cu = p.cambiosUid.reduce(function (s, c) { return s + c.cambios; }, 0);
  L.push('', 'Columna UID actualizada en ' + cu + ' celdas.' + (p.respaldo ? '  Respaldo: ' + p.respaldo : ''));
  return L;
}
