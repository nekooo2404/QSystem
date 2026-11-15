'use client';

import * as React from 'react';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
}

export function Table({ children, wrapperClassName, className, ...rest }: TableProps) {
  return (
    <div className={['qs-table__wrapper', wrapperClassName ?? ''].filter(Boolean).join(' ')} style={{ overflowX: 'auto' }}>
      <table className={['qs-table', className ?? ''].filter(Boolean).join(' ')} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function TableCaption({ children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return <caption {...rest}>{children}</caption>;
}

export function TableHeader({ children, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...rest}>{children}</thead>;
}

export function TableBody({ children, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...rest}>{children}</tbody>;
}

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(function TableRow({ children, onKeyDown, tabIndex, ...rest }, ref) {
  return (
    <tr ref={ref} tabIndex={tabIndex} onKeyDown={onKeyDown} {...rest}>
      {children}
    </tr>
  );
});

export function TableHead({ children, scope = 'col', ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope={scope} {...rest}>
      {children}
    </th>
  );
}

export function TableCell({ children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...rest}>{children}</td>;
}

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
}

type SortDirection = 'ascending' | 'descending' | 'none';

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  caption?: React.ReactNode;
  sortable?: boolean;
  emptyMessage?: React.ReactNode;
  loading?: boolean;
  loadingMessage?: React.ReactNode;
  error?: React.ReactNode;
  onRowClick?: (row: T, index: number) => void;
  getRowKey?: (row: T, index: number) => React.Key;
  selectedRowKey?: React.Key;
  enableJKNavigation?: boolean;
}

// Inner controls opt out of row activation: a click on the button means the
// button, not the row.
const INTERACTIVE = 'button,a,input,select,textarea,[contenteditable]';

function isEditable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input,select,textarea,[contenteditable]') !== null;
}

function compareValues(a: React.ReactNode, b: React.ReactNode): number {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  return sa.localeCompare(sb, undefined, { sensitivity: 'base', numeric: true });
}

export function DataTable<T>({
  data,
  columns,
  caption,
  sortable = false,
  emptyMessage = 'Chưa có dữ liệu',
  loading = false,
  loadingMessage = 'Đang tải dữ liệu…',
  error,
  onRowClick,
  getRowKey,
  selectedRowKey,
  enableJKNavigation = true,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('none');
  const [activeRowIndex, setActiveRowIndex] = React.useState(0);
  const rowRefs = React.useRef<Array<HTMLTableRowElement | null>>([]);

  if (error) {
    return (
      <div className="qs-table__wrapper" style={{ overflowX: 'auto' }}>
        <div role="alert" className="qs-table__error">
          {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="qs-table__wrapper" style={{ overflowX: 'auto' }}>
        <div role="status" className="qs-table__loading">
          {loadingMessage}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="qs-table__wrapper" style={{ overflowX: 'auto' }}>
        {caption ? (
          <Table>
            <TableCaption>{caption}</TableCaption>
          </Table>
        ) : null}
        <div role="status" className="qs-table__empty">
          {emptyMessage}
        </div>
      </div>
    );
  }

  let visible = data;
  if (sortColumn && sortDirection !== 'none') {
    const col = columns.find((c) => c.id === sortColumn);
    if (col) {
      visible = [...data].sort((ra, rb) => {
        const cmp = compareValues(col.accessor(ra), col.accessor(rb));
        return sortDirection === 'ascending' ? cmp : -cmp;
      });
    }
  }

  const toggleSort = (columnId: string) => {
    if (sortColumn !== columnId) {
      setSortColumn(columnId);
      setSortDirection('ascending');
      return;
    }
    setSortDirection((prev) => (prev === 'ascending' ? 'descending' : 'ascending'));
  };

  const focusRow = (index: number) => {
    setActiveRowIndex(index);
    const el = rowRefs.current[index];
    el?.focus();
  };

  // Keep one row tabbable when the active index falls outside the visible set
  // (filtering/sorting can shrink `visible`).
  const currentFocusIndex = Math.min(activeRowIndex, Math.max(0, visible.length - 1));

  const handleRowKeyDown = (row: T, index: number) => (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    // Typing Vietnamese in an inline editor must never move row focus.
    if (isEditable(event.target)) return;
    const down = event.key === 'ArrowDown' || (enableJKNavigation && event.key === 'j');
    const up = event.key === 'ArrowUp' || (enableJKNavigation && event.key === 'k');
    if (down) {
      event.preventDefault();
      focusRow(Math.min(index + 1, visible.length - 1));
    } else if (up) {
      event.preventDefault();
      focusRow(Math.max(index - 1, 0));
    } else if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onRowClick(row, index);
    }
  };

  const rowKeyAt = (row: T, index: number): React.Key =>
    getRowKey ? getRowKey(row, index) : index;

  return (
    <Table>
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          {columns.map((col) => {
            const isSortable = sortable && col.sortable;
            const active = sortColumn === col.id ? sortDirection : 'none';
            return (
              <TableHead key={col.id} scope="col" aria-sort={isSortable ? active : undefined}>
                {isSortable ? (
                  <button
                    type="button"
                    aria-label={`Sắp xếp theo ${typeof col.header === 'string' ? col.header : col.id}`}
                    onClick={() => toggleSort(col.id)}
                    className="qs-table__sort"
                  >
                    {col.header}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.map((row, index) => (
          <TableRow
            key={rowKeyAt(row, index)}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            tabIndex={index === currentFocusIndex ? 0 : -1}
            aria-selected={selectedRowKey !== undefined && selectedRowKey === rowKeyAt(row, index) ? 'true' : undefined}
            onFocus={() => setActiveRowIndex(index)}
            onKeyDown={handleRowKeyDown(row, index)}
            onClick={
              onRowClick
                ? (event) => {
                    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
                    onRowClick(row, index);
                  }
                : undefined
            }
            className={onRowClick ? 'is-clickable' : undefined}
          >
            {columns.map((col) => (
              <TableCell key={col.id}>
                {col.accessor(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
