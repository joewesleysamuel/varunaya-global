import type { RangeStage } from '../scroll/scenes';

interface SizeSpec {
  scale: number;
  specs: Record<string, string>;
}

// Scale values are visual proportions only. [To be confirmed] marks placeholders.
const SIZES: Record<string, SizeSpec> = {
  '330': { scale: 0.82, specs: { volume: '330 ml', use: 'Rooms, minibars and meetings', pack: '[To be confirmed]', label: 'Available' } },
  '500': { scale: 1, specs: { volume: '500 ml', use: 'Cafes, desks and travel', pack: '[To be confirmed]', label: 'Available' } },
  '1000': { scale: 1.12, specs: { volume: '1 litre', use: 'Dining and banquets', pack: '[To be confirmed]', label: 'Available' } },
};

/** Size buttons: a full turn from the real frames, a resize, and new specs. */
export function initRange(stage: RangeStage | null): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.size')];
  const fields = document.querySelectorAll<HTMLElement>('[data-spec]');
  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      const spec = SIZES[btn.dataset.size ?? '500'];
      if (!spec || btn.getAttribute('aria-pressed') === 'true') return;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      fields.forEach((f) => {
        const v = spec.specs[f.dataset.spec ?? ''];
        if (v !== undefined) f.textContent = v;
      });
      stage?.setScale(spec.scale);
      stage?.spin();
    }),
  );
}
