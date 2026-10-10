import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PetFlow",
  description: "SaaS de gestão para pet shops",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                🐾
              </span>
              <div>
                <h1 className="text-lg font-semibold text-teal-800">PetFlow</h1>
                <p className="text-xs text-slate-500">Gestão para pet shops</p>
              </div>
            </div>
            <nav>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                Etapa 7 — Dashboard e relatórios
              </span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          PetFlow © {new Date().getFullYear()} — módulos de negócio em desenvolvimento
        </footer>
      </body>
    </html>
  );
}
