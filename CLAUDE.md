# Sistema de credenciales QR · XVIII Convención de Exportadores (Fedexpor)

Lee `SPEC.md` completo antes de escribir código. Este archivo son las reglas que no se negocian.

## Contexto

Evento de ~300 personas el miércoles 30 de septiembre, 08:30, Hotel Marriott, Quito.
Registro abre 07:00. Dos mesas, cuatro lectores, una sola entrada.
Hoy es **domingo 27**. El cierre de la lista es el **lunes 28 a las 12:00** y los stickers se imprimen ese día con los números que asigna el sistema. **No hay margen para rehacer cosas.**

## Stack

- Google Sheets + Apps Script (Workspace institucional), desplegado con `clasp`
- Frontend estático en GitHub Pages: lector, panel, página pública del QR, recuperación
- Brevo para correo transaccional
- Drive para las credenciales PNG

## Reglas que no se rompen

1. **El ID de credencial es inmutable.** Se asigna una vez (`47P`) y queda ligado a la persona aunque cambien todos sus datos. Nunca se reutiliza un número, ni tras una cancelación.
2. **El QR contiene un token aleatorio**, nunca el ID, el nombre ni el correo.
3. **Solo los lectores con clave válida pueden registrar llegadas.** Escanear el QR con la cámara normal abre una página informativa que no escribe nada.
4. **En el Maestro nada se borra.** Toda acción va a la Bitácora. En las pestañas origen los editores SÍ borran, mueven y cortan filas: el sistema debe absorberlo.
5. **Sin cédula** en ninguna parte del sistema (LOPDP Ecuador).
6. **El script nunca reordena ni borra nada en las pestañas origen.** Solo lee y escribe la columna UID.
7. **Toda escritura usa `LockService`** y es idempotente por `clientId`. Cuatro lectores escriben en paralelo.
8. **El lector nunca espera un correo.** La bienvenida va a una cola procesada por trigger.
9. **Secretos en Script Properties**, jamás en la hoja ni en el repositorio.
10. **Lectura y escritura por lotes** (`getValues`/`setValues`). Nunca celda por celda en bucles.
11. **NINGÚN ENVÍO AUTOMÁTICO POR FECHA.** No crear triggers de tiempo para correos ni WhatsApp. Todo sale solo cuando el responsable lo ejecuta desde el menú.
12. **Interruptor maestro `ENVIOS_HABILITADOS` en Config, valor inicial `NO`.** Con `NO`, toda ruta de envío se rechaza y lo registra. Ningún camino del código puede saltárselo.
13. **Confirmación obligatoria** antes de cualquier envío masivo: mostrar cuántos, a quiénes y quiénes quedan fuera.
14. **Segundo interruptor `BIENVENIDA_AUTOMATICA`, también `NO` por defecto**, independiente del maestro. Controla solo el correo que dispara el check-in.
15. **Los links de WhatsApp se generan en lote desde el menú.** Nunca fila por fila ni dentro de la sincronización.
16. **Lista blanca de pestañas.** Leer solo las declaradas en `PESTANAS_ORIGEN`. Jamás iterar todas las hojas del archivo: existe una pestaña **Anulaciones** que debe ignorarse siempre, y puede haber otras hojas de trabajo.
17. **Todo vive en el Workspace institucional de Fedexpor:** hoja, Apps Script, despliegue web y carpeta de Drive. Nunca en una cuenta personal.
18. **Los encabezados NO están en la fila 1.** Están en la fila 14 y los datos empiezan en la 15. Las filas 1–13 son un tablero con fórmulas que no se toca. La fila de encabezado se declara por pestaña en Config.
19. **Localizar columnas por el texto del encabezado**, nunca por índice fijo. Si falta un encabezado esperado, abortar y reportar.
20. **Ignorar siempre:** `CI` (cédula), `N` (correlativo interno), `Estado del Cliente`, `ASISTENCIA 28/29/30 JULIO`, `ENVÍO DE BIENVENIDA`, `WPP`. Son de eventos anteriores, datos sensibles o irrelevantes. Toda persona con nombre válido en una pestaña declarada es activa y cuenta.
21. **Excluir filas cuyo Nombre sea "Por confirmar"** o variantes. Son cupos por empresa, no personas.
22. **Existen correos compartidos por dos personas.** No bloquear, no deduplicar: cada una tiene su ID y su credencial. En `/recuperar`, un correo con varias personas recibe todas las credenciales en el mismo mensaje, rotuladas por nombre.
22-bis. **`/recuperar` NO usa código de verificación.** La persona escribe su correo y el sistema reenvía la credencial a esa dirección. El QR nunca se muestra en pantalla. Respuesta siempre neutra y máximo 3 reenvíos por dirección por hora.
23. **En las pestañas origen solo se escribe la columna `UID (no editar)`, DENTRO de la tabla de Sheets**, oculta y con protección en modo advertencia. Nunca por fuera del rango de la tabla: ordenar la tabla dejaría los UID cruzados con otras personas.
24. **NO confiar ciegamente en la columna UID.** Reconocer a cada persona con la cascada de SPEC §5.1: UID + huella → si ambos datos cambiaron, ignorar UID → buscar por correo (o correo+nombre, o nombre+empresa) incluyendo Retirados → si no hay coincidencia, persona nueva. Al final, reescribir la columna UID.
25. **Quien desaparece de las pestañas pasa a Retirado, nunca se borra del Maestro.** Una sincronización JAMÁS revierte una llegada. Más de 5 Retirados en una pasada → pausar y pedir confirmación con nombres. Pestaña declarada inexistente → detener todo (no retirar a sus personas).
26. **Encabezado por búsqueda**, no por fila fija: la fila que contiene `Nombre` en las primeras 40.
27. **Respaldo del Maestro en Drive antes de cada sincronización** (últimas 20).
28. **Crear la pestaña ⚠️ LÉEME** protegida, con las reglas para editores de SPEC §5-bis.
29. **Los casos de prueba T1–T15 de SPEC §5-ter son obligatorios.** Ejecutarlos sobre una copia de la hoja y reportar el resultado de cada uno antes de habilitar cualquier envío.

## Orden de construcción (respetarlo)

1. `Config.gs` + pestañas de soporte
2. `Ids.gs` + `Sync.gs` → validar con la hoja real antes de seguir
3. `Credencial.gs` → **probar la lectura del QR con 3 teléfonos antes de generar 300**
4. `Brevo.gs` → correo de prueba antes de cualquier envío masivo
5. `Api.gs` + `Checkin.gs`
6. Lector (`web/lector`) → primero en línea, después el modo sin conexión
7. Panel, `/c`, `/recuperar`
8. `Reportes.gs`

## Puntos donde se rompe todo si se hace mal

- **Trigger `onEdit` para las casillas por fila:** debe ser **instalable**, no simple. El simple no tiene permisos para llamar servicios externos.
- **Generación masiva:** Apps Script corta cada ejecución a los **6 minutos, también en Workspace**. Lotes de máximo 5 minutos, avance guardado en `PropertiesService`, trigger de continuación. Borrar cada trigger de continuación al usarlo: el límite es 20 triggers por usuario por script.
- **CORS:** los POST desde GitHub Pages van con `Content-Type: text/plain` y JSON en el cuerpo, para evitar el preflight que Apps Script no maneja.
- **Cámara:** solo funciona bajo HTTPS. Por eso el frontend no vive dentro de Apps Script.
- **Panel:** cachear la respuesta 10 s con `CacheService`. Apps Script satura con pocas decenas de ejecuciones simultáneas.
- **Zona horaria:** `America/Guayaquil` en `appsscript.json`. Todas las horas del evento son locales.

## Estado del proyecto

Ver la sección 21 de `SPEC.md` para los pendientes de Fedexpor. **Las decisiones del 27/09 (SPEC §18-ter) prevalecen**: se trabaja sobre la hoja real (cada `clasp push` a ella exige la frase literal), T1–T15 van en una hoja aparte con datos ficticios, siglas PD/PB como subcategorías de Pagados y pestaña OTROS en lugar de Diplomado/B2B/Invitados/Fedexpor. Si falta un dato, **no lo inventes ni lo dejes hardcodeado**: ponlo en la pestaña Config con un valor marcador y avisa.


## Entornos y repositorio

30. **Dos entornos.** `SCRIPT_ID_PRUEBAS` (copia de la hoja) y `SCRIPT_ID_PRODUCCION` (hoja real), ambos en `CONFIG_EVENTO.md`. **Todo `clasp push` va a PRUEBAS.** PRODUCCIÓN recibe el sistema **por etapas**, solo cuando el responsable escriba literalmente "pasa a producción la etapa N", y solo con los módulos de esa etapa y las anteriores. **La etapa 1 debe llegar a producción antes del lunes 28 a las 12:00**, porque los stickers se imprimen con los números de la hoja real.
31. **El repositorio es público** (GitHub Pages). **Nunca escribas nombres, correos ni teléfonos reales** en documentos, comentarios, commits, datos de prueba ni resultados de T1–T15 que se guarden en el repositorio: usa datos ficticios o solo IDs. El `.gitignore` excluye `CONFIG_EVENTO.md`, todo `.xlsx`/`.csv` y cualquier archivo con datos de personas. Ninguna clave, token ni API key en el código.
32. **Secretos solo en Script Properties.** Nunca pidas al responsable que pegue la API key de Brevo ni las claves de operador en el chat: dile el nombre exacto de la propiedad y que la pegue él en Apps Script.
33. **Datos faltantes:** si un valor de `CONFIG_EVENTO.md` está vacío, pregunta. No lo inventes ni lo dejes hardcodeado.
34. **Construcción por etapas** (ver INSTALACION.md, Fase 5). Al final de cada etapa, detente y espera la aprobación del responsable antes de continuar.

## Cómo pedir información al responsable

35. **Toda pregunta al responsable se hace con la herramienta `AskUserQuestion`** (preguntas de opción múltiple). Nunca preguntas sueltas en texto, nunca listas de preguntas en prosa. Esto aplica aunque creas que puedes suponer la respuesta: en este proyecto **no se supone, se pregunta**.
36. **Formato:** hasta 4 preguntas por llamada, de 2 a 4 opciones cada una, en español, cortas y concretas. Si una opción es la recomendada, va primero y termina en "(Recomendado)". Agrupa en una sola llamada las preguntas relacionadas.
37. **Datos libres** (un link, un correo, el texto institucional): pregunta igual con `AskUserQuestion`, con opciones como "Ya lo puse en CONFIG_EVENTO.md", "Te lo escribo en la opción Otro" y "Todavía no lo tengo". Si elige la primera, léelo del archivo.
38. **Secretos (API key de Brevo, claves de operador): NUNCA se piden ni se aceptan por `AskUserQuestion` ni por chat.** Indica el nombre exacto de la propiedad y pregunta con opciones como "Ya la pegué en Propiedades de la secuencia de comandos", "Guíame paso a paso" y "Todavía no la tengo". Si el responsable escribe una clave en la opción Otro, no la uses ni la repitas: pídele que la cambie en Brevo y la pegue en Propiedades.
39. **Cierre de cada etapa:** pregunta con `AskUserQuestion` usando opciones como "Aprobado, sigue", "Hay que corregir algo" y "Necesito revisar más". No avances sin "Aprobado".
40. **Acciones irreversibles** (`clasp push` a PRODUCCIÓN, generar las 300 credenciales, cualquier envío real): además de la pregunta, exige que el responsable **escriba la frase literal** ("pasa a producción", "genera todas", etc.). Una pregunta de opción múltiple puede responderse por error o continuar sola si nadie contesta; una acción irreversible nunca depende solo de eso.
41. **Claude Code nunca activa `ENVIOS_HABILITADOS` ni `BIENVENIDA_AUTOMATICA`.** Los activa el responsable desde el menú de la hoja.
42. **Las preguntas las hace siempre la sesión principal.** No delegues preguntas a subagentes: `AskUserQuestion` no está disponible dentro de ellos.
