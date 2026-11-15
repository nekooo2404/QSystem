import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppWorkspaceShell } from '../src/components/shell/AppWorkspaceShell';
import { ThemeProvider } from '../src/lib/theme';

const push = vi.fn();
// The real router changes the pathname on push; the mock does the same so the
// shell keeps deriving the active module from the URL alone.
let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({
    push: (href: string) => {
      push(href);
      pathname = href.split('?')[0];
    },
  }),
}));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const renderShell = () => render(shell());

beforeEach(() => {
  push.mockReset();
  pathname = '/';
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

const shell = () => (
  <ThemeProvider>
    <AppWorkspaceShell>
      <p>Nội dung công việc</p>
    </AppWorkspaceShell>
  </ThemeProvider>
);

async function switchTo(moduleName: string, rerender: (ui: React.ReactElement) => void) {
  const user = userEvent.setup();
  const modulesNav = screen.getByRole('navigation', { name: 'Phân hệ' });
  const link = within(modulesNav).getByRole('link', { name: moduleName });
  await user.click(link);
  pathname = (link.getAttribute('href') ?? '/').split('?')[0];
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

  it('keeps Sáng/Tối, Thông báo and Tài khoản anchored in the top bar', () => {
    renderShell();
    const topbar = screen.getByRole('banner');
    expect(within(topbar).getByRole('button', { name: 'Chuyển giao diện Sáng/Tối' })).toBeInTheDocument();
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
    expect(within(topbar).getByRole('button', { name: 'Chuyển giao diện Sáng/Tối' })).toBeInTheDocument();
    expect(within(topbar).getByRole('link', { name: /Thông báo/ })).toBeInTheDocument();
    expect(within(topbar).getByRole('button', { name: 'Tài khoản' })).toBeInTheDocument();
  });

  it('toggles the theme and shows the account menu with a Vietnamese role', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Chuyển giao diện Sáng/Tối' }));
    expect(document.documentElement.dataset.theme).toBe('light');

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

  it('exposes theme state and supports account menu keyboard navigation and restoration', async () => {
    const user = userEvent.setup();
    renderShell();
    const theme = screen.getByRole('button', { name: 'Chuyển giao diện Sáng/Tối' });
    expect(theme).toHaveAttribute('aria-pressed', 'true');
    await user.click(theme);
    expect(theme).toHaveAttribute('aria-pressed', 'false');
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
});
