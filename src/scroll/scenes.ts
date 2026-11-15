import { gsap, ScrollTrigger } from './smooth';
import { FrameSequence } from '../sequence/FrameSequence';

export interface RangeStage {
  /** Uniform scale of the bottle for a size. */
  setScale(scale: number): void;
  /** A full turn played from the real frames. */
  spin(): void;
}

const live: FrameSequence[] = [];

async function sequenceFor(canvas: HTMLCanvasElement | null): Promise<FrameSequence | null> {
  if (!canvas?.dataset.sequence) return null;
  const seq = await FrameSequence.create(canvas.dataset.sequence, canvas);
  if (seq) live.push(seq);
  return seq;
}

/** Starts loading a sequence once its section is within two screens. */
function loadWhenNear(seq: FrameSequence, trigger: Element): void {
  ScrollTrigger.create({ trigger, start: 'top 300%', once: true, onEnter: () => void seq.load() });
}

/* 1. Hero: the stage sticks for ~1.6 screens while the bottle makes a half turn. */
async function hero(reducedMotion: boolean): Promise<void> {
  const section = document.querySelector<HTMLElement>('.hero');
  const canvas = section?.querySelector<HTMLCanvasElement>('.stage__canvas') ?? null;
  const bar = section?.querySelector<HTMLElement>('.loader span');
  const seq = await sequenceFor(canvas);
  if (!section) return;

  if (seq) {
    await seq.load((p) => {
      if (bar) gsap.to(bar, { scaleX: p, duration: 0.4, overwrite: true });
    });
    seq.setFrame(0);
  }
  section.querySelector('.loader')?.classList.add('is-done');

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: reducedMotion ? true : 0.8,
      onUpdate: (st) => seq?.setProgress(st.progress * 0.5),
    },
  });
  if (reducedMotion) return;
  tl.to('.hero__head', { yPercent: -40, opacity: 0, scale: 0.94, duration: 0.35 }, 0)
    .to('.hero__foot', { opacity: 0, y: 30, duration: 0.25 }, 0)
    .to('.wordmark', { opacity: 0, scale: 1.08, duration: 0.5 }, 0)
    .to('.stage--hero', { y: () => -window.innerHeight * 0.05, duration: 1 }, 0)
    .to('[data-note]', { clipPath: 'inset(0 0 0% 0)', duration: 0.25, stagger: 0.08 }, 0.38)
    .to({}, { duration: 0.2 });
}

/* 2. Story: the detail image settles from a slight zoom as it passes. */
function story(reducedMotion: boolean): void {
  const img = document.querySelector('.story__media img');
  if (!img || reducedMotion) return;
  gsap.fromTo(
    img,
    { scale: 1.18 },
    { scale: 1, ease: 'none', scrollTrigger: { trigger: '.story__media', start: 'top bottom', end: 'bottom top', scrub: 0.8 } },
  );
}

/* 4. Range: the second half of the turn, plus real-frame spins on size change. */
async function range(reducedMotion: boolean): Promise<RangeStage | null> {
  const section = document.querySelector<HTMLElement>('.range');
  const stage = section?.querySelector<HTMLElement>('.stage--range');
  const seq = await sequenceFor(section?.querySelector('.stage__canvas') ?? null);
  if (!section || !stage || !seq) return null;
  loadWhenNear(seq, section);

  const state = { scroll: seq.count / 2, spin: 0 };
  const render = () => seq.setFrame(state.scroll + state.spin);
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
    onUpdate: (st) => {
      state.scroll = seq.count / 2 + st.progress * (seq.count / 2 - 1);
      render();
    },
  });
  render();

  return {
    setScale(scale) {
      gsap.to(stage, { scale, duration: reducedMotion ? 0 : 1.4, ease: 'expo.inOut', overwrite: 'auto' });
    },
    spin() {
      if (reducedMotion) return;
      gsap.fromTo(state, { spin: 0 }, { spin: seq.count, duration: 1.4, ease: 'expo.inOut', onUpdate: render, overwrite: true });
    },
  };
}

/* 5. Process: the camera pushes in toward the cap as the four steps pass. */
async function process(): Promise<void> {
  const section = document.querySelector<HTMLElement>('.process');
  if (!section) return;
  document.querySelectorAll('.step').forEach((step) => {
    ScrollTrigger.create({ trigger: step, start: 'top 62%', end: 'bottom 62%', toggleClass: 'is-active' });
  });
  const stage = section.querySelector<HTMLElement>('.stage--process');
  const seq = await sequenceFor(section.querySelector('.stage__canvas'));
  if (!seq) return;
  loadWhenNear(seq, section);
  seq.setFrame(0);
  ScrollTrigger.create({
    trigger: section.querySelector('.steps') ?? section,
    start: 'top 70%',
    end: 'bottom 60%',
    scrub: true,
    onUpdate: (st) => {
      seq.setProgress(st.progress);
      stage?.style.setProperty('--fade', `${100 - 28 * st.progress}%`);
    },
  });
}

export async function initScenes(reducedMotion: boolean): Promise<RangeStage | null> {
  story(reducedMotion);
  const [, rangeStage] = await Promise.all([hero(reducedMotion), range(reducedMotion), process()]);

  let raf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => live.forEach((s) => s.resize()));
  });
  window.addEventListener('pagehide', () => live.forEach((s) => s.dispose()));
  ScrollTrigger.refresh();
  return rangeStage;
}
