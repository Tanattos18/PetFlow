-- CreateIndex
CREATE INDEX "Client_companyId_createdAt_idx" ON "Client"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Pet_companyId_createdAt_idx" ON "Pet"("companyId", "createdAt");
