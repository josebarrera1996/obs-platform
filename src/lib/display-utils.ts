/** Strip duplicate type prefix from service names (e.g. "ECS: prod-x" when type is ECS). */
export function getDisplayTitle(name: string, type: string): string {
  const prefix = `${type}: `;
  if (name.startsWith(prefix)) return name.slice(prefix.length);
  return name;
}

/** Header title: type + clean name without duplicated prefix. */
export function formatServiceHeaderTitle(name: string, type: string): string {
  return `${type}: ${getDisplayTitle(name, type)}`;
}

/** Recharts axis tick — foreground color, regular weight (readable in dark/light). */
export const CHART_AXIS_TICK = {
  fontSize: 11,
  fill: "var(--foreground)",
  fontWeight: 400,
} as const;

/** CSS color tokens for Recharts inline styles (vars are oklch, not hsl). */
export const CHART_THEME = {
  foreground: "var(--foreground)",
  mutedForeground: "var(--muted-foreground)",
  border: "var(--border)",
  card: "var(--card)",
} as const;
