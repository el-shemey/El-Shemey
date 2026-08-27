import { Skeleton } from "@/components/ui/states";

/** Lesson-player loading skeleton: video-first, no layout shift on arrival. */
export default function LessonLoading() {
  return (
    <div
      className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1fr_300px]"
      role="status"
      aria-busy="true"
    >
      <div className="min-w-0">
        <div className="aspect-video w-full animate-pulse rounded-md border border-edge bg-surface" />
        <Skeleton className="mt-8 h-6 w-3/4" />
        <Skeleton className="mt-3 h-4 w-1/2" />
        <div className="mt-6 space-y-2">
          <Skeleton className="h-3 w-full max-w-prose" />
          <Skeleton className="h-3 w-full max-w-prose" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="hidden lg:block">
        <div className="h-fit rounded-md border border-edge bg-surface p-4">
          <Skeleton className="h-3 w-24" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={`h-3 ${i % 2 ? "w-3/4" : "w-full"}`} />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading lesson…</span>
    </div>
  );
}
