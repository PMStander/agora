export interface BookConfig {
  title: string;
  author: string;
  description?: string;
  dimensions: { width: number; height: number; unit: string };
  margins: { top: number; bottom: number; inner: number; outer: number };
  bleed?: number;
  dpi?: number;
}

export const config: BookConfig = {
  title: "The Little Explorer",
  author: "Sam Storyteller",
  description: "A children's picture book about a curious little adventurer",
  
  // Square format - perfect for children's books
  dimensions: { width: 8, height: 8, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 },
  bleed: 0.125,
  dpi: 300,
};
