import { createClient } from '@/lib/supabase/client';

export interface LocationPref {
  id: string;
  room: string;
  bookshelf: string;
}

export type DecorationStyle = 'wavy' | 'dotted' | 'stitched' | 'scribble';

export interface UserPrefs {
  themeColor: string;
  defaultLocation: LocationPref | null;
  decorationStyle: DecorationStyle;
}

export const DEFAULT_THEME_COLOR = '#002CBC';
export const DEFAULT_DECORATION_STYLE: DecorationStyle = 'wavy';

function readGuestDefaultLocation(): LocationPref | null {
  try {
    const id = localStorage.getItem('defaultLocationId');
    const objStr = localStorage.getItem('defaultLocationObj');
    if (!id || !objStr) return null;
    const obj = JSON.parse(objStr) as { room: string; bookshelf: string };
    return { id, room: obj.room, bookshelf: obj.bookshelf };
  } catch {
    return null;
  }
}

/** Reads both preferences. Guests read from localStorage; logged-in users read their `profiles` row (joined to `shelves` for the default location's display fields). */
export async function getPrefs(isGuest: boolean): Promise<UserPrefs> {
  if (isGuest) {
    let themeColor = DEFAULT_THEME_COLOR;
    let decorationStyle: DecorationStyle = DEFAULT_DECORATION_STYLE;
    try {
      themeColor = localStorage.getItem('guest_theme_color') || DEFAULT_THEME_COLOR;
      decorationStyle = (localStorage.getItem('guest_decoration_style') as DecorationStyle) || DEFAULT_DECORATION_STYLE;
    } catch {
      // localStorage unavailable — fall back to defaults
    }
    return { themeColor, defaultLocation: readGuestDefaultLocation(), decorationStyle };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { themeColor: DEFAULT_THEME_COLOR, defaultLocation: null, decorationStyle: DEFAULT_DECORATION_STYLE };
  }

  const { data } = await supabase
    .from('profiles')
    .select('theme_color, default_location_id, decoration_style, shelf:default_location_id(id, room, bookshelf)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) {
    return { themeColor: DEFAULT_THEME_COLOR, defaultLocation: null, decorationStyle: DEFAULT_DECORATION_STYLE };
  }

  const shelf = (data.shelf as unknown) as { id: string; room: string; bookshelf: string } | null;

  return {
    themeColor: data.theme_color || DEFAULT_THEME_COLOR,
    defaultLocation: shelf ? { id: shelf.id, room: shelf.room, bookshelf: shelf.bookshelf } : null,
    decorationStyle: (data.decoration_style as DecorationStyle) || DEFAULT_DECORATION_STYLE,
  };
}

/** Persists the theme color only — never touches `default_location_id`, since Supabase upsert only updates the columns present in the payload. */
export async function setThemeColor(isGuest: boolean, color: string): Promise<void> {
  if (isGuest) {
    try {
      localStorage.setItem('guest_theme_color', color);
    } catch {
      // localStorage unavailable — nothing to persist
    }
    return;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .upsert({ user_id: user.id, theme_color: color }, { onConflict: 'user_id' });
}

/** Persists the decoration style only — never touches `theme_color` or `default_location_id`. */
export async function setDecorationStyle(isGuest: boolean, style: DecorationStyle): Promise<void> {
  if (isGuest) {
    try {
      localStorage.setItem('guest_decoration_style', style);
    } catch {
      // localStorage unavailable — nothing to persist
    }
    return;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .upsert({ user_id: user.id, decoration_style: style }, { onConflict: 'user_id' });
}

/** Persists the default scan location only — never touches `theme_color`. Pass `null` to clear it. */
export async function setDefaultLocation(isGuest: boolean, location: LocationPref | null): Promise<void> {
  if (isGuest) {
    try {
      if (location) {
        localStorage.setItem('defaultLocationId', location.id);
        localStorage.setItem('defaultLocationObj', JSON.stringify({ room: location.room, bookshelf: location.bookshelf }));
      } else {
        localStorage.removeItem('defaultLocationId');
        localStorage.removeItem('defaultLocationObj');
      }
    } catch {
      // localStorage unavailable — nothing to persist
    }
    return;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .upsert({ user_id: user.id, default_location_id: location?.id || null }, { onConflict: 'user_id' });
}
