import type { PaletteName } from "./types";

/**
 * Ready-made colour ramps.
 *
 * Hand-picked rather than generated from a single brand hex: an auto-generated
 * ramp nearly always goes muddy at the 700-900 end, and those are exactly the
 * steps the hero, footer and admin chrome sit on. Picking from eight known-good
 * ramps gives a client site that looks deliberate in two seconds.
 *
 * The keys match the Tailwind custom colours declared in globals.css, so a
 * swap only has to rewrite CSS variables — no class names change anywhere.
 */
export const PALETTES: Record<PaletteName, Record<string, string>> = {
  blue: {
    "50": "#eff8ff",
    "100": "#dbeffe",
    "200": "#bfe3fe",
    "300": "#93d2fd",
    "400": "#60b8fa",
    "500": "#3b99f5",
    "600": "#257bea",
    "700": "#1d64d7",
    "800": "#1e51ae",
    "900": "#1e4689",
    "950": "#172c54",
  },
  teal: {
    "50": "#f0fdfa",
    "100": "#ccfbf1",
    "200": "#99f6e4",
    "300": "#5eead4",
    "400": "#2dd4bf",
    "500": "#14b8a6",
    "600": "#0d9488",
    "700": "#0f766e",
    "800": "#115e59",
    "900": "#134e4a",
    "950": "#042f2e",
  },
  emerald: {
    "50": "#f0fdf4",
    "100": "#dcfce7",
    "200": "#bbf7d0",
    "300": "#86efac",
    "400": "#4ade80",
    "500": "#22c55e",
    "600": "#16a34a",
    "700": "#15803d",
    "800": "#166534",
    "900": "#14532d",
    "950": "#052e16",
  },
  amber: {
    "50": "#fffbeb",
    "100": "#fef3c7",
    "200": "#fde68a",
    "300": "#fcd34d",
    "400": "#fbbf24",
    "500": "#f59e0b",
    "600": "#d97706",
    "700": "#b45309",
    "800": "#92400e",
    "900": "#78350f",
    "950": "#451a03",
  },
  orange: {
    "50": "#fff7ed",
    "100": "#ffedd5",
    "200": "#fed7aa",
    "300": "#fdba74",
    "400": "#fb923c",
    "500": "#f97316",
    "600": "#ea580c",
    "700": "#c2410c",
    "800": "#9a3412",
    "900": "#7c2d12",
    "950": "#431407",
  },
  violet: {
    "50": "#f5f3ff",
    "100": "#ede9fe",
    "200": "#ddd6fe",
    "300": "#c4b5fd",
    "400": "#a78bfa",
    "500": "#8b5cf6",
    "600": "#7c3aed",
    "700": "#6d28d9",
    "800": "#5b21b6",
    "900": "#4c1d95",
    "950": "#2e1065",
  },
  rose: {
    "50": "#fff1f2",
    "100": "#ffe4e6",
    "200": "#fecdd3",
    "300": "#fda4af",
    "400": "#fb7185",
    "500": "#f43f5e",
    "600": "#e11d48",
    "700": "#be123c",
    "800": "#9f1239",
    "900": "#881337",
    "950": "#4c0519",
  },
  slate: {
    "50": "#f8fafc",
    "100": "#f1f5f9",
    "200": "#e2e8f0",
    "300": "#cbd5e1",
    "400": "#94a3b8",
    "500": "#64748b",
    "600": "#475569",
    "700": "#334155",
    "800": "#1e293b",
    "900": "#0f172a",
    "950": "#020617",
  },
};

/**
 * CSS text that repoints the primary and accent ramps at the chosen palettes.
 *
 * Emitted unlayered in a <style> tag, which is what makes this work at all:
 * Tailwind v4 puts @theme variables in `@layer theme`, and any unlayered rule
 * beats a layered one no matter where it sits in the document or how specific
 * it is. So globals.css keeps a sensible default ramp — the site still looks
 * right with JavaScript or this tag missing — and the config wins at runtime
 * without a rebuild or a single changed class name.
 */
export function themeCss(primary: PaletteName, accent: PaletteName): string {
  const vars = [
    ...Object.entries(PALETTES[primary]).map(
      ([step, hex]) => `--color-primary-${step}:${hex}`
    ),
    ...Object.entries(PALETTES[accent]).map(
      ([step, hex]) => `--color-accent-${step}:${hex}`
    ),
  ];
  return `:root{${vars.join(";")}}`;
}
