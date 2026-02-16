import React from 'react';
import { Page } from './components/Page';
import { Chapter } from './components/Chapter';
import { BookViewer } from './components/BookViewer';
import { config } from '../book.config';

// ── Story page component ──
interface StoryPageProps {
  backgroundColor: string;
  text: string;
  textPosition?: 'top' | 'bottom' | 'left' | 'right';
  illustrationElement?: React.ReactNode;
}

const StoryPage: React.FC<StoryPageProps> = ({
  backgroundColor,
  text,
  textPosition = 'bottom',
  illustrationElement,
}) => {
  const textBoxStyle: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '0.5in',
    borderRadius: '16px',
    fontFamily: 'Georgia, serif',
    fontSize: '18pt',
    lineHeight: 1.6,
    color: '#333',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    maxWidth: '80%',
  };

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { top: '0.5in', left: '50%', transform: 'translateX(-50%)' },
    bottom: { bottom: '0.5in', left: '50%', transform: 'translateX(-50%)' },
    left: { left: '0.5in', top: '50%', transform: 'translateY(-50%)', maxWidth: '40%' },
    right: { right: '0.5in', top: '50%', transform: 'translateY(-50%)', maxWidth: '40%' },
  };

  return (
    <Page layout="full-bleed">
      <div
        style={{
          position: 'absolute',
          top: '-0.125in',
          left: '-0.125in',
          width: 'calc(100% + 0.25in)',
          height: 'calc(100% + 0.25in)',
          backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {illustrationElement || (
          <div
            style={{
              width: '60%',
              height: '60%',
              backgroundColor: 'rgba(255,255,255,0.3)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14pt',
              color: 'rgba(0,0,0,0.5)',
            }}
          >
            [Illustration Placeholder]
          </div>
        )}
      </div>
      <div style={{ ...textBoxStyle, ...positionStyles[textPosition] }}>
        <p style={{ margin: 0 }}>{text}</p>
      </div>
    </Page>
  );
};

// ── Cover page (hard density for realistic flip) ──
const CoverPage: React.FC = () => (
  <Page layout="full-bleed" density="hard">
    <div
      style={{
        position: 'absolute',
        top: '-0.125in',
        left: '-0.125in',
        width: 'calc(100% + 0.25in)',
        height: 'calc(100% + 0.25in)',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '48pt',
          marginBottom: '0.5in',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        {config.title}
      </h1>
      <p
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '20pt',
          fontStyle: 'italic',
        }}
      >
        By {config.author}
      </p>
      <div
        style={{
          width: '2in',
          height: '2in',
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: '50%',
          marginTop: '1in',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12pt',
        }}
      >
        🌟
      </div>
    </div>
  </Page>
);

// ── Title page ──
const TitlePage: React.FC = () => (
  <Page layout="margins">
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '36pt',
          color: '#667eea',
          marginBottom: '1in',
        }}
      >
        {config.title}
      </h1>
      <p
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '16pt',
          color: '#666',
        }}
      >
        Written and illustrated by
        <br />
        <strong style={{ fontSize: '20pt', color: '#333' }}>{config.author}</strong>
      </p>
    </div>
  </Page>
);

// ── Copyright page ──
const CopyrightPage: React.FC = () => (
  <Page layout="margins">
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        paddingBottom: '1in',
        textAlign: 'center',
      }}
    >
      <p style={{ fontFamily: 'Georgia, serif', fontSize: '9pt', color: '#666' }}>
        © 2025 {config.author}. All rights reserved.
        <br />
        <br />
        No part of this publication may be reproduced,
        <br />
        distributed, or transmitted in any form without permission.
        <br />
        <br />
        Printed with love for little explorers everywhere.
      </p>
    </div>
  </Page>
);

// ── The End page (hard density for back cover) ──
const EndPage: React.FC = () => (
  <Page layout="full-bleed" density="hard">
    <div
      style={{
        position: 'absolute',
        top: '-0.125in',
        left: '-0.125in',
        width: 'calc(100% + 0.25in)',
        height: 'calc(100% + 0.25in)',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}
    >
      <h1
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: '48pt',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        The End
      </h1>
      <p style={{ fontSize: '16pt', marginTop: '0.5in', fontStyle: 'italic' }}>
        Thank you for reading!
      </p>
      <div style={{ marginTop: '1in', fontSize: '48pt' }}>🌙 ✨</div>
    </div>
  </Page>
);

// ── Root: Uses BookViewer with flip/slide/scroll modes ──
export const Root: React.FC = () => (
  <BookViewer config={config} mode="flip" showCover={true}>
    <CoverPage />
    <TitlePage />
    <CopyrightPage />
    <Chapter title="The Story" number={1}>
      <StoryPage
        backgroundColor="#87CEEB"
        text="Once upon a time, in a land filled with wonder, there lived a curious little explorer who loved to discover new things every day."
        textPosition="bottom"
      />
      <StoryPage
        backgroundColor="#98D8C8"
        text="Every morning, the little explorer would wake up with a big smile, ready for whatever adventures the day might bring."
        textPosition="bottom"
      />
      <StoryPage
        backgroundColor="#F7DC6F"
        text="Through forests tall and rivers wide, past mountains that touched the sky, the little explorer journeyed far and wide."
        textPosition="top"
      />
      <StoryPage
        backgroundColor="#BB8FCE"
        text="And at the end of each day, no matter how far they had traveled, the little explorer always found their way back home, where cozy dreams awaited."
        textPosition="bottom"
      />
    </Chapter>
    <EndPage />
  </BookViewer>
);
