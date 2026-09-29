/**
 * Credencial digital (SPEC §6): plantilla vertical en Google Slides + QR generado en Apps Script → PNG en Drive.
 *
 * Diseño aprobado el 27/09 según la línea gráfica de la Convención: fondo fijo (fondo-credencial.png, con luces,
 * mapa, logos, íconos, tarjeta del QR y píldora del tipo) + textos en Poppins + QR con el isotipo al centro.
 * Coordenadas en puntos de la página 540×960 (= píxeles del diseño 1080×1920 / 2).
 */

var CRED = {
  LUGAR: { caja: [186, 222.5, 330, 26], tam: 18, peso: 400, color: '#ffffff', alin: 'IZQ' },
  FECHA: { caja: [186, 255, 330, 26], tam: 18, peso: 400, color: '#ffffff', alin: 'IZQ' },
  TEXTO: { caja: [45, 292.5, 450, 25], tam: 20, peso: 300, color: '#d6b16f' },
  NOMBRE: { caja: [30, 314, 480, 65], tam: 31, peso: 700, color: '#ffffff' },
  CARGO: { caja: [45, 380, 450, 20], tam: 16, peso: 300, color: '#bebebe' },
  EMPRESA: { caja: [45, 400, 450, 25], tam: 19, peso: 600, color: '#ffffff' },
  ID: { caja: [45, 756, 450, 85], tam: 75, peso: 700, color: '#d6b16f' },
  TIPO: { caja: [170, 846, 200, 28], tam: 16, peso: 600, color: '#000000' },
  QR: [125, 447.5, 290],
  ISO_PAD: 0.236, // del lado del QR (incluye su margen blanco)
  ISO: 0.20
};
var CRED_FUENTE = 'Poppins';
var CRED_LOTE = 12;               // credenciales por guardado de Slides
var CRED_TIEMPO_MAX_MS = 270000;  // 4,5 min por ejecución (el límite de Apps Script es 6)
var CRED_TRIGGER = 'continuarGeneracionCredenciales';
var CRED_MAX_SIN_FRASE = 5;       // más de esto exige escribir GENERA TODAS

function agregarMenuCredenciales_(menu) {
  menu.addSubMenu(SpreadsheetApp.getUi().createMenu('Credenciales')
    .addItem('Crear / actualizar plantilla', 'menuCrearPlantillaCredencial')
    .addItem('Generar para las filas seleccionadas del Maestro', 'menuGenerarSeleccion')
    .addItem('Generar credenciales pendientes', 'menuGenerarPendientes')
    .addItem('Ver avance de la generación', 'menuAvanceGeneracion')
    .addItem('Exportar credenciales por auspiciante', 'menuExportarPorDueno')
    .addItem('Detener la generación', 'menuDetenerGeneracion'));
}

// ---------------------------------------------------------------------------
// Plantilla
// ---------------------------------------------------------------------------

function menuCrearPlantillaCredencial() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var r = crearPlantillaCredencial_(ss, leerConfig_(ss));
    var link = 'https://docs.google.com/presentation/d/' + r.id + '/edit';
    if (r.estado === 'AJUSTAR_TAMANO') {
      ui.alert('Falta un paso: tamaño vertical', [
        'Google Slides no permite fijar el tamaño desde el script. Hágalo una sola vez:', '',
        '1. Abra la plantilla: ' + link,
        '2. Archivo → Configuración de página → Personalizado.',
        '3. Escriba 540 × 960 y elija «Puntos» (o 7,5 × 13,333 pulgadas) → Aplicar.',
        '4. Vuelva aquí y ejecute otra vez «Credenciales → Crear / actualizar plantilla».'
      ].join('\n'), ui.ButtonSet.OK);
      return;
    }
    ui.alert('Plantilla lista', ['Diseño armado en la página vertical:', link, '',
      'Puede abrirla para revisarla. No cambie los textos entre {{ }} ni borre elementos.'].join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudo crear la plantilla', String(e.message || e), ui.ButtonSet.OK);
  }
}

/** La página debe ser 540 × 960 pt (9:16 vertical). */
function plantillaVertical_(presentacionId) {
  var ps = Slides.Presentations.get(presentacionId, { fields: 'pageSize' }).pageSize;
  var aPt = function (d) { return d.unit === 'EMU' ? d.magnitude / 12700 : d.magnitude; };
  var w = aPt(ps.width), h = aPt(ps.height);
  return Math.abs(w - 540) < 6 && Math.abs(h - 960) < 6;
}

function carpetaCredenciales_(ss, cfg) {
  var id = cfg.valores.CARPETA_CREDENCIALES_ID;
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* se crea abajo */ } }
  var c = DriveApp.createFolder('Credenciales · ' + ss.getName());
  escribirConfig_(ss, 'CARPETA_CREDENCIALES_ID', c.getId());
  return c;
}

function recursoCredencial_(cfg, nombre) {
  var carpetas = DriveApp.getFoldersByName(cfg.valores.CARPETA_RECURSOS || '');
  if (!carpetas.hasNext()) throw new Error('No se encontró la carpeta de Drive «' + cfg.valores.CARPETA_RECURSOS + '» (Config: CARPETA_RECURSOS).');
  var archivos = carpetas.next().getFilesByName(nombre);
  if (!archivos.hasNext()) throw new Error('Falta «' + nombre + '» en la carpeta «' + cfg.valores.CARPETA_RECURSOS + '».');
  return archivos.next();
}

function crearPlantillaCredencial_(ss, cfg) {
  var carpeta = carpetaCredenciales_(ss, cfg);
  var id = cfg.valores.PLANTILLA_CREDENCIAL_ID;
  var existe = false;
  if (id) { try { existe = !DriveApp.getFileById(id).isTrashed(); } catch (e) { existe = false; } }
  if (!existe) {
    var nueva = Slides.Presentations.create({ title: 'Plantilla credencial · ' + (cfg.valores.EVENTO_NOMBRE || '') });
    DriveApp.getFileById(nueva.presentationId).moveTo(carpeta);
    id = nueva.presentationId;
    escribirConfig_(ss, 'PLANTILLA_CREDENCIAL_ID', id);
  }
  if (!plantillaVertical_(id)) return { estado: 'AJUSTAR_TAMANO', id: id };

  var fondo = recursoCredencial_(cfg, 'fondo-credencial.png').getBlob();
  var iso = recursoCredencial_(cfg, 'isotipo-x.png').getBlob();
  var p = SlidesApp.openById(id);
  p.getSlides().slice(1).forEach(function (sl) { sl.remove(); });
  var s = p.getSlides()[0];
  s.getPageElements().forEach(function (e) { e.remove(); });

  s.insertImage(fondo, 0, 0, 540, 960).setTitle('FONDO').sendToBack();
  var textos = {
    LUGAR: cfg.valores.EVENTO_LUGAR, FECHA: cfg.valores.CREDENCIAL_FECHA,
    TEXTO: '{{TEXTO}}', NOMBRE: '{{NOMBRE}}', CARGO: '{{CARGO}}', EMPRESA: '{{EMPRESA}}', ID: '{{ID}}', TIPO: '{{TIPO}}'
  };
  Object.keys(textos).forEach(function (k) {
    var d = CRED[k], c = d.caja;
    var box = s.insertTextBox(textos[k] || ' ', c[0], c[1], c[2], c[3]);
    box.setTitle(k);
    box.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
    var t = box.getText();
    t.getTextStyle().setFontFamilyAndWeight(CRED_FUENTE, d.peso).setFontSize(d.tam).setForegroundColor(d.color);
    t.getParagraphStyle().setParagraphAlignment(d.alin === 'IZQ' ? SlidesApp.ParagraphAlignment.START : SlidesApp.ParagraphAlignment.CENTER);
  });

  var q = CRED.QR;
  var marcador = s.insertShape(SlidesApp.ShapeType.RECTANGLE, q[0], q[1], q[2], q[2]);
  marcador.setTitle('QR'); marcador.getFill().setSolidFill('#ffffff'); marcador.getBorder().setTransparent();
  var cx = q[0] + q[2] / 2, cy = q[1] + q[2] / 2, lp = q[2] * CRED.ISO_PAD, li = q[2] * CRED.ISO;
  var pad = s.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, cx - lp / 2, cy - lp / 2, lp, lp);
  pad.setTitle('ISO_PAD'); pad.getFill().setSolidFill('#ffffff'); pad.getBorder().setTransparent();
  var img = s.insertImage(iso);
  var esc = Math.min(li / img.getWidth(), li / img.getHeight());
  img.setWidth(img.getWidth() * esc).setHeight(img.getHeight() * esc);
  img.setLeft(cx - img.getWidth() / 2).setTop(cy - img.getHeight() / 2).setTitle('ISO');
  p.saveAndClose();
  registrarBitacora_(ss, [eventoBitacora_('PLANTILLA_CREDENCIAL', '', '', 'Plantilla armada: ' + id)]);
  return { estado: 'OK', id: id };
}

// ---------------------------------------------------------------------------
// Qué generar
// ---------------------------------------------------------------------------

/** Personas activas con ID. `soloPendientes`: sin credencial o con credencial desactualizada. */
function candidatosCredencial_(ss, cfg, uids, soloPendientes) {
  var m = leerMaestro_(ss);
  var filtro = uids ? {} : null;
  (uids || []).forEach(function (u) { filtro[u] = true; });
  var ok = [], fuera = [];
  m.filas.forEach(function (r) {
    var uid = String(r[M.UID] || '').trim();
    if (!uid || (filtro && !filtro[uid])) return;
    if (r[M.ESTADO_INSC] !== ESTADO_ACTIVO || !parsearId_(r[M.ID])) { fuera.push({ id: r[M.ID], nombre: r[M.NOMBRE], motivo: 'Retirado o sin ID' }); return; }
    if (!esCupoSinNombre_(r) && (!String(r[M.NOMBRE] || '').trim() || !String(r[M.EMPRESA] || '').trim())) { fuera.push({ id: r[M.ID], nombre: r[M.NOMBRE], motivo: 'Falta nombre o empresa' }); return; }
    var tiene = String(r[M.CREDENCIAL] || '') !== '';
    var alDia = tiene && r[M.HUELLA] === huellaCredencial_(r, cfg);
    if (soloPendientes && alDia) return;
    ok.push(uid);
  });
  return { uids: ok, fuera: fuera };
}

function menuGenerarSeleccion() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getActiveSheet();
    if (hoja.getName() !== HOJA.MAESTRO) { ui.alert('Seleccione filas en la pestaña Maestro.'); return; }
    var uids = [];
    hoja.getActiveRangeList().getRanges().forEach(function (rg) {
      var desde = Math.max(rg.getRow(), 2), hasta = rg.getLastRow();
      if (hasta < desde) return;
      hoja.getRange(desde, M.UID + 1, hasta - desde + 1, 1).getValues().forEach(function (v) { if (v[0]) uids.push(String(v[0])); });
    });
    if (!uids.length) { ui.alert('No hay filas del Maestro seleccionadas.'); return; }
    iniciarGeneracion_(ss, uids, false, ui);
  } catch (e) {
    ui.alert('No se pudo generar', String(e.message || e), ui.ButtonSet.OK);
  }
}

function menuGenerarPendientes() {
  var ui = SpreadsheetApp.getUi();
  try { iniciarGeneracion_(SpreadsheetApp.getActiveSpreadsheet(), null, true, ui); }
  catch (e) { ui.alert('No se pudo generar', String(e.message || e), ui.ButtonSet.OK); }
}

function iniciarGeneracion_(ss, uids, soloPendientes, ui) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('GEN_ESTADO')) { ui.alert('Ya hay una generación en curso. Use «Ver avance» o «Detener la generación».'); return; }
  var cfg = leerConfig_(ss);
  if (!cfg.valores.PLANTILLA_CREDENCIAL_ID) throw new Error('Primero cree la plantilla: «Credenciales → Crear / actualizar plantilla».');
  if (!plantillaVertical_(cfg.valores.PLANTILLA_CREDENCIAL_ID)) throw new Error('La plantilla no está en tamaño vertical 540 × 960. Ejecute «Credenciales → Crear / actualizar plantilla» y siga las instrucciones.');
  var c = candidatosCredencial_(ss, cfg, uids, soloPendientes);
  var fuera = c.fuera.length ? '\n\nQuedan fuera ' + c.fuera.length + ':\n' + c.fuera.slice(0, 15).map(function (x) { return '• ' + (x.id || '—') + ' ' + (x.nombre || '') + ' (' + x.motivo + ')'; }).join('\n') : '';
  if (!c.uids.length) { ui.alert('Nada que generar', 'No hay credenciales pendientes.' + fuera, ui.ButtonSet.OK); return; }
  var minutos = Math.ceil(c.uids.length * 5 / 60);
  var msg = 'Se generarán ' + c.uids.length + ' credenciales (≈ ' + minutos + ' min).' + fuera;
  if (c.uids.length > CRED_MAX_SIN_FRASE) {
    var r = ui.prompt('Generar credenciales', msg + '\n\nEscriba GENERA TODAS para confirmar:', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK || r.getResponseText().trim().toUpperCase() !== 'GENERA TODAS') { ui.alert('No se generó nada.'); return; }
  } else if (ui.alert('Generar credenciales', msg + '\n\n¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) {
    return;
  }
  var trabajo = DriveApp.getFileById(cfg.valores.PLANTILLA_CREDENCIAL_ID).makeCopy('Credenciales · lote temporal', carpetaCredenciales_(ss, cfg));
  props.setProperty('GEN_ESTADO', JSON.stringify({ uids: c.uids, hechos: 0, errores: [], trabajo: trabajo.getId(), inicio: Date.now() }));
  registrarBitacora_(ss, [eventoBitacora_('CREDENCIALES_INICIO', '', '', c.uids.length + ' credenciales en cola')]);
  var res = procesarGeneracion_(ss);
  ui.alert('Generación de credenciales', res, ui.ButtonSet.OK);
}

// ---------------------------------------------------------------------------
// Proceso por lotes con continuación
// ---------------------------------------------------------------------------

/** Lo llama el trigger de continuación. */
function continuarGeneracionCredenciales() {
  borrarTriggersContinuacion_();
  procesarGeneracion_(SpreadsheetApp.openById(idHojaActual_()));
}

function idHojaActual_() {
  var id = PropertiesService.getScriptProperties().getProperty('GEN_HOJA');
  return id || SpreadsheetApp.getActiveSpreadsheet().getId();
}

function procesarGeneracion_(ss) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('GEN_HOJA', ss.getId());
  var estado = JSON.parse(props.getProperty('GEN_ESTADO') || 'null');
  if (!estado) return 'No hay generación en curso.';
  var cfg = leerConfig_(ss);
  var carpeta = carpetaCredenciales_(ss, cfg);
  var t0 = Date.now();

  while (estado.hechos < estado.uids.length && Date.now() - t0 < CRED_TIEMPO_MAX_MS) {
    var lote = estado.uids.slice(estado.hechos, estado.hechos + CRED_LOTE);
    var r = generarLote_(ss, cfg, carpeta, estado.trabajo, lote);
    estado.errores = estado.errores.concat(r.errores);
    estado.hechos += lote.length;
    props.setProperty('GEN_ESTADO', JSON.stringify(estado));
    escribirConfig_(ss, 'GENERACION_ESTADO', fmtFecha_(new Date()) + ' · ' + estado.hechos + ' de ' + estado.uids.length + (estado.errores.length ? ' · ' + estado.errores.length + ' con error' : ''));
  }

  if (estado.hechos < estado.uids.length) {
    ScriptApp.newTrigger(CRED_TRIGGER).timeBased().after(60 * 1000).create();
    return 'Van ' + estado.hechos + ' de ' + estado.uids.length + '. Sigue sola en segundo plano (un lote por minuto); el avance queda en Config → GENERACION_ESTADO.';
  }
  try { DriveApp.getFileById(estado.trabajo).setTrashed(true); } catch (e) { /* ya no existe */ }
  props.deleteProperty('GEN_ESTADO');
  var ok = estado.uids.length - estado.errores.length;
  registrarBitacora_(ss, [eventoBitacora_('CREDENCIALES_FIN', '', '', ok + ' generadas · ' + estado.errores.length + ' con error')]);
  return 'Listo: ' + ok + ' credenciales generadas.' +
    (estado.errores.length ? '\n\nCon error (' + estado.errores.length + '):\n' + estado.errores.slice(0, 20).join('\n') : '');
}

function borrarTriggersContinuacion_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === CRED_TRIGGER) ScriptApp.deleteTrigger(t);
  });
}

function menuAvanceGeneracion() {
  var estado = JSON.parse(PropertiesService.getScriptProperties().getProperty('GEN_ESTADO') || 'null');
  var ui = SpreadsheetApp.getUi();
  if (!estado) { ui.alert('No hay generación en curso.\n\nÚltimo estado: ' + (leerConfig_(SpreadsheetApp.getActiveSpreadsheet()).valores.GENERACION_ESTADO || '—')); return; }
  ui.alert('Van ' + estado.hechos + ' de ' + estado.uids.length + (estado.errores.length ? ' · ' + estado.errores.length + ' con error' : '') + '.');
}

function menuDetenerGeneracion() {
  var props = PropertiesService.getScriptProperties();
  var estado = JSON.parse(props.getProperty('GEN_ESTADO') || 'null');
  borrarTriggersContinuacion_();
  if (estado) { try { DriveApp.getFileById(estado.trabajo).setTrashed(true); } catch (e) { /* ya no existe */ } }
  props.deleteProperty('GEN_ESTADO');
  SpreadsheetApp.getUi().alert(estado ? 'Generación detenida en ' + estado.hechos + ' de ' + estado.uids.length + '. Las ya generadas quedan.' : 'No había generación en curso.');
}

/** Genera un lote: diapositivas → un solo guardado → miniaturas PNG → Drive → Maestro. */
function generarLote_(ss, cfg, carpeta, trabajoId, uids) {
  var m = leerMaestro_(ss);
  var idsArchivo = idsCredencialPorUid_(m);
  var porUid = {};
  m.filas.forEach(function (r, i) { if (r[M.UID]) porUid[String(r[M.UID])] = { r: r, i: i }; });

  var pres = SlidesApp.openById(trabajoId);
  var base = pres.getSlides()[0];
  var hechos = [], errores = [];
  uids.forEach(function (uid) {
    var x = porUid[uid];
    if (!x) { errores.push(uid + ': ya no está en el Maestro'); return; }
    try {
      var s = base.duplicate();
      llenarDiapositiva_(s, x.r, cfg);
      hechos.push({ uid: uid, r: x.r, pagina: s.getObjectId(), huella: huellaCredencial_(x.r, cfg) });
    } catch (e) {
      errores.push(x.r[M.ID] + ' ' + x.r[M.NOMBRE] + ': ' + e.message);
    }
  });
  pres.saveAndClose();

  hechos.forEach(function (h) {
    try {
      var th = Slides.Presentations.Pages.getThumbnail(trabajoId, h.pagina,
        { 'thumbnailProperties.thumbnailSize': 'LARGE', 'thumbnailProperties.mimeType': 'PNG' });
      var nombre = (h.r[M.ID] + ' - ' + etiquetaNombre_(cfg, h.r).replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.png');
      var blob = UrlFetchApp.fetch(th.contentUrl).getBlob().setName(nombre);
      var anterior = idsArchivo[h.uid] || '';
      var archivo = carpeta.createFile(blob);
      try { archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
      catch (e) { h.sinLinkPublico = true; }
      if (anterior) { try { DriveApp.getFileById(anterior).setTrashed(true); } catch (e) { /* ya no existe */ } }
      h.url = 'https://drive.google.com/file/d/' + archivo.getId() + '/view';
    } catch (e) {
      h.error = e.message;
      errores.push(h.r[M.ID] + ' ' + h.r[M.NOMBRE] + ': ' + e.message);
    }
  });

  // Se borran las diapositivas del lote para que la copia de trabajo no crezca.
  var p2 = SlidesApp.openById(trabajoId);
  hechos.forEach(function (h) { var sl = p2.getSlideById(h.pagina); if (sl) sl.remove(); });
  p2.saveAndClose();

  escribirCredencialesEnMaestro_(ss, hechos.filter(function (h) { return h.url; }));
  return { errores: errores };
}

function llenarDiapositiva_(s, r, cfg) {
  var id = parsearId_(r[M.ID]);
  var nombre = etiquetaNombre_(cfg, r);
  var empresa = esCupoSinNombre_(r) ? '' : String(r[M.EMPRESA] || '').trim();
  s.replaceAllText('{{TEXTO}}', cfg.valores.CREDENCIAL_TEXTO || ' ');
  s.replaceAllText('{{NOMBRE}}', nombre);
  s.replaceAllText('{{CARGO}}', String(r[M.CARGO] || '').trim() || ' ');
  s.replaceAllText('{{EMPRESA}}', empresa || ' ');
  s.replaceAllText('{{ID}}', String(r[M.ID]));
  s.replaceAllText('{{TIPO}}', tipoCredencial_(cfg, id.sigla, r[M.FUENTE]).toUpperCase());

  var el = {};
  s.getPageElements().forEach(function (e) { el[e.getTitle()] = e; });
  if (el.NOMBRE) el.NOMBRE.asShape().getText().getTextStyle().setFontSize(tamanoTexto_(nombre, [[22, 31], [30, 26], [40, 22]], 19));
  if (el.EMPRESA) el.EMPRESA.asShape().getText().getTextStyle().setFontSize(tamanoTexto_(empresa, [[34, 19], [48, 16]], 14));

  var q = el.QR;
  if (!q) throw new Error('La plantilla no tiene el marcador QR');
  var blob = qrPngBlob_(urlQr_(cfg, r[M.TOKEN]), 900, 'qr.png');
  var img = s.insertImage(blob, q.getLeft(), q.getTop(), q.getWidth(), q.getHeight());
  q.remove();
  img.setTitle('QR_IMG');
  if (el.ISO_PAD) el.ISO_PAD.bringToFront();
  if (el.ISO) el.ISO.bringToFront();
}

function tamanoTexto_(texto, escalones, minimo) {
  var n = texto.length;
  for (var i = 0; i < escalones.length; i++) if (n <= escalones[i][0]) return escalones[i][1];
  return minimo;
}

/** UID → ID del PNG en Drive, leído de las fórmulas HYPERLINK de la columna Credencial. */
function idsCredencialPorUid_(m) {
  var res = {};
  if (!m.filas.length) return res;
  var f = m.hoja.getRange(2, M.CREDENCIAL + 1, m.filas.length, 1).getFormulas();
  m.filas.forEach(function (r, i) { var id = idArchivoDeCelda_(f[i][0]); if (r[M.UID] && id) res[String(r[M.UID])] = id; });
  return res;
}

function idArchivoDeCelda_(v) {
  var m = /\/d\/([\w-]{20,})/.exec(String(v || ''));
  return m ? m[1] : '';
}

/** Escribe Credencial (L), Huella (AE) y limpia la alerta, por columnas completas y bajo bloqueo. */
function escribirCredencialesEnMaestro_(ss, hechos) {
  if (!hechos.length) return;
  var lock = tomarBloqueo_(30000);
  try {
    var m = leerMaestro_(ss), n = m.filas.length;
    var porUid = {};
    hechos.forEach(function (h) { porUid[h.uid] = h; });
    // La columna Credencial (L) la escribe solo este módulo: se reescribe completa como fórmulas.
    var colL = m.hoja.getRange(2, M.CREDENCIAL + 1, n, 1);
    var formulas = colL.getFormulas();
    var huellas = m.filas.map(function (r) { return [r[M.HUELLA]]; });
    var alertas = m.filas.map(function (r) { return [r[M.ALERTAS]]; });
    var eventos = [];
    m.filas.forEach(function (r, i) {
      var h = porUid[String(r[M.UID])];
      if (!h) return;
      formulas[i] = ['=HYPERLINK("' + h.url + '","Ver credencial")'];
      huellas[i] = [h.huella];
      var a = String(r[M.ALERTAS] || '').split(SEP_ALERTAS).map(function (x) { return x.trim(); })
        .filter(function (x) { return x && x !== ALERTA.CREDENCIAL_DESACTUALIZADA && x !== ALERTA.SIN_LINK_PUBLICO; });
      if (h.sinLinkPublico) a.push(ALERTA.SIN_LINK_PUBLICO);
      alertas[i] = [a.join(SEP_ALERTAS)];
      eventos.push(eventoBitacora_('CREDENCIAL_GENERADA', r[M.UID], r[M.ID], h.url + (h.sinLinkPublico ? ' (sin link público)' : '')));
    });
    colL.setFormulas(formulas);
    m.hoja.getRange(2, M.HUELLA + 1, n, 1).setValues(huellas);
    m.hoja.getRange(2, M.ALERTAS + 1, n, 1).setValues(alertas);
    registrarBitacora_(ss, eventos);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Entrega por dueño (auspiciantes): una carpeta de Drive por auspiciante
// ---------------------------------------------------------------------------

function menuExportarPorDueno() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = leerConfig_(ss);
    if (!cfg.entregaPorDueno.length) { ui.alert('Config: ENTREGA_POR_DUENO está vacío.'); return; }
    if (ui.alert('Exportar por auspiciante', [
      'Se creará (o actualizará) una carpeta por auspiciante con copias de sus credenciales y una lista.',
      'Pestañas: ' + cfg.entregaPorDueno.join(', '), '',
      'No se comparte nada: su equipo comparte cada carpeta con su auspiciante. ¿Continuar?'
    ].join('\n'), ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    var r = exportarPorDueno_(ss, cfg);
    ui.alert('Exportación lista', [
      'Carpeta: ' + r.url, '',
      r.duenos + ' auspiciantes · ' + r.copias + ' credenciales copiadas.',
      r.sinCredencial.length ? 'Sin credencial todavía (' + r.sinCredencial.length + '): ' + r.sinCredencial.slice(0, 15).join(', ') + '. Genere las pendientes y vuelva a exportar.' : '',
      '', 'Si alguien cambia sus datos, regenere las pendientes y exporte otra vez: la carpeta se actualiza.'
    ].join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudo exportar', String(e.message || e), ui.ButtonSet.OK);
  }
}

function exportarPorDueno_(ss, cfg) {
  var m = leerMaestro_(ss), ids = idsCredencialPorUid_(m);
  var raiz = null, id = cfg.valores.CARPETA_ENTREGA_ID;
  if (id) { try { raiz = DriveApp.getFolderById(id); if (raiz.isTrashed()) raiz = null; } catch (e) { raiz = null; } }
  if (!raiz) {
    raiz = DriveApp.createFolder('Credenciales por auspiciante · ' + ss.getName());
    escribirConfig_(ss, 'CARPETA_ENTREGA_ID', raiz.getId());
  }
  var grupos = {};
  m.filas.forEach(function (r) {
    if (!r[M.UID] || r[M.ESTADO_INSC] !== ESTADO_ACTIVO || cfg.entregaPorDueno.indexOf(String(r[M.PESTANA])) === -1) return;
    var d = String(r[M.CUPO_DE] || '').trim() || '(Sin auspiciante)';
    (grupos[d] = grupos[d] || []).push(r);
  });
  var res = { duenos: 0, copias: 0, sinCredencial: [], url: raiz.getUrl() };
  Object.keys(grupos).sort().forEach(function (dueno) {
    var it = raiz.getFoldersByName(dueno);
    var sub = it.hasNext() ? it.next() : raiz.createFolder(dueno);
    var viejos = sub.getFiles();
    while (viejos.hasNext()) viejos.next().setTrashed(true);
    var filas = [['ID', 'Nombre en la credencial', 'Empresa', 'Estado', 'Credencial']];
    grupos[dueno].sort(function (a, b) { return (parsearId_(a[M.ID]) || {}).numero - (parsearId_(b[M.ID]) || {}).numero; })
      .forEach(function (r) {
        var etiqueta = etiquetaNombre_(cfg, r);
        var fid = ids[String(r[M.UID])];
        if (!fid) { res.sinCredencial.push(r[M.ID]); filas.push([r[M.ID], etiqueta, r[M.EMPRESA], 'Sin credencial todavía', '']); return; }
        var copia = DriveApp.getFileById(fid).makeCopy(r[M.ID] + ' - ' + etiqueta.replace(/[\\/:*?"<>|]+/g, ' ') + '.png', sub);
        res.copias++;
        filas.push([r[M.ID], etiqueta, esCupoSinNombre_(r) ? '' : r[M.EMPRESA], esCupoSinNombre_(r) ? 'Cupo sin nombre' : 'Con nombre', copia.getUrl()]);
      });
    var lista = SpreadsheetApp.create('Lista · ' + dueno);
    lista.getSheets()[0].getRange(1, 1, filas.length, filas[0].length).setValues(filas);
    lista.getSheets()[0].getRange(1, 1, 1, filas[0].length).setFontWeight('bold');
    DriveApp.getFileById(lista.getId()).moveTo(sub);
    res.duenos++;
  });
  registrarBitacora_(ss, [eventoBitacora_('EXPORTAR_POR_DUENO', '', '', res.duenos + ' carpetas · ' + res.copias + ' credenciales')]);
  return res;
}
