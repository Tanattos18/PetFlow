"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import {
  type AppointmentDto,
  type ClientDto,
  type Paginated,
  type PetDto,
  type ServiceDto,
} from "../lib/types";

interface AppointmentFormProps {
  initial?: AppointmentDto;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

const datetimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function AppointmentForm({ initial, onSubmit, submitLabel }: AppointmentFormProps) {
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [petId, setPetId] = useState(initial?.petId ?? "");
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? "");
  const [startLocal, setStartLocal] = useState(initial?.startLocal ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    String(initial?.durationMinutes ?? ""),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [clients, setClients] = useState<ClientDto[]>([]);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [pets, setPets] = useState<PetDto[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      api<Paginated<ClientDto>>("/api/clients?status=ACTIVE&pageSize=100"),
      api<Paginated<ServiceDto>>("/api/services?status=ACTIVE&pageSize=100"),
    ])
      .then(([clientPage, servicePage]) => {
        setClients(clientPage.items);
        setServices(servicePage.items);
      })
      .catch(() => {
        setFormError("Não foi possível carregar clientes e serviços.");
      });
  }, []);

  useEffect(() => {
    if (!clientId) {
      setPets([]);
      return;
    }
    void api<Paginated<PetDto>>(`/api/pets?clientId=${clientId}&status=ACTIVE&pageSize=100`)
      .then((page) => {
        setPets(page.items);
        setPetId((current) =>
          current && page.items.some((pet) => pet.id === current) ? current : "",
        );
      })
      .catch(() => setPets([]));
  }, [clientId]);

  function handleServiceChange(value: string) {
    setServiceId(value);
    const service = services.find((item) => item.id === value);
    if (service?.durationMinutes) {
      setDurationMinutes(String(service.durationMinutes));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const issues: Record<string, string> = {};
    if (!clientId) issues.clientId = "Cliente é obrigatório";
    if (!serviceId) issues.serviceId = "Serviço é obrigatório";
    if (!startLocal || !datetimePattern.test(startLocal)) {
      issues.startLocal = "Data e hora devem estar no formato YYYY-MM-DDTHH:mm";
    } else if (
      Number.isNaN(Date.parse(`${startLocal}:00.000Z`)) ||
      new Date(`${startLocal}:00.000Z`).toISOString().slice(0, 16) !== startLocal
    ) {
      issues.startLocal = "Data e hora inválidas";
    }
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      issues.durationMinutes = "Duração deve ser um inteiro entre 1 e 1440 minutos";
    }
    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        clientId,
        petId: petId || null,
        serviceId,
        startLocal,
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
        durationMinutes: duration,
        notes: notes.trim() || null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar o agendamento.");
      }
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
          {formError}
        </div>
      )}
      <div>
        <label htmlFor="appointment-client" className="mb-1 block text-sm text-slate-700">
          Cliente *
        </label>
        <select
          id="appointment-client"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          className={inputClass}
        >
          <option value="">Selecione...</option>
          {clients
            .filter((client) => client.status === "ACTIVE" || client.id === clientId)
            .map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
        </select>
        {fieldErrors.clientId && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.clientId}</p>
        )}
      </div>
      <div>
        <label htmlFor="appointment-pet" className="mb-1 block text-sm text-slate-700">
          Pet
        </label>
        <select
          id="appointment-pet"
          value={petId}
          onChange={(event) => setPetId(event.target.value)}
          disabled={!clientId}
          className={inputClass}
        >
          <option value="">Sem pet</option>
          {pets.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name}
            </option>
          ))}
        </select>
        {fieldErrors.petId && <p className="mt-1 text-xs text-red-600">{fieldErrors.petId}</p>}
      </div>
      <div>
        <label htmlFor="appointment-service" className="mb-1 block text-sm text-slate-700">
          Serviço *
        </label>
        <select
          id="appointment-service"
          value={serviceId}
          onChange={(event) => handleServiceChange(event.target.value)}
          className={inputClass}
        >
          <option value="">Selecione...</option>
          {services
            .filter((service) => service.status === "ACTIVE" || service.id === serviceId)
            .map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
                {service.durationMinutes ? ` (${service.durationMinutes} min)` : ""}
              </option>
            ))}
        </select>
        {fieldErrors.serviceId && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.serviceId}</p>
        )}
      </div>
      <div>
        <label htmlFor="appointment-start" className="mb-1 block text-sm text-slate-700">
          Data e hora *
        </label>
        <input
          id="appointment-start"
          type="datetime-local"
          value={startLocal}
          onChange={(event) => setStartLocal(event.target.value)}
          className={inputClass}
        />
        {fieldErrors.startLocal && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.startLocal}</p>
        )}
      </div>
      <div>
        <label htmlFor="appointment-duration" className="mb-1 block text-sm text-slate-700">
          Duração (minutos) *
        </label>
        <input
          id="appointment-duration"
          inputMode="numeric"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
          placeholder="45"
          className={inputClass}
        />
        {fieldErrors.durationMinutes && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.durationMinutes}</p>
        )}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="appointment-notes" className="mb-1 block text-sm text-slate-700">
          Observações
        </label>
        <textarea
          id="appointment-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className={inputClass}
        />
        {fieldErrors.notes && <p className="mt-1 text-xs text-red-600">{fieldErrors.notes}</p>}
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {saving ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
