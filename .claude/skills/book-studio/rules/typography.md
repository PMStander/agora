---
name: book-typography
description: Typography in Bookmotion - fonts, text styling, web fonts, and text flow
metadata:
  tags: book, typography, fonts, text, styling
---

# Typography in Bookmotion

Typography is critical for book readability and aesthetics. This guide covers fonts, text styling, and best practices.

## Font Configuration

### Default Font

Set the default font in `book.config.ts`:

```typescript
export const config: BookConfig = {
  defaultFont: {
    family: 'Merriweather',
    size: 11,        // in points
    lineHeight: 1.6,
  },
};
```

### Google Fonts

Load Google Fonts automatically:

```typescript
export const config: BookConfig = {
  fonts: [
    {
      family: 'Merriweather',
      source: 'google',
      weights: ['400', '700'],
    },
    {
      family: 'Inter',
      source: 'google',
      weights: ['400', '500', '700'],
    },
  ],
};
```

Available weights: `'100'`, `'200'`, `'300'`, `'400'`, `'500'`, `'600'`, `'700'`, `'800'`, `'900'`

### Local Fonts

Use custom font files:

```typescript
export const config: BookConfig = {
  fonts: [
    {
      family: 'MyCustomFont',
      source: 'local',
      path: 'fonts/MyCustomFont-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      family: 'MyCustomFont',
      source: 'local',
      path: 'fonts/MyCustomFont-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
};
```

Place font files in `public/fonts/`:

```
public/
└── fonts/
    ├── MyCustomFont-Regular.woff2
    └── MyCustomFont-Bold.woff2
```

### Font Loading in Runtime

Load fonts dynamically in components:

```tsx
import { loadFont } from '@bookmotion/core';

const { fontFamily, waitUntilDone } = loadFont({
  family: 'Merriweather',
  source: 'google',
  weights: ['400', '700'],
});

// Wait for font to load before rendering
await waitUntilDone();
```

## Text Styling

### Basic Text

```tsx
<p style={{
  fontFamily: 'Georgia, serif',
  fontSize: '11pt',
  lineHeight: 1.5,
  color: '#333',
}}>
  Your text here...
</p>
```

### Headings

```tsx
<h1 style={{
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '24pt',
  fontWeight: 700,
  marginTop: '1in',
  marginBottom: '0.5in',
  lineHeight: 1.2,
}}>
  Chapter Title
</h1>
```

### Paragraph Styles

```tsx
// First paragraph (no indent)
<p style={{
  textIndent: 0,
  marginTop: 0,
}}>
  First paragraph...
</p>

// Subsequent paragraphs (with indent)
<p style={{
  textIndent: '1em',
  marginTop: 0,
  marginBottom: 0,
}}>
  Next paragraph...
</p>
```

### Drop Caps

Large first letter of chapter:

```tsx
import { DropCap } from '@bookmotion/core';

<p>
  <DropCap letter="O" lines={3} />
  nce upon a time, in a land far away...
</p>
```

Custom styling:

```tsx
<DropCap
  letter="O"
  lines={3}
  style={{
    fontFamily: 'Playfair Display',
    fontSize: '48pt',
    color: '#8B4513',
    marginRight: '4pt',
  }}
/>
```

## Typography Best Practices

### Font Pairings

**Classic (Novels):**
- Body: Georgia, Merriweather, Garamond
- Headings: Same family or sans-serif contrast

**Modern (Non-fiction):**
- Body: Inter, Source Sans Pro, Open Sans
- Headings: Montserrat, Work Sans, Oswald

**Children's:**
- Body: Comic Neue, Nunito, Quicksand
- Headings: Fredoka One, Baloo, Poppins

**Technical:**
- Body: Charter, Merriweather, PT Serif
- Headings: Helvetica Neue, Inter, Roboto

### Font Sizes by Book Type

| Element | Novel | Textbook | Children's | Cookbook |
|---------|-------|----------|------------|----------|
| Body | 10-11pt | 10-11pt | 14-18pt | 10-11pt |
| H1 | 24-36pt | 28-48pt | 36-48pt | 28-36pt |
| H2 | 18-24pt | 20-28pt | 24-36pt | 20-24pt |
| Caption | 8-9pt | 9-10pt | 12-14pt | 9-10pt |
| Footnote | 8pt | 8-9pt | - | 8pt |

### Line Height

```
Novels:         1.4 - 1.6
Textbooks:      1.5 - 1.8
Children's:     1.6 - 2.0
Poetry:         1.8 - 2.2
Technical:      1.4 - 1.5
```

### Measure (Line Length)

Optimal characters per line: **45-75** (average 66)

```tsx
// For wide pages, use columns
<Page layout="two-column">
  <BodyText />
</Page>
```

### Widows and Orphans

Control single lines at page breaks:

```tsx
import { Paragraph } from '@bookmotion/core';

<Paragraph
  orphans={2}    // Min lines at bottom of page
  widows={2}     // Min lines at top of page
>
  Your text...
</Paragraph>
```

## Text Components

### BodyText

Multi-page text flow:

```tsx
import { BodyText } from '@bookmotion/core';

<BodyText
  content={chapterContent}
  typography={{
    fontFamily: 'Georgia',
    fontSize: 11,
    lineHeight: 1.5,
    indent: '1em',
  }}
/>
```

### BlockQuote

```tsx
import { BlockQuote } from '@bookmotion/core';

<BlockQuote
  citation="Author Name, Book Title"
  style={{
    fontSize: '11pt',
    fontStyle: 'italic',
    borderLeft: '3pt solid #333',
    paddingLeft: '0.25in',
    marginLeft: '0.5in',
  }}
>
  The quote text goes here...
</BlockQuote>
```

### Pull Quote

```tsx
import { PullQuote } from '@bookmotion/core';

<PullQuote
  position="right"  // 'left' | 'right' | 'full'
  width="40%"
  style={{
    fontSize: '18pt',
    fontStyle: 'italic',
  }}
>
  An inspiring quote from the text...
</PullQuote>
```

### Epigraph

Quote at chapter start:

```tsx
import { Epigraph } from '@bookmotion/core';

<Epigraph
  quote="The journey of a thousand miles begins with one step."
  author="Lao Tzu"
  style={{
    fontSize: '12pt',
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: '2in',
  }}
/>
```

## Text Flow

### Multi-Page Text

Text that flows across pages:

```tsx
import { TextFlow } from '@bookmotion/core';

<TextFlow
  content={fullChapterText}
  onPageBreak={(remaining) => {
    console.log('Text continues on next page');
  }}
  typography={{
    fontFamily: 'Merriweather',
    fontSize: 11,
    lineHeight: 1.5,
    indent: '1em',
    orphans: 2,
    widows: 2,
  }}
/>
```

### Hyphenation

Enable automatic hyphenation:

```typescript
export const config: BookConfig = {
  typography: {
    hyphenation: true,
    hyphenationLanguage: 'en-us',
  },
};
```

### Text Alignment

```tsx
<p style={{ textAlign: 'left' }}>Left aligned</p>
<p style={{ textAlign: 'right' }}>Right aligned</p>
<p style={{ textAlign: 'center' }}>Center aligned</p>
<p style={{ textAlign: 'justify' }}>Justified (books)</p>
```

### Small Caps

```tsx
<span style={{ fontVariant: 'small-caps' }}>
  Small Caps Text
</span>
```

### Letter Spacing

```tsx
// Tracking (letter spacing)
<h1 style={{ letterSpacing: '0.05em' }}>
  WIDE TRACKING
</h1>

// Kerning (specific pairs)
<span style={{ fontKerning: 'normal' }}>
  AV | WA | To
</span>
```

## Special Characters

### Ligatures

```tsx
<p style={{ fontVariantLigatures: 'common-ligatures' }}>
  fi fl ffi ffl  // Will use ligatures if font supports
</p>
```

### Fractions

```tsx
<p style={{ fontVariantNumeric: 'diagonal-fractions' }}>
  1/2 3/4 5/8
</p>
```

### Old Style Figures

```tsx
<p style={{ fontVariantNumeric: 'oldstyle-nums' }}>
  1234567890  // Numbers with ascenders/descenders
</p>
```

## Language Support

### RTL Languages

```tsx
export const config: BookConfig = {
  language: 'ar',  // Arabic
  direction: 'rtl',
};
```

### CJK Languages

```tsx
export const config: BookConfig = {
  language: 'ja',  // Japanese
  fonts: [
    {
      family: 'Noto Serif JP',
      source: 'google',
    },
  ],
};
```

## Typography Utilities

### Spacer

Add vertical space:

```tsx
import { Spacer } from '@bookmotion/core';

<Spacer height="1em" />
<Spacer height="0.5in" />
```

### Text Divider

```tsx
import { TextDivider } from '@bookmotion/core';

<p>Paragraph one...</p>
<TextDivider style={{ textAlign: 'center' }}>
  * * *
</TextDivider>
<p>Paragraph two...</p>
```

### Page Break

Force new page:

```tsx
import { PageBreak } from '@bookmotion/core';

<PageBreak />
```

### Keep Together

Prevent element from breaking across pages:

```tsx
<div style={{ pageBreakInside: 'avoid' }}>
  <h2>Section Title</h2>
  <p>Content that should stay together...</p>
</div>
```

## Print-Specific Typography

### CMYK Colors

For print, use CMYK-safe colors:

```tsx
// Rich black (for large areas)
<p style={{ color: 'cmyk(60, 40, 40, 100)' }}>
  Rich Black Text
</p>

// Pure black (for text)
<p style={{ color: 'cmyk(0, 0, 0, 100)' }}>
  Pure Black Text
</p>
```

### Knockout Text

White text on dark background (check registration):

```tsx
<div style={{
  backgroundColor: '#000',
  padding: '0.5in',
}}>
  <p style={{ color: '#fff' }}>
    White on black
  </p>
</div>
```

## Web vs Print Typography

### Responsive Typography (for web output)

```tsx
import { useOutputFormat } from '@bookmotion/core';

const format = useOutputFormat();

<p style={{
  fontSize: format === 'web' ? '16px' : '11pt',
  lineHeight: format === 'web' ? 1.6 : 1.5,
}}>
  Responsive text...
</p>
```

### EPUB Considerations

```tsx
// Use relative units for EPUB
<p style={{
  fontSize: '1em',
  lineHeight: '1.5',
}}>
  EPUB-friendly text
</p>
```

## Typography Checklist

Before finalizing your book:

- [ ] Font is readable at chosen size
- [ ] Line height is comfortable (1.4-1.6 for body)
- [ ] Line length is optimal (45-75 characters)
- [ ] Contrast is sufficient (4.5:1 minimum)
- [ ] Widows and orphans are controlled
- [ ] Hyphenation is appropriate
- [ ] Drop caps are sized correctly
- [ ] Headings hierarchy is clear
- [ ] Page numbers are legible
- [ ] Running headers match style
- [ ] Special characters render correctly

## Troubleshooting

### Font not loading

- Check font name spelling
- Verify weights are available for that font
- Ensure network for Google Fonts
- Check font file path for local fonts

### Text overflowing

- Increase page size or margins
- Use smaller font size
- Enable hyphenation
- Add column layout
- Adjust line height

### Poor justification

- Enable hyphenation
- Use `text-align: left` instead
- Adjust word spacing
- Consider ragged right for web

---

See [pages.md](pages.md) for using typography in page layouts.
