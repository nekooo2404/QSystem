import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NotFound from '../src/app/not-found';
import RouteError from '../src/app/error';
import GlobalError from '../src/app/global-error';
import WorkspaceLoading from '../src/app/(workspace)/loading';

describe('App Route Boundaries', () => {
  it('renders not-found boundary with Vietnamese operator copy and navigation links', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' })).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về không gian làm việc' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login');
  });

  it('renders route error boundary with digest and triggers reset() on Thử lại', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const error = Object.assign(new Error('Boom'), { digest: 'ERR-42' });

    render(<RouteError error={error} reset={reset} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Đã xảy ra sự cố ngoài ý muốn' })).toBeInTheDocument();
    expect(screen.getByText('ERR-42')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
    consoleSpy.mockRestore();
  });

  it('renders global error boundary with Steel-Cobalt tokens and triggers reset() on Tải lại ứng dụng', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const error = Object.assign(new Error('Fatal'), { digest: 'ROOT-99' });

    const { container } = render(<GlobalError error={error} reset={reset} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Hệ thống đang khôi phục' })).toBeInTheDocument();
    expect(screen.getByText('ROOT-99')).toBeInTheDocument();
    expect(container.innerHTML).toContain('#111317');
    expect(container.innerHTML).toContain('#f6f8fb');
    expect(screen.getByRole('link', { name: 'Về trang đăng nhập' })).toHaveAttribute('href', '/login');

    await user.click(screen.getByRole('button', { name: 'Tải lại ứng dụng' }));
    expect(reset).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it('renders workspace loading skeleton boundary with status role', () => {
    const { container } = render(<WorkspaceLoading />);
    const statuses = screen.getAllByRole('status', { name: 'Đang tải không gian làm việc' });
    expect(statuses.length).toBeGreaterThanOrEqual(1);
    for (const status of statuses) {
      expect(status).toHaveAttribute('aria-busy', 'true');
    }
    expect(container.querySelectorAll('.qs-skeleton')).toHaveLength(6);
  });
});
