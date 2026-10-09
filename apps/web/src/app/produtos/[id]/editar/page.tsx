"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "../../../../lib/api";
import { fetchSession, type Session } from "../../../../lib/session";
import { ProductForm } from "../../../../components/ProductForm";
import type { ProductDto } from "../../../../lib/types";

export default function EditarProdutoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      api<ProductDto>(`/api/products/${productId}`)
        .then(setProduct)
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : "Produto não encontrado.");
        })
        .finally(() => setLoading(false));
    });
  }, [router, productId]);

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (error || !product) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error ?? "Produto não encontrado."}{" "}
        <Link href="/produtos" className="underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Editar {product.name}</h2>
        <Link
          href={`/produtos/${product.id}`}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ProductForm
          initial={product}
          submitLabel="Salvar alterações"
          onSubmit={async (payload) => {
            await api(`/api/products/${product.id}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            });
            router.push(`/produtos/${product.id}`);
          }}
        />
      </div>
    </div>
  );
}
