import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFloatingLayer } from '../src/layer';

afterEach(() => {
  document.body.style.overflow = '';
});

function Layer({ id, onEscape, lockScroll }: { id: string; onEscape: () => void; lockScroll?: boolean }) {
  useFloatingLayer(true, onEscape, lockScroll);
  return <div data-testid={id} />;
}

/** Mounts a list of layers in order; `visible` decides which are open. */
function Harness({ visible, onEscape }: { visible: string[]; onEscape: Record<string, () => void> }) {
  return (
    <>
      {visible.map((id) => (
        <Layer key={id} id={id} onEscape={onEscape[id]} lockScroll />
      ))}
    </>
  );
}

describe('useFloatingLayer', () => {
  it('closes only the top layer per Escape, in stacking order', () => {
    const open = vi.fn();
    const palette = vi.fn();
    const onEscape = { open, palette };
    render(<Harness visible={['open', 'palette']} onEscape={onEscape} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(palette).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('lifts the scroll lock only when the last locking layer is gone', () => {
    const noop = () => {};
    const { rerender } = render(<Harness visible={['first']} onEscape={{ first: noop }} />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Harness visible={['first', 'second']} onEscape={{ first: noop, second: noop }} />);
    expect(document.body.style.overflow).toBe('hidden');

    // The page closes its layers in any order; the lock must clear regardless.
    rerender(<Harness visible={['first']} onEscape={{ first: noop }} />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Harness visible={[]} onEscape={{}} />);
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps the real overflow value when the page already set one', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = render(<Harness visible={['only']} onEscape={{ only: () => {} }} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('closes a popover that opened over a drawer before the drawer', async () => {
    const user = userEvent.setup();
    const drawer = vi.fn();
    function Popover({ onClose }: { onClose: () => void }) {
      const [open, setOpen] = React.useState(true);
      useFloatingLayer(open, () => {
        setOpen(false);
        onClose();
      });
      return open ? <button type="button">Bộ lọc</button> : null;
    }
    render(
      <>
        <Layer id="drawer" onEscape={drawer} lockScroll />
        <Popover onClose={vi.fn()} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Bộ lọc' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Bộ lọc' })).toBeNull();
    expect(drawer).not.toHaveBeenCalled();
  });

  it('skips controls in CSS-hidden ancestors when choosing modal focus', () => {
    function Dialog() {
      const root = React.useRef<HTMLDivElement>(null);
      useFloatingLayer(true, () => {}, true, { root });
      return <div ref={root} tabIndex={-1} role="dialog"><div style={{ display: 'none' }}><button>Masqué</button></div><button>Tiếp tục</button></div>;
    }
    render(<Dialog />);
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toHaveFocus();
  });
});
