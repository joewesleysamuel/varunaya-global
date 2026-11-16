import { gsap } from '../scroll/smooth';
import { heroConfig as C, type Chapter, type MediaSlot } from './config';
import { AudioEngine } from './audio';
import { Mist } from './mist';

type Mode = 'desktop' | 'mobile';
const SOUND_KEY = 'varunaya-sound';

function storage(get: true): string | null;
function storage(get: false, value: string): void;
function storage(get: boolean, value?: string): string | null | void {
  try {
    if (get) return localStorage.getItem(SOUND_KEY);
    localStorage.setItem(SOUND_KEY, value!);
  } catch {
    return null;
  }
}

const fmt = (m: number) => `${Math.round(m).toLocaleString('en-US')} m`;

export class Hero {

  private scene!: HTMLElement;
  private frame!: HTMLElement;
  private poster!: HTMLImageElement;
  private master!: HTMLVideoElement;
  private mistWrap!: HTMLElement;
  private mistVideo!: HTMLVideoElement;
  private parVideo!: HTMLElement;
  private bottle!: HTMLElement;
  private markersEl!: HTMLElement;
  private chaptersEl!: HTMLElement;
  private head!: HTMLElement;
  private links!: HTMLElement;
  private railValue!: HTMLElement;
  private railLine!: HTMLElement;
  private railDot!: HTMLElement;
  private index!: HTMLElement;
  private soundBtn!: HTMLButtonElement;
  private soundLabel!: HTMLElement;
  private hint!: HTMLElement;
  private card!: HTMLElement;
  private cardLabel!: HTMLElement;
  private cardPoem!: HTMLElement;
  private discover!: HTMLButtonElement;

  private readonly mq = window.matchMedia('(max-width: 767px), (orientation: portrait) and (max-width: 1100px)');
  private mode: Mode = this.mq.matches ? 'mobile' : 'desktop';
  private readonly chapters = C.chapters;
  private markers: HTMLButtonElement[] = [];
  private layers: HTMLElement[] = [];
  private indexBtns: HTMLButtonElement[] = [];
  private current = -1;
  private busy = false;
  private queued: (() => void) | null = null;
  private altitude = { v: 0 };
  private inView = true;
  private mist: Mist;
  private audio: AudioEngine;
  private pointer = { x: 0, y: 0, cx: 0, cy: 0 };
  private parallaxRaf = 0;
  private idleTimer = 0;
  private idleCount = 0;
  private lastFocus: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly reduced: boolean,
  ) {
    this.scene = this.q('.dx-scene');
    this.frame = this.q('.dx-frame');
    this.poster = this.q<HTMLImageElement>('.dx-poster');
    this.master = this.q<HTMLVideoElement>('.dx-master');
    this.mistWrap = this.q('.dx-mistwrap');
    this.mistVideo = this.q<HTMLVideoElement>('.dx-mistvideo');
    this.parVideo = this.q('[data-depth="video"]');
    this.bottle = this.q('.dx-bottle');
    this.markersEl = this.q('.dx-markers');
    this.chaptersEl = this.q('.dx-chapters');
    this.head = this.q('.dx-head');
    this.links = this.q('.dx-links');
    this.railValue = this.q('.dx-rail__value');
    this.railLine = this.q('.dx-rail__line');
    this.railDot = this.q('.dx-rail__dot');
    this.index = this.q('.dx-index');
    this.soundBtn = this.q<HTMLButtonElement>('.dx-sound');
    this.soundLabel = this.q('.dx-sound__label');
    this.hint = this.q('.dx-hint');
    this.card = this.q('.dx-card');
    this.cardLabel = this.q('.dx-card__label');
    this.cardPoem = this.q('.dx-card__poem');
    this.discover = this.q<HTMLButtonElement>('.dx-discover');
    root.style.setProperty('--grade', C.grade);
    root.classList.toggle('no-altitudes', !C.showAltitudes);
    // Markers live inside the frame so they zoom and breathe with the landscape.
    this.frame.appendChild(this.markersEl);
    this.scene.querySelectorAll('img, video, canvas').forEach((el) => el.setAttribute('aria-hidden', 'true'));

    this.buildMarkers();
    this.buildLayers();
    this.buildIndex();
    this.buildRail();
    this.setMedia();

    this.mist = new Mist(this.q<HTMLCanvasElement>('.dx-mist'), [
      { y: 0.66, spread: 0.12, count: 14, size: 0.22, alpha: 0.35 },
      { y: 0.2, spread: 0.08, count: 7, size: 0.18, alpha: 0.22 },
    ]);
    if (C.mistVideo && !this.reduced) this.mistWrap.classList.add('has-video');

    const files: Record<string, string | null> = { base: C.audio.base };
    this.chapters.forEach((ch) => (files[ch.id] = ch.audio));
    this.audio = new AudioEngine(files, { master: C.audio.master, base: C.audio.baseVolume, chapter: C.audio.chapterVolume });

    this.layout();
    this.bind();
    this.observe();
    this.armIdle();
    if (new URLSearchParams(location.search).get('markers') === 'edit') this.editMode();
  }

  private q<T extends Element = HTMLElement>(sel: string): T {
    return this.root.querySelector<T>(sel) as T;
  }

  // --------------------------------------------------------------------------
  // Build
  // --------------------------------------------------------------------------
  private buildMarkers(): void {
    this.chapters.forEach((ch, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dx-marker';
      const alt = C.showAltitudes ? `, ${ch.altitude.toLocaleString('en-US')} metres` : '';
      b.setAttribute('aria-label', `Chapter ${ch.number}, ${ch.name}${alt}`);
      const label = C.showAltitudes ? `${ch.number} · ${ch.name} · ${fmt(ch.altitude)}` : `${ch.number} · ${ch.name}`;
      b.innerHTML = `<span class="dx-marker__ripple"></span><span class="dx-marker__ripple"></span><span class="dx-marker__ring"></span><span class="dx-marker__dot"></span><span class="dx-marker__label" aria-hidden="true">${label}</span>`;
      b.addEventListener('click', () => this.open(i));
      const warm = () => this.loadLayer(i);
      b.addEventListener('pointerenter', warm);
      b.addEventListener('focus', warm);
      this.markersEl.appendChild(b);
      this.markers.push(b);
    });
  }

  private buildLayers(): void {
    this.chapters.forEach(() => {
      const d = document.createElement('div');
      d.className = 'dx-ch';
      this.chaptersEl.appendChild(d);
      this.layers.push(d);
    });
  }

  /** Lazy: a chapter's media loads the first time its marker is hovered or focused. */
  private loadLayer(i: number): void {
    const layer = this.layers[i];
    if (!layer || layer.dataset.mode === this.mode) return;
    layer.dataset.mode = this.mode;
    layer.textContent = '';
    const slot: MediaSlot = this.chapters[i].media[this.mode];
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.src = slot.poster;
    layer.appendChild(img);
    if (slot.video && !this.reduced) {
      const v = this.video(slot.video);
      v.addEventListener('canplay', () => (img.style.opacity = '0'), { once: true });
      layer.appendChild(v);
    }
  }

  private video(src: [string, string]): HTMLVideoElement {
    const v = document.createElement('video');
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('aria-hidden', 'true');
    for (const s of [src[1], src[0]]) {
      const el = document.createElement('source');
      el.src = s;
      el.type = s.endsWith('.webm') ? 'video/webm' : 'video/mp4';
      v.appendChild(el);
    }
    return v;
  }

  private buildIndex(): void {
    this.chapters.forEach((ch, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span>${ch.number}</span>${ch.name}`;
      b.addEventListener('click', () => (this.current >= 0 ? this.swap(i) : this.open(i)));
      li.appendChild(b);
      this.index.appendChild(li);
      this.indexBtns.push(b);
    });
  }

  private buildRail(): void {
    this.chapters.forEach((_, i) => {
      const t = document.createElement('span');
      t.className = 'dx-rail__tick';
      this.railLine.appendChild(t);
      this.placeTick(t, i);
    });
  }

  private tickPct(i: number): number {
    return (i / (this.chapters.length - 1)) * 100;
  }

  private placeTick(t: HTMLElement, i: number): void {
    const p = `${this.tickPct(i)}%`;
    t.style.top = this.mode === 'mobile' ? '' : p;
    t.style.left = this.mode === 'mobile' ? p : '';
  }

  private setMedia(): void {
    const slot = C.master[this.mode];
    if (this.poster.getAttribute('src') !== slot.poster) this.poster.src = slot.poster;
    this.master.classList.remove('is-ready');
    this.master.textContent = '';
    if (slot.video && !this.reduced) {
      for (const s of [slot.video[1], slot.video[0]]) {
        const el = document.createElement('source');
        el.src = s;
        el.type = s.endsWith('.webm') ? 'video/webm' : 'video/mp4';
        this.master.appendChild(el);
      }
      this.master.preload = 'metadata';
      this.master.load();
      this.master.addEventListener('canplay', () => this.master.classList.add('is-ready'), { once: true });
    }
    if (C.mistVideo && !this.reduced) {
      this.mistVideo.textContent = '';
      for (const s of [C.mistVideo[1], C.mistVideo[0]]) {
        const el = document.createElement('source');
        el.src = s;
        this.mistVideo.appendChild(el);
      }
      this.mistVideo.load();
    }
    const b = C.bottle;
    this.bottle.hidden = !C.showBottle;
    if (C.showBottle) {
      this.bottle.querySelectorAll('img').forEach((img) => {
        if (img.getAttribute('src') !== b.src) img.src = b.src;
      });
      // Resolve against the page: a url() inside a CSS variable resolves against the stylesheet.
      this.bottle.style.setProperty('--bottle-mask', `url("${new URL(b.src, document.baseURI).href}")`);
    }
  }

  // --------------------------------------------------------------------------
  // Layout: map the frame onto the viewport the way object-fit: cover would
  // --------------------------------------------------------------------------
  private layout(): void {
    const { width: fw, height: fh } = C.frame[this.mode];
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    const s = Math.max(W / fw, H / fh);
    const w = fw * s;
    const h = fh * s;
    Object.assign(this.frame.style, { width: `${w}px`, height: `${h}px`, left: `${(W - w) / 2}px`, top: `${(H - h) / 2}px` });
    this.mist.setAspect(fw / fh);
    this.chapters.forEach((ch, i) => {
      const [x, y] = ch.marker[this.mode];
      Object.assign(this.markers[i].style, { left: `${x}%`, top: `${y}%` });
    });
    const bp = C.bottle[this.mode];
    Object.assign(this.bottle.style, { left: `${bp.base[0]}%`, top: `${bp.base[1]}%`, height: `${(bp.heightVh / 100) * H}px` });
    this.bottle.hidden = !C.showBottle || !bp.show;
    this.railLine.querySelectorAll<HTMLElement>('.dx-rail__tick').forEach((t, i) => this.placeTick(t, i));
    if (this.current >= 0) this.moveDot(this.current, 0);
  }

  // --------------------------------------------------------------------------
  // Chapter flow
  // --------------------------------------------------------------------------
  private guard(fn: () => void): boolean {
    if (!this.busy) return false;
    this.queued = fn; // queue at most one
    return true;
  }

  private release(): void {
    this.busy = false;
    const next = this.queued;
    this.queued = null;
    next?.();
  }

  private originFor(i: number): string {
    const r = this.markers[i].getBoundingClientRect();
    const h = this.root.getBoundingClientRect();
    return `${r.left + r.width / 2 - h.left}px ${r.top + r.height / 2 - h.top}px`;
  }

  open(i: number): void {
    if (this.current >= 0) return this.swap(i);
    if (this.guard(() => this.open(i))) return;
    this.busy = true;
    this.lastFocus = document.activeElement as HTMLElement;
    this.stopIdle();
    this.loadLayer(i);
    this.loadLayer((i + 1) % this.chapters.length);
    const T = C.timings;
    const layer = this.layers[i];
    this.current = i;
    this.markersEl.inert = true;
    this.root.classList.add('is-chapter');
    this.playLayer(i);

    const tl = gsap.timeline({ onComplete: () => this.release() });
    if (this.reduced) {
      tl.to([this.head, this.markersEl, this.links], { opacity: 0, duration: 0.6 }, 0)
        .to(layer, { opacity: 1, duration: 0.6 }, 0)
        .add(() => this.moveDot(i, 0), 0)
        .add(() => this.showCard(i), 0.4);
    } else {
      gsap.set(this.scene, { transformOrigin: this.originFor(i), willChange: 'transform, filter' });
      tl.to([this.head, this.markersEl, this.links], { opacity: 0, y: 12, duration: 0.8, ease: 'power2.out' }, 0)
        .to(this.scene, { scale: C.zoom[this.mode], duration: T.zoom, ease: 'power2.inOut' }, 0)
        .fromTo(this.scene, { filter: 'blur(0px)' }, { filter: 'blur(3px)', duration: T.blurPeak, ease: 'power1.in' }, 0)
        .to(this.scene, { filter: 'blur(0px)', duration: T.crossfade, ease: 'power1.out' }, T.blurPeak)
        .to(layer, { opacity: 1, duration: T.crossfade, ease: 'power1.inOut' }, T.crossfadeAt)
        .add(() => this.settle(layer), T.crossfadeAt)
        .add(() => this.moveDot(i, T.rail), T.railAt)
        .add(() => this.showCard(i), T.cardAt)
        .add(() => gsap.set(this.scene, { willChange: 'auto' }));
    }
    void this.audio.chapter(this.chapters[i].id as never, C.audio.crossfade);
    this.markIndex(i);
  }

  /** The close up starts slightly large and settles, like a camera arriving. */
  private settle(layer: HTMLElement): void {
    if (this.reduced || !layer.children.length) return;
    gsap.fromTo(layer.children, { scale: 1.12 }, { scale: 1, duration: C.timings.settle, ease: 'expo.out' });
  }

  swap(i: number): void {
    const n = this.chapters.length;
    i = ((i % n) + n) % n;
    if (i === this.current) return;
    if (this.guard(() => this.swap(i))) return;
    this.busy = true;
    const from = this.layers[this.current];
    const to = this.layers[i];
    this.loadLayer(i);
    this.loadLayer((i + 1) % n);
    this.current = i;
    this.playLayer(i);
    const d = this.reduced ? 0.6 : C.timings.chapterSwap;
    const words = this.cardPoem.querySelectorAll('.dx-word');
    gsap
      .timeline({ onComplete: () => this.release() })
      .to([words, this.cardLabel, this.discover], { opacity: 0, duration: 0.4, ease: 'power1.in' }, 0)
      .to(to, { opacity: 1, duration: d, ease: 'power1.inOut' }, 0)
      .to(from, { opacity: 0, duration: d, ease: 'power1.inOut' }, 0)
      .add(() => this.settle(to), 0)
      .add(() => this.moveDot(i, this.reduced ? 0 : 1.6), 0.2)
      .add(() => this.showCard(i), 0.45);
    void this.audio.chapter(this.chapters[i].id as never, C.audio.crossfade);
    this.markIndex(i);
  }

  back(): void {
    if (this.current < 0) return;
    if (this.guard(() => this.back())) return;
    this.busy = true;
    const layer = this.layers[this.current];
    const i = this.current;
    this.current = -1;
    const T = C.timings;
    const tl = gsap.timeline({
      onComplete: () => {
        this.card.hidden = true;
        this.markersEl.inert = false;
        this.root.classList.remove('is-chapter');
        this.pauseLayers();
        (this.lastFocus && this.root.contains(this.lastFocus) ? this.lastFocus : this.markers[i]).focus({ preventScroll: true });
        this.armIdle();
        this.release();
      },
    });
    tl.to(this.card, { opacity: 0, duration: 0.4 }, 0)
      .to(layer, { opacity: 0, duration: this.reduced ? 0.6 : 1.2, ease: 'power1.inOut' }, this.reduced ? 0 : 0.2);
    if (!this.reduced) tl.to(this.scene, { scale: 1, duration: T.return, ease: 'power2.inOut' }, 0.2);
    tl.to([this.head, this.markersEl, this.links], { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, this.reduced ? 0.3 : T.return - 0.4);
    this.overviewRail();
    void this.audio.chapter(null, C.audio.crossfade);
    this.markIndex(-1);
  }

  private playLayer(i: number): void {
    this.layers.forEach((l, k) => {
      const v = l.querySelector('video');
      if (!v) return;
      if (k === i && this.inView) void v.play().catch(() => {});
      else v.pause();
    });
  }

  private pauseLayers(): void {
    this.layers.forEach((l) => l.querySelector('video')?.pause());
  }

  private markIndex(i: number): void {
    this.indexBtns.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
  }

  // --------------------------------------------------------------------------
  // Card and rail
  // --------------------------------------------------------------------------
  private showCard(i: number): void {
    const ch: Chapter = this.chapters[i];
    const alt = C.showAltitudes ? `  ·  ${fmt(ch.altitude)}` : '';
    this.cardLabel.textContent = `Chapter ${ch.number}  ·  ${ch.name}${alt}`;
    this.cardPoem.innerHTML = '';
    ch.lines.forEach((line, li) => {
      line.split(' ').forEach((w, wi, arr) => {
        const s = document.createElement('span');
        s.className = 'dx-word';
        s.textContent = wi < arr.length - 1 ? `${w} ` : w;
        this.cardPoem.appendChild(s);
      });
      if (li === 0) this.cardPoem.appendChild(document.createElement('br'));
    });
    this.discover.hidden = i !== this.chapters.length - 1;
    const wasHidden = this.card.hidden;
    this.card.hidden = false;
    const words = this.cardPoem.querySelectorAll('.dx-word');
    if (wasHidden) gsap.fromTo(this.card, { opacity: 0 }, { opacity: 1, duration: 0.6 });
    gsap.set([this.cardLabel, this.discover], { opacity: 1 });
    if (this.reduced) gsap.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    else
      gsap.fromTo(
        words,
        { opacity: 0, filter: 'blur(8px)', y: 10 },
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.9, stagger: 0.06, ease: 'power2.out', clearProps: 'filter' },
      );
    if (wasHidden && this.lastFocus && this.lastFocus !== document.body) {
      this.q<HTMLButtonElement>('.dx-return').focus({ preventScroll: true });
    }
  }

  private moveDot(i: number, duration: number): void {
    const p = `${this.tickPct(i)}%`;
    const props = this.mode === 'mobile' ? { left: p, top: '0%' } : { top: p, left: '0px' };
    gsap.to(this.railDot, { ...props, opacity: 1, duration, ease: 'power2.inOut' });
    this.railValue.classList.remove('is-overview');
    if (!this.altitude.v) this.altitude.v = this.chapters[0].altitude + 600;
    gsap.to(this.altitude, {
      v: this.chapters[i].altitude,
      duration: Math.max(duration, 0.01),
      ease: 'power2.inOut',
      onUpdate: () => (this.railValue.textContent = fmt(this.altitude.v)),
    });
  }

  private overviewRail(): void {
    gsap.to(this.railDot, { opacity: 0, duration: 0.6 });
    this.railValue.classList.add('is-overview');
    this.railValue.textContent = 'Above the valley';
    this.altitude.v = 0;
  }

  // --------------------------------------------------------------------------
  // Input
  // --------------------------------------------------------------------------
  private bind(): void {
    this.q('.dx-begin').addEventListener('click', () => this.open(0));
    this.q('.dx-return').addEventListener('click', () => this.back());
    this.q('.dx-prev').addEventListener('click', () => this.swap(this.current - 1));
    this.q('.dx-next').addEventListener('click', () => this.swap(this.current + 1));
    this.discover.addEventListener('click', () => {
      this.back();
      document.querySelector('#story')?.scrollIntoView({ behavior: this.reduced ? 'auto' : 'smooth' });
    });

    // Click on the empty scene while a chapter is open returns to the mountain.
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (this.current >= 0 && !this.card.contains(t) && !t.closest('button, a')) this.back();
    });

    document.addEventListener('keydown', (e) => {
      if (!this.inView || this.current < 0) return;
      if (e.key === 'Escape') this.back();
      else if (e.key === 'ArrowRight') this.swap(this.current + 1);
      else if (e.key === 'ArrowLeft') this.swap(this.current - 1);
    });

    // Swipe on the mobile bottom sheet.
    let sx = 0;
    this.card.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
    this.card.addEventListener(
      'touchend',
      (e) => {
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 50) this.swap(this.current + (dx < 0 ? 1 : -1));
      },
      { passive: true },
    );

    // Sound.
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSound();
    });
    if (storage(true) === '1') {
      this.hint.hidden = false;
      const first = (e: Event) => {
        if ((e.target as HTMLElement).closest('.dx-sound')) return;
        this.hint.hidden = true;
        if (!this.audio.isOn) this.toggleSound();
      };
      this.root.addEventListener('pointerdown', first, { once: true });
    }

    // Idle hint resets on interaction.
    ['pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
      window.addEventListener(ev, () => this.current < 0 && this.armIdle(), { passive: true }),
    );

    // Parallax: desktop with a fine pointer only.
    if (!this.reduced && window.matchMedia('(pointer: fine)').matches) {
      this.root.addEventListener('pointermove', (e) => {
        const r = this.root.getBoundingClientRect();
        this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        this.pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      });
      const loop = () => {
        const p = this.pointer;
        const k = C.parallax.lerp;
        p.cx += (p.x - p.cx) * k;
        p.cy += (p.y - p.cy) * k;
        if (this.mode === 'desktop') {
          this.parVideo.style.transform = `translate3d(${-p.cx * C.parallax.video}px, ${-p.cy * C.parallax.video}px, 0)`;
          this.mistWrap.style.transform = `translate3d(${-p.cx * C.parallax.mist}px, ${-p.cy * C.parallax.mist}px, 0)`;
        }
        this.parallaxRaf = this.inView ? requestAnimationFrame(loop) : 0;
      };
      this.startParallax = () => {
        if (!this.parallaxRaf) this.parallaxRaf = requestAnimationFrame(loop);
      };
      this.startParallax();
    }

    let raf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.layout());
    });
    this.mq.addEventListener('change', () => {
      this.mode = this.mq.matches ? 'mobile' : 'desktop';
      this.setMedia();
      this.layers.forEach((l, i) => l.dataset.mode && (delete l.dataset.mode, i === this.current && this.loadLayer(i)));
      this.layout();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.audio.duck(C.audio.fadeOutHidden);
      else if (this.inView) this.audio.unduck(C.audio.fadeOutHidden);
    });
  }

  private startParallax: () => void = () => {};

  private toggleSound(): void {
    const on = !this.audio.isOn;
    if (on) void this.audio.start(C.audio.fadeIn);
    else this.audio.stop();
    this.soundBtn.setAttribute('aria-pressed', String(on));
    this.soundBtn.setAttribute('aria-label', on ? 'Turn off river sound' : 'Turn on river sound');
    this.soundLabel.textContent = on ? 'River sound on' : 'Sound off';
    this.hint.hidden = true;
    storage(false, on ? '1' : '0');
  }

  private observe(): void {
    const io = new IntersectionObserver(
      ([entry]) => {
        this.inView = entry.isIntersecting;
        document.documentElement.classList.toggle('hero-in-view', this.inView);
        if (this.inView) {
          if (!this.reduced) this.mist.start();
          if (this.master.querySelector('source') && !this.reduced) void this.master.play().catch(() => {});
          if (C.mistVideo && !this.reduced) void this.mistVideo.play().catch(() => {});
          if (this.current >= 0) this.playLayer(this.current);
          this.audio.unduck(C.audio.fadeOutHidden);
          this.startParallax();
        } else {
          this.mist.stop();
          this.master.pause();
          this.mistVideo.pause();
          this.pauseLayers();
          this.audio.duck(C.audio.fadeOutHidden);
        }
      },
      { threshold: 0.25 },
    );
    io.observe(this.root);
  }

  // --------------------------------------------------------------------------
  // Idle hint: one brighter, slower pulse on marker 01
  // --------------------------------------------------------------------------
  private armIdle(): void {
    this.stopIdle();
    if (this.idleCount >= 3 || this.reduced) return;
    this.idleTimer = window.setTimeout(() => this.pulse(), this.idleCount ? 20000 : 10000);
  }

  private stopIdle(): void {
    clearTimeout(this.idleTimer);
  }

  private pulse(): void {
    if (this.current >= 0) return;
    this.idleCount++;
    const m = this.markers[0];
    m.classList.add('is-hint');
    window.setTimeout(() => m.classList.remove('is-hint'), 4400);
    this.armIdle();
  }

  // --------------------------------------------------------------------------
  // Dev: ?markers=edit
  // --------------------------------------------------------------------------
  private editMode(): void {
    this.root.classList.add('dx-edit');
    console.info('[Varunaya] Marker edit mode: drag markers; new percentages are logged for heroConfig.');
    this.markers.forEach((m, i) => {
      m.addEventListener(
        'click',
        (e) => {
          e.stopImmediatePropagation();
          e.preventDefault();
        },
        true,
      );
      m.addEventListener('pointerdown', (e) => {
        m.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => {
          const r = this.frame.getBoundingClientRect();
          const x = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
          const y = Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100));
          Object.assign(m.style, { left: `${x}%`, top: `${y}%` });
          (m.dataset as DOMStringMap).pos = `[${x.toFixed(1)}, ${y.toFixed(1)}]`;
        };
        const up = () => {
          m.removeEventListener('pointermove', move);
          console.info(`[Varunaya] ${this.chapters[i].id}.marker.${this.mode} = ${m.dataset.pos}`);
        };
        m.addEventListener('pointermove', move);
        m.addEventListener('pointerup', up, { once: true });
      });
    });
  }
}

export function initHero(reducedMotion: boolean): Hero | null {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  return root ? new Hero(root, reducedMotion) : null;
}
