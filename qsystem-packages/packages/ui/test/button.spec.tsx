import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../src/button';

describe('Button', () => {
  it('renders children with native button semantics and type', () => {
    render(<Button type="submit">Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'submit');
  });

  it('supports primary/secondary/ghost/danger variants and sm/md/lg sizes', () => {
    const { rerender } = render(<Button variant="primary" size="sm">A</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'primary');
    expect(screen.getByRole('button')).toHaveAttribute('data-size', 'sm');
    rerender(<Button variant="secondary" size="md">A</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'secondary');
    rerender(<Button variant="ghost" size="lg">A</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'ghost');
    rerender(<Button variant="danger" size="md">A</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'danger');
  });

  it('disabled state prevents activation and exposes aria-disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button disabled onClick={onClick}>Blocked</Button>);
    const btn = screen.getByRole('button', { name: 'Blocked' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading state exposes aria-busy, blocks clicks, and announces loading text', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button loading loadingText="Saving…">Save</Button>);
    const btn = screen.getByRole('button', { name: 'Saving…' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('activates with keyboard and shows visible focus', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    const btn = screen.getByRole('button', { name: 'Go' });
    btn.focus();
    expect(btn).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    btn.focus();
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
