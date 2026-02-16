import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "My Book",
  author: "Your Name",
  dimensions: { width: 6, height: 9, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  bleed: 0.125,
  dpi: 300,
  colorSpace: 'CMYK',
  
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
      pdfA: true,
      colorSpace: 'CMYK',
      bleeds: true,
      cropMarks: true,
    },
    epub: {
      version: 3,
      reflowable: true,
      toc: true,
      cover: true,
    },
    web: {
      flipAnimation: true,
      zoom: true,
      search: true,
    },
  },
};
