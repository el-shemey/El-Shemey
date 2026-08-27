import Link from "next/link";
import { setCoursePublishStateAction } from "@/features/admin/actions";
import { CreateCourseForm } from "@/features/admin/forms";
import { computeCompleteness, listCoursesAdmin } from "@/lib/server/admin-repo";

export default async function AdminCoursesPage() {
  const courses = await listCoursesAdmin();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
      <p className="mt-1 text-sm text-faint">
        Publication is blocked until a course passes its completeness checks.
      </p>

      <div
        id="new-course"
        className="mt-6 scroll-mt-8 rounded-md border border-edge bg-surface p-4"
      >
        <CreateCourseForm />
      </div>

      <ul className="mt-8 space-y-4">
        {courses.map((course) => {
          const completeness = computeCompleteness({
            titleEn: course.titleEn,
            titleAr: course.titleAr,
            summaryEn: course.summaryEn,
            summaryAr: course.summaryAr,
            _count: course._count,
            modules: course.modules,
          });
          return (
            <li
              key={course.id}
              className="rounded-md border border-edge bg-surface p-5 transition-colors hover:border-edge-strong"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/courses/${course.id}`}
                    className="font-semibold hover:text-electric"
                  >
                    {course.titleEn}
                  </Link>
                  <p lang="ar" dir="rtl" className="font-arabic text-sm text-soft">
                    {course.titleAr}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-faint">
                    <span
                      className={`font-mono uppercase ${statusColor(course.publishState)}`}
                    >
                      {course.publishState}
                    </span>
                    <span>·</span>
                    <span>{course.level.toLowerCase()}</span>
                    <span>·</span>
                    <span>{course.accessLevel}</span>
                    <span>·</span>
                    <span className="tabular-nums">
                      {course._count.modules} modules ·{" "}
                      {course.modules.reduce((n, m) => n + m._count.lessons, 0)} lessons
                    </span>
                  </div>
                  {!completeness.readyToPublish && (
                    <p className="mt-2 text-xs text-warning">
                      ⚠ Missing: {completeness.missing.join(", ")}
                    </p>
                  )}
                </div>

                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await setCoursePublishStateAction(
                      course.id,
                      formData.get("next") as "PUBLISHED" | "DRAFT" | "ARCHIVED",
                    );
                  }}
                  className="flex gap-2"
                >
                  {course.publishState !== "PUBLISHED" && (
                    <button
                      name="next"
                      value="PUBLISHED"
                      disabled={!completeness.readyToPublish}
                      title={
                        completeness.readyToPublish
                          ? ""
                          : completeness.missing.join(", ")
                      }
                      className="rounded-sm bg-indigo px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Publish
                    </button>
                  )}
                  {course.publishState === "PUBLISHED" && (
                    <button
                      name="next"
                      value="DRAFT"
                      className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold hover:border-indigo"
                    >
                      Unpublish
                    </button>
                  )}
                  {course.publishState !== "ARCHIVED" && (
                    <button
                      name="next"
                      value="ARCHIVED"
                      className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold text-faint hover:border-error hover:text-error"
                    >
                      Archive
                    </button>
                  )}
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function statusColor(state: string) {
  if (state === "PUBLISHED") return "text-beginner";
  if (state === "ARCHIVED") return "text-faint";
  return "text-warning";
}
