"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";

export default function RedefinirSenhaPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const issues: Record<string, string> = {};
    if (!email.trim()) issues.email = "Informe o email do seu usuário";
    if (password.length < 8) issues.password = "Senha deve ter ao menos 8 caracteres";
    else if (password.length > 72) issues.password = "Senha deve ter no máximo 72 caracteres";
    if (confirm !== password) issues.confirm = "As senhas não coincidem";
    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setError(err.message);
      } else {
        setError("Não foi possível conectar ao servidor");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold text-slate-900">
          Definir nova senha
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          Informe o email do seu usuário e a senha que você quer usar. Em
          seguida, entre normalmente no sistema.
        </p>

        {done ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800"
            >
              Senha redefinida com sucesso. Suas sessões anteriores foram
              encerradas.
            </div>
            <Link
              href="/login"
              className="block w-full rounded-md bg-teal-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-teal-800"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
                Email do usuário
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email && (
                <p className="mb-3 text-xs text-red-600">{fieldErrors.email}</p>
              )}
              {!fieldErrors.email && <div className="mb-3" />}

              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                aria-invalid={Boolean(fieldErrors.password)}
              />
              {fieldErrors.password && (
                <p className="mb-3 text-xs text-red-600">{fieldErrors.password}</p>
              )}
              {!fieldErrors.password && <div className="mb-3" />}

              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="confirm">
                Confirmar nova senha
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                aria-invalid={Boolean(fieldErrors.confirm)}
              />
              {fieldErrors.confirm && (
                <p className="mb-3 text-xs text-red-600">{fieldErrors.confirm}</p>
              )}
              {!fieldErrors.confirm && <div className="mb-5" />}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Salvando..." : "Redefinir senha"}
              </button>
            </form>
          </>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/login" className="text-teal-700 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
