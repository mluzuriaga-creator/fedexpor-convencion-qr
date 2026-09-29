/**
 * QR → PNG dentro de Apps Script (sin servicios externos).
 * Corrección de error H (admite ~30 % de daño: deja espacio para el isotipo al centro)
 * y margen blanco de 4 módulos. PNG en escala de grises de 1 bit.
 */

var QR_MARGEN_MODULOS = 4;

/** URL que codifica el QR: solo el token, nunca ID, nombre ni correo. */
function urlQr_(cfg, token) {
  var base = String(cfg.valores.URL_PUBLICA_BASE || '').replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) throw new Error('Config: URL_PUBLICA_BASE debe empezar con https://');
  if (!/^[0-9A-Za-z]{20,}$/.test(String(token || ''))) throw new Error('Token inválido');
  return base + '/c/?t=' + token;
}

function qrMatriz_(texto) {
  var q = qrcode(0, 'H');
  q.addData(texto, 'Byte');
  q.make();
  var n = q.getModuleCount();
  return { n: n, oscuro: function (r, c) { return q.isDark(r, c); } };
}

/** Devuelve los bytes (0–255) de un PNG de lado ≈ `ladoPx` con el QR de `texto`. */
function qrPngBytes_(texto, ladoPx) {
  var m = qrMatriz_(texto);
  var total = m.n + 2 * QR_MARGEN_MODULOS;
  var escala = Math.max(1, Math.floor((ladoPx || 600) / total));
  var lado = total * escala;
  var bytesFila = Math.ceil(lado / 8);

  // Filas crudas: byte de filtro 0 + bits (1 = blanco, 0 = negro).
  var crudo = [];
  for (var y = 0; y < lado; y++) {
    crudo.push(0);
    var mr = Math.floor(y / escala) - QR_MARGEN_MODULOS;
    for (var b = 0; b < bytesFila; b++) {
      var byte = 0;
      for (var k = 0; k < 8; k++) {
        var x = b * 8 + k;
        var blanco = 1;
        if (x < lado) {
          var mc = Math.floor(x / escala) - QR_MARGEN_MODULOS;
          if (mr >= 0 && mc >= 0 && mr < m.n && mc < m.n && m.oscuro(mr, mc)) blanco = 0;
        }
        byte = (byte << 1) | blanco;
      }
      crudo.push(byte);
    }
  }

  var png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  var ihdr = [].concat(u32_(lado), u32_(lado), [1, 0, 0, 0, 0]); // 1 bit, escala de grises
  pngChunk_(png, 'IHDR', ihdr);
  pngChunk_(png, 'IDAT', zlibSinComprimir_(crudo));
  pngChunk_(png, 'IEND', []);
  return { bytes: png, lado: lado, modulos: m.n };
}

function qrPngBlob_(texto, ladoPx, nombre) {
  var r = qrPngBytes_(texto, ladoPx);
  var firmados = r.bytes.map(function (b) { return b > 127 ? b - 256 : b; });
  return Utilities.newBlob(firmados, 'image/png', nombre || 'qr.png');
}

function u32_(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }

function pngChunk_(salida, tipo, datos) {
  var t = tipo.split('').map(function (ch) { return ch.charCodeAt(0); });
  var crc = crc32_(t.concat(datos));
  Array.prototype.push.apply(salida, u32_(datos.length));
  Array.prototype.push.apply(salida, t);
  for (var i = 0; i < datos.length; i += 32768) Array.prototype.push.apply(salida, datos.slice(i, i + 32768));
  Array.prototype.push.apply(salida, u32_(crc));
}

/** Flujo zlib con bloques «stored» (sin compresión): simple y exacto. */
function zlibSinComprimir_(datos) {
  var out = [0x78, 0x01];
  var MAX = 65535;
  for (var i = 0; i < datos.length || i === 0; i += MAX) {
    var bloque = datos.slice(i, i + MAX);
    var final = i + MAX >= datos.length ? 1 : 0;
    var len = bloque.length, nlen = (~len) & 0xFFFF;
    out.push(final, len & 255, (len >>> 8) & 255, nlen & 255, (nlen >>> 8) & 255);
    for (var j = 0; j < bloque.length; j += 32768) Array.prototype.push.apply(out, bloque.slice(j, j + 32768));
    if (!datos.length) break;
  }
  var a = 1, b = 0;
  for (var k = 0; k < datos.length; k++) { a = (a + datos[k]) % 65521; b = (b + a) % 65521; }
  Array.prototype.push.apply(out, u32_(((b << 16) | a) >>> 0));
  return out;
}

var TABLA_CRC_ = null;
function crc32_(bytes) {
  if (!TABLA_CRC_) {
    TABLA_CRC_ = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      TABLA_CRC_[n] = c >>> 0;
    }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) crc = TABLA_CRC_[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
