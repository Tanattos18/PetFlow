"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import { formatDate } from "../../lib/format";
import {
  subscriptionStatusLabels,
  type Paginated,
  type SubscriptionDto,
  type SubscriptionStatus,
} from "../../lib/types";

const PAGE_SIZE = 20;

const statusBadge: Record<SubscriptionStatus, string> = {
  ACTIVE: "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700",
  EXPIRED: "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700",
  CANCELLED: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500",
};

export default function AssinaturasPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SubscriptionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const load = useCallback(
    async (params: { page: number; status: string; search: string }) => {
      try {
        const query = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
        if (params.status) query.set("status", params.status);
        if (params.search.trim()) query.set("search", params.search.trim());
        const data = await api<Paginated<SubscriptionDto>>(`/api/subscriptions?${query.toString()}`);
        setItems(data.items);
        setTotal(data.total);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Falha ao carregar assinaturas.");
      }
    },
    [],
  );

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

  useEffect(() => {
    if (session) void load({ page, status, search });
  }, [session, load, page, status, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Assinaturas</h2>
          <p className="text-sm text-slate-500">
            Assinaturas recorrentes de clientes · {session.company.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/planos"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Planos
          </Link>
          {isAdmin && (
            <Link
              href="/assinaturas/nova"
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Nova assinatura
            </Link>
          )}
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

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="sub-status" className="text-sm text-slate-600">
          Status
        </label>
        <select
          id="sub-status"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="ACTIVE">Ativa</option>
          <option value="EXPIRED">Expirada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
        <input
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
          placeholder="Buscar por cliente ou plano"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Período</th>
              <th className="px-4 py-3">Renovações</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((subscription) => (
              <tr key={subscription.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <Link
                    href={`/assinaturas/${subscription.id}`}
                    className="font-medium text-slate-800 hover:text-teal-700 hover:underline"
                  >
                    {subscription.client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {subscription.plan.name}
                  <span className="ml-2 text-xs text-slate-400">
                    R$ {Number(subscription.plan.price).toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(subscription.startAt)} — {formatDate(subscription.endAt)}
                </td>
                <td className="px-4 py-3 text-slate-600">{subscription.renewalCount}</td>
                <td className="px-4 py-3">
                  <span className={statusBadge[subscription.status]}>
                    {subscriptionStatusLabels[subscription.status]}
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Nenhuma assinatura encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} assinatura{total === 1 ? "" : "s"} · página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
