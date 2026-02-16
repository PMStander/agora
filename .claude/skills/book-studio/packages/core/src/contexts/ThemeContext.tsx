import React, { createContext, useContext, useMemo } from 'react';
import type { BookTheme, PartialBookTheme } from '../types.js';

// ── Default theme ──
export const defaultTheme: BookTheme = {
  id: 'default',
  name: 'Default',
  colors: {
    primary: '#1a1a2e',
    secondary: '#16213e',
    accent: '#e94560',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#1a1a2e',
    textMuted: '#6b7280',
    border: '#e5e7eb',
  },
  fonts: {
    heading: { family: 'Georgia, serif', weight: '700' },
    body: { family: 'Georgia, serif', weight: '400' },
    caption: { family: 'system-ui, sans-serif', weight: '400', size: '9pt' },
  },
  spacing: {
    pageMarginScale: 1,
    paragraphGap: '0.15in',
    sectionGap: '0.5in',
    lineHeight: 1.6,
  },
};

// ── Deep merge utility ──
function deepMerge<T extends Record<string, any>>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const baseVal = base[key];
    const overrideVal = override[key];

    if (
      baseVal &&
      overrideVal &&
      typeof baseVal === 'object' &&
      typeof overrideVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(baseVal, overrideVal as any);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal as any;
    }
  }
  return result;
}

// ── Context ──
const ThemeContext = createContext<BookTheme>(defaultTheme);

// ── Provider ──
export const ThemeProvider: React.FC<{
  theme?: BookTheme | PartialBookTheme;
  children: React.ReactNode;
}> = ({ theme, children }) => {
  const mergedTheme = useMemo<BookTheme>(() => {
    if (!theme) return defaultTheme;

    // If it's a full theme (has id), use it as base
    if ('id' in theme && 'name' in theme && 'colors' in theme && 'fonts' in theme && 'spacing' in theme) {
      return theme as BookTheme;
    }

    // Otherwise deep-merge partial theme onto default (cast needed: PartialBookTheme has nested partials)
    return deepMerge(defaultTheme, theme as any);
  }, [theme]);

  return (
    <ThemeContext.Provider value={mergedTheme}>
      {children}
    </ThemeContext.Provider>
  );
};

// ── Hooks ──

/** Get the full book theme */
export const useBookTheme = (): BookTheme => {
  return useContext(ThemeContext);
};

/** Get just the theme colors */
export const useThemeColors = () => {
  const theme = useContext(ThemeContext);
  return theme.colors;
};

/** Get just the theme fonts */
export const useThemeFonts = () => {
  const theme = useContext(ThemeContext);
  return theme.fonts;
};

/** Get just the theme spacing */
export const useThemeSpacing = () => {
  const theme = useContext(ThemeContext);
  return theme.spacing;
};
