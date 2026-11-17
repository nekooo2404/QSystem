import { test, expect } from '@playwright/test';

test('diagnose overflow elements', async ({ page }) => {
  await page.goto('/projects', { waitUntil: 'load' });
  await page.setViewportSize({ width: 375, height: 812 });

  const overflowElements = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.overflowX = 'visible';
    body.style.overflowX = 'visible';

    const vw = window.innerWidth;
    const elements = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while (node = walker.nextNode()) {
      if (node === html || node === body) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width > vw + 1 || rect.left < -1 || rect.right > vw + 1) {
        const style = window.getComputedStyle(node);
        elements.push({
          tag: node.tagName,
          className: node.className,
          role: node.getAttribute('role'),
          ariaLabel: node.getAttribute('aria-label'),
          rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
          overflowX: style.overflowX,
          width: style.width,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          text: (node.textContent || '').trim().slice(0, 60),
        });
      }
    }
    return elements.sort((a, b) => b.rect.width - a.rect.width);
  });

  console.log('OVERFLOW_COUNT:', overflowElements.length);
  console.log(JSON.stringify(overflowElements.slice(0, 15), null, 2));

  await page.evaluate(() => {
    document.documentElement.style.overflowX = '';
    document.body.style.overflowX = '';
  });
});
