import { PrismaClient } from "@prisma/client";
import { COURSES } from "../lib/courses";

/**
 * Deterministic structural seed (Phase 3).
 *
 * Seeds ONLY the published content skeleton from the typed course catalog:
 * categories, courses, modules, lessons. No users, no enrollments, no
 * progress, no pricing — those belong to later phases.
 *
 * Idempotent via upserts on stable slugs; safe to run repeatedly.
 */
const prisma = new PrismaClient();

const LEVEL_MAP = {
  beginner: "BEGINNER",
  intermediate: "INTERMEDIATE",
  advanced: "ADVANCED",
} as const;

async function main() {
  // Categories derived from the catalog
  const categoryIds = [...new Set(COURSES.map((c) => c.category))];
  for (let i = 0; i < categoryIds.length; i++) {
    const id = categoryIds[i];
    await prisma.category.upsert({
      where: { slug: id },
      create: {
        slug: id,
        nameEn: id.charAt(0).toUpperCase() + id.slice(1),
        nameAr: AR_CATEGORY[id],
        order: i,
      },
      update: {
        nameEn: id.charAt(0).toUpperCase() + id.slice(1),
        nameAr: AR_CATEGORY[id],
        order: i,
      },
    });
  }

  for (const course of COURSES) {
    const category = await prisma.category.findUnique({
      where: { slug: course.category },
    });

    const dbCourse = await prisma.course.upsert({
      where: { slug: course.slug },
      create: {
        slug: course.slug,
        level: LEVEL_MAP[course.level],
        accessLevel: course.access,
        publishState: "PUBLISHED",
        estimatedHours: course.hours,
        titleEn: course.title.en,
        titleAr: course.title.ar,
        summaryEn: course.description.en.slice(0, 140),
        summaryAr: course.description.ar.slice(0, 140),
        descriptionEn: course.description.en,
        descriptionAr: course.description.ar,
        categoryId: category?.id,
      },
      update: {
        level: LEVEL_MAP[course.level],
        accessLevel: course.access,
        estimatedHours: course.hours,
        titleEn: course.title.en,
        titleAr: course.title.ar,
        descriptionEn: course.description.en,
        descriptionAr: course.description.ar,
        categoryId: category?.id,
      },
    });

    // One structural module per course with its syllabus as lessons
    // (real curriculum arrives with Phase 8 content work).
    const mod = await prisma.module.upsert({
      where: { courseId_position: { courseId: dbCourse.id, position: 1 } },
      create: {
        courseId: dbCourse.id,
        position: 1,
        titleEn: "Getting started",
        titleAr: "البداية",
        publishState: "PUBLISHED",
      },
      update: {
        titleEn: "Getting started",
        titleAr: "البداية",
        publishState: "PUBLISHED",
      },
    });

    const lessonsEn = course.syllabus.en;
    const lessonsAr = course.syllabus.ar;
    for (let i = 0; i < lessonsEn.length; i++) {
      const slug = `${course.slug}-lesson-${i + 1}`;
      await prisma.lesson.upsert({
        where: { moduleId_slug: { moduleId: mod.id, slug } },
        create: {
          moduleId: mod.id,
          slug,
          position: i + 1,
          type: "LESSON",
          accessLevel: i === 0 ? "FREE" : course.access,
          publishState: "PUBLISHED",
          titleEn: lessonsEn[i],
          titleAr: lessonsAr[i],
          durationSeconds: null,
          contentRef: undefined,
        },
        update: {
          position: i + 1,
          titleEn: lessonsEn[i],
          titleAr: lessonsAr[i],
          accessLevel: i === 0 ? "FREE" : course.access,
          publishState: "PUBLISHED",
        },
      });
    }
  }

  // Plans — structural only; amounts remain 0/inactive until owner-approved.
  const plans = [
    {
      slug: "pro_monthly",
      nameEn: "PRO Monthly",
      nameAr: "برو شهري",
      interval: "MONTH" as const,
    },
    {
      slug: "pro_yearly",
      nameEn: "PRO Yearly",
      nameAr: "برو سنوي",
      interval: "YEAR" as const,
    },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: {
        slug: plan.slug,
        nameEn: plan.nameEn,
        nameAr: plan.nameAr,
        interval: plan.interval,
        amountMinor: 0,
        currency: "EGP",
        isActive: false,
      },
      update: { nameEn: plan.nameEn, nameAr: plan.nameAr, interval: plan.interval },
    });
  }
  console.log(
    `Seeded ${COURSES.length} courses + ${plans.length} plans (deterministic upserts).`,
  );
}

const AR_CATEGORY: Record<string, string> = {
  prompting: "البرومبتات",
  context: "السياق",
  automation: "الأتمتة",
  agents: "الوكلاء",
  rag: "أنظمة RAG",
};

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
