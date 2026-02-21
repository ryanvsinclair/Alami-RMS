type Variant = "default" | "success" | "warning" | "danger" | "info";

const variantStyles: Record<Variant, string> = {
  default: "bg-white/10 text-foreground border border-white/10",
  success: "bg-emerald-500/16 text-emerald-300 border border-emerald-400/25",
  warning: "bg-amber-500/18 text-amber-300 border border-amber-400/25",
  danger: "bg-red-500/18 text-red-300 border border-red-400/25",
  info: "bg-cyan-500/16 text-cyan-300 border border-cyan-400/25",
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
