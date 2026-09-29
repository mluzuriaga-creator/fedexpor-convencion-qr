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

// ---------------------------------------------------------------------------
// Planillas de stickers para imprimir (A4, 3 columnas, 5,98 × 1,98 cm)
// Diseño aprobado el 29/09: fondo negro, texto blanco en Poppins, nombre / línea / empresa;
// cupos sin nombre: solo la empresa en grande; código fuera del sticker a la izquierda;
// separador por tipo; al final 39 stickers en blanco (fondo blanco).
// ---------------------------------------------------------------------------

var PL = {
  PT: 72 / 25.4,              // puntos por mm
  PAG_W: 210, PAG_H: 297,     // A4 en mm
  MX: 4.3, MY: 5,             // márgenes de la hoja
  SW: 59.8, SH: 19.8,         // sticker
  LBL: 4.4, GY: 1.0, SEP: 6,  // franja del código ENCIMA del sticker, espacio entre filas, alto del separador
  IN: 2.54,                   // margen interno que Slides deja en cada cuadro de texto (0,1 pulgada)
  EN_BLANCO: 39,
  FUENTE: 'Poppins'
};

function menuPlanillasStickers() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = leerConfig_(ss);
    var id = cfg.valores.PLANTILLA_PLANILLAS_ID, existe = false;
    if (id) { try { existe = !DriveApp.getFileById(id).isTrashed(); } catch (e) { existe = false; } }
    if (!existe) {
      var p = Slides.Presentations.create({ title: 'Plantilla planillas de stickers (A4)' });
      DriveApp.getFileById(p.presentationId).moveTo(carpetaCredenciales_(ss, cfg));
      escribirConfig_(ss, 'PLANTILLA_PLANILLAS_ID', p.presentationId);
      id = p.presentationId;
    }
    if (!paginaA4_(id)) {
      ui.alert('Falta un paso: tamaño A4', [
        'Google Slides no permite fijar el tamaño desde el script. Hágalo una sola vez:', '',
        '1. Abra: https://docs.google.com/presentation/d/' + id + '/edit',
        '2. Archivo → Configuración de página → Personalizado.',
        '3. Escriba 21 × 29,7 y elija «Centímetros» → Aplicar.',
        '4. Vuelva aquí y ejecute otra vez «Generar planillas de stickers (PDF)».'
      ].join('\n'), ui.ButtonSet.OK);
      return;
    }
    if (ui.alert('Planillas de stickers', 'Se generará un PDF A4 con los stickers de todos los activos, ordenados por sigla y número, más ' +
      PL.EN_BLANCO + ' en blanco. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    var r = generarPlanillas_(ss, cfg, id);
    ui.alert('Planillas listas', [
      r.stickers + ' stickers + ' + PL.EN_BLANCO + ' en blanco · ' + r.paginas + ' hojas A4.', '',
      'PDF para imprimir: ' + r.pdf, '', 'Versión editable (Slides): ' + r.slides, '',
      'Imprima al 100 % («Tamaño real»), sin «Ajustar a la página».'
    ].join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudieron generar las planillas', String(e.message || e), ui.ButtonSet.OK);
  }
}

function paginaA4_(id) {
  var ps = Slides.Presentations.get(id, { fields: 'pageSize' }).pageSize;
  var aMm = function (d) { return (d.unit === 'EMU' ? d.magnitude / 12700 : d.magnitude) / PL.PT; };
  return Math.abs(aMm(ps.width) - 210) < 2 && Math.abs(aMm(ps.height) - 297) < 2;
}

/** Tamaño de letra que entra en `anchoPt` (estimación por ancho medio de carácter de Poppins). */
function tamanoQueEntra_(texto, anchoPt, max, min, factor) {
  var n = Math.max(String(texto || '').length, 1);
  return Math.max(min, Math.min(max, anchoPt / (n * factor)));
}

/**
 * Texto en una línea a tamaño `max1`..`min1`; si no entra a `min1`, en dos líneas equilibradas a `max2`..`min2`.
 * factor: ancho medio de carácter en em para la fuente y peso usados.
 */
function textoEnLineas_(txt, anchoPt, max1, min1, max2, min2, factor) {
  txt = String(txt || '').trim();
  var t1 = anchoPt / (Math.max(txt.length, 1) * factor);
  if (t1 >= min1 || txt.indexOf(' ') === -1) return { texto: txt, tam: Math.max(min2, Math.min(max1, t1)) };
  var pal = txt.split(/\s+/), mejor = null;
  for (var k = 1; k < pal.length; k++) {
    var a = pal.slice(0, k).join(' '), b = pal.slice(k).join(' '), largo = Math.max(a.length, b.length);
    if (!mejor || largo < mejor.largo) mejor = { texto: a + '\n' + b, largo: largo };
  }
  return { texto: mejor.texto, tam: Math.max(min2, Math.min(max2, anchoPt / (mejor.largo * factor))) };
}

function generarPlanillas_(ss, cfg, plantillaId) {
  var m = leerMaestro_(ss), orden = {};
  cfg.ordenSiglas.forEach(function (s, i) { orden[s] = i; });
  var lista = m.filas.filter(function (r) { return r[M.UID] && r[M.ESTADO_INSC] === ESTADO_ACTIVO && parsearId_(r[M.ID]); });
  lista.sort(function (a, b) {
    var x = parsearId_(a[M.ID]), y = parsearId_(b[M.ID]);
    var ox = orden[x.sigla] === undefined ? 999 : orden[x.sigla], oy = orden[y.sigla] === undefined ? 999 : orden[y.sigla];
    return ox - oy || x.numero - y.numero;
  });
  // Grupos por sigla + grupo final en blanco.
  // Siglas con dos stickers por persona (speakers).
  var dobles = String(cfg.valores.STICKERS_DOBLES || 'E').split('|').map(function (x) { return x.trim().toUpperCase(); }).filter(String);
  var grupos = [], actual = null;
  lista.forEach(function (r) {
    var p = parsearId_(r[M.ID]);
    if (!actual || actual.sigla !== p.sigla) { actual = { sigla: p.sigla, items: [] }; grupos.push(actual); }
    var cupo = esCupoSinNombre_(r);
    var item = { id: r[M.ID], nombre: cupo ? '' : nombreParaCredencial_(cfg, r[M.NOMBRE]),
      empresa: cupo ? String(r[M.CUPO_DE] || r[M.EMPRESA] || '').trim() : String(r[M.EMPRESA] || '').trim(), cupo: cupo };
    actual.items.push(item);
    if (dobles.indexOf(p.sigla) !== -1) actual.items.push(item); // segundo sticker, al lado
  });
  grupos.forEach(function (g) {
    g.corto = String(cfg.tipoCredencial[g.sigla] || cfg.tipoPorSigla[g.sigla] || g.sigla).toLocaleUpperCase('es') +
      (dobles.indexOf(g.sigla) !== -1 ? ' · 2 POR PERSONA' : '');
  });
  var blancos = []; for (var b = 0; b < PL.EN_BLANCO; b++) blancos.push({ blanco: true });
  grupos.push({ corto: 'EN BLANCO · REGISTRO EN SITIO', items: blancos });

  var copia = DriveApp.getFileById(plantillaId).makeCopy('Planillas de stickers · ' + fmtFecha_(new Date(), 'dd-MM HH.mm'), carpetaCredenciales_(ss, cfg));
  var presId = copia.getId();
  var pres = Slides.Presentations.get(presId, { fields: 'slides(objectId)' });
  var paginas = [], reqs = [], n = 0;
  function oid(p) { n++; return 'fx_' + p + '_' + ('00000' + n).slice(-6); } // la API exige 5 caracteres o más
  function nuevaPagina() {
    var id = oid('pag');
    reqs.push({ createSlide: { objectId: id, slideLayoutReference: { predefinedLayout: 'BLANK' } } });
    paginas.push(id);
    return id;
  }
  function rect(pag, x, y, w, h, relleno, borde, redondo) {
    var id = oid('r');
    reqs.push({ createShape: { objectId: id, shapeType: redondo ? 'ROUND_RECTANGLE' : 'RECTANGLE', elementProperties: caja_(pag, x, y, w, h) } });
    reqs.push({ updateShapeProperties: { objectId: id, fields: 'shapeBackgroundFill.solidFill.color,outline',
      shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor: rgb_(relleno) } } },
        outline: borde ? { outlineFill: { solidFill: { color: { rgbColor: rgb_(borde) } } }, weight: { magnitude: 0.6, unit: 'PT' } } : { propertyState: 'NOT_RENDERED' } } } });
  }
  function texto(pag, x, y, w, h, t, tam, peso, color, alinH, alinV) {
    if (!String(t || '').trim()) return;
    var id = oid('t');
    reqs.push({ createShape: { objectId: id, shapeType: 'TEXT_BOX', elementProperties: caja_(pag, x, y, w, h) } });
    reqs.push({ insertText: { objectId: id, text: String(t) } });
    reqs.push({ updateTextStyle: { objectId: id, textRange: { type: 'ALL' }, fields: 'fontSize,foregroundColor,weightedFontFamily',
      style: { weightedFontFamily: { fontFamily: PL.FUENTE, weight: peso }, fontSize: { magnitude: Math.round(tam * 4) / 4, unit: 'PT' },
        foregroundColor: { opaqueColor: { rgbColor: rgb_(color) } } } } });
    reqs.push({ updateParagraphStyle: { objectId: id, textRange: { type: 'ALL' }, fields: 'alignment,lineSpacing,spaceAbove,spaceBelow', style: { alignment: alinH || 'CENTER', lineSpacing: 95, spaceAbove: { magnitude: 0, unit: 'PT' }, spaceBelow: { magnitude: 0, unit: 'PT' } } } });
    reqs.push({ updateShapeProperties: { objectId: id, fields: 'contentAlignment', shapeProperties: { contentAlignment: alinV || 'MIDDLE' } } });
  }
  function linea(pag, x1, y, x2, color, grosor) {
    var id = oid('l');
    reqs.push({ createLine: { objectId: id, lineCategory: 'STRAIGHT', elementProperties: caja_(pag, x1, y, x2 - x1, 0) } });
    reqs.push({ updateLineProperties: { objectId: id, fields: 'lineFill.solidFill.color,weight',
      lineProperties: { lineFill: { solidFill: { color: { rgbColor: rgb_(color) } } }, weight: { magnitude: grosor, unit: 'PT' } } } });
  }

  // Cuadrícula FIJA, idéntica en todas las hojas (para cortar las hojas apiladas con guillotina):
  // 3 columnas × FILAS filas, centrada en la página. Cada tipo empieza en una fila nueva y su primer sticker
  // lleva el nombre del tipo junto al código; no hay franjas separadoras que corran la cuadrícula.
  var colW = (PL.PAG_W - 2 * PL.MX) / 3, paso = PL.LBL + PL.SH + PL.GY;
  var FILAS = Math.floor((PL.PAG_H - 2 * PL.MY + PL.GY) / paso);
  var y0 = (PL.PAG_H - (FILAS * paso - PL.GY)) / 2;
  var pag = null, fila = FILAS, total = 0;
  function siguienteFila() { fila++; if (fila >= FILAS) { pag = nuevaPagina(); fila = 0; } return y0 + fila * paso; }
  grupos.forEach(function (g) {
    for (var i = 0; i < g.items.length; i += 3) {
      var y = siguienteFila();
      for (var c = 0; c < 3 && i + c < g.items.length; c++) {
        var it = g.items[i + c], sx = PL.MX + c * colW + (colW - PL.SW) / 2;
        var etiqueta = null;
        if (i + c === 0) etiqueta = (it.id ? it.id + ' · ' : '') + g.corto;
        else if (c === 0 && fila === 0) etiqueta = (it.id ? it.id + ' · ' : '') + g.corto + ' (cont.)';
        dibujarSticker_(pag, sx, y, it, rect, texto, linea, etiqueta);
        if (!it.blanco) total++;
      }
    }
  });

  // Se borra la diapositiva vacía de la plantilla y se crean las páginas por tandas.
  (pres.slides || []).forEach(function (s) { reqs.push({ deleteObject: { objectId: s.objectId } }); });
  for (var k = 0; k < reqs.length; k += 400) Slides.Presentations.batchUpdate({ requests: reqs.slice(k, k + 400) }, presId);

  var pdf = DriveApp.getFileById(presId).getAs(MimeType.PDF).setName(copia.getName() + '.pdf');
  var archivo = carpetaCredenciales_(ss, cfg).createFile(pdf);
  registrarBitacora_(ss, [eventoBitacora_('PLANILLAS_STICKERS', '', '', total + ' stickers · ' + paginas.length + ' hojas · ' + archivo.getUrl())]);
  return { stickers: total, paginas: paginas.length, pdf: archivo.getUrl(), slides: 'https://docs.google.com/presentation/d/' + presId + '/edit' };
}

function dibujarSticker_(pag, sx, yFila, it, rect, texto, linea, etiqueta) {
  var util = (PL.SW - 3 - 2 * PL.IN) * PL.PT; // ancho útil del texto en pt
  var y = yFila + PL.LBL;                     // el sticker va debajo de la franja del código
  // Coloca un texto cuya ÁREA VISIBLE es [x, y0]–[x+w, y0+h] (compensa el margen interno de Slides).
  function t(x, y0, w, h, txt, tam, peso, color, alH, alV) {
    texto(pag, x - PL.IN, y0 - PL.IN, w + 2 * PL.IN, h + 2 * PL.IN, txt, tam, peso, color, alH, alV);
  }
  if (etiqueta && it.blanco) t(sx + 0.8, yFila + 0.2, PL.SW, PL.LBL - 0.5, etiqueta, 8.5, 700, '#000000', 'START', 'BOTTOM');
  if (it.blanco) {
    rect(pag, sx, y, PL.SW, PL.SH, '#ffffff', '#282828', true);
    linea(pag, sx + 10, y + 10.6, sx + PL.SW - 10, '#8a8a8a', 0.5);
    return;
  }
  // Código encima del sticker, alineado a su borde izquierdo, sin invadir la fila de arriba.
  // En el primer sticker de cada tipo el código va acompañado del nombre del tipo («1S · PROYECTO SUMARSE»).
  t(sx + 0.8, yFila + 0.2, PL.SW, PL.LBL - 0.5, etiqueta || it.id, etiqueta ? 9 : 10, 700, '#000000', 'START', 'BOTTOM');
  rect(pag, sx, y, PL.SW, PL.SH, '#000000', null, true);
  if (it.cupo) {
    // Cupo sin nombre: solo la empresa, grande y centrada (sobre negro no se puede escribir a mano).
    t(sx + 1.5, y + 1, PL.SW - 3, PL.SH - 2, it.empresa, tamanoQueEntra_(it.empresa, util, 15, 8, 0.64), 600, '#ffffff', 'CENTER', 'MIDDLE');
    return;
  }
  // Nombre: una línea grande; si en una línea quedaría por debajo de 10,5 pt, se reparte en dos líneas equilibradas.
  var n = textoEnLineas_(it.nombre, util, 15, 10.5, 12, 8, 0.64);
  t(sx + 1.5, y + 0.6, PL.SW - 3, 9.8, n.texto, n.tam, 600, '#ffffff', 'CENTER', 'MIDDLE');
  linea(pag, sx + 7, y + 10.9, sx + PL.SW - 7, '#9b743c', 0.8); // separador dorado de la línea gráfica
  var e = textoEnLineas_(it.empresa, util, 11, 8.5, 9.5, 6.5, 0.56);
  t(sx + 1.5, y + 11.4, PL.SW - 3, 7.9, e.texto, e.tam, 400, '#ffffff', 'CENTER', 'MIDDLE');
}

function caja_(pag, xMm, yMm, wMm, hMm) {
  return { pageObjectId: pag, size: { width: { magnitude: Math.max(wMm, 0.1) * PL.PT, unit: 'PT' }, height: { magnitude: Math.max(hMm, 0.1) * PL.PT, unit: 'PT' } },
    transform: { scaleX: 1, scaleY: 1, translateX: xMm * PL.PT, translateY: yMm * PL.PT, unit: 'PT' } };
}

function rgb_(hex) {
  var h = hex.replace('#', '');
  return { red: parseInt(h.slice(0, 2), 16) / 255, green: parseInt(h.slice(2, 4), 16) / 255, blue: parseInt(h.slice(4, 6), 16) / 255 };
}
