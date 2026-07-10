/**
 * Google's default Books API thumbnail URL (zoom=1, edge=curl) caps out around 128x190px and
 * overlays a curled-page graphic. zoom=0 returns the largest image Google has on file for the
 * volume (upwards of 800px wide when available) with a plain rectangular crop.
 */
export function upgradeGoogleBooksCover(url: string | null | undefined): string | null {
  if (!url) return null;
  let upgraded = url.replace(/([?&])zoom=\d+/, '$1zoom=0');
  upgraded = upgraded.replace(/[?&]edge=curl/, '');
  if (upgraded.startsWith('http://')) {
    upgraded = upgraded.replace('http://', 'https://');
  }
  return upgraded;
}

/**
 * When a volume has no large art on file, Google's content endpoint doesn't 404 — it silently
 * returns a generic "cover unavailable" graphic (served as PNG) with HTTP 200, so the zoom=0
 * upgrade above can't tell success from failure on its own. Real cover photos are always JPEG,
 * so a server-side HEAD request's Content-Type is a reliable, cheap way to tell them apart.
 * Browser callers can't do this check (books.google.com sends no CORS headers), so this is
 * server-only — use it from Server Components/routes, not client components.
 */
export async function resolveGoogleBooksCoverServer(thumbnailUrl: string | null | undefined): Promise<string | null> {
  const upgraded = upgradeGoogleBooksCover(thumbnailUrl);
  if (!upgraded) return null;

  try {
    const res = await fetch(upgraded, { method: 'HEAD', next: { revalidate: 86400 } });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.startsWith('image/jpeg')) {
      return upgraded;
    }
  } catch {
    // fall through to null — caller renders the app's own placeholder cover
  }
  return null;
}
