type Variant = "default" | "success" | "warning" | "danger" | "info";

const variantStyles: Record<Variant, string> = {
  default: "bg-[var(--fill-tertiary)] text-[var(--foreground-secondary)]",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-primary/15 text-primary",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-normal
        ${variantStyles[variant]} ${className}
      `}
    >
      {children}
    </span>
  );
}
