/**
 * Links de WhatsApp (SPEC §8). Se generan TODOS juntos, solo cuando el responsable lo pide desde el menú.
 * wa.me no permite adjuntar: la credencial va como link de Drive. El envío es manual desde el teléfono.
 */

function menuGenerarWhatsApp() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = leerConfig_(ss);
    if (!String(cfg.valores.WHATSAPP_MENSAJE || '').trim() || !String(cfg.valores.URL_AGENDA || '').trim()) {
      throw new Error('Complete en Config: WHATSAPP_MENSAJE y URL_AGENDA.');
    }
    if (ui.alert('Links de WhatsApp', 'Se llenará la columna WhatsApp del Maestro para todas las personas activas con credencial.\n' +
      'No se envía nada: cada link se abre a mano desde el teléfono. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    var r = generarLinksWhatsApp_(ss, cfg);
    ui.alert('Links de WhatsApp', r.ok + ' links generados.\n' +
      (r.invalidos ? '• Celular inválido: ' + r.invalidos + '\n' : '') +
      (r.sinCelular ? '• Sin celular: ' + r.sinCelular + '\n' : '') +
      (r.sinCredencial ? '• Sin credencial: ' + r.sinCredencial + '\n' : '') +
      '\nDespués de enviar cada mensaje, marque la casilla «WA enviado».', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudieron generar', String(e.message || e), ui.ButtonSet.OK);
  }
}

function textoWhatsApp_(cfg, r, urlCredencial) {
  var v = cfg.valores;
  return String(v.WHATSAPP_MENSAJE)
    .replace(/\{NOMBRE\}/g, etiquetaNombre_(cfg, r))
    .replace(/\{FECHA\}/g, v.EVENTO_FECHA || '')
    .replace(/\{HORA\}/g, v.EVENTO_HORA || '')
    .replace(/\{LUGAR\}/g, v.EVENTO_LUGAR || '')
    .replace(/\{CREDENCIAL\}/g, urlCredencial)
    .replace(/\{AGENDA\}/g, v.URL_AGENDA || '');
}

function generarLinksWhatsApp_(ss, cfg) {
  var lock = tomarBloqueo_(30000);
  try {
    var m = leerMaestro_(ss), ids = idsCredencialPorUid_(m), n = m.filas.length;
    var res = { ok: 0, invalidos: 0, sinCelular: 0, sinCredencial: 0 };
    if (!n) return res;
    var col = m.hoja.getRange(2, M.WHATSAPP + 1, n, 1);
    var formulas = col.getFormulas(), valores = col.getValues();
    var salida = m.filas.map(function (r, i) {
      var previo = formulas[i][0] || valores[i][0];
      var uid = String(r[M.UID] || '');
      if (!uid || r[M.ESTADO_INSC] !== ESTADO_ACTIVO) return [previo];
      if (cfg.entregaPorDueno.indexOf(String(r[M.PESTANA])) !== -1) return ['Lo entrega el auspiciante'];
      if (!ids[uid]) { res.sinCredencial++; return ['Sin credencial']; }
      if (!String(r[M.CELULAR] || '').trim()) { res.sinCelular++; return ['Sin celular']; }
      var numero = normalizarCelular_(r[M.CELULAR]);
      if (!numero) { res.invalidos++; return ['Celular inválido']; }
      var url = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(textoWhatsApp_(cfg, r, 'https://drive.google.com/file/d/' + ids[uid] + '/view'));
      res.ok++;
      return ['=HYPERLINK("' + url.replace(/"/g, '""') + '","Abrir WhatsApp")'];
    });
    // Fórmulas y textos se escriben en una sola operación.
    col.setValues(salida);
    registrarBitacora_(ss, [eventoBitacora_('WHATSAPP_LINKS', '', '', res.ok + ' links · ' + res.invalidos + ' inválidos · ' + res.sinCelular + ' sin celular · ' + res.sinCredencial + ' sin credencial')]);
    SpreadsheetApp.flush();
    return res;
  } finally {
    lock.releaseLock();
  }
}
