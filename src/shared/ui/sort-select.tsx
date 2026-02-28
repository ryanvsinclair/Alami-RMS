export type InventorySortKey =
  | "name_asc"
  | "name_desc"
  | "qty_asc"
  | "qty_desc"
  | "low_stock"
  | "last_updated";

export const INVENTORY_SORT_OPTIONS: Array<{ value: InventorySortKey; label: string }> = [
  { value: "name_asc", label: "A->Z" },
  { value: "name_desc", label: "Z->A" },
  { value: "qty_asc", label: "Qty up" },
  { value: "qty_desc", label: "Qty down" },
  { value: "low_stock", label: "Low stock first" },
  { value: "last_updated", label: "Recently updated" },
];

export function SortSelect({
  value,
  onChange,
  className = "",
}: {
  value: InventorySortKey;
  onChange: (key: InventorySortKey) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as InventorySortKey)}
      className={`h-9 rounded-xl border border-[var(--surface-card-border)] bg-[var(--surface-card-bg)] px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 ${className}`}
      aria-label="Sort inventory items"
    >
      {INVENTORY_SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
