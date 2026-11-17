import * as React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../src/table';

type Row = { id: string; name: string; email: string; role: string };

const rows: Row[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
];

const columns = [
  { id: 'name', header: 'Name', accessor: (r: Row) => r.name, sortable: true },
  { id: 'email', header: 'Email', accessor: (r: Row) => r.email },
  { id: 'role', header: 'Role', accessor: (r: Row) => r.role },
];

describe('Table primitives', () => {
  it('renders semantic table with caption and scoped column headers', () => {
    render(
      <Table>
        <TableCaption>Users</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    const th = screen.getByRole('columnheader', { name: 'Name' });
    expect(th).toHaveAttribute('scope', 'col');
  });
});

describe('DataTable', () => {
  it('renders data rows with headers', () => {
    render(<DataTable data={rows} columns={columns} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('reports sort state through aria-sort on th columnheader', async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} sortable />);
    const sortButton = screen.getByRole('button', { name: /sắp xếp theo name/i });
    const th = sortButton.closest('th')!;
    expect(sortButton).not.toHaveAttribute('aria-sort');
    expect(th).toHaveAttribute('aria-sort', 'none');
    await user.click(sortButton);
    expect(th).toHaveAttribute('aria-sort', 'ascending');
    // Ascending puts Jane before John
    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Jane Smith');
    await user.click(sortButton);
    expect(th).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getAllByRole('cell')[0]).toHaveTextContent('John Doe');
  });

  it('renders empty state with status role and no rows', () => {
    render(<DataTable data={[]} columns={columns} emptyMessage="No users yet" />);
    expect(screen.getByRole('status')).toHaveTextContent('No users yet');
    expect(screen.queryAllByRole('cell')).toHaveLength(0);
  });

  it('renders loading state and error state accessibly', () => {
    const { rerender } = render(<DataTable data={rows} columns={columns} loading loadingMessage="Loading rows…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading rows…');
    rerender(<DataTable data={rows} columns={columns} error="Could not load rows" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load rows');
  });

  it('uses roving tabindex for rows with ArrowUp/ArrowDown', () => {
    render(<DataTable data={rows} columns={columns} />);
    const firstRow = screen.getByText('John Doe').closest('tr')!;
    const secondRow = screen.getByText('Jane Smith').closest('tr')!;
    expect(firstRow).toHaveAttribute('tabindex', '0');
    expect(secondRow).toHaveAttribute('tabindex', '-1');
    firstRow.focus();
    expect(firstRow).toHaveFocus();
    fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
    expect(secondRow).toHaveFocus();
    expect(secondRow).toHaveAttribute('tabindex', '0');
    expect(firstRow).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(secondRow, { key: 'ArrowUp' });
    expect(firstRow).toHaveFocus();
    expect(firstRow).toHaveAttribute('tabindex', '0');
  });

  it('moves row focus with J/K', () => {
    render(<DataTable data={[...rows, { id: '3', name: 'Kim Lee', email: 'k@e.co', role: 'User' }]} columns={columns} />);
    const firstRow = screen.getByText('John Doe').closest('tr')!;
    const secondRow = screen.getByText('Jane Smith').closest('tr')!;
    firstRow.focus();
    fireEvent.keyDown(firstRow, { key: 'j' });
    expect(secondRow).toHaveFocus();
    fireEvent.keyDown(secondRow, { key: 'j' });
    expect(screen.getByText('Kim Lee').closest('tr')).toHaveFocus();
    fireEvent.keyDown(screen.getByText('Kim Lee').closest('tr')!, { key: 'k' });
    expect(secondRow).toHaveFocus();
  });

  it('ignores J/K while typing in an editable element', () => {
    const editableColumns = [
      { id: 'name', header: 'Name', accessor: (r: Row) => <input aria-label={`name-${r.id}`} defaultValue={r.name} /> },
      { id: 'email', header: 'Email', accessor: (r: Row) => r.email },
    ];
    render(<DataTable data={[...rows, { id: '3', name: 'Kim Lee', email: 'k@e.co', role: 'User' }]} columns={editableColumns} />);
    const input = screen.getByLabelText('name-1');
    input.focus();
    fireEvent.keyDown(input, { key: 'j' });
    expect(input).toHaveFocus();
    expect(screen.getByText('jane@example.com').closest('tr')).not.toHaveFocus();
  });

  it('keeps exactly one row tabbable when the active row index leaves the visible set', () => {
    const { rerender } = render(<DataTable data={rows} columns={columns} />);
    const firstRow = screen.getByText('John Doe').closest('tr')!;
    const secondRow = screen.getByText('Jane Smith').closest('tr')!;
    // User tabs down to row 2 (activeRowIndex = 1).
    firstRow.focus();
    fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
    expect(secondRow).toHaveFocus();

    // Data narrows to a single row: the old active index is now out of range.
    rerender(<DataTable data={rows.slice(0, 1)} columns={columns} />);
    const remainingRow = screen.getByText('John Doe').closest('tr')!;
    const tabbable = screen.getAllByRole('row').filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable).toEqual([remainingRow]);
  });

  it('notifies row clicks exactly once per activation', async () => {
    const onRowClick = vi.fn();
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} onRowClick={onRowClick} />);
    await user.click(screen.getByText('John Doe'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
    await user.click(screen.getByText('John Doe').closest('tr')!);
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('does not fire onRowClick when an inner control is clicked', async () => {
    const onRowClick = vi.fn();
    const onButtonClick = vi.fn();
    const user = userEvent.setup();
    const actionColumns = [
      { id: 'name', header: 'Name', accessor: (r: Row) => r.name },
      {
        id: 'action',
        header: 'Action',
        accessor: (r: Row) => (
          <button type="button" onClick={onButtonClick}>
            {`open-${r.id}`}
          </button>
        ),
      },
    ];
    render(<DataTable data={rows} columns={actionColumns} onRowClick={onRowClick} />);
    await user.click(screen.getByRole('button', { name: 'open-1' }));
    expect(onButtonClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
    await user.click(screen.getByText('Jane Smith'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('marks the selected row with aria-selected', () => {
    render(<DataTable data={rows} columns={columns} selectedRowKey="2" getRowKey={(r) => r.id} />);
    const selected = screen.getByText('Jane Smith').closest('tr')!;
    const other = screen.getByText('John Doe').closest('tr')!;
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(other).not.toHaveAttribute('aria-selected', 'true');
  });

  it('activates actionable rows with Enter and Space', () => {
    const onRowClick = vi.fn();
    render(<DataTable data={rows} columns={columns} onRowClick={onRowClick} />);
    const firstRow = screen.getByText('John Doe').closest('tr')!;
    firstRow.focus();
    fireEvent.keyDown(firstRow, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
    fireEvent.keyDown(firstRow, { key: ' ' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('renders Lucide sort icons reflecting sort direction and keeps sentence-case headers in CSS', async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} sortable />);
    const sortButton = screen.getByRole('button', { name: /sắp xếp theo name/i });
    const iconBefore = sortButton.querySelector('svg.qs-table__sort-icon');
    expect(iconBefore).not.toBeNull();
    expect(iconBefore).toHaveAttribute('aria-hidden', 'true');
    expect(iconBefore).toHaveAttribute('stroke-width', '1.5');
    const beforeHtml = iconBefore?.innerHTML;

    await user.click(sortButton);
    const iconAsc = sortButton.querySelector('svg.qs-table__sort-icon');
    expect(iconAsc?.innerHTML).not.toBe(beforeHtml);

    await user.click(sortButton);
    const iconDesc = sortButton.querySelector('svg.qs-table__sort-icon');
    expect(iconDesc?.innerHTML).not.toBe(iconAsc?.innerHTML);

    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toMatch(/\.qs-table th\s*\{[^}]*text-transform:\s*none/);
  });

  it('disables J/K navigation when enableJKNavigation is false while preserving Arrow keys', () => {
    render(<DataTable data={rows} columns={columns} enableJKNavigation={false} />);
    const firstRow = screen.getByText('John Doe').closest('tr')!;
    const secondRow = screen.getByText('Jane Smith').closest('tr')!;
    firstRow.focus();
    fireEvent.keyDown(firstRow, { key: 'j' });
    expect(firstRow).toHaveFocus();
    fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
    expect(secondRow).toHaveFocus();
    fireEvent.keyDown(secondRow, { key: 'k' });
    expect(secondRow).toHaveFocus();
  });
});
