"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import type { Paginated, ServiceDto } from "../../lib/types";

const emptyForm = {
  name: "",
  description: "",
  durationMinutes: "",
  price: "",
};

export default function ServicosPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const loadServices = useCallback(async (term: string) => {
    try {
      const query = term.trim() ? `&search=${encodeURIComponent(term.trim())}` : "";
      const data = await api<Paginated<ServiceDto>>(`/api/services?pageSize=100${query}`);
      setServices(data.items);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao carregar serviços.");
    }
  }, []);

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
    if (session) void loadServices(search);
  }, [session, loadServices, search]);

  function startEdit(service: ServiceDto) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description ?? "",
      durationMinutes: service.durationMinutes ? String(service.durationMinutes) : "",
      price: service.price,
    });
    setFieldErrors({});
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (form.name.trim().length < 2) {
      setFieldErrors({ name: "Nome deve ter ao menos 2 caracteres" });
      return;
    }
    if (!form.price.trim()) {
      setFieldErrors({ price: "Preço é obrigatório" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        durationMinutes: form.durationMinutes.trim()
          ? Number(form.durationMinutes)
          : null,
        price: form.price.trim(),
      };
      if (editingId) {
        await api(`/api/services/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("Serviço atualizado.");
      } else {
        await api("/api/services", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Serviço criado.");
      }
      resetForm();
      await loadServices(search);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar o serviço.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(service: ServiceDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!window.confirm(`Deseja ${label} o serviço "${service.name}"?`)) return;
    setNotice(null);
    try {
      await api(`/api/services/${service.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Serviço ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadServices(search);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao atualizar status.");
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Serviços</h2>
          <p className="text-sm text-slate-500">
            Empresa {session.company.name} · catálogo gerenciado por administradores
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/clientes"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Clientes
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      )}
      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {listError}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {editingId ? "Editar serviço" : "Novo serviço"}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="service-name" className="mb-1 block text-sm text-slate-700">
                Nome *
              </label>
              <input
                id="service-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClass}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
              )}
            </div>
            <div>
              <label htmlFor="service-price" className="mb-1 block text-sm text-slate-700">
                Preço (R$) *
              </label>
              <input
                id="service-price"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                placeholder="45.50"
                className={inputClass}
              />
              {fieldErrors.price && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.price}</p>
              )}
            </div>
            <div>
              <label htmlFor="service-duration" className="mb-1 block text-sm text-slate-700">
                Duração (minutos)
              </label>
              <input
                id="service-duration"
                type="number"
                min={1}
                max={1440}
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm({ ...form, durationMinutes: event.target.value })
                }
                placeholder="45"
                className={inputClass}
              />
              {fieldErrors.durationMinutes && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.durationMinutes}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="service-description" className="mb-1 block text-sm text-slate-700">
                Descrição
              </label>
              <textarea
                id="service-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={2}
                className={inputClass}
              />
            </div>
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
                {formError}
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label htmlFor="service-search" className="text-sm text-slate-600">
          Buscar
        </label>
        <input
          id="service-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nome ou descrição do serviço"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3">Duração</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{service.name}</p>
                  {service.description && (
                    <p className="text-xs text-slate-500">{service.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {service.durationMinutes ? `${service.durationMinutes} min` : "—"}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  R$ {Number(service.price).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      service.status === "ACTIVE"
                        ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                    }
                  >
                    {service.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => startEdit(service)}
                        className="text-teal-700 hover:underline"
                      >
                        Editar
                      </button>
                      {service.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => void handleStatus(service, "INACTIVE")}
                          className="text-red-600 hover:underline"
                        >
                          Inativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleStatus(service, "ACTIVE")}
                          className="text-teal-700 hover:underline"
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Nenhum serviço cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
