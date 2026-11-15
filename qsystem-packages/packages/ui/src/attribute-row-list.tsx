import * as React from 'react';

export interface AttributeRowItem {
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface AttributeRowListProps {
  items: AttributeRowItem[];
}

/** Single-column label/value list with no frames — the detail panel layout. */
export function AttributeRowList({ items }: AttributeRowListProps) {
  return (
    <dl className="qs-attribute-list">
      {items.map((item) => (
        <div key={item.id} className="qs-attribute-list__row">
          <dt className="qs-attribute-list__label">{item.label}</dt>
          <dd className="qs-attribute-list__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
