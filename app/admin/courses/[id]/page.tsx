import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createLessonAction,
  deleteCourseAction,
  deleteLessonAction,
  deleteModuleAction,
  duplicateCourseAction,
  duplicateLessonAction,
  duplicateModuleAction,
  moveLessonAction,
  moveModuleAction,
  moveLessonToModuleAction,
  setCoursePublishStateAction,
} from "@/features/admin/actions";
import { AddModuleForm, ConfirmSubmit, CourseEditorForm } from "@/features/admin/forms";
import { getCourseEditor } from "@/lib/server/admin-content";
import { computeCompleteness } from "@/lib/server/admin-repo";

/**
 * Course editor — bilingual fields, then progressive disclosure:
 * metadata form → module tree → per-module lesson creation.
 */

export default async function AdminCourseEditorPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await getCourseEditor(courseId);
  if (!course) notFound();

  const completeness = computeCompleteness({
    titleEn: course.titleEn,
    titleAr: course.titleAr,
    summaryEn: course.summaryEn,
    summaryAr: course.summaryAr,
    _count: { modules: course.modules.length },
    modules: course.modules.map((m) => ({ _count: { lessons: m.lessons.length } })),
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-6">
        <div className="min-w-0">
          <Link
            href="/admin/courses"
            className="text-xs text-faint hover:text-electric"
          >
            ← Courses
          </Link>
          <h1 dir="ltr" className="mt-2 truncate text-2xl font-bold tracking-tight">
            {course.titleEn}
          </h1>
          <p dir="rtl" lang="ar" className="font-arabic text-sm text-soft">
            {course.titleAr}
          </p>
          <p dir="ltr" className="mt-1 font-mono text-[11px] text-faint">
            slug: {course.slug} · {course.publishState}
            {!completeness.readyToPublish && course.publishState !== "PUBLISHED"
              ? ` · missing: ${completeness.missing.join(", ")}`
              : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <PublishControls
            courseId={course.id}
            state={course.publishState}
            canPublish={completeness.readyToPublish}
          />
          <div className="flex gap-2">
            <form action={duplicateCourseAction.bind(null, course.id)}>
              <button
                type="submit"
                className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold hover:border-indigo"
              >
                Duplicate course
              </button>
            </form>
            {course.publishState !== "PUBLISHED" && (
              <form action={deleteCourseAction.bind(null, course.id)}>
                <ConfirmSubmit
                  label="Delete course"
                  message={`Permanently delete "${course.titleEn}" with ALL its modules, lessons and resources? This cannot be undone.`}
                  className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold text-faint hover:border-error hover:text-error"
                />
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Metadata editor */}
      <section aria-labelledby="meta-heading" className="mt-8">
        <h2
          id="meta-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Course details
        </h2>
        <div className="mt-3 rounded-md border border-edge bg-surface p-5">
          <CourseEditorForm
            course={{
              id: course.id,
              titleEn: course.titleEn,
              titleAr: course.titleAr,
              summaryEn: course.summaryEn,
              summaryAr: course.summaryAr,
              descriptionEn: course.descriptionEn,
              descriptionAr: course.descriptionAr,
              level: course.level,
              accessLevel: course.accessLevel,
              estimatedHours: course.estimatedHours,
              seoTitleEn: course.seoTitleEn,
              seoDescEn: course.seoDescEn,
              meta: course.meta,
            }}
          />
        </div>
      </section>

      {/* Curriculum tree */}
      <section aria-labelledby="curriculum-heading" className="mt-10">
        <h2
          id="curriculum-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Curriculum
        </h2>
        <div className="mt-3">
          <AddModuleForm courseId={course.id} />
        </div>

        <ol className="mt-6 space-y-6">
          {course.modules.map((m, mi) => (
            <li key={m.id} className="rounded-md border border-edge bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
                    Module {String(m.position).padStart(2, "0")} ·{" "}
                    {m.publishState.toLowerCase()}
                  </p>
                  <p dir="ltr" className="mt-1 font-semibold">
                    {m.titleEn}
                  </p>
                  <p dir="rtl" lang="ar" className="font-arabic text-sm text-soft">
                    {m.titleAr}
                  </p>
                </div>
                <div className="flex gap-2">
                  <MoveButton
                    action={moveModuleAction.bind(null, course.id, m.id, -1)}
                    label="↑ Move up"
                    disabled={mi === 0}
                  />
                  <MoveButton
                    action={moveModuleAction.bind(null, course.id, m.id, 1)}
                    label="↓ Move down"
                    disabled={mi === course.modules.length - 1}
                  />
                  <form action={duplicateModuleAction.bind(null, course.id, m.id)}>
                    <button
                      type="submit"
                      className="rounded-sm border border-edge px-2 py-1 text-[10px] text-soft hover:border-indigo"
                    >
                      Duplicate
                    </button>
                  </form>
                  <form action={deleteModuleAction.bind(null, course.id, m.id)}>
                    <ConfirmSubmit
                      label="Delete module"
                      message={`Delete module "${m.titleEn}" with ALL its lessons and their progress? This cannot be undone.`}
                      className="rounded-sm border border-edge px-2 py-1 text-[10px] font-semibold text-faint hover:border-error hover:text-error"
                    />
                  </form>
                </div>
              </div>

              <ul className="mt-4 divide-y divide-edge border-t border-edge">
                {m.lessons.map((l, li) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <Link
                      href={`/admin/lessons/${l.id}`}
                      className="group min-w-0 flex-1 text-sm"
                    >
                      <span className="me-2 font-mono text-[10px] text-faint">
                        {String(l.position).padStart(2, "0")}
                      </span>
                      <span className="group-hover:text-electric">{l.titleEn}</span>
                      <span className="ms-2 font-mono text-[9px] uppercase text-gold">
                        {l.accessLevel.toLowerCase()}
                      </span>
                      {l.hasReadyVideo && (
                        <span className="ms-2 font-mono text-[9px] uppercase text-beginner">
                          video ✓
                        </span>
                      )}
                      {!l.hasReadyVideo && (
                        <span className="ms-2 font-mono text-[9px] uppercase text-faint">
                          no video
                        </span>
                      )}
                    </Link>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <form action={duplicateLessonAction.bind(null, course.id, l.id)}>
                        <button
                          type="submit"
                          className="rounded-sm border border-edge px-1.5 py-0.5 text-[10px] text-soft hover:border-indigo"
                        >
                          Copy
                        </button>
                      </form>
                      <form
                        action={moveLessonToModuleAction.bind(null, course.id, l.id)}
                      >
                        <input
                          type="hidden"
                          name="targetModuleId"
                          value={pickOtherModule(course.modules, m.id) ?? ""}
                        />
                        <button
                          type="submit"
                          disabled={!pickOtherModule(course.modules, m.id)}
                          title="Move to another module"
                          className="rounded-sm border border-edge px-1.5 py-0.5 text-[10px] text-soft disabled:opacity-30 hover:border-indigo"
                        >
                          ⇄
                        </button>
                      </form>
                      <form action={deleteLessonAction.bind(null, course.id, l.id)}>
                        <ConfirmSubmit
                          label="Delete"
                          message={`Delete lesson "${l.titleEn}" and its progress records?`}
                          className="rounded-sm border border-edge px-1.5 py-0.5 text-[10px] text-faint hover:border-error hover:text-error"
                        />
                      </form>
                      <MoveButton
                        action={moveLessonAction.bind(null, course.id, m.id, l.id, -1)}
                        label="↑"
                        disabled={li === 0}
                      />
                      <MoveButton
                        action={moveLessonAction.bind(null, course.id, m.id, l.id, 1)}
                        label="↓"
                        disabled={li === m.lessons.length - 1}
                      />
                    </div>
                  </li>
                ))}
                {m.lessons.length === 0 && (
                  <li className="py-3 text-xs text-faint">No lessons yet.</li>
                )}
              </ul>

              <form
                action={createLessonAction.bind(null, m.id, course.id)}
                className="mt-4 flex flex-wrap gap-2"
              >
                <input
                  name="titleEn"
                  required
                  placeholder="New lesson title (EN)"
                  aria-label={`New lesson in ${m.titleEn}`}
                  className="w-full rounded-sm border border-edge bg-base px-3 py-2 text-sm placeholder:text-faint focus:border-indigo sm:w-80"
                  dir="ltr"
                />
                <button
                  type="submit"
                  className="rounded-sm bg-indigo px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-strong"
                >
                  + Lesson
                </button>
              </form>
            </li>
          ))}
          {course.modules.length === 0 && (
            <li className="rounded-md border border-dashed border-edge-strong p-8 text-center text-sm text-faint">
              No modules yet — add your first module above.
            </li>
          )}
        </ol>
      </section>
    </div>
  );
}

function PublishControls({
  courseId,
  state,
  canPublish,
}: {
  courseId: string;
  state: string;
  canPublish: boolean;
}) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        await setCoursePublishStateAction(
          courseId,
          formData.get("next") as "PUBLISHED" | "DRAFT" | "ARCHIVED",
        );
      }}
      className="flex flex-wrap gap-2"
    >
      {state !== "PUBLISHED" && (
        <button
          name="next"
          value="PUBLISHED"
          disabled={!canPublish}
          title={canPublish ? "" : "Fix completeness issues first"}
          className="rounded-sm bg-beginner px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          Publish course
        </button>
      )}
      {state === "PUBLISHED" && (
        <button
          name="next"
          value="DRAFT"
          className="rounded-sm border border-edge-strong px-4 py-2 text-xs font-semibold hover:border-warning"
        >
          Unpublish
        </button>
      )}
    </form>
  );
}

function MoveButton({
  action,
  label,
  disabled,
}: {
  action: () => Promise<void>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        className="rounded-sm border border-edge px-2 py-1 text-xs text-soft disabled:opacity-30 hover:border-indigo"
      >
        {label.split(" ")[0]}
      </button>
    </form>
  );
}

/** Returns the id of the first module other than moduleId (⇄ move target). */
function pickOtherModule(
  modules: Array<{ id: string }>,
  moduleId: string,
): string | null {
  return modules.find((m) => m.id !== moduleId)?.id ?? null;
}
