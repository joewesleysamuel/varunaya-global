/**
 * Hero ambience on the Web Audio API: one AudioContext, one GainNode per
 * layer, a master gain. Layers loop seamlessly and crossfade.
 *
 * When a layer has no file yet (config path null), a quiet generated
 * placeholder is used so the experience can be judged before the licensed
 * recordings arrive. Generated layers are deliberately soft and slow.
 */
type LayerId = 'base' | 'peak' | 'thaw' | 'stone' | 'stillness' | 'vessel';

interface Layer {
  gain: GainNode;
  started: boolean;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private layers = new Map<LayerId, Layer>();
  private noise!: AudioBuffer;
  private active: LayerId | null = null;
  private enabled = false;
  private timers: number[] = [];

  constructor(
    private readonly files: Partial<Record<LayerId, string | null>>,
    private readonly opts: { master: number; base: number; chapter: number },
  ) {}

  get isOn(): boolean {
    return this.enabled;
  }

  /** Must be called from a user gesture. */
  async start(fadeIn: number): Promise<void> {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(8);
    }
    await this.ctx.resume();
    this.enabled = true;
    await this.ensure('base');
    this.setLayer('base', this.opts.base, 0.5);
    if (this.active) {
      await this.ensure(this.active);
      this.setLayer(this.active, this.opts.chapter, 0.5);
    }
    this.ramp(this.master.gain, this.opts.master, fadeIn);
  }

  stop(fade = 1.2): void {
    if (!this.ctx) return;
    this.enabled = false;
    this.ramp(this.master.gain, 0, fade);
  }

  /** Temporary silence (hidden tab, hero off screen). */
  duck(fade: number): void {
    if (this.ctx && this.enabled) this.ramp(this.master.gain, 0, fade);
  }

  unduck(fade: number): void {
    if (this.ctx && this.enabled) {
      void this.ctx.resume();
      this.ramp(this.master.gain, this.opts.master, fade);
    }
  }

  /** Crossfade to a chapter layer (or back to the base alone with null). */
  async chapter(id: LayerId | null, fade: number): Promise<void> {
    const prev = this.active;
    this.active = id;
    if (!this.ctx || !this.enabled) return;
    if (prev && prev !== id) this.setLayer(prev, 0, fade);
    if (id) {
      await this.ensure(id);
      this.setLayer(id, this.opts.chapter, fade);
    }
  }

  private ramp(param: AudioParam, value: number, seconds: number): void {
    const t = this.ctx!.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + Math.max(0.01, seconds));
  }

  private setLayer(id: LayerId, value: number, fade: number): void {
    const l = this.layers.get(id);
    if (l) this.ramp(l.gain.gain, value, fade);
  }

  private async ensure(id: LayerId): Promise<void> {
    if (this.layers.has(id) || !this.ctx) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    const layer: Layer = { gain, started: false };
    this.layers.set(id, layer);
    const file = this.files[id];
    if (file) {
      try {
        const res = await fetch(file);
        if (!res.ok) throw new Error(`${res.status}`);
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(gain);
        src.start();
        layer.started = true;
        return;
      } catch (err) {
        console.info(`[Varunaya] Audio ${file} unavailable, using the generated placeholder.`, err);
      }
    }
    this.synth(id, gain);
    layer.started = true;
  }

  // --------------------------------------------------------------------------
  // Generated placeholders
  // --------------------------------------------------------------------------
  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let brown = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        brown = (brown + 0.02 * w) / 1.02;
        d[i] = brown * 3.2;
      }
      // Crossfade the tail into the head so the loop has no click.
      const fade = ctx.sampleRate * 0.5;
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        d[i] = d[i] * t + d[d.length - fade + i] * (1 - t);
      }
    }
    return buf;
  }

  private noiseSource(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = 0.5;
    src.loopEnd = this.noise.duration;
    src.start(0, Math.random() * 6);
    return src;
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /** A slow LFO wobbling a parameter around its value. */
  private lfo(param: AudioParam, rate: number, depth: number): void {
    const o = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
  }

  private chain(...nodes: AudioNode[]): void {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  }

  private synth(id: LayerId, out: GainNode): void {
    const ctx = this.ctx!;
    const g = (v: number) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    switch (id) {
      case 'base': {
        // Distant stream (low, steady) and high altitude wind (slow swells).
        const stream = this.filter('lowpass', 520);
        const sg = g(0.55);
        this.chain(this.noiseSource(), stream, sg, out);
        this.lfo(sg.gain, 0.07, 0.12);
        const wind = this.filter('bandpass', 900, 0.6);
        const wg = g(0.18);
        this.chain(this.noiseSource(), wind, wg, out);
        this.lfo(wind.frequency, 0.05, 320);
        this.lfo(wg.gain, 0.04, 0.1);
        break;
      }
      case 'peak': {
        const wind = this.filter('bandpass', 2400, 1.2);
        const wg = g(0.35);
        this.chain(this.noiseSource(), wind, wg, out);
        this.lfo(wind.frequency, 0.08, 900);
        this.lfo(wg.gain, 0.06, 0.2);
        this.scheduleRepeating(() => this.creak(out), 6000, 9000);
        break;
      }
      case 'thaw': {
        const trickle = this.filter('highpass', 2600);
        const tg = g(0.05);
        this.chain(this.noiseSource(), trickle, tg, out);
        this.scheduleRepeating(() => this.drip(out), 500, 1400);
        break;
      }
      case 'stone': {
        const water = this.filter('bandpass', 750, 0.9);
        const wg = g(0.6);
        this.chain(this.noiseSource(), water, wg, out);
        this.lfo(water.frequency, 0.6, 260);
        this.lfo(wg.gain, 0.9, 0.18);
        const air = this.filter('highpass', 3200);
        this.chain(this.noiseSource(), air, g(0.05), out);
        break;
      }
      case 'stillness': {
        const hush = this.filter('lowpass', 300);
        this.chain(this.noiseSource(), hush, g(0.25), out);
        this.scheduleRepeating(() => this.lap(out), 3500, 6500);
        window.setTimeout(() => this.bird(out), 7000);
        break;
      }
      case 'vessel': {
        this.scheduleRepeating(() => this.pour(out), 9000, 12000, true);
        const hush = this.filter('lowpass', 260);
        this.chain(this.noiseSource(), hush, g(0.12), out);
        break;
      }
    }
  }

  private scheduleRepeating(fn: () => void, min: number, max: number, immediate = false): void {
    const tick = () => {
      if (this.enabled) fn();
      this.timers.push(window.setTimeout(tick, min + Math.random() * (max - min)));
    };
    if (immediate) tick();
    else this.timers.push(window.setTimeout(tick, min));
  }

  private envelope(node: GainNode, peak: number, attack: number, release: number, at = this.ctx!.currentTime): void {
    node.gain.setValueAtTime(0, at);
    node.gain.linearRampToValueAtTime(peak, at + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  }

  private drip(out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = 900 + Math.random() * 900;
    o.frequency.setValueAtTime(f, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f * 1.9, ctx.currentTime + 0.08);
    this.envelope(g, 0.05 + Math.random() * 0.04, 0.004, 0.18);
    o.connect(g).connect(out);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  }

  private creak(out: AudioNode): void {
    const ctx = this.ctx!;
    const src = this.noiseSource();
    const f = this.filter('bandpass', 180 + Math.random() * 120, 8);
    const g = ctx.createGain();
    this.envelope(g, 0.25, 0.4, 1.2);
    this.chain(src, f, g, out);
    src.stop(ctx.currentTime + 2);
  }

  private lap(out: AudioNode): void {
    const ctx = this.ctx!;
    const src = this.noiseSource();
    const f = this.filter('lowpass', 700);
    const g = ctx.createGain();
    this.envelope(g, 0.22, 0.35, 0.9);
    this.chain(src, f, g, out);
    src.stop(ctx.currentTime + 1.5);
  }

  private bird(out: AudioNode): void {
    if (!this.enabled) return;
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(3200, t);
    o.frequency.exponentialRampToValueAtTime(4300, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(3600, t + 0.3);
    this.envelope(g, 0.02, 0.03, 0.35, t);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.5);
  }

  private pour(out: AudioNode): void {
    const ctx = this.ctx!;
    const src = this.noiseSource();
    const f = this.filter('bandpass', 400, 4);
    const g = ctx.createGain();
    const t = ctx.currentTime;
    // The resonance rises as the glass fills.
    f.frequency.setValueAtTime(380, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 3.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.3);
    g.gain.setValueAtTime(0.32, t + 3.4);
    g.gain.linearRampToValueAtTime(0, t + 4.2);
    this.chain(src, f, g, out);
    src.stop(t + 4.5);
  }

  dispose(): void {
    this.timers.forEach((t) => clearTimeout(t));
    void this.ctx?.close();
  }
}
