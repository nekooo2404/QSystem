import { expect, test, type Page } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_EMAIL || 'e2e-director@qsystem.local';
const E2E_PASSWORD = process.env.E2E_PASSWORD || '';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const THEME_BG = {
  dark: 'rgb(17, 20, 24)',
  light: 'rgb(250, 248, 244)',
} as const;

const FORBIDDEN_RAW_TOKENS =
  /\b(DIRECTOR|MANAGER|EMPLOYEE|4W|PENDING|ANNOUNCEMENT|SHARING|KUDOS|QUESTION)\b/;

async function setTheme(page: Page, theme: 'dark' | 'light') {
  const current = await page.evaluate(() => document.documentElement.dataset.theme);
  if (current === theme) return;
  const toggleBtn = page.getByRole('button', { name: /Chuyển (?:sang )?giao diện/i }).first();
  await toggleBtn.click();
  await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
}

async function assertCleanLayoutAndTokens(page: Page, theme: 'dark' | 'light') {
  const metrics = await page.evaluate((expectedTheme) => {
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const sidebar = document.querySelector('aside');
    const sidebarBg = sidebar ? getComputedStyle(sidebar).backgroundColor : null;
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const visibleText = document.body.innerText || '';
    return {
      dataTheme: document.documentElement.dataset.theme,
      bodyBg,
      sidebarBg,
      overflow,
      visibleText,
      expectedTheme,
    };
  }, theme);

  expect(metrics.dataTheme).toBe(theme);
  expect(metrics.bodyBg).toBe(THEME_BG[theme]);
  if (theme === 'light' && metrics.sidebarBg && metrics.sidebarBg !== 'rgba(0, 0, 0, 0)') {
    expect(['rgb(244, 241, 234)', 'rgb(250, 248, 244)', 'rgb(255, 255, 255)']).toContain(
      metrics.sidebarBg,
    );
  }
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.visibleText).not.toMatch(FORBIDDEN_RAW_TOKENS);
}

test.describe('QSystem Console Responsive Dark/Light & Live Persistence E2E', () => {
  test.beforeAll(() => {
    if (!E2E_PASSWORD) {
      throw new Error('E2E_PASSWORD env var must be set before running Playwright E2E');
    }
  });

  test('login screen meets dark/light tokens and responsive geometry without overflow', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of ['dark', 'light'] as const) {
        await setTheme(page, theme);
        await assertCleanLayoutAndTokens(page, theme);
      }
    }

    expect(pageErrors).toEqual([]);
  });

  test('full authenticated flow: login -> QTask persistence -> QHRM create user -> Ctrl+K -> files -> notifications -> responsive dark/light', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await setTheme(page, 'dark');

    await page.getByLabel('Email công việc', { exact: true }).fill(E2E_EMAIL);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByRole('button', { name: 'Giao việc' })).toBeVisible();

    // 1. Create QTask & confirm Postgres persistence across full reload (including refresh cookie)
    const runSuffix = Date.now().toString().slice(-6);
    const taskTitle = `E2E Task ${runSuffix}`;
    await page.getByRole('button', { name: 'Giao việc' }).click();
    const taskDialog = page.getByRole('dialog');
    await expect(taskDialog).toBeVisible();

    await taskDialog.getByLabel('Tên công việc').fill(taskTitle);
    const assigneeSelect = taskDialog.getByLabel('Người phụ trách');
    let assigneeValue = '';
    await expect
      .poll(async () => {
        assigneeValue = await assigneeSelect
          .locator('option')
          .evaluateAll(
            (opts) => opts.find((o) => (o as HTMLOptionElement).value.length > 0)?.getAttribute('value') ?? '',
          );
        return assigneeValue;
      })
      .not.toBe('');
    await assigneeSelect.selectOption(assigneeValue);
    await taskDialog.getByLabel('Thời hạn').fill('20/11/2026');
    await taskDialog.getByRole('button', { name: 'Giao việc' }).click();
    await expect(taskDialog).toBeHidden();
    await expect(page.getByText(taskTitle).first()).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(taskTitle).first()).toBeVisible();

    // Check responsive Dark + Light viewports on QTask
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of ['dark', 'light'] as const) {
        await setTheme(page, theme);
        await assertCleanLayoutAndTokens(page, theme);
      }
    }

    // 2. Navigate to QHRM (/org) and create real staff member via POST /api/org/users
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(page, 'light');
    await page.goto('/org');
    await expect(page.getByRole('button', { name: 'Thêm nhân sự' })).toBeVisible();
    await assertCleanLayoutAndTokens(page, 'light');

    const newStaffEmail = `e2e-staff-${runSuffix}@qsystem.local`;
    const newStaffName = `Trần E2E ${runSuffix}`;
    await page.getByRole('button', { name: 'Thêm nhân sự' }).click();
    const userDialog = page.getByRole('dialog');
    await expect(userDialog).toBeVisible();
    await userDialog.getByLabel('Họ tên').fill(newStaffName);
    await userDialog.getByLabel('Email').fill(newStaffEmail);
    await userDialog.getByLabel('Mật khẩu tạm').fill('StaffPass!2026');
    await userDialog.getByRole('button', { name: 'Tạo nhân sự' }).click();
    await expect(userDialog).toBeHidden();
    await expect(page.getByText(newStaffName).first()).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(newStaffName).first()).toBeVisible();

    // Check responsive Dark + Light viewports on QHRM
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of ['dark', 'light'] as const) {
        await setTheme(page, theme);
        await assertCleanLayoutAndTokens(page, theme);
      }
    }

    // 3. Global Ctrl+K Command Palette
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole('button', { name: /Tìm việc/i })).toBeVisible();
    await page.keyboard.press('Control+k');
    const paletteDialog = page.getByRole('dialog');
    await expect(paletteDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(paletteDialog).toBeHidden();

    // 4. Files page persists seeded file list after reload
    await page.goto('/files');
    await expect(page.getByText('ke-hoach-nam.pdf').first()).toBeVisible();
    await setTheme(page, 'dark');
    await assertCleanLayoutAndTokens(page, 'dark');

    // 5. Notifications page persists readAt state on backend (auto markAllRead on open)
    await page.goto('/notifications');
    await expect(page.getByText('Yêu cầu duyệt ngân sách quý 4').first()).toBeVisible();
    await expect(page.locator('.qs-notifications__item[data-unread="false"]').first()).toBeVisible();
    await expect(page.locator('.qs-notifications__item[data-unread="true"]')).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Yêu cầu duyệt ngân sách quý 4').first()).toBeVisible();
    await expect(page.locator('.qs-notifications__item[data-unread="false"]').first()).toBeVisible();
    await expect(page.locator('.qs-notifications__item[data-unread="true"]')).toHaveCount(0);

    // 6. QSocial internal network (/social): publish post, like, comment, reload persistence + Dark/Light viewports
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(page, 'dark');
    await page.goto('/social');
    await expect(
      page.getByText('Thông báo triển khai kế hoạch vận hành quý 4 trên toàn hệ thống QSystem.').first(),
    ).toBeVisible();
    await assertCleanLayoutAndTokens(page, 'dark');

    const postText = `Cập nhật bảng tin nội bộ E2E ${runSuffix}`;
    const commentText = `Bình luận xác nhận E2E ${runSuffix}`;
    await page.getByLabel('Nội dung bài viết').fill(postText);
    await page.getByLabel('Chủ đề bài viết').selectOption('KUDOS');
    await page.getByRole('button', { name: 'Đăng bài' }).click();

    const newPostArticle = page.locator('article.qsc-post', { hasText: postText }).first();
    await expect(newPostArticle).toBeVisible();
    await newPostArticle.getByRole('button', { name: /Thích \(0\)/ }).click();
    await expect(newPostArticle.getByRole('button', { name: /Đã thích \(1\)/ })).toBeVisible();

    await newPostArticle.getByPlaceholder('Viết bình luận trao đổi').fill(commentText);
    await newPostArticle.getByRole('button', { name: 'Gửi' }).click();
    await expect(newPostArticle.getByText(commentText)).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloadedPostArticle = page.locator('article.qsc-post', { hasText: postText }).first();
    await expect(reloadedPostArticle).toBeVisible();
    await expect(reloadedPostArticle.getByRole('button', { name: /Đã thích \(1\)/ })).toBeVisible();
    await expect(reloadedPostArticle.getByText(commentText)).toBeVisible();

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of ['dark', 'light'] as const) {
        await setTheme(page, theme);
        await assertCleanLayoutAndTokens(page, theme);
      }
    }

    expect(pageErrors).toEqual([]);
  });
});
