/**
 * «Instalar / reparar estructura». Idempotente: puede ejecutarse varias veces.
 * No borra ni reordena nada en las pestañas origen. En ellas solo agrega la columna
 * «UID (no editar)» DENTRO de la tabla de Sheets, oculta y protegida en modo advertencia.
 */

var BITACORA_COLUMNAS = ['Fecha/hora servidor', 'Hora dispositivo', 'Lector', 'Acción', 'UID', 'ID', 'Detalle', 'clientId'];
var COLA_COLUMNAS = ['Tipo', 'UID', 'Estado', 'Intentos', 'Creado', 'Enviado', 'Error'];
var REENVIOS_COLUMNAS = ['Correo (hash)', 'Hora'];
var COLOR_ENCABEZADO = '#1f3864';

function menuInstalar() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('Instalar / reparar estructura',
    'Se crearán las pestañas que falten (Config, Maestro, Bitácora, LÉEME y las declaradas en PESTANAS_A_CREAR) ' +
    'y la columna oculta «' + ENC.uid + '» dentro de la tabla de cada pestaña origen.\n\n' +
    'No se borra ni se mueve ningún dato. ¿Continuar?', ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  try {
    mostrarTexto_('Instalar / reparar estructura', instalarEstructura_());
  } catch (e) {
    ui.alert('La instalación se detuvo', String(e.message || e), ui.ButtonSet.OK);
  }
}

function instalarEstructura_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var L = [];
  var lock = tomarBloqueo_(30000);
  try {
    if (ss.getSpreadsheetTimeZone() !== ZONA_HORARIA) {
      L.push('✔ Zona horaria: ' + ss.getSpreadsheetTimeZone() + ' → ' + ZONA_HORARIA);
      ss.setSpreadsheetTimeZone(ZONA_HORARIA);
    } else {
      L.push('✔ Zona horaria: ' + ZONA_HORARIA);
    }
    asegurarConfig_(ss, L);
    var cfg = leerConfig_(ss);
    if (asegurarPestanasNuevas_(ss, cfg, L) > 0) {
      SpreadsheetApp.flush();
      ss = SpreadsheetApp.openById(ss.getId());
    }
    asegurarColumnasUid_(ss, cfg, L);
    asegurarMaestro_(ss, L);
    asegurarHojaSimple_(ss, HOJA.BITACORA, BITACORA_COLUMNAS, L, true);
    asegurarHojaSimple_(ss, HOJA.PRUEBAS, BITACORA_COLUMNAS, L, true);
    asegurarHojaSimple_(ss, HOJA.COLA, COLA_COLUMNAS, L, true);
    asegurarHojaSimple_(ss, HOJA.REENVIOS, REENVIOS_COLUMNAS, L, true);
    asegurarLeeme_(ss, L);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  registrarBitacora_(ss, [eventoBitacora_('INSTALACION', '', '', L.join(' | '))]);
  return L;
}

function asegurarConfig_(ss, L) {
  var hoja = ss.getSheetByName(HOJA.CONFIG);
  var nueva = !hoja;
  if (nueva) {
    hoja = ss.insertSheet(HOJA.CONFIG);
    hoja.getRange(1, 1, 1, 3).setValues([CONFIG_ENCABEZADOS]).setFontWeight('bold').setBackground(COLOR_ENCABEZADO).setFontColor('#ffffff');
    hoja.setFrozenRows(1);
  }
  // Solo se agregan claves que falten. Nunca se sobrescribe un valor existente.
  var existentes = {};
  hoja.getDataRange().getDisplayValues().slice(1).forEach(function (r) {
    var k = String(r[0]).trim();
    if (k) existentes[k] = true;
  });
  var faltan = CONFIG_INICIAL.filter(function (r) { return !existentes[r[0]]; });
  if (faltan.length) {
    hoja.getRange('A:C').setNumberFormat('@');
    hoja.getRange(hoja.getLastRow() + 1, 1, faltan.length, 3).setValues(faltan);
    hoja.setColumnWidth(1, 230); hoja.setColumnWidth(2, 420); hoja.setColumnWidth(3, 560);
  }
  if (nueva) {
    hoja.protect().setDescription('Config: solo el responsable').setWarningOnly(true);
    L.push('✔ Config creada con los valores iniciales (ENVIOS_HABILITADOS = NO, BIENVENIDA_AUTOMATICA = NO)');
  } else {
    L.push('✔ Config ya existía' + (faltan.length ? ' · se agregaron ' + faltan.length + ' claves que faltaban' : ''));
  }
}

/** Crea las pestañas de PESTANAS_A_CREAR duplicando la plantilla (mismo tablero, encabezados y tabla). */
function asegurarPestanasNuevas_(ss, cfg, L) {
  var creadas = 0;
  cfg.pestanasACrear.forEach(function (nombre) {
    if (ss.getSheetByName(nombre)) { L.push('✔ Pestaña «' + nombre + '» ya existe'); return; }
    var declarada = cfg.origenes.some(function (o) { return o.hoja === nombre; });
    if (!declarada) { L.push('⚠ «' + nombre + '» está en PESTANAS_A_CREAR pero no es un ORIGEN declarado: no se crea'); return; }
    var plantilla = ss.getSheetByName(cfg.valores.PLANTILLA_PESTANA_NUEVA);
    if (!plantilla) { L.push('✖ No existe la plantilla «' + cfg.valores.PLANTILLA_PESTANA_NUEVA + '»: no se crea «' + nombre + '»'); return; }

    SpreadsheetApp.flush();
    var resp = Sheets.Spreadsheets.batchUpdate({ requests: [{ duplicateSheet: {
      sourceSheetId: plantilla.getSheetId(), newSheetName: nombre, insertSheetIndex: plantilla.getIndex()
    } }] }, ss.getId());
    // SpreadsheetApp no ve de inmediato lo creado por la API: se busca por ID en una referencia nueva.
    var nuevoId = resp.replies[0].duplicateSheet.properties.sheetId;
    var hoja = SpreadsheetApp.openById(ss.getId()).getSheets().filter(function (h) { return h.getSheetId() === nuevoId; })[0];
    if (!hoja) { L.push('✖ «' + nombre + '» se creó pero no se pudo abrir. Vuelva a ejecutar la instalación.'); return; }
    creadas++;

    // Si la plantilla tenía personas, la copia se vacía para no duplicarlas.
    var enc = localizarEncabezado_(hoja, cfg.filasBusqueda);
    if (enc) {
      var nDatos = hoja.getLastRow() - enc.fila;
      var colNombre = enc.indice[normTexto_(ENC.nombre)];
      if (nDatos > 0) {
        var hayNombres = hoja.getRange(enc.fila + 1, colNombre + 1, nDatos, 1).getDisplayValues()
          .some(function (r) { return String(r[0]).trim() !== ''; });
        if (hayNombres) hoja.getRange(enc.fila + 1, 1, nDatos, hoja.getLastColumn()).clearContent();
      }
    }
    L.push('✔ Pestaña «' + nombre + '» creada (copia vacía de «' + plantilla.getName() + '»)');
  });
  return creadas;
}

function asegurarColumnasUid_(ss, cfg, L) {
  var tablas = tablasPorHoja_(ss.getId());
  cfg.origenes.forEach(function (o) {
    var hoja = ss.getSheetByName(o.hoja);
    if (!hoja) { L.push('✖ «' + o.hoja + '»: la pestaña no existe'); return; }
    var enc = localizarEncabezado_(hoja, cfg.filasBusqueda);
    if (!enc) { L.push('✖ «' + o.hoja + '»: no se encontró el encabezado «Nombre»'); return; }

    var col0 = enc.indice[normTexto_(ENC.uid)];
    if (col0 !== undefined) {
      protegerColumnaUid_(hoja, col0 + 1, o.hoja);
      L.push('✔ «' + o.hoja + '»: columna UID ya existe (' + columnaLetra_(col0 + 1) + ')');
      return;
    }

    var t = (tablas[o.hoja] || []).filter(function (x) { return x.range.startRowIndex === enc.fila - 1; })[0];
    var colNueva; // 1-based
    if (t) {
      colNueva = t.range.endColumnIndex + 1;
      var filaIni = t.range.startRowIndex + 1, nFilas = t.range.endRowIndex - t.range.startRowIndex;
      if (hoja.getMaxColumns() < colNueva) {
        hoja.insertColumnAfter(hoja.getMaxColumns());
      } else {
        var ocupada = hoja.getRange(filaIni, colNueva, nFilas, 1).getDisplayValues().some(function (r) { return String(r[0]) !== ''; });
        if (ocupada) {
          L.push('✖ «' + o.hoja + '»: la columna ' + columnaLetra_(colNueva) + ', a la derecha de la tabla «' + t.nombre +
            '», tiene datos. No se agrega el UID. Libere esa columna y vuelva a ejecutar.');
          return;
        }
      }
      // Extender la tabla una columna, salvo que al insertar la columna Sheets ya la haya incluido.
      var t2 = (tablasPorHoja_(ss.getId())[o.hoja] || []).filter(function (x) { return x.tableId === t.tableId; })[0];
      if (t2 && t2.range.endColumnIndex < colNueva) {
        var r = t2.range;
        Sheets.Spreadsheets.batchUpdate({ requests: [{ updateTable: {
          table: { tableId: t.tableId, range: { sheetId: r.sheetId, startRowIndex: r.startRowIndex, endRowIndex: r.endRowIndex,
            startColumnIndex: r.startColumnIndex, endColumnIndex: colNueva } },
          fields: 'range'
        } }] }, ss.getId());
      }
      hoja.getRange(enc.fila, colNueva).setValue(ENC.uid);
      var t3 = (tablasPorHoja_(ss.getId())[o.hoja] || []).filter(function (x) { return x.tableId === t.tableId; })[0];
      var dentro = t3 && t3.range.endColumnIndex >= colNueva;
      L.push((dentro ? '✔ «' : '✖ «') + o.hoja + '»: columna UID creada en ' + columnaLetra_(colNueva) +
        (dentro ? ', dentro de la tabla «' + t.nombre + '»' : ' pero QUEDÓ FUERA de la tabla «' + t.nombre + '». No sincronice: avise.'));
    } else {
      colNueva = enc.ultimaConTexto + 1;
      if (hoja.getMaxColumns() < colNueva) hoja.insertColumnAfter(hoja.getMaxColumns());
      hoja.getRange(enc.fila, colNueva).setValue(ENC.uid);
      L.push('⚠ «' + o.hoja + '»: no tiene tabla de Sheets; columna UID creada en ' + columnaLetra_(colNueva));
    }
    protegerColumnaUid_(hoja, colNueva, o.hoja);
  });
}

function protegerColumnaUid_(hoja, col, nombreHoja) {
  hoja.hideColumns(col);
  var desc = 'UID (no editar) · ' + nombreHoja;
  var existe = hoja.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function (p) { return p.getDescription() === desc; });
  if (!existe) hoja.getRange(1, col, hoja.getMaxRows(), 1).protect().setDescription(desc).setWarningOnly(true);
}

function asegurarMaestro_(ss, L) {
  var h = ss.getSheetByName(HOJA.MAESTRO);
  if (h) {
    try {
      leerMaestro_(ss); // agrega al final las columnas nuevas que falten y valida el resto
      var huecos = compactarMaestro_(ss);
      if (huecos) L.push('✔ Maestro compactado: se quitaron ' + huecos + ' filas vacías entre los inscritos (ningún dato cambió)');
      asegurarCasillasMaestro_(h, L);
      L.push('✔ Maestro ya existe (' + MAESTRO_COLUMNAS.length + ' columnas)');
    } catch (e) {
      L.push('✖ ' + e.message);
    }
    return;
  }
  h = ss.insertSheet(HOJA.MAESTRO);
  var n = MAESTRO_COLUMNAS.length;
  if (h.getMaxColumns() < n) h.insertColumnsAfter(h.getMaxColumns(), n - h.getMaxColumns());
  h.getRange(1, 1, 1, n).setValues([MAESTRO_COLUMNAS]).setFontWeight('bold').setBackground(COLOR_ENCABEZADO).setFontColor('#ffffff');
  h.setFrozenRows(1);
  // Texto plano para que celulares como 0991234567 no pierdan el cero.
  h.getRange(2, 1, h.getMaxRows() - 1, M.ESTADO_INSC + 1).setNumberFormat('@');
  h.getRange(2, M.TOKEN + 1, h.getMaxRows() - 1, 2).setNumberFormat('@');
  h.getRange(2, M.IDS_ANT + 1, h.getMaxRows() - 1, 1).setNumberFormat('@');
  h.getRange(2, M.ALTA + 1, h.getMaxRows() - 1, 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');

  var verde = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + columnaLetra_(M.ESTADO + 1) + '2="' + LLEGO + '"')
    .setBackground('#c6efce')
    .setRanges([h.getRange(2, 1, h.getMaxRows() - 1, n)])
    .build();
  h.setConditionalFormatRules([verde]);

  h.hideColumns(M.UID + 1);
  h.hideColumns(M.TOKEN + 1);
  h.setColumnWidth(M.NOMBRE + 1, 220); h.setColumnWidth(M.EMPRESA + 1, 200); h.setColumnWidth(M.ALERTAS + 1, 260);

  h.protect().setDescription('Maestro: no editar a mano').setWarningOnly(true);
  asegurarCasillasMaestro_(h, L);
  [M.UID, M.ID, M.TOKEN].forEach(function (c) { protegerSoloPropietario_(h.getRange(1, c + 1, h.getMaxRows(), 1), 'Maestro · ' + MAESTRO_COLUMNAS[c]); });
  L.push('✔ Maestro creado (30 columnas, verde al llegar, UID/ID/Token protegidos)');
}

/** Casillas «Enviar correo» (M) y «WA enviado» (P), fuera de la advertencia de protección para marcarlas sin avisos. */
function asegurarCasillasMaestro_(h, L) {
  var filas = h.getMaxRows() - 1;
  var cols = [M.ENVIAR, M.WA_ENVIADO];
  var nuevas = 0;
  cols.forEach(function (c) {
    var rg = h.getRange(2, c + 1, filas, 1);
    var dv = h.getRange(2, c + 1).getDataValidation();
    if (!dv || dv.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) { rg.insertCheckboxes(); nuevas++; }
  });
  var prot = h.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0];
  if (prot) prot.setUnprotectedRanges(cols.map(function (c) { return h.getRange(2, c + 1, filas, 1); }));
  if (nuevas) L.push('✔ Maestro: casillas «Enviar correo» y «WA enviado» listas');
}

function protegerSoloPropietario_(rango, desc) {
  var p = rango.protect().setDescription(desc);
  var yo = Session.getEffectiveUser();
  p.addEditor(yo);
  p.removeEditors(p.getEditors().filter(function (u) { return u.getEmail() !== yo.getEmail(); }));
  if (p.canDomainEdit()) p.setDomainEdit(false);
}

function asegurarHojaSimple_(ss, nombre, columnas, L, advertencia) {
  if (ss.getSheetByName(nombre)) { L.push('✔ ' + nombre + ' ya existe'); return; }
  var h = ss.insertSheet(nombre);
  h.getRange(1, 1, 1, columnas.length).setValues([columnas]).setFontWeight('bold').setBackground(COLOR_ENCABEZADO).setFontColor('#ffffff');
  h.setFrozenRows(1);
  if (advertencia) h.protect().setDescription(nombre + ': la escribe el sistema').setWarningOnly(true);
  L.push('✔ ' + nombre + ' creada');
}

var LEEME_TEXTO = [
  ['⚠️ LÉEME · Reglas para editar esta hoja'],
  [''],
  ['Esta hoja alimenta el sistema de credenciales QR de la XVIII Convención de Exportadores.'],
  ['Cada persona recibe un número de credencial (por ejemplo 47P) que va impreso en su sticker y NO cambia nunca.'],
  [''],
  ['✅ SE PUEDE, sin avisar a nadie'],
  ['• Corregir datos: nombre, empresa, cargo, correo, teléfono.'],
  ['• Agregar personas en cualquier fila vacía de las pestañas de inscritos.'],
  ['• Borrar filas.'],
  ['• Mover u ordenar filas, ordenar la tabla, filtrar y ocultar.'],
  ['• Cortar filas y pegarlas en ⛔Anulaciones (esa persona sale de la lista).'],
  ['• Escribir «Diplomado» o «B2B» en OBSERVACIONES de Lista pagados: define la sigla PD o PB.'],
  [''],
  ['⛔ NO SE DEBE'],
  ['• Renombrar pestañas ni encabezados (Nombre, Empresa, Cargo, Correo Electronico, Teléfono, OBSERVACIONES).'],
  ['• Escribir, pegar o borrar en la columna oculta «UID (no editar)».'],
  ['• Editar las pestañas Maestro, Config, Bitácora ni esta.'],
  [''],
  ['ℹ️ BUENO SABER'],
  ['• Las filas que dicen «Por confirmar» no reciben número: son cupos por empresa, no personas.'],
  ['• La columna «Estado del Cliente» no se usa: toda persona con nombre en una pestaña de inscritos cuenta.'],
  ['• Quien desaparece de las pestañas queda como Retirado en el Maestro; su número no se reutiliza.'],
  ['• Después del corte de impresión, los números ya no cambian aunque cambie la observación.'],
  ['• Para ceder un cupo conservando el sticker ya impreso: avisar al responsable (opción «Delegar cupo»).']
];

function asegurarLeeme_(ss, L) {
  var h = ss.getSheetByName(HOJA.LEEME);
  var nueva = !h;
  if (nueva) h = ss.insertSheet(HOJA.LEEME, 0);
  h.clear();
  h.getRange(1, 1, LEEME_TEXTO.length, 1).setValues(LEEME_TEXTO).setWrap(true).setVerticalAlignment('top');
  h.setColumnWidth(1, 900);
  h.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  [6, 14, 19].forEach(function (f) { h.getRange(f, 1).setFontWeight('bold'); });
  if (nueva) {
    protegerSoloPropietario_(h.getRange(1, 1, h.getMaxRows(), h.getMaxColumns()), 'LÉEME');
  }
  L.push(nueva ? '✔ ⚠️ LÉEME creada al inicio del archivo (protegida)' : '✔ ⚠️ LÉEME actualizada');
}
