/**
 * BANCO DE PRUEBAS T1–T15 (SPEC §5-ter) + casos extra de las decisiones del 27/09.
 *
 * ⚠️ Este archivo NUNCA se sube a producción (scripts/subir.sh lo excluye) y solo corre
 * en una hoja cuyo nombre contiene «DATOS FICTICIOS». Todas las personas son inventadas.
 */

var NOMBRE_OBLIGATORIO_PRUEBAS = 'DATOS FICTICIOS';
var HOJA_RESULTADOS = 'Resultados T';
var FX_PAGADOS = 'Lista pagados';
var FX_FILAS_TABLA = 60;   // filas de datos dentro de cada tabla (15–74)
var FX_FILA_LIBRE = 60;    // fila vacía dentro de la tabla para pegar personas

function agregarMenuPruebas_(menu) {
  menu.addSeparator().addSubMenu(SpreadsheetApp.getUi().createMenu('Pruebas (hoja ficticia)')
    .addItem('1. Preparar hoja ficticia', 'menuPrepararHojaFicticia')
    .addItem('2. Ejecutar T1–T32 (continúa donde quedó)', 'menuEjecutarPruebas')
    .addItem('Probar solo los cambios de hoy (T29, T31, T32)', 'menuProbarCambiosHoy')
    .addItem('Repetir solo las que fallaron', 'menuRepetirFallidas')
    .addItem('Reiniciar la serie de pruebas', 'menuReiniciarPruebas'));
}

/**
 * Borra una pestaña con SpreadsheetApp (no con la API: mezclar ambas deja referencias viejas).
 * Antes se aplican las escrituras pendientes para que un error de ellas no aparezca aquí.
 */
function borrarHoja_(ss, hoja) {
  SpreadsheetApp.flush();
  ss.deleteSheet(hoja);
}

function verificarHojaFicticia_() {
  var nombre = SpreadsheetApp.getActiveSpreadsheet().getName();
  if (nombre.toUpperCase().indexOf(NOMBRE_OBLIGATORIO_PRUEBAS) === -1) {
    throw new Error('Las pruebas solo corren en una hoja cuyo nombre contiene «' + NOMBRE_OBLIGATORIO_PRUEBAS + '». Esta se llama «' + nombre + '».');
  }
}

// ---------------------------------------------------------------------------
// Datos ficticios
// ---------------------------------------------------------------------------

var FX_ENCABEZADOS = (function () {
  var e = ['N', 'Fecha', 'Nombre', 'CI', 'Ciudad', 'Sector', 'Empresa', 'RUC', 'Cargo', 'Correo Electronico', 'Teléfono',
    'Estado del Cliente', 'Forma de pago', 'Valor', 'Factura', 'Vendedor'];
  e.push('AUSPICIANTE');
  ['R', 'S', 'T', 'U', 'V', 'W', 'X'].forEach(function (l) { e.push('Campo ' + l); });
  e.push('OBSERVACIONES', 'ASISTENCIA 28/29/30 JULIO', 'ENVÍO DE BIENVENIDA', 'WPP');
  ['AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL'].forEach(function (l) { e.push('Campo ' + l); });
  return e; // 38 columnas: A–AL, igual que la hoja real
})();
var FX_COL = { nombre: 3, ci: 4, empresa: 7, cargo: 9, correo: 10, tel: 11, estado: 12, aus: 17, obs: 25 };

// [clave, nombre, empresa, cargo, correo, teléfono, observación, estado del cliente]
var FX_PERSONAS = {
  'Lista pagados': [
    ['p01', 'Andrea Ficticia Molina', 'Exportadora Alfa', 'Gerente', 'andrea.molina@ejemplo.test', '0991000001', '', 'Confirmado'],
    ['p02', 'Bruno Prueba Cedeño', 'Exportadora Alfa', 'Analista', 'bruno.cedeno@ejemplo.test', '0991000002', 'Diplomado Internacional', 'Confirmado'],
    ['p03', 'Carla Demo Rivas', 'Cacao Beta', 'Jefa comercial', 'carla.rivas@ejemplo.test', '0991000003', 'DIPLOMADO', 'Pendiente'],
    ['p04', 'Diego Ensayo Paz', 'Cacao Beta', 'Director', 'diego.paz@ejemplo.test', '0991000004', 'B2B', 'Confirmado'],
    ['p05', 'Elena Muestra Vera', 'Flores Gamma', 'Coordinadora', 'elena.vera@ejemplo.test', '0991000005', 'Rueda b 2 b', 'Confirmado'],
    ['p06', 'Fabián Simulado Loor', 'Flores Gamma', 'Gerente', 'fabian.loor@ejemplo.test', '0991000006', 'Diplomado + B2B', 'Confirmado'],
    ['p07', 'Gabriela Test Ortiz', 'Camarón Delta', 'Asistente', 'gabriela.ortiz@ejemplo.test', '0991000007', 'Factura pendiente', 'Confirmado'],
    ['p08', 'Jose Ficticio Alvarez', 'Camarón Delta', 'Presidente', 'jose.alvarez@ejemplo.test', '0991000008', '', 'Confirmado'],
    ['p09', 'Hilda Compartido Uno', 'Banano Épsilon', 'Analista', 'compartido@ejemplo.test', '0991000009', '', 'Confirmado'],
    ['p10', 'Iván Compartido Dos', 'Banano Épsilon', 'Analista', 'compartido@ejemplo.test', '0991000010', '', 'Confirmado'],
    ['p11', 'Karla Sindatos Uno', 'Atún Zeta', 'Operaria', '', '', '', 'Confirmado'],
    ['p12', 'Luis Sindatos Dos', 'Atún Zeta', 'Operario', '', '', '', 'Confirmado'],
    ['p13', 'Mónica Sindatos Tres', 'Atún Zeta', 'Supervisora', '', '', '', 'Confirmado'],
    ['p14', 'Nelson Prueba Arias', 'Café Eta', 'Gerente', 'nelson.arias@ejemplo.test', '+593 99 100 0014', '', 'Confirmado'],
    ['p15', 'Olga Prueba Benítez', 'Café Eta', 'Asistente', 'olga.benitez@ejemplo.test', '099-100-0015', '', 'Confirmado'],
    ['p16', 'Pablo Prueba Castro', 'Mango Theta', 'Jefe', 'pablo.castro@ejemplo.test', '0991000016', '', 'Confirmado'],
    ['p17', 'Rosa Prueba Dávila', 'Mango Theta', 'Analista', 'rosa.davila@ejemplo.test', '12345', '', 'Confirmado'],
    ['p18', 'Sergio Prueba Espinoza', 'Pitahaya Iota', 'Gerente', 'sergio.espinoza@ejemplo', '0991000018', '', 'Confirmado'],
    ['p19', 'Tania Prueba Flores', 'Pitahaya Iota', 'Analista', 'tania.flores@ejemplo.test', '0991000019', '', 'Confirmado'],
    ['p20', 'Ulises Prueba Guerra', 'Brócoli Kappa', 'Director', 'ulises.guerra@ejemplo.test', '0991000020', '', 'Confirmado']
  ],
  'SUMARSE': [
    ['s01', 'Victoria Sumarse Hidalgo', 'Artesanías Lambda', 'Gerente', 'victoria.hidalgo@ejemplo.test', '0992000001', '', 'Confirmado'],
    ['sx1', 'Por confirmar', 'Artesanías Lambda', '', '', '', '', ''],
    ['sx2', 'POR CONFIRMAR ', 'Textiles Mu', '', '', '', '', ''],
    ['s02', 'Walter Sumarse Ibarra', 'Textiles Mu', 'Técnico', 'walter.ibarra@ejemplo.test', '0992000002', '', 'Confirmado'],
    ['sx3', 'Por Confirmar.', 'Textiles Mu', '', '', '', '', ''],
    ['s03', 'Ximena Sumarse Jaramillo', 'Cerámica Nu', 'Diseñadora', 'ximena.jaramillo@ejemplo.test', '0992000003', '', 'Confirmado']
  ],
  'AUSPICIANTES': [
    ['a01', 'Yolanda Auspicio King', 'Banco Xi', 'Gerente de marca', 'yolanda.king@ejemplo.test', '0993000001', '', 'Confirmado', 'Banco Xi'],
    ['a02', 'Zacarías Auspicio León', 'Proveedor Rho', 'Director', 'zacarias.leon@ejemplo.test', '0993000002', '', 'Confirmado', 'Seguros Ómicron'],
    ['c1', '', '', '', '', '', '2 DE 3 / FALTA 1', '', 'Banco Xi'],
    ['c2', 'Banco Xi 2', '', '', '', '', '', '', 'Banco Xi'],
    ['c3', '', '', '', '', '', '', '', 'Seguros Ómicron'],
    ['a03', 'Persona Excedente Ficticia', 'Proveedor Psi', 'Analista', 'excedente@ejemplo.test', '0993000003', '3 DE 2 REVISAR', 'Confirmado', 'Seguros Ómicron']
  ],
  'EXPOSITORES': [
    ['e01', 'Alberto Expo Mera', 'Logística Pi', 'Gerente', 'alberto.mera@ejemplo.test', '0994000001', '', 'Confirmado']
  ],
  'OTROS': [
    ['o01', 'Beatriz Otros Núñez', 'Consultora Rho', 'Consultora', 'beatriz.nunez@ejemplo.test', '0995000001', '', 'Confirmado']
  ],
  'Registro en sitio': [],
  '⛔Anulaciones': [
    ['x01', 'Anulado Ficticio Nieto', 'Empresa Sigma', 'Gerente', 'anulado.nieto@ejemplo.test', '0996000001', '', 'Anulado']
  ]
};
var FX_ORDEN_PESTANAS = ['Lista pagados', 'SUMARSE', 'AUSPICIANTES', 'EXPOSITORES', 'OTROS', 'Registro en sitio', '⛔Anulaciones'];

function fxPersona_(clave) {
  for (var t in FX_PERSONAS) {
    var p = FX_PERSONAS[t].filter(function (x) { return x[0] === clave; })[0];
    if (p) return p;
  }
  throw new Error('No existe la persona ficticia ' + clave);
}

function fxFila_(p, n) {
  var fila = FX_ENCABEZADOS.map(function () { return ''; });
  fila[0] = n; fila[FX_COL.nombre - 1] = p[1]; fila[FX_COL.ci - 1] = 'NO-SE-LEE'; fila[FX_COL.empresa - 1] = p[2];
  fila[FX_COL.cargo - 1] = p[3]; fila[FX_COL.correo - 1] = p[4]; fila[FX_COL.tel - 1] = p[5];
  fila[FX_COL.obs - 1] = p[6]; fila[FX_COL.estado - 1] = p[7]; fila[FX_COL.aus - 1] = p[8] || '';
  fila[25] = 'Sí'; fila[27] = 'Enviado'; // columnas de eventos anteriores: el sistema no debe leerlas
  return fila;
}

/** Borra y vuelve a crear las pestañas ficticias con tablero, encabezado en la fila 14 y tabla de Sheets. */
function construirOrigenesFicticios_(ss, nombres) {
  var nuevas = [];
  nombres.forEach(function (nombre, idx) {
    var vieja = ss.getSheetByName(nombre);
    if (vieja) borrarHoja_(ss, vieja);
    var h = ss.insertSheet(nombre, idx);
    // «Lista pagados» queda con exactamente 38 columnas (como la real) para probar la inserción de la columna UID.
    var cols = nombre === FX_PAGADOS ? FX_ENCABEZADOS.length : FX_ENCABEZADOS.length + 2;
    if (h.getMaxColumns() < cols) h.insertColumnsAfter(h.getMaxColumns(), cols - h.getMaxColumns());
    if (h.getMaxColumns() > cols) h.deleteColumns(cols + 1, h.getMaxColumns() - cols);
    var tablero = [];
    for (var r = 1; r <= 13; r++) tablero.push(['Tablero ficticio fila ' + r, r === 2 ? '=COUNTA(C15:C74)' : '']);
    h.getRange(1, 1, 13, 2).setValues(tablero);
    h.getRange(14, 1, 1, FX_ENCABEZADOS.length).setValues([FX_ENCABEZADOS]);
    var personas = FX_PERSONAS[nombre] || [];
    if (personas.length) h.getRange(15, 1, personas.length, FX_ENCABEZADOS.length).setNumberFormat('@')
      .setValues(personas.map(function (p, i) { return fxFila_(p, i + 1); }));
    nuevas.push({ nombre: nombre, sheetId: h.getSheetId(), idx: idx });
  });
  // Las escrituras de SpreadsheetApp se acumulan; la API no las espera. Se aplican ANTES de crear la tabla
  // (dentro de una tabla no se puede dar formato a varias columnas a la vez).
  SpreadsheetApp.flush();
  var n = 0;
  Sheets.Spreadsheets.batchUpdate({ requests: nuevas.map(function (x) {
    n++;
    return { addTable: { table: { name: 'Seguimiento_fx' + n,
      range: { sheetId: x.sheetId, startRowIndex: 13, endRowIndex: 14 + FX_FILAS_TABLA, startColumnIndex: 0, endColumnIndex: FX_ENCABEZADOS.length } } } };
  }) }, ss.getId());
}

// ---------------------------------------------------------------------------
// Menús
// ---------------------------------------------------------------------------

function menuPrepararHojaFicticia() {
  var ui = SpreadsheetApp.getUi();
  try {
    verificarHojaFicticia_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Arranque limpio: se borran las pestañas del sistema y se reconstruyen las ficticias.
    [HOJA.MAESTRO, HOJA.BITACORA, HOJA.CONFIG, HOJA.PRUEBAS, HOJA.COLA, HOJA.REENVIOS, HOJA.LEEME, HOJA.STICKERS,
      'OTROS', 'Registro en sitio', HOJA_RESULTADOS].forEach(function (n) {
      var h = ss.getSheetByName(n);
      if (h && ss.getSheets().length > 1) borrarHoja_(ss, h);
    });
    borrarContadores_();
    PropertiesService.getScriptProperties().deleteProperty('PRUEBA_SIGUIENTE');
    // OTROS y Registro en sitio NO se construyen: los debe crear la instalación duplicando AUSPICIANTES (que tiene 2 personas).
    construirOrigenesFicticios_(ss, ['Lista pagados', 'SUMARSE', 'AUSPICIANTES', 'EXPOSITORES', '⛔Anulaciones']);
    ss.getSheets().forEach(function (h) {
      if (/^(Hoja|Sheet) ?1$/.test(h.getName()) && ss.getSheets().length > 1) borrarHoja_(ss, h);
    });
    var L = instalarEstructura_();
    SpreadsheetApp.flush();
    ss = SpreadsheetApp.openById(ss.getId()); // ver las pestañas creadas por la API

    // Verificación de la instalación.
    var cfg = leerConfig_(ss);
    var otros = ss.getSheetByName('OTROS');
    var enc = otros && localizarEncabezado_(otros, 40);
    var nombresOtros = enc ? otros.getRange(15, FX_COL.nombre, FX_FILAS_TABLA, 1).getDisplayValues().filter(function (r) { return r[0]; }).length : -1;
    L.push('', 'VERIFICACIÓN');
    L.push((otros ? '✔' : '✖') + ' OTROS creada' + (otros ? ' · personas copiadas de AUSPICIANTES: ' + nombresOtros + (nombresOtros === 0 ? ' ✔' : ' ✖') : ''));
    var tablas = tablasPorHoja_(ss.getId());
    cfg.origenes.forEach(function (o) {
      var h = ss.getSheetByName(o.hoja);
      var e = h && localizarEncabezado_(h, 40);
      var c = e && e.indice[normTexto_(ENC.uid)];
      var t = (tablas[o.hoja] || [])[0];
      var dentro = t && c !== undefined && c < t.range.endColumnIndex;
      L.push((dentro ? '✔ ' : '✖ ') + o.hoja + ': UID en ' + (c !== undefined ? columnaLetra_(c + 1) : '—') +
        (t ? ' · tabla hasta ' + columnaLetra_(t.range.endColumnIndex) : ' · sin tabla') + (dentro ? ' (dentro)' : ' (FUERA)'));
    });
    L.push('', 'Siguiente paso: «Pruebas (hoja ficticia) → 2. Ejecutar T1–T32».');
    mostrarTexto_('Hoja ficticia preparada', L);
  } catch (e) {
    ui.alert('No se pudo preparar', String(e.stack || e), ui.ButtonSet.OK);
  }
}

function menuReiniciarPruebas() {
  PropertiesService.getScriptProperties().deleteProperty('PRUEBA_SIGUIENTE');
  SpreadsheetApp.getUi().alert('Listo: la próxima ejecución empieza desde T1.');
}

function menuEjecutarPruebas() {
  var ui = SpreadsheetApp.getUi();
  try {
    verificarHojaFicticia_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var props = PropertiesService.getScriptProperties();
    var inicio = Date.now();
    var sig = Number(props.getProperty('PRUEBA_SIGUIENTE') || 0);
    var hr = ss.getSheetByName(HOJA_RESULTADOS);
    if (sig === 0 || !hr) {
      if (hr) borrarHoja_(ss, hr);
      hr = ss.insertSheet(HOJA_RESULTADOS, 0);
      hr.getRange(1, 1, 1, 6).setValues([['Prueba', 'Acción del editor', 'Resultado esperado', 'Resultado', 'Detalle', 'Segundos']])
        .setFontWeight('bold').setBackground(COLOR_ENCABEZADO).setFontColor('#ffffff');
      hr.setFrozenRows(1);
      hr.setColumnWidth(2, 300); hr.setColumnWidth(3, 300); hr.setColumnWidth(5, 520);
    }
    // Máximo ~4 min por ejecución (el límite de Apps Script es 6).
    while (sig < PRUEBAS_T.length && Date.now() - inicio < 240000) {
      var t = PRUEBAS_T[sig], t0 = Date.now(), r;
      try {
        var ctx = restablecerEscenario_(ss);
        r = t.fn(ss, ctx);
      } catch (e) {
        r = { ok: false, detalle: 'Error: ' + (e.stack || e) };
      }
      var fila = [t.id, t.accion, t.esperado, r.ok ? 'PASÓ' : 'FALLÓ', r.detalle, Math.round((Date.now() - t0) / 1000)];
      var n = hr.getLastRow() + 1;
      hr.getRange(n, 1, 1, 6).setValues([fila]).setWrap(true).setVerticalAlignment('top');
      hr.getRange(n, 4).setBackground(r.ok ? '#c6efce' : '#ffc7ce').setFontWeight('bold');
      SpreadsheetApp.flush();
      sig++;
      props.setProperty('PRUEBA_SIGUIENTE', String(sig));
    }
    if (sig >= PRUEBAS_T.length) {
      props.deleteProperty('PRUEBA_SIGUIENTE');
      var res = hr.getRange(2, 4, hr.getLastRow() - 1, 1).getValues().map(function (x) { return x[0]; });
      var pasaron = res.filter(function (x) { return x === 'PASÓ'; }).length;
      ui.alert('Pruebas terminadas', pasaron + ' de ' + res.length + ' pasaron. El detalle está en la pestaña «' + HOJA_RESULTADOS + '».', ui.ButtonSet.OK);
    } else {
      ui.alert('Pausa', 'Van ' + sig + ' de ' + PRUEBAS_T.length + '. Apps Script corta a los 6 minutos: vuelva a ejecutar «2. Ejecutar T1–T32» para continuar.', ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert('Error en las pruebas', String(e.stack || e), ui.ButtonSet.OK);
  }
}

// ---------------------------------------------------------------------------
// Escenario base de cada prueba
// ---------------------------------------------------------------------------

function borrarContadores_() {
  var props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf(PREFIJO_CONTADOR) === 0) props.deleteProperty(k); });
}

/** Deja todo como recién instalado + una sincronización inicial. Devuelve el mapa inicial de personas. */
function restablecerEscenario_(ss) {
  var m = ss.getSheetByName(HOJA.MAESTRO);
  if (m.getLastRow() > 1) m.getRange(2, 1, m.getLastRow() - 1, MAESTRO_COLUMNAS.length).clearContent();
  var b = ss.getSheetByName(HOJA.BITACORA);
  if (b.getLastRow() > 1) b.getRange(2, 1, b.getLastRow() - 1, BITACORA_COLUMNAS.length).clearContent();
  escribirConfig_(ss, 'CORTE_IMPRESION', 'NO');
  escribirConfig_(ss, 'CORTE_FECHA', '');
  borrarContadores_();
  construirOrigenesFicticios_(ss, FX_ORDEN_PESTANAS);
  asegurarColumnasUid_(ss, leerConfig_(ss), []);
  SpreadsheetApp.flush();
  var r = sincronizar_({ confirmarRetiros: false });
  if (r.estado !== 'OK') throw new Error('La sincronización inicial falló: ' + JSON.stringify(r.errores || r.estado));
  return { base: personas_(ss), sync: r };
}

// ---------------------------------------------------------------------------
// Utilidades de prueba
// ---------------------------------------------------------------------------

function personas_(ss) {
  var m = leerMaestro_(ss);
  var porUid = {}, porNombre = {}, lista = [];
  m.filas.forEach(function (r, i) {
    if (!r[M.UID]) return;
    var p = { fila: i + 2, uid: r[M.UID], id: r[M.ID], nombre: r[M.NOMBRE], correo: r[M.CORREO], estado: r[M.ESTADO_INSC],
      llego: r[M.ESTADO], alertas: String(r[M.ALERTAS]), token: r[M.TOKEN], sticker: r[M.STICKER], idsAnt: String(r[M.IDS_ANT]),
      fuente: r[M.FUENTE], pestana: r[M.PESTANA] };
    porUid[p.uid] = p; porNombre[p.nombre] = p; lista.push(p);
  });
  return { porUid: porUid, porNombre: porNombre, lista: lista };
}

function hoja_(ss, nombre) { return ss.getSheetByName(nombre); }

function filaDe_(h, nombre) {
  var v = h.getRange(15, FX_COL.nombre, Math.max(h.getLastRow() - 14, 1), 1).getDisplayValues();
  for (var i = 0; i < v.length; i++) if (v[i][0] === nombre) return 15 + i;
  throw new Error('No se encontró «' + nombre + '» en ' + h.getName());
}

function colUid_(h) {
  var e = localizarEncabezado_(h, 40);
  return e.indice[normTexto_(ENC.uid)] + 1;
}

function escribirPersona_(h, fila, p) {
  h.getRange(fila, 1, 1, FX_ENCABEZADOS.length).setValues([fxFila_(p, fila - 14)]);
}

function sync_(confirmar) { return sincronizar_({ confirmarRetiros: confirmar === true }); }

function Chk_() { this.f = []; }
Chk_.prototype.eq = function (a, b, msg) { if (a !== b) this.f.push(msg + ': esperado «' + b + '», obtenido «' + a + '»'); return this; };
Chk_.prototype.ok = function (c, msg) { if (!c) this.f.push(msg); return this; };
Chk_.prototype.fin = function (detalle) { return { ok: this.f.length === 0, detalle: this.f.length ? this.f.join(' | ') : detalle }; };

/** Todos los UID iniciales conservan su ID, salvo los exceptuados. */
function mismosIds_(chk, base, ahora, excepto) {
  excepto = excepto || [];
  var cambian = 0;
  base.lista.forEach(function (p) {
    if (excepto.indexOf(p.uid) !== -1) return;
    var q = ahora.porUid[p.uid];
    if (!q) { chk.ok(false, p.id + ' desapareció del Maestro'); return; }
    if (q.id !== p.id) { cambian++; chk.ok(false, p.nombre + ' cambió de ' + p.id + ' a ' + q.id); }
  });
  return cambian;
}

function activos_(pp) { return pp.lista.filter(function (p) { return p.estado === ESTADO_ACTIVO; }).length; }

/** La columna UID de la pestaña coincide con el Maestro fila por fila. */
function uidAlineados_(ss, chk, nombreHoja) {
  var h = hoja_(ss, nombreHoja), c = colUid_(h), n = h.getLastRow() - 14;
  var nombres = h.getRange(15, FX_COL.nombre, n, 1).getDisplayValues(), uids = h.getRange(15, c, n, 1).getDisplayValues();
  var pp = personas_(ss), malos = 0;
  nombres.forEach(function (r, i) {
    var nom = String(r[0]).trim(), uid = String(uids[i][0]).trim();
    if (!nom || esPorConfirmar_(nom)) { if (uid) malos++; return; }
    var p = pp.porUid[uid];
    if (!p || p.nombre !== nom) malos++;
  });
  chk.eq(malos, 0, 'Filas con UID desalineado en ' + nombreHoja);
}

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

var PRUEBAS_T = [
  { id: 'T1', accion: 'Ordenar la tabla de Pagados por empresa', esperado: 'Mismos ID para todas las personas. Cero altas, cero bajas', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS);
    h.getRange(15, 1, FX_FILAS_TABLA, h.getLastColumn()).sort({ column: FX_COL.empresa, ascending: false });
    var r = sync_(), c = new Chk_();
    c.eq(r.estado, 'OK', 'Estado');
    mismosIds_(c, ctx.base, personas_(ss));
    c.eq(r.plan.nuevas.length, 0, 'Altas').eq(r.plan.retirosNuevos.length, 0, 'Bajas');
    uidAlineados_(ss, c, FX_PAGADOS);
    return c.fin(ctx.base.lista.length + ' personas con el mismo ID · 0 altas · 0 bajas · UID alineados');
  } },
  { id: 'T2', accion: 'Cortar solo las columnas visibles de 3 filas y pegarlas más abajo (el UID queda atrás)', esperado: 'Mismos ID. La columna UID queda reparada', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), n = FX_ENCABEZADOS.length;
    var ini = filaDe_(h, 'Bruno Prueba Cedeño');
    var datos = h.getRange(ini, 1, 3, n).getValues();
    h.getRange(ini, 1, 3, n).clearContent();
    h.getRange(FX_FILA_LIBRE - 5, 1, 3, n).setValues(datos);
    var r = sync_(), c = new Chk_();
    c.eq(r.estado, 'OK', 'Estado');
    mismosIds_(c, ctx.base, personas_(ss));
    c.eq(r.plan.nuevas.length, 0, 'Altas').eq(r.plan.retirosNuevos.length, 0, 'Bajas').eq(r.plan.reparados.length, 3, 'UID reparados');
    uidAlineados_(ss, c, FX_PAGADOS);
    return c.fin('3 filas movidas sin su UID: mismos ID, 3 UID reparados, columna alineada');
  } },
  { id: 'T3', accion: 'Arrastrar filas completas a otra posición', esperado: 'Mismos ID', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS);
    var ini = filaDe_(h, 'Carla Demo Rivas');
    h.moveRows(h.getRange(ini + ':' + (ini + 2)), 31);
    var r = sync_(), c = new Chk_();
    c.eq(r.estado, 'OK', 'Estado');
    mismosIds_(c, ctx.base, personas_(ss));
    c.eq(r.plan.nuevas.length, 0, 'Altas').eq(r.plan.retirosNuevos.length, 0, 'Bajas');
    uidAlineados_(ss, c, FX_PAGADOS);
    return c.fin('3 filas completas movidas: mismos ID, 0 altas, 0 bajas');
  } },
  { id: 'T4', accion: 'Cortar una persona de Pagados y pegarla en Anulaciones', esperado: 'Esa persona pasa a Retirado. Las demás intactas', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), an = hoja_(ss, '⛔Anulaciones');
    var f = filaDe_(h, 'Gabriela Test Ortiz'), cu = colUid_(h);
    var datos = h.getRange(f, 1, 1, cu).getValues();
    an.getRange(16, 1, 1, cu).setValues(datos);
    h.getRange(f, 1, 1, cu).clearContent();
    var r = sync_(), c = new Chk_(), pp = personas_(ss), p = ctx.base.porNombre['Gabriela Test Ortiz'];
    c.eq(r.estado, 'OK', 'Estado').eq(pp.porUid[p.uid].estado, ESTADO_RETIRADO, 'Estado de ' + p.id);
    c.eq(r.plan.retirosNuevos.length, 1, 'Bajas').eq(r.plan.nuevas.length, 0, 'Altas (Anulaciones no debe leerse)');
    c.eq(activos_(pp), activos_(ctx.base) - 1, 'Activos');
    mismosIds_(c, ctx.base, pp);
    return c.fin(p.id + ' pasa a Retirado; Anulaciones no se lee; los demás intactos');
  } },
  { id: 'T5', accion: 'Borrar una fila de Pagados', esperado: 'Pasa a Retirado. Su número no se reutiliza', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), p = ctx.base.porNombre['Jose Ficticio Alvarez'];
    h.deleteRow(filaDe_(h, p.nombre));
    var r1 = sync_();
    escribirPersona_(h, FX_FILA_LIBRE - 1, ['n1', 'Nuevo Ficticio Tras Borrado', 'Empresa Tau', 'Analista', 'nuevo.t5@ejemplo.test', '0997000001', '', '']);
    var r2 = sync_(), c = new Chk_(), pp = personas_(ss);
    c.eq(r1.estado, 'OK', 'Estado 1').eq(pp.porUid[p.uid].estado, ESTADO_RETIRADO, 'Estado de ' + p.id);
    var nuevo = pp.porNombre['Nuevo Ficticio Tras Borrado'];
    var maxP = Math.max.apply(null, ctx.base.lista.map(function (x) { var q = parsearId_(x.id); return q.sigla === 'P' ? q.numero : 0; }));
    c.ok(nuevo, 'La persona nueva no está en el Maestro');
    if (nuevo) { c.ok(nuevo.id !== p.id, 'Se reutilizó el número ' + p.id); c.eq(nuevo.id, (maxP + 1) + 'P', 'ID de la persona nueva'); }
    return c.fin(p.id + ' pasa a Retirado; la persona nueva recibe ' + (nuevo && nuevo.id) + ', no ' + p.id);
  } },
  { id: 'T6', accion: 'Borrar una fila y volver a escribir a la misma persona a mano (sin UID)', esperado: 'Recupera su mismo ID y vuelve a Activo. No hay duplicado', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), p = ctx.base.porNombre['Nelson Prueba Arias'];
    h.deleteRow(filaDe_(h, p.nombre));
    var r1 = sync_();
    var intermedio = personas_(ss).porUid[p.uid].estado;
    escribirPersona_(h, FX_FILA_LIBRE, fxPersona_('p14'));
    var r2 = sync_(), c = new Chk_(), pp = personas_(ss);
    c.eq(intermedio, ESTADO_RETIRADO, 'Tras borrar');
    c.eq(pp.porUid[p.uid].estado, ESTADO_ACTIVO, 'Tras reescribir').eq(pp.porUid[p.uid].id, p.id, 'ID');
    c.eq(r2.plan.nuevas.length, 0, 'Altas').eq(r2.plan.recuperados.length, 1, 'Recuperados');
    c.eq(pp.lista.length, ctx.base.lista.length, 'Personas en el Maestro');
    uidAlineados_(ss, c, FX_PAGADOS);
    return c.fin(p.id + ' vuelve a Activo con su mismo ID; sin duplicado');
  } },
  { id: 'T7', accion: 'Borrar 8 filas de golpe', esperado: 'La sincronización pausa y pide confirmación con los 8 nombres', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS);
    var claves = ['p11', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18'];
    var filas = claves.map(function (k) { return filaDe_(h, fxPersona_(k)[1]); }).sort(function (a, b) { return b - a; });
    filas.forEach(function (f) { h.deleteRow(f); });
    var r1 = sync_(false), c = new Chk_();
    c.eq(r1.estado, 'PAUSA', 'Estado sin confirmar');
    c.eq((r1.retiros || []).length, 8, 'Nombres en la confirmación');
    var nombres = (r1.retiros || []).map(function (x) { return x.nombre; });
    claves.forEach(function (k) { c.ok(nombres.indexOf(fxPersona_(k)[1]) !== -1, 'Falta ' + fxPersona_(k)[1] + ' en la confirmación'); });
    c.eq(activos_(personas_(ss)), activos_(ctx.base), 'Activos tras la pausa (no debe escribir)');
    var r2 = sync_(true);
    c.eq(r2.estado, 'OK', 'Estado confirmando').eq(activos_(personas_(ss)), activos_(ctx.base) - 8, 'Activos tras confirmar');
    return c.fin('Pausa con los 8 nombres sin escribir nada; al confirmar, 8 Retirados');
  } },
  { id: 'T8', accion: 'Escribir una persona distinta encima de otra', esperado: 'Persona nueva con ID nuevo; la anterior pasa a Retirado', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), p = ctx.base.porNombre['Tania Prueba Flores'];
    var f = filaDe_(h, p.nombre);
    h.getRange(f, 1, 1, FX_ENCABEZADOS.length).setValues([fxFila_(['n2', 'Nueva Persona Encima', 'Empresa Upsilon', 'Gerente', 'nueva.encima@ejemplo.test', '0997000002', '', ''], f - 14)]);
    var r = sync_(), c = new Chk_(), pp = personas_(ss), nueva = pp.porNombre['Nueva Persona Encima'];
    c.eq(r.estado, 'OK', 'Estado').eq(pp.porUid[p.uid].estado, ESTADO_RETIRADO, 'Estado de ' + p.id);
    c.ok(nueva && nueva.id !== p.id && nueva.uid !== p.uid, 'La persona nueva debe tener ID y UID propios');
    uidAlineados_(ss, c, FX_PAGADOS);
    return c.fin('Nueva: ' + (nueva && nueva.id) + ' · ' + p.id + ' pasa a Retirado');
  } },
  { id: 'T9', accion: 'Corregir una tilde en un nombre', esperado: 'Mismo ID, dato actualizado', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), p = ctx.base.porNombre['Jose Ficticio Alvarez'];
    h.getRange(filaDe_(h, p.nombre), FX_COL.nombre).setValue('José Ficticio Álvarez');
    var r = sync_(), c = new Chk_(), q = personas_(ss).porUid[p.uid];
    c.eq(r.estado, 'OK', 'Estado').eq(q.id, p.id, 'ID').eq(q.nombre, 'José Ficticio Álvarez', 'Nombre en el Maestro').eq(r.plan.nuevas.length, 0, 'Altas');
    return c.fin(p.id + ' conserva su ID; nombre actualizado con tildes');
  } },
  { id: 'T10', accion: 'Cambiar solo el correo de alguien', esperado: 'Mismo ID, correo actualizado', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), p = ctx.base.porNombre['Ulises Prueba Guerra'];
    h.getRange(filaDe_(h, p.nombre), FX_COL.correo).setValue('ulises.nuevo@ejemplo.test');
    var r = sync_(), c = new Chk_(), q = personas_(ss).porUid[p.uid];
    c.eq(r.estado, 'OK', 'Estado').eq(q.id, p.id, 'ID').eq(q.correo, 'ulises.nuevo@ejemplo.test', 'Correo en el Maestro').eq(r.plan.nuevas.length, 0, 'Altas');
    return c.fin(p.id + ' conserva su ID; correo actualizado');
  } },
  { id: 'T11', accion: 'Copiar y pegar una fila entera (con su UID) y cambiarle nombre y correo', esperado: 'Dos personas distintas, con ID distintos', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), p = ctx.base.porNombre['Andrea Ficticia Molina'], cu = colUid_(h);
    var f = filaDe_(h, p.nombre);
    h.getRange(f, 1, 1, cu).copyTo(h.getRange(FX_FILA_LIBRE, 1, 1, cu));
    h.getRange(FX_FILA_LIBRE, FX_COL.nombre).setValue('Copia Distinta Ficticia');
    h.getRange(FX_FILA_LIBRE, FX_COL.correo).setValue('copia.distinta@ejemplo.test');
    var r = sync_(), c = new Chk_(), pp = personas_(ss), copia = pp.porNombre['Copia Distinta Ficticia'];
    c.eq(r.estado, 'OK', 'Estado').eq(pp.porUid[p.uid].id, p.id, 'ID de la original');
    c.ok(copia && copia.id !== p.id && copia.uid !== p.uid, 'La copia debe ser otra persona');
    c.eq(r.plan.nuevas.length, 1, 'Altas');
    uidAlineados_(ss, c, FX_PAGADOS);
    return c.fin('Original ' + p.id + ' intacta; copia recibe ' + (copia && copia.id));
  } },
  { id: 'T12', accion: 'Registrar la llegada de alguien y luego borrarlo de la pestaña', esperado: 'Sigue contando como asistente. Marcado para revisión', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), p = ctx.base.porNombre['Pablo Prueba Castro'];
    ss.getSheetByName(HOJA.MAESTRO).getRange(p.fila, M.ESTADO + 1).setValue(LLEGO); // simula el check-in (etapa 4)
    h.deleteRow(filaDe_(h, p.nombre));
    var r = sync_(), c = new Chk_(), q = personas_(ss).porUid[p.uid];
    c.eq(r.estado, 'OK', 'Estado').eq(q.llego, LLEGO, 'La llegada se conserva').eq(q.estado, ESTADO_RETIRADO, 'Inscripción');
    c.ok(q.alertas.indexOf(ALERTA.RETIRADO_TRAS_LLEGAR) !== -1, 'Falta la alerta «' + ALERTA.RETIRADO_TRAS_LLEGAR + '»');
    return c.fin(p.id + ': llegada intacta + alerta «' + ALERTA.RETIRADO_TRAS_LLEGAR + '»');
  } },
  { id: 'T13', accion: 'Renombrar la pestaña Pagados', esperado: 'La sincronización se detiene. Nadie pasa a Retirado', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS);
    h.setName('Lista pagados RENOMBRADA');
    var r;
    try { r = sync_(true); } finally { h.setName(FX_PAGADOS); }
    var c = new Chk_(), pp = personas_(ss);
    c.eq(r.estado, 'ERROR', 'Estado');
    c.eq(activos_(pp), activos_(ctx.base), 'Activos');
    mismosIds_(c, ctx.base, pp);
    return c.fin('Detenida: «' + (r.errores || [''])[0] + '» · 0 retirados');
  } },
  { id: 'T14', accion: 'Escanear el QR de una persona Retirada', esperado: 'Lector en naranja: «Inscripción retirada»', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), p = ctx.base.porNombre['Olga Prueba Benítez'];
    h.deleteRow(filaDe_(h, p.nombre));
    sync_();
    var c = new Chk_(), porToken = personas_(ss).lista.filter(function (x) { return x.token === p.token; });
    c.eq(porToken.length, 1, 'Personas con ese token').eq(porToken[0] && porToken[0].estado, ESTADO_RETIRADO, 'Estado del token');
    return c.fin('PARCIAL: el token de ' + p.id + ' sigue existiendo y devuelve «Retirado» (naranja). La pantalla del lector se prueba en la etapa 4');
  } },
  { id: 'T15', accion: 'Dos personas con el mismo correo; borrar a una', esperado: 'Solo esa pasa a Retirado. La otra conserva su ID', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), a = ctx.base.porNombre['Hilda Compartido Uno'], b = ctx.base.porNombre['Iván Compartido Dos'];
    var c = new Chk_();
    c.ok(a.id !== b.id, 'Las dos personas con correo compartido deben tener ID distintos');
    c.ok(a.alertas.indexOf(ALERTA.CORREO_COMPARTIDO) !== -1, 'Falta la alerta «Correo compartido» al inicio');
    h.deleteRow(filaDe_(h, a.nombre));
    var r = sync_(), pp = personas_(ss);
    c.eq(r.estado, 'OK', 'Estado').eq(pp.porUid[a.uid].estado, ESTADO_RETIRADO, 'Estado de ' + a.id);
    c.eq(pp.porUid[b.uid].estado, ESTADO_ACTIVO, 'Estado de ' + b.id).eq(pp.porUid[b.uid].id, b.id, 'ID de ' + b.nombre);
    return c.fin(a.id + ' Retirado · ' + b.id + ' conserva su ID');
  } },

  // ------------------------- Casos extra (decisiones del 27/09) -------------------------
  { id: 'T16', accion: 'Siglas: Diplomado/B2B en OBSERVACIONES, «Por confirmar», Anulaciones, Estado del Cliente', esperado: 'PD y PB con numeración propia; ambas → P con alerta; «Por confirmar» y Anulaciones fuera; Estado del Cliente ignorado', fn: function (ss, ctx) {
    var b = ctx.base.porNombre, c = new Chk_();
    c.eq(b['Andrea Ficticia Molina'].id, '1P', 'Andrea');
    c.eq(b['Bruno Prueba Cedeño'].id, '1PD', 'Bruno (Diplomado Internacional)');
    c.eq(b['Carla Demo Rivas'].id, '2PD', 'Carla (DIPLOMADO, estado Pendiente)');
    c.eq(b['Diego Ensayo Paz'].id, '1PB', 'Diego (B2B)');
    c.eq(b['Elena Muestra Vera'].id, '2PB', 'Elena («Rueda b 2 b»)');
    c.eq(b['Fabián Simulado Loor'].id, '2P', 'Fabián (Diplomado + B2B)');
    c.ok(b['Fabián Simulado Loor'].alertas.indexOf(ALERTA.DOS_SUBCATEGORIAS) !== -1, 'Falta la alerta de Diplomado y B2B a la vez');
    c.eq(b['Gabriela Test Ortiz'].id, '3P', 'Gabriela (otra observación)');
    c.eq(b['Victoria Sumarse Hidalgo'].id, '1S', 'Victoria').eq(b['Walter Sumarse Ibarra'].id, '4S', 'Walter (los «Por confirmar» de SUMARSE ahora son cupos)');
    c.eq(b['Yolanda Auspicio King'].id, '1A', 'Yolanda').eq(b['Alberto Expo Mera'].id, '1E', 'Alberto').eq(b['Beatriz Otros Núñez'].id, '1OT', 'Beatriz');
    c.ok(!b['Anulado Ficticio Nieto'], 'Anulaciones no debe leerse');
    c.ok(!ctx.base.lista.some(function (p) { return esPorConfirmar_(p.nombre); }), 'Ningún registro debe llamarse «Por confirmar»');
    c.eq(ctx.base.lista.length, 34, 'Registros en el Maestro (28 personas + 6 cupos)');
    c.ok(b['Karla Sindatos Uno'].alertas.indexOf(ALERTA.SIN_AMBOS) !== -1, 'Falta «Sin correo ni celular»');
    c.ok(b['Rosa Prueba Dávila'].alertas.indexOf(ALERTA.CELULAR_INVALIDO) !== -1, 'Falta «Celular inválido»');
    c.ok(b['Sergio Prueba Espinoza'].alertas.indexOf(ALERTA.CORREO_INVALIDO) !== -1, 'Falta «Correo inválido»');
    c.ok(b['Nelson Prueba Arias'].alertas.indexOf(ALERTA.CELULAR_INVALIDO) === -1, '«+593 99 100 0014» debe ser válido');
    return c.fin('34 registros: P 1–16, PD 1–2, PB 1–2, S 1–6 (3 cupos), A 1–6 (3 cupos), E 1, OT 1 · Anulaciones fuera · alertas correctas');
  } },
  { id: 'T17', accion: 'Cambiar la observación antes y después del corte de impresión', esperado: 'Antes: el ID se reasigna y el número viejo no se reutiliza. Después: el ID queda fijo con alerta', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), g = ctx.base.porNombre['Gabriela Test Ortiz'], bruno = ctx.base.porNombre['Bruno Prueba Cedeño'];
    h.getRange(filaDe_(h, g.nombre), FX_COL.obs).setValue('Diplomado');
    var r1 = sync_(), c = new Chk_(), q = personas_(ss).porUid[g.uid];
    c.eq(r1.estado, 'OK', 'Estado 1').eq(q.id, '3PD', 'Nuevo ID de Gabriela').ok(q.idsAnt.indexOf(g.id) !== -1, 'IDs anteriores debe guardar ' + g.id);
    escribirPersona_(h, FX_FILA_LIBRE, ['n3', 'Persona Posterior Ficticia', 'Empresa Phi', 'Analista', 'posterior@ejemplo.test', '0997000003', '', '']);
    sync_();
    var post = personas_(ss).porNombre['Persona Posterior Ficticia'];
    c.eq(post && post.id, '17P', 'La siguiente P no reutiliza ' + g.id);
    var rc = marcarCorte_(ss, { confirmarRetiros: false });
    c.eq(rc.estado, 'OK', 'Corte');
    h.getRange(filaDe_(h, bruno.nombre), FX_COL.obs).setValue('');
    escribirPersona_(h, FX_FILA_LIBRE + 1, ['n4', 'Persona Tras Corte Ficticia', 'Empresa Chi', 'Analista', 'trascorte@ejemplo.test', '0997000004', '', '']);
    var r2 = sync_(), pp = personas_(ss), b2 = pp.porUid[bruno.uid], tc = pp.porNombre['Persona Tras Corte Ficticia'];
    c.eq(b2.id, bruno.id, 'Tras el corte el ID de Bruno no cambia').ok(b2.alertas.indexOf(ALERTA.CAMBIO_TIPO) !== -1, 'Falta «Cambió de tipo»');
    c.eq(b2.sticker, 'Sí', 'Sticker impreso de Bruno').eq(tc && tc.sticker, 'No', 'Sticker de la persona nueva tras el corte');
    return c.fin(g.id + ' → 3PD antes del corte; la siguiente P es 17P; tras el corte ' + bruno.id + ' queda fijo con alerta; persona nueva con «Sticker impreso = No»');
  } },
  { id: 'T18', accion: 'Ocultar filas y filtrar', esperado: 'Nadie pasa a Retirado', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS);
    h.hideRows(16, 5);
    var r = sync_(), c = new Chk_();
    c.eq(r.estado, 'OK', 'Estado').eq(r.plan.retirosNuevos.length, 0, 'Bajas');
    mismosIds_(c, ctx.base, personas_(ss));
    return c.fin('5 filas ocultas se leen igual: 0 retirados');
  } },
  { id: 'T19', accion: 'Renombrar un encabezado («Empresa»)', esperado: 'La sincronización se detiene. Nadie pasa a Retirado', fn: function (ss, ctx) {
    hoja_(ss, FX_PAGADOS).getRange(14, FX_COL.empresa).setValue('Empresa X');
    var r = sync_(true), c = new Chk_();
    c.eq(r.estado, 'ERROR', 'Estado').eq(activos_(personas_(ss)), activos_(ctx.base), 'Activos');
    return c.fin('Detenida: «' + (r.errores || [''])[0] + '»');
  } },
  { id: 'T20', accion: 'Pegar la misma persona dos veces (fila duplicada, sin UID)', esperado: 'No recibe un segundo ID; se reporta como duplicada', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS);
    escribirPersona_(h, FX_FILA_LIBRE, fxPersona_('p01'));
    var r = sync_(), c = new Chk_();
    c.eq(r.estado, 'OK', 'Estado').eq(r.plan.nuevas.length, 0, 'Altas').eq(r.plan.duplicadas.length, 1, 'Duplicadas reportadas');
    c.eq(personas_(ss).lista.length, ctx.base.lista.length, 'Personas en el Maestro');
    return c.fin('La fila repetida no recibe ID y queda en el informe');
  } },
  { id: 'T21', accion: 'Mover a una persona de Pagados a SUMARSE, antes y después del corte', esperado: 'Antes del corte: ID nuevo con la sigla S (el número viejo no se reutiliza). Después: conserva su ID con alerta «Cambió de fuente»', fn: function (ss, ctx) {
    var h = hoja_(ss, FX_PAGADOS), s = hoja_(ss, 'SUMARSE'), e = hoja_(ss, 'EXPOSITORES'), cu = colUid_(h), n = FX_ENCABEZADOS.length;
    function mover(nombre, destino, fila) {
      var f = filaDe_(h, nombre);
      destino.getRange(fila, 1, 1, n).setValues(h.getRange(f, 1, 1, n).getValues());
      h.getRange(f, 1, 1, cu).clearContent();
    }
    var u = ctx.base.porNombre['Ulises Prueba Guerra'], a = ctx.base.porNombre['Andrea Ficticia Molina'];
    mover(u.nombre, s, 40);
    var r1 = sync_(), c = new Chk_(), q = personas_(ss).porUid[u.uid];
    c.eq(r1.estado, 'OK', 'Estado 1').eq(q.id, '7S', 'Nuevo ID antes del corte').eq(q.estado, ESTADO_ACTIVO, 'Estado').eq(q.pestana, 'SUMARSE', 'Pestaña');
    c.ok(q.idsAnt.indexOf(u.id) !== -1, 'IDs anteriores debe guardar ' + u.id).ok(q.alertas.indexOf(ALERTA.CAMBIO_FUENTE) === -1, 'No debe marcar «Cambió de fuente» antes del corte');
    c.eq(r1.plan.nuevas.length, 0, 'Altas');
    c.eq(marcarCorte_(ss, { confirmarRetiros: false }).estado, 'OK', 'Corte');
    mover(a.nombre, e, 30);
    var r2 = sync_(), q2 = personas_(ss).porUid[a.uid];
    c.eq(r2.estado, 'OK', 'Estado 2').eq(q2.id, a.id, 'Tras el corte conserva su ID').eq(q2.pestana, 'EXPOSITORES', 'Pestaña');
    c.ok(q2.alertas.indexOf(ALERTA.CAMBIO_FUENTE) !== -1, 'Falta «Cambió de fuente» tras el corte');
    return c.fin(u.id + ' → 7S antes del corte · tras el corte ' + a.id + ' queda fijo en EXPOSITORES con «Cambió de fuente»');
  } },
  { id: 'T22', accion: 'La misma persona en dos pestañas con el nombre abreviado, y otra con el mismo correo en otra pestaña', esperado: 'Ambos pares quedan en Alertas como «posible duplicado»; nadie se une ni se borra; sin falsos positivos en la base', fn: function (ss, ctx) {
    var c = new Chk_();
    c.eq(ctx.sync.plan.posiblesDuplicados.length, 0, 'Posibles duplicados en el escenario base (falsos positivos)');
    escribirPersona_(hoja_(ss, 'SUMARSE'), 40, ['d1', 'Andrea Molina', 'Exportadora Alfa', 'Gerente', 'otra.andrea@ejemplo.test', '0998000001', '', '']);
    escribirPersona_(hoja_(ss, 'EXPOSITORES'), 30, ['d2', 'Persona Distinta Ficticia', 'Logística Pi', 'Analista', 'bruno.cedeno@ejemplo.test', '0998000002', '', '']);
    var r = sync_(), pp = personas_(ss);
    var a1 = pp.porNombre['Andrea Ficticia Molina'], a2 = pp.porNombre['Andrea Molina'];
    var b1 = pp.porNombre['Bruno Prueba Cedeño'], b2 = pp.porNombre['Persona Distinta Ficticia'];
    c.eq(r.estado, 'OK', 'Estado').eq(r.plan.posiblesDuplicados.length, 2, 'Pares detectados').eq(r.plan.nuevas.length, 2, 'Altas');
    c.ok(a1.alertas.indexOf(PREFIJO_POSIBLE_DUPLICADO + a2.id) !== -1, a1.id + ' debe apuntar a ' + a2.id);
    c.ok(a2.alertas.indexOf(PREFIJO_POSIBLE_DUPLICADO + a1.id) !== -1, a2.id + ' debe apuntar a ' + a1.id);
    c.ok(b1.alertas.indexOf(PREFIJO_POSIBLE_DUPLICADO + b2.id) !== -1, b1.id + ' debe apuntar a ' + b2.id);
    hoja_(ss, 'SUMARSE').deleteRow(40);
    var r2 = sync_(), q = personas_(ss).porUid[a1.uid];
    c.ok(q.alertas.indexOf(PREFIJO_POSIBLE_DUPLICADO) === -1 || q.alertas.indexOf(a2.id) === -1, 'Al borrar el duplicado, la alerta de ' + a1.id + ' debe desaparecer');
    return c.fin('0 falsos positivos en la base · ' + a1.id + ' ↔ ' + a2.id + ' (nombre) y ' + b1.id + ' ↔ ' + b2.id + ' (correo) · la alerta se limpia al borrar el duplicado');
  } },
  { id: 'T23', accion: 'Maestro viejo (30 columnas) + credencial generada y luego se corrige el nombre', esperado: 'La columna «Huella credencial» se agrega sola sin perder datos; al cambiar el nombre aparece «Credencial desactualizada»', fn: function (ss, ctx) {
    var c = new Chk_(), mh = ss.getSheetByName(HOJA.MAESTRO), n = mh.getLastRow() - 1;
    // Simula el Maestro de la etapa 1: sin la columna 31.
    mh.getRange(1, M.HUELLA + 1, n + 1, MAESTRO_COLUMNAS.length - M.HUELLA).clearContent(); // sin las columnas 31 en adelante
    var r0 = sync_();
    c.eq(r0.estado, 'OK', 'Sincronizar con Maestro de 30 columnas');
    c.eq(String(mh.getRange(1, M.HUELLA + 1).getValue()), 'Huella credencial', 'Encabezado agregado');
    mismosIds_(c, ctx.base, personas_(ss));
    // Simula una credencial generada para Andrea (sin pasar por Slides).
    var p = personas_(ss).porNombre['Andrea Ficticia Molina'], cfg = leerConfig_(ss);
    var fila = leerMaestro_(ss).filas[p.fila - 2];
    mh.getRange(p.fila, M.CREDENCIAL + 1).setFormula('=HYPERLINK("https://drive.google.com/file/d/xxxxxxxxxxxxxxxxxxxxxxxx/view","Ver credencial")');
    mh.getRange(p.fila, M.HUELLA + 1).setValue(huellaCredencial_(fila, cfg));
    var r1 = sync_();
    c.ok(personas_(ss).porUid[p.uid].alertas.indexOf(ALERTA.CREDENCIAL_DESACTUALIZADA) === -1, 'Sin cambios no debe marcarse desactualizada');
    var h = hoja_(ss, FX_PAGADOS);
    h.getRange(filaDe_(h, p.nombre), FX_COL.nombre).setValue('Andrea Ficticia Molina Ruiz');
    var r2 = sync_(), q = personas_(ss).porUid[p.uid];
    c.eq(q.id, p.id, 'Mismo ID').ok(q.alertas.indexOf(ALERTA.CREDENCIAL_DESACTUALIZADA) !== -1, 'Falta «Credencial desactualizada»');
    return c.fin('Columna 31 agregada sola · ' + p.id + ' marcada «Credencial desactualizada» al corregir el nombre');
  } },
  { id: 'T24', accion: 'Intentar enviar un correo con ENVIOS_HABILITADOS = NO', esperado: 'Se rechaza sin enviar y queda «ENVIO_RECHAZADO» en la Bitácora', fn: function (ss, ctx) {
    var c = new Chk_();
    escribirConfig_(ss, 'ENVIOS_HABILITADOS', 'NO');
    var r = enviarCorreos_(ss, [{ para: { email: 'nadie@ejemplo.test', name: 'Nadie' }, asunto: 'No debe salir', html: '<p>x</p>', adjunto: null, etiqueta: 'prueba' }]);
    c.eq(r.length, 1, 'Respuestas').eq(r[0].ok, false, 'Enviado').eq(r[0].error, 'Envíos deshabilitados', 'Motivo');
    var b = ss.getSheetByName(HOJA.BITACORA), n = b.getLastRow();
    var acciones = n > 1 ? b.getRange(2, 4, n - 1, 1).getValues().map(function (x) { return x[0]; }) : [];
    c.ok(acciones.indexOf('ENVIO_RECHAZADO') !== -1, 'Falta ENVIO_RECHAZADO en la Bitácora');
    c.eq(compacto_(leerConfig_(ss).valores.ENVIOS_HABILITADOS), 'no', 'El interruptor sigue en NO');
    return c.fin('Rechazado sin enviar · registrado en la Bitácora · interruptor en NO');
  } },
  { id: 'T25', accion: 'Cupos: filas de AUSPICIANTES sin nombre o «Banco Xi 2», y «Por confirmar» de SUMARSE', esperado: 'Cada cupo recibe ID y QR como «Invitado N de DUEÑO»; el excedente («REVISAR») queda con alerta; AUSPICIANTES no va por correo', fn: function (ss, ctx) {
    var c = new Chk_(), cfg = leerConfig_(ss), m = leerMaestro_(ss).filas.filter(function (r) { return r[M.UID]; });
    function porId(id) { return m.filter(function (r) { return r[M.ID] === id; })[0]; }
    var esperado = { '3A': 'Invitado 1 de BANCO XI', '4A': 'Invitado 2 de BANCO XI', '5A': 'Invitado 1 de SEGUROS ÓMICRON',
      '2S': 'Invitado 1 de ARTESANÍAS LAMBDA', '3S': 'Invitado 1 de TEXTILES MU', '5S': 'Invitado 2 de TEXTILES MU' };
    Object.keys(esperado).forEach(function (id) {
      var r = porId(id);
      c.ok(r && esCupoSinNombre_(r), id + ' debe ser un cupo sin nombre');
      if (r) {
        c.eq(etiquetaNombre_(cfg, r), esperado[id], 'Etiqueta de ' + id);
        c.ok(String(r[M.ALERTAS]).indexOf(ALERTA.CUPO_SIN_NOMBRE) !== -1, id + ' debe tener «Cupo sin nombre»');
        c.ok(String(r[M.ALERTAS]).indexOf(ALERTA.SIN_AMBOS) === -1, id + ' no debe marcar «Sin correo ni celular»');
      }
    });
    var ex = ctx.base.porNombre['Persona Excedente Ficticia'];
    c.eq(ex && ex.id, '6A', 'ID del excedente').ok(ex && ex.alertas.indexOf('Revisar: excede cupo del auspiciante') !== -1, 'Falta la alerta de excedente');
    var z = ctx.base.porNombre['Zacarías Auspicio León'];
    c.ok(z && z.alertas.indexOf('excede cupo') === -1, 'Zacarías no debe tener alerta de excedente');
    var d = destinatarios_(ss, cfg, 'CREDENCIAL', null, false);
    c.eq(d.fuera['Cupo sin nombre (va por el auspiciante)'], 6, 'Cupos sin nombre fuera del correo');
    return c.fin('6 cupos con «Invitado N de DUEÑO» · excedente 6A con alerta · 6 de AUSPICIANTES fuera del correo');
  } },
  { id: 'T26', accion: 'Escribir a una persona en la fila de un cupo; borrar un cupo y escribir a la persona en otra fila', esperado: 'La persona hereda el ID y el QR del cupo; no se crean IDs nuevos', fn: function (ss, ctx) {
    var c = new Chk_(), h = hoja_(ss, 'AUSPICIANTES'), cu = colUid_(h);
    var antes = leerMaestro_(ss).filas.filter(function (r) { return r[M.ID] === '3A'; })[0];
    h.getRange(17, FX_COL.nombre).setValue('Invitada Asignada Ficticia');
    h.getRange(17, FX_COL.empresa).setValue('Proveedor Tau');
    h.getRange(17, FX_COL.correo).setValue('asignada@ejemplo.test');
    var r1 = sync_(), q = leerMaestro_(ss).filas.filter(function (r) { return r[M.UID] === antes[M.UID]; })[0];
    c.eq(r1.estado, 'OK', 'Estado 1').eq(q[M.ID], '3A', 'ID del cupo asignado').eq(q[M.TOKEN], antes[M.TOKEN], 'Mismo token (mismo QR)');
    c.eq(q[M.NOMBRE], 'Invitada Asignada Ficticia', 'Nombre').eq(Number(q[M.CUPO_N]), 1, 'Número de invitado conservado');
    c.ok(String(q[M.ALERTAS]).indexOf(ALERTA.CUPO_SIN_NOMBRE) === -1, 'Ya no es cupo sin nombre');
    c.eq(r1.plan.nuevas.length, 0, 'Altas').eq((r1.plan.cuposAsignados || []).length, 1, 'Cupos asignados');
    var c3 = leerMaestro_(ss).filas.filter(function (r) { return r[M.ID] === '5A'; })[0];
    h.getRange(19, 1, 1, cu).clearContent();
    escribirPersona_(h, 40, ['n9', 'Invitado Nuevo Ficticio', 'Proveedor Ups', 'Gerente', 'nuevo.inv@ejemplo.test', '0993000009', '', '', 'Seguros Ómicron']);
    var r2 = sync_(), q2 = personas_(ss).porNombre['Invitado Nuevo Ficticio'];
    c.eq(r2.estado, 'OK', 'Estado 2').eq(r2.plan.nuevas.length, 0, 'Altas (debe heredar el cupo libre)').eq(r2.plan.retirosNuevos.length, 0, 'Bajas');
    c.eq(q2 && q2.id, '5A', 'Hereda el ID del cupo').eq(q2 && q2.token, c3[M.TOKEN], 'Hereda el QR');
    return c.fin('Cupo 3A asignado conservando QR · persona escrita en otra fila hereda el cupo libre 5A');
  } },
  { id: 'T27', accion: 'Ordenar AUSPICIANTES y cortar las columnas visibles de dos cupos más abajo', esperado: 'Mismos cupos, sin IDs nuevos ni retirados', fn: function (ss, ctx) {
    var c = new Chk_(), h = hoja_(ss, 'AUSPICIANTES'), n = FX_ENCABEZADOS.length;
    var ids0 = ctx.base.lista.filter(function (p) { return p.pestana === 'AUSPICIANTES'; }).map(function (p) { return p.id; }).sort();
    h.getRange(15, 1, FX_FILAS_TABLA, h.getLastColumn()).sort({ column: FX_COL.empresa, ascending: false });
    var sync1 = sync_();
    var nombres = h.getRange(15, FX_COL.nombre, 20, 1).getValues(), aus = h.getRange(15, FX_COL.aus, 20, 1).getValues();
    var filasCupo = [];
    nombres.forEach(function (v, i) { if (!v[0] && aus[i][0] && filasCupo.length < 2) filasCupo.push(15 + i); });
    filasCupo.forEach(function (f, k) {
      var datos = h.getRange(f, 1, 1, n).getValues();
      h.getRange(f, 1, 1, n).clearContent();
      h.getRange(50 + k, 1, 1, n).setValues(datos);
    });
    var r = sync_();
    var ids1 = personas_(ss).lista.filter(function (p) { return p.pestana === 'AUSPICIANTES' && p.estado === ESTADO_ACTIVO; }).map(function (p) { return p.id; }).sort();
    c.eq(sync1.estado, 'OK', 'Estado tras ordenar').eq(sync1.plan.nuevas.length, 0, 'Altas tras ordenar').eq(sync1.plan.retirosNuevos.length, 0, 'Bajas tras ordenar');
    c.eq(filasCupo.length, 2, 'Cupos movidos');
    c.eq(r.estado, 'OK', 'Estado').eq(r.plan.nuevas.length, 0, 'Altas').eq(r.plan.retirosNuevos.length, 0, 'Bajas');
    c.eq(ids1.join(','), ids0.join(','), 'IDs de AUSPICIANTES');
    return c.fin('Cupos movidos sin su UID: mismos ' + ids1.length + ' IDs, 0 altas, 0 bajas');
  } },
  { id: 'T28', accion: 'El auspiciante reduce sus pases: borrar la fila de un cupo', esperado: 'Solo ese cupo pasa a Retirado; su número no se quema', fn: function (ss, ctx) {
    var c = new Chk_(), h = hoja_(ss, 'AUSPICIANTES');
    var c2 = leerMaestro_(ss).filas.filter(function (r) { return r[M.ID] === '4A'; })[0];
    h.deleteRow(18);
    var r = sync_(), q = leerMaestro_(ss).filas.filter(function (x) { return x[M.UID] === c2[M.UID]; })[0];
    c.eq(r.estado, 'OK', 'Estado').eq(r.plan.retirosNuevos.length, 1, 'Bajas').eq(q[M.ESTADO_INSC], ESTADO_RETIRADO, 'Estado de 4A');
    escribirPersona_(h, 45, ['n8', 'Otra Persona Ficticia', 'Empresa Chi', 'Analista', 'otra@ejemplo.test', '0993000008', '', '', 'Banco Xi']);
    var r2 = sync_(), q2 = personas_(ss).porNombre['Otra Persona Ficticia'];
    c.eq(q2 && q2.id, '4A', 'Una persona nueva del mismo auspiciante recupera el cupo retirado');
    return c.fin('Cupo 4A retirado; la siguiente persona de Banco Xi lo recupera');
  } },
  { id: 'T29', accion: 'Hoja de la etapa 1: una fila «Banco Xi 2» que ya tenía ID como si fuera persona', esperado: 'Conserva su mismo ID y pasa a ser cupo', fn: function (ss, ctx) {
    var c = new Chk_(), mh = ss.getSheetByName(HOJA.MAESTRO), cfg = leerConfig_(ss);
    var filas = leerMaestro_(ss).filas, i = -1;
    filas.forEach(function (r, k) { if (r[M.ID] === '4A') i = k; });
    mh.getRange(i + 2, M.NOMBRE + 1).setValue('Banco Xi 2');
    mh.getRange(i + 2, M.CUPO_DE + 1, 1, 2).setValues([['', '']]);
    var h = hoja_(ss, 'AUSPICIANTES'); h.getRange(18, colUid_(h)).setValue('');
    var r = sync_(), q = leerMaestro_(ss).filas[i];
    c.eq(r.estado, 'OK', 'Estado').eq(r.plan.nuevas.length, 0, 'Altas').eq(q[M.ID], '4A', 'Mismo ID');
    c.ok(esCupoSinNombre_(q), 'Debe quedar como cupo').eq(String(q[M.CUPO_DE]), 'Banco Xi', 'Cupo de');
    c.ok(etiquetaNombre_(cfg, q).indexOf('de BANCO XI') !== -1, 'Etiqueta de invitado');
    return c.fin('4A «Banco Xi 2» conserva su ID y queda como ' + etiquetaNombre_(cfg, q));
  } },
  { id: 'T30', accion: 'Marcar la casilla «Enviar correo» en 2 filas del Maestro', esperado: 'Solo esas 2 quedan como destinatarias; marcar no envía nada', fn: function (ss, ctx) {
    var c = new Chk_(), mh = ss.getSheetByName(HOJA.MAESTRO), cfg = leerConfig_(ss);
    var a = ctx.base.porNombre['Andrea Ficticia Molina'], b = ctx.base.porNombre['Diego Ensayo Paz'];
    mh.getRange(a.fila, M.ENVIAR + 1).setValue(true);
    mh.getRange(b.fila, M.ENVIAR + 1).setValue(true);
    var u = uidsMarcados_(ss);
    c.eq(u.length, 2, 'Casillas marcadas').ok(u.indexOf(a.uid) !== -1 && u.indexOf(b.uid) !== -1, 'Deben ser Andrea y Diego');
    var d = destinatarios_(ss, cfg, 'CREDENCIAL', u, false);
    c.eq(d.van.length + Object.keys(d.fuera).reduce(function (s, k) { return s + d.fuera[k]; }, 0), 2, 'Solo se evalúan las 2 marcadas');
    var bit = ss.getSheetByName(HOJA.BITACORA), n = bit.getLastRow();
    var acc = n > 1 ? bit.getRange(2, 4, n - 1, 1).getValues().map(function (x) { return x[0]; }) : [];
    c.ok(acc.indexOf('CORREO_ENVIADO') === -1, 'Marcar no debe enviar');
    return c.fin('2 casillas → 2 destinatarias evaluadas · nada enviado');
  } },
  { id: 'T31', accion: 'Cupo «Grupo Ome 1» con auspiciante de varias líneas, y «DDOS Ficticio 1» dentro de la empresa en SUMARSE', esperado: 'Ambos se reconocen como cupos; el dueño es la primera línea; persona real con número en el nombre no se confunde', fn: function (ss, ctx) {
    var c = new Chk_(), cfg = leerConfig_(ss);
    escribirPersona_(hoja_(ss, 'AUSPICIANTES'), 41, ['g1', 'Grupo Ome 1', '', '', '', '', '', '', 'Grupo Ome\n- Filial Uno\n- Filial Dos']);
    escribirPersona_(hoja_(ss, 'AUSPICIANTES'), 42, ['g2', 'Grupo Ome 2', '', '', '', '', '', '', 'Grupo Ome\n- Filial Uno\n- Filial Dos']);
    escribirPersona_(hoja_(ss, 'SUMARSE'), 41, ['d1', 'DDOS Ficticio S.A. 1', 'Industria de Alimentos DDOS Ficticio S.A.', '', '', '', '', '', '']);
    escribirPersona_(hoja_(ss, 'AUSPICIANTES'), 43, ['r1', 'Luis Real Ficticio 2', 'Empresa Real', 'Gerente', 'real2@ejemplo.test', '0993000077', '', '', 'Banco Xi']);
    var r = sync_(), filas = leerMaestro_(ss).filas.filter(function (x) { return x[M.UID] && x[M.ESTADO_INSC] === ESTADO_ACTIVO; });
    var cupos = filas.filter(esCupoSinNombre_).map(function (x) { return etiquetaNombre_(cfg, x); });
    c.eq(r.estado, 'OK', 'Estado');
    c.ok(cupos.indexOf('Invitado 1 de GRUPO OME') !== -1 && cupos.indexOf('Invitado 2 de GRUPO OME') !== -1, 'Faltan los cupos de GRUPO OME: ' + cupos.join(' / '));
    c.ok(cupos.some(function (x) { return x.indexOf('DDOS FICTICIO') !== -1; }), 'Falta el cupo de DDOS');
    c.ok(personas_(ss).porNombre['Luis Real Ficticio 2'], 'Una persona real con número en el nombre no debe volverse cupo');
    c.eq((r.plan.posiblesDuplicados || []).length, 0, 'Posibles duplicados');
    return c.fin('GRUPO OME 1 y 2, DDOS como cupos · persona real intacta · 0 posibles duplicados');
  } },
  { id: 'T32', accion: 'Casillas vacías (FALSO) hasta la fila 200 y una fila del Maestro separada por un hueco', esperado: 'Las personas nuevas se agregan justo debajo de la última; al compactar no cambia ningún ID ni token', fn: function (ss, ctx) {
    var c = new Chk_(), mh = ss.getSheetByName(HOJA.MAESTRO);
    var nBase = leerMaestro_(ss).filas.length;
    var falsos = []; for (var k = 0; k < 199; k++) falsos.push([false]);
    mh.getRange(2, M.ENVIAR + 1, 199, 1).setValues(falsos); // simula las casillas de Instalar
    escribirPersona_(hoja_(ss, FX_PAGADOS), FX_FILA_LIBRE, ['n7', 'Persona Tras Casillas Ficticia', 'Empresa Omega', 'Analista', 'casillas@ejemplo.test', '0997000007', '', '', '']);
    var r = sync_(), filas = leerMaestro_(ss).filas;
    c.eq(r.estado, 'OK', 'Estado').eq(filas.length, nBase + 1, 'Filas del Maestro (la nueva va justo debajo)');
    c.eq(filas[filas.length - 1][M.NOMBRE], 'Persona Tras Casillas Ficticia', 'Última fila');
    // Hueco: mover la última fila a la 150.
    var nCol = MAESTRO_COLUMNAS.length, ult = filas.length + 1;
    var fila = mh.getRange(ult, 1, 1, nCol).getValues();
    mh.getRange(150, 1, 1, nCol).setValues(fila);
    mh.getRange(ult, 1, 1, nCol).clearContent();
    var antes = personas_(ss);
    var huecos = compactarMaestro_(ss), despues = personas_(ss);
    c.ok(huecos > 0, 'Debe detectar el hueco').eq(leerMaestro_(ss).filas.length, nBase + 1, 'Filas tras compactar');
    antes.lista.forEach(function (p) {
      var q = despues.porUid[p.uid];
      c.ok(q && q.id === p.id && q.token === p.token && q.nombre === p.nombre, 'Cambió ' + p.id);
    });
    var r2 = sync_();
    c.eq(r2.plan.nuevas.length, 0, 'Altas tras compactar').eq(r2.plan.retirosNuevos.length, 0, 'Bajas tras compactar');
    return c.fin('Nueva fila justo debajo de la última · compactación sin cambios de ID/token · sincronización limpia');
  } }
];

/** Vuelve a correr solo las pruebas marcadas FALLÓ en «Resultados T» y actualiza su fila. */
function menuRepetirFallidas() {
  var ui = SpreadsheetApp.getUi();
  try {
    verificarHojaFicticia_();
    var ss = SpreadsheetApp.getActiveSpreadsheet(), hr = ss.getSheetByName(HOJA_RESULTADOS);
    if (!hr || hr.getLastRow() < 2) { ui.alert('No hay resultados todavía.'); return; }
    var filas = hr.getRange(2, 1, hr.getLastRow() - 1, 4).getValues(), inicio = Date.now(), hechas = 0, pasaron = 0;
    for (var i = 0; i < filas.length && Date.now() - inicio < 240000; i++) {
      if (filas[i][3] !== 'FALLÓ') continue;
      var t = PRUEBAS_T.filter(function (x) { return x.id === filas[i][0]; })[0];
      if (!t) continue;
      var t0 = Date.now(), r;
      try { r = t.fn(ss, restablecerEscenario_(ss)); } catch (e) { r = { ok: false, detalle: 'Error: ' + (e.stack || e) }; }
      hr.getRange(i + 2, 4, 1, 3).setValues([[r.ok ? 'PASÓ' : 'FALLÓ', r.detalle, Math.round((Date.now() - t0) / 1000)]]);
      hr.getRange(i + 2, 4).setBackground(r.ok ? '#c6efce' : '#ffc7ce');
      SpreadsheetApp.flush();
      hechas++; if (r.ok) pasaron++;
    }
    var res = hr.getRange(2, 4, hr.getLastRow() - 1, 1).getValues().map(function (x) { return x[0]; });
    ui.alert(['Repetidas: ' + hechas + ' · pasaron ' + pasaron + '.', '',
      'Total: ' + res.filter(function (x) { return x === 'PASÓ'; }).length + ' de ' + res.length + ' pasaron.'].join('\n'));
  } catch (e) {
    ui.alert('Error', String(e.stack || e), ui.ButtonSet.OK);
  }
}

/** Corre solo las pruebas de los últimos cambios (cupos con varias líneas y compactación del Maestro). */
function menuProbarCambiosHoy() {
  var ui = SpreadsheetApp.getUi();
  try {
    verificarHojaFicticia_();
    var ss = SpreadsheetApp.getActiveSpreadsheet(), L = [], ok = 0, ids = ['T29', 'T31', 'T32'];
    ids.forEach(function (id) {
      var t = PRUEBAS_T.filter(function (x) { return x.id === id; })[0], r;
      try { r = t.fn(ss, restablecerEscenario_(ss)); } catch (e) { r = { ok: false, detalle: 'Error: ' + (e.message || e) }; }
      if (r.ok) ok++;
      L.push((r.ok ? 'PASÓ  ' : 'FALLÓ ') + id + ' · ' + r.detalle);
    });
    L.unshift(ok + ' de ' + ids.length + ' pasaron.', '');
    ui.alert('Pruebas de los cambios de hoy', L.join(String.fromCharCode(10)), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', String(e.stack || e), ui.ButtonSet.OK);
  }
}
