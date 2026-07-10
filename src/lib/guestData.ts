// Bump whenever GUEST_SHELVES or the server's curated guest book list changes shape/content —
// guests with an older version cached in localStorage get reseeded instead of stuck on stale data.
export const GUEST_DATA_VERSION = '2026-releases-v8-hardcoded-desc';

// Shared mock location data for guest sessions (2 rooms, 5 shelves total).
export const GUEST_SHELVES = [
  { id: 'guest-shelf-1', room: 'Living Room', bookshelf: 'Tall Shelf' },
  { id: 'guest-shelf-2', room: 'Living Room', bookshelf: 'Window Nook' },
  { id: 'guest-shelf-3', room: 'Living Room', bookshelf: 'Reading Corner' },
  { id: 'guest-shelf-4', room: 'Bedroom', bookshelf: 'Bedside Table' },
  { id: 'guest-shelf-5', room: 'Bedroom', bookshelf: 'Headboard Shelf' },
];
