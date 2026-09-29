/* Lector de registro · XVIII Convención de Exportadores
 * Valida al instante contra el padrón guardado en el teléfono (verde sin esperar al servidor) y confirma
 * con el servidor en segundo plano. Sin señal, los registros quedan en una cola con clientId y se envían
 * al volver la conexión (el servidor no duplica). Solo registra con la clave del lector.
 */
(function () {
  'use strict';
  var API = window.fedexporApi();
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('fx_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('fx_' + k, JSON.stringify(v)); } catch (e) { /* lleno o bloqueado */ } }
  };
  var $ = function (id) { return document.getElementById(id); };
  var sesion = LS.get('sesion', null);          // { lector, clave, master }
  var estado = LS.get('estado', null);          // { modo, abierto, apertura, corte }
  var padron = LS.get('padron', { personas: [], generado: 0 });
  var cola = LS.get('cola', []);                // operaciones pendientes de enviar
  var historial = LS.get('historial', []);      // últimos 20 de este teléfono
  var contador = LS.get('contador', 0);
  var enLinea = navigator.onLine, qr = null, pausado = false, ultimoToken = '', ultimoTiempo = 0, resultadoActual = null;
  var porToken = {}, porUid = {};

  // ------------------------------------------------------------------ utilidades
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); }
  function hora(ms) { var d = new Date(ms || Date.now()); return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
  function indexar() { porToken = {}; porUid = {}; padron.personas.forEach(function (p) { porToken[p.t] = p; porUid[p.u] = p; }); }
  function mostrar(id) { ['vConfig', 'vMain', 'vResultado', 'vBuscar', 'vSitio', 'vHistorial', 'vMas'].forEach(function (v) { $(v).classList.toggle('oculto', v !== id); }); }
  function guardar() { LS.set('cola', cola); LS.set('historial', historial); LS.set('contador', contador); LS.set('padron', padron); LS.set('estado', estado); }

  function post(accion, datos) {
    var cuerpo = Object.assign({ action: accion, lector: sesion && sesion.lector, clave: sesion && sesion.clave }, datos || {});
    // Sin Content-Type explícito: el navegador envía text/plain y no hay preflight CORS (Apps Script no lo maneja).
    return fetch(API.url, { method: 'POST', body: JSON.stringify(cuerpo), redirect: 'follow' })
      .then(function (r) { return r.json(); });
  }

  // ------------------------------------------------------------------ sonido, vibración, pantalla
  var audio = null;
  function tono(frecs, dur) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      frecs.forEach(function (f, i) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = f; o.connect(g); g.connect(audio.destination);
        var t0 = audio.currentTime + i * dur; g.gain.setValueAtTime(0.25, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        o.start(t0); o.stop(t0 + dur);
      });
    } catch (e) { /* sin audio */ }
  }
  function avisar(color) {
    if (color === 'verde') { tono([880, 1320], 0.12); if (navigator.vibrate) navigator.vibrate(120); }
    else { tono([320, 220], 0.22); if (navigator.vibrate) navigator.vibrate([200, 80, 200]); }
  }
  var wake = null;
  function mantenerPantalla() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () { /* no disponible */ });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && sesion) mantenerPantalla(); });

  // ------------------------------------------------------------------ configuración inicial
  function iniciarConfig() {
    mostrar('vConfig');
    $('cEnv').textContent = API.env === 'pruebas' ? 'Entorno: PRUEBAS (hoja ficticia)' : 'Entorno: hoja real';
    $('cEntrar').onclick = function () {
      var lector = $('cLector').value, clave = $('cClave').value.trim();
      if (!lector || !clave) { $('cMsg').textContent = 'Elija el lector y escriba la clave.'; return; }
      $('cMsg').textContent = 'Verificando…';
      sesion = { lector: lector, clave: clave };
      post('login').then(function (r) {
        if (!r.ok) { $('cMsg').textContent = r.mensaje || 'No se pudo entrar'; sesion = null; return; }
        sesion.master = !!r.datos.master; estado = r.datos;
        LS.set('sesion', sesion); guardar();
        iniciarMain();
      }).catch(function () { $('cMsg').textContent = 'Sin conexión. La primera vez se necesita internet.'; sesion = null; });
    };
  }

  // ------------------------------------------------------------------ pantalla principal
  function pintarBarra() {
    var modo = (estado && estado.modo) || 'PRUEBA';
    $('franjaModo').textContent = modo === 'PRUEBA' ? 'MODO PRUEBA' : 'MODO REAL';
    $('franjaModo').className = 'franja ' + (modo === 'PRUEBA' ? 'prueba' : 'real');
    $('hLector').textContent = sesion.lector.replace('MASTER-', 'Máster ');
    $('hConexion').textContent = enLinea ? (cola.length ? 'En línea · enviando ' + cola.length : 'En línea')
      : 'Sin señal · ' + cola.length + ' guardados en el teléfono';
    $('hContador').textContent = contador;
  }

  function iniciarMain() {
    indexar(); mostrar('vMain'); pintarBarra(); mantenerPantalla();
    $('bIniciar').onclick = iniciarCamara;
    $('bBuscar').onclick = abrirBusqueda;
    $('bSitio').onclick = function () { pausar(); mostrar('vSitio'); $('sMsg').textContent = ''; };
    $('bHistorial').onclick = abrirHistorial;
    $('bMas').onclick = abrirMas;
    document.querySelectorAll('.volver').forEach(function (b) { b.onclick = volver; });
    $('sGuardar').onclick = guardarEnSitio;
    actualizarPadron();
    setInterval(actualizarPadron, 60000);
    setInterval(procesarCola, 3000);
  }

  function volver() { mostrar('vMain'); pintarBarra(); reanudar(); }

  function actualizarPadron() {
    if (!navigator.onLine) return;
    post('padron').then(function (r) {
      if (!r.ok) { if (r.codigo === 'CLAVE' || r.codigo === 'SIN_CLAVE') cerrarSesion(r.mensaje); return; }
      // Conserva las llegadas que este teléfono registró y aún no confirmó el servidor.
      var pendientes = {};
      cola.forEach(function (op) { if (op.uid) pendientes[op.uid] = op; });
      padron = r.datos;
      padron.personas.forEach(function (p) { var op = pendientes[p.u]; if (op && !op.prueba && (op.action === 'checkin' || op.action === 'checkin_manual')) { p.ll = true; p.h = hora(op.horaDispositivo); p.l = sesion.lector; } });
      indexar();
      return post('login').then(function (s) { if (s.ok) estado = s.datos; });
    }).then(function () { guardar(); pintarBarra(); }).catch(function () { /* sin señal */ });
  }

  // ------------------------------------------------------------------ cámara
  function iniciarCamara() {
    $('bIniciar').classList.add('oculto');
    qr = new Html5Qrcode('camara');
    qr.start({ facingMode: 'environment' }, { fps: 12, qrbox: function (w, h) { var s = Math.floor(Math.min(w, h) * 0.8); return { width: s, height: s }; } },
      alLeer, function () { /* sin código en este cuadro */ })
      .then(function () {
        try {
          var cap = qr.getRunningTrackCapabilities && qr.getRunningTrackCapabilities();
          if (cap && cap.torch) $('oLinterna').classList.remove('oculto');
        } catch (e) { /* sin linterna */ }
      })
      .catch(function (e) { $('bIniciar').classList.remove('oculto'); alert('No se pudo abrir la cámara. Revise el permiso de cámara del navegador.\n' + e); });
  }
  function pausar() { if (qr && !pausado) { try { qr.pause(true); pausado = true; } catch (e) { /* no iniciado */ } } }
  function reanudar() { if (qr && pausado) { try { qr.resume(); pausado = false; } catch (e) { /* no iniciado */ } } }

  function tokenDe(texto) {
    var t = String(texto || '').trim();
    var m = /[?&]t=([0-9A-Za-z]+)/.exec(t);
    return m ? m[1] : t;
  }

  function alLeer(texto) {
    var token = tokenDe(texto);
    if (token === ultimoToken && Date.now() - ultimoTiempo < 3000) return; // antirrebote: mismo código en 3 s
    ultimoToken = token; ultimoTiempo = Date.now();
    pausar();
    registrar({ token: token }, 'checkin');
  }

  // ------------------------------------------------------------------ registrar (instantáneo + cola)
  function cerradoParaOperador() {
    return estado && estado.modo === 'REAL' && !sesion.master && Date.now() < Number(estado.apertura || 0);
  }

  function registrar(ref, accion, reactivar) {
    if (cerradoParaOperador()) { pantalla('azul', 'PRÓXIMAMENTE INICIA EL EVENTO', null, 'El registro abre a las 07:00'); return; }
    var p = ref.token ? porToken[ref.token] : porUid[ref.uid];
    if (!p) {
      if (!navigator.onLine) { pantalla('amarillo', 'CÓDIGO NO VÁLIDO', null, 'Use la búsqueda manual'); return; }
      // Puede ser alguien agregado después de la última actualización del padrón: se consulta al servidor.
      pantalla('azul', 'Validando…', null, '');
      var cid = uuid();
      post(accion, { token: ref.token, uid: ref.uid, clientId: cid, horaDispositivo: Date.now() }).then(function (r) {
        mostrarRespuesta(r); if (r.ok) { contar(r.datos, 'OK'); actualizarPadron(); }
      }).catch(function () { pantalla('amarillo', 'CÓDIGO NO VÁLIDO', null, 'Sin conexión. Use la búsqueda manual'); });
      return;
    }
    if (p.ret && !reactivar) { pantalla('naranja', 'INSCRIPCIÓN RETIRADA', p, 'Derivar a supervisor', sesion.master ? [{ t: 'Reactivar y registrar', f: function () { registrar(ref, accion, true); } }] : null); return; }
    // En modo PRUEBA el padrón del teléfono solo refleja llegadas reales: los duplicados de prueba los decide el servidor.
    var prueba = estado && estado.modo === 'PRUEBA';
    if (p.ll && !prueba) { pantalla('rojo', 'YA INGRESÓ', p, (p.h ? p.h : '') + (p.l ? ' · ' + p.l.replace('MASTER-', 'Máster ') : '')); return; }
    // Verde de inmediato: el registro queda hecho en el teléfono y se confirma en segundo plano.
    var op = { action: accion, token: p.t, uid: p.u, clientId: uuid(), horaDispositivo: Date.now(), reactivar: !!reactivar, prueba: prueba };
    if (!prueba) { p.ll = true; p.h = hora(op.horaDispositivo); p.l = sesion.lector; }
    cola.push(op); contar(p, 'OK', op.clientId); guardar(); pintarBarra();
    pantalla('verde', reactivar ? 'REACTIVADO' : 'ACCESO CORRECTO', p, '', null, op.clientId);
    procesarCola();
  }

  function contar(p, estadoTxt, clientId) {
    contador++;
    historial.unshift({ u: p.u || p.uid, id: p.id, n: p.n || p.nombre, e: p.e || p.empresa, h: hora(), est: estadoTxt, cid: clientId || '', t: Date.now() });
    historial = historial.slice(0, 20);
    guardar();
  }

  function procesarCola() {
    pintarBarra();
    if (!cola.length || !navigator.onLine || procesarCola.ocupado) return;
    procesarCola.ocupado = true;
    var op = cola[0];
    var datos = Object.assign({}, op); delete datos.action;
    post(op.action, datos).then(function (r) {
      cola.shift(); guardar();
      if (op.action === 'checkin' || op.action === 'checkin_manual') confirmarLlegada(op, r);
    }).catch(function () { /* sigue en la cola */ }).then(function () { procesarCola.ocupado = false; pintarBarra(); if (cola.length && navigator.onLine) setTimeout(procesarCola, 300); });
  }

  /** El servidor contestó: si otro lector ya la había registrado, se corrige la pantalla y el historial. */
  function confirmarLlegada(op, r) {
    var h = historial.filter(function (x) { return x.cid === op.clientId; })[0];
    if (r.ok) { if (h) h.est = 'OK'; guardar(); return; }
    if (h) h.est = r.codigo;
    var p = porUid[op.uid];
    if (op.prueba) { /* simulacro: el padrón no cambia */ }
    else if (r.codigo === 'YA' && r.datos) { if (p) { p.h = r.datos.hora; p.l = r.datos.lector; } }
    else if (p && r.codigo !== 'ERROR') { p.ll = false; }
    guardar();
    if (resultadoActual && resultadoActual.clientId === op.clientId) {
      if (r.codigo === 'YA') pantalla('rojo', 'YA HABÍA INGRESADO', p || r.datos, (r.datos ? r.datos.hora + ' · ' + String(r.datos.lector).replace('MASTER-', 'Máster ') : ''));
      else if (r.codigo === 'RETIRADO') pantalla('naranja', 'INSCRIPCIÓN RETIRADA', p, 'Derivar a supervisor');
      else if (r.codigo === 'INVALIDO') pantalla('amarillo', 'CÓDIGO NO VÁLIDO', null, 'Use la búsqueda manual');
      else if (r.codigo === 'CERRADO') pantalla('azul', 'PRÓXIMAMENTE INICIA EL EVENTO', null, '');
      avisar('rojo');
    }
  }

  function mostrarRespuesta(r) {
    var d = r.datos;
    if (r.ok) pantalla('verde', 'ACCESO CORRECTO', d ? { id: d.id, n: d.nombre, e: d.empresa, tp: d.tipo, cupo: d.cupo, sm: d.stickerMano, u: d.uid } : null, '');
    else if (r.codigo === 'YA') pantalla('rojo', 'YA INGRESÓ', d && { id: d.id, n: d.nombre, e: d.empresa, tp: d.tipo }, d ? d.hora + ' · ' + d.lector : '');
    else if (r.codigo === 'RETIRADO') pantalla('naranja', 'INSCRIPCIÓN RETIRADA', d && { id: d.id, n: d.nombre, e: d.empresa, tp: d.tipo }, 'Derivar a supervisor');
    else if (r.codigo === 'CERRADO') pantalla('azul', 'PRÓXIMAMENTE INICIA EL EVENTO', null, '');
    else pantalla('amarillo', 'CÓDIGO NO VÁLIDO', null, r.mensaje || 'Use la búsqueda manual');
  }

  // ------------------------------------------------------------------ pantalla de resultado
  function pantalla(color, titulo, p, detalle, extras, clientId) {
    resultadoActual = { color: color, p: p, clientId: clientId || '' };
    mostrar('vResultado');
    var v = $('vResultado'); v.className = 'vista resultado ' + color;
    $('rTitulo').textContent = titulo;
    var etiquetas = [];
    if (p && p.sm) etiquetas.push('STICKER A MANO');
    if (p && p.cupo) etiquetas.push('CUPO SIN NOMBRE · ANOTAR NOMBRE');
    $('rEtiqueta').textContent = etiquetas.join(' · ');
    $('rEtiqueta').classList.toggle('oculto', !etiquetas.length);
    $('rId').textContent = p ? (p.id || '') : '';
    $('rNombre').textContent = p ? (p.n || '') : '';
    $('rEmpresa').textContent = p ? (p.e || '') : '';
    $('rTipo').textContent = p ? (p.tp || '') : '';
    $('rDetalle').textContent = detalle || '';
    var b = $('rBotones'); b.innerHTML = '';
    function boton(t, f, principal) { var x = document.createElement('button'); x.textContent = t; x.onclick = f; if (principal) x.className = 'principal'; b.appendChild(x); }
    if (titulo !== 'Validando…') boton('Continuar', volver, true);
    if (color === 'verde' && p) {
      if (p.cupo) boton('Anotar nombre del invitado', function () { anotar(p, 'nombre_cupo', 'Nombre de la persona que usa este cupo:'); });
      boton('Deshacer', function () { deshacer(p, clientId); });
      boton('Observación', function () { anotar(p, 'observacion', 'Observación:'); });
    }
    if (color === 'amarillo') boton('Búsqueda manual', abrirBusqueda);
    (extras || []).forEach(function (x) { boton(x.t, x.f); });
    if (titulo !== 'Validando…') avisar(color === 'verde' ? 'verde' : 'rojo');
  }

  function anotar(p, accion, pregunta) {
    var texto = prompt(pregunta);
    if (!texto || !texto.trim()) return;
    cola.push({ action: accion, uid: p.u, texto: texto.trim(), clientId: uuid() }); guardar(); procesarCola();
    $('rDetalle').textContent = accion === 'nombre_cupo' ? 'Nombre anotado: ' + texto.trim() : 'Observación guardada';
  }

  function deshacer(p, clientId) {
    if (!confirm('¿Deshacer el ingreso de ' + (p.id || '') + '?')) return;
    // Si todavía no salió del teléfono, basta con sacarlo de la cola.
    var i = cola.findIndex(function (op) { return op.clientId === clientId; });
    p.ll = false; p.h = ''; p.l = '';
    if (i !== -1) { cola.splice(i, 1); marcarDeshecho(clientId); guardar(); volver(); return; }
    post('deshacer', { uid: p.u }).then(function (r) {
      if (!r.ok) { alert(r.mensaje); p.ll = true; return; }
      marcarDeshecho(clientId); guardar(); volver();
    }).catch(function () { alert('Sin conexión: no se pudo deshacer. Intente de nuevo con señal.'); p.ll = true; });
  }
  function marcarDeshecho(clientId) { historial.forEach(function (h) { if (h.cid === clientId) h.est = 'DESHECHO'; }); contador = Math.max(0, contador - 1); }

  // ------------------------------------------------------------------ búsqueda manual
  function abrirBusqueda() {
    pausar(); mostrar('vBuscar'); $('qTexto').value = ''; $('qLista').innerHTML = ''; $('qTexto').focus();
    $('qTexto').oninput = function () {
      var q = norm($('qTexto').value);
      var ul = $('qLista'); ul.innerHTML = '';
      if (q.length < 2) return;
      padron.personas.filter(function (p) { return norm(p.n + ' ' + p.e + ' ' + p.id).indexOf(q) !== -1; }).slice(0, 40).forEach(function (p) {
        var li = document.createElement('li'); if (p.ll) li.className = 'llego';
        li.innerHTML = '<span class="id"></span><span style="flex:1"><div class="t"></div><div class="s"></div></span>';
        li.querySelector('.id').textContent = p.id;
        li.querySelector('.t').textContent = p.n;
        li.querySelector('.s').textContent = (p.e || '') + (p.ret ? ' · RETIRADO' : '') + (p.ll ? ' · ingresó ' + p.h : '');
        li.onclick = function () { if (confirm('¿Registrar el ingreso de ' + p.id + ' — ' + p.n + '?')) registrar({ uid: p.u }, 'checkin_manual'); };
        ul.appendChild(li);
      });
    };
  }

  // ------------------------------------------------------------------ registro en sitio
  function guardarEnSitio() {
    var d = { nombre: $('sNombre').value.trim(), empresa: $('sEmpresa').value.trim(), cargo: $('sCargo').value.trim(),
      correo: $('sCorreo').value.trim(), celular: $('sCelular').value.trim(), clientId: uuid() };
    if (!d.nombre || !d.empresa) { $('sMsg').textContent = 'Nombre y empresa son obligatorios.'; return; }
    if (!navigator.onLine) { $('sMsg').textContent = 'El registro en sitio necesita señal: asigna el número en el servidor.'; return; }
    $('sMsg').textContent = 'Registrando…';
    post('en_sitio', d).then(function (r) {
      if (!r.ok) { $('sMsg').textContent = r.mensaje; return; }
      ['sNombre', 'sEmpresa', 'sCargo', 'sCorreo', 'sCelular'].forEach(function (x) { $(x).value = ''; });
      contar({ u: r.datos.uid, id: r.datos.id, n: r.datos.nombre, e: r.datos.empresa }, 'OK', d.clientId);
      pantalla('verde', 'REGISTRADO EN SITIO', { id: r.datos.id, n: r.datos.nombre, e: r.datos.empresa, tp: r.datos.tipo, sm: true, u: r.datos.uid }, 'Escriba el sticker a mano');
      actualizarPadron();
    }).catch(function () { $('sMsg').textContent = 'Sin conexión. Intente de nuevo.'; });
  }

  // ------------------------------------------------------------------ historial y opciones
  function abrirHistorial() {
    pausar(); mostrar('vHistorial');
    var ul = $('hLista'); ul.innerHTML = '';
    if (!historial.length) ul.innerHTML = '<li>Sin registros todavía.</li>';
    historial.forEach(function (h) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="id"></span><span style="flex:1"><div class="t"></div><div class="s"></div></span>';
      li.querySelector('.id').textContent = h.id || '';
      li.querySelector('.t').textContent = h.n || '';
      li.querySelector('.s').textContent = h.h + ' · ' + ({ OK: 'registrado', YA: 'ya había ingresado', DESHECHO: 'deshecho', INVALIDO: 'no válido' }[h.est] || h.est);
      ul.appendChild(li);
    });
  }

  function abrirMas() {
    pausar(); mostrar('vMas');
    $('oInfo').textContent = 'Padrón: ' + padron.personas.length + ' personas · actualizado ' + (padron.generado ? hora(padron.generado) : '—') +
      ' · entorno ' + (API.env === 'pruebas' ? 'PRUEBAS' : 'real');
    $('oActualizar').onclick = function () { actualizarPadron(); alert('Actualizando…'); };
    $('oLinterna').onclick = function () {
      try { var on = !$('oLinterna').dataset.on; qr.applyVideoConstraints({ advanced: [{ torch: on }] }); $('oLinterna').dataset.on = on ? '1' : ''; } catch (e) { alert('Linterna no disponible'); }
    };
    $('oModo').classList.toggle('oculto', !sesion.master);
    $('oModo').textContent = 'Cambiar a modo ' + ((estado && estado.modo) === 'REAL' ? 'PRUEBA' : 'REAL');
    $('oModo').onclick = function () {
      var nuevo = (estado && estado.modo) === 'REAL' ? 'PRUEBA' : 'REAL';
      if (!confirm('¿Cambiar TODOS los lectores a modo ' + nuevo + '?')) return;
      post('modo', { modo: nuevo }).then(function (r) { if (!r.ok) { alert(r.mensaje); return; } estado = r.datos; guardar(); actualizarPadron(); volver(); })
        .catch(function () { alert('Sin conexión'); });
    };
    $('oSalir').onclick = function () {
      if (cola.length && !confirm('Hay ' + cola.length + ' registros sin enviar. Si cierra la sesión se perderán. ¿Cerrar igual?')) return;
      cerrarSesion('');
    };
  }

  function cerrarSesion(msg) {
    try { ['sesion', 'estado', 'padron', 'cola', 'historial', 'contador'].forEach(function (k) { localStorage.removeItem('fx_' + k); }); } catch (e) { /* sin almacenamiento */ }
    location.reload();
    if (msg) alert(msg);
  }

  window.addEventListener('online', function () { enLinea = true; pintarBarra(); procesarCola(); actualizarPadron(); });
  window.addEventListener('offline', function () { enLinea = false; pintarBarra(); });

  if (sesion) iniciarMain(); else iniciarConfig();
})();
