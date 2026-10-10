"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import type {
  ClientDto,
  Paginated,
  SubscriptionPlanDto,
} from "../../../lib/types";

export default function NovaAssinaturaPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);

  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [registerPayment, setRegisterPayment] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.user.role === "ADMIN";

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
    void (async () => {
      try {
        const [clientData, planData] = await Promise.all([
          api<Paginated<ClientDto>>("/api/clients?status=ACTIVE&pageSize=100&direction=asc"),
          api<Paginated<SubscriptionPlanDto>>(
            "/api/subscription-plans?status=ACTIVE&pageSize=100&direction=asc",
          ),
        ]);
        setClients(clientData.items);
        setPlans(planData.items);
      } catch (err) {
        setFormError(
          err instanceof ApiError ? err.message : "Falha ao carregar dados do formulário.",
        );
      }
    })();
  }, [session]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!clientId) errors.clientId = "Selecione o cliente";
    if (!planId) errors.planId = "Selecione o plano";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = { clientId, planId, registerPayment };
      if (startAt) payload.startAt = new Date(startAt).toISOString();
      await api("/api/subscriptions", { method: "POST", body: JSON.stringify(payload) });
      router.push("/assinaturas");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível criar a assinatura.");
      }
      setSaving(false);
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-800">
          Apenas administradores podem criar assinaturas.
        </p>
        <Link href="/assinaturas" className="mt-3 inline-block text-sm text-teal-700 underline">
          Voltar para assinaturas
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Nova assinatura</h2>
          <p className="text-sm text-slate-500">{session.company.name}</p>
        </div>
        <Link
          href="/assinaturas"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </Link>
      </div>

      <form onSubmit={handleSubmit} noValidate className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4">
          <div>
            <label htmlFor="client" className="mb-1 block text-sm text-slate-700">
              Cliente *
            </label>
            <select
              id="client"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {fieldErrors.clientId && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.clientId}</p>
            )}
            {clients.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Nenhum cliente ativo cadastrado.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="plan" className="mb-1 block text-sm text-slate-700">
              Plano *
            </label>
            <select
              id="plan"
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — R$ {Number(plan.price).toFixed(2)} · {plan.durationDays} dias
                </option>
              ))}
            </select>
            {fieldErrors.planId && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.planId}</p>
            )}
            {plans.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Nenhum plano ativo. Cadastre em{" "}
                <Link href="/planos" className="underline">
                  Planos
                </Link>
                .
              </p>
            )}
          </div>

          <div>
            <label htmlFor="startAt" className="mb-1 block text-sm text-slate-700">
              Início (opcional — padrão: agora)
            </label>
            <input
              id="startAt"
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className={inputClass}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={registerPayment}
              onChange={(event) => setRegisterPayment(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              Registrar pagamento no caixa
              <span className="block text-xs text-slate-500">
                Cria uma entrada em dinheiro vinculada à assinatura. Exige caixa aberto.
              </span>
            </span>
          </label>

          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {saving ? "Criando..." : "Criar assinatura"}
          </button>
        </div>
      </form>
    </div>
  );
}
