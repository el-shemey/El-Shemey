import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-strong text-white border-2 border-transparent hover:bg-indigo active:translate-y-px hover:shadow-glow",
  secondary:
    "bg-raised text-fg border-2 border-edge-strong hover:border-indigo/70 hover:bg-hover active:translate-y-px",
  ghost:
    "bg-transparent text-soft border-2 border-transparent hover:bg-hover hover:text-fg",
  destructive:
    "bg-error-deep text-white border-2 border-transparent hover:brightness-110 active:translate-y-px",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3.5 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-sm",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-sm font-semibold tracking-wide transition-[background-color,border-color,transform,filter,box-shadow] duration-150",
    "disabled:pointer-events-none disabled:opacity-40",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span aria-hidden className="spinner" />}
      {children}
    </button>
  );
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: ButtonVariant;
};

export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(buttonStyles({ variant }), "size-9 p-0", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Spinner for busy regions outside buttons. Pair with visually hidden text. */
export function InlineSpinner({ label }: { label: string }) {
  return (
    <span role="status">
      <span aria-hidden className="spinner text-soft" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
