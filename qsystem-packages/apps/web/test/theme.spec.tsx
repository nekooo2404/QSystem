import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '../src/lib/theme';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

function Probe() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme}
    </button>
  );
}

describe('ThemeProvider', () => {
  it('lets the stored theme win over a stale SSR data-theme after mount', () => {
    // Everything a reload of a light-preferring user sees: the <head> script
    // paints light, then React re-applies the value it rendered on the server.
    localStorage.setItem('qsystem-theme', 'light');
    const { rerender } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    // What React does on a hydration mismatch: re-write the root element with
    // the attributes it rendered on the server, after our effect has run.
    // jsdom has no MutationObserver here, so re-rendering must be enough by
    // itself — a theme that only survives an observer would still lose.
    act(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    rerender(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('defaults to dark when nothing is stored, and persists every toggle', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('qsystem-theme')).toBe('light');

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('qsystem-theme')).toBe('dark');
  });
});
