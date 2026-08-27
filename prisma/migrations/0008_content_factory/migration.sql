-- Phase 8 — Content Factory
-- 1) Course authoring extensions in one validated JSON column (objectives,
--    prerequisites, instructor, cover). Avoids 8+ bilingual text columns;
--    content is admin-authored and sanitized server-side.
ALTER TABLE "Course" ADD COLUMN "meta" JSONB;

-- 2) Downloadable lesson resources (authorization via owning lesson chain).
CREATE TABLE "ResourceFile" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "storageRef" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResourceFile_storageRef_key" ON "ResourceFile"("storageRef");
CREATE INDEX "ResourceFile_lessonId_idx" ON "ResourceFile"("lessonId");

ALTER TABLE "ResourceFile" ADD CONSTRAINT "ResourceFile_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceFile" ADD CONSTRAINT "ResourceFile_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
