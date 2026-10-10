-- CreateEnum
CREATE TYPE "WhatsAppConfigStatus" AS ENUM ('CONFIGURED', 'ACTIVE', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "WhatsAppConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "WhatsAppConsentSource" AS ENUM ('MANUAL', 'REPLY', 'IMPORT');

-- CreateEnum
CREATE TYPE "WhatsAppTemplateCategory" AS ENUM ('UTILITY', 'MARKETING', 'AUTHENTICATION');

-- CreateEnum
CREATE TYPE "WhatsAppTemplateApproval" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WhatsAppMessageOrigin" AS ENUM ('MANUAL', 'SERVICE_REMINDER');

-- CreateEnum
CREATE TYPE "WhatsAppAttemptOutcome" AS ENUM ('ACCEPTED', 'TRANSIENT_ERROR', 'PERMANENT_ERROR');

-- CreateEnum
CREATE TYPE "WhatsAppWebhookKind" AS ENUM ('STATUS', 'INBOUND', 'OTHER');

-- CreateTable
CREATE TABLE "WhatsAppConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "WhatsAppConfigStatus" NOT NULL DEFAULT 'CONFIGURED',
    "phoneNumberId" TEXT,
    "wabaId" TEXT,
    "displayName" TEXT,
    "lastError" TEXT,
    "lastHealthAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt_BR',
    "category" "WhatsAppTemplateCategory" NOT NULL DEFAULT 'UTILITY',
    "approval" "WhatsAppTemplateApproval" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "body" TEXT NOT NULL,
    "providerReference" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConsent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "WhatsAppConsentStatus" NOT NULL,
    "source" "WhatsAppConsentSource" NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "updatedByUserId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT,
    "templateId" TEXT,
    "consentId" TEXT,
    "toPhone" TEXT NOT NULL,
    "variables" JSONB,
    "templateNameSnapshot" TEXT NOT NULL,
    "templateLanguageSnapshot" TEXT NOT NULL,
    "templateBodySnapshot" TEXT NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "WhatsAppMessageOrigin" NOT NULL DEFAULT 'MANUAL',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "failureDetail" TEXT,
    "idempotencyKey" TEXT,
    "cancelReason" TEXT,
    "cancelledByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessageAttempt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "outcome" "WhatsAppAttemptOutcome" NOT NULL,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "httpStatus" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppMessageAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "WhatsAppWebhookKind" NOT NULL DEFAULT 'OTHER',
    "phoneNumberId" TEXT,
    "companyId" TEXT,
    "providerMessageId" TEXT,
    "payload" JSONB NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConfig_companyId_key" ON "WhatsAppConfig"("companyId");

-- CreateIndex
CREATE INDEX "WhatsAppConfig_status_idx" ON "WhatsAppConfig"("status");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_companyId_status_idx" ON "WhatsAppTemplate"("companyId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_companyId_approval_idx" ON "WhatsAppTemplate"("companyId", "approval");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_companyId_nameKey_key" ON "WhatsAppTemplate"("companyId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConsent_clientId_key" ON "WhatsAppConsent"("clientId");

-- CreateIndex
CREATE INDEX "WhatsAppConsent_companyId_status_idx" ON "WhatsAppConsent"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_providerMessageId_key" ON "WhatsAppMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_companyId_createdAt_idx" ON "WhatsAppMessage"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_companyId_status_nextAttemptAt_idx" ON "WhatsAppMessage"("companyId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_clientId_idx" ON "WhatsAppMessage"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_companyId_idempotencyKey_key" ON "WhatsAppMessage"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WhatsAppMessageAttempt_startedAt_idx" ON "WhatsAppMessageAttempt"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessageAttempt_messageId_attemptNumber_key" ON "WhatsAppMessageAttempt"("messageId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppWebhookEvent_eventId_key" ON "WhatsAppWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_companyId_receivedAt_idx" ON "WhatsAppWebhookEvent"("companyId", "receivedAt");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_providerMessageId_idx" ON "WhatsAppWebhookEvent"("providerMessageId");

-- AddForeignKey
ALTER TABLE "WhatsAppConfig" ADD CONSTRAINT "WhatsAppConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConsent" ADD CONSTRAINT "WhatsAppConsent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConsent" ADD CONSTRAINT "WhatsAppConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConsent" ADD CONSTRAINT "WhatsAppConsent_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "WhatsAppConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessageAttempt" ADD CONSTRAINT "WhatsAppMessageAttempt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsAppMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppWebhookEvent" ADD CONSTRAINT "WhatsAppWebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
