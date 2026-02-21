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
        rounded-3xl border border-[rgba(128,164,202,0.24)] bg-[linear-gradient(150deg,rgba(20,42,67,0.72)_0%,rgba(14,30,50,0.7)_60%,rgba(10,22,39,0.8)_100%)] p-4
        shadow-[0_14px_34px_rgba(2,8,18,0.38),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md
        ${onClick ? "cursor-pointer hover:border-[rgba(128,164,202,0.34)] hover:shadow-[0_20px_36px_rgba(2,8,18,0.44),inset_0_1px_0_rgba(255,255,255,0.05)] active:scale-[0.99] transition-all duration-200" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
