"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { printReceipt } from "../../../lib/print";
import { fetchSession, type Session } from "../../../lib/session";
import {
  paymentMethodLabels,
  productUnitLabels,
  saleStatusLabels,
  type SaleDto,
} from "../../../lib/types";
import { Receipt } from "../../../components/Receipt";

export default function VendaDetalhePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const saleId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<SaleDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [printNotice, setPrintNotice] = useState<string | null>(null);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const loadSale = useCallback(async () => {
    try {
      const data = await api<SaleDto>(`/api/sales/${saleId}`);
      setSale(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Venda não encontrada.");
    }
  }, [saleId]);

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
      void loadSale();
    }
  }, [session, loadSale]);

  function handlePrint() {
    if (!sale) return;
    const ok = printReceipt(sale, session?.company.name ?? "PetFlow");
    if (!ok) {
      setPrintNotice("Não foi possível abrir a janela de impressão. Permita pop-ups para este site.");
    } else {
      setPrintNotice(null);
    }
  }

  async function handleCancel(event: FormEvent) {
    event.preventDefault();
    setCancelError(null);
    if (cancelReason.trim().length < 3) {
      setCancelError("Informe o motivo do cancelamento (mín. 3 caracteres).");
      return;
    }
    setCancelling(true);
    try {
      const updated = await api<SaleDto>(`/api/sales/${saleId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      setSale(updated);
      setShowCancel(false);
      setCancelReason("");
      setNotice("Venda cancelada. O estoque foi devolvido automaticamente.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCancelError(err.message);
        await loadSale();
      } else {
        setCancelError(err instanceof ApiError ? err.message : "Falha ao cancelar.");
      }
    } finally {
      setCancelling(false);
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (error || !sale) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error ?? "Venda não encontrada."}{" "}
        <Link href="/vendas" className="underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Venda {sale.receiptCode}</h2>
            <span
              className={
                sale.status === "COMPLETED"
                  ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700"
                  : "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
              }
            >
              {saleStatusLabels[sale.status]}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {new Date(sale.createdAt).toLocaleString("pt-BR")} · {sale.createdBy.name} ·{" "}
            {paymentMethodLabels[sale.paymentMethod]}
            {sale.client ? ` · Cliente: ${sale.client.name}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
          >
            Imprimir comprovante
          </button>
          {isAdmin && sale.status === "COMPLETED" && !showCancel && (
            <button
              type="button"
              onClick={() => {
                setShowCancel(true);
                setCancelError(null);
              }}
              className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Cancelar venda
            </button>
          )}
          <Link
            href="/vendas"
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
      {printNotice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {printNotice}
        </div>
      )}

      {showCancel && (
        <form
          onSubmit={handleCancel}
          className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <div>
            <h3 className="text-sm font-semibold text-red-800">Confirmar cancelamento</h3>
            <p className="text-xs text-red-700">
              A venda será mantida no histórico com status cancelado e o estoque dos itens será
              devolvido automaticamente. Esta ação não pode ser desfeita.
            </p>
          </div>
          <div>
            <label htmlFor="cancel-reason" className="mb-1 block text-sm text-red-900">
              Motivo do cancelamento *
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
              placeholder="Ex.: cliente desistiu da compra"
            />
          </div>
          {cancelError && (
            <div className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-700">
              {cancelError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={cancelling}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCancel(false);
                setCancelReason("");
                setCancelError(null);
              }}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Voltar
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Itens da venda
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 text-left">Produto</th>
                <th className="py-2 text-right">Qtd</th>
                <th className="py-2 text-right">Unitário</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-800">
                    {item.productName}
                    {item.productSku && (
                      <span className="ml-1 text-xs text-slate-400">({item.productSku})</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-slate-600">
                    {Number(item.quantity)} {productUnitLabels[item.unit]}
                  </td>
                  <td className="py-2 text-right text-slate-600">
                    R$ {Number(item.unitPrice).toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-medium text-slate-900">
                    R$ {Number(item.subtotal).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>R$ {Number(sale.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Desconto</span>
              <span>- R$ {Number(sale.discount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-slate-900">
              <span>Total</span>
              <span>R$ {Number(sale.total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Pagamento</span>
              <span>
                {paymentMethodLabels[sale.paymentMethod]}
                {sale.paymentNote ? ` (${sale.paymentNote})` : ""}
              </span>
            </div>
          </div>

          {sale.status === "CANCELLED" && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">Venda cancelada</p>
              <p>Motivo: {sale.cancelReason}</p>
              <p>
                Por {sale.cancelledBy?.name ?? "—"} em{" "}
                {sale.cancelledAt ? new Date(sale.cancelledAt).toLocaleString("pt-BR") : "—"}
              </p>
            </div>
          )}
        </div>

        <div>
          <Receipt sale={sale} companyName={session.company.name} />
        </div>
      </div>
    </div>
  );
}
