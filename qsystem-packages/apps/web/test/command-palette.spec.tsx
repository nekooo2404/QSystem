import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppWorkspaceShell } from '../src/components/shell/AppWorkspaceShell';
import { ThemeProvider } from '../src/lib/theme';

const push = vi.fn();
let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
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

const calls: string[] = [];

beforeEach(() => {
  push.mockReset();
  pathname = '/';
  calls.length = 0;
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith('/api/search')) {
        return json(200, {
          hits: [{ id: 'f-1', title: 'Báo cáo quý IV', owner_id: 'u-1', department_id: 'd-1' }],
          total: 1,
          limit: 20,
          offset: 0,
        });
      }
      if (url === '/api/notifications') return json(200, []);
      return json(200, { ok: true });
    }),
  );
});

const renderShell = () =>
  render(
    <ThemeProvider>
      <AppWorkspaceShell>
        <p>Nội dung công việc</p>
      </AppWorkspaceShell>
    </ThemeProvider>,
  );

const palette = () => screen.getByRole('dialog', { name: 'Tìm nhanh' });

// React 18 updates flush in a microtask; wrap raw dispatches like the
// component's own tests do.
async function pressCtrlK(init: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, ...init }));
  await Promise.resolve();
}

describe('Global Ctrl+K', () => {
  it('opens the palette from the top bar button and from Ctrl+K, and Esc closes it', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: /Tìm mọi thứ trong QSystem/ }));
    expect(palette()).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tìm nhanh' })).toBeNull());

    await pressCtrlK();
    expect(palette()).toBeInTheDocument();
  });

  it('ignores Ctrl+K while a Vietnamese IME composition is in flight', async () => {
    renderShell();

    await pressCtrlK({ isComposing: true });
    expect(screen.queryByRole('dialog', { name: 'Tìm nhanh' })).toBeNull();
  });

  it('renders the three unnumbered groups in the reference order', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /Tìm mọi thứ trong QSystem/ }));

    const labelTexts = Array.from(palette().querySelectorAll('.qp-group__label')).map(
      (node) => node.textContent,
    );
    expect(labelTexts.slice(0, 3)).toEqual(['Đi tới', 'Chuyển ứng dụng', 'Thao tác nhanh']);

    const options = within(palette()).getAllByRole('option');
    for (const option of options) {
      expect(option.textContent ?? '').not.toMatch(/^\s*[1-9]\s*[.)]/);
    }
    expect(palette().textContent ?? '').not.toMatch(/4W|WHO|PENDING|Presign|Audit trail|DIRECTOR/);
  });

  it('navigates with an entry from Đi tới', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /Tìm mọi thứ trong QSystem/ }));

    await user.click(within(palette()).getByRole('option', { name: /Danh bạ nhân sự/ }));
    expect(push).toHaveBeenCalledWith('/org');
  });

  it('debounces GET /api/search and shows the hits', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /Tìm mọi thứ trong QSystem/ }));

    await user.type(within(palette()).getByRole('combobox'), 'báo cáo');

    expect(await within(palette()).findByText('Báo cáo quý IV')).toBeInTheDocument();
    // One request for the whole burst of keystrokes, not one per character.
    expect(calls.filter((url) => url.startsWith('/api/search'))).toHaveLength(1);
    expect(calls.find((url) => url.startsWith('/api/search'))).toContain('q=b%C3%A1o%20c%C3%A1o');
  });

  it('shows role=alert when /api/search fails and retries via Thử lại', async () => {
    let searchCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/search')) {
          searchCalls += 1;
          if (searchCalls === 1) return json(503, { code: 'INTERNAL' });
          return json(200, {
            hits: [{ id: 'f-1', title: 'Báo cáo quý IV', owner_id: 'u-1', department_id: 'd-1' }],
            total: 1,
            limit: 20,
            offset: 0,
          });
        }
        if (url === '/api/notifications') return json(200, []);
        return json(200, { ok: true });
      }),
    );

    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /Tìm mọi thứ trong QSystem/ }));
    await user.type(within(palette()).getByRole('combobox'), 'báo cáo');

    expect(await within(palette()).findByRole('alert')).toHaveTextContent(/Chưa tìm được tài liệu/);
    await user.click(within(palette()).getByRole('button', { name: 'Thử lại' }));
    expect(await within(palette()).findByRole('option', { name: /Báo cáo quý IV/ })).toBeInTheDocument();
    expect(searchCalls).toBe(2);
  });

  it('filters Chuyển ứng dụng in Ctrl+K according to EMPLOYEE module permissions', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <AppWorkspaceShell
          me={{
            id: 'u-emp',
            name: 'Nhân viên A',
            email: 'emp@qsystem.vn',
            role: 'EMPLOYEE',
            departmentId: null,
            managedDepartmentIds: [],
          }}
        >
          <p>Nội dung công việc</p>
        </AppWorkspaceShell>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Tìm mọi thứ trong QSystem/ }));
    const appsGroup = within(palette()).getByRole('group', { name: 'Chuyển ứng dụng' });
    expect(within(appsGroup).getByRole('option', { name: /QTask/ })).toBeInTheDocument();
    expect(within(appsGroup).getByRole('option', { name: /QHRM/ })).toBeInTheDocument();
    expect(within(appsGroup).getByRole('option', { name: /QSocial/ })).toBeInTheDocument();
    expect(within(appsGroup).queryByRole('option', { name: /QCRM/ })).toBeNull();
  });

  it('supports ArrowDown/ArrowUp/Enter navigation and ignores IME composing inside the palette input', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /Tìm mọi thứ trong QSystem/ }));

    const input = within(palette()).getByRole('combobox');
    const options = within(palette()).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    // IME composing Enter/ArrowDown must be ignored.
    const composingArrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    Object.defineProperty(composingArrowDown, 'isComposing', { value: true });
    input.dispatchEvent(composingArrowDown);
    await Promise.resolve();
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    const composingEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(composingEnter, 'isComposing', { value: true });
    input.dispatchEvent(composingEnter);
    await Promise.resolve();
    expect(push).not.toHaveBeenCalled();

    await user.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(push).toHaveBeenCalledWith('/');
  });

  it('uses Lucide module icons, Esc keycap, and clean copy without slop badges or animate classes', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /Tìm mọi thứ trong QSystem/ }));

    const dialog = palette();
    expect(dialog.querySelector('.qp-app-badge')).toBeNull();
    expect(dialog.querySelector('.animate__animated')).toBeNull();
    expect(dialog.textContent ?? '').not.toContain('QSystem Command');
    expect(dialog.querySelector('kbd.qp-esc')).toHaveTextContent('Esc');
    expect(dialog).toHaveTextContent('Esc để đóng');

    const appsGroup = within(dialog).getByRole('group', { name: 'Chuyển ứng dụng' });
    const qtaskOption = within(appsGroup).getByRole('option', { name: /QTask/ });
    expect(qtaskOption.querySelector('svg')).not.toBeNull();
  });
});
