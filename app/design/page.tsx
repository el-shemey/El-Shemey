import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { BrandFoundation } from "@/components/showcase/brand-foundation";
import { ButtonsShowcase } from "@/components/showcase/buttons-showcase";
import { ContentShowcase } from "@/components/showcase/content-showcase";
import { ExplorationShowcase } from "@/components/showcase/exploration-showcase";
import { FeedbackShowcase } from "@/components/showcase/feedback-showcase";
import { FormsShowcase } from "@/components/showcase/forms-showcase";
import { HeroExperience } from "@/components/showcase/hero-experience";
import { NavigationShowcase } from "@/components/showcase/navigation-showcase";
import { PricingShowcase } from "@/components/showcase/pricing-showcase";
import { RtlResponsiveShowcase } from "@/components/showcase/rtl-responsive-showcase";
import { TechnicalShowcase } from "@/components/showcase/technical-showcase";
import { TypographyStudy } from "@/components/studies/typography-study";
import { SectionHeading } from "@/components/ui/text";
import { CoordinateTag } from "@/components/viz/technical";
import { getDict } from "@/lib/i18n/dictionaries";
const designDict = getDict("en");

export const metadata: Metadata = {
  title: "Design system",
};

const sections = [
  {
    id: "brand",
    index: "01",
    title: "Brand foundation",
    arabic: "الأساسيات",
    note: "Darkness · indigo light · electric accents. Tokens, spacing, geometry, Shimmy.",
    content: <BrandFoundation />,
  },
  {
    id: "typography",
    index: "02",
    title: "Typography",
    arabic: "الطباعة",
    note: "IBM Plex Sans Arabic + Plex Sans + Plex Mono. Arabic-first, bilingual by default.",
    content: <TypographyStudy />,
  },
  {
    id: "buttons",
    index: "03",
    title: "Buttons & badges",
    arabic: "الأزرار",
    note: "Variants, sizes, states, icon buttons, tooltips, level coding, stamps, chips.",
    content: <ButtonsShowcase />,
  },
  {
    id: "forms",
    index: "04",
    title: "Forms",
    arabic: "النماذج",
    note: "Inputs, select, search, textarea, checkbox, radio, switch, validation states.",
    content: <FormsShowcase />,
  },
  {
    id: "exploration",
    index: "05",
    title: "Course exploration & knowledge map",
    arabic: "استكشاف الكون",
    note: "Featured destination + the connected learning path. The grid as user experience.",
    content: <ExplorationShowcase />,
  },
  {
    id: "courses",
    index: "06",
    title: "Courses & syllabus",
    arabic: "الكورسات",
    note: "Destination cards, syllabus path with lit nodes, lesson rows, progress.",
    content: <ContentShowcase />,
  },
  {
    id: "pricing",
    index: "07",
    title: "Pricing",
    arabic: "الأسعار",
    note: "Asymmetric composition. EGP. Placeholder amounts — owner approval required.",
    content: <PricingShowcase />,
  },
  {
    id: "states",
    index: "08",
    title: "States & feedback",
    arabic: "الحالات",
    note: "Alerts, toasts, dialogs, dropdowns, empty (Shimmy sleeps), skeleton, loading.",
    content: <FeedbackShowcase />,
  },
  {
    id: "navigation",
    index: "09",
    title: "Navigation",
    arabic: "التنقل",
    note: "Header anatomy, language switcher, mobile drawer, keyboard behavior.",
    content: <NavigationShowcase />,
  },
  {
    id: "technical",
    index: "10",
    title: "Technical visual language",
    arabic: "اللغة التقنية",
    note: "Coordinate grids, sigmoid curve, constellation, code fragments — supporting layer only.",
    content: <TechnicalShowcase />,
  },
  {
    id: "rtl-responsive",
    index: "11",
    title: "RTL & responsive",
    arabic: "العربية والشاشات",
    note: "Mirrored composition with logical properties; per-breakpoint rules.",
    content: <RtlResponsiveShowcase />,
  },
];

export default function DesignPage() {
  return (
    <>
      <SiteHeader locale="en" dict={designDict} activeHref="/design" />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-12 sm:px-6">
        {/* Hero experience */}
        <HeroExperience locale="en" dict={designDict} />

        <div className="mt-16 border-b-2 border-edge-strong pb-10">
          <CoordinateTag value="index" />
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            The EL-SHEMEY design system
          </h1>
          <p
            lang="ar"
            dir="rtl"
            className="mt-2 font-arabic text-lg font-semibold text-violet"
          >
            نظام التصميم — مرجع بناء كل صفحة قادمة
          </p>
          <p className="mt-3 max-w-prose leading-relaxed text-soft">
            Every element below is the real component library future pages are built
            from — reviewed against the{" "}
            <span className="font-semibold">Anti-AI-Template Contract</span> in{" "}
            <code className="font-mono text-sm">docs/DESIGN_REVIEW_CHECKLIST.md</code>.
          </p>
          <nav
            aria-label="Sections"
            className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-faint"
          >
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="transition-colors hover:text-electric hover:underline hover:decoration-electric hover:underline-offset-4"
              >
                {s.index} · {s.title}
              </a>
            ))}
          </nav>
        </div>

        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-heading`}
            className="reveal-scroll scroll-mt-20 border-b border-edge py-14 last:border-b-0"
          >
            <div id={`${section.id}-heading`}>
              <SectionHeading
                index={section.index}
                title={section.title}
                arabic={section.arabic}
                note={section.note}
              />
            </div>
            {section.content}
          </section>
        ))}

        <footer className="flex flex-wrap items-baseline justify-between gap-3 py-10">
          <p className="font-mono text-xs text-faint">
            EL-SHEMEY design system · Phase 1 · no production pages yet
          </p>
          <p lang="ar" dir="rtl" className="font-arabic text-xs text-faint">
            صُمم بعناية — ورق وحبر ولمسة صفراء
          </p>
        </footer>
      </main>
    </>
  );
}
