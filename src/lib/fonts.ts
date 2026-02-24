export interface FontConfig {
  family: string;
  label: string;
  category: "sans-serif" | "serif" | "monospace" | "handwriting" | "display";
}

export const FONTS: readonly FontConfig[] = [
  { family: "Inter", label: "Inter", category: "sans-serif" },
  { family: "Oswald", label: "Oswald", category: "sans-serif" },
  { family: "Playfair Display", label: "Playfair", category: "serif" },
  { family: "Permanent Marker", label: "Marker", category: "handwriting" },
  { family: "Bebas Neue", label: "Bebas", category: "display" },
  { family: "Roboto Mono", label: "Mono", category: "monospace" },
  { family: "Pacifico", label: "Pacifico", category: "handwriting" },
  { family: "Anton", label: "Anton", category: "display" },
  { family: "Archivo Black", label: "Archivo", category: "sans-serif" },
  { family: "Satisfy", label: "Satisfy", category: "handwriting" },
  { family: "Press Start 2P", label: "Pixel", category: "display" },
  { family: "Righteous", label: "Righteous", category: "display" },
] as const;

/** Google Fonts URL to load all configured fonts */
export function getGoogleFontsUrl(): string {
  const families = FONTS.map(
    (f) => `family=${f.family.replace(/ /g, "+")}:wght@400;700`
  ).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
