export function Card({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl border border-[var(--surface-card-border)] bg-[var(--surface-card-bg)] p-4
        shadow-[var(--surface-card-shadow)]
        ${onClick ? "cursor-pointer hover:bg-foreground/[0.02] active:opacity-80 transition-opacity duration-100" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
