#!/usr/bin/env bash
# Construit l'APK release signé de Tessel pour la version X.Y.Z donnée.
# Appelé par semantic-release (prepareCmd). Nécessite les variables ANDROID_KEYSTORE_PATH,
# ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD et ANDROID_HOME.
set -euo pipefail

if [[ $# -ne 1 || ! $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage : $0 X.Y.Z" >&2
  exit 2
fi
VERSION="$1"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

: "${ANDROID_KEYSTORE_PATH:?ANDROID_KEYSTORE_PATH est requis (keystore de signature)}"
: "${ANDROID_KEYSTORE_PASSWORD:?ANDROID_KEYSTORE_PASSWORD est requis}"
: "${ANDROID_KEY_ALIAS:?ANDROID_KEY_ALIAS est requis}"
: "${ANDROID_KEY_PASSWORD:?ANDROID_KEY_PASSWORD est requis}"
[[ -f "$ANDROID_KEYSTORE_PATH" ]] || { echo "Keystore introuvable : $ANDROID_KEYSTORE_PATH" >&2; exit 1; }

SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[[ -n "$SDK_ROOT" ]] || { echo "ANDROID_HOME (ou ANDROID_SDK_ROOT) est requis" >&2; exit 1; }

# apksigner le plus récent (tri par version)
APKSIGNER="$(ls -d "$SDK_ROOT"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -n 1 || true)"
[[ -n "$APKSIGNER" ]] || { echo "apksigner introuvable dans $SDK_ROOT/build-tools" >&2; exit 1; }

echo "==> Build web (v$VERSION)"
TESSEL_VERSION="$VERSION" npm run build

echo "==> Synchronisation Capacitor"
npx cap sync android

echo "==> Assemblage de l'APK release"
(cd android && TESSEL_VERSION="$VERSION" ./gradlew assembleRelease --no-daemon)

APK_SRC="android/app/build/outputs/apk/release/app-release.apk"
[[ -f "$APK_SRC" ]] || { echo "APK introuvable : $APK_SRC (release non signée ?)" >&2; exit 1; }

echo "==> Vérification de la signature ($APKSIGNER)"
"$APKSIGNER" verify --verbose "$APK_SRC"

OUT_DIR="dist-release"
APK_NAME="tessel-v$VERSION.apk"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp "$APK_SRC" "$OUT_DIR/$APK_NAME"
(cd "$OUT_DIR" && sha256sum "$APK_NAME" > "$APK_NAME.sha256")

echo "==> Artefacts prêts"
ls -l "$OUT_DIR"
cat "$OUT_DIR/$APK_NAME.sha256"
