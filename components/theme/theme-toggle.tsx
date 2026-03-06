"use client";

export function ThemeToggle() {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={false}
      aria-label="Theme toggle coming soon"
      disabled
      className="relative inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full border border-border bg-foreground/10 opacity-60"
    >
      <span className="inline-block h-5 w-5 translate-x-[0.1rem] rounded-full bg-white shadow-sm" />
    </button>
  );
}
