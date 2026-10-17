#!/usr/bin/env bash
# Builds web assets -> Capacitor sync -> debug + release-signed APK into ../android/
# Needs: JDK 17 (JAVA_HOME), Android SDK 34 + build-tools 34.0.0 (ANDROID_HOME).
# Release signing: KEYSTORE (default ~/dev/keys/bb-release.jks), alias boomerangbrawl, password in $KSPW.
# Create a local keystore once:  keytool -genkeypair -keystore bb-release.jks -alias boomerangbrawl -keyalg RSA -keysize 2048 -validity 10000
set -euo pipefail
cd "$(dirname "$0")"
: "${JAVA_HOME:?set JAVA_HOME to a JDK 17}"; : "${ANDROID_HOME:?set ANDROID_HOME}"
BT="$ANDROID_HOME/build-tools/34.0.0"; KEYSTORE="${KEYSTORE:-$HOME/dev/keys/bb-release.jks}"
export BUILD="${BUILD:-v2.0-$(date +%Y%m%d-%H%M)}"
npm install --no-audit --no-fund
(cd .. && node build.mjs --min --app)
npx cap sync android
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
(cd android && ./gradlew assembleDebug assembleRelease --no-daemon)
mkdir -p ../android
cp android/app/build/outputs/apk/debug/app-debug.apk ../android/BoomerangBrawl-debug.apk
if [ -f "$KEYSTORE" ] && [ -n "${KSPW:-}" ]; then
  "$BT/zipalign" -f -p 4 android/app/build/outputs/apk/release/app-release-unsigned.apk /tmp/bb-aligned.apk
  "$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias boomerangbrawl --ks-pass env:KSPW --key-pass env:KSPW --out ../android/BoomerangBrawl.apk /tmp/bb-aligned.apk
  rm -f ../android/*.idsig; "$BT/apksigner" verify ../android/BoomerangBrawl.apk && echo "release APK signed"
else echo "No keystore/KSPW: skipped release signing (debug APK still built)"; fi
ls -la ../android
