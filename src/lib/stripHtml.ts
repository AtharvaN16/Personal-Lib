const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * Book descriptions from Open Library / Google Books frequently contain literal HTML markup
 * (<p>, <br>, <b>, <i>, etc.) as part of the source text. React never interprets it (no XSS
 * risk — it's just a string), but it renders as visible tag junk, so strip it at the source.
 *
 * Open Library's descriptions are also crowd-edited wiki text, which occasionally carries spam
 * — markdown-style links to unrelated "free PDF download" sites appended to otherwise-real
 * descriptions (e.g. "...while taking us to places it never dreamed of going. [Project Hail Mary
 * PDF](https://chesserresources.com/...)"). Strip those out along with any bare URLs.
 *
 * Google Books' publisher-submitted descriptions for special/deluxe editions also commonly lead
 * with a retailer blurb about the edition itself ("This book is also available as a limited
 * edition Deluxe HB with designed endpapers and sprayed edges") before the actual synopsis —
 * strip that formulaic sentence too.
 */
export function stripHtml(text: string | null | undefined): string | null {
  if (!text) return null;

  const withBreaks = text.replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, '\n');
  const withoutTags = withBreaks.replace(/<[^>]*>/g, '');
  const decoded = withoutTags.replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity);
  const withoutMarkdownLinks = decoded.replace(/\[([^\]]*)\]\(https?:\/\/[^\s)]+\)/gi, '');
  const withoutBareUrls = withoutMarkdownLinks.replace(/https?:\/\/\S+/gi, '');
  const withoutEditionBlurb = withoutBareUrls.replace(/This (?:book|title|edition) is also available[^\n]*\n*/gi, '');
  const collapsed = withoutEditionBlurb.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

  return collapsed || null;
}
