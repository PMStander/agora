import React from 'react';
import { BookViewer, Page, Chapter } from '@bookmotion/core';
import { config } from '../book.config';

// Project spread component
const ProjectSpread: React.FC<{
  title: string;
  year: string;
  client?: string;
  description: string;
  tags: string[];
}> = ({ title, year, client, description, tags }) => (
  <Page layout="margins">
    <div style={{
      height: '100%',
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      gap: '0.5in',
    }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '28pt',
            fontWeight: 700,
            color: '#111827',
            margin: 0,
          }}>
            {title}
          </h2>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '12pt',
            color: '#9ca3af',
            fontWeight: 300,
          }}>
            {year}
          </span>
        </div>
        {client && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '11pt',
            color: '#6b7280',
            marginTop: '0.1in',
          }}>
            Client: {client}
          </p>
        )}
      </div>

      {/* Image area */}
      <div style={{
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12pt',
        color: '#9ca3af',
      }}>
        [Project Image]
      </div>

      {/* Description + Tags */}
      <div>
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '11pt',
          lineHeight: 1.7,
          color: '#374151',
          marginBottom: '0.25in',
        }}>
          {description}
        </p>
        <div style={{ display: 'flex', gap: '0.15in', flexWrap: 'wrap' }}>
          {tags.map((tag) => (
            <span key={tag} style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '8pt',
              fontWeight: 600,
              color: '#4f46e5',
              backgroundColor: '#eef2ff',
              padding: '0.05in 0.15in',
              borderRadius: '100px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  </Page>
);

// Image gallery page (3 images)
const GalleryPage: React.FC<{ caption?: string }> = ({ caption }) => (
  <Page layout="margins">
    <div style={{
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '2fr 1fr',
      gap: '0.15in',
    }}>
      <div style={{
        gridColumn: 'span 2',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11pt',
        color: '#9ca3af',
      }}>
        [Hero Image]
      </div>
      <div style={{
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10pt',
        color: '#9ca3af',
      }}>
        [Detail 1]
      </div>
      <div style={{
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10pt',
        color: '#9ca3af',
      }}>
        [Detail 2]
      </div>
    </div>
    {caption && (
      <p style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '9pt',
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: '0.15in',
      }}>
        {caption}
      </p>
    )}
  </Page>
);

// Cover
const CoverPage: React.FC = () => (
  <Page layout="full-bleed" density="hard">
    <div style={{
      position: 'absolute', top: '-0.125in', left: '-0.125in',
      width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
      backgroundColor: '#111827',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: 'white', textAlign: 'center',
    }}>
      <h1 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: '42pt', fontWeight: 700,
        letterSpacing: '-0.02em',
      }}>
        {config.title}
      </h1>
      <div style={{
        width: '2in', height: '2px',
        backgroundColor: '#4f46e5',
        margin: '0.4in 0',
      }} />
      <p style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '14pt', fontWeight: 300,
        letterSpacing: '0.15em', textTransform: 'uppercase',
      }}>
        {config.author}
      </p>
    </div>
  </Page>
);

// About page
const AboutPage: React.FC = () => (
  <Page layout="margins">
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <h2 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: '24pt', fontWeight: 700,
        color: '#111827', marginBottom: '0.3in',
      }}>
        About
      </h2>
      <p style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '12pt', lineHeight: 1.8,
        color: '#374151', maxWidth: '5in',
      }}>
        Replace this with your bio. Describe your creative philosophy,
        experience, and what drives your work.
      </p>
    </div>
  </Page>
);

export const Root: React.FC = () => (
  <BookViewer config={config} mode="slide">
    <CoverPage />
    <AboutPage />
    <Chapter title="Selected Work" number={1}>
      <ProjectSpread
        title="Project Alpha"
        year="2025"
        client="Acme Corp"
        description="A comprehensive redesign of the Acme Corp digital experience, focusing on user engagement and brand consistency."
        tags={['UX Design', 'Branding', 'Web']}
      />
      <GalleryPage caption="Project Alpha - Detail views and interactions" />
      <ProjectSpread
        title="Project Beta"
        year="2024"
        description="An exploration of generative art and data visualization, creating immersive experiences from real-time data streams."
        tags={['Creative Coding', 'Data Viz', 'Installation']}
      />
      <GalleryPage />
    </Chapter>
    <Page layout="full-bleed" density="hard">
      <div style={{
        position: 'absolute', top: '-0.125in', left: '-0.125in',
        width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
        backgroundColor: '#111827',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#6b7280', textAlign: 'center',
      }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '11pt', fontWeight: 300 }}>
          hello@yourname.com
        </p>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '10pt', fontWeight: 300, marginTop: '0.1in' }}>
          yourname.com
        </p>
      </div>
    </Page>
  </BookViewer>
);
