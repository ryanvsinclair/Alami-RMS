import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-[0_6px_18px_rgba(0,127,255,0.3)] hover:bg-primary-hover",
  secondary: "bg-card text-foreground border border-border hover:border-foreground/15 hover:bg-foreground/5",
  danger: "bg-danger text-white hover:bg-red-700",
  ghost: "text-muted hover:text-foreground hover:bg-foreground/6",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-10 px-3 text-sm",
  md: "h-12 px-4 text-sm",
  lg: "h-14 px-6 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center rounded-2xl font-semibold tracking-tight
          transition-all duration-200 active:scale-[0.98]
          focus:outline-none focus:ring-2 focus:ring-primary/25
          disabled:opacity-50 disabled:pointer-events-none
          min-w-[44px]
          ${variantStyles[variant]} ${sizeStyles[size]} ${className}
        `}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
