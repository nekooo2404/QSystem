import { expect, test, type Page } from '@playwright/test';
import { installApiMocks } from './fixtures/mock-api';
import {
  attachErrorCollectors,
  expectDetailDrawer,
  getAppAlert,
  seedTheme,
  selectCustomOption,
  setTheme,
  waitForShellReady,
  type ThemeMode,
} from './helpers/ui-actions';
import {
  assertViewportGeometry,
  captureScreenshot,
  isScreenshotCaptureEnabled,
  SCREENSHOT_VIEWPORTS,
  VIEWPORT_MATRIX,
} from './helpers/responsive';

const RESPONSIVE_ROUTES: readonly { slug: string; path: string; auth?: boolean }[] = [
  { slug: 'login', path: '/login', auth: false },
  { slug: 'qtask-all', path: '/' },
  { slug: 'qtask-overview', path: '/?muc=tong-quan' },
  { slug: 'qtask-mine', path: '/tasks' },
  { slug: 'qtask-projects', path: '/projects' },
  { slug: 'qhrm-directory', path: '/org' },
  { slug: 'qhrm-attendance', path: '/org?muc=cham-cong' },
  { slug: 'qcrm-customers', path: '/crm' },
  { slug: 'qcrm-reports', path: '/crm?muc=bao-cao' },
  { slug: 'qsocial-feed', path: '/social' },
  { slug: 'account', path: '/account' },
  { slug: 'files', path: '/files' },
  { slug: 'notifications', path: '/notifications' },
];

const SCREENSHOT_ROUTES: readonly { slug: string; path: string; auth?: boolean }[] = [
  { slug: 'login', path: '/login', auth: false },
  { slug: 'qtask-all', path: '/' },
  { slug: 'qtask-overview', path: '/?muc=tong-quan' },
  { slug: 'qtask-mine', path: '/tasks' },
  { slug: 'qtask-projects', path: '/projects' },
  { slug: 'qhrm-directory', path: '/org' },
  { slug: 'qhrm-overview', path: '/org?muc=tong-quan' },
  { slug: 'qhrm-attendance', path: '/org?muc=cham-cong' },
  { slug: 'qhrm-leave', path: '/org?muc=nghi-phep' },
  { slug: 'qcrm-customers', path: '/crm' },
  { slug: 'qcrm-overview', path: '/crm?muc=tong-quan' },
  { slug: 'qcrm-opportunities', path: '/crm?muc=co-hoi' },
  { slug: 'qcrm-contacts', path: '/crm?muc=lien-he' },
  { slug: 'qcrm-reports', path: '/crm?muc=bao-cao' },
  { slug: 'qsocial-feed', path: '/social' },
  { slug: 'account', path: '/account' },
  { slug: 'files', path: '/files' },
  { slug: 'notifications', path: '/notifications' },
];

async function navigateAndReady(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'load' });
  await waitForShellReady(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test.describe('F1: Auth & /login Flows', () => {
  test('validation, show/hide password, remember checkbox, theme toggle and SSO', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { unauthenticated: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/login');

    const submit = page.getByRole('button', { name: 'Đăng nhập', exact: true });
    await submit.click();
    await expect(getAppAlert(page)).toContainText('Vui lòng nhập email hợp lệ và mật khẩu.');

    const email = page.getByLabel('Email công việc', { exact: true });
    const password = page.getByLabel('Mật khẩu', { exact: true });
    await email.fill('khoi.nguyen@qsystem.vn');
    await password.fill('MatKhau123!');
    await expect(password).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
    await expect(password).toHaveAttribute('type', 'password');

    const remember = page.getByLabel('Ghi nhớ đăng nhập');
    await remember.check();
    await expect(remember).toBeChecked();

    await setTheme(page, 'light');
    await setTheme(page, 'dark');

    await expect(page.getByRole('button', { name: 'Google Workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Microsoft 365' })).toBeVisible();
    errors.assertNoRuntimeErrors();
  });

  test('forgot password modal validation, submission, Escape close and focus return', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { unauthenticated: true });
    await navigateAndReady(page, '/login');

    const trigger = page.getByRole('button', { name: 'Quên mật khẩu?' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Khôi phục mật khẩu' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Gửi yêu cầu' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Vui lòng nhập địa chỉ email công việc hợp lệ.');

    await dialog.getByLabel('Email nhận hướng dẫn').fill('khoi.nguyen@qsystem.vn');
    await dialog.getByRole('button', { name: 'Gửi yêu cầu' }).click();
    await expect(dialog.getByRole('status')).toContainText('Yêu cầu khôi phục mật khẩu đã được ghi nhận');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    errors.assertNoRuntimeErrors();
  });

  test('invalid credentials return 401 alert without redirect', async ({ page }) => {
    const errors = attachErrorCollectors(page, {
      allowConsolePatterns: [/status of 401/i],
    });
    await installApiMocks(page, { unauthenticated: true, failLogin401: true });
    await navigateAndReady(page, '/login');

    await page.getByLabel('Email công việc', { exact: true }).fill('wrong@qsystem.vn');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('wrongpass');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await expect(getAppAlert(page)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    errors.assertNoRuntimeErrors();
  });

  test('SSO button initiates session redirect in dev/demo mode', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    const state = await installApiMocks(page, { unauthenticated: true });
    await navigateAndReady(page, '/login');

    state.authenticated = true;
    await page.getByRole('button', { name: 'Google Workspace' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await waitForShellReady(page);
    errors.assertNoRuntimeErrors();
  });

  test('?auth=required&next=/org redirects to /login and preserves safe next redirect after login', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page, {
      allowConsolePatterns: [/status of 401/i],
    });
    await installApiMocks(page, { unauthenticated: true });

    await page.goto('/org?muc=phong-ban&auth=required', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?next=%2Forg%3Fmuc%3Dphong-ban%26auth%3Drequired/);

    await page.getByLabel('Email công việc', { exact: true }).fill('khoi.nguyen@qsystem.vn');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('MatKhau123!');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await page.waitForURL(/\/org\?muc=phong-ban/);
    await waitForShellReady(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    errors.assertNoRuntimeErrors();
  });

  test('open-redirect ?next=//evil.com sanitizes back to /', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { unauthenticated: true });
    await navigateAndReady(page, '/login?next=%2F%2Fevil.com');

    await page.getByLabel('Email công việc', { exact: true }).fill('khoi.nguyen@qsystem.vn');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('MatKhau123!');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await page.waitForURL((url) => url.pathname === '/');
    await waitForShellReady(page);
    errors.assertNoRuntimeErrors();
  });
});

test.describe('F2: Global Shell, AppLauncher, Ctrl+K, <Select> & Account', () => {
  test('sidebar navigation links and aria-current="page"', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/');

    const sidebar = page.getByRole('complementary', { name: 'Điều hướng chính' });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Tất cả công việc' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await sidebar.getByRole('link', { name: 'Dự án' }).click();
    await page.waitForURL(/\/projects$/);
    await waitForShellReady(page);
    await expect(sidebar.getByRole('link', { name: 'Dự án' })).toHaveAttribute('aria-current', 'page');

    const shortcuts = sidebar.getByRole('navigation', { name: 'Lối tắt' });
    await shortcuts.getByRole('link', { name: 'Tài liệu' }).click();
    await page.waitForURL(/\/files$/);
    await waitForShellReady(page);
    errors.assertNoRuntimeErrors();
  });

  test('mobile drawer opens and closes via backdrop click', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateAndReady(page, '/');

    const toggle = page.getByRole('button', { name: 'Mở điều hướng' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Click outside the left sidebar drawer on the backdrop area
    await page.mouse.click(355, 400);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    errors.assertNoRuntimeErrors();
  });

  test('mobile drawer closes with Escape key (post-M2 requirement)', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateAndReady(page, '/');

    const toggle = page.getByRole('button', { name: 'Mở điều hướng' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    errors.assertNoRuntimeErrors();
  });

  test('AppLauncher diacritic-less search, pin persistence across reload and navigation', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/');

    const launcherBtn = page.getByRole('button', { name: 'Mở App Launcher' });
    await launcherBtn.click();
    const dialog = page.getByRole('dialog', { name: 'App Launcher' });
    await expect(dialog).toBeVisible();

    const search = dialog.getByRole('searchbox', { name: 'Tìm ứng dụng hoặc chức năng' });
    await search.fill('cham cong');
    await expect(dialog.getByRole('link', { name: /QHRM/ })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /QCRM/ })).toHaveCount(0);

    await search.fill('khong-ton-tai-xyz');
    await expect(dialog.getByRole('status')).toContainText('Không tìm thấy');

    await dialog.getByRole('button', { name: 'Xóa tìm kiếm' }).click();
    const pinQcrm = dialog.getByRole('button', { name: 'Ghim QCRM' });
    await pinQcrm.click();
    await expect(dialog.getByRole('button', { name: 'Bỏ ghim QCRM' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForShellReady(page);
    await page.getByRole('button', { name: 'Mở App Launcher' }).click();
    await expect(
      page.getByRole('dialog', { name: 'App Launcher' }).getByRole('button', { name: 'Bỏ ghim QCRM' }),
    ).toBeVisible();

    await page.getByRole('dialog', { name: 'App Launcher' }).getByRole('link', { name: /QCRM/ }).click();
    await page.waitForURL(/\/crm/);
    await waitForShellReady(page);
    errors.assertNoRuntimeErrors();
  });

  test('AppLauncher hides QCRM for EMPLOYEE role', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'EMPLOYEE' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/');

    await page.getByRole('button', { name: 'Mở App Launcher' }).click();
    const dialog = page.getByRole('dialog', { name: 'App Launcher' });
    await expect(dialog.getByRole('link', { name: /QTask/ })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /QHRM/ })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /QSocial/ })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /QCRM/ })).toHaveCount(0);
    errors.assertNoRuntimeErrors();
  });

  test('Ctrl+K search, Arrow+Enter navigation, 503 retry and Escape layer isolation', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page, {
      allowConsolePatterns: [/status of 503/i],
      allowServerErrorUrls: [/\/api\/search/],
    });
    await installApiMocks(page, { role: 'DIRECTOR', failSearch503Once: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/');

    // Open CreateTaskModal first, then Ctrl+K over it -> Escape closes only Ctrl+K
    await page.getByRole('button', { name: 'Giao việc', exact: true }).click();
    const createModal = page.getByRole('dialog', { name: 'Giao việc mới' });
    await expect(createModal).toBeVisible();

    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Tìm nhanh' });
    await expect(palette).toBeVisible();

    const input = palette.getByRole('combobox', {
      name: 'Tìm công việc, nhân sự, tài liệu hoặc ứng dụng',
    });
    await input.fill('Báo cáo');
    await expect(palette.getByRole('alert')).toContainText('Chưa tìm được tài liệu');
    await palette.getByRole('button', { name: 'Thử lại' }).click();
    await expect(palette.getByRole('option', { name: /Báo cáo tài chính quý IV/ })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);
    await expect(createModal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(createModal).toHaveCount(0);

    // Keyboard ArrowDown + Enter navigation via Ctrl+K
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    const paletteInput = palette.getByRole('combobox', {
      name: 'Tìm công việc, nhân sự, tài liệu hoặc ứng dụng',
    });
    await paletteInput.fill('');
    const secondOption = palette.getByRole('option').nth(1);
    await page.keyboard.press('ArrowDown');
    await expect(secondOption).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);

    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await palette
      .getByRole('combobox', { name: 'Tìm công việc, nhân sự, tài liệu hoặc ứng dụng' })
      .fill('QHRM');
    const qhrmAppOption = palette.getByRole('option', { name: /QHRM/ }).first();
    await expect(qhrmAppOption).toBeVisible();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/org/);
    await waitForShellReady(page);
    errors.assertNoRuntimeErrors();
  });

  test('custom <Select> keyboard nav and Escape isolation inside CreateTaskModal and Filter Popover', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/');

    // Inside CreateTaskModal
    await page.getByRole('button', { name: 'Giao việc', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Giao việc mới' });
    await expect(modal).toBeVisible();

    const prioritySelect = modal.getByRole('combobox', { name: 'Mức độ ưu tiên' });
    await prioritySelect.focus();
    await page.keyboard.press('Enter');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(listbox).toHaveCount(0);

    // Re-open <Select> and press Escape -> only <Select> closes; Modal stays open; focus returns to combobox
    await prioritySelect.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(modal).toBeVisible();
    await expect(prioritySelect).toBeFocused();

    await modal.getByRole('button', { name: 'Đóng hộp thoại' }).click();
    await expect(modal).toHaveCount(0);

    // Inside QTask Filter Popover
    await page.getByRole('button', { name: 'Lọc', exact: true }).click();
    const popover = page.getByRole('region', { name: 'Bộ lọc bảng công việc' });
    await expect(popover).toBeVisible();
    await selectCustomOption(page, popover.getByRole('combobox', { name: 'Trạng thái' }), 'Đang làm');
    await expect(popover).toBeVisible();
    await popover.getByRole('button', { name: 'Áp dụng' }).click();
    errors.assertNoRuntimeErrors();
  });

  test('Account menu keyboard navigation and logout redirect', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/');

    const accountBtn = page.getByRole('button', { name: 'Tài khoản', exact: true });
    await accountBtn.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Trang tài khoản' })).toBeFocused();
    await page.keyboard.press('End');
    const logoutItem = page.getByRole('menuitem', { name: 'Đăng xuất' });
    await expect(logoutItem).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(accountBtn).toBeFocused();

    await accountBtn.click();
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
    await page.waitForURL(/\/login/);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?next=/);
    errors.assertNoRuntimeErrors();
  });
});

test.describe('F3: QTask (/, /?muc=tong-quan, /tasks, /projects)', () => {
  test('overview navigation and quick create trigger', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/?muc=tong-quan');

    const region = page.getByRole('region', { name: 'Tổng quan QTask' });
    await expect(region).toBeVisible();
    await region.getByRole('button', { name: 'Giao việc' }).click();
    const modal = page.getByRole('dialog', { name: 'Giao việc mới' });
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Hủy' }).click();

    await region.getByRole('link', { name: 'Xem dự án' }).click();
    await page.waitForURL(/\/projects$/);
    await waitForShellReady(page);
    errors.assertNoRuntimeErrors();
  });

  test('all tasks tabs, search, filter popover, card/table toggle, create task, detail drawer & comments', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/');

    const tabs = page.getByRole('tablist', { name: 'Phạm vi công việc' });
    await tabs.getByRole('tab', { name: 'Của tôi' }).click();
    await expect(page).toHaveURL(/view=mine/);
    await tabs.getByRole('tab', { name: 'Tất cả' }).click();

    // Create task via modal + <Select>
    await page.getByRole('button', { name: 'Giao việc', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Giao việc mới' });
    const titleInput = modal.getByLabel(/Tên công việc/);
    const createdTitle = 'Kiểm tra hệ thống E2E QTask 2026';
    await titleInput.fill(createdTitle);
    await selectCustomOption(page, modal.getByRole('combobox', { name: 'Người phụ trách' }), 'Trần Lan Anh');
    await selectCustomOption(page, modal.getByRole('combobox', { name: 'Mức độ ưu tiên' }), 'Ưu tiên cao');
    await modal.getByRole('button', { name: 'Giao việc' }).click();
    await expect(modal).toHaveCount(0);

    // Search for created task
    const search = page.getByRole('searchbox', { name: /Tìm theo tên hoặc mã công việc/i });
    await search.fill('E2E QTask 2026');
    await expect(page.getByText(createdTitle)).toBeVisible();

    // Toggle Card <-> Table
    const viewToggle = page.getByRole('button', { name: /Chế độ (bảng|thẻ)/ });
    await viewToggle.click();
    await expect(viewToggle).toHaveAttribute('aria-pressed', 'true');
    await viewToggle.click();
    await expect(viewToggle).toHaveAttribute('aria-pressed', 'false');

    // Open detail drawer by clicking row
    await page.getByRole('row', { name: new RegExp(createdTitle) }).click();
    const drawer = page.getByRole('dialog', { name: createdTitle });
    await expect(drawer).toBeVisible();

    await drawer.getByRole('textbox', { name: 'Viết bình luận' }).fill('Đã xác minh luồng bình luận E2E.');
    await drawer.getByRole('button', { name: 'Gửi bình luận' }).click();
    await expect(drawer.getByText('Đã xác minh luồng bình luận E2E.')).toBeVisible();

    await drawer.getByRole('button', { name: 'Hoàn thành công việc' }).click();
    await expect(drawer.getByRole('button', { name: 'Đã hoàn thành' })).toBeDisabled();
    await drawer.getByRole('button', { name: 'Đóng chi tiết' }).click();
    await expect(drawer).toHaveCount(0);

    // Row menu action on an existing task
    await search.fill('');
    await page.getByRole('button', { name: /Thao tác / }).first().click();
    await expect(page.getByRole('menu').first()).toBeVisible();
    await page.keyboard.press('Escape');
    errors.assertNoRuntimeErrors();
  });

  test('my tasks (/tasks) scope tabs, check toggle and calendar strip', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/tasks');

    await expect(page.getByRole('region', { name: 'Công việc của tôi' })).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Phạm vi công việc của tôi' });
    await tabs.getByRole('tab', { name: /^Hôm nay/ }).click();
    await tabs.getByRole('tab', { name: /^Tất cả/ }).click();

    const checkBtn = page
      .getByRole('button', { name: /^(Đánh dấu hoàn thành|Đã hoàn thành) / })
      .first();
    const wasDone = await checkBtn.getAttribute('data-done');
    await checkBtn.click();
    await expect(checkBtn).toHaveAttribute('data-done', wasDone === 'true' ? 'false' : 'true');

    const calendarGroup = page.getByRole('group', { name: 'Ngày trong tuần' });
    const dayButtons = calendarGroup.getByRole('button');
    expect(await dayButtons.count()).toBe(7);
    await dayButtons.nth(2).click();
    await expect(dayButtons.nth(2)).toHaveAttribute('aria-pressed', 'true');
    errors.assertNoRuntimeErrors();
  });

  test('projects (/projects) create modal and project detail milestone toggle', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/projects');

    await expect(page.getByRole('region', { name: 'Dự án' })).toBeVisible();
    await page.getByRole('button', { name: 'Tạo dự án' }).click();
    const createDlg = page.getByRole('dialog', { name: 'Tạo dự án mới' });
    await expect(createDlg).toBeVisible();

    const projectName = 'Triển khai Cổng vận hành E2E';
    await createDlg.getByLabel(/Tên dự án/).fill(projectName);
    await createDlg.getByLabel('Mô tả ngắn').fill('Dự án kiểm thử quy trình E2E.');
    await createDlg.getByRole('button', { name: 'Tạo dự án' }).click();
    await expect(createDlg).toHaveCount(0);

    await page.getByRole('button', { name: projectName }).click();
    const detailDlg = page.getByRole('dialog', { name: projectName });
    await expect(detailDlg).toBeVisible();

    const milestoneBtn = detailDlg.locator('button[aria-pressed]').first();
    if ((await milestoneBtn.count()) > 0) {
      const pressed = await milestoneBtn.getAttribute('aria-pressed');
      await milestoneBtn.click();
      await expect(milestoneBtn).toHaveAttribute('aria-pressed', pressed === 'true' ? 'false' : 'true');
    }
    await detailDlg.getByRole('button', { name: '+10% tiến độ' }).click();
    await detailDlg.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(detailDlg).toHaveCount(0);
    errors.assertNoRuntimeErrors();
  });
});

test.describe('F4: QHRM (/org)', () => {
  test('overview, department filter, search, row menu and CreateUserModal', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });

    await navigateAndReady(page, '/org?muc=tong-quan');
    await expect(page.getByRole('region', { name: 'Tổng quan nhân sự' })).toBeVisible();

    await navigateAndReady(page, '/org');
    const deptAside = page.getByRole('complementary', { name: 'Phòng ban' });
    await deptAside.getByRole('button', { name: /Công nghệ/ }).click();
    await expect(deptAside.getByRole('button', { name: /Công nghệ/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await deptAside.getByRole('button', { name: /Toàn công ty/ }).click();

    await page.getByRole('button', { name: 'Thêm nhân sự' }).click();
    const modal = page.getByRole('dialog', { name: 'Thêm nhân sự mới' });
    await expect(modal).toBeVisible();
    await modal.getByLabel(/Họ và tên/).fill('Đặng Minh Quân');
    await modal.getByLabel(/Email công việc/).fill('quan.dang@qsystem.vn');
    await selectCustomOption(page, modal.getByRole('combobox', { name: 'Phòng ban' }), /Công nghệ/);
    await modal.getByLabel('Chức danh').fill('Chuyên viên QA');
    await modal.getByLabel(/Mật khẩu tạm/).fill('MatKhauTam123!');
    await modal.getByRole('button', { name: 'Tạo nhân sự' }).click();
    await expect(modal).toHaveCount(0);

    await page.getByRole('searchbox', { name: 'Tìm nhân sự' }).fill('Đặng Minh Quân');
    await expect(page.getByRole('table', { name: /Danh sách nhân sự/ })).toContainText('Đặng Minh Quân');

    await page.getByRole('button', { name: 'Thao tác với Đặng Minh Quân' }).click();
    await page.getByRole('menuitem', { name: 'Xem hồ sơ chi tiết' }).click();
    const profileModal = page.getByRole('dialog', { name: 'Hồ sơ nhân sự' });
    await expect(profileModal).toBeVisible();
    await profileModal.getByRole('button', { name: 'Đóng hồ sơ nhân sự' }).click();
    errors.assertNoRuntimeErrors();
  });

  test('departments (?muc=phong-ban) create department', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/org?muc=phong-ban');

    const deptAside = page.getByRole('complementary', { name: 'Phòng ban' });
    await deptAside.getByRole('button', { name: 'Tùy chọn phòng ban' }).click();
    await page.getByRole('menuitem', { name: 'Thêm phòng ban mới' }).click();

    await deptAside.getByLabel('Tên phòng ban mới').fill('Kiểm thử chất lượng');
    await deptAside.getByRole('button', { name: 'Thêm', exact: true }).click();
    await expect(deptAside.getByRole('button', { name: /Kiểm thử chất lượng/ })).toBeVisible();
    errors.assertNoRuntimeErrors();
  });

  test('attendance (?muc=cham-cong) check-in/out and ResponsiveDetailDrawer breakpoint behavior', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/org?muc=cham-cong');

    const checkInBtn = page.getByRole('button', { name: 'Chấm công vào ca' });
    if ((await checkInBtn.count()) > 0) {
      await checkInBtn.click();
      await expect(page.getByRole('button', { name: 'Chấm công ra ca' })).toBeVisible();
      await page.getByRole('button', { name: 'Chấm công ra ca' }).click();
    }

    const table = page.getByRole('table', { name: 'Bảng chấm công nhân sự' });
    const firstDataRow = table.locator('tbody tr').first();
    await firstDataRow.click();

    // At 1440px ResponsiveDetailDrawer uses role="region"
    const desktopDrawer = await expectDetailDrawer(page, /.+/);
    await desktopDrawer.getByLabel('Ghi chú').fill('Xác nhận ca làm việc hợp lệ.');
    await desktopDrawer.getByRole('button', { name: 'Lưu cập nhật' }).click();
    await desktopDrawer.getByRole('button', { name: 'Đóng chi tiết' }).click();

    // At 768px ResponsiveDetailDrawer switches to role="dialog"
    await page.setViewportSize({ width: 768, height: 1024 });
    await firstDataRow.click();
    const tabletDrawer = await expectDetailDrawer(page, /.+/);
    await tabletDrawer.getByRole('button', { name: 'Đóng chi tiết' }).click();
    errors.assertNoRuntimeErrors();
  });

  test('leave (?muc=nghi-phep) tabs, CreateLeaveModal, approve/reject and drawer', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/org?muc=nghi-phep');

    const tabs = page.getByRole('tablist', { name: 'Lọc trạng thái đơn nghỉ phép' });
    await tabs.getByRole('tab', { name: /^Chờ duyệt/ }).click();
    await tabs.getByRole('tab', { name: /^Tất cả/ }).click();

    await page.getByRole('button', { name: 'Gửi đơn nghỉ phép' }).click();
    const createDlg = page.getByRole('dialog', { name: 'Gửi đơn nghỉ phép' });
    await expect(createDlg).toBeVisible();
    await selectCustomOption(page, createDlg.getByRole('combobox', { name: /Loại phép/ }), /^Phép năm/);
    await createDlg.getByLabel(/Lý do nghỉ phép/).fill('Nghỉ phép việc gia đình theo kế hoạch.');
    await createDlg.getByRole('button', { name: 'Gửi đơn nghỉ phép' }).click();
    await expect(createDlg).toHaveCount(0);

    // Approve first pending leave if present
    const approveBtn = page.getByRole('button', { name: /^Duyệt đơn / }).first();
    if ((await approveBtn.count()) > 0) {
      await approveBtn.click();
    }

    // Reject next pending leave via Reject Reason Modal if present
    const rejectBtn = page.getByRole('button', { name: /^Từ chối đơn / }).first();
    if ((await rejectBtn.count()) > 0) {
      await rejectBtn.click();
      const rejectModal = page.getByRole('dialog', { name: /^Từ chối đơn / });
      await expect(rejectModal).toBeVisible();
      await rejectModal.getByLabel(/Lý do từ chối/).fill('Trùng lịch triển khai dự án.');
      await rejectModal.getByRole('button', { name: 'Xác nhận từ chối' }).click();
      await expect(rejectModal).toHaveCount(0);
    }

    // Open leave detail drawer
    const firstRow = page.getByRole('table', { name: 'Danh sách đơn xin nghỉ phép' }).locator('tbody tr').first();
    await firstRow.click();
    const drawer = await expectDetailDrawer(page, /^Đơn nghỉ phép /);
    await drawer.getByRole('button', { name: 'Đóng chi tiết' }).click();
    errors.assertNoRuntimeErrors();
  });
});

test.describe('F5: QCRM (/crm)', () => {
  test('overview, customers search/segment/create and drawer status update', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });

    await navigateAndReady(page, '/crm?muc=tong-quan');
    await expect(page.getByRole('region', { name: 'Tổng quan QCRM' })).toBeVisible();

    await navigateAndReady(page, '/crm');
    const segTabs = page.getByRole('tablist', { name: 'Loại khách hàng' });
    await segTabs.getByRole('tab', { name: /^Doanh nghiệp/ }).click();
    await segTabs.getByRole('tab', { name: /^Tất cả/ }).click();

    await page.getByRole('button', { name: 'Thêm khách hàng' }).click();
    const modal = page.getByRole('dialog', { name: 'Thêm khách hàng mới' });
    await expect(modal).toBeVisible();
    await modal.getByLabel(/Tên khách hàng/).fill('Công ty Cổ phần Sao Mai E2E');
    await modal.getByLabel(/Email liên hệ/).fill('sales@saomaie2e.vn');
    await modal.getByRole('button', { name: 'Lưu khách hàng' }).click();
    await expect(modal).toHaveCount(0);

    await page.getByRole('searchbox', { name: 'Tìm khách hàng' }).fill('Sao Mai E2E');
    const row = page.getByRole('row', { name: /Sao Mai E2E/ });
    await expect(row).toBeVisible();
    await selectCustomOption(
      page,
      page.getByRole('combobox', { name: 'Lọc theo trạng thái khách hàng' }),
      'Mới',
    );
    await expect(row).toBeVisible();
    await selectCustomOption(
      page,
      page.getByRole('combobox', { name: 'Lọc theo trạng thái khách hàng' }),
      'Tất cả trạng thái',
    );
    await row.click();

    const drawer = await expectDetailDrawer(page, 'Công ty Cổ phần Sao Mai E2E');
    await selectCustomOption(
      page,
      drawer.getByRole('combobox', { name: 'Cập nhật trạng thái khách hàng' }),
      'Tiềm năng',
    );
    await drawer.getByRole('button', { name: 'Đóng chi tiết' }).click();
    errors.assertNoRuntimeErrors();
  });

  test('opportunities (?muc=co-hoi) stage tabs and drawer edit', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/crm?muc=co-hoi');

    const tabs = page.getByRole('tablist', { name: 'Giai đoạn cơ hội' });
    await tabs.getByRole('tab', { name: /^Báo giá/ }).click();
    await tabs.getByRole('tab', { name: /^Tất cả/ }).click();

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    const drawer = await expectDetailDrawer(page, /.+/);
    await selectCustomOption(page, drawer.getByRole('combobox', { name: 'Giai đoạn bán hàng' }), 'Đàm phán');
    await drawer.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await drawer.getByRole('button', { name: 'Đóng chi tiết' }).click();
    errors.assertNoRuntimeErrors();
  });

  test('contacts (?muc=lien-he) role tabs, drawer and interaction log', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/crm?muc=lien-he');

    const tabs = page.getByRole('tablist', { name: 'Vai trò đầu mối' });
    await tabs.getByRole('tab', { name: /^Đầu mối chính/ }).click();
    await tabs.getByRole('tab', { name: /^Tất cả/ }).click();

    await page.locator('table tbody tr').first().click();
    const drawer = await expectDetailDrawer(page, /.+/);
    await drawer.getByLabel('Nội dung trao đổi').fill('Gọi điện xác nhận nhu cầu triển khai.');
    await drawer.getByRole('button', { name: 'Ghi nhận tương tác' }).click();
    await expect(drawer.getByText('Gọi điện xác nhận nhu cầu triển khai.')).toBeVisible();
    await drawer.getByRole('button', { name: 'Đóng chi tiết' }).click();
    errors.assertNoRuntimeErrors();
  });

  test('reports (?muc=bao-cao) filters and summary tables', async ({ page }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/crm?muc=bao-cao');

    await selectCustomOption(page, page.getByRole('combobox', { name: 'Kỳ lọc' }), 'Quý này');
    await expect(page.getByRole('table', { name: 'Hiệu suất theo giai đoạn bán hàng' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Hiệu suất theo nhân viên phụ trách' })).toBeVisible();
    errors.assertNoRuntimeErrors();
  });
});

test.describe('F6: QSocial (/social)', () => {
  test('channel navigation, composer post creation, feed tabs, sort, like, comment, save and pin', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/social');

    // Empty submit validation
    await page.getByRole('button', { name: 'Đăng bài' }).click();

    // Channel switch via nav
    const channelNav = page.getByRole('navigation', { name: 'Kênh nội bộ' });
    await channelNav.getByRole('button', { name: /Thông báo chung/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Thông báo chung/ })).toBeVisible();
    await channelNav.getByRole('button', { name: /Toàn công ty/ }).click();

    // Create post
    const postText = 'Thông báo hoàn tất diễn tập kiểm thử E2E QSocial.';
    await page.getByRole('textbox', { name: 'Nội dung bài viết' }).fill(postText);
    await page.getByRole('button', { name: 'Đăng bài' }).click();

    const feed = page.getByRole('region', { name: 'Bảng tin' }).or(page.locator('section[aria-label="Bảng tin"]'));
    const postCard = feed.locator('article').filter({ hasText: postText });
    await expect(postCard).toBeVisible();

    // Like & comment
    const likeBtn = postCard.getByRole('button', { name: /lượt thích$/ });
    await likeBtn.click();
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'true');

    await postCard.getByRole('button', { name: /bình luận$/ }).click();
    await postCard.getByRole('textbox', { name: /^Bình luận bài viết của / }).fill('Ghi nhận thông tin!');
    await postCard.getByRole('button', { name: 'Gửi' }).click();
    await expect(postCard.getByText('Ghi nhận thông tin!')).toBeVisible();

    // Post menu: Save & Pin
    await postCard.getByRole('button', { name: 'Tùy chọn bài viết' }).click();
    await page.getByRole('menuitem', { name: 'Lưu bài viết' }).click();
    await postCard.getByRole('button', { name: 'Tùy chọn bài viết' }).click();
    await page.getByRole('menuitem', { name: 'Ghim bài viết' }).click();

    // Sort toggle & Saved tab
    const sortBtn = page.getByRole('button', { name: /^(Mới nhất|Phổ biến nhất)$/ });
    await sortBtn.click();

    const feedTabs = page.getByRole('tablist', { name: 'Chế độ xem bảng tin' });
    await feedTabs.getByRole('tab', { name: 'Đã lưu' }).click();
    await expect(feed.locator('article').filter({ hasText: postText })).toBeVisible();

    // URL deep links ?muc=thong-bao and ?muc=nhom and ?muc=da-luu
    await navigateAndReady(page, '/social?muc=thong-bao');
    await expect(page.getByRole('heading', { level: 1, name: /Thông báo chung/ })).toBeVisible();
    await navigateAndReady(page, '/social?muc=nhom');
    await expect(page.getByRole('heading', { level: 1, name: /Chia sẻ kinh nghiệm/ })).toBeVisible();
    await navigateAndReady(page, '/social?muc=da-luu');
    await expect(page.getByRole('tablist', { name: 'Chế độ xem bảng tin' }).getByRole('tab', { name: 'Đã lưu' })).toHaveAttribute('aria-selected', 'true');
    errors.assertNoRuntimeErrors();
  });
});

test.describe('F7: Shared Pages (/account, /files, /notifications)', () => {
  test('/account profile edit and ?muc=bao-mat password validation & ?muc=phien', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/account');

    await page.getByRole('button', { name: 'Chỉnh sửa' }).click();
    const nameInput = page.getByLabel('Họ và tên');
    await nameInput.fill('Nguyễn Minh Khôi (Updated)');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await navigateAndReady(page, '/account?muc=bao-mat');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await page.getByLabel('Mật khẩu hiện tại').fill('OldPass123!');
    await page.getByLabel('Mật khẩu mới').fill('short');
    await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
    await expect(getAppAlert(page)).toContainText('Mật khẩu mới cần ít nhất 8 ký tự.');

    await navigateAndReady(page, '/account?muc=phien');
    await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
    errors.assertNoRuntimeErrors();
  });

  test('/files tabs, search, folder filter, format popover, view toggle, create folder, rename and quota modal', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/files');

    const tabs = page.getByRole('tablist', { name: 'Phân loại tài liệu' });
    await tabs.getByRole('tab', { name: 'Gần đây' }).click();
    await tabs.getByRole('tab', { name: 'Tất cả tài liệu' }).click();

    await page.getByRole('button', { name: 'Bộ lọc' }).click();
    const filterMenu = page.getByRole('menu', { name: 'Lọc theo định dạng' });
    await expect(filterMenu).toBeVisible();
    await filterMenu.getByRole('menuitemradio', { name: 'Tài liệu PDF' }).click();
    await page.getByRole('button', { name: 'Bộ lọc' }).click();
    await page.getByRole('menu', { name: 'Lọc theo định dạng' }).getByRole('menuitemradio', { name: 'Tất cả định dạng' }).click();

    // Create folder modal
    await page.getByRole('button', { name: 'Tạo thư mục' }).click();
    const folderDlg = page.getByRole('dialog', { name: 'Tạo thư mục mới' });
    await expect(folderDlg).toBeVisible();
    await folderDlg.getByPlaceholder('Ví dụ: Quy trình vận hành Q4').fill('Tài liệu E2E');
    await folderDlg.getByRole('button', { name: 'Tạo thư mục' }).click();
    await expect(folderDlg).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Tài liệu E2E/ })).toBeVisible();

    // Folder card filter toggle
    const folderBtn = page.getByRole('button', { name: /Tài liệu chung/ });
    await folderBtn.click();
    await expect(folderBtn).toHaveAttribute('aria-pressed', 'true');
    await folderBtn.click();
    await expect(folderBtn).toHaveAttribute('aria-pressed', 'false');

    // View toggle (starts at 'Danh sách' with aria-pressed="false" -> switches to 'Lưới' with aria-pressed="true")
    const viewToggle = page.getByRole('button', { name: /^(Danh sách|Lưới)$/ });
    await expect(viewToggle).toHaveAttribute('aria-pressed', 'false');
    await viewToggle.click();
    await expect(viewToggle).toHaveAttribute('aria-pressed', 'true');
    await viewToggle.click();
    await expect(viewToggle).toHaveAttribute('aria-pressed', 'false');

    // Rename modal via row menu
    await page.getByRole('button', { name: /Tùy chọn cho / }).first().click();
    await page.getByRole('menuitem', { name: 'Đổi tên' }).click();
    const renameDlg = page.getByRole('dialog', { name: 'Đổi tên tài liệu' });
    await expect(renameDlg).toBeVisible();
    await renameDlg.getByRole('textbox').fill('Hợp đồng E2E đã đổi tên.pdf');
    await renameDlg.getByRole('button', { name: 'Lưu tên mới' }).click();
    await expect(renameDlg).toHaveCount(0);

    // Quota modal
    await page.getByRole('button', { name: /dung lượng|Đã gửi yêu cầu mở rộng/ }).click();
    const quotaDlg = page.getByRole('dialog', { name: 'Dung lượng lưu trữ' });
    await expect(quotaDlg).toBeVisible();
    await quotaDlg.getByRole('button', { name: 'Đóng' }).click();
    errors.assertNoRuntimeErrors();
  });

  test('/notifications tabs, mark single read, bookmark, mark all read and subsystem toggles', async ({
    page,
  }) => {
    const errors = attachErrorCollectors(page);
    await installApiMocks(page, { role: 'DIRECTOR' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateAndReady(page, '/notifications');

    const tabs = page.getByRole('tablist', { name: 'Lọc thông báo' });
    await expect(tabs.getByRole('tab', { name: /^Ưu tiên \(/ })).toBeVisible();

    // Bookmark first notification
    const saveBtn = page.getByRole('button', { name: 'Lưu thông báo' }).first();
    await saveBtn.click();
    await tabs.getByRole('tab', { name: 'Đã lưu' }).click();
    await expect(page.getByRole('list', { name: 'Danh sách thông báo' }).locator('li')).toHaveCount(1);

    await tabs.getByRole('tab', { name: 'Tất cả' }).click();
    await page.getByRole('button', { name: /Công việc của bạn sắp đến hạn/ }).click();
    await expect(tabs.getByRole('tab', { name: 'Ưu tiên (1)' })).toBeVisible();
    await page.getByRole('button', { name: 'Đánh dấu đã đọc' }).first().click();
    await expect(tabs.getByRole('tab', { name: 'Ưu tiên (0)' })).toBeVisible();

    // Subsystem toggles
    const qtaskToggle = page.getByRole('button', { name: /QTask · Công việc/ });
    const pressedBefore = await qtaskToggle.getAttribute('aria-pressed');
    await qtaskToggle.click();
    await expect(qtaskToggle).toHaveAttribute('aria-pressed', pressedBefore === 'true' ? 'false' : 'true');
    errors.assertNoRuntimeErrors();
  });
});

test.describe('F9: Responsive Geometry Matrix (6 Viewports x Dark & Light)', () => {
  for (const route of RESPONSIVE_ROUTES) {
    for (const vp of VIEWPORT_MATRIX) {
      for (const theme of ['dark', 'light'] as const satisfies readonly ThemeMode[]) {
        test(`geometry ${route.slug} @ ${vp.name} (${theme})`, async ({ page }) => {
          const errors = attachErrorCollectors(page);
          await installApiMocks(page, {
            role: 'DIRECTOR',
            unauthenticated: route.auth === false,
          });
          await seedTheme(page, theme);
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await navigateAndReady(page, route.path);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await assertViewportGeometry(page);
          errors.assertNoRuntimeErrors();
        });
      }
    }
  }
});

test.describe('F10: Screenshot Capture Suite (M7 Visual Audit)', () => {
  test.beforeEach(() => {
    test.skip(
      !isScreenshotCaptureEnabled(),
      'Set CAPTURE_SCREENSHOTS=1 or CAPTURE_SCREENSHOTS_DIR to capture redesign PNGs.',
    );
  });

  for (const route of SCREENSHOT_ROUTES) {
    for (const vp of SCREENSHOT_VIEWPORTS) {
      for (const theme of ['dark', 'light'] as const satisfies readonly ThemeMode[]) {
        test(`screenshot ${route.slug} @ ${vp.name} (${theme})`, async ({ page }) => {
          await installApiMocks(page, {
            role: 'DIRECTOR',
            unauthenticated: route.auth === false,
          });
          await seedTheme(page, theme);
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await navigateAndReady(page, route.path);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await captureScreenshot(page, `${vp.name}-${theme}-${route.slug}`, { fullPage: true });
        });
      }
    }
  }

  for (const vp of SCREENSHOT_VIEWPORTS) {
    for (const theme of ['dark', 'light'] as const satisfies readonly ThemeMode[]) {
      test(`screenshot overlays @ ${vp.name} (${theme})`, async ({ page }) => {
        await installApiMocks(page, { role: 'DIRECTOR' });
        await seedTheme(page, theme);
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // 1. Ctrl+K Command Palette
        await navigateAndReady(page, '/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: 'Tìm nhanh' })).toBeVisible();
        await captureScreenshot(page, `${vp.name}-${theme}-overlay-ctrl-k`, { fullPage: false });
        await page.keyboard.press('Escape');

        // 2. AppLauncher
        await page.getByRole('button', { name: 'Mở App Launcher' }).click();
        await expect(page.getByRole('dialog', { name: 'App Launcher' })).toBeVisible();
        await captureScreenshot(page, `${vp.name}-${theme}-overlay-app-launcher`, { fullPage: false });
        await page.keyboard.press('Escape');

        // 3. CreateTaskModal + open <Select>
        await page.getByRole('button', { name: 'Giao việc', exact: true }).click();
        const modal = page.getByRole('dialog', { name: 'Giao việc mới' });
        await expect(modal).toBeVisible();
        await modal.getByRole('combobox', { name: 'Mức độ ưu tiên' }).click();
        await expect(page.getByRole('listbox')).toBeVisible();
        await captureScreenshot(page, `${vp.name}-${theme}-overlay-create-task-select`, {
          fullPage: false,
        });
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');

        // 4. Detail Drawer (Attendance ResponsiveDetailDrawer: region >=1280 vs dialog <1280)
        await navigateAndReady(page, '/org?muc=cham-cong');
        await page.getByRole('table', { name: 'Bảng chấm công nhân sự' }).locator('tbody tr').first().click();
        await expectDetailDrawer(page, /.+/);
        await captureScreenshot(page, `${vp.name}-${theme}-overlay-detail-drawer`, { fullPage: false });

        // 5. Mobile Nav Drawer on < 1024px
        if (vp.width < 1024) {
          await navigateAndReady(page, '/');
          await page.getByRole('button', { name: 'Mở điều hướng' }).click();
          await expect(page.getByRole('button', { name: 'Mở điều hướng' })).toHaveAttribute(
            'aria-expanded',
            'true',
          );
          await captureScreenshot(page, `${vp.name}-${theme}-overlay-mobile-nav`, {
            fullPage: false,
          });
        }
      });
    }
  }
});
