-- Self-hosted video storage (owner-managed via Admin Dashboard).
-- No third-party video provider (Bunny removed by product decision).

-- The Bunny-specific reference column becomes the generic opaque storage key.
ALTER TABLE "VideoAsset" RENAME COLUMN "bunnyVideoId" TO "storageRef";
ALTER INDEX "VideoAsset_bunnyVideoId_key" RENAME TO "VideoAsset_storageRef_key";

-- Storage metadata captured server-side during upload/processing.
ALTER TABLE "VideoAsset" ADD COLUMN "fileSizeBytes" BIGINT;
ALTER TABLE "VideoAsset" ADD COLUMN "width" INTEGER;
ALTER TABLE "VideoAsset" ADD COLUMN "height" INTEGER;
ALTER TABLE "VideoAsset" ADD COLUMN "mimeType" TEXT;
