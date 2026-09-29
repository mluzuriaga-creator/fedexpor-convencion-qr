#!/usr/bin/env bash
# Sube el Apps Script a un entorno.
#
#   scripts/subir.sh pruebas
#   scripts/subir.sh produccion <N> "pasa a producción la etapa <N>"
#
# PRUEBAS recibe todo (src/ + pruebas/). PRODUCCIÓN recibe SOLO los archivos de las etapas 1..N
# y nunca pruebas/. Los Script ID se leen de CONFIG_EVENTO.md (excluido del repositorio).
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
cfg="$raiz/CONFIG_EVENTO.md"
src="$raiz/apps-script/src"

# Archivos por etapa (acumulativos).
ETAPA_1="appsscript.json Utils.gs Config.gs Ids.gs Sync.gs Stickers.gs Instalar.gs Menu.gs"
ETAPA_2="QrLib.gs Qr.gs Credencial.gs"
ETAPA_3="Correo.gs WhatsApp.gs"
ETAPA_4="Api.gs Checkin.gs"

leer() { grep -m1 "^- $1:" "$cfg" | sed "s/^- $1:[[:space:]]*//" | tr -d '\r' | xargs; }

entorno="${1:-}"
case "$entorno" in
  pruebas)
    id="$(leer SCRIPT_ID_PRUEBAS)"
    archivos="$(cd "$src" && ls) "
    extra="$raiz/apps-script/pruebas"
    ;;
  produccion)
    etapa="${2:-}"; frase="${3:-}"
    if [ -z "$etapa" ] || [ "$frase" != "pasa a producción la etapa $etapa" ]; then
      echo "✖ Producción exige: scripts/subir.sh produccion <N> \"pasa a producción la etapa <N>\"" >&2; exit 1
    fi
    id="$(leer SCRIPT_ID_PRODUCCION)"
    archivos=""
    for n in $(seq 1 "$etapa"); do
      var="ETAPA_$n"
      [ -n "${!var:-}" ] || { echo "✖ La etapa $n no está definida en este script" >&2; exit 1; }
      archivos="$archivos ${!var}"
    done
    extra=""
    ;;
  *) echo "Uso: $0 pruebas | produccion <N> \"pasa a producción la etapa <N>\"" >&2; exit 1 ;;
esac

[ -n "$id" ] || { echo "✖ Falta el Script ID de $entorno en CONFIG_EVENTO.md" >&2; exit 1; }

build="$raiz/apps-script/build/$entorno"
rm -rf "$build"; mkdir -p "$build"
for f in $archivos; do cp "$src/$f" "$build/"; done
[ -n "$extra" ] && cp "$extra"/*.gs "$build/"
printf '{\n  "scriptId": "%s",\n  "rootDir": "."\n}\n' "$id" > "$build/.clasp.json"

echo "Destino: $entorno (…${id: -5})"
echo "Archivos: $(cd "$build" && ls | tr '\n' ' ')"
if [ "$entorno" = "produccion" ]; then
  faltan=""
  for f in $(cd "$src" && ls); do case " $archivos " in *" $f "*) ;; *) faltan="$faltan $f" ;; esac; done
  [ -n "$faltan" ] && echo "No se suben (etapas posteriores):$faltan"
fi
# Verificación: los archivos deben poder cargarse en el orden en que los ejecuta Apps Script (alfabético).
node -e '
const fs=require("fs"),vm=require("vm"),d=process.argv[1];
const fs2=fs.readdirSync(d).filter(f=>f.endsWith(".gs")).sort((a,b)=>a.localeCompare(b));
const c={console};vm.createContext(c);
try{for(const f of fs2)vm.runInContext(fs.readFileSync(d+"/"+f,"utf8"),c,{filename:f});}
catch(e){console.error("✖ El código falla al cargar ("+e.message+"). No se sube nada.");process.exit(1);}
console.log("✔ Carga en orden de Apps Script: OK");' "$build"
cd "$build" && clasp push --force
