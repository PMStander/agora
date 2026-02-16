---
name: book-config
description: Book configuration reference - dimensions, margins, output settings, and all configuration options
metadata:
  tags: book, configuration, settings, reference
---

# Book Configuration Reference

This guide covers all configuration options for your book in `book.config.ts`.

## Basic Configuration

Every book needs a `book.config.ts` file in the project root:

```typescript
import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  // Required settings
  title: "My Book",
  author: "Your Name",
  dimensions: { width: 6, height: 9, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  
  // Optional settings
  bleed: 0.125,
  dpi: 300,
  colorSpace: 'CMYK',
};
```

## Configuration Options

### Required Fields

#### `title`
- **Type:** `string`
- **Description:** The book title

```ts
title: "The Great Adventure"
```

#### `author`
- **Type:** `string`
- **Description:** Author name(s)

```ts
author: "Jane Doe"
// or
author: "Jane Doe and John Smith"
```

#### `dimensions`
- **Type:** `Dimensions`
- **Description:** Page dimensions

```ts
dimensions: {
  width: 6,      // Number
  height: 9,     // Number
  unit: 'in',    // 'in' | 'mm' | 'cm' | 'px'
}
```

**Common sizes:**

| Format | Width | Height | Unit |
|--------|-------|--------|------|
| US Trade | 6 | 9 | in |
| US Letter | 8.5 | 11 | in |
| US Digest | 5.5 | 8.5 | in |
| Square Small | 8 | 8 | in |
| Square Large | 10 | 10 | in |
| A4 | 210 | 297 | mm |
| A5 | 148 | 210 | mm |

#### `margins`
- **Type:** `Margins`
- **Description:** Page margins

```ts
margins: {
  top: 0.5,      // Top margin
  bottom: 0.5,   // Bottom margin
  inner: 0.75,   // Binding edge (gutter)
  outer: 0.5,    // Outside edge
}
```

**Margin guidelines:**

| Book Type | Top | Bottom | Inner | Outer |
|-----------|-----|--------|-------|-------|
| Novel | 0.75" | 1" | 0.875" | 0.75" |
| Textbook | 0.75" | 1" | 1" | 0.75" |
| Children's | 0.5" | 0.5" | 0.75" | 0.5" |
| Photo book | 0.25" | 0.25" | 0.5" | 0.25" |

### Optional Fields

#### `subtitle`
- **Type:** `string`
- **Description:** Book subtitle

```ts
subtitle: "A Journey Through Time"
```

#### `description`
- **Type:** `string`
- **Description:** Short description for metadata

```ts
description: "An epic tale of adventure and discovery..."
```

#### `language`
- **Type:** `string`
- **Default:** `'en'`
- **Description:** Language code (ISO 639-1)

```ts
language: 'en'  // English
language: 'es'  // Spanish
language: 'fr'  // French
```

#### `isbn`
- **Type:** `string`
- **Description:** ISBN-13 or ISBN-10

```ts
isbn: '978-3-16-148410-0'
```

#### `publisher`
- **Type:** `string`
- **Description:** Publisher name

```ts
publisher: 'My Publishing Co.'
```

#### `publicationDate`
- **Type:** `string` (ISO date)
- **Description:** Publication date

```ts
publicationDate: '2025-01-15'
```

#### `edition`
- **Type:** `string`
- **Description:** Edition information

```ts
edition: 'First Edition'
// or
edition: '2nd Edition, Revised'
```

#### `copyright`
- **Type:** `string`
- **Description:** Copyright notice

```ts
copyright: '© 2025 Your Name. All rights reserved.'
```

#### `keywords`
- **Type:** `string[]`
- **Description:** Keywords for search/discovery

```ts
keywords: ['fiction', 'adventure', 'fantasy', 'young adult']
```

### Print Settings

#### `bleed`
- **Type:** `number`
- **Default:** `0`
- **Description:** Extra area beyond trim edge for full-bleed images

```ts
bleed: 0.125  // 1/8 inch (standard for print)
```

**Visual representation:**
```
┌───────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← Bleed area
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │     (gets trimmed off)
│ ▓▓┌───────────────────────────────┐▓▓ │
│ ▓▓│                               │▓▓ │
│ ▓▓│      CONTENT AREA             │▓▓ │
│ ▓▓│      (final page size)        │▓▓ │
│ ▓▓│                               │▓▓ │
│ ▓▓└───────────────────────────────┘▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└───────────────────────────────────────┘
```

**Standard bleed values:**
- US/Canada: 0.125" (1/8 inch)
- UK/Europe: 3mm
- Japan: 3mm

#### `dpi`
- **Type:** `number`
- **Default:** `300`
- **Description:** Resolution for raster output

```ts
dpi: 300  // Standard print quality
dpi: 150  // Draft/web quality
dpi: 600  // High quality
```

**DPI recommendations:**

| Use Case | DPI | Notes |
|----------|-----|-------|
| Print | 300 | Industry standard |
| Web/PDF | 150 | Faster rendering |
| High-end print | 600 | Photo books |
| Drafts | 72 | Quick previews |

#### `colorSpace`
- **Type:** `'RGB' | 'CMYK'`
- **Default:** `'RGB'`
- **Description:** Color space for print output

```ts
colorSpace: 'RGB'    // For digital/web
colorSpace: 'CMYK'   // For professional print
```

**When to use each:**
- **RGB**: Digital PDFs, EPUB, web output, home printing
- **CMYK**: Offset printing, print-on-demand services (KDP, IngramSpark)

#### `registrationMarks`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Add printer registration marks

```ts
registrationMarks: true  // For professional printing
```

#### `cropMarks`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Add crop/trim marks

```ts
cropMarks: true  // For print-ready PDF
```

### Output Configuration

#### `outputs`
- **Type:** `OutputsConfig`
- **Description:** Output format settings

```ts
outputs: {
  images: {
    format: 'png',      // 'png' | 'jpg'
    quality: 95,        // 1-100 (for jpg)
    dpi: 300,
    colorSpace: 'RGB',
  },
  pdf: {
    pdfA: true,         // PDF/A archival standard
    colorSpace: 'CMYK',
    bleeds: true,
    cropMarks: true,
  },
  epub: {
    version: 3,         // 2 or 3
    reflowable: true,   // true = responsive, false = fixed layout
    toc: true,
    cover: true,
  },
  web: {
    flipAnimation: true,
    zoom: true,
    search: true,
  },
}
```

### Typography Settings

#### `defaultFont`
- **Type:** `FontConfig`
- **Description:** Default font settings

```ts
defaultFont: {
  family: 'Georgia',
  size: 11,           // in points
  lineHeight: 1.5,
}
```

#### `fonts`
- **Type:** `FontConfig[]`
- **Description:** Additional fonts to load

```ts
fonts: [
  {
    family: 'Merriweather',
    weights: ['400', '700'],
    source: 'google',  // 'google' | 'local' | 'url'
  },
  {
    family: 'MyCustomFont',
    source: 'local',
    path: 'fonts/MyCustomFont.woff2',
  },
]
```

### Pagination Settings

#### `pageNumbering`
- **Type:** `PageNumberingConfig`
- **Description:** Page number settings

```ts
pageNumbering: {
  startAt: 1,         // First page number
  format: 'arabic',   // 'arabic' | 'roman' | 'Roman'
  position: 'footer', // 'footer' | 'header' | null
  alignment: 'center', // 'left' | 'center' | 'right' | 'outside'
  skipPages: [1, 2],  // Pages without numbers
}
```

#### `frontMatterRoman`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Use Roman numerals for front matter

```ts
frontMatterRoman: true  // i, ii, iii for intro pages
```

### Chapter Settings

#### `chapters`
- **Type:** `ChaptersConfig`
- **Description:** Chapter behavior

```ts
chapters: {
  startOn: 'right',        // 'left' | 'right' | 'either'
  headerStyle: 'alternating', // 'alternating' | 'chapter' | 'book'
  dropCaps: false,         // First letter styling
  showNumber: true,
  showTitle: true,
}
```

### Advanced Settings

#### `signatures`
- **Type:** `number[]`
- **Description:** Page signature configuration for print binding

```ts
// Standard 32-page signature
signatures: [32]

// Mixed signatures
signatures: [16, 32, 32, 16]
```

#### `imposition`
- **Type:** `ImpositionConfig`
- **Description:** Printer spread imposition settings

```ts
imposition: {
  enabled: false,
  sheetSize: { width: 17, height: 11, unit: 'in' },
  pagesPerSheet: 2,
}
```

## Complete Example Configuration

```typescript
import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  // Metadata
  title: "The Art of Cooking",
  subtitle: "Simple Recipes for Home Chefs",
  author: "Chef Maria Rodriguez",
  description: "A collection of 100 easy-to-follow recipes...",
  
  // Book details
  isbn: '978-3-16-148410-0',
  publisher: 'Culinary Press',
  publicationDate: '2025-03-15',
  edition: 'First Edition',
  copyright: '© 2025 Maria Rodriguez. All rights reserved.',
  language: 'en',
  keywords: ['cooking', 'recipes', 'home cooking', 'food'],
  
  // Dimensions (US Trade 6x9)
  dimensions: {
    width: 6,
    height: 9,
    unit: 'in',
  },
  
  // Margins
  margins: {
    top: 0.75,
    bottom: 1,
    inner: 0.875,
    outer: 0.75,
  },
  
  // Print settings
  bleed: 0.125,
  dpi: 300,
  colorSpace: 'CMYK',
  registrationMarks: true,
  cropMarks: true,
  
  // Typography
  defaultFont: {
    family: 'Merriweather',
    size: 10.5,
    lineHeight: 1.6,
  },
  fonts: [
    {
      family: 'Montserrat',
      weights: ['400', '600', '700'],
      source: 'google',
    },
  ],
  
  // Pagination
  pageNumbering: {
    startAt: 1,
    format: 'arabic',
    position: 'footer',
    alignment: 'outside',
  },
  
  // Chapters
  chapters: {
    startOn: 'right',
    headerStyle: 'alternating',
    showNumber: true,
    showTitle: true,
  },
  
  // Output formats
  outputs: {
    images: {
      format: 'png',
      quality: 95,
      dpi: 300,
      colorSpace: 'RGB',
    },
    pdf: {
      pdfA: true,
      colorSpace: 'CMYK',
      bleeds: true,
      cropMarks: true,
      registrationMarks: true,
    },
    epub: {
      version: 3,
      reflowable: false,  // Fixed layout for cookbook
      toc: true,
      cover: true,
    },
    web: {
      flipAnimation: true,
      zoom: true,
      search: true,
    },
  },
};
```

## Environment-Specific Config

You can use environment variables for different build targets:

```typescript
// book.config.ts
import { BookConfig } from '@bookmotion/core';

const isPrint = process.env.TARGET === 'print';

export const config: BookConfig = {
  title: "My Book",
  author: "Author",
  dimensions: { width: 6, height: 9, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  
  // Conditional settings
  colorSpace: isPrint ? 'CMYK' : 'RGB',
  dpi: isPrint ? 300 : 150,
  bleed: isPrint ? 0.125 : 0,
};
```

Build commands:
```bash
# Digital version
npm run render:pdf

# Print version
TARGET=print npm run render:pdf
```

## TypeScript Types

For advanced use, import the configuration types:

```typescript
import type {
  BookConfig,
  Dimensions,
  Margins,
  FontConfig,
  PageNumberingConfig,
  OutputsConfig,
} from '@bookmotion/core';
```

## Validation

Bookmotion validates your configuration and warns about:
- Margins larger than page dimensions
- Bleed larger than margins
- Invalid color spaces
- Missing required fields
- Unsupported font sources

Run validation manually:
```bash
npx book-motion validate
```

## Best Practices

1. **Use standard sizes** - Stick to industry-standard dimensions when possible
2. **Allow for binding** - Inner margin should be 1.5-2x the outer margin
3. **Consider bleeds** - Always use bleed for full-bleed images, even for digital
4. **Test all outputs** - Configure and test each output format you need
5. **Document choices** - Add comments explaining non-standard settings
6. **Version control** - Keep config in git to track changes
7. **Environment configs** - Use separate configs for print vs digital

## Common Configurations by Book Type

### Novel
```ts
{
  dimensions: { width: 6, height: 9, unit: 'in' },
  margins: { top: 0.75, bottom: 1, inner: 0.875, outer: 0.75 },
  defaultFont: { family: 'Georgia', size: 11, lineHeight: 1.5 },
  colorSpace: 'CMYK',
}
```

### Children's Picture Book
```ts
{
  dimensions: { width: 8, height: 8, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 },
  bleed: 0.125,
  colorSpace: 'CMYK',
}
```

### Cookbook
```ts
{
  dimensions: { width: 7.5, height: 9.25, unit: 'in' },
  margins: { top: 0.75, bottom: 0.75, inner: 1, outer: 0.75 },
  colorSpace: 'CMYK',
  outputs: { epub: { reflowable: false } },
}
```

### Journal
```ts
{
  dimensions: { width: 6, height: 9, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  defaultFont: { family: 'Inter', size: 10, lineHeight: 1.4 },
}
```

---

See [pages.md](pages.md) for using the configured dimensions and margins in your pages.
