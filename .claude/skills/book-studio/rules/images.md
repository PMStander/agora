---
name: book-images
description: Working with images in Bookmotion - placement, bleed, captions, and optimization
metadata:
  tags: book, images, photos, illustrations, bleed
---

# Images in Bookmotion

Images are essential for most books. This guide covers image placement, handling, and best practices.

## The Image Component

Use the `<Image>` component for book-optimized images:

```tsx
import { Image, staticFile } from '@bookmotion/core';

<Image
  src={staticFile('photos/landscape.jpg')}
  layout="bleed"        // or "margins", "float"
  caption="A beautiful landscape"
  alt="Mountain landscape at sunset"
/>
```

## Image Props

| Prop | Type | Description |
|------|------|-------------|
| `src` | `string` | Image source URL |
| `layout` | `'bleed' \| 'margins' \| 'float'` | How image is positioned |
| `caption` | `string \| ReactNode` | Caption text |
| `alt` | `string` | Alt text for accessibility |
| `width` | `string \| number` | Image width |
| `height` | `string \| number` | Image height |
| `objectFit` | `'cover' \| 'contain' \| 'fill'` | Resize behavior |
| `quality` | `number` | Compression quality (1-100) |

## Image Layouts

### `bleed` - Full Bleed Images

Images extend to the trim edge (and into bleed area):

```tsx
<Page layout="full-bleed">
  <Image
    src={staticFile('illustration.jpg')}
    layout="bleed"
    objectFit="cover"
  />
</Page>
```

**Important:** For print, your source image must be larger than the page:

```
Page size: 8" x 10"
Bleed: 0.125"
Required image size: 8.25" x 10.25" at 300 DPI = 2475 x 3075 pixels
```

### `margins` - Within Margins

Images stay within safe content area:

```tsx
<Page layout="margins">
  <Image
    src={staticFile('diagram.png')}
    layout="margins"
    width="100%"
    caption="Figure 1: System architecture"
  />
</Page>
```

### `float` - Text Wrap

Image with text wrapping around it:

```tsx
<Page layout="margins">
  <Image
    src={staticFile('portrait.jpg')}
    layout="float"
    width="40%"
    float="left"
    style={{ marginRight: '0.25in' }}
  />
  <p>Text wraps around the image...</p>
</Page>
```

## Full Bleed Implementation

### Using the `<Image>` Component

```tsx
import { Image, staticFile, Page } from '@bookmotion/core';

export const FullBleedPage = () => (
  <Page layout="full-bleed">
    <Image
      src={staticFile('spread.jpg')}
      layout="bleed"
      objectFit="cover"
      style={{
        position: 'absolute',
        top: '-0.125in',    // Extend into bleed
        left: '-0.125in',
        width: 'calc(100% + 0.25in)',
        height: 'calc(100% + 0.25in)',
      }}
    />
  </Page>
);
```

### Manual Implementation

For more control, use a plain `<img>` tag:

```tsx
<Page layout="full-bleed">
  <img
    src={staticFile('illustration.jpg')}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    }}
  />
</Page>
```

## Image Sizing

### Aspect Ratio

Maintain aspect ratio:

```tsx
<Image
  src={staticFile('photo.jpg')}
  width="100%"
  height="auto"
  objectFit="contain"
/>
```

### Fixed Dimensions

Set exact size:

```tsx
<Image
  src={staticFile('thumbnail.jpg')}
  width="2in"
  height="2in"
  objectFit="cover"
/>
```

### Responsive

Percentage-based sizing:

```tsx
<Image
  src={staticFile('diagram.png')}
  width="50%"
  style={{ float: 'right' }}
/>
```

## Captions

### Basic Caption

```tsx
<Image
  src={staticFile('photo.jpg')}
  caption="A beautiful sunset over the mountains"
/>
```

### Custom Caption

```tsx
<Image
  src={staticFile('photo.jpg')}
  caption={
    <span>
      Photo by <em>Photographer Name</em>
    </span>
  }
/>
```

### Caption Styling

```tsx
<Image
  src={staticFile('photo.jpg')}
  caption="Figure 1: Sample image"
  captionStyle={{
    fontSize: '9pt',
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    marginTop: '0.125in',
  }}
/>
```

## Image Grids

### Two-Column Grid

```tsx
<Page layout="margins">
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '0.125in',
    }}
  >
    <Image src={staticFile('photo1.jpg')} layout="margins" />
    <Image src={staticFile('photo2.jpg')} layout="margins" />
    <Image src={staticFile('photo3.jpg')} layout="margins" />
    <Image src={staticFile('photo4.jpg')} layout="margins" />
  </div>
</Page>
```

### Masonry Grid

```tsx
import { Masonry } from '@bookmotion/core';

<Page layout="margins">
  <Masonry columns={2} gap="0.125in">
    <Image src={staticFile('tall.jpg')} />
    <Image src={staticFile('wide.jpg')} />
    <Image src={staticFile('square.jpg')} />
  </Masonry>
</Page>
```

### Asymmetric Grid

```tsx
<div
  style={{
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: '0.125in',
  }}
>
  <Image 
    src={staticFile('large.jpg')} 
    style={{ gridRow: 'span 2' }}
  />
  <Image src={staticFile('small1.jpg')} />
  <Image src={staticFile('small2.jpg')} />
</div>
```

## Asset Management

### File Organization

Organize images in the `public/` folder:

```
public/
├── assets/
│   ├── cover/
│   │   ├── front.jpg
│   │   ├── back.jpg
│   │   └── spine.jpg
│   ├── illustrations/
│   │   ├── page-01.jpg
│   │   ├── page-02.jpg
│   │   └── page-03.jpg
│   ├── photos/
│   │   ├── portrait.jpg
│   │   └── landscape.jpg
│   └── diagrams/
│       └── chart.png
```

### Referencing Assets

Always use `staticFile()`:

```tsx
// ✅ Correct
import { staticFile } from '@bookmotion/core';
<Image src={staticFile('assets/photos/portrait.jpg')} />

// ❌ Wrong - won't work after build
<Image src="./assets/photos/portrait.jpg" />

// ❌ Wrong - won't work in subdirectories
<Image src="/assets/photos/portrait.jpg" />
```

### Dynamic Image Paths

```tsx
const pageNumber = 5;
<Image src={staticFile(`assets/illustrations/page-${pageNumber}.jpg`)} />
```

## Image Optimization

### Source Requirements

For print quality at 300 DPI:

| Page Size | Minimum Pixels at 300 DPI | Recommended |
|-----------|---------------------------|-------------|
| 6" x 9" | 1800 x 2700 | 2400 x 3600 |
| 8.5" x 11" | 2550 x 3300 | 3400 x 4400 |
| 8" x 8" | 2400 x 2400 | 3200 x 3200 |
| Full bleed 8" x 8" | 2475 x 2475 | 3300 x 3300 |

### File Formats

| Format | Best For | Notes |
|--------|----------|-------|
| **PNG** | Diagrams, illustrations, transparent images | Lossless, larger files |
| **JPG** | Photos, complex images | Compressed, smaller files |
| **WebP** | Web output | Not supported in all PDF renderers |
| **SVG** | Icons, logos, diagrams | Scalable, small file size |
| **TIFF** | Print production | Uncompressed, very large |

### Compression

Control quality in config:

```ts
// book.config.ts
export const config = {
  outputs: {
    images: {
      format: 'jpg',
      quality: 95,  // 1-100
    },
  },
};
```

### Lazy Loading

For large books with many images:

```tsx
import { LazyImage } from '@bookmotion/core';

<LazyImage
  src={staticFile('large-photo.jpg')}
  placeholder={staticFile('thumbnails/large-photo.jpg')}
/>
```

## Background Images

### Page Background

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
  <div style={{ position: 'relative', zIndex: 1 }}>
    <h1>Title</h1>
  </div>
</Page>
```

### Watermark

```tsx
<div style={{ position: 'relative' }}>
  <img
    src={staticFile('watermark.png')}
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      opacity: 0.1,
    }}
  />
  <p>Content...</p>
</div>
```

## Image Effects

### Rounded Corners

```tsx
<Image
  src={staticFile('photo.jpg')}
  style={{ borderRadius: '8px' }}
/>
```

### Borders

```tsx
<Image
  src={staticFile('photo.jpg')}
  style={{
    border: '2pt solid #333',
    padding: '4pt',
    backgroundColor: '#fff',
  }}
/>
```

### Shadows

```tsx
<Image
  src={staticFile('photo.jpg')}
  style={{
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  }}
/>
```

### Grayscale

```tsx
<Image
  src={staticFile('photo.jpg')}
  style={{ filter: 'grayscale(100%)' }}
/>
```

## Advanced Patterns

### Image with Text Overlay

```tsx
<Page layout="full-bleed">
  <Image
    src={staticFile('hero.jpg')}
    layout="bleed"
    objectFit="cover"
  />
  <div
    style={{
      position: 'absolute',
      bottom: '1in',
      left: '0.5in',
      right: '0.5in',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      color: 'white',
      padding: '0.5in',
    }}
  >
    <h1>Chapter Title</h1>
  </div>
</Page>
```

### Two-Page Spread

```tsx
// Left page (even number)
<Page layout="full-bleed">
  <Image
    src={staticFile('spread-left.jpg')}
    layout="bleed"
    style={{
      clipPath: 'inset(0 50% 0 0)',  // Show left half
    }}
  />
</Page>

// Right page (odd number)
<Page layout="full-bleed">
  <Image
    src={staticFile('spread-right.jpg')}
    layout="bleed"
    style={{
      clipPath: 'inset(0 0 0 50%)',  // Show right half
    }}
  />
</Page>
```

### Image Sequence

```tsx
const images = ['frame1.jpg', 'frame2.jpg', 'frame3.jpg'];

{images.map((img, i) => (
  <Page key={i} layout="margins">
    <Image
      src={staticFile(`assets/sequence/${img}`)}
      caption={`Step ${i + 1}`}
    />
  </Page>
))}
```

## Image Best Practices

1. **Resolution**: Use 300 DPI for print, 150 DPI for web
2. **Bleed**: Extend full-bleed images 0.125" beyond trim
3. **Format**: Use PNG for diagrams, JPG for photos
4. **Alt text**: Always include for accessibility
5. **Captions**: Provide context and attribution
6. **File size**: Optimize images before adding to project
7. **Naming**: Use descriptive, sequential names (`page-01.jpg`, `fig-1.1.png`)
8. **Organization**: Group by type in subfolders
9. **Color space**: Convert to CMYK for print if needed
10. **Backup**: Keep original high-res files outside project

## Troubleshooting

### Images not appearing

- Check file is in `public/` folder
- Verify path with `staticFile()`
- Ensure file extension matches (.jpg vs .jpeg)

### Low quality output

- Use higher resolution source images
- Check DPI setting in config (300 for print)
- Use PNG instead of JPG for diagrams

### Wrong colors in print

- Convert images to CMYK before adding
- Or use `colorSpace: 'CMYK'` in config
- Be aware of color profile differences

### Slow rendering

- Optimize image file sizes
- Use `LazyImage` for large books
- Consider lowering preview quality
- Use JPG instead of PNG for photos

### Full bleed not working

- Ensure `layout="full-bleed"` on Page
- Check bleed setting in config
- Image must extend past page edges

---

See [pages.md](pages.md) for page layout options.
