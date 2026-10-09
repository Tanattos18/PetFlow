-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "CashMovementOrigin" AS ENUM ('MANUAL', 'SALE', 'SALE_CANCELMENT', 'REVERSAL');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cashSessionId" TEXT;

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "initialAmount" DECIMAL(12,2) NOT NULL,
    "openingNotes" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "closingNotes" TEXT,
    "countedAmount" DECIMAL(12,2),
    "expectedAmount" DECIMAL(12,2),
    "difference" DECIMAL(12,2),

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "origin" "CashMovementOrigin" NOT NULL,
    "inCash" BOOLEAN NOT NULL DEFAULT true,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "justification" TEXT,
    "saleId" TEXT,
    "reversalOfId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversalReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashSession_companyId_status_idx" ON "CashSession"("companyId", "status");

-- CreateIndex
CREATE INDEX "CashSession_companyId_openedAt_idx" ON "CashSession"("companyId", "openedAt");

-- CreateIndex
CREATE INDEX "CashMovement_companyId_createdAt_idx" ON "CashMovement"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CashMovement_companyId_cashSessionId_idx" ON "CashMovement"("companyId", "cashSessionId");

-- CreateIndex
CREATE INDEX "CashMovement_companyId_saleId_idx" ON "CashMovement"("companyId", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_origin_saleId_key" ON "CashMovement"("origin", "saleId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "CashMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
