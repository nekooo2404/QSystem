import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import FilesPage from '../src/app/(workspace)/files/page';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('../src/lib/api/client', () => ({ apiFetch, ApiError: class extends Error {} }));
beforeEach(() => apiFetch.mockReset());

it('distinguishes pending, failed, and successfully empty lists', async () => {
  let reject!: (error: Error) => void;
  apiFetch.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValueOnce([]);
  render(<FilesPage />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText('Chưa có tệp nào')).toBeNull();
  reject(new Error('offline'));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Chưa có tệp nào')).toBeInTheDocument();
});

it('keeps a completed upload when an older list response arrives and deduplicates file opening', async () => {
  let resolveList!: (rows: unknown[]) => void;
  let resolveOpen!: (file: unknown) => void;
  apiFetch.mockImplementationOnce(() => new Promise(resolve => { resolveList = resolve; }))
    .mockResolvedValueOnce({ fileId: 'new', uploadUrl: '/upload-fixture' })
    .mockImplementationOnce(() => new Promise(resolve => { resolveOpen = resolve; }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  const user = userEvent.setup();
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  render(<FilesPage />);
  await user.upload(screen.getByLabelText('Chọn tệp để tải lên'), new File(['data'], 'Báo cáo mới.pdf', { type: 'application/pdf' }));
  expect(await screen.findByText('Báo cáo mới.pdf')).toBeInTheDocument();
  await act(async () => resolveList([{ id: 'old', key: 'uploads/Tài liệu cũ.pdf' }]));
  expect(screen.getByText('Báo cáo mới.pdf')).toBeInTheDocument();
  expect(screen.getByText('Tài liệu cũ.pdf')).toBeInTheDocument();
  const button = screen.getAllByRole('button', { name: 'Mở tệp' })[0];
  await user.dblClick(button);
  expect(apiFetch.mock.calls.filter(call => call[0] === '/api/files/new')).toHaveLength(1);
  expect(button).toBeDisabled();
  await act(async () => resolveOpen({ id: 'new', url: '/download-fixture' }));
  expect(open).toHaveBeenCalledOnce();
  open.mockRestore();
  vi.unstubAllGlobals();
});
