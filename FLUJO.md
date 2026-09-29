# Flujograma del sistema · XVIII Convención de Exportadores

Cada flecha está numerada. Para corregir algo, cítame el número de la arista (por ejemplo "cambia D7") y lo ajusto.

**Leyenda de responsables:** 🧑 Responsable Fedexpor · 🤖 Sistema · 👥 Equipo de mesa · 🧍 Asistente

---

## Flujo A · Cargar y sincronizar la lista

El sistema reconoce a cada persona aunque su fila se **mueva**, se **borre** o se **corte a Anulaciones**. La columna UID es solo una pista: se verifica con el nombre y el correo, y se repara sola en cada sincronización.

```mermaid
flowchart TD
    CFG["Config<br/>lista blanca de pestañas"]
    MENU(["🧑 Menú: Sincronizar Maestro"])
    ORIG["Pestañas origen"]
    ANUL["⛔ Anulaciones<br/>nunca se lee"]
    LEER["Leer filas<br/>encabezado por búsqueda"]
    VAL{"¿Fila válida?"}
    OMIT["Omitidas<br/>sin nombre · 'Por confirmar'"]
    P1{"¿UID y nombre<br/>o correo coinciden?"}
    MISMA["Misma persona<br/>conserva ID y token"]
    P3{"¿Coincide por correo?<br/>incluye Retirados"}
    RECUP["Recupera su ID<br/>vuelve a Activo"]
    NUEVO["Persona nueva<br/>UID, número y token"]
    AMBIG["Revisar<br/>coincidencia ambigua"]
    MAE[("Maestro")]
    RET["Ausentes → Retirado<br/>más de 5: confirmar"]
    REPARA["Reescribir columna UID"]
    INF["Informe"]

    CFG -->|A1| MENU
    ORIG -->|A2| LEER
    ANUL -.->|A3 nunca se lee| LEER
    MENU -->|A4| LEER
    LEER -->|A5| VAL
    VAL -->|A6 no| OMIT
    VAL -->|A7 sí| P1
    P1 -->|A8 no| P3
    P1 -->|A9 sí| MISMA
    P3 -->|A10 única| RECUP
    P3 -->|A11 ninguna| NUEVO
    P3 -->|A12 varias| AMBIG
    MISMA -->|A13| MAE
    RECUP -->|A14| MAE
    NUEVO -->|A15| MAE
    MAE -->|A16| RET
    RET -->|A17| REPARA
    REPARA -->|A18| INF
```

| # | Qué pasa exactamente | Si falla |
|---|---|---|
| **A1** | Se leen las pestañas declaradas en la lista blanca de Config. | Si Config está vacío, no corre y avisa. |
| **A2** | Solo pestañas declaradas. Filas ocultas o filtradas **sí se leen**: filtrar no hace desaparecer a nadie. | — |
| **A3** | Anulaciones nunca se lee. Cortar a alguien de Pagados y pegarlo ahí lo hace desaparecer, y pasa a Retirado en A16. | — |
| **A4** | Arranca a mano. Nunca por fecha ni por trigger. | — |
| **A5** | Busca la fila con el encabezado «Nombre» y localiza columnas por su texto. | Encabezado faltante o pestaña inexistente: **se detiene**. Nunca retira a sus personas. |
| **A6** | Nombre vacío o «Por confirmar»: se omite y se reporta. | — |
| **A7** | Fila válida: hay que reconocer a quién pertenece. | — |
| **A8** | Sin UID, o UID desalineado: cambiaron **a la vez** nombre y correo. Pasa al mover solo celdas visibles o escribir encima de otra persona. | — |
| **A9** 🔴 | UID existe y coincide nombre **o** correo: misma persona, **conserva su número y token**. | Si el número cambiara al editar datos, los stickers impresos no servirían. |
| **A10** | Coincide por correo (o correo + nombre si es compartido, o nombre + empresa si no tiene correo), **incluso si estaba Retirada**: recupera su número original. | Es el caso del borrado por error y reescrito a mano. Sin esto, habría duplicados. |
| **A11** | No coincide con nadie: persona nueva, siguiente número. Los números nunca se reutilizan. | — |
| **A12** | Más de un candidato: no adivina, queda en Alertas. | — |
| **A13–A15** | Se escribe en el Maestro por lotes y con bloqueo. | — |
| **A16** | Quien no apareció en ninguna pestaña pasa a **Retirado**: fuera de envíos, conteo y panel. **Una llegada registrada nunca se revierte.** | Más de 5 retirados de golpe: pausa y pide confirmación con nombres. |
| **A17** | Se reescribe la columna UID en todas las filas. La desalineación se repara sola. | — |
| **A18** | Informe: leídas, omitidas, nuevas, recuperadas y retiradas, con nombre. | — |

---

## Flujo B · Generar la credencial

```mermaid
flowchart TD
    MAE[("Maestro")]
    TRIG(["🧑 Menú 'Generar credenciales'<br/>o casilla de una fila"])
    MIN{"¿Tiene nombre<br/>y empresa?"}
    SKIP["Se salta<br/>y queda en Alertas"]
    QR["Generar imagen del QR<br/>token aleatorio + isotipo X al centro<br/>corrección de error alta"]
    TPL["Copiar la plantilla vertical<br/>y rellenar nombre, empresa, cargo,<br/>tipo, ID grande y nombre del evento"]
    PNG["Exportar PNG"]
    DRV[("Drive<br/>carpeta de credenciales")]
    CEL["Escribir el link en la fila<br/>columna 'Credencial'"]
    LOTE{"¿Quedan<br/>pendientes?"}
    CONT["Trigger de continuación<br/>retoma donde se quedó"]
    FIN["Listo"]

    MAE -->|B1| TRIG
    TRIG -->|B2| MIN
    MIN -->|B3 no| SKIP
    MIN -->|B4 sí| QR
    QR -->|B5| TPL
    TPL -->|B6| PNG
    PNG -->|B7| DRV
    DRV -->|B8| CEL
    CEL -->|B9| LOTE
    LOTE -->|B10 sí| CONT
    CONT -->|B11| MIN
    LOTE -->|B12 no| FIN
```

| # | Qué pasa exactamente | Si falla |
|---|---|---|
| **B1** | Se trabaja sobre las filas activas del Maestro, nunca sobre las pestañas origen. | — |
| **B2** | Se dispara a mano: todos los pendientes, solo la selección, o una sola fila. | — |
| **B3** | Sin nombre o sin empresa no hay credencial. Queda registrado en Alertas. | — |
| **B4** | Datos suficientes para el diseño. El correo **no** es requisito: puede tener credencial y recibirla en la mesa. | — |
| **B5** | El QR codifica un link con el token. **Nunca el ID, el nombre ni el correo.** | Si el servicio de QR no responde, reintenta 3 veces y marca error en esa fila. |
| **B6** | Se copia la plantilla y se reemplazan los textos. El ID va en grande porque es lo que la mesa busca. | — |
| **B7** | Se guarda como `47P - Nombre Apellido.png`, con permiso de lectura por link. | — |
| **B8** | El link queda en la fila de esa persona. | — |
| **B9–B11** | Apps Script corta cada ejecución a los 6 minutos. El proceso trabaja en lotes de 5 minutos, guarda su avance y continúa solo. | Si se corta, al reanudar no repite las ya generadas. |
| **B12** | Fin. Te informa cuántas generó y cuántas fallaron. | — |

---

## Flujo C · Enviar credenciales

```mermaid
flowchart TD
    TRIG(["🧑 Menú 'Enviar credencial'<br/>o casilla de una fila"])
    SW{"Interruptor maestro<br/>ENVIOS_HABILITADOS"}
    STOP["Bloqueado<br/>'Envíos deshabilitados'"]
    CONF{"🧑 Confirmación<br/>'Vas a enviar N correos'"}
    CANCEL["Cancelado"]
    TIENE{"¿Tiene correo<br/>y credencial?"}
    ALERTA["Queda en Alertas<br/>se atenderá en la mesa"]
    BREVO["Brevo envía<br/>remitente Fedexpor<br/>credencial adjunta + link agenda"]
    EST["Estado del correo en su fila"]
    HOOK["Webhook de Brevo<br/>entregado · rebotado · spam"]
    WA(["🧑 Menú 'Generar links WhatsApp'"])
    COLWA["Se llenan los 300 links de una vez"]
    ENVWA["👥 Dos teléfonos<br/>abren el link y envían"]
    MARCA["🧑 Marca la casilla 'WA enviado'"]

    TRIG -->|C1| SW
    SW -->|C2 NO| STOP
    SW -->|C3 SI| CONF
    CONF -->|C4 rechaza| CANCEL
    CONF -->|C5 acepta| TIENE
    TIENE -->|C6 no| ALERTA
    TIENE -->|C7 sí| BREVO
    BREVO -->|C8| EST
    BREVO -->|C9| HOOK
    HOOK -->|C10| EST
    WA -->|C11| COLWA
    COLWA -->|C12| ENVWA
    ENVWA -->|C13| MARCA
```

| # | Qué pasa exactamente | Si falla |
|---|---|---|
| **C1** | Todo envío es manual. **No hay ningún correo programado por fecha.** | — |
| **C2** | El interruptor arranca en NO. Con NO, ninguna ruta del sistema puede enviar, ni siquiera por error. | Escribe "Envíos deshabilitados" en la fila. No envía nada. |
| **C3** | Solo tú lo cambias a SÍ, desde el menú. Se recomienda volverlo a NO al terminar cada tanda. | — |
| **C4 / C5** | Antes de un envío masivo te muestra cuántos van, con qué plantilla y quiénes quedan fuera. | — |
| **C6** | Sin correo o sin credencial no se envía. Esas personas llegarán sin QR y se atienden en la mesa. | — |
| **C7 / C8** | Sale por Brevo desde el correo institucional. La credencial va adjunta y también incrustada. | Si Brevo rechaza, guarda el error en la fila y sigue con el siguiente. No corta la tanda. |
| **C9 / C10** | Brevo avisa después si el correo se entregó o rebotó. Eso permite corregir direcciones antes del evento. | — |
| **C11** | Los links de WhatsApp se generan todos juntos, cuando tú lo pidas. Antes de eso la columna está vacía. | Si el celular no se puede normalizar a +593, marca "Celular inválido". |
| **C12 / C13** | Envío manual desde dos teléfonos, unos 150 cada uno. WhatsApp no permite adjuntar por esta vía, así que va el link. | — |

---

## Flujo D · El día del evento (el flujo crítico)

```mermaid
flowchart TD
    LLEGA["🧍 La persona llega a la mesa"]
    TIENE{"¿Trae su QR?"}
    CARTEL["🧍 Cartel de recuperación<br/>ver Flujo E"]
    BUSCA["👥 Búsqueda manual<br/>por nombre o empresa"]
    ESTA{"¿Está en<br/>la lista?"}
    NUEVO["👥 Registro en sitio<br/>asigna ID nuevo tipo 12NR"]
    SCAN["👥 Escanear con el lector"]
    ROL{"¿Lector autorizado<br/>con clave válida?"}
    NADA["No registra nada"]
    MODO{"¿Modo REAL?"}
    PRUEBA["Va a la pestaña Pruebas<br/>no afecta datos reales"]
    HORA{"¿Ya son las 07:00<br/>o es un máster?"}
    PRE["🔵 Pantalla azul<br/>'Próximamente inicia el evento'"]
    TOKEN{"¿Token válido?"}
    MALO["🟡 Pantalla amarilla<br/>'Código no válido'"]
    YA{"¿Ya ingresó<br/>antes?"}
    DUP["🔴 Pantalla roja<br/>'Ya ingresó 08:42 Mesa 1-B'"]
    OK["🟢 Pantalla verde<br/>ID grande + nombre + empresa + tipo"]
    ESCRIBE["Maestro: fila en verde<br/>+ hora + lector"]
    BIT[("Bitácora")]
    SWB{"¿Bienvenida<br/>automática ON?"}
    COLA["Cola de correos<br/>sale en menos de 1 min"]
    ACC{"👥 ¿Qué hace<br/>el operador?"}
    CONT["Continuar<br/>vuelve a la cámara"]
    DESH["Deshacer<br/>la fila vuelve a blanco"]
    OBS["Observación<br/>texto libre en su fila"]
    STICK["👥 Buscar el sticker por el ID<br/>pegarlo y entregar la credencial"]
    PUERTA["👥 Puerta: verificar<br/>credencial colgada"]

    LLEGA -->|D1| TIENE
    TIENE -->|D2 no| CARTEL
    TIENE -->|D3 no lo logra| BUSCA
    BUSCA -->|D4| ESTA
    ESTA -->|D5 no| NUEVO
    ESTA -->|D6 sí| ESCRIBE
    CARTEL -->|D7| SCAN
    TIENE -->|D8 sí| SCAN
    NUEVO -->|D9| ESCRIBE
    SCAN -->|D10| ROL
    ROL -->|D11 no| NADA
    ROL -->|D12 sí| MODO
    MODO -->|D13 no| PRUEBA
    MODO -->|D14 sí| HORA
    HORA -->|D15 no| PRE
    HORA -->|D16 sí| TOKEN
    TOKEN -->|D17 no| MALO
    TOKEN -->|D18 sí| YA
    YA -->|D19 sí| DUP
    YA -->|D20 no| OK
    OK -->|D21| ESCRIBE
    ESCRIBE -->|D22| BIT
    ESCRIBE -->|D23| SWB
    SWB -->|D24 sí| COLA
    OK -->|D25| ACC
    ACC -->|D26| CONT
    ACC -->|D27| DESH
    ACC -->|D28| OBS
    DESH -->|D29| BIT
    OBS -->|D30| BIT
    OK -->|D31| STICK
    STICK -->|D32| PUERTA
    MALO -->|D33| BUSCA
```

| # | Qué pasa exactamente | Si falla |
|---|---|---|
| **D1** | Una sola entrada, dos mesas, cuatro lectores. | — |
| **D2** | Si no tiene el QR, se le señala el cartel de recuperación que está en la fila. | — |
| **D3** | Si no puede recuperarlo (sin batería, sin datos, sin acceso al correo), el operador lo busca a mano. | — |
| **D4 / D5** | Búsqueda por nombre o empresa dentro del lector. | — |
| **D5** | No está en ninguna lista: registro en sitio. Recibe un ID nuevo con sigla **NR** y sticker escrito a mano. | — |
| **D6** | Está en la lista pero sin QR: se marca llegada igual, con origen "Manual". | — |
| **D7 / D8** | El escaneo solo ocurre en la mesa, nunca en la puerta. | — |
| **D9** | El registro en sitio marca llegada de inmediato y encola su credencial y bienvenida. | — |
| **D10 / D11** | **La arista de seguridad más importante.** Si el QR se escanea con la cámara común del celular, se abre una página informativa que **no escribe nada**. Solo un lector con clave válida puede registrar. | Sin clave, el lector no deja pasar de la pantalla de configuración. |
| **D12 / D13** | En modo PRUEBA todo funciona igual pero se guarda aparte. Sirve para el simulacro del lunes sin ensuciar datos. | — |
| **D14 / D15** | Los operadores no pueden registrar antes de las 07:00. Los dos lectores máster sí, siempre. | — |
| **D16 / D17** | Se valida el token contra el padrón. Un QR inventado o ajeno al evento cae aquí. | — |
| **D18 / D19** | Si el token ya fue usado, sale rojo con la hora y la mesa donde entró. Evita la doble entrega de credencial. | — |
| **D20 / D21** | Verde a pantalla completa con sonido y vibración. **El registro ya está hecho cuando aparece el verde**, no se espera confirmación. | Sin señal, valida contra el padrón local y guarda en cola. Sincroniza al volver la conexión. |
| **D22** | Todo queda en la bitácora: hora, lector, acción. Nada se borra nunca. | — |
| **D23 / D24** | La bienvenida tiene su propio interruptor, independiente del maestro. Si está apagado, el ingreso se registra igual. | El lector **nunca espera** al correo. Va por cola. |
| **D25–D28** | Tres botones tras el verde: continuar, deshacer, observación. | — |
| **D27 / D29** | Deshacer devuelve la fila a blanco. Los operadores pueden deshacer sus últimos 5, dentro de 10 minutos. Los máster, cualquiera. | — |
| **D31 / D32** | El operador busca el sticker por el número, lo pega y entrega. En la puerta solo se verifica que la lleve puesta. | Si el ID es tipo NR, el lector avisa "sticker a mano". |
| **D33** | Un código inválido siempre deriva a búsqueda manual. Nunca se deja a alguien afuera por un QR que no leyó. | — |

---

## Flujo E · Recuperar la credencial en la fila

```mermaid
flowchart TD
    CART["🧍 Escanea el cartel<br/>'¿No tienes tu código?'"]
    FORM["Ingresa su correo"]
    RESP["Mensaje siempre igual:<br/>'Si estás inscrito,<br/>recibirás tu credencial'"]
    EXISTE{"¿Está inscrito<br/>con ese correo?"}
    NADA["No se envía nada<br/>no se revela quién está inscrito"]
    LIM{"¿Menos de 3 envíos<br/>en la última hora?"}
    ESPERA["Bloqueado<br/>espere unos minutos"]
    ENVIO["Brevo reenvía la credencial<br/>SOLO a ese correo"]
    BIT[("Bitácora")]
    ABRE["🧍 Abre su correo<br/>y muestra el QR"]
    MESA["Pasa igual por la mesa"]

    CART -->|E1| FORM
    FORM -->|E2| RESP
    FORM -->|E3| EXISTE
    EXISTE -->|E4 no| NADA
    EXISTE -->|E5 sí| LIM
    LIM -->|E6 no| ESPERA
    LIM -->|E7 sí| ENVIO
    ENVIO -->|E8| BIT
    ENVIO -->|E9| ABRE
    ABRE -->|E10| MESA
```

| # | Qué pasa exactamente | Por qué |
|---|---|---|
| **E1** | Un QR impreso al inicio de la fila abre esta página. Nada que instalar. | — |
| **E2** | El mensaje es el mismo exista o no el correo. | Si dijera "no estás inscrito", cualquiera podría averiguar quién asiste. |
| **E3 / E4** | Si el correo no está en la lista, no se envía nada, pero la pantalla no lo delata. | — |
| **E5 / E6** | Máximo tres reenvíos por hora y por dirección. | Evita que alguien sature el buzón de otra persona. |
| **E7** | **Sin código de verificación.** Brevo reenvía la credencial directamente a la dirección registrada. El QR nunca se muestra en pantalla. | Nadie puede obtener la credencial de otro escribiendo su correo: el archivo solo llega al buzón del titular. |
| **E8** | Cada reenvío queda en la bitácora, con hora y correo. | — |
| **E9** | La persona abre el mensaje en su celular y muestra el QR. Si el correo tiene dos inscritos, van las dos credenciales en el mismo mensaje, cada una con su nombre. | Por eso ya no hace falta la pantalla de "elige tu nombre". |
| **E10** | Recuperar la credencial **nunca marca llegada.** | Solo los lectores de la mesa registran asistencia. |

> **Límite conocido:** este camino exige que la persona pueda abrir su correo en la fila. Quien no pueda (sin datos, sin batería, sin acceso al buzón) se atiende por **búsqueda manual** desde el lector, que es la arista **D5**.

---

## Flujo F · Panel en vivo y reporte

```mermaid
flowchart TD
    MAE[("Maestro")]
    API["Consulta cada 15 segundos<br/>respuesta en caché 10 s"]
    PANEL["Panel<br/>link abierto, sin PIN"]
    CONT2["Contadores<br/>esperados · llegaron · faltan"]
    TIPO["Desglose por tipo y por mesa"]
    CURVA["Llegadas por franja horaria"]
    BUSC["Buscador por nombre, empresa o ID"]
    LIST["Listas: llegaron · faltan · en sitio"]
    REP(["🧑 Menú 'Generar reporte final'"])
    XLS["Excel y PDF<br/>asistencia, ausentes, observaciones,<br/>rebotes y bitácora"]

    MAE -->|F1| API
    API -->|F2| PANEL
    PANEL -->|F3| CONT2
    PANEL -->|F4| TIPO
    PANEL -->|F5| CURVA
    PANEL -->|F6| BUSC
    PANEL -->|F7| LIST
    MAE -->|F8| REP
    REP -->|F9| XLS
```

| # | Qué pasa exactamente | Nota |
|---|---|---|
| **F1** | El panel lee del Maestro, no escribe nunca. | Un espectador no puede alterar nada. |
| **F2** | La respuesta se guarda en caché 10 segundos. | Sin esto, 20 personas mirando el panel saturan el sistema y el lector se pone lento. |
| **F3–F7** | Todo responsive, móvil y computador. | **No muestra correo ni celular**, porque el link es abierto. |
| **F8 / F9** | El reporte se genera cuando lo pidas, las veces que quieras. | — |

---

## Las cinco aristas donde el sistema se cae si están mal

1. **D10** · Si cualquiera pudiera registrar llegadas, el conteo pierde todo valor. Es el error que ocurrió en tu evento anterior.
2. **A9** · Si la misma persona cambiara de número al editar sus datos o al mover su fila, los stickers impresos dejarían de servir.
3. **C2** · Sin el interruptor maestro, un clic accidental envía 300 correos que no se pueden deshacer.
4. **D20** · Si el lector esperara la respuesta del servidor para mostrar el verde, la fila se detendría con cada segundo de latencia.
5. **F2** · Sin caché, el panel compite con los lectores por el mismo recurso y ambos se vuelven lentos justo en la hora pico.
