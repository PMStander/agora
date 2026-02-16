import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "The Great Novel",
  author: "Author Name",
  
  // Standard novel size
  dimensions: { width: 6, height: 9, unit: 'in' },
  margins: { top: 0.75, bottom: 1, inner: 0.875, outer: 0.75 },
  bleed: 0,
  dpi: 300,
  colorSpace: 'CMYK',
  
  defaultFont: {
    family: 'Merriweather',
    size: 11,
    lineHeight: 1.5,
  },
  
  fonts: [
    {
      family: 'Merriweather',
      source: 'google',
      weights: ['300', '400', '700'],
    },
  ],
  
  pageNumbering: {
    format: 'arabic',
    position: 'footer',
    alignment: 'center',
  },
  
  chapters: {
    startOn: 'right',
    headerStyle: 'alternating',
    showNumber: true,
    showTitle: true,
  },
  
  outputs: {
    pdf: {
      colorSpace: 'CMYK',
    },
    epub: {
      reflowable: true,
      toc: true,
    },
  },
};
