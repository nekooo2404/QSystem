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

  it('ships the DESIGN.md Graphite Dark palette', () => {
    expect(tokens.dark.bg.base).toBe('#111317');
    expect(tokens.dark.bg.sidebar).toBe('#0D0F12');
    expect(tokens.dark.surface[1]).toBe('#171A20');
    expect(tokens.dark.surface[2]).toBe('#1E222A');
    expect(tokens.dark.bg.inverse).toBe('#0B0D10');
    expect(tokens.dark.state.hover).toBe('#1F242C');
    expect(tokens.dark.state.selected).toBe('#252B35');
    expect(tokens.dark.border.base).toBe('rgb(238 240 245 / 0.09)');
    expect(tokens.dark.border.strong).toBe('rgb(238 240 245 / 0.16)');
    expect(tokens.dark.fg.base).toBe('#EEF0F5');
    expect(tokens.dark.fg.secondary).toBe('#A3A9B8');
    expect(tokens.dark.fg.muted).toBe('#8C95AB');
    expect(tokens.dark.brand.primary).toBe('#618DC9');
    expect(tokens.dark.brand.primaryInk).toBe('#091423');
    expect(tokens.dark.accent.red).toBe('#F06469');
    expect(tokens.dark.accent.green).toBe('#4CC38A');
  });

  it('ships the DESIGN.md Cool Slate Light palette', () => {
    expect(tokens.light.bg.base).toBe('#F6F8FB');
    expect(tokens.light.bg.sidebar).toBe('#EEF2F6');
    expect(tokens.light.surface[1]).toBe('#FFFFFF');
    expect(tokens.light.surface[2]).toBe('#F1F4F8');
    expect(tokens.light.bg.inverse).toBe('#F1F4F8');
    expect(tokens.light.state.hover).toBe('#EAEFF5');
    expect(tokens.light.state.selected).toBe('#E1E8F0');
    expect(tokens.light.border.base).toBe('rgb(17 24 39 / 0.09)');
    expect(tokens.light.border.strong).toBe('rgb(17 24 39 / 0.16)');
    expect(tokens.light.fg.base).toBe('#111827');
    expect(tokens.light.fg.secondary).toBe('#4B5565');
    expect(tokens.light.fg.muted).toBe('#596377');
    expect(tokens.light.brand.primary).toBe('#2C568F');
    expect(tokens.light.brand.primaryInk).toBe('#FFFFFF');
    expect(tokens.light.accent.red).toBe('#B91C1C');
    expect(tokens.light.accent.green).toBe('#157339');
  });

  it('lifts layered colours (scrim, shadow, danger, info) into tokens', () => {
    expect(tokens.dark.brand.primaryHover).toBe('#759ED4');
    expect(tokens.light.brand.primaryHover).toBe('#234675');
    expect(tokens.dark.button.danger.bg).toBe('#B91C1C');
    expect(tokens.light.button.danger.text).toBe('#FFFFFF');
    expect(tokens.dark.overlay.scrim).toBe('rgb(8 10 14 / 0.68)');
    expect(tokens.dark.shadow.float).toContain('rgb(0 0 0 / 0.40)');
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

  it('defines unified 4px spacing, nested radii, single easing, transitional aliases, and zero 700+ weights', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toContain('--qs-ease: cubic-bezier(0.22, 1, 0.36, 1);');
    expect(css).toContain('--qs-fg-secondary:');
    expect(css).toContain('--qs-surface-2:');
    expect(css).toContain('--qs-border-strong:');
    expect(css).toContain('--qs-space-1: 4px;');
    expect(css).toContain('--qs-radius-sm: 4px;');
    expect(css).toContain('--qs-radius-control: 8px;');
    expect(css).toContain('--qs-radius-card: 12px;');
    expect(css).toContain('--qs-radius-panel: 16px;');
    expect(css).toContain('--qs-float-shadow: var(--qs-shadow-floating);');
    expect(css).not.toMatch(/font-weight:\s*(700|800|900)/i);
    expect(css.toLowerCase()).not.toContain('transition: all');
  });

  it('meets WCAG 2.1 AA (>= 4.5:1) across light, dark, and highContrast tokens', () => {
    const hexToRgb = (hex: string): [number, number, number] => {
      const clean = hex.replace('#', '');
      return [
        Number.parseInt(clean.slice(0, 2), 16),
        Number.parseInt(clean.slice(2, 4), 16),
        Number.parseInt(clean.slice(4, 6), 16),
      ];
    };
    const luminance = (hex: string) => {
      const [r, g, b] = hexToRgb(hex).map((channel) => {
        const s = channel / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const l1 = luminance(a);
      const l2 = luminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    for (const mode of ['light', 'dark', 'highContrast'] as const) {
      const t = tokens[mode];
      const surfaces = [
        t.bg.base,
        t.bg.sidebar,
        t.bg.inverse,
        t.surface[1],
        t.surface[2],
        t.state.hover,
        t.state.selected,
      ];
      const foregrounds = [
        t.fg.base,
        t.fg.secondary,
        t.fg.muted,
        t.accent.green,
        t.accent.red,
        t.status.success.fg,
        t.status.error.fg,
        t.status.warning.fg,
        t.status.info.fg,
      ];

      for (const fg of foregrounds) {
        for (const bg of surfaces) {
          expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
        }
      }
      for (const status of Object.values(t.status)) {
        expect(contrast(status.fg, status.bg)).toBeGreaterThanOrEqual(4.5);
      }
      for (const btn of Object.values(t.button)) {
        expect(contrast(btn.text, btn.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(btn.text, btn.hover)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(t.brand.primaryInk, t.brand.primary)).toBeGreaterThanOrEqual(4.5);
      // Non-text brand indicator clears >= 3:1 even on selected surfaces in dark mode.
      expect(contrast(t.brand.primary, t.state.selected)).toBeGreaterThanOrEqual(3.0);
    }
  });
});
