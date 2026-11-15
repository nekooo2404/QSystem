'use client';

import * as React from 'react';

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'qsystem-theme';

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // localStorage is the source of truth, not `data-theme`: React regenerates
  // the tree on a hydration mismatch and re-applies the SSR attribute, so
  // reading it back would silently return the server's "dark".
  // Server render and first client render both assume dark; the effect below
  // promotes the stored choice, and the <head> script has already painted it.
  const [theme, setThemeState] = React.useState<Theme>('dark');

  React.useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  // <html> belongs to React, and a hydration mismatch makes it re-apply the
  // attributes it rendered on the server — silently undoing the saved theme.
  // The effect below restores ours after each commit; the observer also
  // catches the overwrite that lands during React's own commit.
  React.useEffect(() => {
    if (document.documentElement.dataset.theme !== theme) applyTheme(theme);
  });

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (root.dataset.theme !== theme) root.dataset.theme = theme;
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode: theme just will not persist */
    }
  }, []);

  const toggle = React.useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [setTheme, theme]);

  const value = React.useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
