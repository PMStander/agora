/**
 * BlockRenderer — Renders ContentBlock data as React elements.
 *
 * This is the "template engine" of the data-driven model.
 * Each block type has a default renderer that produces styled HTML.
 * Custom renderers can be registered for extensibility.
 */

import React from 'react';
import type {
  ContentBlock,
  HeadingBlock,
  ParagraphBlock,
  BlockquoteBlock,
  ListBlock,
  CodeBlock,
  CaptionBlock,
  ImageBlock,
  ImageGridBlock,
  IllustrationBlock,
  ColumnsBlock,
  GridBlock,
  SpacerBlock,
  DividerBlock,
  BoxBlock,
  TableBlock,
  ChartBlock,
  StatCardBlock,
  TocEntryBlock,
  RecipeCardBlock,
  CustomBlock,
} from './types';

// ── Render Context ──

export interface BlockRenderContext {
  /** Whether we're in edit mode */
  isEditing: boolean;
  /** Theme fonts */
  fonts?: {
    heading?: string;
    body?: string;
    mono?: string;
  };
  /** Theme colors */
  colors?: Record<string, string>;
  /** Callback when a text block is edited */
  onTextChange?: (blockId: string, newText: string) => void;
  /** Callback when a block is selected */
  onBlockSelect?: (blockId: string) => void;
  /** Currently selected block ID */
  selectedBlockId?: string | null;
  /** Callback to replace an image */
  onImageReplace?: (blockId: string) => void;
  /** Custom block renderers */
  customRenderers?: Record<string, React.FC<{ block: ContentBlock; ctx: BlockRenderContext }>>;
}

const defaultContext: BlockRenderContext = {
  isEditing: false,
};

// ── Main Renderer ──

export const BlockRenderer: React.FC<{
  block: ContentBlock;
  ctx?: BlockRenderContext;
}> = ({ block, ctx = defaultContext }) => {
  const isSelected = ctx.selectedBlockId === block.id;

  const wrapperStyle: React.CSSProperties = {
    ...(block.style as React.CSSProperties),
    ...(ctx.isEditing && isSelected ? {
      outline: '2px solid #4f46e5',
      outlineOffset: '2px',
      borderRadius: '4px',
    } : {}),
    ...(ctx.isEditing ? { cursor: 'pointer' } : {}),
  };

  const handleClick = ctx.isEditing && ctx.onBlockSelect
    ? (e: React.MouseEvent) => { e.stopPropagation(); ctx.onBlockSelect!(block.id); }
    : undefined;

  const rendered = (() => {
    switch (block.type) {
      case 'heading': return <HeadingRenderer block={block} ctx={ctx} />;
      case 'paragraph': return <ParagraphRenderer block={block} ctx={ctx} />;
      case 'blockquote': return <BlockquoteRenderer block={block} ctx={ctx} />;
      case 'list': return <ListRenderer block={block} ctx={ctx} />;
      case 'code': return <CodeRenderer block={block} ctx={ctx} />;
      case 'caption': return <CaptionRenderer block={block} ctx={ctx} />;
      case 'image': return <ImageRenderer block={block} ctx={ctx} />;
      case 'image-grid': return <ImageGridRenderer block={block} ctx={ctx} />;
      case 'illustration': return <IllustrationRenderer block={block} ctx={ctx} />;
      case 'columns': return <ColumnsRenderer block={block} ctx={ctx} />;
      case 'grid': return <GridRenderer block={block} ctx={ctx} />;
      case 'spacer': return <SpacerRenderer block={block} />;
      case 'divider': return <DividerRenderer block={block} />;
      case 'box': return <BoxRenderer block={block} ctx={ctx} />;
      case 'table': return <TableRenderer block={block} ctx={ctx} />;
      case 'chart': return <ChartRenderer block={block} ctx={ctx} />;
      case 'stat-card': return <StatCardRenderer block={block} ctx={ctx} />;
      case 'toc-entry': return <TocEntryRenderer block={block} ctx={ctx} />;
      case 'recipe-card': return <RecipeCardRenderer block={block} ctx={ctx} />;
      case 'custom': {
        const customBlock = block as CustomBlock;
        const Renderer = ctx.customRenderers?.[customBlock.renderer];
        if (Renderer) return <Renderer block={block} ctx={ctx} />;
        return <div style={{ color: 'red', fontSize: '10pt' }}>Unknown renderer: {customBlock.renderer}</div>;
      }
      default:
        return <div style={{ color: '#999', fontSize: '10pt' }}>[Unsupported block: {(block as any).type}]</div>;
    }
  })();

  if (ctx.isEditing) {
    return <div style={wrapperStyle} onClick={handleClick}>{rendered}</div>;
  }

  return rendered;
};

// ── Editable Text Wrapper ──

const EditableText: React.FC<{
  blockId: string;
  text: string;
  richText?: string;
  ctx: BlockRenderContext;
  style?: React.CSSProperties;
  tag?: keyof JSX.IntrinsicElements;
}> = ({ blockId, text, richText, ctx, style, tag: Tag = 'div' }) => {
  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const newText = e.currentTarget.innerText;
    if (newText !== text && ctx.onTextChange) {
      ctx.onTextChange(blockId, newText);
    }
  };

  if (ctx.isEditing) {
    return React.createElement(Tag, {
      contentEditable: true,
      suppressContentEditableWarning: true,
      onBlur: handleBlur,
      style: { ...style, outline: 'none', minHeight: '1em' },
      dangerouslySetInnerHTML: richText ? { __html: richText } : undefined,
      children: richText ? undefined : text,
    });
  }

  if (richText) {
    return React.createElement(Tag, {
      style,
      dangerouslySetInnerHTML: { __html: richText },
    });
  }

  return React.createElement(Tag, { style }, text);
};

// ── Individual Block Renderers ──

const HeadingRenderer: React.FC<{ block: HeadingBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => {
  const tag = `h${block.level}` as keyof JSX.IntrinsicElements;
  const sizes: Record<number, string> = { 1: '32pt', 2: '24pt', 3: '20pt', 4: '16pt', 5: '14pt', 6: '12pt' };
  return (
    <EditableText
      blockId={block.id}
      text={block.text}
      richText={block.richText}
      ctx={ctx}
      tag={tag}
      style={{
        fontFamily: ctx.fonts?.heading || 'Georgia, serif',
        fontSize: sizes[block.level] || '16pt',
        fontWeight: block.level <= 2 ? 900 : 700,
        lineHeight: 1.2,
        margin: 0,
        color: ctx.colors?.text || '#1a1a2e',
        ...(block.style as React.CSSProperties),
      }}
    />
  );
};

const ParagraphRenderer: React.FC<{ block: ParagraphBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => {
  const style: React.CSSProperties = {
    fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
    fontSize: '11pt',
    lineHeight: 1.7,
    color: ctx.colors?.text || '#374151',
    textAlign: block.align || 'left',
    margin: 0,
    ...(block.style as React.CSSProperties),
  };

  if (block.dropCap) {
    // Render with drop cap
    const first = block.text.charAt(0);
    const rest = block.text.slice(1);
    return (
      <p style={style}>
        <span style={{
          float: 'left',
          fontSize: '3.5em',
          fontFamily: ctx.fonts?.heading || 'Georgia, serif',
          fontWeight: 700,
          lineHeight: 0.8,
          marginRight: '0.05em',
          marginTop: '0.05em',
          color: ctx.colors?.primary || ctx.colors?.text || '#1a1a2e',
        }}>
          {first}
        </span>
        {ctx.isEditing ? (
          <EditableText blockId={block.id} text={rest} ctx={ctx} tag="span" />
        ) : (
          rest
        )}
      </p>
    );
  }

  return <EditableText blockId={block.id} text={block.text} richText={block.richText} ctx={ctx} tag="p" style={style} />;
};

const BlockquoteRenderer: React.FC<{ block: BlockquoteBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <blockquote style={{
    borderLeft: `3px solid ${ctx.colors?.accent || '#7c3aed'}`,
    paddingLeft: '0.3in',
    margin: '0.2in 0',
    fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
    fontSize: '12pt',
    fontStyle: 'italic',
    color: ctx.colors?.text || '#374151',
    lineHeight: 1.7,
    ...(block.style as React.CSSProperties),
  }}>
    <EditableText blockId={block.id} text={block.text} ctx={ctx} />
    {block.citation && (
      <cite style={{ display: 'block', marginTop: '0.1in', fontSize: '10pt', fontStyle: 'normal', color: ctx.colors?.textMuted || '#6b7280' }}>
        — {block.citation}
      </cite>
    )}
  </blockquote>
);

const ListRenderer: React.FC<{ block: ListBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => {
  const Tag = block.ordered ? 'ol' : 'ul';
  return React.createElement(Tag, {
    style: {
      fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
      fontSize: '11pt',
      lineHeight: 1.7,
      color: ctx.colors?.text || '#374151',
      paddingLeft: '0.3in',
      margin: 0,
      ...(block.style as React.CSSProperties),
    },
  }, block.items.map((item, i) => (
    <li key={i} style={{ marginBottom: '0.05in' }}>{item}</li>
  )));
};

const CodeRenderer: React.FC<{ block: CodeBlock; ctx: BlockRenderContext }> = ({ block }) => (
  <div style={{
    backgroundColor: '#1e1e2e',
    borderRadius: '8px',
    padding: '0.2in',
    overflow: 'hidden',
    ...(block.style as React.CSSProperties),
  }}>
    {block.filename && (
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '8pt',
        color: '#6c7086',
        marginBottom: '0.1in',
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
      }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f38ba8', display: 'inline-block' }} />
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a6e3a1', display: 'inline-block' }} />
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f9e2af', display: 'inline-block' }} />
        <span style={{ marginLeft: '8px' }}>{block.filename}</span>
      </div>
    )}
    <pre style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: '9pt',
      lineHeight: 1.6,
      color: '#cdd6f4',
      margin: 0,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {block.code}
    </pre>
  </div>
);

const CaptionRenderer: React.FC<{ block: CaptionBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <EditableText
    blockId={block.id}
    text={block.text}
    ctx={ctx}
    tag="div"
    style={{
      fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
      fontSize: '9pt',
      color: ctx.colors?.textMuted || '#6b7280',
      textAlign: 'center',
      fontStyle: 'italic',
      ...(block.style as React.CSSProperties),
    }}
  />
);

// ── Media Renderers ──

const ImageRenderer: React.FC<{ block: ImageBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <figure style={{ margin: 0, ...(block.style as React.CSSProperties) }}>
    <div style={{ position: 'relative' }}>
      <img
        src={block.src}
        alt={block.alt}
        style={{
          width: block.width || '100%',
          height: block.height || 'auto',
          objectFit: block.fit || 'cover',
          borderRadius: block.borderRadius || '0',
          display: 'block',
        }}
      />
      {ctx.isEditing && ctx.onImageReplace && (
        <button
          onClick={(e) => { e.stopPropagation(); ctx.onImageReplace!(block.id); }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 12px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Replace
        </button>
      )}
    </div>
    {block.caption && (
      <figcaption style={{
        fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
        fontSize: '9pt',
        color: ctx.colors?.textMuted || '#6b7280',
        textAlign: 'center',
        marginTop: '0.08in',
        fontStyle: 'italic',
      }}>
        {block.caption}
      </figcaption>
    )}
  </figure>
);

const ImageGridRenderer: React.FC<{ block: ImageGridBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${block.columns || 2}, 1fr)`,
    gap: block.gap || '0.15in',
    ...(block.style as React.CSSProperties),
  }}>
    {block.images.map((img, i) => (
      <figure key={i} style={{ margin: 0 }}>
        <img src={img.src} alt={img.alt} style={{ width: '100%', height: 'auto', objectFit: 'cover', borderRadius: '4px', display: 'block' }} />
        {img.caption && (
          <figcaption style={{
            fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
            fontSize: '8pt',
            color: ctx.colors?.textMuted || '#6b7280',
            textAlign: 'center',
            marginTop: '4px',
          }}>
            {img.caption}
          </figcaption>
        )}
      </figure>
    ))}
  </div>
);

const IllustrationRenderer: React.FC<{ block: IllustrationBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => {
  const containerStyle: React.CSSProperties = block.fullBleed ? {
    position: 'absolute',
    top: '-0.125in',
    left: '-0.125in',
    width: 'calc(100% + 0.25in)',
    height: 'calc(100% + 0.25in)',
  } : {
    width: '100%',
    height: '100%',
  };

  return (
    <div style={{ ...containerStyle, position: 'relative', ...(block.style as React.CSSProperties) }}>
      <img
        src={block.src}
        alt={block.alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {block.textOverlay && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          ...(block.textOverlay.position === 'top' ? { top: '0.5in' } :
            block.textOverlay.position === 'bottom' ? { bottom: '0.5in' } :
              { top: '50%', transform: 'translateY(-50%)' }),
          textAlign: 'center',
          color: block.textOverlay.color || 'white',
          fontFamily: ctx.fonts?.heading || 'Georgia, serif',
          fontSize: '24pt',
          fontWeight: 700,
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          padding: '0 0.5in',
        }}>
          {block.textOverlay.text}
        </div>
      )}
      {ctx.isEditing && ctx.onImageReplace && (
        <button
          onClick={(e) => { e.stopPropagation(); ctx.onImageReplace!(block.id); }}
          style={{
            position: 'absolute', top: '8px', right: '8px',
            padding: '4px 12px', backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white', border: 'none', borderRadius: '4px',
            fontSize: '11px', cursor: 'pointer',
          }}
        >
          Replace
        </button>
      )}
    </div>
  );
};

// ── Layout Renderers ──

const ColumnsRenderer: React.FC<{ block: ColumnsBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: (block.widths || ['1fr', '1fr']).join(' '),
    gap: block.gap || '0.3in',
    ...(block.style as React.CSSProperties),
  }}>
    {block.children.map((child) => (
      <div key={child.id}>
        <BlockRenderer block={child} ctx={ctx} />
      </div>
    ))}
  </div>
);

const GridRenderer: React.FC<{ block: GridBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
    ...(block.rows ? { gridTemplateRows: `repeat(${block.rows}, 1fr)` } : {}),
    gap: block.gap || '0.15in',
    ...(block.style as React.CSSProperties),
  }}>
    {block.children.map((child) => (
      <div key={child.id}>
        <BlockRenderer block={child} ctx={ctx} />
      </div>
    ))}
  </div>
);

const SpacerRenderer: React.FC<{ block: SpacerBlock }> = ({ block }) => (
  <div style={{ height: block.height }} />
);

const DividerRenderer: React.FC<{ block: DividerBlock }> = ({ block }) => {
  const color = block.color || '#d1d5db';
  switch (block.variant) {
    case 'dots':
      return <div style={{ textAlign: 'center', color, letterSpacing: '0.3em', fontSize: '14pt' }}>• • •</div>;
    case 'stars':
      return <div style={{ textAlign: 'center', color, letterSpacing: '0.3em', fontSize: '12pt' }}>✦ ✦ ✦</div>;
    case 'ornament':
      return <div style={{ textAlign: 'center', color, fontSize: '14pt' }}>§</div>;
    default:
      return <hr style={{ border: 'none', borderTop: `1px solid ${color}`, margin: '0.2in 0' }} />;
  }
};

const BoxRenderer: React.FC<{ block: BoxBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <div style={{
    backgroundColor: block.backgroundColor || ctx.colors?.surface || '#f1f5f9',
    borderRadius: block.borderRadius || '8px',
    padding: block.padding || '0.2in',
    border: block.border,
    ...(block.style as React.CSSProperties),
  }}>
    {block.children.map((child) => (
      <BlockRenderer key={child.id} block={child} ctx={ctx} />
    ))}
  </div>
);

// ── Data Renderers ──

const TableRenderer: React.FC<{ block: TableBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <table style={{
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
    fontSize: '10pt',
    ...(block.style as React.CSSProperties),
  }}>
    <thead>
      <tr>
        {block.headers.map((h, i) => (
          <th key={i} style={{
            padding: '8px 12px',
            textAlign: 'left',
            borderBottom: `2px solid ${ctx.colors?.border || '#d1d5db'}`,
            fontWeight: 600,
            color: ctx.colors?.text || '#1a1a2e',
          }}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {block.rows.map((row, ri) => (
        <tr key={ri} style={block.striped && ri % 2 === 1 ? { backgroundColor: ctx.colors?.surface || '#f9fafb' } : {}}>
          {row.map((cell, ci) => (
            <td key={ci} style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${ctx.colors?.border || '#e5e7eb'}`,
              color: ctx.colors?.text || '#374151',
            }}>
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const ChartRenderer: React.FC<{ block: ChartBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => {
  // Simple bar chart (no external deps)
  const maxValue = Math.max(...block.data.map(d => d.value));
  return (
    <div style={block.style as React.CSSProperties}>
      {block.title && (
        <div style={{
          fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
          fontSize: '9pt',
          fontWeight: 600,
          color: ctx.colors?.textMuted || '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.15in',
        }}>
          {block.title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1in' }}>
        {block.data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.1in' }}>
            <span style={{
              fontFamily: ctx.fonts?.mono || 'monospace',
              fontSize: '9pt',
              color: ctx.colors?.text || '#374151',
              width: '1in',
              textAlign: 'right',
              flexShrink: 0,
            }}>
              {d.label}
            </span>
            <div style={{ flex: 1, height: '18px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${(d.value / maxValue) * 100}%`,
                height: '100%',
                backgroundColor: d.color || ctx.colors?.primary || '#7c3aed',
                borderRadius: '4px',
              }} />
            </div>
            <span style={{
              fontFamily: ctx.fonts?.mono || 'monospace',
              fontSize: '8pt',
              color: ctx.colors?.textMuted || '#6b7280',
              width: '0.4in',
            }}>
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatCardRenderer: React.FC<{ block: StatCardBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <div style={{
    backgroundColor: ctx.colors?.surface || '#f1f5f9',
    borderRadius: '10px',
    padding: '0.2in',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    ...(block.style as React.CSSProperties),
  }}>
    {block.icon && <div style={{ fontSize: '20pt', marginBottom: '0.05in' }}>{block.icon}</div>}
    <div style={{
      fontFamily: ctx.fonts?.heading || 'Georgia, serif',
      fontSize: '24pt',
      fontWeight: 900,
      color: block.color || ctx.colors?.primary || '#7c3aed',
    }}>
      {block.value}
    </div>
    <div style={{
      fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
      fontSize: '8pt',
      fontWeight: 500,
      color: ctx.colors?.textMuted || '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {block.label}
    </div>
  </div>
);

// ── Book-Specific Renderers ──

const TocEntryRenderer: React.FC<{ block: TocEntryBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <div style={{
    display: 'flex',
    alignItems: 'baseline',
    marginBottom: '0.2in',
    ...(block.style as React.CSSProperties),
  }}>
    <span style={{
      fontFamily: ctx.fonts?.mono || 'monospace',
      fontSize: '10pt',
      color: ctx.colors?.accent || '#7c3aed',
      fontWeight: 500,
      width: '0.5in',
      flexShrink: 0,
    }}>
      {block.number}
    </span>
    <span style={{
      fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
      fontSize: '13pt',
      fontWeight: 500,
      color: ctx.colors?.text || '#1a1a2e',
      flex: 1,
    }}>
      {block.title}
    </span>
    <span style={{
      borderBottom: '1px dotted #d1d5db',
      flex: 1,
      margin: '0 0.15in',
      alignSelf: 'flex-end',
      marginBottom: '4px',
    }} />
    <span style={{
      fontFamily: ctx.fonts?.mono || 'monospace',
      fontSize: '10pt',
      color: ctx.colors?.textMuted || '#6b7280',
    }}>
      {block.page}
    </span>
  </div>
);

const RecipeCardRenderer: React.FC<{ block: RecipeCardBlock; ctx: BlockRenderContext }> = ({ block, ctx }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: block.image ? '1fr 1fr' : '1fr',
    gap: '0.3in',
    ...(block.style as React.CSSProperties),
  }}>
    <div>
      <h3 style={{
        fontFamily: ctx.fonts?.heading || 'Georgia, serif',
        fontSize: '18pt',
        fontWeight: 700,
        color: ctx.colors?.text || '#1a1a2e',
        margin: '0 0 0.1in 0',
      }}>
        {block.title}
      </h3>
      {block.description && (
        <p style={{
          fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
          fontSize: '10pt',
          color: ctx.colors?.textMuted || '#6b7280',
          margin: '0 0 0.15in 0',
          lineHeight: 1.5,
        }}>
          {block.description}
        </p>
      )}

      {/* Meta info */}
      <div style={{ display: 'flex', gap: '0.2in', marginBottom: '0.2in', flexWrap: 'wrap' }}>
        {block.servings && <MetaPill label="Serves" value={block.servings} ctx={ctx} />}
        {block.prepTime && <MetaPill label="Prep" value={block.prepTime} ctx={ctx} />}
        {block.cookTime && <MetaPill label="Cook" value={block.cookTime} ctx={ctx} />}
      </div>

      <h4 style={{ fontFamily: ctx.fonts?.body || 'system-ui, sans-serif', fontSize: '10pt', fontWeight: 600, color: ctx.colors?.text || '#1a1a2e', margin: '0 0 0.08in 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Ingredients
      </h4>
      <ul style={{ fontFamily: ctx.fonts?.body || 'system-ui, sans-serif', fontSize: '10pt', color: ctx.colors?.text || '#374151', paddingLeft: '0.2in', margin: '0 0 0.2in 0', lineHeight: 1.7 }}>
        {block.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
      </ul>

      <h4 style={{ fontFamily: ctx.fonts?.body || 'system-ui, sans-serif', fontSize: '10pt', fontWeight: 600, color: ctx.colors?.text || '#1a1a2e', margin: '0 0 0.08in 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Method
      </h4>
      <ol style={{ fontFamily: ctx.fonts?.body || 'system-ui, sans-serif', fontSize: '10pt', color: ctx.colors?.text || '#374151', paddingLeft: '0.25in', margin: 0, lineHeight: 1.7 }}>
        {block.steps.map((step, i) => <li key={i} style={{ marginBottom: '0.08in' }}>{step}</li>)}
      </ol>
    </div>

    {block.image && (
      <div style={{ borderRadius: '8px', overflow: 'hidden' }}>
        <img src={block.image} alt={block.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )}
  </div>
);

const MetaPill: React.FC<{ label: string; value: string; ctx: BlockRenderContext }> = ({ label, value, ctx }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: ctx.colors?.surface || '#f1f5f9',
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '8pt',
    fontFamily: ctx.fonts?.body || 'system-ui, sans-serif',
  }}>
    <span style={{ fontWeight: 600, color: ctx.colors?.textMuted || '#6b7280' }}>{label}</span>
    <span style={{ color: ctx.colors?.text || '#374151' }}>{value}</span>
  </div>
);

export default BlockRenderer;
