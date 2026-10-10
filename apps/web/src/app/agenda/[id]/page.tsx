"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import { formatLocalDateShort, formatLocalTime } from "../../../lib/format";
import {
  appointmentStatusLabels,
  type AppointmentActionStatus,
  type AppointmentDto,
  type AppointmentStatus,
} from "../../../lib/types";

const statusBadgeClass: Record<AppointmentStatus, string> = {
  SCHEDULED: "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700",
  CONFIRMED: "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700",
  COMPLETED: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600",
  CANCELLED: "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700",
  NO_SHOW: "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700",
};

const terminalStatuses: AppointmentStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

const actionLabels: Array<{
  status: AppointmentActionStatus;
  label: string;
  visibleWhen: AppointmentStatus[];
}> = [
  { status: "CONFIRMED", label: "Confirmar", visibleWhen: ["SCHEDULED"] },
  {
    status: "COMPLETED",
    label: "Concluir",
    visibleWhen: ["SCHEDULED", "CONFIRMED"],
  },
  {
    status: "NO_SHOW",
    label: "Não compareceu",
    visibleWhen: ["SCHEDULED", "CONFIRMED"],
  },
];

export default function AgendamentoDetalhePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const appointmentId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<AppointmentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const loadAppointment = useCallback(async () => {
    try {
      setAppointment(await api<AppointmentDto>(`/api/appointments/${appointmentId}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o agendamento.");
    }
  }, [appointmentId]);

  useEffect(() => {
    if (session) {
      void loadAppointment();
    }
  }, [session, loadAppointment]);

  async function changeStatus(status: AppointmentActionStatus) {
    if (!window.confirm(`Marcar este agendamento como "${appointmentStatusLabels[status]}"?`)) {
      return;
    }
    setBusy(true);
    try {
      await api(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice("Status atualizado.");
      await loadAppointment();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o status.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelAppointment() {
    const reason = window.prompt("Motivo do cancelamento (mínimo 3 caracteres):");
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError("Informe um motivo com pelo menos 3 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/appointments/${appointmentId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setNotice("Agendamento cancelado.");
      setError(null);
      await loadAppointment();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cancelar.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (!appointment) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Link href="/agenda" className="text-sm text-teal-700 hover:underline">
          Voltar à agenda
        </Link>
      </div>
    );
  }

  const isTerminal = terminalStatuses.includes(appointment.status);
  const canCancel = !isTerminal && appointment.status !== "CANCELLED";
  const phone = appointment.client.phone || appointment.client.mobile;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Agendamento</h2>
          <p className="text-sm text-slate-500">
            {formatLocalDateShort(appointment.startLocal)} às{" "}
            {formatLocalTime(appointment.startLocal)} · {appointment.durationMinutes} min
          </p>
        </div>
        <div className="flex gap-2">
          {!isTerminal && (
            <Link
              href={`/agenda/${appointment.id}/editar`}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Editar
            </Link>
          )}
          <Link
            href="/agenda"
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

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-slate-400">Status</p>
          <span className={`mt-1 inline-block ${statusBadgeClass[appointment.status]}`}>
            {appointmentStatusLabels[appointment.status]}
          </span>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Serviço</p>
          <p className="mt-1 text-sm text-slate-800">
            {appointment.service.name} · R$ {Number(appointment.service.price).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Cliente</p>
          <p className="mt-1 text-sm text-slate-800">
            <Link href={`/clientes/${appointment.client.id}`} className="text-teal-700 hover:underline">
              {appointment.client.name}
            </Link>
            {phone ? <span className="text-slate-500"> · {phone}</span> : null}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Pet</p>
          <p className="mt-1 text-sm text-slate-800">
            {appointment.pet
              ? `${appointment.pet.name} (${appointment.pet.species === "DOG" ? "Cachorro" : appointment.pet.species === "CAT" ? "Gato" : "Outro"})`
              : "—"}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs uppercase text-slate-400">Observações</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
            {appointment.notes || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Criado por</p>
          <p className="mt-1 text-sm text-slate-800">{appointment.createdBy.name}</p>
        </div>
        {appointment.cancelledAt && (
          <div>
            <p className="text-xs uppercase text-slate-400">Cancelamento</p>
            <p className="mt-1 text-sm text-slate-800">
              {appointment.cancelReason} — {appointment.cancelledBy?.name ?? "—"}
            </p>
          </div>
        )}
      </div>

      {(!isTerminal || canCancel) && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {actionLabels
            .filter((action) => action.visibleWhen.includes(appointment.status))
            .map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={busy}
                onClick={() => void changeStatus(action.status)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {action.label}
              </button>
            ))}
          {canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancelAppointment()}
              className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Cancelar agendamento
            </button>
          )}
        </div>
      )}
    </div>
  );
}
