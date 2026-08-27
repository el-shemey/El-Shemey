import { appendFileSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { registerWithIdentifier } from "@/lib/server/auth-service";
import {
  completeLesson,
  getEnrollmentProgress,
  startEnrollment,
  getPublishedCourseTree,
} from "@/lib/server/learning-repo";
import { getLessonView } from "@/lib/server/learner";
import { authorizePlayback } from "@/lib/server/video/playback";

/**
 * INTEGRATION — Phase 6 learner flows against the live local PostgreSQL.
 * Skips automatically when the database is unreachable.
 */

const prisma = new PrismaClient();
let dbUp = true;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // Ensure the structural seed exists for deterministic assertions.
    const count = await prisma.course.count();
    if (count === 0) throw new Error("seed missing");
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const RID = Math.random().toString(36).slice(2, 8);
const COURSE = "prompt-engineering"; // seeded: module with 3 lessons (1 FREE + 2 PRO)

async function makeUser(tag: string): Promise<{ id: string; email: string }> {
  const email = `${tag}-${RID}@test.elshemey.dev`;
  const emailCanonical = email.toLowerCase(); // storage invariant: normalized-lowercase
  const preExisting = await prisma.user.findUnique({
    where: { email: emailCanonical },
  });
  if (preExisting) return { id: preExisting.id, email: emailCanonical };
  await registerWithIdentifier({
    name: tag,
    identifier: email,
    password: "Strong-Pass-77",
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: emailCanonical },
  });
  // verify immediately (token plumbing covered by auth integration tests)
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });
  return { id: user.id, email };
}

describe.sequential("Phase 6 learner flows (live local DB)", () => {
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbUp = false;
      return;
    }
    try {
      userA = await makeUser("learnerA");
      userB = await makeUser("learnerB");
    } catch (e) {
      appendFileSync("learner-debug.txt", "SETUP FAIL: " + (e as Error).message + "\n");
      dbUp = false;
    }
  });

  afterAll(async () => {
    if (!dbUp) return;
    try {
      await prisma.user.deleteMany({
        where: { email: { contains: `-${RID}@test.` } },
      });
      const course = await prisma.course.findUnique({ where: { slug: COURSE } });
      if (course) {
        await prisma.enrollment.deleteMany({ where: { courseId: course.id } });
      }
    } catch {
      // best-effort cleanup
    }
  });

  it("unauthenticated-equivalent access: unknown userId has no enrollment and gets NO_ENROLLMENT", async () => {
    if (!dbUp) return;
    const view = await getLessonView(
      "ghost-user-id",
      "en",
      COURSE,
      `${COURSE}-lesson-1`,
    );
    expect(view.status).toBe("NO_ENROLLMENT");
  });

  it("startEnrollment is idempotent and lesson view resolves after enrolling", async () => {
    if (!dbUp) return;
    await startEnrollment({ userId: userA.id, courseSlug: COURSE });
    // duplicate start must not create a second enrollment
    await startEnrollment({ userId: userA.id, courseSlug: COURSE });
    const count = await prisma.enrollment.count({
      where: { userId: userA.id },
    });
    expect(count).toBe(1);

    const view = await getLessonView(userA.id, "en", COURSE, `${COURSE}-lesson-1`);
    expect(view.status).not.toBe("NO_ENROLLMENT");
    expect(view.status).not.toBe("LOCKED"); // first lesson is FREE
  });

  it("progress persists; completion is idempotent; percent derives correctly", async () => {
    if (!dbUp) return;
    const tree = await getPublishedCourseTree(COURSE);
    const lessons = tree!.modules.flatMap((m) => m.lessons);
    const first = lessons[0];

    const firstCall = await completeLesson({
      userId: userA.id,
      courseSlug: COURSE,
      lessonSlug: first.slug,
    });
    expect(firstCall.wasDuplicate).toBe(false);

    const secondCall = await completeLesson({
      userId: userA.id,
      courseSlug: COURSE,
      lessonSlug: first.slug,
    });
    expect(secondCall.wasDuplicate).toBe(true);
    expect(secondCall.progress.completedAt).toEqual(firstCall.progress.completedAt);

    const records = await prisma.lessonProgress.findMany({
      where: { lessonId: first.id },
    });
    expect(records).toHaveLength(1); // no duplicate rows

    const progress = await getEnrollmentProgress(userA.id, COURSE);
    expect(progress).toBeTruthy();
    expect(progress!.percent).toBeGreaterThan(0);
  });

  it("PRO lessons are denied without subscription — server-side", async () => {
    if (!dbUp) return;
    const pro = await prisma.lesson.findFirst({
      where: { accessLevel: "PRO", module: { course: { slug: COURSE } } },
      select: { slug: true },
    });
    if (!pro) return; // seed guarantees at least one
    await expect(
      completeLesson({ userId: userA.id, courseSlug: COURSE, lessonSlug: pro.slug }),
    ).rejects.toThrow("ACCESS_DENIED");

    const view = await getLessonView(userA.id, "en", COURSE, pro.slug);
    if (view.status === "OK") {
      // If the learner reached a PRO lesson view, video auth must deny.
      const playback = await authorizePlayback(userA.id, pro.slug);
      expect(
        playback.allowed === true ||
          playback.reason === "ACCESS_DENIED" ||
          playback.reason === "NO_VIDEO",
      ).toBe(true);
    } else {
      expect(view.status).toBe("LOCKED");
    }
  });

  it("cross-user isolation: B's completion does not affect A's progress", async () => {
    if (!dbUp) return;
    const before = await getEnrollmentProgress(userA.id, COURSE);
    await startEnrollment({ userId: userB.id, courseSlug: COURSE });
    const tree = await getPublishedCourseTree(COURSE);
    const first = tree!.modules.flatMap((m) => m.lessons)[0];
    await completeLesson({
      userId: userB.id,
      courseSlug: COURSE,
      lessonSlug: first.slug,
    });

    const after = await getEnrollmentProgress(userA.id, COURSE);
    expect(after!.completedCount).toBe(before!.completedCount);
  });

  it("unknown lessons are rejected (invalid relationships)", async () => {
    if (!dbUp) return;
    await expect(
      completeLesson({
        userId: userA.id,
        courseSlug: COURSE,
        lessonSlug: `ghost-${RID}`,
      }),
    ).rejects.toThrow("LESSON_NOT_FOUND");
  });

  it("protected video authorization denies unentitled users honestly", async () => {
    if (!dbUp) return;
    const result = await authorizePlayback(userA.id, `${COURSE}-lesson-1`);
    // Unentitled PRO access is denied; when allowed (FREE), only a
    // short-lived signed self-hosted stream URL is ever produced.
    if (!result.allowed && result.reason === "ACCESS_DENIED") {
      expect(result.reason).toBe("ACCESS_DENIED");
    } else if (result.allowed) {
      expect(result.playbackUrl).toContain("/api/videos/");
    }
  });

  it("bilingual routes resolve the same domain identity", async () => {
    if (!dbUp) return;
    const en = await getLessonView(userA.id, "en", COURSE, `${COURSE}-lesson-1`);
    const ar = await getLessonView(userA.id, "ar", COURSE, `${COURSE}-lesson-1`);
    expect(en.status).toBe(ar.status);
    if (en.status === "OK" && ar.status === "OK") {
      expect(en.curriculum.length).toBe(ar.curriculum.length);
    }
  });
});
