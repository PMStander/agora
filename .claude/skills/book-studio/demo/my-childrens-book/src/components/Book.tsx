import React, { createContext, useContext, useState, useMemo } from 'react';
import type { BookProps, BookConfig, PageContextType } from '../types';

export const BookConfigContext = createContext<BookConfig | null>(null);
export const PageContext = createContext<PageContextType>({
  pageNumber: 0,
  isLeftPage: false,
  isRightPage: false,
  isFirstPage: false,
  isLastPage: false,
  chapterTitle: null,
  chapterNumber: null,
});

export const PageCounterContext = createContext<{
  currentPage: number;
  registerPage: () => number;
}>({
  currentPage: 0,
  registerPage: () => 0,
});

export const ChapterContext = createContext<{ title: string; number?: number } | null>(null);

export const Book: React.FC<BookProps> = ({ config, children }) => {
  const [currentPage, setCurrentPage] = useState(0);

  const pageCounter = useMemo(() => ({
    currentPage,
    registerPage: () => {
      setCurrentPage(prev => prev + 1);
      return currentPage + 1;
    },
  }), [currentPage]);

  const bookStyles: React.CSSProperties = {
    width: config.dimensions.width + config.dimensions.unit,
    height: config.dimensions.height + config.dimensions.unit,
    position: 'relative',
    backgroundColor: '#fff',
    boxShadow: '0 0 20px rgba(0,0,0,0.1)',
    margin: '20px auto',
    overflow: 'hidden',
  };

  return (
    <BookConfigContext.Provider value={config}>
      <PageCounterContext.Provider value={pageCounter}>
        <div className="book" style={bookStyles}>
          {children}
        </div>
      </PageCounterContext.Provider>
    </BookConfigContext.Provider>
  );
};

export const useBookConfig = () => {
  const ctx = useContext(BookConfigContext);
  if (!ctx) throw new Error('useBookConfig must be used within Book');
  return ctx;
};

export const usePageCounter = () => {
  const ctx = useContext(PageCounterContext);
  if (!ctx) throw new Error('usePageCounter must be used within Book');
  return ctx;
};
