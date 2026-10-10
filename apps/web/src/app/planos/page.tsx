"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import type { Paginated, SubscriptionPlanDto } from "../../lib/types";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  durationDays: "30",
};

export default function PlanosPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const loadPlans = useCallback(async (term: string) => {
    try {
      const query = term.trim() ? `&search=${encodeURIComponent(term.trim())}` : "";
      const data = await api<Paginated<SubscriptionPlanDto>>(
        `/api/subscription-plans?pageSize=100${query}`,
      );
      setPlans(data.items);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao carregar planos.");
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
    if (session) void loadPlans(search);
  }, [session, loadPlans, search]);

  function startEdit(plan: SubscriptionPlanDto) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      description: plan.description ?? "",
      price: plan.price,
      durationDays: String(plan.durationDays),
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
        price: form.price.trim(),
        durationDays: Number(form.durationDays),
      };
      if (editingId) {
        await api(`/api/subscription-plans/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("Plano atualizado.");
      } else {
        await api("/api/subscription-plans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Plano criado.");
      }
      resetForm();
      await loadPlans(search);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar o plano.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(plan: SubscriptionPlanDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!window.confirm(`Deseja ${label} o plano "${plan.name}"?`)) return;
    setNotice(null);
    try {
      await api(`/api/subscription-plans/${plan.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Plano ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadPlans(search);
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
          <h2 className="text-xl font-semibold text-slate-900">Planos de assinatura</h2>
          <p className="text-sm text-slate-500">
            Pacotes recorrentes para clientes · {session.company.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/assinaturas"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Assinaturas
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
            {editingId ? "Editar plano" : "Novo plano"}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="plan-name" className="mb-1 block text-sm text-slate-700">
                Nome *
              </label>
              <input
                id="plan-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClass}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
              )}
            </div>
            <div>
              <label htmlFor="plan-price" className="mb-1 block text-sm text-slate-700">
                Preço (R$) *
              </label>
              <input
                id="plan-price"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                placeholder="89.90"
                className={inputClass}
              />
              {fieldErrors.price && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.price}</p>
              )}
            </div>
            <div>
              <label htmlFor="plan-duration" className="mb-1 block text-sm text-slate-700">
                Duração (dias) *
              </label>
              <input
                id="plan-duration"
                type="number"
                min={1}
                max={3650}
                value={form.durationDays}
                onChange={(event) => setForm({ ...form, durationDays: event.target.value })}
                className={inputClass}
              />
              {fieldErrors.durationDays && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.durationDays}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="plan-description" className="mb-1 block text-sm text-slate-700">
                Descrição
              </label>
              <textarea
                id="plan-description"
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
        <label htmlFor="plan-search" className="text-sm text-slate-600">
          Buscar
        </label>
        <input
          id="plan-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nome ou descrição do plano"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Duração</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{plan.name}</p>
                  {plan.description && (
                    <p className="text-xs text-slate-500">{plan.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{plan.durationDays} dias</td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  R$ {Number(plan.price).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      plan.status === "ACTIVE"
                        ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                    }
                  >
                    {plan.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => startEdit(plan)}
                        className="text-teal-700 hover:underline"
                      >
                        Editar
                      </button>
                      {plan.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => void handleStatus(plan, "INACTIVE")}
                          className="text-red-600 hover:underline"
                        >
                          Inativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleStatus(plan, "ACTIVE")}
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
            {plans.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Nenhum plano cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
