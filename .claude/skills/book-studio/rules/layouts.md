---
name: book-layouts
description: Layout templates and custom layout creation for Bookmotion pages
metadata:
  tags: book, layout, templates, grid, design
---

# Layouts in Bookmotion

Layouts define the structure and arrangement of content on your pages. Bookmotion provides built-in layouts and the ability to create custom ones.

## Built-in Layouts

### `margins` (default)

Content stays within the safe margins. Best for text-heavy pages.

```tsx
<Page layout="margins">
  <h1>Chapter Title</h1>
  <p>Your text content...</p>
</Page>
```

**CSS Grid applied:**
```
┌─────────────────────────────────────────┐
│                                         │
│    ┌───────────────────────────────┐    │
│    │                               │    │
│    │        CONTENT AREA           │    │
│    │        (within margins)       │    │
│    │                               │    │
│    └───────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### `full-bleed`

Content extends to the trim edge. Best for illustrations, photos, and covers.

```tsx
<Page layout="full-bleed">
  <img 
    src={staticFile('illustration.jpg')} 
    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
  />
</Page>
```

**Note:** Images should extend into the bleed area to be trimmed cleanly.

### `text-only`

Optimized for text with generous margins and no header/footer by default.

```tsx
<Page layout="text-only">
  <BodyText content={chapterText} />
</Page>
```

### `two-column`

Side-by-side text columns for wide pages or reference material.

```tsx
<Page layout="two-column">
  <TwoColumnContent 
    left={<Column1 />}
    right={<Column2 />}
  />
</Page>
```

**Grid:**
```
┌─────────────────────────────────────────┐
│                                         │
│    ┌─────────────┐ ┌─────────────┐     │
│    │             │ │             │     │
│    │   COLUMN 1  │ │   COLUMN 2  │     │
│    │             │ │             │     │
│    └─────────────┘ └─────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

### `recipe`

Cookbook layout with ingredients and method split.

```tsx
<Page layout="recipe">
  <RecipeLayout
    header={<RecipeTitle />}
    ingredients={<IngredientList />}
    method={<CookingSteps />}
  />
</Page>
```

**Layout:**
```
┌─────────────────────────────────────────┐
│         RECIPE TITLE                    │
├─────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ │
│ │   INGREDIENTS   │ │     METHOD      │ │
│ │   • Item 1      │ │   1. Step one   │ │
│ │   • Item 2      │ │   2. Step two   │ │
│ │                 │ │                 │ │
│ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────┘
```

### `puzzle`

Centered puzzle grid with surrounding space.

```tsx
<Page layout="puzzle">
  <PuzzleLayout
    title="Sudoku"
    difficulty="Medium"
    grid={<SudokuGrid />}
    instructions={
      <p>Fill in numbers 1-9...</p>
    }
  />
</Page>
```

### `cover`

Special layout for front/back covers with spine consideration.

```tsx
<Page layout="cover" cover="front">
  <CoverTitle />
  <CoverImage />
</Page>
```

## Custom Layouts

Create custom layouts for specialized page designs.

### Layout Definition

A layout is a React component that receives children and context:

```tsx
// src/layouts/ThreeColumn.tsx
import React from 'react';
import { usePageConfig, PageMargins } from '@bookmotion/core';

interface ThreeColumnLayoutProps {
  children: [React.ReactNode, React.ReactNode, React.ReactNode];
  gap?: string;
}

export const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
  children,
  gap = '0.25in',
}) => {
  const { margins } = usePageConfig();
  
  const [left, center, right] = children;
  
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap,
        height: '100%',
        padding: `${margins.top}in ${margins.outer}in`,
      }}
    >
      <div>{left}</div>
      <div>{center}</div>
      <div>{right}</div>
    </div>
  );
};
```

### Register Custom Layout

Register in `book.config.ts`:

```ts
import { ThreeColumnLayout } from './layouts/ThreeColumn';

export const config: BookConfig = {
  // ... other config
  customLayouts: {
    'three-column': ThreeColumnLayout,
  },
};
```

### Use Custom Layout

```tsx
<Page layout="three-column">
  <LeftContent />
  <CenterContent />
  <RightContent />
</Page>
```

## Layout Components

### Grid Layout

CSS Grid-based layout:

```tsx
import { Grid } from '@bookmotion/core';

<Grid
  columns={3}
  gap="0.25in"
  rows="auto"
>
  <Item />
  <Item />
  <Item />
</Grid>
```

### Masonry Layout

For uneven image grids:

```tsx
import { Masonry } from '@bookmotion/core';

<Masonry
  columns={2}
  gap="0.125in"
>
  <img src={photo1} />
  <img src={photo2} />
  <img src={photo3} />
</Masonry>
```

### Split Layout

Vertical or horizontal split:

```tsx
import { Split } from '@bookmotion/core';

// Horizontal split (top/bottom)
<Split direction="horizontal" ratio={0.6}>
  <TopContent />
  <BottomContent />
</Split>

// Vertical split (left/right)
<Split direction="vertical" ratio={0.5}>
  <LeftContent />
  <RightContent />
</Split>
```

## Common Layout Patterns

### Hero + Text

Large image at top, text below:

```tsx
export const HeroPage = () => (
  <Page layout="margins">
    <div style={{ height: '60%' }}>
      <FullBleedImage src="hero.jpg" />
    </div>
    <div style={{ marginTop: '0.5in' }}>
      <h1>Chapter Title</h1>
      <p>Body text...</p>
    </div>
  </Page>
);
```

### Sidebar Layout

Main content with sidebar:

```tsx
export const SidebarPage = () => (
  <Page layout="margins">
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 0.3fr',
        gap: '0.5in',
      }}
    >
      <main>
        <p>Main content...</p>
      </main>
      <aside
        style={{
          borderLeft: '1pt solid #ccc',
          paddingLeft: '0.25in',
          fontSize: '9pt',
        }}
      >
        <h4>Notes</h4>
        <p>Sidebar content...</p>
      </aside>
    </div>
  </Page>
);
```

### Photo Grid

Multiple photos in a grid:

```tsx
export const PhotoGridPage = () => (
  <Page layout="margins">
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: '0.125in',
        height: '100%',
      }}
    >
      <img src={photo1} style={{ objectFit: 'cover' }} />
      <img src={photo2} style={{ objectFit: 'cover' }} />
      <img src={photo3} style={{ objectFit: 'cover' }} />
      <img src={photo4} style={{ objectFit: 'cover' }} />
    </div>
  </Page>
);
```

### Caption Layout

Image with caption:

```tsx
export const CaptionedImage = ({ src, caption }) => (
  <figure style={{ margin: 0 }}>
    <img src={src} style={{ width: '100%' }} />
    <figcaption
      style={{
        fontSize: '9pt',
        fontStyle: 'italic',
        color: '#666',
        marginTop: '0.125in',
      }}
    >
      {caption}
    </figcaption>
  </figure>
);
```

### Pull Quote Layout

Text with large quote:

```tsx
export const PullQuotePage = () => (
  <Page layout="margins">
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 0.4fr',
        gap: '0.5in',
      }}
    >
      <div>
        <p>Main paragraph text...</p>
      </div>
      <blockquote
        style={{
          fontSize: '18pt',
          fontStyle: 'italic',
          borderLeft: '3pt solid #333',
          paddingLeft: '0.25in',
          margin: 0,
        }}
      >
        "The pull quote goes here"
      </blockquote>
    </div>
  </Page>
);
```

## Responsive Layouts

Different layouts for different output formats:

```tsx
import { useOutputFormat } from '@bookmotion/core';

export const ResponsivePage = () => {
  const format = useOutputFormat(); // 'pdf' | 'epub' | 'web' | 'print'
  
  return (
    <Page layout={format === 'epub' ? 'text-only' : 'margins'}>
      {format === 'web' ? (
        <WebOptimizedContent />
      ) : (
        <PrintOptimizedContent />
      )}
    </Page>
  );
};
```

## Layout Utilities

### Spacer

Add consistent spacing:

```tsx
import { Spacer } from '@bookmotion/core';

<Spacer height="0.5in" />
<Spacer height="1rem" />
```

### Divider

Horizontal or vertical line:

```tsx
import { Divider } from '@bookmotion/core';

<Divider />
<Divider type="dashed" />
<Divider type="double" />
```

### Box

Container with padding:

```tsx
import { Box } from '@bookmotion/core';

<Box padding="0.5in" backgroundColor="#f5f5f5">
  <p>Content in a box</p>
</Box>
```

## Layout Best Practices

1. **Use built-in layouts first** - They're optimized for books
2. **Respect margins** - Keep critical content within safe margins
3. **Consider binding** - Inner margins need more space
4. **Test all formats** - EPUB and web may need different layouts
5. **Use grid for complex layouts** - CSS Grid is powerful for book layouts
6. **Keep it simple** - Clean layouts are more readable
7. **Preview in spread view** - Check how facing pages look together
8. **Use consistent spacing** - Define spacing units and stick to them

## Layout Examples by Book Type

### Children's Book Spread

```tsx
// Left page (even)
<Page layout="full-bleed">
  <FullBleedImage src="spread-left.jpg" />
</Page>

// Right page (odd)
<Page layout="margins">
  <div style={{ marginTop: '40%' }}>
    <p style={{ fontSize: '24pt' }}>
      "And then the adventure began..."
    </p>
  </div>
</Page>
```

### Cookbook Recipe

```tsx
<Page layout="recipe">
  <RecipeLayout
    photo={<RecipePhoto src="dish.jpg" />}
    title={<h1>Pasta Carbonara</h1>}
    meta={
      <div style={{ display: 'flex', gap: '1rem' }}>
        <span>Prep: 15 min</span>
        <span>Cook: 20 min</span>
        <span>Serves: 4</span>
      </div>
    }
    ingredients={
      <ul>
        <li>400g spaghetti</li>
        <li>200g pancetta</li>
        <li>4 egg yolks</li>
      </ul>
    }
    method={
      <ol>
        <li>Boil pasta</li>
        <li>Cook pancetta</li>
        <li>Mix eggs and cheese</li>
      </ol>
    }
  />
</Page>
```

### Journal Daily Page

```tsx
<Page layout="margins">
  <div style={{ 
    display: 'grid',
    gridTemplateRows: 'auto 1fr 1fr 1fr',
    gap: '0.25in',
    height: '100%',
  }}>
    <div>
      <h2>Monday, January 15</h2>
    </div>
    <Box title="Gratitude" backgroundColor="#fef3c7" />
    <Box title="Focus" backgroundColor="#dbeafe" />
    <Box title="Notes" backgroundColor="#f3f4f6" />
  </div>
</Page>
```

---

See [pages.md](pages.md) for using layouts with the Page component.
