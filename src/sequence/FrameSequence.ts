/**
 * Scroll-scrubbed image sequence drawn to a canvas.
 *
 * Each sequence lives in /public/sequence/<name>/ with a manifest.json:
 * {
 *   "frameCount": 96,
 *   "width": 800, "height": 1200,
 *   "pattern": "frame_{index}.webp",      // full size
 *   "small": "s/frame_{index}.webp",      // optional, used on small screens
 *   "pad": 4, "start": 0
 * }
 * Frames load coarse to fine (every 8th, then every 4th, then the rest), and
 * the canvas always draws the nearest loaded frame, so scrubbing never blanks.
 */
export interface SequenceManifest {
  frameCount: number;
  width: number;
  height: number;
  pattern: string;
  small?: string;
  pad?: number;
  start?: number;
}

export class FrameSequence {
  readonly frames: (HTMLImageElement | null)[];
  private readonly ctx: CanvasRenderingContext2D;
  private current = -1;
  private target = 0;
  private disposed = false;
  private loading: Promise<void> | null = null;

  private constructor(
    private readonly base: string,
    readonly manifest: SequenceManifest,
    readonly canvas: HTMLCanvasElement,
    private readonly useSmall: boolean,
  ) {
    this.frames = new Array(manifest.frameCount).fill(null);
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  static async create(base: string, canvas: HTMLCanvasElement): Promise<FrameSequence | null> {
    try {
      const res = await fetch(`${base}/manifest.json`);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || type.includes('text/html')) throw new Error(`no manifest at ${base}`);
      const manifest = (await res.json()) as SequenceManifest;
      const small = !!manifest.small && window.matchMedia('(max-width: 768px)').matches;
      return new FrameSequence(base, manifest, canvas, small);
    } catch (err) {
      console.info('[Varunaya] Sequence unavailable, keeping the poster image.', err);
      return null;
    }
  }

  get count(): number {
    return this.manifest.frameCount;
  }

  private url(i: number): string {
    const { pattern, small, pad = 4, start = 0 } = this.manifest;
    const p = this.useSmall && small ? small : pattern;
    return `${this.base}/${p.replace('{index}', String(i + start).padStart(pad, '0'))}`;
  }

  private loadFrame(i: number): Promise<void> {
    if (this.frames[i]) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (this.disposed) return resolve();
        this.frames[i] = img;
        // A closer frame just arrived: redraw.
        if (Math.abs(i - this.target) < Math.abs(this.current - this.target) || this.current < 0) this.draw(true);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = this.url(i);
    });
  }

  /** Coarse-to-fine loading. Resolves once the coarse pass is in. */
  load(onProgress?: (p: number) => void): Promise<void> {
    if (this.loading) return this.loading;
    const n = this.count;
    const passes = [8, 4, 2, 1];
    const order: number[] = [];
    const seen = new Set<number>();
    for (const step of passes) {
      for (let i = 0; i < n; i += step) if (!seen.has(i)) (seen.add(i), order.push(i));
    }
    if (!seen.has(n - 1)) order.splice(1, 0, n - 1);
    const coarse = order.filter((i) => i % 8 === 0 || i === n - 1);
    let done = 0;
    this.loading = Promise.all(
      coarse.map((i) =>
        this.loadFrame(i).then(() => {
          // Braces matter: a returned GSAP tween is thenable and would stall this chain.
          onProgress?.(++done / coarse.length);
        }),
      ),
    ).then(() => {
      const rest = order.filter((i) => !coarse.includes(i));
      const worker = async () => {
        while (rest.length && !this.disposed) await this.loadFrame(rest.shift()!);
      };
      void Promise.all([worker(), worker(), worker(), worker()]);
    });
    return this.loading;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.draw(true);
    }
  }

  /** Progress 0..1 across the sequence. */
  setProgress(p: number): void {
    this.setFrame(Math.round(Math.min(1, Math.max(0, p)) * (this.count - 1)));
  }

  setFrame(f: number): void {
    this.target = ((Math.round(f) % this.count) + this.count) % this.count;
    this.draw(false);
  }

  private nearest(): number {
    const t = this.target;
    for (let d = 0; d < this.count; d++) {
      if (this.frames[t - d]) return t - d;
      if (this.frames[t + d]) return t + d;
    }
    return -1;
  }

  private draw(force: boolean): void {
    const idx = this.nearest();
    if (idx < 0 || (!force && idx === this.current)) return;
    this.current = idx;
    const img = this.frames[idx]!;
    const { width: cw, height: ch } = this.canvas;
    const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    this.canvas.classList.add('is-live');
  }

  dispose(): void {
    this.disposed = true;
    this.frames.fill(null);
  }
}
