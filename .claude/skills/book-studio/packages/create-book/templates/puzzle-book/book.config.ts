import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "Brain Teasers",
  author: "Puzzle Master",
  
  dimensions: { width: 8.5, height: 11, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  bleed: 0,
  dpi: 300,
  
  defaultFont: {
    family: 'Inter',
    size: 12,
  },
  
  fonts: [
    {
      family: 'Inter',
      source: 'google',
      weights: ['400', '600'],
    },
  ],
  
  pageNumbering: {
    position: 'footer',
    alignment: 'center',
  },
};
