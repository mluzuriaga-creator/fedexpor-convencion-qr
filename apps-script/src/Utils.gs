/**
 * Utilidades compartidas: normalización de texto, fechas, diálogos y metadatos de tablas.
 */

/** Minúsculas, sin tildes, solo letras/dígitos separados por un espacio. Para nombres, empresas y encabezados. */
function normTexto_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Igual que normTexto_ pero sin espacios. Para palabras clave ("b 2 b" → "b2b") y "Por confirmar". */
function compacto_(s) {
  return normTexto_(s).replace(/ /g, '');
}

function normCorreo_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
}

function correoValido_(s) {
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(s || '').trim());
}

/** Celular ecuatoriano a formato 5939XXXXXXXX. Devuelve '' si no se puede normalizar. */
function normalizarCelular_(s) {
  var d = String(s == null ? '' : s).replace(/\D/g, '');
  if (/^5939\d{8}$/.test(d)) return d;
  if (/^09\d{8}$/.test(d)) return '593' + d.slice(1);
  if (/^9\d{8}$/.test(d)) return '593' + d;
  return '';
}

function esPorConfirmar_(nombre) {
  return compacto_(nombre).indexOf('porconfirmar') === 0;
}

function fmtFecha_(d, patron) {
  return Utilities.formatDate(d, ZONA_HORARIA, patron || 'dd/MM/yyyy HH:mm:ss');
}

function columnaLetra_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function escaparHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mostrarTexto_(titulo, lineas) {
  var html = HtmlService.createHtmlOutput(
    '<pre style="font:13px/1.45 monospace;white-space:pre-wrap">' + escaparHtml_(lineas.join('\n')) + '</pre>'
  ).setWidth(720).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, titulo);
}

/**
 * Localiza la fila de encabezado: la primera fila, dentro de las primeras `filasBusqueda`,
 * que tiene una celda "Nombre". Devuelve null si no la encuentra.
 */
function localizarEncabezado_(hoja, filasBusqueda) {
  var ultimaFila = hoja.getLastRow(), ultimaCol = hoja.getLastColumn();
  if (ultimaFila === 0 || ultimaCol === 0) return null;
  var n = Math.min(filasBusqueda, ultimaFila);
  var cab = hoja.getRange(1, 1, n, ultimaCol).getDisplayValues();
  for (var r = 0; r < cab.length; r++) {
    for (var c = 0; c < cab[r].length; c++) {
      if (normTexto_(cab[r][c]) === 'nombre') {
        var indice = {};
        cab[r].forEach(function (t, i) {
          var k = normTexto_(t);
          if (k && indice[k] === undefined) indice[k] = i;
        });
        var ultimaConTexto = 0;
        cab[r].forEach(function (t, i) { if (String(t).trim() !== '') ultimaConTexto = i + 1; });
        return { fila: r + 1, encabezados: cab[r], indice: indice, ultimaCol: ultimaCol, ultimaConTexto: ultimaConTexto };
      }
    }
  }
  return null;
}

/** Tablas de Sheets por pestaña (solo metadatos). { titulo: [{tableId, nombre, range, sheetId}] } */
function tablasPorHoja_(spreadsheetId) {
  var res = {};
  var meta = Sheets.Spreadsheets.get(spreadsheetId, {
    fields: 'sheets(properties(sheetId,title),tables(tableId,name,range))'
  });
  (meta.sheets || []).forEach(function (s) {
    res[s.properties.title] = (s.tables || []).map(function (t) {
      var g = t.range || {};
      return {
        tableId: t.tableId, nombre: t.name, sheetId: s.properties.sheetId,
        range: {
          sheetId: s.properties.sheetId,
          startRowIndex: g.startRowIndex || 0, endRowIndex: g.endRowIndex,
          startColumnIndex: g.startColumnIndex || 0, endColumnIndex: g.endColumnIndex
        }
      };
    });
  });
  return res;
}

/**
 * Resumen de todo lo que se imprime en la credencial de una fila del Maestro.
 * Si cambia cualquier dato visible (o el token), la credencial queda desactualizada.
 */
function huellaCredencial_(r, cfg) {
  var id = parsearId_(r[M.ID]);
  var partes = [r[M.ID], etiquetaNombre_(cfg, r), r[M.EMPRESA], r[M.CARGO], tipoCredencial_(cfg, id ? id.sigla : '', r[M.FUENTE]), r[M.TOKEN],
    cfg.valores.CREDENCIAL_TEXTO, cfg.valores.EVENTO_LUGAR, cfg.valores.CREDENCIAL_FECHA, cfg.valores.URL_PUBLICA_BASE];
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, partes.map(function (x) { return String(x == null ? '' : x).trim(); }).join('|'), Utilities.Charset.UTF_8);
  return d.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

var PARTICULAS_NOMBRE = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'das', 'van', 'von', 'di'];

/** «ALIRIO DEL JESUS SALAZAR» → «Alirio del Jesus Salazar». Respeta tildes, guiones y apóstrofes. */
function nombrePropio_(s) {
  var palabras = String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLocaleLowerCase('es').split(' ');
  return palabras.map(function (p, i) {
    if (i > 0 && PARTICULAS_NOMBRE.indexOf(p) !== -1) return p;
    return p.replace(/(^|[-'’])(\p{L})/gu, function (m, sep, letra) { return sep + letra.toLocaleUpperCase('es'); });
  }).join(' ');
}

function nombreParaCredencial_(cfg, nombre) {
  var f = String(cfg.valores.CREDENCIAL_FORMATO_NOMBRE || 'PROPIO').toUpperCase();
  if (f === 'TAL_CUAL') return String(nombre || '').trim();
  if (f === 'MAYUSCULAS') return String(nombre || '').trim().toLocaleUpperCase('es');
  return nombrePropio_(nombre);
}

/** Nombre que se muestra en credencial, stickers y correos. Un cupo sin persona: «Invitado 2 de BANCO PICHINCHA». */
function etiquetaNombre_(cfg, r) {
  if (esCupoSinNombre_(r)) return 'Invitado ' + (r[M.CUPO_N] || '') + ' de ' + String(r[M.CUPO_DE]).trim().toLocaleUpperCase('es');
  return nombreParaCredencial_(cfg, r[M.NOMBRE]);
}

function tipoCredencial_(cfg, sigla, fuente) {
  return (cfg.tipoCredencial && cfg.tipoCredencial[sigla]) || fuente || '';
}

/** Agrega filas al final si la hoja no alcanza hasta `ultimaFila`. */
function asegurarFilas_(hoja, ultimaFila) {
  var faltan = ultimaFila - hoja.getMaxRows();
  if (faltan > 0) hoja.insertRowsAfter(hoja.getMaxRows(), Math.max(faltan, 200));
}

function tomarBloqueo_(ms) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(ms || 30000)) {
    throw new Error('Otro proceso está escribiendo en la hoja. Intente de nuevo en unos segundos.');
  }
  return lock;
}
