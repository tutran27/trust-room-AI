-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TermsUploaded';

-- CreateTable
CREATE TABLE "DealTermFile" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "storageType" TEXT NOT NULL DEFAULT 'local',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealTermFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealTermFile_sha256Hash_key" ON "DealTermFile"("sha256Hash");

-- CreateIndex
CREATE INDEX "DealTermFile_dealId_idx" ON "DealTermFile"("dealId");

-- AddForeignKey
ALTER TABLE "DealTermFile" ADD CONSTRAINT "DealTermFile_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
