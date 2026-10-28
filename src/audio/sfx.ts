// Every sound is synthesised with Web Audio: no files, works offline, and
// nothing in it is speech.

type Wave = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicGain: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
  }

  private tone(freq: number, start: number, dur: number, wave: Wave, vol: number, endFreq?: number, out?: AudioNode) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out ?? this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(start: number, dur: number, vol: number, filterFreq: number, out?: AudioNode) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + start;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out ?? this.master);
    src.start(t);
  }

  boing() {
    this.tone(180, 0, 0.35, 'sine', 0.5, 520);
    this.tone(520, 0.3, 0.25, 'sine', 0.3, 260);
  }

  beat(n: number) {
    this.tone(n === 1 ? 880 : 587, 0, 0.18, 'square', 0.18);
  }

  freeze() {
    this.noise(0, 0.35, 0.4, 3000);
    this.tone(1760, 0.02, 0.5, 'triangle', 0.25, 2637);
  }

  success(stars: number) {
    const notes = [523, 659, 784, 1047, 1319];
    const count = 2 + stars;
    notes.slice(0, count).forEach((f, i) => this.tone(f, i * 0.09, 0.35, 'triangle', 0.35));
    this.tone(notes[count - 1]! * 0.5, count * 0.09, 0.6, 'square', 0.12);
    this.noise(0, 0.25, 0.5, 6000);
  }

  /** The sad trombone: four sliding notes, the last one wobbling. */
  fail() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.connect(this.master);
    const notes = [233, 220, 208];
    notes.forEach((f, i) => this.tone(f, i * 0.42, 0.42, 'sawtooth', 0.3, f * 0.97, lp));
    const t = ctx.currentTime + 1.26;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(196, t);
    osc.frequency.linearRampToValueAtTime(185, t + 1.2);
    lfo.frequency.value = 6;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    osc.connect(g).connect(lp);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 1.35);
    lfo.stop(t + 1.35);
  }

  /** Overblown orchestral hit for the slow-motion replay. */
  sting() {
    [131, 196, 262, 330, 392].forEach((f) => {
      this.tone(f, 0, 1.6, 'sawtooth', 0.09);
      this.tone(f * 1.005, 0, 1.6, 'sawtooth', 0.07);
    });
    this.tone(110, 0, 0.8, 'sine', 0.6, 45);
    this.noise(0, 0.6, 0.3, 200);
  }

  card(i: number) {
    this.tone(1200 + i * 200, 0, 0.12, 'triangle', 0.3);
  }

  laugh() {
    [0, 0.12, 0.24].forEach((s, i) => this.tone(700 - i * 60, s, 0.1, 'square', 0.12, 500 - i * 60));
  }

  fanfare() {
    const seq = [392, 523, 659, 784, 659, 784, 1047];
    seq.forEach((f, i) => this.tone(f, i * 0.14, i === seq.length - 1 ? 1 : 0.2, 'square', 0.16));
    this.noise(0.9, 0.4, 0.5, 5000);
  }

  /** A light drum-and-bass loop under the demo and hold. */
  startMusic(bpm = 112) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.musicTimer !== null) return;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    const out = this.musicGain;
    const beat = 60 / bpm / 2;
    let next = ctx.currentTime + 0.05;
    let n = 0;
    const bass = [55, 55, 82, 73, 55, 55, 98, 82];
    const schedule = () => {
      while (next < ctx.currentTime + 0.2) {
        const s = next - ctx.currentTime;
        if (n % 4 === 0) this.tone(120, s, 0.18, 'sine', 0.9, 45, out);
        if (n % 4 === 2) this.noise(s, 0.12, 0.35, 1800, out);
        this.noise(s, 0.03, 0.12, 8000, out);
        if (n % 2 === 0) this.tone(bass[(n / 2) % bass.length]!, s, beat * 1.6, 'triangle', 0.5, undefined, out);
        next += beat;
        n++;
      }
    };
    schedule();
    this.musicTimer = window.setInterval(schedule, 50);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      const g = this.musicGain;
      window.setTimeout(() => g.disconnect(), 600);
    }
    this.musicGain = null;
  }
}
