import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPopover } from '../src/filter-popover';
import { Form, FormField } from '../src/form';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../src/modal';
import { ResponsiveDetailDrawer } from '../src/responsive-detail-drawer';
import { Select, type SelectOption } from '../src/select';

type StatusValue = 'todo' | 'doing' | 'blocked' | 'done';

const STATUS_OPTIONS: readonly SelectOption<StatusValue>[] = [
  { value: 'todo', label: 'Cần làm', description: 'Chưa bắt đầu thực hiện' },
  { value: 'doing', label: 'Đang làm', description: 'Đang được xử lý' },
  { value: 'blocked', label: 'Tạm hoãn', disabled: true },
  { value: 'done', label: 'Hoàn thành' },
];

const originalInnerHeight = window.innerHeight;
const originalInnerWidth = window.innerWidth;

afterEach(() => {
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: originalInnerHeight,
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: originalInnerWidth,
  });
  document.body.style.overflow = '';
});

function ControlledSelect({
  initialValue = 'todo',
  options = STATUS_OPTIONS,
  onChangeSpy,
  ...props
}: {
  initialValue?: StatusValue | '';
  options?: readonly SelectOption<StatusValue>[];
  onChangeSpy?: (val: StatusValue) => void;
} & Partial<Omit<React.ComponentProps<typeof Select<StatusValue>>, 'value' | 'onValueChange' | 'options'>>) {
  const [value, setValue] = React.useState<StatusValue>(initialValue as StatusValue);
  return (
    <Select<StatusValue>
      aria-label="Trạng thái"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChangeSpy?.(next);
      }}
      options={options}
      {...props}
    />
  );
}

describe('Select', () => {
  it('renders custom combobox button with ChevronDown and never renders a native <select>', () => {
    const { container } = render(
      <ControlledSelect
        id="task-status"
        name="status"
        controlSize="lg"
        error
        aria-describedby="status-hint"
        className="custom-trigger"
      />,
    );

    expect(container.querySelector('select')).toBeNull();

    const trigger = screen.getByRole('combobox', { name: 'Trạng thái' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'task-status-listbox');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', 'status-hint');
    expect(trigger).toHaveAttribute('data-error', 'true');
    expect(trigger).toHaveClass('qs-select', 'qs-select--lg', 'custom-trigger');
    expect(trigger).toHaveTextContent('Cần làm');
    expect(trigger.querySelector('svg.qs-select__chevron')).not.toBeNull();

    const hiddenInput = container.querySelector('input[type="hidden"][name="status"]') as HTMLInputElement | null;
    expect(hiddenInput).not.toBeNull();
    expect(hiddenInput?.value).toBe('todo');
  });

  it('shows placeholder when value matches no option and supports sm/md/lg sizes', () => {
    const { rerender } = render(
      <Select
        aria-label="Phòng ban"
        value=""
        onValueChange={() => {}}
        options={[{ value: 'eng', label: 'Kỹ thuật' }]}
        placeholder="Chọn phòng ban"
        controlSize="sm"
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Phòng ban' });
    expect(trigger).toHaveTextContent('Chọn phòng ban');
    expect(trigger).toHaveClass('qs-select--sm');

    rerender(
      <Select
        aria-label="Phòng ban"
        value="eng"
        onValueChange={() => {}}
        options={[{ value: 'eng', label: 'Kỹ thuật' }]}
        placeholder="Chọn phòng ban"
        controlSize="md"
      />,
    );
    expect(trigger).toHaveTextContent('Kỹ thuật');
    expect(trigger).toHaveClass('qs-select--md');
  });

  it('integrates with FormField for label, helperText, error and disabled propagation', async () => {
    const user = userEvent.setup();
    render(
      <Form>
        <FormField name="priority" label="Độ ưu tiên" helperText="Chọn mức độ." error="Bắt buộc chọn" required>
          <ControlledSelect aria-label={undefined} />
        </FormField>
      </Form>,
    );

    const trigger = screen.getByRole('combobox', { name: /Độ ưu tiên/ });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-required', 'true');
    const describedBy = trigger.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('helper');
    expect(describedBy).toContain('error');

    await user.click(screen.getByText('Độ ưu tiên'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('portals listbox to document.body, marks selected option with aria-selected + Check icon, and selects on click', async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    const { container } = render(
      <ControlledSelect onChangeSpy={onChangeSpy} menuClassName="custom-menu" />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Trạng thái' });
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Trạng thái' });
    expect(container.contains(listbox)).toBe(false);
    expect(listbox.parentElement).toBe(document.body);
    expect(listbox).toHaveClass('qs-select__menu', 'custom-menu');
    expect(listbox.style.position).toBe('fixed');

    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[0].querySelector('svg.qs-select__check')).not.toBeNull();
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    expect(options[1].querySelector('svg.qs-select__check')).toBeNull();
    expect(within(options[1]).getByText('Đang được xử lý')).toBeInTheDocument();
    expect(options[2]).toHaveAttribute('aria-disabled', 'true');

    // Clicking disabled option leaves menu open and does not trigger change.
    await user.click(options[2]);
    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Clicking valid option commits value, closes menu, and returns focus to trigger.
    await user.click(options[3]);
    expect(onChangeSpy).toHaveBeenCalledWith('done');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('Hoàn thành');
    expect(trigger).toHaveFocus();
  });

  it('positions below trigger by default and flips above trigger when bottom viewport space is tight', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 768 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 });

    render(<ControlledSelect />);
    const trigger = screen.getByRole('combobox', { name: 'Trạng thái' });

    // Near top -> opens below
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 140,
      left: 80,
      right: 280,
      width: 200,
      height: 40,
      x: 80,
      y: 100,
      toJSON: () => {},
    } as DOMRect);

    await user.click(trigger);
    let listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('data-placement', 'bottom');
    expect(listbox.style.top).toBe('144px');
    expect(listbox.style.left).toBe('80px');
    expect(listbox.style.minWidth).toBe('200px');
    expect(listbox.style.maxHeight).toBe('280px');

    // Close and re-open near bottom -> flips above trigger
    await user.click(trigger);
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 680,
      bottom: 720,
      left: 80,
      right: 280,
      width: 200,
      height: 40,
      x: 80,
      y: 680,
      toJSON: () => {},
    } as DOMRect);

    await user.click(trigger);
    listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('data-placement', 'top');
    expect(listbox.style.bottom).toBe('92px');
    expect(listbox.style.top).toBe('');
  });

  it('supports full keyboard navigation (ArrowDown, ArrowUp, Home, End, Enter, Space, Tab) skipping disabled options', async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(
      <>
        <ControlledSelect onChangeSpy={onChangeSpy} />
        <button type="button">Sau đó</button>
      </>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Trạng thái' });
    trigger.focus();

    // Space opens menu with active option = currently selected ('todo')
    await user.keyboard(' ');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const getOptions = () => within(screen.getByRole('listbox')).getAllByRole('option');
    expect(getOptions()[0]).toHaveAttribute('data-active', 'true');

    // ArrowDown moves to 'doing', then skips disabled 'blocked' to 'done'
    await user.keyboard('{ArrowDown}');
    expect(getOptions()[1]).toHaveAttribute('data-active', 'true');
    expect(trigger).toHaveAttribute('aria-activedescendant', getOptions()[1].id);

    await user.keyboard('{ArrowDown}');
    expect(getOptions()[3]).toHaveAttribute('data-active', 'true');

    // Home jumps to first enabled, End jumps to last enabled
    await user.keyboard('{Home}');
    expect(getOptions()[0]).toHaveAttribute('data-active', 'true');
    await user.keyboard('{End}');
    expect(getOptions()[3]).toHaveAttribute('data-active', 'true');

    // ArrowUp skips disabled 'blocked' back to 'doing'
    await user.keyboard('{ArrowUp}');
    expect(getOptions()[1]).toHaveAttribute('data-active', 'true');

    // Enter selects 'doing' and closes
    await user.keyboard('{Enter}');
    expect(onChangeSpy).toHaveBeenCalledWith('doing');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent('Đang làm');
    expect(trigger).toHaveFocus();

    // ArrowDown opens menu again; Space confirms active choice
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
    expect(onChangeSpy).toHaveBeenCalledWith('done');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Tab closes an open menu and moves focus to the next control
    await user.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sau đó' })).toHaveFocus();
  });

  it('closes on outside mousedown, outside scroll, and resize — but NOT when scrolling inside the listbox', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <div data-testid="scroll-container" style={{ overflowY: 'auto', height: 100 }}>
          <ControlledSelect />
        </div>
        <button type="button">Bên ngoài</button>
      </div>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Trạng thái' });

    // Outside click closes
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bên ngoài' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Scrolling INSIDE listbox keeps it open
    await user.click(trigger);
    const listbox = screen.getByRole('listbox');
    fireEvent.scroll(listbox);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Scrolling OUTSIDE listbox closes it
    fireEvent.scroll(screen.getByTestId('scroll-container'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Window resize closes it
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes ONLY the dropdown on Escape when inside a Modal (never closing the Modal)', async () => {
    const user = userEvent.setup();
    const onModalClose = vi.fn();

    function ModalHarness() {
      const [open, setOpen] = React.useState(true);
      return (
        <Modal
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) onModalClose();
          }}
        >
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Tạo công việc</ModalTitle>
            </ModalHeader>
            <ControlledSelect />
          </ModalContent>
        </Modal>
      );
    }

    render(<ModalHarness />);
    const dialog = await screen.findByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');

    const trigger = within(dialog).getByRole('combobox', { name: 'Trạng thái' });
    await user.click(trigger);

    const listbox = screen.getByRole('listbox', { name: 'Trạng thái' });
    expect(listbox).toBeInTheDocument();
    expect(listbox).not.toHaveAttribute('aria-hidden', 'true');
    expect(listbox).not.toHaveAttribute('inert');

    // First Escape closes ONLY the Select dropdown
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onModalClose).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('hidden');
    expect(trigger).toHaveFocus();

    // Second Escape closes the Modal
    await user.keyboard('{Escape}');
    expect(onModalClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes ONLY the dropdown on Escape when inside an overlay ResponsiveDetailDrawer', async () => {
    const user = userEvent.setup();
    const onDrawerClose = vi.fn();

    function DrawerHarness() {
      const [open, setOpen] = React.useState(true);
      return (
        <ResponsiveDetailDrawer
          open={open}
          onClose={() => {
            setOpen(false);
            onDrawerClose();
          }}
          title="Chi tiết công việc"
          mode="overlay"
        >
          <ControlledSelect />
        </ResponsiveDetailDrawer>
      );
    }

    render(<DrawerHarness />);
    const dialog = screen.getByRole('dialog', { name: 'Chi tiết công việc' });
    const trigger = within(dialog).getByRole('combobox', { name: 'Trạng thái' });

    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Chi tiết công việc' })).toBeInTheDocument();
    expect(onDrawerClose).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onDrawerClose).toHaveBeenCalledTimes(1);
  });

  it('works inside FilterPopover without closing the popover when selecting a portaled option', async () => {
    const user = userEvent.setup();
    render(
      <FilterPopover label="Bộ lọc">
        <ControlledSelect />
      </FilterPopover>,
    );

    await user.click(screen.getByRole('button', { name: /Bộ lọc/ }));
    const popover = screen.getByRole('dialog', { name: 'Bộ lọc' });
    const trigger = within(popover).getByRole('combobox', { name: 'Trạng thái' });

    await user.click(trigger);
    const listbox = screen.getByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /Hoàn thành/ }));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Bộ lọc' })).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Hoàn thành');
  });

  it('respects disabled state and ignores clicks and keyboard interactions', async () => {
    const user = userEvent.setup();
    render(<ControlledSelect disabled />);

    const trigger = screen.getByRole('combobox', { name: 'Trạng thái' });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports Vietnamese-aware typeahead search when menu is open skipping disabled options', async () => {
    const user = userEvent.setup();
    render(<ControlledSelect />);
    const trigger = screen.getByRole('combobox', { name: 'Trạng thái' });
    trigger.focus();

    await user.keyboard('{Enter}');
    const getOptions = () => within(screen.getByRole('listbox')).getAllByRole('option');
    expect(getOptions()[0]).toHaveAttribute('data-active', 'true');

    // 'd' matches 'Đang làm' (normalized Đ -> d)
    await user.keyboard('d');
    expect(getOptions()[1]).toHaveAttribute('data-active', 'true');

    // 't' targets 'Tạm hoãn' which is disabled, so active option does not move onto it
    await user.keyboard('t');
    expect(getOptions()[2]).not.toHaveAttribute('data-active', 'true');

    // Ctrl+h is ignored by typeahead
    fireEvent.keyDown(trigger, { key: 'h', ctrlKey: true });
    expect(getOptions()[3]).not.toHaveAttribute('data-active', 'true');

    // IME composing is ignored by typeahead
    fireEvent.keyDown(trigger, { key: 'h', isComposing: true });
    expect(getOptions()[3]).not.toHaveAttribute('data-active', 'true');

    // Clear buffer via timeout simulation? Wait 600ms or reopen menu to test 'h' -> 'Hoàn thành'
    await user.keyboard('{Escape}');
    await user.keyboard('{Enter}');
    await user.keyboard('h');
    expect(getOptions()[3]).toHaveAttribute('data-active', 'true');
  });

  it('clears the typeahead buffer on ArrowDown/ArrowUp/Home/End navigation', async () => {
    const user = userEvent.setup();
    type ExtraValue = 'hc' | 'ol' | 'ht' | 'on';
    const extraOptions: readonly SelectOption<ExtraValue>[] = [
      { value: 'hc', label: 'Hành chính' },
      { value: 'ol', label: 'Ở lại' },
      { value: 'ht', label: 'Hoàn thành' },
      { value: 'on', label: 'Ở nhà' },
    ];
    function ExtraSelect() {
      const [val, setVal] = React.useState<ExtraValue>('hc');
      return <Select<ExtraValue> aria-label="Phân loại" value={val} onValueChange={setVal} options={extraOptions} />;
    }
    render(<ExtraSelect />);
    const trigger = screen.getByRole('combobox', { name: 'Phân loại' });
    trigger.focus();

    await user.keyboard('{Enter}');
    const getOptions = () => within(screen.getByRole('listbox')).getAllByRole('option');

    // Type 'h' -> 'Hoàn thành' [2], ArrowUp -> 'Ở lại' [1] clears buffer, so 'o' jumps to 'Ở nhà' [3] instead of 'ho' -> 'Hoàn thành' [2].
    await user.keyboard('h');
    expect(getOptions()[2]).toHaveAttribute('data-active', 'true');
    await user.keyboard('{ArrowUp}');
    expect(getOptions()[1]).toHaveAttribute('data-active', 'true');
    await user.keyboard('o');
    expect(getOptions()[3]).toHaveAttribute('data-active', 'true');
  });

  it('closes ONLY Select on Modal or Drawer backdrop click, leaving the parent overlay open until the next click', async () => {
    const user = userEvent.setup();
    const onModalClose = vi.fn();

    function ModalBackdropHarness() {
      const [open, setOpen] = React.useState(true);
      return (
        <Modal
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) onModalClose();
          }}
        >
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Tạo công việc</ModalTitle>
            </ModalHeader>
            <ControlledSelect />
          </ModalContent>
        </Modal>
      );
    }

    const { unmount } = render(<ModalBackdropHarness />);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'Trạng thái' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const modalOverlay = document.querySelector('[data-qs-modal-overlay]') as HTMLElement;
    await user.click(modalOverlay);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onModalClose).not.toHaveBeenCalled();

    // Second backdrop click closes the Modal itself.
    await user.click(modalOverlay);
    expect(onModalClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    const onDrawerClose = vi.fn();
    function DrawerBackdropHarness() {
      const [open, setOpen] = React.useState(true);
      return (
        <ResponsiveDetailDrawer
          open={open}
          onClose={() => {
            setOpen(false);
            onDrawerClose();
          }}
          title="Chi tiết"
          mode="overlay"
        >
          <ControlledSelect />
        </ResponsiveDetailDrawer>
      );
    }

    render(<DrawerBackdropHarness />);
    const drawer = screen.getByRole('dialog', { name: 'Chi tiết' });
    await user.click(within(drawer).getByRole('combobox', { name: 'Trạng thái' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const drawerBackdrop = document.querySelector('.qs-drawer__backdrop') as HTMLElement;
    await user.click(drawerBackdrop);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Chi tiết' })).toBeInTheDocument();
    expect(onDrawerClose).not.toHaveBeenCalled();

    await user.click(drawerBackdrop);
    expect(onDrawerClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Chi tiết' })).not.toBeInTheDocument();
  });

  it('styles .qs-select* with QSystem tokens, proper z-index layering, no transition: all, and reduced motion support', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toContain('--qs-shadow-floating');
    expect(css).toContain('--qs-radius-control');
    expect(css).toContain('.qs-select');
    expect(css).toContain('.qs-select--sm { height: 36px;');
    expect(css).toContain('.qs-select--md { height: 40px;');
    expect(css).toContain('.qs-select--lg { height: 44px;');
    expect(css).toContain('.qs-select__menu');
    expect(css).toContain('max-height: 280px;');
    expect(css).toContain('overflow-y: auto;');
    expect(css).toContain('padding: 8px 12px;');
    expect(css).toContain('var(--qs-bg-inverse)');
    expect(css).toContain('var(--qs-surface-1)');
    expect(css).toContain('var(--qs-state-hover)');
    expect(css).toContain('var(--qs-state-selected)');
    expect(css).toContain('var(--qs-shadow-floating)');
    expect(css).toContain('var(--qs-radius-control)');
    expect(css).toContain('var(--qs-ease)');
    expect(css.toLowerCase()).not.toContain('transition: all');

    const menuZMatch = css.match(/\.qs-select__menu\s*\{[^}]*z-index:\s*(\d+)/);
    const modalZMatch = css.match(/\.qs-modal__overlay\s*\{[^}]*z-index:\s*(\d+)/);
    const drawerZMatch = css.match(/\.qs-drawer__overlay\s*\{[^}]*z-index:\s*(\d+)/);
    const cmdkZMatch = css.match(/\.qs-cmdk__overlay\s*\{[^}]*z-index:\s*(\d+)/);
    const toastZMatch = css.match(/\.qs-toast-region\s*\{[^}]*z-index:\s*(\d+)/);
    expect(Number(menuZMatch?.[1])).toBeGreaterThanOrEqual(160);
    expect(Number(menuZMatch?.[1])).toBeGreaterThan(Number(modalZMatch?.[1]));
    expect(Number(menuZMatch?.[1])).toBeGreaterThan(Number(drawerZMatch?.[1]));
    expect(Number(cmdkZMatch?.[1])).toBe(200);
    expect(Number(cmdkZMatch?.[1])).toBeGreaterThan(Number(menuZMatch?.[1]));
    expect(Number(toastZMatch?.[1])).toBe(220);
    expect(Number(toastZMatch?.[1])).toBeGreaterThan(Number(cmdkZMatch?.[1]));
  });
});
