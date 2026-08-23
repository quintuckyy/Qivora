-- CreateEnum
CREATE TYPE "DetectedEmailType" AS ENUM ('APPLICATION_RECEIVED', 'ASSESSMENT', 'INTERVIEW', 'REJECTION', 'OFFER', 'OTHER');

-- CreateEnum
CREATE TYPE "SuggestedAction" AS ENUM ('CREATE_APPLICATION', 'UPDATE_STATUS', 'NONE');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateTable
CREATE TABLE "gmail_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_emails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT,
    "subject" TEXT,
    "fromAddress" TEXT,
    "receivedAt" TIMESTAMP(3),
    "detectedType" "DetectedEmailType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "extractedCompany" TEXT,
    "extractedPosition" TEXT,
    "extractedDate" TIMESTAMP(3),
    "extractedSource" TEXT,
    "suggestedAction" "SuggestedAction" NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "matchedApplicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "processed_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gmail_connections_userId_key" ON "gmail_connections"("userId");

-- CreateIndex
CREATE INDEX "processed_emails_userId_status_idx" ON "processed_emails"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "processed_emails_userId_gmailMessageId_key" ON "processed_emails"("userId", "gmailMessageId");

-- AddForeignKey
ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_emails" ADD CONSTRAINT "processed_emails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_emails" ADD CONSTRAINT "processed_emails_matchedApplicationId_fkey" FOREIGN KEY ("matchedApplicationId") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
