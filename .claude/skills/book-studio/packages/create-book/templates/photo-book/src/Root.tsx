import React from 'react';
import { BookViewer, Page, Chapter } from '@bookmotion/core';
import { config } from '../book.config';

// Photo grid component for 2x2 layouts
const PhotoGrid: React.FC<{
  photos: { src: string; caption?: string }[];
  gap?: string;
}> = ({ photos, gap = '0.125in' }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gridTemplateRows: 'repeat(2, 1fr)',
    gap,
    height: '100%',
  }}>
    {photos.map((photo, i) => (
      <div key={i} style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: `hsl(${200 + i * 30}, 30%, 85%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10pt',
          color: '#666',
        }}>
          [Photo {i + 1}]
        </div>
        {photo.caption && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '0.25in',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
            color: '#fff',
            fontSize: '9pt',
            fontFamily: 'Montserrat, sans-serif',
          }}>
            {photo.caption}
          </div>
        )}
      </div>
    ))}
  </div>
);

// Timeline spread with date and description
const TimelinePage: React.FC<{
  date: string;
  title: string;
  description: string;
}> = ({ date, title, description }) => (
  <Page layout="margins">
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: 'center',
      fontFamily: 'Playfair Display, Georgia, serif',
    }}>
      <p style={{ fontSize: '14pt', color: '#999', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        {date}
      </p>
      <h2 style={{ fontSize: '36pt', margin: '0.5in 0', color: '#222' }}>
        {title}
      </h2>
      <p style={{ fontSize: '14pt', color: '#666', lineHeight: 1.8, maxWidth: '6in', margin: '0 auto' }}>
        {description}
      </p>
    </div>
  </Page>
);

// Cover
const CoverPage: React.FC = () => (
  <Page layout="full-bleed" density="hard">
    <div style={{
      position: 'absolute', top: '-0.125in', left: '-0.125in',
      width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
      backgroundColor: '#1a1a2e',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: 'white', textAlign: 'center',
    }}>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '48pt', marginBottom: '0.5in' }}>
        {config.title}
      </h1>
      <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '14pt', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        {config.author}
      </p>
    </div>
  </Page>
);

// Full-bleed photo page
const FullPhotoPage: React.FC<{ caption?: string }> = ({ caption }) => (
  <Page layout="full-bleed">
    <div style={{
      position: 'absolute', top: '-0.125in', left: '-0.125in',
      width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
      backgroundColor: '#e8e8e8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '14pt', color: '#888',
    }}>
      [Full-bleed Photo]
    </div>
    {caption && (
      <div style={{
        position: 'absolute', bottom: '0.5in', left: '0.5in', right: '0.5in',
        textAlign: 'center', color: '#fff', fontSize: '11pt',
        fontFamily: 'Montserrat, sans-serif',
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}>
        {caption}
      </div>
    )}
  </Page>
);

// Grid photo page
const GridPhotoPage: React.FC = () => (
  <Page layout="full-bleed">
    <PhotoGrid photos={[
      { src: '', caption: 'Morning light' },
      { src: '', caption: 'Golden hour' },
      { src: '', caption: 'City streets' },
      { src: '', caption: 'Quiet moments' },
    ]} />
  </Page>
);

export const Root: React.FC = () => (
  <BookViewer config={config} mode="slide">
    <CoverPage />
    <Chapter title="Summer Adventures" number={1}>
      <TimelinePage date="June 2025" title="The Journey Begins" description="Replace this with your story. Every photo album tells a tale." />
      <FullPhotoPage caption="A moment captured in time" />
      <GridPhotoPage />
      <FullPhotoPage caption="The road ahead" />
    </Chapter>
    <Page layout="full-bleed" density="hard">
      <div style={{
        position: 'absolute', top: '-0.125in', left: '-0.125in',
        width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
        backgroundColor: '#1a1a2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#666', fontSize: '11pt', fontFamily: 'Montserrat, sans-serif',
      }}>
        The End
      </div>
    </Page>
  </BookViewer>
);
