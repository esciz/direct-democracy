CREATE TABLE IF NOT EXISTS "HumanReviewDecision" (
  "reviewType" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "reviewerUserId" TEXT NOT NULL,
  "reviewerName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HumanReviewDecision_pkey" PRIMARY KEY ("reviewType", "itemId")
);
CREATE INDEX IF NOT EXISTS "HumanReviewDecision_status_idx" ON "HumanReviewDecision"("status");
