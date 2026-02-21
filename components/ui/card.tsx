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
        rounded-xl border border-border bg-card p-4 shadow-sm
        ${onClick ? "cursor-pointer hover:shadow-md active:scale-[0.98] transition-all" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
