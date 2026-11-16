import '@fontsource/bricolage-grotesque/latin-300.css';
import '@fontsource/bricolage-grotesque/latin-500.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/manrope/latin-300.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import './styles/main.css';
import './hero/hero.css';

import { gsap, initSmoothScroll } from './scroll/smooth';
import { initScenes } from './scroll/scenes';
import { initScrollReveals } from './ui/reveals';
import { initRange } from './ui/range';
import { initHero } from './hero/Hero';

const root = document.documentElement;
root.classList.add('js');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (new URLSearchParams(location.search).has('placeholders')) root.classList.add('show-placeholders');

async function boot(): Promise<void> {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  initSmoothScroll(reducedMotion);
  initHero(reducedMotion);

  // Quiet entrance: the landscape is already there (poster), the words arrive.
  if (!reducedMotion) {
    // The headline is visible from the first frame (it is the largest paint); the rest follows.
    gsap.from('.dx-head > :not(.dx-title)', { opacity: 0, y: 14, duration: 1.4, ease: 'power2.out', stagger: 0.12, delay: 0.3 });
    gsap.from('.dx-markers, .dx-rail, .dx-index, .dx-soundwrap', { opacity: 0, duration: 1.6, delay: 0.9, clearProps: 'opacity' });
  }
  initScrollReveals(reducedMotion);

  const rangeStage = await initScenes(reducedMotion);
  initRange(rangeStage);
}

boot();
