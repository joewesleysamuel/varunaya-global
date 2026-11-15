# Varunaya Global home page

A single-page, Apple-style product page for Varunaya Global. Bright paper white with black type and a black logo, soft grey and deep charcoal bands, and a black "Obelisk" bottle rendered photoreal in Blender Cycles and scrubbed by scroll.

Stack: Vite, vanilla TypeScript, GSAP with ScrollTrigger, Lenis. No UI frameworks, no CSS libraries, no WebGL at runtime. The motion comes from pre-rendered frame sequences, the same technique Apple uses on its product pages, so the bottle looks like a photograph and the page stays light.

## Versions

Each client-facing version is saved as its own branch on GitHub. `main` is always what is live at https://varunaya.joewesleysamuel.com.

| Version | Branch | Commit | Date | Notes |
| --- | --- | --- | --- | --- |
| demo-1 | `demo-1` | `3305cc8` | 2026-11-15 | First look for the client. White layout with charcoal bands, black Obelisk bottle, scroll animations, placeholder copy. |

To put a saved version back live, merge or reset `main` to its branch and push; the site redeploys in about a minute. Saved branches are never changed after they are created.

## Run

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run preview
```

`npm run build` type-checks with `tsc --noEmit`, then builds to `dist/`.

Add `?placeholders` to the URL to outline every placeholder string.

## Project structure

```
index.html                 Markup and all copy
public/
  sequence/turntable/      96-frame turn of the bottle (+ s/ phone set, manifest.json)
  sequence/dolly/          60-frame push-in toward the cap (+ s/, manifest.json)
  media/detail.webp        Macro still used in the Story section
render/
  obelisk.py               Blender scene: bottle, materials, studio, camera moves
  pack.py                  PNG frames -> WebP sequence + manifest
  fonts/                   Bricolage Grotesque TTFs for the etched wordmark
src/
  main.ts                  Load sequence, smooth scroll, scenes, range
  styles/main.css          Tokens, layout, responsive, reduced motion
  sequence/FrameSequence.ts  Canvas scrubber: coarse-to-fine loading, nearest frame
  scroll/smooth.ts         Lenis on the GSAP ticker
  scroll/scenes.ts         Hero turn, story parallax, range spins, process push-in
  ui/                      reveals, range buttons, wordmark split
```

## How the page moves

- Hero: the section is 2.6 screens tall with a sticky stage. Scrolling turns the bottle half a revolution, lifts the headline away and reveals two design notes.
- Story: the macro still settles from a slight zoom as it passes.
- Marquee: one continuous band of solid and outlined type.
- Range (charcoal band): the second half of the turn scrubs as the band passes. The size buttons play a full real-frame spin and rescale the bottle.
- Process: the stage sticks while the four steps scroll past; the camera pushes in toward the cap and the active step darkens.
- Contact (charcoal band): closing line and quote button.

Frames load coarse to fine (every 8th frame first), the canvas always draws the nearest loaded frame, and phones get a smaller frame set. The first frame is a normal `<img>` with `fetchpriority="high"`, so the page paints immediately and still works without JavaScript.

## Re-rendering the bottle

The bottle, materials and studio are all code in `render/obelisk.py`, so the design can be changed and re-rendered. It needs Blender 4.2 or newer, either the app or the `bpy` Python module (Python 3.13 for bpy 5.x).

```bash
pip install bpy fonttools pillow
```

```bash
python render/obelisk.py --shot test --out out/test --res 800x1200 --samples 64
```

```bash
python render/obelisk.py --shot turntable --out out/turntable --frames 0-95 --res 800x1200 --samples 64
```

```bash
python render/obelisk.py --shot dolly --out out/dolly --frames 0-59 --res 800x1200 --samples 64
```

```bash
python render/obelisk.py --shot detail --out out/detail --res 1600x1000 --samples 128
```

A long render can be split or resumed: pass the slice with `--frames 40-59` and the full length with `--total 60` so the camera move stays the same.

Then pack the frames for the web:

```bash
python render/pack.py out/turntable public/sequence/turntable
```

```bash
python render/pack.py out/dolly public/sequence/dolly
```

```bash
python render/pack.py --still out/detail/frame_0000.png public/media/detail.webp
```

On a 4-core CPU a frame takes 35 to 55 seconds at these settings. A GPU (CUDA, OptiX, Metal) is many times faster: set `scene.cycles.device = "GPU"` in the script.

Design notes: square-section flacon lofted from a superellipse profile, satin black glass with a faint micro texture and light clear coat, wordmark etched in gloss black running up the front face, heavy square cap in polished black chrome, condensation as instanced water droplets, two tall strip lights for the edge streaks, a shadow catcher for the contact shadow, transparent background so one set of frames works on both white and charcoal sections.

## Swapping in your own renders or film

Any image sequence works. Drop frames into `public/sequence/<name>/` and write a `manifest.json`:

```json
{
  "frameCount": 96,
  "width": 800,
  "height": 1200,
  "pattern": "frame_{index}.webp",
  "small": "s/frame_{index}.webp",
  "pad": 4,
  "start": 0
}
```

Transparent WebP (with the shadow in the alpha) lets the same frames sit on both white and charcoal bands. For photographed footage on a fixed background, match the section background to the footage.

## Deploy

The build is static. Any static host works: Netlify or Cloudflare Pages (build `npm run build`, output `dist`), Vercel (Vite preset), or any bucket. Give `/assets/*` and `/sequence/*` long cache headers.

## Accessibility and motion

- Landmarks, skip link, visible focus rings, keyboard-operable size buttons with `aria-pressed`, live spec list.
- The hero bottle is a real image with alt text; the scrub canvases are `aria-hidden`.
- Only headlines use mask reveals; body copy does not animate.
- `prefers-reduced-motion`: native scroll, no marquee, no reveals, no spins, everything visible at rest. Scroll still changes the frame, since that is driven directly by the reader.

## Placeholders to replace

Nothing below is a verified claim. `?placeholders` outlines each one on the page.

| Location | Placeholder |
| --- | --- |
| Story paragraph | `[source location]`, `[filtration stages]`, `[line type]`, and the sentences "Nothing is added that does not belong." and "Every bottle leaves the plant the way it was filled." |
| Process step 01 Source | `[source type and location]` |
| Process step 02 Filter | `[list each filtration stage]` |
| Process step 03 Balance | `[target profile]` and "for a clean, even taste" |
| Process step 04 Seal | `[line and standard]` |
| Range spec "Case pack" (`index.html`, `src/ui/range.ts`) | `[To be confirmed]` for all sizes |
| Range size scales (`src/ui/range.ts`) | Visual proportions only, not real dimensions |
| Contact | `hello@varunaya.example` (button and text) |
| Footer | `[Street address]`, `[City]`, `[Phone number]`, `tel:+000000000000`, `[Licence and certification numbers]` |
| Bottle design (`render/obelisk.py`) | An original concept render, not a manufactured bottle. Confirm the shape, finish and wordmark placement with your bottle supplier before production. |
