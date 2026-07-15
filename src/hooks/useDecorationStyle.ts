'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getPrefs,
  setDecorationStyle as persistDecorationStyle,
  DEFAULT_DECORATION_STYLE,
  type DecorationStyle,
} from '@/lib/userPrefs';

function applyDecorationStyle(style: DecorationStyle) {
  document.documentElement.dataset.decoration = style;
}

/** Loads the persisted decoration style (Supabase profile for logged-in users, localStorage for guests), applies it as a `data-decoration` attribute on `<html>` that `globals.css` keys its underline rules off of, and exposes a setter that updates the DOM, local state, and persistence together. Mirrors useThemeColor.ts. */
export function useDecorationStyle(isGuest: boolean) {
  const [decorationStyle, setDecorationStyleState] = useState<DecorationStyle>(DEFAULT_DECORATION_STYLE);

  useEffect(() => {
    let cancelled = false;

    getPrefs(isGuest).then((prefs) => {
      if (cancelled) return;
      setDecorationStyleState(prefs.decorationStyle);
      applyDecorationStyle(prefs.decorationStyle);
    });

    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const setDecorationStyle = useCallback((style: DecorationStyle) => {
    setDecorationStyleState(style);
    applyDecorationStyle(style);
    persistDecorationStyle(isGuest, style);
  }, [isGuest]);

  return { decorationStyle, setDecorationStyle };
}
