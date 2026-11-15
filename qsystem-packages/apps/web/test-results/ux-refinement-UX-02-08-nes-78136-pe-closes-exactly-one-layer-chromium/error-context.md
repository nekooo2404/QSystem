# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ux-refinement.spec.ts >> UX-02/08 nested palette owns focus and Escape closes exactly one layer
- Location: e2e\ux-refinement.spec.ts:98:1

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  getByRole('button', { name: 'Giao việc', exact: true })
Expected: focused
Received: inactive
Timeout:  5000ms

Call log:
  - Expect "toBeFocused" getByRole('button', { name: 'Giao việc', exact: true }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Giao việc', exact: true })
    14 × locator resolved to <button type="button" data-size="md" data-variant="primary" class="qs-btn qs-btn--primary qs-btn--md">…</button>
       - unexpected value "inactive"

```

```yaml
- button "Giao việc"
```

# Test source

```ts
  16  |       : path === '/api/org/departments' ? [{ id: 'd-1', name: 'Phòng Kỹ thuật' }]
  17  |       : path === '/api/org/users' ? [me]
  18  |       : path === '/api/registry' ? []
  19  |       : path === '/api/files' ? [{ id: 'f-1', key: `uploads/${'Báo_cáo_nhân_sự_'.repeat(15)}.pdf` }]
  20  |       : path === '/api/notifications' ? Array.from({ length: 105 }, (_, i) => ({ ...notification, id: `n-${i + 1}` }))
  21  |       : path === '/api/notifications/read-all' ? { ok: true, count: 105, readAt: new Date().toISOString() }
  22  |       : path === '/api/search' ? { hits: [], total: 0, limit: 20, offset: 0 }
  23  |       : { ok: true };
  24  |     await route.fulfill({ json: body });
  25  |   });
  26  | }
  27  | 
  28  | async function assertGeometry(page: Page) {
  29  |   expect(await page.evaluate(() => {
  30  |     // Measure without the existing defensive clipping: it cannot hide a bug.
  31  |     const nodes = [document.documentElement, document.body];
  32  |     const before = nodes.map(el => el.style.overflowX);
  33  |     nodes.forEach(el => { el.style.overflowX = 'visible'; });
  34  |     const overflow = document.documentElement.scrollWidth - innerWidth;
  35  |     nodes.forEach((el, index) => { el.style.overflowX = before[index]; });
  36  |     return overflow;
  37  |   })).toBeLessThanOrEqual(1);
  38  |   for (const element of await page.locator('.qs-shell__top-actions > button, .qs-shell__top-actions > a, .qs-account > button, .qs-shell__search, .qs-shell__nav-toggle').all()) {
  39  |     const box = await element.boundingBox();
  40  |     if (!box) continue;
  41  |     expect(box.x).toBeGreaterThanOrEqual(0);
  42  |     expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  43  |     expect(box.y + box.height).toBeLessThanOrEqual(56);
  44  |     if (page.viewportSize()!.width === 390) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
  45  |   }
  46  | }
  47  | 
  48  | test.beforeEach(async ({ page }) => { await fixtures(page); });
  49  | 
  50  | for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  51  |   for (const theme of ['dark', 'light']) {
  52  |     test(`UX-01/09 responsive ${viewport.width} ${theme}`, async ({ page }) => {
  53  |       test.setTimeout(120_000);
  54  |       const errors: string[] = [];
  55  |       page.on('pageerror', error => errors.push(error.message));
  56  |       await page.setViewportSize(viewport);
  57  |       await page.addInitScript(value => localStorage.setItem('qsystem-theme', value), theme);
  58  |       for (const route of ['/', '/org', '/account', '/files', '/notifications', '/login']) {
  59  |         await page.goto(route);
  60  |         await expect(page.locator('h1')).toBeVisible();
  61  |         await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  62  |         await page.evaluate(() => document.fonts.ready);
  63  |         await assertGeometry(page);
  64  |         expect(await page.evaluate(() => devicePixelRatio)).toBe(1);
  65  |         expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(theme === 'dark' ? 'rgb(17, 20, 24)' : 'rgb(250, 248, 244)');
  66  |         if (route !== '/login' && viewport.width >= 1024) await expect(page.locator('aside.qs-shell__sidebar')).toBeVisible();
  67  |         await page.screenshot({ path: `../../artifacts/ux-codex-direct/screens/${route.slice(1) || 'tasks'}-${viewport.width}-${theme}.png` });
  68  |       }
  69  |       expect(errors).toEqual([]);
  70  |     });
  71  |   }
  72  | }
  73  | 
  74  | test('UX-01/02 boundary resize releases modal focus and keeps detail access', async ({ page }) => {
  75  |   await page.setViewportSize({ width: 1023, height: 768 });
  76  |   await page.goto('/');
  77  |   await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  78  |   const nav = page.getByRole('dialog', { name: 'Điều hướng', exact: true });
  79  |   await expect(nav).toBeVisible();
  80  |   for (let i = 0; i < 12; i++) { await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); expect(await nav.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  81  |   await page.setViewportSize({ width: 1024, height: 768 });
  82  |   await expect(nav).toHaveCount(0);
  83  |   await expect(page.locator('aside.qs-shell__sidebar')).toBeVisible();
  84  |   expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  85  |   expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  86  |   for (const width of [1025, 1279, 1280]) {
  87  |     await page.setViewportSize({ width, height: 768 });
  88  |     await page.getByRole('cell', { name: task.title, exact: true }).click();
  89  |     const detail = page.getByRole(width < 1280 ? 'dialog' : 'region', { name: task.title });
  90  |     await expect(detail).toBeVisible();
  91  |     if (width >= 1280) expect((await detail.boundingBox())!.width).toBe(390);
  92  |     await detail.getByRole('button', { name: 'Đóng chi tiết' }).click();
  93  |     await expect(detail).toHaveCount(0);
  94  |     await assertGeometry(page);
  95  |   }
  96  | });
  97  | 
  98  | test('UX-02/08 nested palette owns focus and Escape closes exactly one layer', async ({ page }) => {
  99  |   await page.setViewportSize({ width: 1440, height: 900 });
  100 |   await page.goto('/');
  101 |   const trigger = page.getByRole('button', { name: 'Giao việc', exact: true });
  102 |   await trigger.click();
  103 |   const create = page.getByRole('dialog', { name: 'Giao việc mới' });
  104 |   await expect(create).toBeVisible();
  105 |   await page.keyboard.press('Control+k');
  106 |   const palette = page.getByRole('dialog', { name: 'Tìm nhanh', exact: true });
  107 |   await expect(palette).toBeVisible();
  108 |   for (let i = 0; i < 6; i++) { await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); expect(await palette.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  109 |   await page.keyboard.press('Escape');
  110 |   await expect(palette).toHaveCount(0);
  111 |   await expect(create).toBeVisible();
  112 |   expect(await create.evaluate(el => el.contains(document.activeElement))).toBe(true);
  113 |   expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  114 |   await page.keyboard.press('Escape');
  115 |   await expect(create).toHaveCount(0);
> 116 |   await expect(trigger).toBeFocused();
      |                         ^ Error: expect(locator).toBeFocused() failed
  117 |   expect(await page.locator('[inert]').count()).toBe(0);
  118 |   const account = page.getByRole('button', { name: 'Tài khoản', exact: true });
  119 |   await account.focus(); await page.keyboard.press('ArrowDown');
  120 |   await expect(page.getByRole('menuitem', { name: 'Trang tài khoản' })).toBeFocused();
  121 |   await page.keyboard.press('End');
  122 |   await expect(page.getByRole('menuitem', { name: 'Đăng xuất' })).toBeFocused();
  123 |   await page.keyboard.press('Escape'); await expect(account).toBeFocused();
  124 | });
  125 | 
  126 | test('UX-05 search rejection retries the current query; reduced motion stays static', async ({ page }) => {
  127 |   await page.emulateMedia({ reducedMotion: 'reduce' });
  128 |   let searches = 0;
  129 |   await page.route('**/api/search?*', route => { searches++; return route.fulfill(searches === 1 ? { status: 503, json: {} } : { json: { hits: [{ id: 'doc', title: 'Báo cáo quý IV' }], total: 1, limit: 20, offset: 0 } }); });
  130 |   await page.goto('/');
  131 |   await page.getByRole('button', { name: /Tìm việc, nhân sự/ }).click();
  132 |   const input = page.getByRole('combobox');
  133 |   await input.fill('Báo cáo');
  134 |   await expect(page.getByRole('alert')).toHaveText(/Chưa tìm được tài liệu/);
  135 |   await page.getByRole('button', { name: 'Thử lại' }).click();
  136 |   await expect(page.getByRole('option', { name: 'Báo cáo quý IV' })).toBeVisible();
  137 |   expect(searches).toBe(2);
  138 |   const styles = await input.evaluate(el => ({ transition: getComputedStyle(el).transitionDuration, outline: getComputedStyle(el).outlineWidth }));
  139 |   expect(styles.transition).toBe('0s'); expect(styles.outline).toBe('2px');
  140 |   await page.keyboard.press('Escape');
  141 |   const button = page.getByRole('button', { name: 'Giao việc', exact: true });
  142 |   await button.focus(); await page.keyboard.down('Space');
  143 |   expect(await button.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  144 |   await page.keyboard.up('Space');
  145 | });
  146 | 
  147 | test('UX-09 short viewport keeps focused create fields and close action reachable', async ({ page }) => {
  148 |   await page.setViewportSize({ width: 390, height: 360 });
  149 |   await page.goto('/');
  150 |   await page.getByRole('button', { name: 'Giao việc', exact: true }).click();
  151 |   const dialog = page.getByRole('dialog', { name: 'Giao việc mới' });
  152 |   const due = dialog.getByLabel('Thời hạn', { exact: true });
  153 |   await due.focus(); await due.scrollIntoViewIfNeeded();
  154 |   await expect(due).toBeInViewport();
  155 |   expect(await due.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
  156 |   const close = dialog.getByRole('button', { name: 'Đóng hộp thoại' });
  157 |   await close.scrollIntoViewIfNeeded(); await expect(close).toBeInViewport();
  158 |   await close.click(); await expect(dialog).toHaveCount(0);
  159 | });
  160 | 
```