import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, useCommandPaletteHotkey } from '../src/command-palette';
import { ResponsiveDetailDrawer } from '../src/responsive-detail-drawer';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  act(() => {
    fireEvent(window, new Event('resize'));
  });
}

const originalWidth = window.innerWidth;
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 });
});
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
  document.body.style.overflow = '';
});

const groups = [
  {
    id: 'go',
    label: 'Đi tới',
    items: [
      { id: 'all', label: 'Tất cả công việc', hint: 'QTask' },
      { id: 'mine', label: 'Công việc của tôi', hint: 'QTask' },
    ],
  },
  {
    id: 'apps',
    label: 'Chuyển ứng dụng',
    items: [{ id: 'qhrm', label: 'QHRM', hint: 'Tổ chức và nhân sự' }],
  },
  {
    id: 'actions',
    label: 'Thao tác nhanh',
    items: [{ id: 'create', label: 'Giao việc mới' }],
  },
];

function PaletteHarness(props: { initialOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = React.useState(props.initialOpen ?? true);
  const [query, setQuery] = React.useState('');
  useCommandPaletteHotkey({ open, onOpenChange: setOpen });
  return (
    <CommandPalette
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      }}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
    />
  );
}

describe('CommandPalette', () => {
  it('renders unnumbered group headings inside a 640px floating dialog', () => {
    render(<PaletteHarness />);
    const dialog = screen.getByRole('dialog', { name: 'Tìm nhanh' });
    expect(dialog).toHaveClass('qs-cmdk__panel');
    const headings = Array.from(document.querySelectorAll('.qs-cmdk__group-label'));
    expect(headings.map((n) => n.textContent)).toEqual(['Đi tới', 'Chuyển ứng dụng', 'Thao tác nhanh']);
    // No 1-2-3 numbering in the group headings.
    for (const heading of headings) expect(heading.textContent).not.toMatch(/^\s*\d/);
    const input = screen.getByRole('combobox');
    expect(input).toHaveClass('qs-cmdk__input');
  });

  it('moves the active option with ArrowDown/ArrowUp and selects it with Enter', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(true);
      const [query, setQuery] = React.useState('');
      return (
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          query={query}
          onQueryChange={setQuery}
          groups={[
            {
              id: 'go',
              label: 'Đi tới',
              items: [
                { id: 'all', label: 'Tất cả công việc', onSelect },
                { id: 'mine', label: 'Công việc của tôi', onSelect },
              ],
            },
          ]}
        />
      );
    }
    render(<Harness />);
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and focuses the search input when opened', () => {
    const onOpenChange = vi.fn();
    render(<PaletteHarness onOpenChange={onOpenChange} />);
    expect(screen.getByRole('combobox')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('filters items by the current query and shows an empty message when nothing matches', () => {
    function Harness() {
      const [query, setQuery] = React.useState('');
      return (
        <CommandPalette
          open
          onOpenChange={() => {}}
          query={query}
          onQueryChange={setQuery}
          groups={groups}
          emptyText="Không tìm thấy kết quả"
        />
      );
    }
    render(<Harness />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'nhân sự' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Không tìm thấy kết quả')).toBeInTheDocument();
  });

  it('shows a loading row while results load', () => {
    render(
      <CommandPalette open onOpenChange={() => {}} query="" onQueryChange={() => {}} groups={[]} loading />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('opens on Ctrl+K and closes on Escape, ignoring IME composing key events', () => {
    const onOpenChange = vi.fn();
    const Wrapper = () => {
      const [open, setOpen] = React.useState(false);
      useCommandPaletteHotkey({
        open,
        onOpenChange: (next) => {
          setOpen(next);
          onOpenChange(next);
        },
      });
      return (
        <CommandPalette
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            onOpenChange(next);
          }}
          query=""
          onQueryChange={() => {}}
          groups={groups}
        />
      );
    };
    render(<Wrapper />);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true, isComposing: true });
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'k', metaKey: true, isComposing: true });
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('combobox')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('does not steal Ctrl+K or J/K typing inside inputs and contenteditable', () => {
    const onOpenChange = vi.fn();
    function Wrapper() {
      const [open, setOpen] = React.useState(false);
      useCommandPaletteHotkey({
        open,
        onOpenChange: (next) => {
          setOpen(next);
          onOpenChange(next);
        },
      });
      return (
        <>
          <input type="search" aria-label="Ô nhập" defaultValue="Gõ tiếng Việt" />
          <textarea aria-label="Ghi chú" defaultValue="" />
          <div role="textbox" aria-label="Soạn thảo" contentEditable suppressContentEditableWarning>
            nội dung
          </div>
        </>
      );
    }
    render(<Wrapper />);

    fireEvent.keyDown(screen.getByLabelText('Ô nhập'), { key: 'k', ctrlKey: true });
    fireEvent.keyDown(screen.getByLabelText('Ghi chú'), { key: 'k', metaKey: true });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Soạn thảo' }), { key: 'k', ctrlKey: true });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('renders errorText recovery UI with role="alert" and triggers onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="bao cao"
        onQueryChange={() => {}}
        groups={[]}
        errorText="Không thể tìm kiếm lúc này."
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Không thể tìm kiếm lúc này.');
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('ResponsiveDetailDrawer', () => {
  function Drawer(props: { onClose?: () => void }) {
    return (
      <ResponsiveDetailDrawer
        open
        onClose={props.onClose ?? (() => {})}
        title="Giao báo cáo tuần"
        subtitle="CV-1042"
        footer={<button type="button">Hoàn thành việc</button>}
      >
        <p>Phụ trách: Nguyễn Minh Tuấn</p>
        <button type="button">Ghi chú</button>
      </ResponsiveDetailDrawer>
    );
  }

  it('renders a static 390px side panel at 1440px with no dialog role and no scroll lock', () => {
    render(
      <ResponsiveDetailDrawer open onClose={() => {}} title="Giao báo cáo tuần" subtitle="CV-1042">
        <p>Phụ trách: Nguyễn Minh Tuấn</p>
      </ResponsiveDetailDrawer>,
    );
    const panel = screen.getByRole('region', { name: 'Giao báo cáo tuần' });
    expect(panel).toHaveClass('qs-drawer', 'qs-drawer--inline');
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Phụ trách: Nguyễn Minh Tuấn')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('renders an overlay dialog with backdrop below 1280px', () => {
    setViewportWidth(1024);
    render(<Drawer />);
    const dialog = screen.getByRole('dialog', { name: 'Giao báo cáo tuần' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('qs-drawer--overlay');
    expect(document.querySelector('.qs-drawer__backdrop')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores focus to the selected row and releases the scroll lock when closed', async () => {
    const user = userEvent.setup();
    setViewportWidth(1024);
    const onClose = vi.fn();
    function FocusHarness() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button
            type="button"
            aria-label="Chọn việc Giao báo cáo tuần"
            onClick={(event) => {
              event.currentTarget.focus();
              setOpen(true);
            }}
          >
            Giao báo cáo tuần
          </button>
          <ResponsiveDetailDrawer
            open={open}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            title="Giao báo cáo tuần"
          >
            <p>Chi tiết</p>
          </ResponsiveDetailDrawer>
        </div>
      );
    }
    render(<FocusHarness />);
    const row = screen.getByRole('button', { name: 'Chọn việc Giao báo cáo tuần' });
    await user.click(row);
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('');
    // The closed panel hands focus back to the row that opened it.
    expect(row).toHaveFocus();

    // Escape closes the same way and restores focus too.
    await user.click(row);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(row).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('does not leak body overflow after unmount or when resizing back to desktop', () => {
    setViewportWidth(1024);
    const { unmount } = render(<Drawer />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');

    setViewportWidth(1024);
    render(<Drawer />);
    expect(document.body.style.overflow).toBe('hidden');
    setViewportWidth(1440);
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('region', { name: 'Giao báo cáo tuần' })).toBeInTheDocument();
  });

  it('closes on backdrop click in overlay mode only', async () => {
    const user = userEvent.setup();
    setViewportWidth(1024);
    const onClose = vi.fn();
    render(<Drawer onClose={onClose} />);
    await user.click(document.querySelector('.qs-drawer__backdrop') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('honours an explicit slide mode regardless of viewport', () => {
    setViewportWidth(1440);
    render(
      <ResponsiveDetailDrawer open onClose={() => {}} title="Chi tiết" mode="overlay">
        <p>Nội dung</p>
      </ResponsiveDetailDrawer>,
    );
    expect(screen.getByRole('dialog', { name: 'Chi tiết' })).toBeInTheDocument();
  });
});
