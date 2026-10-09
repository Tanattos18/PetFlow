import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/**
 * Localiza e bloqueia a sessão de caixa aberta da empresa dentro da
 * transação corrente (lock `FOR UPDATE`). Nenhuma sessão aberta → 409.
 *
 * Toda operação que movimenta dinheiro (venda, cancelamento, movimento
 * manual, estorno e fechamento) locka a sessão ANTES de outras tabelas —
 * ordem fixa sessão → produtos evita deadlock entre operações.
 */
export async function lockOpenCashSession(
  tx: Prisma.TransactionClient,
  companyId: string,
  action: string,
): Promise<{ id: string }> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "CashSession"
    WHERE "companyId" = ${companyId} AND status = 'OPEN'
    ORDER BY "openedAt" DESC
    LIMIT 1
    FOR UPDATE`;

  const session = rows[0];
  if (!session) {
    throw new ConflictException(`Caixa fechado: abra o caixa para ${action}`);
  }
  return session;
}
