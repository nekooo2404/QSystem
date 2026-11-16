import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokens } from '../src/tokens';

describe('tokens + styles', () => {
  it('exposes light/dark/high-contrast status tokens mirroring Fragment UI', () => {
    for (const mode of ['light', 'dark', 'highContrast'] as const) {
      const status = (tokens[mode] as { status: Record<string, unknown> }).status;
      expect(Object.keys(status).sort()).toEqual(['error', 'info', 'success', 'warning']);
    }
    // Spot-check Fragment values carried over exactly.
    expect(tokens.light.status.success.bg).toBe('#F0FDF4');
    expect(tokens.dark.status.error.fg).toBe('#FCA5A5');
    expect(tokens.highContrast.status.warning.base).toBe('#FFFF00');
  });

  it('ships the DESIGN.md Console Dark palette', () => {
    expect(tokens.dark.bg.base).toBe('#111418');
    expect(tokens.dark.bg.sidebar).toBe('#191D23');
    expect(tokens.dark.surface[1]).toBe('#191D23');
    expect(tokens.dark.bg.inverse).toBe('#0D1014');
    expect(tokens.dark.state.hover).toBe('#222731');
    expect(tokens.dark.state.selected).toBe('#252B36');
    expect(tokens.dark.border.base).toBe('#30363D');
    expect(tokens.dark.fg.base).toBe('#F3F4F6');
    expect(tokens.dark.fg.muted).toBe('#9CA3AF');
    expect(tokens.dark.brand.primary).toBe('#618DC9');
    expect(tokens.dark.brand.primaryInk).toBe('#091423');
    expect(tokens.dark.accent.red).toBe('#F85149');
    expect(tokens.dark.accent.green).toBe('#3FB950');
  });

  it('ships the DESIGN.md Cool Slate Light palette', () => {
    expect(tokens.light.bg.base).toBe('#F8FAFC');
    expect(tokens.light.bg.sidebar).toBe('#F1F5F9');
    expect(tokens.light.surface[1]).toBe('#FFFFFF');
    expect(tokens.light.bg.inverse).toBe('#F1F5F9');
    expect(tokens.light.state.hover).toBe('#E9EFF5');
    expect(tokens.light.state.selected).toBe('#E2E8F0');
    expect(tokens.light.border.base).toBe('#D5DCE4');
    expect(tokens.light.fg.base).toBe('#18181B');
    expect(tokens.light.fg.muted).toBe('#52525B');
    expect(tokens.light.brand.primary).toBe('#2C568F');
    expect(tokens.light.brand.primaryInk).toBe('#FFFFFF');
    expect(tokens.light.accent.red).toBe('#B91C1C');
    expect(tokens.light.accent.green).toBe('#15803D');
  });

  it('lifts layered colours (scrim, shadow, danger, info) into tokens', () => {
    expect(tokens.dark.brand.primaryHover).toBe('#759ED4');
    expect(tokens.light.brand.primaryHover).toBe('#234675');
    expect(tokens.dark.button.danger.bg).toBe('#B91C1C');
    expect(tokens.light.button.danger.text).toBe('#FFFFFF');
    expect(tokens.dark.overlay.scrim).toBe('rgb(8 10 14 / 0.68)');
    expect(tokens.dark.shadow.float).toContain('rgb(0 0 0 / 0.45)');
    expect(tokens.dark.status.info.base).toBe('#5B8DB8');
    expect(tokens.light.status.info.base).toBe('#2F6690');
  });

  it('ships reduced-motion-safe styles with visible focus', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(':focus-visible');
  });

  it('drives colours from [data-theme] variables instead of hardcoded legacy values', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toMatch(/\[data-theme=['"]dark['"]\]/);
    expect(css).toMatch(/\[data-theme=['"]light['"]\]/);
    expect(css).toContain('--qs-brand: #618dc9');
    expect(css.toLowerCase()).not.toContain('#6366f1');
    expect(css.toLowerCase()).not.toContain('#fafafa');
  });
});
