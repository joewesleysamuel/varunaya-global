import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scroll driven by the GSAP ticker, so scroll, ScrollTrigger
 * and the WebGL frame all advance on one requestAnimationFrame.
 * With reduced motion, native scrolling is kept.
 */
export function initSmoothScroll(reducedMotion: boolean): Lenis | null {
  // Modest lag smoothing: a blocked frame (first GPU upload) must not make
  // the load sequence skip ahead, but normal frames stay in sync with Lenis.
  gsap.ticker.lagSmoothing(250, 33);
  if (reducedMotion) return null;

  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: -52 } /* header height */ });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  return lenis;
}

export { gsap, ScrollTrigger };
