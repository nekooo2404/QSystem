import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, FormField } from '../src/form';
import { Input } from '../src/input';

describe('Form', () => {
  it('associates label with input and wires describedby for helper text', () => {
    render(
      <Form>
        <FormField name="email" label="Email" helperText="We never share it.">
          <Input type="email" />
        </FormField>
      </Form>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('aria-describedby');
    expect(screen.getByText('We never share it.')).toBeInTheDocument();
  });

  it('keeps label htmlFor in sync when the child provides its own id', async () => {
    const user = userEvent.setup();
    render(
      <Form>
        <FormField name="email" label="Email">
          <Input id="custom-id" type="email" />
        </FormField>
      </Form>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('id', 'custom-id');
    const label = screen.getByText('Email').closest('label')!;
    expect(label).toHaveAttribute('for', 'custom-id');
    await user.click(label);
    expect(input).toHaveFocus();
  });

  it('marks required fields and surfaces errors as role=alert', () => {
    render(
      <Form>
        <FormField name="email" label="Email" required error="Email is required">
          <Input type="email" />
        </FormField>
      </Form>,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Email is required');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('disabled fields propagate disabled to the input', () => {
    render(
      <Form>
        <FormField name="nickname" label="Nickname" disabled>
          <Input />
        </FormField>
      </Form>,
    );
    expect(screen.getByLabelText('Nickname')).toBeDisabled();
  });

  it('submits values and blocks submit while invalid', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = React.useState('');
      const error = value.includes('@') ? undefined : 'Enter a valid email';
      return (
        <Form onSubmit={(e) => { e.preventDefault(); if (!error) onSubmit(value); }}>
          <FormField name="email" label="Email" error={error}>
            <Input type="email" value={value} onChange={(e) => setValue(e.target.value)} />
          </FormField>
          <button type="submit">Submit</button>
        </Form>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
    await user.type(screen.getByLabelText(/Email/), 'a@b.co');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledWith('a@b.co');
  });

  it('preserves the child aria-describedby alongside helper/error ids', () => {
    render(
      <Form>
        <FormField name="email" label="Email" helperText="Hint" error="Bad email">
          <Input aria-describedby="outside-hint" />
        </FormField>
      </Form>,
    );
    const input = screen.getByLabelText('Email');
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    expect(ids[0]).toBe('outside-hint');
    const helper = screen.getByText('Hint');
    const alert = screen.getByRole('alert');
    expect(ids).toContain(helper.id);
    expect(ids).toContain(alert.id);
  });

  it('styles Input with .qs-input and honours error/controlSize props', () => {
    render(
      <Form>
        <FormField name="email" label="Email">
          <Input error controlSize="lg" />
        </FormField>
      </Form>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveClass('qs-input');
    expect(input).toHaveClass('qs-input--lg');
    expect(input).toHaveAttribute('data-error', 'true');
  });

  it('supports onBlur validation mode', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [touched, setTouched] = React.useState(false);
      const error = touched ? 'Required' : undefined;
      return (
        <Form>
          <FormField name="name" label="Name" error={error}>
            <Input onBlur={() => setTouched(true)} />
          </FormField>
        </Form>
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText('Name');
    await user.click(input);
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent('Required');
  });
});
