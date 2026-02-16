import React from 'react';
import { Page } from './components/Page';
import { Chapter } from './components/Chapter';
import { BookViewer } from './components/BookViewer';
import { config } from '../book.config';

// ── Shared styles ──
const font = {
  heading: "'Playfair Display', Georgia, serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

const color = {
  ink: '#1a1a2e',
  muted: '#6b7280',
  accent: '#7c3aed',
  accentLight: '#ede9fe',
  warm: '#f59e0b',
  warmLight: '#fffbeb',
  teal: '#0d9488',
  tealLight: '#f0fdfa',
  rose: '#e11d48',
  roseLight: '#fff1f2',
  slate: '#f1f5f9',
};

// ════════════════════════════════════════════════════════════
// COVER
// ════════════════════════════════════════════════════════════
const CoverPage: React.FC = () => (
  <Page layout="full-bleed" density="hard">
    <div style={{
      position: 'absolute', top: '-0.125in', left: '-0.125in',
      width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
      background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: 'white', textAlign: 'center', overflow: 'hidden',
    }}>
      {/* Decorative circles */}
      <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '300px', height: '300px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', bottom: '-80px', left: '-60px', width: '400px', height: '400px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }} />
      <div style={{ position: 'absolute', top: '30%', left: '15%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.15), transparent)' }} />

      {/* Title */}
      <div style={{ fontSize: '11pt', fontFamily: font.body, fontWeight: 500, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.3in' }}>
        Bookmotion Presents
      </div>
      <h1 style={{
        fontFamily: font.heading, fontSize: '52pt', fontWeight: 900,
        lineHeight: 1.1, margin: 0, letterSpacing: '-0.02em',
        background: 'linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        The Agora<br/>Almanac
      </h1>
      <div style={{ width: '1.5in', height: '2px', background: 'linear-gradient(90deg, transparent, #7c3aed, transparent)', margin: '0.35in 0' }} />
      <p style={{ fontFamily: font.body, fontSize: '13pt', fontWeight: 300, color: 'rgba(255,255,255,0.6)', maxWidth: '4in', lineHeight: 1.5 }}>
        A showcase of programmatic book design,<br/>built with React components.
      </p>
    </div>
  </Page>
);

// ════════════════════════════════════════════════════════════
// TABLE OF CONTENTS
// ════════════════════════════════════════════════════════════
const TocPage: React.FC = () => {
  const entries = [
    { num: '01', title: 'Typography & Layout', page: '3' },
    { num: '02', title: 'The Grid System', page: '4' },
    { num: '03', title: 'Color & Theme', page: '5' },
    { num: '04', title: 'Data Visualization', page: '6' },
    { num: '05', title: 'Code & Components', page: '7' },
  ];

  return (
    <Page layout="margins">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0.5in' }}>
        <h2 style={{ fontFamily: font.heading, fontSize: '28pt', fontWeight: 700, color: color.ink, marginBottom: '0.5in', letterSpacing: '-0.01em' }}>
          Contents
        </h2>
        {entries.map((e) => (
          <div key={e.num} style={{ display: 'flex', alignItems: 'baseline', marginBottom: '0.25in' }}>
            <span style={{ fontFamily: font.mono, fontSize: '10pt', color: color.accent, fontWeight: 500, width: '0.5in', flexShrink: 0 }}>
              {e.num}
            </span>
            <span style={{ fontFamily: font.body, fontSize: '13pt', fontWeight: 500, color: color.ink, flex: 1 }}>
              {e.title}
            </span>
            <span style={{ borderBottom: '1px dotted #d1d5db', flex: 1, margin: '0 0.15in', alignSelf: 'flex-end', marginBottom: '4px' }} />
            <span style={{ fontFamily: font.mono, fontSize: '10pt', color: color.muted }}>
              {e.page}
            </span>
          </div>
        ))}
      </div>
    </Page>
  );
};

// ════════════════════════════════════════════════════════════
// CH 1: TYPOGRAPHY & LAYOUT
// ════════════════════════════════════════════════════════════
const TypographyPage: React.FC = () => (
  <Page layout="margins">
    <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', gap: '0.3in' }}>
      {/* Chapter header */}
      <div>
        <div style={{ fontFamily: font.mono, fontSize: '9pt', color: color.accent, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.1in' }}>
          Chapter 01
        </div>
        <h2 style={{ fontFamily: font.heading, fontSize: '32pt', fontWeight: 900, color: color.ink, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Typography<br/>&amp; Layout
        </h2>
        <div style={{ width: '0.8in', height: '3px', backgroundColor: color.accent, marginTop: '0.15in', borderRadius: '2px' }} />
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4in' }}>
        {/* Left column */}
        <div>
          <p style={{ fontFamily: font.body, fontSize: '11pt', lineHeight: 1.75, color: '#374151', marginBottom: '0.2in' }}>
            Good typography is invisible. When type is well-set, the reader focuses on content, not the mechanics of reading. Every decision matters.
          </p>
          <p style={{ fontFamily: font.body, fontSize: '11pt', lineHeight: 1.75, color: '#374151' }}>
            Bookmotion gives you precise control over every typographic detail through React components and CSS-in-JS styling.
          </p>
        </div>

        {/* Right column: type specimens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2in' }}>
          {[
            { name: 'Playfair Display', family: font.heading, weight: 700, sample: 'Aa Bb Cc' },
            { name: 'Inter', family: font.body, weight: 400, sample: 'Aa Bb Cc' },
            { name: 'JetBrains Mono', family: font.mono, weight: 400, sample: '0O 1lI {}' },
          ].map((f) => (
            <div key={f.name} style={{ backgroundColor: color.slate, borderRadius: '8px', padding: '0.2in' }}>
              <div style={{ fontFamily: font.body, fontSize: '8pt', color: color.muted, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.05in' }}>
                {f.name}
              </div>
              <div style={{ fontFamily: f.family, fontSize: '24pt', fontWeight: f.weight, color: color.ink }}>
                {f.sample}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Page>
);

// ════════════════════════════════════════════════════════════
// CH 2: THE GRID SYSTEM
// ════════════════════════════════════════════════════════════
const GridPage: React.FC = () => (
  <Page layout="margins">
    <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', gap: '0.3in' }}>
      <div>
        <div style={{ fontFamily: font.mono, fontSize: '9pt', color: color.teal, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.1in' }}>
          Chapter 02
        </div>
        <h2 style={{ fontFamily: font.heading, fontSize: '28pt', fontWeight: 700, color: color.ink, margin: 0 }}>
          The Grid System
        </h2>
        <div style={{ width: '0.8in', height: '3px', backgroundColor: color.teal, marginTop: '0.15in', borderRadius: '2px' }} />
      </div>

      {/* Grid demo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: '0.12in' }}>
        {/* Span 2x2 hero block */}
        <div style={{ gridColumn: 'span 2', gridRow: 'span 2', background: `linear-gradient(135deg, ${color.teal}, #0d9488cc)`, borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0.3in', color: 'white' }}>
          <div style={{ fontFamily: font.heading, fontSize: '20pt', fontWeight: 700, marginBottom: '0.1in' }}>
            Flexible Grids
          </div>
          <div style={{ fontFamily: font.body, fontSize: '10pt', lineHeight: 1.6, opacity: 0.9 }}>
            CSS Grid lets you create any layout. Span columns, nest grids, and build complex compositions with precision.
          </div>
        </div>
        {/* Small blocks */}
        {[color.tealLight, '#e0f2fe', '#f0fdf4', '#fefce8', '#fdf2f8', '#f5f3ff'].map((bg, i) => (
          <div key={i} style={{
            backgroundColor: bg, borderRadius: '8px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: font.mono, fontSize: '9pt', color: color.muted,
            border: `1px solid ${i < 3 ? '#d1d5db20' : '#d1d5db10'}`,
          }}>
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  </Page>
);

// ════════════════════════════════════════════════════════════
// CH 3: COLOR & THEME
// ════════════════════════════════════════════════════════════
const ColorPage: React.FC = () => {
  const palettes = [
    { name: 'Violet', colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ede9fe'] },
    { name: 'Teal', colors: ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#ccfbf1'] },
    { name: 'Amber', colors: ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fef3c7'] },
    { name: 'Rose', colors: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#ffe4e6'] },
  ];

  return (
    <Page layout="margins">
      <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', gap: '0.3in' }}>
        <div>
          <div style={{ fontFamily: font.mono, fontSize: '9pt', color: color.warm, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.1in' }}>
            Chapter 03
          </div>
          <h2 style={{ fontFamily: font.heading, fontSize: '28pt', fontWeight: 700, color: color.ink, margin: 0 }}>
            Color &amp; Theme
          </h2>
          <div style={{ width: '0.8in', height: '3px', backgroundColor: color.warm, marginTop: '0.15in', borderRadius: '2px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2in' }}>
          <p style={{ fontFamily: font.body, fontSize: '11pt', lineHeight: 1.7, color: '#374151', margin: 0 }}>
            The theme system provides 15 built-in color palettes. Each theme includes colors, fonts, and spacing presets that cascade through every component.
          </p>

          {/* Color swatches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.15in', flex: 1 }}>
            {palettes.map((p) => (
              <div key={p.name}>
                <div style={{ fontFamily: font.body, fontSize: '9pt', fontWeight: 600, color: color.ink, marginBottom: '0.08in' }}>
                  {p.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderRadius: '8px', overflow: 'hidden' }}>
                  {p.colors.map((c, i) => (
                    <div key={i} style={{
                      backgroundColor: c, height: i === 0 ? '0.6in' : '0.3in',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        fontFamily: font.mono, fontSize: '7pt',
                        color: i < 2 ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.35)',
                      }}>
                        {c}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
};

// ════════════════════════════════════════════════════════════
// CH 4: DATA VISUALIZATION
// ════════════════════════════════════════════════════════════
const DataPage: React.FC = () => {
  const bars = [
    { label: 'React', value: 92, color: '#7c3aed' },
    { label: 'TypeScript', value: 85, color: '#8b5cf6' },
    { label: 'Vite', value: 78, color: '#a78bfa' },
    { label: 'CSS Grid', value: 70, color: '#c4b5fd' },
    { label: 'PDF', value: 55, color: '#ddd6fe' },
  ];

  const stats = [
    { label: 'Templates', value: '9', icon: '📄' },
    { label: 'Themes', value: '15', icon: '🎨' },
    { label: 'Components', value: '12', icon: '🧩' },
    { label: 'View Modes', value: '3', icon: '👁' },
  ];

  return (
    <Page layout="margins">
      <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', gap: '0.3in' }}>
        <div>
          <div style={{ fontFamily: font.mono, fontSize: '9pt', color: color.rose, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.1in' }}>
            Chapter 04
          </div>
          <h2 style={{ fontFamily: font.heading, fontSize: '28pt', fontWeight: 700, color: color.ink, margin: 0 }}>
            Data Visualization
          </h2>
          <div style={{ width: '0.8in', height: '3px', backgroundColor: color.rose, marginTop: '0.15in', borderRadius: '2px' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.4in' }}>
          {/* Bar chart */}
          <div>
            <div style={{ fontFamily: font.body, fontSize: '9pt', fontWeight: 600, color: color.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15in' }}>
              Technology Stack
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12in' }}>
              {bars.map((b) => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '0.1in' }}>
                  <span style={{ fontFamily: font.mono, fontSize: '9pt', color: color.ink, width: '0.9in', textAlign: 'right', flexShrink: 0 }}>
                    {b.label}
                  </span>
                  <div style={{ flex: 1, height: '20px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${b.value}%`, height: '100%',
                      backgroundColor: b.color, borderRadius: '4px',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <span style={{ fontFamily: font.mono, fontSize: '8pt', color: color.muted, width: '0.3in' }}>
                    {b.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.12in' }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                backgroundColor: color.slate, borderRadius: '10px', padding: '0.2in',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '20pt', marginBottom: '0.05in' }}>{s.icon}</div>
                <div style={{ fontFamily: font.heading, fontSize: '24pt', fontWeight: 900, color: color.accent }}>{s.value}</div>
                <div style={{ fontFamily: font.body, fontSize: '8pt', fontWeight: 500, color: color.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
};

// ════════════════════════════════════════════════════════════
// CH 5: CODE & COMPONENTS
// ════════════════════════════════════════════════════════════
const CodePage: React.FC = () => (
  <Page layout="margins">
    <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', gap: '0.3in' }}>
      <div>
        <div style={{ fontFamily: font.mono, fontSize: '9pt', color: color.accent, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.1in' }}>
          Chapter 05
        </div>
        <h2 style={{ fontFamily: font.heading, fontSize: '28pt', fontWeight: 700, color: color.ink, margin: 0 }}>
          Code &amp; Components
        </h2>
        <div style={{ width: '0.8in', height: '3px', backgroundColor: color.accent, marginTop: '0.15in', borderRadius: '2px' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3in' }}>
        {/* Code block */}
        <div style={{
          backgroundColor: '#1e1e2e', borderRadius: '10px', padding: '0.25in',
          fontFamily: font.mono, fontSize: '9pt', lineHeight: 1.7,
          color: '#cdd6f4', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '0.15in' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f38ba8' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#a6e3a1' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f9e2af' }} />
          </div>
          <div><span style={{ color: '#cba6f7' }}>import</span> {'{'} <span style={{ color: '#89b4fa' }}>Book</span>, <span style={{ color: '#89b4fa' }}>Page</span> {'}'}</div>
          <div>  <span style={{ color: '#cba6f7' }}>from</span> <span style={{ color: '#a6e3a1' }}>'@bookmotion/core'</span>;</div>
          <div style={{ marginTop: '0.1in' }}><span style={{ color: '#cba6f7' }}>export const</span> <span style={{ color: '#89dceb' }}>MyBook</span> = () =&gt; (</div>
          <div>  &lt;<span style={{ color: '#89b4fa' }}>Book</span> <span style={{ color: '#f9e2af' }}>config</span>=&#123;config&#125;&gt;</div>
          <div>    &lt;<span style={{ color: '#89b4fa' }}>Page</span> <span style={{ color: '#f9e2af' }}>layout</span>=<span style={{ color: '#a6e3a1' }}>"full-bleed"</span>&gt;</div>
          <div>      <span style={{ color: '#6c7086' }}>&#123;/* Your content */&#125;</span></div>
          <div>    &lt;/<span style={{ color: '#89b4fa' }}>Page</span>&gt;</div>
          <div>  &lt;/<span style={{ color: '#89b4fa' }}>Book</span>&gt;</div>
          <div>);</div>
        </div>

        {/* Component cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12in' }}>
          {[
            { name: '<Book>', desc: 'Root container with config context', tag: 'Core' },
            { name: '<Page>', desc: 'Individual page with layout modes', tag: 'Core' },
            { name: '<Chapter>', desc: 'Groups pages with metadata', tag: 'Core' },
            { name: '<BookViewer>', desc: 'Interactive viewer with 3 modes', tag: 'New' },
            { name: '<ThemeProvider>', desc: 'Cascading theme system', tag: 'New' },
          ].map((c) => (
            <div key={c.name} style={{
              display: 'flex', alignItems: 'center', gap: '0.15in',
              backgroundColor: color.slate, borderRadius: '8px', padding: '0.12in 0.18in',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: font.mono, fontSize: '10pt', fontWeight: 500, color: color.accent }}>
                  {c.name}
                </div>
                <div style={{ fontFamily: font.body, fontSize: '9pt', color: color.muted, marginTop: '2px' }}>
                  {c.desc}
                </div>
              </div>
              <span style={{
                fontFamily: font.mono, fontSize: '7pt', fontWeight: 600,
                backgroundColor: c.tag === 'New' ? color.accentLight : '#e2e8f0',
                color: c.tag === 'New' ? color.accent : color.muted,
                padding: '2px 8px', borderRadius: '100px',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {c.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Page>
);

// ════════════════════════════════════════════════════════════
// BACK COVER
// ════════════════════════════════════════════════════════════
const BackCover: React.FC = () => (
  <Page layout="full-bleed" density="hard">
    <div style={{
      position: 'absolute', top: '-0.125in', left: '-0.125in',
      width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: 'white', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: font.heading, fontSize: '20pt', fontWeight: 700,
        marginBottom: '0.3in', opacity: 0.9,
      }}>
        Built with Bookmotion
      </div>
      <div style={{
        fontFamily: font.body, fontSize: '11pt', fontWeight: 300,
        color: 'rgba(255,255,255,0.5)', lineHeight: 1.8,
      }}>
        React components for print-ready books.<br/>
        PDF &middot; EPUB &middot; Web &middot; Print
      </div>
      <div style={{
        marginTop: '0.5in', fontFamily: font.mono, fontSize: '9pt',
        color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em',
      }}>
        agora.studio
      </div>
    </div>
  </Page>
);

// ════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════
export const Root: React.FC = () => (
  <BookViewer config={config} mode="slide" showCover={true}>
    <CoverPage />
    <TocPage />
    <Chapter title="Design Foundations" number={1}>
      <TypographyPage />
      <GridPage />
      <ColorPage />
    </Chapter>
    <Chapter title="Technical Showcase" number={2}>
      <DataPage />
      <CodePage />
    </Chapter>
    <BackCover />
  </BookViewer>
);
