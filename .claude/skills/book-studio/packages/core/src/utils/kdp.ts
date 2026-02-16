/**
 * Amazon KDP (Kindle Direct Publishing) presets and utilities
 *
 * Reference: https://kdp.amazon.com/en_US/help/topic/G201834180
 *
 * KDP supports trim sizes from 5" x 8" to 8.5" x 11.69"
 * Interior margins vary by page count
 * Cover is a separate flat PDF: front + spine + back
 */

import type { Dimensions, Margins, Unit } from '../types.js';

// ── KDP Trim Size Presets ──

export interface KDPTrimSize {
  name: string;
  description: string;
  width: number;
  height: number;
  unit: Unit;
  category: 'popular' | 'standard' | 'all';
  bestFor: string;
}

/**
 * All KDP-supported trim sizes (inches)
 * Source: https://kdp.amazon.com/en_US/help/topic/G201834180
 */
export const KDP_TRIM_SIZES: KDPTrimSize[] = [
  // ── Popular Sizes ──
  { name: '5 x 8', description: '5" × 8"', width: 5, height: 8, unit: 'in', category: 'popular', bestFor: 'Novels, fiction, memoirs' },
  { name: '5.25 x 8', description: '5.25" × 8"', width: 5.25, height: 8, unit: 'in', category: 'popular', bestFor: 'Novels, fiction' },
  { name: '5.5 x 8.5', description: '5.5" × 8.5"', width: 5.5, height: 8.5, unit: 'in', category: 'popular', bestFor: 'Novels, self-help, business' },
  { name: '6 x 9', description: '6" × 9"', width: 6, height: 9, unit: 'in', category: 'popular', bestFor: 'Non-fiction, textbooks, trade paperbacks' },
  { name: '8.5 x 11', description: '8.5" × 11"', width: 8.5, height: 11, unit: 'in', category: 'popular', bestFor: 'Workbooks, cookbooks, coloring books' },

  // ── Standard Sizes ──
  { name: '5 x 5', description: '5" × 5"', width: 5, height: 5, unit: 'in', category: 'standard', bestFor: 'Small photo books, gift books' },
  { name: '5.06 x 7.81', description: '5.06" × 7.81"', width: 5.06, height: 7.81, unit: 'in', category: 'standard', bestFor: 'Digest-size paperbacks' },
  { name: '6.14 x 9.21', description: '6.14" × 9.21"', width: 6.14, height: 9.21, unit: 'in', category: 'standard', bestFor: 'US trade size' },
  { name: '6.69 x 9.61', description: '6.69" × 9.61"', width: 6.69, height: 9.61, unit: 'in', category: 'standard', bestFor: 'Royal size' },
  { name: '7 x 10', description: '7" × 10"', width: 7, height: 10, unit: 'in', category: 'standard', bestFor: 'Textbooks, technical books' },
  { name: '7.44 x 9.69', description: '7.44" × 9.69"', width: 7.44, height: 9.69, unit: 'in', category: 'standard', bestFor: 'Crown Quarto size' },
  { name: '7.5 x 9.25', description: '7.5" × 9.25"', width: 7.5, height: 9.25, unit: 'in', category: 'standard', bestFor: 'Large trade paperback' },
  { name: '8 x 8', description: '8" × 8"', width: 8, height: 8, unit: 'in', category: 'standard', bestFor: "Children's books, photo books" },
  { name: '8 x 10', description: '8" × 10"', width: 8, height: 10, unit: 'in', category: 'standard', bestFor: 'Cookbooks, art books' },
  { name: '8.25 x 6', description: '8.25" × 6"', width: 8.25, height: 6, unit: 'in', category: 'standard', bestFor: 'Landscape format' },
  { name: '8.25 x 8.25', description: '8.25" × 8.25"', width: 8.25, height: 8.25, unit: 'in', category: 'standard', bestFor: "Children's books, square format" },
  { name: '8.27 x 11.69', description: '8.27" × 11.69"', width: 8.27, height: 11.69, unit: 'in', category: 'standard', bestFor: 'A4 size (international)' },
  { name: '8.5 x 8.5', description: '8.5" × 8.5"', width: 8.5, height: 8.5, unit: 'in', category: 'standard', bestFor: "Children's picture books" },

  // ── Additional Sizes ──
  { name: '5.5 x 5.5', description: '5.5" × 5.5"', width: 5.5, height: 5.5, unit: 'in', category: 'all', bestFor: 'Small square books' },
  { name: '6 x 6', description: '6" × 6"', width: 6, height: 6, unit: 'in', category: 'all', bestFor: 'Square photo books' },
];

// ── Recommended sizes by book type ──

export interface KDPBookTypePreset {
  type: string;
  displayName: string;
  recommendedSize: string;
  trimSize: KDPTrimSize;
  bleed: number;
  pageCountRange: { min: number; max: number };
  colorInterior: boolean;
  description: string;
}

export const KDP_BOOK_TYPE_PRESETS: KDPBookTypePreset[] = [
  {
    type: 'children-book',
    displayName: "Children's Picture Book",
    recommendedSize: '8.5 x 8.5',
    trimSize: KDP_TRIM_SIZES.find(s => s.name === '8.5 x 8.5')!,
    bleed: 0.125,
    pageCountRange: { min: 24, max: 48 },
    colorInterior: true,
    description: 'Full-color picture books with illustrations',
  },
  {
    type: 'novel',
    displayName: 'Novel / Fiction',
    recommendedSize: '5.5 x 8.5',
    trimSize: KDP_TRIM_SIZES.find(s => s.name === '5.5 x 8.5')!,
    bleed: 0,
    pageCountRange: { min: 100, max: 800 },
    colorInterior: false,
    description: 'Text-heavy fiction, memoirs, literary works',
  },
  {
    type: 'cookbook',
    displayName: 'Cookbook',
    recommendedSize: '8 x 10',
    trimSize: KDP_TRIM_SIZES.find(s => s.name === '8 x 10')!,
    bleed: 0.125,
    pageCountRange: { min: 50, max: 400 },
    colorInterior: true,
    description: 'Recipe books with photos and ingredient lists',
  },
  {
    type: 'workbook',
    displayName: 'Workbook / Activity Book',
    recommendedSize: '8.5 x 11',
    trimSize: KDP_TRIM_SIZES.find(s => s.name === '8.5 x 11')!,
    bleed: 0,
    pageCountRange: { min: 50, max: 300 },
    colorInterior: false,
    description: 'Puzzle books, journals, planners, coloring books',
  },
  {
    type: 'photo-book',
    displayName: 'Photo Book / Art Book',
    recommendedSize: '8 x 10',
    trimSize: KDP_TRIM_SIZES.find(s => s.name === '8 x 10')!,
    bleed: 0.125,
    pageCountRange: { min: 24, max: 200 },
    colorInterior: true,
    description: 'Photo collections, portfolios, art books',
  },
  {
    type: 'comic-book',
    displayName: 'Comic Book / Graphic Novel',
    recommendedSize: '6.69 x 9.61',
    trimSize: KDP_TRIM_SIZES.find(s => s.name === '6.69 x 9.61')!,
    bleed: 0.125,
    pageCountRange: { min: 24, max: 200 },
    colorInterior: true,
    description: 'Comics, manga, graphic novels',
  },
  {
    type: 'non-fiction',
    displayName: 'Non-Fiction / Business',
    recommendedSize: '6 x 9',
    trimSize: KDP_TRIM_SIZES.find(s => s.name === '6 x 9')!,
    bleed: 0,
    pageCountRange: { min: 100, max: 500 },
    colorInterior: false,
    description: 'Self-help, business, educational, how-to',
  },
  {
    type: 'journal',
    displayName: 'Journal / Planner',
    recommendedSize: '5.5 x 8.5',
    trimSize: KDP_TRIM_SIZES.find(s => s.name === '5.5 x 8.5')!,
    bleed: 0,
    pageCountRange: { min: 100, max: 400 },
    colorInterior: false,
    description: 'Lined journals, daily planners, gratitude journals',
  },
  {
    type: 'portfolio',
    displayName: 'Portfolio / Catalog',
    recommendedSize: '8.5 x 11',
    trimSize: KDP_TRIM_SIZES.find(s => s.name === '8.5 x 11')!,
    bleed: 0.125,
    pageCountRange: { min: 24, max: 200 },
    colorInterior: true,
    description: 'Design portfolios, product catalogs',
  },
];

// ── KDP Margin Calculator ──

/**
 * KDP minimum margins based on page count
 * Source: https://kdp.amazon.com/en_US/help/topic/G201834180
 *
 * Gutter (inner margin) varies by page count:
 * - 24-150 pages: 0.375"
 * - 151-300 pages: 0.5"
 * - 301-500 pages: 0.625"
 * - 501-700 pages: 0.75"
 * - 701-828 pages: 0.875"
 *
 * Outer margins: minimum 0.25" (no bleed) or 0.375" (with bleed)
 */
export function getKDPMinimumMargins(pageCount: number, hasBleed: boolean = false): Margins {
  // Gutter (inner) margin based on page count
  let gutter: number;
  if (pageCount <= 150) gutter = 0.375;
  else if (pageCount <= 300) gutter = 0.5;
  else if (pageCount <= 500) gutter = 0.625;
  else if (pageCount <= 700) gutter = 0.75;
  else gutter = 0.875;

  // Outer margins
  const outerMin = hasBleed ? 0.375 : 0.25;

  return {
    top: outerMin,
    bottom: outerMin,
    inner: gutter,
    outer: outerMin,
  };
}

/**
 * Validate margins against KDP requirements
 */
export function validateKDPMargins(
  margins: Margins,
  pageCount: number,
  hasBleed: boolean = false
): { valid: boolean; errors: string[] } {
  const min = getKDPMinimumMargins(pageCount, hasBleed);
  const errors: string[] = [];

  if (margins.top < min.top) errors.push(`Top margin (${margins.top}") is below KDP minimum (${min.top}")`);
  if (margins.bottom < min.bottom) errors.push(`Bottom margin (${margins.bottom}") is below KDP minimum (${min.bottom}")`);
  if (margins.inner < min.inner) errors.push(`Inner/gutter margin (${margins.inner}") is below KDP minimum (${min.inner}") for ${pageCount} pages`);
  if (margins.outer < min.outer) errors.push(`Outer margin (${margins.outer}") is below KDP minimum (${min.outer}")`);

  return { valid: errors.length === 0, errors };
}

// ── KDP Cover Calculator ──

export interface KDPCoverDimensions {
  /** Total width of flat cover (front + spine + back) in inches */
  totalWidth: number;
  /** Total height with bleed in inches */
  totalHeight: number;
  /** Spine width in inches */
  spineWidth: number;
  /** Front cover width (trim width) in inches */
  frontWidth: number;
  /** Bleed on all sides in inches */
  bleed: number;
  /** Trim size (without bleed) */
  trimWidth: number;
  trimHeight: number;
}

/**
 * Calculate KDP cover dimensions
 *
 * Cover is a single flat PDF: bleed + back + spine + front + bleed
 *
 * Spine width depends on paper type and page count:
 * - White paper: page_count × 0.002252"
 * - Cream paper: page_count × 0.0025"
 */
export function getKDPCoverDimensions(
  trimSize: Dimensions,
  pageCount: number,
  paperType: 'white' | 'cream' = 'white'
): KDPCoverDimensions {
  const spinePerPage = paperType === 'white' ? 0.002252 : 0.0025;
  const spineWidth = Math.max(pageCount * spinePerPage, 0.039); // Minimum spine width
  const bleed = 0.125;

  const trimWidth = trimSize.width;
  const trimHeight = trimSize.height;

  // Total cover width: bleed + back + spine + front + bleed
  const totalWidth = bleed + trimWidth + spineWidth + trimWidth + bleed;
  // Total cover height: bleed + height + bleed
  const totalHeight = bleed + trimHeight + bleed;

  return {
    totalWidth: Math.round(totalWidth * 1000) / 1000,
    totalHeight: Math.round(totalHeight * 1000) / 1000,
    spineWidth: Math.round(spineWidth * 1000) / 1000,
    frontWidth: trimWidth,
    bleed,
    trimWidth,
    trimHeight,
  };
}

// ── KDP Validation ──

export interface KDPValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  coverDimensions?: KDPCoverDimensions;
  minimumMargins: Margins;
}

/**
 * Validate full book configuration against KDP requirements
 */
export function validateForKDP(
  config: {
    dimensions: Dimensions;
    margins: Margins;
    bleed?: number;
    pageCount: number;
    paperType?: 'white' | 'cream';
    colorInterior?: boolean;
  }
): KDPValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check trim size is KDP-compatible
  const matchingSize = KDP_TRIM_SIZES.find(
    s => Math.abs(s.width - config.dimensions.width) < 0.01 &&
         Math.abs(s.height - config.dimensions.height) < 0.01
  );

  if (!matchingSize) {
    errors.push(
      `Trim size ${config.dimensions.width}" × ${config.dimensions.height}" is not a standard KDP size. ` +
      `See KDP_TRIM_SIZES for supported sizes.`
    );
  }

  // Check page count
  if (config.pageCount < 24) {
    errors.push(`Page count (${config.pageCount}) is below KDP minimum of 24 pages`);
  }
  if (config.pageCount > 828) {
    errors.push(`Page count (${config.pageCount}) exceeds KDP maximum of 828 pages`);
  }
  if (config.pageCount % 2 !== 0) {
    warnings.push(`Page count (${config.pageCount}) should be even for print books`);
  }

  // Check bleed
  const hasBleed = (config.bleed || 0) > 0;
  if (hasBleed && config.bleed !== 0.125) {
    warnings.push(`KDP requires exactly 0.125" bleed. Current bleed: ${config.bleed}"`);
  }

  // Validate margins
  const marginValidation = validateKDPMargins(config.margins, config.pageCount, hasBleed);
  errors.push(...marginValidation.errors);

  // Calculate cover dimensions
  const coverDimensions = getKDPCoverDimensions(
    config.dimensions,
    config.pageCount,
    config.paperType || 'white'
  );

  // Minimum margins
  const minimumMargins = getKDPMinimumMargins(config.pageCount, hasBleed);

  // DPI warning
  warnings.push('Ensure all images are at least 300 DPI for print quality');

  // Color warning
  if (config.colorInterior) {
    warnings.push('Color interior books cost more per copy to print. Ensure color is necessary.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    coverDimensions,
    minimumMargins,
  };
}

// ── Helper: Get preset by book type ──

export function getKDPPreset(bookType: string): KDPBookTypePreset | undefined {
  return KDP_BOOK_TYPE_PRESETS.find(p => p.type === bookType);
}

// ── Helper: Get all trim sizes by category ──

export function getKDPTrimSizes(category?: 'popular' | 'standard' | 'all'): KDPTrimSize[] {
  if (!category || category === 'all') return KDP_TRIM_SIZES;
  if (category === 'standard') return KDP_TRIM_SIZES.filter(s => s.category === 'popular' || s.category === 'standard');
  return KDP_TRIM_SIZES.filter(s => s.category === category);
}
