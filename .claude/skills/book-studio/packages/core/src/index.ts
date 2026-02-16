// Main exports for @bookmotion/core
import React from 'react';

// Components
export { Book, useBookConfig } from './components/Book.js';
export { Page } from './components/Page.js';
export { Chapter } from './components/Chapter.js';
export { BookViewer } from './components/BookViewer.js';

// Hooks
export {
  usePageConfig,
  useChapter,
  useOutputFormat,
  useFont,
  type FontLoadResult,
} from './hooks/index.js';

// Theme system
export {
  ThemeProvider,
  useBookTheme,
  useThemeColors,
  useThemeFonts,
  useThemeSpacing,
  defaultTheme,
} from './contexts/ThemeContext.js';

export {
  allThemes,
  themeRegistry,
  themesByTemplate,
  getThemeById,
  getThemesForTemplate,
  // Individual themes
  whimsicalForest,
  oceanAdventure,
  candyPastel,
  rusticKitchen,
  modernMinimalist,
  warmHarvest,
  classicLiterary,
  darkAcademia,
  elegantSerif,
  cleanMonochrome,
  softPastel,
  playfulBright,
  classicPuzzle,
  modernSans,
  boldGraphic,
} from './themes/index.js';

// Utilities
export { staticFile, staticFileExists, getPublicDir } from './utils/staticFile.js';
export {
  renderToImages,
  renderToPDF,
  renderToEPUB,
  renderToWeb,
  renderAll,
  toPixels,
  fromPixels,
} from './utils/render.js';

// KDP (Amazon Kindle Direct Publishing) utilities
export {
  KDP_TRIM_SIZES,
  KDP_BOOK_TYPE_PRESETS,
  getKDPMinimumMargins,
  validateKDPMargins,
  getKDPCoverDimensions,
  validateForKDP,
  getKDPPreset,
  getKDPTrimSizes,
} from './utils/kdp.js';

export type {
  KDPTrimSize,
  KDPBookTypePreset,
  KDPCoverDimensions,
  KDPValidationResult,
} from './utils/kdp.js';

// PDF Export (Node.js only — uses puppeteer + pdf-lib)
export { exportToPDF, quickExport } from './utils/export-pdf.js';
export type { PDFExportOptions, PDFExportResult } from './utils/export-pdf.js';

// Data-driven page model (JSON book definitions, editing, AI generation)
export {
  // Helpers
  generateBlockId,
  createBlock,
  createPage,
  createChapter,
  // Renderer
  BlockRenderer,
  BookDataRenderer,
  getAllPages,
  updateBlockInData,
  // Editor hook
  useBookEditor,
} from './data/index.js';

export type {
  // Block types
  BlockType,
  ContentBlock,
  ContentBlockBase,
  HeadingBlock,
  ParagraphBlock,
  BlockquoteBlock,
  ListBlock,
  CodeBlock,
  CaptionBlock,
  ImageBlock,
  ImageGridBlock,
  IllustrationBlock,
  ColumnsBlock,
  GridBlock,
  SpacerBlock,
  DividerBlock,
  BoxBlock,
  TableBlock,
  ChartBlock,
  StatCardBlock,
  TocEntryBlock,
  RecipeCardBlock,
  SpeechBubbleBlock,
  PanelBlock,
  CustomBlock,
  // Data model
  PageData,
  ChapterData,
  BookData,
  EditorState,
  // Renderer
  BlockRenderContext,
  BookDataRendererProps,
  // Editor
  UseBookEditorReturn,
} from './data/index.js';

// Types
export type {
  BookConfig,
  BookProps,
  ChapterConfig,
  ChapterInfo,
  ChapterProps,
  Dimensions,
  DropCapProps,
  EPUBOutputConfig,
  FontConfig,
  ImageOutputConfig,
  ImageProps,
  Margins,
  OutputsConfig,
  PageContextType,
  PageNumberingConfig,
  PageProps,
  PDFOutputConfig,
  RenderOptions,
  TextFlowProps,
  Unit,
  UseChapterReturn,
  UsePageConfigReturn,
  ViewerMode,
  BookViewerProps,
  BookTheme,
  PartialBookTheme,
  ThemeFontConfig,
  TemplateManifest,
  WebOutputConfig,
} from './types.js';

// Additional utility components can be added here

// Placeholder component for Image (to be implemented)
export const Image: React.FC<any> = ({ src, alt, style, ...props }) => {
  return React.createElement('img', { src, alt, style, ...props });
};

// Placeholder for DropCap
export const DropCap: React.FC<any> = ({ letter, style }) => {
  return React.createElement('span', { style: { float: 'left', fontSize: '3em', ...style } }, letter);
};

// Placeholder for PageNumber
export const PageNumber: React.FC<any> = ({ format: _format = 'arabic' }) => {
  // This would use usePageConfig to get actual page number
  return React.createElement('span', {}, '1');
};

// Placeholder for TableOfContents
export const TableOfContents: React.FC<any> = ({ autoGenerate: _autoGenerate }) => {
  return React.createElement('div', { className: 'table-of-contents' }, 
    React.createElement('h2', {}, 'Table of Contents')
  );
};

// Placeholder for BodyText
export const BodyText: React.FC<any> = ({ content }) => {
  return React.createElement('div', { className: 'body-text' }, content);
};

// Placeholder for BlockQuote
export const BlockQuote: React.FC<any> = ({ children, citation }) => {
  return React.createElement('blockquote', {}, 
    children,
    citation && React.createElement('cite', {}, citation)
  );
};

// Note: React imported at top of file for placeholder components
