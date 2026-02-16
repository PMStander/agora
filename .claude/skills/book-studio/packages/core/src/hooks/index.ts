import { useContext } from 'react';
import { PageContext, ChapterContext, BookConfigContext } from '../components/Book.js';
import type { PageContextType, ChapterInfo, BookConfig } from '../types.js';

// Hook to access page configuration
export const usePageConfig = (): PageContextType => {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageConfig must be used within a Page');
  }
  return context;
};

// Hook to access chapter info
export const useChapter = (): ChapterInfo | null => {
  return useContext(ChapterContext);
};

// Hook to access book config
export const useBookConfig = (): BookConfig => {
  const context = useContext(BookConfigContext);
  if (!context) {
    throw new Error('useBookConfig must be used within a Book');
  }
  return context;
};

// Hook to detect output format (for responsive design)
export const useOutputFormat = (): 'pdf' | 'epub' | 'web' | 'print' | 'preview' => {
  // This would be set during rendering process
  if (typeof window !== 'undefined') {
    const format = (window as any).__BOOKMOTION_OUTPUT_FORMAT;
    if (format) return format;
  }
  return 'preview';
};

// Hook for loading fonts
export interface FontLoadResult {
  fontFamily: string;
  loaded: boolean;
  error: Error | null;
}

export const useFont = (config: {
  family: string;
  source?: 'google' | 'local' | 'url';
  url?: string;
  weights?: string[];
}): FontLoadResult => {
  // Simplified font loading - would integrate with actual font loading API
  return {
    fontFamily: config.family,
    loaded: true,
    error: null,
  };
};
