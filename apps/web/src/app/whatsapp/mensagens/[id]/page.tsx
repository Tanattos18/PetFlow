"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "../../../../lib/api";
import { fetchSession, type Session } from "../../../../lib/session";
import {
  whatsappMessageOriginLabels,
  whatsappMessageStatusLabels,
  type WhatsAppMessageDto,
} from "../../../../lib/types";

const statusBadgeClass: Record<string, string> = {
  PENDING: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600",
  PROCESSING: "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700",
  ACCEPTED: "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700",
  SENT: "rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700",
  DELIVERED: "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700",
  READ: "rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-800",
  FAILED: "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700",
  CANCELLED: "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700",
};

const outcomeLabels: Record<string, string> = {
  ACCEPTED: "Aceita pelo provedor",
  TRANSIENT_ERROR: "Erro transitório",
  PERMANENT_ERROR: "Erro permanente",
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

export default function WhatsAppMensagemDetalhePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const messageId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<WhatsAppMessageDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const loadMessage = useCallback(async () => {
    try {
      const data = await api<WhatsAppMessageDto>(`/api/whatsapp/messages/${messageId}`);
      setMessage(data);
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Falha ao carregar a mensagem.");
      }
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
    });
  }, [router]);

  useEffect(() => {
    if (session) void loadMessage();
  }, [session, loadMessage]);

  async function handleCancel() {
    if (!message) return;
    const reason = window.prompt("Motivo do cancelamento:");
    if (!reason || reason.trim().length < 3) return;
    setError(null);
    try {
      await api(`/api/whatsapp/messages/${message.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setNotice("Mensagem cancelada.");
      await loadMessage();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao cancelar.");
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (notFound || !message) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-slate-500">Mensagem não encontrada.</p>
        <Link
          href="/whatsapp/mensagens"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar às mensagens
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Detalhe da mensagem</h2>
          <p className="text-sm text-slate-500">
            {message.client?.name ?? "—"} · {message.toPhone}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && message.status === "PENDING" && (
            <button
              type="button"
              onClick={() => void handleCancel()}
              className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Cancelar mensagem
            </button>
          )}
          <Link
            href="/whatsapp/mensagens"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Voltar
          </Link>
        </div>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Situação
          </h3>
          <span className={statusBadgeClass[message.status]}>
            {whatsappMessageStatusLabels[message.status]}
          </span>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-slate-400">Template</dt>
            <dd className="text-slate-700">{message.templateNameSnapshot}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Idioma</dt>
            <dd className="text-slate-700">{message.templateLanguageSnapshot}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Origem</dt>
            <dd className="text-slate-700">
              {whatsappMessageOriginLabels[message.origin]}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Tentativas</dt>
            <dd className="text-slate-700">
              {message.attempts}/{message.maxAttempts}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">ID do provedor</dt>
            <dd className="break-all text-slate-700">{message.providerMessageId || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Próxima tentativa</dt>
            <dd className="text-slate-700">{formatDate(message.nextAttemptAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Criada em</dt>
            <dd className="text-slate-700">{formatDate(message.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Criada por</dt>
            <dd className="text-slate-700">{message.createdBy?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Chave de idempotência</dt>
            <dd className="break-all text-slate-700">{message.idempotencyKey || "—"}</dd>
          </div>
          {message.failureReason && (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs uppercase text-red-400">Falha</dt>
              <dd className="text-red-700">
                {message.failureReason}
                {message.failureDetail ? ` — ${message.failureDetail}` : ""}
              </dd>
            </div>
          )}
          {message.cancelReason && (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs uppercase text-amber-500">Cancelamento</dt>
              <dd className="text-amber-700">{message.cancelReason}</dd>
            </div>
          )}
        </dl>
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <p className="mb-1 text-xs uppercase text-slate-400">Corpo do template no envio</p>
          {message.templateBodySnapshot}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">Erro</th>
              <th className="px-4 py-3">HTTP</th>
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3">Fim</th>
            </tr>
          </thead>
          <tbody>
            {(message.attemptsLog ?? []).map((attempt) => (
              <tr key={attempt.id} className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-600">{attempt.attemptNumber}</td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {outcomeLabels[attempt.outcome] ?? attempt.outcome}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {attempt.errorCode
                    ? `${attempt.errorCode}${attempt.errorMessage ? ` — ${attempt.errorMessage}` : ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{attempt.httpStatus ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(attempt.startedAt)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(attempt.finishedAt)}</td>
              </tr>
            ))}
            {(message.attemptsLog ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nenhuma tentativa registrada ainda — a mensagem aguarda o worker.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
