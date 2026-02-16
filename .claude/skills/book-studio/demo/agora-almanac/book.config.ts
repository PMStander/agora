import type { BookConfig } from './src/types';

export const config: BookConfig = {
  title: "The Agora Almanac",
  author: "Agora Studio",
  description: "A showcase of what Bookmotion can do",

  // Landscape-ish format for a showcase book
  dimensions: { width: 9, height: 7, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  bleed: 0.125,
  dpi: 300,
};
