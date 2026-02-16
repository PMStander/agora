// Utility for referencing static files in the public directory
// Similar to Remotion's staticFile function

const isBrowser = typeof window !== 'undefined';

/**
 * Returns the correct path for a file in the public directory.
 * Handles both dev server paths and production builds.
 * 
 * @param filename - Path relative to public directory (e.g., 'assets/image.png')
 * @returns Complete URL or path to the file
 * 
 * @example
 * <img src={staticFile('assets/photo.png')} />
 */
export const staticFile = (filename: string): string => {
  // Remove leading slash if present
  const cleanPath = filename.replace(/^\//, '');
  
  if (isBrowser) {
    // In browser, files are served from public directory
    // Vite serves public files at root
    return `/${cleanPath}`;
  }
  
  // In Node/rendering context
  return cleanPath;
};

/**
 * Get the public directory path (for server-side rendering)
 */
export const getPublicDir = (): string => {
  return 'public';
};

/**
 * Check if a static file exists
 */
export const staticFileExists = async (filename: string): Promise<boolean> => {
  if (!isBrowser) {
    // Server-side check
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(getPublicDir(), filename);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
  
  // Client-side - try to fetch
  try {
    const response = await fetch(staticFile(filename), { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};
