"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import {
  cashMovementOriginLabels,
  cashMovementTypeLabels,
  type CashMovementDto,
  type CashMovementType,
  type CashSessionDto,
  type Paginated,
} from "../../lib/types";

export default function CaixaPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState<CashSessionDto | null>(null);
  const [recent, setRecent] = useState<CashMovementDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [opening, setOpening] = useState(false);
  const [initialAmount, setInitialAmount] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");

  const [type, setType] = useState<CashMovementType>("IN");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.user.role === "ADMIN";

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

  const loadCash = useCallback(async () => {
    try {
      const current = await api<CashSessionDto>("/api/cash/sessions/current", {
        redirectOnUnauthorized: false,
      });
      setCash(current);
      const movements = await api<Paginated<CashMovementDto>>(
        `/api/cash/movements?sessionId=${current.id}&pageSize=10`,
        { redirectOnUnauthorized: false },
      );
      setRecent(movements.items);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCash(null);
        setRecent([]);
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Não foi possível carregar o caixa.");
    }
  }, []);

  useEffect(() => {
    if (session) {
      void loadCash();
    }
  }, [session, loadCash]);

  async function handleOpen(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api("/api/cash/sessions", {
        method: "POST",
        body: JSON.stringify({
          initialAmount,
          notes: openingNotes.trim() ? openingNotes.trim() : null,
        }),
      });
      setInitialAmount("");
      setOpeningNotes("");
      setOpening(false);
      setNotice("Caixa aberto com sucesso.");
      await loadCash();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível abrir o caixa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMovement(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api("/api/cash/movements", {
        method: "POST",
        body: JSON.stringify({
          type,
          amount,
          description: description.trim(),
          justification: type === "OUT" ? justification.trim() : undefined,
        }),
      });
      setAmount("");
      setDescription("");
      setJustification("");
      setNotice("Movimentação registrada.");
      await loadCash();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível registrar a movimentação.",
      );
    } finally {
      setSaving(false);
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
          <h2 className="text-xl font-semibold text-slate-900">Caixa</h2>
          <p className="text-sm text-slate-500">
            {cash
              ? `Sessão aberta em ${new Date(cash.openedAt).toLocaleString("pt-BR")} por ${cash.openedBy.name}.`
              : "Nenhuma sessão de caixa aberta."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financeiro"
            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Resumo financeiro
          </Link>
          <Link
            href="/caixa/movimentos"
            className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
          >
            Movimentações
          </Link>
          <Link
            href="/caixa/sessoes"
            className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
          >
            Histórico de sessões
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      )}

      {!cash && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="font-semibold text-amber-900">Caixa fechado</h3>
          <p className="mt-1 text-sm text-amber-800">
            Vendas, cancelamentos e movimentações manuais exigem um caixa aberto.
          </p>
          {isAdmin ? (
            opening ? (
              <form onSubmit={handleOpen} className="mt-4 grid max-w-md gap-3">
                <div>
                  <label htmlFor="open-amount" className="mb-1 block text-sm text-amber-900">
                    Valor inicial de troco (R$) *
                  </label>
                  <input
                    id="open-amount"
                    inputMode="decimal"
                    required
                    value={initialAmount}
                    onChange={(event) => setInitialAmount(event.target.value)}
                    placeholder="0,00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="open-notes" className="mb-1 block text-sm text-amber-900">
                    Observações
                  </label>
                  <input
                    id="open-notes"
                    value={openingNotes}
                    onChange={(event) => setOpeningNotes(event.target.value)}
                    placeholder="Opcional"
                    className={inputClass}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                  >
                    {saving ? "Abrindo..." : "Confirmar abertura"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpening(false)}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setOpening(true)}
                className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                Abrir caixa
              </button>
            )
          ) : (
            <p className="mt-3 text-sm text-amber-800">
              Peça a um administrador para abrir o caixa.
            </p>
          )}
        </section>
      )}

      {cash && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
              <p className="text-xs uppercase text-teal-700">Saldo esperado</p>
              <p className="mt-1 text-2xl font-semibold text-teal-900">
                R$ {Number(cash.expectedBalance).toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-500">Entradas (dinheiro)</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                R$ {Number(cash.entriesTotal).toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-500">Saídas (dinheiro)</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                R$ {Number(cash.exitsTotal).toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-500">Vendas na sessão</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                R$ {Number(cash.salesTotal).toFixed(2)}
              </p>
            </div>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-600">
              Valor inicial de troco:{" "}
              <strong className="text-slate-900">
                R$ {Number(cash.initialAmount).toFixed(2)}
              </strong>
              {cash.openingNotes && <span className="text-slate-500"> — {cash.openingNotes}</span>}
            </div>
            <Link
              href="/caixa/fechar"
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Fechar caixa
            </Link>
          </section>

          {isAdmin && (
            <form
              onSubmit={handleMovement}
              className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
            >
              <div>
                <label htmlFor="movement-type" className="mb-1 block text-sm text-slate-700">
                  Tipo
                </label>
                <select
                  id="movement-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as CashMovementType)}
                  className={inputClass}
                >
                  <option value="IN">Entrada</option>
                  <option value="OUT">Saída</option>
                </select>
              </div>
              <div>
                <label htmlFor="movement-amount" className="mb-1 block text-sm text-slate-700">
                  Valor (R$) *
                </label>
                <input
                  id="movement-amount"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0,00"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label htmlFor="movement-description" className="mb-1 block text-sm text-slate-700">
                  Descrição *
                </label>
                <input
                  id="movement-description"
                  required
                  minLength={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ex.: pagamento de fornecedor"
                  className={inputClass}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {saving ? "Registrando..." : "Registrar"}
                </button>
              </div>
              {type === "OUT" && (
                <div className="sm:col-span-2 lg:col-span-5">
                  <label
                    htmlFor="movement-justification"
                    className="mb-1 block text-sm text-slate-700"
                  >
                    Justificativa (obrigatória para saídas) *
                  </label>
                  <input
                    id="movement-justification"
                    required
                    minLength={3}
                    value={justification}
                    onChange={(event) => setJustification(event.target.value)}
                    placeholder="Motivo da saída de dinheiro"
                    className={inputClass}
                  />
                </div>
              )}
            </form>
          )}

          <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-xs uppercase text-slate-500">
              Movimentações recentes
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((movement) => (
                  <tr key={movement.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(movement.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          movement.type === "IN"
                            ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                            : "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                        }
                      >
                        {cashMovementTypeLabels[movement.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {cashMovementOriginLabels[movement.origin]}
                      {movement.reversedAt && (
                        <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                          Estornado
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-700">
                      {movement.description}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {movement.type === "IN" ? "+" : "-"} R${" "}
                      {Number(movement.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {!recent.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma movimentação nesta sessão.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <div className="text-right">
            <Link href="/caixa/movimentos" className="text-sm text-teal-700 hover:underline">
              Ver todas as movimentações
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
