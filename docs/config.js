// Direcciones del Web App de Apps Script. No son secretas: toda escritura exige la clave del lector.
window.FEDEXPOR = {
  api: {
    real: '',  // se completa al pasar la etapa 4 a producción
    pruebas: 'https://script.google.com/macros/s/AKfycbyDrvSLTjgB-XlzYDJRZ77TX30QCYerS-wq93U91FkyKiBuVWH857XHla0GGxM2WwOi/exec'
  },
  evento: {
    nombre: 'XVIII Convención de Exportadores',
    fecha: 'Miércoles 30 de septiembre de 2026',
    hora: '08:30',
    lugar: 'Quito, JW Marriott',
    agenda: 'https://fedexporacademy.my.canva.site/convencionxviii/agenda#page-5'
  }
};

// Entorno: ?env=pruebas en la URL, o el guardado en el teléfono. Por defecto, el real si ya existe.
window.fedexporApi = function () {
  var q = new URLSearchParams(location.search).get('env');
  var guardado = null;
  try { guardado = localStorage.getItem('fx_env'); } catch (e) { /* sin almacenamiento */ }
  var env = q || guardado || (window.FEDEXPOR.api.real ? 'real' : 'pruebas');
  if (q) { try { localStorage.setItem('fx_env', q); } catch (e) { /* sin almacenamiento */ } }
  return { env: env, url: window.FEDEXPOR.api[env] || window.FEDEXPOR.api.pruebas };
};
