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
        rounded-3xl border border-[var(--surface-card-border)] bg-[var(--surface-card-bg)] p-4
        shadow-[var(--surface-card-shadow)] backdrop-blur-md
        ${onClick ? "cursor-pointer hover:border-[var(--surface-card-border-hover)] hover:shadow-[var(--surface-card-shadow-hover)] active:scale-[0.99] transition-all duration-200" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
