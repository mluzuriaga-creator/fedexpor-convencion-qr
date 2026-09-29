/**
 * Identificadores.
 *  - UID: interno, aleatorio (u_xxxxxxxxxx). Llave entre pestaña origen y Maestro.
 *  - ID de credencial: número + sigla (47P). Se asigna una vez; el número nunca se reutiliza.
 *  - Token: 24 caracteres base62 aleatorios. Es lo único que va en el QR.
 */

var ALFABETO_62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
var ALFABETO_36 = '0123456789abcdefghijklmnopqrstuvwxyz';
var PREFIJO_CONTADOR = 'CONTADOR_';

/** Cadena aleatoria sin sesgo: SHA-256 de tres UUID v4 y muestreo por rechazo. */
function aleatorio_(n, alfabeto) {
  var out = '';
  var limite = 256 - (256 % alfabeto.length);
  while (out.length < n) {
    var semilla = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, semilla);
    for (var i = 0; i < bytes.length && out.length < n; i++) {
      var x = (bytes[i] + 256) % 256;
      if (x < limite) out += alfabeto.charAt(x % alfabeto.length);
    }
  }
  return out;
}

function nuevoUid_() { return 'u_' + aleatorio_(10, ALFABETO_36); }
function nuevoToken_() { return aleatorio_(24, ALFABETO_62); }

function parsearId_(id) {
  var m = /^(\d+)([A-Z]+)$/.exec(String(id == null ? '' : id).trim());
  return m ? { numero: Number(m[1]), sigla: m[2] } : null;
}

/**
 * Asignador de números por sigla. Parte del mayor entre el contador guardado en
 * Script Properties y cualquier número presente en el Maestro (ID actual o IDs anteriores),
 * así un número nunca se reutiliza aunque se pierda una propiedad.
 */
function crearAsignadorIds_(filasMaestro) {
  var props = PropertiesService.getScriptProperties().getProperties();
  var max = {};
  Object.keys(props).forEach(function (k) {
    if (k.indexOf(PREFIJO_CONTADOR) === 0) max[k.slice(PREFIJO_CONTADOR.length)] = Number(props[k]) || 0;
  });
  function considerar(id) {
    var p = parsearId_(id);
    if (p && p.numero > (max[p.sigla] || 0)) max[p.sigla] = p.numero;
  }
  filasMaestro.forEach(function (r) {
    considerar(r[M.ID]);
    String(r[M.IDS_ANT] || '').split(',').forEach(function (x) { considerar(x.trim()); });
  });
  var usados = {};
  return {
    siguiente: function (sigla) {
      max[sigla] = (max[sigla] || 0) + 1;
      usados[sigla] = true;
      return max[sigla] + sigla;
    },
    /** Solo las siglas que avanzaron en esta pasada. */
    propiedades: function () {
      var p = {};
      Object.keys(usados).forEach(function (s) { p[PREFIJO_CONTADOR + s] = String(max[s]); });
      return p;
    }
  };
}
