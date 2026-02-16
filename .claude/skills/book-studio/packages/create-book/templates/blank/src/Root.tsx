import { BookViewer, Page, Chapter } from '@bookmotion/core'
import { config } from '../book.config'

export const Root = () => (
  <BookViewer config={config} mode="slide">
    {/* Front matter */}
    <Page layout="margins">
      <div style={{ textAlign: 'center', marginTop: '3in' }}>
        <h1 style={{ fontSize: '36pt', marginBottom: '0.5in' }}>
          {config.title}
        </h1>
        <p style={{ fontSize: '18pt' }}>By {config.author}</p>
      </div>
    </Page>

    <Page layout="margins">
      <div style={{ marginTop: '2in' }}>
        <p>© 2025 {config.author}. All rights reserved.</p>
        <p style={{ marginTop: '1in', fontSize: '10pt' }}>
          No part of this publication may be reproduced...
        </p>
      </div>
    </Page>

    {/* Main content */}
    <Chapter title="Chapter 1" number={1} startOn="right">
      <Page layout="margins">
        <h1>Chapter 1</h1>
        <h2 style={{ fontStyle: 'italic', color: '#666' }}>
          The Beginning
        </h2>
        <p style={{ marginTop: '1in', textIndent: '1em' }}>
          Once upon a time, in a land far away, there lived a brave hero...
        </p>
        <p style={{ textIndent: '1em' }}>
          This is where your story begins. Edit this file at{' '}
          <code>src/Root.tsx</code> to create your book.
        </p>
      </Page>
    </Chapter>

    <Chapter title="Chapter 2" number={2}>
      <Page layout="margins">
        <h1>Chapter 2</h1>
        <h2 style={{ fontStyle: 'italic', color: '#666' }}>
          The Journey
        </h2>
        <p style={{ marginTop: '1in', textIndent: '1em' }}>
          The adventure continued as our hero set out on a grand journey...
        </p>
      </Page>
    </Chapter>
  </BookViewer>
)
