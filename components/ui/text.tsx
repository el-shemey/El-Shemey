import Link from "next/link";
import { cn } from "@/lib/cn";

/** Small mono uppercase label — the EL-SHEMEY technical annotation voice. */
export function TechLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.18em] text-faint",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Numbered editorial section heading with Arabic pairing. */
export function SectionHeading({
  id,
  index,
  title,
  arabic,
  note,
}: {
  id?: string;
  index: string;
  title: string;
  arabic: string;
  note?: string;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-baseline gap-x-5 gap-y-1">
      <span className="font-mono text-sm text-violet">{index}</span>
      <h2 id={id} className="text-2xl font-bold tracking-tight">
        {title}
      </h2>
      <span lang="ar" dir="rtl" className="font-arabic text-lg font-semibold text-soft">
        {arabic}
      </span>
      {note && <p className="w-full font-mono text-xs text-faint">{note}</p>}
    </div>
  );
}

/** Big tabular figure with a bilingual caption — for stats that matter. */
export function Stat({
  value,
  label,
  labelAr,
  className,
}: {
  value: string;
  label: string;
  labelAr?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="bg-linear-to-r from-fg to-soft bg-clip-text text-3xl font-bold tracking-tight text-transparent tabular-nums">
        {value}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-soft">
        {label}
        {labelAr && (
          <span lang="ar" dir="rtl" className="font-arabic text-faint">
            · {labelAr}
          </span>
        )}
      </p>
    </div>
  );
}

/** Inline text link with an electric underline. */
export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-semibold underline decoration-electric decoration-2 underline-offset-4 transition-colors hover:text-electric",
        className,
      )}
    >
      {children}
    </Link>
  );
}
