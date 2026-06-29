// Light/dark theme hook. Respects OS preference on first load, then persists the
// user's explicit choice in localStorage. Applies `data-theme` on <html> so CSS
// variables can switch the whole palette.

import { useEffect, useState } from 'react';
import type { ThemeMode } from './types';
import { loadTheme, saveTheme } from './storage';

export function useTheme(): [ThemeMode, () => void] {
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return [theme, toggle];
}
