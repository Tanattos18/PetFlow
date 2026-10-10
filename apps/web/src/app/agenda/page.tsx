"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import {
  formatDayTitle,
  formatLocalTime,
  shiftDay,
  todayLocal,
} from "../../lib/format";
import {
  appointmentStatusLabels,
  type AppointmentDto,
  type AppointmentStatus,
  type Paginated,
} from "../../lib/types";

const pageSize = 20;

const statusBadgeClass: Record<AppointmentStatus, string> = {
  SCHEDULED: "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700",
  CONFIRMED: "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700",
  COMPLETED: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600",
  CANCELLED: "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700",
  NO_SHOW: "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700",
};

export default function AgendaPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [day, setDay] = useState(() => todayLocal());
  const [status, setStatus] = useState<"" | AppointmentStatus>("");
  const [search, setSearch] = useState("");

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

  const loadAppointments = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        from: day,
        to: day,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);

      const data = await api<Paginated<AppointmentDto>>(
        `/api/appointments?${params.toString()}`,
      );
      setAppointments(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a agenda.");
    }
  }, [day, page, search, status]);

  useEffect(() => {
    if (session) {
      void loadAppointments();
    }
  }, [session, loadAppointments]);

  function changeDay(nextDay: string) {
    setDay(nextDay);
    setPage(1);
  }

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void loadAppointments();
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
          <h2 className="text-xl font-semibold text-slate-900">Agenda</h2>
          <p className="text-sm text-slate-500">
            {formatDayTitle(day)} · {total} agendamento{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/agenda/novo"
            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Novo agendamento
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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeDay(shiftDay(day, -1))}
            aria-label="Dia anterior"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => changeDay(todayLocal())}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => changeDay(shiftDay(day, 1))}
            aria-label="Próximo dia"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            →
          </button>
        </div>
        <div>
          <label htmlFor="agenda-day" className="mb-1 block text-sm text-slate-700">
            Dia
          </label>
          <input
            id="agenda-day"
            type="date"
            value={day}
            onChange={(event) => event.target.value && changeDay(event.target.value)}
            className={inputClass}
          />
        </div>
        <form onSubmit={handleFilter} className="flex flex-1 flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <label htmlFor="agenda-search" className="mb-1 block text-sm text-slate-700">
              Busca
            </label>
            <input
              id="agenda-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cliente, pet ou serviço"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="agenda-status" className="mb-1 block text-sm text-slate-700">
              Status
            </label>
            <select
              id="agenda-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "" | AppointmentStatus)}
              className={inputClass}
            >
              <option value="">Todos</option>
              {Object.entries(appointmentStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Filtrar
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Pet</th>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={appointment.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {formatLocalTime(appointment.startLocal)}
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    {appointment.durationMinutes} min
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{appointment.client.name}</td>
                <td className="px-4 py-3 text-slate-600">{appointment.pet?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{appointment.service.name}</td>
                <td className="px-4 py-3">
                  <span className={statusBadgeClass[appointment.status]}>
                    {appointmentStatusLabels[appointment.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/agenda/${appointment.id}`}
                    className="text-sm text-teal-700 hover:underline"
                  >
                    Ver detalhe
                  </Link>
                </td>
              </tr>
            ))}
            {!appointments.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum agendamento para este dia.
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
