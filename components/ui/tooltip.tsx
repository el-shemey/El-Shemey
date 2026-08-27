import { cn } from "@/lib/cn";

/**
 * CSS-only tooltip: appears on hover and on keyboard focus-within.
 * The trigger must be a focusable element for keyboard users.
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xs border border-edge-strong bg-raised px-2 py-1 text-xs font-medium text-fg opacity-0 transition-opacity duration-100 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
