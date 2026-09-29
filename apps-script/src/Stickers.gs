/**
 * Lista para imprenta y corte de impresión (SPEC §5.4).
 */

var STICKERS_COLUMNAS = ['ID', 'Nombre', 'Empresa', 'Cargo', 'Tipo', 'Sticker impreso'];

function menuExportarStickers() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var lock = tomarBloqueo_(30000);
    var r;
    try { r = exportarStickers_(ss, leerConfig_(ss)); } finally { lock.releaseLock(); }
    ui.alert('Lista para stickers', resumenStickers_(r) +
      '\n\nEstá en la pestaña «' + HOJA.STICKERS + '». Para la imprenta: Archivo → Descargar → Excel o PDF, con esa pestaña abierta.' +
      '\n\nConsejo: sincronice el Maestro justo antes de exportar.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudo exportar', String(e.message || e), ui.ButtonSet.OK);
  }
}

/** Escribe la pestaña Stickers: activos, ordenados por sigla (orden de Config) y número. */
function exportarStickers_(ss, cfg) {
  var m = leerMaestro_(ss);
  var orden = {};
  cfg.ordenSiglas.forEach(function (s, i) { orden[s] = i; });
  var lista = m.filas.filter(function (r) {
    return r[M.UID] && r[M.ESTADO_INSC] === ESTADO_ACTIVO && parsearId_(r[M.ID]);
  });
  lista.sort(function (a, b) {
    var x = parsearId_(a[M.ID]), y = parsearId_(b[M.ID]);
    var ox = orden[x.sigla] === undefined ? 999 : orden[x.sigla], oy = orden[y.sigla] === undefined ? 999 : orden[y.sigla];
    return ox - oy || x.numero - y.numero;
  });

  var hoja = ss.getSheetByName(HOJA.STICKERS) || ss.insertSheet(HOJA.STICKERS);
  hoja.clear();
  var filas = lista.map(function (r) {
    var cupo = esCupoSinNombre_(r);
    return [r[M.ID], cupo ? etiquetaNombre_(cfg, r) : r[M.NOMBRE], cupo ? (r[M.EMPRESA] || r[M.CUPO_DE]) : r[M.EMPRESA], r[M.CARGO], r[M.FUENTE], r[M.STICKER] === 'Sí' ? 'Sí' : (r[M.STICKER] || 'No')];
  });
  hoja.getRange(1, 1, 1, STICKERS_COLUMNAS.length).setValues([STICKERS_COLUMNAS])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  if (filas.length) hoja.getRange(2, 1, filas.length, STICKERS_COLUMNAS.length).setNumberFormat('@').setValues(filas);
  hoja.setFrozenRows(1);
  hoja.autoResizeColumns(1, STICKERS_COLUMNAS.length);

  var porSigla = {};
  lista.forEach(function (r) {
    var p = parsearId_(r[M.ID]);
    var s = porSigla[p.sigla] = porSigla[p.sigla] || { n: 0, min: Infinity, max: 0 };
    s.n++; s.min = Math.min(s.min, p.numero); s.max = Math.max(s.max, p.numero);
  });
  var resumen = [['Sigla', 'Cantidad', 'Desde', 'Hasta']];
  cfg.ordenSiglas.forEach(function (s) {
    if (porSigla[s]) resumen.push([s, porSigla[s].n, porSigla[s].min + s, porSigla[s].max + s]);
  });
  var colR = STICKERS_COLUMNAS.length + 2;
  hoja.getRange(1, colR, resumen.length, 4).setValues(resumen);
  hoja.getRange(1, colR, 1, 4).setFontWeight('bold');
  return { total: lista.length, porSigla: porSigla, orden: cfg.ordenSiglas };
}

function resumenStickers_(r) {
  var lineas = [r.total + ' stickers:'];
  r.orden.forEach(function (s) {
    var x = r.porSigla[s];
    if (x) lineas.push('• ' + s + ': ' + x.n + ' (' + x.min + s + ' a ' + x.max + s + ')');
  });
  return lineas.join('\n');
}

function menuMarcarCorte() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var cfg = leerConfig_(ss);
    if (cfg.corte) {
      ui.alert('Corte ya marcado', 'El corte de impresión ya se marcó el ' + (cfg.valores.CORTE_FECHA || '(sin fecha)') + '.', ui.ButtonSet.OK);
      return;
    }
    var resp = ui.prompt('Marcar corte de impresión',
      'Se sincroniza el Maestro, se marca «Sticker impreso = Sí» a todos los activos y se exporta la lista.\n' +
      'Después del corte los ID ya no se reasignan y las personas nuevas quedan con STICKER A MANO.\n\n' +
      'Escriba CORTE para confirmar:', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK || resp.getResponseText().trim().toUpperCase() !== 'CORTE') {
      ui.alert('Corte no marcado. No se cambió nada.');
      return;
    }
    var r = marcarCorte_(ss, { interactivo: true });
    if (r.estado !== 'OK') { mostrarTexto_('Corte no marcado', informeSincronizacion_(r.sync)); return; }
    ui.alert('Corte marcado', r.marcados + ' stickers marcados como impresos.\n\n' + resumenStickers_(r.stickers) +
      '\n\nLa lista está en la pestaña «' + HOJA.STICKERS + '».', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudo marcar el corte', String(e.message || e), ui.ButtonSet.OK);
  }
}

/** Sincroniza, marca el corte y exporta. Sin diálogos (el menú pide la confirmación). */
function marcarCorte_(ss, opts) {
  var sync = sincronizar_(opts || {});
  if (sync.estado !== 'OK') return { estado: 'SYNC_' + sync.estado, sync: sync };

  var lock = tomarBloqueo_(30000);
  try {
    var m = leerMaestro_(ss);
    var marcados = 0;
    var col = m.filas.map(function (r) {
      if (r[M.UID] && r[M.ESTADO_INSC] === ESTADO_ACTIVO && parsearId_(r[M.ID])) { marcados++; return ['Sí']; }
      return [r[M.STICKER]];
    });
    if (col.length) m.hoja.getRange(2, M.STICKER + 1, col.length, 1).setValues(col);
    var ahora = fmtFecha_(new Date());
    escribirConfig_(ss, 'CORTE_IMPRESION', 'SI');
    escribirConfig_(ss, 'CORTE_FECHA', ahora);
    registrarBitacora_(ss, [eventoBitacora_('CORTE_IMPRESION', '', '', marcados + ' stickers marcados como impresos')]);
    var stickers = exportarStickers_(ss, leerConfig_(ss));
    SpreadsheetApp.flush();
    return { estado: 'OK', marcados: marcados, stickers: stickers };
  } finally {
    lock.releaseLock();
  }
}
