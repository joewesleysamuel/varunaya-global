# Varunaya Global home page

A single-page, Apple-style product page for Varunaya Global. Bright paper white with black type and a black logo, soft grey and deep charcoal bands, and a black "Obelisk" bottle rendered photoreal in Blender Cycles and scrubbed by scroll.

Stack: Vite, vanilla TypeScript, GSAP with ScrollTrigger, Lenis. No UI frameworks, no CSS libraries, no WebGL at runtime. The motion comes from pre-rendered frame sequences, the same technique Apple uses on its product pages, so the bottle looks like a photograph and the page stays light.

## Versions

Each version is saved as its own branch on GitHub.

- `main` is what the client sees at https://varunaya.joewesleysamuel.com. Only `main` deploys.
- Work in progress happens on the next version's branch. Pushing it never changes the client link.
- To publish a version, merge its branch into `main` and push; the site redeploys in about a minute.
- Once a version is published, its branch is a frozen snapshot and is not changed again.

| Version | Branch | Status | Date | Notes |
| --- | --- | --- | --- | --- |
| Version 1 | `version-1` | Live (shared with the client) | 2026-11-15 | First look. White layout with charcoal bands, black Obelisk bottle rendered in Blender, scroll animations, placeholder copy. |
| Version 2 | `version-2` | In progress (private) | | New hero "The Descent": five altitudes with zoom transitions, altitude rail, chapter poems and river ambience. Placeholder plates and sound until footage arrives. |

## Hero: "The Descent" (Version 2)

The hero tells the journey of one drop of water in five altitudes: Peak, Thaw, Stone, Stillness, Vessel. Code: `src/hero/` (`config.ts`, `Hero.ts`, `audio.ts`, `mist.ts`, `hero.css`). Every tunable value (copy, altitudes, marker positions, file paths, zoom, timings, volumes, `showBottle`, `showAltitudes`, grade) lives in `src/hero/config.ts`.

### What is placeholder right now

Realism has to come from real or generated footage; code cannot fake it. Until the clips exist:

- Images: the master shot, mobile shot and five close ups are stills rendered in Blender from a procedural valley (`render/valley.py`). They are cohesive and framed for the markers, but they are not photographs. Replace them.
- Motion: the page adds breathing, zoom, settle and a built-in canvas mist over the stills. Real clips replace the stills automatically once their paths are set.
- Sound: every layer uses a quiet ambience generated in the browser (filtered noise, drips, lapping, a pour). Replace with licensed recordings.
- Bottle: the Obelisk concept render.

### Asset files still needed

Put files in `public/assets/hero/video/`, `public/assets/hero/audio/` and `public/assets/hero/img/`, then set their paths in `src/hero/config.ts` (replace `video: null` or `audio: null`).

| File | Spec | Config slot |
| --- | --- | --- |
| `video/hero-master-desktop.mp4` + `.webm` | DONE (Gemini clip, 1280x720, made into a 20s forward-and-back loop). For final launch, a 2560x1440 version would be sharper on large screens. Note: the visible Gemini watermark is still in the bottom-right corner. | `master.desktop.video` |
| `video/hero-master-mobile.mp4` + `.webm` | DONE (406x720 crop of the Gemini clip centred on the peak). A native 9:16 generation at 1080x1920 would be sharper. | `master.mobile.video` |
| `img/hero-poster-desktop.webp`, `img/hero-poster-mobile.webp` | First frame of each master clip, under 250 KB (currently the Blender stills) | `master.*.poster` |
| `video/chapter-01-peak.mp4` to `video/chapter-05-vessel.mp4` (+ `.webm`) | 16:9 close ups, 1920x1080, 10 to 15s seamless loops, under 5 MB each, plus 9:16 mobile versions | `chapters[n].media.*.video` |
| `img/chapter-01-peak.webp` to `img/chapter-05-vessel.webp` | First frame of each close up (currently the Blender stills) | `chapters[n].media.*.poster` |
| `video/mist-overlay.mp4` + `.webm` | White mist drifting on pure black, 1920x1080, 20s loop | `mistVideo` |
| `audio/amb-base.mp3` | Slow, gentle distant mountain stream, very soft high wind; 60 to 90s seamless loop, 44.1 kHz stereo | `audio.base` |
| `audio/amb-peak.mp3` | Thin cold wind across snow, faint ice creaks | `chapters[0].audio` |
| `audio/amb-thaw.mp3` | Slow meltwater drips and a tiny trickle | `chapters[1].audio` |
| `audio/amb-stone.mp3` | Water running softly over and between stones, close | `chapters[2].audio` |
| `audio/amb-stillness.mp3` | Almost silent lake: faintest lapping, one distant bird | `chapters[3].audio` |
| `audio/amb-vessel.mp3` | Soft water pouring into glass, then stillness | `chapters[4].audio` |
| `img/bottle.webp` | Transparent image of the real bottle, standing, tightly cropped | `bottle.src` |

Sound must stay calm: still water and slow flow, never a rushing river. Use licensed sources (Freesound CC0, Epidemic Sound, Artlist, or an AI sound effects tool). Colour footage is graded by the `grade` value (Silver Hour); set it to `'none'` to compare full colour.

### Markers

Positions are percentages of the media frame, so they stay on the landscape at any screen ratio. If new footage is framed differently, open the page with `?markers=edit`, drag each marker onto its spot, and paste the logged values into `config.ts`. The current values were projected from the 3D scene, and the framing keeps every marker clear of the headline block.

### Notes for the client

- Only state real altitudes or "Himalayan" in final copy if the water is sourced there. `showAltitudes: false` hides every number.
- "Sustainability" in the hero nav has no section yet; it currently scrolls to The Source.
- The nav uses the text wordmark in white; swap in a white logo file when one exists.
- Fonts (Instrument Serif, Manrope) are the Google Fonts families, self-hosted through npm for speed and privacy.

### Re-rendering the placeholder plates

```bash
python render/obelisk.py --shot none --save-blend out/obelisk.blend
```

```bash
python render/valley.py --out out/valley --shots master,mobile,peak,thaw,stone,stillness,vessel --bottle out/obelisk.blend
```

`--shots none` only projects the markers (written to `markers.json`) without rendering.

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
