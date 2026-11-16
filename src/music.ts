// Gentle generated music: a piano you can sit and play, and a lo-fi radio on the café counter.
// Everything is synthesised with the Web Audio API and only starts after the user acts.
let context: AudioContext | null = null;
function audio() {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

function pluck(ctx: AudioContext, out: AudioNode, note: number, at: number, length: number, volume: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, at + length);
  gain.connect(out);
  for (const [type, ratio, level] of [
    ['triangle', 1, 1],
    ['sine', 2, 0.3],
  ] as const) {
    const osc = ctx.createOscillator(),
      g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = midi(note) * ratio;
    g.gain.value = level;
    osc.connect(g).connect(gain);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

// A soft pentatonic improvisation with a chord every few bars.
export class Piano {
  private timer = 0;
  private out: GainNode | null = null;
  private note = 64;
  private step = 0;
  start(volume = 0.22) {
    if (this.timer) return;
    const ctx = audio();
    this.out = ctx.createGain();
    this.out.gain.value = volume;
    this.out.connect(ctx.destination);
    const scale = [0, 2, 4, 7, 9];
    const tick = () => {
      const now = ctx.currentTime + 0.02;
      const degree = Math.max(
        0,
        Math.min(9, Math.round((this.note - 60) / 2.4) + Math.round((Math.random() - 0.5) * 3)),
      );
      this.note = 60 + Math.floor(degree / 5) * 12 + scale[degree % 5];
      pluck(ctx, this.out!, this.note, now, 1.6, 0.5);
      if (this.step % 8 === 0)
        for (const n of [48, 55, 64].map(n => n + [0, 5, -3, 7][(this.step / 8) % 4]))
          pluck(ctx, this.out!, n, now, 3, 0.22);
      this.step++;
      this.timer = window.setTimeout(tick, [380, 380, 760, 190][Math.floor(Math.random() * 4)]);
    };
    tick();
  }
  stop() {
    window.clearTimeout(this.timer);
    this.timer = 0;
    const out = this.out;
    this.out = null;
    if (out && context) {
      out.gain.setTargetAtTime(0, context.currentTime, 0.4);
      window.setTimeout(() => out.disconnect(), 2500);
    }
  }
}

// Lo-fi loop: warm seventh chords, a lazy beat and vinyl crackle, scheduled a little ahead of time.
export class LofiRadio {
  private timer = 0;
  private master: GainNode | null = null;
  private crackle: AudioBufferSourceNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  start() {
    if (this.timer) return;
    const ctx = audio();
    const master = (this.master = ctx.createGain());
    master.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1800;
    master.connect(tone).connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = Math.random() < 0.0015 ? (Math.random() - 0.5) * 0.9 : (Math.random() - 0.5) * 0.02;
    const crackle = (this.crackle = ctx.createBufferSource());
    crackle.buffer = noise;
    crackle.loop = true;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.35;
    crackle.connect(crackleGain).connect(master);
    crackle.start();
    const chords = [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 65],
      [52, 55, 59, 62],
    ];
    const secondsPerBeat = 60 / 74;
    this.nextBeat = ctx.currentTime + 0.1;
    const hit = (at: number, kind: 'kick' | 'snare' | 'hat') => {
      if (kind === 'kick') {
        const osc = ctx.createOscillator(),
          g = ctx.createGain();
        osc.frequency.setValueAtTime(120, at);
        osc.frequency.exponentialRampToValueAtTime(42, at + 0.18);
        g.gain.setValueAtTime(0.9, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
        osc.connect(g).connect(master);
        osc.start(at);
        osc.stop(at + 0.32);
        return;
      }
      const src = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        g = ctx.createGain();
      src.buffer = noise;
      filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
      filter.frequency.value = kind === 'hat' ? 7000 : 1800;
      g.gain.setValueAtTime(kind === 'hat' ? 2.2 : 5, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + (kind === 'hat' ? 0.05 : 0.16));
      src.connect(filter).connect(g).connect(master);
      src.start(at, Math.random());
      src.stop(at + 0.2);
    };
    const schedule = () => {
      while (this.nextBeat < ctx.currentTime + 0.3) {
        const at = this.nextBeat,
          inBar = this.beat % 4;
        if (inBar === 0)
          for (const n of chords[Math.floor(this.beat / 8) % 4]) pluck(ctx, master, n, at, secondsPerBeat * 7.5, 0.16);
        if (inBar === 0 || (inBar === 2 && this.beat % 8 === 6)) hit(at, 'kick');
        if (inBar === 1 || inBar === 3) hit(at + 0.02, 'snare');
        hit(at, 'hat');
        hit(at + secondsPerBeat * 0.58, 'hat');
        this.nextBeat += secondsPerBeat;
        this.beat++;
      }
      this.timer = window.setTimeout(schedule, 80);
    };
    schedule();
  }
  // 0..1, e.g. from how close you are to the radio.
  setVolume(level: number) {
    if (this.master && context) this.master.gain.setTargetAtTime(level * 0.32, context.currentTime, 0.3);
  }
  stop() {
    window.clearTimeout(this.timer);
    this.timer = 0;
    const master = this.master,
      crackle = this.crackle;
    this.master = this.crackle = null;
    if (master && context) {
      master.gain.setTargetAtTime(0, context.currentTime, 0.3);
      window.setTimeout(() => {
        crackle?.stop();
        master.disconnect();
      }, 2000);
    }
  }
}
