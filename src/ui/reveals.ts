import { gsap, ScrollTrigger } from '../scroll/smooth';

/** Mask reveal for one headline: each line slides up inside its own clip. */
export function revealHeadline(el: Element, tl?: gsap.core.Timeline, at: number | string = 0): void {
  const lines = el.querySelectorAll('.line > span');
  const tween = {
    y: 0,
    yPercent: 0,
    duration: 1.25,
    ease: 'expo.out',
    stagger: 0.09,
    onComplete: () => el.classList.add('is-revealed'),
  };
  if (tl) tl.fromTo(lines, { y: 0, yPercent: 105 }, tween, at);
  else gsap.fromTo(lines, { y: 0, yPercent: 105 }, tween);
}

/** Headlines below the fold reveal once as they enter. Only headlines move. */
export function initScrollReveals(reducedMotion: boolean): void {
  const heads = document.querySelectorAll('.reveal:not(.hero__title)');
  heads.forEach((el) => {
    if (reducedMotion) {
      el.classList.add('is-revealed');
      return;
    }
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => revealHeadline(el),
    });
  });
}
