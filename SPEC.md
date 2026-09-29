# Especificación técnica: Sistema de credenciales QR
## XVIII Convención de Exportadores · Fedexpor

> Documento para entregar a Claude Code. Describe **qué** construir y **por qué**. Las decisiones marcadas con ⚠️ están pendientes de confirmación.

---

## 0. Datos del evento

| Campo | Valor |
|---|---|
| Organizador | Fedexpor (Federación Ecuatoriana de Exportadores) |
| Evento | XVIII Convención de Exportadores |
| Fecha | Miércoles 30 de septiembre de 2026 |
| Lugar | Hotel Marriott, Quito |
| Inicio del evento | 08:30 |
| Apertura de registro (lectores operadores) | 07:00 |
| Zona horaria | America/Guayaquil (UTC−5) |
| Asistentes estimados | ~300 |
| Cuenta | Google Workspace institucional (dominio fedexpor) |
| Remitente de correo | Nombre: **Fedexpor** · Dirección: ⚠️ pendiente (correo institucional del responsable) |
| Proveedor de correo | Brevo (dominio ya autenticado) · Límite diario: ⚠️ pendiente |
| WhatsApp | Links wa.me personalizados (envío semi-manual, sin adjunto) |
| Agenda | Siempre por link al micrositio de Canva: ⚠️ pendiente el link |
| Tono de todos los mensajes | Formal y corporativo |

---

## 1. Principios de diseño (no negociables)

1. **El ID de credencial nunca cambia.** Se asigna una vez por persona y queda ligado a ella, aunque cambien su nombre, empresa, correo o celular.
2. **Solo los lectores autorizados registran llegadas.** Escanear el QR con cualquier otra cámara jamás marca asistencia.
3. **Ningún registro se pierde.** Los lectores funcionan sin conexión y sincronizan después. Las escrituras son idempotentes y usan bloqueo.
4. **En el Maestro nada se borra.** Toda acción queda en una bitácora. En las pestañas origen, en cambio, los editores **sí pueden borrar, mover y cortar filas** libremente: el sistema lo absorbe.
5. **Sin cédula** en ningún lugar del sistema (protección de datos, LOPDP Ecuador).
6. **El script nunca reordena ni borra nada en las pestañas origen.** Solo lee de ellas y escribe una única columna técnica (UID). Los editores humanos sí pueden hacerlo.

---

## 2. Arquitectura

```
┌──────────────────────────── Google Sheet (Workspace) ────────────────────────────┐
│ Pestañas origen: Pagados · Diplomado · Auspiciantes · Expositores · Sumarse ·    │
│                  B2B · Invitados · Fedexpor · Registro en sitio                  │
│ Maestro · Bitácora · ColaCorreos · Pruebas · Config · Reenvíos · Reporte         │
│ Apps Script (clasp): menú, sincronización, credenciales, Brevo, API Web App      │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │ HTTPS (JSON)
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  Lector QR (PWA)               Panel en vivo                 Página pública
  /lector                       /panel                        /c  (destino del QR)
  4 operadores + máster         link abierto, sin PIN         /recuperar (reenvío)
        └──────────── Hosting estático: GitHub Pages (HTTPS) ────────────┘

  Drive: carpeta "Credenciales XVIII Convención" (PNG por persona, lectura pública con link)
  Brevo: correos transaccionales (plantillas + webhook de entrega/rebote)
```

**Por qué el frontend va en GitHub Pages y no dentro de Apps Script:** la cámara dentro del iframe de Apps Script es poco confiable, sobre todo en iPhone. GitHub Pages da HTTPS propio, carga rápido, permite PWA, `localStorage` y Wake Lock.

**Comunicación:** el frontend llama al Web App de Apps Script. Los POST se envían con `Content-Type: text/plain` para evitar el preflight CORS; el cuerpo es JSON.

### Estructura del repositorio

```
fedexpor-convencion-qr/
├── CLAUDE.md                  ← resumen de este documento + reglas del proyecto
├── SPEC.md                    ← este documento
├── apps-script/
│   ├── .clasp.json
│   ├── appsscript.json        ← timeZone America/Guayaquil, webapp ANYONE_ANONYMOUS, Slides/Sheets avanzados
│   └── src/
│       ├── Config.gs          ← lectura de pestaña Config + Script Properties
│       ├── Menu.gs            ← onOpen, menú "Fedexpor QR", casillas por fila (onEdit instalable)
│       ├── Sync.gs            ← sincronización origen → Maestro
│       ├── Ids.gs             ← UID, ID de credencial, token
│       ├── Credencial.gs      ← QR + plantilla Slides → PNG en Drive
│       ├── Brevo.gs           ← envíos y webhook
│       ├── WhatsApp.gs        ← normalización +593 y links wa.me
│       ├── Api.gs             ← doGet/doPost (router por "action")
│       ├── Checkin.gs         ← ingreso, deshacer, observación, manual, en sitio
│       ├── Cola.gs            ← cola de correos (trigger cada minuto)
│       ├── Otp.gs             ← recuperación de credencial
│       ├── Reportes.gs        ← reporte final
│       └── Utils.gs
└── web/                       ← publicado en GitHub Pages
    ├── lector/  (index.html, app.js, sw.js, manifest.json, sonidos)
    ├── panel/
    ├── c/                     ← página que abre el QR con una cámara común
    ├── recuperar/
    └── assets/  (logos, isotipo X)
```

---

## 3. Modelo de datos

### 3.1 Pestañas origen (estructura real del archivo)

**Las pestañas NO empiezan en la fila 1.** Cada una tiene un tablero de control con totales y fórmulas en las filas 1–13, los **encabezados en la fila 14** y los datos desde la **fila 15**. Ese tablero es de Fedexpor y no se toca.

**Detección del encabezado:** el sistema busca, dentro de las primeras 40 filas, la fila que contiene el encabezado `Nombre`. Así, si alguien inserta o borra filas en el tablero superior, nada se rompe. Config guarda la fila esperada solo como referencia: si la encontrada difiere, el sistema avisa pero continúa con la encontrada.

Config declara, para cada pestaña:

```
PESTANAS_ORIGEN = [
  { hoja: "Lista pagados", sigla: "P", filaEncabezado: 14 },
  { hoja: "SUMARSE",       sigla: "S", filaEncabezado: 14 },
  { hoja: "AUSPICIANTES",  sigla: "A", filaEncabezado: 14 },
  { hoja: "EXPOSITORES",   sigla: "E", filaEncabezado: 14 },
  { hoja: "OTROS",         sigla: "OT", filaEncabezado: 14 }
]
SUBCATEGORIAS (solo Lista pagados, por palabra clave en observaciones) = [
  { palabra: "diplomado", sigla: "PD" },
  { palabra: "b2b",       sigla: "PB" }
]
```

El script localiza cada columna **por el texto de su encabezado**, no por posición fija, para que Fedexpor pueda insertar o mover columnas sin romper nada. Si un encabezado esperado no aparece, la sincronización se detiene y lo reporta en vez de leer datos equivocados.

**Mapeo de columnas (encabezados reales del archivo):**

| Encabezado en la hoja | Uso en el sistema |
|---|---|
| `Nombre` | Nombre (obligatorio) |
| `Empresa` | Empresa (obligatorio) |
| `Cargo` | Cargo (opcional) |
| `Correo Electronico` | Correo |
| `Teléfono` | Celular |
| `Estado del Cliente` | **Ignorada** (decisión del responsable, 27/09). No se lee ni define quién es activo |
| `CI` | **Ignorada.** Nunca se lee ni se muestra (LOPDP) |
| `N` | **Ignorada.** Es el correlativo interno de Fedexpor, no el ID de credencial |
| `ASISTENCIA 28/29/30 JULIO`, `ENVÍO DE BIENVENIDA`, `WPP` | **Ignoradas.** Son de eventos anteriores. El sistema no las lee ni las escribe |

**Única columna que el script escribe en las pestañas origen:** `UID (no editar)`. **Debe quedar DENTRO de la tabla de Sheets**, como una columna más de la tabla, no por fuera. Las pestañas son tablas estructuradas (`Seguimiento`, `Seguimiento_2`…); si el UID quedara fuera del rango de la tabla, ordenar la tabla movería los nombres pero no los UID, y las personas quedarían cruzadas sin ningún aviso. La columna se oculta y se protege en modo **advertencia**, para que el orden de la tabla siga funcionando para todos los editores.

### Filas que se excluyen automáticamente

| Caso | Regla |
|---|---|
| Nombre vacío | Se ignora la fila |
| Nombre literal "Por confirmar" (o variantes) | **Se ignora.** Son cupos por empresa, no personas. No reciben ID ni credencial |
| Pestaña `⛔Anulaciones` | Nunca se lee |

El resultado de cada sincronización reporta: filas leídas, filas omitidas y el motivo de cada omisión.

### 3.2 Siglas por fuente (fijas, van impresas en el sticker)

| Fuente | Sigla | Pestaña |
|---|---|---|
| Pagados | P | Lista pagados |
| Pagados · Diplomado Internacional | **PD** | Lista pagados (observación contiene "diplomado") |
| Pagados · Rueda de Negocios B2B | **PB** | Lista pagados (observación contiene "b2b") |
| Auspiciantes | A | AUSPICIANTES |
| Expositores | E | EXPOSITORES |
| Proyecto Sumarse | S | SUMARSE |
| Otros | **OT** | OTROS (la crea la etapa 1) |
| Registro en sitio | NR | Registro en sitio |

> **Decisión del 27/09:** ya no existen pestañas Diplomado, B2B, Invitados ni Fedexpor. Diplomado y B2B son subcategorías de Pagados, detectadas por palabra clave en la columna de observaciones (ver §18-ter).

Los nombres de pestaña y siglas se leen desde **Config**, no se codifican a mano.

### 3.3 Identificadores

- **UID**: interno, aleatorio (ej. `u_7f3k9q2m`), invisible para el usuario final. Es la llave de emparejamiento entre la pestaña origen y el Maestro.
- **ID de credencial**: `número + sigla` (ej. `47P`). Se asigna en la primera sincronización según el **orden actual de filas** de la pestaña. El número es el siguiente disponible para esa sigla (contador persistente en Script Properties). **Nunca se reutiliza**, ni si la persona se cancela.
- **Token**: aleatorio de 22+ caracteres (base62, criptográficamente seguro vía `Utilities.getUuid()` combinado). Es lo que codifica el QR. No revela ID, nombre ni ningún dato.

### 3.4 Pestaña Maestro

| # | Columna | Escribe | Nota |
|---|---|---|---|
| A | UID | Script | Protegida, puede ocultarse |
| B | ID | Script | Ej. `47P`. Protegida |
| C | Fuente | Script | Pagado, Diplomado… |
| D | Nombre | Sync | |
| E | Empresa | Sync | |
| F | Cargo | Sync | |
| G | Correo | Sync | |
| H | Celular | Sync | Tal como viene en origen |
| I | Estado inscripción | Sync | Activo / Cancelado / **Retirado** (desapareció de las pestañas) |
| J | Alertas | Script | "Sin correo", "Sin celular", "Credencial desactualizada", "Correo rebotado" |
| K | ☐ Generar | Usuario | Casilla = botón por fila |
| L | Credencial | Script | Chip de Drive (o hipervínculo) al PNG |
| M | ☐ Enviar correo | Usuario | Casilla = botón por fila |
| N | Estado correo | Script | "Enviado 28/09 08:02" · "Entregado" · "Rebotado" · "Error: …" |
| O | WhatsApp | Script | `=HYPERLINK(wa.me…, "Abrir WhatsApp")` |
| P | ☐ WA enviado | Usuario | Marca manual tras enviar |
| Q | Recordatorio 1 | Script | Fecha/hora o error |
| R | Recordatorio 2 | Script | Fecha/hora o error |
| S | Sticker impreso | Script | Sí / No (se fija en el corte de impresión) |
| T | Estado | Script | `Llegó` o vacío |
| U | Hora de llegada | Script | HH:mm:ss |
| V | Lector | Script | M1-A, M1-B, M2-A, M2-B, MÁSTER |
| W | Origen registro | Script | QR · Manual · En sitio |
| X | Observación | Lector o usuario | Texto libre |
| Y | Bienvenida | Script | Enviada / En cola / Error |
| Z | Token | Script | Protegida, oculta |

**Formato condicional:** toda la fila en **verde** cuando `T = "Llegó"`. Sin otros colores de fila.

**Protección:** columnas A, B, Z y la columna UID de cada origen protegidas (solo el propietario del script edita).

### 3.5 Pestañas de soporte

- **Bitácora** (solo anexar): Fecha/hora servidor · Hora dispositivo · Lector · Acción · UID · ID · Detalle · clientId. Acciones: `INGRESO`, `DUPLICADO`, `INVALIDO`, `DESHACER`, `OBSERVACION`, `MANUAL`, `EN_SITIO`, `CANCELADO_INTENTO`, `REENVIO_SOLICITADO`, `REENVIO_ENVIADO`, `REENVIO_BLOQUEADO`, `CREDENCIAL_GENERADA`, `CORREO_ENVIADO`, `TOKEN_REGENERADO`.
- **ColaCorreos**: tipo · UID · estado · intentos · creado · enviado · error.
- **Pruebas**: igual que Bitácora, recibe los escaneos en modo prueba.
- **Reenvíos**: correo (hash) · hora de cada solicitud, para aplicar el límite de 3 por hora.
- **Config**: clave/valor (fechas, horas, textos, links, nombres de pestaña, siglas, modo actual).
- **Registro en sitio**: pestaña origen adicional para las personas agregadas el día del evento.
- **Anulaciones** y cualquier otra pestaña de trabajo: **excluidas**. El sistema no las lee nunca.

Secretos en **Script Properties**, nunca en la hoja: `BREVO_API_KEY`, claves de lectores (`KEY_M1A`, `KEY_M1B`, `KEY_M2A`, `KEY_M2B`, `KEY_MASTER`), contadores de ID.

---

## 4. Menú "Fedexpor QR" en la hoja

| Opción | Qué hace |
|---|---|
| Sincronizar Maestro | Lee todas las pestañas origen y actualiza el Maestro (ver §5) |
| Generar credenciales pendientes | Genera PNG para filas activas sin credencial o desactualizadas (por lotes) |
| Enviar credencial | A todos los pendientes, a la selección o a una fila. Pide confirmación |
| Generar links WhatsApp | Llena la columna O para todos, de una sola vez. La columna queda vacía hasta ejecutarlo |
| **Delegar cupo** (fila seleccionada) | La persona nueva hereda el ID y el sticker; se regenera el token y el QR anterior deja de servir |
| Marcar corte de impresión | Fija "Sticker impreso = Sí" y exporta la lista para imprenta |
| Exportar lista para stickers | Hoja/PDF ordenado por sigla y número |
| **Habilitar / deshabilitar envíos** | Interruptor maestro de correos. Arranca en NO |
| **Bienvenida automática: encender / apagar** | Interruptor independiente. Arranca en NO |
| Enviar bienvenida a los que llegaron | Para los pendientes, si la automática estuvo apagada |
| Enviar recordatorio | A todos, a la selección o a una fila. Sin programación |
| Enviar correo de prueba | A una dirección de prueba, con datos ficticios |
| Limpiar pruebas | Vacía la pestaña Pruebas y la cola de prueba |
| Generar reporte final | Ver §11 |

**Botones por fila:** las casillas K (Generar) y M (Enviar correo) disparan la acción solo para esa fila mediante un trigger `onEdit` **instalable** (necesita permisos). Al terminar, la casilla se desmarca sola y el resultado queda en la columna de estado.

---

## 5. Sincronización origen → Maestro

**Supuesto de diseño:** los editores de la hoja van a borrar filas, moverlas dentro de una pestaña y cortarlas hacia Anulaciones. El sistema **no depende de que la columna UID permanezca alineada**; la usa como pista y la verifica siempre.

**Lista blanca de pestañas.** La sincronización lee **únicamente** las pestañas declaradas en Config bajo `PESTANAS_ORIGEN`. Anulaciones, hojas de trabajo y cualquier pestaña nueva no declarada se ignoran. Al sincronizar, el sistema informa qué pestañas leyó y cuáles omitió. Filas filtradas u ocultas **sí se leen** (no cuentan como desaparecidas). **Toda persona con nombre válido en una pestaña declarada es activa y cuenta**, sin importar `Estado del Cliente`. Agregar o borrar personas en las pestañas se refleja en el Maestro con la siguiente sincronización.

### 5.1 Reconocimiento de cada persona (en este orden)

Para cada fila válida de las pestañas declaradas:

| Paso | Condición | Resultado |
|---|---|---|
| **1** | Tiene UID, y ese UID existe en el Maestro, y coincide su **nombre o su correo** (normalizados: sin tildes, minúsculas, sin espacios extra) | Es la misma persona. Se actualizan sus datos. **Conserva su ID y su token.** |
| **2** | Tiene UID, pero cambiaron **a la vez** nombre y correo respecto de la huella del Maestro | El UID quedó desalineado (fila movida sin su columna, o persona escrita encima). **Se ignora el UID** y se pasa al paso 3. |
| **3** | Sin UID, o UID ignorado | Se busca en el Maestro (incluidos los **Retirados**) por correo. Si el correo es compartido, por correo + nombre. Si no hay correo, por nombre + empresa. Si aparece una coincidencia única: **recupera su UID, su ID y su token originales**, y si estaba Retirado vuelve a Activo. |
| **4** | Sin coincidencia | Persona nueva: UID nuevo, siguiente ID de su sigla, token nuevo. |
| **5** | Coincidencia ambigua (más de un candidato) | No se asigna nada. La fila queda en Alertas como "Revisar: coincidencia ambigua". |

Después del recorrido:

| Situación | Resultado |
|---|---|
| Persona del Maestro que **no apareció** en ninguna pestaña declarada | Estado **Retirado**. Sale de envíos, del conteo de esperados y de las listas del panel. Su ID **no se reutiliza jamás**. |
| Persona Retirada que **ya había llegado** (Estado = Llegó) | Se mantiene como asistente. **Una sincronización nunca revierte una llegada.** Se marca "Revisar: retirado tras llegar". |
| Más de **5 personas** pasan a Retirado en una misma sincronización | La sincronización se pausa y muestra la lista de nombres. Solo continúa si el responsable confirma. |
| Persona que aparece en otra pestaña distinta a su fuente original | **Antes del corte:** recibe un ID nuevo con la sigla de su nueva pestaña (el número anterior no se reutiliza). **Después del corte:** conserva su ID y se marca "Cambió de fuente". (Decisión del 27/09) |

Finalmente, **el sistema reescribe la columna UID** de todas las filas leídas con el UID correcto. Cualquier desalineación se repara sola en cada sincronización.

### 5.2 Delegación de cupo

Escribir una persona nueva encima de otra se trata automáticamente como **una persona nueva + una Retirada** (paso 2 → paso 4). Es el comportamiento seguro por defecto.

Si se quiere que la persona nueva **herede el sticker** del anterior (delegación después de imprimir), se usa la opción de menú **"Delegar cupo"**: conserva el ID, regenera el token (el QR anterior deja de servir) y registra la delegación en la Bitácora.

### 5.3 Validaciones

Correo con formato válido, celular normalizable a +593, correos duplicados (se alertan, no se bloquean). Escritura en el Maestro por lotes y con `LockService`.

**Correos compartidos: caso confirmado.** En la lista real hay al menos dos personas con el mismo correo. Cada una recibe su propia credencial con su propio ID. En `/recuperar`, un reenvío a esa dirección lleva todas sus credenciales en el mismo mensaje, rotuladas por nombre. El paso 3 del reconocimiento las distingue por nombre.

### 5.4 Corte de impresión

Después de "Marcar corte de impresión", todo ID nuevo queda con "Sticker impreso = No" y el lector muestra **STICKER A MANO**. Cualquier reactivación o delegación sobre un ID impreso requiere un lector máster.

---

## 5-bis. Protección de identidad

### Controles automáticos

| Control | Qué detecta | Qué hace |
|---|---|---|
| **Huella por persona** | Nombre y correo originales de cada UID, guardados en el Maestro | Base del paso 2: si cambian ambos a la vez, el UID se considera desalineado |
| **UID duplicado** | El mismo UID en dos filas (copiar y pegar una fila entera) | Se aplica el paso 1 a la fila cuya huella coincide; la otra se trata por el paso 3. Si ninguna coincide, ambas quedan en Alertas |
| **Desaparición masiva** | Más de 5 Retirados en una sincronización | Pausa y pide confirmación con nombres |
| **Encabezado faltante** | Un encabezado renombrado o borrado | Detiene la sincronización de esa pestaña y lo reporta |
| **Pestaña renombrada** | Una pestaña declarada que ya no existe | Detiene la sincronización completa. **Nunca** interpreta que todas sus personas se retiraron |

### Respaldo

Antes de cada sincronización se guarda una copia del Maestro en Drive, con fecha y hora. Se conservan las últimas 20.

### Pestaña ⚠️ LÉEME (protegida, al inicio del archivo)

**Se puede, sin avisar a nadie:** corregir datos · agregar personas · **borrar filas** · **mover u ordenar filas** · **cortar filas hacia Anulaciones** · filtrar y ocultar.

**No se debe:** renombrar pestañas o encabezados · escribir en la columna UID · editar la pestaña Maestro.

**Para delegar un cupo conservando el sticker impreso:** avisar al responsable, que usa "Delegar cupo".

---

## 5-ter. Casos de prueba obligatorios antes del primer envío

Claude Code debe ejecutar cada caso sobre una **copia** de la hoja y mostrar el resultado. Ninguna credencial se envía hasta que todos pasen.

| # | Acción del editor | Resultado esperado |
|---|---|---|
| T1 | Ordenar la tabla de Pagados por empresa | Mismos ID para todas las personas. Cero altas, cero bajas |
| T2 | Cortar solo las columnas visibles de 3 filas y pegarlas más abajo (UID queda atrás) | Mismos ID. La columna UID queda reparada tras sincronizar |
| T3 | Arrastrar filas completas a otra posición | Mismos ID |
| T4 | Cortar una persona de Pagados y pegarla en Anulaciones | Esa persona pasa a Retirado. Las demás intactas |
| T5 | Borrar una fila de Pagados | Pasa a Retirado. Su número no se reutiliza |
| T6 | Borrar una fila y volver a escribir a la misma persona a mano (sin UID) | Recupera su **mismo ID** y vuelve a Activo. No hay duplicado |
| T7 | Borrar 8 filas de golpe | La sincronización pausa y pide confirmación con los 8 nombres |
| T8 | Escribir una persona distinta encima de otra | Persona nueva con ID nuevo; la anterior pasa a Retirado |
| T9 | Corregir una tilde en un nombre | Mismo ID, dato actualizado |
| T10 | Cambiar solo el correo de alguien | Mismo ID, correo actualizado |
| T11 | Copiar y pegar una fila entera para crear otra persona y cambiarle nombre y correo | Dos personas distintas, con ID distintos |
| T12 | Registrar la llegada de alguien y luego borrarlo de la pestaña | Sigue contando como asistente. Marcado para revisión |
| T13 | Renombrar la pestaña Pagados | La sincronización se detiene. Nadie pasa a Retirado |
| T14 | Escanear el QR de una persona Retirada | Lector en naranja: "Inscripción retirada". Máster puede reactivar y registrar |
| T15 | Dos personas con el mismo correo; borrar a una | Solo esa pasa a Retirado. La otra conserva su ID |

---

## 6. Credencial digital (PNG)

### 6.1 Contenido

- Nombre del evento: **XVIII Convención de Exportadores**
- Nombre · Empresa · Cargo · Tipo de inscrito
- **ID en grande** (ej. 47P)
- QR con el **isotipo X de Fedexpor al centro**
- Seis logos obligatorios: Fedexpor, Convención, Academy Fedexpor, Proyecto Sumarse, Hilton Foundation, ⚠️ sexto logo de proyecto pendiente
- Texto institucional obligatorio: ⚠️ pendiente
- Sin cédula

### 6.2 Generación

1. **Plantilla en Google Slides** (tamaño vertical tipo historia, 1080×1920 o similar) con los logos fijos y marcadores `{{EVENTO}}`, `{{NOMBRE}}`, `{{EMPRESA}}`, `{{CARGO}}`, `{{TIPO}}`, `{{ID}}` y una forma marcadora para el QR. El diseño lo aprueba Fedexpor.
2. **Imagen del QR:** contenido = `https://<pages>/c/?t=<TOKEN>`. Corrección de error **H**, isotipo al centro ≤ 20 % del ancho, margen blanco de 4 módulos. Generación vía API de QuickChart (`ecLevel=H`, `centerImageUrl` apuntando al isotipo en GitHub Pages, tamaño ≥ 600 px).
   - ⚠️ Alternativa si se prefiere no enviar tokens a un tercero: generar el QR con una librería JS dentro del propio Apps Script y rasterizar por otro medio. Evaluar en implementación.
3. Por persona: copiar la plantilla, reemplazar textos, insertar QR, exportar miniatura PNG con el servicio avanzado de Slides (`getThumbnail`, tamaño LARGE), guardar en Drive como `47P - Nombre Apellido.png`, compartir "cualquiera con el link: lector", borrar la copia temporal.
4. Escribir en la columna L un **chip de Drive** (Sheets API, `chipRuns`) o, si no está disponible, `=HYPERLINK(url, "Ver credencial")`.

### 6.3 Rendimiento

~5–8 s por persona → 300 personas ≈ 30–40 min en total. **Apps Script corta cada ejecución a los 6 minutos, también en Workspace.** Procesar en lotes de máximo 5 minutos, guardando el avance en `PropertiesService`, con **trigger de continuación** automático. Progreso visible en un toast y en Config.

### 6.4 Prueba obligatoria antes del envío masivo

Escanear 5 credenciales de muestra con al menos 3 teléfonos distintos (iPhone, Android gama media, Android gama baja), desde pantalla y con brillo bajo.

---

## 7. Correo (Brevo)

Envío con la API transaccional de Brevo (`POST /v3/smtp/email`) usando **plantillas creadas en Brevo** con parámetros. Remitente "Fedexpor" desde el correo institucional.

> **REGLA CRÍTICA: ningún envío es automático por fecha.** No se crean triggers de tiempo para correos. Todo sale únicamente cuando el responsable lo ejecuta desde el menú de la hoja.

### Interruptor maestro de envíos

En la pestaña **Config**, la clave `ENVIOS_HABILITADOS` arranca en **NO**.

- Con `NO`: cualquier intento de envío (menú, casilla por fila, cola) se rechaza y escribe "Envíos deshabilitados" en la columna de estado. Nada sale.
- Solo el responsable lo cambia a `SI`, desde el menú, con confirmación.
- Recomendación: volver a `NO` apenas termine cada tanda.

### Interruptor de la bienvenida

Clave `BIENVENIDA_AUTOMATICA` en Config, independiente del interruptor maestro. Arranca en **NO**.

- En `SI`: cada ingreso registrado encola el correo de bienvenida y sale en menos de un minuto.
- En `NO`: el ingreso se registra igual, pero no se encola nada. La columna Y queda como "Pendiente".
- Se enciende y se apaga en cualquier momento desde el menú, incluso a mitad del evento, sin reiniciar nada.
- Si estuvo apagado y luego se quiere enviar, la opción "Enviar bienvenida a los que llegaron" la manda a todos los pendientes.

### Confirmación previa

Antes de cualquier envío masivo, el sistema muestra un diálogo con: cuántos destinatarios, qué plantilla, cuántos quedan fuera y por qué (sin correo, cancelados, ya enviados). El envío solo corre si el responsable acepta.

### Plantillas disponibles (se envían a demanda)

| # | Correo | Cómo se dispara | Contenido |
|---|---|---|---|
| 1 | Credencial | Menú "Enviar credencial" (masivo o selección) o casilla de la fila | Saludo personalizado, fecha, hora, lugar, credencial adjunta e incrustada, link Drive, link agenda |
| 2 | Recordatorio | Menú "Enviar recordatorio" | Igual, con indicaciones de llegada. Reutilizable las veces que se quiera |
| 3 | Bienvenida | Al registrar ingreso, **si está habilitada** | Agradecimiento y agenda |
| 4 | Reenvío de credencial | Al solicitarlo en /recuperar | La credencial adjunta, al correo registrado |

Cada plantilla puede enviarse a: todos los pendientes, solo las filas seleccionadas, o una fila individual. El sistema nunca reenvía a alguien que ya recibió esa plantilla salvo que se marque "forzar reenvío".

- Adjuntar la credencial en los correos 1–3 reduce drásticamente el problema de "no encuentro mi QR".
- **Webhook de Brevo** → `doPost` action `brevo_webhook` para registrar "Entregado" / "Rebotado" / "Spam" en la columna N. Revisar rebotes el lunes para corregir correos antes del evento.
- La **bienvenida** no se envía en el mismo request del escaneo: entra a ColaCorreos y un trigger cada minuto la procesa, siempre que `BIENVENIDA_AUTOMATICA` esté en `SI`. El lector nunca espera al correo.
- ⚠️ Verificar límite diario del plan Brevo. Volumen estimado: 300 (credencial) + 300 + 300 (recordatorios) + ~280 (bienvenidas) + reenvíos.

---

## 8. WhatsApp (wa.me)

- Normalizar celular: quitar espacios y símbolos; `09XXXXXXXX` → `5939XXXXXXXX`; `+593…` → `593…`. Si no valida, alerta "Celular inválido".
- Link: `https://wa.me/<número>?text=<mensaje codificado>`.
- **La columna O se llena solo al ejecutar "Generar links WhatsApp" desde el menú**, de una vez para toda la lista. No se genera fila por fila ni de forma automática.
- Mensaje formal: saludo con nombre, evento, fecha, hora, lugar, link a la credencial (Drive) y link a la agenda.
- **Limitación confirmada:** wa.me no permite adjuntar archivos. La credencial va como link.
- Flujo: el usuario abre el link desde el celular institucional, envía, marca la casilla P.

---

## 9. Página pública del QR (/c)

Si alguien escanea su QR con la cámara común del teléfono, se abre `/c/?t=TOKEN` y ve:

- Antes y durante el evento: "**Próximamente inicia la XVIII Convención de Exportadores.** Presenta este código en la mesa de registro." + fecha, hora, lugar y link a la agenda.
- **Nunca registra asistencia ni muestra datos personales.** La página no llama a ningún endpoint de escritura.

---

## 10. Lector QR (/lector) · PWA

### 10.1 Configuración inicial (una sola vez por teléfono)

Pantalla de configuración: elegir lector (M1-A, M1-B, M2-A, M2-B o MÁSTER) e ingresar su **clave de operador**. Se guarda en el dispositivo. El servidor valida la clave en cada escritura. Las claves se pueden revocar desde Script Properties.

### 10.2 Roles y modos

| | Operador | Máster |
|---|---|---|
| Escanear | Desde las 07:00 del 30/09 **y** con modo REAL activo | Siempre |
| Antes de la apertura | Pantalla "Próximamente inicia el evento", no registra | Escanea en el modo vigente |
| Deshacer | Sus últimos 5 registros, dentro de 10 min | Cualquier registro, sin límite |
| Cambiar modo PRUEBA / REAL | No | Sí |
| Registro en sitio | Sí | Sí |

**Modo PRUEBA:** los escaneos van a la pestaña Pruebas, no pintan el Maestro y no envían bienvenidas. **Modo REAL:** operación normal. El modo actual se muestra siempre en una franja visible del lector ("PRUEBA" en morado).

### 10.3 Resultado del escaneo (pantalla completa, color + sonido + vibración)

| Color | Caso | Texto principal |
|---|---|---|
| 🟢 Verde | Ingreso registrado | **ACCESO CORRECTO** · ID enorme · Nombre · Empresa · Tipo |
| 🔴 Rojo | Ya ingresó antes | **YA INGRESÓ** · 08:42 · Mesa 1-A · ID · Nombre |
| 🟡 Amarillo | Token no existe / QR ajeno al evento | **CÓDIGO NO VÁLIDO** · "Usar búsqueda manual" |
| 🟠 Naranja | Inscripción cancelada o **retirada** (borrada o movida a Anulaciones) | **INSCRIPCIÓN RETIRADA** · "Derivar a supervisor". Un lector máster puede **reactivar y registrar** en el mismo paso |
| 🔵 Azul | Antes de la apertura (operadores) | **PRÓXIMAMENTE INICIA EL EVENTO** |
| ⚪ Aviso extra | ID creado tras el corte | Etiqueta **STICKER A MANO** sobre el verde |

Tras el verde: botones grandes **Continuar** · **Deshacer** · **Observación**. Continuar vuelve a la cámara. El registro ya está hecho al mostrarse el verde (flujo optimista); Deshacer lo revierte.

**Antirrebote:** el mismo token en el mismo teléfono dentro de 3 s se ignora (evita dobles lecturas del mismo gesto).

### 10.4 Funciones adicionales del lector

- **Búsqueda manual** por nombre, empresa o ID → confirmar → registra con Origen = Manual. Para quien no tiene QR, batería ni correo.
- **Registro en sitio**: Nombre, Empresa, Cargo, Correo, Celular, Fuente. Crea fila en "Registro en sitio" y Maestro, asigna el siguiente ID de esa sigla, marca Llegó (Origen = En sitio), muestra el ID con "STICKER A MANO" y encola credencial + bienvenida.
- **Reenviar credencial** al correo de la persona (desde el resultado o la búsqueda).
- **Observación** con texto libre, guardada en la columna X y en Bitácora.
- **Historial** de los últimos 20 registros del dispositivo, con opción de deshacer según rol.
- **Contador** de registros del lector y total general.
- **Indicador de conexión:** "En línea" / "Sin señal · N registros guardados en el teléfono".
- **Pantalla siempre encendida** (Wake Lock) y linterna si el dispositivo lo permite.

### 10.5 Funcionamiento sin conexión

- Al abrir en modo REAL, el lector descarga el padrón mínimo: token → UID, ID, nombre, empresa, tipo, estado, sticker impreso. Se refresca cada 60 s si hay señal.
- Sin señal: valida contra el padrón local, muestra el color correspondiente y guarda el registro en una cola local con `clientId` único.
- Al volver la señal: envía la cola. El servidor es **idempotente** por `clientId`. Si dos mesas registraron a la misma persona sin conexión, gana la hora más temprana y la otra queda en Bitácora como DUPLICADO.
- Limitación asumida: sin conexión, un lector no ve lo que registró otro lector también sin conexión en ese mismo instante.

### 10.6 Tecnología

- `html5-qrcode` (versión fijada) para la cámara. HTTPS vía GitHub Pages.
- PWA instalable (manifest + service worker) para abrir rápido desde la pantalla de inicio.
- Sonidos distintos para éxito y error, vibración con la Vibration API (Android; iPhone solo sonido).

---

## 11. Panel en vivo (/panel)

- **Link único, abierto, sin PIN** (decisión de Fedexpor).
- Por esa razón el panel **no muestra correo ni celular**, solo: ID, nombre, empresa, cargo, tipo, estado, hora de llegada, lector.
- Actualización automática cada 15 s. Responsive (móvil y escritorio), modo claro/oscuro.
- Contenido:
  - Contadores: Esperados (activos) · Llegaron · Faltan · % asistencia
  - Barras por tipo de inscrito (llegaron / esperados)
  - Registros por mesa y por lector
  - Curva de llegadas por franjas de 15 min
  - Buscador en vivo (nombre, empresa, ID)
  - Pestañas: Llegaron · Faltan · Registro en sitio
  - Últimos 10 ingresos
- **Rendimiento:** la respuesta del panel se cachea 10 s (`CacheService`) para que muchos espectadores no saturen Apps Script (límite ~30 ejecuciones simultáneas).

---

## 12. Recuperación de credencial (/recuperar)

QR impreso en un cartel al inicio de la fila: "¿No tienes tu credencial? Escanea aquí."

**Sin código de verificación.** La persona escribe su correo y el sistema le **reenvía la credencial a esa misma dirección**. El QR nunca se muestra en pantalla.

1. La persona ingresa su correo.
2. El sistema responde siempre lo mismo: "Si estás inscrito con ese correo, recibirás tu credencial en unos segundos" (no revela quién está inscrito).
3. Si el correo corresponde a una persona activa, Brevo reenvía su credencial adjunta, con el link de la agenda.
4. Si el correo corresponde a **varias personas**, se envían todas las credenciales en el mismo mensaje, cada una rotulada con su nombre. Ya no hace falta pantalla de selección.
5. Límite: **3 reenvíos por dirección por hora**, para que nadie sature el buzón de otro.
6. Cada reenvío queda en la Bitácora, con hora y correo.
7. **Recuperar la credencial nunca registra asistencia.** La persona debe pasar igual por la mesa.

### Por qué este diseño es seguro sin código

El archivo solo llega al buzón del titular. Aunque un tercero escriba el correo de otra persona, no obtiene nada: la credencial no aparece en pantalla, solo se envía. El peor caso posible es una molestia, y el límite de 3 por hora lo contiene.

### Límite conocido

Exige que la persona pueda abrir su correo en la fila. Quien no pueda (sin datos, sin batería, sin acceso al buzón) se atiende por **búsqueda manual** desde el lector, que es más rápido y sigue disponible.

---

## 13. API (Web App de Apps Script)

| Método | action | Quién | Descripción |
|---|---|---|---|
| GET | `config` | Público | Estado del evento, modo, hora de apertura |
| GET | `padron` | Lector (clave) | Padrón mínimo para validación local |
| GET | `panel` | Público | Datos del panel (cacheados) |
| POST | `checkin` | Lector | `{token, lector, clientId, horaDispositivo}` |
| POST | `checkin_manual` | Lector | `{uid, lector, clientId}` |
| POST | `deshacer` | Lector | `{uid, lector, clientId}` con reglas de rol |
| POST | `observacion` | Lector | `{uid, texto, lector}` |
| POST | `en_sitio` | Lector | Datos de la persona nueva |
| POST | `reenviar` | Lector | `{uid}` |
| POST | `modo` | Máster | `{modo: PRUEBA|REAL}` |
| POST | `reenviar_credencial` | Público | `{correo}` → reenvía por Brevo; respuesta siempre neutra |
| POST | `brevo_webhook` | Brevo | Estado de entrega |

Todas las escrituras usan `LockService.getScriptLock()` con espera máxima de 10 s y registran en Bitácora. Respuestas JSON con `{ok, codigo, mensaje, datos}`.

---

## 14. Reporte final

Opción de menú "Generar reporte final" → pestaña Reporte + exportación a Excel y PDF:

- Resumen: esperados, llegaron, faltan, % asistencia, registros en sitio, registros manuales
- Por tipo de inscrito
- Por empresa
- Por mesa y lector
- Llegadas por franja horaria
- Lista de asistentes con hora
- Lista de ausentes
- Observaciones
- Correos rebotados y personas sin correo/celular
- Resumen de la Bitácora (duplicados, inválidos, deshacer)

---

## 15. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Caída de datos móviles en el Marriott | Modo sin conexión con padrón local; WiFi del hotel como respaldo; lista impresa |
| Cuatro lectores escribiendo a la vez | LockService + idempotencia por clientId |
| Persona escaneó su propio QR antes | El QR abre /c, que no escribe nada; solo lectores con clave registran |
| QR falsificado con otro número | El QR contiene un token aleatorio, no el ID |
| Credencial reenviada a otra persona tras delegación | "Regenerar token" invalida el QR anterior |
| Logo al centro impide la lectura | Corrección H, isotipo ≤ 20 %, prueba en 3 teléfonos |
| Correos en spam o rebotados | Dominio autenticado en Brevo, webhook de rebotes, revisión el lunes |
| Persona sin QR en la fila | Cartel de recuperación que reenvía la credencial al correo + búsqueda manual en la mesa |
| Panel abierto reenviado a externos | Panel sin correo ni celular |
| Error del operador | Deshacer + historial + Bitácora |
| Pruebas ensucian datos reales | Modo PRUEBA separado + "Limpiar pruebas" |
| Generación masiva excede tiempo | Lotes con trigger de continuación |
| Muchos espectadores del panel | Caché de 10 s |
| Batería agotada | Power banks, Wake Lock solo durante registro |

---

## 16. Cronograma (fechas reales)

**Hoy es domingo 27 de septiembre. El evento es el miércoles 30.** El cierre de la lista es mañana lunes 28 a las 12:00, y los stickers se imprimen con los números que asigna el sistema. Por eso la etapa 1 **tiene** que quedar en producción hoy o mañana temprano.

| Día | Qué pasa | Quién |
|---|---|---|
| **Dom 27 · hoy** | Instalación y conexión (fases 1 a 4). **Etapa 1** en PRUEBAS con T1–T15, y **paso parcial a producción de la etapa 1**. Si hay logos: etapa 2. Si hay tiempo: etapa 3 | Responsable + Claude Code |
| **Lun 28 · mañana** | Antes de las 12:00: equipos completan pestañas faltantes. **12:00** cierre → Sincronizar Maestro en la hoja real → **13:00** exportar lista de stickers → imprenta. Tarde: etapas 2 y 3 si faltan; generación de credenciales | Responsable + Claude Code |
| **Mar 29** | Etapa 4 (lector, panel, páginas) y etapa 5. **Simulacro de 15 min con los 4 operadores**. Paso a producción completo. Stickers recibidos y ordenados | Responsable + Equipo |
| **Mié 30** | 06:45 montaje · 07:00 limpiar pruebas y activar modo REAL · 08:30 inicio | Máster |

**Envíos: a criterio del responsable.** No tienen hora asignada.

### Camino crítico

`Etapa 1 aprobada y en producción (hoy) → cierre lun 12:00 → stickers lun 13:00`

`Logos (hoy) → credencial aprobada → credenciales generadas → envío`

`Lector aprobado (mar) → simulacro (mar) → evento (mié)`

### Si el tiempo no alcanza: qué se recorta y qué nunca

| Se puede recortar, en este orden | Alternativa |
|---|---|
| Reporte final | Se construye después del evento; los datos ya estarán en el Maestro |
| Curva horaria y desgloses del panel | El panel queda con contadores, buscador y listas |
| Página /recuperar | Búsqueda manual desde el lector |
| Modo sin conexión del lector | WiFi del hotel como respaldo + lista impresa |

| **Nunca se recorta** |
|---|
| Estabilidad del ID (A9) y casos T1–T15 |
| Solo lectores autorizados registran (D10) |
| Interruptor maestro de envíos (C2) |
| QR con token aleatorio (B5) |

---

## 17. Checklist del día del evento

**La noche anterior**
- [ ] 4 teléfonos cargados al 100 % + 2 power banks + cables
- [ ] Lector instalado como app en cada teléfono, con su clave ya ingresada
- [ ] Un quinto teléfono de respaldo con el lector configurado
- [ ] Stickers ordenados por sigla y número, separados por rango y por mesa
- [ ] Stickers en blanco + marcador para los IDs `NR`
- [ ] Lista impresa de respaldo (una por ID, una alfabética)
- [ ] Cartel de recuperación impreso y plastificado

**06:45 en el Marriott**
- [ ] Probar un escaneo en cada teléfono **en modo PRUEBA**
- [ ] Verificar señal de datos en los 4 teléfonos; WiFi del hotel como respaldo
- [ ] Panel abierto en la pantalla de coordinación
- [ ] Cartel de recuperación colocado al inicio de la fila

**07:00**
- [ ] Máster ejecuta "Limpiar pruebas"
- [ ] Máster activa **modo REAL**
- [ ] Confirmar con cada operador que su pantalla ya no dice "PRUEBA"
- [ ] Supervisor asignado para los casos naranjas (cancelados) y amarillos (código inválido)

---

## 18. Decisiones confirmadas por Fedexpor

| Tema | Decisión |
|---|---|
| Siglas | P · D · A · E · S · B · I · F · **NR** (registro el día del evento) |
| Numeración | Orden actual de cada pestaña, sin orden alfabético |
| Cédula | No se usa en ningún lado |
| Correo | Brevo, remitente "Fedexpor" desde el correo institucional |
| WhatsApp | Links wa.me, envío manual desde **2 teléfonos** (~150 mensajes cada uno) |
| Agenda | Siempre por link al micrositio de Canva |
| Credencial | **Formato vertical**, diseñada por Claude con los logos de Fedexpor |
| Logos | Fedexpor, Convención, Academy Fedexpor, Proyecto Sumarse, Hilton Foundation + 1 pendiente. Isotipo X al centro del QR |
| Envíos | **Manuales, sin programación.** Interruptor maestro apagado por defecto. El responsable decide cuándo |
| Bienvenida | Automática al escanear, con interruptor propio apagado por defecto |
| Links WhatsApp | Se generan todos juntos desde el menú, cuando el responsable lo pida |
| Cierre de lista | Lunes 12:00 |
| Impresión | Lunes en la tarde |
| Simulacro | Lunes en la tarde, 15 minutos |
| Lectores | 4 operadores (M1-A, M1-B, M2-A, M2-B) + **2 lectores máster** |
| Registro | Solo llegada, sin salida. Una entrada, dos mesas |
| Colores en la hoja | Solo verde cuando llega. Sin rojo |
| Panel | Link único, abierto, sin PIN. Sin correo ni celular visibles |
| Recuperación | Reenvío directo de la credencial al correo inscrito, sin código |
| Tono | Formal y corporativo |
| Hosting | GitHub Pages (cuenta propia) |

---

## 18-bis. Estado de los datos (revisión del 26/09)

| Pestaña | Personas con nombre | Observaciones |
|---|---|---|
| Lista pagados | **71** | Todos "Confirmado". 3 sin correo ni teléfono. 1 correo compartido por 2 personas |
| SUMARSE | 30 filas, **5 útiles** | 25 dicen "Por confirmar": son cupos por empresa y quedan excluidos |
| AUSPICIANTES | 0 | Pestaña creada, sin datos |
| EXPOSITORES | 0 | Pestaña creada, sin datos |
| Diplomado, B2B, Invitados, Fedexpor | — | **Pestañas aún no creadas** |
| ⛔Anulaciones | 5 | Excluida |

**Total procesable hoy: ~76 personas** de las ~300 esperadas.

### Casos que requieren acción de Fedexpor

- **Sin correo ni teléfono (3):** tres personas de una misma empresa en Pagados. No pueden recibir credencial por ningún canal. Quedarán en la lista y en el padrón del lector, y se atenderán en la mesa por búsqueda manual. El sistema los marca con la alerta "Sin correo ni celular".
- **Correo compartido (2):** dos personas de Pagados usan la misma dirección de correo. Confirmado como correcto por Fedexpor. Reciben dos correos separados, y un reenvío a esa dirección lleva las dos credenciales rotuladas con su nombre.

---

## 18-ter. Decisiones del 27/09 (prevalecen sobre lo anterior)

| Tema | Decisión |
|---|---|
| Entorno | Se trabaja sobre la **hoja real** (no hay copia de pruebas de la hoja real). T1–T15 se ejecutan en una **hoja nueva con datos ficticios** y la misma estructura |
| `Estado del Cliente` | Ignorada. Toda persona con nombre válido en una pestaña declarada es activa |
| Pestañas nuevas | Solo **OTROS**, duplicando AUSPICIANTES vacía. Diplomado, B2B, Invitados y Fedexpor no se crean |
| Diplomado / B2B | Subcategorías de Lista pagados, por palabra clave en la columna de observaciones (normalizada, sin tildes ni espacios). Siglas **PD** y **PB**, cada una con su propio contador desde 1 (1P, 1PD, 1PB). Si la observación dice Diplomado **y** B2B: queda como **P** con la alerta "Revisar: Diplomado y B2B a la vez" |
| Sigla de OTROS | **OT** |
| Cambio de pestaña | Igual que el cambio de subcategoría: antes del corte se reasigna el ID con la sigla nueva; después del corte queda fijo con "Cambió de fuente" |
| Posible duplicado | Alerta "Revisar: posible duplicado de <ID>" en ambas personas cuando todas las palabras del nombre más corto (mín. 2, sin "de/la/…") están en el otro, o mismo correo en pestañas distintas. Solo avisa: nunca une ni borra. Se recalcula en cada sincronización |
| Correo | **Gmail desde la cuenta del responsable (MailApp), no Brevo** (29/09: no fue posible generar la API key). Nombre visible "Fedexpor". Mismo interruptor ENVIOS_HABILITADOS, confirmación con conteo y Bitácora. Sin triggers de tiempo |
| Elegir destinatarios | Casilla «Enviar correo» (col. M) en el Maestro + menú «Enviar … a las casillas marcadas». Marcar no envía; al enviar, la casilla se desmarca |
| Cupos | CUPO en Config (AUSPICIANTES → columna AUSPICIANTE; SUMARSE → Empresa). Fila con dueño y sin nombre, «Por confirmar» o «Dueño N» = cupo con ID/QR «Invitado N de DUEÑO» (N fijo). Persona escrita en el cupo conserva ID y QR. OBSERVACIONES con «REVISAR» = alerta de excedente. AUSPICIANTES no va por correo: carpeta de Drive por auspiciante |
| Lista para imprenta | Pestaña Stickers: ID, Nombre, Empresa, Cargo, Tipo, Sticker impreso, ordenada por sigla y número. Aprobada tal cual |
| Cambio de subcategoría | **Antes** de "Marcar corte de impresión": el ID se reasigna solo (47P → 13PD); el número anterior queda quemado, nunca se reutiliza, y se registra en la Bitácora. **Después** del corte: el ID queda fijo y se marca la alerta "Cambió de tipo" |
| Zona horaria de la hoja | Estaba en America/Los_Angeles. La etapa 1 la cambia a America/Guayaquil |

---

## 19. Dónde vive el sistema

| Componente | Debe estar en |
|---|---|
| Hoja de cálculo | Google Workspace institucional de Fedexpor |
| Proyecto Apps Script y despliegue web | La misma cuenta institucional. **Nunca una cuenta personal** |
| Carpeta de credenciales en Drive | La misma cuenta institucional |
| Repositorio y GitHub Pages | Cuenta de GitHub del responsable |
| Claude Code | Computador de trabajo, autenticado en Google con la cuenta institucional |

Motivos: el Apps Script se ejecuta con la identidad de quien lo despliega; Workspace da 6 horas diarias de ejecución por triggers (frente a 90 minutos en cuentas personales), necesarias para la cola de correos y la generación por lotes; y la propiedad de los datos debe quedar en la organización.

**Durante la etapa de diseño no se comparte la hoja real.** Basta con una copia que tenga los encabezados y los nombres de pestaña verdaderos y unas pocas filas de datos ficticios. Los datos reales de las ~300 personas nunca salen del Workspace institucional (LOPDP Ecuador).

**Continuidad entre equipos y cuentas:** `SPEC.md` y `CLAUDE.md` en el repositorio son la fuente de verdad. El historial de conversación no se transfiere entre cuentas; los archivos sí.

---

## 20. Entornos

| Entorno | Hoja | Uso |
|---|---|---|
| **PRUEBAS** | Copia de la hoja real | Todo el desarrollo, los casos T1–T15, el simulacro y las pruebas de envío |
| **PRODUCCIÓN** | Hoja real | Recibe el sistema **por etapas**, cada una solo cuando el responsable escribe "pasa a producción la etapa N" |

**Paso parcial obligatorio de la etapa 1.** Los números de sticker deben asignarse sobre la hoja real antes del cierre del lunes 28 a las 12:00, porque es ahí donde el equipo sigue editando. La copia de PRUEBAS queda desactualizada en cuanto se crea. Por eso, apenas la etapa 1 pase T1–T15 en PRUEBAS, se sube a PRODUCCIÓN **solo** el módulo de sincronización, identificadores, exportación de stickers y la pestaña LÉEME. En ese momento no existe todavía ningún código de envío en producción.

Los identificadores de ambos scripts están en `CONFIG_EVENTO.md` (excluido del repositorio). El frontend en GitHub Pages apunta a la URL del Web App de PRUEBAS durante el desarrollo, y se cambia a la de PRODUCCIÓN en el paso a producción.

---

## 21. Pendientes de entrega

**Bloqueantes (hoy)**
1. Los 6 logos en PNG transparente o SVG + el isotipo X por separado
2. Nombre del sexto logo de proyecto
3. Texto institucional obligatorio de la credencial
4. Link de la hoja de Google Sheets con permisos de edición

**Antes del sábado**
5. Correo institucional exacto del remitente
6. Link del micrositio de Canva (agenda) + PDF para redactar los correos
7. Límite diario del plan Brevo
8. Correo de prueba para el modo PRUEBA
9. Claves de operador: definir 4 + 2 máster
10. Confirmar los nombres exactos de las 8 pestañas
11. Confirmar si hay personas inscritas con el mismo correo
