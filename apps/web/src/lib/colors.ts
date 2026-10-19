/** Relative luminance of a "#rrggbb" color (WCAG). */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#10131a';

/** White or near-black, whichever reads better on the given background color. */
export function readableTextColor(background: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(background)) return LIGHT_TEXT;
  return contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT)
    ? LIGHT_TEXT
    : DARK_TEXT;
}

function hashString(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h * 33) ^ value.charCodeAt(i)) >>> 0;
  return h;
}

const LABEL_HUES = [262, 200, 155, 35, 345, 95, 225, 15] as const;

/** A stable hue (degrees) for a label name, picked from a curated set of distinct hues. */
export function labelHue(label: string): number {
  return LABEL_HUES[hashString(label.trim().toLowerCase()) % LABEL_HUES.length]!;
}

/** Initials for a name when the API does not provide them ("Maya Chen" -> "MC"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]! : '';
  return (Array.from(first)[0]! + (last ? Array.from(last)[0]! : '')).toUpperCase();
}
