import type { BookTheme } from '../types.js';

// ── Children's Book Themes ──

export const whimsicalForest: BookTheme = {
  id: 'whimsical-forest',
  name: 'Whimsical Forest',
  colors: {
    primary: '#2d5016',
    secondary: '#4a7c24',
    accent: '#f4a261',
    background: '#fefcf3',
    surface: '#f0ead2',
    text: '#2d3319',
    textMuted: '#6b705c',
    border: '#c8c09e',
  },
  fonts: {
    heading: { family: "'Fredoka One', 'Comic Sans MS', cursive", weight: '700', letterSpacing: '0.02em' },
    body: { family: "'Patrick Hand', 'Comic Sans MS', cursive", weight: '400', size: '18pt' },
    caption: { family: "'Patrick Hand', cursive", weight: '400', size: '12pt' },
  },
  spacing: { pageMarginScale: 0.8, paragraphGap: '0.2in', sectionGap: '0.4in', lineHeight: 1.7 },
};

export const oceanAdventure: BookTheme = {
  id: 'ocean-adventure',
  name: 'Ocean Adventure',
  colors: {
    primary: '#023e8a',
    secondary: '#0077b6',
    accent: '#ffb703',
    background: '#f0f8ff',
    surface: '#caf0f8',
    text: '#03045e',
    textMuted: '#48639c',
    border: '#90e0ef',
  },
  fonts: {
    heading: { family: "'Bubblegum Sans', 'Comic Sans MS', cursive", weight: '400' },
    body: { family: "'Quicksand', 'Trebuchet MS', sans-serif", weight: '500', size: '17pt' },
    caption: { family: "'Quicksand', sans-serif", weight: '400', size: '11pt' },
  },
  spacing: { pageMarginScale: 0.8, paragraphGap: '0.2in', sectionGap: '0.5in', lineHeight: 1.7 },
};

export const candyPastel: BookTheme = {
  id: 'candy-pastel',
  name: 'Candy Pastel',
  colors: {
    primary: '#c77dba',
    secondary: '#e8a4c8',
    accent: '#ff6b9d',
    background: '#fff5f7',
    surface: '#fce4ec',
    text: '#4a1942',
    textMuted: '#8e6587',
    border: '#f3c4d8',
  },
  fonts: {
    heading: { family: "'Baloo 2', 'Arial Rounded MT Bold', sans-serif", weight: '700' },
    body: { family: "'Nunito', 'Trebuchet MS', sans-serif", weight: '400', size: '17pt' },
    caption: { family: "'Nunito', sans-serif", weight: '300', size: '11pt' },
  },
  spacing: { pageMarginScale: 0.85, paragraphGap: '0.18in', sectionGap: '0.4in', lineHeight: 1.65 },
};

// ── Cookbook Themes ──

export const rusticKitchen: BookTheme = {
  id: 'rustic-kitchen',
  name: 'Rustic Kitchen',
  colors: {
    primary: '#6b3a2a',
    secondary: '#a0522d',
    accent: '#d4a574',
    background: '#fdf6e3',
    surface: '#f5e6d3',
    text: '#3e2723',
    textMuted: '#795548',
    border: '#d7ccc8',
  },
  fonts: {
    heading: { family: "'Playfair Display', Georgia, serif", weight: '700' },
    body: { family: "'Source Serif Pro', 'Palatino Linotype', serif", weight: '400' },
    caption: { family: "'Source Sans Pro', sans-serif", weight: '400', size: '9pt' },
  },
  spacing: { pageMarginScale: 1, paragraphGap: '0.12in', sectionGap: '0.5in', lineHeight: 1.55 },
};

export const modernMinimalist: BookTheme = {
  id: 'modern-minimalist',
  name: 'Modern Minimalist',
  colors: {
    primary: '#212121',
    secondary: '#424242',
    accent: '#00bcd4',
    background: '#ffffff',
    surface: '#fafafa',
    text: '#212121',
    textMuted: '#9e9e9e',
    border: '#e0e0e0',
  },
  fonts: {
    heading: { family: "'Inter', 'Helvetica Neue', sans-serif", weight: '600', letterSpacing: '-0.01em' },
    body: { family: "'Inter', 'Helvetica Neue', sans-serif", weight: '400' },
    caption: { family: "'Inter', sans-serif", weight: '300', size: '8pt' },
  },
  spacing: { pageMarginScale: 1.1, paragraphGap: '0.15in', sectionGap: '0.6in', lineHeight: 1.6 },
};

export const warmHarvest: BookTheme = {
  id: 'warm-harvest',
  name: 'Warm Harvest',
  colors: {
    primary: '#bf360c',
    secondary: '#e64a19',
    accent: '#ffc107',
    background: '#fff8e1',
    surface: '#ffecb3',
    text: '#3e2723',
    textMuted: '#795548',
    border: '#ffe0b2',
  },
  fonts: {
    heading: { family: "'Libre Baskerville', 'Palatino Linotype', serif", weight: '700' },
    body: { family: "'Lora', Georgia, serif", weight: '400' },
    caption: { family: "'Open Sans', sans-serif", weight: '400', size: '9pt' },
  },
  spacing: { pageMarginScale: 1, paragraphGap: '0.14in', sectionGap: '0.5in', lineHeight: 1.6 },
};

// ── Novel Themes ──

export const classicLiterary: BookTheme = {
  id: 'classic-literary',
  name: 'Classic Literary',
  colors: {
    primary: '#1a1a2e',
    secondary: '#16213e',
    accent: '#8b0000',
    background: '#fffff5',
    surface: '#f5f5dc',
    text: '#1a1a2e',
    textMuted: '#555555',
    border: '#d4c5a9',
  },
  fonts: {
    heading: { family: "'Cormorant Garamond', 'Garamond', serif", weight: '600' },
    body: { family: "'EB Garamond', 'Garamond', serif", weight: '400', size: '12pt' },
    caption: { family: "'Cormorant', serif", weight: '400', size: '9pt', style: 'italic' },
  },
  spacing: { pageMarginScale: 1.15, paragraphGap: '0in', sectionGap: '0.75in', lineHeight: 1.5 },
};

export const darkAcademia: BookTheme = {
  id: 'dark-academia',
  name: 'Dark Academia',
  colors: {
    primary: '#2c1810',
    secondary: '#4a3728',
    accent: '#c9a959',
    background: '#f4ede4',
    surface: '#e8ddd0',
    text: '#2c1810',
    textMuted: '#6d5d4e',
    border: '#c4b5a2',
  },
  fonts: {
    heading: { family: "'Crimson Pro', 'Palatino Linotype', serif", weight: '700' },
    body: { family: "'Crimson Pro', 'Palatino Linotype', serif", weight: '400', size: '11.5pt' },
    caption: { family: "'Spectral', serif", weight: '400', size: '9pt' },
  },
  spacing: { pageMarginScale: 1.1, paragraphGap: '0in', sectionGap: '0.75in', lineHeight: 1.55 },
};

export const elegantSerif: BookTheme = {
  id: 'elegant-serif',
  name: 'Elegant Serif',
  colors: {
    primary: '#1b1b3a',
    secondary: '#3b3b6d',
    accent: '#b8860b',
    background: '#ffffff',
    surface: '#f7f7f7',
    text: '#1b1b3a',
    textMuted: '#666680',
    border: '#d5d5e0',
  },
  fonts: {
    heading: { family: "'Didot', 'Bodoni MT', 'Playfair Display', serif", weight: '400', letterSpacing: '0.05em', textTransform: 'uppercase' },
    body: { family: "'Minion Pro', 'Adobe Caslon Pro', Georgia, serif", weight: '400', size: '11pt' },
    caption: { family: "'Didot', serif", weight: '400', size: '8pt', style: 'italic' },
  },
  spacing: { pageMarginScale: 1.2, paragraphGap: '0in', sectionGap: '1in', lineHeight: 1.5 },
};

// ── Journal Themes ──

export const cleanMonochrome: BookTheme = {
  id: 'clean-monochrome',
  name: 'Clean Monochrome',
  colors: {
    primary: '#000000',
    secondary: '#333333',
    accent: '#666666',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#000000',
    textMuted: '#888888',
    border: '#cccccc',
  },
  fonts: {
    heading: { family: "'Montserrat', 'Helvetica Neue', sans-serif", weight: '600' },
    body: { family: "'Montserrat', 'Helvetica Neue', sans-serif", weight: '300' },
    caption: { family: "'Montserrat', sans-serif", weight: '300', size: '8pt' },
  },
  spacing: { pageMarginScale: 1, paragraphGap: '0.15in', sectionGap: '0.5in', lineHeight: 1.6 },
};

export const softPastel: BookTheme = {
  id: 'soft-pastel',
  name: 'Soft Pastel',
  colors: {
    primary: '#6c5b7b',
    secondary: '#c06c84',
    accent: '#f67280',
    background: '#fef9ff',
    surface: '#f8e8ee',
    text: '#355070',
    textMuted: '#8a7e90',
    border: '#e6d5e8',
  },
  fonts: {
    heading: { family: "'Poppins', 'Segoe UI', sans-serif", weight: '600' },
    body: { family: "'Poppins', 'Segoe UI', sans-serif", weight: '300' },
    caption: { family: "'Poppins', sans-serif", weight: '300', size: '8pt' },
  },
  spacing: { pageMarginScale: 1, paragraphGap: '0.15in', sectionGap: '0.5in', lineHeight: 1.65 },
};

// ── Puzzle Themes ──

export const playfulBright: BookTheme = {
  id: 'playful-bright',
  name: 'Playful Bright',
  colors: {
    primary: '#e63946',
    secondary: '#457b9d',
    accent: '#f4a261',
    background: '#f1faee',
    surface: '#a8dadc',
    text: '#1d3557',
    textMuted: '#457b9d',
    border: '#a8dadc',
  },
  fonts: {
    heading: { family: "'Rubik', 'Arial', sans-serif", weight: '700' },
    body: { family: "'Rubik', 'Arial', sans-serif", weight: '400' },
    caption: { family: "'Rubik', sans-serif", weight: '400', size: '10pt' },
  },
  spacing: { pageMarginScale: 0.9, paragraphGap: '0.12in', sectionGap: '0.35in', lineHeight: 1.5 },
};

export const classicPuzzle: BookTheme = {
  id: 'classic-puzzle',
  name: 'Classic Puzzle',
  colors: {
    primary: '#2b2d42',
    secondary: '#8d99ae',
    accent: '#ef233c',
    background: '#ffffff',
    surface: '#edf2f4',
    text: '#2b2d42',
    textMuted: '#8d99ae',
    border: '#d3d8de',
  },
  fonts: {
    heading: { family: "'Roboto Slab', 'Georgia', serif", weight: '700' },
    body: { family: "'Roboto', 'Arial', sans-serif", weight: '400' },
    caption: { family: "'Roboto', sans-serif", weight: '400', size: '9pt' },
  },
  spacing: { pageMarginScale: 0.95, paragraphGap: '0.1in', sectionGap: '0.3in', lineHeight: 1.5 },
};

// ── Generic Themes ──

export const modernSans: BookTheme = {
  id: 'modern-sans',
  name: 'Modern Sans',
  colors: {
    primary: '#111827',
    secondary: '#374151',
    accent: '#4f46e5',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textMuted: '#6b7280',
    border: '#e5e7eb',
  },
  fonts: {
    heading: { family: "'Inter', 'Helvetica Neue', sans-serif", weight: '700' },
    body: { family: "'Inter', 'Helvetica Neue', sans-serif", weight: '400' },
    caption: { family: "'Inter', sans-serif", weight: '400', size: '9pt' },
  },
  spacing: { pageMarginScale: 1, paragraphGap: '0.15in', sectionGap: '0.5in', lineHeight: 1.6 },
};

export const boldGraphic: BookTheme = {
  id: 'bold-graphic',
  name: 'Bold Graphic',
  colors: {
    primary: '#000000',
    secondary: '#ff3366',
    accent: '#ffcc00',
    background: '#ffffff',
    surface: '#f0f0f0',
    text: '#000000',
    textMuted: '#555555',
    border: '#000000',
  },
  fonts: {
    heading: { family: "'Oswald', 'Impact', sans-serif", weight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
    body: { family: "'Open Sans', 'Arial', sans-serif", weight: '400' },
    caption: { family: "'Open Sans', sans-serif", weight: '600', size: '8pt', textTransform: 'uppercase' },
  },
  spacing: { pageMarginScale: 0.9, paragraphGap: '0.15in', sectionGap: '0.5in', lineHeight: 1.5 },
};

// ── Theme Registry ──

export const allThemes: BookTheme[] = [
  // Children's
  whimsicalForest,
  oceanAdventure,
  candyPastel,
  // Cookbook
  rusticKitchen,
  modernMinimalist,
  warmHarvest,
  // Novel
  classicLiterary,
  darkAcademia,
  elegantSerif,
  // Journal
  cleanMonochrome,
  softPastel,
  // Puzzle
  playfulBright,
  classicPuzzle,
  // Generic
  modernSans,
  boldGraphic,
];

/** Map of theme IDs to themes */
export const themeRegistry: Record<string, BookTheme> = Object.fromEntries(
  allThemes.map((t) => [t.id, t])
);

/** Map of template names to recommended theme IDs */
export const themesByTemplate: Record<string, string[]> = {
  'children-book': ['whimsical-forest', 'ocean-adventure', 'candy-pastel'],
  'cookbook': ['rustic-kitchen', 'modern-minimalist', 'warm-harvest'],
  'novel': ['classic-literary', 'dark-academia', 'elegant-serif'],
  'journal': ['clean-monochrome', 'soft-pastel', 'modern-sans'],
  'puzzle-book': ['playful-bright', 'classic-puzzle', 'modern-sans'],
  'photo-book': ['modern-minimalist', 'clean-monochrome', 'bold-graphic'],
  'comic-book': ['bold-graphic', 'playful-bright', 'candy-pastel'],
  'portfolio': ['modern-sans', 'modern-minimalist', 'elegant-serif'],
};

/** Get a theme by ID */
export const getThemeById = (id: string): BookTheme | undefined => themeRegistry[id];

/** Get recommended themes for a template */
export const getThemesForTemplate = (templateName: string): BookTheme[] => {
  const ids = themesByTemplate[templateName] || ['modern-sans'];
  return ids.map((id) => themeRegistry[id]).filter(Boolean);
};
