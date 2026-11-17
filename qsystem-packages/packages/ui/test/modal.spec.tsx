import * as React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '../src/modal';

function OpenHarness(props: Partial<React.ComponentProps<typeof Modal>>) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Modal open={open} onOpenChange={setOpen} {...props}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Confirm action</ModalTitle>
            <ModalDescription>Are you sure you want to proceed?</ModalDescription>
          </ModalHeader>
          <p>Dialog body</p>
          <ModalFooter>
            <button onClick={() => setOpen(false)}>Cancel</button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('renders dialog semantics with labelledby/describedby and modal state', async () => {
    const user = userEvent.setup();
    render(<OpenHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const title = screen.getByText('Confirm action');
    const description = screen.getByText('Are you sure you want to proceed?');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog.getAttribute('aria-describedby')).toBe(description.id);
  });

  it('traps focus inside and restores focus to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<OpenHarness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    // Focus starts on close button; tab cycles inside the dialog.
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'Open dialog' })).toHaveFocus();
  });

  it('closes on Escape and calls onOpenChange', async () => {
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = React.useState(true);
      return (
        <Modal
          open={open}
          onOpenChange={(next) => { setOpen(next); onOpenChange(next); }}
        >
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Title</ModalTitle>
            </ModalHeader>
          </ModalContent>
        </Modal>
      );
    }
    const user = userEvent.setup();
    render(<Controlled />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restores body overflow only when the last stacked modal closes', async () => {
    const user = userEvent.setup();
    function Stacked() {
      const [outer, setOuter] = React.useState(false);
      const [inner, setInner] = React.useState(false);
      return (
        <>
          <button onClick={() => setOuter(true)}>Open outer</button>
          <Modal open={outer} onOpenChange={setOuter}>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Outer</ModalTitle>
              </ModalHeader>
              <p>Outer body</p>
              <button onClick={() => setInner(true)}>Open inner</button>
            </ModalContent>
          </Modal>
          <Modal open={inner} onOpenChange={setInner}>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Inner</ModalTitle>
              </ModalHeader>
              <p>Inner body</p>
            </ModalContent>
          </Modal>
        </>
      );
    }
    render(<Stacked />);
    expect(document.body.style.overflow).toBe('');
    await user.click(screen.getByRole('button', { name: 'Open outer' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(screen.getByRole('button', { name: 'Open inner' }));
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Inner body')).not.toBeInTheDocument();
    expect(screen.getByText('Outer body')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('supports controlled open state and labelled close', async () => {
    const user = userEvent.setup();
    render(<OpenHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /đóng hộp thoại/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders Lucide close icon with [data-qs-modal-close] and ships close button styling in styles.css', async () => {
    const user = userEvent.setup();
    render(<OpenHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const closeBtn = screen.getByRole('button', { name: /đóng hộp thoại/i });
    expect(closeBtn).toHaveAttribute('data-qs-modal-close', '');
    expect(closeBtn).toHaveClass('qs-modal__close');
    const svg = closeBtn.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('stroke-width', '1.5');

    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toContain('.qs-modal__dialog > [data-qs-modal-close]');
    expect(css).toContain('width: 44px;');
    expect(css).toContain('height: 44px;');
  });
});
