import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import AccountPage from '../src/app/(workspace)/account/page';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../src/lib/api/client', () => ({ apiFetch, ApiError: class extends Error {}, setAccessToken: vi.fn() }));

it('settles a failed profile request and retries only the profile', async () => {
  apiFetch.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('still offline')).mockResolvedValueOnce({ name: 'Nguyễn Minh Tuấn', email: 'tuan@qsystem.vn', role: 'EMPLOYEE' });
  render(<AccountPage />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Nguyễn Minh Tuấn')).toBeInTheDocument();
  expect(apiFetch.mock.calls.map(call => call[0])).toEqual(['/api/me', '/api/me', '/api/me']);
});
