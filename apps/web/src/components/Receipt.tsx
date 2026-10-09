"use client";

import {
  paymentMethodLabels,
  productUnitLabels,
  saleStatusLabels,
  type SaleDto,
} from "../lib/types";

export function Receipt({
  sale,
  companyName,
}: {
  sale: SaleDto;
  companyName?: string;
}) {
  return (
    <div className="mx-auto max-w-sm rounded-lg border border-slate-200 bg-white p-6 font-mono text-sm text-slate-800 shadow-sm">
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-900">{companyName ?? "PetFlow"}</p>
        <p className="text-xs text-slate-500">Comprovante de venda</p>
      </div>

      <div className="mt-3 space-y-1 border-t border-dashed border-slate-300 pt-3 text-xs">
        <div className="flex justify-between">
          <span>Código</span>
          <span className="font-semibold">{sale.receiptCode}</span>
        </div>
        <div className="flex justify-between">
          <span>Data</span>
          <span>{new Date(sale.createdAt).toLocaleString("pt-BR")}</span>
        </div>
        <div className="flex justify-between">
          <span>Vendedor</span>
          <span>{sale.createdBy.name}</span>
        </div>
        <div className="flex justify-between">
          <span>Status</span>
          <span>{saleStatusLabels[sale.status]}</span>
        </div>
      </div>

      <div className="mt-3 border-t border-dashed border-slate-300 pt-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-1">Item</th>
              <th className="pb-1 text-right">Qtd</th>
              <th className="pb-1 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td className="py-1 pr-2">{item.productName}</td>
                <td className="whitespace-nowrap py-1 text-right">
                  {Number(item.quantity)} {productUnitLabels[item.unit]}
                </td>
                <td className="py-1 text-right">R$ {Number(item.subtotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-1 border-t border-dashed border-slate-300 pt-3 text-xs">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>R$ {Number(sale.subtotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Desconto</span>
          <span>- R$ {Number(sale.discount).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-slate-900">
          <span>Total</span>
          <span>R$ {Number(sale.total).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Pagamento</span>
          <span>{paymentMethodLabels[sale.paymentMethod]}</span>
        </div>
        {sale.paymentNote && (
          <div className="flex justify-between">
            <span>Obs.</span>
            <span>{sale.paymentNote}</span>
          </div>
        )}
      </div>

      {sale.status === "CANCELLED" && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          VENDA CANCELADA{sale.cancelReason ? ` — ${sale.cancelReason}` : ""}
        </div>
      )}

      <p className="mt-4 text-center text-[10px] text-slate-400">
        PetFlow — Obrigado pela preferência!
      </p>
    </div>
  );
}
