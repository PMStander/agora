import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "My Photo Album",
  author: "Your Name",
  description: "A beautiful photo book capturing special moments",

  // Large square format for photos
  dimensions: { width: 12, height: 12, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  bleed: 0.125,
  dpi: 300,
  colorSpace: 'RGB',

  defaultFont: {
    family: 'Montserrat',
    size: 12,
  },

  fonts: [
    {
      family: 'Montserrat',
      source: 'google',
      weights: ['300', '400', '600'],
    },
    {
      family: 'Playfair Display',
      source: 'google',
      weights: ['400', '700'],
    },
  ],

  pageNumbering: {
    format: 'arabic',
    position: null, // No page numbers
  },

  outputs: {
    images: {
      format: 'png',
      quality: 95,
      dpi: 300,
      colorSpace: 'RGB',
    },
    pdf: {
      colorSpace: 'RGB',
      bleeds: true,
      cropMarks: true,
    },
  },
};
