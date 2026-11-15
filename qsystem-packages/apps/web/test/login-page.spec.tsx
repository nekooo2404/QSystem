import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import LoginPage from '../src/app/login/page';
import { ThemeProvider } from '../src/lib/theme';

afterEach(cleanup);

// Mirrors the real tree: root layout wraps every page in ThemeProvider.
const renderPage = () =>
  render(
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>,
  );

describe('/login', () => {
  it('shows the Q mark, the QSystem wordmark and sign-in heading — no extra tables', () => {
    const { container } = renderPage();
    expect(screen.getByText('QSystem', { selector: '.lg-logo__word' })).toBeInTheDocument();
    expect(screen.getByText('Q', { selector: '.lg-logo__mark' })).toBeInTheDocument();
    expect(screen.getByText('Chào mừng trở lại')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(container.querySelectorAll('table')).toHaveLength(0);
  });

  it('toggles the password field between hidden and visible', async () => {
    const user = userEvent.setup();
    renderPage();
    const password = screen.getByLabelText('Mật khẩu');
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('renders the single amber primary action labelled Đăng nhập', () => {
    renderPage();
    const submit = screen.getByRole('button', { name: 'Đăng nhập' });
    expect(submit).toHaveAttribute('data-variant', 'primary');
    expect(screen.getAllByRole('button', { name: 'Đăng nhập' })).toHaveLength(1);
  });
});
