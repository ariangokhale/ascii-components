/**
 * Color palettes for <AsciiGlobe />.
 *
 * The component only uses the glyph colors (ocean, land, ice, rim, stars). The page colors
 * (bg, fg, muted, rule, accent) are included so a page can theme itself to match the globe.
 *
 * On a light background dense characters such as "@" read as dark, so a light palette runs
 * from pale (shadow) to deep (lit) instead of from dim to bright.
 */

export interface AsciiGlobePalette {
  name: string;
  /** True for palettes meant for a light page background. */
  light?: boolean;

  /** Page colors, for the surrounding UI. The globe itself never paints a background. */
  bg: string;
  fg: string;
  muted: string;
  rule: string;
  accent: string;

  /** Open water, dimmest to brightest. Brightest also covers the sun glint. */
  ocean: [string, string, string, string];
  /** Land, dimmest to brightest. */
  land: [string, string, string, string];
  /** Polar ice and the Greenland ice sheet: darker, then lighter. */
  ice: [string, string];
  /** Thin atmosphere glow around the sunlit edge. */
  rim: string;
  /** Background stars: faint, then bright twinkle. */
  stars: [string, string];
}

export const PALETTES = {
  atlas: {
    name: "Atlas",
    bg: "#080d19", fg: "#d6dff0", muted: "#7c89a6", rule: "#1b2540", accent: "#e0b562",
    ocean: ["#22365c", "#34568f", "#4f7cc0", "#86aeea"],
    land: ["#6b4f27", "#a07637", "#d1a352", "#f4d48f"],
    ice: ["#8995b0", "#eef3fb"], rim: "#5f95d6", stars: ["#344060", "#93a3c6"],
  },
  phosphor: {
    name: "Phosphor",
    bg: "#050a07", fg: "#cfeadb", muted: "#6f9482", rule: "#14261c", accent: "#5dff9a",
    ocean: ["#0f3320", "#17603a", "#22934f", "#3ccf72"],
    land: ["#4b7a1c", "#7fb82a", "#b6ee4a", "#e4ffa0"],
    ice: ["#7aa88a", "#eafff0"], rim: "#2fb86a", stars: ["#1f3a2a", "#7fc89a"],
  },
  ember: {
    name: "Ember",
    bg: "#130806", fg: "#f0dcd2", muted: "#a07f72", rule: "#3a1d17", accent: "#ff8a5c",
    ocean: ["#3a1a14", "#6b2e1f", "#a8472b", "#e0704a"],
    land: ["#5a4a2a", "#8c7340", "#c9a867", "#f5e0a8"],
    ice: ["#b09890", "#fff0e8"], rim: "#e0704a", stars: ["#4a2c24", "#c8a090"],
  },
  neon: {
    name: "Neon",
    bg: "#0b0716", fg: "#e4dcf8", muted: "#8a7cb0", rule: "#251a45", accent: "#4fe3e0",
    ocean: ["#2a1850", "#4a2a8c", "#7a45d6", "#b08cff"],
    land: ["#0f6a7a", "#18a0b0", "#3fe0e0", "#b4ffff"],
    ice: ["#b0a0d8", "#f6f0ff"], rim: "#9a6cff", stars: ["#382860", "#b8a8ee"],
  },
  blueprint: {
    name: "Blueprint",
    bg: "#0b2a63", fg: "#e3ecfb", muted: "#8fa8d6", rule: "#25447f", accent: "#ffffff",
    ocean: ["#2a4f96", "#3f69b0", "#6b92d0", "#a9c6f0"],
    land: ["#bcd2f5", "#dbe8fb", "#f0f6ff", "#ffffff"],
    ice: ["#c8d8f4", "#ffffff"], rim: "#8fb4ec", stars: ["#2f559c", "#a9c2ea"],
  },
  mono: {
    name: "Mono",
    bg: "#0b0b0c", fg: "#dcdcdf", muted: "#85858c", rule: "#232326", accent: "#f2f2f2",
    ocean: ["#2a2a2d", "#45454a", "#6d6d74", "#a0a0a8"],
    land: ["#9a9a9e", "#c0c0c4", "#e0e0e2", "#ffffff"],
    ice: ["#c8c8cc", "#ffffff"], rim: "#8a8a92", stars: ["#3a3a3e", "#a0a0a6"],
  },
  daylight: {
    name: "Daylight",
    light: true,
    bg: "#ffffff", fg: "#0f2a5c", muted: "#5d7399", rule: "#d6e0f0", accent: "#1f5fd1",
    ocean: ["#c9d9f2", "#9fbbe6", "#6f97d9", "#3f73c9"],
    land: ["#5a7fc0", "#2f5fb5", "#17428f", "#0a2a66"],
    ice: ["#7fa3d6", "#3f6fb5"], rim: "#6f9be0", stars: ["#c9d8f0", "#5b86c8"],
  },
  midnight: {
    name: "Midnight",
    bg: "#000000", fg: "#cfe0ff", muted: "#6f88b8", rule: "#101a33", accent: "#4d8dff",
    ocean: ["#0a1f4d", "#123d8f", "#1f63d6", "#5b9bff"],
    land: ["#1b4fa8", "#3a7be0", "#7db4ff", "#d6e8ff"],
    ice: ["#9fc4ff", "#ffffff"], rim: "#2f6fe0", stars: ["#12224a", "#6a9be8"],
  },
} as const satisfies Record<string, AsciiGlobePalette>;

export type PaletteName = keyof typeof PALETTES;

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

export function resolvePalette(p: PaletteName | AsciiGlobePalette | undefined): AsciiGlobePalette {
  if (!p) return PALETTES.atlas;
  return typeof p === "string" ? PALETTES[p] ?? PALETTES.atlas : p;
}

/** CSS custom properties the globe's glyphs read their colors from. */
export function paletteVars(p: AsciiGlobePalette): Record<string, string> {
  return {
    "--ag-o1": p.ocean[0], "--ag-o2": p.ocean[1], "--ag-o3": p.ocean[2], "--ag-o4": p.ocean[3],
    "--ag-l1": p.land[0], "--ag-l2": p.land[1], "--ag-l3": p.land[2], "--ag-l4": p.land[3],
    "--ag-i1": p.ice[0], "--ag-i2": p.ice[1],
    "--ag-rm": p.rim,
    "--ag-s1": p.stars[0], "--ag-s2": p.stars[1],
    "--ag-fg": p.fg,
  };
}
