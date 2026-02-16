---
name: book-getting-started
description: Getting started with Bookmotion - installation, first book, and basic concepts
metadata:
  tags: book, getting-started, tutorial, installation
---

# Getting Started with Bookmotion

This guide walks you through creating your first book with Bookmotion.

## Prerequisites

- **Node.js** 18 or higher
- **npm**, **yarn**, **pnpm**, or **bun**

## Installation

### 1. Scaffold a New Book

Use the `create-book` CLI tool to scaffold a new project:

```bash
npx create-book@latest
```

Or with other package managers:

```bash
npm create book
yarn create book
pnpm create book
bun create book
```

### 2. Choose Your Template

The CLI will prompt you to select a template:

| Template | Description | Best For |
|----------|-------------|----------|
| `children-book` | Picture book with full-bleed illustrations | Children's books, picture books |
| `cookbook` | Recipe cards with ingredients and steps | Cookbooks, recipe collections |
| `puzzle-book` | Activity pages with games and puzzles | Puzzle books, activity books |
| `journal` | Dated pages with prompts and trackers | Journals, planners, diaries |
| `novel` | Text-focused with chapters | Novels, textbooks, non-fiction |
| `blank` | Minimal starter | Custom book types |

### 3. Enter Project Details

```bash
? Project name: my-first-book
? Template: children-book
? Package manager: npm
? Install dependencies: Yes
```

### 4. Start the Dev Server

```bash
cd my-first-book
npm run dev
```

This starts the **Book Studio** - a development preview interface at `http://localhost:3000`.

## Book Studio Interface

The Book Studio provides several preview modes:

### Single Page View
View one page at a time. Use arrow keys or on-screen buttons to navigate.

### Spread View (default)
See left and right pages side-by-side, like an open book. This is the most useful view for checking layouts.

### Grid View
Thumbnail view of all pages. Good for overview and quick navigation.

### Inspector Panel
Click any element to see:
- Component props
- CSS styles
- Page context (page number, margins)

### Grid Overlays
Toggle overlays for:
- **Margins** - Safe content area
- **Bleed** - Extra space beyond trim edge
- **Text Baseline** - Typography alignment
- **Column Grid** - Multi-column layouts

## Your First Book

Let's walk through a simple children's book.

### Project Structure

After scaffolding a `children-book` template:

```
my-first-book/
├── book.config.ts           # Book configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── assets/
│       ├── cover.png
│       ├── page1.png
│       └── page2.png
├── src/
│   ├── index.tsx            # Entry point
│   ├── Root.tsx             # Book root component
│   └── pages/
│       ├── Cover.tsx
│       ├── TitlePage.tsx
│       └── StoryPages.tsx
└── output/                  # Rendered output goes here
```

### 1. Configure Your Book

Open `book.config.ts`:

```typescript
import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  // Book metadata
  title: "The Little Explorer",
  author: "Your Name",
  
  // Page size (inches)
  dimensions: {
    width: 8.5,
    height: 8.5,  // Square format for children's book
    unit: 'in',
  },
  
  // Margins
  margins: {
    top: 0.5,
    bottom: 0.5,
    inner: 0.75,   // Binding edge
    outer: 0.5,
  },
  
  // Print settings
  bleed: 0.125,     // For full-bleed images
  dpi: 300,
  colorSpace: 'CMYK',
};
```

### 2. Create the Root Component

Open `src/Root.tsx`:

```tsx
import { Book, Chapter } from '@bookmotion/core';
import { Cover } from './pages/Cover';
import { TitlePage } from './pages/TitlePage';
import { StoryPage } from './pages/StoryPage';

export const Root = () => {
  return (
    <Book config={config}>
      {/* Front matter */}
      <Cover />
      <TitlePage />
      
      {/* Story chapters */}
      <Chapter title="The Adventure" number={1}>
        <StoryPage 
          illustration="page1.png"
          text="Once upon a time, there was a curious little explorer..."
        />
        <StoryPage 
          illustration="page2.png"
          text="The explorer loved to discover new places and meet new friends."
        />
      </Chapter>
      
      {/* Back matter */}
      <BackCover />
    </Book>
  );
};
```

### 3. Create a Page Component

Open `src/pages/StoryPage.tsx`:

```tsx
import { Page, usePageConfig } from '@bookmotion/core';
import { staticFile } from '@bookmotion/core';

interface StoryPageProps {
  illustration: string;
  text: string;
}

export const StoryPage: React.FC<StoryPageProps> = ({ illustration, text }) => {
  const { pageNumber } = usePageConfig();
  
  return (
    <Page layout="full-bleed">
      {/* Full-bleed illustration */}
      <img 
        src={staticFile(`assets/${illustration}`)} 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      
      {/* Text overlay at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '1in',
          left: '0.5in',
          right: '0.5in',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '0.5in',
          borderRadius: '8px',
        }}
      >
        <p
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '18pt',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {text}
        </p>
        <span
          style={{
            position: 'absolute',
            bottom: '0.25in',
            right: '0.25in',
            fontSize: '12pt',
            color: '#666',
          }}
        >
          {pageNumber}
        </span>
      </div>
    </Page>
  );
};
```

### 4. Add Assets

Place your images in `public/assets/`:

```bash
public/
└── assets/
    ├── cover.png
    ├── page1.png
    └── page2.png
```

### 5. Preview in Studio

With `npm run dev` running, open `http://localhost:3000`:

1. You should see your cover page
2. Click the right arrow or press → to go to the next page
3. Toggle "Spread View" to see pages side-by-side
4. Enable "Show Margins" to see the safe content area

### 6. Hot Reload

Try editing `StoryPage.tsx`:
- Change the text color
- Adjust the overlay position
- Modify the font size

The preview updates instantly without refreshing.

## Rendering Your Book

When you're ready to create the final output:

### Render to PDF

```bash
npm run render:pdf
```

Output: `output/book.pdf`

### Render Individual Pages as Images

```bash
npm run render:images
```

Output: `output/pages/page-001.png`, `page-002.png`, etc.

### Render All Formats

```bash
npm run render:all
```

Creates:
- `output/book.pdf`
- `output/book.epub`
- `output/book-web/` (interactive website)
- `output/pages/*.png`

## Next Steps

### Learn Layouts

See [layouts.md](layouts.md) for different page layout options:
- Full-bleed images
- Two-column text
- Recipe cards
- Puzzle grids

### Add Typography

See [typography.md](typography.md) for:
- Google Fonts
- Custom fonts
- Text styling
- Hyphenation

### Work with Images

See [images.md](images.md) for:
- Image optimization
- Bleed handling
- Captions
- Image grids

### Organize with Chapters

See [chapters.md](chapters.md) for:
- Chapter structure
- Running headers
- Table of contents
- Page numbering

## Troubleshooting

### Images not showing

Make sure images are in `public/` folder and referenced with `staticFile()`:

```tsx
// ✅ Correct
import { staticFile } from '@bookmotion/core';
<img src={staticFile('assets/photo.png')} />

// ❌ Wrong
<img src="./assets/photo.png" />
```

### Fonts not loading

For custom fonts, place the font file in `public/fonts/` and load it:

```tsx
import { loadFont } from '@bookmotion/core';

const font = loadFont({
  family: 'MyFont',
  url: staticFile('fonts/MyFont.woff2'),
});
```

### Pages not rendering

Ensure each page is wrapped in `<Page>` component:

```tsx
// ✅ Correct
<Page>
  <Content />
</Page>

// ❌ Wrong - plain div won't have margins/headers
<div>
  <Content />
</div>
```

### Studio not loading

Check that:
- Port 3000 is not in use
- Dependencies are installed (`npm install`)
- No TypeScript errors in console

## Example Projects

Explore the starter templates in `templates/`:

```bash
# Copy a starter and modify it
cp -r templates/cookbook-starter my-cookbook
cd my-cookbook
npm install
npm run dev
```

---

**Happy book making!** 📚
