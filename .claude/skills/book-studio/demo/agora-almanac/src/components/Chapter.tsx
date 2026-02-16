import React, { useContext } from 'react';
import type { ChapterProps } from '../types';
import { ChapterContext, PageCounterContext } from './Book';

export const Chapter: React.FC<ChapterProps> = ({
  title,
  number,
  startOn = 'right',
  children,
}) => {
  const pageCounter = useContext(PageCounterContext);
  const chapterInfo = { title, number };

  // Check if we need a blank page
  const nextPage = pageCounter.currentPage + 1;
  const isNextLeft = nextPage % 2 === 0;
  const needsBlank = startOn === 'right' && isNextLeft;

  return (
    <ChapterContext.Provider value={chapterInfo}>
      <div className="book-chapter" data-chapter={title} data-number={number}>
        {needsBlank && (
          <div style={{ display: 'none' }} data-blank-page />
        )}
        {children}
      </div>
    </ChapterContext.Provider>
  );
};

export const useChapter = () => {
  const ctx = useContext(ChapterContext);
  return ctx;
};
