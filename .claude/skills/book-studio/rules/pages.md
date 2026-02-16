---
name: book-pages
description: Creating and customizing pages in Bookmotion - the Page component, hooks, and layout options
metadata:
  tags: book, pages, layout, components
---

# Pages in Bookmotion

Pages are the fundamental building blocks of your book. This guide covers the `<Page>` component, configuration options, and best practices.

## The `<Page>` Component

Every page in your book must be wrapped in a `<Page>` component:

```tsx
import { Page, usePageConfig } from '@bookmotion/core';

export const MyPage = () => {
  return (
    <Page
      layout="margins"           // Layout template
      header={<RunningHeader />}  // Optional header
      footer={<PageNumber />}     // Optional footer
      backgroundColor="#fff"      // Page background
      className="my-page"        // Custom CSS class
    >
      {/* Your page content */}
    </Page>
  );
};
```

## Page Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `layout` | `string` | `"margins"` | Layout template to use |
| `header` | `ReactNode` | - | Header content (appears at top of page) |
| `footer` | `ReactNode` | - | Footer content (appears at bottom of page) |
| `backgroundColor` | `string` | `"#fff"` | Page background color |
| `className` | `string` | - | Additional CSS classes |
| `style` | `CSSProperties` | - | Inline styles |

## Page Layouts

Bookmotion provides several built-in layout templates:

### `margins` (default)

Content stays within the safe margins. Best for text-heavy pages.

```tsx
<Page layout="margins">
  <h1>Chapter Title</h1>
  <p>Body text goes here...</p>
</Page>
```

Visual:
```
┌─────────────────────────────┐
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │    CONTENT AREA         │ │
│ │    (within margins)     │ │
│ │                         │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### `full-bleed`

Content extends to the trim edge (including bleed area). Best for illustrations, covers, and photos.

```tsx
<Page layout="full-bleed">
  <img 
    src={staticFile('illustration.png')} 
    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
  />
</Page>
```

Visual:
```
┌─────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Bleed area (trimmed)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓┌─────────────────────┐▓▓ │
│ ▓▓│                     │▓▓ │
│ ▓▓│   CONTENT AREA       │▓▓ │
│ ▓▓│   (extends to edge)  │▓▓ │
│ ▓▓│                     │▓▓ │
│ ▓▓└─────────────────────┘▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└─────────────────────────────┘
```

### `text-only`

Optimized for text with generous margins. No header/footer by default.

```tsx
<Page layout="text-only">
  <BodyText content={chapterText} />
</Page>
```

### `two-column`

Side-by-side text columns. Great for wide pages or reference material.

```tsx
<Page layout="two-column">
  <TwoColumnText 
    leftColumn={leftText} 
    rightColumn={rightText} 
  />
</Page>
```

Visual:
```
┌─────────────────────────────┐
│ ┌──────────┐ ┌──────────┐ │
│ │ Column 1 │ │ Column 2 │ │
│ │          │ │          │ │
│ │          │ │          │ │
│ │          │ │          │ │
│ └──────────┘ └──────────┘ │
└─────────────────────────────┘
```

### `cover`

Special layout for front/back covers. Includes spine margin calculation.

```tsx
<Page layout="cover" page="front">
  <CoverTitle />
  <CoverImage />
</Page>
```

### Custom Layouts

You can create custom layouts. See [layouts.md](layouts.md) for details.

## The `usePageConfig` Hook

Access page context with the `usePageConfig` hook:

```tsx
import { usePageConfig } from '@bookmotion/core';

export const MyPage = () => {
  const {
    pageNumber,      // Absolute page number (1-based)
    isLeftPage,      // True if on left side of spread
    isRightPage,     // True if on right side of spread
    isFirstPage,     // True if first page of book
    isLastPage,      // True if last page of book
    chapter,         // Current chapter info
    margins,         // Margin measurements
    dimensions,      // Page dimensions
  } = usePageConfig();

  return (
    <Page>
      {isRightPage && <ChapterHeader />}
      <p>This is page {pageNumber}</p>
    </Page>
  );
};
```

### Hook Return Values

| Value | Type | Description |
|-------|------|-------------|
| `pageNumber` | `number` | Current page number (1, 2, 3...) |
| `isLeftPage` | `boolean` | True on even pages (left side) |
| `isRightPage` | `boolean` | True on odd pages (right side) |
| `isFirstPage` | `boolean` | True only on page 1 |
| `isLastPage` | `boolean` | True only on last page |
| `chapter` | `ChapterInfo` | Current chapter data |
| `margins` | `Margins` | Margin measurements in current unit |
| `dimensions` | `Dimensions` | Page dimensions |

### Example: Different Headers for Left/Right

```tsx
export const RunningHeader = () => {
  const { isLeftPage, chapter } = usePageConfig();
  
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      {isLeftPage ? (
        <span>{chapter.title}</span>
      ) : (
        <span>{chapter.bookTitle}</span>
      )}
    </div>
  );
};
```

## Headers and Footers

Add consistent headers and footers to pages:

```tsx
<Page
  header={<RunningHeader />}
  footer={
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <PageNumber />
      <span>My Book</span>
    </div>
  }
>
  {/* Content */}
</Page>
```

### Automatic Page Numbers

Use the `<PageNumber />` component:

```tsx
import { PageNumber } from '@bookmotion/core';

<Page footer={<PageNumber />} />
```

Options:
```tsx
<PageNumber format="arabic" />     // 1, 2, 3...
<PageNumber format="roman" />      // i, ii, iii...
<PageNumber format="Roman" />      // I, II, III...
<PageNumber startAt={5} />         // Start from 5
<PageNumber hideOnFirst />         // No number on page 1
```

### Running Headers

Headers that change based on chapter:

```tsx
const RunningHeader = () => {
  const { isLeftPage, chapter } = usePageConfig();
  
  return (
    <div
      style={{
        fontStyle: 'italic',
        borderBottom: '1pt solid #ccc',
        paddingBottom: '0.25in',
      }}
    >
      {isLeftPage ? chapter.title : 'My Book'}
    </div>
  );
};
```

## Backgrounds

### Solid Color

```tsx
<Page backgroundColor="#f5f5f5">
  {/* Content */}
</Page>
```

### Gradient

```tsx
<Page
  style={{
    background: 'linear-gradient(to bottom, #fff, #f0f0f0)',
  }}
>
  {/* Content */}
</Page>
```

### Image Background

```tsx
<Page layout="full-bleed">
  <img
    src={staticFile('background.jpg')}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      zIndex: -1,
    }}
  />
  {/* Content on top */}
</Page>
```

## Page Transitions (for Web Output)

When rendering to web format, you can add page-turn animations:

```tsx
<Page
  transition={{
    type: 'flip',
    duration: 0.5,
    direction: 'right',  // or 'left'
  }}
>
  {/* Content */}
</Page>
```

## Common Patterns

### Blank Pages

Intentionally blank pages (often on the back of chapter starts):

```tsx
export const BlankPage = () => (
  <Page layout="margins">
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontStyle: 'italic',
        color: '#999',
      }}
    >
      This page intentionally left blank
    </div>
  </Page>
);
```

### Copyright Page

Standard copyright page layout:

```tsx
export const CopyrightPage = () => (
  <Page layout="margins">
    <div style={{ marginTop: '2in' }}>
      <p>© 2025 Your Name. All rights reserved.</p>
      <p>ISBN: 978-3-16-148410-0</p>
      <p>First Edition: January 2025</p>
      <p style={{ marginTop: '1in', fontSize: '9pt' }}>
        No part of this publication may be reproduced...
      </p>
    </div>
  </Page>
);
```

### Dedication Page

Centered dedication:

```tsx
export const DedicationPage = () => (
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
      <p style={{ fontStyle: 'italic' }}>
        For my family, who always believed.
      </p>
    </div>
  </Page>
);
```

### Chapter Opening Pages

Special first page of each chapter:

```tsx
export const ChapterOpening = () => {
  const { chapter } = usePageConfig();
  
  return (
    <Page layout="margins" footer={null}>
      <div style={{ marginTop: '3in' }}>
        <h1
          style={{
            fontSize: '48pt',
            marginBottom: '0.5in',
          }}
        >
          Chapter {chapter.number}
        </h1>
        <h2
          style={{
            fontSize: '24pt',
            fontStyle: 'italic',
          }}
        >
          {chapter.title}
        </h2>
      </div>
    </Page>
  );
};
```

## Page Size Reference

Common book dimensions:

| Format | Dimensions (in) | Dimensions (mm) | Use Case |
|--------|-----------------|-----------------|----------|
| US Letter | 8.5 × 11 | 216 × 279 | Textbooks, workbooks |
| US Trade | 6 × 9 | 152 × 229 | Novels, non-fiction |
| US Digest | 5.5 × 8.5 | 140 × 216 | Paperbacks |
| US Square | 8 × 8 | 203 × 203 | Children's books |
| A4 | 8.27 × 11.69 | 210 × 297 | International |
| A5 | 5.83 × 8.27 | 148 × 210 | Novels, journals |
| Square Small | 6 × 6 | 152 × 152 | Board books |
| Square Large | 10 × 10 | 254 × 254 | Picture books |

Set in `book.config.ts`:

```ts
export const config: BookConfig = {
  dimensions: {
    width: 6,
    height: 9,
    unit: 'in',
  },
  // ...
};
```

## Best Practices

1. **Always use `<Page>`** - Don't use plain `<div>` for pages. The Page component handles margins, headers, footers, and pagination.

2. **Choose appropriate layouts** - Use `full-bleed` for illustrations, `margins` for text.

3. **Consider binding** - The `inner` margin should be larger than `outer` to account for the binding/gutter.

4. **Test with bleed** - If printing, preview with "Show Bleed" overlay to ensure full-bleed images extend far enough.

5. **Use hooks for dynamic content** - `usePageConfig()` provides page context for headers, footers, and conditional layouts.

6. **Keep headers/footers consistent** - Use the same component across pages for professional appearance.

7. **Preview in spread view** - Always check how left and right pages look together.

## Troubleshooting

### Content bleeding into margins

Use `layout="margins"` or wrap content in a container with padding:

```tsx
<Page>
  <div style={{ padding: '0.5in' }}>
    {/* Content stays within safe area */}
  </div>
</Page>
```

### Headers/footers not showing

Make sure you're passing them as props:

```tsx
// ✅ Correct
<Page header={<Header />} footer={<Footer />} />

// ❌ Wrong - place inside children
<Page>
  <Header /> {/* Won't be treated as header */}
</Page>
```

### Page numbers wrong

Check that all content is wrapped in `<Page>`:

```tsx
// ✅ Correct
<Book>
  <Page>{/* content */}</Page>
  <Page>{/* content */}</Page>
</Book>

// ❌ Wrong - plain content affects pagination
<Book>
  <Page>{/* content */}</Page>
  <div>{/* This breaks page counting */}</div>
  <Page>{/* content */}</Page>
</Book>
```

---

For layout templates and custom layouts, see [layouts.md](layouts.md).
