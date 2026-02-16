import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "The Little Explorer",
  author: "Your Name",
  description: "A children's picture book about adventure and discovery",
  
  // Square format common for children's books
  dimensions: { width: 8, height: 8, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 },
  bleed: 0.125,
  dpi: 300,
  colorSpace: 'CMYK',
  
  defaultFont: {
    family: 'Nunito',
    size: 18,
  },
  
  fonts: [
    {
      family: 'Nunito',
      source: 'google',
      weights: ['400', '700'],
    },
    {
      family: 'Fredoka One',
      source: 'google',
      weights: ['400'],
    },
  ],
  
  pageNumbering: {
    format: 'arabic',
    position: null, // No page numbers for children's book
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
    epub: {
      version: 3,
      reflowable: false, // Fixed layout for picture book
      toc: false,
      cover: true,
    },
  },
};
