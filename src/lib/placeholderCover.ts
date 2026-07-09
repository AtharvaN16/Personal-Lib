// A small curated palette (muted, warm-register colors already at home with the app's
// ink-and-paper design system) used to give books with no cover art a distinct, colorful
// stand-in instead of a blank white card.
const PLACEHOLDER_COLORS = [
  '#C77966', // terracotta
  '#6E8AA6', // dusty blue
  '#7C9885', // muted sage-green
  '#D4A373', // amber
  '#8C7BA3', // muted plum
  '#B0705C', // clay
];

function hashTitle(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministically picks a placeholder color for a book title, so the same book always gets the same color. */
export function getPlaceholderColor(title: string): string {
  return PLACEHOLDER_COLORS[hashTitle(title) % PLACEHOLDER_COLORS.length];
}

/** Darkens a hex color by a factor (0-1). */
function darkenColor(hex: string, factor: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((num >> 16) & 0xff) * (1 - factor));
  const g = Math.round(((num >> 8) & 0xff) * (1 - factor));
  const b = Math.round((num & 0xff) * (1 - factor));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** A darker shade of the same book's placeholder color, for a book-spine strip along the cover's left edge. */
export function getSpineColor(title: string): string {
  return darkenColor(getPlaceholderColor(title), 0.35);
}
