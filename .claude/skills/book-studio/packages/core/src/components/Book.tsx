import React, { createContext, useContext, useMemo, useState } from 'react';
import type { BookProps, BookConfig, ChapterInfo, PageContextType } from '../types.js';
import { ThemeProvider } from '../contexts/ThemeContext.js';

// Create contexts
export const BookConfigContext = createContext<BookConfig | null>(null);
export const PageContext = createContext<PageContextType>({
  pageNumber: 0,
  isLeftPage: false,
  isRightPage: false,
  isFirstPage: false,
  isLastPage: false,
  chapter: null,
  margins: { top: 0, bottom: 0, inner: 0, outer: 0 },
  dimensions: { width: 0, height: 0, unit: 'in' },
});

// Page counter context for tracking
interface PageCounterContextType {
  currentPage: number;
  totalPages: number;
  registerPage: () => number;
  setTotalPages: (count: number) => void;
}

export const PageCounterContext = createContext<PageCounterContextType>({
  currentPage: 0,
  totalPages: 0,
  registerPage: () => 0,
  setTotalPages: () => {},
});

// Chapter context
export const ChapterContext = createContext<ChapterInfo | null>(null);

export const Book: React.FC<BookProps> = ({ config, children }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Create page counter functions
  const pageCounter = useMemo(() => ({
    currentPage,
    totalPages,
    registerPage: () => {
      setCurrentPage(prev => prev + 1);
      return currentPage + 1;
    },
    setTotalPages: (count: number) => {
      setTotalPages(count);
    },
  }), [currentPage, totalPages]);

  const bookStyles: React.CSSProperties = {
    width: config.dimensions.width + config.dimensions.unit,
    height: config.dimensions.height + config.dimensions.unit,
    position: 'relative',
    backgroundColor: '#fff',
    boxShadow: '0 0 20px rgba(0,0,0,0.1)',
    margin: '0 auto',
    overflow: 'hidden',
  };

  return (
    <BookConfigContext.Provider value={config}>
      <ThemeProvider theme={config.theme}>
        <PageCounterContext.Provider value={pageCounter}>
          <div className="book-container" style={{ padding: '20px' }}>
            <div
              className="book"
              style={bookStyles}
              data-book-title={config.title}
              data-book-author={config.author}
            >
              {children}
            </div>
          </div>
        </PageCounterContext.Provider>
      </ThemeProvider>
    </BookConfigContext.Provider>
  );
};

// Hook to access book config
export const useBookConfig = (): BookConfig => {
  const context = useContext(BookConfigContext);
  if (!context) {
    throw new Error('useBookConfig must be used within a Book');
  }
  return context;
};

// Hook to access page counter
export const usePageCounter = (): PageCounterContextType => {
  const context = useContext(PageCounterContext);
  if (!context) {
    throw new Error('usePageCounter must be used within a Book');
  }
  return context;
};
