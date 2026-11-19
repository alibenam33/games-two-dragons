// Synthesised sound for Two Dragons, built entirely with the Web Audio API:
// a Karplus-Strong plucked string (zither-like), a generated reverb, a
// generative pentatonic ambience and short sound effects. No audio files.
//
// In the Android APK the sound effects are played natively instead: the
// WebView's Web Audio lags by about a second on some tablets. MainActivity
// exposes window.NativeAudio (load(path), play(path, volume)), backed by a
// SoundPool, and plays sounds/<name>.wav: the effects below pre-rendered at
// build time (scripts/render-sounds.sh). The ambience stays on Web Audio,
// where latency does not matter.
(function (root) {
  'use strict';

  const N = {
    D2: 73.42, A2: 110, D3: 146.83, E3: 164.81, Fs3: 185.0, A3: 220, B3: 246.94,
    D4: 293.66, E4: 329.63, Fs4: 369.99, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, A5: 880,
  };
  // D major pentatonic, the range the melody wanders through.
  const SCALE = [N.D3, N.E3, N.Fs3, N.A3, N.B3, N.D4, N.E4, N.Fs4, N.A4, N.B4, N.D5];
  const MUSIC_LEVEL = 0.55;
  const SFX_LEVEL = 0.8;
  const BEAT = 0.45;
  // Every effect, by the name of its pre-rendered file, with how to play it.
  const EFFECTS = {
    'place-x': (e) => e.place('X'), 'place-o': (e) => e.place('O'),
    'win-x': (e) => e.win('X'), 'win-o': (e) => e.win('O'),
    draw: (e) => e.draw(), invalid: (e) => e.invalid(), click: (e) => e.click(), swish: (e) => e.swish(),
  };
  const nativeFile = (name) => `sounds/${name}.wav`;

  class AudioEngine {
    constructor(prefs = {}) {
      this.ctx = null;
      this.music = prefs.music !== false;
      this.sfx = prefs.sfx !== false;
      this.buffers = new Map();
      this.playing = false;
      this.timer = 0;
      this.stopTimer = 0;
      this.drone = null;
      this.paused = false;
      // Injectable for the offline pre-rendering of the effects.
      this.AudioContextClass = prefs.AudioContextClass || root.AudioContext || root.webkitAudioContext;
      this.native = prefs.nativeAudio !== undefined ? prefs.nativeAudio : root.NativeAudio || null;
      if (this.native) {
        for (const name of Object.keys(EFFECTS)) {
          try { this.native.load(nativeFile(name)); } catch (e) { /* missing file: that effect stays silent */ }
        }
      }
    }

    // Must be called from a user gesture (browsers block audio before one).
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended' && !document.hidden && !this.paused) this.ctx.resume();
        return;
      }
      const AC = this.AudioContextClass;
      if (!AC) return;
      const ctx = (this.ctx = new AC());

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);

      const reverb = ctx.createConvolver();
      reverb.buffer = this.impulse(3.4, 2.6);
      const wet = ctx.createGain();
      wet.gain.value = 0.4;
      reverb.connect(wet);
      wet.connect(this.master);

      this.musicBus = this.bus(this.music ? MUSIC_LEVEL : 0, reverb, 0.8);
      this.sfxBus = this.bus(this.sfx ? SFX_LEVEL : 0, reverb, 0.3);

      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.ctx.suspend();
        else if (!this.paused) this.ctx.resume();
      });

      if (this.music) this.startMusic();
    }

    bus(level, reverb, send) {
      const g = this.ctx.createGain();
      g.gain.value = level;
      g.connect(this.master);
      const s = this.ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(reverb);
      return g;
    }

    impulse(seconds, decay) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          lp += (Math.random() * 2 - 1 - lp) * (0.6 - 0.45 * t);
          d[i] = lp * (1 - t) ** decay;
        }
      }
      return buf;
    }

    // Karplus-Strong string with an all-pass stage for accurate tuning.
    pluckBuffer(freq) {
      const key = freq.toFixed(2);
      if (this.buffers.has(key)) return this.buffers.get(key);
      const sr = this.ctx.sampleRate;
      const dur = 2.8;
      const len = Math.floor(sr * dur);
      const period = sr / freq;
      const n = Math.floor(period - 0.5);
      const frac = period - n - 0.5;
      const c = (1 - frac) / (1 + frac);
      const t60 = Math.max(1.2, Math.min(2.6, 2.6 - freq / 600));
      const loss = Math.pow(0.001, 1 / (freq * t60));

      const ring = new Float32Array(n);
      let lp = 0;
      let mean = 0;
      for (let i = 0; i < n; i++) {
        lp += (Math.random() * 2 - 1 - lp) * 0.55;
        ring[i] = lp;
        mean += lp;
      }
      mean /= n;
      for (let i = 0; i < n; i++) ring[i] -= mean;

      const buf = this.ctx.createBuffer(1, len, sr);
      const out = buf.getChannelData(0);
      let idx = 0;
      let prev = 0;
      let apX = 0;
      let apY = 0;
      let peak = 0;
      for (let i = 0; i < len; i++) {
        const cur = ring[idx];
        out[i] = cur;
        peak = Math.max(peak, Math.abs(cur));
        const avg = loss * 0.5 * (cur + prev);
        prev = cur;
        const ap = c * avg + apX - c * apY;
        apX = avg;
        apY = ap;
        ring[idx] = ap;
        idx = idx + 1 === n ? 0 : idx + 1;
      }
      const norm = 0.9 / (peak || 1);
      const fade = Math.floor(sr * 0.05);
      for (let i = 0; i < len; i++) {
        out[i] *= norm * (i > len - fade ? (len - i) / fade : 1);
      }
      this.buffers.set(key, buf);
      return buf;
    }

    pluck(freq, t, { gain = 0.3, pan = 0, bus = this.sfxBus, tone = 2400, vibrato = false } = {}) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.pluckBuffer(freq);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = tone;
      lp.Q.value = 0.5;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(lp);
      lp.connect(g);
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        g.connect(p);
        p.connect(bus);
      } else {
        g.connect(bus);
      }
      if (vibrato) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.2;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(0.007, t + 0.6);
        lfo.connect(depth);
        depth.connect(src.playbackRate);
        lfo.start(t);
        lfo.stop(t + src.buffer.duration);
      }
      src.start(t);
    }

    noiseHit(t, { freq, q = 1, gain, decay, type = 'bandpass' }) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      src.connect(f);
      f.connect(g);
      g.connect(this.sfxBus);
      src.start(t, Math.random() * 0.5);
      src.stop(t + decay + 0.05);
    }

    tone(t, { freq, to = freq, type = 'sine', gain, decay, attack = 0.006 }) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (to !== freq) o.frequency.exponentialRampToValueAtTime(to, t + decay * 0.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g);
      g.connect(this.sfxBus);
      o.start(t);
      o.stop(t + decay + 0.05);
    }

    // Called by the Android app when it goes to the background or comes back,
    // since the WebView does not always fire visibilitychange.
    setPaused(paused) {
      this.paused = paused;
      if (!this.ctx) return;
      if (paused) this.ctx.suspend();
      else if (!document.hidden) this.ctx.resume();
    }

    // ---- Music --------------------------------------------------------------

    setMusic(on) {
      this.music = on;
      if (!this.ctx) return;
      const g = this.musicBus.gain;
      const t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(on ? MUSIC_LEVEL : 0, t + 0.6);
      clearTimeout(this.stopTimer);
      if (on) this.startMusic();
      else this.stopTimer = setTimeout(() => { if (!this.music) this.stopMusic(); }, 700);
    }

    setSfx(on) {
      this.sfx = on;
      if (!this.ctx) return;
      const g = this.sfxBus.gain;
      const t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(on ? SFX_LEVEL : 0, t + 0.1);
    }

    startMusic() {
      if (!this.ctx || this.playing) return;
      this.playing = true;
      this.step = 0;
      this.melody = 5;
      this.next = this.ctx.currentTime + 0.3;
      this.startDrone();
      this.timer = setInterval(() => this.schedule(), 100);
      this.schedule();
    }

    stopMusic() {
      this.playing = false;
      clearInterval(this.timer);
      if (this.drone) {
        const t = this.ctx.currentTime;
        this.drone.out.gain.cancelScheduledValues(t);
        this.drone.out.gain.setValueAtTime(this.drone.out.gain.value, t);
        this.drone.out.gain.linearRampToValueAtTime(0, t + 0.5);
        for (const o of this.drone.oscs) o.stop(t + 0.6);
        this.drone = null;
      }
    }

    schedule() {
      const now = this.ctx.currentTime;
      if (this.next < now) this.next = now + 0.05;
      while (this.next < now + 0.6) {
        this.musicStep(this.next);
        this.next += BEAT;
        this.step++;
      }
    }

    // One eighth-note step of a slowly wandering pentatonic melody.
    musicStep(t) {
      const pos = this.step % 32;
      const bus = this.musicBus;
      if (pos === 0) {
        this.pluck(Math.random() < 0.6 ? N.D3 : N.A2, t, { gain: 0.3, bus, pan: -0.2, tone: 900 });
      }
      const strong = pos % 4 === 0;
      const chance = pos >= 28 ? 0.06 : strong ? 0.7 : pos % 2 === 0 ? 0.35 : 0.12;
      if (Math.random() >= chance) return;
      const moves = [-2, -1, -1, 0, 1, 1, 2];
      this.melody = Math.max(2, Math.min(SCALE.length - 1, this.melody + moves[Math.floor(Math.random() * moves.length)]));
      const when = t + (Math.random() - 0.5) * 0.03;
      this.pluck(SCALE[this.melody], when, {
        gain: 0.2 + Math.random() * 0.14, bus, pan: (Math.random() - 0.5) * 0.7, tone: 2600, vibrato: Math.random() < 0.2,
      });
      if (strong && Math.random() < 0.22) {
        this.pluck(SCALE[Math.max(0, this.melody - 2)], when + 0.07, { gain: 0.13, bus, pan: 0.1, tone: 2000 });
      }
    }

    startDrone() {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(0.05, t + 4);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      lp.connect(out);
      out.connect(this.musicBus);
      const oscs = [[N.D2, 'sine', 0.6], [N.A2, 'sine', 0.35], [N.D3 * 1.002, 'triangle', 0.12]].map(([f, type, level]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = level;
        o.connect(g);
        g.connect(lp);
        o.start(t);
        return o;
      });
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.06;
      const depth = ctx.createGain();
      depth.gain.value = 0.02;
      lfo.connect(depth);
      depth.connect(out.gain);
      lfo.start(t);
      this.drone = { out, oscs: [...oscs, lfo] };
    }

    // ---- Sound effects ------------------------------------------------------

    // True when the effect should be synthesized now. In the APK it plays the
    // pre-rendered file instead and returns false.
    ready(name) {
      if (!this.sfx) return false;
      if (this.native) {
        try { this.native.play(nativeFile(name), 1); } catch (e) { /* playback failed: stay silent */ }
        return false;
      }
      return !!this.ctx;
    }

    place(side) {
      if (!this.ready(`place-${side.toLowerCase()}`)) return;
      const t = this.ctx.currentTime + 0.01;
      this.tone(t, { freq: 150, to: 52, gain: 0.5, decay: 0.22, attack: 0.008 });
      this.noiseHit(t, { freq: 1100, q: 0.7, gain: 0.22, decay: 0.07 });
      this.pluck(side === 'X' ? N.A3 : N.E4, t + 0.02, { gain: 0.32, pan: side === 'X' ? -0.25 : 0.25, tone: 2800 });
    }

    invalid() {
      if (!this.ready('invalid')) return;
      const t = this.ctx.currentTime + 0.01;
      this.tone(t, { freq: 240, to: 200, gain: 0.16, decay: 0.09 });
      this.tone(t + 0.1, { freq: 180, to: 150, gain: 0.14, decay: 0.1 });
    }

    win(side) {
      if (!this.ready(`win-${side.toLowerCase()}`)) return;
      const t = this.ctx.currentTime + 0.05;
      const seq = side === 'X' ? [N.D4, N.E4, N.Fs4, N.A4, N.D5] : [N.E4, N.Fs4, N.A4, N.B4, N.E5];
      seq.forEach((f, i) => this.pluck(f, t + i * 0.1, { gain: 0.26, pan: -0.4 + i * 0.2, tone: 3200 }));
      const base = side === 'X' ? N.D5 : N.A5;
      [[1, 0.1, 2.2], [2.76, 0.05, 1.4], [5.4, 0.025, 0.8], [8.9, 0.012, 0.4]].forEach(([ratio, gain, decay]) => {
        this.tone(t + 0.55, { freq: base * ratio, gain, decay, attack: 0.004 });
      });
    }

    draw() {
      if (!this.ready('draw')) return;
      const t = this.ctx.currentTime + 0.05;
      [N.A3, N.Fs3, N.D3].forEach((f, i) => this.pluck(f, t + i * 0.24, { gain: 0.26, tone: 1800 }));
    }

    click() {
      if (!this.ready('click')) return;
      this.noiseHit(this.ctx.currentTime + 0.005, { freq: 3200, q: 1.2, gain: 0.08, decay: 0.03 });
    }

    // Brush sweeping across paper, used when the board is cleared.
    swish() {
      if (!this.ready('swish')) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.01;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      src.connect(f);
      f.connect(g);
      g.connect(this.sfxBus);
      src.start(t);
      src.stop(t + 0.45);
    }
  }

  AudioEngine.EFFECTS = EFFECTS;
  root.TwoDragonsAudio = AudioEngine;
})(window);
