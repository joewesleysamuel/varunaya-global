import '@fontsource/bricolage-grotesque/latin-300.css';
import '@fontsource/bricolage-grotesque/latin-500.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import './styles/main.css';

import { gsap, initSmoothScroll } from './scroll/smooth';
import { initScenes } from './scroll/scenes';
import { splitWordmark } from './ui/wordmark';
import { initScrollReveals, revealHeadline } from './ui/reveals';
import { initRange } from './ui/range';

const root = document.documentElement;
root.classList.add('js');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (new URLSearchParams(location.search).has('placeholders')) root.classList.add('show-placeholders');

async function fontsReady(timeout = 1200): Promise<void> {
  await Promise.race([
    Promise.all([document.fonts.load('300 1em "Bricolage Grotesque"'), document.fonts.load('800 1em "Bricolage Grotesque"')]),
    new Promise((r) => setTimeout(r, timeout)),
  ]);
}

async function boot(): Promise<void> {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const letters = splitWordmark();
  initSmoothScroll(reducedMotion);
  await fontsReady();

  // One orchestrated load sequence: headline, then the wordmark rises behind the bottle.
  const heroTitle = document.querySelector('.hero__title');
  if (reducedMotion) {
    heroTitle?.classList.add('is-revealed');
  } else {
    const tl = gsap.timeline();
    if (heroTitle) revealHeadline(heroTitle, tl, 0.1);
    tl.fromTo(letters, { y: 0, yPercent: 110 }, { yPercent: 0, duration: 1.6, ease: 'expo.out', stagger: 0.06 }, 0.45);
    tl.from('.stage--hero', { opacity: 0, y: 40, duration: 1.6, ease: 'expo.out', clearProps: 'opacity' }, 0.3);
  }
  initScrollReveals(reducedMotion);

  const rangeStage = await initScenes(reducedMotion);
  initRange(rangeStage);
}

boot();
