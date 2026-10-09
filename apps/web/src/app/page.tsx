"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { fetchSession, type Session } from "../lib/session";

const plannedModules = [
  {
    name: "Produtos e estoque",
    description: "Catálogo, categorias, fornecedores e movimentações",
    href: "/produtos",
    available: true,
  },
  {
    name: "Vendas e PDV",
    description: "Frente de caixa, comprovantes e histórico de vendas",
    href: "/pdv",
    available: true,
  },
  { name: "Caixa e financeiro", description: "Movimentações e conciliação" },
  { name: "Clientes e animais", description: "Cadastro de tutores e pets" },
  { name: "Serviços e agendamentos", description: "Banho, tosa e agenda" },
  { name: "Automação WhatsApp", description: "Mensagens e atendimento automatizado" },
  { name: "Dashboard e relatórios", description: "Indicadores gerenciais" },
];

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

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

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", {
        method: "POST",
        redirectOnUnauthorized: false,
      });
    } finally {
      window.location.href = "/login";
    }
  }

  if (loading || !session) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">Carregando sessão...</p>
    );
  }

  return (
    <div>
      <section className="mb-10 rounded-lg border border-teal-200 bg-teal-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{session.company.name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Você está logado como{" "}
              <strong className="font-medium text-slate-800">{session.user.name}</strong> (
              {session.user.email}) — papel{" "}
              {session.user.role === "ADMIN" ? "administrador" : "membro"}.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/pdv"
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Abrir PDV
            </Link>
            <Link
              href="/vendas"
              className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
            >
              Vendas
            </Link>
            <Link
              href="/produtos"
              className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
            >
              Produtos e estoque
            </Link>
            {session.user.role === "ADMIN" && (
              <Link
                href="/usuarios"
                className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
              >
                Gerenciar usuários
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {loggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Módulos
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plannedModules.map((module) => {
            const card = (
              <div className="h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="font-medium text-slate-800">{module.name}</h4>
                  <span
                    className={
                      module.available
                        ? "whitespace-nowrap rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700"
                        : "whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                    }
                  >
                    {module.available ? "Disponível" : "Em breve"}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{module.description}</p>
              </div>
            );

            return module.href ? (
              <Link key={module.name} href={module.href} className="block hover:shadow-md">
                {card}
              </Link>
            ) : (
              <div key={module.name}>{card}</div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
