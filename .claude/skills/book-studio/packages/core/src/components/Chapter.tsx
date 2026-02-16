import React, { useContext, useMemo } from 'react';
import type { ChapterProps, ChapterInfo } from '../types.js';
import { BookConfigContext, ChapterContext, PageCounterContext } from './Book.js';

export const Chapter: React.FC<ChapterProps> = ({
  title,
  subtitle,
  number,
  startOn = 'right',
  id,
  className = '',
  children,
}) => {
  const bookConfig = useContext(BookConfigContext);
  const pageCounter = useContext(PageCounterContext);

  if (!bookConfig) {
    throw new Error('Chapter must be used within a Book');
  }

  // Calculate chapter info
  const chapterInfo: ChapterInfo = useMemo(() => {
    const startPage = pageCounter.currentPage + 1;
    
    return {
      title,
      subtitle,
      number,
      id: id || `chapter-${number || title.toLowerCase().replace(/\s+/g, '-')}`,
      bookTitle: bookConfig.title,
      pageCount: 0, // Will be calculated after rendering
      startPage,
      endPage: startPage, // Will be updated
    };
  }, [title, subtitle, number, id, bookConfig.title, pageCounter.currentPage]);

  // Check if we need to insert a blank page
  const needsBlankPage = useMemo(() => {
    if (startOn === 'either') return false;
    
    const nextPage = pageCounter.currentPage + 1;
    const isNextLeft = nextPage % 2 === 0;
    const isNextRight = !isNextLeft;
    
    return (startOn === 'right' && isNextLeft) || 
           (startOn === 'left' && isNextRight);
  }, [startOn, pageCounter.currentPage]);

  return (
    <ChapterContext.Provider value={chapterInfo}>
      <div 
        className={`book-chapter ${className}`}
        data-chapter-number={number}
        data-chapter-title={title}
        data-chapter-start-page={chapterInfo.startPage}
      >
        {/* Insert blank page if needed */}
        {needsBlankPage && (
          <div 
            className="blank-page-placeholder"
            style={{ display: 'none' }}
            data-blank-page="true"
          />
        )}
        
        {children}
      </div>
    </ChapterContext.Provider>
  );
};

export default Chapter;
