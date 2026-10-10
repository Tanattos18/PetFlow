"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import { formatBrl, formatDateTime, formatDate } from "../../../lib/format";
import {
  subscriptionStatusLabels,
  type SubscriptionDto,
} from "../../../lib/types";

const statusBadge: Record<string, string> = {
  ACTIVE: "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700",
  EXPIRED: "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700",
  CANCELLED: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500",
};

export default function AssinaturaDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = session?.user.role === "ADMIN";
  const id = params.id;

  const load = useCallback(async () => {
    try {
      const data = await api<SubscriptionDto>(`/api/subscriptions/${id}`);
      setSubscription(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar a assinatura.");
    }
  }, [id]);

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
    if (session) void load();
  }, [session, load]);

  async function handleRenew() {
    if (!window.confirm("Registrar renovação (novo pagamento no caixa)?")) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await api(`/api/subscriptions/${id}/renew`, { method: "POST" });
      setNotice("Assinatura renovada.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao renovar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const reason = window.prompt("Motivo do cancelamento (3 a 500 caracteres):");
    if (reason === null) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await api(`/api/subscriptions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setNotice("Assinatura cancelada.");
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.issues?.length) {
        setError(err.issues[0].message);
      } else {
        setError(err instanceof ApiError ? err.message : "Falha ao cancelar.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (error && !subscription) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/assinaturas" className="text-sm text-teal-700 underline">
          Voltar para assinaturas
        </Link>
      </div>
    );
  }

  if (!subscription) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const canRenew =
    subscription.status === "ACTIVE" || subscription.status === "EXPIRED";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{subscription.client.name}</h2>
          <p className="text-sm text-slate-500">
            {subscription.plan.name} · {formatBrl(subscription.plan.price)} ·{" "}
            {subscription.plan.durationDays} dias
          </p>
        </div>
        <Link
          href="/assinaturas"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </Link>
      </div>

      {notice && (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Período</dt>
            <dd className="text-sm text-slate-800">
              {formatDate(subscription.startAt)} — {formatDate(subscription.endAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Status</dt>
            <dd>
              <span className={statusBadge[subscription.status]}>
                {subscriptionStatusLabels[subscription.status]}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Renovações</dt>
            <dd className="text-sm text-slate-800">{subscription.renewalCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Último pagamento</dt>
            <dd className="text-sm text-slate-800">
              {subscription.lastPaymentAt
                ? formatDateTime(subscription.lastPaymentAt)
                : "—"}
            </dd>
          </div>
          {subscription.status === "CANCELLED" && subscription.cancelReason && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-slate-500">Motivo do cancelamento</dt>
              <dd className="text-sm text-slate-800">{subscription.cancelReason}</dd>
            </div>
          )}
        </dl>

        {isAdmin && (canRenew || subscription.status === "ACTIVE") && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            {canRenew && (
              <button
                type="button"
                onClick={() => void handleRenew()}
                disabled={busy}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {busy ? "Processando..." : "Renovar (pagar no caixa)"}
              </button>
            )}
            {subscription.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={busy}
                className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Cancelar assinatura
              </button>
            )}
          </div>
        )}
        {isAdmin && canRenew && (
          <p className="mt-2 text-xs text-slate-500">
            Renovar exige caixa aberto; a entrada é criada como pagamento/renovação da assinatura.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-6 py-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pagamentos
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Valor</th>
                <th className="px-6 py-3">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {(subscription.payments ?? []).map((payment) => (
                <tr key={payment.id} className="border-b border-slate-100">
                  <td className="px-6 py-3 text-slate-600">
                    {formatDateTime(payment.createdAt)}
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-800">
                    {formatBrl(payment.amount)}
                  </td>
                  <td className="px-6 py-3 text-slate-600">{payment.description}</td>
                </tr>
              ))}
              {(subscription.payments ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-slate-400">
                    Nenhum pagamento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
