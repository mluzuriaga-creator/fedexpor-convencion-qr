/**
 * Configuración: pestaña Config (clave/valor) + constantes de estructura.
 * Los secretos NO van aquí: viven en Script Properties.
 */

var ZONA_HORARIA = 'America/Guayaquil';

var HOJA = {
  CONFIG: 'Config',
  MAESTRO: 'Maestro',
  BITACORA: 'Bitácora',
  PRUEBAS: 'Pruebas',
  COLA: 'ColaCorreos',
  REENVIOS: 'Reenvíos',
  LEEME: '⚠️ LÉEME',
  STICKERS: 'Stickers'
};

/** Encabezados que se buscan en cada pestaña origen, por texto. */
var ENC = {
  nombre: 'Nombre',
  empresa: 'Empresa',
  cargo: 'Cargo',
  correo: 'Correo Electronico',
  telefono: 'Teléfono',
  uid: 'UID (no editar)'
};

var CONFIG_ENCABEZADOS = ['Clave', 'Valor', 'Nota'];

var CONFIG_INICIAL = [
  ['ORIGEN', 'Lista pagados | P | 14 | Pagado',
    'Pestaña origen: nombre exacto | sigla | fila de encabezado esperada | tipo. Una fila por pestaña, en el orden de los stickers.'],
  ['ORIGEN', 'SUMARSE | S | 14 | Proyecto Sumarse', ''],
  ['ORIGEN', 'AUSPICIANTES | A | 14 | Auspiciante', ''],
  ['ORIGEN', 'EXPOSITORES | E | 14 | Expositor', ''],
  ['ORIGEN', 'OTROS | OT | 14 | Otros', ''],
  ['ORIGEN', 'Registro en sitio | NR | 14 | Registro en sitio', ''],
  ['SUBCATEGORIA', 'Lista pagados | OBSERVACIONES | diplomado | PD | Pagado · Diplomado',
    'pestaña | encabezado donde buscar | palabra clave | sigla | tipo. Si coinciden dos palabras, queda la sigla base con alerta.'],
  ['SUBCATEGORIA', 'Lista pagados | OBSERVACIONES | b2b | PB | Pagado · B2B', ''],
  ['CUPO', 'AUSPICIANTES | AUSPICIANTE',
    'pestaña | columna del dueño del cupo. Fila con dueño y sin nombre (o «Por confirmar», o nombre que empieza con el del dueño) = cupo: recibe ID y QR como «Invitado N de DUEÑO».'],
  ['CUPO', 'SUMARSE | Empresa', ''],
  ['ALERTA_OBSERVACION', 'AUSPICIANTES | OBSERVACIONES | revisar | Revisar: excede cupo del auspiciante',
    'pestaña | encabezado | palabra | texto de la alerta. Solo avisa; no cambia el ID.'],
  ['ENTREGA_POR_DUENO', 'AUSPICIANTES', 'Pestañas cuyas credenciales NO van por correo ni WhatsApp: se exportan en una carpeta por dueño (auspiciante).'],
  ['PESTANAS_A_CREAR', 'OTROS | Registro en sitio',
    '«Instalar / reparar estructura» crea estas pestañas solo si no existen, duplicando la plantilla.'],
  ['PLANTILLA_PESTANA_NUEVA', 'AUSPICIANTES', 'Pestaña que se duplica para crear las de PESTANAS_A_CREAR.'],
  ['ENVIOS_HABILITADOS', 'NO', 'Interruptor maestro de correos. Solo el responsable lo cambia, desde el menú.'],
  ['BIENVENIDA_AUTOMATICA', 'NO', 'Interruptor de la bienvenida al registrar ingreso. Independiente del maestro.'],
  ['MODO', 'PRUEBA', 'PRUEBA o REAL. Lo cambia un lector máster.'],
  ['CORTE_IMPRESION', 'NO', 'Lo fija el menú «Marcar corte de impresión». Después del corte los ID no se reasignan.'],
  ['CORTE_FECHA', '', 'La escribe el sistema.'],
  ['MAX_RETIROS_SIN_CONFIRMAR', '5', 'Si más personas que esto pasan a Retirado en una sincronización, se pide confirmación.'],
  ['FILAS_BUSQUEDA_ENCABEZADO', '40', 'Se busca la fila con el encabezado «Nombre» dentro de estas primeras filas.'],
  ['RESPALDOS_A_CONSERVAR', '20', 'Respaldos del Maestro en Drive antes de cada sincronización.'],
  ['CARPETA_RESPALDOS_ID', '', 'La crea el sistema.'],
  ['ULTIMA_SINCRONIZACION', '', 'La escribe el sistema.'],
  ['EVENTO_NOMBRE', 'XVIII Convención de Exportadores', ''],
  ['EVENTO_FECHA', 'Miércoles 30 de septiembre de 2026', 'Texto largo para correos.'],
  ['EVENTO_HORA', '08:30', ''],
  ['EVENTO_LUGAR', 'Quito, JW Marriott', 'Como en la línea gráfica oficial.'],
  ['CREDENCIAL_FECHA', '30 de Septiembre · 08:30', 'Línea junto al ícono de calendario en la credencial.'],
  ['CREDENCIAL_TEXTO', 'Bienvenido/a', 'Texto institucional sobre el nombre.'],
  ['CREDENCIAL_FORMATO_NOMBRE', 'PROPIO', 'PROPIO («Alirio del Jesus»), TAL_CUAL o MAYUSCULAS. Solo afecta a la credencial, no a la hoja.'],
  ['TIPO_CREDENCIAL', 'P=Participante | PD=Diplomado | PB=B2B | S=Proyecto Sumarse | A=Auspiciante | E=Expositor | OT=Otros | NR=Registro en sitio',
    'Etiqueta dorada de la credencial, por sigla.'],
  ['URL_PUBLICA_BASE', 'https://mluzuriaga-creator.github.io/fedexpor-convencion-qr', 'El QR abre URL_PUBLICA_BASE/c/?t=TOKEN. No cambiar después de enviar credenciales.'],
  ['CARPETA_RECURSOS', 'Recursos credencial · XVIII Convención', 'Carpeta de Drive con fondo-credencial.png e isotipo-x.png.'],
  ['CARPETA_CREDENCIALES_ID', '', 'La crea el sistema.'],
  ['PLANTILLA_CREDENCIAL_ID', '', 'La crea «Credenciales → Crear plantilla».'],
  ['GENERACION_ESTADO', '', 'Avance de la generación de credenciales. Lo escribe el sistema.'],
  ['CARPETA_ENTREGA_ID', '', 'Carpeta «Credenciales por auspiciante». La crea el sistema.'],
  ['EVENTO_APERTURA_REGISTRO', '07:00', 'Hora en que abre la mesa de registro (los operadores no registran antes, salvo en modo PRUEBA).'],
  ['EVENTO_FECHA_ISO', '2026-09-30', 'Fecha del evento (AAAA-MM-DD) para la hora de apertura del lector.'],
  ['PRUEBA_VERSION', '1', 'La cambia «Limpiar pruebas del lector».'],
  ['URL_AGENDA', 'https://fedexporacademy.my.canva.site/convencionxviii/agenda#page-5', 'Link de la agenda (micrositio de Canva).'],
  ['REMITENTE_NOMBRE', 'Fedexpor', 'Nombre visible del remitente. Los correos salen desde la cuenta que ejecuta el menú.'],
  ['CORREO_PRUEBAS', '', 'Recibe el correo de prueba (datos ficticios). Vacío = la cuenta que envía.'],
  ['CORREO_ASUNTO_CREDENCIAL', 'Su credencial · XVIII Convención de Exportadores', ''],
  ['CORREO_ASUNTO_RECORDATORIO', 'Recordatorio · XVIII Convención de Exportadores · 30 de septiembre', ''],
  ['CORREO_INDICACIONES_LLEGADA', 'Le recomendamos llegar con anticipación: el evento inicia a las 08:30. Presente su código QR desde su celular; no es necesario imprimirlo.', 'Párrafo del recordatorio.'],
  ['WHATSAPP_MENSAJE', 'Estimado/a {NOMBRE}: le compartimos su credencial para la XVIII Convención de Exportadores de Fedexpor, el {FECHA} a las {HORA} en {LUGAR}. Credencial: {CREDENCIAL} · Agenda: {AGENDA}. Preséntela en la mesa de registro desde su celular.', 'Texto de los links de WhatsApp. Marcadores: {NOMBRE} {FECHA} {HORA} {LUGAR} {CREDENCIAL} {AGENDA}.']
];

function leerConfig_(ss) {
  var hoja = ss.getSheetByName(HOJA.CONFIG);
  if (!hoja) throw new Error('Falta la pestaña Config. Ejecute «Fedexpor QR → Instalar / reparar estructura».');
  var v = hoja.getDataRange().getDisplayValues();
  var cfg = { valores: {}, origenes: [], subcategorias: [], cupos: [], alertasObs: [], ordenSiglas: [], tipoPorSigla: {} };
  var errores = [];

  for (var i = 1; i < v.length; i++) {
    var clave = String(v[i][0]).trim();
    var valor = String(v[i][1]).trim();
    if (!clave) continue;
    if (clave === 'ORIGEN') {
      var p = valor.split('|').map(function (x) { return x.trim(); });
      if (p.length < 4 || !p[0] || !p[1]) { errores.push('Config fila ' + (i + 1) + ': ORIGEN mal escrito'); continue; }
      cfg.origenes.push({ hoja: p[0], sigla: p[1].toUpperCase(), filaEncabezado: Number(p[2]) || 0, tipo: p[3], subcategorias: [] });
    } else if (clave === 'CUPO') {
      var cp = valor.split('|').map(function (x) { return x.trim(); });
      if (cp.length < 2 || !cp[0] || !cp[1]) { errores.push('Config fila ' + (i + 1) + ': CUPO mal escrito'); continue; }
      cfg.cupos.push({ hoja: cp[0], columna: cp[1] });
    } else if (clave === 'ALERTA_OBSERVACION') {
      var ao = valor.split('|').map(function (x) { return x.trim(); });
      if (ao.length < 4 || !ao[0] || !ao[1] || !ao[2] || !ao[3]) { errores.push('Config fila ' + (i + 1) + ': ALERTA_OBSERVACION mal escrita'); continue; }
      cfg.alertasObs.push({ hoja: ao[0], encabezado: ao[1], palabra: compacto_(ao[2]), texto: ao[3] });
    } else if (clave === 'SUBCATEGORIA') {
      var q = valor.split('|').map(function (x) { return x.trim(); });
      if (q.length < 5 || !q[0] || !q[1] || !q[2] || !q[3]) { errores.push('Config fila ' + (i + 1) + ': SUBCATEGORIA mal escrita'); continue; }
      cfg.subcategorias.push({ hoja: q[0], encabezado: q[1], palabra: compacto_(q[2]), sigla: q[3].toUpperCase(), tipo: q[4] });
    } else {
      cfg.valores[clave] = valor;
    }
  }

  if (!cfg.origenes.length) errores.push('Config no declara ninguna pestaña ORIGEN');

  var siglas = {};
  function registrarSigla(s, tipo) {
    if (!/^[A-Z]{1,3}$/.test(s)) errores.push('Sigla inválida en Config: "' + s + '"');
    if (siglas[s]) errores.push('Sigla repetida en Config: "' + s + '"');
    siglas[s] = true;
    cfg.ordenSiglas.push(s);
    cfg.tipoPorSigla[s] = tipo;
  }
  cfg.origenes.forEach(function (o) {
    registrarSigla(o.sigla, o.tipo);
    cfg.subcategorias.forEach(function (sc) {
      if (sc.hoja === o.hoja) { o.subcategorias.push(sc); registrarSigla(sc.sigla, sc.tipo); }
    });
  });
  cfg.origenes.forEach(function (o) {
    o.cupo = cfg.cupos.filter(function (c) { return c.hoja === o.hoja; })[0] || null;
    o.alertasObs = cfg.alertasObs.filter(function (a) { return a.hoja === o.hoja; });
  });
  cfg.textosAlertasObs = cfg.alertasObs.map(function (a) { return a.texto; });
  cfg.entregaPorDueno = String(cfg.valores.ENTREGA_POR_DUENO || '').split('|').map(function (x) { return x.trim(); }).filter(String);
  cfg.subcategorias.forEach(function (sc) {
    var existe = cfg.origenes.some(function (o) { return o.hoja === sc.hoja; });
    if (!existe) errores.push('SUBCATEGORIA apunta a una pestaña no declarada: "' + sc.hoja + '"');
  });

  if (errores.length) throw new Error('Config inválida:\n• ' + errores.join('\n• '));

  cfg.corte = compacto_(cfg.valores.CORTE_IMPRESION) === 'si';
  cfg.maxRetiros = Number(cfg.valores.MAX_RETIROS_SIN_CONFIRMAR) || 5;
  cfg.filasBusqueda = Number(cfg.valores.FILAS_BUSQUEDA_ENCABEZADO) || 40;
  cfg.respaldos = Number(cfg.valores.RESPALDOS_A_CONSERVAR) || 20;
  cfg.tipoCredencial = {};
  String(cfg.valores.TIPO_CREDENCIAL || '').split('|').forEach(function (par) {
    var kv = par.split('=');
    if (kv.length === 2 && kv[0].trim()) cfg.tipoCredencial[kv[0].trim().toUpperCase()] = kv[1].trim();
  });
  cfg.pestanasACrear = String(cfg.valores.PESTANAS_A_CREAR || '').split('|')
    .map(function (x) { return x.trim(); }).filter(String);
  return cfg;
}

/** Escribe un valor en Config (crea la clave si no existe). Una sola celda: no se usa en bucles. */
function escribirConfig_(ss, clave, valor) {
  var hoja = ss.getSheetByName(HOJA.CONFIG);
  var claves = hoja.getRange(1, 1, Math.max(hoja.getLastRow(), 1), 1).getValues();
  for (var i = 0; i < claves.length; i++) {
    if (String(claves[i][0]).trim() === clave) { hoja.getRange(i + 1, 2).setValue(valor); return; }
  }
  hoja.appendRow([clave, valor, '']);
}
