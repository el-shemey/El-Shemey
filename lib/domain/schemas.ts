import { z } from "zod";

/**
 * Input validation boundaries for learning mutations (Phase 3).
 * Every server-side mutation validates its inputs through these schemas —
 * the client is never trusted (see SECURITY.md).
 */

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid slug format");

export const completeLessonInputSchema = z.object({
  userId: z.string().cuid(),
  courseSlug: slugSchema,
  lessonSlug: slugSchema,
});

export type CompleteLessonInput = z.infer<typeof completeLessonInputSchema>;

export const startEnrollmentInputSchema = z.object({
  userId: z.string().cuid(),
  courseSlug: slugSchema,
});

export type StartEnrollmentInput = z.infer<typeof startEnrollmentInputSchema>;
