#!/bin/sh
# Sube Casa de Cambio a GitHub la primera vez: repo público, firma del APK como secreto, Pages y primera corrida.
set -e
cd "$(dirname "$0")"
U=$(gh api user --jq .login)
[ -d .git ] || git init -q -b main
git config user.name "$U"; git config user.email "$U@users.noreply.github.com"
git add -A && git commit -qm "Casa de Cambio" || true
gh repo view "$U/casa-de-cambio" >/dev/null 2>&1 || gh repo create casa-de-cambio --public --description "Conversor de monedas" >/dev/null
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$U/casa-de-cambio.git"
gh auth setup-git
base64 -i android/firma/firma.p12 | gh secret set FIRMA_B64 -R "$U/casa-de-cambio"
gh secret set FIRMA_CLAVE -R "$U/casa-de-cambio" < android/firma/clave.txt
gh api -X POST "repos/$U/casa-de-cambio/pages" -f build_type=workflow >/dev/null 2>&1 || true
git push -qu origin main
echo "App:  https://$U.github.io/casa-de-cambio/"
echo "APK:  https://github.com/$U/casa-de-cambio/releases/latest/download/CasaDeCambio.apk"
