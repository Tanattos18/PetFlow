"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import {
  cashSessionStatusLabels,
  type CashSessionDto,
  type Paginated,
} from "../../../lib/types";

export default function SessoesCaixaPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<CashSessionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  const loadSessions = useCallback(async () => {
    try {
      const data = await api<Paginated<CashSessionDto>>("/api/cash/sessions");
      setSessions(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as sessões.");
    }
  }, []);

  useEffect(() => {
    if (session) {
      void loadSessions();
    }
  }, [session, loadSessions]);

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Histórico de sessões de caixa</h2>
          <p className="text-sm text-slate-500">
            {total} sessão{total === 1 ? "" : "ões"} registrada{total === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/caixa"
            className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
          >
            Caixa
          </Link>
          <Link
            href="/financeiro"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Resumo financeiro
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Abertura</th>
              <th className="px-4 py-3">Fechamento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aberto por</th>
              <th className="px-4 py-3">Fechado por</th>
              <th className="px-4 py-3">Inicial</th>
              <th className="px-4 py-3">Saldo esperado</th>
              <th className="px-4 py-3">Contado</th>
              <th className="px-4 py-3">Diferença</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">
                  {new Date(item.openedAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {item.closedAt ? new Date(item.closedAt).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      item.status === "OPEN"
                        ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    }
                  >
                    {cashSessionStatusLabels[item.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.openedBy.name}</td>
                <td className="px-4 py-3 text-slate-600">{item.closedBy?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">
                  R$ {Number(item.initialAmount).toFixed(2)}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  R$ {Number(item.expectedBalance).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {item.countedAmount ? `R$ ${Number(item.countedAmount).toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3">
                  {item.difference ? (
                    <span
                      className={
                        Number(item.difference) === 0
                          ? "text-teal-700"
                          : "font-medium text-red-700"
                      }
                    >
                      R$ {Number(item.difference).toFixed(2)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/caixa/movimentos?sessionId=${item.id}`}
                    className="text-sm text-teal-700 hover:underline"
                  >
                    Movimentações
                  </Link>
                </td>
              </tr>
            ))}
            {!sessions.length && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma sessão de caixa registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
