"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import {
  productUnitLabels,
  stockMovementTypeLabels,
  type MovementDto,
  type Paginated,
  type ProductDto,
} from "../../../lib/types";

const movementPageSize = 10;

export default function ProdutoDetalhePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [movements, setMovements] = useState<MovementDto[]>([]);
  const [movementTotal, setMovementTotal] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [entryQty, setEntryQty] = useState("");
  const [entryReference, setEntryReference] = useState("");
  const [exitQty, setExitQty] = useState("");
  const [exitNotes, setExitNotes] = useState("");
  const [adjustType, setAdjustType] = useState<"ADJUST_POSITIVE" | "ADJUST_NEGATIVE">(
    "ADJUST_POSITIVE",
  );
  const [adjustQty, setAdjustQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const loadProduct = useCallback(async () => {
    try {
      const data = await api<ProductDto>(`/api/products/${productId}`);
      setProduct(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Produto não encontrado.");
    }
  }, [productId]);

  const loadMovements = useCallback(async () => {
    try {
      const data = await api<Paginated<MovementDto>>(
        `/api/stock/movements?productId=${productId}&page=${movementPage}&pageSize=${movementPageSize}`,
      );
      setMovements(data.items);
      setMovementTotal(data.total);
    } catch {
      setError("Não foi possível carregar o histórico.");
    }
  }, [productId, movementPage]);

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
    if (session) {
      void loadProduct();
      void loadMovements();
    }
  }, [session, loadProduct, loadMovements]);

  async function submitMovement(
    path: string,
    payload: Record<string, unknown>,
    label: string,
    clear: () => void,
  ) {
    setFormError(null);
    setSaving(true);
    try {
      await api(path, { method: "POST", body: JSON.stringify(payload) });
      setNotice(`${label} registrada com sucesso.`);
      clear();
      await Promise.all([loadProduct(), loadMovements()]);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : `Falha ao registrar ${label}.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjust(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (reason.trim().length < 3) {
      setFormError("Informe a justificativa do ajuste (mín. 3 caracteres).");
      return;
    }
    if (!adjustQty || Number(adjustQty) <= 0) {
      setFormError("Informe uma quantidade maior que zero.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/stock/adjustments", {
        method: "POST",
        body: JSON.stringify({
          productId,
          type: adjustType,
          quantity: adjustQty,
          reason: reason.trim(),
        }),
      });
      setNotice("Ajuste registrado com sucesso.");
      setAdjustQty("");
      setReason("");
      await Promise.all([loadProduct(), loadMovements()]);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Falha ao registrar ajuste.");
    } finally {
      setSaving(false);
    }
  }

  async function handleInactive() {
    if (!product) return;
    if (!window.confirm(`Inativar o produto "${product.name}"?`)) return;
    try {
      await api(`/api/products/${product.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      });
      setNotice("Produto inativado.");
      await loadProduct();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao inativar.");
    }
  }

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

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";
  const movementPages = Math.max(1, Math.ceil(movementTotal / movementPageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">{product.name}</h2>
            {product.lowStock && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Estoque baixo
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {product.sku ? `SKU ${product.sku}` : "Sem SKU"} · {product.category?.name ?? "Sem categoria"} ·{" "}
            {product.supplier?.name ?? "Sem fornecedor"}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && product.status === "ACTIVE" && (
            <>
              <Link
                href={`/produtos/${product.id}/editar`}
                className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
              >
                Editar
              </Link>
              <button
                type="button"
                onClick={() => void handleInactive()}
                className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Inativar
              </button>
            </>
          )}
          <Link
            href="/produtos"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Voltar
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      )}
      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Saldo atual</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {Number(product.stockQuantity)}{" "}
            <span className="text-sm font-normal text-slate-500">
              {productUnitLabels[product.unit]}
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Estoque mínimo</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {Number(product.minimumStock)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Preço de venda</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            R$ {Number(product.salePrice).toFixed(2)}
          </p>
        </div>
      </div>

      {product.status === "ACTIVE" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Entrada
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="entry-qty" className="mb-1 block text-sm text-slate-700">
                  Quantidade
                </label>
                <input
                  id="entry-qty"
                  inputMode="decimal"
                  value={entryQty}
                  onChange={(event) => setEntryQty(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="entry-ref" className="mb-1 block text-sm text-slate-700">
                  Referência (opcional)
                </label>
                <input
                  id="entry-ref"
                  value={entryReference}
                  onChange={(event) => setEntryReference(event.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (!entryQty || Number(entryQty) <= 0) {
                    setFormError("Informe uma quantidade maior que zero.");
                    return;
                  }
                  void submitMovement(
                    "/api/stock/entries",
                    { productId, quantity: entryQty, reference: entryReference || null },
                    "entrada",
                    () => {
                      setEntryQty("");
                      setEntryReference("");
                    },
                  );
                }}
                className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                Registrar entrada
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Saída
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="exit-qty" className="mb-1 block text-sm text-slate-700">
                  Quantidade
                </label>
                <input
                  id="exit-qty"
                  inputMode="decimal"
                  value={exitQty}
                  onChange={(event) => setExitQty(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="exit-notes" className="mb-1 block text-sm text-slate-700">
                  Observação (opcional)
                </label>
                <input
                  id="exit-notes"
                  value={exitNotes}
                  onChange={(event) => setExitNotes(event.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (!exitQty || Number(exitQty) <= 0) {
                    setFormError("Informe uma quantidade maior que zero.");
                    return;
                  }
                  void submitMovement(
                    "/api/stock/exits",
                    { productId, quantity: exitQty, notes: exitNotes || null },
                    "saída",
                    () => {
                      setExitQty("");
                      setExitNotes("");
                    },
                  );
                }}
                className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
              >
                Registrar saída
              </button>
            </div>
          </div>

          {isAdmin && (
            <form onSubmit={handleAdjust} className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-800">
                Ajuste de inventário
              </h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="adjust-type" className="mb-1 block text-sm text-amber-900">
                    Tipo
                  </label>
                  <select
                    id="adjust-type"
                    value={adjustType}
                    onChange={(event) =>
                      setAdjustType(event.target.value as "ADJUST_POSITIVE" | "ADJUST_NEGATIVE")
                    }
                    className={inputClass}
                  >
                    <option value="ADJUST_POSITIVE">Ajuste positivo (+)</option>
                    <option value="ADJUST_NEGATIVE">Ajuste negativo (-)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="adjust-qty" className="mb-1 block text-sm text-amber-900">
                    Quantidade
                  </label>
                  <input
                    id="adjust-qty"
                    inputMode="decimal"
                    value={adjustQty}
                    onChange={(event) => setAdjustQty(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="adjust-reason" className="mb-1 block text-sm text-amber-900">
                    Justificativa *
                  </label>
                  <input
                    id="adjust-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  Registrar ajuste
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Histórico de movimentações
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Quantidade</th>
                <th className="py-2 pr-4">Motivo / referência</th>
                <th className="py-2">Usuário</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-600">
                    {new Date(movement.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        movement.type === "IN" || movement.type === "ADJUST_POSITIVE"
                          ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                          : "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                      }
                    >
                      {stockMovementTypeLabels[movement.type]}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-800">{Number(movement.quantity)}</td>
                  <td className="py-2 pr-4 text-slate-600">
                    {movement.notes ?? movement.reference ?? "—"}
                  </td>
                  <td className="py-2 text-slate-600">{movement.createdBy.name}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    Nenhuma movimentação registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {movementPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              Página {movementPage} de {movementPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={movementPage <= 1}
                onClick={() => setMovementPage((value) => Math.max(1, value - 1))}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={movementPage >= movementPages}
                onClick={() => setMovementPage((value) => value + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
