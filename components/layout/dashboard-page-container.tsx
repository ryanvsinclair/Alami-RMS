import type { ReactNode } from "react";

export type DashboardPageContainerVariant =
  | "narrow"
  | "standard"
  | "wide"
  | "full";

const VARIANT_CLASSNAME: Record<DashboardPageContainerVariant, string> = {
  narrow: "max-w-2xl",
  standard: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function DashboardPageContainer({
  variant = "standard",
  className,
  children,
}: {
  variant?: DashboardPageContainerVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "mx-auto w-full px-4 md:px-6 xl:px-8",
        VARIANT_CLASSNAME[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
