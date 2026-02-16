import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
} from 'react';
import type { BookConfig } from '../types';
import { BookConfigContext, PageCounterContext } from './Book';

// ── Types ──
type ViewerMode = 'flip' | 'slide' | 'scroll';

interface BookViewerProps {
  config: BookConfig;
  children: React.ReactNode;
  mode?: ViewerMode;
  showToolbar?: boolean;
  showThumbnails?: boolean;
  flipDuration?: number;
  showCover?: boolean;
  drawShadow?: boolean;
  maxShadowOpacity?: number;
  keyboardNavigation?: boolean;
  onPageChange?: (pageIndex: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

// ── Toolbar ──
const BookViewerToolbar: React.FC<{
  currentPage: number;
  totalPages: number;
  mode: ViewerMode;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (index: number) => void;
  onModeChange: (mode: ViewerMode) => void;
  showThumbnails: boolean;
}> = ({ currentPage, totalPages, mode, onPrev, onNext, onGoToPage, onModeChange, showThumbnails }) => {
  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: '#fff',
    color: '#374151',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s ease',
  };

  const disabledStyle: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.4,
    cursor: 'not-allowed',
  };

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#4f46e5',
    color: '#fff',
    borderColor: '#4f46e5',
  };

  const modeIcons: Record<ViewerMode, string> = {
    flip: '\u{1F4D6}',
    slide: '\u{25B6}',
    scroll: '\u{2195}',
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: showThumbnails ? '12px' : '0' }}>
        <button onClick={onPrev} disabled={currentPage === 0} style={currentPage === 0 ? disabledStyle : buttonStyle} aria-label="Previous page">← Prev</button>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: '#374151', minWidth: '120px', justifyContent: 'center' }}>
          Page {currentPage + 1} of {totalPages}
        </span>
        <button onClick={onNext} disabled={currentPage >= totalPages - 1} style={currentPage >= totalPages - 1 ? disabledStyle : buttonStyle} aria-label="Next page">Next →</button>
        <div style={{ display: 'flex', gap: '2px', marginLeft: '8px' }}>
          {(['flip', 'slide', 'scroll'] as ViewerMode[]).map((m) => (
            <button key={m} onClick={() => onModeChange(m)} style={mode === m ? activeButtonStyle : buttonStyle} title={`${m.charAt(0).toUpperCase() + m.slice(1)} mode`} aria-label={`Switch to ${m} mode`}>
              {modeIcons[m]}
            </button>
          ))}
        </div>
      </div>
      {showThumbnails && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => onGoToPage(i)} style={{ width: '28px', height: '28px', borderRadius: '4px', border: '1px solid', borderColor: i === currentPage ? '#4f46e5' : '#d1d5db', backgroundColor: i === currentPage ? '#4f46e5' : '#fff', color: i === currentPage ? '#fff' : '#374151', cursor: 'pointer', fontSize: '11px', fontWeight: i === currentPage ? 600 : 400, transition: 'all 0.15s ease', padding: 0 }} title={`Page ${i + 1}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── FlipPageClone: clones a rendered DOM node into react-pageflip ──
const FlipPageClone = forwardRef<HTMLDivElement, {
  sourceElement: HTMLElement;
  density?: 'hard' | 'soft';
}>(({ sourceElement, density = 'soft' }, ref) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [ref]);

  useEffect(() => {
    if (innerRef.current && sourceElement) {
      innerRef.current.innerHTML = '';
      const clone = sourceElement.cloneNode(true) as HTMLElement;
      clone.style.display = 'block';
      clone.style.width = '100%';
      clone.style.height = '100%';
      innerRef.current.appendChild(clone);
    }
  }, [sourceElement]);

  return (
    <div ref={mergedRef} data-density={density} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: '#fff' }} />
  );
});
FlipPageClone.displayName = 'FlipPageClone';

// ── Main BookViewer Component ──
//
// Architecture: DOM-based page discovery
// Children render normally into a container. After mount, we query the DOM
// for .book-page elements (which the Page component adds). This works
// regardless of whether pages are wrapped in custom components or chapters.
//
export const BookViewer: React.FC<BookViewerProps> = ({
  config,
  children,
  mode: initialMode = 'slide',
  showToolbar = true,
  showThumbnails = true,
  flipDuration = 800,
  showCover = true,
  drawShadow = true,
  maxShadowOpacity = 0.5,
  keyboardNavigation = true,
  onPageChange,
  className = '',
  style = {},
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [mode, setMode] = useState<ViewerMode>(initialMode);
  const [totalPages, setTotalPages] = useState(0);
  const [flipPages, setFlipPages] = useState<HTMLElement[]>([]);
  const [HTMLFlipBook, setHTMLFlipBook] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const renderAreaRef = useRef<HTMLDivElement>(null);
  const flipBookRef = useRef<any>(null);

  // Page counter for nested Page components
  const pageCountRef = useRef(0);
  const pageCounter = useMemo(() => ({
    currentPage: pageCountRef.current,
    registerPage: () => {
      pageCountRef.current += 1;
      return pageCountRef.current;
    },
  }), []);

  const toPixels = useCallback((value: number, unit: string): number => {
    switch (unit) {
      case 'in': return value * 96;
      case 'mm': return value * 3.78;
      case 'cm': return value * 37.8;
      case 'pt': return value * 1.33;
      default: return value;
    }
  }, []);

  const pageWidth = toPixels(config.dimensions.width, config.dimensions.unit);
  const pageHeight = toPixels(config.dimensions.height, config.dimensions.unit);

  // Discover rendered .book-page elements from the DOM after children render
  useEffect(() => {
    const timer = setTimeout(() => {
      if (renderAreaRef.current) {
        const pages = renderAreaRef.current.querySelectorAll('.book-page');
        if (pages.length > 0 && pages.length !== totalPages) {
          setTotalPages(pages.length);
          setFlipPages(Array.from(pages) as HTMLElement[]);
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  });

  // Load react-pageflip for flip mode
  useEffect(() => {
    let cancelled = false;
    import('react-pageflip')
      .then((mod) => { if (!cancelled) setHTMLFlipBook(() => mod.default); })
      .catch(() => { if (!cancelled) setLoadError('react-pageflip not installed'); });
    return () => { cancelled = true; };
  }, []);

  // Show/hide pages in slide mode via CSS
  useEffect(() => {
    if (!renderAreaRef.current) return;
    const pages = renderAreaRef.current.querySelectorAll('.book-page') as NodeListOf<HTMLElement>;
    pages.forEach((page, i) => {
      if (mode === 'slide') {
        page.style.display = i === currentPage ? 'block' : 'none';
      } else {
        page.style.display = 'block';
      }
    });
  }, [currentPage, mode, totalPages]);

  const goToPage = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, totalPages - 1));
    setCurrentPage(clamped);
    onPageChange?.(clamped);
  }, [totalPages, onPageChange]);

  const goToPrev = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const goToNext = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);

  useEffect(() => {
    if (!keyboardNavigation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); goToPrev(); break;
        case 'ArrowRight': case ' ': e.preventDefault(); goToNext(); break;
        case 'Home': e.preventDefault(); goToPage(0); break;
        case 'End': e.preventDefault(); goToPage(totalPages - 1); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardNavigation, goToPrev, goToNext, goToPage, totalPages]);

  useEffect(() => {
    if (mode !== 'flip' || !flipBookRef.current?.pageFlip()) return;
    const pf = flipBookRef.current.pageFlip();
    if (pf.getCurrentPageIndex() !== currentPage) pf.flip(currentPage);
  }, [currentPage, mode]);

  const handleFlip = useCallback((pageIndex: number) => {
    setCurrentPage(pageIndex);
    onPageChange?.(pageIndex);
  }, [onPageChange]);

  const isRenderVisible = mode === 'slide' || mode === 'scroll';
  const showFlip = mode === 'flip' && totalPages > 0;

  return (
    <BookConfigContext.Provider value={config}>
      <PageCounterContext.Provider value={pageCounter}>
        <div className={`book-viewer ${className}`} style={{ textAlign: 'center', padding: '20px', ...style }}>
          {showToolbar && totalPages > 0 && (
            <BookViewerToolbar currentPage={currentPage} totalPages={totalPages} mode={mode} onPrev={goToPrev} onNext={goToNext} onGoToPage={goToPage} onModeChange={setMode} showThumbnails={showThumbnails} />
          )}

          <div ref={renderAreaRef} className="book-viewer-render-area" style={{
            ...(isRenderVisible ? {
              display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
              ...(mode === 'scroll' ? { maxHeight: '80vh', overflowY: 'auto' as const, gap: '24px', padding: '24px 0' } : {
                width: pageWidth, height: pageHeight, margin: '0 auto', overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: '2px', position: 'relative' as const,
              }),
            } : { position: 'absolute' as const, left: '-99999px', top: '-99999px' }),
          }}>
            {children}
          </div>

          {totalPages === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ marginBottom: '8px', fontSize: '14px' }}>Loading pages...</div>
            </div>
          )}

          {showFlip && !loadError && HTMLFlipBook && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <HTMLFlipBook ref={flipBookRef} width={pageWidth} height={pageHeight} size="fixed" minWidth={pageWidth} maxWidth={pageWidth} minHeight={pageHeight} maxHeight={pageHeight} showCover={showCover} drawShadow={drawShadow} maxShadowOpacity={maxShadowOpacity} flippingTime={flipDuration} usePortrait={false} startPage={0} autoSize={false} clickEventForward={false} useMouseEvents={true} swipeDistance={30} showPageCorners={true} disableFlipByClick={false} onFlip={(e: any) => handleFlip(e.data)} style={{}} className="book-viewer-flipbook">
                {flipPages.map((el, i) => {
                  const density = (i === 0 || i === flipPages.length - 1) && showCover ? 'hard' : 'soft';
                  return <FlipPageClone key={i} sourceElement={el} density={density} />;
                })}
              </HTMLFlipBook>
            </div>
          )}

          {showFlip && loadError && (
            <div style={{ width: pageWidth, height: pageHeight, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#991b1b', fontSize: '14px' }}>
              <div><p style={{ fontWeight: 600, marginBottom: '8px' }}>Page flip not available</p><p>{loadError}</p></div>
            </div>
          )}

          {showFlip && !loadError && !HTMLFlipBook && (
            <div style={{ width: pageWidth * 2, height: pageHeight, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px' }}>Loading page flip...</span>
            </div>
          )}

          {keyboardNavigation && totalPages > 0 && (
            <p style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af' }}>
              Use ← → arrow keys to navigate &middot; Home / End to jump
            </p>
          )}
        </div>
      </PageCounterContext.Provider>
    </BookConfigContext.Provider>
  );
};

BookViewer.displayName = 'BookViewer';
