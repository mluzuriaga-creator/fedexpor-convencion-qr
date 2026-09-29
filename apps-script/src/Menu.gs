/**
 * Menú "Fedexpor QR".
 */

function onOpen() {
  var menu = SpreadsheetApp.getUi().createMenu('Fedexpor QR')
    .addItem('Sincronizar Maestro', 'menuSincronizar')
    .addItem('Exportar lista para stickers', 'menuExportarStickers')
    .addItem('Generar planillas de stickers (PDF)', 'menuPlanillasStickers')
    .addItem('Marcar corte de impresión', 'menuMarcarCorte');
  // Etapa 2: solo aparece si el módulo de credenciales está instalado.
  if (typeof agregarMenuCredenciales_ === 'function') { menu.addSeparator(); agregarMenuCredenciales_(menu); }
  // Etapa 3: correos y WhatsApp.
  if (typeof agregarMenuCorreos_ === 'function') agregarMenuCorreos_(menu);
  // Etapa 4: lector.
  if (typeof menuLimpiarPruebas === 'function') menu.addItem('Limpiar pruebas del lector', 'menuLimpiarPruebas');
  menu.addSeparator()
    .addItem('Instalar / reparar estructura', 'menuInstalar')
    .addItem('Probar conexión', 'probarConexion');
  // Solo existe en la hoja de pruebas ficticia (pruebas/Pruebas.gs nunca se sube a producción).
  if (typeof agregarMenuPruebas_ === 'function') agregarMenuPruebas_(menu);
  menu.addToUi();
}

// Lista usada por «Probar conexión» solo mientras no exista la pestaña Config.
var PRUEBA_PESTANAS_ORIGEN = [
  { hoja: 'Lista pagados', sigla: 'P', filaEncabezado: 14,
    subcategorias: [{ encabezado: 'OBSERVACIONES', palabra: 'diplomado', sigla: 'PD' }, { encabezado: 'OBSERVACIONES', palabra: 'b2b', sigla: 'PB' }] },
  { hoja: 'SUMARSE', sigla: 'S', filaEncabezado: 14, subcategorias: [] },
  { hoja: 'AUSPICIANTES', sigla: 'A', filaEncabezado: 14, subcategorias: [] },
  { hoja: 'EXPOSITORES', sigla: 'E', filaEncabezado: 14, subcategorias: [] }
];

/** SOLO LECTURA. No escribe ninguna celda. Muestra solo conteos, sin datos personales. */
function probarConexion() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var origenes = PRUEBA_PESTANAS_ORIGEN, filasBusqueda = 40, fuente = 'lista provisional (aún no hay Config)';
  if (ss.getSheetByName(HOJA.CONFIG)) {
    var cfg = leerConfig_(ss);
    origenes = cfg.origenes; filasBusqueda = cfg.filasBusqueda; fuente = 'pestaña Config';
  }
  var tablas = {};
  try { tablas = tablasPorHoja_(ss.getId()); } catch (e) { Logger.log(e); }

  var L = ['Archivo: ' + ss.getName(), 'Zona horaria: ' + ss.getSpreadsheetTimeZone(), 'Pestañas declaradas según: ' + fuente, ''];
  L.push('PESTAÑAS DECLARADAS (se leen)');
  origenes.forEach(function (o) {
    L.push('', '• ' + o.hoja + '  [' + o.sigla + ']');
    var hoja = ss.getSheetByName(o.hoja);
    if (!hoja) { L.push('   ✖ NO EXISTE con ese nombre exacto'); return; }
    var enc = localizarEncabezado_(hoja, filasBusqueda);
    if (!enc) { L.push('   ✖ No se encontró el encabezado «Nombre» en las primeras ' + filasBusqueda + ' filas'); return; }
    L.push('   Encabezado en la fila ' + enc.fila + (enc.fila === o.filaEncabezado ? ' (la esperada)' : '  ⚠ se esperaba la ' + o.filaEncabezado));
    Object.keys(ENC).forEach(function (k) {
      var i = enc.indice[normTexto_(ENC[k])];
      L.push('   ' + (i === undefined ? '✖ falta   ' : '✔ columna ' + columnaLetra_(i + 1) + '  ') + ENC[k]);
    });

    var colNombre = enc.indice['nombre'];
    var nDatos = hoja.getLastRow() - enc.fila;
    var nombres = nDatos > 0 ? hoja.getRange(enc.fila + 1, colNombre + 1, nDatos, 1).getDisplayValues() : [];
    var validas = [], porConfirmar = 0;
    nombres.forEach(function (r, k) {
      if (!String(r[0]).trim()) return;
      if (esPorConfirmar_(r[0])) porConfirmar++; else validas.push(k);
    });
    L.push('   Personas con nombre: ' + validas.length + '   ·   «Por confirmar» (se excluyen): ' + porConfirmar);

    (o.subcategorias || []).forEach(function (sc, j) {
      var c = enc.indice[normTexto_(sc.encabezado)];
      if (c === undefined) { L.push('   ✖ falta la columna «' + sc.encabezado + '» para ' + sc.sigla); return; }
      if (j > 0 && o.subcategorias[0].encabezado === sc.encabezado) return;
      var obs = nDatos > 0 ? hoja.getRange(enc.fila + 1, c + 1, nDatos, 1).getDisplayValues() : [];
      var conteo = {}, ambos = 0, ninguna = 0;
      validas.forEach(function (k) {
        var t = compacto_(obs[k][0]);
        var hits = o.subcategorias.filter(function (s) { return s.encabezado === sc.encabezado && t.indexOf(compacto_(s.palabra)) !== -1; });
        if (hits.length > 1) ambos++; else if (hits.length === 1) conteo[hits[0].sigla] = (conteo[hits[0].sigla] || 0) + 1; else ninguna++;
      });
      L.push('   Subcategorías por «' + sc.encabezado + '» (columna ' + columnaLetra_(c + 1) + '):');
      L.push('      ' + o.subcategorias.map(function (s) { return s.sigla + ': ' + (conteo[s.sigla] || 0); }).join('   ·   ') +
        '   ·   ambas: ' + ambos + '   ·   ' + o.sigla + ': ' + ninguna);
    });

    (tablas[o.hoja] || []).forEach(function (t) {
      L.push('   Tabla «' + t.nombre + '»: filas ' + (t.range.startRowIndex + 1) + '–' + t.range.endRowIndex +
        ', columnas ' + columnaLetra_(t.range.startColumnIndex + 1) + '–' + columnaLetra_(t.range.endColumnIndex));
    });
    if (!(tablas[o.hoja] || []).length) L.push('   ⚠ No se detectó ninguna tabla de Sheets');
  });

  var declaradas = origenes.map(function (d) { return d.hoja; });
  var otras = ss.getSheets().map(function (h) { return h.getName(); }).filter(function (n) { return declaradas.indexOf(n) === -1; });
  L.push('', 'OTRAS PESTAÑAS (no se leen, solo su nombre)');
  L.push(otras.length ? otras.map(function (n) { return '• ' + n; }).join('\n') : '(ninguna)');
  mostrarTexto_('Probar conexión · solo lectura', L);
}
