import React, { useContext, useRef, forwardRef } from 'react';
import type { PageProps, PageContextType } from '../types';
import { BookConfigContext, PageContext, PageCounterContext, ChapterContext } from './Book';

export const Page = forwardRef<HTMLDivElement, PageProps>(({
  layout = 'margins',
  header,
  footer,
  backgroundColor = '#fff',
  className = '',
  style = {},
  density = 'soft',
  children,
}, ref) => {
  const bookConfig = useContext(BookConfigContext);
  const chapter = useContext(ChapterContext);
  const pageCounter = useContext(PageCounterContext);
  const internalRef = useRef<HTMLDivElement>(null);

  const mergedRef = (node: HTMLDivElement | null) => {
    (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  if (!bookConfig) throw new Error('Page must be used within Book');

  const pageNumberRef = useRef<number | null>(null);
  if (pageNumberRef.current === null) {
    pageNumberRef.current = pageCounter.registerPage();
  }
  const pageNumber = pageNumberRef.current;

  const isLeftPage = pageNumber % 2 === 0;
  const isRightPage = !isLeftPage;

  const pageContext: PageContextType = {
    pageNumber,
    isLeftPage,
    isRightPage,
    isFirstPage: pageNumber === 1,
    isLastPage: false, // Would need to calculate total
    chapterTitle: chapter?.title || null,
    chapterNumber: chapter?.number || null,
  };

  const toPixels = (value: number, unit: string) => {
    switch (unit) {
      case 'in': return value * 96;
      case 'mm': return value * 3.78;
      case 'cm': return value * 37.8;
      default: return value;
    }
  };

  const { width, height, unit } = bookConfig.dimensions;
  const { top, bottom, inner, outer } = bookConfig.margins;
  const bleed = bookConfig.bleed || 0;

  const pageWidth = toPixels(width, unit);
  const pageHeight = toPixels(height, unit);
  const marginTop = toPixels(top, unit);
  const marginBottom = toPixels(bottom, unit);
  const marginInner = toPixels(inner, unit);
  const marginOuter = toPixels(outer, unit);
  const bleedPx = toPixels(bleed, unit);

  const marginLeft = isLeftPage ? marginOuter : marginInner;
  const marginRight = isLeftPage ? marginInner : marginOuter;

  const pageStyles: React.CSSProperties = {
    width: pageWidth,
    height: pageHeight,
    position: 'relative',
    backgroundColor,
    breakAfter: 'page',
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  const contentStyles: React.CSSProperties = layout === 'full-bleed' 
    ? { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }
    : { 
        position: 'absolute', 
        top: marginTop, 
        bottom: marginBottom, 
        left: marginLeft, 
        right: marginRight 
      };

  const headerStyles: React.CSSProperties = {
    position: 'absolute',
    top: layout === 'full-bleed' ? bleedPx : marginTop * 0.5,
    left: layout === 'full-bleed' ? bleedPx : marginLeft,
    right: layout === 'full-bleed' ? bleedPx : marginRight,
    zIndex: 10,
  };

  const footerStyles: React.CSSProperties = {
    position: 'absolute',
    bottom: layout === 'full-bleed' ? bleedPx : marginBottom * 0.5,
    left: layout === 'full-bleed' ? bleedPx : marginLeft,
    right: layout === 'full-bleed' ? bleedPx : marginRight,
    zIndex: 10,
  };

  return (
    <PageContext.Provider value={pageContext}>
      <div
        ref={mergedRef}
        className={`book-page ${className}`}
        style={{ ...pageStyles, ...style }}
        data-page-number={pageNumber}
        data-density={density}
      >
        {header && <div style={headerStyles}>{header}</div>}
        <div style={contentStyles}>{children}</div>
        {footer && <div style={footerStyles}>{footer}</div>}
      </div>
    </PageContext.Provider>
  );
});

Page.displayName = 'Page';

export const usePageConfig = () => {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error('usePageConfig must be used within Page');
  return ctx;
};
