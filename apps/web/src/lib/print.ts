import type { SaleDto } from "./types";
import { paymentMethodLabels, saleStatusLabels, productUnitLabels } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printReceipt(sale: SaleDto, companyName: string): boolean {
  const rows = sale.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.productName)}</td>
        <td class="num">${Number(item.quantity)} ${productUnitLabels[item.unit]} × R$ ${Number(item.unitPrice).toFixed(2)}</td>
        <td class="num">R$ ${Number(item.subtotal).toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const cancelledBlock =
    sale.status === "CANCELLED"
      ? `<p class="cancelled">VENDA CANCELADA${sale.cancelReason ? ` — ${escapeHtml(sale.cancelReason)}` : ""}</p>`
      : "";

  const noteBlock = sale.paymentNote
    ? `<p class="row"><span>Obs.</span><span>${escapeHtml(sale.paymentNote)}</span></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Comprovante ${escapeHtml(sale.receiptCode)}</title>
<style>
  body { font-family: "Courier New", monospace; font-size: 12px; width: 260px; margin: 0 auto; color: #000; }
  h1 { font-size: 14px; text-align: center; margin: 12px 0 2px; }
  .center { text-align: center; margin: 0; color: #444; }
  hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  .num { text-align: right; white-space: nowrap; }
  .total { font-size: 14px; font-weight: bold; }
  .cancelled { border: 1px solid #000; text-align: center; padding: 4px; font-weight: bold; margin: 8px 0; }
</style>
</head>
<body>
  <h1>${escapeHtml(companyName)}</h1>
  <p class="center">Comprovante de venda</p>
  <hr />
  <p class="row"><span>Código</span><span>${escapeHtml(sale.receiptCode)}</span></p>
  <p class="row"><span>Data</span><span>${new Date(sale.createdAt).toLocaleString("pt-BR")}</span></p>
  <p class="row"><span>Vendedor</span><span>${escapeHtml(sale.createdBy.name)}</span></p>
  <p class="row"><span>Status</span><span>${saleStatusLabels[sale.status]}</span></p>
  <hr />
  <table>
    <tbody>${rows}</tbody>
  </table>
  <hr />
  <p class="row"><span>Subtotal</span><span>R$ ${Number(sale.subtotal).toFixed(2)}</span></p>
  <p class="row"><span>Desconto</span><span>- R$ ${Number(sale.discount).toFixed(2)}</span></p>
  <p class="row total"><span>Total</span><span>R$ ${Number(sale.total).toFixed(2)}</span></p>
  <p class="row"><span>Pagamento</span><span>${paymentMethodLabels[sale.paymentMethod]}</span></p>
  ${noteBlock}
  <hr />
  ${cancelledBlock}
  <p class="center">Obrigado pela preferência!</p>
</body>
</html>`;

  const win = window.open("", "_blank", "width=360,height=640");
  if (!win) {
    return false;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
