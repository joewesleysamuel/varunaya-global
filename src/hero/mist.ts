/**
 * Built-in mist: soft white blobs drifting on black, drawn small and scaled
 * up (cheap), blended over the scene with mix-blend-mode: screen.
 * Two bands: low over the lake, and thin cloud across the peak's shoulder.
 * Replaced automatically by heroConfig.mistVideo when that clip exists.
 */
interface Puff {
  x: number;
  y: number;
  r: number;
  a: number;
  v: number;
  phase: number;
}

export class Mist {
  private readonly ctx: CanvasRenderingContext2D;
  private puffs: Puff[] = [];
  private raf = 0;
  private running = false;
  private last = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    bands: { y: number; spread: number; count: number; size: number; alpha: number }[],
  ) {
    this.ctx = canvas.getContext('2d')!;
    canvas.width = 320;
    canvas.height = 180;
    for (const b of bands) {
      for (let i = 0; i < b.count; i++) {
        this.puffs.push({
          x: Math.random() * 1.4 - 0.2,
          y: b.y + (Math.random() - 0.5) * b.spread,
          r: b.size * (0.6 + Math.random() * 0.8),
          a: b.alpha * (0.5 + Math.random() * 0.5),
          v: 0.004 + Math.random() * 0.006, // frame widths per second: very slow
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    this.draw(0);
  }

  /** Match the canvas aspect to the media frame. */
  setAspect(aspect: number): void {
    this.canvas.width = 320;
    this.canvas.height = Math.round(320 / aspect);
    this.draw(this.last);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    let prev = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      for (const p of this.puffs) {
        p.x += p.v * dt;
        if (p.x - p.r > 1.2) p.x = -0.2 - p.r;
      }
      this.draw(now / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private draw(t: number): void {
    this.last = t;
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.puffs) {
      const breathe = 0.75 + 0.25 * Math.sin(t * 0.15 + p.phase);
      const x = p.x * w;
      const y = (p.y + Math.sin(t * 0.05 + p.phase) * 0.006) * h;
      const r = p.r * w;
      // Squash the space, not the shape, so the falloff stays soft on all sides.
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.32);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(255,255,255,${p.a * breathe})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
  }
}
