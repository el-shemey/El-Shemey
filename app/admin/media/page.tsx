import { db } from "@/lib/server/db";
import {
  assignVideoFormAction,
  bulkVideoStateAction,
  deleteVideoAction,
  setVideoPublishStateAction,
} from "@/features/admin/actions";
import { ConfirmSubmit, VideoPreview, VideoUploader } from "@/features/admin/forms";
import { buildStreamUrl } from "@/lib/server/video/playback";

/**
 * Central media library (Phase 5A).
 * Upload → process → attach → publish, with search and status filters.
 * All mutations are ADMIN-gated server actions; storage refs shown here are
 * opaque keys, never filesystem paths.
 */

const STATUSES = ["UPLOADING", "PROCESSING", "READY", "FAILED", "ARCHIVED"] as const;

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status: statusFilter, q } = await searchParams;
  const validStatus = STATUSES.find((s) => s === statusFilter);

  const [videos, lessons] = await Promise.all([
    db.videoAsset.findMany({
      where: {
        ...(validStatus ? { status: validStatus } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        lesson: {
          select: {
            id: true,
            titleEn: true,
            module: { select: { course: { select: { slug: true } } } },
          },
        },
        createdBy: { select: { email: true } },
      },
      take: 200,
    }),
    db.lesson.findMany({
      orderBy: [{ moduleId: "asc" }, { position: "asc" }],
      select: {
        id: true,
        titleEn: true,
        module: { select: { course: { select: { titleEn: true } } } },
      },
      take: 500,
    }),
  ]);

  const counts = await db.$transaction([
    db.videoAsset.count(),
    db.videoAsset.count({ where: { status: "PROCESSING" } }),
    db.videoAsset.count({ where: { status: "READY" } }),
    db.videoAsset.count({ where: { status: "FAILED" } }),
  ]);
  const [total, processing, ready, failed] = counts;

  return (
    <div>
      <header className="border-b border-edge pb-6">
        <h1 className="text-2xl font-bold tracking-tight">Media library</h1>
        <p className="mt-1 max-w-prose text-sm text-faint">
          Self-hosted video storage. Upload, inspect, attach to a lesson, then publish.
          Storage keys are server-generated; binaries never touch PostgreSQL.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest">
          <span className="rounded-sm bg-raised px-2 py-1 text-soft">
            {total} total
          </span>
          <span className="rounded-sm bg-raised px-2 py-1 text-electric">
            {ready} ready
          </span>
          <span className="rounded-sm bg-raised px-2 py-1 text-warning">
            {processing} processing
          </span>
          <span className="rounded-sm bg-raised px-2 py-1 text-error">
            {failed} failed
          </span>
        </div>
      </header>

      <section aria-label="Upload media" className="mt-6">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          Upload
        </h2>
        <div className="mt-3">
          <VideoUploader lessonOptions={lessons} />
        </div>
      </section>

      {/* Search + filters */}
      <section aria-label="Filters" className="mt-8">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by title…"
            aria-label="Search media"
            className="w-64 rounded-sm border border-edge bg-base px-3 py-2 text-sm placeholder:text-faint focus:border-indigo"
          />
          {[
            ["", `All (${total})`],
            ["READY", `Ready (${ready})`],
            ["PROCESSING", `Processing (${processing})`],
            ["FAILED", `Failed (${failed})`],
            ["ARCHIVED", "Archived"],
          ].map(([value, labelText]) => (
            <button
              key={value || "all"}
              type="submit"
              name="status"
              value={value}
              className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
                (validStatus ?? "") === value
                  ? "border-indigo text-fg"
                  : "border-edge text-faint hover:border-indigo"
              }`}
            >
              {labelText}
            </button>
          ))}
        </form>
      </section>

      {/* Asset list — checkboxes submit to the bulk form below (no nesting) */}
      <ul className="mt-4 divide-y divide-edge">
        {videos.map((v) => {
          const size =
            v.fileSizeBytes !== null
              ? `${(Number(v.fileSizeBytes) / 1024 / 1024).toFixed(1)} MB`
              : null;
          const dims = v.width && v.height ? `${v.width}×${v.height}` : null;
          const duration = v.durationSeconds
            ? `${Math.floor(v.durationSeconds / 60)}:${String(v.durationSeconds % 60).padStart(2, "0")}`
            : null;
          return (
            <li key={v.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    form="bulk-form"
                    name="videoIds"
                    value={v.id}
                    aria-label={`Select ${v.title}`}
                    className="mt-1 size-3.5 accent-indigo"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span
                        className={`font-mono text-[10px] uppercase tracking-widest ${
                          v.status === "READY"
                            ? "text-beginner"
                            : v.status === "FAILED"
                              ? "text-error"
                              : v.status === "PROCESSING"
                                ? "text-warning"
                                : "text-faint"
                        }`}
                      >
                        {v.status}
                      </span>
                      <p className="truncate text-sm font-medium">{v.title}</p>
                    </div>
                    <p
                      dir="ltr"
                      className="mt-1 truncate font-mono text-[11px] text-faint"
                    >
                      {[size, dims, duration].filter(Boolean).join(" · ") ||
                        "metadata pending"}
                      {" · "}
                      {v.lesson ? v.lesson.titleEn : "unassigned"}
                      {" · "}
                      {v.createdBy.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {v.status === "READY" && (
                    <VideoPreview src={buildStreamUrl(v.id).url} title={v.title} />
                  )}
                  <form
                    action={setVideoPublishStateAction.bind(
                      null,
                      v.id,
                      v.status === "READY" ? "ARCHIVED" : "READY",
                    )}
                  >
                    <button
                      type="submit"
                      disabled={v.status !== "READY" && v.status !== "ARCHIVED"}
                      className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:border-indigo"
                    >
                      {v.status === "READY" ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                  <form action={deleteVideoAction.bind(null, v.id)}>
                    <ConfirmSubmit
                      label="Delete"
                      message={`Permanently delete "${v.title}" and its stored file? This cannot be undone.`}
                      className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold text-faint hover:border-error hover:text-error"
                    />
                  </form>
                </div>
              </div>

              {/* Attachment row */}
              <form
                action={assignVideoFormAction.bind(null, v.id)}
                className="mt-3 flex flex-wrap items-center gap-2"
              >
                <select
                  name="lessonId"
                  defaultValue={v.lesson?.id ?? ""}
                  className="rounded-sm border border-edge bg-base px-3 py-1.5 text-xs text-soft focus:border-indigo sm:w-96"
                  aria-label={`Attach ${v.title} to lesson`}
                >
                  <option value="">— unassigned —</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.module.course.titleEn} › {l.titleEn}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold hover:border-indigo"
                >
                  Save assignment
                </button>
              </form>
            </li>
          );
        })}
        {videos.length === 0 && (
          <li className="py-10 text-center text-sm text-faint">
            No media yet — upload your first video above.
          </li>
        )}
      </ul>

      {/* Bulk toolbar — checkboxes above associate via form="bulk-form" */}
      <form
        id="bulk-form"
        action={bulkVideoStateAction}
        className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-md border border-edge bg-surface/95 px-4 py-2 backdrop-blur-sm"
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
          Bulk actions
        </span>
        <button
          type="submit"
          name="mode"
          value="publish"
          className="rounded-sm border border-edge-strong px-3 py-1 text-xs font-semibold hover:border-beginner hover:text-beginner"
        >
          Publish selected
        </button>
        <button
          type="submit"
          name="mode"
          value="unpublish"
          className="rounded-sm border border-edge-strong px-3 py-1 text-xs font-semibold hover:border-warning hover:text-warning"
        >
          Unpublish selected
        </button>
        <ConfirmSubmit
          label="Delete selected"
          message="Permanently delete ALL selected videos and their stored files? This cannot be undone."
          name="mode"
          value="delete"
          className="rounded-sm border border-edge-strong px-3 py-1 text-xs font-semibold text-faint hover:border-error hover:text-error"
        />
      </form>
    </div>
  );
}
