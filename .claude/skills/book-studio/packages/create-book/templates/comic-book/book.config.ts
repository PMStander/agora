import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "My Comic",
  author: "Your Name",
  description: "A comic book with panel layouts and speech bubbles",

  // Standard US comic book dimensions
  dimensions: { width: 6.625, height: 10.25, unit: 'in' },
  margins: { top: 0.375, bottom: 0.375, inner: 0.5, outer: 0.375 },
  bleed: 0.125,
  dpi: 300,
  colorSpace: 'CMYK',

  defaultFont: {
    family: 'Bangers',
    size: 14,
  },

  fonts: [
    {
      family: 'Bangers',
      source: 'google',
      weights: ['400'],
    },
    {
      family: 'Comic Neue',
      source: 'google',
      weights: ['400', '700'],
    },
  ],

  pageNumbering: {
    format: 'arabic',
    position: 'footer',
    alignment: 'center',
  },

  outputs: {
    images: {
      format: 'png',
      quality: 95,
      dpi: 300,
      colorSpace: 'RGB',
    },
    pdf: {
      colorSpace: 'CMYK',
      bleeds: true,
      cropMarks: true,
    },
  },
};
