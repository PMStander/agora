/**
 * useBookEditor — State management hook for the data-driven editor.
 *
 * Provides:
 * - Edit mode toggle
 * - Block selection
 * - Undo/redo (max 50 states)
 * - Text updates
 * - Image replacement tracking
 * - Dirty flag for unsaved changes
 *
 * Usage:
 *   const editor = useBookEditor(initialBookData);
 *
 *   <BookDataRenderer
 *     data={editor.bookData}
 *     editable={editor.isEditing}
 *     onDataChange={editor.updateData}
 *     selectedBlockId={editor.selectedBlockId}
 *     onBlockSelect={editor.selectBlock}
 *     onImageReplace={editor.requestImageReplace}
 *   />
 *
 *   <button onClick={editor.toggleEdit}>
 *     {editor.isEditing ? 'Preview' : 'Edit'}
 *   </button>
 *   <button onClick={editor.undo} disabled={!editor.canUndo}>Undo</button>
 *   <button onClick={editor.redo} disabled={!editor.canRedo}>Redo</button>
 */

import { useState, useCallback, useRef } from 'react';
import type { BookData, PageData, ContentBlock } from './types';

const MAX_UNDO_STACK = 50;

export interface UseBookEditorReturn {
  /** Current book data */
  bookData: BookData;
  /** Whether edit mode is active */
  isEditing: boolean;
  /** Toggle edit mode */
  toggleEdit: () => void;
  /** Set edit mode explicitly */
  setEditing: (editing: boolean) => void;
  /** Update the entire BookData (pushes undo state) */
  updateData: (newData: BookData) => void;
  /** Currently selected block ID */
  selectedBlockId: string | null;
  /** Select a block by ID */
  selectBlock: (blockId: string | null) => void;
  /** Undo last change */
  undo: () => void;
  /** Redo last undone change */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Mark as saved (clears dirty flag) */
  markSaved: () => void;
  /** Request image replacement for a block */
  requestImageReplace: (blockId: string) => void;
  /** The block ID that needs image replacement (null if none) */
  pendingImageReplace: string | null;
  /** Complete image replacement */
  completeImageReplace: (blockId: string, newSrc: string) => void;
  /** Cancel image replacement */
  cancelImageReplace: () => void;
  /** Update a specific block */
  updateBlock: (blockId: string, updater: (block: ContentBlock) => ContentBlock) => void;
  /** Reset to initial data */
  reset: (data?: BookData) => void;
}

export function useBookEditor(initialData: BookData): UseBookEditorReturn {
  const [bookData, setBookData] = useState<BookData>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [pendingImageReplace, setPendingImageReplace] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const undoStackRef = useRef<BookData[]>([]);
  const redoStackRef = useRef<BookData[]>([]);

  const pushUndo = useCallback((currentData: BookData) => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-MAX_UNDO_STACK + 1),
      currentData,
    ];
    redoStackRef.current = []; // Clear redo on new change
  }, []);

  const updateData = useCallback((newData: BookData) => {
    pushUndo(bookData);
    setBookData(newData);
    setIsDirty(true);
  }, [bookData, pushUndo]);

  const toggleEdit = useCallback(() => {
    setIsEditing(prev => !prev);
    if (isEditing) {
      setSelectedBlockId(null); // Deselect when exiting edit mode
    }
  }, [isEditing]);

  const selectBlock = useCallback((blockId: string | null) => {
    setSelectedBlockId(blockId);
  }, []);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, bookData];
    setBookData(prev);
  }, [bookData]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, bookData];
    setBookData(next);
  }, [bookData]);

  const markSaved = useCallback(() => {
    setIsDirty(false);
  }, []);

  const requestImageReplace = useCallback((blockId: string) => {
    setPendingImageReplace(blockId);
  }, []);

  const completeImageReplace = useCallback((blockId: string, newSrc: string) => {
    // Deep update the block's src
    const updateBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
      return blocks.map(block => {
        if (block.id === blockId && 'src' in block) {
          return { ...block, src: newSrc };
        }
        if ('children' in block && Array.isArray((block as any).children)) {
          return { ...block, children: updateBlocks((block as any).children) } as ContentBlock;
        }
        return block;
      });
    };

    const updatePages = (pages: PageData[]): PageData[] => {
      return pages.map(page => ({ ...page, blocks: updateBlocks(page.blocks) }));
    };

    pushUndo(bookData);
    setBookData(prev => ({
      ...prev,
      chapters: prev.chapters.map(ch => ({
        ...ch,
        pages: updatePages(ch.pages),
      })),
      standalonePages: prev.standalonePages ? {
        frontMatter: updatePages(prev.standalonePages.frontMatter),
        backMatter: updatePages(prev.standalonePages.backMatter),
      } : undefined,
    }));
    setPendingImageReplace(null);
    setIsDirty(true);
  }, [bookData, pushUndo]);

  const cancelImageReplace = useCallback(() => {
    setPendingImageReplace(null);
  }, []);

  const updateBlock = useCallback((blockId: string, updater: (block: ContentBlock) => ContentBlock) => {
    const updateBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
      return blocks.map(block => {
        if (block.id === blockId) return updater(block);
        if ('children' in block && Array.isArray((block as any).children)) {
          return { ...block, children: updateBlocks((block as any).children) } as ContentBlock;
        }
        return block;
      });
    };

    const updatePages = (pages: PageData[]): PageData[] => {
      return pages.map(page => ({ ...page, blocks: updateBlocks(page.blocks) }));
    };

    pushUndo(bookData);
    setBookData(prev => ({
      ...prev,
      chapters: prev.chapters.map(ch => ({
        ...ch,
        pages: updatePages(ch.pages),
      })),
      standalonePages: prev.standalonePages ? {
        frontMatter: updatePages(prev.standalonePages.frontMatter),
        backMatter: updatePages(prev.standalonePages.backMatter),
      } : undefined,
    }));
    setIsDirty(true);
  }, [bookData, pushUndo]);

  const reset = useCallback((data?: BookData) => {
    setBookData(data || initialData);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setSelectedBlockId(null);
    setPendingImageReplace(null);
    setIsDirty(false);
  }, [initialData]);

  return {
    bookData,
    isEditing,
    toggleEdit,
    setEditing: setIsEditing,
    updateData,
    selectedBlockId,
    selectBlock,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    isDirty,
    markSaved,
    requestImageReplace,
    pendingImageReplace,
    completeImageReplace,
    cancelImageReplace,
    updateBlock,
    reset,
  };
}
