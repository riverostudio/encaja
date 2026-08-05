#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
ENCAJA_REPO="/Users/victorrivero/encaja"
ENCAJA_DRIVE="/Users/victorrivero/Library/CloudStorage/GoogleDrive-data.victore115@gmail.com/Mi unidad/Mi unidad/Encaja (ayudas publicas)"
ENCAJA_LOCK="/tmp/app.encaja.publicar.lock"

if ! /bin/mkdir "$ENCAJA_LOCK" 2>/dev/null; then
  echo "Ya hay una publicación de Encaja en curso."
  exit 0
fi
trap '/bin/rmdir "$ENCAJA_LOCK" 2>/dev/null || true' EXIT

cd "$ENCAJA_REPO"
echo "[$(/bin/date -Iseconds)] Sincronización diaria"
/opt/homebrew/bin/npm run sync:espana
/opt/homebrew/bin/npm run public:db
/opt/homebrew/bin/npm run lint
/opt/homebrew/bin/npm test
/opt/homebrew/bin/npm run test:links
/opt/homebrew/bin/npm run build:public
/opt/homebrew/bin/npx vercel deploy --prod --yes
# El alias personalizado no forma parte de los dominios automáticos del
# proyecto; se vuelve a apuntar a su alias estable de producción.
/opt/homebrew/bin/npx vercel alias set encaja-app-xi.vercel.app usar-encaja.vercel.app
/opt/homebrew/bin/npm run test:prod

ENCAJA_TMP=$(/usr/bin/mktemp -d /tmp/encaja-publicar.XXXXXX)
trap '/bin/rmdir "$ENCAJA_LOCK" 2>/dev/null || true; /bin/rm -f "$ENCAJA_TMP"/* 2>/dev/null || true; /bin/rmdir "$ENCAJA_TMP" 2>/dev/null || true' EXIT

/usr/bin/gzip -c data/radar-publico.db > "$ENCAJA_TMP/radar-publico.db.gz"
/usr/bin/gzip -c data/radar.db > "$ENCAJA_TMP/radar.db.gz"
/usr/bin/git archive --format=zip --output="$ENCAJA_TMP/codigo-fuente-encaja.zip" HEAD

/bin/mv "$ENCAJA_TMP/radar-publico.db.gz" "$ENCAJA_DRIVE/Copia de seguridad/radar-publico.db.gz"
/bin/mv "$ENCAJA_TMP/radar.db.gz" "$ENCAJA_DRIVE/Copia de seguridad/radar.db.gz"
/bin/mv "$ENCAJA_TMP/codigo-fuente-encaja.zip" "$ENCAJA_DRIVE/Copia de seguridad/codigo-fuente-encaja.zip"

echo "[$(/bin/date -Iseconds)] Publicación y copias terminadas"
