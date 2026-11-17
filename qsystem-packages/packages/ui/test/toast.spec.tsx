import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ToastRegion, toast } from '../src/toast';

describe('Toast', () => {
  it('announces info/success/warning/error variants and dismisses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<ToastRegion />);
      act(() => { toast.success('Saved'); });
      const item = await screen.findByRole('status');
      expect(item).toHaveTextContent('Saved');
      expect(item).toHaveAttribute('data-variant', 'success');
      await user.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      act(() => {
        toast.error('Failed', { duration: 1000 });
        toast.warning('Heads up', { duration: 1000 });
        toast.info('FYI', { duration: 1000 });
      });
      const alerts = await screen.findAllByRole('alert');
      expect(alerts.map((a) => a.getAttribute('data-variant')).sort()).toEqual(['error', 'info', 'warning']);
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('auto-dismisses after duration and pauses on hover/focus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<ToastRegion />);
      act(() => { toast('Hello', { duration: 2000 }); });
      const item = await screen.findByRole('status');
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.getByRole('status')).toBeInTheDocument();
      // Hover pauses dismissal.
      act(() => { item.dispatchEvent(new Event('pointerenter', { bubbles: true })); });
      act(() => { vi.advanceTimersByTime(2000); });
      expect(screen.getByRole('status')).toBeInTheDocument();
      act(() => { item.dispatchEvent(new Event('pointerleave', { bubbles: true })); });
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays paused while focus remains even if the pointer leaves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<ToastRegion />);
      act(() => { toast('Hello', { duration: 1000 }); });
      const item = await screen.findByRole('status');
      act(() => {
        item.dispatchEvent(new Event('focusin', { bubbles: true }));
        item.dispatchEvent(new Event('pointerenter', { bubbles: true }));
        item.dispatchEvent(new Event('pointerleave', { bubbles: true }));
      });
      act(() => { vi.advanceTimersByTime(5000); });
      expect(screen.getByRole('status')).toBeInTheDocument();
      act(() => { item.dispatchEvent(new Event('focusout', { bubbles: true })); });
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the remaining time across rapid hover/focus toggles', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<ToastRegion />);
      act(() => { toast('Hello', { duration: 2000 }); });
      const item = await screen.findByRole('status');
      act(() => { vi.advanceTimersByTime(1500); });
      act(() => {
        for (let i = 0; i < 4; i += 1) {
          item.dispatchEvent(new Event('pointerenter', { bubbles: true }));
          item.dispatchEvent(new Event('pointerleave', { bubbles: true }));
        }
      });
      act(() => { vi.advanceTimersByTime(600); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies an updated duration prop to already-mounted toasts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { rerender } = render(<ToastRegion duration={1000} />);
      act(() => { toast('Hello'); });
      expect(await screen.findByRole('status')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(500); });
      rerender(<ToastRegion duration={3000} />);
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.getByRole('status')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stacks multiple toasts up to visible limit', async () => {
    render(<ToastRegion visibleToasts={2} />);
    act(() => {
      toast('One');
      toast('Two');
      toast('Three');
    });
    expect(await screen.findAllByRole('status')).toHaveLength(2);
  });

  it('does not resurrect hidden toasts after visible ones auto-dismiss', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<ToastRegion visibleToasts={3} />);
      act(() => {
        toast('One', { duration: 1000 });
        toast('Two', { duration: 1000 });
        toast('Three', { duration: 1000 });
        toast('Four', { duration: 1000 });
      });
      expect(screen.getAllByRole('status')).toHaveLength(3);
      // All four expire; only visible ones may be queried, and none may reappear.
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.queryAllByRole('status')).toHaveLength(0);
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.queryAllByRole('status')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('has CSS for every data-position the region can render', () => {
    const css = readFileSync(resolve(__dirname, '../src/styles.css'), 'utf8');
    for (const p of ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']) {
      expect(css).toMatch(new RegExp(`\[data-position=["']${p}["']\]`));
    }
  });

  it('never blocks clicks through the region but keeps cards interactive', () => {
    const css = readFileSync(resolve(__dirname, '../src/styles.css'), 'utf8');
    expect(css).toMatch(/\.qs-toast-region\s*{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.qs-toast\s*{[^}]*pointer-events:\s*auto/);
  });

  it('respects position and theme attributes on the region', () => {
    const { rerender } = render(<ToastRegion position="bottom-center" theme="dark" />);
    const region = screen.getByRole('region', { name: /thông báo/i });
    expect(region).toHaveAttribute('data-position', 'bottom-center');
    expect(region).toHaveAttribute('data-theme', 'dark');
    rerender(<ToastRegion position="top-right" theme="light" />);
    expect(screen.getByRole('region', { name: /thông báo/i })).toHaveAttribute('data-position', 'top-right');
  });

  it('renders a styled Lucide close icon on toast dismiss buttons', async () => {
    render(<ToastRegion />);
    act(() => {
      toast.info('Đã cập nhật');
    });
    const closeBtn = await screen.findByRole('button', { name: 'Đóng thông báo' });
    expect(closeBtn).toHaveClass('qs-toast__close');
    expect(closeBtn.textContent).toBe('');
    const svg = closeBtn.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('stroke-width', '1.5');

    const css = readFileSync(resolve(__dirname, '../src/styles.css'), 'utf8');
    expect(css).toContain('.qs-toast__close');
  });
});
