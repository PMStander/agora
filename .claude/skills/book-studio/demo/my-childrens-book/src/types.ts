import React from 'react';

export interface BookConfig {
  title: string;
  author: string;
  description?: string;
  dimensions: { width: number; height: number; unit: string };
  margins: { top: number; bottom: number; inner: number; outer: number };
  bleed?: number;
  dpi?: number;
}

export interface PageContextType {
  pageNumber: number;
  isLeftPage: boolean;
  isRightPage: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;
  chapterTitle: string | null;
  chapterNumber: number | null;
}

export interface PageProps {
  layout?: 'margins' | 'full-bleed' | 'text-only';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  backgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
  density?: 'hard' | 'soft';
  children?: React.ReactNode;
}

export interface ChapterProps {
  title: string;
  number?: number;
  startOn?: 'left' | 'right' | 'either';
  children?: React.ReactNode;
}

export interface BookProps {
  config: BookConfig;
  children?: React.ReactNode;
}
