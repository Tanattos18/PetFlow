"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import type { CashSessionDto } from "../../../lib/types";

interface CloseResult {
  expectedBalance: string;
  countedAmount: string;
  differenceBalance: string;
}

export default function FecharCaixaPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState<CashSessionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countedAmount, setCountedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CloseResult | null>(null);

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
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.replace("/caixa");
        return;
      }
      setError(err instanceof Error ? err.message : "Não foi possível carregar o caixa.");
    }
  }, [router]);

  useEffect(() => {
    if (session) {
      void loadCash();
    }
  }, [session, loadCash]);

  async function handleClose(event: FormEvent) {
    event.preventDefault();
    if (!cash) return;
    setError(null);
    setSaving(true);
    try {
      const closed = await api<CashSessionDto>(`/api/cash/sessions/${cash.id}/close`, {
        method: "POST",
        body: JSON.stringify({
          countedAmount,
          notes: notes.trim() ? notes.trim() : undefined,
        }),
      });
      setResult({
        expectedBalance: closed.expectedBalance,
        countedAmount: closed.countedAmount ?? countedAmount,
        differenceBalance: closed.differenceBalance ?? "0.00",
      });
      setCash(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível fechar o caixa.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

  if (result) {
    const difference = Number(result.differenceBalance);
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <h2 className="text-xl font-semibold text-slate-900">Caixa fechado</h2>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Saldo esperado (calculado pelo sistema)</span>
            <span className="font-medium text-slate-900">
              R$ {Number(result.expectedBalance).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Valor contado</span>
            <span className="font-medium text-slate-900">
              R$ {Number(result.countedAmount).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-slate-600">
            <span>Diferença</span>
            <span
              className={`font-semibold ${difference === 0 ? "text-teal-700" : "text-red-700"}`}
            >
              R$ {difference.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="flex justify-center gap-2">
          <Link
            href="/caixa"
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Voltar ao caixa
          </Link>
          <Link
            href="/financeiro"
            className="rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
          >
            Ver resumo financeiro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Fechar caixa</h2>
        <Link href="/caixa" className="text-sm text-teal-700 hover:underline">
          Voltar
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {cash && (
        <>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Valor inicial de troco</span>
              <span className="font-medium text-slate-900">
                R$ {Number(cash.initialAmount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Entradas (dinheiro)</span>
              <span className="font-medium text-teal-700">
                + R$ {Number(cash.entriesTotal).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Saídas (dinheiro)</span>
              <span className="font-medium text-red-700">
                - R$ {Number(cash.exitsTotal).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-slate-600">
              <span className="font-medium text-slate-800">Saldo esperado</span>
              <span className="font-semibold text-slate-900">
                R$ {Number(cash.expectedBalance).toFixed(2)}
              </span>
            </div>
          </div>

          <form onSubmit={handleClose} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <label htmlFor="counted" className="mb-1 block text-sm text-slate-700">
                Valor contado fisicamente (R$) *
              </label>
              <input
                id="counted"
                inputMode="decimal"
                required
                value={countedAmount}
                onChange={(event) => setCountedAmount(event.target.value)}
                placeholder="0,00"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-500">
                A diferença entre o contado e o saldo esperado é calculada pelo servidor.
              </p>
            </div>
            <div>
              <label htmlFor="close-notes" className="mb-1 block text-sm text-slate-700">
                Observações
              </label>
              <input
                id="close-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              {saving ? "Fechando..." : "Confirmar fechamento"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
