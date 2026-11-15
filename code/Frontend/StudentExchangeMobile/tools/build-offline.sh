#!/bin/sh
# Package with installed Android tools when Gradle sockets are restricted.
set -eu
cd "$(dirname "$0")/.."
SDK_DIR=${ANDROID_HOME:-/Users/robertrichardson/Library/Android/sdk}
JAVA_DIR=${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}
export JAVA_HOME="$JAVA_DIR"
export PATH="$JAVA_DIR/bin:$PATH"
BUILD_TOOLS="$SDK_DIR/build-tools/36.0.0"
ANDROID_JAR="$SDK_DIR/platforms/android-34/android.jar"
OUT=app/build/offline
mkdir -p "$OUT/compiled" "$OUT/generated" "$OUT/classes" "$OUT/dex" app/build/outputs/apk/debug
"$BUILD_TOOLS/aapt2" compile --dir app/src/main/res -o "$OUT/compiled/resources.zip"
sed 's/<manifest /<manifest package="com.studentexchange.mobile" /' app/src/main/AndroidManifest.xml > "$OUT/AndroidManifest.xml"
"$BUILD_TOOLS/aapt2" link -o "$OUT/base.apk" -I "$ANDROID_JAR" --manifest "$OUT/AndroidManifest.xml" --java "$OUT/generated" --min-sdk-version 26 --target-sdk-version 34 --version-code 1 --version-name 1.0 "$OUT/compiled/resources.zip"
find app/src/main/java "$OUT/generated" -name '*.java' > "$OUT/sources.txt"
javac -g -encoding UTF-8 --release 17 -classpath "$ANDROID_JAR" -d "$OUT/classes" @"$OUT/sources.txt"
jar cf "$OUT/classes.jar" -C "$OUT/classes" .
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output "$OUT/dex" "$OUT/classes.jar"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q ../unsigned.apk classes*.dex)
"$BUILD_TOOLS/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
if [ ! -f "$OUT/debug.keystore" ]; then
 keytool -genkeypair -keystore "$OUT/debug.keystore" -storepass android -keypass android -alias androiddebugkey -dname 'CN=Android Debug,O=Android,C=US' -keyalg RSA -validity 10000
fi
rm -f app/build/outputs/apk/debug/app-debug.apk app/build/outputs/apk/debug/app-debug.apk.idsig
"$BUILD_TOOLS/apksigner" sign --v4-signing-enabled false --ks "$OUT/debug.keystore" --ks-pass pass:android --out app/build/outputs/apk/debug/app-debug.apk "$OUT/aligned.apk"
"$BUILD_TOOLS/apksigner" verify app/build/outputs/apk/debug/app-debug.apk
printf 'Built app/build/outputs/apk/debug/app-debug.apk\n'
