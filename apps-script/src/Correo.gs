/**
 * Correo desde la cuenta institucional con MailApp (SPEC §7; decisión del 29/09: Gmail en lugar de Brevo).
 *
 * REGLAS QUE NO SE ROMPEN
 *  - Ningún envío es automático ni por fecha: no hay triggers de tiempo para correos.
 *    Si una tanda no termina en una ejecución, el responsable pulsa «Continuar envío».
 *  - TODO envío pasa por enviarCorreos_(), que revisa ENVIOS_HABILITADOS en cada llamada.
 *    Con NO se rechaza y queda en la Bitácora. Ningún otro código envía correos.
 *  - Antes de cualquier envío masivo se muestra cuántos, a quiénes y quiénes quedan fuera.
 *  - Marcar una casilla no envía nada: solo el menú «Enviar a las casillas marcadas».
 */

var CORREO_TIEMPO_MAX_MS = 270000;  // 4,5 min por ejecución
var CORREO_POR_TANDA = 10;          // se guarda el avance cada 10 correos
var CORREO_MAX_SIN_FRASE = 5;       // más de esto exige escribir ENVIAR

/** Plantillas de correo. Es una función (no una constante) porque usa M, que se define en otro archivo. */
function plantillasCorreo_() {
  return {
    CREDENCIAL: { col: M.ESTADO_CORREO, asunto: 'CORREO_ASUNTO_CREDENCIAL', nombre: 'Credencial' },
    RECORDATORIO_1: { col: M.RECORDATORIO_1, asunto: 'CORREO_ASUNTO_RECORDATORIO', nombre: 'Recordatorio 1', recordatorio: true },
    RECORDATORIO_2: { col: M.RECORDATORIO_2, asunto: 'CORREO_ASUNTO_RECORDATORIO', nombre: 'Recordatorio 2', recordatorio: true }
  };
}

function agregarMenuCorreos_(menu) {
  menu.addSubMenu(SpreadsheetApp.getUi().createMenu('Correos y WhatsApp')
    .addItem('Envíos: habilitar / deshabilitar', 'menuInterruptorEnvios')
    .addItem('Enviar correo de prueba (datos ficticios)', 'menuCorreoPrueba')
    .addSeparator()
    .addItem('Enviar credencial a las casillas marcadas', 'menuEnviarCredencialMarcadas')
    .addItem('Enviar recordatorio 1 a las casillas marcadas', 'menuEnviarRecordatorio1Marcadas')
    .addItem('Enviar recordatorio 2 a las casillas marcadas', 'menuEnviarRecordatorio2Marcadas')
    .addSeparator()
    .addItem('Enviar credencial a todos los pendientes', 'menuEnviarCredencialPendientes')
    .addItem('Enviar recordatorio 1 a todos', 'menuEnviarRecordatorio1')
    .addItem('Enviar recordatorio 2 a todos', 'menuEnviarRecordatorio2')
    .addItem('Continuar envío interrumpido', 'menuContinuarEnvio')
    .addItem('Correos disponibles hoy', 'menuCuotaCorreo')
    .addSeparator()
    .addItem('Generar links de WhatsApp (todos)', 'menuGenerarWhatsApp'));
}

// ---------------------------------------------------------------------------
// Interruptor maestro
// ---------------------------------------------------------------------------

function enviosHabilitados_(ss) {
  return compacto_(leerConfig_(ss).valores.ENVIOS_HABILITADOS) === 'si';
}

function menuInterruptorEnvios() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var activo = enviosHabilitados_(ss);
  var r = ui.alert('Interruptor de envíos',
    'Estado actual: ' + (activo ? 'HABILITADOS (SI)' : 'DESHABILITADOS (NO)') + '\n\n' +
    (activo ? '¿Deshabilitar los envíos? Ningún correo podrá salir.'
            : '¿Habilitar los envíos? Aun así, cada envío masivo pide confirmación. Se recomienda volver a NO al terminar cada tanda.'),
    ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  var nuevo = activo ? 'NO' : 'SI';
  escribirConfig_(ss, 'ENVIOS_HABILITADOS', nuevo);
  registrarBitacora_(ss, [eventoBitacora_('INTERRUPTOR_ENVIOS', '', '', 'ENVIOS_HABILITADOS = ' + nuevo + ' · ' + Session.getActiveUser().getEmail())]);
  ui.alert('ENVIOS_HABILITADOS = ' + nuevo);
}

function menuCuotaCorreo() {
  SpreadsheetApp.getUi().alert('Correos que su cuenta puede enviar hoy desde Apps Script: ' + MailApp.getRemainingDailyQuota());
}

// ---------------------------------------------------------------------------
// Único punto de salida de correos
// ---------------------------------------------------------------------------

/**
 * mensajes: [{ para: {email, name}, asunto, html, adjunto: {nombre, blob} | null, etiqueta }]
 * Devuelve [{ ok, id, error }] en el mismo orden. Con ENVIOS_HABILITADOS ≠ SI no envía nada.
 * Sale desde la cuenta que ejecuta el script, con el nombre visible de REMITENTE_NOMBRE.
 */
function enviarCorreos_(ss, mensajes) {
  if (!mensajes.length) return [];
  var cfg = leerConfig_(ss); // se lee en cada llamada: si alguien apaga el interruptor a mitad de tanda, se detiene
  if (compacto_(cfg.valores.ENVIOS_HABILITADOS) !== 'si') {
    registrarBitacora_(ss, [eventoBitacora_('ENVIO_RECHAZADO', '', '', mensajes.length + ' correos rechazados: ENVIOS_HABILITADOS = NO')]);
    return mensajes.map(function () { return { ok: false, error: 'Envíos deshabilitados' }; });
  }
  var cuota = MailApp.getRemainingDailyQuota();
  return mensajes.map(function (m) {
    if (cuota <= 0) return { ok: false, error: 'Sin cuota diaria de correo (se renueva en 24 h)' };
    try {
      var op = { htmlBody: m.html, name: cfg.valores.REMITENTE_NOMBRE || 'Fedexpor' };
      if (m.adjunto) {
        op.attachments = [m.adjunto.blob.copyBlob().setName(m.adjunto.nombre)];
        op.inlineImages = { credencial: m.adjunto.blob.copyBlob().setName('credencial.png') };
      }
      MailApp.sendEmail(m.para.email, m.asunto, textoPlano_(m.html), op);
      cuota--;
      return { ok: true, id: '' };
    } catch (e) {
      return { ok: false, error: String(e.message || e).slice(0, 180) };
    }
  });
}

function textoPlano_(html) {
  return String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|tr|h1|div)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

function escHtml_(s) { return escaparHtml_(String(s == null ? '' : s)).replace(/"/g, '&quot;'); }

/** d: {nombre, id, tipo, urlCredencial, idArchivo}; plantilla: CREDENCIAL | RECORDATORIO_x */
function htmlCorreo_(cfg, d, plantilla) {
  var v = cfg.valores, esRecordatorio = plantillasCorreo_()[plantilla].recordatorio;
  var dorado = '#c9a25a';
  var img = d.conImagen ? 'cid:credencial' : ''; // la credencial va incrustada (y además adjunta)
  var intro = esRecordatorio
    ? 'Le recordamos que la <b>' + escHtml_(v.EVENTO_NOMBRE) + '</b> se realizará este <b>' + escHtml_(v.EVENTO_FECHA) + '</b>. ' + escHtml_(v.CORREO_INDICACIONES_LLEGADA)
    : 'Es un gusto confirmar su participación en la <b>' + escHtml_(v.EVENTO_NOMBRE) + '</b>, organizada por Fedexpor. Adjuntamos su credencial digital con su código QR personal: preséntela en la mesa de registro desde su celular, no es necesario imprimirla.';
  var boton = function (texto, url) {
    return '<a href="' + escHtml_(url) + '" style="display:inline-block;margin:6px;padding:12px 22px;border-radius:24px;background:' + dorado +
      ';color:#000;text-decoration:none;font-weight:bold;font-family:Arial,sans-serif;font-size:14px">' + texto + '</a>';
  };
  return '<!doctype html><html><body style="margin:0;padding:0;background:#f2f2f2">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#000;border-radius:14px;overflow:hidden">' +
    '<tr><td style="height:6px;background:linear-gradient(90deg,#9a743c,#d6b16f);background-color:' + dorado + '"></td></tr>' +
    '<tr><td style="padding:28px 32px 8px;font-family:Arial,sans-serif;color:#fff">' +
      '<div style="color:' + dorado + ';font-size:13px;letter-spacing:2px;text-transform:uppercase">' + escHtml_(v.EVENTO_NOMBRE) + '</div>' +
      '<h1 style="margin:10px 0 18px;font-size:22px;font-weight:bold">Estimado/a ' + escHtml_(d.nombre) + ':</h1>' +
      '<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#e6e6e6">' + intro + '</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-size:14px;color:#e6e6e6">' +
        '<tr><td style="padding:3px 12px 3px 0;color:' + dorado + '">Fecha</td><td>' + escHtml_(v.EVENTO_FECHA) + '</td></tr>' +
        '<tr><td style="padding:3px 12px 3px 0;color:' + dorado + '">Hora</td><td>' + escHtml_(v.EVENTO_HORA) + '</td></tr>' +
        '<tr><td style="padding:3px 12px 3px 0;color:' + dorado + '">Lugar</td><td>' + escHtml_(v.EVENTO_LUGAR) + '</td></tr>' +
        '<tr><td style="padding:3px 12px 3px 0;color:' + dorado + '">Su código</td><td><b>' + escHtml_(d.id) + '</b> · ' + escHtml_(d.tipo) + '</td></tr>' +
      '</table></td></tr>' +
    (img ? '<tr><td align="center" style="padding:4px 32px 12px"><a href="' + escHtml_(d.urlCredencial) + '"><img src="' + img + '" width="300" alt="Credencial ' + escHtml_(d.id) + '" style="width:300px;max-width:100%;border-radius:10px;display:block"></a></td></tr>' : '') +
    '<tr><td align="center" style="padding:6px 24px 22px">' +
      (d.urlCredencial ? boton('Ver mi credencial', d.urlCredencial) : '') + boton('Ver agenda', v.URL_AGENDA) +
    '</td></tr>' +
    '<tr><td style="padding:0 32px 26px;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#9a9a9a">' +
      'Su código QR es personal e intransferible. Si no encuentra este correo el día del evento, en la mesa de registro podemos ubicarle por su nombre.<br><br>' +
      'Atentamente,<br><b style="color:#fff">Federación Ecuatoriana de Exportadores · Fedexpor</b>' +
    '</td></tr></table></td></tr></table></body></html>';
}

// ---------------------------------------------------------------------------
// Correo de prueba (datos ficticios)
// ---------------------------------------------------------------------------

function menuCorreoPrueba() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = leerConfig_(ss);
    validarConfigCorreo_(cfg);
    var destino = String(cfg.valores.CORREO_PRUEBAS || '').trim() || Session.getActiveUser().getEmail();
    if (!correoValido_(destino)) throw new Error('Config: CORREO_PRUEBAS inválido.');
    if (!enviosHabilitados_(ss)) {
      ui.alert('Envíos deshabilitados', 'ENVIOS_HABILITADOS está en NO, así que tampoco sale el correo de prueba.\n\n' +
        'Para probar: «Envíos: habilitar / deshabilitar» → SI, envíe la prueba y vuelva a ponerlo en NO.', ui.ButtonSet.OK);
      return;
    }
    if (ui.alert('Correo de prueba', 'Se enviará UN correo con datos ficticios a ' + destino + ', con una credencial de muestra adjunta. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    var blob = credencialFicticiaBlob_(ss, cfg);
    var d = { nombre: 'Persona de Prueba', id: '0P', tipo: 'Participante', urlCredencial: '', idArchivo: '', conImagen: true };
    var r = enviarCorreos_(ss, [{ para: { email: destino, name: 'Prueba' }, asunto: '[PRUEBA] ' + cfg.valores.CORREO_ASUNTO_CREDENCIAL,
      html: htmlCorreo_(cfg, d, 'CREDENCIAL'), adjunto: { nombre: '0P - Persona de Prueba.png', blob: blob }, etiqueta: 'prueba' }])[0];
    registrarBitacora_(ss, [eventoBitacora_(r.ok ? 'CORREO_PRUEBA' : 'CORREO_PRUEBA_ERROR', '', '', destino + ' · ' + (r.ok ? r.id : r.error))]);
    ui.alert(r.ok ? 'Correo de prueba enviado a ' + destino + '.\n\nRevise la bandeja de entrada (y spam). Recuerde volver ENVIOS_HABILITADOS a NO.' : 'No se envió: ' + r.error);
  } catch (e) {
    ui.alert('No se pudo enviar la prueba', String(e.message || e), ui.ButtonSet.OK);
  }
}

/** Credencial de muestra con datos ficticios y un token inventado (no se guarda en Drive). */
function credencialFicticiaBlob_(ss, cfg) {
  if (!cfg.valores.PLANTILLA_CREDENCIAL_ID) throw new Error('Primero cree la plantilla de credencial.');
  var copia = DriveApp.getFileById(cfg.valores.PLANTILLA_CREDENCIAL_ID).makeCopy('Credencial de prueba · temporal', carpetaCredenciales_(ss, cfg));
  try {
    var p = SlidesApp.openById(copia.getId()), s = p.getSlides()[0];
    var r = MAESTRO_COLUMNAS.map(function () { return ''; });
    r[M.ID] = '0P'; r[M.NOMBRE] = 'Persona de Prueba'; r[M.EMPRESA] = 'Empresa Ficticia S.A.'; r[M.CARGO] = 'Cargo de ejemplo';
    r[M.FUENTE] = 'Pagado'; r[M.TOKEN] = nuevoToken_();
    llenarDiapositiva_(s, r, cfg);
    var pagina = s.getObjectId();
    p.saveAndClose();
    var th = Slides.Presentations.Pages.getThumbnail(copia.getId(), pagina, { 'thumbnailProperties.thumbnailSize': 'LARGE', 'thumbnailProperties.mimeType': 'PNG' });
    return UrlFetchApp.fetch(th.contentUrl).getBlob();
  } finally {
    copia.setTrashed(true);
  }
}

function validarConfigCorreo_(cfg) {
  var faltan = ['URL_AGENDA', 'CORREO_ASUNTO_CREDENCIAL', 'EVENTO_FECHA', 'EVENTO_HORA', 'EVENTO_LUGAR']
    .filter(function (k) { return !String(cfg.valores[k] || '').trim(); });
  if (faltan.length) throw new Error('Complete en Config: ' + faltan.join(', '));
}

// ---------------------------------------------------------------------------
// Envíos masivos (siempre a mano, con confirmación)
// ---------------------------------------------------------------------------

function menuEnviarCredencialMarcadas() { prepararEnvio_('CREDENCIAL', true); }
function menuEnviarRecordatorio1Marcadas() { prepararEnvio_('RECORDATORIO_1', true); }
function menuEnviarRecordatorio2Marcadas() { prepararEnvio_('RECORDATORIO_2', true); }
function menuEnviarCredencialPendientes() { prepararEnvio_('CREDENCIAL', false); }
function menuEnviarRecordatorio1() { prepararEnvio_('RECORDATORIO_1', false); }
function menuEnviarRecordatorio2() { prepararEnvio_('RECORDATORIO_2', false); }

/** UID de las filas del Maestro con la casilla «Enviar correo» marcada. */
function uidsMarcados_(ss) {
  var m = leerMaestro_(ss), uids = [];
  m.filas.forEach(function (r) { if (r[M.UID] && r[M.ENVIAR] === true) uids.push(String(r[M.UID])); });
  return uids;
}

/** Clasifica destinatarios: quiénes van y quiénes quedan fuera (y por qué). */
function destinatarios_(ss, cfg, plantilla, uids, forzar) {
  var m = leerMaestro_(ss), ids = idsCredencialPorUid_(m), col = plantillasCorreo_()[plantilla].col;
  var filtro = null;
  if (uids) { filtro = {}; uids.forEach(function (u) { filtro[u] = true; }); }
  var van = [], fuera = { 'Retirado o sin ID': 0, 'Cupo sin nombre (va por el auspiciante)': 0, 'Sin correo': 0, 'Correo inválido': 0, 'Sin credencial': 0, 'Credencial desactualizada': 0, 'Ya enviado': 0 };
  m.filas.forEach(function (r) {
    var uid = String(r[M.UID] || '');
    if (!uid || (filtro && !filtro[uid])) return;
    var correo = String(r[M.CORREO] || '').trim();
    if (r[M.ESTADO_INSC] !== ESTADO_ACTIVO || !parsearId_(r[M.ID])) fuera['Retirado o sin ID']++;
    else if (esCupoSinNombre_(r)) fuera['Cupo sin nombre (va por el auspiciante)']++;
    else if (!correo) fuera['Sin correo']++;
    else if (!correoValido_(correo)) fuera['Correo inválido']++;
    else if (!ids[uid]) fuera['Sin credencial']++;
    else if (r[M.HUELLA] !== huellaCredencial_(r, cfg)) fuera['Credencial desactualizada']++;
    else if (!forzar && /^Enviado/.test(String(r[col] || ''))) fuera['Ya enviado']++;
    else van.push(uid);
  });
  return { van: van, fuera: fuera };
}

function prepararEnvio_(plantilla, seleccion) {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = leerConfig_(ss);
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('ENV_ESTADO')) { ui.alert('Hay un envío interrumpido. Use «Continuar envío interrumpido» primero.'); return; }
    validarConfigCorreo_(cfg);
    if (!enviosHabilitados_(ss)) {
      ui.alert('Envíos deshabilitados', 'ENVIOS_HABILITADOS está en NO. No sale ningún correo.\n\nPara enviar: «Envíos: habilitar / deshabilitar» → SI.', ui.ButtonSet.OK);
      registrarBitacora_(ss, [eventoBitacora_('ENVIO_RECHAZADO', '', '', plantillasCorreo_()[plantilla].nombre + ': ENVIOS_HABILITADOS = NO')]);
      return;
    }
    var uids = seleccion ? uidsMarcados_(ss) : null;
    if (seleccion && !uids.length) { ui.alert('No hay casillas «Enviar correo» marcadas en el Maestro.'); return; }
    var forzar = false;
    var d = destinatarios_(ss, cfg, plantilla, uids, false);
    if (seleccion && d.fuera['Ya enviado'] > 0) {
      var rf = ui.alert('Ya enviados', d.fuera['Ya enviado'] + ' de las filas marcadas ya recibieron este correo. ¿Reenviárselo (forzar reenvío)?', ui.ButtonSet.YES_NO);
      if (rf === ui.Button.YES) { forzar = true; d = destinatarios_(ss, cfg, plantilla, uids, true); }
    }
    var fueraTxt = Object.keys(d.fuera).filter(function (k) { return d.fuera[k]; }).map(function (k) { return '• ' + k + ': ' + d.fuera[k]; }).join('\n');
    if (!d.van.length) { ui.alert('Nada que enviar', 'Nadie cumple las condiciones.\n\nQuedan fuera:\n' + (fueraTxt || '—'), ui.ButtonSet.OK); return; }
    var cuota = MailApp.getRemainingDailyQuota();
    var aviso = d.van.length > cuota ? '\n\n⚠ Su cuenta solo puede enviar ' + cuota + ' correos más hoy: el resto quedará para «Continuar envío interrumpido» mañana.' : '';
    var msg = 'Plantilla: ' + plantillasCorreo_()[plantilla].nombre + '\nDestinatarios: ' + d.van.length + (forzar ? ' (forzando reenvío)' : '') +
      '\n\nQuedan fuera:\n' + (fueraTxt || '• nadie') + aviso;
    if (d.van.length > CORREO_MAX_SIN_FRASE) {
      var r = ui.prompt('Confirmar envío', msg + '\n\nEscriba ENVIAR para confirmar:', ui.ButtonSet.OK_CANCEL);
      if (r.getSelectedButton() !== ui.Button.OK || r.getResponseText().trim().toUpperCase() !== 'ENVIAR') { ui.alert('No se envió nada.'); return; }
    } else if (ui.alert('Confirmar envío', msg + '\n\n¿Enviar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) {
      return;
    }
    props.setProperty('ENV_ESTADO', JSON.stringify({ plantilla: plantilla, uids: d.van, hechos: 0, ok: 0, errores: [] }));
    registrarBitacora_(ss, [eventoBitacora_('ENVIO_INICIO', '', '', plantillasCorreo_()[plantilla].nombre + ' · ' + d.van.length + ' destinatarios')]);
    ui.alert('Envío', procesarEnvio_(ss), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudo enviar', String(e.message || e), ui.ButtonSet.OK);
  }
}

function menuContinuarEnvio() {
  var ui = SpreadsheetApp.getUi();
  try {
    if (!PropertiesService.getScriptProperties().getProperty('ENV_ESTADO')) { ui.alert('No hay envíos interrumpidos.'); return; }
    ui.alert('Envío', procesarEnvio_(SpreadsheetApp.getActiveSpreadsheet()), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudo continuar', String(e.message || e), ui.ButtonSet.OK);
  }
}

/** Envía en tandas hasta ~4,5 min. Nunca programa continuaciones: el responsable pulsa «Continuar». */
function procesarEnvio_(ss) {
  var props = PropertiesService.getScriptProperties();
  var e = JSON.parse(props.getProperty('ENV_ESTADO'));
  var t0 = Date.now(), p = plantillasCorreo_()[e.plantilla];
  while (e.hechos < e.uids.length && Date.now() - t0 < CORREO_TIEMPO_MAX_MS) {
    var cfg = leerConfig_(ss);
    if (compacto_(cfg.valores.ENVIOS_HABILITADOS) !== 'si') {
      props.setProperty('ENV_ESTADO', JSON.stringify(e));
      return 'Se detuvo: ENVIOS_HABILITADOS cambió a NO. Van ' + e.ok + ' enviados. Para seguir, habilite los envíos y use «Continuar envío interrumpido».';
    }
    var lote = e.uids.slice(e.hechos, e.hechos + CORREO_POR_TANDA);
    var res = enviarLote_(ss, cfg, e.plantilla, lote);
    e.hechos += lote.length;
    e.ok += res.ok;
    e.errores = e.errores.concat(res.errores);
    props.setProperty('ENV_ESTADO', JSON.stringify(e));
  }
  if (e.hechos < e.uids.length) {
    return 'Van ' + e.hechos + ' de ' + e.uids.length + ' (' + e.ok + ' enviados). Apps Script corta a los 6 minutos: use «Continuar envío interrumpido».';
  }
  props.deleteProperty('ENV_ESTADO');
  registrarBitacora_(ss, [eventoBitacora_('ENVIO_FIN', '', '', p.nombre + ' · ' + e.ok + ' enviados · ' + e.errores.length + ' con error')]);
  return 'Listo: ' + e.ok + ' correos enviados (' + p.nombre + ').' +
    (e.errores.length ? '\n\nCon error (' + e.errores.length + '):\n' + e.errores.slice(0, 15).join('\n') : '') +
    '\n\nRecuerde volver ENVIOS_HABILITADOS a NO.';
}

function enviarLote_(ss, cfg, plantilla, uids) {
  var m = leerMaestro_(ss), ids = idsCredencialPorUid_(m), p = plantillasCorreo_()[plantilla];
  var porUid = {};
  m.filas.forEach(function (r) { if (r[M.UID]) porUid[String(r[M.UID])] = r; });
  var mensajes = [], quienes = [], errores = [];
  uids.forEach(function (uid) {
    var r = porUid[uid];
    if (!r || !ids[uid]) { errores.push(uid + ': sin credencial'); return; }
    try {
      var id = parsearId_(r[M.ID]);
      var nombre = etiquetaNombre_(cfg, r);
      var d = { nombre: nombre, id: r[M.ID], tipo: tipoCredencial_(cfg, id.sigla, r[M.FUENTE]),
        urlCredencial: 'https://drive.google.com/file/d/' + ids[uid] + '/view', idArchivo: ids[uid], conImagen: true };
      mensajes.push({ para: { email: String(r[M.CORREO]).trim(), name: nombre }, asunto: cfg.valores[p.asunto], html: htmlCorreo_(cfg, d, plantilla),
        adjunto: { nombre: r[M.ID] + ' - ' + nombre + '.png', blob: DriveApp.getFileById(ids[uid]).getBlob() }, etiqueta: plantilla.toLowerCase() });
      quienes.push(r);
    } catch (e) {
      errores.push(r[M.ID] + ': ' + e.message);
    }
  });
  var res = enviarCorreos_(ss, mensajes);
  var ahora = fmtFecha_(new Date(), 'dd/MM HH:mm');
  var estados = {}, casillas = {}, eventos = [], ok = 0;
  res.forEach(function (x, i) {
    var r = quienes[i];
    estados[String(r[M.UID])] = x.ok ? 'Enviado ' + ahora : 'Error: ' + x.error;
    if (x.ok) casillas[String(r[M.UID])] = false; // se desmarca solo lo que salió bien
    if (x.ok) ok++; else errores.push(r[M.ID] + ': ' + x.error);
    eventos.push(eventoBitacora_(x.ok ? 'CORREO_ENVIADO' : 'CORREO_ERROR', r[M.UID], r[M.ID], p.nombre + ' · ' + (x.ok ? x.id : x.error)));
  });
  escribirColumnaPorUid_(ss, p.col, estados);
  escribirColumnaPorUid_(ss, M.ENVIAR, casillas);
  registrarBitacora_(ss, eventos);
  return { ok: ok, errores: errores };
}

/** Reescribe una columna del Maestro solo en las filas indicadas (por UID), en un único setValues y bajo bloqueo. */
function escribirColumnaPorUid_(ss, col, valoresPorUid) {
  if (!Object.keys(valoresPorUid).length) return;
  var lock = tomarBloqueo_(30000);
  try {
    var m = leerMaestro_(ss);
    var colVals = m.filas.map(function (r) {
      var v = valoresPorUid[String(r[M.UID] || '')];
      return [v !== undefined ? v : r[col]];
    });
    m.hoja.getRange(2, col + 1, colVals.length, 1).setValues(colVals);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}
