const modules = [
  { name: "Produtos e estoque", description: "Catálogo e controle de estoque" },
  { name: "Vendas e PDV", description: "Frente de caixa e histórico de vendas" },
  { name: "Caixa e financeiro", description: "Movimentações e conciliação" },
  { name: "Clientes e animais", description: "Cadastro de tutores e pets" },
  { name: "Serviços e agendamentos", description: "Banho, tosa e agenda" },
  { name: "Automação WhatsApp", description: "Mensagens e atendimento automatizado" },
  { name: "Dashboard e relatórios", description: "Indicadores gerenciais" },
];

export default function HomePage() {
  return (
    <div>
      <section className="mb-10">
        <h2 className="mb-2 text-2xl font-semibold text-slate-900">
          Bem-vindo ao PetFlow
        </h2>
        <p className="max-w-2xl text-slate-600">
          Fundação técnica do SaaS de gestão para pet shops. Nesta etapa apenas a
          estrutura do projeto está disponível; os módulos de negócio serão
          entregues nas próximas etapas.
        </p>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Módulos planejados
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <div
              key={module.name}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h4 className="font-medium text-slate-800">{module.name}</h4>
                <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  Em breve
                </span>
              </div>
              <p className="text-sm text-slate-500">{module.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
