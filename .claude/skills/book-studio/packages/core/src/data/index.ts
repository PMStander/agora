// Data-driven page model for Bookmotion
// Enables AI generation, inline editing, and JSON-based book definitions

// Types
export type {
  BlockType,
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
  ContentBlock,
  PageData,
  ChapterData,
  BookData,
  EditorState,
} from './types';

// Helpers
export {
  generateBlockId,
  createBlock,
  createPage,
  createChapter,
} from './types';

// Renderer
export { BlockRenderer } from './BlockRenderer';
export type { BlockRenderContext } from './BlockRenderer';

// Book Data Renderer
export {
  BookDataRenderer,
  getAllPages,
  updateBlockInData,
} from './BookDataRenderer';
export type { BookDataRendererProps } from './BookDataRenderer';

// Editor hook
export { useBookEditor } from './useBookEditor';
export type { UseBookEditorReturn } from './useBookEditor';
