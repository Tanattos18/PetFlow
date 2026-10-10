"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { templateVariableCount } from "@petflow/shared";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import {
  whatsappConfigStatusLabels,
  type Paginated,
  type WhatsAppConfigDto,
  type WhatsAppHealthResult,
  type WhatsAppTemplateDto,
} from "../../lib/types";

const emptyForm = {
  phoneNumberId: "",
  wabaId: "",
  displayName: "",
  reminderTemplateId: "",
  reminderLeadMinutes: "1440",
};

const statusBadgeClass: Record<string, string> = {
  ACTIVE: "rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700",
  CONFIGURED: "rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700",
  NOT_CONFIGURED: "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500",
  ERROR: "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700",
  DISCONNECTED: "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700",
};

export default function WhatsAppConfigPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<WhatsAppConfigDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [health, setHealth] = useState<WhatsAppHealthResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [reminderTemplates, setReminderTemplates] = useState<WhatsAppTemplateDto[]>([]);

  const isAdmin = session?.user.role === "ADMIN";

  const loadConfig = useCallback(async () => {
    try {
      const data = await api<WhatsAppConfigDto>("/api/whatsapp/config");
      setConfig(data);
      setForm({
        phoneNumberId: data.phoneNumberId ?? "",
        wabaId: data.wabaId ?? "",
        displayName: data.displayName ?? "",
        reminderTemplateId: data.reminderTemplateId ?? "",
        reminderLeadMinutes: String(data.reminderLeadMinutes),
      });
      setPageError(null);
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : "Falha ao carregar a configuração.");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    api<Paginated<WhatsAppTemplateDto>>(
      "/api/whatsapp/templates?pageSize=100&status=ACTIVE&approval=APPROVED",
    )
      .then((page) =>
        setReminderTemplates(
          page.items.filter((template) => templateVariableCount(template.body) === 3),
        ),
      )
      .catch(() => setReminderTemplates([]));
  }, [session]);

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
    if (session) void loadConfig();
  }, [session, loadConfig]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await api("/api/whatsapp/config", {
        method: "PUT",
        body: JSON.stringify({
          phoneNumberId: form.phoneNumberId.trim() || null,
          wabaId: form.wabaId.trim() || null,
          displayName: form.displayName.trim() || null,
          reminderTemplateId: form.reminderTemplateId.trim() || null,
          reminderLeadMinutes: Number(form.reminderLeadMinutes),
        }),
      });
      setNotice("Configuração salva.");
      await loadConfig();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleHealth() {
    setChecking(true);
    setNotice(null);
    setPageError(null);
    try {
      const result = await api<WhatsAppHealthResult>("/api/whatsapp/config/health", {
        method: "POST",
      });
      setHealth(result);
      await loadConfig();
    } catch (err) {
      setHealth(null);
      setPageError(err instanceof ApiError ? err.message : "Falha no teste de conexão.");
    } finally {
      setChecking(false);
    }
  }

  async function handleStatus(status: "CONFIGURED" | "DISCONNECTED") {
    const label = status === "DISCONNECTED" ? "desconectar" : "reconectar";
    if (!window.confirm(`Deseja ${label} a integração do WhatsApp?`)) return;
    setNotice(null);
    setPageError(null);
    try {
      await api("/api/whatsapp/config/status", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(status === "DISCONNECTED" ? "Integração desconectada." : "Integração reconectada.");
      await loadConfig();
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : "Falha ao alterar o status.");
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
          <h2 className="text-xl font-semibold text-slate-900">Integração com WhatsApp</h2>
          <p className="text-sm text-slate-500">
            WhatsApp Business Cloud API (Meta) · credenciais mantidas apenas no servidor
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/whatsapp/mensagens"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Mensagens
          </Link>
          <Link
            href="/whatsapp/templates"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Templates
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
      {pageError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {config && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Status da integração
            </h3>
            <span className={statusBadgeClass[config.status] ?? statusBadgeClass.NOT_CONFIGURED}>
              {whatsappConfigStatusLabels[config.status]}
            </span>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs uppercase text-slate-400">Provedor</dt>
              <dd className="text-slate-700">
                {config.provider.provider === "meta" ? "Meta Cloud API" : "Mock (dev/teste)"}
                {config.provider.credentialsConfigured
                  ? " · credenciais configuradas"
                  : " · sem credenciais no servidor"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Phone Number ID</dt>
              <dd className="text-slate-700">{config.phoneNumberId || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Nome exibido</dt>
              <dd className="text-slate-700">{config.displayName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">WABA ID</dt>
              <dd className="text-slate-700">{config.wabaId || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Último teste</dt>
              <dd className="text-slate-700">
                {config.lastHealthAt
                  ? new Date(config.lastHealthAt).toLocaleString("pt-BR")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Webhook</dt>
              <dd className="break-all text-slate-700">
                {config.webhook.path}
                <span className="mt-1 block text-xs text-slate-500">
                  Verificação {config.webhook.verifyConfigured ? "✓" : "✗"} · assinatura{" "}
                  {config.webhook.signatureConfigured ? "✓" : "✗"}
                </span>
              </dd>
            </div>
            {config.lastError && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs uppercase text-red-400">Último erro</dt>
                <dd className="text-red-700">{config.lastError}</dd>
              </div>
            )}
          </dl>

          {isAdmin && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => void handleHealth()}
                disabled={checking}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {checking ? "Testando..." : "Testar conexão"}
              </button>
              {config.status === "DISCONNECTED" ? (
                <button
                  type="button"
                  onClick={() => void handleStatus("CONFIGURED")}
                  className="rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
                >
                  Reconectar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleStatus("DISCONNECTED")}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Desconectar
                </button>
              )}
            </div>
          )}

          {health && (
            <div
              className={
                health.ok
                  ? "mt-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800"
                  : "mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              }
            >
              {health.ok
                ? `Conexão OK — ${health.verifiedName ?? config.displayName ?? "número verificado"}${
                    health.displayPhoneNumber ? ` · ${health.displayPhoneNumber}` : ""
                  }`
                : health.message || "Falha ao contatar o provedor."}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Configuração do número
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wa-phone-id" className="mb-1 block text-sm text-slate-700">
                Phone Number ID *
              </label>
              <input
                id="wa-phone-id"
                value={form.phoneNumberId}
                onChange={(event) => setForm({ ...form, phoneNumberId: event.target.value })}
                placeholder="123456789012345"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="wa-waba-id" className="mb-1 block text-sm text-slate-700">
                WABA ID
              </label>
              <input
                id="wa-waba-id"
                value={form.wabaId}
                onChange={(event) => setForm({ ...form, wabaId: event.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="wa-display-name" className="mb-1 block text-sm text-slate-700">
                Nome exibido
              </label>
              <input
                id="wa-display-name"
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Lembrete de agendamentos (Etapa 8)
              </p>
            </div>
            <div>
              <label htmlFor="wa-reminder-template" className="mb-1 block text-sm text-slate-700">
                Template de lembrete
              </label>
              <select
                id="wa-reminder-template"
                value={form.reminderTemplateId}
                onChange={(event) =>
                  setForm({ ...form, reminderTemplateId: event.target.value })
                }
                className={inputClass}
              >
                <option value="">Nenhum (lembretes desativados)</option>
                {reminderTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Somente templates aprovados com exatamente 3 variáveis: {"{{1}}"} tutor/pet,{" "}
                {"{{2}}"} serviço e {"{{3}}"} data/hora.
              </p>
            </div>
            <div>
              <label htmlFor="wa-reminder-lead" className="mb-1 block text-sm text-slate-700">
                Antecedência do lembrete (minutos)
              </label>
              <input
                id="wa-reminder-lead"
                inputMode="numeric"
                value={form.reminderLeadMinutes}
                onChange={(event) =>
                  setForm({ ...form, reminderLeadMinutes: event.target.value })
                }
                placeholder="1440"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-500">
                Entre 5 e 40320 minutos (1440 = 1 dia antes).
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:col-span-2">
              O access token e o app secret ficam apenas nas variáveis de ambiente do servidor
              (WHATSAPP_ACCESS_TOKEN / WHATSAPP_APP_SECRET) — nunca são enviados ao navegador.
            </div>
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
                {formError}
              </div>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar configuração"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Como funciona o envio
        </h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>
            Mensagens saem apenas como <strong>templates aprovados</strong> pelo WhatsApp — texto
            livre só em resposta dentro da janela de 24 horas após a última mensagem do cliente.
          </li>
          <li>
            Antes de enviar, o servidor exige consentimento (opt-in) do cliente; descadastros
            bloqueiam novos envios imediatamente.
          </li>
          <li>
            O envio é enfileirado e processado pelo worker com retentativas limitadas; status de
            entrega (entregue/lida) só muda quando o webhook da Meta confirma.
          </li>
          <li>
            O cliente pode responder <strong>SAIR</strong> a qualquer momento para se descadastrar.
          </li>
        </ul>
      </div>
    </div>
  );
}
