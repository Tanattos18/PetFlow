"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { templateVariableCount } from "@petflow/shared";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import {
  whatsappTemplateApprovalLabels,
  whatsappTemplateCategoryLabels,
  type Paginated,
  type WhatsAppTemplateApproval,
  type WhatsAppTemplateCategory,
  type WhatsAppTemplateDto,
} from "../../../lib/types";

const emptyForm = {
  name: "",
  language: "pt_BR",
  category: "UTILITY" as WhatsAppTemplateCategory,
  body: "",
};

const approvalBadgeClass: Record<WhatsAppTemplateApproval, string> = {
  PENDING_APPROVAL: "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700",
  APPROVED: "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700",
  REJECTED: "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700",
};

export default function WhatsAppTemplatesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<WhatsAppTemplateDto[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const loadTemplates = useCallback(async () => {
    try {
      const data = await api<Paginated<WhatsAppTemplateDto>>(
        "/api/whatsapp/templates?pageSize=100",
      );
      setTemplates(data.items);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao carregar templates.");
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
    if (session) void loadTemplates();
  }, [session, loadTemplates]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    setSaving(true);
    try {
      await api("/api/whatsapp/templates", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          language: form.language.trim(),
          category: form.category,
          body: form.body.trim(),
        }),
      });
      setNotice("Template criado — aguardando aprovação do provedor.");
      setForm(emptyForm);
      await loadTemplates();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível criar o template.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleApproval(
    template: WhatsAppTemplateDto,
    approval: WhatsAppTemplateApproval,
  ) {
    const label = approval === "APPROVED" ? "aprovar" : "reprovar";
    if (!window.confirm(`Deseja ${label} o template "${template.name}"?`)) return;
    setNotice(null);
    setListError(null);
    try {
      await api(`/api/whatsapp/templates/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify({ approval }),
      });
      setNotice(`Template ${approval === "APPROVED" ? "aprovado" : "reprovado"} (registro local).`);
      await loadTemplates();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao atualizar aprovação.");
    }
  }

  async function handleStatus(template: WhatsAppTemplateDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!window.confirm(`Deseja ${label} o template "${template.name}"?`)) return;
    setNotice(null);
    setListError(null);
    try {
      await api(`/api/whatsapp/templates/${template.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Template ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadTemplates();
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
          <h2 className="text-xl font-semibold text-slate-900">Templates de mensagem</h2>
          <p className="text-sm text-slate-500">
            Modelos aprovados pelo WhatsApp — necessários para enviar mensagens fora da janela de
            24h
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/whatsapp"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Integração
          </Link>
          <Link
            href="/whatsapp/mensagens"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Mensagens
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
            Novo template
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tpl-name" className="mb-1 block text-sm text-slate-700">
                Nome * (minúsculas, números e _)
              </label>
              <input
                id="tpl-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="lembrete_pet"
                className={inputClass}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="tpl-language" className="mb-1 block text-sm text-slate-700">
                  Idioma *
                </label>
                <input
                  id="tpl-language"
                  value={form.language}
                  onChange={(event) => setForm({ ...form, language: event.target.value })}
                  placeholder="pt_BR"
                  className={inputClass}
                />
                {fieldErrors.language && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.language}</p>
                )}
              </div>
              <div>
                <label htmlFor="tpl-category" className="mb-1 block text-sm text-slate-700">
                  Categoria
                </label>
                <select
                  id="tpl-category"
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value as WhatsAppTemplateCategory })
                  }
                  className={inputClass}
                >
                  {(Object.keys(whatsappTemplateCategoryLabels) as WhatsAppTemplateCategory[]).map(
                    (category) => (
                      <option key={category} value={category}>
                        {whatsappTemplateCategoryLabels[category]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="tpl-body" className="mb-1 block text-sm text-slate-700">
                Corpo * (variáveis {"{{1}}"}, {"{{2}}"}... em sequência)
              </label>
              <textarea
                id="tpl-body"
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                rows={3}
                placeholder="Olá {{1}}, seu pet {{2}} aguarda pelo próximo banho."
                className={inputClass}
              />
              {fieldErrors.body && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.body}</p>
              )}
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
                {saving ? "Criando..." : "Criar template"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium text-slate-800">{template.name}</h4>
                <span className="text-xs text-slate-500">
                  {template.language} · {whatsappTemplateCategoryLabels[template.category]}
                </span>
                <span className={approvalBadgeClass[template.approval]}>
                  {whatsappTemplateApprovalLabels[template.approval]}
                </span>
                <span
                  className={
                    template.status === "ACTIVE"
                      ? "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400 line-through"
                  }
                >
                  {template.status === "ACTIVE" ? "Ativo" : "Inativo"}
                </span>
              </div>
              {isAdmin && (
                <div className="flex gap-3 text-xs font-medium">
                  {template.approval !== "APPROVED" && (
                    <button
                      type="button"
                      onClick={() => void handleApproval(template, "APPROVED")}
                      className="text-teal-700 hover:underline"
                    >
                      Marcar aprovado
                    </button>
                  )}
                  {template.approval === "APPROVED" && (
                    <button
                      type="button"
                      onClick={() => void handleApproval(template, "REJECTED")}
                      className="text-red-600 hover:underline"
                    >
                      Marcar reprovado
                    </button>
                  )}
                  {template.status === "ACTIVE" ? (
                    <button
                      type="button"
                      onClick={() => void handleStatus(template, "INACTIVE")}
                      className="text-red-600 hover:underline"
                    >
                      Inativar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleStatus(template, "ACTIVE")}
                      className="text-teal-700 hover:underline"
                    >
                      Reativar
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {template.body}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Variáveis: {templateVariableCount(template.body)} · criado em{" "}
              {new Date(template.createdAt).toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
            Nenhum template cadastrado.
          </p>
        )}
      </div>
    </div>
  );
}
