---
name: book-studio
description: "Agora Book Studio - Create books programmatically with React. Like Remotion for books. Generate children's books, cookbooks, puzzle books, journals, and novels with editable React components. Export to PDF, EPUB, web, or print-ready formats. Agora system skill for book publishing."
metadata:
  tags: book, publishing, layout, react, pdf, epub, print, agora
---

# Bookmotion - Book Creator

> **Create books programmatically with React.**
>
> Like Remotion for books - design pages as React components, preview in a dev server, render to PDF, EPUB, web, or print-ready formats.

## When to Use This Skill

Use this skill when you want to:
- Create a **children's picture book** with illustrations and text
- Build a **cookbook** with recipe cards and ingredient lists
- Design a **puzzle book** with crosswords, sudoku, or word searches
- Make a **journal or planner** with dated pages and trackers
- Publish a **novel or text book** with proper typography
- Create a **photo book**, **comic book**, or **portfolio**
- Generate any **print-ready book** programmatically

## Architecture Overview

The skill has 3 packages:
- `packages/core` (`@bookmotion/core`) - Core components, hooks, themes, data model, PDF export, KDP utilities
- `packages/create-book` - CLI scaffolder with 9 templates
- `demo/` - Example projects (children's book, agora-almanac)

**Two authoring modes:**
1. **React Components** — Write pages as TSX components (traditional, full control)
2. **JSON Data Model** — Define books as `BookData` JSON → rendered via `BookDataRenderer` (AI-friendly, editable)

**CRITICAL**: When creating a new book project, copy the component files from an existing demo project's `src/components/` directory (Book.tsx, Page.tsx, Chapter.tsx, BookViewer.tsx) and `src/types.ts`. These are the working local copies with all bug fixes applied.

## Quick Start

### 1. Create a New Book Project

Create a new directory with this structure:

```
my-book/
  book.config.ts       # Book dimensions and metadata
  index.html           # Vite entry point
  package.json         # Dependencies
  tsconfig.json        # TypeScript config
  vite.config.ts       # Vite config
  src/
    index.tsx          # React entry point
    Root.tsx            # Book content (pages)
    types.ts            # Type definitions
    components/
      Book.tsx          # Book context provider
      Page.tsx          # Page component (MUST have .book-page class)
      Chapter.tsx       # Chapter wrapper
      BookViewer.tsx    # Navigation + page flip viewer
```

### 2. Start the Dev Server

```bash
cd my-book
npm install
npm run dev
```

### 3. Edit Your Book

Open `src/Root.tsx` and customize your book.

## Core Pattern: BookViewer + Page

**IMPORTANT**: Always use `<BookViewer>` as the root component, NOT `<Book>`. The `BookViewer` provides navigation (prev/next, keyboard, thumbnails) and viewing modes (slide, scroll, flip). The `Book` component is just a context provider with no navigation.

```tsx
import { BookViewer } from './components/BookViewer';
import { Page } from './components/Page';
import { Chapter } from './components/Chapter';
import { config } from '../book.config';

export const Root = () => (
  <BookViewer config={config} mode="slide">
    <CoverPage />
    <TitlePage />
    <Chapter title="Chapter 1" number={1}>
      <StoryPage text="Once upon a time..." />
      <StoryPage text="The adventure continues..." />
    </Chapter>
    <BackCoverPage />
  </BookViewer>
);
```

### BookViewer Props

```tsx
interface BookViewerProps {
  config: BookConfig;           // Book dimensions and metadata
  children: React.ReactNode;    // Page components
  mode?: 'slide' | 'scroll' | 'flip';  // Default: 'slide'
  showToolbar?: boolean;        // Default: true
  showThumbnails?: boolean;     // Default: true
  flipDuration?: number;        // Default: 800ms (for flip mode)
  showCover?: boolean;          // Default: true (for flip mode)
  drawShadow?: boolean;         // Default: true (for flip mode)
  maxShadowOpacity?: number;    // Default: 0.5
  keyboardNavigation?: boolean; // Default: true (arrow keys, Home/End)
  onPageChange?: (pageIndex: number) => void;
  className?: string;
  style?: React.CSSProperties;
}
```

**Viewing modes:**
- `slide` - Shows one page at a time with prev/next navigation (recommended default)
- `scroll` - Shows all pages in a scrollable container
- `flip` - Realistic page-flip animation using react-pageflip

### Page Component

Every page MUST use the `<Page>` component. It adds the `.book-page` CSS class which is **critical** for BookViewer to discover pages via DOM querying.

```tsx
const MyPage = () => (
  <Page layout="full-bleed" density="hard">
    <div style={{ /* your page content */ }}>
      Hello World
    </div>
  </Page>
);
```

**Page props:**
- `layout` - `"full-bleed"` | `"margins"` | `"two-column"` | `"text-only"` | `"cover"`
- `density` - `"hard"` | `"soft"` (for flip mode: hard = rigid cover pages, soft = bendy pages)
- `header` - Optional header React node
- `footer` - Optional footer React node
- `backgroundColor` - Optional background color

### Chapter Component

Group pages into logical sections:

```tsx
<Chapter title="The Beginning" number={1}>
  <StoryPage text="..." />
  <StoryPage text="..." />
</Chapter>
```

### Book Config

Define in `book.config.ts`:

```ts
import type { BookConfig } from './src/types';

export const config: BookConfig = {
  title: "My Book",
  author: "Author Name",
  dimensions: { width: 8.5, height: 11, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  bleed: 0.125,
  dpi: 300,
};
```

**Common dimensions:**
- Children's book: `{ width: 8.5, height: 8.5, unit: 'in' }` (square)
- Novel: `{ width: 6, height: 9, unit: 'in' }`
- Cookbook: `{ width: 8, height: 10, unit: 'in' }`
- Photo book: `{ width: 12, height: 12, unit: 'in' }` (square)
- Comic book: `{ width: 6.625, height: 10.25, unit: 'in' }`
- Portfolio: `{ width: 8.5, height: 11, unit: 'in' }` (letter)
- Landscape showcase: `{ width: 9, height: 7, unit: 'in' }`

## Creating Page Components

Pages are defined as wrapper components that render `<Page>` inside their function body:

```tsx
// Cover page with full-bleed gradient
const CoverPage = () => (
  <Page layout="full-bleed" density="hard">
    <div style={{
      position: 'absolute', top: '-0.125in', left: '-0.125in',
      width: 'calc(100% + 0.25in)', height: 'calc(100% + 0.25in)',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: 'white', textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '48pt' }}>{config.title}</h1>
      <p style={{ fontSize: '20pt' }}>By {config.author}</p>
    </div>
  </Page>
);

// Content page within margins
const TextPage = ({ title, content }: { title: string; content: string }) => (
  <Page layout="margins">
    <h2 style={{ fontSize: '24pt', marginBottom: '0.5in' }}>{title}</h2>
    <p style={{ fontSize: '12pt', lineHeight: 1.6 }}>{content}</p>
  </Page>
);
```

### Full-Bleed Pattern

For pages that extend to the trim edge (covers, photo pages), use this pattern:

```tsx
<Page layout="full-bleed">
  <div style={{
    position: 'absolute',
    top: '-0.125in',      // Extend into bleed area
    left: '-0.125in',
    width: 'calc(100% + 0.25in)',
    height: 'calc(100% + 0.25in)',
    backgroundColor: '#1a1a2e',
  }}>
    {/* Content */}
  </div>
</Page>
```

## Dependencies

Every book project needs these in `package.json`:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-pageflip": "^2.0.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^4.4.0"
  }
}
```

## Critical Gotchas

### 1. ALWAYS use BookViewer, NOT Book

`<Book>` only provides context. `<BookViewer>` provides navigation, toolbar, keyboard shortcuts, and viewing modes. If you use `<Book>`, pages render but there's no way to navigate between them.

```tsx
// WRONG - no navigation
<Book config={config}>
  <MyPage />
</Book>

// CORRECT - full navigation UI
<BookViewer config={config} mode="slide">
  <MyPage />
</BookViewer>
```

### 2. Page Discovery is DOM-Based

BookViewer discovers pages by querying the DOM for `.book-page` elements after React renders. This means:
- Every page MUST use the `<Page>` component (which adds `.book-page` class)
- Pages can be wrapped in any component hierarchy (custom components, Chapters, etc.)
- There's a 150ms delay after render before pages are discovered

**DO NOT** try to walk the React element tree to find pages. React element tree walking cannot see inside function components — `child.type` is the wrapper function, not `Page`, and `child.props.children` is undefined since `<Page>` is rendered inside the function body.

### 3. react-pageflip Import

When importing react-pageflip dynamically, use `mod.default`:

```tsx
import('react-pageflip')
  .then((mod) => setHTMLFlipBook(() => mod.default));
```

### 4. Copy Components from Existing Demo

When creating a new book project, copy the working component files from `demo/agora-almanac/src/components/` or `demo/my-childrens-book/src/components/`. These local copies have all bug fixes applied. The files you need:
- `Book.tsx` - Context providers
- `Page.tsx` - Page component with `.book-page` class
- `Chapter.tsx` - Chapter wrapper
- `BookViewer.tsx` - Navigation and viewer component
- Also copy `types.ts` from `src/types.ts`

### 5. Cover Pages Need density="hard"

For realistic page-flip animation, first and last pages should have `density="hard"` so they flip rigidly like actual book covers:

```tsx
<Page layout="full-bleed" density="hard">  {/* Cover - rigid */}
<Page layout="margins">                     {/* Interior - soft/bendy */}
```

### 6. Default to mode="slide"

The `slide` mode is the most reliable and works immediately. The `flip` mode requires react-pageflip to be loaded and has a slight delay for DOM cloning. Use `slide` as default and let users switch to `flip` via the toolbar.

## Template Reference

Available templates when scaffolding with `create-book`:

| Template | Description | Dimensions |
|----------|------------|-----------|
| `blank` | Minimal starter | 8.5x11" |
| `children-book` | Picture books with illustrations | 8.5x8.5" square |
| `cookbook` | Recipe cards with ingredients/steps | 8x10" |
| `novel` | Text-heavy with chapters | 6x9" |
| `journal` | Daily/weekly planners | 5.5x8.5" |
| `puzzle-book` | Sudoku, word search, mazes | 8.5x11" |
| `photo-book` | Photo grids and timelines | 12x12" square |
| `comic-book` | Panel grids with speech bubbles | 6.625x10.25" |
| `portfolio` | Project spreads and galleries | 8.5x11" |

## Theme System

Books support themes via `BookTheme`:

```tsx
import { useBookTheme, useThemeColors } from '@bookmotion/core';

const MyPage = () => {
  const { colors, fonts } = useBookTheme();
  return (
    <Page layout="margins">
      <h1 style={{ color: colors.primary, fontFamily: fonts.heading.family }}>
        Themed Title
      </h1>
    </Page>
  );
};
```

Built-in themes: `whimsicalForest`, `oceanAdventure`, `candyPastel`, `rusticKitchen`, `modernMinimalist`, `warmHarvest`, `classicLiterary`, `darkAcademia`, `elegantSerif`, `cleanMonochrome`, `softPastel`, `playfulBright`, `classicPuzzle`, `modernSans`, `boldGraphic`.

## Amazon KDP Publishing

### KDP Trim Size Presets

Use `getKDPPreset(bookType)` or `KDP_TRIM_SIZES` for exact KDP-compatible dimensions:

```ts
import { getKDPPreset, KDP_TRIM_SIZES, getKDPMinimumMargins, validateForKDP } from '@bookmotion/core';

// Get recommended preset for children's books
const preset = getKDPPreset('children-book');
// → { trimSize: 8.5x8.5", bleed: 0.125, colorInterior: true, ... }

// Get minimum margins for a 32-page book
const margins = getKDPMinimumMargins(32, true); // true = has bleed
// → { top: 0.375, bottom: 0.375, inner: 0.375, outer: 0.375 }

// Validate your config against KDP requirements
const validation = validateForKDP({
  dimensions: { width: 8.5, height: 8.5, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 },
  bleed: 0.125,
  pageCount: 32,
});
// → { valid: true, errors: [], warnings: [...], coverDimensions: {...} }
```

**Available book type presets:** `children-book`, `novel`, `cookbook`, `workbook`, `photo-book`, `comic-book`, `non-fiction`, `journal`, `portfolio`

### PDF Export

Export to print-ready PDF using Puppeteer (headless Chrome rendering):

```bash
# 1. Install export dependencies
npm install -D puppeteer pdf-lib

# 2. Start your dev server
npm run dev

# 3. In another terminal, run the export script
npx tsx scripts/export-pdf.ts
```

The export script uses `exportToPDF()`:

```ts
import { exportToPDF } from '@bookmotion/core';
import { config } from '../book.config';

const result = await exportToPDF(config, {
  devServerUrl: 'http://localhost:5173',
  outputPath: 'output/book-interior.pdf',
  dpi: 300,
  generateCover: true,      // Creates cover template PDF
  cropMarks: false,          // Add crop marks for print
  paperType: 'white',        // 'white' or 'cream' (affects spine width)
  onProgress: (current, total, status) => {
    console.log(`[${current}/${total}] ${status}`);
  },
});

// result.interiorPath → 'output/book-interior.pdf'
// result.coverPath → 'output/book-interior-cover.pdf'
// result.kdpValidation → { valid, errors, warnings, coverDimensions }
```

### KDP Cover Dimensions

Cover is a separate flat PDF: front + spine + back. Use `getKDPCoverDimensions()`:

```ts
import { getKDPCoverDimensions } from '@bookmotion/core';

const cover = getKDPCoverDimensions(
  { width: 8.5, height: 8.5, unit: 'in' }, // trim size
  32,       // page count
  'white'   // paper type
);
// → { totalWidth: 17.197", totalHeight: 8.75", spineWidth: 0.072", ... }
```

### Export Dependencies

Add to your book project's `package.json` devDependencies:

```json
{
  "devDependencies": {
    "puppeteer": "^22.0.0",
    "pdf-lib": "^1.17.1",
    "tsx": "^4.0.0"
  }
}
```

## Data-Driven Page Model (AI Generation + Editing)

Bookmotion supports two approaches to creating books:
1. **React Components** (traditional) — Write page components directly in TSX
2. **JSON Data Model** (AI-friendly) — Define books as structured JSON, rendered automatically

The JSON model is preferred for AI-generated books because it's serializable, editable, and supports undo/redo.

### BookData Structure

```
BookData
├── version: 1
├── standalonePages
│   ├── frontMatter: PageData[]  (cover, title, TOC, copyright)
│   └── backMatter: PageData[]   (appendix, back cover)
├── chapters: ChapterData[]
│   └── pages: PageData[]
│       └── blocks: ContentBlock[]  (recursive tree)
└── theme: { fonts, colors }
```

### Defining a Book as JSON

```ts
import { createPage, createChapter, createBlock } from '@bookmotion/core';
import type { BookData, HeadingBlock, ParagraphBlock, ImageBlock } from '@bookmotion/core';

const bookData: BookData = {
  version: 1,
  theme: {
    fonts: { heading: "'Playfair Display', serif", body: "'Inter', sans-serif" },
    colors: { primary: '#7c3aed', text: '#1a1a2e', textMuted: '#6b7280' },
  },
  standalonePages: {
    frontMatter: [
      createPage('cover', [
        createBlock<HeadingBlock>('heading', { text: 'My Book Title', level: 1 }),
        createBlock<ParagraphBlock>('paragraph', { text: 'By Author Name', align: 'center' }),
      ], { density: 'hard', background: 'linear-gradient(135deg, #1a1a2e, #533483)' }),
    ],
    backMatter: [
      createPage('cover', [
        createBlock<ParagraphBlock>('paragraph', { text: 'The End', align: 'center' }),
      ], { density: 'hard', background: '#1a1a2e' }),
    ],
  },
  chapters: [
    createChapter('The Beginning', [
      createPage('margins', [
        createBlock<HeadingBlock>('heading', { text: 'Chapter 1: The Beginning', level: 2 }),
        createBlock<ParagraphBlock>('paragraph', { text: 'Once upon a time...', dropCap: true }),
        createBlock<ImageBlock>('image', {
          src: '/illustrations/forest.png',
          alt: 'A magical forest',
          fit: 'cover',
          height: '3in',
          borderRadius: '8px',
          aiPrompt: 'A whimsical watercolor forest with tall trees and dappled sunlight',
        }),
      ]),
    ]),
  ],
};
```

### Available Block Types

| Type | Purpose | Key Props |
|------|---------|-----------|
| `heading` | Titles (h1-h6) | `text`, `level` |
| `paragraph` | Body text | `text`, `dropCap`, `align` |
| `blockquote` | Quoted text | `text`, `citation` |
| `list` | Bulleted/numbered lists | `items[]`, `ordered` |
| `code` | Code snippets | `code`, `language`, `filename` |
| `image` | Single image | `src`, `alt`, `fit`, `caption`, `aiPrompt` |
| `image-grid` | Multiple images | `images[]`, `columns` |
| `illustration` | Full-page artwork | `src`, `fullBleed`, `textOverlay`, `aiPrompt` |
| `columns` | Multi-column layout | `widths[]`, `children[]` |
| `grid` | Grid layout | `columns`, `children[]` |
| `box` | Styled container | `backgroundColor`, `children[]` |
| `table` | Data table | `headers[]`, `rows[][]` |
| `chart` | Bar/pie/line chart | `data[]`, `chartType` |
| `stat-card` | Stat callout | `label`, `value`, `icon` |
| `toc-entry` | TOC line | `number`, `title`, `page` |
| `recipe-card` | Recipe layout | `ingredients[]`, `steps[]`, `image` |
| `divider` | Visual separator | `variant: line/dots/stars/ornament` |
| `spacer` | Vertical space | `height` |

### Rendering JSON Data

```tsx
import { BookDataRenderer, useBookEditor } from '@bookmotion/core';

const MyBook = ({ config, initialData }) => {
  const editor = useBookEditor(initialData);

  return (
    <>
      <div>
        <button onClick={editor.toggleEdit}>
          {editor.isEditing ? '✓ Preview' : '✏️ Edit'}
        </button>
        <button onClick={editor.undo} disabled={!editor.canUndo}>Undo</button>
        <button onClick={editor.redo} disabled={!editor.canRedo}>Redo</button>
      </div>

      <BookDataRenderer
        config={config}
        data={editor.bookData}
        editable={editor.isEditing}
        onDataChange={editor.updateData}
        selectedBlockId={editor.selectedBlockId}
        onBlockSelect={editor.selectBlock}
        onImageReplace={editor.requestImageReplace}
      />
    </>
  );
};
```

### Editor Features

The `useBookEditor` hook provides:
- **Edit mode toggle** — Switch between preview and editing
- **Inline text editing** — Click any text block to edit via `contentEditable`
- **Image replacement** — Click "Replace" button on images to swap them
- **Block selection** — Click blocks to select them (highlighted with outline)
- **Undo/redo** — Up to 50 states with `Ctrl+Z` / `Ctrl+Shift+Z`
- **Dirty flag** — Track unsaved changes

### AI Book Generation Pattern

When an AI agent generates a book, it should:
1. Create a `BookData` JSON object with chapters and pages
2. Use `createBlock()`, `createPage()`, `createChapter()` helpers for unique IDs
3. Include `aiPrompt` on image blocks for regeneration
4. Store the JSON to disk (for persistence) and render via `BookDataRenderer`
5. The user can then edit text/images inline and export to PDF

```ts
// AI generates this JSON:
const bookData: BookData = {
  version: 1,
  theme: { fonts: { heading: "'Lora', serif", body: "'Source Sans 3', sans-serif" } },
  chapters: [
    createChapter('The Enchanted Forest', [
      createPage('full-bleed', [
        createBlock('illustration', {
          src: '/images/forest-scene.png',
          alt: 'An enchanted forest',
          fullBleed: true,
          textOverlay: { text: 'Chapter 1', position: 'bottom', color: 'white' },
          aiPrompt: 'Lush enchanted forest with glowing mushrooms, style: children\'s book watercolor',
          aiModel: 'dall-e-3',
        }),
      ]),
      createPage('margins', [
        createBlock('paragraph', {
          text: 'Deep in the heart of the Whispering Woods...',
          dropCap: true,
        }),
      ]),
    ]),
  ],
};

// Save to file
fs.writeFileSync('book-data.json', JSON.stringify(bookData, null, 2));
```

## Project Setup Checklist

When creating a new book project from scratch:

1. Create project directory structure (see Quick Start)
2. Copy component files from `demo/agora-almanac/src/components/` (Book.tsx, Page.tsx, Chapter.tsx, BookViewer.tsx)
3. Copy `src/types.ts` from the same demo
4. Create `book.config.ts` with dimensions for your book type
5. Create `src/Root.tsx` using `<BookViewer>` as root with `<Page>` components inside
6. Set up `package.json` with react, react-dom, react-pageflip, vite, typescript
7. Create `index.html`, `vite.config.ts`, `tsconfig.json` (standard Vite + React setup)
8. Run `npm install && npm run dev`

## Best Practices

1. **Use `<BookViewer>` as root** - Never use `<Book>` directly; it has no navigation
2. **Every page uses `<Page>`** - The `.book-page` class is how BookViewer finds pages
3. **Use `density="hard"` for covers** - Makes flip animation realistic
4. **Default to `mode="slide"`** - Most reliable; users can switch via toolbar
5. **Use full-bleed pattern for covers** - Extend into the 0.125" bleed area
6. **Organize with `<Chapter>`** - Helps with TOC and running headers
7. **Place assets in `public/`** - Reference with `staticFile()` helper
8. **Test in the browser** - Run `npm run dev` and check all pages frequently

---

**Bookmotion** - Programmatic books, powered by React.
