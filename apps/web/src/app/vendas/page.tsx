"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import {
  paymentMethodLabels,
  saleStatusLabels,
  type Paginated,
  type SaleDto,
  type SaleStatus,
} from "../../lib/types";

const pageSize = 20;

export default function VendasPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | SaleStatus>("");
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

  const loadSales = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const data = await api<Paginated<SaleDto>>(`/api/sales?${params.toString()}`);
      setSales(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as vendas.");
    }
  }, [page, search, status, from, to]);

  useEffect(() => {
    if (session) {
      void loadSales();
    }
  }, [session, loadSales]);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void loadSales();
  }

  function clearFilters() {
    setSearch("");
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Histórico de vendas</h2>
          <p className="text-sm text-slate-500">
            {total} venda{total === 1 ? "" : "s"} encontrada{total === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pdv"
            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Abrir PDV
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

      <form onSubmit={handleFilter} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="filter-search" className="mb-1 block text-sm text-slate-700">
            Código
          </label>
          <input
            id="filter-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="PF-XXXXXXXX"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="filter-status" className="mb-1 block text-sm text-slate-700">
            Status
          </label>
          <select
            id="filter-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as "" | SaleStatus)}
            className={inputClass}
          >
            <option value="">Todos</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-from" className="mb-1 block text-sm text-slate-700">
            De
          </label>
          <input
            id="filter-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="filter-to" className="mb-1 block text-sm text-slate-700">
            Até
          </label>
          <input
            id="filter-to"
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
            Filtrar
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Limpar
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Itens</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">
                  {new Date(sale.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                  {sale.receiptCode}
                </td>
                <td className="px-4 py-3 text-slate-600">{sale.items.length}</td>
                <td className="px-4 py-3 text-slate-600">
                  {paymentMethodLabels[sale.paymentMethod]}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  R$ {Number(sale.total).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      sale.status === "COMPLETED"
                        ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                        : "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                    }
                  >
                    {saleStatusLabels[sale.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/vendas/${sale.id}`}
                    className="text-sm text-teal-700 hover:underline"
                  >
                    Ver detalhe
                  </Link>
                </td>
              </tr>
            ))}
            {!sales.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma venda encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Página {page} de {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
