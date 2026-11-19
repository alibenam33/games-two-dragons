#!/usr/bin/env bash
# Pre-renders the sound effects of js/audio.js to build/sounds/<name>.wav for the APK, where the native
# SoundPool plays them. build-apk.sh runs it whenever js/audio.js is newer than the files.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/render_sounds.py build/sounds
