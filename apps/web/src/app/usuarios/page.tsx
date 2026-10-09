"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";

interface UserDto {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export default function UsuariosPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api<UserDto[]>("/api/users");
      setUsers(data);
      setListError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setListError("Acesso restrito a administradores.");
      } else if (err instanceof ApiError) {
        setListError(err.message);
      } else {
        setListError("Não foi possível carregar os usuários.");
      }
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
      if (value.user.role === "ADMIN") {
        void loadUsers();
      }
    });
  }, [router, loadUsers]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setNotice(null);

    const issues: Record<string, string> = {};
    if (name.trim().length < 2) issues.name = "Nome deve ter ao menos 2 caracteres";
    if (!email.trim()) issues.email = "Informe o email";
    if (password.length < 8) issues.password = "Senha deve ter ao menos 8 caracteres";
    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      return;
    }

    setSaving(true);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });
      setNotice(`Usuário ${email.trim()} criado.`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("MEMBER");
      await loadUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível criar o usuário.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(user: UserDto, status: "ACTIVE" | "INACTIVE") {
    setNotice(null);
    setListError(null);
    try {
      await api(`/api/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(
        status === "INACTIVE"
          ? `Usuário ${user.email} inativado.`
          : `Usuário ${user.email} reativado.`,
      );
      await loadUsers();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao atualizar o usuário.");
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-2 font-semibold text-amber-900">Acesso restrito</h2>
        <p className="text-sm text-amber-800">
          Apenas administradores podem gerenciar usuários.{" "}
          <Link href="/" className="underline">
            Voltar ao início
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Usuários</h2>
          <p className="text-sm text-slate-500">
            Usuários da empresa {session.company.name}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </Link>
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

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Novo usuário
        </h3>
        {formError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleCreate} noValidate className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="user-name" className="mb-1 block text-sm text-slate-700">
              Nome
            </label>
            <input
              id="user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="user-email" className="mb-1 block text-sm text-slate-700">
              Email
            </label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>
          <div>
            <label htmlFor="user-password" className="mb-1 block text-sm text-slate-700">
              Senha provisória (mín. 8)
            </label>
            <input
              id="user-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            )}
          </div>
          <div>
            <label htmlFor="user-role" className="mb-1 block text-sm text-slate-700">
              Papel
            </label>
            <select
              id="user-role"
              value={role}
              onChange={(event) => setRole(event.target.value as "ADMIN" | "MEMBER")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            >
              <option value="MEMBER">Membro</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {saving ? "Criando..." : "Criar usuário"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Lista de usuários
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Papel</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-800">{user.name}</td>
                  <td className="py-2 pr-4 text-slate-600">{user.email}</td>
                  <td className="py-2 pr-4">{user.role === "ADMIN" ? "Admin" : "Membro"}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        user.status === "ACTIVE"
                          ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                      }
                    >
                      {user.status === "ACTIVE" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-2">
                    {user.id !== session.user.id &&
                      (user.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(user, "INACTIVE")}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Inativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(user, "ACTIVE")}
                          className="text-xs font-medium text-teal-700 hover:underline"
                        >
                          Reativar
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
