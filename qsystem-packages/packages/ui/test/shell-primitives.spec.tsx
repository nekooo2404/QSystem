import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModuleSwitcher } from '../src/module-switcher';
import { UnderlineTabs } from '../src/underline-tabs';
import { AttributeRowList } from '../src/attribute-row-list';
import { FilterPopover } from '../src/filter-popover';
import { EmptyState, ErrorState, LoadingSkeleton, StateRegion } from '../src/state-region';
import { UnifiedShell } from '../src/unified-shell';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  fireEvent(window, new Event('resize'));
}

const originalWidth = window.innerWidth;
beforeEach(() => {
  setViewportWidth(1440);
});
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
});

describe('UnderlineTabs', () => {
  function Harness() {
    const [active, setActive] = React.useState('all');
    return (
      <UnderlineTabs
        activeId={active}
        onChange={setActive}
        tabs={[
          { id: 'all', label: 'Tất cả' },
          { id: 'mine', label: 'Của tôi' },
          { id: 'overdue', label: 'Quá hạn' },
        ]}
      />
    );
  }

  it('renders a tablist with aria-selected on the active tab', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
  });

  it('switches tabs with arrow keys and keeps focus on the active tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    // Wraps around from the first tab to the last one.
    await user.keyboard('{ArrowLeft}');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('activates a tab on click and on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UnderlineTabs
        activeId="all"
        onChange={onChange}
        tabs={[
          { id: 'all', label: 'Tất cả' },
          { id: 'mine', label: 'Của tôi' },
        ]}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Của tôi' }));
    expect(onChange).toHaveBeenCalledWith('mine');
    screen.getByRole('tab', { name: 'Của tôi' }).focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('mine');
  });

  it('supports Home/End keyboard navigation and renders count badges', async () => {
    const user = userEvent.setup();
    function CountHarness() {
      const [active, setActive] = React.useState('mine');
      return (
        <UnderlineTabs
          activeId={active}
          onChange={setActive}
          tabs={[
            { id: 'all', label: 'Tất cả', count: 12 },
            { id: 'mine', label: 'Của tôi', count: 4 },
            { id: 'overdue', label: 'Quá hạn', count: 2 },
          ]}
        />
      );
    }
    render(<CountHarness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].querySelector('.qs-tabs__count')).toHaveTextContent('12');
    tabs[1].focus();
    await user.keyboard('{End}');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[2]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveFocus();
  });
});

describe('ModuleSwitcher', () => {
  const modules = [
    { id: 'qtask', name: 'QTask', description: 'Công việc và dự án' },
    { id: 'qhrm', name: 'QHRM', description: 'Tổ chức và nhân sự' },
  ];

  it('renders the Q brand row and an elevated menu with icon, name and description per module', async () => {
    const user = userEvent.setup();
    render(<ModuleSwitcher activeModuleId="qtask" modules={modules} onSelectModule={() => {}} />);
    // Brand row sits above the switcher trigger.
    expect(screen.getByText('QSystem')).toBeInTheDocument();
    const brandMark = screen.getByText('Q');
    expect(brandMark).toHaveClass('qs-module-switcher__mark');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /QTask/ }));
    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('qs-switcher__menu');
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items).toHaveLength(2);
    expect(within(items[1]).getByText('QHRM')).toBeInTheDocument();
    expect(within(items[1]).getByText('Tổ chức và nhân sự')).toBeInTheDocument();
    expect(items[1].querySelector('svg')).not.toBeNull();
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('closes on Escape and reports the selected module', async () => {
    const user = userEvent.setup();
    const onSelectModule = vi.fn();
    render(<ModuleSwitcher activeModuleId="qtask" modules={modules} onSelectModule={onSelectModule} />);

    await user.click(screen.getByRole('button', { name: /QTask/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Focus returns to the trigger after Escape.
    expect(screen.getByRole('button', { name: /QTask/ })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: /QTask/ }));
    await user.click(screen.getByRole('menuitemradio', { name: /QHRM/ }));
    expect(onSelectModule).toHaveBeenCalledWith('qhrm');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('StateRegion', () => {
  it('renders skeleton rows sized like a table while loading', () => {
    render(<LoadingSkeleton rows={4} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region.querySelectorAll('.qs-skeleton')).toHaveLength(4);
  });

  it('renders an empty state with guidance', () => {
    render(<EmptyState title="Chưa có công việc" description="Giao việc đầu tiên cho nhóm của bạn." />);
    expect(screen.getByText('Chưa có công việc')).toBeInTheDocument();
    expect(screen.getByText('Giao việc đầu tiên cho nhóm của bạn.')).toBeInTheDocument();
  });

  it('renders an error state with an accessible retry button', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState description="Không tải được danh sách." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Thử lại' });
    expect(retry).toHaveAccessibleName('Thử lại');
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('switches between loading, empty, error and ready content', () => {
    const { rerender } = render(<StateRegion state="loading" rows={3} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<StateRegion state="empty" emptyTitle="Chưa có nhân sự" />);
    expect(screen.getByText('Chưa có nhân sự')).toBeInTheDocument();
    rerender(<StateRegion state="error" onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    rerender(
      <StateRegion state="ready">
        <p>Nội dung đã tải</p>
      </StateRegion>,
    );
    expect(screen.getByText('Nội dung đã tải')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('AttributeRowList', () => {
  it('pairs labels on the left with values on the right in a definition list', () => {
    render(
      <AttributeRowList
        items={[
          { id: 'assignee', label: 'Phụ trách', value: 'Nguyễn Minh Tuấn' },
          { id: 'due', label: 'Thời hạn', value: '24/11/2026' },
        ]}
      />,
    );
    const labels = screen.getAllByRole('term');
    expect(labels.map((node) => node.textContent)).toEqual(['Phụ trách', 'Thời hạn']);
    expect(labels[0].tagName).toBe('DT');
    const values = screen.getAllByRole('definition');
    expect(values.map((node) => node.textContent)).toEqual(['Nguyễn Minh Tuấn', '24/11/2026']);
    expect(values[0].closest('dl')).toHaveClass('qs-attribute-list');
  });
});

describe('FilterPopover', () => {
  it('opens on the filter trigger, closes on Escape and outside click', async () => {
    const user = userEvent.setup();
    render(
      <FilterPopover>
        <p>Trạng thái</p>
      </FilterPopover>,
    );
    const trigger = screen.getByRole('button', { name: /Bộ lọc/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Trạng thái')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Bộ lọc' })).toBeInTheDocument();
    expect(screen.getByText('Trạng thái')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Trạng thái')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByText('Trạng thái')).not.toBeInTheDocument();
  });
});

describe('UnifiedShell', () => {
  function renderShell(onOpenCommandPalette = vi.fn()) {
    return render(
      <UnifiedShell
        sidebarHeader={<p>Chuyển ứng dụng</p>}
        sidebarNav={
          <nav aria-label="Điều hướng QTask">
            <a href="/tasks">Tất cả công việc</a>
          </nav>
        }
        breadcrumb={<span>QTask / Tất cả công việc</span>}
        onOpenCommandPalette={onOpenCommandPalette}
        topActions={<button type="button">Tài khoản</button>}
      >
        <p>Nội dung bảng</p>
      </UnifiedShell>,
    );
  }

  it('renders a fixed 240px sidebar and 56px top bar with breadcrumb, search and actions', async () => {
    const user = userEvent.setup();
    const onOpenCommandPalette = vi.fn();
    renderShell(onOpenCommandPalette);

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveClass('qs-shell__sidebar');
    expect(screen.getByText('Chuyển ứng dụng')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Điều hướng QTask' })).toBeInTheDocument();

    const topbar = screen.getByRole('banner');
    expect(topbar).toHaveClass('qs-shell__topbar');
    expect(within(topbar).getByText('QTask / Tất cả công việc')).toBeInTheDocument();
    expect(within(topbar).getByRole('button', { name: 'Tài khoản' })).toBeInTheDocument();
    expect(screen.getByText('Nội dung bảng')).toBeInTheDocument();
    // Desktop has no hamburger.
    expect(screen.queryByRole('button', { name: 'Mở điều hướng' })).not.toBeInTheDocument();

    await user.click(within(topbar).getByRole('button', { name: /Tìm việc/ }));
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });

  it('turns the sidebar into a drawer below 1024px and closes it with Escape', async () => {
    const user = userEvent.setup();
    setViewportWidth(900);
    renderShell();

    const hamburger = screen.getByRole('button', { name: 'Mở điều hướng' });
    expect(screen.queryByRole('navigation', { name: 'Điều hướng QTask' })).not.toBeInTheDocument();

    await user.click(hamburger);
    const drawer = screen.getByRole('dialog', { name: 'Điều hướng' });
    expect(within(drawer).getByRole('navigation', { name: 'Điều hướng QTask' })).toBeInTheDocument();

    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Điều hướng' })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the desktop sidebar when the viewport widens again', () => {
    setViewportWidth(900);
    renderShell();
    expect(screen.getByRole('button', { name: 'Mở điều hướng' })).toBeInTheDocument();

    setViewportWidth(1440);
    expect(screen.queryByRole('button', { name: 'Mở điều hướng' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Điều hướng QTask' })).toBeInTheDocument();
  });

  it('renders Lucide icons with stroke-width="1.5" across ModuleSwitcher, FilterPopover, and UnifiedShell', async () => {
    const user = userEvent.setup();
    render(
      <UnifiedShell
        sidebarHeader={
          <ModuleSwitcher
            activeModuleId="qtask"
            modules={[
              { id: 'qtask', name: 'QTask', description: 'Công việc' },
              { id: 'qhrm', name: 'QHRM', description: 'Nhân sự' },
            ]}
            onSelectModule={() => {}}
          />
        }
        sidebarNav={<nav aria-label="Điều hướng" />}
        breadcrumb={<span>QTask</span>}
        onOpenCommandPalette={() => {}}
        topActions={
          <FilterPopover label="Bộ lọc">
            <span>Lọc</span>
          </FilterPopover>
        }
      >
        <p>Nội dung</p>
      </UnifiedShell>,
    );
    await user.click(screen.getByRole('button', { name: /QTask/ }));
    const svgs = Array.from(document.querySelectorAll('svg'));
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute('stroke-width', '1.5');
    }
  });
});
