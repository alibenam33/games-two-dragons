# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Two Dragons**: a two-player local tic-tac-toe in HTML5, set in a Chinese ink-wash garden. `rules.md` (in French) is the source of truth for the rules, art direction, accessibility and acceptance criteria. The game itself is in **English** and laid out in **landscape**.

Hard constraints from the owner:
- **No asset files.** Every image, texture, music track and sound effect is generated at runtime with HTML/CSS/SVG/Canvas/Web Audio. Do not add image, audio or font files, and do not load fonts or libraries from CDNs.
- Visual quality should stay modern and polished.

## Running

No build step, no dependencies. Open `index.html` directly in a browser (it works from `file://`, which is why the scripts are classic `<script>` tags exposing `window.TwoDragons*` globals instead of ES modules).

Tests: open `tests/logic.test.html` in a browser. It runs the rules-module tests (one per validation criterion in `rules.md`) and shows the pass/fail summary in the page and in the tab title. Node is not installed on this machine. For headless checks, the snap Firefox can screenshot pages, but it can only write inside `~/snap/firefox/common/`:
`firefox --headless --no-remote --profile <dir> --window-size=1600,900 --screenshot <out.png> file://…`

Android APK: `scripts/build-apk.sh` writes `build/two-dragons-<VERSION_NAME>.apk` (raise `VERSION_CODE=<n>` for each release). Same toolchain as the Kaizo project: no Gradle and no network, it calls the SDK tools directly (`~/Android/Sdk`, build-tools 34.0.0, android-34, JDK 17). There is no emulator or device here: check a build with `aapt2 dump badging`, `apksigner verify`, and a screenshot of `build/android/assets/www/index.html`.

## Architecture

Script load order in `index.html` matters: `logic.js` → `art.js` → `audio.js` → `main.js`.

- `js/logic.js`: pure rules, no DOM. Each function takes a state object and returns a new one. `play()` returns `{ ok, reason, state }`; when a move is rejected (`occupied`, `round-over`, `not-your-turn`), the original state object is returned untouched. The win check runs before the draw check. `newRound()` alternates based on `state.starter`, not on who played last. It also exports via `module.exports`, so it can be tested under Node if Node is ever installed.
- `js/art.js`: procedural visuals. `brushPath()` turns a polyline into a tapered brush-stroke SVG path. It is the building block for the grid, the X strokes, the O ring and the win line. `seal(side)` builds the pieces: a square jade seal with X for the Dragon, a round vermilion seal with O for the Phoenix, so the shape and letter differ as well as the colour. Shared gradients and filters (`#td-*`) are injected once into a hidden SVG by `injectDefs()` and referenced by `url(#id)`. `BackgroundScene` renders the animated landscape on `#scenery`. Mountains, bamboo, the pavilion and the sun are pre-rendered into offscreen canvases on resize; only the mist, the motes and the pointer parallax are drawn each frame.
- `js/audio.js`: `AudioEngine` with all sound synthesized. Karplus-Strong plucked-string buffers (cached per frequency), a generated convolution reverb, separate music and SFX buses (they mute independently), and a generative D-pentatonic ambience with a drone. The audio context is created lazily by `init()` on the first user gesture.
- `js/main.js`: UI glue. Holds `state`, renders it into the DOM, handles input, and calls the art and audio modules. All UI copy is in the `TEXT` object. The board uses a roving tabindex (arrow keys, Home and End), and each cell's `aria-label` gives its row, column and state.
- `css/style.css`: the layout is a fixed **1600×900 stage**, scaled to fit the window via the `--s` CSS variable set in `fitStage()`. Position elements in stage pixels. `--paper-tex` is a data URL generated at startup. `prefers-reduced-motion` is honoured both in CSS and in `BackgroundScene`.

## Android APK

- `android/` is a minimal native shell, package `fr.twodragons.game`, `sensorLandscape`, minSdk 24, no AndroidX. `MainActivity.java` is a single immersive full-screen `WebView` loading `file:///android_asset/www/index.html`. The Android back button closes the open `<dialog>` if there is one, otherwise leaves the app. The full-screen button is hidden in the app (`main.js` checks `window.NativeAudio`).
- **Sound fix carried over from Kaizo**: the WebView's Web Audio lags about 1 s on the owner's Huawei tablet, so in the APK the **sound effects** are played natively. `MainActivity` exposes `window.NativeAudio` (`load(path)`, `play(path, volume)`) backed by a `SoundPool`; when it exists, `AudioEngine.ready(name)` plays `sounds/<name>.wav` instead of synthesizing. The effects are listed in `AudioEngine.EFFECTS`. The **music** (generative ambience) stays on Web Audio, where latency does not matter; `MainActivity` suspends it on pause through `window.TwoDragonsPause(bool)` → `audio.setPaused()`, since the WebView does not always fire `visibilitychange`.
- The WAVs are rendered at build time through the real engine (compressor and reverb included) by `scripts/render-sounds.sh` (headless Firefox, `tools/render-sounds.html` + `tools/render_sounds.py`, which fails on a silent or clipping sound). They go to `build/sounds/`, are re-rendered when older than `js/audio.js`, and are stored uncompressed in the APK (`aapt2 -0 wav`, required by `openFd`). Add any new effect to `EFFECTS` and to the list in `build-apk.sh`.
- The launcher icon is generated at build time from `tools/icon.html` (the two seals of `art.js` on paper, screenshotted at 1024×1024): adaptive icon, monochrome layer, and legacy PNGs. Generated sounds and icons live only under `build/`, so the "no asset files" rule still holds for the project.
- `android/two-dragons.keystore` is the self-signed release key (password `KEYSTORE_PASS`, default `two-dragons-local`), created on the first build. It is gitignored and **must be kept**: updates to the installed app must be signed with the same key.
