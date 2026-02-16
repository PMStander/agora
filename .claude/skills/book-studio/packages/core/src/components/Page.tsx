import React, { useContext, useRef, forwardRef } from 'react';
import type { PageProps, PageContextType } from '../types.js';
import { BookConfigContext, PageContext, PageCounterContext, ChapterContext } from './Book.js';

export const Page = forwardRef<HTMLDivElement, PageProps>(({
  layout = 'margins',
  header,
  footer,
  backgroundColor = '#fff',
  className = '',
  style: _style = {},
  density = 'soft',
  children,
}, ref) => {
  const bookConfig = useContext(BookConfigContext);
  const chapter = useContext(ChapterContext);
  const pageCounter = useContext(PageCounterContext);
  const pageRef = useRef<HTMLDivElement>(null);

  // Merge forwarded ref with internal ref
  const mergedRef = (node: HTMLDivElement | null) => {
    (pageRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  if (!bookConfig) {
    throw new Error('Page must be used within a Book');
  }

  // Register this page and get its number (useRef avoids side-effects in render for StrictMode)
  const pageNumberRef = useRef<number | null>(null);
  if (pageNumberRef.current === null) {
    pageNumberRef.current = pageCounter.registerPage();
  }
  const pageNumber = pageNumberRef.current;

  // Calculate page properties
  const isLeftPage = pageNumber % 2 === 0;
  const isRightPage = !isLeftPage;
  const isFirstPage = pageNumber === 1;
  const isLastPage = pageNumber === pageCounter.totalPages;

  // Create page context
  const pageContext: PageContextType = {
    pageNumber,
    isLeftPage,
    isRightPage,
    isFirstPage,
    isLastPage,
    chapter,
    margins: bookConfig.margins,
    dimensions: bookConfig.dimensions,
  };

  // Convert dimensions to pixels for CSS (assuming 96 DPI for preview)
  const toPixels = (value: number, unit: string): number => {
    switch (unit) {
      case 'in': return value * 96;
      case 'mm': return value * 3.78;
      case 'cm': return value * 37.8;
      case 'pt': return value * 1.33;
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

  // Calculate margins based on left/right page
  const marginLeft = isLeftPage ? marginOuter : marginInner;
  const marginRight = isLeftPage ? marginInner : marginOuter;

  // Layout-specific styles
  const getLayoutStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor,
      boxSizing: 'border-box',
    };

    switch (layout) {
      case 'full-bleed':
        return {
          ...base,
          padding: 0,
        };
      
      case 'margins':
      case 'text-only':
      default:
        return {
          ...base,
          paddingTop: marginTop,
          paddingBottom: marginBottom,
          paddingLeft: marginLeft,
          paddingRight: marginRight,
        };
      
      case 'two-column':
        return {
          ...base,
          paddingTop: marginTop,
          paddingBottom: marginBottom,
          paddingLeft: marginLeft,
          paddingRight: marginRight,
          columnCount: 2,
          columnGap: '0.25in',
        };
    }
  };

  const pageStyles: React.CSSProperties = {
    width: pageWidth,
    height: pageHeight,
    position: 'relative',
    backgroundColor,
    pageBreakAfter: 'always',
    breakAfter: 'page',
    overflow: 'hidden',
  };

  const contentStyles = getLayoutStyles();

  const headerStyles: React.CSSProperties = {
    position: 'absolute',
    top: layout === 'full-bleed' ? bleedPx : marginTop * 0.5,
    left: layout === 'full-bleed' ? bleedPx : marginLeft,
    right: layout === 'full-bleed' ? bleedPx : marginRight,
    height: marginTop * 0.4,
    zIndex: 10,
  };

  const footerStyles: React.CSSProperties = {
    position: 'absolute',
    bottom: layout === 'full-bleed' ? bleedPx : marginBottom * 0.5,
    left: layout === 'full-bleed' ? bleedPx : marginLeft,
    right: layout === 'full-bleed' ? bleedPx : marginRight,
    height: marginBottom * 0.4,
    zIndex: 10,
  };

  // Add data attributes for debugging
  const dataAttributes = {
    'data-page-number': pageNumber,
    'data-layout': layout,
    'data-left-page': isLeftPage,
    'data-right-page': isRightPage,
  };

  return (
    <PageContext.Provider value={pageContext}>
      <div
        ref={mergedRef}
        className={`book-page ${className}`}
        style={pageStyles}
        data-density={density}
        {...dataAttributes}
      >
        {/* Header */}
        {header && (
          <div className="page-header" style={headerStyles}>
            {header}
          </div>
        )}

        {/* Main content */}
        <div className="page-content" style={contentStyles}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="page-footer" style={footerStyles}>
            {footer}
          </div>
        )}

        {/* Bleed guides (visible in preview) */}
        {process.env.NODE_ENV === 'development' && (
          <BleedGuides bleed={bleedPx} show={false} />
        )}
      </div>
    </PageContext.Provider>
  );
});

Page.displayName = 'Page';

// Bleed guide component for development
const BleedGuides: React.FC<{ bleed: number; show: boolean }> = ({ bleed, show }) => {
  if (!show || bleed === 0) return null;

  const guideStyle: React.CSSProperties = {
    position: 'absolute',
    border: '1px dashed rgba(255, 0, 0, 0.3)',
    pointerEvents: 'none',
    zIndex: 100,
  };

  return (
    <>
      <div style={{ ...guideStyle, top: bleed, left: 0, right: 0, height: 1 }} />
      <div style={{ ...guideStyle, bottom: bleed, left: 0, right: 0, height: 1 }} />
      <div style={{ ...guideStyle, left: bleed, top: 0, bottom: 0, width: 1 }} />
      <div style={{ ...guideStyle, right: bleed, top: 0, bottom: 0, width: 1 }} />
    </>
  );
};

export default Page;
