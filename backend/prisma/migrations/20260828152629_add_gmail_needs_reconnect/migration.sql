-- AlterTable
ALTER TABLE "gmail_connections" ADD COLUMN     "needsReconnect" BOOLEAN NOT NULL DEFAULT false;
