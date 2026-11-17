import { expect, type Locator, type Page } from '@playwright/test';

export type ThemeMode = 'dark' | 'light';

export interface ErrorCollectorOptions {
  allowConsolePatterns?: RegExp[];
  allowServerErrorUrls?: RegExp[];
}

export interface ErrorCollector {
  consoleErrors: string[];
  pageErrors: string[];
  serverErrors: string[];
  assertNoRuntimeErrors: () => void;
}

export function attachErrorCollectors(page: Page, options: ErrorCollectorOptions = {}): ErrorCollector {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (options.allowConsolePatterns?.some((re) => re.test(text))) return;
    consoleErrors.push(text);
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  page.on('response', (res) => {
    const status = res.status();
    if (status < 500) return;
    const url = res.url();
    if (!url.includes('/api/')) return;
    if (options.allowServerErrorUrls?.some((re) => re.test(url))) return;
    serverErrors.push(`${status} ${res.request().method()} ${url}`);
  });

  return {
    consoleErrors,
    pageErrors,
    serverErrors,
    assertNoRuntimeErrors() {
      expect(pageErrors, `Unexpected pageerror(s): ${pageErrors.join(' | ')}`).toEqual([]);
      expect(consoleErrors, `Unexpected console.error(s): ${consoleErrors.join(' | ')}`).toEqual([]);
      expect(serverErrors, `Unexpected 5xx API response(s): ${serverErrors.join(' | ')}`).toEqual([]);
    },
  };
}

export async function waitForShellReady(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

export async function seedTheme(page: Page, theme: ThemeMode): Promise<void> {
  await page.addInitScript((value: ThemeMode) => {
    window.localStorage.setItem('qsystem-theme', value);
  }, theme);
}

export async function setTheme(page: Page, theme: ThemeMode): Promise<void> {
  const current = await page.locator('html').getAttribute('data-theme');
  if (current === theme) {
    const stored = await page.evaluate(() => window.localStorage.getItem('qsystem-theme'));
    if (stored === theme) return;
  }

  const loginLightBtn = page.getByRole('button', { name: 'Chuyển giao diện sáng' });
  const loginDarkBtn = page.getByRole('button', { name: 'Chuyển giao diện tối' });
  if ((await loginLightBtn.count()) > 0 && (await loginDarkBtn.count()) > 0) {
    await (theme === 'light' ? loginLightBtn : loginDarkBtn).click();
  } else {
    const shellToggle = page.getByRole('button', { name: 'Chuyển giao diện Sáng/Tối' });
    if ((await shellToggle.count()) > 0 && (await shellToggle.first().isVisible())) {
      if (current !== theme) {
        await shellToggle.first().click();
      }
    } else {
      await page.evaluate((value: ThemeMode) => {
        window.localStorage.setItem('qsystem-theme', value);
        document.documentElement.dataset.theme = value;
      }, theme);
    }
  }

  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  const storedAfter = await page.evaluate(() => window.localStorage.getItem('qsystem-theme'));
  expect(storedAfter).toBe(theme);
}

export async function selectCustomOption(
  page: Page,
  comboboxLocator: Locator,
  optionName: string | RegExp,
): Promise<void> {
  await expect(comboboxLocator).toBeVisible();
  await comboboxLocator.click();

  const controlsId = await comboboxLocator.getAttribute('aria-controls');
  const listbox = controlsId ? page.locator(`#${controlsId}`) : page.getByRole('listbox').last();
  await expect(listbox).toBeVisible();

  const option = listbox.getByRole('option', {
    name: optionName,
    exact: typeof optionName === 'string',
  });
  await expect(option.first()).toBeVisible();
  await option.first().click();

  await expect(listbox).toHaveCount(0);
  if (typeof optionName === 'string') {
    await expect(comboboxLocator).toContainText(optionName);
  } else {
    await expect(comboboxLocator).toContainText(optionName);
  }
}

export async function expectDetailDrawer(page: Page, title: string | RegExp): Promise<Locator> {
  const width = page.viewportSize()?.width ?? 1440;
  const expectedRole = width >= 1280 ? 'region' : 'dialog';
  const drawer = page
    .getByRole(expectedRole, { name: title })
    .filter({ has: page.getByRole('button', { name: 'Đóng chi tiết' }) })
    .last();
  await expect(drawer).toBeVisible();
  return drawer;
}

export function getAppAlert(page: Page): Locator {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
