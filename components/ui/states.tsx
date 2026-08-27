import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";
import { Shimmy } from "@/components/character/shimmy";

/** Skeleton block for loading layouts. Width/height via className. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton block rounded-xs", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-md border-2 border-dashed border-edge-strong bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      {icon ?? <Shimmy mood="sleepy" size={110} className="mb-2 opacity-90" />}
      {icon && (
        <div aria-hidden className="mb-4 text-faint">
          {icon}
        </div>
      )}
      <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-soft">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-faint">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function EmptyCoursesExample() {
  return (
    <EmptyState
      title="Nothing here yet"
      description="When you start a course, it will show up here so you can pick up where you left off."
      action={
        <a href="#" className={buttonStyles({ variant: "secondary", size: "sm" })}>
          Explore courses
        </a>
      }
    />
  );
}
