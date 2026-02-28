export type QuantityBadgeSize = "sm" | "md";

const SIZE_CLASS: Record<QuantityBadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

const UNIT_ABBREVIATIONS: Record<string, string> = {
  each: "ea",
  case_unit: "cs",
  case: "cs",
  dozen: "dz",
};

function formatQuantity(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function abbreviateUnit(unit: string) {
  const normalized = unit.trim().toLowerCase();
  return UNIT_ABBREVIATIONS[normalized] ?? normalized;
}

export function QuantityBadge({
  quantity,
  unit,
  parLevel,
  size,
  className = "",
}: {
  quantity: number;
  unit: string;
  parLevel?: number | null;
  size: QuantityBadgeSize;
  className?: string;
}) {
  const isLow = parLevel != null && quantity < parLevel;
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${
        isLow
          ? "border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-300"
          : "border-foreground/12 bg-foreground/6 text-foreground/80"
      } ${SIZE_CLASS[size]} ${className}`}
    >
      {formatQuantity(quantity)} {abbreviateUnit(unit)}
    </span>
  );
}
