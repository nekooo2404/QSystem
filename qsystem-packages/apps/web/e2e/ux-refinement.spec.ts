import { expect, test, type Page } from '@playwright/test';

// Deterministic browser fixtures exercise the real app and middleware. They do
// not replace the separate seeded-service persistence suite.
const sample = 'Nguyễn Minh Tuấn, Trễ hạn, Tổ chức & Nhân sự';
const me = { id: 'u-1', name: sample, email: `${'nguyenminhtuan'.repeat(9)}@qsystem.test`, role: 'DIRECTOR', departmentId: 'd-1', managedDepartmentIds: ['d-1'] };
const task = { id: 't-1', code: 'CV-1042', title: `Rà soát danh sách chi nhánh quý 4 — ${sample}`, assigneeId: me.id, assigneeName: 'Nguyễn Minh Tuấn', dueDate: '2026-11-20', departmentId: 'd-1', status: 'Đang làm' };
const notification = { id: 'n-1', channel: 'EMAIL', recipient: me.email, recipientId: me.id, payload: { title: sample }, status: 'SENT', attempts: 1, readAt: null, createdAt: '2026-11-14T06:00:00Z' };

async function fixtures(page: Page) {
  await page.context().addCookies([{ name: 'refresh_token', value: 'browser-fixture-only', url: test.info().project.use.baseURL || 'http://127.0.0.1:3000' }]);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/me' ? me
      : path === '/api/org/tasks' ? { items: [task], total: 1, page: 1, pageSize: 50 }
      : path === '/api/org/departments' ? [{ id: 'd-1', name: 'Phòng Kỹ thuật' }]
      : path === '/api/org/users' ? [me]
      : path === '/api/registry' ? []
      : path === '/api/files' ? [{ id: 'f-1', key: `uploads/${'Báo_cáo_nhân_sự_'.repeat(15)}.pdf` }]
      : path === '/api/notifications' ? Array.from({ length: 105 }, (_, i) => ({ ...notification, id: `n-${i + 1}` }))
      : path === '/api/notifications/read-all' ? { ok: true, count: 105, readAt: new Date().toISOString() }
      : path === '/api/search' ? { hits: [], total: 0, limit: 20, offset: 0 }
      : path === '/api/social/posts' ? { items: [], total: 0, page: 1, pageSize: 20 }
      : { ok: true };
    await route.fulfill({ json: body });
  });
}

async function assertGeometry(page: Page) {
  expect(await page.evaluate(() => {
    // Measure without the existing defensive clipping: it cannot hide a bug.
    const nodes = [document.documentElement, document.body];
    const before = nodes.map(el => el.style.overflowX);
    nodes.forEach(el => { el.style.overflowX = 'visible'; });
    const overflow = document.documentElement.scrollWidth - innerWidth;
    nodes.forEach((el, index) => { el.style.overflowX = before[index]; });
    return overflow;
  })).toBeLessThanOrEqual(1);
  for (const element of await page.locator('.qs-shell__top-actions > button, .qs-shell__top-actions > a, .qs-account > button, .qs-shell__search, .qs-shell__nav-toggle').all()) {
    const box = await element.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(box.y + box.height).toBeLessThanOrEqual(56);
    if (page.viewportSize()!.width === 390) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
  }
}

test.beforeEach(async ({ page }) => { await fixtures(page); });

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  for (const theme of ['dark', 'light']) {
    test(`UX-01/09 responsive ${viewport.width} ${theme}`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize(viewport);
      await page.addInitScript(value => localStorage.setItem('qsystem-theme', value), theme);
      for (const route of ['/', '/tasks', '/projects', '/org', '/account', '/files', '/notifications', '/social', '/crm', '/login']) {
        await page.goto(route);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        await assertGeometry(page);
        expect(await page.evaluate(() => devicePixelRatio)).toBe(1);
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(theme === 'dark' ? 'rgb(17, 20, 24)' : 'rgb(250, 248, 244)');
        if (route !== '/login' && viewport.width >= 1024) await expect(page.locator('aside.qs-shell__sidebar')).toBeVisible();
        await page.screenshot({ path: `test-results/ux-refinement-${route.slice(1) || 'tasks'}-${viewport.width}-${theme}.png` });
      }
      expect(errors).toEqual([]);
    });
  }
}

test('UX-01/02 boundary resize releases modal focus and keeps detail access', async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  const nav = page.getByRole('dialog', { name: 'Điều hướng', exact: true });
  await expect(nav).toBeVisible();
  for (let i = 0; i < 12; i++) { await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); expect(await nav.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(nav).toHaveCount(0);
  await expect(page.locator('aside.qs-shell__sidebar')).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  for (const width of [1025, 1279, 1280]) {
    await page.setViewportSize({ width, height: 768 });
    await page.getByRole('cell', { name: task.title, exact: true }).click();
    const detail = page.getByRole(width < 1280 ? 'dialog' : 'region', { name: task.title });
    await expect(detail).toBeVisible();
    if (width >= 1280) expect((await detail.boundingBox())!.width).toBe(390);
    await detail.getByRole('button', { name: 'Đóng chi tiết' }).click();
    await expect(detail).toHaveCount(0);
    await assertGeometry(page);
  }
});

test('UX-02/08 nested palette owns focus and Escape closes exactly one layer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Giao việc', exact: true });
  await trigger.click();
  const create = page.getByRole('dialog', { name: 'Giao việc mới' });
  await expect(create).toBeVisible();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Tìm nhanh', exact: true });
  await expect(palette).toBeVisible();
  for (let i = 0; i < 6; i++) { await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); expect(await palette.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
  await expect(create).toBeVisible();
  expect(await create.evaluate(el => el.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(create).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.locator('[inert]').count()).toBe(0);
  const account = page.getByRole('button', { name: 'Tài khoản', exact: true });
  await account.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Trang tài khoản' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Đăng xuất' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(account).toBeFocused();
});

test('UX-05 search rejection retries the current query; reduced motion stays static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let searches = 0;
  await page.route('**/api/search?*', route => { searches++; return route.fulfill(searches === 1 ? { status: 503, json: {} } : { json: { hits: [{ id: 'doc', title: 'Báo cáo quý IV' }], total: 1, limit: 20, offset: 0 } }); });
  await page.goto('/');
  await page.getByRole('button', { name: /Tìm việc, nhân sự/ }).click();
  const input = page.getByRole('combobox');
  await input.fill('Báo cáo');
  await expect(page.getByRole('alert')).toHaveText(/Chưa tìm được tài liệu/);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('option', { name: 'Báo cáo quý IV' })).toBeVisible();
  expect(searches).toBe(2);
  const styles = await input.evaluate(el => ({ transition: getComputedStyle(el).transitionDuration, outline: getComputedStyle(el).outlineWidth }));
  expect(styles.transition).toBe('0s'); expect(parseFloat(styles.outline)).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Escape');
  const button = page.getByRole('button', { name: 'Giao việc', exact: true });
  await button.focus(); await page.keyboard.down('Space');
  expect(await button.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.keyboard.up('Space');
});

test('UX-09 short viewport keeps focused create fields and close action reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Giao việc', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Giao việc mới' });
  const due = dialog.getByLabel('Thời hạn', { exact: true });
  await due.focus(); await due.scrollIntoViewIfNeeded();
  await expect(due).toBeInViewport();
  expect(await due.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
  const close = dialog.getByRole('button', { name: 'Đóng hộp thoại' });
  await close.scrollIntoViewIfNeeded(); await expect(close).toBeInViewport();
  await close.click(); await expect(dialog).toHaveCount(0);
});
