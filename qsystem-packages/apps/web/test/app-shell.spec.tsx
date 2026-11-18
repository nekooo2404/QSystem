import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastRegion, dismissToast } from '@qsystem/ui';
import type { MeResponse } from '@qsystem/contracts';
import { AppWorkspaceShell, type AppWorkspaceShellProps } from '../src/components/shell/AppWorkspaceShell';
import { LAUNCHER_FAVORITES_KEY } from '../src/components/shell/AppLauncher';
import { ThemeProvider } from '../src/lib/theme';

const push = vi.fn();
// The real router changes the pathname on push; the mock does the same so the
// shell keeps deriving the active module from the URL alone.
let pathname = '/';
let search = '';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({
    push: (href: string) => {
      push(href);
      const [nextPath, nextQuery = ''] = href.split('?');
      pathname = nextPath;
      search = nextQuery;
    },
  }),
}));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const renderShell = (props?: Partial<AppWorkspaceShellProps>) => render(shell(props));

beforeEach(() => {
  push.mockReset();
  pathname = '/';
  search = '';
  window.innerWidth = 1024;
  window.localStorage.clear();
  dismissToast();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/notifications') {
        return json(200, [
          {
            id: 'n-1',
            channel: 'EMAIL',
            recipient: 'minhtuan@qsystem.vn',
            recipientId: 'u-1',
            payload: { title: 'Bạn có việc mới' },
            status: 'SENT',
            attempts: 1,
            createdAt: new Date(Date.now() + 60_000).toISOString(),
          },
        ]);
      }
      return json(200, { ok: true });
    }),
  );
});

const shell = (props?: Partial<AppWorkspaceShellProps>) => (
  <ThemeProvider>
    <AppWorkspaceShell {...props}>
      <p>Nội dung công việc</p>
    </AppWorkspaceShell>
  </ThemeProvider>
);

const makeMe = (role: MeResponse['role']): MeResponse => ({
  id: `u-${role.toLowerCase()}`,
  name: 'Nguyễn Minh Tuấn',
  email: 'tuan@qsystem.vn',
  role,
  departmentId: null,
  managedDepartmentIds: [],
});

async function switchTo(moduleName: string, rerender: (ui: React.ReactElement) => void) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Mở App Launcher' }));
  const launcher = screen.getByRole('dialog', { name: 'App Launcher' });
  const link = within(launcher).getByRole('link', { name: new RegExp(`^${moduleName}\\b`) });
  await user.click(link);
  const [nextPath, nextQuery = ''] = (link.getAttribute('href') ?? '/').split('?');
  pathname = nextPath;
  search = nextQuery;
  rerender(shell());
}

describe('AppWorkspaceShell', () => {
  it('opens on QTask with its own navigation items', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'Tất cả công việc' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Công việc của tôi/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dự án' })).toBeInTheDocument();
    expect(screen.getByText('Nội dung công việc')).toBeInTheDocument();
  });

  it('keeps Thông báo and Tài khoản anchored in the top bar', () => {
    renderShell();
    const topbar = screen.getByRole('banner');
    expect(within(topbar).queryByRole('button', { name: 'Chuyển giao diện Sáng/Tối' })).toBeNull();
    expect(within(topbar).getByRole('link', { name: /Thông báo/ })).toBeInTheDocument();
    expect(within(topbar).getByRole('button', { name: 'Tài khoản' })).toBeInTheDocument();
  });

  it('swaps the contextual sidebar to QHRM and leaves the top bar controls in place', async () => {
    const { rerender } = renderShell();
    await switchTo('QHRM', rerender);

    expect(screen.getByRole('link', { name: 'Danh bạ nhân sự' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Phòng ban' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chấm công' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tất cả công việc' })).toBeNull();

    const topbar = screen.getByRole('banner');
    expect(within(topbar).queryByRole('button', { name: 'Chuyển giao diện Sáng/Tối' })).toBeNull();
    expect(within(topbar).getByRole('link', { name: /Thông báo/ })).toBeInTheDocument();
    expect(within(topbar).getByRole('button', { name: 'Tài khoản' })).toBeInTheDocument();
  });

  it('shows the account menu with a Vietnamese role', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Tài khoản' }));
    const menu = screen.getByRole('menu', { name: 'Tài khoản' });
    expect(within(menu).getByRole('menuitem', { name: 'Trang tài khoản' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Đăng xuất' })).toBeInTheDocument();
    expect(menu.textContent ?? '').not.toMatch(/DIRECTOR|MANAGER|EMPLOYEE|4W|WHO|PENDING|SENT|FAILED|DEAD/);
  });

  it('shows the unread notification count as Chưa đọc', async () => {
    renderShell();
    expect(await screen.findByRole('link', { name: 'Thông báo, 1 chưa đọc' })).toBeInTheDocument();
  });

  it('supports account menu keyboard navigation and restoration', async () => {
    const user = userEvent.setup();
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Tài khoản' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Trang tài khoản' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Đăng xuất' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Trang tài khoản' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('decouples /account from QTask in breadcrumb, launcher state, and sidebar navigation', async () => {
    const user = userEvent.setup();
    pathname = '/account';
    renderShell();

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb.textContent ?? '').not.toContain('QTask');
    expect(within(breadcrumb).getByText('QSystem')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Tài khoản & bảo mật')).toHaveAttribute('aria-current', 'page');

    const sidebar = screen.getByRole('complementary', { name: 'Điều hướng chính' });
    expect(within(sidebar).queryByRole('navigation', { name: 'Phân hệ' })).toBeNull();
    expect(within(sidebar).queryByText('Không gian làm việc')).toBeNull();
    expect(within(sidebar).queryByText('QTask / Điều hướng')).toBeNull();
    expect(within(sidebar).queryByRole('link', { name: 'Tất cả công việc' })).toBeNull();
    expect(within(sidebar).queryByRole('link', { name: /^Công việc của tôi/ })).toBeNull();
    expect(within(sidebar).queryByRole('link', { name: 'Dự án' })).toBeNull();

    expect(within(sidebar).getByText('Tài khoản / Điều hướng')).toBeInTheDocument();
    const accountNav = within(sidebar).getByRole('navigation', { name: 'Tài khoản & bảo mật' });
    expect(within(accountNav).getByRole('link', { name: 'Thông tin cá nhân' })).toHaveAttribute('aria-current', 'page');
    expect(within(accountNav).getByRole('link', { name: 'Bảo mật & đăng nhập' })).toHaveAttribute('href', '/account?muc=bao-mat');
    expect(within(accountNav).queryByRole('link', { name: 'Phiên làm việc' })).toBeNull();

    const shortcutsNav = within(sidebar).getByRole('navigation', { name: 'Lối tắt' });
    expect(within(shortcutsNav).getByRole('button', { name: 'Tìm kiếm' })).toBeInTheDocument();
    expect(within(shortcutsNav).getByRole('link', { name: 'Tài liệu' })).toBeInTheDocument();
    expect(within(shortcutsNav).getByRole('link', { name: 'Thông báo' })).toBeInTheDocument();

    const launcherTrigger = screen.getByRole('button', { name: 'Mở App Launcher' });
    expect(launcherTrigger).toHaveAttribute('data-module', 'system');
    await user.click(launcherTrigger);
    const launcher = screen.getByRole('dialog', { name: 'App Launcher' });
    for (const moduleName of ['QTask', 'QHRM', 'QCRM', 'QSocial']) {
      expect(within(launcher).getByRole('link', { name: new RegExp(`^${moduleName}\\b`) })).not.toHaveAttribute('aria-current', 'page');
    }
  });

  it('highlights the matching account sidebar section when ?muc= is set', () => {
    pathname = '/account';
    search = 'muc=bao-mat';
    renderShell();

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb.textContent ?? '').not.toContain('QTask');
    expect(within(breadcrumb).getByText('QSystem')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Tài khoản & bảo mật')).toBeInTheDocument();

    const accountNav = screen.getByRole('navigation', { name: 'Tài khoản & bảo mật' });
    expect(within(accountNav).getByRole('link', { name: 'Bảo mật & đăng nhập' })).toHaveAttribute('aria-current', 'page');
    expect(within(accountNav).getByRole('link', { name: 'Thông tin cá nhân' })).not.toHaveAttribute('aria-current');
  });

  it('decouples /files and /notifications from QTask without duplicating sidebar links', () => {
    pathname = '/files';
    const { rerender } = renderShell();

    let breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb.textContent ?? '').not.toContain('QTask');
    expect(within(breadcrumb).getByText('QSystem')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Tài liệu')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Mở App Launcher' })).toHaveAttribute('data-module', 'system');

    let sidebar = screen.getByRole('complementary', { name: 'Điều hướng chính' });
    expect(within(sidebar).queryByText('QTask / Điều hướng')).toBeNull();
    expect(within(sidebar).getByText('Hệ thống / Điều hướng')).toBeInTheDocument();
    const filesLinks = within(sidebar).getAllByRole('link', { name: 'Tài liệu' });
    expect(filesLinks).toHaveLength(1);
    expect(filesLinks[0]).toHaveAttribute('aria-current', 'page');

    pathname = '/notifications';
    rerender(shell());

    breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb.textContent ?? '').not.toContain('QTask');
    expect(within(breadcrumb).getByText('QSystem')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Thông báo')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Mở App Launcher' })).toHaveAttribute('data-module', 'system');

    sidebar = screen.getByRole('complementary', { name: 'Điều hướng chính' });
    const notifLinks = within(sidebar).getAllByRole('link', { name: 'Thông báo' });
    expect(notifLinks).toHaveLength(1);
    expect(notifLinks[0]).toHaveAttribute('aria-current', 'page');
  });

  it('keeps QTask active on QTask routes such as /tasks and /projects', () => {
    pathname = '/tasks';
    const { rerender } = renderShell();
    expect(screen.getByRole('button', { name: 'Mở App Launcher' })).toHaveAttribute('data-module', 'qtask');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('QTask')).toBeInTheDocument();

    pathname = '/projects';
    rerender(shell());
    expect(screen.getByRole('button', { name: 'Mở App Launcher' })).toHaveAttribute('data-module', 'qtask');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('QTask')).toBeInTheDocument();
  });

  it('removes workspace module chips from the sidebar and switches modules from the Navbar App Launcher', async () => {
    const user = userEvent.setup();
    const { rerender } = renderShell();

    const sidebar = screen.getByRole('complementary', { name: 'Điều hướng chính' });
    expect(within(sidebar).queryByRole('navigation', { name: 'Phân hệ' })).toBeNull();
    expect(within(sidebar).queryByText('Không gian làm việc')).toBeNull();

    const trigger = screen.getByRole('button', { name: 'Mở App Launcher' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('data-module', 'qtask');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const launcher = screen.getByRole('dialog', { name: 'App Launcher' });
    expect(within(launcher).getByRole('searchbox', { name: 'Tìm ứng dụng hoặc chức năng' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'App Launcher' })).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();

    await switchTo('QCRM', rerender);
    expect(screen.getByText('QCRM / Điều hướng')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Khách hàng' })).toBeInTheDocument();

    await switchTo('QSocial', rerender);
    expect(screen.getByText('QSocial / Điều hướng')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bảng tin' })).toBeInTheDocument();

    await switchTo('QTask', rerender);
    expect(screen.getByText('QTask / Điều hướng')).toBeInTheDocument();
  });

  it('filters App Launcher modules by Vietnamese name and sub-function without diacritics', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Mở App Launcher' }));
    const launcher = screen.getByRole('dialog', { name: 'App Launcher' });
    const searchInput = within(launcher).getByRole('searchbox', { name: 'Tìm ứng dụng hoặc chức năng' });

    await user.type(searchInput, 'nhân sự');
    expect(within(launcher).getByRole('link', { name: /QHRM/ })).toBeInTheDocument();
    expect(within(launcher).queryByRole('link', { name: /QTask/ })).toBeNull();
    expect(within(launcher).queryByRole('link', { name: /QCRM/ })).toBeNull();

    await user.clear(searchInput);
    await user.type(searchInput, 'cham cong');
    expect(within(launcher).getByRole('link', { name: /QHRM/ })).toBeInTheDocument();
    expect(within(launcher).getByText(/chấm công/i)).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'nghi phep');
    expect(within(launcher).getByRole('link', { name: /QHRM/ })).toBeInTheDocument();
    expect(within(launcher).getByText(/Chức năng: Nghỉ phép/)).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'giao việc');
    expect(within(launcher).getByRole('link', { name: /QTask/ })).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'bảng tin');
    expect(within(launcher).getByRole('link', { name: /QSocial/ })).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'cơ hội');
    expect(within(launcher).getByRole('link', { name: /QCRM/ })).toBeInTheDocument();
    expect(within(launcher).queryByRole('link', { name: /QHRM/ })).toBeNull();

    await user.clear(searchInput);
    await user.type(searchInput, 'khong ton tai');
    expect(within(launcher).getByRole('status')).toHaveTextContent(/Không tìm thấy ứng dụng/);

    await user.click(screen.getByText('Nội dung công việc'));
    expect(screen.queryByRole('dialog', { name: 'App Launcher' })).toBeNull();
  });

  it('pins and unpins favorite modules in App Launcher and persists across reloads', async () => {
    const user = userEvent.setup();
    const first = renderShell();

    await user.click(screen.getByRole('button', { name: 'Mở App Launcher' }));
    let launcher = screen.getByRole('dialog', { name: 'App Launcher' });
    expect(within(launcher).queryByText('Đã ghim')).toBeNull();
    expect(within(launcher).getByText('Tất cả ứng dụng')).toBeInTheDocument();

    const pinQhrm = within(launcher).getByRole('button', { name: 'Ghim QHRM' });
    expect(pinQhrm).toHaveAttribute('aria-pressed', 'false');
    await user.click(pinQhrm);

    expect(pathname).toBe('/');
    expect(screen.getByRole('dialog', { name: 'App Launcher' })).toBeInTheDocument();
    expect(within(launcher).getByText('Đã ghim')).toBeInTheDocument();
    expect(within(launcher).getByText('Tất cả ứng dụng')).toBeInTheDocument();
    expect(within(launcher).getByRole('button', { name: 'Bỏ ghim QHRM' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(window.localStorage.getItem(LAUNCHER_FAVORITES_KEY) ?? '[]')).toEqual(['qhrm']);

    first.unmount();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Mở App Launcher' }));
    launcher = screen.getByRole('dialog', { name: 'App Launcher' });
    const pinnedGroup = within(launcher).getByRole('region', { name: 'Đã ghim' });
    expect(within(pinnedGroup).getByRole('link', { name: /QHRM/ })).toBeInTheDocument();

    await user.click(within(launcher).getByRole('button', { name: 'Bỏ ghim QHRM' }));
    expect(within(launcher).queryByText('Đã ghim')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(LAUNCHER_FAVORITES_KEY) ?? '[]')).toEqual([]);
  });

  it('filters App Launcher modules by user role and optional allowedModuleIds without exposing raw role enums', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(LAUNCHER_FAVORITES_KEY, JSON.stringify(['qcrm', 'qhrm']));
    const { rerender } = renderShell({ me: makeMe('EMPLOYEE') });

    await user.click(screen.getByRole('button', { name: 'Mở App Launcher' }));
    let launcher = screen.getByRole('dialog', { name: 'App Launcher' });
    expect(within(launcher).getByRole('link', { name: /QTask/ })).toBeInTheDocument();
    expect(within(launcher).getByRole('link', { name: /QHRM/ })).toBeInTheDocument();
    expect(within(launcher).getByRole('link', { name: /QSocial/ })).toBeInTheDocument();
    expect(within(launcher).queryByRole('link', { name: /QCRM/ })).toBeNull();
    expect(launcher.textContent ?? '').not.toMatch(/DIRECTOR|MANAGER|EMPLOYEE/);

    rerender(shell({ me: makeMe('MANAGER') }));
    launcher = screen.getByRole('dialog', { name: 'App Launcher' });
    expect(within(launcher).getByRole('link', { name: /QCRM/ })).toBeInTheDocument();

    rerender(shell({ me: makeMe('DIRECTOR'), allowedModuleIds: ['qtask', 'qcrm'] }));
    launcher = screen.getByRole('dialog', { name: 'App Launcher' });
    expect(within(launcher).getByRole('link', { name: /QTask/ })).toBeInTheDocument();
    expect(within(launcher).getByRole('link', { name: /QCRM/ })).toBeInTheDocument();
    expect(within(launcher).queryByRole('link', { name: /QHRM/ })).toBeNull();
    expect(within(launcher).queryByRole('link', { name: /QSocial/ })).toBeNull();
  });

  it('manages the mobile drawer with useFloatingLayer (Escape, focus return, backdrop close, and >= 1024px cleanup)', async () => {
    const user = userEvent.setup();
    window.innerWidth = 768;
    const { container } = renderShell();
    fireEvent(window, new Event('resize'));

    const shellRoot = container.querySelector('.qx-shell') as HTMLElement;
    const burger = screen.getByRole('button', { name: 'Mở điều hướng' });
    expect(shellRoot).toHaveAttribute('data-nav', 'closed');

    await user.click(burger);
    expect(shellRoot).toHaveAttribute('data-nav', 'open');
    const dialog = screen.getByRole('dialog', { name: 'Điều hướng chính' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(container.querySelector('.qx-main')).toHaveAttribute('inert', '');

    await user.keyboard('{Escape}');
    expect(shellRoot).toHaveAttribute('data-nav', 'closed');
    expect(document.body.style.overflow).toBe('');
    expect(container.querySelector('.qx-main')).not.toHaveAttribute('inert');
    expect(burger).toHaveFocus();

    await user.click(burger);
    expect(shellRoot).toHaveAttribute('data-nav', 'open');
    const backdrop = container.querySelector('.qx-backdrop') as HTMLElement;
    await user.click(backdrop);
    expect(shellRoot).toHaveAttribute('data-nav', 'closed');

    await user.click(burger);
    expect(shellRoot).toHaveAttribute('data-nav', 'open');
    window.innerWidth = 1024;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(shellRoot).toHaveAttribute('data-nav', 'closed'));
    expect(document.body.style.overflow).toBe('');
    expect(container.querySelector('.qx-main')).not.toHaveAttribute('inert');
  });

  it('removes the WORKSPACE tag and renders the textual Q fallback if qts-logo.png fails to load', () => {
    const { container } = renderShell();
    const sidebar = screen.getByRole('complementary', { name: 'Điều hướng chính' });
    expect(within(sidebar).queryByText('WORKSPACE')).toBeNull();

    const mark = container.querySelector('.qx-brand__mark') as HTMLElement;
    const img = mark.querySelector('img') as HTMLImageElement;
    expect(img).toHaveAttribute('src', '/qts-logo.png');
    fireEvent.error(img);
    expect(mark).toHaveAttribute('data-fallback', 'true');
    expect(mark).toHaveTextContent('Q');
  });

  it('routes shell feedback through @qsystem/ui ToastRegion without a duplicate .qx-toast-stack', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ThemeProvider>
        <AppWorkspaceShell>
          <p>Nội dung công việc</p>
        </AppWorkspaceShell>
        <ToastRegion position="bottom-right" />
      </ThemeProvider>,
    );

    expect(container.querySelector('.qx-toast-stack')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Chọn không gian làm việc/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'QTS Workspace' }));
    expect(await screen.findByText('Đã chuyển sang QTS Workspace')).toBeInTheDocument();
    expect(container.querySelector('.qx-toast-stack')).toBeNull();
  });

  it('closes only the top-most floating layer on Escape when Ctrl+K opens over AppLauncher', async () => {
    const user = userEvent.setup();
    renderShell();

    const launcherTrigger = screen.getByRole('button', { name: 'Mở App Launcher' });
    await user.click(launcherTrigger);
    expect(screen.getByRole('dialog', { name: 'App Launcher' })).toBeInTheDocument();

    // Move focus off the searchbox so Ctrl+K global hotkey activates (matching editable guard).
    screen.getByRole('button', { name: 'Đóng App Launcher' }).focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Tìm nhanh' })).toBeInTheDocument());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tìm nhanh' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'App Launcher' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'App Launcher' })).toBeNull());
    expect(launcherTrigger).toHaveFocus();
  });
});

afterEach(() => {
  window.innerWidth = 1024;
  dismissToast();
});
