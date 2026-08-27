import Link from "next/link";
import { notFound } from "next/navigation";
import {
  setLessonPublishStateAction,
  setVideoPublishStateAction,
} from "@/features/admin/actions";
import {
  LessonEditorForm,
  ResourceUploader,
  VideoPreview,
  VideoUploader,
} from "@/features/admin/forms";
import {
  getLessonCompleteness,
  getLessonEditor,
  listLessonResources,
} from "@/lib/server/admin-content";
import { buildStreamUrl } from "@/lib/server/video/playback";

/**
 * Lesson editor — sections: CONTENT / SETTINGS / RESOURCES in one form,
 * VIDEO managed separately (attach from library or upload directly).
 */

export default async function AdminLessonEditorPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = await getLessonEditor(lessonId);
  if (!lesson) notFound();

  const allVideos = lesson.videos;
  const activeVideo =
    allVideos.find((v) => v.status === "READY") ?? allVideos[0] ?? null;

  const completeness = await getLessonCompleteness(lessonId);
  const resourceFiles = await listLessonResources(lessonId);
  const missing = completeness?.missing ?? [];
  const checklist: Array<{ key: string; label: string; ok: boolean }> = [
    {
      key: "english_title",
      label: "English title",
      ok: !missing.includes("english_title"),
    },
    {
      key: "arabic_title",
      label: "Arabic title",
      ok: !missing.includes("arabic_title"),
    },
    { key: "content", label: "Lesson content", ok: !missing.includes("content") },
    { key: "video", label: "Video attached", ok: !missing.includes("video") },
    { key: "duration", label: "Duration known", ok: !missing.includes("duration") },
    {
      key: "module_unpublished",
      label: "Module published",
      ok: !missing.includes("module_unpublished"),
    },
    {
      key: "course_unpublished",
      label: "Course published",
      ok: !missing.includes("course_unpublished"),
    },
  ];
  const readyToPublish = completeness?.readyToPublish ?? false;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-6">
        <div className="min-w-0">
          <Link
            href={`/admin/courses/${lesson.courseId}`}
            className="text-xs text-faint hover:text-electric"
          >
            ← {lesson.courseTitleEn}
          </Link>
          <h1 dir="ltr" className="mt-2 truncate text-2xl font-bold tracking-tight">
            {lesson.titleEn}
          </h1>
          <p dir="rtl" lang="ar" className="font-arabic text-sm text-soft">
            {lesson.titleAr}
          </p>
          <p dir="ltr" className="mt-1 font-mono text-[11px] text-faint">
            {lesson.moduleTitleEn} · position {lesson.position} ·{" "}
            {lesson.publishState.toLowerCase()}
          </p>
        </div>

        {/* Publish controls + preview */}
        <div className="flex flex-col items-end gap-3">
          <Link
            href={`/en/learn/${lesson.courseSlug}/${lesson.slug}`}
            target="_blank"
            className="rounded-sm border border-edge-strong px-4 py-2 text-xs font-semibold hover:border-indigo"
          >
            Preview as student ↗
          </Link>

          {/* Completeness checklist — exact missing items, never silent */}
          <div className="w-64 rounded-md border border-edge bg-surface p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
              {readyToPublish ? "✓ Ready to publish" : "⚠ Needs attention"}
            </p>
            <ul className="mt-2 space-y-1">
              {checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-2 text-[11px]">
                  <span aria-hidden className={c.ok ? "text-beginner" : "text-faint"}>
                    {c.ok ? "✓" : "○"}
                  </span>
                  <span className={c.ok ? "text-soft" : "text-warning"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <form
              action={async () => {
                "use server";
                await setLessonPublishStateAction(
                  lessonId,
                  lesson.publishState === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                );
              }}
              className="mt-3"
            >
              <button
                type="submit"
                disabled={lesson.publishState !== "PUBLISHED" && !readyToPublish}
                title={
                  readyToPublish || lesson.publishState === "PUBLISHED"
                    ? ""
                    : missing.join(", ")
                }
                className={`w-full rounded-sm px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                  lesson.publishState === "PUBLISHED"
                    ? "border border-edge-strong hover:border-warning"
                    : "bg-beginner text-white"
                }`}
              >
                {lesson.publishState === "PUBLISHED"
                  ? "Unpublish lesson"
                  : "Publish lesson"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* VIDEO section */}
      <section aria-labelledby="video-heading" className="mt-8">
        <h2
          id="video-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Video
        </h2>

        {activeVideo ? (
          <div className="mt-3 rounded-md border border-edge bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{activeVideo.title}</p>
                <p dir="ltr" className="mt-1 font-mono text-[11px] text-faint">
                  {activeVideo.status}
                  {activeVideo.durationSeconds
                    ? ` · ${Math.floor(activeVideo.durationSeconds / 60)}:${String(activeVideo.durationSeconds % 60).padStart(2, "0")}`
                    : ""}
                  {activeVideo.fileSizeBytes
                    ? ` · ${(activeVideo.fileSizeBytes / 1024 / 1024).toFixed(1)} MB`
                    : ""}
                  {activeVideo.width && activeVideo.height
                    ? ` · ${activeVideo.width}×${activeVideo.height}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeVideo.status === "READY" && (
                  <>
                    <VideoPreview
                      src={buildStreamUrl(activeVideo.id).url}
                      title={activeVideo.title}
                    />
                    <form
                      action={setVideoPublishStateAction.bind(
                        null,
                        activeVideo.id,
                        "ARCHIVED",
                      )}
                    >
                      <button
                        type="submit"
                        className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold hover:border-warning"
                      >
                        Unpublish video
                      </button>
                    </form>
                  </>
                )}
                {(activeVideo.status === "ARCHIVED" ||
                  activeVideo.status === "FAILED") && (
                  <form
                    action={setVideoPublishStateAction.bind(
                      null,
                      activeVideo.id,
                      "READY",
                    )}
                  >
                    <button
                      type="submit"
                      disabled={activeVideo.status !== "ARCHIVED"}
                      className="rounded-sm bg-beginner px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Publish video
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-sm border border-dashed border-edge-strong p-4 text-xs text-faint">
            No video attached yet — upload one below.
          </p>
        )}

        <details className="mt-3 rounded-md border border-edge bg-surface p-4">
          <summary className="cursor-pointer text-xs font-semibold text-soft">
            Upload a new video for this lesson
          </summary>
          <div className="mt-3">
            <VideoUploader pinnedLessonId={lesson.id} lessonOptions={[]} />
            <p className="mt-2 font-mono text-[10px] text-faint">
              Uploads attach directly to this lesson. Attaching a READY video archives
              the previous one (replace semantics).
            </p>
          </div>
        </details>
      </section>

      {/* RESOURCES (file downloads) */}
      <section aria-labelledby="resfiles-heading" className="mt-8">
        <h2
          id="resfiles-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Downloadable resources
        </h2>
        <div className="mt-3">
          <ResourceUploader
            lessonId={lesson.id}
            resources={resourceFiles.map((r) => ({
              id: r.id,
              label: r.label,
              sizeBytes: r.sizeBytes,
              mimeType: r.mimeType,
            }))}
          />
        </div>
      </section>

      {/* CONTENT + SETTINGS + RESOURCES */}
      <section aria-label="Lesson content" className="mt-10">
        <div className="rounded-md border border-edge bg-surface p-6">
          <LessonEditorForm
            lesson={{
              id: lesson.id,
              titleEn: lesson.titleEn,
              titleAr: lesson.titleAr,
              descriptionEn: lesson.contentRef?.descriptionEn,
              descriptionAr: lesson.contentRef?.descriptionAr,
              type: lesson.type,
              accessLevel: lesson.accessLevel,
              publishState: lesson.publishState,
              durationSeconds:
                lesson.durationSeconds ?? activeVideo?.durationSeconds ?? null,
              resources: lesson.contentRef?.resources ?? [],
              attachments: lesson.contentRef?.attachments ?? [],
              blocks: lesson.contentRef?.blocks ?? [],
              completionThreshold: lesson.contentRef?.completionThreshold ?? null,
            }}
          />
        </div>
      </section>
    </div>
  );
}
