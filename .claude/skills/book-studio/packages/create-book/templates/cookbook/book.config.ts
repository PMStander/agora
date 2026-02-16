import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "Family Recipes",
  author: "Chef Name",
  description: "A collection of beloved family recipes",
  
  // Common cookbook size
  dimensions: { width: 7.5, height: 9.25, unit: 'in' },
  margins: { top: 0.75, bottom: 0.75, inner: 1, outer: 0.75 },
  bleed: 0.125,
  dpi: 300,
  colorSpace: 'CMYK',
  
  defaultFont: {
    family: 'Merriweather',
    size: 10.5,
    lineHeight: 1.6,
  },
  
  fonts: [
    {
      family: 'Merriweather',
      source: 'google',
      weights: ['400', '700'],
    },
    {
      family: 'Montserrat',
      source: 'google',
      weights: ['400', '600', '700'],
    },
  ],
  
  pageNumbering: {
    format: 'arabic',
    position: 'footer',
    alignment: 'outside',
  },
  
  outputs: {
    images: {
      format: 'png',
      quality: 95,
      dpi: 300,
    },
    pdf: {
      colorSpace: 'CMYK',
      bleeds: true,
    },
    epub: {
      version: 3,
      reflowable: false, // Fixed layout for recipes
      toc: true,
    },
  },
};
