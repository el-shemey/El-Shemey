import { Button } from "@/components/ui/button";
import { AccessStamp, LevelBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { KnowledgeMap } from "@/components/viz/knowledge-map";
import { Shimmy } from "@/components/character/shimmy";
import { CoordinateTag, GridSurface } from "@/components/viz/technical";
import { CourseCard } from "@/components/ui/course-card";

/**
 * Course discovery — the universe structure.
 * A featured destination + the knowledge map of connected courses.
 */
export function ExplorationShowcase() {
  return (
    <div className="space-y-14">
      {/* Featured destination */}
      <GridSurface className="overflow-hidden shadow-card">
        <div className="relative z-10 grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <CoordinateTag value="destination 01" />
              <AccessStamp kind="FREE" />
              <LevelBadge level="beginner" />
            </div>
            <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Claude Mastery
            </h3>
            <p
              lang="ar"
              dir="rtl"
              className="mt-1 text-right font-arabic text-base text-soft"
            >
              من أول برومبت إلى سير عمل شغّال
            </p>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-soft">
              Start with the fundamentals — free, forever. Continue into context
              engineering, real-world workflows and automation when you are ready for
              PRO.
            </p>
            <p className="mt-4 font-mono text-xs tabular-nums text-faint">
              6 modules · 24 lessons · ~9h
            </p>
            <ProgressBar
              value={38}
              label="Claude Mastery progress"
              showValue
              className="mt-4 max-w-xs"
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button>Continue learning</Button>
              <Button variant="secondary">View syllabus</Button>
            </div>
          </div>

          {/* Shimmy guides you into the course */}
          <div className="relative mx-auto hidden lg:block" aria-hidden>
            <Shimmy mood="thinking" size={150} className="floaty" />
          </div>
        </div>
      </GridSurface>

      {/* The knowledge map */}
      <section aria-label="Knowledge map">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <CoordinateTag value="map · v1" />
            <h3 className="mt-2 text-xl font-bold tracking-tight">
              The territory — how concepts connect
            </h3>
            <p
              lang="ar"
              dir="rtl"
              className="mt-1 text-right font-arabic text-sm text-soft"
            >
              خريطة المعرفة: من أول برومبت إلى وكلاء أذكياء
            </p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-soft">
              Every course is a destination on the grid. Completed stages stay lit
              behind you; your current position glows. Follow the path in order, or jump
              to what you need.
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <CourseCard
                title="AI Automation with n8n"
                titleAr="الأتمتة بالذكاء الاصطناعي"
                description="Webhooks, triggers, and agents — build automations businesses will actually pay for."
                level="intermediate"
                access="PRO"
                modules={8}
                lessons={31}
                hours={12}
                continueLabel="Preview module 1"
              />
              <CourseCard
                title="Building AI Agents"
                titleAr="بناء وكلاء الذكاء الاصطناعي"
                description="Tool use, memory, evaluation — ship agents that behave in production."
                level="advanced"
                access="PRO"
                modules={5}
                lessons={18}
                hours={7}
              />
              <CourseCard
                title="Prompt Engineering"
                titleAr="هندسة البرومبتات"
                description="Prompts that survive real work — context, constraints, output formats."
                level="beginner"
                access="FREE"
                modules={6}
                lessons={24}
                hours={9}
                progressPercent={82}
                continueLabel="Continue lesson 20"
              />
            </div>
          </div>

          {/* Map panel */}
          <aside
            aria-label="Learning path map"
            className="rounded-md border border-edge bg-surface p-5 shadow-card"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">
              Learning path
            </p>
            <KnowledgeMap
              className="mt-4"
              nodes={[
                {
                  id: "prompting",
                  title: "Prompt Engineering",
                  titleAr: "هندسة البرومبتات",
                  state: "done",
                  meta: "24 lessons",
                  access: "FREE",
                },
                {
                  id: "context",
                  title: "Context Engineering",
                  titleAr: "هندسة السياق",
                  state: "current",
                  meta: "18 lessons",
                  access: "PRO",
                },
                {
                  id: "tools",
                  title: "Tools & APIs",
                  titleAr: "الأدوات والـ APIs",
                  state: "available",
                  meta: "12 lessons",
                  access: "PRO",
                },
                {
                  id: "automation",
                  title: "AI Automation",
                  titleAr: "الأتمتة الذكية",
                  state: "available",
                  meta: "31 lessons",
                  access: "PRO",
                },
                {
                  id: "agents",
                  title: "AI Agents",
                  titleAr: "الوكلاء الأذكياء",
                  state: "locked",
                  meta: "18 lessons",
                  access: "PRO",
                },
                {
                  id: "rag",
                  title: "RAG Systems",
                  titleAr: "أنظمة RAG",
                  state: "locked",
                  meta: "14 lessons",
                  access: "PRO",
                },
              ]}
            />
            <p className="mt-5 border-t border-edge pt-4 font-arabic text-xs leading-relaxed text-faint">
              العقدة اللي بتنبّض هي موقعك الحالي — اللي وراك منوّر، واللي قدامك مستني.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
