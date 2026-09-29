# Paso a paso · Entregar el proyecto a Claude Code

Guía para montar el sistema de credenciales QR en el **computador de trabajo**, con la **cuenta Claude Pro de Fedexpor** y la **cuenta Google Workspace institucional**.

> ⏰ **Calendario real:** hoy es **domingo 27**. El cierre de la lista es el **lunes 28 a las 12:00** y los stickers se imprimen ese día. El evento es el **miércoles 30**. Lo único que no puede esperar a mañana es la **etapa 1 en la hoja real**.

Tiempo total de preparación: unos **45 minutos**. Después, la construcción avanza por etapas, y en cada una tú revisas antes de seguir.

---

## Fase 0 · Ten esto a mano antes de empezar

| Qué | Para qué | Dónde va |
|---|---|---|
| Computador de trabajo con permiso para instalar programas | Instalar las herramientas | — |
| Cuenta **Claude Pro de Fedexpor** | Iniciar sesión en Claude Code | Claude Code |
| Cuenta **Google Workspace institucional** (dueña de la hoja) | Conectar el script a la hoja | Navegador |
| Cuenta de **GitHub** | Publicar el lector y el panel | Navegador |
| Este kit descomprimido (5 archivos) | Todo el contexto del proyecto | Carpeta del proyecto |
| Los **6 logos** en PNG transparente o SVG | Diseño de la credencial | `assets/logos/` |
| El **isotipo X** por separado | Centro del QR | `assets/logos/` |
| **API key de Brevo** | Envío de correos | **La pegas tú** en Apps Script. Nunca en el chat |

---

## Fase 1 · Instalar las herramientas (15 min)

Haz esto una sola vez. Abre **PowerShell** en Windows o **Terminal** en Mac.

**1. Git**
- Windows: descarga e instala **Git for Windows** desde `git-scm.com`. Deja todas las opciones por defecto. Claude Code lo necesita en Windows.
- Mac: escribe `git --version`. Si no lo tiene, el sistema te ofrece instalarlo.

**2. Node.js**
- Descarga la versión **LTS** desde `nodejs.org` e instálala con las opciones por defecto.
- Lo necesita `clasp`, la herramienta que conecta con Apps Script.

**3. Claude Code**
- Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
- Mac: `curl -fsSL https://claude.ai/install.sh | bash`
- Si algo falla, la guía oficial está en `code.claude.com/docs/en/quickstart`.

**4. clasp**
- En la terminal: `npm install -g @google/clasp`

**5. Verificar**

Cierra la terminal, ábrela de nuevo y escribe estos cuatro comandos. Cada uno debe responder con un número de versión:

```
git --version
node --version
claude --version
clasp --version
```

Si alguno dice "no se reconoce el comando", repite su instalación.

---

## Fase 2 · Preparar Google (10 min)

Todo esto con la **cuenta institucional**. Si en el navegador tienes varias cuentas de Google, revisa arriba a la derecha que esté activa la de Fedexpor.

**6. Activar la API de Apps Script**
- Entra a `script.google.com/home/usersettings`
- Activa **API de Google Apps Script**.
- ⚠️ Si el interruptor está bloqueado o gris, el administrador de Google Workspace de Fedexpor lo tiene deshabilitado. Pídele a TI que lo habilite para tu cuenta. **Sin esto no se puede continuar.**

**7. Crear la copia de pruebas**
- Abre la hoja real → **Archivo → Hacer una copia**.
- Nómbrala: `XVIII Convención · COPIA DE PRUEBAS`.
- **Todo se construye y se prueba primero aquí.** La hoja real recibe cada etapa solo cuando tú lo autorizas.

**8. Obtener el ID del script de PRUEBAS**
- En la copia: **Extensiones → Apps Script**.
- Arriba a la izquierda, cambia el nombre del proyecto a `Sistema QR Fedexpor · PRUEBAS`.
- En el menú lateral, abre **⚙️ Configuración del proyecto**.
- Copia el **ID de la secuencia de comandos** y pégalo en `CONFIG_EVENTO.md`, en el campo `SCRIPT_ID_PRUEBAS`.

**9. Obtener el ID del script de PRODUCCIÓN**
- Repite el paso 8 en la **hoja real**. Nombre: `Sistema QR Fedexpor · PRODUCCIÓN`.
- Pega su ID en `SCRIPT_ID_PRODUCCION`.
- No se sube nada ahí hasta que tú escribas "pasa a producción la etapa N". La etapa 1 va hoy mismo, apenas pase sus pruebas.

---

## Fase 3 · Preparar la carpeta del proyecto (5 min)

**10.** Crea una carpeta, por ejemplo en Documentos: `fedexpor-convencion-qr`

**11.** Descomprime ahí el kit. La carpeta debe quedar así:

```
fedexpor-convencion-qr/
├── CLAUDE.md            ← reglas del proyecto (Claude Code lo lee solo)
├── SPEC.md              ← especificación completa
├── FLUJO.md             ← flujograma con las aristas numeradas
├── INSTALACION.md       ← esta guía
├── CONFIG_EVENTO.md     ← datos del evento que llenas tú
└── assets/
    └── logos/           ← créala y pon aquí los logos
```

**12.** Pon los logos en `assets/logos/` con estos nombres:

```
isotipo-x.png
fedexpor.png
convencion.png
academy-fedexpor.png
proyecto-sumarse.png
hilton-foundation.png
logo-proyecto-6.png
```

(Si alguno es SVG, usa la extensión `.svg`.)

**13.** Llena `CONFIG_EVENTO.md`. Lo que no tengas todavía, déjalo vacío: Claude Code te lo preguntará en vez de inventarlo.

---

## Fase 4 · Conectar Claude Code a la hoja (10 min)

**14. Abrir Claude Code en la carpeta**
- Windows: abre la carpeta en el Explorador, haz clic en la barra de dirección, escribe `powershell` y presiona Enter.
- Mac: en Terminal, `cd ` (con espacio), arrastra la carpeta a la ventana y presiona Enter.
- Escribe `claude` y presiona Enter.
- La primera vez se abre el navegador para iniciar sesión. **Usa la cuenta Claude Pro de Fedexpor.**

**15. Pegar el primer mensaje**

Copia y pega esto tal cual:

```
Hola. Vas a construir el sistema de credenciales QR de la XVIII Convención
de Exportadores de Fedexpor.

Regla principal: todo lo que necesites de mí pídemelo SIEMPRE con la
herramienta AskUserQuestion (preguntas de opción múltiple), como indican
las reglas 35 a 42 de CLAUDE.md. No me hagas preguntas sueltas en texto
y no supongas: pregunta.

Antes de escribir cualquier código:
1. Lee completos CLAUDE.md, SPEC.md y FLUJO.md.
2. Lee CONFIG_EVENTO.md. Si un dato está vacío, pregúntamelo con
   AskUserQuestion; no lo inventes.
3. Resúmeme en 10 líneas qué entendiste, y hazme tus dudas con
   AskUserQuestion.

Después, SOLO la conexión:
4. Inicializa git y crea un .gitignore que excluya CONFIG_EVENTO.md,
   cualquier .xlsx o .csv y cualquier archivo con datos de personas.
   El repositorio será público.
5. Ejecuta clasp login. Yo completo el inicio de sesión en el navegador
   con la cuenta institucional.
6. Clona en la carpeta apps-script/ el proyecto de PRUEBAS
   (SCRIPT_ID_PRUEBAS de CONFIG_EVENTO.md).
7. NO uses el SCRIPT_ID_PRODUCCION hasta que yo escriba
   "pasa a producción la etapa N". Solo subes esa etapa y las anteriores.
8. Sube solo un menú "Fedexpor QR" con la opción "Probar conexión",
   que muestre sin escribir nada en la hoja: las pestañas encontradas,
   la fila de encabezado detectada en cada una y cuántas filas con
   nombre tiene cada pestaña.
9. Avísame para que recargue la hoja y lo pruebe.

No avances a la etapa 1 hasta que yo confirme que la conexión funciona.
```

Claude Code te pedirá permiso antes de ejecutar comandos. Léelos y acepta los de `git`, `npm` y `clasp`.

**Cómo responder sus preguntas.** Cuando Claude Code necesite algo, verás en la terminal una pregunta con opciones. Muévete con las **flechas ↑ ↓** y confirma con **Enter**. Si ninguna opción sirve, o necesitas escribir un dato como un link o un correo, elige **Otro** (Other) y escríbelo. Si trae varias preguntas juntas, las verás como pestañas: respóndelas todas antes de enviar.

⚠️ **Nunca escribas la API key de Brevo ni las claves de operador en la opción Otro.** Esas van solo en Apps Script. Si Claude Code te pregunta por una clave, la respuesta correcta es la opción "Ya la pegué en Propiedades".

⚠️ **No dejes una pregunta sin responder y te vayas.** Claude Code puede continuar solo si pasa un rato sin respuesta. Por eso las acciones irreversibles, como subir a producción, siempre exigen además que escribas una frase literal.

**16. Verificar la conexión (el punto de control más importante)**
- Recarga la **COPIA DE PRUEBAS** en el navegador.
- Debe aparecer el menú **Fedexpor QR** junto a Ayuda.
- Haz clic en **Probar conexión**.
- Google pedirá autorización. Como es un script propio, mostrará "Google no verificó esta app": haz clic en **Configuración avanzada → Ir a Sistema QR Fedexpor (no seguro)** → **Permitir**.
- Debe mostrarte tus pestañas (Lista pagados, SUMARSE, AUSPICIANTES, EXPOSITORES), la fila 14 como encabezado y cuántas personas hay en cada una.

✅ **Si ves eso, Claude Code ya está conectado a tu hoja.** Respóndele "conexión confirmada".

---

## Fase 5 · Construcción por etapas

Cada etapa termina con algo que **tú** revisas. No le digas que avance hasta que la revisión esté bien. Copia el mensaje de cada etapa cuando corresponda.

> En todas las etapas, Claude Code cierra con una pregunta de opción múltiple: **"Aprobado, sigue"**, **"Hay que corregir algo"** o **"Necesito revisar más"**. Solo elige "Aprobado" después de hacer tu revisión.

### Etapa 1 · Sincronización, identificadores y stickers ⏰ HOY

**Esta etapa tiene que estar en la hoja real antes del lunes 28 a las 12:00.** Los stickers se imprimen con los números que asigna el sistema, y el equipo sigue editando la hoja real, no la copia.

```
Conexión confirmada. Avanza con los pasos 1 y 2 del orden de construcción
de CLAUDE.md (Config, pestañas de soporte, Ids, Sync), más las opciones
de menú "Exportar lista para stickers" y "Marcar corte de impresión", y
la pestaña LÉEME. Trabaja solo en PRUEBAS. Al terminar, ejecuta los casos
T1 a T15 de SPEC §5-ter sobre la copia y muéstrame el resultado de cada
uno en una tabla.
```

**Tú revisas:** que los 15 casos digan "pasó", que la pestaña Maestro tenga a cada persona con su número (1P, 2P, 1S…) y que la lista de stickers exportada se vea como la necesita la imprenta.

**Cuando esté aprobada, escribe literalmente:**

```
pasa a producción la etapa 1
```

Claude Code sube a la hoja real **solo** este módulo: no hay nada de envíos todavía. Luego repites el paso 16 en la hoja real (recargar, ver el menú, autorizar) y ejecutas **Sincronizar Maestro** una vez para verificar.

⚠️ Avisa a tu equipo que desde ese momento la hoja tiene una columna oculta nueva y una pestaña **⚠️ LÉEME**. Pueden seguir trabajando normalmente.

**Lunes 28:** a las 12:00 ejecutas **Sincronizar Maestro** en la hoja real, luego **Marcar corte de impresión** y **Exportar lista para stickers**, y mandas ese archivo a la imprenta.

### Etapa 2 · Credencial

```
Etapa 1 aprobada. Paso 3: credencial vertical. Los logos están en
assets/logos/. Genera solo 5 credenciales de muestra y dime dónde verlas.
No generes las demás.
```

**Tú revisas:** el diseño, y **escaneas las 5 con tres celulares distintos** (un iPhone y dos Android), desde la pantalla y con brillo bajo. Si alguno no lee, se ajusta antes de seguir.

### Etapa 3 · Correo con Brevo

```
Diseño aprobado. Paso 4: Brevo. Dime el nombre exacto de la propiedad
donde debo pegar la API key y confírmalo conmigo con AskUserQuestion;
la pego yo en Apps Script. Envía UN solo correo de prueba a mi correo.
ENVIOS_HABILITADOS debe quedar en NO.
```

**Tú haces:** en el editor de Apps Script de PRUEBAS → ⚙️ Configuración del proyecto → **Propiedades de la secuencia de comandos** → Agregar → pega el nombre que te dé y tu API key de Brevo.

**Tú revisas:** que el correo llegue a la bandeja de entrada (no a spam), con la credencial adjunta y el link de la agenda.

### Etapa 4 · Lector, panel y páginas públicas

```
Correo aprobado. Pasos 5, 6 y 7: API, lector, panel, /c y /recuperar.
Crea el repositorio en mi GitHub y publícalo en GitHub Pages. Dime cómo
definir las claves de los 4 operadores y los 2 máster.
```

**Tú haces:** defines las 6 claves y las pegas en Propiedades de la secuencia de comandos, igual que la de Brevo.

**Tú revisas:** con 4 celulares, en **modo PRUEBA**: verde, rojo, amarillo, naranja y azul; deshacer; búsqueda manual; registro en sitio. Y abres el panel desde tu celular.

### Etapa 5 · Reporte y paso a producción

```
Lector aprobado. Paso 8: reporte final. Después prepárame la lista de
verificación para pasar a producción las etapas 2 a 5. No hagas clasp
push a PRODUCCIÓN hasta que yo escriba "pasa a producción la etapa 5".
```

**Tú revisas** la lista de verificación y, cuando todo esté en orden, escribes **"pasa a producción la etapa 5"**. Claude Code sube el resto del sistema a la hoja real, cambia el lector y el panel para que apunten a producción, y tú repites el paso 16.

> Las etapas 2, 3 y 4 también pueden subirse a producción una por una, con "pasa a producción la etapa N", si necesitas generar o enviar credenciales antes de terminar todo.

---

## Reglas de seguridad durante todo el proyecto

- **Nunca pegues en el chat de Claude Code** la API key de Brevo ni las claves de operador. Van solo en Propiedades de la secuencia de comandos.
- **Nunca subas a GitHub** la hoja exportada ni datos de personas. Si tu cuenta de GitHub es gratuita, el repositorio de GitHub Pages es **público**.
- **Todo se prueba en la COPIA.** La hoja real recibe cada etapa solo cuando tú escribes "pasa a producción la etapa N".
- **Ningún envío masivo** antes de que la etapa 3 esté aprobada y tú actives el interruptor.

---

## Si algo sale mal

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `clasp login` dice "acceso bloqueado" o "app bloqueada" | Política del Workspace de Fedexpor | Pedir a TI que permita clasp / Apps Script API para tu cuenta |
| El interruptor de la API de Apps Script no se puede activar | Deshabilitado por el administrador | Igual: TI de Fedexpor |
| No aparece el menú "Fedexpor QR" | La hoja no se recargó, o el push fue a otro proyecto | Recargar con Ctrl+Shift+R. Pedir a Claude Code que confirme el Script ID usado |
| "No tienes permiso para llamar a…" | Falta autorizar el script | Repetir la autorización del paso 16 |
| "Exceeded maximum execution time" en la hoja | Un proceso pasó los 6 minutos de Apps Script | Pedir a Claude Code que revise el procesamiento por lotes (CLAUDE.md, "Generación masiva") |
| Claude Code avisa que llegaste al límite de uso | Límite del plan Pro | Espera y retoma. Todo el contexto vive en los archivos: al volver, escribe "continúa donde quedamos según CLAUDE.md" |
| Claude Code propone saltarse un caso de prueba | — | No lo aceptes. Los casos T1–T15 son obligatorios |
| Claude Code te pregunta algo en texto, sin opciones | Se olvidó de la regla | Respóndele: "Pregúntamelo con AskUserQuestion, regla 35 de CLAUDE.md" |
| Claude Code avanzó sin preguntarte algo importante | Supuso en vez de preguntar | Detenlo con Esc y dile: "No supongas. Pregúntame con AskUserQuestion" |
| En Windows, Claude Code pide "git-bash" | Falta Git for Windows | Instalarlo (paso 1) y reiniciar la terminal |

---

## Para retomar otro día

Abre la terminal en la carpeta del proyecto y escribe `claude`. Claude Code lee `CLAUDE.md` automáticamente al iniciar en esa carpeta. Escríbele:

```
Retomamos. Revisa en qué etapa quedamos y qué falta. Recuerda: todo
lo que necesites de mí, con AskUserQuestion.
```
