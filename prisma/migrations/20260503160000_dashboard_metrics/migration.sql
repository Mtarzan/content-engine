-- AlterTable
ALTER TABLE "Product" ADD COLUMN "product_url" TEXT;

-- AlterTable
ALTER TABLE "ContentPost" ADD COLUMN "asset_type" TEXT NOT NULL DEFAULT 'image';
ALTER TABLE "ContentPost" ADD COLUMN "scheduled_for" TIMESTAMP(3);
ALTER TABLE "ContentPost" ADD COLUMN "published_at" TIMESTAMP(3);
ALTER TABLE "ContentPost" ADD COLUMN "impressions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContentPost" ADD COLUMN "clicks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContentPost" ADD COLUMN "conversions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContentPost" ADD COLUMN "spend" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ContentPost" ADD COLUMN "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PostEvent" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "interval_minutes" INTEGER NOT NULL DEFAULT 30,
    "batch_size" INTEGER NOT NULL DEFAULT 25,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentPost_platform_idx" ON "ContentPost"("platform");

-- CreateIndex
CREATE INDEX "ContentPost_created_at_idx" ON "ContentPost"("created_at");

-- CreateIndex
CREATE INDEX "PostEvent_post_id_idx" ON "PostEvent"("post_id");

-- CreateIndex
CREATE INDEX "PostEvent_event_type_idx" ON "PostEvent"("event_type");

-- CreateIndex
CREATE INDEX "PostEvent_created_at_idx" ON "PostEvent"("created_at");

-- AddForeignKey
ALTER TABLE "PostEvent" ADD CONSTRAINT "PostEvent_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "ContentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed singleton scheduler setting
INSERT INTO "SchedulerSetting" ("id", "enabled", "interval_minutes", "batch_size", "updated_at")
VALUES ('default', true, 30, 25, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
