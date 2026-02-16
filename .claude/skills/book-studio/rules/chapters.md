---
name: book-chapters
description: Chapter organization, running headers, table of contents, and section management
metadata:
  tags: book, chapters, toc, sections, organization
---

# Chapters in Bookmotion

Chapters help organize your book and enable features like tables of contents, running headers, and page numbering.

## The `<Chapter>` Component

Wrap pages in a `<Chapter>` component:

```tsx
import { Book, Chapter, Page } from '@bookmotion/core';

<Book config={config}>
  <Chapter
    title="The Beginning"
    subtitle="How it all started"
    number={1}
    startOn="right"
  >
    <ChapterOpeningPage />
    <StoryPage1 />
    <StoryPage2 />
    <StoryPage3 />
  </Chapter>
  
  <Chapter title="The Journey" number={2}>
    <ChapterOpeningPage />
    <StoryPages />
  </Chapter>
</Book>
```

## Chapter Props

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Chapter title (required) |
| `subtitle` | `string` | Chapter subtitle |
| `number` | `number \| string` | Chapter number |
| `startOn` | `'left' \| 'right' \| 'either'` | Force start page |
| `id` | `string` | Unique identifier |
| `className` | `string` | CSS class |

## Chapter Start Pages

### Right Page Start (default)

Chapters traditionally start on right (odd) pages:

```tsx
<Chapter title="Chapter One" number={1} startOn="right">
  {/* If previous chapter ends on right page,
      a blank left page is inserted */}
  <ChapterOpening />
</Chapter>
```

### Left Page Start

For special cases:

```tsx
<Chapter title="Appendix" startOn="left">
  <AppendixContent />
</Chapter>
```

### Any Page

Allow chapter to start on next available page:

```tsx
<Chapter title="Interlude" startOn="either">
  <InterludeContent />
</Chapter>
```

## Chapter Opening Pages

### Standard Opening

```tsx
import { ChapterOpening } from '@bookmotion/core';

export const ChapterOpening = () => {
  const { chapter } = usePageConfig();
  
  return (
    <Page layout="margins" footer={null}>
      <div style={{ marginTop: '3in' }}>
        <h1 style={{ fontSize: '48pt', marginBottom: '0.5in' }}>
          Chapter {chapter.number}
        </h1>
        <h2 style={{ fontSize: '24pt', fontStyle: 'italic' }}>
          {chapter.title}
        </h2>
        {chapter.subtitle && (
          <h3 style={{ fontSize: '16pt', color: '#666' }}>
            {chapter.subtitle}
          </h3>
        )}
      </div>
    </Page>
  );
};
```

### Opening with Epigraph

```tsx
import { Epigraph } from '@bookmotion/core';

<Page layout="margins">
  <div style={{ marginTop: '2in' }}>
    <h1>Chapter 1</h1>
    <h2>The Beginning</h2>
    
    <Epigraph
      quote="Every journey begins with a single step."
      author="Lao Tzu"
      style={{ marginTop: '2in' }}
    />
  </div>
</Page>
```

### Decorative Opening

```tsx
<Page layout="full-bleed">
  <BackgroundImage src="chapter-bg.jpg" />
  <div
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      color: 'white',
    }}
  >
    <h1>Chapter One</h1>
  </div>
</Page>
```

## Running Headers

Headers that show chapter info:

```tsx
import { usePageConfig } from '@bookmotion/core';

export const RunningHeader = () => {
  const { isLeftPage, isRightPage, chapter } = usePageConfig();
  
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontStyle: 'italic',
        borderBottom: '0.5pt solid #ccc',
        paddingBottom: '0.125in',
      }}
    >
      {isLeftPage && <span>{chapter.title}</span>}
      {isRightPage && <span>{chapter.bookTitle}</span>}
    </div>
  );
};
```

Use in pages:

```tsx
<Page header={<RunningHeader />}>
  {/* Page content */}
</Page>
```

### Alternating Header Style

Book title on right, chapter on left:

```tsx
export const AlternatingHeader = () => {
  const { isLeftPage, chapter, bookConfig } = usePageConfig();
  
  return (
    <div
      style={{
        fontSize: '9pt',
        fontStyle: 'italic',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}
    >
      {isLeftPage ? chapter.title : bookConfig.title}
    </div>
  );
};
```

## Blank Pages

### Intentionally Blank

```tsx
export const BlankPage = () => (
  <Page layout="margins">
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ fontStyle: 'italic', color: '#999' }}>
        This page intentionally left blank
      </span>
    </div>
  </Page>
);
```

### Auto-Inserted Blank

When a chapter starts on right but previous ends on right:

```tsx
<Chapter title="Chapter 1" number={1} startOn="right">
  {/* Blank page auto-inserted here if needed */}
  <ChapterOpening />
</Chapter>
```

## Section Breaks

Within chapters:

```tsx
export const SectionBreak = () => (
  <div style={{ textAlign: 'center', margin: '1in 0' }}>
    * * *
  </div>
);
```

Or use a component:

```tsx
import { SectionBreak } from '@bookmotion/core';

<Page layout="margins">
  <p>First section...</p>
  <SectionBreak type="asterism" />  // * * *
  <SectionBreak type="line" />      // ———
  <SectionBreak type="space" />     // Just spacing
  <p>Second section...</p>
</Page>
```

## Chapter Utilities

### useChapter Hook

Access chapter info anywhere:

```tsx
import { useChapter } from '@bookmotion/core';

const MyComponent = () => {
  const {
    title,
    subtitle,
    number,
    pageCount,
    startPage,
    endPage,
  } = useChapter();
  
  return <span>Chapter {number}: {title}</span>;
};
```

### usePageConfig Hook

Access page context:

```tsx
import { usePageConfig } from '@bookmotion/core';

const MyComponent = () => {
  const {
    pageNumber,
    chapter,
    isFirstPageOfChapter,
    isLastPageOfChapter,
  } = usePageConfig();
  
  return (
    <div>
      Page {pageNumber} of chapter "{chapter.title}"
    </div>
  );
};
```

## Front Matter

Pages before main content:

```tsx
<Book config={config}>
  {/* Front Matter (lowercase Roman numerals) */}
  <FrontMatter>
    <HalfTitlePage />
    <Frontispiece />
    <TitlePage />
    <CopyrightPage />
    <Dedication />
    <Epigraph />
    <TableOfContents />
    <Foreword />
    <Preface />
    <Acknowledgments />
  </FrontMatter>
  
  {/* Main Content (Arabic numerals) */}
  <Chapter title="Chapter 1" number={1}>
    <Content />
  </Chapter>
</Book>
```

### Front Matter Component

```tsx
import { FrontMatter } from '@bookmotion/core';

<FrontMatter pageNumbering="roman">
  <HalfTitlePage />
  <TitlePage />
  <CopyrightPage />
  <Dedication />
  <TableOfContents />
</FrontMatter>
```

## Back Matter

Pages after main content:

```tsx
<BackMatter>
  <Appendix title="Additional Resources">
    <Content />
  </Appendix>
  <Notes />
  <Glossary />
  <Bibliography />
  <Index />
  <Colophon />
</BackMatter>
```

## Page Numbering

### Configuring Page Numbers

```typescript
// book.config.ts
export const config: BookConfig = {
  pageNumbering: {
    startAt: 1,
    format: 'arabic',     // 'arabic' | 'roman' | 'Roman'
    position: 'footer',   // 'footer' | 'header' | null
    alignment: 'outside', // 'left' | 'center' | 'right' | 'outside'
  },
};
```

### Front Matter Roman Numerals

```tsx
<FrontMatter pageNumbering={{ format: 'roman', startAt: 1 }}>
  {/* Pages numbered i, ii, iii... */}
</FrontMatter>

<Chapter title="Chapter 1" number={1}>
  {/* Pages numbered 1, 2, 3... */}
</Chapter>
```

### Skip Page Numbers

Hide page number on specific pages:

```tsx
<Page footer={null}>
  {/* No page number */}
</Page>
```

Or configure:

```ts
pageNumbering: {
  skipPages: [1, 2],  // No numbers on pages 1-2
}
```

## Table of Contents

### Auto-Generated TOC

```tsx
import { TableOfContents, TOCItem } from '@bookmotion/core';

// Automatic from chapters
<TableOfContents autoGenerate />

// Manual control
<TableOfContents>
  <TOCItem
    title="Chapter 1: The Beginning"
    page={1}
    level={1}
  />
  <TOCItem
    title="The First Adventure"
    page={3}
    level={2}
  />
</TableOfContents>
```

### Chapter-Based TOC

```tsx
const chapters = [
  { title: 'Chapter 1: The Beginning', page: 1 },
  { title: 'Chapter 2: The Journey', page: 15 },
  { title: 'Chapter 3: The Return', page: 32 },
];

<Page layout="margins">
  <h1>Contents</h1>
  {chapters.map((ch) => (
    <div
      key={ch.title}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.25in',
      }}
    >
      <span>{ch.title}</span>
      <span>{ch.page}</span>
    </div>
  ))}
</Page>
```

### Dotted Leader Lines

```tsx
<div style={{ display: 'flex', alignItems: 'baseline' }}>
  <span>Chapter Title</span>
  <span
    style={{
      flex: 1,
      borderBottom: '1px dotted #999',
      margin: '0 0.125in',
    }}
  />
  <span>42</span>
</div>
```

## Chapter Best Practices

1. **Use chapters liberally** - Even short books benefit from structure
2. **Start chapters on right pages** - Traditional and looks better
3. **Include chapter openings** - Set the tone for each chapter
4. **Keep titles descriptive** - Help readers navigate
5. **Use running headers** - Orient readers within the book
6. **Handle blank pages gracefully** - Add "intentionally blank" if needed
7. **Number consistently** - Arabic for main, Roman for front matter
8. **Update TOC** - Keep table of contents current
9. **Test page breaks** - Ensure chapters start where expected
10. **Consider subdivisions** - Use sections within long chapters

## Common Patterns

### Novel Structure

```tsx
<Book config={config}>
  <FrontMatter>
    <TitlePage />
    <CopyrightPage />
    <Dedication />
    <TableOfContents />
  </FrontMatter>
  
  <Part title="Part One: The Beginning">
    <Chapter title="Chapter 1" number={1}>
      <Content />
    </Chapter>
    <Chapter title="Chapter 2" number={2}>
      <Content />
    </Chapter>
  </Part>
  
  <Part title="Part Two: The Journey">
    <Chapter title="Chapter 3" number={3}>
      <Content />
    </Chapter>
  </Part>
  
  <BackMatter>
    <Acknowledgments />
    <AboutTheAuthor />
  </BackMatter>
</Book>
```

### Cookbook Structure

```tsx
<Book config={config}>
  <TitlePage />
  <Introduction />
  
  <Chapter title="Breakfast">
    <RecipeCard title="Pancakes" />
    <RecipeCard title="Eggs Benedict" />
  </Chapter>
  
  <Chapter title="Main Courses">
    <RecipeCard title="Pasta Carbonara" />
    <RecipeCard title="Roast Chicken" />
  </Chapter>
  
  <Index />
</Book>
```

### Textbook Structure

```tsx
<Book config={config}>
  <FrontMatter>
    <TitlePage />
    <TableOfContents detailed />
    <Preface />
  </FrontMatter>
  
  <Unit title="Unit 1: Foundations">
    <Chapter title="Chapter 1: Introduction">
      <LearningObjectives />
      <Content />
      <Summary />
      <ReviewQuestions />
    </Chapter>
  </Unit>
  
  <BackMatter>
    <Appendix title="Glossary" />
    <Appendix title="Index" />
  </BackMatter>
</Book>
```

---

See [pagination.md](pagination.md) for detailed page numbering and TOC generation.
