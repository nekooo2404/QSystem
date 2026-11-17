import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { waitForShellReady } from './ui-actions';

export interface ViewportSpec {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORT_MATRIX: readonly ViewportSpec[] = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x812', width: 375, height: 812 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const;

export const SCREENSHOT_VIEWPORTS: readonly ViewportSpec[] = [
  { name: '375x812', width: 375, height: 812 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;

export interface GeometryIssue {
  kind: 'overflow' | 'out-of-bounds' | 'clipped' | 'overlap';
  detail: string;
}

export async function assertViewportGeometry(
  page: Page,
  options: { checkOpenLayerOnly?: boolean } = {},
): Promise<void> {
  const overflowCheck = await page.evaluate(() => {
    const nodes = [document.documentElement, document.body];
    const previous = nodes.map((el) => ({
      hadStyle: el.hasAttribute('style'),
      overflowX: el.style.overflowX,
    }));
    nodes.forEach((el) => {
      el.style.overflowX = 'visible';
    });
    try {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    } finally {
      nodes.forEach((el, idx) => {
        el.style.overflowX = previous[idx].overflowX;
        if (!previous[idx].hadStyle && el.getAttribute('style') === '') {
          el.removeAttribute('style');
        }
      });
    }
  });

  expect(
    overflowCheck.scrollWidth,
    `Horizontal overflow detected: scrollWidth=${overflowCheck.scrollWidth} > innerWidth=${overflowCheck.innerWidth}`,
  ).toBeLessThanOrEqual(overflowCheck.innerWidth + 1);

  const issues = await page.evaluate((opts: { checkOpenLayerOnly: boolean }) => {
    const found: Array<{ kind: string; detail: string }> = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    function describeEl(el: Element): string {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const label =
        el.getAttribute('aria-label') ||
        (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `<${tag}${role ? ` role="${role}"` : ''}> "${label}"`;
    }

    function isHiddenOrInert(el: Element): boolean {
      let cur: Element | null = el;
      while (cur) {
        if (cur.hasAttribute('hidden') || cur.hasAttribute('inert')) return true;
        if (cur.getAttribute('aria-hidden') === 'true') return true;
        const style = window.getComputedStyle(cur);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    }

    function isInsideClosedMobileSidebar(el: Element): boolean {
      if (vw >= 1024) return false;
      const aside = el.closest('aside[aria-label="Điều hướng chính"]');
      if (!aside) return false;
      const closedShell = aside.closest('[data-nav="closed"]');
      if (closedShell) return true;
      const asideRect = aside.getBoundingClientRect();
      return asideRect.right <= 1;
    }

    function getHorizontalScrollAncestor(el: Element): Element | null {
      let cur = el.parentElement;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const style = window.getComputedStyle(cur);
        if (
          (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
          cur.scrollWidth > cur.clientWidth + 1
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    }

    function checkOverflowHiddenAncestors(el: Element, rect: DOMRect): void {
      let cur = el.parentElement;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const style = window.getComputedStyle(cur);
        if (
          style.overflowX === 'hidden' ||
          style.overflowX === 'clip' ||
          style.overflowY === 'hidden' ||
          style.overflowY === 'clip'
        ) {
          const pRect = cur.getBoundingClientRect();
          if (pRect.width > 0 && pRect.height > 0) {
            if (
              rect.left < pRect.left - 1.5 ||
              rect.right > pRect.right + 1.5 ||
              rect.top < pRect.top - 1.5 ||
              rect.bottom > pRect.bottom + 1.5
            ) {
              found.push({
                kind: 'clipped',
                detail: `${describeEl(el)} (${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)}) clipped by ${describeEl(cur)} (${Math.round(pRect.left)},${Math.round(pRect.top)},${Math.round(pRect.right)},${Math.round(pRect.bottom)})`,
              });
              return;
            }
          }
        }
        cur = cur.parentElement;
      }
    }

    // Check open floating surfaces (menus, listboxes, filter popovers) for viewport & ancestor clipping
    const floatingSurfaces = Array.from(
      document.querySelectorAll('[role="menu"], [role="listbox"], [role="region"][aria-label*="Bộ lọc"]'),
    ).filter((el) => !isHiddenOrInert(el));

    for (const surface of floatingSurfaces) {
      const rect = surface.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.left < -1 || rect.right > vw + 1 || rect.top < -1 || rect.bottom > vh + 1) {
        found.push({
          kind: 'out-of-bounds',
          detail: `Floating ${describeEl(surface)} exceeds viewport ${vw}x${vh}: [${Math.round(rect.left)}, ${Math.round(rect.top)}, ${Math.round(rect.right)}, ${Math.round(rect.bottom)}]`,
        });
      }
      checkOverflowHiddenAncestors(surface, rect);
    }

    // Determine active top layer root
    const openModals = Array.from(
      document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
    ).filter((el) => !isHiddenOrInert(el));

    let layerRoot: Element = document.body;
    if (floatingSurfaces.length > 0 && opts.checkOpenLayerOnly) {
      layerRoot = floatingSurfaces[floatingSurfaces.length - 1];
    } else if (openModals.length > 0) {
      layerRoot = openModals[openModals.length - 1];
    }

    const controlSelector =
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="combobox"], [role="menuitem"]';
    const rawControls = Array.from(layerRoot.querySelectorAll(controlSelector));

    interface BoxedControl {
      el: Element;
      rect: DOMRect;
      scrollAncestor: Element | null;
    }

    const activeControls: BoxedControl[] = [];
    const checkedScrollWrappers = new Set<Element>();

    for (const el of rawControls) {
      if (isHiddenOrInert(el)) continue;
      if (isInsideClosedMobileSidebar(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      // Visually-hidden checkbox/file inputs inside styled labels
      if (rect.width <= 2 && rect.height <= 2) continue;

      const scrollAncestor = getHorizontalScrollAncestor(el);
      if (scrollAncestor) {
        if (!checkedScrollWrappers.has(scrollAncestor)) {
          checkedScrollWrappers.add(scrollAncestor);
          const wrapRect = scrollAncestor.getBoundingClientRect();
          if (wrapRect.left < -1 || wrapRect.right > vw + 1) {
            found.push({
              kind: 'out-of-bounds',
              detail: `Scroll wrapper ${describeEl(scrollAncestor)} out of [0, ${vw}]: left=${Math.round(wrapRect.left)}, right=${Math.round(wrapRect.right)}`,
            });
          }
        }
      } else {
        if (rect.left < -1 || rect.right > vw + 1) {
          found.push({
            kind: 'out-of-bounds',
            detail: `Control ${describeEl(el)} out of [0, ${vw}]: left=${Math.round(rect.left)}, right=${Math.round(rect.right)}`,
          });
        }
      }

      activeControls.push({ el, rect, scrollAncestor });
    }

    // Layer-scoped pairwise overlap check (ignore ancestor/descendant and separate scroll containers)
    for (let i = 0; i < activeControls.length; i++) {
      const a = activeControls[i];
      for (let j = i + 1; j < activeControls.length; j++) {
        const b = activeControls[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (a.scrollAncestor !== b.scrollAncestor) continue;
        // Skip off-screen scrolled items inside a horizontal scroll wrapper
        if (a.scrollAncestor) {
          const wRect = a.scrollAncestor.getBoundingClientRect();
          if (
            a.rect.right < wRect.left ||
            a.rect.left > wRect.right ||
            b.rect.right < wRect.left ||
            b.rect.left > wRect.right
          ) {
            continue;
          }
        }
        const overlapX = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const overlapY = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (overlapX > 2 && overlapY > 2) {
          found.push({
            kind: 'overlap',
            detail: `Overlap (${Math.round(overlapX)}x${Math.round(overlapY)}px) between ${describeEl(a.el)} and ${describeEl(b.el)}`,
          });
        }
      }
    }

    return found;
  }, { checkOpenLayerOnly: Boolean(options.checkOpenLayerOnly) });

  expect(
    issues,
    `Viewport ${overflowCheck.innerWidth}px geometry issues:\n${issues.map((i) => `- [${i.kind}] ${i.detail}`).join('\n')}`,
  ).toEqual([]);
}

export function isScreenshotCaptureEnabled(): boolean {
  return process.env.CAPTURE_SCREENSHOTS === '1' || Boolean(process.env.CAPTURE_SCREENSHOTS_DIR);
}

export function resolveScreenshotDir(): string {
  if (process.env.CAPTURE_SCREENSHOTS_DIR) {
    return path.resolve(process.env.CAPTURE_SCREENSHOTS_DIR);
  }
  return path.resolve(__dirname, '../../test-results/redesign-screenshots');
}

export async function captureScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<string | null> {
  if (!isScreenshotCaptureEnabled()) return null;
  await waitForShellReady(page);
  const dir = resolveScreenshotDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({
    path: filePath,
    animations: 'disabled',
    fullPage: options.fullPage ?? true,
  });
  return filePath;
}
