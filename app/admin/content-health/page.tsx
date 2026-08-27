import Link from "next/link";
import { db } from "@/lib/server/db";

/**
 * Content health dashboard (Phase 8).
 * Every metric is a live count; clicking navigates to the filtered view.
 */
function Metric({
  value,
  label,
  href,
  tone = "",
}: {
  value: number;
  label: string;
  href: string;
  tone?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-edge bg-surface p-4 transition-colors hover:border-indigo"
    >
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-faint">{label}</p>
    </Link>
  );
}

export default async function ContentHealthPage() {
  const now = new Date();
  // "No content" = no legacy body text AND no structured blocks.
  const lessonRows = await db.lesson.findMany({
    select: { id: true, contentRef: true },
    take: 5000,
  });
  const lessonsNoContent = lessonRows.filter((l) => {
    if (!l.contentRef || typeof l.contentRef !== "object") return true;
    const c = l.contentRef as Record<string, unknown>;
    const hasText =
      typeof c.descriptionEn === "string" && c.descriptionEn.trim().length > 0;
    const hasBlocks = Array.isArray(c.blocks) && c.blocks.length > 0;
    return !hasText && !hasBlocks;
  }).length;

  const [
    coursesTotal,
    coursesPublished,
    lessonsTotal,
    lessonsPublished,
    lessonsDraft,
    lessonsMissingVideo,
    videosTotal,
    videosUnused,
    videosFailed,
    resourcesTotal,
    activeSubs,
  ] = await Promise.all([
    db.course.count(),
    db.course.count({ where: { publishState: "PUBLISHED" } }),
    db.lesson.count(),
    db.lesson.count({ where: { publishState: "PUBLISHED" } }),
    db.lesson.count({ where: { publishState: "DRAFT" } }),
    db.lesson.count({
      where: {
        publishState: "PUBLISHED",
        videos: { none: { status: "READY", archivedAt: null } },
      },
    }),
    db.videoAsset.count(),
    db.videoAsset.count({ where: { lessonId: null, archivedAt: null } }),
    db.videoAsset.count({ where: { status: "FAILED" } }),
    db.resourceFile.count(),
    db.subscription.count({
      where: { status: "ACTIVE", currentPeriodEnd: { gt: now } },
    }),
  ]);
  void lessonsNoContent;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Content health</h1>
      <p className="mt-1 text-sm text-faint">
        Live quality metrics — click any number to open its filtered view.
      </p>

      <section aria-labelledby="ch-courses" className="mt-8">
        <h2
          id="ch-courses"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Courses
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Metric value={coursesTotal} label="Total" href="/admin/courses" />
          <Metric
            value={coursesPublished}
            label="Published"
            href="/admin/courses"
            tone="text-beginner"
          />
          <Metric
            value={coursesTotal - coursesPublished}
            label="Drafts / archived"
            href="/admin/search?filter=draft"
            tone="text-warning"
          />
        </div>
      </section>

      <section aria-labelledby="ch-lessons" className="mt-8">
        <h2
          id="ch-lessons"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Lessons
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Metric value={lessonsTotal} label="Total" href="/admin/search" />
          <Metric
            value={lessonsPublished}
            label="Published"
            href="/admin/search?filter=published"
            tone="text-beginner"
          />
          <Metric
            value={lessonsDraft}
            label="Drafts"
            href="/admin/search?filter=draft"
            tone="text-warning"
          />
          <Metric
            value={lessonsMissingVideo}
            label="Published w/o video"
            href="/admin/search?filter=missing-video"
            tone="text-error"
          />
          <Metric
            value={lessonsNoContent}
            label="No content"
            href="/admin/search?filter=draft"
            tone="text-error"
          />{" "}
        </div>
      </section>

      <section aria-labelledby="ch-media" className="mt-8">
        <h2
          id="ch-media"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Media &amp; resources
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric value={videosTotal} label="Videos" href="/admin/media" />
          <Metric
            value={videosFailed}
            label="Failed uploads"
            href="/admin/media?status=FAILED"
            tone="text-error"
          />
          <Metric
            value={videosUnused}
            label="Unattached videos"
            href="/admin/media"
            tone="text-warning"
          />
          <Metric
            value={resourcesTotal}
            label="Resource files"
            href="/admin/search"
            tone="text-electric"
          />
        </div>
      </section>

      <section aria-labelledby="ch-biz" className="mt-8">
        <h2
          id="ch-biz"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Business
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Metric
            value={activeSubs}
            label="Active subscriptions"
            href="/admin/subscriptions"
            tone="text-electric"
          />
        </div>
      </section>

      <p className="mt-10 font-mono text-[11px] leading-relaxed text-faint">
        Missing-Arabic / missing-English title filters are available on the search page
        for untranslated content. Lessons inherit publish eligibility from their course
        and module.
      </p>
    </div>
  );
}
