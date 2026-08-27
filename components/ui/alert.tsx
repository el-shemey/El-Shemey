import { cn } from "@/lib/cn";

type AlertVariant = "info" | "success" | "warning" | "error";

const alertStyles: Record<
  AlertVariant,
  { bar: string; title: string; role?: "alert" }
> = {
  info: { bar: "border-intermediate", title: "text-intermediate" },
  success: { bar: "border-success", title: "text-success" },
  warning: { bar: "border-warning", title: "text-warning" },
  error: { bar: "border-error", title: "text-error", role: "alert" },
};

export function Alert({
  variant,
  title,
  children,
  className,
}: {
  variant: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const s = alertStyles[variant];
  return (
    <div
      role={s.role ?? "status"}
      className={cn(
        "rounded-sm border border-edge border-s-4 bg-surface px-4 py-3",
        s.bar,
        className,
      )}
    >
      {title && <p className={cn("text-sm font-semibold", s.title)}>{title}</p>}
      <div className="mt-0.5 text-sm leading-relaxed text-soft">{children}</div>
    </div>
  );
}
