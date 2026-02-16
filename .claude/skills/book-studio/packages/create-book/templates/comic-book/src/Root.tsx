import React from 'react';
import { BookViewer, Page, Chapter } from '@bookmotion/core';
import { config } from '../book.config';

// Speech bubble component
const SpeechBubble: React.FC<{
  text: string;
  position?: { top?: string; left?: string; right?: string; bottom?: string };
  tail?: 'left' | 'right' | 'bottom';
  style?: React.CSSProperties;
}> = ({ text, position = {}, tail = 'bottom', style = {} }) => (
  <div style={{
    position: 'absolute',
    backgroundColor: '#fff',
    border: '3px solid #000',
    borderRadius: '20px',
    padding: '0.15in 0.25in',
    fontFamily: "'Comic Neue', 'Comic Sans MS', cursive",
    fontSize: '11pt',
    fontWeight: 700,
    lineHeight: 1.3,
    maxWidth: '2.5in',
    textAlign: 'center',
    zIndex: 10,
    ...position,
    ...style,
  }}>
    {text}
    {/* Tail indicator */}
    <div style={{
      position: 'absolute',
      width: 0, height: 0,
      ...(tail === 'bottom' ? {
        bottom: '-16px', left: '30%',
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '16px solid #000',
      } : tail === 'left' ? {
        left: '-16px', top: '40%',
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderRight: '16px solid #000',
      } : {
        right: '-16px', top: '40%',
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderLeft: '16px solid #000',
      }),
    }} />
  </div>
);

// Panel component
const Panel: React.FC<{
  backgroundColor?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ backgroundColor = '#e8e8e8', children, style = {} }) => (
  <div style={{
    border: '3px solid #000',
    backgroundColor,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  }}>
    {children || <span style={{ color: '#999', fontSize: '10pt' }}>[Panel Art]</span>}
  </div>
);

// Caption box
const CaptionBox: React.FC<{ text: string; position?: React.CSSProperties }> = ({ text, position = {} }) => (
  <div style={{
    position: 'absolute',
    backgroundColor: '#fffacd',
    border: '2px solid #000',
    padding: '0.1in 0.2in',
    fontFamily: "'Comic Neue', cursive",
    fontSize: '10pt',
    fontStyle: 'italic',
    zIndex: 10,
    ...position,
  }}>
    {text}
  </div>
);

// Cover
const CoverPage: React.FC = () => (
  <Page layout="full-bleed" density="hard">
    <div style={{
      position: 'absolute', top: '-0.125in', left: '-0.125in',
      width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
      background: 'linear-gradient(135deg, #ff3366 0%, #ffcc00 50%, #ff3366 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center',
    }}>
      <h1 style={{
        fontFamily: "'Bangers', 'Impact', sans-serif",
        fontSize: '64pt', color: '#fff',
        textShadow: '4px 4px 0 #000, -2px -2px 0 #000',
        letterSpacing: '0.05em',
        transform: 'rotate(-3deg)',
      }}>
        {config.title}
      </h1>
      <p style={{
        fontFamily: "'Comic Neue', cursive",
        fontSize: '16pt', color: '#fff',
        textShadow: '2px 2px 0 #000',
        marginTop: '0.5in',
      }}>
        By {config.author}
      </p>
    </div>
  </Page>
);

// Comic page with 6-panel grid
const SixPanelPage: React.FC = () => (
  <Page layout="margins">
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr 1fr',
      gap: '0.1in',
      height: '100%',
    }}>
      <Panel backgroundColor="#c8e6c9">
        <SpeechBubble text="It all started one morning..." position={{ top: '0.15in', left: '0.15in' }} tail="bottom" />
      </Panel>
      <Panel backgroundColor="#bbdefb" />
      <Panel backgroundColor="#ffe0b2">
        <CaptionBox text="Meanwhile, across town..." position={{ top: '0.1in', left: '0.1in' }} />
      </Panel>
      <Panel backgroundColor="#f8bbd0" />
      <Panel backgroundColor="#d1c4e9" style={{ gridColumn: 'span 2' }}>
        <SpeechBubble text="This changes everything!" position={{ top: '0.15in', right: '0.3in' }} tail="left" />
      </Panel>
    </div>
  </Page>
);

// Action page with dynamic layout
const ActionPage: React.FC = () => (
  <Page layout="margins">
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gridTemplateRows: '2fr 1fr',
      gap: '0.1in',
      height: '100%',
    }}>
      <Panel backgroundColor="#ffcdd2" style={{ gridRow: 'span 2' }}>
        <div style={{ fontSize: '48pt', fontFamily: "'Bangers', sans-serif", color: '#ff3366', textShadow: '3px 3px 0 #000' }}>
          POW!
        </div>
      </Panel>
      <Panel backgroundColor="#c5cae9" />
      <Panel backgroundColor="#dcedc8">
        <SpeechBubble text="We did it!" position={{ top: '0.1in', left: '0.1in' }} />
      </Panel>
    </div>
  </Page>
);

export const Root: React.FC = () => (
  <BookViewer config={config} mode="slide">
    <CoverPage />
    <Chapter title="Issue 1" number={1}>
      <SixPanelPage />
      <ActionPage />
      <SixPanelPage />
    </Chapter>
    <Page layout="full-bleed" density="hard">
      <div style={{
        position: 'absolute', top: '-0.125in', left: '-0.125in',
        width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
        backgroundColor: '#1a1a2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: '24pt', color: '#ffcc00' }}>
          TO BE CONTINUED...
        </span>
      </div>
    </Page>
  </BookViewer>
);
