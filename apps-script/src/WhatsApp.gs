/**
 * Links de WhatsApp (SPEC §8). Se generan TODOS juntos, solo cuando el responsable lo pide desde el menú.
 * wa.me no permite adjuntar: la credencial va como link de Drive. El envío es manual desde el teléfono
 * de cada persona del equipo (el link abre el WhatsApp del teléfono donde se toca).
 * Además de la columna WhatsApp del Maestro, se arma la pestaña «WhatsApp» repartida entre el equipo.
 */

var HOJA_WHATSAPP = 'WhatsApp';
var WA_COLUMNAS = ['Responsable', 'ID', 'Nombre', 'Celular', 'Abrir WhatsApp', 'Enviado', 'UID'];

function menuGenerarWhatsApp() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = leerConfig_(ss);
    if (!String(cfg.valores.WHATSAPP_MENSAJE || '').trim() || !String(cfg.valores.URL_AGENDA || '').trim()) {
      throw new Error('Complete en Config: WHATSAPP_MENSAJE y URL_AGENDA.');
    }
    var resp = responsablesWhatsApp_(cfg);
    if (ui.alert('Links de WhatsApp', 'Se llenará la columna WhatsApp del Maestro y la pestaña «' + HOJA_WHATSAPP + '» para las personas con nombre, celular y credencial.\n\n' +
      'Reparto entre: ' + resp.join(', ') + ' (Config → WHATSAPP_RESPONSABLES).\n\n' +
      'No se envía nada: cada persona del equipo abre sus links desde su teléfono. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    var r = generarLinksWhatsApp_(ss, cfg);
    ui.alert('Links de WhatsApp', [
      r.ok + ' links generados, repartidos así:',
      Object.keys(r.porResponsable).map(function (k) { return '• ' + k + ': ' + r.porResponsable[k]; }).join('\n'), '',
      (r.invalidos ? '• Celular inválido: ' + r.invalidos + '\n' : '') +
      (r.sinCelular ? '• Sin celular: ' + r.sinCelular + '\n' : '') +
      (r.sinCredencial ? '• Sin credencial: ' + r.sinCredencial + '\n' : '') +
      (r.cupos ? '• Cupos sin nombre (van por el auspiciante): ' + r.cupos + '\n' : ''),
      'Cada responsable abre la pestaña «' + HOJA_WHATSAPP + '», filtra por su nombre, toca «Abrir WhatsApp», envía y marca «Enviado».'
    ].join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudieron generar', String(e.message || e), ui.ButtonSet.OK);
  }
}

function responsablesWhatsApp_(cfg) {
  var l = String(cfg.valores.WHATSAPP_RESPONSABLES || '').split('|').map(function (x) { return x.trim(); }).filter(String);
  return l.length ? l : ['Responsable 1'];
}

function textoWhatsApp_(cfg, r, urlCredencial) {
  var v = cfg.valores;
  return String(v.WHATSAPP_MENSAJE)
    .replace(/\{NOMBRE\}/g, etiquetaNombre_(cfg, r))
    .replace(/\{FECHA\}/g, v.EVENTO_FECHA || '')
    .replace(/\{HORA\}/g, v.EVENTO_HORA || '')
    .replace(/\{LUGAR\}/g, v.EVENTO_LUGAR || '')
    .replace(/\{SALON\}/g, v.EVENTO_SALON || '')
    .replace(/\{CREDENCIAL\}/g, urlCredencial)
    .replace(/\{AGENDA\}/g, v.URL_AGENDA || '');
}

function generarLinksWhatsApp_(ss, cfg) {
  var lock = tomarBloqueo_(30000);
  try {
    var m = leerMaestro_(ss), ids = idsCredencialPorUid_(m), n = m.filas.length;
    var res = { ok: 0, invalidos: 0, sinCelular: 0, sinCredencial: 0, cupos: 0, porResponsable: {} };
    if (!n) return res;
    var col = m.hoja.getRange(2, M.WHATSAPP + 1, n, 1);
    var formulas = col.getFormulas(), valores = col.getValues();
    var lista = [];
    var salida = m.filas.map(function (r, i) {
      var previo = formulas[i][0] || valores[i][0];
      var uid = String(r[M.UID] || '');
      if (!uid || r[M.ESTADO_INSC] !== ESTADO_ACTIVO) return [previo];
      if (esCupoSinNombre_(r)) { res.cupos++; return ['Cupo sin nombre']; }
      if (!ids[uid]) { res.sinCredencial++; return ['Sin credencial']; }
      if (!String(r[M.CELULAR] || '').trim()) { res.sinCelular++; return ['Sin celular']; }
      var numero = normalizarCelular_(r[M.CELULAR]);
      if (!numero) { res.invalidos++; return ['Celular inválido']; }
      var url = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(textoWhatsApp_(cfg, r, 'https://drive.google.com/file/d/' + ids[uid] + '/view'));
      var formula = '=HYPERLINK("' + url.replace(/"/g, '""') + '","Abrir WhatsApp")';
      lista.push({ uid: uid, id: r[M.ID], nombre: etiquetaNombre_(cfg, r), celular: '+' + numero, formula: formula });
      res.ok++;
      return [formula];
    });
    col.setValues(salida); // fórmulas y textos en una sola operación
    escribirPestanaWhatsApp_(ss, cfg, lista, res);
    registrarBitacora_(ss, [eventoBitacora_('WHATSAPP_LINKS', '', '', res.ok + ' links · ' + res.invalidos + ' inválidos · ' + res.sinCelular + ' sin celular · ' + res.sinCredencial + ' sin credencial')]);
    SpreadsheetApp.flush();
    return res;
  } finally {
    lock.releaseLock();
  }
}

/** Pestaña «WhatsApp»: la lista ordenada por ID y repartida en bloques iguales entre los responsables. Conserva «Enviado». */
function escribirPestanaWhatsApp_(ss, cfg, lista, res) {
  var h = ss.getSheetByName(HOJA_WHATSAPP);
  var enviado = {};
  if (h && h.getLastRow() > 1) {
    h.getRange(2, 1, h.getLastRow() - 1, WA_COLUMNAS.length).getValues().forEach(function (f) { if (f[6] && f[5] === true) enviado[String(f[6])] = true; });
  }
  if (!h) h = ss.insertSheet(HOJA_WHATSAPP);
  if (h.getFilter()) h.getFilter().remove();
  h.clear();
  var orden = {};
  cfg.ordenSiglas.forEach(function (s, i) { orden[s] = i; });
  lista.sort(function (a, b) {
    var x = parsearId_(a.id), y = parsearId_(b.id);
    return (orden[x.sigla] - orden[y.sigla]) || (x.numero - y.numero);
  });
  var resp = responsablesWhatsApp_(cfg), tam = Math.ceil(lista.length / resp.length) || 1;
  var filas = lista.map(function (p, i) {
    var quien = resp[Math.min(Math.floor(i / tam), resp.length - 1)];
    res.porResponsable[quien] = (res.porResponsable[quien] || 0) + 1;
    return [quien, p.id, p.nombre, p.celular, p.formula, !!enviado[p.uid], p.uid];
  });
  h.getRange(1, 1, 1, WA_COLUMNAS.length).setValues([WA_COLUMNAS]).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  h.setFrozenRows(1);
  if (filas.length) {
    asegurarFilas_(h, filas.length + 1);
    h.getRange(2, 1, filas.length, WA_COLUMNAS.length).setValues(filas);
    h.getRange(2, 6, filas.length, 1).insertCheckboxes();
    h.getRange(2, 6, filas.length, 1).setValues(filas.map(function (f) { return [f[5]]; }));
    h.getRange(1, 1, filas.length + 1, WA_COLUMNAS.length).createFilter();
  }
  h.hideColumns(7);
  h.autoResizeColumns(1, 5);
}
