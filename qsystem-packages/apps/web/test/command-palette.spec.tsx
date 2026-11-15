import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppWorkspaceShell } from '../src/components/shell/AppWorkspaceShell';
import { ThemeProvider } from '../src/lib/theme';

const push = vi.fn();
let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
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

    await user.click(screen.getByRole('button', { name: /Tìm việc, nhân sự, tài liệu/ }));
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
    await user.click(screen.getByRole('button', { name: /Tìm việc, nhân sự, tài liệu/ }));

    const labelTexts = Array.from(palette().querySelectorAll('.qs-cmdk__group-label')).map(
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
    await user.click(screen.getByRole('button', { name: /Tìm việc, nhân sự, tài liệu/ }));

    await user.click(within(palette()).getByRole('option', { name: /Danh bạ nhân sự/ }));
    expect(push).toHaveBeenCalledWith('/org');
  });

  it('debounces GET /api/search and shows the hits', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /Tìm việc, nhân sự, tài liệu/ }));

    await user.type(within(palette()).getByRole('combobox'), 'báo cáo');

    expect(await within(palette()).findByText('Báo cáo quý IV')).toBeInTheDocument();
    // One request for the whole burst of keystrokes, not one per character.
    expect(calls.filter((url) => url.startsWith('/api/search'))).toHaveLength(1);
    expect(calls.find((url) => url.startsWith('/api/search'))).toContain('q=b%C3%A1o%20c%C3%A1o');
  });
});
