import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "My Portfolio",
  author: "Your Name",
  description: "A professional portfolio showcasing creative work",

  // US Letter format
  dimensions: { width: 8.5, height: 11, unit: 'in' },
  margins: { top: 0.75, bottom: 0.75, inner: 1, outer: 0.75 },
  bleed: 0.125,
  dpi: 300,
  colorSpace: 'RGB',

  defaultFont: {
    family: 'Inter',
    size: 11,
  },

  fonts: [
    {
      family: 'Inter',
      source: 'google',
      weights: ['300', '400', '600', '700'],
    },
    {
      family: 'Space Grotesk',
      source: 'google',
      weights: ['400', '700'],
    },
  ],

  pageNumbering: {
    format: 'arabic',
    position: 'footer',
    alignment: 'outside',
  },

  chapters: {
    startOn: 'right',
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
      cropMarks: false,
    },
    web: {
      flipAnimation: true,
      responsive: true,
    },
  },
};
