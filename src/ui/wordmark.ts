/**
 * Splits the DOM wordmark into masked letters. In WebGL mode the DOM wordmark
 * is hidden and only used for layout (the backdrop redraws it in 3D so the
 * glass can refract it). Without WebGL, these spans are what rises.
 */
export function splitWordmark(): HTMLElement[] {
  const el = document.querySelector<HTMLElement>('.wordmark__inner');
  if (!el) return [];
  const text = el.textContent?.trim() ?? '';
  el.textContent = '';
  return [...text].map((ch) => {
    const outer = document.createElement('span');
    outer.className = 'char';
    const inner = document.createElement('span');
    inner.textContent = ch;
    outer.appendChild(inner);
    el.appendChild(outer);
    return inner;
  });
}
