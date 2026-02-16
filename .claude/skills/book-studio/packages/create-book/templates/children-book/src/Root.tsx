import { BookViewer, Chapter, Page, staticFile } from '@bookmotion/core'
import { config } from '../book.config'

// Cover page component
const CoverPage: React.FC = () => (
  <Page layout="full-bleed">
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
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
          fontFamily: 'Fredoka One, cursive',
          fontSize: '48pt',
          marginBottom: '0.5in',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        {config.title}
      </h1>
      <p
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: '20pt',
          fontStyle: 'italic',
        }}
      >
        By {config.author}
      </p>
    </div>
  </Page>
)

// Story page component
interface StoryPageProps {
  illustration?: string
  text: string
  textPosition?: 'top' | 'bottom' | 'left' | 'right'
}

const StoryPage: React.FC<StoryPageProps> = ({
  illustration,
  text,
  textPosition = 'bottom',
}) => {
  const textStyle: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '0.5in',
    borderRadius: '16px',
    fontFamily: 'Nunito, sans-serif',
    fontSize: '18pt',
    lineHeight: 1.6,
    color: '#333',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  }

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { top: '0.5in', left: '0.5in', right: '0.5in' },
    bottom: { bottom: '0.5in', left: '0.5in', right: '0.5in' },
    left: { left: '0.5in', top: '50%', transform: 'translateY(-50%)', width: '40%' },
    right: { right: '0.5in', top: '50%', transform: 'translateY(-50%)', width: '40%' },
  }

  return (
    <Page layout="full-bleed">
      {/* Background illustration */}
      {illustration ? (
        <img
          src={staticFile(illustration)}
          alt=""
          style={{
            position: 'absolute',
            top: '-0.125in',
            left: '-0.125in',
            width: 'calc(100% + 0.25in)',
            height: 'calc(100% + 0.25in)',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%)',
          }}
        />
      )}

      {/* Text overlay */}
      <div style={{ ...textStyle, ...positionStyles[textPosition] }}>
        <p style={{ margin: 0 }}>{text}</p>
      </div>
    </Page>
  )
}

// Title page
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
          fontFamily: 'Fredoka One, cursive',
          fontSize: '36pt',
          color: '#667eea',
          marginBottom: '1in',
        }}
      >
        {config.title}
      </h1>
      <p
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: '16pt',
          color: '#666',
        }}
      >
        Written and illustrated by<br />
        <strong style={{ fontSize: '20pt', color: '#333' }}>{config.author}</strong>
      </p>
    </div>
  </Page>
)

// Copyright page
const CopyrightPage: React.FC = () => (
  <Page layout="margins">
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        paddingBottom: '1in',
      }}
    >
      <p
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: '9pt',
          color: '#666',
          textAlign: 'center',
        }}
      >
        © 2025 {config.author}. All rights reserved.<br />
        <br />
        No part of this publication may be reproduced, distributed, or<br />
        transmitted in any form without permission.<br />
        <br />
        Printed with love for little explorers everywhere.
      </p>
    </div>
  </Page>
)

export const Root = () => (
  <BookViewer config={config} mode="slide">
    {/* Front matter */}
    <CoverPage />
    <TitlePage />
    <CopyrightPage />

    {/* Main story */}
    <Chapter title="The Story" number={1}>
      <StoryPage
        illustration="assets/page1.jpg"
        text="Once upon a time, in a land filled with wonder, there lived a curious little explorer who loved to discover new things."
        textPosition="bottom"
      />
      <StoryPage
        illustration="assets/page2.jpg"
        text="Every morning, the little explorer would set out with a backpack full of snacks and a heart full of courage."
        textPosition="bottom"
      />
      <StoryPage
        illustration="assets/page3.jpg"
        text="Through forests and over hills, past rivers and under bridges, the adventure grew bigger with every step."
        textPosition="top"
      />
      <StoryPage
        illustration="assets/page4.jpg"
        text="And at the end of the day, the little explorer always found their way home, ready to dream of tomorrow's adventures."
        textPosition="bottom"
      />
    </Chapter>

    {/* The End */}
    <Page layout="full-bleed">
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: 'Fredoka One, cursive',
            fontSize: '48pt',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          The End
        </h1>
      </div>
    </Page>
  </BookViewer>
)
