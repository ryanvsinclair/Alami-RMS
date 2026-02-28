export type InventoryViewMode = "grid" | "list";

function GridIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path d="M7 7h13M7 12h13M7 17h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="4" cy="7" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

export function ViewModeToggle({
  value,
  onChange,
  className = "",
}: {
  value: InventoryViewMode;
  onChange: (mode: InventoryViewMode) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border border-[var(--surface-card-border)] p-1 ${className}`}>
      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          value === "grid"
            ? "bg-primary text-white"
            : "bg-transparent text-muted hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        <GridIcon />
      </button>
      <button
        type="button"
        aria-label="List view"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          value === "list"
            ? "bg-primary text-white"
            : "bg-transparent text-muted hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        <ListIcon />
      </button>
    </div>
  );
}
