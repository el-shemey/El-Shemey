import type { Locale } from "@/lib/i18n/config";

export type Level = "beginner" | "intermediate" | "advanced";
export type Access = "FREE" | "PRO";
export type CategoryId = "prompting" | "context" | "automation" | "agents" | "rag";

/**
 * Typed seed content for Phase 2.
 * Shape mirrors the future Prisma model so the DB can replace these
 * seeds without touching presentation code (see DATABASE_DESIGN.md).
 */
export interface CourseSeed {
  slug: string;
  category: CategoryId;
  level: Level;
  access: Access;
  modules: number;
  lessons: number;
  hours: number;
  /** Sample learner progress for the demo states. */
  progressPercent?: number;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  syllabus: Record<Locale, string[]>;
}

export const CATEGORY_LABELS: Record<CategoryId, Record<Locale, string>> = {
  prompting: { en: "Prompting", ar: "البرومبتات" },
  context: { en: "Context", ar: "السياق" },
  automation: { en: "Automation", ar: "الأتمتة" },
  agents: { en: "Agents", ar: "الوكلاء" },
  rag: { en: "RAG", ar: "أنظمة RAG" },
};

export const COURSES: CourseSeed[] = [
  {
    slug: "prompt-engineering",
    category: "prompting",
    level: "beginner",
    access: "FREE",
    modules: 6,
    lessons: 24,
    hours: 9,
    progressPercent: 82,
    title: { en: "Prompt Engineering", ar: "هندسة البرومبتات" },
    description: {
      en: "Write prompts that survive real work — context, constraints, and output formats that hold up.",
      ar: "اكتب برومبتات صامدة في الشغل الحقيقي — سياق وقيود وصيغ مخرجات بتستمر.",
    },
    syllabus: {
      en: [
        "Introduction",
        "Anatomy of a working prompt",
        "Constraints & output formats",
      ],
      ar: ["مقدمة", "تشريح البرومبت الشغّال", "القيود وصيغ المخرجات"],
    },
  },
  {
    slug: "context-engineering",
    category: "context",
    level: "intermediate",
    access: "PRO",
    modules: 5,
    lessons: 18,
    hours: 7,
    title: { en: "Context Engineering", ar: "هندسة السياق" },
    description: {
      en: "Give models the right information, in the right shape, at the right moment.",
      ar: "ادّي النموذج المعلومة الصح، بالشكل الصح، في الوقت الصح.",
    },
    syllabus: {
      en: [
        "What context actually is",
        "Retrieval vs. stuffing",
        "Structuring knowledge",
      ],
      ar: ["ما هو السياق فعلًا", "الاسترجاع مقابل الحشو", "تنظيم المعرفة"],
    },
  },
  {
    slug: "n8n-automation",
    category: "automation",
    level: "intermediate",
    access: "PRO",
    modules: 8,
    lessons: 31,
    hours: 12,
    progressPercent: 38,
    title: { en: "AI Automation with n8n", ar: "الأتمتة بالذكاء الاصطناعي" },
    description: {
      en: "Webhooks, triggers and AI steps — build automations businesses will actually pay for.",
      ar: "ويبهوكز ومشغّلات وخطوات ذكاء اصطناعي — ابنِ أتمتة بتفرق فعليًا في الشغل.",
    },
    syllabus: {
      en: ["n8n fundamentals", "Your first webhook", "AI nodes in the flow"],
      ar: ["أساسيات n8n", "أول ويب هوك", "عقد الذكاء الاصطناعي في السير"],
    },
  },
  {
    slug: "building-ai-agents",
    category: "agents",
    level: "advanced",
    access: "PRO",
    modules: 5,
    lessons: 18,
    hours: 7,
    title: { en: "Building AI Agents", ar: "بناء وكلاء الذكاء الاصطناعي" },
    description: {
      en: "Tool use, memory, evaluation — ship agents that behave in production, not just in demos.",
      ar: "أدوات وذاكرة وتقييم — سلّم وكلاء تتصرف صح في الإنتاج مش في العرض بس.",
    },
    syllabus: {
      en: ["Agent anatomy", "Tools & guardrails", "Evaluating behavior"],
      ar: ["تشريح الوكيل", "الأدوات والحواجز", "تقييم السلوك"],
    },
  },
  {
    slug: "apis-and-webhooks",
    category: "automation",
    level: "beginner",
    access: "FREE",
    modules: 4,
    lessons: 14,
    hours: 5,
    title: { en: "APIs & Webhooks 101", ar: "الـ APIs والويب هوكس" },
    description: {
      en: "The plumbing behind every automation — requests, responses, events — explained plainly.",
      ar: "السباكة اللي ورا كل أتمتة — طلبات واستجابات وأحداث — بشرح بسيط.",
    },
    syllabus: {
      en: ["What an API really is", "Requests & responses", "Webhooks vs. polling"],
      ar: ["ما هي الـ API فعلًا", "الطلبات والاستجابات", "الويب هوك مقابل الاستطلاع"],
    },
  },
  {
    slug: "rag-systems",
    category: "rag",
    level: "advanced",
    access: "PRO",
    modules: 6,
    lessons: 20,
    hours: 8,
    title: { en: "RAG & AI Systems", ar: "أنظمة RAG والذكاء الاصطناعي" },
    description: {
      en: "Ground answers in your own documents — retrieval that cites, chunks that make sense.",
      ar: "اجعل الإجابات مبنية على مستنداتك — استرجاع بإحالات وتقطيع مفهوم.",
    },
    syllabus: {
      en: ["Why RAG exists", "Chunking strategies", "Citations & evaluation"],
      ar: ["ليه RAG موجود", "استراتيجيات التقطيع", "الإحالات والتقييم"],
    },
  },
];

export function getCourse(slug: string): CourseSeed | undefined {
  return COURSES.find((c) => c.slug === slug);
}

/** The featured destination shown on the homepage + explorer. */
export const FEATURED_SLUG = "n8n-automation";

/** Ordered learning path shown on the knowledge grid. */
export const PATH_NODE_IDS = [
  "prompting",
  "context",
  "automation",
  "agents",
  "rag",
] as const satisfies readonly CategoryId[];
