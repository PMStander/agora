import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "My Journal",
  author: "Your Name",
  
  dimensions: { width: 6, height: 9, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  bleed: 0,
  dpi: 300,
  
  defaultFont: {
    family: 'Inter',
    size: 10,
    lineHeight: 1.4,
  },
  
  fonts: [
    {
      family: 'Inter',
      source: 'google',
      weights: ['400', '600'],
    },
  ],
  
  pageNumbering: {
    position: null,
  },
};
