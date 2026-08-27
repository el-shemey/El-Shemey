import { CourseCard } from "@/components/ui/course-card";
import { LessonRow, SyllabusList } from "@/components/ui/syllabus";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const cards = [
  {
    title: "Prompt Engineering",
    titleAr: "هندسة البرومبتات",
    description:
      "Write prompts that survive real work — context, constraints, and output formats that hold up.",
    level: "beginner" as const,
    access: "FREE" as const,
    modules: 6,
    lessons: 24,
    hours: 9,
    progressPercent: 82,
    continueLabel: "Continue lesson 20",
  },
  {
    title: "AI Automation with n8n",
    titleAr: "الأتمتة بالذكاء الاصطناعي",
    description:
      "Webhooks, triggers, and agents — build automations businesses will actually pay for.",
    level: "intermediate" as const,
    access: "PRO" as const,
    modules: 8,
    lessons: 31,
    hours: 12,
    continueLabel: "Preview module 1",
  },
  {
    title: "Building AI Agents",
    titleAr: "بناء وكلاء الذكاء الاصطناعي",
    description:
      "Tool use, memory, evaluation — ship agents that behave in production, not just in demos.",
    level: "advanced" as const,
    access: "PRO" as const,
    modules: 5,
    lessons: 18,
    hours: 7,
    continueLabel: "See syllabus",
  },
];

export function ContentShowcase() {
  return (
    <div className="space-y-14">
      {/* Course cards */}
      <section aria-label="Course cards">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <CourseCard key={c.title} {...c} />
          ))}
        </div>
      </section>

      {/* Syllabus + lesson list + progress — course experience fragment */}
      <section aria-label="Course experience fragment">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="border border-edge-strong bg-surface p-5 sm:p-7 shadow-card">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-soft">
              Claude Mastery · Syllabus
            </p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight">
              From first prompt to working workflow
            </h3>
            <p
              lang="ar"
              dir="rtl"
              className="mt-1 text-right font-arabic text-sm text-soft"
            >
              من أول برومبت إلى سير عمل شغّال
            </p>
            <SyllabusList
              className="mt-5"
              rows={[
                {
                  number: "01",
                  title: "Introduction",
                  titleAr: "مقدمة",
                  access: "FREE",
                  state: "done",
                  duration: "08:12",
                },
                {
                  number: "02",
                  title: "Claude Fundamentals",
                  titleAr: "أساسيات كلاود",
                  access: "FREE",
                  state: "done",
                  duration: "14:40",
                },
                {
                  number: "03",
                  title: "Context Engineering",
                  titleAr: "هندسة السياق",
                  access: "PRO",
                  state: "current",
                  duration: "18:05",
                },
                {
                  number: "04",
                  title: "Advanced Prompting",
                  titleAr: "برومبتات متقدمة",
                  access: "PRO",
                  state: "locked",
                  duration: "21:33",
                },
                {
                  number: "05",
                  title: "Real-world Workflows",
                  titleAr: "سير عمل حقيقي",
                  access: "PRO",
                  state: "locked",
                  duration: "16:48",
                },
                {
                  number: "06",
                  title: "Final Project",
                  titleAr: "المشروع النهائي",
                  access: "PRO",
                  state: "locked",
                  duration: "—",
                },
              ]}
            />
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <ProgressBar
                value={38}
                label="Course progress"
                showValue
                className="max-w-xs flex-1"
              />
              <Button size="sm">Resume → Context Engineering</Button>
            </div>
          </div>

          {/* Player sidebar fragment */}
          <aside
            aria-label="Player sidebar example"
            className="rounded-md border border-edge bg-hover/60 p-3"
          >
            <p className="px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              Module 02 · Fundamentals
            </p>
            <nav aria-label="Lessons" className="mt-1 space-y-1">
              <LessonRow
                title="What Claude actually does"
                duration="09:20"
                state="done"
              />
              <LessonRow
                title="Tokens & context windows"
                duration="12:44"
                state="done"
              />
              <LessonRow
                title="System prompts that stick"
                duration="15:10"
                state="current"
                active
              />
              <LessonRow title="Structured outputs" duration="11:03" state="locked" />
              <LessonRow title="Practice: brief → spec" duration="—" state="locked" />
            </nav>
            <div className="mt-4 flex items-center gap-4 border-t border-edge pt-4">
              <ProgressRing value={38} size={52} label="Course completion" />
              <p className="text-xs leading-relaxed text-soft">
                38% of the course
                <br />
                <span lang="ar" dir="rtl" className="font-arabic">
                  أنجزت ٣٨٪ من الكورس
                </span>
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
