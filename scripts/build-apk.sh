#!/usr/bin/env bash
# Builds the Android APK with the SDK tools only (aapt2, javac, d8, zipalign, apksigner): no Gradle, no
# network. Output: build/two-dragons-<version>.apk
#
# The APK bundles the web game (index.html, css, js) in assets/www. Its sound effects are WAV files
# pre-rendered from js/audio.js (build/sounds, re-rendered by scripts/render-sounds.sh when missing or
# older than js/audio.js) and played by the native SoundPool (window.NativeAudio, see MainActivity.java).
# The launcher icon is generated from tools/icon.html. Neither is kept in the project: no asset files.
#
# Variables: VERSION_CODE (integer, raise it for each new release), VERSION_NAME,
#            KEYSTORE_PASS (password of android/two-dragons.keystore, created on the first run).
set -euo pipefail
cd "$(dirname "$0")/.."

SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
BT="$SDK/build-tools/34.0.0"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"
KEYSTORE="android/two-dragons.keystore"
KEYSTORE_PASS="${KEYSTORE_PASS:-two-dragons-local}"
FF_DIR="$HOME/snap/firefox/common/two-dragons-icon"   # snap Firefox can only write there

OUT="build/android"
APK="build/two-dragons-$VERSION_NAME.apk"
WWW="$OUT/assets/www"
rm -rf "$OUT"
mkdir -p "$WWW/sounds" "$OUT/res" "$OUT/gen" "$OUT/classes" "$OUT/dex"

echo "1/6 Web game and sound effects"
for s in place-x place-o win-x win-o draw invalid click swish; do
  if [ ! -f "build/sounds/$s.wav" ] || [ js/audio.js -nt "build/sounds/$s.wav" ]; then
    scripts/render-sounds.sh
    break
  fi
done
cp index.html "$WWW/"
cp -r css js "$WWW/"
cp build/sounds/*.wav "$WWW/sounds/"

echo "2/6 Launcher icon"
mkdir -p "$FF_DIR/profile"
rm -f "$FF_DIR/icon.png"
firefox --headless --no-remote --profile "$FF_DIR/profile" --window-size=1024,1024 \
  --screenshot "$FF_DIR/icon.png" "file://$PWD/tools/icon.html" >/dev/null 2>&1
[ -f "$FF_DIR/icon.png" ] || { echo "Icon rendering failed (headless Firefox)"; exit 1; }
cp "$FF_DIR/icon.png" "$OUT/icon-source.png"
python3 - "$OUT/icon-source.png" "$OUT/res" <<'PY'
import os, sys
from PIL import Image, ImageDraw, ImageFilter
src, res = sys.argv[1], sys.argv[2]

img = Image.open(src).convert('RGB')
side = min(img.size)
img = img.crop((0, 0, side, side))
# Background colour: the paper at the corners, so the layers join seamlessly.
corners = [img.getpixel(p) for p in [(4, 4), (side - 5, 4), (4, side - 5), (side - 5, side - 5)]]
bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

def save(density, name, image):
    os.makedirs(f'{res}/mipmap-{density}', exist_ok=True)
    image.save(f'{res}/mipmap-{density}/{name}.png')

scales = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for density, k in scales.items():
    # Adaptive icon (Android 8+): the whole artwork is the 108 dp foreground layer; the launcher shows
    # its central 72 dp, cut to its own shape. tools/icon.html keeps the seals inside the 66 dp safe circle.
    canvas = round(108 * k)
    fg = img.resize((canvas, canvas), Image.LANCZOS)
    save(density, 'ic_launcher_foreground', fg)

    # Monochrome layer (Android 13+ themed icons): the seal silhouettes, letters cut out. Keyed on
    # saturation, so the greyish drop shadows and the ivory letters both drop out.
    sat = fg.convert('HSV').getchannel('S').filter(ImageFilter.GaussianBlur(canvas / 160))
    mono = sat.point(lambda v: 255 if v > 75 else 0).filter(ImageFilter.MedianFilter(5))
    layer = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    layer.paste(Image.new('RGBA', (canvas, canvas), (255, 255, 255, 255)), (0, 0), mono)
    save(density, 'ic_launcher_monochrome', layer)

    # Legacy icons (Android 7): the central 72 dp of the artwork, rounded square and circle, 48 dp.
    size = round(48 * k)
    m = side // 6
    legacy = img.crop((m, m, side - m, side - m)).resize((size, size), Image.LANCZOS)
    for name, shape in [('ic_launcher', 'rounded'), ('ic_launcher_round', 'circle')]:
        mask = Image.new('L', (size, size), 0)
        draw = ImageDraw.Draw(mask)
        if shape == 'circle':
            draw.ellipse((0, 0, size - 1, size - 1), fill=255)
        else:
            draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 5, fill=255)
        icon = legacy.convert('RGBA')
        icon.putalpha(mask)
        save(density, name, icon)

os.makedirs(f'{res}/values', exist_ok=True)
with open(f'{res}/values/ic_launcher.xml', 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            f'    <color name="ic_launcher_background">#{bg[0]:02X}{bg[1]:02X}{bg[2]:02X}</color>\n</resources>\n')
os.makedirs(f'{res}/mipmap-anydpi-v26', exist_ok=True)
for name in ['ic_launcher', 'ic_launcher_round']:
    with open(f'{res}/mipmap-anydpi-v26/{name}.xml', 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@color/ic_launcher_background" />\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
                '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />\n'
                '</adaptive-icon>\n')
PY

echo "3/6 Resources and manifest (aapt2)"
"$BT/aapt2" compile --dir "$OUT/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/unsigned.apk" -I "$ANDROID_JAR" \
  --manifest android/AndroidManifest.xml -A "$OUT/assets" -0 wav --java "$OUT/gen" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  "$OUT/res.zip"

echo "4/6 Java code (javac + d8)"
javac --release 11 -nowarn -classpath "$ANDROID_JAR" -d "$OUT/classes" \
  android/src/fr/twodragons/game/MainActivity.java $(find "$OUT/gen" -name '*.java')
"$BT/d8" --release --min-api 24 --lib "$ANDROID_JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
python3 - "$OUT/unsigned.apk" "$OUT/dex/classes.dex" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'a', zipfile.ZIP_DEFLATED) as apk:
    apk.write(sys.argv[2], 'classes.dex')
PY

echo "5/6 Alignment and signing"
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
if [ ! -f "$KEYSTORE" ]; then
  echo "    Creating the signing key $KEYSTORE (keep it: without it the installed app cannot be updated)"
  keytool -genkeypair -keystore "$KEYSTORE" -alias two-dragons -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYSTORE_PASS" -keypass "$KEYSTORE_PASS" -dname "CN=Two Dragons" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias two-dragons --ks-pass "pass:$KEYSTORE_PASS" \
  --key-pass "pass:$KEYSTORE_PASS" --out "$APK" "$OUT/aligned.apk"

echo "6/6 Verification"
"$BT/apksigner" verify "$APK"
echo "APK: $APK ($(du -h "$APK" | cut -f1))"
