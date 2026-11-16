/**
 * heroConfig: every tunable value for "The Descent" hero lives here.
 *
 * Media: each slot takes a poster image (always) and an optional video. Leave
 * `video` as null until the real clip exists; the poster is shown with the
 * same breathing, zoom and settle moves. Audio slots work the same way: null
 * means a quiet generated placeholder is used. See README "Hero assets".
 *
 * Marker positions are percentages of the media frame (not the viewport), so
 * they stay pinned to the landscape when object-fit: cover crops it.
 * Use ?markers=edit to drag markers and log new values.
 */
export interface MediaSlot {
  poster: string;
  /** [mp4, webm] or null while the clip does not exist yet. */
  video: [string, string] | null;
}

export interface Chapter {
  id: string;
  number: string;
  name: string;
  altitude: number;
  lines: [string, string];
  marker: { desktop: [number, number]; mobile: [number, number] };
  media: { desktop: MediaSlot; mobile: MediaSlot };
  audio: string | null;
}

const IMG = '/assets/hero/img';

export const heroConfig = {
  /** Set false to hide every altitude number and label (only state real altitudes). */
  showAltitudes: true,
  showBottle: true,
  /** Silver Hour grade applied to colour footage. Use 'none' to compare full colour. */
  grade: 'grayscale(0.82) contrast(1.06) brightness(0.94)',

  frame: {
    // Gemini master clip: 1280x720, and a 406x720 crop of it centred on the peak for phones.
    desktop: { width: 1280, height: 720 },
    mobile: { width: 406, height: 720 },
  },
  master: {
    desktop: { poster: `${IMG}/hero-poster-desktop.webp`, video: ['/assets/hero/video/hero-master-desktop.mp4', '/assets/hero/video/hero-master-desktop.webm'] } as MediaSlot,
    mobile: { poster: `${IMG}/hero-poster-mobile.webp`, video: ['/assets/hero/video/hero-master-mobile.mp4', '/assets/hero/video/hero-master-mobile.webm'] } as MediaSlot,
  },
  /** White mist on pure black, blended with screen. null uses the built-in canvas mist. */
  mistVideo: null as [string, string] | null,

  bottle: {
    src: `${IMG}/bottle.webp`,
    /** Where the bottle's base sits (% of the frame), its height (% of viewport height), and whether it shows. */
    desktop: { base: [70.7, 78.6] as [number, number], heightVh: 34, show: true }, // on the flat shore stone
    mobile: { base: [63.9, 52.6] as [number, number], heightVh: 24, show: false },
  },

  zoom: { desktop: 2.2, mobile: 1.9 },
  timings: {
    zoom: 2.4,
    blurPeak: 1.6,
    crossfadeAt: 1.6,
    crossfade: 1.2,
    railAt: 2.2,
    rail: 1.6,
    cardAt: 2.6,
    settle: 9,
    chapterSwap: 1.4,
    return: 2.2,
  },
  parallax: { video: 4, mist: 12, lerp: 0.06 },

  audio: {
    master: 0.6,
    baseVolume: 0.5,
    chapterVolume: 0.85,
    fadeIn: 3,
    crossfade: 2.5,
    fadeOutHidden: 1.2,
    /** null: generated placeholder ambience. Supply mp3 (ogg optional) paths when ready. */
    base: null as string | null,
  },

  chapters: [
    {
      id: 'peak',
      number: '01',
      name: 'Peak',
      altitude: 5200,
      lines: ['Above the clouds, the years are kept in ice,', 'and time moves only when the sun allows.'],
      marker: { desktop: [50.4, 20.0], mobile: [50.0, 22.0] },
      media: {
        desktop: { poster: `${IMG}/chapter-01-peak.webp`, video: null },
        mobile: { poster: `${IMG}/chapter-01-peak.webp`, video: null },
      },
      audio: null,
    },
    {
      id: 'thaw',
      number: '02',
      name: 'Thaw',
      altitude: 4300,
      lines: ['One warm morning, a single drop lets go,', 'and the long walk to the valley begins.'],
      marker: { desktop: [53.1, 40.3], mobile: [58.6, 40.3] },
      media: {
        desktop: { poster: `${IMG}/chapter-02-thaw.webp`, video: null },
        mobile: { poster: `${IMG}/chapter-02-thaw.webp`, video: null },
      },
      audio: null,
    },
    {
      id: 'stone',
      number: '03',
      name: 'Stone',
      altitude: 3400,
      lines: ['Through granite and slow, dark centuries,', 'the water gathers what the mountain gives.'],
      marker: { desktop: [35.5, 51.7], mobile: [29.0, 48.5] },
      media: {
        desktop: { poster: `${IMG}/chapter-03-stone.webp`, video: null },
        mobile: { poster: `${IMG}/chapter-03-stone.webp`, video: null },
      },
      audio: null,
    },
    {
      id: 'stillness',
      number: '04',
      name: 'Stillness',
      altitude: 2600,
      lines: ['Where the river slows to almost silence,', 'it learns to hold the light.'],
      marker: { desktop: [58.0, 63.0], mobile: [51.0, 52.5] },
      media: {
        desktop: { poster: `${IMG}/chapter-04-stillness.webp`, video: null },
        mobile: { poster: `${IMG}/chapter-04-stillness.webp`, video: null },
      },
      audio: null,
    },
    {
      id: 'vessel',
      number: '05',
      name: 'Vessel',
      altitude: 1800,
      lines: ['Sealed close to the source, untouched by hurry,', 'the mountain arrives in your hand.'],
      marker: { desktop: [64.5, 76.0], mobile: [85.7, 51.7] },
      media: {
        desktop: { poster: `${IMG}/chapter-05-vessel.webp`, video: null },
        mobile: { poster: `${IMG}/chapter-05-vessel.webp`, video: null },
      },
      audio: null,
    },
  ] as Chapter[],
};

export type HeroConfig = typeof heroConfig;
