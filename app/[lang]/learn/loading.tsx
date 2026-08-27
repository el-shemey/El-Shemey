import { Skeleton } from "@/components/ui/states";

/** Route-level loading skeleton — calm graphite placeholders, no spinners. */
export default function LearnLoading() {
  return (
    <div
      className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-12 sm:px-6"
      role="status"
      aria-busy="true"
    >
      <Skeleton className="h-3 w-24" />
      <div className="mt-8 rounded-md border border-edge bg-surface p-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-7 w-2/3" />
        <Skeleton className="mt-6 h-2 w-full max-w-sm" />
        <Skeleton className="mt-3 h-2 w-1/2" />
        <Skeleton className="mt-6 h-11 w-36" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
