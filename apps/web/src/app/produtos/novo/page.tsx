"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import { ProductForm } from "../../../components/ProductForm";

export default function NovoProdutoPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      if (value.user.role !== "ADMIN") {
        router.replace("/produtos");
        return;
      }
      setSession(value);
      setLoading(false);
    });
  }, [router]);

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Novo produto</h2>
        <Link
          href="/produtos"
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

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ProductForm
          submitLabel="Criar produto"
          onSubmit={async (payload) => {
            await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
            setNotice("Produto criado.");
            router.push("/produtos");
          }}
        />
      </div>
    </div>
  );
}
