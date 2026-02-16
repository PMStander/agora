/**
 * PDF Export for Bookmotion
 *
 * Uses Puppeteer to render each page of a book to a print-quality PDF.
 * This is a Node.js-only module (not for browser use).
 *
 * Architecture:
 * 1. Start Vite dev server (or use an already-running one)
 * 2. Launch headless Chromium via Puppeteer
 * 3. Navigate to the book's dev server URL
 * 4. For each .book-page element, capture it as a PDF page
 * 5. Merge individual pages into a single PDF using pdf-lib
 * 6. Optionally add crop marks and bleed indicators
 *
 * Usage:
 *   npx ts-node scripts/export-pdf.ts
 *   # or from the book project:
 *   npm run render:pdf
 */

import type { BookConfig, PDFOutputConfig } from '../types.js';
import {
  validateForKDP,
  type KDPCoverDimensions,
} from './kdp.js';

// ── Types ──

export interface PDFExportOptions {
  /** URL of the running dev server (default: http://localhost:5173) */
  devServerUrl?: string;
  /** Output file path (default: output/book.pdf) */
  outputPath?: string;
  /** DPI for rendering (default: 300) */
  dpi?: number;
  /** Include bleed area in output (default: true if config has bleed) */
  includeBleed?: boolean;
  /** Add crop marks to pages (default: false) */
  cropMarks?: boolean;
  /** PDF output config overrides */
  pdfConfig?: PDFOutputConfig;
  /** Only export specific pages (0-indexed) */
  pages?: number[];
  /** Time to wait for page render in ms (default: 500) */
  pageRenderDelay?: number;
  /** Generate KDP cover PDF separately */
  generateCover?: boolean;
  /** Path to Chrome/Chromium executable (auto-detected if not provided) */
  executablePath?: string;
  /** Page count for spine width calculation (auto-detected if not provided) */
  pageCount?: number;
  /** Paper type for spine calculation */
  paperType?: 'white' | 'cream';
  /** Callback for progress updates */
  onProgress?: (current: number, total: number, status: string) => void;
}

export interface PDFExportResult {
  success: boolean;
  interiorPath?: string;
  coverPath?: string;
  pageCount: number;
  errors: string[];
  warnings: string[];
  kdpValidation?: ReturnType<typeof validateForKDP>;
}

/**
 * Find Chrome executable on the current system.
 * Tries system Chrome first (more stable), then falls back to Puppeteer's bundled Chromium.
 */
async function findChromeAsync(): Promise<string | undefined> {
  const fs = await import('fs');
  const candidates = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      continue;
    }
  }
  return undefined; // Let puppeteer use its bundled Chromium
}

/**
 * Export a book to PDF using Puppeteer
 *
 * This function must be run in a Node.js environment with puppeteer installed.
 * It connects to the book's dev server and captures each page.
 */
export async function exportToPDF(
  config: BookConfig,
  options: PDFExportOptions = {}
): Promise<PDFExportResult> {
  const {
    devServerUrl = 'http://localhost:5173',
    outputPath = 'output/book-interior.pdf',
    dpi = 300,
    includeBleed = (config.bleed || 0) > 0,
    cropMarks = false,
    pages: pageFilter,
    pageRenderDelay = 500,
    generateCover = false,
    paperType = 'white',
    executablePath: userExecPath,
    onProgress,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // We dynamically import puppeteer and pdf-lib since they're Node-only deps
  let puppeteer: any;
  let PDFLib: any;

  try {
    puppeteer = await import('puppeteer');
  } catch {
    errors.push(
      'puppeteer is not installed. Run: npm install -D puppeteer\n' +
      'This is required for PDF export.'
    );
    return { success: false, pageCount: 0, errors, warnings };
  }

  try {
    PDFLib = await import('pdf-lib');
  } catch {
    errors.push(
      'pdf-lib is not installed. Run: npm install -D pdf-lib\n' +
      'This is required to merge PDF pages.'
    );
    return { success: false, pageCount: 0, errors, warnings };
  }

  // Calculate page dimensions
  const { dimensions, bleed = 0 } = config;
  const pageWidthIn = dimensions.width + (includeBleed ? bleed * 2 : 0);
  const pageHeightIn = dimensions.height + (includeBleed ? bleed * 2 : 0);

  // CSS pixel dimensions (96 DPI base)
  const cssWidth = Math.round(pageWidthIn * 96);
  const cssHeight = Math.round(pageHeightIn * 96);
  const scale = dpi / 96; // Scale factor for high-DPI rendering

  onProgress?.(0, 1, 'Launching browser...');

  let browser: any;
  let page: any;

  try {
    // Auto-detect Chrome executable if not provided
    const executablePath = userExecPath || await findChromeAsync();

    // Launch headless Chrome
    browser = await puppeteer.default.launch({
      headless: 'new',
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        `--window-size=${cssWidth},${cssHeight}`,
      ],
    });

    page = await browser.newPage();

    // Set viewport to match page dimensions at 96 DPI
    await page.setViewport({
      width: cssWidth,
      height: cssHeight,
      deviceScaleFactor: scale,
    });

    // Navigate to the dev server
    // Use 'load' instead of 'networkidle0' — the latter hangs on Vite's HMR websocket
    // and external font CDN connections that may timeout
    onProgress?.(0, 1, 'Loading book...');
    await page.goto(devServerUrl, { waitUntil: 'load', timeout: 30000 });

    // Wait for pages to render (BookViewer needs 150ms + buffer)
    // Then wait extra for fonts to load
    await page.waitForSelector('.book-page', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, pageRenderDelay));

    // Wait for fonts to finish loading
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 300));

    // Count total pages
    const totalPages: number = await page.evaluate(() => {
      return document.querySelectorAll('.book-page').length;
    });

    if (totalPages === 0) {
      errors.push('No pages found in the book. Ensure <Page> components render .book-page elements.');
      return { success: false, pageCount: 0, errors, warnings };
    }

    onProgress?.(0, totalPages, `Found ${totalPages} pages`);

    // Determine which pages to export
    const pagesToExport = pageFilter || Array.from({ length: totalPages }, (_, i) => i);

    // Prepare the page for export: hide UI chrome, make render area visible
    await page.evaluate(() => {
      // Hide BookViewer toolbar, thumbnails, flipbook, and keyboard hint
      const selectors = [
        '.book-viewer-flipbook',
        '[class*="toolbar"]',
        '[class*="thumbnail"]',
        'p', // keyboard hint paragraph
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach((el: any) => {
          if (el.closest('.book-page')) return; // Don't hide elements inside pages
          el.style.display = 'none';
        });
      });

      // Make the render area visible (it may be positioned offscreen in flip mode)
      const renderArea = document.querySelector('.book-viewer-render-area') as HTMLElement;
      if (renderArea) {
        renderArea.style.position = 'static';
        renderArea.style.left = '0';
        renderArea.style.top = '0';
        renderArea.style.display = 'flex';
        renderArea.style.flexDirection = 'column';
        renderArea.style.alignItems = 'center';
      }

      // Also hide the outer viewer padding
      const viewer = document.querySelector('.book-viewer') as HTMLElement;
      if (viewer) {
        viewer.style.padding = '0';
        viewer.style.textAlign = 'left';
      }
    });

    // Create the merged PDF document
    const mergedPdf = await PDFLib.PDFDocument.create();

    // Export each page
    for (let i = 0; i < pagesToExport.length; i++) {
      const pageIndex = pagesToExport[i];
      onProgress?.(i, pagesToExport.length, `Rendering page ${pageIndex + 1}/${totalPages}...`);

      // Make only the target page visible, hide all others
      await page.evaluate((idx: number) => {
        const allPages = document.querySelectorAll('.book-page');
        allPages.forEach((el: any, j: number) => {
          el.style.display = j === idx ? 'block' : 'none';
        });
      }, pageIndex);

      // Reset body margin/padding for clean capture
      await page.evaluate(() => {
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.background = 'white';
      });

      // Small delay for render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate PDF for this single page
      const pdfBuffer = await page.pdf({
        width: `${pageWidthIn}in`,
        height: `${pageHeightIn}in`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        preferCSSPageSize: false,
      });

      // Load single-page PDF and copy to merged document
      const singlePdf = await PDFLib.PDFDocument.load(pdfBuffer);
      const [copiedPage] = await mergedPdf.copyPages(singlePdf, [0]);

      // Add crop marks if requested
      if (cropMarks && includeBleed) {
        addCropMarks(copiedPage, pageWidthIn, pageHeightIn, bleed, PDFLib);
      }

      mergedPdf.addPage(copiedPage);
    }

    // Set PDF metadata
    mergedPdf.setTitle(config.title);
    mergedPdf.setAuthor(config.author);
    if (config.subtitle) mergedPdf.setSubject(config.subtitle);
    if (config.keywords) mergedPdf.setKeywords(config.keywords);
    mergedPdf.setCreator('Bookmotion - Agora Book Studio');
    mergedPdf.setProducer('Bookmotion PDF Export');

    // Save the merged PDF
    const pdfBytes = await mergedPdf.save();

    // Write to file system
    const fs = await import('fs');
    const path = await import('path');
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, pdfBytes);

    onProgress?.(pagesToExport.length, pagesToExport.length, 'Interior PDF complete!');

    // KDP validation
    const kdpValidation = validateForKDP({
      dimensions: config.dimensions,
      margins: config.margins,
      bleed: config.bleed,
      pageCount: totalPages,
      paperType,
    });
    warnings.push(...kdpValidation.warnings);
    if (!kdpValidation.valid) {
      warnings.push('KDP validation failed — see errors above. The PDF may not be accepted by KDP.');
    }

    // Generate cover PDF if requested
    let coverPath: string | undefined;
    if (generateCover && kdpValidation.coverDimensions) {
      coverPath = outputPath.replace('.pdf', '-cover.pdf');
      onProgress?.(0, 1, 'Generating cover template...');

      await generateCoverTemplate(
        kdpValidation.coverDimensions,
        config,
        coverPath,
        PDFLib
      );

      onProgress?.(1, 1, 'Cover template complete!');
    }

    return {
      success: true,
      interiorPath: outputPath,
      coverPath,
      pageCount: pagesToExport.length,
      errors,
      warnings,
      kdpValidation,
    };
  } catch (err: any) {
    errors.push(`PDF export failed: ${err.message}`);
    return { success: false, pageCount: 0, errors, warnings };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Add crop marks to a PDF page
 */
function addCropMarks(
  page: any,
  pageWidthIn: number,
  pageHeightIn: number,
  bleedIn: number,
  PDFLib: any
): void {
  const { rgb } = PDFLib;
  const markLength = 0.25 * 72; // 0.25" in points
  const markOffset = 0.0625 * 72; // 1/16" offset from trim edge
  const pageW = pageWidthIn * 72;
  const pageH = pageHeightIn * 72;
  const bleed = bleedIn * 72;

  const color = rgb(0, 0, 0);
  const lineWidth = 0.25; // 0.25pt thin line

  // Trim rectangle corners (offset from bleed)
  const trimLeft = bleed;
  const trimRight = pageW - bleed;
  const trimTop = pageH - bleed;
  const trimBottom = bleed;

  // Top-left corner
  page.drawLine({ start: { x: trimLeft, y: trimTop + markOffset }, end: { x: trimLeft, y: trimTop + markOffset + markLength }, thickness: lineWidth, color });
  page.drawLine({ start: { x: trimLeft - markOffset, y: trimTop }, end: { x: trimLeft - markOffset - markLength, y: trimTop }, thickness: lineWidth, color });

  // Top-right corner
  page.drawLine({ start: { x: trimRight, y: trimTop + markOffset }, end: { x: trimRight, y: trimTop + markOffset + markLength }, thickness: lineWidth, color });
  page.drawLine({ start: { x: trimRight + markOffset, y: trimTop }, end: { x: trimRight + markOffset + markLength, y: trimTop }, thickness: lineWidth, color });

  // Bottom-left corner
  page.drawLine({ start: { x: trimLeft, y: trimBottom - markOffset }, end: { x: trimLeft, y: trimBottom - markOffset - markLength }, thickness: lineWidth, color });
  page.drawLine({ start: { x: trimLeft - markOffset, y: trimBottom }, end: { x: trimLeft - markOffset - markLength, y: trimBottom }, thickness: lineWidth, color });

  // Bottom-right corner
  page.drawLine({ start: { x: trimRight, y: trimBottom - markOffset }, end: { x: trimRight, y: trimBottom - markOffset - markLength }, thickness: lineWidth, color });
  page.drawLine({ start: { x: trimRight + markOffset, y: trimBottom }, end: { x: trimRight + markOffset + markLength, y: trimBottom }, thickness: lineWidth, color });
}

/**
 * Generate a KDP cover template PDF
 *
 * Creates a blank PDF at the correct dimensions with guide lines
 * showing front, spine, and back cover areas.
 * The user can design their cover in the BookViewer and this serves as
 * the target dimensions reference.
 */
async function generateCoverTemplate(
  coverDims: KDPCoverDimensions,
  config: BookConfig,
  outputPath: string,
  PDFLib: any
): Promise<void> {
  const { rgb } = PDFLib;
  const doc = await PDFLib.PDFDocument.create();

  // Cover dimensions in points (72 DPI)
  const totalW = coverDims.totalWidth * 72;
  const totalH = coverDims.totalHeight * 72;
  const bleed = coverDims.bleed * 72;
  const spineW = coverDims.spineWidth * 72;
  const trimW = coverDims.trimWidth * 72;

  const page = doc.addPage([totalW, totalH]);

  // Draw guide lines (light cyan, thin)
  const guideColor = rgb(0, 0.8, 0.8);
  const lineWidth = 0.5;

  // Trim/bleed boundary lines
  // Top trim line
  page.drawLine({ start: { x: 0, y: totalH - bleed }, end: { x: totalW, y: totalH - bleed }, thickness: lineWidth, color: guideColor });
  // Bottom trim line
  page.drawLine({ start: { x: 0, y: bleed }, end: { x: totalW, y: bleed }, thickness: lineWidth, color: guideColor });

  // Spine boundaries (vertical lines)
  const spineLeft = bleed + trimW;
  const spineRight = spineLeft + spineW;
  page.drawLine({ start: { x: spineLeft, y: 0 }, end: { x: spineLeft, y: totalH }, thickness: lineWidth, color: guideColor });
  page.drawLine({ start: { x: spineRight, y: 0 }, end: { x: spineRight, y: totalH }, thickness: lineWidth, color: guideColor });

  // Left bleed line
  page.drawLine({ start: { x: bleed, y: 0 }, end: { x: bleed, y: totalH }, thickness: lineWidth, color: guideColor });
  // Right bleed line
  page.drawLine({ start: { x: totalW - bleed, y: 0 }, end: { x: totalW - bleed, y: totalH }, thickness: lineWidth, color: guideColor });

  // Add text labels
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const fontSize = 8;
  const textColor = rgb(0.5, 0.5, 0.5);

  // Back cover label (centered in back area)
  const backCenterX = bleed + trimW / 2;
  const centerY = totalH / 2;
  page.drawText('BACK COVER', {
    x: backCenterX - font.widthOfTextAtSize('BACK COVER', fontSize) / 2,
    y: centerY,
    size: fontSize,
    font,
    color: textColor,
  });

  // Spine label
  const spineCenterX = spineLeft + spineW / 2;
  page.drawText('SPINE', {
    x: spineCenterX - font.widthOfTextAtSize('SPINE', fontSize) / 2,
    y: centerY,
    size: fontSize,
    font,
    color: textColor,
  });

  // Front cover label
  const frontCenterX = spineRight + trimW / 2;
  page.drawText('FRONT COVER', {
    x: frontCenterX - font.widthOfTextAtSize('FRONT COVER', fontSize) / 2,
    y: centerY,
    size: fontSize,
    font,
    color: textColor,
  });

  // Dimensions annotation
  const dimText = `${coverDims.totalWidth.toFixed(3)}" × ${coverDims.totalHeight.toFixed(3)}" | Spine: ${coverDims.spineWidth.toFixed(3)}"`;
  page.drawText(dimText, {
    x: totalW / 2 - font.widthOfTextAtSize(dimText, 6) / 2,
    y: 10,
    size: 6,
    font,
    color: textColor,
  });

  // Set metadata
  doc.setTitle(`${config.title} - Cover Template`);
  doc.setAuthor(config.author);
  doc.setCreator('Bookmotion - Agora Book Studio');

  // Save
  const pdfBytes = await doc.save();
  const fs = await import('fs');
  const path = await import('path');
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, pdfBytes);
}

/**
 * Quick helper: Export the current running dev server to PDF
 */
export async function quickExport(
  config: BookConfig,
  options: Partial<PDFExportOptions> = {}
): Promise<PDFExportResult> {
  return exportToPDF(config, {
    devServerUrl: 'http://localhost:5173',
    outputPath: 'output/book-interior.pdf',
    dpi: 300,
    generateCover: true,
    ...options,
    onProgress: options.onProgress || ((current, total, status) => {
      console.log(`[${current}/${total}] ${status}`);
    }),
  });
}
