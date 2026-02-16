import React from 'react';

// Units for measurements
export type Unit = 'in' | 'mm' | 'cm' | 'px' | 'pt';

// Page dimensions
export interface Dimensions {
  width: number;
  height: number;
  unit: Unit;
}

// Margins
export interface Margins {
  top: number;
  bottom: number;
  inner: number;  // Binding edge
  outer: number;
}

// Font configuration
export interface FontConfig {
  family: string;
  size?: number;
  weight?: string;
  style?: 'normal' | 'italic';
  source?: 'google' | 'local' | 'url';
  path?: string;
  weights?: string[];
  subsets?: string[];
}

// Page numbering
export interface PageNumberingConfig {
  startAt?: number;
  format?: 'arabic' | 'roman' | 'Roman';
  position?: 'header' | 'footer' | null;
  alignment?: 'left' | 'center' | 'right' | 'outside';
  skipPages?: number[];
}

// Chapter configuration
export interface ChapterConfig {
  startOn?: 'left' | 'right' | 'either';
  headerStyle?: 'alternating' | 'chapter' | 'book';
  dropCaps?: boolean;
  showNumber?: boolean;
  showTitle?: boolean;
}

// Output configuration
export interface ImageOutputConfig {
  format?: 'png' | 'jpg';
  quality?: number;
  dpi?: number;
  colorSpace?: 'RGB' | 'CMYK';
}

export interface PDFOutputConfig {
  pdfA?: boolean;
  colorSpace?: 'RGB' | 'CMYK';
  bleeds?: boolean;
  cropMarks?: boolean;
  registrationMarks?: boolean;
}

export interface EPUBOutputConfig {
  version?: 2 | 3;
  reflowable?: boolean;
  toc?: boolean;
  cover?: boolean;
}

export interface WebOutputConfig {
  flipAnimation?: boolean;
  flipDuration?: number;
  showCover?: boolean;
  defaultMode?: ViewerMode;
  zoom?: boolean;
  search?: boolean;
  responsive?: boolean;
}

export interface OutputsConfig {
  images?: ImageOutputConfig;
  pdf?: PDFOutputConfig;
  epub?: EPUBOutputConfig;
  web?: WebOutputConfig;
}

// Theme system
export interface ThemeFontConfig {
  family: string;
  weight?: string | number;
  style?: 'normal' | 'italic';
  size?: string;
  letterSpacing?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface BookTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
  };
  fonts: {
    heading: ThemeFontConfig;
    body: ThemeFontConfig;
    caption?: ThemeFontConfig;
  };
  spacing: {
    pageMarginScale: number;
    paragraphGap: string;
    sectionGap: string;
    lineHeight: number;
  };
}

export type PartialBookTheme = {
  [K in keyof BookTheme]?: K extends 'colors' | 'fonts' | 'spacing'
    ? Partial<BookTheme[K]>
    : BookTheme[K];
};

// Template manifest
export interface TemplateManifest {
  name: string;
  displayName: string;
  description: string;
  category: 'fiction' | 'non-fiction' | 'creative' | 'educational' | 'personal';
  tags: string[];
  defaults: {
    dimensions: Dimensions;
    margins: Margins;
    bleed?: number;
  };
  themes: string[];
  defaultTheme: string;
  features: {
    pageFlip?: boolean;
    pageNumbers?: boolean;
    chapters?: boolean;
    tableOfContents?: boolean;
  };
}

// Main book configuration
export interface BookConfig {
  // Metadata
  title: string;
  author: string;
  subtitle?: string;
  description?: string;
  language?: string;
  isbn?: string;
  publisher?: string;
  publicationDate?: string;
  edition?: string;
  copyright?: string;
  keywords?: string[];
  
  // Dimensions
  dimensions: Dimensions;
  margins: Margins;
  
  // Print settings
  bleed?: number;
  dpi?: number;
  colorSpace?: 'RGB' | 'CMYK';
  registrationMarks?: boolean;
  cropMarks?: boolean;
  
  // Typography
  defaultFont?: FontConfig;
  fonts?: FontConfig[];
  
  // Pagination
  pageNumbering?: PageNumberingConfig;
  
  // Chapters
  chapters?: ChapterConfig;
  
  // Theme
  theme?: BookTheme | PartialBookTheme;

  // Outputs
  outputs?: OutputsConfig;
}

// Page context
export interface PageContextType {
  pageNumber: number;
  isLeftPage: boolean;
  isRightPage: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;
  chapter: ChapterInfo | null;
  margins: Margins;
  dimensions: Dimensions;
}

// Chapter info
export interface ChapterInfo {
  title: string;
  subtitle?: string;
  number?: number | string;
  id?: string;
  bookTitle: string;
  pageCount: number;
  startPage: number;
  endPage: number;
}

// Page props
export interface PageProps {
  layout?: 'margins' | 'full-bleed' | 'text-only' | 'two-column' | 'recipe' | 'puzzle' | 'cover' | string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  backgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
  density?: 'hard' | 'soft';
  children?: React.ReactNode;
}

// Chapter props
export interface ChapterProps {
  title: string;
  subtitle?: string;
  number?: number | string;
  startOn?: 'left' | 'right' | 'either';
  id?: string;
  className?: string;
  children?: React.ReactNode;
}

// Book props
export interface BookProps {
  config: BookConfig;
  children?: React.ReactNode;
}

// Image props
export interface ImageProps {
  src: string;
  layout?: 'bleed' | 'margins' | 'float';
  caption?: string | React.ReactNode;
  alt?: string;
  width?: string | number;
  height?: string | number;
  objectFit?: 'cover' | 'contain' | 'fill';
  quality?: number;
  style?: React.CSSProperties;
  className?: string;
}

// Text flow props
export interface TextFlowProps {
  content: string;
  typography?: {
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    indent?: string;
    orphans?: number;
    widows?: number;
  };
  onPageBreak?: (remainingText: string) => void;
}

// Drop cap props
export interface DropCapProps {
  letter: string;
  lines: number;
  style?: React.CSSProperties;
  className?: string;
}

// Utility function type for staticFile
export type StaticFileFunction = (filename: string) => string;

// Render options
export interface RenderOptions {
  outputDir?: string;
  format?: 'images' | 'pdf' | 'epub' | 'web' | 'all';
  pages?: number[];
  quality?: number;
}

// Hook return types
export interface UsePageConfigReturn extends PageContextType {}

export interface UseChapterReturn extends ChapterInfo {}

// Viewer types
export type ViewerMode = 'flip' | 'slide' | 'scroll';

export interface BookViewerProps {
  config: BookConfig;
  children: React.ReactNode;
  mode?: ViewerMode;
  showToolbar?: boolean;
  showThumbnails?: boolean;
  flipDuration?: number;
  showCover?: boolean;
  drawShadow?: boolean;
  maxShadowOpacity?: number;
  keyboardNavigation?: boolean;
  onPageChange?: (pageIndex: number) => void;
  className?: string;
  style?: React.CSSProperties;
}
