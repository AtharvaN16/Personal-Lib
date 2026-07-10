'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPrefs, setThemeColor as persistThemeColor, DEFAULT_THEME_COLOR } from '@/lib/userPrefs';

function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function applyThemeColor(color: string) {
  document.documentElement.style.setProperty('--accent-primary', color);
  document.documentElement.style.setProperty('--accent-primary-rgb', hexToRgbTriplet(color));
}

/** Loads the persisted theme color (Supabase profile for logged-in users, localStorage for guests), applies it to the CSS custom properties every accent-colored element reads from, and exposes a setter that updates the DOM, local state, and persistence together. */
export function useThemeColor(isGuest: boolean) {
  const [themeColor, setThemeColorState] = useState(DEFAULT_THEME_COLOR);

  useEffect(() => {
    let cancelled = false;
    getPrefs(isGuest).then((prefs) => {
      if (cancelled) return;
      setThemeColorState(prefs.themeColor);
      applyThemeColor(prefs.themeColor);
    });
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const setThemeColor = useCallback((color: string) => {
    setThemeColorState(color);
    applyThemeColor(color);
    persistThemeColor(isGuest, color);
  }, [isGuest]);

  return { themeColor, setThemeColor };
}
