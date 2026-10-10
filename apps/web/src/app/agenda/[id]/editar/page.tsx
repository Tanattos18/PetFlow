"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../lib/api";
import { fetchSession, type Session } from "../../../../lib/session";
import { AppointmentForm } from "../../../../components/AppointmentForm";
import type { AppointmentDto } from "../../../../lib/types";

const terminalStatuses = ["COMPLETED", "CANCELLED", "NO_SHOW"];

export default function EditarAgendamentoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const appointmentId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<AppointmentDto | null>(null);
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

  useEffect(() => {
    if (!session) return;
    api<AppointmentDto>(`/api/appointments/${appointmentId}`)
      .then((value) => {
        if (terminalStatuses.includes(value.status)) {
          router.replace(`/agenda/${appointmentId}`);
          return;
        }
        setAppointment(value);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Não foi possível carregar o agendamento.");
      });
  }, [session, appointmentId, router]);

  if (loading || !session || (!appointment && !error)) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Editar agendamento</h2>
        <Link
          href={`/agenda/${appointmentId}`}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {appointment && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <AppointmentForm
            initial={appointment}
            submitLabel="Salvar alterações"
            onSubmit={async (payload) => {
              await api(`/api/appointments/${appointmentId}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
              });
              router.push(`/agenda/${appointmentId}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
