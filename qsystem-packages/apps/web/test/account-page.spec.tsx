import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import AccountPage from '../src/app/(workspace)/account/page';

const { apiFetch, push, setAccessToken } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  push: vi.fn(),
  setAccessToken: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../src/lib/api/client', () => ({ apiFetch, ApiError: class extends Error {}, setAccessToken }));

beforeEach(() => {
  apiFetch.mockReset();
  push.mockReset();
  setAccessToken.mockReset();
});

it('settles a failed profile request and retries only the profile', async () => {
  apiFetch
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce(new Error('still offline'))
    .mockResolvedValueOnce({ name: 'Nguyễn Minh Tuấn', email: 'tuan@qsystem.vn', role: 'EMPLOYEE' });
  render(<AccountPage />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Nguyễn Minh Tuấn')).toBeInTheDocument();
  expect(apiFetch.mock.calls.map((call) => call[0])).toEqual(['/api/me', '/api/me', '/api/me']);
});

it('fails closed on password update errors without redirecting or faking success', async () => {
  apiFetch
    .mockResolvedValueOnce({ name: 'Nguyễn Minh Tuấn', email: 'tuan@qsystem.vn', role: 'EMPLOYEE' })
    .mockRejectedValueOnce(new Error('server unavailable'));
  const user = userEvent.setup();
  render(<AccountPage />);
  expect(await screen.findByText('Nguyễn Minh Tuấn')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
  await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'OldPass!123');
  await user.type(screen.getByLabelText('Mật khẩu mới'), 'NewStrong!456');
  await user.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }));

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(setAccessToken).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalledWith('/login');
});

it('clears access token, sets logout cookie, and navigates to /login on logout', async () => {
  apiFetch
    .mockResolvedValueOnce({ name: 'Nguyễn Minh Tuấn', email: 'tuan@qsystem.vn', role: 'EMPLOYEE' })
    .mockResolvedValueOnce({ ok: true });
  const user = userEvent.setup();
  render(<AccountPage />);
  expect(await screen.findByText('Nguyễn Minh Tuấn')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

  expect(setAccessToken).toHaveBeenCalledWith(null);
  expect(document.cookie).toContain('qsystem_logged_out=1');
  expect(push).toHaveBeenCalledWith('/login');
});
