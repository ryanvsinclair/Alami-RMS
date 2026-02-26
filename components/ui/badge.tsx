type Variant = "default" | "success" | "warning" | "danger" | "info";

const variantStyles: Record<Variant, string> = {
  default: "bg-foreground/8 text-foreground/80 border border-foreground/10",
  success: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  warning: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  danger: "bg-red-500/12 text-red-600 dark:text-red-400 border border-red-500/20",
  info: "bg-[rgba(0,127,255,0.1)] text-[#007fff] border border-[rgba(0,127,255,0.2)]",
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
        inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase
        ${variantStyles[variant]} ${className}
      `}
    >
      {children}
    </span>
  );
}
