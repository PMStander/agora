/**
 * BookDataRenderer — Renders an entire book from a BookData JSON model.
 *
 * This component bridges the data-driven model with the existing BookViewer.
 * It takes BookData (JSON) and renders it as BookViewer + Page components.
 *
 * Usage:
 *   <BookDataRenderer
 *     config={bookConfig}
 *     data={bookData}
 *     mode="slide"
 *   />
 *
 * For editing:
 *   <BookDataRenderer
 *     config={bookConfig}
 *     data={bookData}
 *     editable
 *     onDataChange={(newData) => setBookData(newData)}
 *   />
 */

import React, { useCallback, useMemo } from 'react';
import type { BookConfig } from '../types.js';
import type { BookData, PageData, ContentBlock } from './types';
import { BlockRenderer, type BlockRenderContext } from './BlockRenderer';

// ── Props ──

export interface BookDataRendererProps {
  /** Book configuration (dimensions, margins, etc.) */
  config: BookConfig;
  /** Book data to render */
  data: BookData;
  /** Viewer mode */
  mode?: 'slide' | 'scroll' | 'flip';
  /** Enable inline editing */
  editable?: boolean;
  /** Callback when data changes (editing) */
  onDataChange?: (data: BookData) => void;
  /** Currently selected block ID */
  selectedBlockId?: string | null;
  /** Callback when a block is selected */
  onBlockSelect?: (blockId: string | null) => void;
  /** Callback to replace an image */
  onImageReplace?: (blockId: string) => void;
  /** Custom block renderers */
  customRenderers?: Record<string, React.FC<{ block: ContentBlock; ctx: BlockRenderContext }>>;
  /** Additional BookViewer props */
  showToolbar?: boolean;
  showThumbnails?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// ── Helper: Flatten all pages from BookData ──

function getAllPages(data: BookData): PageData[] {
  const pages: PageData[] = [];

  // Front matter
  if (data.standalonePages?.frontMatter) {
    pages.push(...data.standalonePages.frontMatter);
  }

  // Chapter pages
  for (const chapter of data.chapters) {
    pages.push(...chapter.pages);
  }

  // Back matter
  if (data.standalonePages?.backMatter) {
    pages.push(...data.standalonePages.backMatter);
  }

  return pages;
}

// ── Helper: Deep-update a block in BookData ──

function updateBlockInData(data: BookData, blockId: string, updater: (block: ContentBlock) => ContentBlock): BookData {
  const updateBlocksRecursive = (blocks: ContentBlock[]): ContentBlock[] => {
    return blocks.map(block => {
      if (block.id === blockId) {
        return updater(block);
      }
      // Recurse into container blocks
      if ('children' in block && Array.isArray((block as any).children)) {
        return {
          ...block,
          children: updateBlocksRecursive((block as any).children),
        } as ContentBlock;
      }
      return block;
    });
  };

  const updatePages = (pages: PageData[]): PageData[] => {
    return pages.map(page => ({
      ...page,
      blocks: updateBlocksRecursive(page.blocks),
    }));
  };

  return {
    ...data,
    chapters: data.chapters.map(ch => ({
      ...ch,
      pages: updatePages(ch.pages),
    })),
    standalonePages: data.standalonePages ? {
      frontMatter: updatePages(data.standalonePages.frontMatter),
      backMatter: updatePages(data.standalonePages.backMatter),
    } : undefined,
  };
}

// ── Page Renderer ──

const DataPage: React.FC<{
  pageData: PageData;
  ctx: BlockRenderContext;
}> = ({ pageData, ctx }) => {
  const background = pageData.background || 'white';
  const isFullBleed = pageData.layout === 'full-bleed' || pageData.layout === 'cover';

  return (
    <div
      className="book-page"
      data-density={pageData.density || 'soft'}
      data-page-id={pageData.id}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: isFullBleed ? 'transparent' : background,
        boxSizing: 'border-box',
        ...(pageData.layout === 'margins' || pageData.layout === 'text-only' || pageData.layout === 'two-column'
          ? { padding: '0.75in 0.5in' }
          : {}),
        ...(pageData.style as React.CSSProperties),
      }}
    >
      {isFullBleed && background !== 'white' && (
        <div style={{
          position: 'absolute',
          top: '-0.125in',
          left: '-0.125in',
          width: 'calc(100% + 0.25in)',
          height: 'calc(100% + 0.25in)',
          background,
          zIndex: 0,
        }} />
      )}

      <div style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.15in',
        ...(pageData.layout === 'two-column' ? {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.3in',
        } as React.CSSProperties : {}),
      }}>
        {pageData.blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} ctx={ctx} />
        ))}
      </div>
    </div>
  );
};

// ── Main Component ──

export const BookDataRenderer: React.FC<BookDataRendererProps> = ({
  config: _config,
  data,
  mode: _mode = 'slide',
  editable = false,
  onDataChange,
  selectedBlockId,
  onBlockSelect,
  onImageReplace,
  customRenderers,
  showToolbar: _showToolbar = true,
  showThumbnails: _showThumbnails = true,
  className,
  style,
}) => {
  // Build render context
  const handleTextChange = useCallback((blockId: string, newText: string) => {
    if (!onDataChange) return;
    const updated = updateBlockInData(data, blockId, (block) => {
      if ('text' in block) {
        return { ...block, text: newText };
      }
      return block;
    });
    onDataChange(updated);
  }, [data, onDataChange]);

  const ctx: BlockRenderContext = useMemo(() => ({
    isEditing: editable,
    fonts: data.theme?.fonts,
    colors: data.theme?.colors,
    onTextChange: handleTextChange,
    onBlockSelect: onBlockSelect || undefined,
    selectedBlockId,
    onImageReplace,
    customRenderers,
  }), [editable, data.theme, handleTextChange, onBlockSelect, selectedBlockId, onImageReplace, customRenderers]);

  // Get all pages in order
  const allPages = useMemo(() => getAllPages(data), [data]);

  // We render as a standalone component that uses .book-page class for BookViewer compatibility.
  // The parent can wrap this in <BookViewer> or use it directly.
  return (
    <div
      className={`book-data-renderer ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...style,
      }}
    >
      {allPages.map((pageData) => (
        <DataPage key={pageData.id} pageData={pageData} ctx={ctx} />
      ))}
    </div>
  );
};

// ── Export utilities ──

export { getAllPages, updateBlockInData };
export default BookDataRenderer;
