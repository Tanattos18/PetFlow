"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { formatBrl, formatDateTime } from "../../lib/format";
import { fetchSession, type Session } from "../../lib/session";
import type { DashboardSummaryDto } from "../../lib/types";

function StatCard({
  title,
  period,
  definition,
  children,
  footer,
}: {
  title: string;
  period?: string;
  definition: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h4>
        {period && (
          <span className="whitespace-nowrap text-[11px] text-slate-400">{period}</span>
        )}
      </div>
      <div className="flex-1">{children}</div>
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-400">
        {definition}
      </p>
      {footer}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
      setLoading(false);
    });
  }, [router]);

  const loadSummary = useCallback(async () => {
    setLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const query = params.toString();
      const data = await api<DashboardSummaryDto>(
        `/api/reports/summary${query ? `?${query}` : ""}`,
      );
      setSummary(data);
      setLoadedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o dashboard.");
    } finally {
      setLoadingData(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (session) {
      void loadSummary();
    }
  }, [session]);

  function handlePeriod(event: FormEvent) {
    event.preventDefault();
    void loadSummary();
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";
  const periodLabel = summary
    ? `${summary.period.from} a ${summary.period.to} (${summary.period.timezone})`
    : "—";

  const maxDayNet = summary
    ? Math.max(
        1,
        ...summary.salesByDay.map((day) => Number(day.net)),
      )
    : 1;
  const maxPaymentNet = summary
    ? Math.max(1, ...summary.salesByPaymentMethod.map((item) => Number(item.net)))
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">
            Indicadores da operação — período aplicado:{" "}
            <strong className="font-medium text-slate-700">{periodLabel}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/relatorios"
            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Relatórios
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      <form
        onSubmit={handlePeriod}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label htmlFor="dash-from" className="mb-1 block text-sm text-slate-700">
            De
          </label>
          <input
            id="dash-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="dash-to" className="mb-1 block text-sm text-slate-700">
            Até
          </label>
          <input
            id="dash-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={loadingData}
            className="flex-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loadingData ? "Atualizando..." : "Atualizar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Padrão 30 dias
          </button>
        </div>
        <div className="flex items-end text-xs text-slate-500">
          {loadedAt ? `Dados carregados em ${formatDateTime(loadedAt)}` : "Sem dados carregados"}
        </div>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loadingData && !summary && (
        <p className="py-8 text-center text-sm text-slate-500">Carregando indicadores...</p>
      )}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Vendas do período"
              period={periodLabel}
              definition="Líquido = Σ total de vendas concluídas; ticket médio = líquido ÷ quantidade de concluídas; cancelamentos ficam fora do líquido."
            >
              <p className="text-2xl font-semibold text-slate-900">
                {formatBrl(summary.sales.net)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {summary.sales.completedCount} venda
                {summary.sales.completedCount === 1 ? "" : "s"} concluída
                {summary.sales.completedCount === 1 ? "" : "s"} · bruto{" "}
                {formatBrl(summary.sales.gross)} · descontos{" "}
                {formatBrl(summary.sales.discounts)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Ticket médio:{" "}
                <strong className="font-medium text-slate-800">
                  {summary.sales.ticketAverage === null
                    ? "— (sem vendas)"
                    : formatBrl(summary.sales.ticketAverage)}
                </strong>
              </p>
              <p className="mt-1 text-sm text-red-600">
                {summary.sales.cancelledCount} cancelada
                {summary.sales.cancelledCount === 1 ? "" : "s"} ·{" "}
                {formatBrl(summary.sales.cancelledTotal)}
              </p>
            </StatCard>

            <StatCard
              title="Caixa"
              period={periodLabel}
              definition="Entradas/saídas do período consideram apenas dinheiro físico (inCash); saldo esperado é da sessão aberta, calculado no servidor."
            >
              <p className="mb-1">
                <span
                  className={
                    summary.cash.openSession
                      ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700"
                      : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                  }
                >
                  {summary.cash.openSession ? "Caixa aberto" : "Caixa fechado"}
                </span>
              </p>
              {summary.cash.openSession && (
                <p className="text-sm text-slate-600">
                  Saldo esperado:{" "}
                  <strong className="font-medium text-slate-800">
                    {formatBrl(summary.cash.openSession.expectedBalance)}
                  </strong>
                </p>
              )}
              <p className="mt-1 text-sm text-slate-600">
                Entradas {formatBrl(summary.cash.entriesInCash)} · saídas{" "}
                {formatBrl(summary.cash.exitsInCash)} · líquido{" "}
                {formatBrl(
                  Number(summary.cash.entriesInCash) - Number(summary.cash.exitsInCash),
                )}
              </p>
            </StatCard>

            <StatCard
              title="Estoque"
              period="situação atual"
              definition="Alertas de produtos ativos: sem estoque = saldo zerado; estoque baixo = saldo abaixo do mínimo (exclui os zerados)."
            >
              <p className="text-2xl font-semibold text-red-600">
                {summary.stock.outOfStockCount}
              </p>
              <p className="text-sm text-slate-600">produto(s) sem estoque</p>
              <p className="mt-2 text-2xl font-semibold text-amber-600">
                {summary.stock.lowStockCount}
              </p>
              <p className="text-sm text-slate-600">produto(s) com estoque baixo</p>
            </StatCard>

            <StatCard
              title="Novos clientes"
              period={periodLabel}
              definition="Contagem de clientes criados no período, pela data de cadastro (UTC)."
            >
              <p className="text-2xl font-semibold text-slate-900">
                {summary.clients.newClients}
              </p>
              <p className="text-sm text-slate-600">cliente(s) cadastrado(s)</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {summary.clients.newPets}
              </p>
              <p className="text-sm text-slate-600">pet(s) cadastrado(s)</p>
            </StatCard>

            <StatCard
              title="WhatsApp"
              period={periodLabel}
              definition="Contagem pelo status atual das mensagens criadas no período — 'aceita pela API' não significa 'entregue'."
            >
              <p className="text-2xl font-semibold text-slate-900">
                {summary.whatsapp.total}
              </p>
              <p className="text-sm text-slate-600">mensagem(ns) no período</p>
              <p className="mt-1 text-sm text-slate-600">
                Entregues: <strong className="font-medium">{summary.whatsapp.delivered}</strong>{" "}
                · Lidas: <strong className="font-medium">{summary.whatsapp.read}</strong> ·
                Falhas:{" "}
                <strong className="font-medium text-red-600">
                  {summary.whatsapp.failed}
                </strong>{" "}
                · Pendentes: {summary.whatsapp.pending}
              </p>
            </StatCard>

            <StatCard
              title="Agendamentos e serviços"
              period={periodLabel}
              definition="Contagem de agendamentos por status no período, pela data e hora de início (Etapa 8)."
            >
              {summary.modules.servicesRealized.available && summary.services ? (
                <>
                  <p className="text-2xl font-semibold text-slate-900">
                    {summary.services.completed}
                  </p>
                  <p className="text-sm text-slate-600">serviço(s) concluído(s)</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Confirmados: <strong className="font-medium">{summary.services.confirmed}</strong>{" "}
                    · Agendados: <strong className="font-medium">{summary.services.scheduled}</strong>
                  </p>
                  <p className="text-sm text-slate-600">
                    Cancelados: {summary.services.cancelled} · Não compareceu:{" "}
                    {summary.services.noShow}
                  </p>
                </>
              ) : (
                <>
                  <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Módulo não disponível
                  </span>
                  <p className="mt-2 text-sm text-slate-500">
                    {summary.modules.servicesRealized.reason ??
                      "Contagens de agendamentos indisponíveis."}
                  </p>
                </>
              )}
            </StatCard>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Vendas concluídas por dia
              </h3>
              <span className="text-xs text-slate-400">
                {periodLabel} · valores líquidos (R$)
              </span>
            </div>
            {summary.salesByDay.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Nenhuma venda concluída no período selecionado.
              </p>
            ) : (
              <div className="flex h-40 items-end gap-1">
                {summary.salesByDay.map((day) => (
                  <div
                    key={day.day}
                    className="flex h-full flex-1 items-end"
                    title={`${day.day}: ${day.count} venda(s) — ${formatBrl(day.net)}`}
                  >
                    <div
                      className="w-full rounded-t bg-teal-600 hover:bg-teal-700"
                      style={{
                        height: `${Math.max(
                          4,
                          (Number(day.net) / maxDayNet) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            {summary.salesByDay.length > 0 && (
              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>{summary.salesByDay[0].day}</span>
                <span>
                  {summary.salesByDay[summary.salesByDay.length - 1].day}
                </span>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Vendas por forma de pagamento
              </h3>
              <span className="text-xs text-slate-400">
                {periodLabel} · apenas concluídas
              </span>
            </div>
            {summary.salesByPaymentMethod.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Nenhuma venda concluída no período selecionado.
              </p>
            ) : (
              <ul className="space-y-3">
                {summary.salesByPaymentMethod.map((item) => (
                  <li key={item.paymentMethod}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-700">
                        {item.label} ({item.count})
                      </span>
                      <span className="font-medium text-slate-900">
                        {formatBrl(item.net)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-teal-600"
                        style={{
                          width: `${Math.max(
                            2,
                            (Number(item.net) / maxPaymentNet) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
