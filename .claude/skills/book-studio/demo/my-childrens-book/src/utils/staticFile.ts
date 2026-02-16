export const staticFile = (filename: string): string => {
  // In Vite dev server, public files are served at root
  return `/${filename}`;
};
