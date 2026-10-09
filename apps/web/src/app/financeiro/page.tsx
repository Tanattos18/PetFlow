"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import type { CashSummaryDto } from "../../lib/types";

export default function FinanceiroPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CashSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const query = params.toString();
      const data = await api<CashSummaryDto>(`/api/cash/summary${query ? `?${query}` : ""}`);
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o resumo.");
    }
  }, [from, to]);

  useEffect(() => {
    if (session) {
      void loadSummary();
    }
  }, [session, loadSummary]);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    void loadSummary();
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

  const cards: Array<{ label: string; value: string; tone?: "green" | "red" }> = [
    { label: "Vendas", value: summary?.salesTotal ?? "0.00", tone: "green" },
    { label: "Entradas manuais", value: summary?.manualEntriesTotal ?? "0.00", tone: "green" },
    { label: "Saídas manuais", value: summary?.manualExitsTotal ?? "0.00", tone: "red" },
    { label: "Cancelamentos", value: summary?.cancelmentsTotal ?? "0.00", tone: "red" },
    { label: "Estornos (+)", value: summary?.reversalsInTotal ?? "0.00", tone: "green" },
    { label: "Estornos (-)", value: summary?.reversalsOutTotal ?? "0.00", tone: "red" },
    { label: "Total de entradas", value: summary?.totalIn ?? "0.00", tone: "green" },
    { label: "Total de saídas", value: summary?.totalOut ?? "0.00", tone: "red" },
  ];

  const net = Number(summary?.net ?? "0");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Resumo financeiro</h2>
          <p className="text-sm text-slate-500">
            Totais calculados no servidor para o período selecionado.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/caixa"
            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Caixa
          </Link>
          <Link
            href="/caixa/movimentos"
            className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
          >
            Movimentações
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleFilter}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3"
      >
        <div>
          <label htmlFor="fin-from" className="mb-1 block text-sm text-slate-700">
            De
          </label>
          <input
            id="fin-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="fin-to" className="mb-1 block text-sm text-slate-700">
            Até
          </label>
          <input
            id="fin-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Aplicar período
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Limpar
          </button>
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">{card.label}</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                card.tone === "green" ? "text-teal-800" : "text-red-700"
              }`}
            >
              R$ {Number(card.value).toFixed(2)}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-xs uppercase text-teal-700">Líquido (entradas - saídas)</p>
          <p className="mt-1 text-3xl font-semibold text-teal-900">R$ {net.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Período</p>
          <p className="mt-1 text-sm text-slate-700">
            {summary?.from || summary?.to
              ? `${summary.from ?? "início"} até ${summary.to ?? "hoje"}`
              : "Todo o histórico"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Estornos (saldo)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            R$ {Number(summary?.reversalsNetTotal ?? "0").toFixed(2)}
          </p>
        </div>
      </section>
    </div>
  );
}
