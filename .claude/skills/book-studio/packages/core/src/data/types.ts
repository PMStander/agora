/**
 * Data-Driven Page Model for Bookmotion
 *
 * This module defines a JSON-serializable data model for book content.
 * Instead of writing React components directly, authors (human or AI) describe
 * pages as a tree of "content blocks" with typed properties.
 *
 * The data model enables:
 * - AI agents to generate entire books as JSON
 * - Human editors to modify text/images inline via contentEditable
 * - Undo/redo via immutable state snapshots
 * - Export to multiple formats from the same source data
 * - Collaboration and version control (JSON diffs cleanly)
 *
 * Architecture:
 *   BookData → ChapterData[] → PageData[] → ContentBlock[]
 *   ContentBlock is a recursive tree (blocks can contain child blocks)
 */

// ── Content Block Types ──

/** All supported block types */
export type BlockType =
  // Text
  | 'heading'
  | 'paragraph'
  | 'blockquote'
  | 'list'
  | 'code'
  | 'caption'
  // Media
  | 'image'
  | 'image-grid'
  | 'illustration'
  // Layout
  | 'columns'
  | 'grid'
  | 'spacer'
  | 'divider'
  | 'box'
  // Data
  | 'table'
  | 'chart'
  | 'stat-card'
  // Book-specific
  | 'toc-entry'
  | 'recipe-card'
  | 'speech-bubble'
  | 'panel'
  // Custom
  | 'custom';

/** Base interface for all content blocks */
export interface ContentBlockBase {
  /** Unique ID for this block (for editing, undo/redo) */
  id: string;
  /** Block type determines rendering */
  type: BlockType;
  /** Optional CSS styles (camelCase keys) */
  style?: Record<string, string | number>;
  /** Optional CSS class name */
  className?: string;
  /** Whether this block is editable (default: true for text blocks) */
  editable?: boolean;
  /** AI generation metadata */
  aiGenerated?: {
    model?: string;
    prompt?: string;
    timestamp?: string;
  };
}

// ── Text Blocks ──

export interface HeadingBlock extends ContentBlockBase {
  type: 'heading';
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** HTML-safe markup within text (bold, italic, links) */
  richText?: string;
}

export interface ParagraphBlock extends ContentBlockBase {
  type: 'paragraph';
  text: string;
  /** HTML-safe markup */
  richText?: string;
  /** Drop cap on first letter */
  dropCap?: boolean;
  /** Text alignment */
  align?: 'left' | 'center' | 'right' | 'justify';
}

export interface BlockquoteBlock extends ContentBlockBase {
  type: 'blockquote';
  text: string;
  citation?: string;
}

export interface ListBlock extends ContentBlockBase {
  type: 'list';
  items: string[];
  ordered?: boolean;
}

export interface CodeBlock extends ContentBlockBase {
  type: 'code';
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  filename?: string;
}

export interface CaptionBlock extends ContentBlockBase {
  type: 'caption';
  text: string;
}

// ── Media Blocks ──

export interface ImageBlock extends ContentBlockBase {
  type: 'image';
  /** URL or path to image */
  src: string;
  alt: string;
  /** Object fit mode */
  fit?: 'cover' | 'contain' | 'fill' | 'none';
  /** Width as CSS value (e.g. '100%', '3in') */
  width?: string;
  /** Height as CSS value */
  height?: string;
  /** Caption shown below image */
  caption?: string;
  /** AI image generation prompt (for regeneration) */
  aiPrompt?: string;
  /** AI model used to generate this image */
  aiModel?: string;
  /** Border radius */
  borderRadius?: string;
}

export interface ImageGridBlock extends ContentBlockBase {
  type: 'image-grid';
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
    aiPrompt?: string;
  }>;
  columns?: number;
  gap?: string;
}

export interface IllustrationBlock extends ContentBlockBase {
  type: 'illustration';
  /** Full-page or section illustration */
  src: string;
  alt: string;
  /** Whether this illustration fills the entire page (with bleed) */
  fullBleed?: boolean;
  /** Overlay text position */
  textOverlay?: {
    text: string;
    position: 'top' | 'bottom' | 'center';
    color?: string;
  };
  aiPrompt?: string;
  aiModel?: string;
}

// ── Layout Blocks ──

export interface ColumnsBlock extends ContentBlockBase {
  type: 'columns';
  /** Column widths as fractions (e.g. ['1fr', '1fr'] or ['2fr', '1fr']) */
  widths?: string[];
  gap?: string;
  children: ContentBlock[];
}

export interface GridBlock extends ContentBlockBase {
  type: 'grid';
  columns: number;
  rows?: number;
  gap?: string;
  children: ContentBlock[];
}

export interface SpacerBlock extends ContentBlockBase {
  type: 'spacer';
  height: string;
}

export interface DividerBlock extends ContentBlockBase {
  type: 'divider';
  variant?: 'line' | 'dots' | 'stars' | 'ornament';
  color?: string;
}

export interface BoxBlock extends ContentBlockBase {
  type: 'box';
  backgroundColor?: string;
  borderRadius?: string;
  padding?: string;
  border?: string;
  children: ContentBlock[];
}

// ── Data Blocks ──

export interface TableBlock extends ContentBlockBase {
  type: 'table';
  headers: string[];
  rows: string[][];
  striped?: boolean;
}

export interface ChartBlock extends ContentBlockBase {
  type: 'chart';
  chartType: 'bar' | 'pie' | 'line';
  data: Array<{ label: string; value: number; color?: string }>;
  title?: string;
}

export interface StatCardBlock extends ContentBlockBase {
  type: 'stat-card';
  label: string;
  value: string;
  icon?: string;
  color?: string;
}

// ── Book-Specific Blocks ──

export interface TocEntryBlock extends ContentBlockBase {
  type: 'toc-entry';
  number: string;
  title: string;
  page: string;
}

export interface RecipeCardBlock extends ContentBlockBase {
  type: 'recipe-card';
  title: string;
  description?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients: string[];
  steps: string[];
  image?: string;
  aiPrompt?: string;
}

export interface SpeechBubbleBlock extends ContentBlockBase {
  type: 'speech-bubble';
  text: string;
  character?: string;
  position?: 'left' | 'right' | 'top' | 'bottom';
  tailDirection?: 'left' | 'right' | 'bottom';
}

export interface PanelBlock extends ContentBlockBase {
  type: 'panel';
  /** Grid position for comic panels */
  gridArea?: string;
  image?: string;
  children?: ContentBlock[];
  aiPrompt?: string;
}

// ── Custom Block ──

export interface CustomBlock extends ContentBlockBase {
  type: 'custom';
  /** Name of a registered custom renderer */
  renderer: string;
  /** Arbitrary props passed to the renderer */
  props: Record<string, unknown>;
}

// ── Union Type ──

export type ContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | BlockquoteBlock
  | ListBlock
  | CodeBlock
  | CaptionBlock
  | ImageBlock
  | ImageGridBlock
  | IllustrationBlock
  | ColumnsBlock
  | GridBlock
  | SpacerBlock
  | DividerBlock
  | BoxBlock
  | TableBlock
  | ChartBlock
  | StatCardBlock
  | TocEntryBlock
  | RecipeCardBlock
  | SpeechBubbleBlock
  | PanelBlock
  | CustomBlock;

// ── Page Data ──

export interface PageData {
  /** Unique ID */
  id: string;
  /** Page layout type */
  layout: 'full-bleed' | 'margins' | 'text-only' | 'two-column' | 'cover';
  /** Page density for flip animation */
  density?: 'hard' | 'soft';
  /** Background color or gradient */
  background?: string;
  /** Content blocks on this page */
  blocks: ContentBlock[];
  /** Page-level styles */
  style?: Record<string, string | number>;
  /** Page number override (null = auto) */
  pageNumber?: number | null;
}

// ── Chapter Data ──

export interface ChapterData {
  /** Unique ID */
  id: string;
  /** Chapter title */
  title: string;
  /** Chapter subtitle */
  subtitle?: string;
  /** Chapter number (auto-incremented if not provided) */
  number?: number | string;
  /** Pages in this chapter */
  pages: PageData[];
}

// ── Book Data (Top-Level) ──

export interface BookData {
  /** Schema version for forward compatibility */
  version: 1;
  /** Chapters containing pages */
  chapters: ChapterData[];
  /** Standalone pages (cover, TOC, etc.) that are outside chapters */
  standalonePages?: {
    /** Pages before chapters (cover, title page, TOC, copyright) */
    frontMatter: PageData[];
    /** Pages after chapters (appendix, back cover) */
    backMatter: PageData[];
  };
  /** Global theme overrides for data-rendered pages */
  theme?: {
    fonts?: {
      heading?: string;
      body?: string;
      mono?: string;
    };
    colors?: Record<string, string>;
  };
}

// ── Editor State ──

export interface EditorState {
  /** The current book data */
  bookData: BookData;
  /** Whether edit mode is active */
  isEditing: boolean;
  /** Currently selected block ID */
  selectedBlockId: string | null;
  /** Currently selected page ID */
  selectedPageId: string | null;
  /** Undo history (past states) */
  undoStack: BookData[];
  /** Redo history (future states) */
  redoStack: BookData[];
  /** Dirty flag (unsaved changes) */
  isDirty: boolean;
}

// ── Helper: Generate unique IDs ──

let _idCounter = 0;
export function generateBlockId(prefix = 'block'): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

// ── Helper: Create typed blocks ──

export function createBlock<T extends ContentBlock>(
  type: T['type'],
  props: Omit<T, 'id' | 'type'>
): T {
  return {
    id: generateBlockId(type),
    type,
    ...props,
  } as T;
}

export function createPage(
  layout: PageData['layout'],
  blocks: ContentBlock[],
  options: Partial<Omit<PageData, 'id' | 'layout' | 'blocks'>> = {}
): PageData {
  return {
    id: generateBlockId('page'),
    layout,
    blocks,
    ...options,
  };
}

export function createChapter(
  title: string,
  pages: PageData[],
  options: Partial<Omit<ChapterData, 'id' | 'title' | 'pages'>> = {}
): ChapterData {
  return {
    id: generateBlockId('chapter'),
    title,
    pages,
    ...options,
  };
}
